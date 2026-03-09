import type { InventorySystem, Item } from "./inventory-system";
import type { UIManager } from "../ui/ui-manager";
import type { Player } from "../entities/player";

// ── Quick-slot key type ───────────────────────────────────────────────────────

export type QuickSlotKey = "7" | "8" | "9" | "0";

export const QUICK_SLOT_KEYS: readonly QuickSlotKey[] = ["7", "8", "9", "0"] as const;

// ── Save / load ───────────────────────────────────────────────────────────────

export interface QuickSlotSaveState {
  slots: Record<QuickSlotKey, string | null>;
}

// ── System ────────────────────────────────────────────────────────────────────

/**
 * QuickSlotSystem — hotkey bindings for consumable items.
 *
 * Maps keys 7, 8, 9, 0 to inventory item IDs so the player can consume
 * potions / scrolls without opening the inventory screen.  Only items
 * that carry a `heal` or `magicka` or `stamina` stat value are treated
 * as consumables.
 *
 * Items are resolved from the live inventory at use-time so stale slot
 * bindings gracefully report "not in inventory" rather than crashing.
 *
 * Wire-up example (game.ts):
 * ```ts
 * this.quickSlotSystem = new QuickSlotSystem(this.inventorySystem, this.player, this.ui);
 * this.quickSlotSystem.onItemConsumed = (item, key) => {
 *   this.eventBus.emit("player:consumeItem", { itemId: item.id });
 * };
 * // Bind a starter health potion to slot 7
 * this.quickSlotSystem.bindSlot("7", "potion_hp_01");
 * // In keyboard handler:
 * this.quickSlotSystem.useSlot("7");
 * ```
 */
export class QuickSlotSystem {
  private _slots: Record<QuickSlotKey, string | null> = {
    "7": null,
    "8": null,
    "9": null,
    "0": null,
  };

  private readonly _inventory: InventorySystem;
  private readonly _player: Player;
  private readonly _ui: UIManager;

  /** Fired after an item is successfully consumed. Useful for event bus integration. */
  public onItemConsumed: ((item: Item, key: QuickSlotKey) => void) | null = null;

  constructor(inventory: InventorySystem, player: Player, ui: UIManager) {
    this._inventory = inventory;
    this._player    = player;
    this._ui        = ui;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Bind an item ID to a quick-slot key.
   * Pass `null` to clear the slot.
   */
  public bindSlot(key: QuickSlotKey, itemId: string | null): void {
    this._slots[key] = itemId;
  }

  /** Returns the item ID bound to a key, or null if empty. */
  public getSlotItemId(key: QuickSlotKey): string | null {
    return this._slots[key];
  }

  /**
   * Returns all slot bindings as an array for HUD display.
   * Each entry has `key`, `itemId`, and the resolved `item` (or null if
   * the bound item is not currently in the player's inventory).
   */
  public getSlots(): Array<{ key: QuickSlotKey; itemId: string | null; item: Item | null }> {
    return QUICK_SLOT_KEYS.map((k) => {
      const id   = this._slots[k];
      const item = id ? (this._inventory.items.find((i) => i.id === id) ?? null) : null;
      return { key: k, itemId: id, item };
    });
  }

  /**
   * Use the item bound to the given key.
   *
   * Behaviour:
   *  - Empty slot → notification "Slot <key>: empty", returns false.
   *  - Slot bound but item not in inventory → notification + returns false.
   *  - Item is not a consumable → notification + returns false.
   *  - Consumable found → effects applied to player, item removed (quantity - 1),
   *    `onItemConsumed` fires, returns true.
   *
   * Consumable detection: item must have at least one of `stats.heal`,
   * `stats.magicka`, or `stats.stamina` set to a positive value.
   */
  public useSlot(key: QuickSlotKey): boolean {
    const itemId = this._slots[key];

    if (!itemId) {
      this._ui.showNotification(`Slot ${key}: empty`, 1000);
      return false;
    }

    const item = this._inventory.items.find((i) => i.id === itemId);
    if (!item) {
      this._ui.showNotification(`Slot ${key}: item not in inventory`, 1500);
      return false;
    }

    if (!this._isConsumable(item)) {
      this._ui.showNotification(`${item.name}: not a consumable`, 1500);
      return false;
    }

    // Apply effects
    this._applyStatRestore("heal",    "health",  "maxHealth",  "HP",      item);
    this._applyStatRestore("magicka", "magicka", "maxMagicka", "Magicka", item);
    this._applyStatRestore("stamina", "stamina", "maxStamina", "Stamina", item);

    // Remove one from inventory
    this._inventory.removeItem(itemId, 1);

    this.onItemConsumed?.(item, key);
    return true;
  }

  // ── Save / Load ───────────────────────────────────────────────────────────

  public getSaveState(): QuickSlotSaveState {
    return { slots: { ...this._slots } };
  }

  public restoreFromSave(data: QuickSlotSaveState): void {
    for (const key of QUICK_SLOT_KEYS) {
      const v = data.slots[key];
      this._slots[key] = typeof v === "string" ? v : null;
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _isConsumable(item: Item): boolean {
    const s = item.stats;
    if (!s) return false;
    return (
      (typeof s.heal    === "number" && s.heal    > 0) ||
      (typeof s.magicka === "number" && s.magicka > 0) ||
      (typeof s.stamina === "number" && s.stamina > 0)
    );
  }

  /**
   * Apply a single stat restoration to the player.
   *
   * @param statKey    Key on `item.stats` that holds the restore amount.
   * @param playerStat Player property to increase (e.g. `"health"`).
   * @param playerMax  Player property for the maximum value (e.g. `"maxHealth"`).
   * @param label      Display label used in the notification (e.g. `"HP"`).
   * @param item       The consumable item being used.
   */
  private _applyStatRestore(
    statKey: string,
    playerStat: "health" | "magicka" | "stamina",
    playerMax: "maxHealth" | "maxMagicka" | "maxStamina",
    label: string,
    item: Item,
  ): void {
    const amount = item.stats?.[statKey];
    if (typeof amount !== "number" || amount <= 0) return;
    const current = this._player[playerStat];
    const max     = this._player[playerMax];
    const restored = Math.min(amount, max - current);
    this._player[playerStat] = Math.min(max, current + amount);
    if (restored > 0) {
      this._ui.showNotification(`Restored ${Math.round(restored)} ${label}`, 1500);
    }
  }
}
