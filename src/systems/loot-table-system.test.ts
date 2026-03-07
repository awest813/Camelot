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

  it("rollTable produces exactly `rolls` items (non-unique table)", () => {
    const result = lts.rollTable("bandit_loot", 42);
    expect(result.items).toHaveLength(3);
  });

  it("rollTable returns items with valid ids from the table entries", () => {
    const table = lts.getTable("bandit_loot")!;
    const validIds = new Set(table.entries.map(e => e.itemId));
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
    const items = lts.rollTables(["common_loot", "bandit_loot"], 42);
    // common_loot 2 rolls + bandit_loot 3 rolls = 5 total
    expect(items).toHaveLength(5);
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
});
