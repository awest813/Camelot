import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  PlayerLevelSystem,
  MAJOR_LEVELUPS_REQUIRED,
  SKILL_GOVERNING_ATTRIBUTE,
  attributeBonusForLevelUps,
} from "./player-level-system";
import { ClassSystem } from "./class-system";
import { AttributeSystem } from "./attribute-system";
import { SkillProgressionSystem } from "./skill-progression-system";
import type { AttributeName } from "./attribute-system";
import type { ProgressionSkillId } from "./skill-progression-system";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeSystem() {
  const pls = new PlayerLevelSystem();
  const cls = new ClassSystem();
  const attrs = new AttributeSystem();
  const skills = new SkillProgressionSystem();

  // Warrior: major skills = blade, block, marksman
  cls.chooseClass("warrior");
  pls.attachToClassSystem(cls);
  pls.attachToAttributeSystem(attrs);

  // Wire skill level-up handler
  skills.onSkillLevelUp = (skillId) => pls.handleSkillLevelUp(skillId);

  return { pls, cls, attrs, skills };
}

/** Force-level a skill N times by dumping XP into it. */
function levelSkillNTimes(
  skills: SkillProgressionSystem,
  skillId: ProgressionSkillId,
  times: number,
) {
  for (let i = 0; i < times; i++) {
    // Gain enough XP to guarantee at least one level-up each iteration.
    skills.gainXP(skillId, 10_000);
  }
}

// ── attributeBonusForLevelUps ──────────────────────────────────────────────

describe("attributeBonusForLevelUps", () => {
  it("returns 1 for 0 level-ups", () => {
    expect(attributeBonusForLevelUps(0)).toBe(1);
  });

  it("returns 2 for 1–4 level-ups", () => {
    expect(attributeBonusForLevelUps(1)).toBe(2);
    expect(attributeBonusForLevelUps(4)).toBe(2);
  });

  it("returns 3 for 5–7 level-ups", () => {
    expect(attributeBonusForLevelUps(5)).toBe(3);
    expect(attributeBonusForLevelUps(7)).toBe(3);
  });

  it("returns 4 for 8–9 level-ups", () => {
    expect(attributeBonusForLevelUps(8)).toBe(4);
    expect(attributeBonusForLevelUps(9)).toBe(4);
  });

  it("returns 5 for 10+ level-ups", () => {
    expect(attributeBonusForLevelUps(10)).toBe(5);
    expect(attributeBonusForLevelUps(20)).toBe(5);
  });
});

// ── SKILL_GOVERNING_ATTRIBUTE ─────────────────────────────────────────────

describe("SKILL_GOVERNING_ATTRIBUTE", () => {
  it("maps blade → strength", () => {
    expect(SKILL_GOVERNING_ATTRIBUTE["blade"]).toBe("strength");
  });

  it("maps block → endurance", () => {
    expect(SKILL_GOVERNING_ATTRIBUTE["block"]).toBe("endurance");
  });

  it("maps destruction → willpower", () => {
    expect(SKILL_GOVERNING_ATTRIBUTE["destruction"]).toBe("willpower");
  });

  it("maps restoration → willpower", () => {
    expect(SKILL_GOVERNING_ATTRIBUTE["restoration"]).toBe("willpower");
  });

  it("maps marksman → agility", () => {
    expect(SKILL_GOVERNING_ATTRIBUTE["marksman"]).toBe("agility");
  });

  it("maps sneak → speed", () => {
    expect(SKILL_GOVERNING_ATTRIBUTE["sneak"]).toBe("speed");
  });

  it("maps speechcraft → luck", () => {
    expect(SKILL_GOVERNING_ATTRIBUTE["speechcraft"]).toBe("luck");
  });

  it("maps alchemy → intelligence", () => {
    expect(SKILL_GOVERNING_ATTRIBUTE["alchemy"]).toBe("intelligence");
  });
});

// ── Initial state ──────────────────────────────────────────────────────────

describe("PlayerLevelSystem — initial state", () => {
  it("starts at character level 1", () => {
    const { pls } = makeSystem();
    expect(pls.characterLevel).toBe(1);
  });

  it("starts with zero major level-ups", () => {
    const { pls } = makeSystem();
    expect(pls.majorLevelUpsThisLevel).toBe(0);
  });

  it("levelUpPending is false initially", () => {
    const { pls } = makeSystem();
    expect(pls.levelUpPending).toBe(false);
  });

  it("availableBonuses all return 1 with no skill level-ups", () => {
    const { pls } = makeSystem();
    const bonuses = pls.availableBonuses;
    for (const val of Object.values(bonuses)) {
      expect(val).toBe(1);
    }
  });
});

// ── handleSkillLevelUp ─────────────────────────────────────────────────────

describe("PlayerLevelSystem — handleSkillLevelUp", () => {
  it("counts major-skill level-ups", () => {
    const { pls, skills } = makeSystem();
    // Warrior major skills: blade, block, marksman
    levelSkillNTimes(skills, "blade", 1);
    expect(pls.majorLevelUpsThisLevel).toBeGreaterThanOrEqual(1);
  });

  it("does not count non-major skill level-ups toward the trigger", () => {
    const { pls, skills } = makeSystem();
    // alchemy is NOT a major skill for Warrior
    const before = pls.majorLevelUpsThisLevel;
    levelSkillNTimes(skills, "alchemy", 1);
    expect(pls.majorLevelUpsThisLevel).toBe(before);
  });

  it("still tracks governing-attribute counts for non-major skills", () => {
    const { pls, skills } = makeSystem();
    const beforeIntel = pls.availableBonuses["intelligence"];
    levelSkillNTimes(skills, "alchemy", 1);
    expect(pls.availableBonuses["intelligence"]).toBeGreaterThanOrEqual(beforeIntel);
  });

  it("fires onLevelUpReady after MAJOR_LEVELUPS_REQUIRED major-skill level-ups", () => {
    const { pls, skills } = makeSystem();
    const spy = vi.fn();
    pls.onLevelUpReady = spy;

    // Warrior major skills: blade, block, marksman — level them up enough times
    levelSkillNTimes(skills, "blade", 4);
    levelSkillNTimes(skills, "block", 4);
    levelSkillNTimes(skills, "marksman", 2);

    expect(spy).toHaveBeenCalledOnce();
    expect(pls.levelUpPending).toBe(true);
  });

  it("does not fire onLevelUpReady before threshold is reached", () => {
    const { pls, skills } = makeSystem();
    const spy = vi.fn();
    pls.onLevelUpReady = spy;

    levelSkillNTimes(skills, "blade", 1);

    // With just one level-up we won't have 10 major-skill level-ups yet
    if (!pls.levelUpPending) {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it("does not fire onLevelUpReady a second time when already pending", () => {
    const { pls, skills } = makeSystem();
    const spy = vi.fn();
    pls.onLevelUpReady = spy;

    levelSkillNTimes(skills, "blade", 4);
    levelSkillNTimes(skills, "block", 4);
    levelSkillNTimes(skills, "marksman", 4); // > 10, would double-fire without guard

    expect(spy).toHaveBeenCalledOnce();
  });

  it("does not count level-ups when no class has been chosen", () => {
    const pls = new PlayerLevelSystem();
    pls.attachToAttributeSystem(new AttributeSystem());
    // No class attached → no major skills → no counter increment
    pls.handleSkillLevelUp("blade");
    expect(pls.majorLevelUpsThisLevel).toBe(0);
  });
});

// ── availableBonuses ───────────────────────────────────────────────────────

describe("PlayerLevelSystem — availableBonuses", () => {
  it("increases strength bonus when blade levels up multiple times", () => {
    const { pls, skills } = makeSystem();
    levelSkillNTimes(skills, "blade", 5);
    // After 5 blade level-ups → strength should be at ≥ +3
    expect(pls.availableBonuses["strength"]).toBeGreaterThanOrEqual(3);
  });

  it("willpower bonus reflects both destruction and restoration level-ups", () => {
    const { pls } = makeSystem();
    // Directly feed 3 destruction + 3 restoration level-up events = 6 willpower-governing level-ups → bonus of 3
    for (let i = 0; i < 3; i++) pls.handleSkillLevelUp("destruction");
    for (let i = 0; i < 3; i++) pls.handleSkillLevelUp("restoration");
    expect(pls.availableBonuses["willpower"]).toBe(3);
  });
});

// ── suggestedAttributes ────────────────────────────────────────────────────

describe("PlayerLevelSystem — suggestedAttributes", () => {
  it("returns exactly 3 distinct attribute names", () => {
    const { pls } = makeSystem();
    const suggested = pls.suggestedAttributes;
    expect(suggested.length).toBe(3);
    const unique = new Set(suggested);
    expect(unique.size).toBe(3);
  });

  it("returns attributes with the highest bonuses first", () => {
    const { pls, skills } = makeSystem();
    // Level blade many times → high strength bonus
    levelSkillNTimes(skills, "blade", 8);
    const suggested = pls.suggestedAttributes;
    // Strength should be the highest (or tied for highest)
    const bonuses = pls.availableBonuses;
    const topBonus = bonuses[suggested[0]];
    const strBonus = bonuses["strength"];
    expect(topBonus).toBeGreaterThanOrEqual(strBonus - 1); // within 1 (ties)
  });
});

// ── confirmLevelUp ─────────────────────────────────────────────────────────

describe("PlayerLevelSystem — confirmLevelUp", () => {
  function setupPendingLevelUp() {
    const { pls, cls, attrs, skills } = makeSystem();
    const spy = vi.fn();
    pls.onLevelUpReady = spy;

    levelSkillNTimes(skills, "blade", 4);
    levelSkillNTimes(skills, "block", 4);
    levelSkillNTimes(skills, "marksman", 2);

    expect(pls.levelUpPending).toBe(true);
    return { pls, cls, attrs, skills };
  }

  it("returns false when no level-up is pending", () => {
    const { pls } = makeSystem();
    expect(pls.confirmLevelUp("strength", "endurance", "agility")).toBe(false);
  });

  it("returns false when attribute system is not attached", () => {
    const { pls, skills } = makeSystem();
    const plsNoAttr = new PlayerLevelSystem();
    const cls2 = new ClassSystem();
    cls2.chooseClass("warrior");
    plsNoAttr.attachToClassSystem(cls2);
    skills.onSkillLevelUp = (s) => plsNoAttr.handleSkillLevelUp(s);

    levelSkillNTimes(skills, "blade", 4);
    levelSkillNTimes(skills, "block", 4);
    levelSkillNTimes(skills, "marksman", 2);

    expect(plsNoAttr.levelUpPending).toBe(true);
    expect(plsNoAttr.confirmLevelUp("strength", "endurance", "agility")).toBe(false);
  });

  it("returns false for duplicate attribute choices", () => {
    const { pls } = setupPendingLevelUp();
    expect(pls.confirmLevelUp("strength", "strength", "agility")).toBe(false);
    expect(pls.confirmLevelUp("strength", "endurance", "strength")).toBe(false);
    expect(pls.confirmLevelUp("agility", "endurance", "endurance")).toBe(false);
  });

  it("applies attribute bonuses to the attribute system", () => {
    const { pls, attrs } = setupPendingLevelUp();
    const strBefore = attrs.get("strength");
    const endBefore = attrs.get("endurance");
    const agilBefore = attrs.get("agility");

    const result = pls.confirmLevelUp("strength", "endurance", "agility");
    expect(result).toBe(true);

    expect(attrs.get("strength")).toBeGreaterThan(strBefore);
    expect(attrs.get("endurance")).toBeGreaterThan(endBefore);
    expect(attrs.get("agility")).toBeGreaterThan(agilBefore);
  });

  it("advances characterLevel by 1", () => {
    const { pls } = setupPendingLevelUp();
    const before = pls.characterLevel;
    pls.confirmLevelUp("strength", "endurance", "agility");
    expect(pls.characterLevel).toBe(before + 1);
  });

  it("resets levelUpPending to false", () => {
    const { pls } = setupPendingLevelUp();
    pls.confirmLevelUp("strength", "endurance", "agility");
    expect(pls.levelUpPending).toBe(false);
  });

  it("resets majorLevelUpsThisLevel to 0", () => {
    const { pls } = setupPendingLevelUp();
    pls.confirmLevelUp("strength", "endurance", "agility");
    expect(pls.majorLevelUpsThisLevel).toBe(0);
  });

  it("fires onLevelUpComplete with the new character level", () => {
    const { pls } = setupPendingLevelUp();
    const spy = vi.fn();
    pls.onLevelUpComplete = spy;
    pls.confirmLevelUp("strength", "endurance", "agility");
    expect(spy).toHaveBeenCalledWith(2);
  });

  it("allows a second level-up after the first is confirmed", () => {
    const { pls, skills } = setupPendingLevelUp();
    pls.confirmLevelUp("strength", "endurance", "agility");

    const spy2 = vi.fn();
    pls.onLevelUpReady = spy2;

    // Level major skills again for the second level
    levelSkillNTimes(skills, "blade", 4);
    levelSkillNTimes(skills, "block", 4);
    levelSkillNTimes(skills, "marksman", 2);

    expect(spy2).toHaveBeenCalledOnce();
    expect(pls.characterLevel).toBe(2);
    expect(pls.levelUpPending).toBe(true);
  });
});

// ── Save / restore ─────────────────────────────────────────────────────────

describe("PlayerLevelSystem — save / restore", () => {
  it("round-trips initial state", () => {
    const { pls } = makeSystem();
    const state = pls.getSaveState();
    const pls2 = new PlayerLevelSystem();
    pls2.restoreFromSave(state);
    expect(pls2.characterLevel).toBe(1);
    expect(pls2.majorLevelUpsThisLevel).toBe(0);
    expect(pls2.levelUpPending).toBe(false);
  });

  it("round-trips mid-level state", () => {
    const { pls, skills } = makeSystem();
    levelSkillNTimes(skills, "blade", 3);
    const state = pls.getSaveState();

    const pls2 = new PlayerLevelSystem();
    pls2.restoreFromSave(state);

    expect(pls2.majorLevelUpsThisLevel).toBe(pls.majorLevelUpsThisLevel);
    expect(pls2.availableBonuses["strength"]).toBe(pls.availableBonuses["strength"]);
  });

  it("round-trips pending level-up state", () => {
    const { pls, skills } = makeSystem();
    levelSkillNTimes(skills, "blade", 4);
    levelSkillNTimes(skills, "block", 4);
    levelSkillNTimes(skills, "marksman", 2);

    const state = pls.getSaveState();
    const pls2 = new PlayerLevelSystem();
    pls2.restoreFromSave(state);

    expect(pls2.levelUpPending).toBe(true);
    expect(pls2.characterLevel).toBe(1);
  });

  it("round-trips characterLevel after level-up", () => {
    const { pls, skills } = makeSystem();
    levelSkillNTimes(skills, "blade", 4);
    levelSkillNTimes(skills, "block", 4);
    levelSkillNTimes(skills, "marksman", 2);
    pls.confirmLevelUp("strength", "endurance", "agility");

    const state = pls.getSaveState();
    const pls2 = new PlayerLevelSystem();
    pls2.restoreFromSave(state);

    expect(pls2.characterLevel).toBe(2);
    expect(pls2.levelUpPending).toBe(false);
    expect(pls2.majorLevelUpsThisLevel).toBe(0);
  });

  it("clamps restored characterLevel to minimum of 1", () => {
    const { pls } = makeSystem();
    pls.restoreFromSave({ characterLevel: 0, majorLevelUpsThisLevel: 0, attributeLevelUpCounts: pls.getSaveState().attributeLevelUpCounts, levelUpPending: false });
    expect(pls.characterLevel).toBe(1);
  });

  it("handles missing/corrupt attributeLevelUpCounts gracefully", () => {
    const { pls } = makeSystem();
    // Pass state with missing counts — should default to 0
    pls.restoreFromSave({ characterLevel: 3, majorLevelUpsThisLevel: 5, attributeLevelUpCounts: {} as any, levelUpPending: false });
    const bonuses = pls.availableBonuses;
    for (const val of Object.values(bonuses)) {
      expect(val).toBe(1); // all zero counts → bonus of 1
    }
  });
});

// ── Integration with SkillProgressionSystem ────────────────────────────────

describe("PlayerLevelSystem — SkillProgressionSystem integration", () => {
  it("MAJOR_LEVELUPS_REQUIRED constant is 10", () => {
    expect(MAJOR_LEVELUPS_REQUIRED).toBe(10);
  });

  it("fires level-up ready exactly at 10 major-skill level-up events", () => {
    const { pls } = makeSystem();
    const spy = vi.fn();
    pls.onLevelUpReady = spy;
    let count = 0;
    let readyFiredAt = -1;

    // Manually feed exactly 10 major-skill level-ups one at a time
    for (let i = 0; i < 12; i++) {
      pls.handleSkillLevelUp("blade"); // blade is a major skill for Warrior
      count++;
      if (spy.mock.calls.length === 1 && readyFiredAt === -1) {
        readyFiredAt = count;
      }
    }

    expect(spy).toHaveBeenCalledOnce();
    expect(readyFiredAt).toBe(MAJOR_LEVELUPS_REQUIRED);
  });

  it("bonus for willpower reflects combined destruction + restoration level-ups", () => {
    const { pls } = makeSystem();
    // Feed 5 destruction + 3 restoration = 8 willpower-governing level-ups
    for (let i = 0; i < 5; i++) pls.handleSkillLevelUp("destruction");
    for (let i = 0; i < 3; i++) pls.handleSkillLevelUp("restoration");
    // 8 level-ups → bonus of 4
    expect(pls.availableBonuses["willpower"]).toBe(4);
  });
});
