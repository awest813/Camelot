import { describe, it, expect, beforeEach, vi } from "vitest";
import { PerkSystem, PERK_DEFINITIONS } from "./perk-system";

// ── Minimal stubs ─────────────────────────────────────────────────────────────

function makePlayer() {
  return {
    bonusDamage: 0,
    bonusArmor: 0,
    bonusMagicDamage: 0,
    critChance: 0,
    healthRegen: 0.5,
    magickaRegen: 2,
    staminaRegen: 5,
    maxHealth: 100,
    maxMagicka: 100,
    maxStamina: 100,
    maxCarryWeight: 300,
    perkPowerAttackStaminaMultiplier: 1.0,
    perkSneakAttackMultiplier: 1.0,
    perkHealingMultiplier: 1.0,
  } as any;
}

function makeSkillSystem(levels: Partial<Record<string, number>> = {}) {
  return {
    getSkill: (skillId: string) => ({
      level: levels[skillId] ?? 0,
    }),
  } as any;
}

// ── PerkSystem construction ───────────────────────────────────────────────────

describe("PerkSystem — construction", () => {
  it("starts with 0 perk points", () => {
    const sys = new PerkSystem(makePlayer(), makeSkillSystem());
    expect(sys.perkPoints).toBe(0);
  });

  it("addPerkPoints increases the count", () => {
    const sys = new PerkSystem(makePlayer(), makeSkillSystem());
    sys.addPerkPoints(3);
    expect(sys.perkPoints).toBe(3);
  });

  it("addPerkPoints ignores non-positive amounts", () => {
    const sys = new PerkSystem(makePlayer(), makeSkillSystem());
    sys.addPerkPoints(0);
    sys.addPerkPoints(-5);
    expect(sys.perkPoints).toBe(0);
  });

  it("PERK_DEFINITIONS contains 36 entries (9 skills × 4 tiers)", () => {
    expect(PERK_DEFINITIONS.length).toBe(36);
  });

  it("each skill has exactly 4 perks", () => {
    const skills = ["blade","blunt","block","destruction","restoration","marksman","sneak","speechcraft","alchemy"];
    for (const skill of skills) {
      const count = PERK_DEFINITIONS.filter(p => p.skillId === skill).length;
      expect(count).toBe(4);
    }
  });
});

// ── canUnlock checks ──────────────────────────────────────────────────────────

describe("PerkSystem — canUnlock", () => {
  it("returns false for unknown perk id", () => {
    const sys = new PerkSystem(makePlayer(), makeSkillSystem());
    sys.addPerkPoints(5);
    expect(sys.canUnlock("nonexistent").allowed).toBe(false);
  });

  it("returns false when no perk points available", () => {
    const sys = new PerkSystem(makePlayer(), makeSkillSystem({ blade: 30 }));
    expect(sys.canUnlock("blade_finesse").allowed).toBe(false);
    expect(sys.canUnlock("blade_finesse").reason).toMatch(/perk points/i);
  });

  it("returns false when skill level is below requirement", () => {
    const sys = new PerkSystem(makePlayer(), makeSkillSystem({ blade: 10 }));
    sys.addPerkPoints(1);
    const result = sys.canUnlock("blade_finesse");
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/requires blade level 25/i);
  });

  it("returns true when all conditions are met", () => {
    const sys = new PerkSystem(makePlayer(), makeSkillSystem({ blade: 25 }));
    sys.addPerkPoints(1);
    expect(sys.canUnlock("blade_finesse").allowed).toBe(true);
  });

  it("returns false for already-unlocked perk", () => {
    const sys = new PerkSystem(makePlayer(), makeSkillSystem({ blade: 25 }));
    sys.addPerkPoints(2);
    sys.unlock("blade_finesse");
    expect(sys.canUnlock("blade_finesse").allowed).toBe(false);
    expect(sys.canUnlock("blade_finesse").reason).toMatch(/already unlocked/i);
  });

  it("returns false when prerequisite perk is not unlocked", () => {
    const sys = new PerkSystem(makePlayer(), makeSkillSystem({ blade: 75 }));
    sys.addPerkPoints(3);
    // blade_adept requires blade_finesse
    expect(sys.canUnlock("blade_adept").allowed).toBe(false);
    expect(sys.canUnlock("blade_adept").reason).toMatch(/Blade Finesse/i);
  });

  it("returns true for prerequisite-gated perk after prerequisites met", () => {
    const sys = new PerkSystem(makePlayer(), makeSkillSystem({ blade: 50 }));
    sys.addPerkPoints(3);
    sys.unlock("blade_finesse");
    expect(sys.canUnlock("blade_adept").allowed).toBe(true);
  });
});

// ── unlock ────────────────────────────────────────────────────────────────────

describe("PerkSystem — unlock", () => {
  it("returns false and does not apply when conditions are not met", () => {
    const player = makePlayer();
    const sys = new PerkSystem(player, makeSkillSystem({ blade: 0 }));
    sys.addPerkPoints(1);
    const ok = sys.unlock("blade_finesse");
    expect(ok).toBe(false);
    expect(player.critChance).toBe(0);
    expect(sys.perkPoints).toBe(1); // points not consumed
  });

  it("applies perk effect on successful unlock", () => {
    const player = makePlayer();
    const sys = new PerkSystem(player, makeSkillSystem({ blade: 25 }));
    sys.addPerkPoints(1);
    const ok = sys.unlock("blade_finesse");
    expect(ok).toBe(true);
    expect(player.critChance).toBeCloseTo(0.05);
    expect(sys.perkPoints).toBe(0);
  });

  it("fires onPerkUnlocked callback", () => {
    const player = makePlayer();
    const sys = new PerkSystem(player, makeSkillSystem({ blade: 25 }));
    sys.addPerkPoints(1);
    const cb = vi.fn();
    sys.onPerkUnlocked = cb;
    sys.unlock("blade_finesse");
    expect(cb).toHaveBeenCalledWith("blade_finesse", "Blade Finesse");
  });

  it("hasPerk returns true after unlock", () => {
    const sys = new PerkSystem(makePlayer(), makeSkillSystem({ blade: 25 }));
    sys.addPerkPoints(1);
    sys.unlock("blade_finesse");
    expect(sys.hasPerk("blade_finesse")).toBe(true);
    expect(sys.hasPerk("blade_adept")).toBe(false);
  });

  it("power attack stamina multiplier is reduced by blade_power_strikes", () => {
    const player = makePlayer();
    const sys = new PerkSystem(player, makeSkillSystem({ blade: 75 }));
    sys.addPerkPoints(3);
    sys.unlock("blade_finesse");
    sys.unlock("blade_adept");
    sys.unlock("blade_power_strikes");
    expect(player.perkPowerAttackStaminaMultiplier).toBeCloseTo(0.8);
  });

  it("sneak attack multiplier is increased by sneak_silent_death", () => {
    const player = makePlayer();
    const sys = new PerkSystem(player, makeSkillSystem({ sneak: 100 }));
    sys.addPerkPoints(4);
    sys.unlock("sneak_shadow_step");
    sys.unlock("sneak_blur");
    sys.unlock("sneak_phantom");
    sys.unlock("sneak_silent_death");
    expect(player.perkSneakAttackMultiplier).toBeCloseTo(2.0);
  });

  it("healing multiplier is increased by restoration_healer", () => {
    const player = makePlayer();
    const sys = new PerkSystem(player, makeSkillSystem({ restoration: 25 }));
    sys.addPerkPoints(1);
    sys.unlock("restoration_healer");
    expect(player.perkHealingMultiplier).toBeCloseTo(1.2);
  });

  it("stacking restoration and alchemy healing perks compounds correctly", () => {
    const player = makePlayer();
    const sys = new PerkSystem(player, makeSkillSystem({ restoration: 50, alchemy: 50 }));
    sys.addPerkPoints(5);
    // Restoration tree up to empowered (+0.20 + 0.20 = 0.40 total)
    sys.unlock("restoration_healer");
    sys.unlock("restoration_empowered");
    // Alchemy potency (+0.15)
    sys.unlock("alchemy_experimenter");
    sys.unlock("alchemy_potency");
    // Total: 1.0 + 0.40 + 0.15 = 1.55
    expect(player.perkHealingMultiplier).toBeCloseTo(1.55);
  });
});

// ── getPerksForSkill ──────────────────────────────────────────────────────────

describe("PerkSystem — getPerksForSkill", () => {
  it("returns 4 perks for the blade tree", () => {
    const sys = new PerkSystem(makePlayer(), makeSkillSystem());
    expect(sys.getPerksForSkill("blade").length).toBe(4);
  });

  it("annotates unlocked status correctly", () => {
    const sys = new PerkSystem(makePlayer(), makeSkillSystem({ blade: 25 }));
    sys.addPerkPoints(1);
    sys.unlock("blade_finesse");
    const entries = sys.getPerksForSkill("blade");
    const finesse = entries.find(e => e.id === "blade_finesse")!;
    expect(finesse.isUnlocked).toBe(true);
    expect(entries.filter(e => !e.isUnlocked).length).toBe(3);
  });
});

// ── Save / restore ────────────────────────────────────────────────────────────

describe("PerkSystem — save and restore", () => {
  it("getSaveState captures unlocked ids and points", () => {
    const sys = new PerkSystem(makePlayer(), makeSkillSystem({ blade: 50 }));
    sys.addPerkPoints(3);
    sys.unlock("blade_finesse");
    sys.unlock("blade_adept");
    const state = sys.getSaveState();
    expect(state.perkPoints).toBe(1);
    expect(state.unlockedPerkIds).toContain("blade_finesse");
    expect(state.unlockedPerkIds).toContain("blade_adept");
  });

  it("restoreFromSave re-applies perk effects", () => {
    const player = makePlayer();
    const sys = new PerkSystem(player, makeSkillSystem({ blade: 50 }));
    const state = {
      perkPoints: 2,
      unlockedPerkIds: ["blade_finesse", "blade_adept"],
    };
    // Simulate the save-system resetting perk fields before restore
    player.critChance = 0;
    player.bonusDamage = 0;
    sys.restoreFromSave(state);
    expect(player.critChance).toBeCloseTo(0.05);
    expect(player.bonusDamage).toBe(5);
    expect(sys.perkPoints).toBe(2);
    expect(sys.hasPerk("blade_finesse")).toBe(true);
    expect(sys.hasPerk("blade_adept")).toBe(true);
  });

  it("restoreFromSave is idempotent — calling twice does not double effects", () => {
    const player = makePlayer();
    const sys = new PerkSystem(player, makeSkillSystem({ blade: 25 }));
    const state = { perkPoints: 0, unlockedPerkIds: ["blade_finesse"] };

    player.critChance = 0;
    sys.restoreFromSave(state);
    expect(player.critChance).toBeCloseTo(0.05);

    // Reset as save-system would before a second load
    player.critChance = 0;
    sys.restoreFromSave(state);
    expect(player.critChance).toBeCloseTo(0.05); // not doubled
  });

  it("restoreFromSave with empty state clears unlocked perks", () => {
    const player = makePlayer();
    const sys = new PerkSystem(player, makeSkillSystem({ blade: 25 }));
    sys.addPerkPoints(1);
    sys.unlock("blade_finesse");
    expect(sys.hasPerk("blade_finesse")).toBe(true);

    player.critChance = 0;
    sys.restoreFromSave({ perkPoints: 0, unlockedPerkIds: [] });
    expect(sys.hasPerk("blade_finesse")).toBe(false);
    expect(player.critChance).toBe(0);
  });

  it("restoreFromSave handles invalid data gracefully", () => {
    const player = makePlayer();
    const sys = new PerkSystem(player, makeSkillSystem());
    expect(() => sys.restoreFromSave({} as any)).not.toThrow();
    expect(sys.perkPoints).toBe(0);
  });
});
