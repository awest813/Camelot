import { describe, it, expect, beforeEach } from "vitest";
import { LootTableCreatorSystem } from "./loot-table-creator-system";

describe("LootTableCreatorSystem", () => {
  let sys: LootTableCreatorSystem;

  beforeEach(() => {
    sys = new LootTableCreatorSystem();
  });

  // ── constructor ────────────────────────────────────────────────────────────

  describe("constructor", () => {
    it("starts with a blank draft", () => {
      expect(sys.draft.id).toBe("");
      expect(sys.draft.rolls).toBe(1);
      expect(sys.draft.unique).toBe(false);
      expect(sys.draft.noneWeight).toBe(0);
      expect(sys.entries).toHaveLength(0);
    });

    it("accepts initial values", () => {
      const s = new LootTableCreatorSystem({ id: "boss_loot", rolls: 3 });
      expect(s.draft.id).toBe("boss_loot");
      expect(s.draft.rolls).toBe(3);
    });
  });

  // ── setMeta ────────────────────────────────────────────────────────────────

  describe("setMeta", () => {
    it("trims id", () => {
      sys.setMeta({ id: "  common_loot  " });
      expect(sys.draft.id).toBe("common_loot");
    });

    it("clamps rolls to [1, 20]", () => {
      sys.setMeta({ rolls: 0 });
      expect(sys.draft.rolls).toBe(1);
      sys.setMeta({ rolls: 99 });
      expect(sys.draft.rolls).toBe(20);
    });

    it("clamps noneWeight to [0, 10000]", () => {
      sys.setMeta({ noneWeight: -5 });
      expect(sys.draft.noneWeight).toBe(0);
      sys.setMeta({ noneWeight: 99999 });
      expect(sys.draft.noneWeight).toBe(10_000);
    });

    it("partial update leaves other fields unchanged", () => {
      sys.setMeta({ id: "t1", rolls: 2 });
      sys.setMeta({ unique: true });
      expect(sys.draft.id).toBe("t1");
      expect(sys.draft.rolls).toBe(2);
      expect(sys.draft.unique).toBe(true);
    });
  });

  // ── addEntry ───────────────────────────────────────────────────────────────

  describe("addEntry", () => {
    it("adds an entry with defaults", () => {
      const key = sys.addEntry();
      expect(sys.entries).toHaveLength(1);
      expect(sys.entries[0].entryKey).toBe(key);
      expect(sys.entries[0].weight).toBe(10);
      expect(sys.entries[0].minQuantity).toBe(1);
      expect(sys.entries[0].maxQuantity).toBe(1);
      expect(sys.entries[0].guarantee).toBe(false);
    });

    it("uses provided entryKey", () => {
      const key = sys.addEntry({ entryKey: "iron_sword", itemId: "iron_sword", weight: 30 });
      expect(key).toBe("iron_sword");
      expect(sys.entries[0].itemId).toBe("iron_sword");
      expect(sys.entries[0].weight).toBe(30);
    });

    it("auto-generates unique keys", () => {
      const a = sys.addEntry();
      const b = sys.addEntry();
      expect(a).not.toBe(b);
    });

    it("normalises minQuantity <= maxQuantity", () => {
      sys.addEntry({ minQuantity: 5, maxQuantity: 2 });
      expect(sys.entries[0].maxQuantity).toBe(5);
    });
  });

  // ── updateEntry ────────────────────────────────────────────────────────────

  describe("updateEntry", () => {
    it("updates entry fields", () => {
      const key = sys.addEntry({ itemId: "gold" });
      const ok  = sys.updateEntry(key, { weight: 50, minQuantity: 2, maxQuantity: 4, guarantee: true });
      expect(ok).toBe(true);
      const e = sys.entries[0];
      expect(e.weight).toBe(50);
      expect(e.minQuantity).toBe(2);
      expect(e.maxQuantity).toBe(4);
      expect(e.guarantee).toBe(true);
    });

    it("clamps negative weight to 0", () => {
      const key = sys.addEntry();
      sys.updateEntry(key, { weight: -5 });
      expect(sys.entries[0].weight).toBe(0);
    });

    it("enforces minQuantity <= maxQuantity after update", () => {
      const key = sys.addEntry({ minQuantity: 1, maxQuantity: 3 });
      sys.updateEntry(key, { minQuantity: 5 });
      expect(sys.entries[0].maxQuantity).toBe(5);
    });

    it("returns false for unknown key", () => {
      expect(sys.updateEntry("no_such", { weight: 10 })).toBe(false);
    });
  });

  // ── removeEntry ────────────────────────────────────────────────────────────

  describe("removeEntry", () => {
    it("removes the entry", () => {
      const key = sys.addEntry({ itemId: "gem" });
      expect(sys.removeEntry(key)).toBe(true);
      expect(sys.entries).toHaveLength(0);
    });

    it("returns false for unknown key", () => {
      expect(sys.removeEntry("ghost")).toBe(false);
    });
  });

  // ── moveEntryUp / moveEntryDown ────────────────────────────────────────────

  describe("moveEntryUp / moveEntryDown", () => {
    it("reorders entries correctly", () => {
      const a = sys.addEntry({ itemId: "a" });
      const b = sys.addEntry({ itemId: "b" });
      const c = sys.addEntry({ itemId: "c" });

      sys.moveEntryUp(b);
      expect(sys.entries.map(e => e.itemId)).toEqual(["b", "a", "c"]);

      sys.moveEntryDown(a);
      expect(sys.entries.map(e => e.itemId)).toEqual(["b", "c", "a"]);
    });

    it("moveEntryUp returns false at first position", () => {
      const a = sys.addEntry();
      expect(sys.moveEntryUp(a)).toBe(false);
    });

    it("moveEntryDown returns false at last position", () => {
      const a = sys.addEntry();
      expect(sys.moveEntryDown(a)).toBe(false);
    });
  });

  // ── validate ──────────────────────────────────────────────────────────────

  describe("validate", () => {
    it("reports missing id and empty entries", () => {
      const report = sys.validate();
      expect(report.valid).toBe(false);
      expect(report.issues).toContain("Loot table ID is required.");
      expect(report.issues).toContain("Loot table must have at least one entry.");
    });

    it("passes a minimal valid table", () => {
      sys.setMeta({ id: "bandits" });
      sys.addEntry({ itemId: "gold_coins", weight: 10 });
      expect(sys.validate().valid).toBe(true);
    });

    it("reports entries with no item or sub-table", () => {
      sys.setMeta({ id: "t" });
      sys.addEntry({ weight: 5 }); // no itemId, itemName, or subTableId
      const report = sys.validate();
      expect(report.valid).toBe(false);
      expect(report.issues.some(i => i.includes("produce nothing"))).toBe(true);
    });

    it("reports minLevel > maxLevel condition error", () => {
      sys.setMeta({ id: "t" });
      sys.addEntry({ itemId: "gem", minLevel: 10, maxLevel: 5 });
      const report = sys.validate();
      expect(report.valid).toBe(false);
      expect(report.issues.some(i => i.includes("minLevel"))).toBe(true);
    });

    it("reports zero total weight for non-guaranteed entries", () => {
      sys.setMeta({ id: "t" });
      sys.addEntry({ itemId: "gem", weight: 0 });
      const report = sys.validate();
      expect(report.valid).toBe(false);
      expect(report.issues.some(i => i.includes("zero weight"))).toBe(true);
    });
  });

  // ── toLootTable ────────────────────────────────────────────────────────────

  describe("toLootTable", () => {
    it("produces correct LootTable fields", () => {
      sys.setMeta({ id: "common", rolls: 2, unique: true, noneWeight: 5 });
      sys.addEntry({ itemId: "gold", weight: 20, minQuantity: 5, maxQuantity: 10 });
      sys.addEntry({ entryKey: "gem_key", itemId: "ruby", weight: 5, guarantee: true });

      const table = sys.toLootTable();
      expect(table.id).toBe("common");
      expect(table.rolls).toBe(2);
      expect(table.unique).toBe(true);
      expect(table.noneWeight).toBe(5);
      expect(table.entries).toHaveLength(2);
      expect(table.entries[0].itemId).toBe("gold");
      expect(table.entries[0].minQuantity).toBe(5);
      expect(table.entries[1].guarantee).toBe(true);
    });

    it("omits unique and noneWeight when defaults", () => {
      sys.setMeta({ id: "t", unique: false, noneWeight: 0 });
      sys.addEntry({ itemId: "x", weight: 1 });
      const table = sys.toLootTable();
      expect(table.unique).toBeUndefined();
      expect(table.noneWeight).toBeUndefined();
    });

    it("includes condition block when minLevel or maxLevel is set", () => {
      sys.setMeta({ id: "t" });
      sys.addEntry({ itemId: "rare_sword", weight: 5, minLevel: 10, maxLevel: 20 });
      const table = sys.toLootTable();
      expect(table.entries[0].condition?.minLevel).toBe(10);
      expect(table.entries[0].condition?.maxLevel).toBe(20);
    });

    it("uses subTableId instead of itemId when set", () => {
      sys.setMeta({ id: "t" });
      sys.addEntry({ subTableId: "boss_drops", weight: 1 });
      const table = sys.toLootTable();
      expect(table.entries[0].subTableId).toBe("boss_drops");
      expect(table.entries[0].itemId).toBeUndefined();
    });
  });

  // ── export / import round-trip ─────────────────────────────────────────────

  describe("exportToJson / importFromJson", () => {
    it("round-trips a full draft", () => {
      sys.setMeta({ id: "boss_loot", rolls: 3, unique: true, noneWeight: 10 });
      sys.addEntry({ entryKey: "e1", itemId: "legendary_sword", weight: 5 });
      sys.addEntry({ entryKey: "e2", subTableId: "treasure_chest", weight: 20, guarantee: true });

      const json = sys.exportToJson();
      const other = new LootTableCreatorSystem();
      expect(other.importFromJson(json)).toBe(true);

      expect(other.draft.id).toBe("boss_loot");
      expect(other.draft.rolls).toBe(3);
      expect(other.entries).toHaveLength(2);
      expect(other.entries[0].itemId).toBe("legendary_sword");
      expect(other.entries[1].subTableId).toBe("treasure_chest");
      expect(other.entries[1].guarantee).toBe(true);
    });

    it("returns false for malformed JSON", () => {
      expect(sys.importFromJson("!!!")).toBe(false);
    });

    it("returns false when entries field is absent", () => {
      expect(sys.importFromJson('{"id":"t"}')).toBe(false);
    });
  });

  // ── reset ─────────────────────────────────────────────────────────────────

  describe("reset", () => {
    it("restores blank draft", () => {
      sys.setMeta({ id: "t1", rolls: 5 });
      sys.addEntry({ itemId: "gold" });
      sys.reset();
      expect(sys.draft.id).toBe("");
      expect(sys.draft.rolls).toBe(1);
      expect(sys.entries).toHaveLength(0);
    });
  });
});
