import {
  EquipSlot,
  InventoryEntry,
  InventoryOperationResult,
  InventorySnapshot,
  ItemDefinition,
} from "./inventory-types";

export class InventoryEngine {
  private _definitions: Map<string, ItemDefinition>;
  private _items: Map<string, number> = new Map();
  private _equipped: Partial<Record<EquipSlot, string>> = {};
  private _capacity: number;

  constructor(definitions: ItemDefinition[], capacity: number = 20) {
    this._definitions = new Map(definitions.map((item) => [item.id, item]));
    this._capacity = Math.max(1, Math.floor(capacity));
  }

  public getSnapshot(): InventorySnapshot {
    const items: InventoryEntry[] = Array.from(this._items.entries())
      .map(([itemId, quantity]) => ({ itemId, quantity }))
      .sort((a, b) => a.itemId.localeCompare(b.itemId));

    return {
      capacity: this._capacity,
      items,
      equipped: { ...this._equipped },
    };
  }

  public getItemCount(itemId: string): number {
    return this._items.get(itemId) ?? 0;
  }

  public setCapacity(capacity: number): void {
    this._capacity = Math.max(1, Math.floor(capacity));
  }

  public addItem(itemId: string, quantity: number = 1): InventoryOperationResult {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return this._fail("INVALID_QUANTITY", "Quantity must be greater than zero.");
    }

    const item = this._definitions.get(itemId);
    if (!item) {
      return this._fail("UNKNOWN_ITEM", `Unknown item: ${itemId}`);
    }

    const currentQuantity = this.getItemCount(itemId);
    const nextQuantity = currentQuantity + quantity;

    if (item.stackable && item.maxStack !== undefined && nextQuantity > item.maxStack) {
      return this._fail(
        "STACK_LIMIT_EXCEEDED",
        `${item.name} exceeds stack limit (${item.maxStack}).`
      );
    }

    const slotCost = this._getSlotCost(item, quantity);
    if (this._getUsedSlots() + slotCost > this._capacity) {
      return this._fail("CAPACITY_EXCEEDED", "Inventory capacity exceeded.");
    }

    this._items.set(itemId, nextQuantity);
    return this._ok(`Added ${quantity}x ${item.name}.`);
  }

  public removeItem(itemId: string, quantity: number = 1): InventoryOperationResult {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return this._fail("INVALID_QUANTITY", "Quantity must be greater than zero.");
    }

    const item = this._definitions.get(itemId);
    if (!item) {
      return this._fail("UNKNOWN_ITEM", `Unknown item: ${itemId}`);
    }

    const currentQuantity = this.getItemCount(itemId);
    if (currentQuantity < quantity) {
      return this._fail("INSUFFICIENT_ITEMS", `Not enough ${item.name}.`);
    }

    const remaining = currentQuantity - quantity;
    if (remaining <= 0) {
      this._items.delete(itemId);
    } else {
      this._items.set(itemId, remaining);
    }

    return this._ok(`Removed ${quantity}x ${item.name}.`);
  }

  public equipItem(itemId: string, slot: EquipSlot): InventoryOperationResult {
    const item = this._definitions.get(itemId);
    if (!item) {
      return this._fail("UNKNOWN_ITEM", `Unknown item: ${itemId}`);
    }
    if (!item.slot) {
      return this._fail("NOT_EQUIPPABLE", `${item.name} cannot be equipped.`);
    }
    if (item.slot !== slot) {
      return this._fail("SLOT_MISMATCH", `${item.name} can only be equipped to ${item.slot}.`);
    }
    if (this.getItemCount(itemId) <= 0) {
      return this._fail("INSUFFICIENT_ITEMS", `No ${item.name} available to equip.`);
    }

    const currentlyEquipped = this._equipped[slot];
    if (currentlyEquipped === itemId) {
      return this._ok(`${item.name} is already equipped in ${slot}.`);
    }

    if (currentlyEquipped) {
      const unequipResult = this.unequipSlot(slot);
      if (!unequipResult.success) {
        return unequipResult;
      }
    }

    this._items.set(itemId, this.getItemCount(itemId) - 1);
    if (this.getItemCount(itemId) <= 0) {
      this._items.delete(itemId);
    }
    this._equipped[slot] = itemId;

    return this._ok(`Equipped ${item.name} to ${slot}.`);
  }

  public unequipSlot(slot: EquipSlot): InventoryOperationResult {
    const itemId = this._equipped[slot];
    if (!itemId) {
      return this._ok(`No item equipped in ${slot}.`);
    }

    const item = this._definitions.get(itemId);
    if (!item) {
      delete this._equipped[slot];
      return this._ok(`Cleared invalid equipment slot: ${slot}.`);
    }

    const slotCost = this._getSlotCost(item, 1);
    if (this._getUsedSlots() + slotCost > this._capacity) {
      return this._fail("SLOT_OCCUPIED", `Cannot unequip ${item.name}; inventory is full.`);
    }

    this._items.set(itemId, this.getItemCount(itemId) + 1);
    delete this._equipped[slot];
    return this._ok(`Unequipped ${item.name} from ${slot}.`);
  }

  public restoreSnapshot(snapshot: InventorySnapshot): void {
    this._capacity = Math.max(1, Math.floor(snapshot.capacity));
    this._items.clear();
    for (const entry of snapshot.items) {
      if (!this._definitions.has(entry.itemId)) continue;
      if (!Number.isFinite(entry.quantity) || entry.quantity <= 0) continue;
      this._items.set(entry.itemId, Math.floor(entry.quantity));
    }
    this._equipped = { ...snapshot.equipped };
  }

  private _getSlotCost(item: ItemDefinition, quantity: number): number {
    const currentQuantity = this.getItemCount(item.id);
    if (item.stackable) {
      return currentQuantity > 0 ? 0 : 1;
    }
    return quantity;
  }

  private _getUsedSlots(): number {
    let used = 0;
    for (const [itemId, quantity] of this._items.entries()) {
      const def = this._definitions.get(itemId);
      if (!def) continue;
      if (def.stackable) {
        used += 1;
      } else {
        used += quantity;
      }
    }
    return used;
  }

  private _ok(message: string): InventoryOperationResult {
    return {
      success: true,
      message,
      snapshot: this.getSnapshot(),
    };
  }

  private _fail(reason: InventoryOperationResult["reason"], message: string): InventoryOperationResult {
    return {
      success: false,
      reason,
      message,
      snapshot: this.getSnapshot(),
    };
  }
}
