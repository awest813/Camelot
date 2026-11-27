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

  it("exposes 8 heritages", () => {
    expect(system.all.length).toBe(8);
  });

  it("all race ids match the RACES export", () => {
    const sysIds = system.all.map((r) => r.id);
    const expIds = RACES.map((r) => r.id);
    expect(sysIds).toEqual(expIds);
  });

  it("getDefinition returns the correct race", () => {
    const hillfolk = system.getDefinition("hillfolk");
    expect(hillfolk).toBeDefined();
    expect(hillfolk!.name).toBe("Hill-folk");
    expect(hillfolk!.heritage).toBe("wild");
  });

  it("getDefinition returns undefined for unknown id", () => {
    expect(system.getDefinition("not_a_race")).toBeUndefined();
  });

  it("all races have a name, description, heritage and non-empty id", () => {
    for (const race of RACES) {
      expect(race.id.length).toBeGreaterThan(0);
      expect(race.name.length).toBeGreaterThan(0);
      expect(race.description.length).toBeGreaterThan(0);
      expect(["hearth", "wild", "fae"]).toContain(race.heritage);
    }
  });

  it("includes peoples of the settled lands, the wild places and the fae-touched", () => {
    const heritages = new Set(RACES.map((r) => r.heritage));
    expect(heritages.has("hearth")).toBe(true);
    expect(heritages.has("wild")).toBe(true);
    expect(heritages.has("fae")).toBe(true);
  });

  // ── chooseRace ────────────────────────────────────────────────────────────

  it("chooseRace returns true for a valid id", () => {
    expect(system.chooseRace("hillfolk")).toBe(true);
  });

  it("chooseRace returns false for unknown id", () => {
    expect(system.chooseRace("nonexistent")).toBe(false);
    expect(system.chosenRace).toBeNull();
  });

  it("chooseRace can only be called once — second call returns false", () => {
    system.chooseRace("hillfolk");
    expect(system.chooseRace("lowlander")).toBe(false);
    expect(system.chosenRace!.id).toBe("hillfolk");
  });

  it("chooseRace sets chosenRace", () => {
    system.chooseRace("faeblood");
    expect(system.chosenRace!.id).toBe("faeblood");
    expect(system.chosenRace!.name).toBe("Fae-blooded");
  });

  it("chooseRace fires onRaceChosen callback", () => {
    const cb = vi.fn();
    system.onRaceChosen = cb;
    system.chooseRace("forestkin");
    expect(cb).toHaveBeenCalledOnce();
    expect(cb.mock.calls[0][0].id).toBe("forestkin");
  });

  // ── Attribute bonuses ──────────────────────────────────────────────────────

  it("hillfolk applies +10 to strength and endurance", () => {
    const attrs = new AttributeSystem();
    const baseStr = attrs.get("strength");
    const baseEnd = attrs.get("endurance");
    system.chooseRace("hillfolk", attrs);
    expect(attrs.get("strength")).toBe(baseStr + RACE_ATTRIBUTE_BONUS);
    expect(attrs.get("endurance")).toBe(baseEnd + RACE_ATTRIBUTE_BONUS);
  });

  it("faeblood applies +10 to intelligence and willpower", () => {
    const attrs = new AttributeSystem();
    const baseInt = attrs.get("intelligence");
    const baseWil = attrs.get("willpower");
    system.chooseRace("faeblood", attrs);
    expect(attrs.get("intelligence")).toBe(baseInt + RACE_ATTRIBUTE_BONUS);
    expect(attrs.get("willpower")).toBe(baseWil + RACE_ATTRIBUTE_BONUS);
  });

  it("faeblood applies penalty to endurance", () => {
    const attrs = new AttributeSystem();
    const baseEnd = attrs.get("endurance");
    system.chooseRace("faeblood", attrs);
    // faeblood has endurance: -RACE_ATTRIBUTE_BONUS
    expect(attrs.get("endurance")).toBe(baseEnd - RACE_ATTRIBUTE_BONUS);
  });

  it("does not apply attribute bonuses when no attributeSystem passed", () => {
    // Should not throw; bonus is silently skipped
    expect(() => system.chooseRace("hillfolk")).not.toThrow();
  });

  // ── Skill bonuses ──────────────────────────────────────────────────────────

  it("hillfolk applies +10 to blade skill", () => {
    const skills = new SkillProgressionSystem();
    const baseBlade = skills.getSkill("blade")!.level;
    system.chooseRace("hillfolk", undefined, skills);
    expect(skills.getSkill("blade")!.level).toBe(baseBlade + RACE_SKILL_BONUS);
  });

  it("forestkin applies +10 to marksman and sneak", () => {
    const skills = new SkillProgressionSystem();
    const baseMarksman = skills.getSkill("marksman")!.level;
    const baseSneak = skills.getSkill("sneak")!.level;
    system.chooseRace("forestkin", undefined, skills);
    expect(skills.getSkill("marksman")!.level).toBe(baseMarksman + RACE_SKILL_BONUS);
    expect(skills.getSkill("sneak")!.level).toBe(baseSneak + RACE_SKILL_BONUS);
  });

  it("lowlander applies +10 to speechcraft and restoration", () => {
    const skills = new SkillProgressionSystem();
    const baseSpeech = skills.getSkill("speechcraft")!.level;
    const baseResto = skills.getSkill("restoration")!.level;
    system.chooseRace("lowlander", undefined, skills);
    expect(skills.getSkill("speechcraft")!.level).toBe(baseSpeech + RACE_SKILL_BONUS);
    expect(skills.getSkill("restoration")!.level).toBe(baseResto + RACE_SKILL_BONUS);
  });

  it("does not apply skill bonuses when no skillSystem passed", () => {
    expect(() => system.chooseRace("forestkin")).not.toThrow();
  });

  // ── Resistance data ────────────────────────────────────────────────────────

  it("hillfolk has frost resistance of 0.5", () => {
    const hillfolk = system.getDefinition("hillfolk")!;
    expect(hillfolk.resistance?.frost).toBe(0.5);
  });

  it("faeblood has fire weakness (-0.25) and frost weakness (-0.25)", () => {
    const faeblood = system.getDefinition("faeblood")!;
    expect(faeblood.resistance?.fire).toBe(-0.25);
    expect(faeblood.resistance?.frost).toBe(-0.25);
  });

  it("fenfolk has full poison immunity (1.0)", () => {
    const fenfolk = system.getDefinition("fenfolk")!;
    expect(fenfolk.resistance?.poison).toBe(1.0);
  });

  // ── Power data ────────────────────────────────────────────────────────────

  it("all 8 heritages have a power with a name, description, cooldownHours, and effects", () => {
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
    system.chooseRace("hillfolk");
    expect(system.canActivatePower(0)).toBe(true);
  });

  it("canActivatePower returns false while on cooldown", () => {
    system.chooseRace("hillfolk");
    system.activatePower(0);
    // Immediately after use — still within cooldown window
    expect(system.canActivatePower(1)).toBe(false);
  });

  it("canActivatePower returns true after cooldown has elapsed", () => {
    system.chooseRace("hillfolk"); // cooldownHours=24
    const t0 = 0;
    system.activatePower(t0);
    // 24 h * 60 min = 1440 minutes later
    expect(system.canActivatePower(t0 + 1440)).toBe(true);
  });

  it("canActivatePower returns false just before cooldown expires", () => {
    system.chooseRace("hillfolk");
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
    system.chooseRace("fenfolk");
    expect(system.activatePower(0)).toBe(true);
  });

  it("activatePower returns false on second immediate use (on cooldown)", () => {
    system.chooseRace("fenfolk");
    system.activatePower(0);
    expect(system.activatePower(1)).toBe(false);
  });

  it("activatePower dispatches effects to ActiveEffectsSystem", () => {
    system.chooseRace("fenfolk"); // power: marsh_mending → health_restore
    const effects = new ActiveEffectsSystem();
    system.activatePower(0, effects);
    const active = effects.activeEffects;
    expect(active.length).toBeGreaterThan(0);
    expect(active.some(e => e.effectType === "health_restore")).toBe(true);
  });

  it("activatePower dispatches multiple effects for multi-effect powers", () => {
    system.chooseRace("giantblood"); // berserk: fortify_strength + resist_damage
    const effects = new ActiveEffectsSystem();
    system.activatePower(0, effects);
    const active = effects.activeEffects;
    expect(active.some(e => e.effectType === "fortify_strength")).toBe(true);
    expect(active.some(e => e.effectType === "resist_damage")).toBe(true);
  });

  it("activatePower works without an ActiveEffectsSystem (no-op effects path)", () => {
    system.chooseRace("hillfolk");
    // Should not throw; power still activates (cooldown consumed)
    expect(() => system.activatePower(0)).not.toThrow();
    expect(system.canActivatePower(1)).toBe(false);
  });

  it("activatePower fires onPowerActivated callback with the correct power", () => {
    system.chooseRace("forestkin");
    const cb = vi.fn();
    system.onPowerActivated = cb;
    system.activatePower(0);
    expect(cb).toHaveBeenCalledOnce();
    expect(cb.mock.calls[0][0].id).toBe("hunters_stride");
  });

  it("onPowerActivated is not called when activation fails (cooldown)", () => {
    system.chooseRace("forestkin");
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
    system.chooseRace("hillfolk");
    expect(system.powerCooldownRemaining(500)).toBe(0);
  });

  it("powerCooldownRemaining returns remaining minutes after activation", () => {
    system.chooseRace("hillfolk"); // 24h cooldown = 1440 min
    const t0 = 0;
    system.activatePower(t0);
    expect(system.powerCooldownRemaining(t0 + 700)).toBe(740);
  });

  it("powerCooldownRemaining returns 0 once cooldown has fully elapsed", () => {
    system.chooseRace("hillfolk");
    const t0 = 0;
    system.activatePower(t0);
    expect(system.powerCooldownRemaining(t0 + 1440)).toBe(0);
  });

  // ── Persistence (with lastPowerUseTime) ───────────────────────────────────

  it("getSaveState includes lastPowerUseTime as null before any use", () => {
    system.chooseRace("fenfolk");
    expect(system.getSaveState().lastPowerUseTime).toBeNull();
  });

  it("getSaveState includes lastPowerUseTime after activation", () => {
    system.chooseRace("fenfolk");
    system.activatePower(500);
    expect(system.getSaveState().lastPowerUseTime).toBe(500);
  });

  it("restoreFromSave round-trips lastPowerUseTime", () => {
    system.chooseRace("hillfolk");
    system.activatePower(300);
    const state = system.getSaveState();

    const fresh = new RaceSystem();
    fresh.restoreFromSave(state);
    expect(fresh.chosenRace!.id).toBe("hillfolk");
    // After restoring, power should still be on cooldown
    expect(fresh.canActivatePower(301)).toBe(false);
    expect(fresh.powerCooldownRemaining(301)).toBeGreaterThan(0);
  });

  it("restoreFromSave handles missing lastPowerUseTime (legacy saves)", () => {
    const fresh = new RaceSystem();
    // Simulate old save that has no lastPowerUseTime field
    fresh.restoreFromSave({ chosenId: "ashkin" } as any);
    expect(fresh.chosenRace!.id).toBe("ashkin");
    expect(fresh.canActivatePower(0)).toBe(true); // Power ready since no usage recorded
  });

  it("restoreFromSave ignores non-finite lastPowerUseTime values", () => {
    const fresh = new RaceSystem();
    fresh.restoreFromSave({ chosenId: "forestkin", lastPowerUseTime: Infinity });
    expect(fresh.canActivatePower(0)).toBe(true);
  });

  it("full round-trip save/restore preserves race and cooldown state", () => {
    system.chooseRace("forestkin");
    system.activatePower(1000);
    const state = system.getSaveState();

    const fresh = new RaceSystem();
    fresh.restoreFromSave(state);
    expect(fresh.chosenRace!.id).toBe("forestkin");
    expect(fresh.chosenRace!.heritage).toBe("wild");
    expect(fresh.canActivatePower(1001)).toBe(false);
    expect(fresh.powerCooldownRemaining(1001)).toBeGreaterThan(0);
  });
});
