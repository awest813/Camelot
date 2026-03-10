import type { Item } from "./inventory-system";

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Conditions that must be satisfied for a loot entry to be eligible for
 * selection during a roll.  All present conditions are ANDed together.
 */
export interface LootCondition {
  /** Minimum player level required (inclusive). */
  minLevel?: number;
  /** Maximum player level allowed (inclusive). */
  maxLevel?: number;
  /** All listed flag strings must be present in `LootContext.flags`. */
  requiredFlags?: string[];
}

export interface LootEntry {
  /** The item id (must exist in the item registry; the system builds the Item from this). */
  itemId?: string;
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
  /**
   * When set, this entry always appears in the result regardless of the random
   * rolls.  Guaranteed entries are processed before any weighted rolls and do
   * not consume a roll slot.  The `weight` field is ignored for guaranteed
   * entries.
   */
  guarantee?: boolean;
  /**
   * When set, rolling this entry triggers a sub-table roll instead of
   * building a single item.  `itemId` / `itemTemplate` are ignored for
   * sub-table entries.
   */
  subTableId?: string;
  /**
   * Optional conditions that must be satisfied for this entry to be eligible.
   * Entries that fail their conditions are excluded from the weighted pool
   * (and their guaranteed flag is also skipped).
   */
  condition?: LootCondition;
}

export interface LootTable {
  id: string;
  /** How many independent rolls to perform on this table. */
  rolls: number;
  /** If true, each entry can be chosen at most once per roll call. */
  unique?: boolean;
  /**
   * Additional weight for a "nothing" outcome.  On each roll there is a
   * `noneWeight / (totalEntryWeight + noneWeight)` chance of returning no
   * item.  Defaults to 0 (no empty rolls).
   */
  noneWeight?: number;
  entries: LootEntry[];
}

export interface LootRollResult {
  tableId: string;
  items: Item[];
}

/**
 * Contextual information passed to `rollTable()` / `rollTables()`.
 * Used to evaluate entry conditions and enable level-scaled loot.
 */
export interface LootContext {
  /** Current player level (1-based). */
  playerLevel?: number;
  /** Arbitrary string flags set by the game state (e.g. "boss_dead", "hard_mode"). */
  flags?: string[];
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
 *   selects the winning entry.  An optional `noneWeight` on the table adds a
 *   weighted "no drop" outcome to each roll.
 *
 * Quantity:
 *   For stackable items, quantity is chosen uniformly between
 *   [minQuantity, maxQuantity] per roll.
 *
 * Guaranteed items:
 *   Entries with `guarantee: true` are always included in the result before
 *   any random rolls are performed.  They do not consume a roll slot.
 *
 * Conditional entries:
 *   Entries with a `condition` are excluded from the eligible pool (and their
 *   guarantee flag is skipped) unless the supplied `LootContext` satisfies all
 *   conditions.
 *
 * Sub-table entries:
 *   An entry with `subTableId` triggers a roll on that table instead of
 *   building a single item from `itemId`/`itemTemplate`.
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
   * @param context  Optional runtime context (player level, flags) used to
   *   evaluate entry conditions.
   */
  public rollTable(tableId: string, seed?: number, context?: LootContext): LootRollResult {
    const table = this._tables.get(tableId);
    if (!table) return { tableId, items: [] };

    const rng = { seed: seed !== undefined ? (seed | 0) || 1 : Math.floor(Math.random() * 0x7fffffff) + 1 };

    const items: Item[] = [];

    // Filter entries by condition first
    const eligible = table.entries.filter(e => this._checkCondition(e, context));

    // 1. Guaranteed items always drop (before any random rolls)
    for (const entry of eligible) {
      if (!entry.guarantee) continue;
      const qty = this._randomRange(entry.minQuantity ?? 1, entry.maxQuantity ?? 1, rng);
      items.push(...this._resolveEntry(entry, qty, seed, context));
    }

    // 2. Weighted random rolls
    let available = eligible.filter(e => !e.guarantee);

    for (let roll = 0; roll < table.rolls; roll++) {
      if (available.length === 0) break;

      const entry = this._weightedPick(available, rng, table.noneWeight ?? 0);
      if (!entry) continue; // "none" outcome — empty roll

      if (table.unique) {
        available = available.filter(e => e !== entry);
      }

      const qty = this._randomRange(
        entry.minQuantity ?? 1,
        entry.maxQuantity ?? 1,
        rng,
      );

      items.push(...this._resolveEntry(entry, qty, seed, context));
    }

    return { tableId, items };
  }

  /**
   * Roll multiple tables at once (e.g. different loot tiers on one enemy).
   * Results are merged into a single item list.
   */
  public rollTables(tableIds: string[], seed?: number, context?: LootContext): Item[] {
    const all: Item[] = [];
    let currentSeed = seed;
    for (const id of tableIds) {
      const result = this.rollTable(id, currentSeed, context);
      all.push(...result.items);
      if (currentSeed !== undefined) currentSeed = (currentSeed * 1664525 + 1013904223) >>> 0;
    }
    return all;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Evaluate an entry's condition against the supplied context.
   * Returns true if the entry is eligible (no condition, or all conditions met).
   */
  private _checkCondition(entry: LootEntry, context?: LootContext): boolean {
    const cond = entry.condition;
    if (!cond) return true;

    const level = context?.playerLevel ?? 1;
    if (cond.minLevel !== undefined && level < cond.minLevel) return false;
    if (cond.maxLevel !== undefined && level > cond.maxLevel) return false;

    if (cond.requiredFlags && cond.requiredFlags.length > 0) {
      const flags = context?.flags ?? [];
      for (const flag of cond.requiredFlags) {
        if (!flags.includes(flag)) return false;
      }
    }

    return true;
  }

  /**
   * Resolve a single eligible entry into one or more items.
   * Sub-table entries trigger a nested `rollTable()` call.
   */
  private _resolveEntry(
    entry: LootEntry,
    qty: number,
    seed: number | undefined,
    context: LootContext | undefined,
  ): Item[] {
    if (entry.subTableId) {
      // Sub-table: derive a child seed using a simple djb2-style hash of the
      // full sub-table ID so different IDs never produce the same child seed.
      let childSeed: number | undefined;
      if (seed !== undefined) {
        let h = seed;
        for (let i = 0; i < entry.subTableId.length; i++) {
          h = Math.imul(h ^ entry.subTableId.charCodeAt(i), 0x9e3779b9);
        }
        childSeed = (h >>> 0) || 1;
      }
      return this.rollTable(entry.subTableId, childSeed, context).items;
    }
    return [this._buildItem(entry, qty)];
  }

  private _weightedPick(
    entries: LootEntry[],
    rng: { seed: number },
    noneWeight: number,
  ): LootEntry | null {
    const safeNone = Math.max(0, noneWeight);
    const entryTotal = entries.reduce((sum, e) => sum + Math.max(0, e.weight), 0);
    const total = entryTotal + safeNone;
    if (total <= 0) return null;

    const pick = xorshift(rng) * total;

    // "none" occupies the first `safeNone` portion of [0, total)
    if (pick < safeNone) return null;

    let remaining = pick - safeNone;
    for (const entry of entries) {
      remaining -= Math.max(0, entry.weight);
      if (remaining <= 0) return entry;
    }
    return entries[entries.length - 1];
  }

  private _randomRange(min: number, max: number, rng: { seed: number }): number {
    if (min === max) return min;
    const range = max - min + 1;
    return min + Math.floor(xorshift(rng) * range);
  }

  private _buildItem(entry: LootEntry, quantity: number): Item {
    const itemId = entry.itemId ?? "unknown_item";
    const base: Item = {
      id:          itemId,
      name:        entry.itemName ?? entry.itemTemplate?.name ?? itemId,
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
    noneWeight: 5,
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
  {
    id: "boss_loot",
    rolls: 3,
    entries: [
      // Guaranteed gold drop for every boss kill
      { itemId: "gold_coins",       itemName: "Gold Coins",       weight: 0,  guarantee: true, minQuantity: 50, maxQuantity: 150, itemTemplate: { stackable: true, weight: 0.1, stats: { value: 1 } } },
      // High-tier weapons — only available to players level 5+
      { itemId: "daedric_sword",    itemName: "Daedric Sword",    weight: 20, condition: { minLevel: 5 },  itemTemplate: { stackable: false, weight: 5.0, slot: "mainHand", stats: { damage: 30, value: 500 } } },
      { itemId: "daedric_shield",   itemName: "Daedric Shield",   weight: 15, condition: { minLevel: 5 },  itemTemplate: { stackable: false, weight: 7.0, slot: "offHand",  stats: { armor: 20, value: 400 } } },
      { itemId: "glass_armor",      itemName: "Glass Armor",      weight: 15, condition: { minLevel: 8 },  itemTemplate: { stackable: false, weight: 8.0, slot: "chest",    stats: { armor: 22, value: 600 } } },
      { itemId: "soul_gem_grand",   itemName: "Grand Soul Gem",   weight: 20, maxQuantity: 2, itemTemplate: { stackable: true, weight: 0.3, stats: { value: 200 } } },
      // Sub-table for extra consumables
      {                             weight: 10, subTableId: "common_loot" },
      // Low-level players get standard dungeon gear
      { itemId: "steel_sword",      itemName: "Steel Sword",      weight: 20, condition: { maxLevel: 4 },  itemTemplate: { stackable: false, weight: 4.0, slot: "mainHand", stats: { damage: 18, value: 200 } } },
    ],
  },
  {
    id: "treasure_chest",
    rolls: 4,
    noneWeight: 0,
    entries: [
      // Always contains a key
      { itemId: "ornate_key",        itemName: "Ornate Key",       weight: 0, guarantee: true, itemTemplate: { stackable: false, weight: 0.1, stats: { value: 50 } } },
      { itemId: "gold_coins",        itemName: "Gold Coins",       weight: 35, minQuantity: 30, maxQuantity: 200, itemTemplate: { stackable: true, weight: 0.1, stats: { value: 1 } } },
      { itemId: "ruby",              itemName: "Ruby",             weight: 15, maxQuantity: 3, itemTemplate: { stackable: true, weight: 0.1, stats: { value: 150 } } },
      { itemId: "emerald",           itemName: "Emerald",          weight: 12, maxQuantity: 2, itemTemplate: { stackable: true, weight: 0.1, stats: { value: 200 } } },
      { itemId: "enchanted_ring",    itemName: "Enchanted Ring",   weight: 10, condition: { minLevel: 3 }, itemTemplate: { stackable: false, weight: 0.05, slot: "ring", stats: { value: 300 } } },
      { itemId: "spell_tome",        itemName: "Spell Tome",       weight: 8,  condition: { requiredFlags: ["mage_guild_member"] }, itemTemplate: { stackable: false, weight: 0.5, stats: { value: 250 } } },
      // Roll the dungeon table for a bonus weapon/armor
      {                              weight: 20, subTableId: "dungeon_loot" },
    ],
  },
];
