/**
 * The player's pack as the rest of the game sees it: gold (one stack of
 * coins) and items, and the mapping between framework item ids and the
 * game's own.  The game's inventory is the only player inventory: framework
 * dialogue conditions, item costs and rewards read and write it through
 * this (the runtime's dialogue host hooks).  It used to be mirrored into the
 * framework's own inventory engine, which nothing read.
 *
 * Moved out of game.ts (engine overhaul, Phase 1).
 */
import type { Item } from "../systems/inventory-system";
import { HEALTH_POTION_STATS, stockItem } from "../content/starter-merchants";

export const GOLD_ITEM_ID = "gold_coins";

/** Framework item ids the game names differently. */
const FRAMEWORK_TO_GAME: Readonly<Record<string, string>> = {
  health_potion: "potion_hp_01",
  iron_sword: "sword_01",
};

/** A stack of `quantity` gold coins. */
export function goldCoins(quantity: number): Item {
  return {
    id: GOLD_ITEM_ID, name: "Gold Coins", description: "Currency for trade and fines.",
    stackable: true, quantity, weight: 0.1, stats: { value: 1 },
  };
}

export interface PackInventory {
  items: Item[];
  addItem(item: Item, opts?: { quiet?: boolean; overfill?: boolean }): boolean;
  removeItem(itemId: string, amount?: number): boolean;
}

export interface FrameworkItemDef { name: string; description: string; stackable: boolean; slot?: Item["slot"] }

export class PlayerPack {
  constructor(
    private readonly _inv: () => PackInventory,
    /** A framework item's definition (for items dialogue or quests give). */
    private readonly _itemDef: (id: string) => FrameworkItemDef | undefined,
  ) {}

  public gold(): number {
    return this._inv().items.find((i) => i.id === GOLD_ITEM_ID)?.quantity ?? 0;
  }

  /** Take gold; false (and nothing taken) when there isn't enough. */
  public spendGold(amount: number): boolean {
    if (amount <= 0) return true;
    if (this.gold() < amount) return false;
    return this._inv().removeItem(GOLD_ITEM_ID, amount);
  }

  public addGold(amount: number, opts?: { quiet?: boolean }): void {
    if (amount <= 0) return;
    this._inv().addItem(goldCoins(amount), { ...opts, overfill: true }); // the purse is never refused
  }

  /** Make the gold stack equal `target` (barter keeps its own running total). */
  public setGold(target: number): void {
    const want = Math.max(0, Math.floor(target));
    const have = this.gold();
    if (have > want) this._inv().removeItem(GOLD_ITEM_ID, have - want);
    else if (want > have) this._inv().addItem(goldCoins(want - have), { overfill: true });
  }

  /** How many of a framework item the player carries. */
  public count(frameworkId: string): number {
    if (frameworkId === GOLD_ITEM_ID) return this.gold();
    const id = FRAMEWORK_TO_GAME[frameworkId] ?? frameworkId;
    return this._inv().items.find((i) => i.id === id)?.quantity ?? 0;
  }

  /** Take a framework item (or gold); false when there isn't enough. */
  public consume(frameworkId: string, quantity: number): boolean {
    if (frameworkId === GOLD_ITEM_ID) return this.spendGold(quantity);
    return this._inv().removeItem(FRAMEWORK_TO_GAME[frameworkId] ?? frameworkId, quantity);
  }

  /** Give a framework item (from dialogue or a quest); unknown ids are ignored. */
  public give(frameworkId: string, quantity: number): boolean {
    const def = this._itemDef(frameworkId);
    if (!def) return false;
    const id = FRAMEWORK_TO_GAME[frameworkId] ?? frameworkId;
    const inv = this._inv();
    const existing = inv.items.find((i) => i.id === id);
    // Given (a quest's reward, a gift): taken even into a full bag.
    if (existing) {
      inv.addItem({ ...existing, quantity }, { overfill: true });
      return true;
    }
    const shop = stockItem(id);
    const item: Item = {
      id, name: def.name, description: def.description, stackable: def.stackable, quantity, weight: shop?.weight ?? 0.3,
      stats: shop?.stats ?? (frameworkId === "health_potion" ? { ...HEALTH_POTION_STATS } : { value: 10 }),
    };
    if (def.slot) item.slot = def.slot;
    inv.addItem(item, { overfill: true });
    return true;
  }

  /** One more of an item: another of a carried one, a framework item, or a plain `fallback`. */
  public receive(itemId: string, fallback: () => Item): void {
    const id = FRAMEWORK_TO_GAME[itemId] ?? itemId;
    const inv = this._inv();
    const existing = inv.items.find((i) => i.id === id);
    if (existing) { inv.addItem({ ...existing, quantity: 1 }); return; }
    if (this.give(itemId, 1)) return;
    inv.addItem(fallback());
  }
}
