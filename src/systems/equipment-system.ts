import { Player } from "../entities/player";
import { Item, InventorySystem } from "./inventory-system";
import { UIManager } from "../ui/ui-manager";

export type EquipSlot = "mainHand" | "offHand" | "head" | "chest" | "legs" | "feet";

export class EquipmentSystem {
  private _slots: Map<EquipSlot, Item> = new Map();
  private _player: Player;
  private _inventory: InventorySystem;
  private _ui: UIManager;

  constructor(player: Player, inventory: InventorySystem, ui: UIManager) {
    this._player = player;
    this._inventory = inventory;
    this._ui = ui;
  }

  /** Called when a player clicks an inventory item. Equips it if unequipped, unequips if already equipped. */
  public handleItemClick(item: Item): void {
    if (!item.slot) return;
    const slot = item.slot as EquipSlot;
    if (this.isEquipped(item.id)) {
      this.unequip(slot);
    } else {
      this.equip(item);
    }
  }

  public equip(item: Item): void {
    if (!item.slot) return;
    const slot = item.slot as EquipSlot;

    // If something is already in this slot, swap it back to inventory
    const current = this._slots.get(slot);
    if (current) {
      this._removeStats(current);
      this._inventory.items.push({ ...current });
    }

    // Remove from inventory (non-stackable equippables — remove one)
    this._inventory.removeItem(item.id, 1);

    // Equip
    this._slots.set(slot, { ...item, quantity: 1 });
    this._applyStats(item);

    this._refreshUI();
    this._ui.showNotification(`Equipped ${item.name}`);
  }

  public unequip(slot: EquipSlot): void {
    const item = this._slots.get(slot);
    if (!item) return;

    this._removeStats(item);
    this._slots.delete(slot);
    this._inventory.items.push({ ...item });

    this._refreshUI();
    this._ui.showNotification(`Unequipped ${item.name}`);
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
