import { describe, it, expect, vi, beforeEach } from "vitest";
import { AmbientEventSystem } from "./ambient-event-system";
import type {
  AmbientEventDefinition,
  AmbientEventContext,
  AmbientEventSnapshot,
} from "./ambient-event-system";

// ── Fixture helpers ───────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<AmbientEventContext> = {}): AmbientEventContext {
  const flags: Record<string, boolean> = {};
  return {
    gameTimeHours: 12,
    weatherId: "Clear",
    activeBiomeIds: [],
    playerLevel: 1,
    getFlag: (f) => flags[f] ?? false,
    setFlag: (f, v) => { flags[f] = v; },
    emitEvent: vi.fn(),
    ...overrides,
  };
}

const simpleEvent: AmbientEventDefinition = {
  id: "birds_scatter",
  label: "Birds Scatter",
  conditions: {},
  effect: { notification: "The birds scatter into the sky." },
};

const nightFogEvent: AmbientEventDefinition = {
  id: "night_fog",
  label: "Night Fog",
  conditions: {
    timeRange: { minHour: 22, maxHour: 6 },
    weather: ["Clear", "Overcast"],
  },
  effect: { notification: "Fog rolls across the valley.", emitEvent: "fog_start" },
  cooldownHours: 4,
};

const forestAmbient: AmbientEventDefinition = {
  id: "forest_ambient",
  label: "Forest Sounds",
  conditions: { biomeIds: ["forest", "deep_forest"] },
  effect: { notification: "You hear rustling leaves." },
  cooldownHours: 2,
};

// ── Tests: CRUD ───────────────────────────────────────────────────────────────

describe("AmbientEventSystem — CRUD", () => {
  it("registers an event and retrieves its definition", () => {
    const sys = new AmbientEventSystem();
    sys.addEvent(simpleEvent);
    expect(sys.getEvent("birds_scatter")).toEqual(simpleEvent);
  });

  it("replaces an existing event with the same id, resetting runtime state", () => {
    const sys = new AmbientEventSystem();
    sys.addEvent(simpleEvent);
    const ctx = makeCtx();
    sys.update(ctx); // fires once
    expect(sys.hasFired("birds_scatter")).toBe(true);

    const updated: AmbientEventDefinition = { ...simpleEvent, label: "Birds Scatter v2" };
    sys.addEvent(updated);
    expect(sys.getEvent("birds_scatter")?.label).toBe("Birds Scatter v2");
    expect(sys.hasFired("birds_scatter")).toBe(false); // reset
    expect(sys.getLastFiredAt("birds_scatter")).toBeNull(); // reset
  });

  it("removeEvent deletes a registered event", () => {
    const sys = new AmbientEventSystem();
    sys.addEvent(simpleEvent);
    sys.removeEvent("birds_scatter");
    expect(sys.getEvent("birds_scatter")).toBeUndefined();
    expect(sys.events).toHaveLength(0);
  });

  it("removeEvent on unknown id does not throw", () => {
    const sys = new AmbientEventSystem();
    expect(() => sys.removeEvent("ghost")).not.toThrow();
  });

  it("events getter returns all registered definitions", () => {
    const sys = new AmbientEventSystem();
    sys.addEvent(simpleEvent);
    sys.addEvent(nightFogEvent);
    expect(sys.events).toHaveLength(2);
    expect(sys.events.map((e) => e.id)).toContain("birds_scatter");
    expect(sys.events.map((e) => e.id)).toContain("night_fog");
  });

  it("clear() removes all events", () => {
    const sys = new AmbientEventSystem();
    sys.addEvent(simpleEvent);
    sys.addEvent(nightFogEvent);
    sys.clear();
    expect(sys.events).toHaveLength(0);
  });
});

// ── Tests: Unconditional firing ───────────────────────────────────────────────

describe("AmbientEventSystem — unconditional events", () => {
  it("fires an event with empty conditions on every update", () => {
    const sys = new AmbientEventSystem();
    const cb = vi.fn();
    sys.onEventTriggered = cb;
    sys.addEvent(simpleEvent);

    sys.update(makeCtx());
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith("birds_scatter", simpleEvent.effect);
  });

  it("fires multiple events in a single update", () => {
    const sys = new AmbientEventSystem();
    const cb = vi.fn();
    sys.onEventTriggered = cb;
    sys.addEvent(simpleEvent);
    sys.addEvent({ ...nightFogEvent, conditions: {} }); // remove conditions

    sys.update(makeCtx());
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it("hasFired returns true after an event fires", () => {
    const sys = new AmbientEventSystem();
    sys.addEvent(simpleEvent);
    expect(sys.hasFired("birds_scatter")).toBe(false);
    sys.update(makeCtx());
    expect(sys.hasFired("birds_scatter")).toBe(true);
  });

  it("getLastFiredAt records the context gameTimeHours", () => {
    const sys = new AmbientEventSystem();
    sys.addEvent(simpleEvent);
    sys.update(makeCtx({ gameTimeHours: 14.5 }));
    expect(sys.getLastFiredAt("birds_scatter")).toBe(14.5);
  });
});

// ── Tests: One-shot ───────────────────────────────────────────────────────────

describe("AmbientEventSystem — one-shot events", () => {
  it("a oneShot event fires exactly once", () => {
    const sys = new AmbientEventSystem();
    const cb = vi.fn();
    sys.onEventTriggered = cb;
    sys.addEvent({ ...simpleEvent, oneShot: true });

    sys.update(makeCtx({ gameTimeHours: 1 }));
    sys.update(makeCtx({ gameTimeHours: 2 }));
    sys.update(makeCtx({ gameTimeHours: 3 }));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("hasFired is true after a oneShot event fires", () => {
    const sys = new AmbientEventSystem();
    sys.addEvent({ ...simpleEvent, oneShot: true });
    sys.update(makeCtx());
    expect(sys.hasFired("birds_scatter")).toBe(true);
  });

  it("a non-oneShot event with zero cooldown fires on every update", () => {
    const sys = new AmbientEventSystem();
    const cb = vi.fn();
    sys.onEventTriggered = cb;
    sys.addEvent({ ...simpleEvent, cooldownHours: 0 });

    for (let i = 0; i < 5; i++) sys.update(makeCtx({ gameTimeHours: i }));
    expect(cb).toHaveBeenCalledTimes(5);
  });
});

// ── Tests: Cooldown ───────────────────────────────────────────────────────────

describe("AmbientEventSystem — cooldown", () => {
  it("does not re-fire before cooldown elapses", () => {
    const sys = new AmbientEventSystem();
    const cb = vi.fn();
    sys.onEventTriggered = cb;
    sys.addEvent({ ...simpleEvent, cooldownHours: 3 });

    sys.update(makeCtx({ gameTimeHours: 1 }));  // fires
    sys.update(makeCtx({ gameTimeHours: 2 }));  // still in cooldown
    sys.update(makeCtx({ gameTimeHours: 3 }));  // still in cooldown (only 2h elapsed)
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("re-fires after cooldown elapses", () => {
    const sys = new AmbientEventSystem();
    const cb = vi.fn();
    sys.onEventTriggered = cb;
    sys.addEvent({ ...simpleEvent, cooldownHours: 3 });

    sys.update(makeCtx({ gameTimeHours: 1 }));  // fires
    sys.update(makeCtx({ gameTimeHours: 4 }));  // 3h elapsed, fires again
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it("handles cooldown wrap across midnight", () => {
    const sys = new AmbientEventSystem();
    const cb = vi.fn();
    sys.onEventTriggered = cb;
    sys.addEvent({ ...simpleEvent, cooldownHours: 2 });

    sys.update(makeCtx({ gameTimeHours: 23 })); // fires at 23h
    sys.update(makeCtx({ gameTimeHours: 0.5 })); // only 1.5h elapsed (wrapped)
    sys.update(makeCtx({ gameTimeHours: 1.5 })); // 2.5h elapsed, fires
    expect(cb).toHaveBeenCalledTimes(2);
  });
});

// ── Tests: Time range condition ───────────────────────────────────────────────

describe("AmbientEventSystem — timeRange condition", () => {
  it("fires inside a daytime window", () => {
    const sys = new AmbientEventSystem();
    const cb = vi.fn();
    sys.onEventTriggered = cb;
    sys.addEvent({
      ...simpleEvent,
      conditions: { timeRange: { minHour: 8, maxHour: 18 } },
    });

    sys.update(makeCtx({ gameTimeHours: 10 }));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("does not fire outside a daytime window", () => {
    const sys = new AmbientEventSystem();
    const cb = vi.fn();
    sys.onEventTriggered = cb;
    sys.addEvent({
      ...simpleEvent,
      conditions: { timeRange: { minHour: 8, maxHour: 18 } },
    });

    sys.update(makeCtx({ gameTimeHours: 22 }));
    sys.update(makeCtx({ gameTimeHours: 3 }));
    expect(cb).not.toHaveBeenCalled();
  });

  it("fires inside a wrap-around night window", () => {
    const sys = new AmbientEventSystem();
    const cb = vi.fn();
    sys.onEventTriggered = cb;
    sys.addEvent({
      ...simpleEvent,
      conditions: { timeRange: { minHour: 22, maxHour: 4 } },
    });

    sys.update(makeCtx({ gameTimeHours: 23 })); // in window
    sys.update(makeCtx({ gameTimeHours: 1 }));  // in window (wrapped)
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it("does not fire outside a wrap-around night window", () => {
    const sys = new AmbientEventSystem();
    const cb = vi.fn();
    sys.onEventTriggered = cb;
    sys.addEvent({
      ...simpleEvent,
      conditions: { timeRange: { minHour: 22, maxHour: 4 } },
    });

    sys.update(makeCtx({ gameTimeHours: 12 }));
    sys.update(makeCtx({ gameTimeHours: 18 }));
    expect(cb).not.toHaveBeenCalled();
  });
});

// ── Tests: Weather condition ──────────────────────────────────────────────────

describe("AmbientEventSystem — weather condition", () => {
  it("fires when weatherId matches the allowed list", () => {
    const sys = new AmbientEventSystem();
    const cb = vi.fn();
    sys.onEventTriggered = cb;
    sys.addEvent({
      ...simpleEvent,
      conditions: { weather: ["Rain", "Storm"] },
    });

    sys.update(makeCtx({ weatherId: "Rain" }));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("does not fire when weatherId is not in the allowed list", () => {
    const sys = new AmbientEventSystem();
    const cb = vi.fn();
    sys.onEventTriggered = cb;
    sys.addEvent({
      ...simpleEvent,
      conditions: { weather: ["Rain", "Storm"] },
    });

    sys.update(makeCtx({ weatherId: "Clear" }));
    expect(cb).not.toHaveBeenCalled();
  });

  it("does not fire when context has no weatherId", () => {
    const sys = new AmbientEventSystem();
    const cb = vi.fn();
    sys.onEventTriggered = cb;
    sys.addEvent({
      ...simpleEvent,
      conditions: { weather: ["Rain"] },
    });

    sys.update(makeCtx({ weatherId: undefined }));
    expect(cb).not.toHaveBeenCalled();
  });
});

// ── Tests: Biome condition ────────────────────────────────────────────────────

describe("AmbientEventSystem — biomeIds condition", () => {
  it("fires when at least one required biome is active", () => {
    const sys = new AmbientEventSystem();
    const cb = vi.fn();
    sys.onEventTriggered = cb;
    sys.addEvent(forestAmbient);

    sys.update(makeCtx({ activeBiomeIds: ["plains", "forest"] }));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("does not fire when no required biomes are active", () => {
    const sys = new AmbientEventSystem();
    const cb = vi.fn();
    sys.onEventTriggered = cb;
    sys.addEvent(forestAmbient);

    sys.update(makeCtx({ activeBiomeIds: ["desert", "tundra"] }));
    expect(cb).not.toHaveBeenCalled();
  });

  it("does not fire when activeBiomeIds is empty", () => {
    const sys = new AmbientEventSystem();
    const cb = vi.fn();
    sys.onEventTriggered = cb;
    sys.addEvent(forestAmbient);

    sys.update(makeCtx({ activeBiomeIds: [] }));
    expect(cb).not.toHaveBeenCalled();
  });
});

// ── Tests: Player level condition ─────────────────────────────────────────────

describe("AmbientEventSystem — minPlayerLevel condition", () => {
  it("fires when player meets the minimum level", () => {
    const sys = new AmbientEventSystem();
    const cb = vi.fn();
    sys.onEventTriggered = cb;
    sys.addEvent({
      ...simpleEvent,
      conditions: { minPlayerLevel: 5 },
    });

    sys.update(makeCtx({ playerLevel: 5 }));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("does not fire when player is below minimum level", () => {
    const sys = new AmbientEventSystem();
    const cb = vi.fn();
    sys.onEventTriggered = cb;
    sys.addEvent({
      ...simpleEvent,
      conditions: { minPlayerLevel: 5 },
    });

    sys.update(makeCtx({ playerLevel: 4 }));
    expect(cb).not.toHaveBeenCalled();
  });

  it("treats missing playerLevel as 0", () => {
    const sys = new AmbientEventSystem();
    const cb = vi.fn();
    sys.onEventTriggered = cb;
    sys.addEvent({
      ...simpleEvent,
      conditions: { minPlayerLevel: 1 },
    });

    sys.update(makeCtx({ playerLevel: undefined }));
    expect(cb).not.toHaveBeenCalled();
  });
});

// ── Tests: Flag conditions ────────────────────────────────────────────────────

describe("AmbientEventSystem — flag conditions", () => {
  it("fires when all requiredFlags are set", () => {
    const sys = new AmbientEventSystem();
    const cb = vi.fn();
    sys.onEventTriggered = cb;
    sys.addEvent({
      ...simpleEvent,
      conditions: { requiredFlags: ["quest_done", "shrine_blessed"] },
    });

    const flags: Record<string, boolean> = { quest_done: true, shrine_blessed: true };
    sys.update(makeCtx({ getFlag: (f) => flags[f] ?? false }));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("does not fire when a requiredFlag is missing", () => {
    const sys = new AmbientEventSystem();
    const cb = vi.fn();
    sys.onEventTriggered = cb;
    sys.addEvent({
      ...simpleEvent,
      conditions: { requiredFlags: ["quest_done", "shrine_blessed"] },
    });

    const flags: Record<string, boolean> = { quest_done: true };
    sys.update(makeCtx({ getFlag: (f) => flags[f] ?? false }));
    expect(cb).not.toHaveBeenCalled();
  });

  it("does not fire when a forbiddenFlag is set", () => {
    const sys = new AmbientEventSystem();
    const cb = vi.fn();
    sys.onEventTriggered = cb;
    sys.addEvent({
      ...simpleEvent,
      conditions: { forbiddenFlags: ["boss_dead"] },
    });

    const flags: Record<string, boolean> = { boss_dead: true };
    sys.update(makeCtx({ getFlag: (f) => flags[f] ?? false }));
    expect(cb).not.toHaveBeenCalled();
  });

  it("fires when forbiddenFlags are all absent", () => {
    const sys = new AmbientEventSystem();
    const cb = vi.fn();
    sys.onEventTriggered = cb;
    sys.addEvent({
      ...simpleEvent,
      conditions: { forbiddenFlags: ["boss_dead"] },
    });

    sys.update(makeCtx({ getFlag: () => false }));
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

// ── Tests: Effect application ─────────────────────────────────────────────────

describe("AmbientEventSystem — effect application", () => {
  it("applies setFlag effect via context.setFlag", () => {
    const sys = new AmbientEventSystem();
    const flags: Record<string, boolean> = {};
    const ctx = makeCtx({ setFlag: (f, v) => { flags[f] = v; } });

    sys.addEvent({
      ...simpleEvent,
      effect: { setFlag: "fog_active" },
    });
    sys.update(ctx);
    expect(flags["fog_active"]).toBe(true);
  });

  it("applies emitEvent effect via context.emitEvent", () => {
    const sys = new AmbientEventSystem();
    const emitFn = vi.fn();
    sys.addEvent({
      ...simpleEvent,
      effect: { emitEvent: "ambient_fog" },
    });
    sys.update(makeCtx({ emitEvent: emitFn }));
    expect(emitFn).toHaveBeenCalledWith("ambient_fog");
  });

  it("does not crash when context lacks optional helpers", () => {
    const sys = new AmbientEventSystem();
    sys.addEvent({
      ...simpleEvent,
      effect: { setFlag: "flag_x", emitEvent: "event_x" },
    });
    // No setFlag / emitEvent in context
    expect(() => sys.update({ gameTimeHours: 12 })).not.toThrow();
  });
});

// ── Tests: Combined conditions ────────────────────────────────────────────────

describe("AmbientEventSystem — combined conditions", () => {
  it("fires nightFogEvent only when time, weather and biome all match", () => {
    const sys = new AmbientEventSystem();
    const cb = vi.fn();
    sys.onEventTriggered = cb;

    const event: AmbientEventDefinition = {
      id: "storm_arrival",
      label: "Storm Arrival",
      conditions: {
        timeRange: { minHour: 14, maxHour: 20 },
        weather: ["Storm"],
        biomeIds: ["coast"],
      },
      effect: { notification: "Dark clouds roll in from the sea." },
    };
    sys.addEvent(event);

    // All conditions met
    sys.update(makeCtx({
      gameTimeHours: 16,
      weatherId: "Storm",
      activeBiomeIds: ["coast"],
    }));
    expect(cb).toHaveBeenCalledTimes(1);

    // Wrong weather
    sys.update(makeCtx({
      gameTimeHours: 17,
      weatherId: "Clear",
      activeBiomeIds: ["coast"],
    }));
    expect(cb).toHaveBeenCalledTimes(1); // not fired again

    // Wrong biome
    sys.update(makeCtx({
      gameTimeHours: 18,
      weatherId: "Storm",
      activeBiomeIds: ["desert"],
    }));
    expect(cb).toHaveBeenCalledTimes(1); // not fired again
  });
});

// ── Tests: getEligibleEventIds ────────────────────────────────────────────────

describe("AmbientEventSystem — getEligibleEventIds", () => {
  it("returns ids of all eligible events without firing them", () => {
    const sys = new AmbientEventSystem();
    const cb = vi.fn();
    sys.onEventTriggered = cb;
    sys.addEvent(simpleEvent);
    sys.addEvent({
      ...nightFogEvent,
      conditions: { weather: ["Storm"] }, // won't match Clear
    });

    const ctx = makeCtx({ weatherId: "Clear" });
    const eligible = sys.getEligibleEventIds(ctx);
    expect(eligible).toContain("birds_scatter");
    expect(eligible).not.toContain("night_fog");
    expect(cb).not.toHaveBeenCalled(); // no side-effects
  });
});

// ── Tests: Snapshot / restore ─────────────────────────────────────────────────

describe("AmbientEventSystem — snapshot / restore", () => {
  it("getSnapshot captures lastFiredAt and fired state", () => {
    const sys = new AmbientEventSystem();
    sys.addEvent(simpleEvent);
    sys.update(makeCtx({ gameTimeHours: 7 }));
    const snap = sys.getSnapshot();
    expect(snap).toHaveLength(1);
    expect(snap[0]).toEqual({ id: "birds_scatter", lastFiredAt: 7, fired: true });
  });

  it("getSnapshot returns null lastFiredAt for unfired events", () => {
    const sys = new AmbientEventSystem();
    sys.addEvent(simpleEvent);
    const snap = sys.getSnapshot();
    expect(snap[0].lastFiredAt).toBeNull();
    expect(snap[0].fired).toBe(false);
  });

  it("restoreSnapshot rehydrates lastFiredAt and fired", () => {
    const sys = new AmbientEventSystem();
    sys.addEvent(simpleEvent);
    const snapshots: AmbientEventSnapshot[] = [
      { id: "birds_scatter", lastFiredAt: 9, fired: true },
    ];
    sys.restoreSnapshot(snapshots);
    expect(sys.hasFired("birds_scatter")).toBe(true);
    expect(sys.getLastFiredAt("birds_scatter")).toBe(9);
  });

  it("restoreSnapshot ignores unknown ids", () => {
    const sys = new AmbientEventSystem();
    expect(() =>
      sys.restoreSnapshot([{ id: "ghost_event", lastFiredAt: 5, fired: true }])
    ).not.toThrow();
  });

  it("does not fire onEventTriggered during restore", () => {
    const sys = new AmbientEventSystem();
    const cb = vi.fn();
    sys.onEventTriggered = cb;
    sys.addEvent(simpleEvent);
    sys.restoreSnapshot([{ id: "birds_scatter", lastFiredAt: 3, fired: true }]);
    expect(cb).not.toHaveBeenCalled();
  });

  it("restores a oneShot event's fired flag suppressing future updates", () => {
    const sys = new AmbientEventSystem();
    const cb = vi.fn();
    sys.onEventTriggered = cb;
    sys.addEvent({ ...simpleEvent, oneShot: true });
    sys.restoreSnapshot([{ id: "birds_scatter", lastFiredAt: 1, fired: true }]);
    sys.update(makeCtx({ gameTimeHours: 2 }));
    expect(cb).not.toHaveBeenCalled(); // suppressed by restored fired flag
  });

  it("round-trips snapshot through addEvent + restoreSnapshot", () => {
    const sys1 = new AmbientEventSystem();
    sys1.addEvent(simpleEvent);
    sys1.addEvent({ ...nightFogEvent, conditions: {} });
    sys1.update(makeCtx({ gameTimeHours: 5 }));
    const snap = sys1.getSnapshot();

    const sys2 = new AmbientEventSystem();
    sys2.addEvent(simpleEvent);
    sys2.addEvent({ ...nightFogEvent, conditions: {} });
    sys2.restoreSnapshot(snap);

    expect(sys2.hasFired("birds_scatter")).toBe(sys1.hasFired("birds_scatter"));
    expect(sys2.getLastFiredAt("birds_scatter")).toBe(sys1.getLastFiredAt("birds_scatter"));
    expect(sys2.hasFired("night_fog")).toBe(sys1.hasFired("night_fog"));
  });
});
