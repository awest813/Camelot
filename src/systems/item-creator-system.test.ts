import { describe, it, expect, beforeEach } from "vitest";
import { ItemCreatorSystem } from "./item-creator-system";

describe("ItemCreatorSystem", () => {
  let sys: ItemCreatorSystem;

  beforeEach(() => {
    sys = new ItemCreatorSystem();
  });

  // ── setMeta ───────────────────────────────────────────────────────────────

  describe("setMeta", () => {
    it("trims string fields", () => {
      sys.setMeta({ id: "  item_sword  ", name: "  Iron Sword  ", description: "  Sharp.  " });
      expect(sys.draft.id).toBe("item_sword");
      expect(sys.draft.name).toBe("Iron Sword");
      expect(sys.draft.description).toBe("Sharp.");
    });

    it("clamps maxStack to at least 1", () => {
      sys.setMeta({ maxStack: -5 });
      expect(sys.draft.maxStack).toBe(1);
    });

    it("rounds maxStack", () => {
      sys.setMeta({ maxStack: 7.9 });
      expect(sys.draft.maxStack).toBe(8);
    });

    it("sets slot", () => {
      sys.setMeta({ slot: "mainHand" });
      expect(sys.draft.slot).toBe("mainHand");
    });

    it("sets stackable", () => {
      sys.setMeta({ stackable: true });
      expect(sys.draft.stackable).toBe(true);
    });

    it("partial update leaves other fields unchanged", () => {
      sys.setMeta({ id: "item_01", name: "Sword" });
      sys.setMeta({ stackable: true });
      expect(sys.draft.id).toBe("item_01");
      expect(sys.draft.stackable).toBe(true);
    });
  });

  // ── Tags ──────────────────────────────────────────────────────────────────

  describe("addTag / removeTag", () => {
    it("adds a tag", () => {
      sys.addTag("weapon");
      expect(sys.draft.tags).toContain("weapon");
    });

    it("does not add duplicate tags", () => {
      sys.addTag("weapon");
      sys.addTag("weapon");
      expect(sys.draft.tags.filter(t => t === "weapon").length).toBe(1);
    });

    it("ignores empty/whitespace tags", () => {
      sys.addTag("");
      sys.addTag("   ");
      expect(sys.draft.tags.length).toBe(0);
    });

    it("removes a tag", () => {
      sys.addTag("weapon");
      sys.removeTag("weapon");
      expect(sys.draft.tags).not.toContain("weapon");
    });

    it("trims tags before adding", () => {
      sys.addTag("  armor  ");
      expect(sys.draft.tags).toContain("armor");
    });
  });

  // ── Validation ────────────────────────────────────────────────────────────

  describe("validate", () => {
    it("requires id, name, and description", () => {
      const report = sys.validate();
      expect(report.valid).toBe(false);
      expect(report.issues.some(i => i.includes("ID"))).toBe(true);
      expect(report.issues.some(i => i.includes("name"))).toBe(true);
      expect(report.issues.some(i => i.includes("description"))).toBe(true);
    });

    it("warns when stackable but maxStack < 2", () => {
      sys.setMeta({ id: "x", name: "X", description: "d", stackable: true, maxStack: 1 });
      const report = sys.validate();
      expect(report.issues.some(i => i.includes("max stack"))).toBe(true);
    });

    it("passes for a valid item", () => {
      sys.setMeta({ id: "item_sword", name: "Iron Sword", description: "A sturdy blade." });
      const report = sys.validate();
      expect(report.valid).toBe(true);
    });

    it("passes for valid stackable item", () => {
      sys.setMeta({
        id: "item_arrow", name: "Iron Arrow", description: "Fletched iron arrows.",
        stackable: true, maxStack: 200,
      });
      const report = sys.validate();
      expect(report.valid).toBe(true);
    });
  });

  // ── Export / Import ───────────────────────────────────────────────────────

  describe("exportToJson / importFromJson", () => {
    it("round-trips through JSON", () => {
      sys.setMeta({
        id: "item_health_potion", name: "Health Potion",
        description: "Restores 50 health.", stackable: true, maxStack: 10,
      });
      sys.addTag("consumable");
      sys.addTag("potion");

      const json = sys.exportToJson();
      const sys2 = new ItemCreatorSystem();
      expect(sys2.importFromJson(json)).toBe(true);
      expect(sys2.draft.id).toBe("item_health_potion");
      expect(sys2.draft.stackable).toBe(true);
      expect(sys2.draft.maxStack).toBe(10);
      expect(sys2.draft.tags).toContain("consumable");
    });

    it("returns false for invalid JSON", () => {
      expect(sys.importFromJson("not-json")).toBe(false);
    });

    it("returns false when id is not a string", () => {
      expect(sys.importFromJson('{"id": 42}')).toBe(false);
    });
  });

  // ── toDefinition ──────────────────────────────────────────────────────────

  describe("toDefinition", () => {
    it("omits maxStack for non-stackable items", () => {
      sys.setMeta({ id: "x", name: "X", description: "D", stackable: false, maxStack: 5 });
      const def = sys.toDefinition();
      expect(def.maxStack).toBeUndefined();
    });

    it("includes maxStack for stackable items", () => {
      sys.setMeta({ id: "x", name: "X", description: "D", stackable: true, maxStack: 20 });
      const def = sys.toDefinition();
      expect(def.maxStack).toBe(20);
    });

    it("omits slot when empty string", () => {
      sys.setMeta({ id: "x", name: "X", description: "D", slot: "" });
      const def = sys.toDefinition();
      expect(def.slot).toBeUndefined();
    });

    it("omits tags when array is empty", () => {
      sys.setMeta({ id: "x", name: "X", description: "D" });
      const def = sys.toDefinition();
      expect(def.tags).toBeUndefined();
    });

    it("includes tags when set", () => {
      sys.setMeta({ id: "x", name: "X", description: "D" });
      sys.addTag("weapon");
      const def = sys.toDefinition();
      expect(def.tags).toContain("weapon");
    });
  });

  // ── Reset ─────────────────────────────────────────────────────────────────

  describe("reset", () => {
    it("clears all state to defaults", () => {
      sys.setMeta({ id: "sword", name: "Sword", description: "D", stackable: true });
      sys.addTag("weapon");
      sys.reset();
      expect(sys.draft.id).toBe("");
      expect(sys.draft.tags.length).toBe(0);
      expect(sys.draft.stackable).toBe(false);
    });
  });
});
