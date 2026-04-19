import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  StandingStoneSystem,
  STANDING_STONES,
  GUARDIAN_STONE_XP_BONUS,
  LOVER_STONE_XP_BONUS,
  SKILL_FAMILY,
  type StandingStoneDefinition,
} from "./standing-stone-system";

describe("StandingStoneSystem", () => {
  let system: StandingStoneSystem;

  beforeEach(() => {
    system = new StandingStoneSystem();
  });

  // ── Initial state ──────────────────────────────────────────────────────────

  it("starts with no active stone", () => {
    expect(system.activeStone).toBeNull();
    expect(system.activeId).toBeNull();
  });

  it("starts with no discovered stones", () => {
    expect(system.discoveredIds.length).toBe(0);
  });

  it("starts with zero stat bonuses", () => {
    const b = system.getStatBonuses();
    expect(b.maxHealth).toBe(0);
    expect(b.maxMagicka).toBe(0);
    expect(b.maxStamina).toBe(0);
    expect(b.carryWeight).toBe(0);
  });

  it("starts with no passive flags", () => {
    expect(system.stunted).toBe(false);
    expect(system.spellAbsorption).toBe(0);
    expect(system.armorWeightMult).toBe(1.0);
    expect(system.magicResist).toBe(0);
    expect(system.diseaseResist).toBe(0);
    expect(system.poisonResist).toBe(0);
  });

  it("returns 1.0 regen multiplier with no active stone", () => {
    expect(system.getRegenMultiplier("health")).toBe(1.0);
    expect(system.getRegenMultiplier("magicka")).toBe(1.0);
    expect(system.getRegenMultiplier("stamina")).toBe(1.0);
  });

  it("returns 1.0 XP multiplier with no active stone", () => {
    expect(system.getSkillXpMultiplier("blade")).toBe(1.0);
    expect(system.getSkillXpMultiplier("destruction")).toBe(1.0);
  });

  // ── Catalogue ──────────────────────────────────────────────────────────────

  it("exposes 13 standing stone definitions", () => {
    expect(system.all.length).toBe(13);
  });

  it("ids match the STANDING_STONES export", () => {
    const registered = system.all.map((s) => s.id);
    const exported   = STANDING_STONES.map((s) => s.id);
    expect(registered).toEqual(exported);
  });

  it("getDefinition returns the correct stone", () => {
    const warrior = system.getDefinition("warrior_stone");
    expect(warrior).toBeDefined();
    expect(warrior!.name).toBe("The Warrior Stone");
    expect(warrior!.skillFamily).toBe("combat");
  });

  it("getDefinition returns undefined for unknown ids", () => {
    expect(system.getDefinition("nonexistent")).toBeUndefined();
  });

  it("accepts extra stones via constructor", () => {
    const custom: StandingStoneDefinition = {
      id: "custom_stone",
      name: "The Custom Stone",
      guardian: "other",
      description: "test",
      maxHealthBonus: 42,
    };
    const extended = new StandingStoneSystem([custom]);
    expect(extended.getDefinition("custom_stone")).toBeDefined();
    expect(extended.all.length).toBe(14);
  });

  // ── Discovery ──────────────────────────────────────────────────────────────

  it("discoverStone marks a stone as discovered and fires callback", () => {
    const cb = vi.fn();
    system.onStoneDiscovered = cb;
    expect(system.discoverStone("warrior_stone")).toBe(true);
    expect(system.isDiscovered("warrior_stone")).toBe(true);
    expect(cb).toHaveBeenCalledOnce();
    expect(cb.mock.calls[0][0].id).toBe("warrior_stone");
  });

  it("discoverStone is idempotent and does not re-fire on second call", () => {
    const cb = vi.fn();
    system.onStoneDiscovered = cb;
    expect(system.discoverStone("lady_stone")).toBe(true);
    expect(system.discoverStone("lady_stone")).toBe(false);
    expect(cb).toHaveBeenCalledOnce();
  });

  it("discoverStone returns false for unknown ids", () => {
    expect(system.discoverStone("fake_stone")).toBe(false);
    expect(system.discoveredIds.length).toBe(0);
  });

  // ── Activation ─────────────────────────────────────────────────────────────

  it("activateStone sets the active stone and fires callback", () => {
    const cb = vi.fn();
    system.onStoneActivated = cb;
    expect(system.activateStone("mage_stone")).toBe(true);
    expect(system.activeId).toBe("mage_stone");
    expect(system.activeStone!.name).toBe("The Mage Stone");
    expect(cb).toHaveBeenCalledOnce();
    expect(cb.mock.calls[0][0].id).toBe("mage_stone");
    expect(cb.mock.calls[0][1]).toBeNull(); // previous is null
  });

  it("activateStone returns false for unknown ids", () => {
    expect(system.activateStone("bogus")).toBe(false);
    expect(system.activeId).toBeNull();
  });

  it("activateStone returns false when re-activating the same stone", () => {
    system.activateStone("thief_stone");
    const cb = vi.fn();
    system.onStoneActivated = cb;
    expect(system.activateStone("thief_stone")).toBe(false);
    expect(cb).not.toHaveBeenCalled();
  });

  it("switching stones passes the previous stone to the callback", () => {
    system.activateStone("mage_stone");
    const cb = vi.fn();
    system.onStoneActivated = cb;
    system.activateStone("warrior_stone");
    expect(cb).toHaveBeenCalledOnce();
    expect(cb.mock.calls[0][0].id).toBe("warrior_stone");
    expect(cb.mock.calls[0][1]!.id).toBe("mage_stone");
  });

  it("activateStone auto-discovers an undiscovered stone", () => {
    const cbD = vi.fn();
    system.onStoneDiscovered = cbD;
    system.activateStone("steed_stone");
    expect(system.isDiscovered("steed_stone")).toBe(true);
    expect(cbD).toHaveBeenCalledOnce();
  });

  it("activateStone does not re-fire discovery for already-known stones", () => {
    system.discoverStone("steed_stone");
    const cbD = vi.fn();
    system.onStoneDiscovered = cbD;
    system.activateStone("steed_stone");
    expect(cbD).not.toHaveBeenCalled();
  });

  it("clearActive resets active stone and power cooldown", () => {
    system.activateStone("lord_stone");
    system.activateSpecialPower(0); // lord stone has no power anyway
    system.clearActive();
    expect(system.activeStone).toBeNull();
    expect(system.activeId).toBeNull();
  });

  // ── XP multipliers ─────────────────────────────────────────────────────────

  it("Warrior Stone grants +20% XP to combat skills only", () => {
    system.activateStone("warrior_stone");
    expect(system.getSkillXpMultiplier("blade")).toBeCloseTo(1 + GUARDIAN_STONE_XP_BONUS);
    expect(system.getSkillXpMultiplier("blunt")).toBeCloseTo(1 + GUARDIAN_STONE_XP_BONUS);
    expect(system.getSkillXpMultiplier("block")).toBeCloseTo(1 + GUARDIAN_STONE_XP_BONUS);
    expect(system.getSkillXpMultiplier("marksman")).toBeCloseTo(1 + GUARDIAN_STONE_XP_BONUS);
    // Not combat — no bonus
    expect(system.getSkillXpMultiplier("destruction")).toBe(1.0);
    expect(system.getSkillXpMultiplier("sneak")).toBe(1.0);
  });

  it("Mage Stone grants +20% XP to magic skills only", () => {
    system.activateStone("mage_stone");
    expect(system.getSkillXpMultiplier("destruction")).toBeCloseTo(1 + GUARDIAN_STONE_XP_BONUS);
    expect(system.getSkillXpMultiplier("restoration")).toBeCloseTo(1 + GUARDIAN_STONE_XP_BONUS);
    expect(system.getSkillXpMultiplier("blade")).toBe(1.0);
  });

  it("Thief Stone grants +20% XP to stealth skills only", () => {
    system.activateStone("thief_stone");
    expect(system.getSkillXpMultiplier("sneak")).toBeCloseTo(1 + GUARDIAN_STONE_XP_BONUS);
    expect(system.getSkillXpMultiplier("speechcraft")).toBeCloseTo(1 + GUARDIAN_STONE_XP_BONUS);
    expect(system.getSkillXpMultiplier("alchemy")).toBeCloseTo(1 + GUARDIAN_STONE_XP_BONUS);
    expect(system.getSkillXpMultiplier("blade")).toBe(1.0);
  });

  it("Lover Stone grants +15% XP to all skills", () => {
    system.activateStone("lover_stone");
    const expected = 1 + LOVER_STONE_XP_BONUS;
    for (const skill of ["blade", "destruction", "sneak", "alchemy"] as const) {
      expect(system.getSkillXpMultiplier(skill)).toBeCloseTo(expected);
    }
  });

  it("SKILL_FAMILY classifies every progression skill", () => {
    const allSkills = [
      "blade", "blunt", "block", "marksman",
      "destruction", "restoration",
      "sneak", "speechcraft", "alchemy",
    ] as const;
    for (const s of allSkills) {
      expect(SKILL_FAMILY[s]).toBeDefined();
    }
  });

  // ── Stat bonuses ───────────────────────────────────────────────────────────

  it("Atronach Stone grants +50 max Magicka and stunted regen", () => {
    system.activateStone("atronach_stone");
    expect(system.getStatBonuses().maxMagicka).toBe(50);
    expect(system.stunted).toBe(true);
    expect(system.spellAbsorption).toBe(0.5);
  });

  it("Lord Stone grants +25 max Health and +25% magic resist", () => {
    system.activateStone("lord_stone");
    expect(system.getStatBonuses().maxHealth).toBe(25);
    expect(system.magicResist).toBeCloseTo(0.25);
  });

  it("Steed Stone grants +100 carry weight and zeros armor weight", () => {
    system.activateStone("steed_stone");
    expect(system.getStatBonuses().carryWeight).toBe(100);
    expect(system.armorWeightMult).toBe(0);
  });

  it("Apprentice Stone doubles magicka regen but weakens to magic", () => {
    system.activateStone("apprentice_stone");
    expect(system.getRegenMultiplier("magicka")).toBe(2.0);
    expect(system.magicResist).toBeCloseTo(-1.0);
  });

  it("Lady Stone boosts health and stamina regen", () => {
    system.activateStone("lady_stone");
    expect(system.getRegenMultiplier("health")).toBeCloseTo(1.25);
    expect(system.getRegenMultiplier("stamina")).toBeCloseTo(1.25);
    expect(system.getRegenMultiplier("magicka")).toBe(1.0);
  });

  // ── Once-per-day power ─────────────────────────────────────────────────────

  it("getSpecialPower returns the power for stones that have one", () => {
    system.activateStone("shadow_stone");
    const power = system.getSpecialPower();
    expect(power).not.toBeNull();
    expect(power!.id).toBe("shadowcloak");
  });

  it("getSpecialPower returns null for stones with no power", () => {
    system.activateStone("warrior_stone");
    expect(system.getSpecialPower()).toBeNull();
  });

  it("canActivatePower is true when ready and false while on cooldown", () => {
    system.activateStone("tower_stone");
    expect(system.canActivatePower(0)).toBe(true);
    expect(system.activateSpecialPower(0)).toBe(true);
    expect(system.canActivatePower(0)).toBe(false);
    expect(system.canActivatePower(60 * 12)).toBe(false); // 12 in-game hours
    expect(system.canActivatePower(60 * 24)).toBe(true);  // 24 hours elapsed
  });

  it("activateSpecialPower fires onPowerActivated", () => {
    const cb = vi.fn();
    system.onPowerActivated = cb;
    system.activateStone("ritual_stone");
    system.activateSpecialPower(0);
    expect(cb).toHaveBeenCalledOnce();
    expect(cb.mock.calls[0][0].id).toBe("ritual_reanimate");
    expect(cb.mock.calls[0][1].id).toBe("ritual_stone");
  });

  it("activateSpecialPower returns false when no stone is active", () => {
    expect(system.activateSpecialPower(0)).toBe(false);
  });

  it("activateSpecialPower returns false for stones without a power", () => {
    system.activateStone("warrior_stone");
    expect(system.activateSpecialPower(0)).toBe(false);
  });

  it("activateSpecialPower returns false while on cooldown", () => {
    system.activateStone("shadow_stone");
    expect(system.activateSpecialPower(100)).toBe(true);
    expect(system.activateSpecialPower(200)).toBe(false);
  });

  it("powerCooldownRemaining counts down correctly", () => {
    system.activateStone("shadow_stone");
    system.activateSpecialPower(0);
    expect(system.powerCooldownRemaining(0)).toBe(24 * 60);
    expect(system.powerCooldownRemaining(60)).toBe(23 * 60);
    expect(system.powerCooldownRemaining(24 * 60)).toBe(0);
    expect(system.powerCooldownRemaining(25 * 60)).toBe(0);
  });

  it("swapping stones clears any outstanding power cooldown", () => {
    system.activateStone("shadow_stone");
    system.activateSpecialPower(0);
    expect(system.canActivatePower(60)).toBe(false);
    system.activateStone("tower_stone");
    // Cooldown belongs to the previous stone; the new stone is ready.
    expect(system.canActivatePower(60)).toBe(true);
  });

  // ── Persistence ────────────────────────────────────────────────────────────

  it("getSaveState captures active id, discovered set, and cooldown", () => {
    system.discoverStone("mage_stone");
    system.discoverStone("thief_stone");
    system.activateStone("mage_stone");
    system.activateStone("shadow_stone");
    system.activateSpecialPower(500);

    const state = system.getSaveState();
    expect(state.activeId).toBe("shadow_stone");
    expect(state.discovered).toEqual(
      expect.arrayContaining(["mage_stone", "thief_stone", "shadow_stone"]),
    );
    expect(state.lastPowerUseTime).toBe(500);
  });

  it("restoreFromSave restores active id, discovery, and cooldown", () => {
    const restored = new StandingStoneSystem();
    restored.restoreFromSave({
      activeId: "atronach_stone",
      discovered: ["atronach_stone", "lover_stone"],
      lastPowerUseTime: 123,
    });
    expect(restored.activeId).toBe("atronach_stone");
    expect(restored.isDiscovered("atronach_stone")).toBe(true);
    expect(restored.isDiscovered("lover_stone")).toBe(true);
    expect(restored.isDiscovered("warrior_stone")).toBe(false);
    expect(restored.stunted).toBe(true);
  });

  it("restoreFromSave ignores unknown stone ids", () => {
    const restored = new StandingStoneSystem();
    restored.restoreFromSave({
      activeId: "not_a_stone",
      discovered: ["warrior_stone", "also_not_a_stone"],
      lastPowerUseTime: null,
    });
    expect(restored.activeId).toBeNull();
    expect(restored.discoveredIds).toEqual(["warrior_stone"]);
  });

  it("restoreFromSave is safe against malformed input", () => {
    const restored = new StandingStoneSystem();
    restored.restoreFromSave({
      // @ts-expect-error — deliberately malformed
      activeId: 42,
      // @ts-expect-error — deliberately malformed
      discovered: "not an array",
      // @ts-expect-error — deliberately malformed
      lastPowerUseTime: "soon",
    });
    expect(restored.activeId).toBeNull();
    expect(restored.discoveredIds.length).toBe(0);
  });

  it("round-trips through save/restore", () => {
    system.activateStone("lady_stone");
    system.discoverStone("lord_stone");
    const snapshot = system.getSaveState();

    const clone = new StandingStoneSystem();
    clone.restoreFromSave(snapshot);
    expect(clone.activeId).toBe("lady_stone");
    expect([...clone.discoveredIds].sort()).toEqual(snapshot.discovered.slice().sort());
    expect(clone.getRegenMultiplier("stamina")).toBeCloseTo(1.25);
  });
});
