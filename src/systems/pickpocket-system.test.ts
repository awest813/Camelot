import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PickpocketSystem,
  MIN_SUCCESS_CHANCE,
  MAX_SUCCESS_CHANCE,
  CAUGHT_THRESHOLD,
  SNEAK_XP_PER_PICKPOCKET,
  WEIGHT_PENALTY,
  VALUE_DIVISOR,
} from "./pickpocket-system";
import type {
  PickpocketableItem,
  PickpocketSaveState,
} from "./pickpocket-system";

// ── Fixture helpers ───────────────────────────────────────────────────────────

function makeItem(overrides: Partial<PickpocketableItem> = {}): PickpocketableItem {
  return {
    id:     "test_item",
    name:   "Test Item",
    weight: 1,
    value:  10,
    ...overrides,
  };
}

function alwaysSuccess(): () => number {
  return () => 0; // roll 0 always succeeds
}

function alwaysFail(): () => number {
  return () => 100; // roll 100 always fails
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("PickpocketSystem — initial state", () => {
  it("starts with zero attempts, successes, and caught", () => {
    const sys = new PickpocketSystem();
    expect(sys.totalAttempts).toBe(0);
    expect(sys.totalSuccesses).toBe(0);
    expect(sys.totalCaught).toBe(0);
  });

  it("starts with no registered NPCs", () => {
    const sys = new PickpocketSystem();
    expect(sys.registeredNpcIds).toHaveLength(0);
  });
});

describe("PickpocketSystem — registerNpcInventory / removeNpcInventory / getNpcInventory", () => {
  it("registers an NPC inventory", () => {
    const sys = new PickpocketSystem();
    sys.registerNpcInventory("npc_01", [makeItem()]);
    expect(sys.registeredNpcIds).toContain("npc_01");
  });

  it("getNpcInventory returns a defensive copy", () => {
    const sys = new PickpocketSystem();
    const original = [makeItem({ id: "ring" })];
    sys.registerNpcInventory("npc_01", original);
    const copy = sys.getNpcInventory("npc_01");
    expect(copy).not.toBe(original);
    expect(copy).toHaveLength(1);
    expect(copy![0].id).toBe("ring");
  });

  it("getNpcInventory returns undefined for unknown NPC", () => {
    const sys = new PickpocketSystem();
    expect(sys.getNpcInventory("no_such_npc")).toBeUndefined();
  });

  it("registerNpcInventory replaces an existing inventory", () => {
    const sys = new PickpocketSystem();
    sys.registerNpcInventory("npc_01", [makeItem({ id: "old_item" })]);
    sys.registerNpcInventory("npc_01", [makeItem({ id: "new_item" })]);
    const inv = sys.getNpcInventory("npc_01")!;
    expect(inv).toHaveLength(1);
    expect(inv[0].id).toBe("new_item");
  });

  it("removeNpcInventory returns true when NPC existed", () => {
    const sys = new PickpocketSystem();
    sys.registerNpcInventory("npc_01", [makeItem()]);
    expect(sys.removeNpcInventory("npc_01")).toBe(true);
    expect(sys.getNpcInventory("npc_01")).toBeUndefined();
  });

  it("removeNpcInventory returns false for unknown NPC", () => {
    const sys = new PickpocketSystem();
    expect(sys.removeNpcInventory("no_such_npc")).toBe(false);
  });

  it("stores a defensive copy of the item array", () => {
    const sys = new PickpocketSystem();
    const arr = [makeItem()];
    sys.registerNpcInventory("npc_01", arr);
    arr.push(makeItem({ id: "extra" }));
    expect(sys.getNpcInventory("npc_01")).toHaveLength(1);
  });
});

describe("PickpocketSystem — getSuccessChance", () => {
  it("returns null for unknown NPC", () => {
    const sys = new PickpocketSystem();
    expect(sys.getSuccessChance("no_npc", "item", 50)).toBeNull();
  });

  it("returns null for unknown item", () => {
    const sys = new PickpocketSystem();
    sys.registerNpcInventory("npc_01", [makeItem({ id: "known_item" })]);
    expect(sys.getSuccessChance("npc_01", "unknown_item", 50)).toBeNull();
  });

  it("returns a value within [MIN_SUCCESS_CHANCE, MAX_SUCCESS_CHANCE]", () => {
    const sys = new PickpocketSystem();
    sys.registerNpcInventory("npc_01", [makeItem({ weight: 0, value: 0 })]);
    const chance = sys.getSuccessChance("npc_01", "test_item", 50, 0);
    expect(chance).toBeGreaterThanOrEqual(MIN_SUCCESS_CHANCE);
    expect(chance).toBeLessThanOrEqual(MAX_SUCCESS_CHANCE);
  });

  it("floors at MIN_SUCCESS_CHANCE when conditions are extremely bad", () => {
    const sys = new PickpocketSystem();
    sys.registerNpcInventory("npc_01", [makeItem({ weight: 100, value: 1000 })]);
    const chance = sys.getSuccessChance("npc_01", "test_item", 0, 100);
    expect(chance).toBe(MIN_SUCCESS_CHANCE);
  });

  it("caps at MAX_SUCCESS_CHANCE when conditions are extremely good", () => {
    const sys = new PickpocketSystem();
    sys.registerNpcInventory("npc_01", [makeItem({ weight: 0, value: 0 })]);
    const chance = sys.getSuccessChance("npc_01", "test_item", 100, 0);
    expect(chance).toBe(MAX_SUCCESS_CHANCE);
  });

  it("heavier items have a lower success chance than lighter items", () => {
    const sys = new PickpocketSystem();
    sys.registerNpcInventory("npc_01", [
      makeItem({ id: "light", weight: 0, value: 0 }),
      makeItem({ id: "heavy", weight: 10, value: 0 }),
    ]);
    const light = sys.getSuccessChance("npc_01", "light", 50, 0)!;
    const heavy = sys.getSuccessChance("npc_01", "heavy", 50, 0)!;
    expect(light).toBeGreaterThan(heavy);
  });

  it("higher-value items have a lower success chance", () => {
    const sys = new PickpocketSystem();
    sys.registerNpcInventory("npc_01", [
      makeItem({ id: "cheap", weight: 0, value: 0 }),
      makeItem({ id: "expensive", weight: 0, value: 100 }),
    ]);
    const cheap     = sys.getSuccessChance("npc_01", "cheap",     50, 0)!;
    const expensive = sys.getSuccessChance("npc_01", "expensive", 50, 0)!;
    expect(cheap).toBeGreaterThan(expensive);
  });

  it("higher NPC awareness reduces success chance", () => {
    const sys = new PickpocketSystem();
    sys.registerNpcInventory("npc_01", [makeItem({ weight: 0, value: 0 })]);
    const low  = sys.getSuccessChance("npc_01", "test_item", 50, 10)!;
    const high = sys.getSuccessChance("npc_01", "test_item", 50, 80)!;
    expect(low).toBeGreaterThan(high);
  });

  it("uses default npcAwareness of 30 when omitted", () => {
    const sys = new PickpocketSystem();
    sys.registerNpcInventory("npc_01", [makeItem({ weight: 0, value: 0 })]);
    const explicit = sys.getSuccessChance("npc_01", "test_item", 50, 30)!;
    const implicit = sys.getSuccessChance("npc_01", "test_item", 50)!;
    expect(explicit).toBe(implicit);
  });
});

describe("PickpocketSystem — canAttempt", () => {
  it("returns unknown_npc for unregistered NPC", () => {
    const sys = new PickpocketSystem();
    const result = sys.canAttempt("no_npc", true, false);
    expect(result.canAttempt).toBe(false);
    expect(result.reason).toBe("unknown_npc");
  });

  it("returns not_crouching when player is standing", () => {
    const sys = new PickpocketSystem();
    sys.registerNpcInventory("npc_01", [makeItem()]);
    const result = sys.canAttempt("npc_01", false, false);
    expect(result.canAttempt).toBe(false);
    expect(result.reason).toBe("not_crouching");
  });

  it("returns already_detected when isDetected is true", () => {
    const sys = new PickpocketSystem();
    sys.registerNpcInventory("npc_01", [makeItem()]);
    const result = sys.canAttempt("npc_01", true, true);
    expect(result.canAttempt).toBe(false);
    expect(result.reason).toBe("already_detected");
  });

  it("returns empty_inventory when NPC has no items", () => {
    const sys = new PickpocketSystem();
    sys.registerNpcInventory("npc_01", []);
    const result = sys.canAttempt("npc_01", true, false);
    expect(result.canAttempt).toBe(false);
    expect(result.reason).toBe("empty_inventory");
  });

  it("returns unknown_item when itemId does not exist", () => {
    const sys = new PickpocketSystem();
    sys.registerNpcInventory("npc_01", [makeItem({ id: "known" })]);
    const result = sys.canAttempt("npc_01", true, false, "no_such_item");
    expect(result.canAttempt).toBe(false);
    expect(result.reason).toBe("unknown_item");
  });

  it("returns canAttempt=true with successChance when all gates pass", () => {
    const sys = new PickpocketSystem();
    sys.registerNpcInventory("npc_01", [makeItem({ weight: 0, value: 0 })]);
    const result = sys.canAttempt("npc_01", true, false, "test_item", 50, 30);
    expect(result.canAttempt).toBe(true);
    expect(result.successChance).not.toBeNull();
  });

  it("returns null successChance when not crouching (non-item gate)", () => {
    const sys = new PickpocketSystem();
    sys.registerNpcInventory("npc_01", [makeItem()]);
    const result = sys.canAttempt("npc_01", false, false, "test_item");
    expect(result.successChance).toBeNull();
  });
});

describe("PickpocketSystem — attempt (success paths)", () => {
  it("returns success result when roll is below chance", () => {
    const sys = new PickpocketSystem();
    sys.registerNpcInventory("npc_01", [makeItem({ weight: 0, value: 0 })]);
    const result = sys.attempt("npc_01", "test_item", 100, 0, true, false, alwaysSuccess());
    expect(result.success).toBe(true);
  });

  it("removes item from NPC inventory on success", () => {
    const sys = new PickpocketSystem();
    sys.registerNpcInventory("npc_01", [makeItem()]);
    sys.attempt("npc_01", "test_item", 100, 0, true, false, alwaysSuccess());
    expect(sys.getNpcInventory("npc_01")).toHaveLength(0);
  });

  it("increments totalAttempts and totalSuccesses on success", () => {
    const sys = new PickpocketSystem();
    sys.registerNpcInventory("npc_01", [makeItem({ weight: 0, value: 0 })]);
    sys.attempt("npc_01", "test_item", 100, 0, true, false, alwaysSuccess());
    expect(sys.totalAttempts).toBe(1);
    expect(sys.totalSuccesses).toBe(1);
  });

  it("returns sneakXpAwarded = SNEAK_XP_PER_PICKPOCKET on success", () => {
    const sys = new PickpocketSystem();
    sys.registerNpcInventory("npc_01", [makeItem({ weight: 0, value: 0 })]);
    const result = sys.attempt("npc_01", "test_item", 100, 0, true, false, alwaysSuccess());
    if (result.success) {
      expect(result.sneakXpAwarded).toBe(SNEAK_XP_PER_PICKPOCKET);
    }
  });

  it("fires onPickpocketSuccess callback", () => {
    const sys = new PickpocketSystem();
    const cb = vi.fn();
    sys.onPickpocketSuccess = cb;
    sys.registerNpcInventory("npc_01", [makeItem({ weight: 0, value: 0 })]);
    sys.attempt("npc_01", "test_item", 100, 0, true, false, alwaysSuccess());
    expect(cb).toHaveBeenCalledWith("npc_01", "test_item", SNEAK_XP_PER_PICKPOCKET);
  });

  it("does not fire onPickpocketFailed or onCaught on success", () => {
    const sys = new PickpocketSystem();
    const failCb  = vi.fn();
    const caughtCb = vi.fn();
    sys.onPickpocketFailed = failCb;
    sys.onCaught           = caughtCb;
    sys.registerNpcInventory("npc_01", [makeItem({ weight: 0, value: 0 })]);
    sys.attempt("npc_01", "test_item", 100, 0, true, false, alwaysSuccess());
    expect(failCb).not.toHaveBeenCalled();
    expect(caughtCb).not.toHaveBeenCalled();
  });
});

describe("PickpocketSystem — attempt (failure paths)", () => {
  it("returns failure result when roll is above chance", () => {
    const sys = new PickpocketSystem();
    sys.registerNpcInventory("npc_01", [makeItem({ weight: 100, value: 1000 })]);
    const result = sys.attempt("npc_01", "test_item", 0, 100, true, false, alwaysFail());
    expect(result.success).toBe(false);
  });

  it("increments totalAttempts but not totalSuccesses on failure", () => {
    const sys = new PickpocketSystem();
    sys.registerNpcInventory("npc_01", [makeItem({ weight: 100, value: 1000 })]);
    sys.attempt("npc_01", "test_item", 0, 100, true, false, alwaysFail());
    expect(sys.totalAttempts).toBe(1);
    expect(sys.totalSuccesses).toBe(0);
  });

  it("player is caught when chance < CAUGHT_THRESHOLD and roll fails", () => {
    // force success chance to be low (< 50) by using very heavy/valuable item
    const sys = new PickpocketSystem();
    sys.registerNpcInventory("npc_01", [makeItem({ weight: 10, value: 500 })]);
    const result = sys.attempt("npc_01", "test_item", 0, 100, true, false, alwaysFail());
    if (!result.success) {
      expect(result.caught).toBe(true);
    }
  });

  it("increments totalCaught when caught", () => {
    const sys = new PickpocketSystem();
    sys.registerNpcInventory("npc_01", [makeItem({ weight: 10, value: 500 })]);
    sys.attempt("npc_01", "test_item", 0, 100, true, false, alwaysFail());
    expect(sys.totalCaught).toBe(1);
  });

  it("fires onCaught when caught", () => {
    const sys = new PickpocketSystem();
    const cb = vi.fn();
    sys.onCaught = cb;
    sys.registerNpcInventory("npc_01", [makeItem({ weight: 10, value: 500 })]);
    sys.attempt("npc_01", "test_item", 0, 100, true, false, alwaysFail());
    expect(cb).toHaveBeenCalledWith("npc_01");
  });

  it("player is not caught when chance >= CAUGHT_THRESHOLD and roll fails", () => {
    // high sneak, low weight/value = high success chance, so failure is gentle
    const sys = new PickpocketSystem();
    sys.registerNpcInventory("npc_01", [makeItem({ weight: 0, value: 0 })]);
    // Force chance above CAUGHT_THRESHOLD by using sneak=100, awareness=0
    // chance = 100*1.5 - 0 - 0 - 0 = 150 → capped at MAX (90) > CAUGHT_THRESHOLD (50)
    const result = sys.attempt("npc_01", "test_item", 100, 0, true, false, alwaysFail());
    if (!result.success) {
      expect(result.caught).toBe(false);
    }
  });

  it("does not fire onCaught when not caught", () => {
    const sys = new PickpocketSystem();
    const cb = vi.fn();
    sys.onCaught = cb;
    sys.registerNpcInventory("npc_01", [makeItem({ weight: 0, value: 0 })]);
    sys.attempt("npc_01", "test_item", 100, 0, true, false, alwaysFail());
    expect(cb).not.toHaveBeenCalled();
  });

  it("fires onPickpocketFailed with caught=false when not caught", () => {
    const sys = new PickpocketSystem();
    const cb = vi.fn();
    sys.onPickpocketFailed = cb;
    sys.registerNpcInventory("npc_01", [makeItem({ weight: 0, value: 0 })]);
    sys.attempt("npc_01", "test_item", 100, 0, true, false, alwaysFail());
    expect(cb).toHaveBeenCalledWith("npc_01", "test_item", false);
  });

  it("fires onPickpocketFailed with caught=true when caught", () => {
    const sys = new PickpocketSystem();
    const cb = vi.fn();
    sys.onPickpocketFailed = cb;
    sys.registerNpcInventory("npc_01", [makeItem({ weight: 10, value: 500 })]);
    sys.attempt("npc_01", "test_item", 0, 100, true, false, alwaysFail());
    expect(cb).toHaveBeenCalledWith("npc_01", "test_item", true);
  });

  it("returns 'not_crouching' reason without incrementing totalAttempts", () => {
    const sys = new PickpocketSystem();
    sys.registerNpcInventory("npc_01", [makeItem()]);
    sys.attempt("npc_01", "test_item", 50, 30, false, false);
    expect(sys.totalAttempts).toBe(0);
  });

  it("returns 'already_detected' reason without incrementing totalAttempts", () => {
    const sys = new PickpocketSystem();
    sys.registerNpcInventory("npc_01", [makeItem()]);
    sys.attempt("npc_01", "test_item", 50, 30, true, true);
    expect(sys.totalAttempts).toBe(0);
  });

  it("item remains in NPC inventory after a failed attempt", () => {
    const sys = new PickpocketSystem();
    sys.registerNpcInventory("npc_01", [makeItem({ weight: 100, value: 1000 })]);
    sys.attempt("npc_01", "test_item", 0, 100, true, false, alwaysFail());
    expect(sys.getNpcInventory("npc_01")).toHaveLength(1);
  });
});

describe("PickpocketSystem — multiple items / NPCs", () => {
  it("tracks attempts across multiple NPCs independently", () => {
    const sys = new PickpocketSystem();
    sys.registerNpcInventory("npc_a", [makeItem({ id: "item_a", weight: 0, value: 0 })]);
    sys.registerNpcInventory("npc_b", [makeItem({ id: "item_b", weight: 0, value: 0 })]);
    sys.attempt("npc_a", "item_a", 100, 0, true, false, alwaysSuccess());
    sys.attempt("npc_b", "item_b", 100, 0, true, false, alwaysSuccess());
    expect(sys.totalAttempts).toBe(2);
    expect(sys.totalSuccesses).toBe(2);
  });

  it("only removes the stolen item, leaving others in place", () => {
    const sys = new PickpocketSystem();
    sys.registerNpcInventory("npc_01", [
      makeItem({ id: "ring",    weight: 0, value: 0 }),
      makeItem({ id: "potion", weight: 0, value: 0 }),
    ]);
    sys.attempt("npc_01", "ring", 100, 0, true, false, alwaysSuccess());
    const inv = sys.getNpcInventory("npc_01")!;
    expect(inv).toHaveLength(1);
    expect(inv[0].id).toBe("potion");
  });
});

describe("PickpocketSystem — save/restore", () => {
  it("getSaveState returns current stats", () => {
    const sys = new PickpocketSystem();
    sys.registerNpcInventory("npc_01", [makeItem({ weight: 0, value: 0 })]);
    sys.attempt("npc_01", "test_item", 100, 0, true, false, alwaysSuccess());
    const state = sys.getSaveState();
    expect(state.totalAttempts).toBe(1);
    expect(state.totalSuccesses).toBe(1);
    expect(state.totalCaught).toBe(0);
  });

  it("restoreFromSave restores stats", () => {
    const sys = new PickpocketSystem();
    const state: PickpocketSaveState = { totalAttempts: 10, totalSuccesses: 7, totalCaught: 2 };
    sys.restoreFromSave(state);
    expect(sys.totalAttempts).toBe(10);
    expect(sys.totalSuccesses).toBe(7);
    expect(sys.totalCaught).toBe(2);
  });

  it("restoreFromSave clamps negative values to 0", () => {
    const sys = new PickpocketSystem();
    sys.restoreFromSave({ totalAttempts: -5, totalSuccesses: -3, totalCaught: -1 });
    expect(sys.totalAttempts).toBe(0);
    expect(sys.totalSuccesses).toBe(0);
    expect(sys.totalCaught).toBe(0);
  });

  it("save/restore round-trip preserves stats", () => {
    const sys = new PickpocketSystem();
    sys.registerNpcInventory("npc_01", [
      makeItem({ id: "item1", weight: 0, value: 0 }),
      makeItem({ id: "item2", weight: 0, value: 0 }),
    ]);
    sys.attempt("npc_01", "item1", 100, 0, true, false, alwaysSuccess());
    sys.attempt("npc_01", "item2", 100, 0, true, false, alwaysFail());

    const state = sys.getSaveState();
    const sys2 = new PickpocketSystem();
    sys2.restoreFromSave(state);
    expect(sys2.totalAttempts).toBe(sys.totalAttempts);
    expect(sys2.totalSuccesses).toBe(sys.totalSuccesses);
    expect(sys2.totalCaught).toBe(sys.totalCaught);
  });

  it("restoreFromSave does not fire callbacks", () => {
    const sys = new PickpocketSystem();
    const cb = vi.fn();
    sys.onPickpocketSuccess = cb;
    sys.restoreFromSave({ totalAttempts: 5, totalSuccesses: 5, totalCaught: 0 });
    expect(cb).not.toHaveBeenCalled();
  });

  it("restoreFromSave handles missing fields gracefully", () => {
    const sys = new PickpocketSystem();
    sys.restoreFromSave({} as PickpocketSaveState);
    expect(sys.totalAttempts).toBe(0);
    expect(sys.totalSuccesses).toBe(0);
    expect(sys.totalCaught).toBe(0);
  });
});

describe("PickpocketSystem — constants", () => {
  it("MIN_SUCCESS_CHANCE is 5", () => expect(MIN_SUCCESS_CHANCE).toBe(5));
  it("MAX_SUCCESS_CHANCE is 90", () => expect(MAX_SUCCESS_CHANCE).toBe(90));
  it("CAUGHT_THRESHOLD is 50", () => expect(CAUGHT_THRESHOLD).toBe(50));
  it("SNEAK_XP_PER_PICKPOCKET is a positive number", () => expect(SNEAK_XP_PER_PICKPOCKET).toBeGreaterThan(0));
  it("WEIGHT_PENALTY is a positive number", () => expect(WEIGHT_PENALTY).toBeGreaterThan(0));
  it("VALUE_DIVISOR is a positive number", () => expect(VALUE_DIVISOR).toBeGreaterThan(0));
});
