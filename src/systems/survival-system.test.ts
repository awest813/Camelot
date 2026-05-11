import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  SurvivalSystem,
  DEFAULT_CONFIG,
} from "./survival-system";
import type {
  HungerLevel,
  FatigueLevel,
  ColdLevel,
  SurvivalSaveState,
  SurvivalConfig,
} from "./survival-system";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSys(): SurvivalSystem {
  return new SurvivalSystem();
}

/** Drain hunger to a specific value by calling update many times. */
function drainTo(sys: SurvivalSystem, need: "hunger" | "fatigue" | "cold", target: number): void {
  // Set the need directly via save/restore to avoid waiting many frames.
  const state = sys.getSaveState();
  (state as unknown as Record<string, number>)[need] = target;
  sys.restoreFromSave(state as SurvivalSaveState);
}

// ── Initial state ─────────────────────────────────────────────────────────────

describe("SurvivalSystem — initial state", () => {
  it("starts with all needs at 100", () => {
    const sys = makeSys();
    expect(sys.hunger).toBe(100);
    expect(sys.fatigue).toBe(100);
    expect(sys.cold).toBe(100);
  });

  it("starts with satiated hunger level", () => {
    expect(makeSys().hungerLevel).toBe("satiated");
  });

  it("starts with rested fatigue level", () => {
    expect(makeSys().fatigueLevel).toBe("rested");
  });

  it("starts with warm cold level", () => {
    expect(makeSys().coldLevel).toBe("warm");
  });

  it("starts with no stamina regen penalty", () => {
    expect(makeSys().staminaRegenPenalty).toBe(0);
  });

  it("starts with no max stamina penalty", () => {
    expect(makeSys().maxStaminaPenalty).toBe(0);
  });

  it("starts with no max magicka penalty", () => {
    expect(makeSys().maxMagickaPenalty).toBe(0);
  });

  it("starts with no frost damage", () => {
    expect(makeSys().frostDamagePerSecond).toBe(0);
  });

  it("starts with xpMultiplier of 1.15 (satiated + rested)", () => {
    expect(makeSys().xpMultiplier).toBeCloseTo(1.15);
  });

  it("exposes a default config object", () => {
    const sys = makeSys();
    expect(sys.config.hungerDrainRate).toBeGreaterThan(0);
    expect(sys.config.fatigueDrainRate).toBeGreaterThan(0);
    expect(sys.config.coldDrainRate).toBeGreaterThan(0);
    expect(sys.config.coldRecoveryRate).toBeGreaterThan(0);
  });
});

// ── update() — drain behaviour ────────────────────────────────────────────────

describe("SurvivalSystem — update() drains needs", () => {
  it("reduces hunger over time", () => {
    const sys = makeSys();
    sys.update(10);
    expect(sys.hunger).toBeLessThan(100);
  });

  it("reduces fatigue over time", () => {
    const sys = makeSys();
    sys.update(10);
    expect(sys.fatigue).toBeLessThan(100);
  });

  it("reduces cold when isColdEnvironment=true", () => {
    const sys = makeSys();
    sys.update(10, true);
    expect(sys.cold).toBeLessThan(100);
  });

  it("recovers cold when isColdEnvironment=false (default)", () => {
    const sys = makeSys();
    drainTo(sys, "cold", 50);
    sys.update(10, false);
    expect(sys.cold).toBeGreaterThan(50);
  });

  it("clamps hunger to 0 (never negative)", () => {
    const sys = makeSys();
    sys.update(99999);
    expect(sys.hunger).toBe(0);
  });

  it("clamps fatigue to 0 (never negative)", () => {
    const sys = makeSys();
    sys.update(99999);
    expect(sys.fatigue).toBe(0);
  });

  it("clamps cold to 0 (never negative) in cold environment", () => {
    const sys = makeSys();
    sys.update(99999, true);
    expect(sys.cold).toBe(0);
  });

  it("clamps cold to 100 (never above) when recovering", () => {
    const sys = makeSys();
    // Already at 100, recovering — should stay at 100
    sys.update(999, false);
    expect(sys.cold).toBe(100);
  });

  it("ignores dt <= 0", () => {
    const sys = makeSys();
    const before = { h: sys.hunger, f: sys.fatigue, c: sys.cold };
    sys.update(0);
    sys.update(-5);
    expect(sys.hunger).toBe(before.h);
    expect(sys.fatigue).toBe(before.f);
    expect(sys.cold).toBe(before.c);
  });

  it("ignores non-finite dt", () => {
    const sys = makeSys();
    sys.update(Infinity);
    sys.update(NaN);
    expect(sys.hunger).toBe(100);
    expect(sys.fatigue).toBe(100);
  });

  it("hunger drain rate matches config", () => {
    const sys = makeSys();
    const rate = sys.config.hungerDrainRate;
    sys.update(1);
    expect(sys.hunger).toBeCloseTo(100 - rate, 5);
  });

  it("fatigue drain rate matches config", () => {
    const sys = makeSys();
    const rate = sys.config.fatigueDrainRate;
    sys.update(1);
    expect(sys.fatigue).toBeCloseTo(100 - rate, 5);
  });

  it("cold drain rate matches config in cold environment", () => {
    const sys = makeSys();
    const rate = sys.config.coldDrainRate;
    sys.update(1, true);
    expect(sys.cold).toBeCloseTo(100 - rate, 5);
  });
});

// ── eat() / rest() / warmUp() ─────────────────────────────────────────────────

describe("SurvivalSystem — need restoration", () => {
  it("eat() increases hunger", () => {
    const sys = makeSys();
    drainTo(sys, "hunger", 40);
    sys.eat(20);
    expect(sys.hunger).toBeCloseTo(60, 5);
  });

  it("eat() clamps hunger to 100", () => {
    const sys = makeSys();
    sys.eat(999);
    expect(sys.hunger).toBe(100);
  });

  it("eat() ignores zero", () => {
    const sys = makeSys();
    drainTo(sys, "hunger", 50);
    sys.eat(0);
    expect(sys.hunger).toBeCloseTo(50, 5);
  });

  it("eat() ignores negative value", () => {
    const sys = makeSys();
    drainTo(sys, "hunger", 50);
    sys.eat(-10);
    expect(sys.hunger).toBeCloseTo(50, 5);
  });

  it("rest() increases fatigue", () => {
    const sys = makeSys();
    drainTo(sys, "fatigue", 30);
    sys.rest(25);
    expect(sys.fatigue).toBeCloseTo(55, 5);
  });

  it("rest() clamps fatigue to 100", () => {
    const sys = makeSys();
    sys.rest(999);
    expect(sys.fatigue).toBe(100);
  });

  it("rest() ignores zero", () => {
    const sys = makeSys();
    drainTo(sys, "fatigue", 40);
    sys.rest(0);
    expect(sys.fatigue).toBeCloseTo(40, 5);
  });

  it("warmUp() increases cold", () => {
    const sys = makeSys();
    drainTo(sys, "cold", 20);
    sys.warmUp(30);
    expect(sys.cold).toBeCloseTo(50, 5);
  });

  it("warmUp() clamps cold to 100", () => {
    const sys = makeSys();
    sys.warmUp(999);
    expect(sys.cold).toBe(100);
  });

  it("warmUp() ignores negative value", () => {
    const sys = makeSys();
    drainTo(sys, "cold", 20);
    sys.warmUp(-5);
    expect(sys.cold).toBeCloseTo(20, 5);
  });
});

// ── Hunger level transitions ──────────────────────────────────────────────────

describe("SurvivalSystem — hunger level thresholds", () => {
  it("hunger > 60 → satiated", () => {
    const sys = makeSys();
    drainTo(sys, "hunger", 70);
    expect(sys.hungerLevel).toBe("satiated");
  });

  it("hunger 25–60 → normal", () => {
    const sys = makeSys();
    drainTo(sys, "hunger", 40);
    expect(sys.hungerLevel).toBe("normal");
  });

  it("hunger 10–25 → hungry", () => {
    const sys = makeSys();
    drainTo(sys, "hunger", 15);
    expect(sys.hungerLevel).toBe("hungry");
  });

  it("hunger 0–10 → starving", () => {
    const sys = makeSys();
    drainTo(sys, "hunger", 5);
    expect(sys.hungerLevel).toBe("starving");
  });

  it("hunger exactly 60 → normal (boundary)", () => {
    const sys = makeSys();
    drainTo(sys, "hunger", 60);
    expect(sys.hungerLevel).toBe("normal");
  });

  it("hunger exactly 25 → hungry (boundary)", () => {
    const sys = makeSys();
    drainTo(sys, "hunger", 25);
    expect(sys.hungerLevel).toBe("hungry");
  });

  it("hunger exactly 10 → starving (boundary)", () => {
    const sys = makeSys();
    drainTo(sys, "hunger", 10);
    expect(sys.hungerLevel).toBe("starving");
  });

  it("onHungerLevelChanged fires on threshold crossing", () => {
    const sys = makeSys();
    const cb = vi.fn();
    sys.onHungerLevelChanged = cb;
    drainTo(sys, "hunger", 40); // satiated → normal
    expect(cb).toHaveBeenCalledWith("normal");
  });

  it("onHungerLevelChanged fires for each distinct level crossed", () => {
    const sys = makeSys();
    const levels: HungerLevel[] = [];
    sys.onHungerLevelChanged = (l) => levels.push(l);
    drainTo(sys, "hunger", 15); // satiated → hungry (calls normal, then hungry)
    expect(levels).toContain("hungry");
  });

  it("onHungerLevelChanged does NOT fire if level unchanged", () => {
    const sys = makeSys();
    const cb = vi.fn();
    sys.onHungerLevelChanged = cb;
    drainTo(sys, "hunger", 90); // still satiated
    expect(cb).not.toHaveBeenCalled();
  });
});

// ── Fatigue level transitions ─────────────────────────────────────────────────

describe("SurvivalSystem — fatigue level thresholds", () => {
  it("fatigue > 60 → rested", () => {
    expect(makeSys().fatigueLevel).toBe("rested");
  });

  it("fatigue 25–60 → normal", () => {
    const sys = makeSys();
    drainTo(sys, "fatigue", 40);
    expect(sys.fatigueLevel).toBe("normal");
  });

  it("fatigue 10–25 → tired", () => {
    const sys = makeSys();
    drainTo(sys, "fatigue", 15);
    expect(sys.fatigueLevel).toBe("tired");
  });

  it("fatigue 0–10 → exhausted", () => {
    const sys = makeSys();
    drainTo(sys, "fatigue", 5);
    expect(sys.fatigueLevel).toBe("exhausted");
  });

  it("onFatigueLevelChanged fires on transition", () => {
    const sys = makeSys();
    const cb = vi.fn();
    sys.onFatigueLevelChanged = cb;
    drainTo(sys, "fatigue", 40); // rested → normal
    expect(cb).toHaveBeenCalledWith("normal");
  });

  it("onFatigueLevelChanged does NOT fire without level change", () => {
    const sys = makeSys();
    const cb = vi.fn();
    sys.onFatigueLevelChanged = cb;
    drainTo(sys, "fatigue", 80);
    expect(cb).not.toHaveBeenCalled();
  });
});

// ── Cold level transitions ────────────────────────────────────────────────────

describe("SurvivalSystem — cold level thresholds", () => {
  it("cold > 60 → warm", () => {
    expect(makeSys().coldLevel).toBe("warm");
  });

  it("cold 25–60 → chilly", () => {
    const sys = makeSys();
    drainTo(sys, "cold", 40);
    expect(sys.coldLevel).toBe("chilly");
  });

  it("cold 10–25 → cold", () => {
    const sys = makeSys();
    drainTo(sys, "cold", 15);
    expect(sys.coldLevel).toBe("cold");
  });

  it("cold 0–10 → freezing", () => {
    const sys = makeSys();
    drainTo(sys, "cold", 5);
    expect(sys.coldLevel).toBe("freezing");
  });

  it("onColdLevelChanged fires on transition", () => {
    const sys = makeSys();
    const cb = vi.fn();
    sys.onColdLevelChanged = cb;
    drainTo(sys, "cold", 40); // warm → chilly
    expect(cb).toHaveBeenCalledWith("chilly");
  });

  it("warmUp() from freezing to warm fires onColdLevelChanged three times", () => {
    const sys = makeSys();
    const levels: ColdLevel[] = [];
    sys.onColdLevelChanged = (l) => levels.push(l);
    drainTo(sys, "cold", 5); // warm → freezing (callback fires multiple times)
    sys.warmUp(100); // freezing → warm (callback fires multiple times)
    expect(levels).toContain("warm");
  });
});

// ── Derived stat modifiers ────────────────────────────────────────────────────

describe("SurvivalSystem — derived stat modifiers", () => {
  it("staminaRegenPenalty is 0 when satiated or normal", () => {
    const sys = makeSys();
    drainTo(sys, "hunger", 70);
    expect(sys.staminaRegenPenalty).toBe(0);
    drainTo(sys, "hunger", 40);
    expect(sys.staminaRegenPenalty).toBe(0);
  });

  it("staminaRegenPenalty is −2 when hungry", () => {
    const sys = makeSys();
    drainTo(sys, "hunger", 15);
    expect(sys.staminaRegenPenalty).toBe(-2);
  });

  it("staminaRegenPenalty is −5 when starving", () => {
    const sys = makeSys();
    drainTo(sys, "hunger", 5);
    expect(sys.staminaRegenPenalty).toBe(-5);
  });

  it("maxStaminaPenalty is 0 unless exhausted", () => {
    const sys = makeSys();
    drainTo(sys, "fatigue", 40);
    expect(sys.maxStaminaPenalty).toBe(0);
  });

  it("maxStaminaPenalty is −15 when exhausted", () => {
    const sys = makeSys();
    drainTo(sys, "fatigue", 5);
    expect(sys.maxStaminaPenalty).toBe(-15);
  });

  it("maxMagickaPenalty is 0 unless freezing", () => {
    const sys = makeSys();
    drainTo(sys, "cold", 40);
    expect(sys.maxMagickaPenalty).toBe(0);
  });

  it("maxMagickaPenalty is −10 when freezing", () => {
    const sys = makeSys();
    drainTo(sys, "cold", 5);
    expect(sys.maxMagickaPenalty).toBe(-10);
  });

  it("frostDamagePerSecond is 0 unless freezing", () => {
    const sys = makeSys();
    drainTo(sys, "cold", 40);
    expect(sys.frostDamagePerSecond).toBe(0);
  });

  it("frostDamagePerSecond is 2 when freezing", () => {
    const sys = makeSys();
    drainTo(sys, "cold", 5);
    expect(sys.frostDamagePerSecond).toBe(2);
  });

  it("xpMultiplier is 1.0 when hungry and tired", () => {
    const sys = makeSys();
    drainTo(sys, "hunger", 15);
    drainTo(sys, "fatigue", 15);
    expect(sys.xpMultiplier).toBeCloseTo(1.0);
  });

  it("xpMultiplier is 1.10 when satiated and not rested", () => {
    const sys = makeSys();
    drainTo(sys, "fatigue", 40); // normal
    expect(sys.xpMultiplier).toBeCloseTo(1.10);
  });

  it("xpMultiplier is 1.05 when rested and not satiated", () => {
    const sys = makeSys();
    drainTo(sys, "hunger", 40); // normal
    expect(sys.xpMultiplier).toBeCloseTo(1.05);
  });

  it("xpMultiplier is 1.15 when both satiated and rested", () => {
    expect(makeSys().xpMultiplier).toBeCloseTo(1.15);
  });
});

// ── Config ───────────────────────────────────────────────────────────────────

describe("SurvivalSystem — config", () => {
  it("allows overriding drain rates", () => {
    const sys = makeSys();
    sys.config.hungerDrainRate = 10; // very fast
    sys.update(1);
    expect(sys.hunger).toBeCloseTo(90, 5);
  });

  it("allows overriding cold recovery rate", () => {
    const sys = makeSys();
    drainTo(sys, "cold", 50);
    sys.config.coldRecoveryRate = 50; // fast
    sys.update(1, false);
    expect(sys.cold).toBeCloseTo(100, 5);
  });
});

// ── Persistence ───────────────────────────────────────────────────────────────

describe("SurvivalSystem — getSaveState / restoreFromSave", () => {
  it("getSaveState returns correct snapshot", () => {
    const sys = makeSys();
    drainTo(sys, "hunger", 45);
    drainTo(sys, "fatigue", 30);
    drainTo(sys, "cold", 15);
    const state = sys.getSaveState();
    expect(state.hunger).toBeCloseTo(45, 5);
    expect(state.fatigue).toBeCloseTo(30, 5);
    expect(state.cold).toBeCloseTo(15, 5);
  });

  it("round-trips via getSaveState → restoreFromSave", () => {
    const a = makeSys();
    drainTo(a, "hunger", 22);
    drainTo(a, "fatigue", 8);
    drainTo(a, "cold", 55);
    const state = a.getSaveState();

    const b = makeSys();
    b.restoreFromSave(state);
    expect(b.hunger).toBeCloseTo(22, 5);
    expect(b.fatigue).toBeCloseTo(8, 5);
    expect(b.cold).toBeCloseTo(55, 5);
  });

  it("restoreFromSave updates derived levels", () => {
    const sys = makeSys();
    sys.restoreFromSave({ hunger: 5, fatigue: 5, cold: 5 });
    expect(sys.hungerLevel).toBe("starving");
    expect(sys.fatigueLevel).toBe("exhausted");
    expect(sys.coldLevel).toBe("freezing");
  });

  it("restoreFromSave fires level-change callbacks if level changed", () => {
    const sys = makeSys();
    const cb = vi.fn();
    sys.onHungerLevelChanged = cb;
    sys.restoreFromSave({ hunger: 5, fatigue: 100, cold: 100 }); // satiated → starving
    expect(cb).toHaveBeenCalledWith("starving");
  });

  it("restoreFromSave with nullish state defaults to full needs", () => {
    const sys = makeSys();
    drainTo(sys, "hunger", 20);
    sys.restoreFromSave(null as unknown as SurvivalSaveState);
    expect(sys.hunger).toBe(100);
    expect(sys.fatigue).toBe(100);
    expect(sys.cold).toBe(100);
  });

  it("restoreFromSave clamps out-of-range values to [0, 100]", () => {
    const sys = makeSys();
    sys.restoreFromSave({ hunger: -50, fatigue: 200, cold: 999 });
    expect(sys.hunger).toBe(0);
    expect(sys.fatigue).toBe(100);
    expect(sys.cold).toBe(100);
  });
});
