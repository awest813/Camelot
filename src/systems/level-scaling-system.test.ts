import { describe, it, expect, beforeEach } from "vitest";
import {
  LevelScalingSystem,
  SCALE_PER_LEVEL,
  MIN_SCALE,
  MAX_SCALE,
} from "./level-scaling-system";

// ── Minimal NPC stub ──────────────────────────────────────────────────────────

function makeNPC(health = 100, xpReward = 25) {
  return { maxHealth: health, health, xpReward } as any;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("LevelScalingSystem", () => {
  let lss: LevelScalingSystem;

  beforeEach(() => {
    lss = new LevelScalingSystem();
  });

  // ── computeScale ──────────────────────────────────────────────────────────

  it("computeScale increases with player level", () => {
    const s1 = LevelScalingSystem.computeScale(1);
    const s5 = LevelScalingSystem.computeScale(5);
    const s10 = LevelScalingSystem.computeScale(10);
    expect(s5).toBeGreaterThan(s1);
    expect(s10).toBeGreaterThan(s5);
  });

  it("computeScale never goes below MIN_SCALE", () => {
    expect(LevelScalingSystem.computeScale(0)).toBeGreaterThanOrEqual(MIN_SCALE);
    expect(LevelScalingSystem.computeScale(-99)).toBeGreaterThanOrEqual(MIN_SCALE);
  });

  it("computeScale never exceeds MAX_SCALE", () => {
    expect(LevelScalingSystem.computeScale(1000)).toBeLessThanOrEqual(MAX_SCALE);
  });

  it("computeScale at level 1 equals 0.8 + SCALE_PER_LEVEL (within MIN/MAX bounds)", () => {
    const expected = Math.max(MIN_SCALE, Math.min(MAX_SCALE, 0.8 + 1 * SCALE_PER_LEVEL));
    expect(LevelScalingSystem.computeScale(1)).toBeCloseTo(expected, 5);
  });

  // ── scaleNPC ──────────────────────────────────────────────────────────────

  it("scaleNPC scales maxHealth and health by factor", () => {
    const npc = makeNPC(100);
    lss.scaleNPC(npc, 5);
    const factor = LevelScalingSystem.computeScale(5);
    expect(npc.maxHealth).toBe(Math.round(100 * factor));
    expect(npc.health).toBe(npc.maxHealth);
  });

  it("scaleNPC scales xpReward by factor", () => {
    const npc = makeNPC(100, 25);
    lss.scaleNPC(npc, 10);
    const factor = LevelScalingSystem.computeScale(10);
    expect(npc.xpReward).toBe(Math.max(1, Math.round(25 * factor)));
  });

  it("scaleNPC sets health to new maxHealth (full HP on spawn)", () => {
    const npc = makeNPC(100);
    npc.health = 40; // simulate damaged NPC
    lss.scaleNPC(npc, 3);
    expect(npc.health).toBe(npc.maxHealth);
  });

  it("scaleNPC health never drops below 1", () => {
    const npc = makeNPC(1);
    lss.scaleNPC(npc, 1);
    expect(npc.maxHealth).toBeGreaterThanOrEqual(1);
    expect(npc.health).toBeGreaterThanOrEqual(1);
  });

  it("scaleNPC xpReward never drops below 1", () => {
    const npc = makeNPC(1, 1);
    lss.scaleNPC(npc, 1);
    expect(npc.xpReward).toBeGreaterThanOrEqual(1);
  });

  it("high player level caps at MAX_SCALE", () => {
    const npc = makeNPC(100, 50);
    lss.scaleNPC(npc, 999);
    expect(npc.maxHealth).toBe(Math.round(100 * MAX_SCALE));
  });

  it("scaling is deterministic across two calls with same level", () => {
    const npc1 = makeNPC(200, 30);
    const npc2 = makeNPC(200, 30);
    lss.scaleNPC(npc1, 7);
    lss.scaleNPC(npc2, 7);
    expect(npc1.maxHealth).toBe(npc2.maxHealth);
    expect(npc1.xpReward).toBe(npc2.xpReward);
  });
});
