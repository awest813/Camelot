import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DynamicWorldEventSystem,
} from "./dynamic-world-event-system";
import type {
  DynamicEventTemplate,
  DynamicEventContext,
  DynamicEventResult,
  DynamicEventReward,
  DynamicEventSnapshot,
} from "./dynamic-world-event-system";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSys(): DynamicWorldEventSystem {
  return new DynamicWorldEventSystem();
}

function makeTemplate(overrides: Partial<DynamicEventTemplate> = {}): DynamicEventTemplate {
  return {
    id:           "test_event",
    label:        "Test Event",
    tableId:      "bandits_plains",
    cooldownHours: 4,
    baseChance:   1.0, // always fires when eligible
    ...overrides,
  };
}

function makeCtx(overrides: Partial<DynamicEventContext> = {}): DynamicEventContext {
  return {
    gameTimeHours: 10, // mid-morning (daytime)
    playerLevel:   5,
    ...overrides,
  };
}

/** RNG that always returns 0 (always rolls a "success"). */
const alwaysRng = () => 0;
/** RNG that always returns 1 (always rolls a "failure"). */
const neverRng  = () => 1;

// ── Initial state ─────────────────────────────────────────────────────────────

describe("DynamicWorldEventSystem — initial state", () => {
  it("starts with no registered templates", () => {
    expect(makeSys().templates).toHaveLength(0);
  });

  it("onEventFired and onRewardGranted default to null", () => {
    const sys = makeSys();
    expect(sys.onEventFired).toBeNull();
    expect(sys.onRewardGranted).toBeNull();
  });
});

// ── addTemplate / removeTemplate / getTemplate ────────────────────────────────

describe("DynamicWorldEventSystem — template CRUD", () => {
  it("addTemplate registers a template", () => {
    const sys = makeSys();
    sys.addTemplate(makeTemplate());
    expect(sys.getTemplate("test_event")).toBeDefined();
    expect(sys.templates).toHaveLength(1);
  });

  it("addTemplate replaces duplicate id and resets runtime state", () => {
    const sys = makeSys();
    sys.addTemplate(makeTemplate());
    // Trigger once to populate lastTriggeredAt
    sys.triggerEvent("test_event", makeCtx(), alwaysRng);
    expect(sys.getLastTriggeredAt("test_event")).not.toBeNull();
    // Re-register same id
    sys.addTemplate(makeTemplate({ label: "Updated Event" }));
    expect(sys.getTemplate("test_event")!.label).toBe("Updated Event");
    expect(sys.getLastTriggeredAt("test_event")).toBeNull(); // reset
  });

  it("removeTemplate deletes the template", () => {
    const sys = makeSys();
    sys.addTemplate(makeTemplate());
    sys.removeTemplate("test_event");
    expect(sys.getTemplate("test_event")).toBeUndefined();
    expect(sys.templates).toHaveLength(0);
  });

  it("removeTemplate on unknown id is safe", () => {
    const sys = makeSys();
    expect(() => sys.removeTemplate("nonexistent")).not.toThrow();
  });

  it("clear() removes all templates", () => {
    const sys = makeSys();
    sys.addTemplate(makeTemplate({ id: "a" }));
    sys.addTemplate(makeTemplate({ id: "b" }));
    sys.clear();
    expect(sys.templates).toHaveLength(0);
  });
});

// ── triggerEvent() ────────────────────────────────────────────────────────────

describe("DynamicWorldEventSystem — triggerEvent()", () => {
  it("returns null for unknown templateId", () => {
    const sys = makeSys();
    expect(sys.triggerEvent("missing", makeCtx())).toBeNull();
  });

  it("fires onEventFired callback", () => {
    const sys = makeSys();
    sys.addTemplate(makeTemplate());
    const cb = vi.fn();
    sys.onEventFired = cb;
    sys.triggerEvent("test_event", makeCtx(), alwaysRng);
    expect(cb).toHaveBeenCalledOnce();
  });

  it("returns a DynamicEventResult with correct fields", () => {
    const sys = makeSys();
    sys.addTemplate(makeTemplate({ tableId: "wolves_forest", minCount: 2, maxCount: 2 }));
    const result = sys.triggerEvent("test_event", makeCtx({ playerLevel: 7 }), alwaysRng);
    expect(result).not.toBeNull();
    expect(result!.templateId).toBe("test_event");
    expect(result!.tableId).toBe("wolves_forest");
    expect(result!.count).toBe(2);
    expect(result!.playerLevel).toBe(7);
  });

  it("increments triggerCount", () => {
    const sys = makeSys();
    sys.addTemplate(makeTemplate());
    sys.triggerEvent("test_event", makeCtx(), alwaysRng);
    sys.triggerEvent("test_event", makeCtx(), alwaysRng); // second call within cooldown but triggerEvent bypasses chance
    expect(sys.getTriggerCount("test_event")).toBeGreaterThanOrEqual(1);
  });

  it("returns null when cooldown has not elapsed", () => {
    const sys = makeSys();
    sys.addTemplate(makeTemplate({ cooldownHours: 8 }));
    sys.triggerEvent("test_event", makeCtx({ gameTimeHours: 10 }), alwaysRng);
    const second = sys.triggerEvent("test_event", makeCtx({ gameTimeHours: 12 }), alwaysRng);
    expect(second).toBeNull();
  });

  it("fires after cooldown has elapsed", () => {
    const sys = makeSys();
    sys.addTemplate(makeTemplate({ cooldownHours: 4 }));
    sys.triggerEvent("test_event", makeCtx({ gameTimeHours: 10 }), alwaysRng);
    const second = sys.triggerEvent("test_event", makeCtx({ gameTimeHours: 15 }), alwaysRng);
    expect(second).not.toBeNull();
  });

  it("respects minLevel gate", () => {
    const sys = makeSys();
    sys.addTemplate(makeTemplate({ minLevel: 10 }));
    const result = sys.triggerEvent("test_event", makeCtx({ playerLevel: 5 }), alwaysRng);
    expect(result).toBeNull();
  });

  it("respects maxLevel gate", () => {
    const sys = makeSys();
    sys.addTemplate(makeTemplate({ maxLevel: 5 }));
    const result = sys.triggerEvent("test_event", makeCtx({ playerLevel: 10 }), alwaysRng);
    expect(result).toBeNull();
  });

  it("grants rewards via onRewardGranted callback", () => {
    const sys = makeSys();
    sys.addTemplate(makeTemplate({ rewards: { xp: 100, gold: 50, label: "Loot found" } }));
    const rewardCb = vi.fn();
    sys.onRewardGranted = rewardCb;
    sys.triggerEvent("test_event", makeCtx(), alwaysRng);
    expect(rewardCb).toHaveBeenCalledWith({ xp: 100, gold: 50, label: "Loot found" });
  });

  it("does not call onRewardGranted when template has no rewards", () => {
    const sys = makeSys();
    sys.addTemplate(makeTemplate()); // no rewards
    const rewardCb = vi.fn();
    sys.onRewardGranted = rewardCb;
    sys.triggerEvent("test_event", makeCtx(), alwaysRng);
    expect(rewardCb).not.toHaveBeenCalled();
  });
});

// ── update() ─────────────────────────────────────────────────────────────────

describe("DynamicWorldEventSystem — update()", () => {
  it("returns empty array when no templates registered", () => {
    const sys = makeSys();
    expect(sys.update(makeCtx(), alwaysRng)).toHaveLength(0);
  });

  it("fires eligible templates and returns results", () => {
    const sys = makeSys();
    sys.addTemplate(makeTemplate());
    const results = sys.update(makeCtx(), alwaysRng);
    expect(results).toHaveLength(1);
    expect(results[0].templateId).toBe("test_event");
  });

  it("does not fire when RNG roll exceeds baseChance", () => {
    const sys = makeSys();
    sys.addTemplate(makeTemplate({ baseChance: 0.5 }));
    const results = sys.update(makeCtx(), neverRng); // always returns 1 > 0.5
    expect(results).toHaveLength(0);
  });

  it("applies biome filter — skips templates with no matching biome", () => {
    const sys = makeSys();
    sys.addTemplate(makeTemplate({ biomeIds: ["forest"] }));
    // context does not include "forest"
    const results = sys.update(makeCtx({ activeBiomeIds: ["plains"] }), alwaysRng);
    expect(results).toHaveLength(0);
  });

  it("applies biome filter — fires when biome matches", () => {
    const sys = makeSys();
    sys.addTemplate(makeTemplate({ biomeIds: ["forest"] }));
    const results = sys.update(makeCtx({ activeBiomeIds: ["forest", "plains"] }), alwaysRng);
    expect(results).toHaveLength(1);
  });

  it("fires templates with empty biomeIds in any biome", () => {
    const sys = makeSys();
    sys.addTemplate(makeTemplate({ biomeIds: [] }));
    const results = sys.update(makeCtx({ activeBiomeIds: ["desert"] }), alwaysRng);
    expect(results).toHaveLength(1);
  });

  it("respects cooldown between update() calls", () => {
    const sys = makeSys();
    sys.addTemplate(makeTemplate({ cooldownHours: 8 }));
    sys.update(makeCtx({ gameTimeHours: 6 }), alwaysRng);
    const second = sys.update(makeCtx({ gameTimeHours: 8 }), alwaysRng);
    expect(second).toHaveLength(0);
  });

  it("fires again after cooldown elapses", () => {
    const sys = makeSys();
    sys.addTemplate(makeTemplate({ cooldownHours: 4 }));
    sys.update(makeCtx({ gameTimeHours: 6 }), alwaysRng);
    const second = sys.update(makeCtx({ gameTimeHours: 12 }), alwaysRng);
    expect(second).toHaveLength(1);
  });
});

// ── Faction threat modifier ───────────────────────────────────────────────────

describe("DynamicWorldEventSystem — faction threat modifier", () => {
  it("boosts effective chance when a hostile faction is active", () => {
    const sys = makeSys();
    sys.addTemplate(makeTemplate({
      baseChance: 0.4,
      hostileFactionIds: ["bandits"],
      factionThreatMultiplier: 2.0,
    }));
    const chance = sys.computeEffectiveChance("test_event", makeCtx({
      activeFactionIds: ["bandits"],
    }));
    expect(chance).toBeCloseTo(0.8, 5);
  });

  it("does not boost chance when hostile faction is absent", () => {
    const sys = makeSys();
    sys.addTemplate(makeTemplate({
      baseChance: 0.4,
      hostileFactionIds: ["bandits"],
      factionThreatMultiplier: 2.0,
    }));
    const chance = sys.computeEffectiveChance("test_event", makeCtx({
      activeFactionIds: ["guards"],
    }));
    expect(chance).toBeCloseTo(0.4, 5);
  });

  it("uses default faction multiplier of 1.5 when not specified", () => {
    const sys = makeSys();
    sys.addTemplate(makeTemplate({
      baseChance: 0.4,
      hostileFactionIds: ["necromancers"],
      // factionThreatMultiplier not set → defaults to 1.5
    }));
    const chance = sys.computeEffectiveChance("test_event", makeCtx({
      activeFactionIds: ["necromancers"],
    }));
    expect(chance).toBeCloseTo(0.6, 5);
  });

  it("causes event to fire more often when hostile faction is present", () => {
    const sys = makeSys();
    sys.addTemplate(makeTemplate({
      baseChance: 0.6,
      hostileFactionIds: ["bandits"],
      factionThreatMultiplier: 2.0,
    }));
    // With a faction boost of 2.0, effective = 1.0; rng returning 0.7 should succeed
    const results = sys.update(makeCtx({ activeFactionIds: ["bandits"] }), () => 0.7);
    expect(results).toHaveLength(1);
  });
});

// ── Weather modifier ──────────────────────────────────────────────────────────

describe("DynamicWorldEventSystem — weather modifier", () => {
  it("boosts effective chance during boosted weather", () => {
    const sys = makeSys();
    sys.addTemplate(makeTemplate({
      baseChance: 0.4,
      boostedWeatherIds: ["Storm"],
      weatherBoostMultiplier: 2.0,
    }));
    const chance = sys.computeEffectiveChance("test_event", makeCtx({ weatherId: "Storm" }));
    expect(chance).toBeCloseTo(0.8, 5);
  });

  it("does not boost during non-matching weather", () => {
    const sys = makeSys();
    sys.addTemplate(makeTemplate({
      baseChance: 0.4,
      boostedWeatherIds: ["Storm"],
      weatherBoostMultiplier: 2.0,
    }));
    const chance = sys.computeEffectiveChance("test_event", makeCtx({ weatherId: "Clear" }));
    expect(chance).toBeCloseTo(0.4, 5);
  });

  it("uses default weather multiplier of 1.5 when not specified", () => {
    const sys = makeSys();
    sys.addTemplate(makeTemplate({
      baseChance: 0.4,
      boostedWeatherIds: ["Fog"],
      // weatherBoostMultiplier not set → defaults to 1.5
    }));
    const chance = sys.computeEffectiveChance("test_event", makeCtx({ weatherId: "Fog" }));
    expect(chance).toBeCloseTo(0.6, 5);
  });
});

// ── Night modifier ────────────────────────────────────────────────────────────

describe("DynamicWorldEventSystem — night multiplier", () => {
  it("applies nightMultiplier after 18:00", () => {
    const sys = makeSys();
    sys.addTemplate(makeTemplate({ baseChance: 0.4, nightMultiplier: 2.0 }));
    const chance = sys.computeEffectiveChance("test_event", makeCtx({ gameTimeHours: 20 }));
    expect(chance).toBeCloseTo(0.8, 5);
  });

  it("applies nightMultiplier before 06:00", () => {
    const sys = makeSys();
    sys.addTemplate(makeTemplate({ baseChance: 0.4, nightMultiplier: 2.0 }));
    const chance = sys.computeEffectiveChance("test_event", makeCtx({ gameTimeHours: 3 }));
    expect(chance).toBeCloseTo(0.8, 5);
  });

  it("does NOT apply nightMultiplier during the day (06:00–18:00)", () => {
    const sys = makeSys();
    sys.addTemplate(makeTemplate({ baseChance: 0.4, nightMultiplier: 2.0 }));
    const chance = sys.computeEffectiveChance("test_event", makeCtx({ gameTimeHours: 12 }));
    expect(chance).toBeCloseTo(0.4, 5);
  });

  it("clamps effective chance to 1.0", () => {
    const sys = makeSys();
    sys.addTemplate(makeTemplate({
      baseChance: 0.8,
      nightMultiplier: 5.0,
    }));
    const chance = sys.computeEffectiveChance("test_event", makeCtx({ gameTimeHours: 22 }));
    expect(chance).toBe(1.0);
  });

  it("stacks faction + weather + night modifiers", () => {
    const sys = makeSys();
    sys.addTemplate(makeTemplate({
      baseChance: 0.2,
      hostileFactionIds: ["wolves"],
      factionThreatMultiplier: 1.5,
      boostedWeatherIds: ["Storm"],
      weatherBoostMultiplier: 1.5,
      nightMultiplier: 1.5,
    }));
    const chance = sys.computeEffectiveChance("test_event", makeCtx({
      gameTimeHours:   22,
      activeFactionIds: ["wolves"],
      weatherId:        "Storm",
    }));
    // 0.2 × 1.5 × 1.5 × 1.5 = 0.675
    expect(chance).toBeCloseTo(0.675, 5);
  });
});

// ── Event chaining ────────────────────────────────────────────────────────────

describe("DynamicWorldEventSystem — event chaining", () => {
  it("fires the chain event immediately after the first event (cooldown reset)", () => {
    const sys = makeSys();
    sys.addTemplate(makeTemplate({
      id: "first",
      chainEventId: "second",
      cooldownHours: 1,
    }));
    sys.addTemplate(makeTemplate({
      id: "second",
      cooldownHours: 10, // would block second event without the chain reset
    }));

    const fired: string[] = [];
    sys.onEventFired = (r) => fired.push(r.templateId);

    // Trigger "first" — should chain-reset "second"
    sys.triggerEvent("first", makeCtx({ gameTimeHours: 5 }), alwaysRng);
    expect(sys.getLastTriggeredAt("second")).toBeNull(); // reset

    // Now update — "second" should fire despite its 10-hour cooldown
    const results = sys.update(makeCtx({ gameTimeHours: 6 }), alwaysRng);
    expect(results.some((r) => r.templateId === "second")).toBe(true);
  });

  it("does not throw when chainEventId refers to an unknown template", () => {
    const sys = makeSys();
    sys.addTemplate(makeTemplate({ chainEventId: "unknown_chain" }));
    expect(() => sys.triggerEvent("test_event", makeCtx(), alwaysRng)).not.toThrow();
  });
});

// ── getEligibleTemplates ──────────────────────────────────────────────────────

describe("DynamicWorldEventSystem — getEligibleTemplates()", () => {
  it("returns all eligible templates off cooldown within level range", () => {
    const sys = makeSys();
    sys.addTemplate(makeTemplate({ id: "a" }));
    sys.addTemplate(makeTemplate({ id: "b" }));
    const eligible = sys.getEligibleTemplates(makeCtx());
    expect(eligible).toHaveLength(2);
  });

  it("excludes templates on cooldown", () => {
    const sys = makeSys();
    sys.addTemplate(makeTemplate({ id: "a", cooldownHours: 8 }));
    sys.triggerEvent("a", makeCtx({ gameTimeHours: 5 }), alwaysRng);
    const eligible = sys.getEligibleTemplates(makeCtx({ gameTimeHours: 6 }));
    expect(eligible).toHaveLength(0);
  });

  it("computeEffectiveChance returns 0 for unknown template", () => {
    const sys = makeSys();
    expect(sys.computeEffectiveChance("none", makeCtx())).toBe(0);
  });
});

// ── getLastTriggeredAt / getTriggerCount ──────────────────────────────────────

describe("DynamicWorldEventSystem — query helpers", () => {
  it("getLastTriggeredAt returns null before any trigger", () => {
    const sys = makeSys();
    sys.addTemplate(makeTemplate());
    expect(sys.getLastTriggeredAt("test_event")).toBeNull();
  });

  it("getLastTriggeredAt returns the trigger time after firing", () => {
    const sys = makeSys();
    sys.addTemplate(makeTemplate());
    sys.triggerEvent("test_event", makeCtx({ gameTimeHours: 8 }), alwaysRng);
    expect(sys.getLastTriggeredAt("test_event")).toBe(8);
  });

  it("getTriggerCount increments on each fire", () => {
    const sys = makeSys();
    sys.addTemplate(makeTemplate({ cooldownHours: 0 }));
    sys.triggerEvent("test_event", makeCtx({ gameTimeHours: 1 }), alwaysRng);
    sys.triggerEvent("test_event", makeCtx({ gameTimeHours: 2 }), alwaysRng);
    expect(sys.getTriggerCount("test_event")).toBe(2);
  });

  it("getTriggerCount returns 0 for unknown id", () => {
    expect(makeSys().getTriggerCount("none")).toBe(0);
  });

  it("getLastTriggeredAt returns null for unknown id", () => {
    expect(makeSys().getLastTriggeredAt("none")).toBeNull();
  });
});

// ── Snapshot / restore ────────────────────────────────────────────────────────

describe("DynamicWorldEventSystem — getSnapshot / restoreSnapshot", () => {
  it("getSnapshot captures lastTriggeredAt and triggerCount", () => {
    const sys = makeSys();
    sys.addTemplate(makeTemplate());
    sys.triggerEvent("test_event", makeCtx({ gameTimeHours: 9 }), alwaysRng);
    const snaps = sys.getSnapshot();
    expect(snaps).toHaveLength(1);
    expect(snaps[0].id).toBe("test_event");
    expect(snaps[0].lastTriggeredAt).toBe(9);
    expect(snaps[0].triggerCount).toBe(1);
  });

  it("restoreSnapshot restores runtime state", () => {
    const a = makeSys();
    a.addTemplate(makeTemplate());
    a.triggerEvent("test_event", makeCtx({ gameTimeHours: 7 }), alwaysRng);
    const snaps = a.getSnapshot();

    const b = makeSys();
    b.addTemplate(makeTemplate());
    b.restoreSnapshot(snaps);

    expect(b.getLastTriggeredAt("test_event")).toBe(7);
    expect(b.getTriggerCount("test_event")).toBe(1);
  });

  it("restoreSnapshot ignores unknown ids", () => {
    const sys = makeSys();
    const snap: DynamicEventSnapshot = { id: "unknown", lastTriggeredAt: 5, triggerCount: 3 };
    expect(() => sys.restoreSnapshot([snap])).not.toThrow();
  });

  it("restoreSnapshot handles invalid lastTriggeredAt gracefully", () => {
    const sys = makeSys();
    sys.addTemplate(makeTemplate());
    const snap: DynamicEventSnapshot = { id: "test_event", lastTriggeredAt: null, triggerCount: 0 };
    sys.restoreSnapshot([snap]);
    expect(sys.getLastTriggeredAt("test_event")).toBeNull();
  });

  it("round-trips correctly — event fires after cooldown post-restore", () => {
    const a = makeSys();
    a.addTemplate(makeTemplate({ cooldownHours: 4 }));
    a.triggerEvent("test_event", makeCtx({ gameTimeHours: 8 }), alwaysRng);
    const snaps = a.getSnapshot();

    const b = makeSys();
    b.addTemplate(makeTemplate({ cooldownHours: 4 }));
    b.restoreSnapshot(snaps);

    // Still on cooldown at hour 10
    const r1 = b.triggerEvent("test_event", makeCtx({ gameTimeHours: 10 }), alwaysRng);
    expect(r1).toBeNull();

    // Off cooldown at hour 13
    const r2 = b.triggerEvent("test_event", makeCtx({ gameTimeHours: 13 }), alwaysRng);
    expect(r2).not.toBeNull();
  });
});
