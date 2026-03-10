import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  RaceSystem,
  RACES,
  RACE_ATTRIBUTE_BONUS,
  RACE_SKILL_BONUS,
  type RacePower,
} from "./race-system";
import { AttributeSystem } from "./attribute-system";
import { SkillProgressionSystem } from "./skill-progression-system";
import { ActiveEffectsSystem } from "./active-effects-system";

describe("RaceSystem", () => {
  let system: RaceSystem;

  beforeEach(() => {
    system = new RaceSystem();
  });

  // ── Initial state ──────────────────────────────────────────────────────────

  it("starts with no chosen race", () => {
    expect(system.chosenRace).toBeNull();
  });

  // ── Catalogue ──────────────────────────────────────────────────────────────

  it("exposes 10 race definitions", () => {
    expect(system.all.length).toBe(10);
  });

  it("all race ids match the RACES export", () => {
    const sysIds = system.all.map((r) => r.id);
    const expIds = RACES.map((r) => r.id);
    expect(sysIds).toEqual(expIds);
  });

  it("getDefinition returns the correct race", () => {
    const nord = system.getDefinition("nord");
    expect(nord).toBeDefined();
    expect(nord!.name).toBe("Nord");
    expect(nord!.heritage).toBe("human");
  });

  it("getDefinition returns undefined for unknown id", () => {
    expect(system.getDefinition("not_a_race")).toBeUndefined();
  });

  it("all races have a name, description, heritage and non-empty id", () => {
    for (const race of RACES) {
      expect(race.id.length).toBeGreaterThan(0);
      expect(race.name.length).toBeGreaterThan(0);
      expect(race.description.length).toBeGreaterThan(0);
      expect(["human", "elven", "beast"]).toContain(race.heritage);
    }
  });

  it("includes both human and elven and beast heritage races", () => {
    const heritages = new Set(RACES.map((r) => r.heritage));
    expect(heritages.has("human")).toBe(true);
    expect(heritages.has("elven")).toBe(true);
    expect(heritages.has("beast")).toBe(true);
  });

  // ── chooseRace ────────────────────────────────────────────────────────────

  it("chooseRace returns true for a valid id", () => {
    expect(system.chooseRace("nord")).toBe(true);
  });

  it("chooseRace returns false for unknown id", () => {
    expect(system.chooseRace("nonexistent")).toBe(false);
    expect(system.chosenRace).toBeNull();
  });

  it("chooseRace can only be called once — second call returns false", () => {
    system.chooseRace("nord");
    expect(system.chooseRace("imperial")).toBe(false);
    expect(system.chosenRace!.id).toBe("nord");
  });

  it("chooseRace sets chosenRace", () => {
    system.chooseRace("altmer");
    expect(system.chosenRace!.id).toBe("altmer");
    expect(system.chosenRace!.name).toBe("High Elf");
  });

  it("chooseRace fires onRaceChosen callback", () => {
    const cb = vi.fn();
    system.onRaceChosen = cb;
    system.chooseRace("khajiit");
    expect(cb).toHaveBeenCalledOnce();
    expect(cb.mock.calls[0][0].id).toBe("khajiit");
  });

  // ── Attribute bonuses ──────────────────────────────────────────────────────

  it("nord applies +10 to strength and endurance", () => {
    const attrs = new AttributeSystem();
    const baseStr = attrs.get("strength");
    const baseEnd = attrs.get("endurance");
    system.chooseRace("nord", attrs);
    expect(attrs.get("strength")).toBe(baseStr + RACE_ATTRIBUTE_BONUS);
    expect(attrs.get("endurance")).toBe(baseEnd + RACE_ATTRIBUTE_BONUS);
  });

  it("breton applies +10 to intelligence and willpower", () => {
    const attrs = new AttributeSystem();
    const baseInt = attrs.get("intelligence");
    const baseWil = attrs.get("willpower");
    system.chooseRace("breton", attrs);
    expect(attrs.get("intelligence")).toBe(baseInt + RACE_ATTRIBUTE_BONUS);
    expect(attrs.get("willpower")).toBe(baseWil + RACE_ATTRIBUTE_BONUS);
  });

  it("altmer applies penalty to endurance", () => {
    const attrs = new AttributeSystem();
    const baseEnd = attrs.get("endurance");
    system.chooseRace("altmer", attrs);
    // altmer has endurance: -RACE_ATTRIBUTE_BONUS
    expect(attrs.get("endurance")).toBe(baseEnd - RACE_ATTRIBUTE_BONUS);
  });

  it("does not apply attribute bonuses when no attributeSystem passed", () => {
    // Should not throw; bonus is silently skipped
    expect(() => system.chooseRace("nord")).not.toThrow();
  });

  // ── Skill bonuses ──────────────────────────────────────────────────────────

  it("nord applies +10 to blade skill", () => {
    const skills = new SkillProgressionSystem();
    const baseBlade = skills.getSkill("blade")!.level;
    system.chooseRace("nord", undefined, skills);
    expect(skills.getSkill("blade")!.level).toBe(baseBlade + RACE_SKILL_BONUS);
  });

  it("bosmer applies +10 to marksman and sneak", () => {
    const skills = new SkillProgressionSystem();
    const baseMarksman = skills.getSkill("marksman")!.level;
    const baseSneak = skills.getSkill("sneak")!.level;
    system.chooseRace("bosmer", undefined, skills);
    expect(skills.getSkill("marksman")!.level).toBe(baseMarksman + RACE_SKILL_BONUS);
    expect(skills.getSkill("sneak")!.level).toBe(baseSneak + RACE_SKILL_BONUS);
  });

  it("imperial applies +10 to speechcraft and restoration", () => {
    const skills = new SkillProgressionSystem();
    const baseSpeech = skills.getSkill("speechcraft")!.level;
    const baseResto = skills.getSkill("restoration")!.level;
    system.chooseRace("imperial", undefined, skills);
    expect(skills.getSkill("speechcraft")!.level).toBe(baseSpeech + RACE_SKILL_BONUS);
    expect(skills.getSkill("restoration")!.level).toBe(baseResto + RACE_SKILL_BONUS);
  });

  it("does not apply skill bonuses when no skillSystem passed", () => {
    expect(() => system.chooseRace("bosmer")).not.toThrow();
  });

  // ── Resistance data ────────────────────────────────────────────────────────

  it("nord has frost resistance of 0.5", () => {
    const nord = system.getDefinition("nord")!;
    expect(nord.resistance?.frost).toBe(0.5);
  });

  it("altmer has fire weakness (-0.25) and frost weakness (-0.25)", () => {
    const altmer = system.getDefinition("altmer")!;
    expect(altmer.resistance?.fire).toBe(-0.25);
    expect(altmer.resistance?.frost).toBe(-0.25);
  });

  it("argonian has full poison immunity (1.0)", () => {
    const argonian = system.getDefinition("argonian")!;
    expect(argonian.resistance?.poison).toBe(1.0);
  });

  // ── Power data ────────────────────────────────────────────────────────────

  it("all 10 races have a power with a name, description, cooldownHours, and effects", () => {
    for (const race of RACES) {
      expect(race.power).toBeDefined();
      expect(race.power!.name.length).toBeGreaterThan(0);
      expect(race.power!.description.length).toBeGreaterThan(0);
      expect(race.power!.cooldownHours).toBeGreaterThan(0);
      expect(race.power!.effects.length).toBeGreaterThan(0);
    }
  });

  it("every power effect has a valid name, magnitude, and positive duration", () => {
    for (const race of RACES) {
      for (const eff of race.power!.effects) {
        expect(eff.name.length).toBeGreaterThan(0);
        expect(eff.magnitude).toBeGreaterThan(0);
        expect(eff.duration).toBeGreaterThan(0);
        expect(typeof eff.effectType).toBe("string");
      }
    }
  });

  // ── canActivatePower ──────────────────────────────────────────────────────

  it("canActivatePower returns false when no race chosen", () => {
    expect(system.canActivatePower(0)).toBe(false);
  });

  it("canActivatePower returns true on first use after race chosen", () => {
    system.chooseRace("nord");
    expect(system.canActivatePower(0)).toBe(true);
  });

  it("canActivatePower returns false while on cooldown", () => {
    system.chooseRace("nord");
    system.activatePower(0);
    // Immediately after use — still within cooldown window
    expect(system.canActivatePower(1)).toBe(false);
  });

  it("canActivatePower returns true after cooldown has elapsed", () => {
    system.chooseRace("nord"); // cooldownHours=24
    const t0 = 0;
    system.activatePower(t0);
    // 24 h * 60 min = 1440 minutes later
    expect(system.canActivatePower(t0 + 1440)).toBe(true);
  });

  it("canActivatePower returns false just before cooldown expires", () => {
    system.chooseRace("nord");
    const t0 = 100;
    system.activatePower(t0);
    // 1439 minutes is just short of 24 h
    expect(system.canActivatePower(t0 + 1439)).toBe(false);
  });

  // ── activatePower ─────────────────────────────────────────────────────────

  it("activatePower returns false when no race chosen", () => {
    expect(system.activatePower(0)).toBe(false);
  });

  it("activatePower returns true on first use", () => {
    system.chooseRace("argonian");
    expect(system.activatePower(0)).toBe(true);
  });

  it("activatePower returns false on second immediate use (on cooldown)", () => {
    system.chooseRace("argonian");
    system.activatePower(0);
    expect(system.activatePower(1)).toBe(false);
  });

  it("activatePower dispatches effects to ActiveEffectsSystem", () => {
    system.chooseRace("argonian"); // power: histskin → health_restore
    const effects = new ActiveEffectsSystem();
    system.activatePower(0, effects);
    const active = effects.activeEffects;
    expect(active.length).toBeGreaterThan(0);
    expect(active.some(e => e.effectType === "health_restore")).toBe(true);
  });

  it("activatePower dispatches multiple effects for multi-effect powers", () => {
    system.chooseRace("orsimer"); // berserk: fortify_strength + resist_damage
    const effects = new ActiveEffectsSystem();
    system.activatePower(0, effects);
    const active = effects.activeEffects;
    expect(active.some(e => e.effectType === "fortify_strength")).toBe(true);
    expect(active.some(e => e.effectType === "resist_damage")).toBe(true);
  });

  it("activatePower works without an ActiveEffectsSystem (no-op effects path)", () => {
    system.chooseRace("nord");
    // Should not throw; power still activates (cooldown consumed)
    expect(() => system.activatePower(0)).not.toThrow();
    expect(system.canActivatePower(1)).toBe(false);
  });

  it("activatePower fires onPowerActivated callback with the correct power", () => {
    system.chooseRace("khajiit");
    const cb = vi.fn();
    system.onPowerActivated = cb;
    system.activatePower(0);
    expect(cb).toHaveBeenCalledOnce();
    expect(cb.mock.calls[0][0].id).toBe("eye_of_fear");
  });

  it("onPowerActivated is not called when activation fails (cooldown)", () => {
    system.chooseRace("khajiit");
    const cb = vi.fn();
    system.onPowerActivated = cb;
    system.activatePower(0); // success
    system.activatePower(1); // fails — on cooldown
    expect(cb).toHaveBeenCalledOnce();
  });

  // ── powerCooldownRemaining ────────────────────────────────────────────────

  it("powerCooldownRemaining returns 0 when no race chosen", () => {
    expect(system.powerCooldownRemaining(0)).toBe(0);
  });

  it("powerCooldownRemaining returns 0 before first use", () => {
    system.chooseRace("nord");
    expect(system.powerCooldownRemaining(500)).toBe(0);
  });

  it("powerCooldownRemaining returns remaining minutes after activation", () => {
    system.chooseRace("nord"); // 24h cooldown = 1440 min
    const t0 = 0;
    system.activatePower(t0);
    expect(system.powerCooldownRemaining(t0 + 700)).toBe(740);
  });

  it("powerCooldownRemaining returns 0 once cooldown has fully elapsed", () => {
    system.chooseRace("nord");
    const t0 = 0;
    system.activatePower(t0);
    expect(system.powerCooldownRemaining(t0 + 1440)).toBe(0);
  });

  // ── Persistence (with lastPowerUseTime) ───────────────────────────────────

  it("getSaveState includes lastPowerUseTime as null before any use", () => {
    system.chooseRace("argonian");
    expect(system.getSaveState().lastPowerUseTime).toBeNull();
  });

  it("getSaveState includes lastPowerUseTime after activation", () => {
    system.chooseRace("argonian");
    system.activatePower(500);
    expect(system.getSaveState().lastPowerUseTime).toBe(500);
  });

  it("restoreFromSave round-trips lastPowerUseTime", () => {
    system.chooseRace("nord");
    system.activatePower(300);
    const state = system.getSaveState();

    const fresh = new RaceSystem();
    fresh.restoreFromSave(state);
    expect(fresh.chosenRace!.id).toBe("nord");
    // After restoring, power should still be on cooldown
    expect(fresh.canActivatePower(301)).toBe(false);
    expect(fresh.powerCooldownRemaining(301)).toBeGreaterThan(0);
  });

  it("restoreFromSave handles missing lastPowerUseTime (legacy saves)", () => {
    const fresh = new RaceSystem();
    // Simulate old save that has no lastPowerUseTime field
    fresh.restoreFromSave({ chosenId: "dunmer" } as any);
    expect(fresh.chosenRace!.id).toBe("dunmer");
    expect(fresh.canActivatePower(0)).toBe(true); // Power ready since no usage recorded
  });

  it("restoreFromSave ignores non-finite lastPowerUseTime values", () => {
    const fresh = new RaceSystem();
    fresh.restoreFromSave({ chosenId: "bosmer", lastPowerUseTime: Infinity });
    expect(fresh.canActivatePower(0)).toBe(true);
  });

  it("full round-trip save/restore preserves race and cooldown state", () => {
    system.chooseRace("khajiit");
    system.activatePower(1000);
    const state = system.getSaveState();

    const fresh = new RaceSystem();
    fresh.restoreFromSave(state);
    expect(fresh.chosenRace!.id).toBe("khajiit");
    expect(fresh.chosenRace!.heritage).toBe("beast");
    expect(fresh.canActivatePower(1001)).toBe(false);
    expect(fresh.powerCooldownRemaining(1001)).toBeGreaterThan(0);
  });
});
