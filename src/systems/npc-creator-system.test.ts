import { describe, it, expect, beforeEach } from "vitest";
import { NpcCreatorSystem } from "./npc-creator-system";

describe("NpcCreatorSystem", () => {
  let sys: NpcCreatorSystem;

  beforeEach(() => {
    sys = new NpcCreatorSystem();
  });

  // ── setMeta ───────────────────────────────────────────────────────────────

  describe("setMeta", () => {
    it("trims string fields", () => {
      sys.setMeta({ id: "  npc_guard_01  ", name: "  Guard Roland  " });
      expect(sys.draft.id).toBe("npc_guard_01");
      expect(sys.draft.name).toBe("Guard Roland");
    });

    it("clamps numeric fields to >= 0", () => {
      sys.setMeta({ baseHealth: -50, level: -1 });
      expect(sys.draft.baseHealth).toBe(0);
      expect(sys.draft.level).toBe(0);
    });

    it("sets role", () => {
      sys.setMeta({ role: "guard" });
      expect(sys.draft.role).toBe("guard");
    });

    it("sets boolean flags", () => {
      sys.setMeta({ isHostile: true, isMerchant: true, respawns: true });
      expect(sys.draft.isHostile).toBe(true);
      expect(sys.draft.isMerchant).toBe(true);
      expect(sys.draft.respawns).toBe(true);
    });

    it("partial update leaves other fields unchanged", () => {
      sys.setMeta({ id: "npc_01", name: "Bob" });
      sys.setMeta({ role: "merchant" });
      expect(sys.draft.id).toBe("npc_01");
      expect(sys.draft.role).toBe("merchant");
    });
  });

  // ── Skills ────────────────────────────────────────────────────────────────

  describe("setSkill / removeSkill", () => {
    it("stores a skill override clamped to 1–100", () => {
      sys.setSkill("blade", 75);
      expect(sys.draft.skills["blade"]).toBe(75);
    });

    it("clamps skill to minimum 1", () => {
      sys.setSkill("blade", -10);
      expect(sys.draft.skills["blade"]).toBe(1);
    });

    it("clamps skill to maximum 100", () => {
      sys.setSkill("blade", 200);
      expect(sys.draft.skills["blade"]).toBe(100);
    });

    it("removes a skill", () => {
      sys.setSkill("blade", 50);
      sys.removeSkill("blade");
      expect(sys.draft.skills["blade"]).toBeUndefined();
    });

    it("ignores empty skill id", () => {
      sys.setSkill("", 50);
      expect(Object.keys(sys.draft.skills).length).toBe(0);
    });
  });

  // ── Resistances / Weaknesses ──────────────────────────────────────────────

  describe("setResistance / removeResistance", () => {
    it("stores a resistance clamped to 0–1", () => {
      sys.setResistance("fire", 0.5);
      expect(sys.draft.damageResistances["fire"]).toBe(0.5);
    });

    it("clamps resistance to 0", () => {
      sys.setResistance("fire", -1);
      expect(sys.draft.damageResistances["fire"]).toBe(0);
    });

    it("clamps resistance to 1", () => {
      sys.setResistance("fire", 5);
      expect(sys.draft.damageResistances["fire"]).toBe(1);
    });

    it("removes a resistance", () => {
      sys.setResistance("fire", 0.5);
      sys.removeResistance("fire");
      expect(sys.draft.damageResistances["fire"]).toBeUndefined();
    });
  });

  describe("setWeakness / removeWeakness", () => {
    it("stores a weakness clamped to 0–2", () => {
      sys.setWeakness("frost", 0.75);
      expect(sys.draft.damageWeaknesses["frost"]).toBe(0.75);
    });

    it("clamps weakness to 2", () => {
      sys.setWeakness("frost", 99);
      expect(sys.draft.damageWeaknesses["frost"]).toBe(2);
    });

    it("removes a weakness", () => {
      sys.setWeakness("frost", 0.5);
      sys.removeWeakness("frost");
      expect(sys.draft.damageWeaknesses["frost"]).toBeUndefined();
    });
  });

  // ── Validation ────────────────────────────────────────────────────────────

  describe("validate", () => {
    it("requires id and name", () => {
      const report = sys.validate();
      expect(report.valid).toBe(false);
      expect(report.issues.some(i => i.includes("ID"))).toBe(true);
      expect(report.issues.some(i => i.includes("name"))).toBe(true);
    });

    it("requires level >= 1", () => {
      sys.setMeta({ id: "npc_01", name: "Bob", level: 0 });
      const report = sys.validate();
      expect(report.issues.some(i => i.includes("Level"))).toBe(true);
    });

    it("passes for a valid minimal NPC", () => {
      sys.setMeta({ id: "npc_guard", name: "Guard", level: 5, baseHealth: 80, disposition: 50 });
      const report = sys.validate();
      expect(report.valid).toBe(true);
    });

    it("flags disposition out of range", () => {
      sys.setMeta({ id: "x", name: "X", disposition: 150 });
      const report = sys.validate();
      expect(report.issues.some(i => i.includes("Disposition"))).toBe(true);
    });
  });

  // ── Export / Import ───────────────────────────────────────────────────────

  describe("exportToJson / importFromJson", () => {
    it("round-trips through JSON", () => {
      sys.setMeta({
        id: "npc_innkeeper", name: "Roland",
        role: "innkeeper", level: 3, baseHealth: 120,
      });
      sys.setSkill("speechcraft", 80);
      sys.setResistance("fire", 0.2);

      const json = sys.exportToJson();
      const sys2 = new NpcCreatorSystem();
      expect(sys2.importFromJson(json)).toBe(true);
      expect(sys2.draft.id).toBe("npc_innkeeper");
      expect(sys2.draft.name).toBe("Roland");
      expect(sys2.draft.level).toBe(3);
      expect(sys2.draft.skills["speechcraft"]).toBe(80);
      expect(sys2.draft.damageResistances["fire"]).toBe(0.2);
    });

    it("returns false for invalid JSON", () => {
      expect(sys.importFromJson("bad")).toBe(false);
    });
  });

  // ── Reset ─────────────────────────────────────────────────────────────────

  describe("reset", () => {
    it("clears all fields to defaults", () => {
      sys.setMeta({ id: "npc_test", name: "Test", level: 10 });
      sys.setSkill("blade", 90);
      sys.reset();
      expect(sys.draft.id).toBe("");
      expect(sys.draft.level).toBe(1);
      expect(Object.keys(sys.draft.skills).length).toBe(0);
    });
  });

  // ── toDefinition ──────────────────────────────────────────────────────────

  describe("toDefinition", () => {
    it("omits empty optional string fields", () => {
      sys.setMeta({ id: "npc_01", name: "Bob", level: 1, baseHealth: 100 });
      const def = sys.toDefinition();
      expect(def.factionId).toBeUndefined();
      expect(def.dialogueId).toBeUndefined();
      expect(def.lootTableId).toBeUndefined();
    });

    it("omits skills when empty", () => {
      sys.setMeta({ id: "x", name: "X" });
      const def = sys.toDefinition();
      expect(def.skills).toBeUndefined();
    });

    it("includes skills when set", () => {
      sys.setMeta({ id: "x", name: "X" });
      sys.setSkill("blade", 60);
      const def = sys.toDefinition();
      expect(def.skills?.["blade"]).toBe(60);
    });
  });
});
