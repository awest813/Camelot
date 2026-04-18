// ── Types ─────────────────────────────────────────────────────────────────────

export interface LeveledEntry {
  /** Minimum player level required for this entry to be eligible. */
  minLevel: number;
  /**
   * The value to return when this entry is selected.
   * If `isList` is true, this is the ID of another LeveledList and resolution
   * is recursive; otherwise the value is returned as the final resolved string
   * (item ID, archetype ID, etc.).
   */
  value: string;
  /**
   * When true, `value` is treated as a sub-list ID and resolved recursively.
   * Defaults to false.
   */
  isList?: boolean;
  /** Relative selection weight.  Entries with no weight default to 1. */
  weight?: number;
}

export interface LeveledList {
  id: string;
  entries: LeveledEntry[];
  /**
   * Selection mode.
   *
   * false (default) — highest-tier-wins: find the highest `minLevel` that
   *   does not exceed `playerLevel` and only consider entries at exactly that
   *   level.  A level-8 player rolling a list with tiers at 1 / 5 / 10
   *   receives a tier-5 item every time.
   *
   * true — all eligible entries whose `minLevel ≤ playerLevel` are pooled
   *   together.  Lower-tier items can still appear at high levels, producing
   *   more varied loot (mirrors OpenMW's CALC_ALL_LEVELS flag).
   */
  calculateAllLevels?: boolean;
  /**
   * Integer 0–100.  Probability that resolution immediately returns null
   * ("no spawn / no drop").  Evaluated before entry selection.
   * Defaults to 0 (always resolve to an entry when eligible ones exist).
   */
  chanceNone?: number;
}

// ── Resolution result ─────────────────────────────────────────────────────────

export interface LeveledListResult {
  /** The resolved ID string, or null when chanceNone fired or no eligible entries exist. */
  value: string | null;
  /** True when a chanceNone roll caused the null result. */
  wasChanceNone: boolean;
}

// ── PRNG ──────────────────────────────────────────────────────────────────────

function xorshift(state: { seed: number }): number {
  let x = state.seed;
  x ^= x << 13;
  x ^= x >> 17;
  x ^= x << 5;
  state.seed = x;
  return (x >>> 0) / 0xffffffff;
}

/**
 * Wang hash — maps a user-supplied seed (including small sequential integers)
 * to a well-distributed internal seed before the first xorshift call.
 * Without this, seeds like 0, 1, 2 … produce very similar (near-zero) first
 * xorshift outputs, causing biased weighted picks.
 */
function wangHash(seed: number): number {
  let h = seed | 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = h ^ (h >>> 16);
  return (h >>> 0) || 1;
}

// ── LeveledListSystem ─────────────────────────────────────────────────────────

/** Guard against infinite recursive list chains. */
const MAX_DEPTH = 16;

/**
 * Morrowind / OpenMW-style leveled lists.
 *
 * A leveled list is a named registry of entries, each with a minimum player-
 * level threshold and an optional selection weight.  When the list is
 * "resolved" at a given player level, only eligible entries (minLevel ≤
 * playerLevel) are candidates and one is selected at random.
 *
 * Two selection modes mirror OpenMW behaviour (see `LeveledList.calculateAllLevels`).
 *
 * Nested lists:
 *   An entry with `isList = true` contains the ID of another `LeveledList`.
 *   Resolution is recursive: the sub-list is resolved first.  Circular
 *   references are guarded against (max depth 16).
 *
 * chanceNone:
 *   Each list can specify a 0–100 integer chance that resolution produces
 *   null instead of an entry.  Useful for sparse creature/loot spawns.
 *
 * Usage:
 * ```ts
 * const lls = new LeveledListSystem();
 * lls.registerAll(ALL_BUILT_IN_LEVELED_LISTS);
 * const result = lls.resolve("ll_weapon_melee", playerLevel);
 * // result.value → item ID string, or null
 * ```
 */
export class LeveledListSystem {
  private _lists: Map<string, LeveledList> = new Map();

  // ── Registry ──────────────────────────────────────────────────────────────

  /** Register a leveled list definition.  Overwrites existing lists with the same id. */
  public registerList(list: LeveledList): void {
    this._lists.set(list.id, list);
  }

  /** Register multiple lists at once. */
  public registerAll(lists: LeveledList[]): void {
    for (const list of lists) this._lists.set(list.id, list);
  }

  /** Returns the registered list definition or undefined. */
  public getList(id: string): LeveledList | undefined {
    return this._lists.get(id);
  }

  /** Returns all registered list ids. */
  public getListIds(): string[] {
    return Array.from(this._lists.keys());
  }

  // ── Resolution ────────────────────────────────────────────────────────────

  /**
   * Resolve a leveled list to a single value string.
   *
   * @param listId      ID of the registered LeveledList.
   * @param playerLevel Current player level (≥ 1).
   * @param seed        Optional integer seed for deterministic resolution.
   */
  public resolve(listId: string, playerLevel: number, seed?: number): LeveledListResult {
    const rng = {
      seed: seed !== undefined
        ? wangHash(seed)
        : Math.floor(Math.random() * 0x7fffffff) + 1,
    };
    return this._resolveInner(listId, playerLevel, rng, 0);
  }

  /**
   * Resolve a leveled list multiple times, returning an array of results.
   * Each resolution derives an independent RNG state so rolls are uncorrelated.
   *
   * @param listId      ID of the registered LeveledList.
   * @param count       Number of resolutions to perform.
   * @param playerLevel Current player level (≥ 1).
   * @param seed        Optional base seed.
   */
  public resolveMany(
    listId: string,
    count: number,
    playerLevel: number,
    seed?: number,
  ): LeveledListResult[] {
    const results: LeveledListResult[] = [];
    let currentSeed = seed !== undefined ? wangHash(seed) : undefined;
    for (let i = 0; i < count; i++) {
      const rng = {
        seed: currentSeed !== undefined
          ? currentSeed
          : Math.floor(Math.random() * 0x7fffffff) + 1,
      };
      results.push(this._resolveInner(listId, playerLevel, rng, 0));
      if (currentSeed !== undefined) {
        currentSeed = ((currentSeed * 1664525 + 1013904223) >>> 0) || 1;
      }
    }
    return results;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _resolveInner(
    listId: string,
    playerLevel: number,
    rng: { seed: number },
    depth: number,
  ): LeveledListResult {
    const NULL_RESULT: LeveledListResult = { value: null, wasChanceNone: false };
    if (depth > MAX_DEPTH) return NULL_RESULT;

    const list = this._lists.get(listId);
    if (!list) return NULL_RESULT;

    // chanceNone check — performed before entry selection
    const chanceNone = Math.max(0, Math.min(100, list.chanceNone ?? 0));
    if (chanceNone > 0 && xorshift(rng) * 100 < chanceNone) {
      return { value: null, wasChanceNone: true };
    }

    const eligible = this._buildEligiblePool(list, playerLevel);
    if (eligible.length === 0) return NULL_RESULT;

    const picked = this._weightedPick(eligible, rng);
    if (!picked) return NULL_RESULT;

    // Recurse if the entry is itself a leveled list reference
    if (picked.isList) {
      return this._resolveInner(picked.value, playerLevel, rng, depth + 1);
    }

    return { value: picked.value, wasChanceNone: false };
  }

  /**
   * Build the pool of eligible entries for a given player level.
   *
   * Default mode (calculateAllLevels = false):
   *   Find the highest minLevel that does not exceed playerLevel, then
   *   include only entries at exactly that level.
   *
   * calculateAllLevels = true:
   *   Include every entry whose minLevel ≤ playerLevel.
   */
  private _buildEligiblePool(list: LeveledList, playerLevel: number): LeveledEntry[] {
    const allEligible = list.entries.filter(e => e.minLevel <= playerLevel);
    if (allEligible.length === 0) return [];

    if (list.calculateAllLevels) {
      return allEligible;
    }

    // Highest-tier-wins: filter to entries at the maximum qualifying minLevel
    const maxMinLevel = Math.max(...allEligible.map(e => e.minLevel));
    return allEligible.filter(e => e.minLevel === maxMinLevel);
  }

  private _weightedPick(entries: LeveledEntry[], rng: { seed: number }): LeveledEntry | null {
    const total = entries.reduce((sum, e) => sum + Math.max(1, e.weight ?? 1), 0);
    if (total <= 0) return null;

    let remaining = xorshift(rng) * total;
    for (const entry of entries) {
      remaining -= Math.max(1, entry.weight ?? 1);
      if (remaining <= 0) return entry;
    }
    return entries[entries.length - 1];
  }
}

// ── Built-in leveled lists ────────────────────────────────────────────────────

/**
 * Leveled weapon lists — resolve to item IDs compatible with LootTableSystem
 * item templates.  Modelled on Morrowind's leveled-item breakpoints.
 */
export const LEVELED_WEAPON_LISTS: LeveledList[] = [
  {
    id: "ll_weapon_melee",
    calculateAllLevels: false,
    entries: [
      { minLevel: 1,  value: "iron_sword" },
      { minLevel: 3,  value: "steel_sword" },
      { minLevel: 6,  value: "silver_sword" },
      { minLevel: 10, value: "daedric_sword" },
    ],
  },
  {
    id: "ll_weapon_ranged",
    calculateAllLevels: false,
    entries: [
      { minLevel: 1, value: "iron_bow" },
      { minLevel: 4, value: "steel_bow" },
      { minLevel: 8, value: "elven_bow" },
    ],
  },
];

/**
 * Leveled armor lists — resolve to item IDs by armor class and player level.
 */
export const LEVELED_ARMOR_LISTS: LeveledList[] = [
  {
    id: "ll_armor_light",
    calculateAllLevels: false,
    entries: [
      { minLevel: 1,  value: "hide_armor" },
      { minLevel: 3,  value: "leather_armor" },
      { minLevel: 6,  value: "chitin_armor" },
      { minLevel: 10, value: "glass_armor" },
    ],
  },
  {
    id: "ll_armor_heavy",
    calculateAllLevels: false,
    entries: [
      { minLevel: 1,  value: "iron_cuirass" },
      { minLevel: 4,  value: "steel_cuirass" },
      { minLevel: 8,  value: "orcish_cuirass" },
      { minLevel: 12, value: "daedric_cuirass" },
    ],
  },
];

/**
 * Leveled creature lists — resolve to NPC archetype IDs compatible with
 * NpcArchetypeSystem.  Controls which enemy type spawns based on player level.
 */
export const LEVELED_CREATURE_LISTS: LeveledList[] = [
  {
    id: "ll_creature_undead",
    calculateAllLevels: false,
    entries: [
      { minLevel: 1,  value: "skeleton" },
      { minLevel: 3,  value: "skeleton_warrior" },
      { minLevel: 6,  value: "skeleton_champion" },
      { minLevel: 10, value: "lich" },
    ],
  },
  {
    id: "ll_creature_beast",
    calculateAllLevels: false,
    entries: [
      { minLevel: 1,  value: "wolf" },
      { minLevel: 3,  value: "bear" },
      { minLevel: 7,  value: "troll" },
      { minLevel: 12, value: "frost_atronach" },
    ],
  },
  {
    id: "ll_creature_humanoid",
    calculateAllLevels: false,
    entries: [
      { minLevel: 1,  value: "bandit" },
      { minLevel: 4,  value: "bandit_archer" },
      { minLevel: 7,  value: "bandit_leader" },
      { minLevel: 12, value: "necromancer" },
    ],
  },
];

/** All built-in leveled lists combined for easy bulk registration. */
export const ALL_BUILT_IN_LEVELED_LISTS: LeveledList[] = [
  ...LEVELED_WEAPON_LISTS,
  ...LEVELED_ARMOR_LISTS,
  ...LEVELED_CREATURE_LISTS,
];
