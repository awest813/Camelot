import { describe, it, expect, beforeEach } from "vitest";
import { NpcCreatorSystem, NPC_VOICE_TYPES, NPC_PERSONALITY_TRAITS } from "./npc-creator-system";

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

    it("sets voiceType", () => {
      sys.setMeta({ voiceType: "old_man" });
      expect(sys.draft.voiceType).toBe("old_man");
    });

    it("sets scheduleId trimmed", () => {
      sys.setMeta({ scheduleId: "  sched_innkeeper  " });
      expect(sys.draft.scheduleId).toBe("sched_innkeeper");
    });

    it("sets new role types (bandit, healer, trainer, beggar)", () => {
      for (const role of ["bandit", "healer", "trainer", "beggar"] as const) {
        sys.setMeta({ role });
        expect(sys.draft.role).toBe(role);
      }
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

  // ── Personality Traits ────────────────────────────────────────────────────

  describe("addPersonalityTrait / removePersonalityTrait / clearPersonalityTraits", () => {
    it("adds a personality trait", () => {
      sys.addPersonalityTrait("brave");
      expect(sys.draft.personalityTraits).toContain("brave");
    });

    it("ignores duplicate traits", () => {
      sys.addPersonalityTrait("brave");
      sys.addPersonalityTrait("brave");
      expect(sys.draft.personalityTraits.filter(t => t === "brave")).toHaveLength(1);
    });

    it("adds multiple distinct traits", () => {
      sys.addPersonalityTrait("brave");
      sys.addPersonalityTrait("cunning");
      expect(sys.draft.personalityTraits).toHaveLength(2);
    });

    it("removes a trait", () => {
      sys.addPersonalityTrait("brave");
      sys.removePersonalityTrait("brave");
      expect(sys.draft.personalityTraits).not.toContain("brave");
    });

    it("removePersonalityTrait is no-op for absent trait", () => {
      sys.removePersonalityTrait("brave");
      expect(sys.draft.personalityTraits).toHaveLength(0);
    });

    it("clears all traits", () => {
      sys.addPersonalityTrait("brave");
      sys.addPersonalityTrait("greedy");
      sys.clearPersonalityTraits();
      expect(sys.draft.personalityTraits).toHaveLength(0);
    });
  });

  // ── AI Profile ────────────────────────────────────────────────────────────

  describe("setAIProfileField / removeAIProfileField / clearAIProfile", () => {
    it("sets an AI profile field", () => {
      sys.setAIProfileField("aggroRange", 20);
      expect(sys.draft.aiProfile.aggroRange).toBe(20);
    });

    it("clamps numeric fields to >= 0", () => {
      sys.setAIProfileField("aggroRange", -5);
      expect(sys.draft.aiProfile.aggroRange).toBe(0);
    });

    it("clamps fleesBelowHealthPct to 0–1", () => {
      sys.setAIProfileField("fleesBelowHealthPct", 2);
      expect(sys.draft.aiProfile.fleesBelowHealthPct).toBe(1);
      sys.setAIProfileField("fleesBelowHealthPct", -0.5);
      expect(sys.draft.aiProfile.fleesBelowHealthPct).toBe(0);
    });

    it("allows fleesBelowHealthPct of 0 (never flees)", () => {
      sys.setAIProfileField("fleesBelowHealthPct", 0);
      expect(sys.draft.aiProfile.fleesBelowHealthPct).toBe(0);
    });

    it("sets multiple AI profile fields independently", () => {
      sys.setAIProfileField("attackDamage", 15);
      sys.setAIProfileField("attackCooldown", 1.2);
      expect(sys.draft.aiProfile.attackDamage).toBe(15);
      expect(sys.draft.aiProfile.attackCooldown).toBe(1.2);
    });

    it("removes a single AI profile field", () => {
      sys.setAIProfileField("aggroRange", 20);
      sys.removeAIProfileField("aggroRange");
      expect(sys.draft.aiProfile.aggroRange).toBeUndefined();
    });

    it("clears all AI profile overrides", () => {
      sys.setAIProfileField("aggroRange", 20);
      sys.setAIProfileField("moveSpeed", 3);
      sys.clearAIProfile();
      expect(Object.keys(sys.draft.aiProfile)).toHaveLength(0);
    });
  });

  // ── Starting Equipment ────────────────────────────────────────────────────

  describe("addStartingEquipment / removeStartingEquipment / clearStartingEquipment", () => {
    it("adds an item ID", () => {
      sys.addStartingEquipment("sword_01");
      expect(sys.draft.startingEquipment).toContain("sword_01");
    });

    it("trims whitespace from item IDs", () => {
      sys.addStartingEquipment("  shield_01  ");
      expect(sys.draft.startingEquipment).toContain("shield_01");
    });

    it("ignores empty item IDs", () => {
      sys.addStartingEquipment("   ");
      expect(sys.draft.startingEquipment).toHaveLength(0);
    });

    it("ignores duplicate item IDs", () => {
      sys.addStartingEquipment("sword_01");
      sys.addStartingEquipment("sword_01");
      expect(sys.draft.startingEquipment.filter(id => id === "sword_01")).toHaveLength(1);
    });

    it("removes an item ID", () => {
      sys.addStartingEquipment("sword_01");
      sys.removeStartingEquipment("sword_01");
      expect(sys.draft.startingEquipment).not.toContain("sword_01");
    });

    it("clears all starting equipment", () => {
      sys.addStartingEquipment("sword_01");
      sys.addStartingEquipment("shield_01");
      sys.clearStartingEquipment();
      expect(sys.draft.startingEquipment).toHaveLength(0);
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

    it("flags AI aggroRange <= 0", () => {
      sys.setMeta({ id: "x", name: "X" });
      // Force invalid value directly bypassing clamp for test coverage
      (sys.draft as { aiProfile: Record<string, unknown> }).aiProfile["aggroRange"] = 0;
      const report = sys.validate();
      expect(report.issues.some(i => i.includes("aggroRange"))).toBe(true);
    });

    it("flags AI fleesBelowHealthPct out of range", () => {
      sys.setMeta({ id: "x", name: "X" });
      (sys.draft as { aiProfile: Record<string, unknown> }).aiProfile["fleesBelowHealthPct"] = 1.5;
      const report = sys.validate();
      expect(report.issues.some(i => i.includes("fleesBelowHealthPct"))).toBe(true);
    });

    it("passes with valid AI profile fields", () => {
      sys.setMeta({ id: "npc_01", name: "Bob", level: 1, baseHealth: 100 });
      sys.setAIProfileField("aggroRange", 15);
      sys.setAIProfileField("fleesBelowHealthPct", 0.25);
      const report = sys.validate();
      expect(report.valid).toBe(true);
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

    it("round-trips new fields (voiceType, personalityTraits, aiProfile, scheduleId, startingEquipment)", () => {
      sys.setMeta({ id: "npc_warrior", name: "Warrior", level: 5, baseHealth: 150, voiceType: "male_warrior", scheduleId: "sched_guard" });
      sys.addPersonalityTrait("brave");
      sys.addPersonalityTrait("noble");
      sys.setAIProfileField("aggroRange", 18);
      sys.setAIProfileField("fleesBelowHealthPct", 0.1);
      sys.addStartingEquipment("sword_iron");
      sys.addStartingEquipment("shield_iron");

      const json = sys.exportToJson();
      const sys2 = new NpcCreatorSystem();
      expect(sys2.importFromJson(json)).toBe(true);
      expect(sys2.draft.voiceType).toBe("male_warrior");
      expect(sys2.draft.scheduleId).toBe("sched_guard");
      expect(sys2.draft.personalityTraits).toContain("brave");
      expect(sys2.draft.personalityTraits).toContain("noble");
      expect(sys2.draft.aiProfile.aggroRange).toBe(18);
      expect(sys2.draft.aiProfile.fleesBelowHealthPct).toBe(0.1);
      expect(sys2.draft.startingEquipment).toContain("sword_iron");
      expect(sys2.draft.startingEquipment).toContain("shield_iron");
    });

    it("returns false for invalid JSON", () => {
      expect(sys.importFromJson("bad")).toBe(false);
    });

    it("importFromJson defaults voiceType to neutral when absent", () => {
      const minimalJson = JSON.stringify({ id: "x", name: "X", role: "villager", isHostile: false, isMerchant: false, baseHealth: 100, level: 1 });
      const sys2 = new NpcCreatorSystem();
      sys2.importFromJson(minimalJson);
      expect(sys2.draft.voiceType).toBe("neutral");
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

    it("clears new fields (voiceType, personalityTraits, aiProfile, startingEquipment)", () => {
      sys.setMeta({ voiceType: "beast", scheduleId: "sched_01" });
      sys.addPersonalityTrait("cunning");
      sys.setAIProfileField("aggroRange", 25);
      sys.addStartingEquipment("dagger_01");
      sys.reset();
      expect(sys.draft.voiceType).toBe("neutral");
      expect(sys.draft.scheduleId).toBe("");
      expect(sys.draft.personalityTraits).toHaveLength(0);
      expect(Object.keys(sys.draft.aiProfile)).toHaveLength(0);
      expect(sys.draft.startingEquipment).toHaveLength(0);
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

    it("omits voiceType when neutral", () => {
      sys.setMeta({ id: "x", name: "X" });
      const def = sys.toDefinition();
      expect(def.voiceType).toBeUndefined();
    });

    it("includes voiceType when non-neutral", () => {
      sys.setMeta({ id: "x", name: "X", voiceType: "old_woman" });
      const def = sys.toDefinition();
      expect(def.voiceType).toBe("old_woman");
    });

    it("omits personalityTraits when empty", () => {
      sys.setMeta({ id: "x", name: "X" });
      const def = sys.toDefinition();
      expect(def.personalityTraits).toBeUndefined();
    });

    it("includes personalityTraits when set", () => {
      sys.setMeta({ id: "x", name: "X" });
      sys.addPersonalityTrait("friendly");
      const def = sys.toDefinition();
      expect(def.personalityTraits).toContain("friendly");
    });

    it("omits aiProfile when empty", () => {
      sys.setMeta({ id: "x", name: "X" });
      const def = sys.toDefinition();
      expect(def.aiProfile).toBeUndefined();
    });

    it("includes aiProfile when set", () => {
      sys.setMeta({ id: "x", name: "X" });
      sys.setAIProfileField("aggroRange", 20);
      const def = sys.toDefinition();
      expect(def.aiProfile?.aggroRange).toBe(20);
    });

    it("omits scheduleId when empty", () => {
      sys.setMeta({ id: "x", name: "X" });
      const def = sys.toDefinition();
      expect(def.scheduleId).toBeUndefined();
    });

    it("includes scheduleId when set", () => {
      sys.setMeta({ id: "x", name: "X", scheduleId: "sched_village" });
      const def = sys.toDefinition();
      expect(def.scheduleId).toBe("sched_village");
    });

    it("omits startingEquipment when empty", () => {
      sys.setMeta({ id: "x", name: "X" });
      const def = sys.toDefinition();
      expect(def.startingEquipment).toBeUndefined();
    });

    it("includes startingEquipment when set", () => {
      sys.setMeta({ id: "x", name: "X" });
      sys.addStartingEquipment("iron_sword");
      const def = sys.toDefinition();
      expect(def.startingEquipment).toContain("iron_sword");
    });
  });

  // ── Constants exports ─────────────────────────────────────────────────────

  describe("exported constants", () => {
    it("NPC_VOICE_TYPES contains expected values", () => {
      expect(NPC_VOICE_TYPES).toContain("neutral");
      expect(NPC_VOICE_TYPES).toContain("male_warrior");
      expect(NPC_VOICE_TYPES).toContain("undead");
    });

    it("NPC_PERSONALITY_TRAITS contains expected values", () => {
      expect(NPC_PERSONALITY_TRAITS).toContain("brave");
      expect(NPC_PERSONALITY_TRAITS).toContain("cunning");
      expect(NPC_PERSONALITY_TRAITS).toContain("greedy");
    });
  });
});
