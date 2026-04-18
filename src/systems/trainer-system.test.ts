import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  TrainerSystem,
  BUILT_IN_TRAINERS,
} from "./trainer-system";
import type {
  TrainerDefinition,
  TrainerSaveState,
} from "./trainer-system";

// ── Fixture helpers ───────────────────────────────────────────────────────────

function makeTrainer(overrides: Partial<TrainerDefinition> = {}): TrainerDefinition {
  return {
    id: "trainer_test",
    name: "Test Trainer",
    skillId: "blade",
    maxLevel: 50,
    baseCost: 30,
    costPerLevel: 5,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("TrainerSystem — initial state", () => {
  it("starts with zero sessions this level", () => {
    const sys = new TrainerSystem();
    expect(sys.sessionsThisLevel).toBe(0);
  });

  it("starts with default maxSessionsPerLevel of 5", () => {
    const sys = new TrainerSystem();
    expect(sys.maxSessionsPerLevel).toBe(5);
  });

  it("starts with all sessionsRemaining available", () => {
    const sys = new TrainerSystem();
    expect(sys.sessionsRemaining).toBe(5);
  });

  it("pre-registers all built-in trainers", () => {
    const sys = new TrainerSystem();
    for (const def of BUILT_IN_TRAINERS) {
      expect(sys.getTrainer(def.id)).toBeDefined();
    }
  });
});

describe("TrainerSystem — registerTrainer / removeTrainer / getTrainer", () => {
  it("registers a new trainer", () => {
    const sys = new TrainerSystem();
    const def = makeTrainer({ id: "trainer_custom" });
    sys.registerTrainer(def);
    expect(sys.getTrainer("trainer_custom")).toBeDefined();
  });

  it("registerTrainer overwrites existing definition", () => {
    const sys = new TrainerSystem();
    const def = makeTrainer({ id: "trainer_custom", baseCost: 10 });
    sys.registerTrainer(def);
    sys.registerTrainer({ ...def, baseCost: 999 });
    expect(sys.getTrainer("trainer_custom")!.baseCost).toBe(999);
  });

  it("getTrainer returns undefined for unknown id", () => {
    const sys = new TrainerSystem();
    expect(sys.getTrainer("no_such_trainer")).toBeUndefined();
  });

  it("removeTrainer returns true when trainer existed", () => {
    const sys = new TrainerSystem();
    sys.registerTrainer(makeTrainer({ id: "trainer_del" }));
    expect(sys.removeTrainer("trainer_del")).toBe(true);
  });

  it("removeTrainer returns false for unknown trainer", () => {
    const sys = new TrainerSystem();
    expect(sys.removeTrainer("no_such_trainer")).toBe(false);
  });

  it("removed trainer is no longer returned by getTrainer", () => {
    const sys = new TrainerSystem();
    sys.registerTrainer(makeTrainer({ id: "trainer_gone" }));
    sys.removeTrainer("trainer_gone");
    expect(sys.getTrainer("trainer_gone")).toBeUndefined();
  });
});

describe("TrainerSystem — getAllTrainers / getTrainersForSkill", () => {
  it("getAllTrainers includes registered trainers", () => {
    const sys = new TrainerSystem();
    sys.registerTrainer(makeTrainer({ id: "trainer_extra", skillId: "sneak" }));
    const ids = sys.getAllTrainers().map(t => t.id);
    expect(ids).toContain("trainer_extra");
  });

  it("getTrainersForSkill returns only trainers for that skill", () => {
    const sys = new TrainerSystem();
    sys.registerTrainer(makeTrainer({ id: "t_blade_1", skillId: "blade" }));
    sys.registerTrainer(makeTrainer({ id: "t_sneak_1", skillId: "sneak" }));
    const bladeTrainers = sys.getTrainersForSkill("blade");
    expect(bladeTrainers.every(t => t.skillId === "blade")).toBe(true);
    expect(bladeTrainers.map(t => t.id)).toContain("t_blade_1");
    expect(bladeTrainers.map(t => t.id)).not.toContain("t_sneak_1");
  });

  it("getTrainersForSkill returns empty array when no trainers for skill", () => {
    const sys = new TrainerSystem();
    // Remove all default trainers to isolate
    for (const t of BUILT_IN_TRAINERS) sys.removeTrainer(t.id);
    expect(sys.getTrainersForSkill("block")).toHaveLength(0);
  });
});

describe("TrainerSystem — getCost()", () => {
  it("returns null for unknown trainer", () => {
    const sys = new TrainerSystem();
    expect(sys.getCost("no_trainer", 10)).toBeNull();
  });

  it("returns baseCost when skill level is 0", () => {
    const sys = new TrainerSystem();
    sys.registerTrainer(makeTrainer({ id: "t", baseCost: 30, costPerLevel: 5 }));
    expect(sys.getCost("t", 0)).toBe(30);
  });

  it("adds costPerLevel × currentLevel to baseCost", () => {
    const sys = new TrainerSystem();
    sys.registerTrainer(makeTrainer({ id: "t", baseCost: 30, costPerLevel: 5 }));
    expect(sys.getCost("t", 10)).toBe(30 + 10 * 5);
  });

  it("negative currentSkillLevel is treated as 0 for cost calculation", () => {
    const sys = new TrainerSystem();
    sys.registerTrainer(makeTrainer({ id: "t", baseCost: 30, costPerLevel: 5 }));
    expect(sys.getCost("t", -5)).toBe(30);
  });
});

describe("TrainerSystem — canTrain()", () => {
  it("returns canTrain true when all conditions met", () => {
    const sys = new TrainerSystem();
    sys.registerTrainer(makeTrainer({ id: "t", maxLevel: 50, baseCost: 30, costPerLevel: 5 }));
    const result = sys.canTrain("t", 20, 1000);
    expect(result.canTrain).toBe(true);
    expect(result.cost).toBe(30 + 20 * 5);
  });

  it("returns unknown_trainer when trainer id not registered", () => {
    const sys = new TrainerSystem();
    const result = sys.canTrain("ghost", 10, 500);
    expect(result.canTrain).toBe(false);
    expect(result.reason).toBe("unknown_trainer");
    expect(result.cost).toBeNull();
  });

  it("returns skill_at_cap when player skill >= trainer maxLevel", () => {
    const sys = new TrainerSystem();
    sys.registerTrainer(makeTrainer({ id: "t", maxLevel: 50 }));
    const result = sys.canTrain("t", 50, 1000);
    expect(result.canTrain).toBe(false);
    expect(result.reason).toBe("skill_at_cap");
  });

  it("returns skill_at_cap when skill is above maxLevel", () => {
    const sys = new TrainerSystem();
    sys.registerTrainer(makeTrainer({ id: "t", maxLevel: 50 }));
    const result = sys.canTrain("t", 75, 1000);
    expect(result.canTrain).toBe(false);
    expect(result.reason).toBe("skill_at_cap");
  });

  it("returns session_limit_reached when all sessions are used", () => {
    const sys = new TrainerSystem();
    sys.registerTrainer(makeTrainer({ id: "t", maxLevel: 100, baseCost: 10, costPerLevel: 1 }));
    // Exhaust sessions
    for (let i = 0; i < sys.maxSessionsPerLevel; i++) {
      sys.train("t", i, 10000);
    }
    const result = sys.canTrain("t", sys.maxSessionsPerLevel, 10000);
    expect(result.canTrain).toBe(false);
    expect(result.reason).toBe("session_limit_reached");
  });

  it("returns insufficient_gold when player cannot afford", () => {
    const sys = new TrainerSystem();
    sys.registerTrainer(makeTrainer({ id: "t", maxLevel: 50, baseCost: 100, costPerLevel: 0 }));
    const result = sys.canTrain("t", 10, 50);
    expect(result.canTrain).toBe(false);
    expect(result.reason).toBe("insufficient_gold");
    expect(result.cost).toBe(100);
  });

  it("is non-mutating — does not increment sessions", () => {
    const sys = new TrainerSystem();
    sys.registerTrainer(makeTrainer({ id: "t", maxLevel: 100, baseCost: 10, costPerLevel: 0 }));
    sys.canTrain("t", 5, 1000);
    sys.canTrain("t", 5, 1000);
    expect(sys.sessionsThisLevel).toBe(0);
  });
});

describe("TrainerSystem — train()", () => {
  it("returns success with newLevel and goldSpent", () => {
    const sys = new TrainerSystem();
    sys.registerTrainer(makeTrainer({ id: "t", maxLevel: 100, baseCost: 30, costPerLevel: 5 }));
    const result = sys.train("t", 10, 1000);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.newLevel).toBe(11);
      expect(result.goldSpent).toBe(30 + 10 * 5);
    }
  });

  it("increments sessionsThisLevel on success", () => {
    const sys = new TrainerSystem();
    sys.registerTrainer(makeTrainer({ id: "t", maxLevel: 100, baseCost: 10, costPerLevel: 0 }));
    sys.train("t", 5, 1000);
    expect(sys.sessionsThisLevel).toBe(1);
  });

  it("fires onTrainingComplete callback on success", () => {
    const sys = new TrainerSystem();
    sys.registerTrainer(makeTrainer({ id: "t", skillId: "sneak", maxLevel: 100, baseCost: 20, costPerLevel: 2 }));
    const cb = vi.fn();
    sys.onTrainingComplete = cb;
    sys.train("t", 15, 500);
    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith("t", "sneak", 16, 20 + 15 * 2);
  });

  it("returns failure for unknown trainer", () => {
    const sys = new TrainerSystem();
    const result = sys.train("ghost", 5, 1000);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.reason).toBe("unknown_trainer");
  });

  it("returns failure when skill at trainer cap", () => {
    const sys = new TrainerSystem();
    sys.registerTrainer(makeTrainer({ id: "t", maxLevel: 30 }));
    const result = sys.train("t", 30, 1000);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.reason).toBe("skill_at_cap");
  });

  it("returns failure when session limit reached", () => {
    const sys = new TrainerSystem();
    sys.registerTrainer(makeTrainer({ id: "t", maxLevel: 100, baseCost: 10, costPerLevel: 1 }));
    for (let i = 0; i < sys.maxSessionsPerLevel; i++) {
      sys.train("t", i, 10000);
    }
    const result = sys.train("t", 5, 10000);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.reason).toBe("session_limit_reached");
  });

  it("does not fire callback on failure", () => {
    const sys = new TrainerSystem();
    const cb = vi.fn();
    sys.onTrainingComplete = cb;
    sys.train("ghost", 5, 1000);
    expect(cb).not.toHaveBeenCalled();
  });

  it("does not increment sessions on failure", () => {
    const sys = new TrainerSystem();
    sys.train("ghost", 5, 1000);
    expect(sys.sessionsThisLevel).toBe(0);
  });
});

describe("TrainerSystem — sessionsRemaining", () => {
  it("decreases after each successful training", () => {
    const sys = new TrainerSystem();
    sys.registerTrainer(makeTrainer({ id: "t", maxLevel: 100, baseCost: 10, costPerLevel: 0 }));
    expect(sys.sessionsRemaining).toBe(5);
    sys.train("t", 0, 100);
    expect(sys.sessionsRemaining).toBe(4);
    sys.train("t", 1, 100);
    expect(sys.sessionsRemaining).toBe(3);
  });

  it("never goes below 0", () => {
    const sys = new TrainerSystem();
    sys.registerTrainer(makeTrainer({ id: "t", maxLevel: 100, baseCost: 1, costPerLevel: 0 }));
    for (let i = 0; i < 10; i++) sys.train("t", i, 100);
    expect(sys.sessionsRemaining).toBe(0);
  });
});

describe("TrainerSystem — onCharacterLevelUp()", () => {
  it("resets sessionsThisLevel to 0", () => {
    const sys = new TrainerSystem();
    sys.registerTrainer(makeTrainer({ id: "t", maxLevel: 100, baseCost: 10, costPerLevel: 0 }));
    sys.train("t", 0, 100);
    sys.train("t", 1, 100);
    sys.onCharacterLevelUp();
    expect(sys.sessionsThisLevel).toBe(0);
  });

  it("restores sessionsRemaining to full", () => {
    const sys = new TrainerSystem();
    sys.registerTrainer(makeTrainer({ id: "t", maxLevel: 100, baseCost: 10, costPerLevel: 0 }));
    for (let i = 0; i < sys.maxSessionsPerLevel; i++) sys.train("t", i, 100);
    sys.onCharacterLevelUp();
    expect(sys.sessionsRemaining).toBe(sys.maxSessionsPerLevel);
  });

  it("allows training again after level-up", () => {
    const sys = new TrainerSystem();
    sys.registerTrainer(makeTrainer({ id: "t", maxLevel: 100, baseCost: 10, costPerLevel: 0 }));
    for (let i = 0; i < sys.maxSessionsPerLevel; i++) sys.train("t", i, 100);
    sys.onCharacterLevelUp();
    const result = sys.train("t", sys.maxSessionsPerLevel, 10000);
    expect(result.success).toBe(true);
  });
});

describe("TrainerSystem — maxSessionsPerLevel configuration", () => {
  it("custom maxSessionsPerLevel limits sessions", () => {
    const sys = new TrainerSystem();
    sys.maxSessionsPerLevel = 2;
    sys.registerTrainer(makeTrainer({ id: "t", maxLevel: 100, baseCost: 10, costPerLevel: 0 }));
    sys.train("t", 0, 100);
    sys.train("t", 1, 100);
    const result = sys.train("t", 2, 100);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.reason).toBe("session_limit_reached");
  });
});

describe("TrainerSystem — getSaveState() / restoreFromSave()", () => {
  it("getSaveState returns sessions and limit", () => {
    const sys = new TrainerSystem();
    sys.registerTrainer(makeTrainer({ id: "t", maxLevel: 100, baseCost: 10, costPerLevel: 0 }));
    sys.train("t", 0, 100);
    sys.train("t", 1, 100);
    const state = sys.getSaveState();
    expect(state.sessionsThisLevel).toBe(2);
    expect(state.maxSessionsPerLevel).toBe(5);
  });

  it("restoreFromSave restores session count and limit", () => {
    const sys = new TrainerSystem();
    const savedState: TrainerSaveState = { sessionsThisLevel: 3, maxSessionsPerLevel: 7 };
    sys.restoreFromSave(savedState);
    expect(sys.sessionsThisLevel).toBe(3);
    expect(sys.maxSessionsPerLevel).toBe(7);
    expect(sys.sessionsRemaining).toBe(4);
  });

  it("restoreFromSave clamps sessionsThisLevel to min 0", () => {
    const sys = new TrainerSystem();
    sys.restoreFromSave({ sessionsThisLevel: -5, maxSessionsPerLevel: 5 });
    expect(sys.sessionsThisLevel).toBe(0);
  });

  it("restoreFromSave clamps maxSessionsPerLevel to min 1", () => {
    const sys = new TrainerSystem();
    sys.restoreFromSave({ sessionsThisLevel: 0, maxSessionsPerLevel: 0 });
    expect(sys.maxSessionsPerLevel).toBe(1);
  });

  it("restoreFromSave does NOT fire callbacks", () => {
    const sys = new TrainerSystem();
    const cb = vi.fn();
    sys.onTrainingComplete = cb;
    sys.restoreFromSave({ sessionsThisLevel: 3, maxSessionsPerLevel: 5 });
    expect(cb).not.toHaveBeenCalled();
  });

  it("round-trip save/restore preserves session count", () => {
    const sys = new TrainerSystem();
    sys.registerTrainer(makeTrainer({ id: "t", maxLevel: 100, baseCost: 10, costPerLevel: 0 }));
    sys.train("t", 0, 100);
    sys.train("t", 1, 100);
    const state = sys.getSaveState();

    const restored = new TrainerSystem();
    restored.restoreFromSave(state);
    expect(restored.sessionsThisLevel).toBe(2);
    expect(restored.sessionsRemaining).toBe(3);
  });

  it("training blocked after restore with exhausted sessions", () => {
    const sys = new TrainerSystem();
    sys.registerTrainer(makeTrainer({ id: "t", maxLevel: 100, baseCost: 10, costPerLevel: 0 }));
    sys.restoreFromSave({ sessionsThisLevel: 5, maxSessionsPerLevel: 5 });
    const result = sys.train("t", 5, 1000);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.reason).toBe("session_limit_reached");
  });
});

describe("TrainerSystem — built-in trainer sanity", () => {
  it("blade master maxLevel is 50", () => {
    const sys = new TrainerSystem();
    expect(sys.getTrainer("trainer_blade_master")!.maxLevel).toBe(50);
  });

  it("grand blade master maxLevel is 100", () => {
    const sys = new TrainerSystem();
    expect(sys.getTrainer("trainer_grand_blade_master")!.maxLevel).toBe(100);
  });

  it("archmage teaches destruction skill", () => {
    const sys = new TrainerSystem();
    expect(sys.getTrainer("trainer_archmage")!.skillId).toBe("destruction");
  });

  it("training with blade master raises blade skill", () => {
    const sys = new TrainerSystem();
    const cb = vi.fn();
    sys.onTrainingComplete = cb;
    sys.train("trainer_blade_master", 10, 10000);
    expect(cb).toHaveBeenCalledWith("trainer_blade_master", "blade", 11, expect.any(Number));
  });
});
