import { describe, it, expect, vi, beforeEach } from "vitest";
import { DiseaseSystem, BUILT_IN_DISEASES } from "./disease-system";
import type { DiseaseDefinition } from "./disease-system";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** rng that always returns 0 → never resists (disease always contracted). */
const alwaysContract = () => 0;
/** rng that always returns 1 → always resists (disease never contracted). */
const alwaysResist = () => 1;

const CUSTOM: DiseaseDefinition = {
  id: "test_plague",
  name: "Test Plague",
  description: "A synthetic test disease.",
  attributeEffects: { strength: -3, agility: -2 },
};

// ── Initial state ─────────────────────────────────────────────────────────────

describe("DiseaseSystem — initial state", () => {
  it("starts with no active diseases", () => {
    const sys = new DiseaseSystem();
    expect(sys.getActiveDiseases()).toHaveLength(0);
  });

  it("hasDiseases is false on init", () => {
    const sys = new DiseaseSystem();
    expect(sys.hasDiseases).toBe(false);
  });

  it("activeDiseaseCount is 0 on init", () => {
    const sys = new DiseaseSystem();
    expect(sys.activeDiseaseCount).toBe(0);
  });

  it("diseaseResistanceChance defaults to 0", () => {
    const sys = new DiseaseSystem();
    expect(sys.diseaseResistanceChance).toBe(0);
  });

  it("pre-registers all built-in diseases", () => {
    const sys = new DiseaseSystem();
    for (const def of BUILT_IN_DISEASES) {
      expect(sys.getDefinition(def.id)).toBeDefined();
    }
  });

  it("getAttributePenalties returns empty object when no diseases active", () => {
    const sys = new DiseaseSystem();
    expect(sys.getAttributePenalties()).toEqual({});
  });
});

// ── Disease registration ───────────────────────────────────────────────────────

describe("DiseaseSystem — registerDisease", () => {
  it("can register a custom disease", () => {
    const sys = new DiseaseSystem();
    sys.registerDisease(CUSTOM);
    expect(sys.getDefinition("test_plague")).toEqual(CUSTOM);
  });

  it("registering the same id replaces the previous definition", () => {
    const sys = new DiseaseSystem();
    sys.registerDisease(CUSTOM);
    const updated = { ...CUSTOM, name: "Updated Plague" };
    sys.registerDisease(updated);
    expect(sys.getDefinition("test_plague")?.name).toBe("Updated Plague");
  });

  it("getRegisteredDiseaseIds includes built-in and custom ids", () => {
    const sys = new DiseaseSystem();
    sys.registerDisease(CUSTOM);
    const ids = sys.getRegisteredDiseaseIds();
    expect(ids).toContain("rust_chancre");
    expect(ids).toContain("test_plague");
  });

  it("getDefinition returns undefined for unknown id", () => {
    const sys = new DiseaseSystem();
    expect(sys.getDefinition("nonexistent")).toBeUndefined();
  });
});

// ── contractDisease ────────────────────────────────────────────────────────────

describe("DiseaseSystem — contractDisease", () => {
  let sys: DiseaseSystem;
  beforeEach(() => { sys = new DiseaseSystem(); });

  it("contracts a known disease and returns true", () => {
    expect(sys.contractDisease("rust_chancre", alwaysContract)).toBe(true);
    expect(sys.hasDisease("rust_chancre")).toBe(true);
  });

  it("returns false for an unknown disease id", () => {
    expect(sys.contractDisease("unknown_disease", alwaysContract)).toBe(false);
  });

  it("is a no-op if the disease is already active", () => {
    sys.contractDisease("rust_chancre", alwaysContract);
    const result = sys.contractDisease("rust_chancre", alwaysContract);
    expect(result).toBe(false);
    expect(sys.activeDiseaseCount).toBe(1);
  });

  it("fires onDiseaseContracted callback", () => {
    const cb = vi.fn();
    sys.onDiseaseContracted = cb;
    sys.contractDisease("rust_chancre", alwaysContract);
    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith("rust_chancre");
  });

  it("does not fire onDiseaseContracted if already infected", () => {
    const cb = vi.fn();
    sys.onDiseaseContracted = cb;
    sys.contractDisease("rust_chancre", alwaysContract);
    sys.contractDisease("rust_chancre", alwaysContract); // duplicate
    expect(cb).toHaveBeenCalledOnce();
  });

  it("respects resistance — resists when rng < resistance", () => {
    sys.diseaseResistanceChance = 1.0; // full immunity
    expect(sys.contractDisease("rust_chancre", alwaysContract)).toBe(false);
    expect(sys.hasDisease("rust_chancre")).toBe(false);
  });

  it("contracts when rng roll exceeds resistance", () => {
    sys.diseaseResistanceChance = 0.5;
    // rng returns 0.9 > 0.5 → NOT resisted (probability model: resist if rng < resistance)
    expect(sys.contractDisease("rust_chancre", () => 0.9)).toBe(true);
  });

  it("resists when rng roll is below resistance", () => {
    sys.diseaseResistanceChance = 0.5;
    expect(sys.contractDisease("rust_chancre", () => 0.3)).toBe(false);
  });

  it("clamps resistance above 1.0 to full immunity", () => {
    sys.diseaseResistanceChance = 2.0;
    expect(sys.contractDisease("rust_chancre", alwaysContract)).toBe(false);
  });

  it("clamps resistance below 0 to no resistance", () => {
    sys.diseaseResistanceChance = -1.0;
    expect(sys.contractDisease("rust_chancre", alwaysContract)).toBe(true);
  });

  it("multiple diseases can be active simultaneously", () => {
    sys.contractDisease("rust_chancre", alwaysContract);
    sys.contractDisease("swamp_rot", alwaysContract);
    expect(sys.activeDiseaseCount).toBe(2);
    expect(sys.hasDisease("rust_chancre")).toBe(true);
    expect(sys.hasDisease("swamp_rot")).toBe(true);
  });

  it("does not fire onDiseaseContracted when resisted", () => {
    const cb = vi.fn();
    sys.onDiseaseContracted = cb;
    sys.diseaseResistanceChance = 1.0;
    sys.contractDisease("rust_chancre", alwaysContract);
    expect(cb).not.toHaveBeenCalled();
  });
});

// ── cureDisease ────────────────────────────────────────────────────────────────

describe("DiseaseSystem — cureDisease", () => {
  let sys: DiseaseSystem;
  beforeEach(() => {
    sys = new DiseaseSystem();
    sys.contractDisease("rust_chancre", alwaysContract);
  });

  it("cures an active disease and returns true", () => {
    expect(sys.cureDisease("rust_chancre")).toBe(true);
    expect(sys.hasDisease("rust_chancre")).toBe(false);
  });

  it("returns false when disease is not active", () => {
    expect(sys.cureDisease("swamp_rot")).toBe(false);
  });

  it("fires onDiseaseCured callback", () => {
    const cb = vi.fn();
    sys.onDiseaseCured = cb;
    sys.cureDisease("rust_chancre");
    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith("rust_chancre");
  });

  it("does not fire onDiseaseCured if disease was not active", () => {
    const cb = vi.fn();
    sys.onDiseaseCured = cb;
    sys.cureDisease("swamp_rot");
    expect(cb).not.toHaveBeenCalled();
  });

  it("curing one disease does not affect others", () => {
    sys.contractDisease("swamp_rot", alwaysContract);
    sys.cureDisease("rust_chancre");
    expect(sys.hasDisease("rust_chancre")).toBe(false);
    expect(sys.hasDisease("swamp_rot")).toBe(true);
  });
});

// ── cureAllDiseases ────────────────────────────────────────────────────────────

describe("DiseaseSystem — cureAllDiseases", () => {
  let sys: DiseaseSystem;
  beforeEach(() => {
    sys = new DiseaseSystem();
    sys.contractDisease("rust_chancre", alwaysContract);
    sys.contractDisease("swamp_rot", alwaysContract);
    sys.contractDisease("witbane", alwaysContract);
  });

  it("removes all active diseases", () => {
    sys.cureAllDiseases();
    expect(sys.hasDiseases).toBe(false);
    expect(sys.activeDiseaseCount).toBe(0);
  });

  it("fires onDiseaseCured once per disease", () => {
    const cb = vi.fn();
    sys.onDiseaseCured = cb;
    sys.cureAllDiseases();
    expect(cb).toHaveBeenCalledTimes(3);
  });

  it("is a no-op when no diseases are active", () => {
    const sys2 = new DiseaseSystem();
    const cb = vi.fn();
    sys2.onDiseaseCured = cb;
    sys2.cureAllDiseases(); // nothing to cure
    expect(cb).not.toHaveBeenCalled();
  });
});

// ── hasDisease / getActiveDiseases ────────────────────────────────────────────

describe("DiseaseSystem — hasDisease / getActiveDiseases", () => {
  it("hasDisease returns false for non-active disease", () => {
    const sys = new DiseaseSystem();
    expect(sys.hasDisease("rust_chancre")).toBe(false);
  });

  it("getActiveDiseases returns only active disease ids", () => {
    const sys = new DiseaseSystem();
    sys.contractDisease("rust_chancre", alwaysContract);
    sys.contractDisease("swamp_rot", alwaysContract);
    const active = sys.getActiveDiseases();
    expect(active).toContain("rust_chancre");
    expect(active).toContain("swamp_rot");
    expect(active).toHaveLength(2);
  });

  it("getActiveDiseases returns a copy (mutation does not affect internal state)", () => {
    const sys = new DiseaseSystem();
    sys.contractDisease("rust_chancre", alwaysContract);
    const list = sys.getActiveDiseases();
    list.push("swamp_rot");
    expect(sys.activeDiseaseCount).toBe(1);
  });
});

// ── getAttributePenalties ─────────────────────────────────────────────────────

describe("DiseaseSystem — getAttributePenalties", () => {
  it("returns correct penalty for a single disease", () => {
    const sys = new DiseaseSystem();
    sys.contractDisease("rust_chancre", alwaysContract); // endurance: -5
    expect(sys.getAttributePenalties()).toEqual({ endurance: -5 });
  });

  it("stacks penalties from multiple diseases on the same attribute", () => {
    const sys = new DiseaseSystem();
    sys.contractDisease("rust_chancre", alwaysContract); // endurance: -5
    sys.contractDisease("porphyric_hemophilia", alwaysContract); // willpower: -2, endurance: -2
    const p = sys.getAttributePenalties();
    expect(p.endurance).toBe(-7);
    expect(p.willpower).toBe(-2);
  });

  it("merges penalties from diseases affecting different attributes", () => {
    const sys = new DiseaseSystem();
    sys.contractDisease("rust_chancre", alwaysContract); // endurance: -5
    sys.contractDisease("swamp_rot", alwaysContract);    // willpower: -5
    expect(sys.getAttributePenalties()).toEqual({ endurance: -5, willpower: -5 });
  });

  it("penalties disappear after curing the disease", () => {
    const sys = new DiseaseSystem();
    sys.contractDisease("rust_chancre", alwaysContract);
    sys.cureDisease("rust_chancre");
    expect(sys.getAttributePenalties()).toEqual({});
  });

  it("custom disease penalties are included", () => {
    const sys = new DiseaseSystem();
    sys.registerDisease(CUSTOM);
    sys.contractDisease("test_plague", alwaysContract); // strength: -3, agility: -2
    const p = sys.getAttributePenalties();
    expect(p.strength).toBe(-3);
    expect(p.agility).toBe(-2);
  });
});

// ── Built-in disease roster ───────────────────────────────────────────────────

describe("DiseaseSystem — built-in disease roster", () => {
  it("rust_chancre applies endurance penalty", () => {
    const sys = new DiseaseSystem();
    sys.contractDisease("rust_chancre", alwaysContract);
    expect(sys.getAttributePenalties().endurance).toBeLessThan(0);
  });

  it("brain_rot applies larger intelligence penalty than witbane", () => {
    const sys1 = new DiseaseSystem();
    sys1.contractDisease("witbane", alwaysContract);
    const sys2 = new DiseaseSystem();
    sys2.contractDisease("brain_rot", alwaysContract);
    expect(sys2.getAttributePenalties().intelligence!).toBeLessThan(
      sys1.getAttributePenalties().intelligence!,
    );
  });

  it("porphyric_hemophilia affects two attributes", () => {
    const sys = new DiseaseSystem();
    sys.contractDisease("porphyric_hemophilia", alwaysContract);
    const p = sys.getAttributePenalties();
    const keys = Object.keys(p);
    expect(keys.length).toBeGreaterThanOrEqual(2);
  });
});

// ── Persistence ───────────────────────────────────────────────────────────────

describe("DiseaseSystem — persistence", () => {
  it("getSaveState captures active disease ids", () => {
    const sys = new DiseaseSystem();
    sys.contractDisease("rust_chancre", alwaysContract);
    sys.contractDisease("swamp_rot", alwaysContract);
    const state = sys.getSaveState();
    expect(state.activeDiseases).toContain("rust_chancre");
    expect(state.activeDiseases).toContain("swamp_rot");
    expect(state.activeDiseases).toHaveLength(2);
  });

  it("getSaveState returns empty array when no diseases active", () => {
    const sys = new DiseaseSystem();
    expect(sys.getSaveState().activeDiseases).toHaveLength(0);
  });

  it("restoreFromSave rehydrates active diseases", () => {
    const sys = new DiseaseSystem();
    sys.restoreFromSave({ activeDiseases: ["rust_chancre", "witbane"] });
    expect(sys.hasDisease("rust_chancre")).toBe(true);
    expect(sys.hasDisease("witbane")).toBe(true);
    expect(sys.activeDiseaseCount).toBe(2);
  });

  it("restoreFromSave ignores unknown disease ids", () => {
    const sys = new DiseaseSystem();
    sys.restoreFromSave({ activeDiseases: ["unknown_disease", "rust_chancre"] });
    expect(sys.hasDisease("rust_chancre")).toBe(true);
    expect(sys.activeDiseaseCount).toBe(1);
  });

  it("restoreFromSave clears previously active diseases", () => {
    const sys = new DiseaseSystem();
    sys.contractDisease("swamp_rot", alwaysContract);
    sys.restoreFromSave({ activeDiseases: ["rust_chancre"] });
    expect(sys.hasDisease("swamp_rot")).toBe(false);
    expect(sys.hasDisease("rust_chancre")).toBe(true);
  });

  it("round-trip: save then restore preserves active diseases", () => {
    const original = new DiseaseSystem();
    original.contractDisease("rust_chancre", alwaysContract);
    original.contractDisease("yellow_tick", alwaysContract);
    const state = original.getSaveState();

    const restored = new DiseaseSystem();
    restored.restoreFromSave(state);
    expect(restored.getActiveDiseases().sort()).toEqual(
      original.getActiveDiseases().sort(),
    );
  });

  it("restoreFromSave with empty activeDiseases clears all", () => {
    const sys = new DiseaseSystem();
    sys.contractDisease("rust_chancre", alwaysContract);
    sys.restoreFromSave({ activeDiseases: [] });
    expect(sys.hasDiseases).toBe(false);
  });
});
