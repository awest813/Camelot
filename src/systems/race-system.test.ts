import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  RaceSystem,
  RACES,
  RACE_ATTRIBUTE_BONUS,
  RACE_SKILL_BONUS,
} from "./race-system";
import { AttributeSystem } from "./attribute-system";
import { SkillProgressionSystem } from "./skill-progression-system";

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

  it("all 10 races have a racial power", () => {
    for (const race of RACES) {
      expect(race.power).toBeDefined();
      expect(race.power!.id.length).toBeGreaterThan(0);
      expect(race.power!.name.length).toBeGreaterThan(0);
      expect(race.power!.description.length).toBeGreaterThan(0);
    }
  });

  // ── Persistence ───────────────────────────────────────────────────────────

  it("getSaveState returns the chosen race id", () => {
    system.chooseRace("argonian");
    expect(system.getSaveState().chosenId).toBe("argonian");
  });

  it("getSaveState returns null when no race chosen", () => {
    expect(system.getSaveState().chosenId).toBeNull();
  });

  it("restoreFromSave re-populates the chosen race", () => {
    const fresh = new RaceSystem();
    fresh.restoreFromSave({ chosenId: "dunmer" });
    expect(fresh.chosenRace!.id).toBe("dunmer");
    expect(fresh.chosenRace!.name).toBe("Dark Elf");
  });

  it("restoreFromSave ignores unknown race ids", () => {
    system.restoreFromSave({ chosenId: "unknown_race" });
    expect(system.chosenRace).toBeNull();
  });

  it("restoreFromSave handles null state gracefully", () => {
    expect(() => system.restoreFromSave(null as any)).not.toThrow();
    expect(system.chosenRace).toBeNull();
  });

  it("restoreFromSave handles null chosenId gracefully", () => {
    system.restoreFromSave({ chosenId: null });
    expect(system.chosenRace).toBeNull();
  });

  it("full round-trip save/restore preserves state", () => {
    system.chooseRace("khajiit");
    const state = system.getSaveState();
    const fresh = new RaceSystem();
    fresh.restoreFromSave(state);
    expect(fresh.chosenRace!.id).toBe("khajiit");
    expect(fresh.chosenRace!.heritage).toBe("beast");
  });
});
