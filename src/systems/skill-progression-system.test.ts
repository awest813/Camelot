import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  SkillProgressionSystem,
  SKILL_MAX_LEVEL,
  type ProgressionSkillId,
} from "./skill-progression-system";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("SkillProgressionSystem", () => {
  let sps: SkillProgressionSystem;

  beforeEach(() => {
    sps = new SkillProgressionSystem();
  });

  // ── Initial state ─────────────────────────────────────────────────────────

  it("initialises all eight skills at level 0 with 0 XP", () => {
    const ids: ProgressionSkillId[] = [
      "blade", "block", "destruction", "restoration", "marksman",
      "sneak", "speechcraft", "alchemy",
    ];
    for (const id of ids) {
      const skill = sps.getSkill(id);
      expect(skill, `${id} should exist`).toBeDefined();
      expect(skill!.level).toBe(0);
      expect(skill!.xp).toBe(0);
    }
  });

  it("getAllSkills returns exactly 8 skills", () => {
    expect(sps.getAllSkills()).toHaveLength(8);
  });

  // ── XP gain ───────────────────────────────────────────────────────────────

  it("gainXP increases xp on the correct skill", () => {
    sps.gainXP("blade", 10);
    expect(sps.getSkill("blade")!.xp).toBe(10);
    expect(sps.getSkill("destruction")!.xp).toBe(0);
  });

  it("gainXP ignores unknown skill IDs gracefully", () => {
    expect(() => sps.gainXP("unknown" as ProgressionSkillId, 10)).not.toThrow();
  });

  it("gainXP ignores zero or negative amounts", () => {
    sps.gainXP("blade", 0);
    sps.gainXP("blade", -5);
    expect(sps.getSkill("blade")!.xp).toBe(0);
  });

  // ── Level-up ──────────────────────────────────────────────────────────────

  it("levels up when xp reaches xpToNext", () => {
    const xpNeeded = sps.getSkill("blade")!.xpToNext;
    sps.gainXP("blade", xpNeeded);
    expect(sps.getSkill("blade")!.level).toBe(1);
  });

  it("fires onSkillLevelUp callback on level-up", () => {
    const spy = vi.fn();
    sps.onSkillLevelUp = spy;
    const xpNeeded = sps.getSkill("sneak")!.xpToNext;
    sps.gainXP("sneak", xpNeeded);
    expect(spy).toHaveBeenCalledWith("sneak", 1);
  });

  it("can level up multiple times in a single gainXP call", () => {
    const spy = vi.fn();
    sps.onSkillLevelUp = spy;
    // Enough XP for at least 3 levels
    const xp1 = sps.getSkill("alchemy")!.xpToNext;
    const xp2 = 50 + 1 * 12; // xpToNext(1)
    const xp3 = 50 + 2 * 12; // xpToNext(2)
    sps.gainXP("alchemy", xp1 + xp2 + xp3);
    expect(sps.getSkill("alchemy")!.level).toBe(3);
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it("does not exceed SKILL_MAX_LEVEL", () => {
    sps.gainXP("blade", 1_000_000);
    expect(sps.getSkill("blade")!.level).toBe(SKILL_MAX_LEVEL);
  });

  it("stops accumulating XP past max level", () => {
    sps.gainXP("blade", 1_000_000);
    sps.gainXP("blade", 500);
    expect(sps.getSkill("blade")!.xp).toBe(0);
  });

  // ── Multiplier ────────────────────────────────────────────────────────────

  it("multiplier returns 1.0 at level 0", () => {
    expect(sps.multiplier("blade")).toBeCloseTo(1.0, 5);
  });

  it("multiplier returns 2.0 at max level", () => {
    sps.gainXP("blade", 1_000_000);
    expect(sps.multiplier("blade")).toBeCloseTo(2.0, 5);
  });

  it("multiplier scales linearly between 0 and max", () => {
    // Force level 50 via save restore
    sps.restoreFromSave({ skills: [{ id: "destruction", level: 50, xp: 0 }] });
    expect(sps.multiplier("destruction")).toBeCloseTo(1.5, 5);
  });

  it("multiplier returns 1.0 for unknown skill IDs", () => {
    expect(sps.multiplier("unknown" as ProgressionSkillId)).toBe(1);
  });

  // ── Persistence ───────────────────────────────────────────────────────────

  it("getSaveState captures level and xp for all skills", () => {
    sps.gainXP("restoration", 25);
    const state = sps.getSaveState();
    const entry = state.skills.find(s => s.id === "restoration");
    expect(entry).toBeDefined();
    expect(entry!.xp).toBe(25);
  });

  it("restoreFromSave restores level and xp correctly", () => {
    sps.gainXP("speechcraft", 20);
    const state = sps.getSaveState();
    const sps2  = new SkillProgressionSystem();
    sps2.restoreFromSave(state);
    expect(sps2.getSkill("speechcraft")!.xp).toBe(20);
  });

  it("restoreFromSave ignores null gracefully", () => {
    expect(() => sps.restoreFromSave(null as any)).not.toThrow();
  });

  it("restoreFromSave clamps level to [0, SKILL_MAX_LEVEL]", () => {
    sps.restoreFromSave({ skills: [{ id: "blade", level: 999, xp: 0 }] });
    expect(sps.getSkill("blade")!.level).toBe(SKILL_MAX_LEVEL);
  });

  it("saves and restores round-trip without data loss", () => {
    const firstXpThreshold = sps.getSkill("marksman")!.xpToNext;
    sps.gainXP("marksman", firstXpThreshold + 10);
    const state = sps.getSaveState();
    const sps2 = new SkillProgressionSystem();
    sps2.restoreFromSave(state);
    expect(sps2.getSkill("marksman")!.level).toBe(1);
    expect(sps2.getSkill("marksman")!.xp).toBe(10);
  });
});
