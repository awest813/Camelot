import { describe, it, expect, vi, beforeEach } from "vitest";
import { SwimmingSystem } from "./swimming-system";
import type { SwimmingPlayer } from "./swimming-system";

// ── Fixture helpers ───────────────────────────────────────────────────────────

function makePlayer(health = 100, maxHealth = 100): SwimmingPlayer {
  return { health, maxHealth };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("SwimmingSystem — initial state", () => {
  it("starts not submerged", () => {
    const sys = new SwimmingSystem();
    expect(sys.isSubmerged).toBe(false);
  });

  it("starts with full breath", () => {
    const sys = new SwimmingSystem();
    expect(sys.breathRatio).toBe(1);
    expect(sys.currentBreath).toBe(sys.maxBreath);
  });

  it("swim speed multiplier is 1.0 when not submerged", () => {
    const sys = new SwimmingSystem();
    expect(sys.swimSpeedMultiplier).toBe(1.0);
  });

  it("hasWaterBreathing is false by default", () => {
    const sys = new SwimmingSystem();
    expect(sys.hasWaterBreathing).toBe(false);
  });
});

describe("SwimmingSystem — enterWater / exitWater", () => {
  it("enterWater sets isSubmerged to true", () => {
    const sys = new SwimmingSystem();
    sys.enterWater();
    expect(sys.isSubmerged).toBe(true);
  });

  it("exitWater sets isSubmerged to false", () => {
    const sys = new SwimmingSystem();
    sys.enterWater();
    sys.exitWater();
    expect(sys.isSubmerged).toBe(false);
  });

  it("exitWater restores breath to full", () => {
    const sys = new SwimmingSystem();
    sys.enterWater();
    const player = makePlayer();
    sys.update(5, player); // drain some breath
    sys.exitWater();
    expect(sys.currentBreath).toBe(sys.maxBreath);
    expect(sys.breathRatio).toBe(1);
  });

  it("enterWater fires onEnterWater callback", () => {
    const sys = new SwimmingSystem();
    const cb = vi.fn();
    sys.onEnterWater = cb;
    sys.enterWater();
    expect(cb).toHaveBeenCalledOnce();
  });

  it("exitWater fires onExitWater callback", () => {
    const sys = new SwimmingSystem();
    const cb = vi.fn();
    sys.onExitWater = cb;
    sys.enterWater();
    sys.exitWater();
    expect(cb).toHaveBeenCalledOnce();
  });

  it("enterWater is idempotent — callback fires only once", () => {
    const sys = new SwimmingSystem();
    const cb = vi.fn();
    sys.onEnterWater = cb;
    sys.enterWater();
    sys.enterWater(); // duplicate
    expect(cb).toHaveBeenCalledOnce();
  });

  it("exitWater is idempotent — callback fires only once", () => {
    const sys = new SwimmingSystem();
    const cb = vi.fn();
    sys.onExitWater = cb;
    sys.enterWater();
    sys.exitWater();
    sys.exitWater(); // duplicate
    expect(cb).toHaveBeenCalledOnce();
  });

  it("swim speed multiplier is less than 1 while submerged", () => {
    const sys = new SwimmingSystem();
    sys.enterWater();
    expect(sys.swimSpeedMultiplier).toBeLessThan(1.0);
  });

  it("swim speed multiplier returns to 1.0 after exiting", () => {
    const sys = new SwimmingSystem();
    sys.enterWater();
    sys.exitWater();
    expect(sys.swimSpeedMultiplier).toBe(1.0);
  });
});

describe("SwimmingSystem — breath drain", () => {
  it("breath drains while submerged", () => {
    const sys = new SwimmingSystem();
    sys.enterWater();
    const player = makePlayer();
    sys.update(1, player);
    expect(sys.currentBreath).toBeLessThan(sys.maxBreath);
  });

  it("breath does not drain when not submerged", () => {
    const sys = new SwimmingSystem();
    const player = makePlayer();
    sys.update(5, player);
    expect(sys.breathRatio).toBe(1);
  });

  it("breath drains to zero if underwater long enough", () => {
    const sys = new SwimmingSystem();
    sys.enterWater();
    const player = makePlayer();
    sys.update(100, player); // far exceeds max breath
    expect(sys.currentBreath).toBe(0);
  });

  it("breath does not go below zero", () => {
    const sys = new SwimmingSystem();
    sys.enterWater();
    const player = makePlayer();
    sys.update(1000, player);
    expect(sys.currentBreath).toBeGreaterThanOrEqual(0);
  });

  it("fires onBreathChange callback while breath is draining", () => {
    const sys = new SwimmingSystem();
    const cb = vi.fn();
    sys.onBreathChange = cb;
    sys.enterWater();
    const player = makePlayer();
    sys.update(1, player);
    expect(cb).toHaveBeenCalled();
    const [ratio] = cb.mock.calls[0];
    expect(ratio).toBeGreaterThanOrEqual(0);
    expect(ratio).toBeLessThan(1);
  });
});

describe("SwimmingSystem — low breath warning", () => {
  it("fires onBreathLow once when breath drops below 20 %", () => {
    const sys = new SwimmingSystem();
    const cb = vi.fn();
    sys.onBreathLow = cb;
    sys.enterWater();
    const player = makePlayer();
    // Drain to exactly 0 — threshold (20 %) will be crossed
    sys.update(sys.maxBreath, player);
    expect(cb).toHaveBeenCalledOnce();
  });

  it("onBreathLow does not fire again in the same submersion", () => {
    const sys = new SwimmingSystem();
    const cb = vi.fn();
    sys.onBreathLow = cb;
    sys.enterWater();
    const player = makePlayer();
    sys.update(sys.maxBreath * 0.9, player); // first tick past threshold
    sys.update(1, player);                    // subsequent tick
    expect(cb).toHaveBeenCalledOnce();
  });

  it("onBreathLow fires again on the next submersion", () => {
    const sys = new SwimmingSystem();
    const cb = vi.fn();
    sys.onBreathLow = cb;
    const player = makePlayer();

    // First submersion
    sys.enterWater();
    sys.update(sys.maxBreath, player);
    sys.exitWater();

    // Second submersion
    sys.enterWater();
    sys.update(sys.maxBreath, player);
    sys.exitWater();

    expect(cb).toHaveBeenCalledTimes(2);
  });
});

describe("SwimmingSystem — drowning damage", () => {
  it("player takes damage when out of breath", () => {
    const sys = new SwimmingSystem();
    sys.enterWater();
    const player = makePlayer(100, 100);
    sys.update(sys.maxBreath + 1, player); // exhaust breath + one extra second
    expect(player.health).toBeLessThan(100);
  });

  it("fires onDrowning callback with damage amount", () => {
    const sys = new SwimmingSystem();
    const cb = vi.fn();
    sys.onDrowning = cb;
    sys.enterWater();
    const player = makePlayer();
    sys.update(sys.maxBreath + 0.1, player); // go past breath = 0
    expect(cb).toHaveBeenCalled();
    const [dmg] = cb.mock.calls[0];
    expect(dmg).toBeGreaterThan(0);
  });

  it("player health does not drop below zero from drowning", () => {
    const sys = new SwimmingSystem();
    sys.enterWater();
    const player = makePlayer(1, 100);
    sys.update(sys.maxBreath + 100, player);
    expect(player.health).toBeGreaterThanOrEqual(0);
  });
});

describe("SwimmingSystem — water breathing", () => {
  it("breath does not drain when hasWaterBreathing is true", () => {
    const sys = new SwimmingSystem();
    sys.hasWaterBreathing = true;
    sys.enterWater();
    const player = makePlayer();
    sys.update(100, player);
    expect(sys.breathRatio).toBe(1);
  });

  it("onBreathLow does not fire when hasWaterBreathing is true", () => {
    const sys = new SwimmingSystem();
    sys.hasWaterBreathing = true;
    const cb = vi.fn();
    sys.onBreathLow = cb;
    sys.enterWater();
    const player = makePlayer();
    sys.update(100, player);
    expect(cb).not.toHaveBeenCalled();
  });

  it("player does not take drowning damage when hasWaterBreathing is true", () => {
    const sys = new SwimmingSystem();
    sys.hasWaterBreathing = true;
    sys.enterWater();
    const player = makePlayer(100, 100);
    sys.update(200, player);
    expect(player.health).toBe(100);
  });
});

describe("SwimmingSystem — setMaxBreath", () => {
  it("setMaxBreath updates the cap", () => {
    const sys = new SwimmingSystem();
    sys.setMaxBreath(60);
    expect(sys.maxBreath).toBe(60);
  });

  it("setMaxBreath clamps currentBreath when new max is smaller", () => {
    const sys = new SwimmingSystem();
    sys.enterWater();
    const player = makePlayer();
    sys.update(5, player); // currentBreath = 25 (30-5)
    sys.exitWater();
    // Now manually reset to test clamping
    sys.setMaxBreath(10);
    expect(sys.currentBreath).toBeLessThanOrEqual(10);
  });

  it("setMaxBreath minimum is 1 second", () => {
    const sys = new SwimmingSystem();
    sys.setMaxBreath(0);
    expect(sys.maxBreath).toBe(1);
  });
});

describe("SwimmingSystem — persistence", () => {
  it("getSaveState captures current state", () => {
    const sys = new SwimmingSystem();
    sys.enterWater();
    const player = makePlayer();
    sys.update(5, player);
    const state = sys.getSaveState();
    expect(state.isSubmerged).toBe(true);
    expect(state.currentBreath).toBeLessThan(state.maxBreath);
    expect(state.maxBreath).toBeGreaterThan(0);
  });

  it("restoreFromSave rehydrates state", () => {
    const sys = new SwimmingSystem();
    sys.restoreFromSave({ currentBreath: 15, maxBreath: 30, isSubmerged: true });
    expect(sys.currentBreath).toBe(15);
    expect(sys.maxBreath).toBe(30);
    expect(sys.isSubmerged).toBe(true);
  });

  it("round-trip: save then restore preserves state", () => {
    const original = new SwimmingSystem();
    original.enterWater();
    const player = makePlayer();
    original.update(10, player);
    const state = original.getSaveState();

    const restored = new SwimmingSystem();
    restored.restoreFromSave(state);
    expect(restored.currentBreath).toBeCloseTo(original.currentBreath);
    expect(restored.maxBreath).toBe(original.maxBreath);
    expect(restored.isSubmerged).toBe(original.isSubmerged);
  });

  it("restoreFromSave clamps currentBreath to maxBreath", () => {
    const sys = new SwimmingSystem();
    sys.restoreFromSave({ currentBreath: 999, maxBreath: 30, isSubmerged: false });
    expect(sys.currentBreath).toBe(30);
  });

  it("restoreFromSave clamps currentBreath minimum to 0", () => {
    const sys = new SwimmingSystem();
    sys.restoreFromSave({ currentBreath: -5, maxBreath: 30, isSubmerged: false });
    expect(sys.currentBreath).toBe(0);
  });
});
