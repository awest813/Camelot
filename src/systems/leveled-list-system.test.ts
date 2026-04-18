import { describe, it, expect, beforeEach } from "vitest";
import {
  LeveledListSystem,
  ALL_BUILT_IN_LEVELED_LISTS,
} from "./leveled-list-system";
import type { LeveledList } from "./leveled-list-system";

describe("LeveledListSystem", () => {
  let lls: LeveledListSystem;

  beforeEach(() => {
    lls = new LeveledListSystem();
    lls.registerAll(ALL_BUILT_IN_LEVELED_LISTS);
  });

  // ── Registration ──────────────────────────────────────────────────────────

  it("registers lists and returns their ids", () => {
    const ids = lls.getListIds();
    expect(ids).toContain("ll_weapon_melee");
    expect(ids).toContain("ll_weapon_ranged");
    expect(ids).toContain("ll_armor_light");
    expect(ids).toContain("ll_armor_heavy");
    expect(ids).toContain("ll_creature_undead");
    expect(ids).toContain("ll_creature_beast");
    expect(ids).toContain("ll_creature_humanoid");
  });

  it("getList returns the definition", () => {
    const list = lls.getList("ll_weapon_melee");
    expect(list?.id).toBe("ll_weapon_melee");
  });

  it("getList returns undefined for unknown id", () => {
    expect(lls.getList("ghost_list")).toBeUndefined();
  });

  it("registerList overwrites existing list with the same id", () => {
    lls.registerList({
      id: "ll_weapon_melee",
      entries: [{ minLevel: 1, value: "custom_sword" }],
    });
    const r = lls.resolve("ll_weapon_melee", 1, 1);
    expect(r.value).toBe("custom_sword");
  });

  // ── resolve: unknown list ─────────────────────────────────────────────────

  it("resolve returns null for unknown list id", () => {
    const result = lls.resolve("not_a_list", 5, 1);
    expect(result.value).toBeNull();
    expect(result.wasChanceNone).toBe(false);
  });

  // ── resolve: no eligible entries ─────────────────────────────────────────

  it("resolve returns null when no entries meet player level", () => {
    const list: LeveledList = {
      id: "high_level_only",
      entries: [{ minLevel: 20, value: "epic_item" }],
    };
    lls.registerList(list);
    const result = lls.resolve("high_level_only", 5, 1);
    expect(result.value).toBeNull();
    expect(result.wasChanceNone).toBe(false);
  });

  // ── resolve: highest-tier-wins (calculateAllLevels = false) ──────────────

  it("level-1 player gets iron_sword from ll_weapon_melee", () => {
    const result = lls.resolve("ll_weapon_melee", 1, 42);
    expect(result.value).toBe("iron_sword");
  });

  it("level-3 player gets steel_sword (highest eligible tier = 3)", () => {
    const result = lls.resolve("ll_weapon_melee", 3, 42);
    expect(result.value).toBe("steel_sword");
  });

  it("level-4 player still gets steel_sword (no tier-4 entry)", () => {
    const result = lls.resolve("ll_weapon_melee", 4, 42);
    expect(result.value).toBe("steel_sword");
  });

  it("level-10 player gets daedric_sword from ll_weapon_melee", () => {
    const result = lls.resolve("ll_weapon_melee", 10, 42);
    expect(result.value).toBe("daedric_sword");
  });

  it("level-15 player still gets daedric_sword (capped at highest entry)", () => {
    const result = lls.resolve("ll_weapon_melee", 15, 42);
    expect(result.value).toBe("daedric_sword");
  });

  it("calculateAllLevels=false never returns lower tiers at high level", () => {
    // ll_weapon_melee uses calculateAllLevels=false, so level-10 should only
    // ever return daedric_sword (the sole entry at the highest eligible minLevel)
    const seen = new Set<string>();
    for (let seed = 0; seed < 100; seed++) {
      const r = lls.resolve("ll_weapon_melee", 10, seed);
      if (r.value) seen.add(r.value);
    }
    expect(seen.size).toBe(1);
    expect(seen.has("daedric_sword")).toBe(true);
  });

  // ── resolve: calculateAllLevels = true ───────────────────────────────────

  it("calculateAllLevels=true allows lower-tier items at high level", () => {
    const list: LeveledList = {
      id: "calc_all_test",
      calculateAllLevels: true,
      entries: [
        { minLevel: 1,  value: "iron_sword",    weight: 1 },
        { minLevel: 5,  value: "steel_sword",   weight: 1 },
        { minLevel: 10, value: "daedric_sword", weight: 1 },
      ],
    };
    lls.registerList(list);
    // Level-10 player should see all three tiers over many seeds
    const seen = new Set<string>();
    for (let seed = 0; seed < 300; seed++) {
      const r = lls.resolve("calc_all_test", 10, seed);
      if (r.value) seen.add(r.value);
    }
    expect(seen.has("iron_sword")).toBe(true);
    expect(seen.has("steel_sword")).toBe(true);
    expect(seen.has("daedric_sword")).toBe(true);
  });

  it("calculateAllLevels=true excludes entries above player level", () => {
    const list: LeveledList = {
      id: "calc_all_gate",
      calculateAllLevels: true,
      entries: [
        { minLevel: 1,  value: "tier_1_item", weight: 1 },
        { minLevel: 5,  value: "tier_5_item", weight: 1 },
        { minLevel: 10, value: "tier_10_item", weight: 1 },
      ],
    };
    lls.registerList(list);
    // Level-4 player must never see tier_5_item or tier_10_item
    for (let seed = 0; seed < 100; seed++) {
      const r = lls.resolve("calc_all_gate", 4, seed);
      expect(r.value).toBe("tier_1_item");
    }
  });

  // ── resolve: deterministic seed ──────────────────────────────────────────

  it("same seed produces the same result", () => {
    const a = lls.resolve("ll_weapon_melee", 5, 999);
    const b = lls.resolve("ll_weapon_melee", 5, 999);
    expect(a.value).toBe(b.value);
    expect(a.wasChanceNone).toBe(b.wasChanceNone);
  });

  it("different seeds can produce different results across equal-weight entries", () => {
    const list: LeveledList = {
      id: "two_options",
      calculateAllLevels: true,
      entries: [
        { minLevel: 1, value: "item_a", weight: 1 },
        { minLevel: 1, value: "item_b", weight: 1 },
      ],
    };
    lls.registerList(list);
    const values = new Set<string>();
    for (let seed = 0; seed < 100; seed++) {
      const r = lls.resolve("two_options", 1, seed);
      if (r.value) values.add(r.value);
    }
    expect(values.size).toBe(2);
  });

  // ── chanceNone ────────────────────────────────────────────────────────────

  it("chanceNone=0 always resolves to an entry", () => {
    const list: LeveledList = {
      id: "no_chance_none",
      chanceNone: 0,
      entries: [{ minLevel: 1, value: "always_item" }],
    };
    lls.registerList(list);
    for (let seed = 0; seed < 30; seed++) {
      const r = lls.resolve("no_chance_none", 1, seed);
      expect(r.value).toBe("always_item");
      expect(r.wasChanceNone).toBe(false);
    }
  });

  it("chanceNone=100 always resolves to null with wasChanceNone=true", () => {
    const list: LeveledList = {
      id: "always_none",
      chanceNone: 100,
      entries: [{ minLevel: 1, value: "ghost_item" }],
    };
    lls.registerList(list);
    for (let seed = 0; seed < 30; seed++) {
      const r = lls.resolve("always_none", 1, seed);
      expect(r.value).toBeNull();
      expect(r.wasChanceNone).toBe(true);
    }
  });

  it("chanceNone=50 produces roughly half null results", () => {
    const list: LeveledList = {
      id: "half_none",
      chanceNone: 50,
      entries: [{ minLevel: 1, value: "item" }],
    };
    lls.registerList(list);
    let nullCount = 0;
    const runs = 200;
    for (let seed = 0; seed < runs; seed++) {
      const r = lls.resolve("half_none", 1, seed);
      if (r.wasChanceNone) nullCount++;
    }
    // Loose bounds: expect 30%–70% null to account for PRNG variation
    expect(nullCount).toBeGreaterThan(runs * 0.30);
    expect(nullCount).toBeLessThan(runs * 0.70);
  });

  it("chanceNone out-of-range values are clamped (>100 behaves as 100)", () => {
    const list: LeveledList = {
      id: "clamped_none",
      chanceNone: 200,
      entries: [{ minLevel: 1, value: "unreachable" }],
    };
    lls.registerList(list);
    for (let seed = 0; seed < 20; seed++) {
      const r = lls.resolve("clamped_none", 1, seed);
      expect(r.value).toBeNull();
      expect(r.wasChanceNone).toBe(true);
    }
  });

  // ── Nested / sub-list resolution ─────────────────────────────────────────

  it("isList=true entry resolves through the sub-list", () => {
    lls.registerList({
      id: "child_list",
      entries: [{ minLevel: 1, value: "child_item" }],
    });
    lls.registerList({
      id: "parent_list",
      entries: [{ minLevel: 1, value: "child_list", isList: true }],
    });
    const r = lls.resolve("parent_list", 1, 1);
    expect(r.value).toBe("child_item");
  });

  it("sub-list resolution respects playerLevel filtering", () => {
    lls.registerList({
      id: "weapon_sub",
      entries: [
        { minLevel: 1,  value: "iron_sword" },
        { minLevel: 10, value: "daedric_sword" },
      ],
    });
    lls.registerList({
      id: "spawn_with_weapon",
      entries: [{ minLevel: 1, value: "weapon_sub", isList: true }],
    });
    // Level-3 player — sub-list highest eligible = 1 → iron_sword
    const r = lls.resolve("spawn_with_weapon", 3, 42);
    expect(r.value).toBe("iron_sword");
  });

  it("deeply nested lists resolve correctly", () => {
    // Build a 5-deep chain: deep_1 → deep_2 → … → deep_5 → "final_item"
    lls.registerList({ id: "deep_5", entries: [{ minLevel: 1, value: "final_item" }] });
    lls.registerList({ id: "deep_4", entries: [{ minLevel: 1, value: "deep_5", isList: true }] });
    lls.registerList({ id: "deep_3", entries: [{ minLevel: 1, value: "deep_4", isList: true }] });
    lls.registerList({ id: "deep_2", entries: [{ minLevel: 1, value: "deep_3", isList: true }] });
    lls.registerList({ id: "deep_1", entries: [{ minLevel: 1, value: "deep_2", isList: true }] });
    const r = lls.resolve("deep_1", 5, 1);
    expect(r.value).toBe("final_item");
  });

  it("sub-list with unknown id returns null without throwing", () => {
    lls.registerList({
      id: "orphan_parent",
      entries: [{ minLevel: 1, value: "nonexistent_child", isList: true }],
    });
    const r = lls.resolve("orphan_parent", 5, 1);
    expect(r.value).toBeNull();
  });

  // ── Weighted selection ────────────────────────────────────────────────────

  it("higher weight entries are selected more often", () => {
    const list: LeveledList = {
      id: "weighted_test",
      calculateAllLevels: true,
      entries: [
        { minLevel: 1, value: "rare_item",   weight: 1 },
        { minLevel: 1, value: "common_item", weight: 99 },
      ],
    };
    lls.registerList(list);
    let commonCount = 0;
    const runs = 300;
    for (let seed = 0; seed < runs; seed++) {
      const r = lls.resolve("weighted_test", 1, seed);
      if (r.value === "common_item") commonCount++;
    }
    // 99:1 weight → common should dominate (>85% of rolls)
    expect(commonCount).toBeGreaterThan(runs * 0.85);
  });

  it("default weight of 1 spreads selection across all entries", () => {
    const list: LeveledList = {
      id: "equal_weight",
      calculateAllLevels: true,
      entries: [
        { minLevel: 1, value: "item_a" },
        { minLevel: 1, value: "item_b" },
        { minLevel: 1, value: "item_c" },
      ],
    };
    lls.registerList(list);
    const seen = new Set<string>();
    for (let seed = 0; seed < 300; seed++) {
      const r = lls.resolve("equal_weight", 1, seed);
      if (r.value) seen.add(r.value);
    }
    expect(seen.size).toBe(3);
  });

  // ── resolveMany ───────────────────────────────────────────────────────────

  it("resolveMany returns the requested number of results", () => {
    const results = lls.resolveMany("ll_weapon_melee", 5, 3, 42);
    expect(results).toHaveLength(5);
  });

  it("resolveMany with count=0 returns an empty array", () => {
    expect(lls.resolveMany("ll_weapon_melee", 0, 5)).toHaveLength(0);
  });

  it("resolveMany results are independently rolled", () => {
    const list: LeveledList = {
      id: "many_test",
      calculateAllLevels: true,
      entries: [
        { minLevel: 1, value: "opt_a", weight: 1 },
        { minLevel: 1, value: "opt_b", weight: 1 },
      ],
    };
    lls.registerList(list);
    const results = lls.resolveMany("many_test", 30, 1, 42);
    const values = results.map(r => r.value);
    expect(values.includes("opt_a")).toBe(true);
    expect(values.includes("opt_b")).toBe(true);
  });

  it("resolveMany deterministic with same seed produces same sequence", () => {
    const a = lls.resolveMany("ll_creature_undead", 5, 6, 77);
    const b = lls.resolveMany("ll_creature_undead", 5, 6, 77);
    expect(a.map(r => r.value)).toEqual(b.map(r => r.value));
  });

  // ── Built-in weapon lists ─────────────────────────────────────────────────

  it("ll_weapon_ranged resolves to iron_bow at level 1", () => {
    const r = lls.resolve("ll_weapon_ranged", 1, 1);
    expect(r.value).toBe("iron_bow");
  });

  it("ll_weapon_ranged resolves to elven_bow at level 8+", () => {
    const r = lls.resolve("ll_weapon_ranged", 8, 1);
    expect(r.value).toBe("elven_bow");
  });

  // ── Built-in armor lists ──────────────────────────────────────────────────

  it("ll_armor_light resolves to hide_armor at level 1", () => {
    const r = lls.resolve("ll_armor_light", 1, 1);
    expect(r.value).toBe("hide_armor");
  });

  it("ll_armor_light resolves to glass_armor at level 10+", () => {
    const r = lls.resolve("ll_armor_light", 10, 1);
    expect(r.value).toBe("glass_armor");
  });

  it("ll_armor_heavy resolves to iron_cuirass at level 1", () => {
    const r = lls.resolve("ll_armor_heavy", 1, 1);
    expect(r.value).toBe("iron_cuirass");
  });

  it("ll_armor_heavy resolves to daedric_cuirass at level 12+", () => {
    const r = lls.resolve("ll_armor_heavy", 12, 1);
    expect(r.value).toBe("daedric_cuirass");
  });

  // ── Built-in creature lists ───────────────────────────────────────────────

  it("ll_creature_undead resolves to skeleton at level 1", () => {
    const r = lls.resolve("ll_creature_undead", 1, 1);
    expect(r.value).toBe("skeleton");
  });

  it("ll_creature_undead resolves to lich at level 10+", () => {
    const r = lls.resolve("ll_creature_undead", 10, 1);
    expect(r.value).toBe("lich");
  });

  it("ll_creature_beast resolves to wolf at level 1", () => {
    const r = lls.resolve("ll_creature_beast", 1, 1);
    expect(r.value).toBe("wolf");
  });

  it("ll_creature_beast resolves to frost_atronach at level 12+", () => {
    const r = lls.resolve("ll_creature_beast", 12, 1);
    expect(r.value).toBe("frost_atronach");
  });

  it("ll_creature_humanoid resolves to bandit at level 1", () => {
    const r = lls.resolve("ll_creature_humanoid", 1, 1);
    expect(r.value).toBe("bandit");
  });

  it("ll_creature_humanoid resolves to necromancer at level 12+", () => {
    const r = lls.resolve("ll_creature_humanoid", 12, 1);
    expect(r.value).toBe("necromancer");
  });

  it("ll_creature_humanoid resolves to bandit_archer at level 4", () => {
    const r = lls.resolve("ll_creature_humanoid", 4, 1);
    expect(r.value).toBe("bandit_archer");
  });

  // ── Edge cases ────────────────────────────────────────────────────────────

  it("list with a single entry always returns that entry regardless of seed", () => {
    const list: LeveledList = {
      id: "single_entry",
      entries: [{ minLevel: 1, value: "fixed_item" }],
    };
    lls.registerList(list);
    for (let seed = 0; seed < 20; seed++) {
      const r = lls.resolve("single_entry", 1, seed);
      expect(r.value).toBe("fixed_item");
    }
  });

  it("player level exactly equal to minLevel makes entry eligible", () => {
    const list: LeveledList = {
      id: "exact_level",
      entries: [{ minLevel: 5, value: "level_5_item" }],
    };
    lls.registerList(list);
    // level 4 → not eligible
    expect(lls.resolve("exact_level", 4, 1).value).toBeNull();
    // level 5 → eligible
    expect(lls.resolve("exact_level", 5, 1).value).toBe("level_5_item");
  });
});
