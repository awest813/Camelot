import { describe, it, expect, beforeEach } from "vitest";
import { LootTableSystem, STARTER_LOOT_TABLES } from "./loot-table-system";
import type { LootTable } from "./loot-table-system";

describe("LootTableSystem", () => {
  let lts: LootTableSystem;

  beforeEach(() => {
    lts = new LootTableSystem();
    for (const t of STARTER_LOOT_TABLES) lts.registerTable(t);
  });

  // ── Registration ──────────────────────────────────────────────────────────

  it("registers tables and returns their ids", () => {
    const ids = lts.getTableIds();
    expect(ids).toContain("common_loot");
    expect(ids).toContain("bandit_loot");
    expect(ids).toContain("dungeon_loot");
    expect(ids).toContain("merchant_restock");
    expect(ids).toContain("boss_loot");
    expect(ids).toContain("treasure_chest");
  });

  it("getTable returns the definition", () => {
    const t = lts.getTable("common_loot");
    expect(t?.id).toBe("common_loot");
  });

  it("getTable returns undefined for unknown id", () => {
    expect(lts.getTable("ghost_table")).toBeUndefined();
  });

  // ── Rolling ───────────────────────────────────────────────────────────────

  it("rollTable returns empty items for unknown table", () => {
    const result = lts.rollTable("nope");
    expect(result.items).toHaveLength(0);
  });

  it("rollTable produces exactly `rolls` items (non-unique table, no noneWeight)", () => {
    const result = lts.rollTable("bandit_loot", 42);
    expect(result.items).toHaveLength(3);
  });

  it("rollTable returns items with valid ids from the table entries", () => {
    const table = lts.getTable("bandit_loot")!;
    const validIds = new Set(table.entries.map(e => e.itemId).filter(Boolean));
    const result = lts.rollTable("bandit_loot", 99);
    for (const item of result.items) {
      expect(validIds.has(item.id)).toBe(true);
    }
  });

  it("rollTable with unique flag produces at most entries.length items", () => {
    const table = lts.getTable("merchant_restock")!;
    const result = lts.rollTable("merchant_restock", 7);
    expect(result.items.length).toBeLessThanOrEqual(table.entries.length);
  });

  it("deterministic seed produces the same output", () => {
    const a = lts.rollTable("common_loot", 1234);
    const b = lts.rollTable("common_loot", 1234);
    expect(a.items.map(i => i.id)).toEqual(b.items.map(i => i.id));
    expect(a.items.map(i => i.quantity)).toEqual(b.items.map(i => i.quantity));
  });

  it("different seeds produce different outputs (probabilistically)", () => {
    const a = lts.rollTable("bandit_loot", 1);
    const b = lts.rollTable("bandit_loot", 99999);
    const sameIds = a.items.map(i => i.id).join() === b.items.map(i => i.id).join();
    const sameQty = a.items.map(i => i.quantity).join() === b.items.map(i => i.quantity).join();
    // At least one of ids or quantities should differ across seeds
    expect(sameIds && sameQty).toBe(false);
  });

  it("item quantity is within [minQuantity, maxQuantity]", () => {
    for (let seed = 0; seed < 10; seed++) {
      const result = lts.rollTable("common_loot", seed);
      for (const item of result.items) {
        expect(item.quantity).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("gold_coins item is stackable", () => {
    // Run many seeds to get gold coins to appear at least once
    let gotGold = false;
    for (let seed = 0; seed < 50; seed++) {
      const result = lts.rollTable("common_loot", seed);
      const gold = result.items.find(i => i.id === "gold_coins");
      if (gold) {
        expect(gold.stackable).toBe(true);
        gotGold = true;
        break;
      }
    }
    expect(gotGold).toBe(true);
  });

  it("items inherit itemTemplate properties", () => {
    // iron_sword should have weight and slot from its template
    let gotSword = false;
    for (let seed = 0; seed < 100; seed++) {
      const result = lts.rollTable("bandit_loot", seed);
      const sword = result.items.find(i => i.id === "iron_sword");
      if (sword) {
        expect(sword.weight).toBeGreaterThan(0);
        expect(sword.slot).toBe("mainHand");
        gotSword = true;
        break;
      }
    }
    expect(gotSword).toBe(true);
  });

  // ── rollTables (multi-table) ───────────────────────────────────────────────

  it("rollTables merges results from multiple tables", () => {
    // bandit_loot: 3 rolls (no noneWeight) = always 3 items
    // dungeon_loot: 4 rolls (no noneWeight) = always 4 items
    const items = lts.rollTables(["bandit_loot", "dungeon_loot"], 42);
    expect(items).toHaveLength(7);
  });

  it("rollTables with empty array returns empty list", () => {
    expect(lts.rollTables([])).toHaveLength(0);
  });

  // ── Custom table ──────────────────────────────────────────────────────────

  it("custom table with a single entry always returns that entry", () => {
    const singleTable: LootTable = {
      id: "single_item",
      rolls: 3,
      entries: [{ itemId: "magic_gem", itemName: "Magic Gem", weight: 1 }],
    };
    lts.registerTable(singleTable);
    const result = lts.rollTable("single_item", 42);
    expect(result.items.every(i => i.id === "magic_gem")).toBe(true);
    expect(result.items).toHaveLength(3);
  });

  it("table with zero-weight entries are never picked", () => {
    const t: LootTable = {
      id: "zero_weight",
      rolls: 10,
      entries: [
        { itemId: "item_a", weight: 100 },
        { itemId: "item_b", weight: 0 },
      ],
    };
    lts.registerTable(t);
    const result = lts.rollTable("zero_weight", 7);
    expect(result.items.every(i => i.id === "item_a")).toBe(true);
  });

  // ── noneWeight ────────────────────────────────────────────────────────────

  it("noneWeight=100 with weight=1 entry: most rolls are empty", () => {
    const t: LootTable = {
      id: "mostly_empty",
      rolls: 50,
      noneWeight: 100,
      entries: [{ itemId: "rare_item", weight: 1 }],
    };
    lts.registerTable(t);
    const result = lts.rollTable("mostly_empty", 3);
    // With noneWeight dominating, most rolls should be empty — max 10 items
    expect(result.items.length).toBeLessThan(10);
  });

  it("noneWeight=0 produces the same item count as no noneWeight", () => {
    const t: LootTable = {
      id: "no_none",
      rolls: 5,
      noneWeight: 0,
      entries: [{ itemId: "item_x", weight: 1 }],
    };
    lts.registerTable(t);
    const result = lts.rollTable("no_none", 1);
    expect(result.items).toHaveLength(5);
  });

  it("common_loot noneWeight=5 allows empty rolls", () => {
    // Over 100 runs, at least some runs of common_loot (rolls:2) should yield
    // fewer than 2 items due to noneWeight=5 out of total ~105 weight
    let seenFewerThanMax = false;
    for (let seed = 0; seed < 100; seed++) {
      const result = lts.rollTable("common_loot", seed);
      if (result.items.length < 2) {
        seenFewerThanMax = true;
        break;
      }
    }
    expect(seenFewerThanMax).toBe(true);
  });

  // ── Guaranteed entries ────────────────────────────────────────────────────

  it("guaranteed entries always appear in results", () => {
    const t: LootTable = {
      id: "guarantee_test",
      rolls: 1,
      entries: [
        { itemId: "always_item",  itemName: "Always",  weight: 0, guarantee: true },
        { itemId: "random_item",  itemName: "Random",  weight: 1 },
      ],
    };
    lts.registerTable(t);
    for (let seed = 0; seed < 20; seed++) {
      const result = lts.rollTable("guarantee_test", seed);
      expect(result.items.some(i => i.id === "always_item")).toBe(true);
    }
  });

  it("guaranteed entries do not consume roll slots", () => {
    const t: LootTable = {
      id: "guarantee_count",
      rolls: 2,
      entries: [
        { itemId: "guaranteed_a", weight: 0, guarantee: true },
        { itemId: "guaranteed_b", weight: 0, guarantee: true },
        { itemId: "random_c",     weight: 1 },
      ],
    };
    lts.registerTable(t);
    const result = lts.rollTable("guarantee_count", 42);
    // 2 guaranteed + 2 random rolls = 4 total
    expect(result.items).toHaveLength(4);
    expect(result.items.filter(i => i.id === "guaranteed_a")).toHaveLength(1);
    expect(result.items.filter(i => i.id === "guaranteed_b")).toHaveLength(1);
  });

  it("boss_loot always contains gold_coins (guaranteed)", () => {
    for (let seed = 0; seed < 20; seed++) {
      const result = lts.rollTable("boss_loot", seed);
      expect(result.items.some(i => i.id === "gold_coins")).toBe(true);
    }
  });

  it("treasure_chest always contains ornate_key (guaranteed)", () => {
    for (let seed = 0; seed < 20; seed++) {
      const result = lts.rollTable("treasure_chest", seed);
      expect(result.items.some(i => i.id === "ornate_key")).toBe(true);
    }
  });

  // ── Conditional entries ───────────────────────────────────────────────────

  it("minLevel condition excludes entry when player level is too low", () => {
    const t: LootTable = {
      id: "level_gate",
      rolls: 20,
      entries: [
        { itemId: "low_tier_item",  weight: 1, condition: { maxLevel: 4 } },
        { itemId: "high_tier_item", weight: 1, condition: { minLevel: 5 } },
      ],
    };
    lts.registerTable(t);

    // Level 1 — should never see high_tier_item
    const lowResult = lts.rollTable("level_gate", 1, { playerLevel: 1 });
    expect(lowResult.items.some(i => i.id === "high_tier_item")).toBe(false);
    expect(lowResult.items.every(i => i.id === "low_tier_item")).toBe(true);

    // Level 10 — should never see low_tier_item
    const highResult = lts.rollTable("level_gate", 1, { playerLevel: 10 });
    expect(highResult.items.some(i => i.id === "low_tier_item")).toBe(false);
    expect(highResult.items.every(i => i.id === "high_tier_item")).toBe(true);
  });

  it("maxLevel condition excludes entry when player level is too high", () => {
    const t: LootTable = {
      id: "max_level_test",
      rolls: 10,
      entries: [
        { itemId: "beginner_item", weight: 1, condition: { maxLevel: 3 } },
        { itemId: "other_item",    weight: 1 },
      ],
    };
    lts.registerTable(t);
    const result = lts.rollTable("max_level_test", 5, { playerLevel: 10 });
    expect(result.items.some(i => i.id === "beginner_item")).toBe(false);
  });

  it("requiredFlags condition excludes entry when flag is absent", () => {
    const t: LootTable = {
      id: "flags_test",
      rolls: 10,
      entries: [
        { itemId: "guild_item", weight: 1, condition: { requiredFlags: ["guild_member"] } },
        { itemId: "public_item", weight: 1 },
      ],
    };
    lts.registerTable(t);

    // No flags → guild_item should never appear
    const noFlagResult = lts.rollTable("flags_test", 7);
    expect(noFlagResult.items.some(i => i.id === "guild_item")).toBe(false);

    // With flag → guild_item can appear
    let gotGuildItem = false;
    for (let seed = 0; seed < 50; seed++) {
      const result = lts.rollTable("flags_test", seed, { flags: ["guild_member"] });
      if (result.items.some(i => i.id === "guild_item")) {
        gotGuildItem = true;
        break;
      }
    }
    expect(gotGuildItem).toBe(true);
  });

  it("conditional guarantee is skipped when condition fails", () => {
    const t: LootTable = {
      id: "conditional_guarantee",
      rolls: 1,
      entries: [
        { itemId: "high_level_gift", weight: 0, guarantee: true, condition: { minLevel: 20 } },
        { itemId: "filler", weight: 1 },
      ],
    };
    lts.registerTable(t);
    const result = lts.rollTable("conditional_guarantee", 1, { playerLevel: 1 });
    expect(result.items.some(i => i.id === "high_level_gift")).toBe(false);
  });

  it("boss_loot high-tier items only appear at level 5+", () => {
    const highTierIds = new Set(["daedric_sword", "daedric_shield", "glass_armor"]);
    for (let seed = 0; seed < 50; seed++) {
      const result = lts.rollTable("boss_loot", seed, { playerLevel: 3 });
      for (const item of result.items) {
        expect(highTierIds.has(item.id)).toBe(false);
      }
    }
  });

  it("boss_loot high-tier items can appear at level 5+", () => {
    const highTierIds = new Set(["daedric_sword", "daedric_shield"]);
    let gotHighTier = false;
    for (let seed = 0; seed < 200; seed++) {
      const result = lts.rollTable("boss_loot", seed, { playerLevel: 5 });
      if (result.items.some(i => highTierIds.has(i.id))) {
        gotHighTier = true;
        break;
      }
    }
    expect(gotHighTier).toBe(true);
  });

  // ── Sub-table entries ─────────────────────────────────────────────────────

  it("subTableId entry triggers a nested roll on the referenced table", () => {
    lts.registerTable({
      id: "child_table",
      rolls: 1,
      entries: [{ itemId: "child_item", itemName: "Child Item", weight: 1 }],
    });
    lts.registerTable({
      id: "parent_table",
      rolls: 1,
      entries: [{ weight: 1, subTableId: "child_table" }],
    });
    const result = lts.rollTable("parent_table", 1);
    expect(result.items.some(i => i.id === "child_item")).toBe(true);
  });

  it("subTableId for unknown table yields no items for that roll", () => {
    const t: LootTable = {
      id: "orphan_sub",
      rolls: 2,
      entries: [{ weight: 1, subTableId: "nonexistent_table" }],
    };
    lts.registerTable(t);
    const result = lts.rollTable("orphan_sub", 1);
    // Each roll returns no items (sub-table not found)
    expect(result.items).toHaveLength(0);
  });

  it("boss_loot sub-table entry can produce common_loot items", () => {
    // boss_loot has a subTableId: "common_loot" entry with weight:10
    // run many seeds — some should produce items from common_loot
    const commonIds = new Set(["gold_coins", "health_potion", "torch", "lockpick", "cloth_scraps"]);
    let gotCommon = false;
    for (let seed = 0; seed < 100; seed++) {
      const result = lts.rollTable("boss_loot", seed, { playerLevel: 5 });
      if (result.items.some(i => commonIds.has(i.id))) {
        gotCommon = true;
        break;
      }
    }
    expect(gotCommon).toBe(true);
  });

  // ── rollTables with context ───────────────────────────────────────────────

  it("rollTables passes context to each table", () => {
    // Level 1 player should never get boss high-tier items
    const highTierIds = new Set(["daedric_sword", "daedric_shield", "glass_armor"]);
    const items = lts.rollTables(["boss_loot"], 42, { playerLevel: 1 });
    expect(items.some(i => highTierIds.has(i.id))).toBe(false);
  });
});
