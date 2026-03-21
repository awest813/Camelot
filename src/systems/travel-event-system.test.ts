import { describe, it, expect, vi, beforeEach } from "vitest";
import { TravelEventSystem } from "./travel-event-system";
import type {
  TravelEventDefinition,
  TravelContext,
  TravelEventSnapshot,
} from "./travel-event-system";

// ── Fixture helpers ───────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<TravelContext> = {}): TravelContext {
  const flags: Record<string, boolean> = {};
  return {
    gameTimeHours: 10,
    activeBiomeIds: ["plains"],
    weatherId: "Clear",
    playerLevel: 5,
    getFlag: (f) => flags[f] ?? false,
    setFlag: (f, v) => { flags[f] = v; },
    emitEvent: vi.fn(),
    discoverLandmark: vi.fn(),
    ...overrides,
  };
}

const banditAmbush: TravelEventDefinition = {
  id: "bandit_ambush",
  label: "Bandit Ambush",
  conditions: { biomeIds: ["plains", "road"] },
  outcome: { notification: "Bandits leap from the bushes!", emitEvent: "spawn_bandits" },
  weight: 3,
  cooldownHours: 4,
};

const merchantMeeting: TravelEventDefinition = {
  id: "merchant_meeting",
  label: "Travelling Merchant",
  conditions: { biomeIds: ["road", "plains"] },
  outcome: { notification: "A travelling merchant greets you." },
  weight: 2,
};

const ruinDiscovery: TravelEventDefinition = {
  id: "ruin_discovery",
  label: "Ancient Ruin",
  conditions: { biomeIds: ["forest"] },
  outcome: {
    notification: "You spot ancient ruins through the trees.",
    landmarkId: "ancient_ruin_1",
    setFlag: "found_ruin_1",
  },
  weight: 1,
  oneShot: true,
};

const stormAmbush: TravelEventDefinition = {
  id: "storm_ambush",
  label: "Storm Ambush",
  conditions: { biomeIds: ["plains"], weather: ["Storm"] },
  outcome: { notification: "A storm obscures the horizon..." },
  weight: 1,
};

const highLevelEvent: TravelEventDefinition = {
  id: "dragon_sighting",
  label: "Dragon Sighting",
  conditions: { minPlayerLevel: 15 },
  outcome: { notification: "A dragon circles the peaks overhead!" },
  weight: 1,
};

const flagGatedEvent: TravelEventDefinition = {
  id: "flag_gated",
  label: "Flag Gated Event",
  conditions: {
    requiredFlags: ["completed_main_quest"],
    forbiddenFlags: ["already_rewarded"],
  },
  outcome: { notification: "A messenger finds you on the road.", setFlag: "already_rewarded" },
  weight: 1,
  oneShot: true,
};

// Deterministic RNGs
const rngFirst = () => 0;         // always selects the first eligible event
const rngLast = () => 0.9999;     // always selects the last eligible event

// ── Tests: CRUD ───────────────────────────────────────────────────────────────

describe("TravelEventSystem — CRUD", () => {
  it("registers an event and retrieves its definition", () => {
    const sys = new TravelEventSystem();
    sys.addEvent(banditAmbush);
    expect(sys.getEvent("bandit_ambush")).toEqual(banditAmbush);
  });

  it("replaces an existing event with the same id, resetting runtime state", () => {
    const sys = new TravelEventSystem();
    sys.addEvent(banditAmbush);
    sys.rollEvent(makeCtx());
    expect(sys.hasFired("bandit_ambush")).toBe(true);

    const updated: TravelEventDefinition = { ...banditAmbush, label: "Bandit Ambush v2" };
    sys.addEvent(updated);
    expect(sys.getEvent("bandit_ambush")?.label).toBe("Bandit Ambush v2");
    expect(sys.hasFired("bandit_ambush")).toBe(false); // state reset
    expect(sys.getLastFiredAt("bandit_ambush")).toBeNull();
  });

  it("removeEvent deletes a registered event", () => {
    const sys = new TravelEventSystem();
    sys.addEvent(banditAmbush);
    sys.removeEvent("bandit_ambush");
    expect(sys.getEvent("bandit_ambush")).toBeUndefined();
    expect(sys.events).toHaveLength(0);
  });

  it("removeEvent on unknown id is safe", () => {
    const sys = new TravelEventSystem();
    expect(() => sys.removeEvent("unknown")).not.toThrow();
  });

  it("events getter returns all registered definitions", () => {
    const sys = new TravelEventSystem();
    sys.addEvent(banditAmbush);
    sys.addEvent(merchantMeeting);
    expect(sys.events).toHaveLength(2);
  });

  it("clear removes all events and resets total count", () => {
    const sys = new TravelEventSystem();
    sys.addEvent(banditAmbush);
    sys.rollEvent(makeCtx());
    sys.clear();
    expect(sys.events).toHaveLength(0);
    expect(sys.getTotalEventsFired()).toBe(0);
  });
});

// ── Tests: rollEvent — basic ──────────────────────────────────────────────────

describe("TravelEventSystem — rollEvent (basic)", () => {
  it("returns null when no events are registered", () => {
    const sys = new TravelEventSystem();
    expect(sys.rollEvent(makeCtx())).toBeNull();
  });

  it("returns null when no events are eligible", () => {
    const sys = new TravelEventSystem();
    sys.addEvent(stormAmbush);   // requires Storm weather
    expect(sys.rollEvent(makeCtx({ weatherId: "Clear" }))).toBeNull();
  });

  it("fires an eligible event and returns its outcome", () => {
    const sys = new TravelEventSystem();
    sys.addEvent(banditAmbush);
    const outcome = sys.rollEvent(makeCtx());
    expect(outcome).not.toBeNull();
    expect(outcome?.notification).toBe("Bandits leap from the bushes!");
  });

  it("fires onTravelEventFired callback", () => {
    const sys = new TravelEventSystem();
    sys.addEvent(banditAmbush);
    const spy = vi.fn();
    sys.onTravelEventFired = spy;
    sys.rollEvent(makeCtx());
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toBe("bandit_ambush");
  });

  it("increments getTotalEventsFired after each roll that fires", () => {
    const sys = new TravelEventSystem();
    sys.addEvent(banditAmbush);
    sys.rollEvent(makeCtx());
    sys.rollEvent(makeCtx({ gameTimeHours: 15 })); // past cooldown
    expect(sys.getTotalEventsFired()).toBe(2);
  });

  it("does not increment getTotalEventsFired when no eligible event exists", () => {
    const sys = new TravelEventSystem();
    sys.addEvent(stormAmbush);
    sys.rollEvent(makeCtx({ weatherId: "Clear" }));
    expect(sys.getTotalEventsFired()).toBe(0);
  });
});

// ── Tests: conditions ─────────────────────────────────────────────────────────

describe("TravelEventSystem — conditions", () => {
  it("biomeIds: fires when active biome matches", () => {
    const sys = new TravelEventSystem();
    sys.addEvent(ruinDiscovery);
    const outcome = sys.rollEvent(makeCtx({ activeBiomeIds: ["forest"] }));
    expect(outcome?.notification).toContain("ruins");
  });

  it("biomeIds: does not fire when active biome does not match", () => {
    const sys = new TravelEventSystem();
    sys.addEvent(ruinDiscovery);
    const outcome = sys.rollEvent(makeCtx({ activeBiomeIds: ["plains"] }));
    expect(outcome).toBeNull();
  });

  it("biomeIds: fires when one of multiple active biomes matches", () => {
    const sys = new TravelEventSystem();
    sys.addEvent(ruinDiscovery);
    const outcome = sys.rollEvent(
      makeCtx({ activeBiomeIds: ["plains", "forest"] }),
    );
    expect(outcome).not.toBeNull();
  });

  it("weather: fires when weather matches", () => {
    const sys = new TravelEventSystem();
    sys.addEvent(stormAmbush);
    const outcome = sys.rollEvent(makeCtx({ weatherId: "Storm" }));
    expect(outcome).not.toBeNull();
  });

  it("weather: does not fire when weather does not match", () => {
    const sys = new TravelEventSystem();
    sys.addEvent(stormAmbush);
    const outcome = sys.rollEvent(makeCtx({ weatherId: "Clear" }));
    expect(outcome).toBeNull();
  });

  it("weather: does not fire when weatherId is absent from context", () => {
    const sys = new TravelEventSystem();
    sys.addEvent(stormAmbush);
    const outcome = sys.rollEvent(makeCtx({ weatherId: undefined }));
    expect(outcome).toBeNull();
  });

  it("minPlayerLevel: fires at exactly the required level", () => {
    const sys = new TravelEventSystem();
    sys.addEvent(highLevelEvent);
    const outcome = sys.rollEvent(makeCtx({ playerLevel: 15, activeBiomeIds: [] }));
    expect(outcome).not.toBeNull();
  });

  it("minPlayerLevel: does not fire below the required level", () => {
    const sys = new TravelEventSystem();
    sys.addEvent(highLevelEvent);
    const outcome = sys.rollEvent(makeCtx({ playerLevel: 14, activeBiomeIds: [] }));
    expect(outcome).toBeNull();
  });

  it("requiredFlags: fires only when flag is set", () => {
    const sys = new TravelEventSystem();
    sys.addEvent(flagGatedEvent);

    const flags: Record<string, boolean> = {};
    const ctx = makeCtx({
      activeBiomeIds: [],
      getFlag: (f) => flags[f] ?? false,
      setFlag: (f, v) => { flags[f] = v; },
    });

    // Flag not set — should not fire
    expect(sys.rollEvent(ctx)).toBeNull();

    // Set flag and try again
    flags["completed_main_quest"] = true;
    const outcome = sys.rollEvent(ctx);
    expect(outcome).not.toBeNull();
  });

  it("forbiddenFlags: does not fire when forbidden flag is set", () => {
    const sys = new TravelEventSystem();
    sys.addEvent(flagGatedEvent);

    const flags: Record<string, boolean> = {
      completed_main_quest: true,
      already_rewarded: true,
    };
    const ctx = makeCtx({
      activeBiomeIds: [],
      getFlag: (f) => flags[f] ?? false,
    });
    expect(sys.rollEvent(ctx)).toBeNull();
  });
});

// ── Tests: cooldown ───────────────────────────────────────────────────────────

describe("TravelEventSystem — cooldown", () => {
  it("records lastFiredAt after firing", () => {
    const sys = new TravelEventSystem();
    sys.addEvent(banditAmbush);
    sys.rollEvent(makeCtx({ gameTimeHours: 6 }));
    expect(sys.getLastFiredAt("bandit_ambush")).toBe(6);
  });

  it("does not re-fire within cooldown window", () => {
    const sys = new TravelEventSystem();
    sys.addEvent(banditAmbush); // cooldownHours: 4
    sys.rollEvent(makeCtx({ gameTimeHours: 6 }));
    const outcome = sys.rollEvent(makeCtx({ gameTimeHours: 8 })); // only 2h later
    expect(outcome).toBeNull();
  });

  it("re-fires after cooldown has elapsed", () => {
    const sys = new TravelEventSystem();
    sys.addEvent(banditAmbush); // cooldownHours: 4
    sys.rollEvent(makeCtx({ gameTimeHours: 6 }));
    const outcome = sys.rollEvent(makeCtx({ gameTimeHours: 10 })); // 4h later
    expect(outcome).not.toBeNull();
  });

  it("handles midnight wrap-around in cooldown calculation", () => {
    const sys = new TravelEventSystem();
    sys.addEvent(banditAmbush); // cooldownHours: 4
    sys.rollEvent(makeCtx({ gameTimeHours: 22 }));
    // 3h later (past midnight: 01:00) — not yet elapsed
    expect(sys.rollEvent(makeCtx({ gameTimeHours: 1 }))).toBeNull();
    // 5h later (past midnight: 03:00) — elapsed
    expect(sys.rollEvent(makeCtx({ gameTimeHours: 3 }))).not.toBeNull();
  });

  it("event with no cooldown fires every call", () => {
    const sys = new TravelEventSystem();
    sys.addEvent(merchantMeeting); // no cooldownHours
    sys.rollEvent(makeCtx({ gameTimeHours: 1 }));
    sys.rollEvent(makeCtx({ gameTimeHours: 1 }));
    expect(sys.getTotalEventsFired()).toBe(2);
  });
});

// ── Tests: oneShot ────────────────────────────────────────────────────────────

describe("TravelEventSystem — oneShot", () => {
  it("one-shot event fires exactly once", () => {
    const sys = new TravelEventSystem();
    sys.addEvent(ruinDiscovery); // oneShot: true
    sys.rollEvent(makeCtx({ activeBiomeIds: ["forest"] }));
    expect(sys.hasFired("ruin_discovery")).toBe(true);
    const second = sys.rollEvent(makeCtx({ activeBiomeIds: ["forest"] }));
    expect(second).toBeNull();
  });

  it("hasFired returns false before the event fires", () => {
    const sys = new TravelEventSystem();
    sys.addEvent(ruinDiscovery);
    expect(sys.hasFired("ruin_discovery")).toBe(false);
  });

  it("hasFired returns false for unknown id", () => {
    const sys = new TravelEventSystem();
    expect(sys.hasFired("no_such_event")).toBe(false);
  });
});

// ── Tests: outcome side-effects ───────────────────────────────────────────────

describe("TravelEventSystem — outcome side-effects", () => {
  it("applies setFlag via context.setFlag", () => {
    const sys = new TravelEventSystem();
    sys.addEvent(ruinDiscovery); // setFlag: "found_ruin_1"
    const flags: Record<string, boolean> = {};
    sys.rollEvent(
      makeCtx({
        activeBiomeIds: ["forest"],
        setFlag: (f, v) => { flags[f] = v; },
      }),
    );
    expect(flags["found_ruin_1"]).toBe(true);
  });

  it("calls context.emitEvent with the correct event id", () => {
    const sys = new TravelEventSystem();
    sys.addEvent(banditAmbush); // emitEvent: "spawn_bandits"
    const emitSpy = vi.fn();
    sys.rollEvent(makeCtx({ emitEvent: emitSpy }));
    expect(emitSpy).toHaveBeenCalledWith("spawn_bandits");
  });

  it("calls context.discoverLandmark with the correct landmark id", () => {
    const sys = new TravelEventSystem();
    sys.addEvent(ruinDiscovery); // landmarkId: "ancient_ruin_1"
    const discoverSpy = vi.fn();
    sys.rollEvent(
      makeCtx({ activeBiomeIds: ["forest"], discoverLandmark: discoverSpy }),
    );
    expect(discoverSpy).toHaveBeenCalledWith("ancient_ruin_1");
  });

  it("does not crash when setFlag is not provided in context", () => {
    const sys = new TravelEventSystem();
    sys.addEvent(ruinDiscovery);
    const ctx = makeCtx({ activeBiomeIds: ["forest"], setFlag: undefined });
    expect(() => sys.rollEvent(ctx)).not.toThrow();
  });

  it("does not crash when emitEvent is not provided in context", () => {
    const sys = new TravelEventSystem();
    sys.addEvent(banditAmbush);
    expect(() => sys.rollEvent(makeCtx({ emitEvent: undefined }))).not.toThrow();
  });

  it("does not crash when discoverLandmark is not provided in context", () => {
    const sys = new TravelEventSystem();
    sys.addEvent(ruinDiscovery);
    const ctx = makeCtx({ activeBiomeIds: ["forest"], discoverLandmark: undefined });
    expect(() => sys.rollEvent(ctx)).not.toThrow();
  });
});

// ── Tests: weighted selection ─────────────────────────────────────────────────

describe("TravelEventSystem — weighted selection", () => {
  it("always selects the only eligible event", () => {
    const sys = new TravelEventSystem();
    sys.addEvent(merchantMeeting);
    const outcome = sys.rollEvent(makeCtx());
    expect(outcome?.notification).toBe("A travelling merchant greets you.");
  });

  it("with rng=0 selects the highest-weight event first", () => {
    const sys = new TravelEventSystem();
    sys.addEvent(banditAmbush);    // weight 3, first in order
    sys.addEvent(merchantMeeting); // weight 2
    const outcome = sys.rollEvent(makeCtx(), rngFirst);
    expect(outcome?.notification).toBe("Bandits leap from the bushes!");
  });

  it("with rng~1 selects the last eligible event", () => {
    const sys = new TravelEventSystem();
    sys.addEvent(banditAmbush);
    sys.addEvent(merchantMeeting);
    const outcome = sys.rollEvent(makeCtx(), rngLast);
    // With rng close to 1, roll = 0.9999 * 5 = ~5, which exhausts all weights
    expect(outcome).not.toBeNull();
  });

  it("getEligibleEvents returns all currently eligible definitions", () => {
    const sys = new TravelEventSystem();
    sys.addEvent(banditAmbush);
    sys.addEvent(merchantMeeting);
    sys.addEvent(ruinDiscovery); // forest biome — not eligible in plains
    const eligible = sys.getEligibleEvents(makeCtx({ activeBiomeIds: ["plains"] }));
    expect(eligible.map((e) => e.id).sort()).toEqual(
      ["bandit_ambush", "merchant_meeting"].sort(),
    );
  });

  it("getEligibleEvents returns empty array when no events are eligible", () => {
    const sys = new TravelEventSystem();
    sys.addEvent(stormAmbush);
    expect(sys.getEligibleEvents(makeCtx({ weatherId: "Clear" }))).toHaveLength(0);
  });
});

// ── Tests: getLastFiredAt ─────────────────────────────────────────────────────

describe("TravelEventSystem — getLastFiredAt", () => {
  it("returns null before an event fires", () => {
    const sys = new TravelEventSystem();
    sys.addEvent(banditAmbush);
    expect(sys.getLastFiredAt("bandit_ambush")).toBeNull();
  });

  it("returns null for an unknown id", () => {
    const sys = new TravelEventSystem();
    expect(sys.getLastFiredAt("unknown")).toBeNull();
  });

  it("returns the game time when the event last fired", () => {
    const sys = new TravelEventSystem();
    sys.addEvent(merchantMeeting); // no cooldown
    sys.rollEvent(makeCtx({ gameTimeHours: 14.5 }));
    expect(sys.getLastFiredAt("merchant_meeting")).toBe(14.5);
  });
});

// ── Tests: snapshot / restore ─────────────────────────────────────────────────

describe("TravelEventSystem — snapshot / restore", () => {
  it("captures per-event state in a snapshot", () => {
    const sys = new TravelEventSystem();
    sys.addEvent(banditAmbush);
    sys.addEvent(ruinDiscovery);
    sys.rollEvent(makeCtx({ gameTimeHours: 8, activeBiomeIds: ["forest"] }));

    const snap = sys.getSnapshot();
    const ruinSnap = snap.find((s) => s.id === "ruin_discovery");
    expect(ruinSnap?.fired).toBe(true);
    expect(ruinSnap?.lastFiredAt).toBe(8);
  });

  it("restores per-event state from a snapshot", () => {
    const sys = new TravelEventSystem();
    sys.addEvent(banditAmbush);
    const snapshots: TravelEventSnapshot[] = [
      { id: "bandit_ambush", lastFiredAt: 12, fired: true },
    ];
    sys.restoreSnapshot(snapshots);
    expect(sys.getLastFiredAt("bandit_ambush")).toBe(12);
    expect(sys.hasFired("bandit_ambush")).toBe(true);
  });

  it("ignores unknown ids during restore", () => {
    const sys = new TravelEventSystem();
    sys.addEvent(banditAmbush);
    const snapshots: TravelEventSnapshot[] = [
      { id: "bandit_ambush", lastFiredAt: 3, fired: false },
      { id: "no_such_event", lastFiredAt: 0, fired: true },
    ];
    expect(() => sys.restoreSnapshot(snapshots)).not.toThrow();
    expect(sys.getLastFiredAt("bandit_ambush")).toBe(3);
  });

  it("round-trips snapshot correctly", () => {
    const sys = new TravelEventSystem();
    sys.addEvent(banditAmbush);
    sys.addEvent(ruinDiscovery);
    sys.rollEvent(makeCtx({ activeBiomeIds: ["forest"], gameTimeHours: 5 }));

    const snap = sys.getSnapshot();

    const sys2 = new TravelEventSystem();
    sys2.addEvent(banditAmbush);
    sys2.addEvent(ruinDiscovery);
    sys2.restoreSnapshot(snap);

    expect(sys2.hasFired("ruin_discovery")).toBe(true);
    expect(sys2.getLastFiredAt("ruin_discovery")).toBe(5);
    expect(sys2.hasFired("bandit_ambush")).toBe(false);
  });

  it("does not fire onTravelEventFired during restoreSnapshot", () => {
    const sys = new TravelEventSystem();
    sys.addEvent(banditAmbush);
    const spy = vi.fn();
    sys.onTravelEventFired = spy;
    sys.restoreSnapshot([{ id: "bandit_ambush", lastFiredAt: 6, fired: true }]);
    expect(spy).not.toHaveBeenCalled();
  });

  it("restored one-shot events do not re-fire", () => {
    const sys = new TravelEventSystem();
    sys.addEvent(ruinDiscovery);
    sys.restoreSnapshot([{ id: "ruin_discovery", lastFiredAt: 4, fired: true }]);
    const outcome = sys.rollEvent(makeCtx({ activeBiomeIds: ["forest"] }));
    expect(outcome).toBeNull();
  });
});
