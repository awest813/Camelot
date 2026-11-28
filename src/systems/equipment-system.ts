import { Player } from "../entities/player";
import { Item, InventorySystem } from "./inventory-system";
import { UIManager } from "../ui/ui-manager";
import type { GameEventBus } from "./event-bus";

export type EquipSlot = "mainHand" | "offHand" | "head" | "chest" | "legs" | "feet";

export class EquipmentSystem {
  /** Where this reports what happened (the game's event bus). */
  public events: GameEventBus | null = null;

  private _slots: Map<EquipSlot, Item> = new Map();
  private _player: Player;
  private _inventory: InventorySystem;
  private _ui: UIManager;

  constructor(player: Player, inventory: InventorySystem, ui: UIManager) {
    this._player = player;
    this._inventory = inventory;
    this._ui = ui;
  }

  /**
   * A click on an item: worn gear (the object in its slot) comes off; an item
   * from the bag is put on, the worn one in its slot going to the bag. (By
   * object, not id: a spare Iron Sword in the bag is put on, not taken for
   * the worn one.)
   */
  public handleItemClick(item: Item): void {
    if (!item.slot) return;
    for (const [slot, worn] of this._slots) {
      if (worn === item) { this.unequip(slot); return; }
    }
    this.equip(item);
  }

  public equip(item: Item): void {
    if (!item.slot) return;
    const slot = item.slot as EquipSlot;

    // Out of the bag first (the exact copy clicked: two Iron Swords may
    // differ in wear), so the worn one always has room to go back.
    this._inventory.removeInstance(item, 1);
    const current = this._slots.get(slot);
    if (current) {
      this._removeStats(current);
      this._inventory.addItem({ ...current }, { quiet: true });
    }

    // Equip
    this._slots.set(slot, { ...item, quantity: 1 });
    this._applyStats(item);

    this._refreshUI();
    this._ui.showNotification(`Equipped ${item.name}`);
    this.events?.emit("equipment:changed", {});
  }

  public unequip(slot: EquipSlot): void {
    const item = this._slots.get(slot);
    if (!item) return;
    // Into the bag the usual way (its room, carry weight): a full bag keeps it worn.
    if (!this._inventory.addItem({ ...item }, { quiet: true })) return;

    this._removeStats(item);
    this._slots.delete(slot);

    this._refreshUI();
    this._ui.showNotification(`Unequipped ${item.name}`);
    this.events?.emit("equipment:changed", {});
  }

  public getEquipped(): Map<EquipSlot, Item> {
    return this._slots;
  }

  public isEquipped(itemId: string): boolean {
    for (const item of this._slots.values()) {
      if (item.id === itemId) return true;
    }
    return false;
  }

  public getEquippedIds(): Set<string> {
    const ids = new Set<string>();
    for (const item of this._slots.values()) {
      ids.add(item.id);
    }
    return ids;
  }

  /**
   * Equip an item directly into a slot without touching inventory or the UI.
   * Used by SaveSystem when restoring saved equipment.
   */
  public equipSilent(item: Item, slot: EquipSlot): void {
    const current = this._slots.get(slot);
    if (current) this._removeStats(current);
    this._slots.set(slot, { ...item, quantity: 1 });
    this._applyStats(item);
  }

  /**
   * Remove an item from a slot without touching inventory or the UI.
   * Used by SaveSystem when clearing equipment before a load.
   */
  public unequipSilent(slot: EquipSlot): void {
    const item = this._slots.get(slot);
    if (!item) return;
    this._removeStats(item);
    this._slots.delete(slot);
  }

  /** Trigger a full UI sync. Called by SaveSystem after restoring all state. */
  public refreshUI(): void {
    this._refreshUI();
  }

  private _refreshUI(): void {
    this._ui.setEquippedIds(this.getEquippedIds());
    this._ui.updateInventory(this._inventory.items);
    this._ui.updateEquipment(this._slots);
  }

  private _applyStats(item: Item): void {
    if (!item.stats) return;
    if (item.stats.damage) this._player.bonusDamage += item.stats.damage;
    if (item.stats.armor) this._player.bonusArmor += item.stats.armor;
    if (item.stats.healthBonus) this._player.maxHealth += item.stats.healthBonus;
    if (item.stats.magickaBonus) this._player.maxMagicka += item.stats.magickaBonus;
    if (item.stats.staminaBonus) this._player.maxStamina += item.stats.staminaBonus;
  }

  private _removeStats(item: Item): void {
    if (!item.stats) return;
    if (item.stats.damage) this._player.bonusDamage -= item.stats.damage;
    if (item.stats.armor) this._player.bonusArmor -= item.stats.armor;
    if (item.stats.healthBonus) this._player.maxHealth = Math.max(1, this._player.maxHealth - item.stats.healthBonus);
    if (item.stats.magickaBonus) this._player.maxMagicka = Math.max(1, this._player.maxMagicka - item.stats.magickaBonus);
    if (item.stats.staminaBonus) this._player.maxStamina = Math.max(1, this._player.maxStamina - item.stats.staminaBonus);
  }
}
