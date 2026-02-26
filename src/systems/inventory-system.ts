import { Player } from "../entities/player";
import { UIManager } from "../ui/ui-manager";

export interface Item {
  id: string;
  name: string;
  description: string;
  icon?: string;
  stackable: boolean;
  quantity: number;
  slot?: string; // equipment slot this item can go in (mainHand, offHand, armor, head, feet, accessory)
  stats?: any;
}

export class InventorySystem {
  public items: Item[] = [];
  public maxCapacity: number = 20;
  public isOpen: boolean = false;
  public _player: Player;
  public _ui: UIManager;
  public _canvas: HTMLCanvasElement;

  // Equipment slots
  public equipped: Map<string, Item> = new Map();
  private _equipmentSlots = ["mainHand", "offHand", "armor", "head", "feet", "accessory"];

  constructor(player: Player, ui: UIManager, canvas: HTMLCanvasElement) {
    this._player = player;
    this._ui = ui;
    this._canvas = canvas;
    this._initEquipmentSlots();
  }

  private _initEquipmentSlots(): void {
    for (const slot of this._equipmentSlots) {
      this.equipped.set(slot, null as any);
    }
  }

  public addItem(newItem: Item): boolean {
    // Check if stackable
    if (newItem.stackable) {
      const existingItem = this.items.find(i => i.id === newItem.id);
      if (existingItem) {
        existingItem.quantity += newItem.quantity;
        this._updateUI();
        this._ui.showNotification(`Added ${newItem.quantity}x ${newItem.name}`);
        return true;
      }
    }

    if (this.items.length >= this.maxCapacity) {
      console.log("Inventory full!");
      this._ui.showNotification("Inventory Full!", 2000);
      return false;
    }

    // Add new item
    this.items.push({ ...newItem });
    this._updateUI();
    this._ui.showNotification(`Added ${newItem.name}`);
    return true;
  }

  public removeItem(itemId: string, amount: number = 1): boolean {
    const index = this.items.findIndex(i => i.id === itemId);
    if (index === -1) return false;

    const item = this.items[index];
    if (item.quantity > amount) {
      item.quantity -= amount;
    } else {
      this.items.splice(index, 1);
    }
    this._updateUI();
    return true;
  }

  /**
   * Equip an item to a slot. Unequips existing item in that slot.
   */
  public equip(itemId: string, slot: string): boolean {
    const itemIndex = this.items.findIndex(i => i.id === itemId);
    if (itemIndex === -1) return false;

    const item = this.items[itemIndex];

    // Check if item can go in this slot
    if (!this._canEquip(item, slot)) {
      this._ui.showNotification(`${item.name} cannot go in ${slot} slot!`, 2000);
      return false;
    }

    // Unequip existing item
    const prevEquipped = this.equipped.get(slot);
    if (prevEquipped) {
      this.unequip(slot);
    }

    // Equip the new item
    this.equipped.set(slot, item);
    this.removeItem(itemId, 1); // Remove from inventory

    // Apply equipment bonuses to player
    this._player.applyEquipmentBonus(item);

    // Update armor visual if this is armor
    const totalArmor = this._getTotalArmor();
    this._player.updateArmorVisual(totalArmor);

    this._ui.showNotification(`Equipped ${item.name}`);
    this._updateUI();
    return true;
  }

  /**
   * Unequip an item from a slot and return it to inventory.
   */
  public unequip(slot: string): boolean {
    const item = this.equipped.get(slot);
    if (!item) return false;

    // Remove equipment bonuses from player
    this._player.removeEquipmentBonus(item);

    // Return to inventory
    if (!this.addItem(item)) {
      // If inventory is full, re-equip
      this._player.applyEquipmentBonus(item);
      return false;
    }

    this.equipped.set(slot, null as any);

    // Update armor visual
    const totalArmor = this._getTotalArmor();
    this._player.updateArmorVisual(totalArmor);

    this._ui.showNotification(`Unequipped ${item.name}`);
    this._updateUI();
    return true;
  }

  /**
   * Calculate total armor from equipped items.
   */
  private _getTotalArmor(): number {
    let totalArmor = 0;
    for (const [_, item] of this.equipped) {
      if (item?.stats?.armor) {
        totalArmor += item.stats.armor;
      }
    }
    return totalArmor;
  }

  /**
   * Check if an item can be equipped to a slot.
   */
  private _canEquip(item: Item, slot: string): boolean {
    // If item has a preferred slot, check it matches
    if (item.slot && item.slot !== slot) {
      return false;
    }
    // Otherwise allow equipping to any slot (flexible system)
    return true;
  }

  /**
   * Swap two items in inventory.
   */
  public swapItems(fromIndex: number, toIndex: number): boolean {
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= this.items.length || toIndex >= this.items.length) {
      return false;
    }
    [this.items[fromIndex], this.items[toIndex]] = [this.items[toIndex], this.items[fromIndex]];
    this._updateUI();
    return true;
  }

  /**
   * Get all equipment slots and their contents.
   */
  public getEquipment(): Array<{ slot: string; item: Item | null }> {
    return this._equipmentSlots.map(slot => ({
      slot,
      item: this.equipped.get(slot) || null,
    }));
  }

  /**
   * Toggle inventory visibility. Optionally pass explicit state.
   */
  public toggleInventory(visible?: boolean): void {
    if (visible !== undefined) {
      this.isOpen = visible;
    } else {
      this.isOpen = !this.isOpen;
    }

    if (this.isOpen) {
      this._ui.toggleInventory(true);
      this._ui.setInteractionText("");
      document.exitPointerLock();
      this._player.camera.detachControl();
      this._updateUI();
    } else {
      this._ui.toggleInventory(false);
      this._canvas.requestPointerLock();
      this._player.camera.attachControl(this._canvas, true);
    }
  }

  private _updateUI(): void {
    this._ui.updateInventory(
      this.items,
      this.getEquipment(),
      {
        onEquip: (itemId: string, slot: string) => this.equip(itemId, slot),
        onUnequip: (slot: string) => this.unequip(slot),
      }
    );
  }
}
