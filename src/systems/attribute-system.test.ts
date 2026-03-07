import { describe, it, expect, beforeEach } from "vitest";
import {
  AttributeSystem,
  ATTRIBUTE_NAMES,
  ATTRIBUTE_POINTS_PER_LEVEL,
} from "./attribute-system";

describe("AttributeSystem", () => {
  let attrs: AttributeSystem;

  beforeEach(() => {
    attrs = new AttributeSystem();
  });

  it("returns default base values for all attributes", () => {
    for (const name of ATTRIBUTE_NAMES) {
      expect(attrs.get(name)).toBe(40);
    }
  });

  it("allows custom initial base values via constructor", () => {
    const custom = new AttributeSystem({ strength: 60, luck: 20 });
    expect(custom.get("strength")).toBe(60);
    expect(custom.get("luck")).toBe(20);
    expect(custom.get("endurance")).toBe(40); // default unchanged
  });

  it("clamps get() result to [1, 100]", () => {
    attrs.setBase("strength", 120); // above max
    expect(attrs.get("strength")).toBe(100);

    attrs.setBase("strength", 0); // below min
    expect(attrs.get("strength")).toBe(1);
  });

  it("applies and accumulates modifiers", () => {
    attrs.applyModifier("strength", 10);
    expect(attrs.get("strength")).toBe(50);

    attrs.applyModifier("strength", 5);
    expect(attrs.get("strength")).toBe(55);
  });

  it("clears all modifiers", () => {
    attrs.applyModifier("strength", 10);
    attrs.clearModifiers();
    expect(attrs.get("strength")).toBe(40);
  });

  it("derives maxHealth from endurance", () => {
    // endurance=40 → 100 + 40*2 = 180
    expect(attrs.maxHealth).toBe(180);
    attrs.setBase("endurance", 60);
    expect(attrs.maxHealth).toBe(220);
  });

  it("derives maxMagicka from intelligence + willpower", () => {
    // int=40, will=40 → 100 + 80*0.5 = 140
    expect(attrs.maxMagicka).toBe(140);
  });

  it("derives maxStamina from endurance + strength", () => {
    // end=40, str=40 → 100 + 80*0.5 = 140
    expect(attrs.maxStamina).toBe(140);
  });

  it("derives carryWeight from strength", () => {
    // str=40 → 100 + 40*5 = 300
    expect(attrs.carryWeight).toBe(300);
    attrs.setBase("strength", 80);
    expect(attrs.carryWeight).toBe(500);
  });

  it("derives meleeDamageBonus from strength", () => {
    // str=40 → 40*0.2 = 8
    expect(attrs.meleeDamageBonus).toBeCloseTo(8);
  });

  it("derives magicDamageBonus from intelligence", () => {
    expect(attrs.magicDamageBonus).toBeCloseTo(8);
  });

  it("derives critChance from luck capped at 0.1", () => {
    // luck=40 → 40/1000 = 0.04
    expect(attrs.critChance).toBeCloseTo(0.04);
    attrs.setBase("luck", 100);
    expect(attrs.critChance).toBe(0.1);
  });

  it("derives speedMultiplier from agility relative to 40", () => {
    // agility=40 → 1.0
    expect(attrs.speedMultiplier).toBeCloseTo(1.0);
    attrs.setBase("agility", 60);
    expect(attrs.speedMultiplier).toBeCloseTo(1.1);
    attrs.setBase("agility", 20);
    expect(attrs.speedMultiplier).toBeCloseTo(0.9);
  });

  it("awards level-up points and allows spending them", () => {
    attrs.awardLevelUpPoints(1);
    expect(attrs.pendingPoints).toBe(ATTRIBUTE_POINTS_PER_LEVEL);

    const ok = attrs.spendPoint("strength");
    expect(ok).toBe(true);
    expect(attrs.get("strength")).toBe(41);
    expect(attrs.pendingPoints).toBe(ATTRIBUTE_POINTS_PER_LEVEL - 1);
  });

  it("spendPoint returns false when no points are available", () => {
    expect(attrs.spendPoint("strength")).toBe(false);
    expect(attrs.get("strength")).toBe(40);
  });

  it("spendPoint returns false when attribute is already at max", () => {
    attrs.setBase("strength", 100);
    attrs.awardLevelUpPoints(1);
    expect(attrs.spendPoint("strength")).toBe(false);
  });

  it("getAll returns effective values for every attribute", () => {
    attrs.applyModifier("agility", 5);
    const all = attrs.getAll();
    expect(all.agility).toBe(45);
    expect(all.strength).toBe(40);
  });

  it("saves and restores state", () => {
    attrs.setBase("strength", 55);
    attrs.awardLevelUpPoints(2);
    const saved = attrs.getSaveState();

    const restored = new AttributeSystem();
    restored.restoreFromSave(saved);
    expect(restored.get("strength")).toBe(55);
    expect(restored.pendingPoints).toBe(ATTRIBUTE_POINTS_PER_LEVEL * 2);
  });
});
