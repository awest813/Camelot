import type { Item } from "./inventory-system";

// ── Types ────────────────────────────────────────────────────────────────────

export interface LootEntry {
  /** The item id (must exist in the item registry; the system builds the Item from this). */
  itemId: string;
  /** Display name used to build the Item when no external registry is provided. */
  itemName?: string;
  /** Relative probability weight.  Higher weight = appears more often. */
  weight: number;
  /** Minimum quantity per roll. Defaults to 1. */
  minQuantity?: number;
  /** Maximum quantity per roll. Defaults to 1. */
  maxQuantity?: number;
  /** Prototype Item properties to merge into the generated item. */
  itemTemplate?: Partial<Item>;
}

export interface LootTable {
  id: string;
  /** How many independent rolls to perform on this table. */
  rolls: number;
  /** If true, each entry can be chosen at most once per roll call. */
  unique?: boolean;
  entries: LootEntry[];
}

export interface LootRollResult {
  tableId: string;
  items: Item[];
}

// ── Deterministic pseudo-random (seedable for tests) ─────────────────────────

/** Simple xorshift32 PRNG — good enough for loot rolls. */
function xorshift(state: { seed: number }): number {
  let x = state.seed;
  x ^= x << 13;
  x ^= x >> 17;
  x ^= x << 5;
  state.seed = x;
  return (x >>> 0) / 0xffffffff;
}

// ── LootTableSystem ───────────────────────────────────────────────────────────

/**
 * Data-driven loot generation system.
 *
 * Usage:
 * ```ts
 * const lts = new LootTableSystem();
 * lts.registerTable({ id: "bandit_loot", rolls: 2, entries: [...] });
 * const result = lts.rollTable("bandit_loot");
 * // result.items → Item[] to add to inventory / container
 * ```
 *
 * Weight algorithm:
 *   A weighted random pick is performed for each roll.
 *   All entry weights are summed; a uniform random number in [0, totalWeight)
 *   selects the winning entry.
 *
 * Quantity:
 *   For stackable items, quantity is chosen uniformly between
 *   [minQuantity, maxQuantity] per roll.
 *
 * Seeding:
 *   Pass a numeric seed to `rollTable()` for deterministic rolls
 *   (useful in tests and for reproducible dungeon loot).
 */
export class LootTableSystem {
  private _tables: Map<string, LootTable> = new Map();

  // ── Registration ──────────────────────────────────────────────────────────

  /** Register a loot table definition.  Overwrites existing tables with the same id. */
  public registerTable(table: LootTable): void {
    this._tables.set(table.id, table);
  }

  /** Returns the registered table definition or undefined. */
  public getTable(tableId: string): LootTable | undefined {
    return this._tables.get(tableId);
  }

  /** Returns all registered table ids. */
  public getTableIds(): string[] {
    return Array.from(this._tables.keys());
  }

  // ── Rolling ───────────────────────────────────────────────────────────────

  /**
   * Roll a registered loot table and return the generated item stack.
   *
   * @param tableId  The table to roll.
   * @param seed     Optional integer seed for deterministic output.
   */
  public rollTable(tableId: string, seed?: number): LootRollResult {
    const table = this._tables.get(tableId);
    if (!table) return { tableId, items: [] };

    const rng = { seed: seed !== undefined ? (seed | 0) || 1 : Math.floor(Math.random() * 0x7fffffff) + 1 };

    const items: Item[] = [];
    let available = [...table.entries];

    for (let roll = 0; roll < table.rolls; roll++) {
      if (available.length === 0) break;

      const entry = this._weightedPick(available, rng);
      if (!entry) continue;

      if (table.unique) {
        available = available.filter(e => e !== entry);
      }

      const qty = this._randomRange(
        entry.minQuantity ?? 1,
        entry.maxQuantity ?? 1,
        rng,
      );

      items.push(this._buildItem(entry, qty));
    }

    return { tableId, items };
  }

  /**
   * Roll multiple tables at once (e.g. different loot tiers on one enemy).
   * Results are merged into a single item list.
   */
  public rollTables(tableIds: string[], seed?: number): Item[] {
    const all: Item[] = [];
    let currentSeed = seed;
    for (const id of tableIds) {
      const result = this.rollTable(id, currentSeed);
      all.push(...result.items);
      if (currentSeed !== undefined) currentSeed = (currentSeed * 1664525 + 1013904223) >>> 0;
    }
    return all;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _weightedPick(entries: LootEntry[], rng: { seed: number }): LootEntry | null {
    const total = entries.reduce((sum, e) => sum + Math.max(0, e.weight), 0);
    if (total <= 0) return null;

    let pick = xorshift(rng) * total;
    for (const entry of entries) {
      pick -= Math.max(0, entry.weight);
      if (pick <= 0) return entry;
    }
    return entries[entries.length - 1];
  }

  private _randomRange(min: number, max: number, rng: { seed: number }): number {
    if (min === max) return min;
    const range = max - min + 1;
    return min + Math.floor(xorshift(rng) * range);
  }

  private _buildItem(entry: LootEntry, quantity: number): Item {
    const base: Item = {
      id:          entry.itemId,
      name:        entry.itemName ?? entry.itemTemplate?.name ?? entry.itemId,
      description: entry.itemTemplate?.description ?? "",
      stackable:   quantity > 1 || (entry.itemTemplate?.stackable ?? false),
      quantity,
      weight:      entry.itemTemplate?.weight ?? 0,
      ...(entry.itemTemplate ?? {}),
    };
    return base;
  }
}

// ── Built-in starter loot tables ─────────────────────────────────────────────

export const STARTER_LOOT_TABLES: LootTable[] = [
  {
    id: "common_loot",
    rolls: 2,
    entries: [
      { itemId: "gold_coins",    itemName: "Gold Coins",    weight: 40, minQuantity: 5,  maxQuantity: 30, itemTemplate: { stackable: true, weight: 0.1, stats: { value: 1 } } },
      { itemId: "health_potion", itemName: "Health Potion", weight: 20, maxQuantity: 2,  itemTemplate: { stackable: true, weight: 0.5, stats: { value: 25 } } },
      { itemId: "torch",         itemName: "Torch",         weight: 15, maxQuantity: 3,  itemTemplate: { stackable: true, weight: 0.3, stats: { value: 5 } } },
      { itemId: "lockpick",      itemName: "Lockpick",      weight: 10, maxQuantity: 3,  itemTemplate: { stackable: true, weight: 0.1, stats: { value: 8 } } },
      { itemId: "cloth_scraps",  itemName: "Cloth Scraps",  weight: 15, maxQuantity: 4,  itemTemplate: { stackable: true, weight: 0.2, stats: { value: 2 } } },
    ],
  },
  {
    id: "bandit_loot",
    rolls: 3,
    entries: [
      { itemId: "gold_coins",    itemName: "Gold Coins",    weight: 35, minQuantity: 10, maxQuantity: 50, itemTemplate: { stackable: true, weight: 0.1, stats: { value: 1 } } },
      { itemId: "iron_sword",    itemName: "Iron Sword",    weight: 20,                  itemTemplate: { stackable: false, weight: 3.5, slot: "mainHand", stats: { damage: 10, value: 80 } } },
      { itemId: "iron_shield",   itemName: "Iron Shield",   weight: 15,                  itemTemplate: { stackable: false, weight: 5.0, slot: "offHand",  stats: { armor: 6,  value: 60 } } },
      { itemId: "leather_armor", itemName: "Leather Armor", weight: 15,                  itemTemplate: { stackable: false, weight: 7.0, slot: "chest",    stats: { armor: 4,  value: 50 } } },
      { itemId: "health_potion", itemName: "Health Potion", weight: 15, maxQuantity: 2,  itemTemplate: { stackable: true, weight: 0.5, stats: { value: 25 } } },
    ],
  },
  {
    id: "dungeon_loot",
    rolls: 4,
    entries: [
      { itemId: "gold_coins",      itemName: "Gold Coins",      weight: 30, minQuantity: 20, maxQuantity: 100, itemTemplate: { stackable: true, weight: 0.1, stats: { value: 1 } } },
      { itemId: "steel_sword",     itemName: "Steel Sword",     weight: 15,                   itemTemplate: { stackable: false, weight: 4.0, slot: "mainHand", stats: { damage: 18, value: 200 } } },
      { itemId: "steel_shield",    itemName: "Steel Shield",    weight: 12,                   itemTemplate: { stackable: false, weight: 6.0, slot: "offHand",  stats: { armor: 10, value: 160 } } },
      { itemId: "chainmail_armor", itemName: "Chainmail Armor", weight: 12,                   itemTemplate: { stackable: false, weight: 10,  slot: "chest",    stats: { armor: 10, value: 150 } } },
      { itemId: "magic_scroll",    itemName: "Magic Scroll",    weight: 8,  maxQuantity: 2,   itemTemplate: { stackable: true, weight: 0.2, stats: { value: 75 } } },
      { itemId: "health_potion",   itemName: "Health Potion",   weight: 13, maxQuantity: 3,   itemTemplate: { stackable: true, weight: 0.5, stats: { value: 25 } } },
      { itemId: "lockpick",        itemName: "Lockpick",        weight: 10, maxQuantity: 5,   itemTemplate: { stackable: true, weight: 0.1, stats: { value: 8 } } },
    ],
  },
  {
    id: "merchant_restock",
    rolls: 5,
    unique: true,
    entries: [
      { itemId: "health_potion",   itemName: "Health Potion",   weight: 25, maxQuantity: 5, itemTemplate: { stackable: true, weight: 0.5, stats: { value: 25 } } },
      { itemId: "magicka_potion",  itemName: "Magicka Potion",  weight: 20, maxQuantity: 5, itemTemplate: { stackable: true, weight: 0.5, stats: { value: 30 } } },
      { itemId: "lockpick",        itemName: "Lockpick",        weight: 15, maxQuantity: 10, itemTemplate: { stackable: true, weight: 0.1, stats: { value: 8 } } },
      { itemId: "iron_sword",      itemName: "Iron Sword",      weight: 20, itemTemplate: { stackable: false, weight: 3.5, slot: "mainHand", stats: { damage: 10, value: 80 } } },
      { itemId: "leather_armor",   itemName: "Leather Armor",   weight: 20, itemTemplate: { stackable: false, weight: 7.0, slot: "chest",    stats: { armor: 4,  value: 50 } } },
    ],
  },
];
