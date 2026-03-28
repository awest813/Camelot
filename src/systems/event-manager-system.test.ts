import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EventManagerSystem,
  type DMPersonality,
  type ManagedEventDefinition,
} from "./event-manager-system";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ambushDef: ManagedEventDefinition = {
  id: "bandit-ambush",
  category: "ambush",
  title: "Bandit Ambush",
  description: "A group of bandits blocks the road.",
  weight: 2,
};

const encounterDef: ManagedEventDefinition = {
  id: "merchant-meeting",
  category: "encounter",
  title: "Travelling Merchant",
  description: "A merchant offers rare wares.",
  weight: 1,
};

const weatherDef: ManagedEventDefinition = {
  id: "sudden-storm",
  category: "weather",
  title: "Sudden Storm",
  description: "Dark clouds roll in.",
};

const narrativeDef: ManagedEventDefinition = {
  id: "npc-lore",
  category: "narrative",
  title: "Local Legend",
  description: "An elder shares a tale.",
};

const mysteryDef: ManagedEventDefinition = {
  id: "strange-rune",
  category: "mystery",
  title: "Strange Rune",
  description: "A glowing sigil on the ground.",
};

const oneShotDef: ManagedEventDefinition = {
  id: "dragon-sighting",
  category: "mystery",
  title: "Dragon Sighting",
  description: "A shadow passes overhead.",
  oneShot: true,
};

const cooldownDef: ManagedEventDefinition = {
  id: "wolf-pack",
  category: "encounter",
  title: "Wolf Pack",
  description: "Wolves circle the campfire.",
  cooldownMs: 5000,
};

const hardDef: ManagedEventDefinition = {
  id: "death-knight",
  category: "ambush",
  title: "Death Knight",
  description: "An undead warrior emerges.",
  minDifficulty: "hard",
};

// RNG helpers
const rngAlways = (): number => 0;       // always ≤ frequency → always fires
const rngNever  = (): number => 0.9999;  // always > frequency → never fires

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("EventManagerSystem — personality / personal options", () => {
  it("has sensible defaults", () => {
    const em = new EventManagerSystem();
    const p = em.personality;
    expect(p.difficulty).toBe("normal");
    expect(p.eventFrequency).toBe(0.5);
    expect(p.aggressiveness).toBe(0.5);
    expect(p.narrativeTone).toBe("balanced");
    expect(p.enableAmbushes).toBe(true);
    expect(p.enableRandomEncounters).toBe(true);
    expect(p.enableWeatherEvents).toBe(true);
    expect(p.enableNPCInteractions).toBe(true);
  });

  it("configure() merges partial options", () => {
    const em = new EventManagerSystem();
    em.configure({ difficulty: "hard", narrativeTone: "grim" });
    const p = em.personality;
    expect(p.difficulty).toBe("hard");
    expect(p.narrativeTone).toBe("grim");
    // Unmodified fields retained.
    expect(p.eventFrequency).toBe(0.5);
    expect(p.enableAmbushes).toBe(true);
  });

  it("configure() clamps eventFrequency to [0, 1]", () => {
    const em = new EventManagerSystem();
    em.configure({ eventFrequency: 5 });
    expect(em.personality.eventFrequency).toBe(1);
    em.configure({ eventFrequency: -3 });
    expect(em.personality.eventFrequency).toBe(0);
  });

  it("configure() clamps aggressiveness to [0, 1]", () => {
    const em = new EventManagerSystem();
    em.configure({ aggressiveness: 99 });
    expect(em.personality.aggressiveness).toBe(1);
    em.configure({ aggressiveness: -1 });
    expect(em.personality.aggressiveness).toBe(0);
  });

  it("personality getter returns a defensive copy", () => {
    const em = new EventManagerSystem();
    const p = em.personality as DMPersonality;
    p.difficulty = "legendary";
    expect(em.personality.difficulty).toBe("normal");
  });
});

// ── CRUD ──────────────────────────────────────────────────────────────────────

describe("EventManagerSystem — event registration (CRUD)", () => {
  let em: EventManagerSystem;
  beforeEach(() => { em = new EventManagerSystem(); });

  it("registerEvent() adds a definition", () => {
    em.registerEvent(ambushDef);
    expect(em.definitionCount).toBe(1);
  });

  it("getDefinition() returns a defensive copy", () => {
    em.registerEvent(ambushDef);
    const d = em.getDefinition("bandit-ambush")!;
    d.title = "Modified";
    expect(em.getDefinition("bandit-ambush")!.title).toBe("Bandit Ambush");
  });

  it("getDefinition() returns undefined for unknown id", () => {
    expect(em.getDefinition("nope")).toBeUndefined();
  });

  it("getAllDefinitions() returns all registered defs", () => {
    em.registerEvent(ambushDef);
    em.registerEvent(encounterDef);
    expect(em.getAllDefinitions()).toHaveLength(2);
  });

  it("registerEvent() replaces an existing definition", () => {
    em.registerEvent(ambushDef);
    em.registerEvent({ ...ambushDef, title: "Updated" });
    expect(em.getDefinition("bandit-ambush")!.title).toBe("Updated");
    expect(em.definitionCount).toBe(1);
  });

  it("unregisterEvent() removes a definition and returns true", () => {
    em.registerEvent(ambushDef);
    expect(em.unregisterEvent("bandit-ambush")).toBe(true);
    expect(em.definitionCount).toBe(0);
  });

  it("unregisterEvent() returns false for unknown id", () => {
    expect(em.unregisterEvent("ghost")).toBe(false);
  });
});

// ── Scheduling ────────────────────────────────────────────────────────────────

describe("EventManagerSystem — scheduling", () => {
  let clock: number;
  let em: EventManagerSystem;
  beforeEach(() => {
    clock = 1000;
    em = new EventManagerSystem(() => clock);
    em.registerEvent(ambushDef);
    em.configure({ eventFrequency: 1 }); // always fire
  });

  it("scheduleEvent() adds to the queue", () => {
    em.scheduleEvent("bandit-ambush", 500);
    expect(em.scheduledCount).toBe(1);
  });

  it("queueEvent() schedules with zero delay", () => {
    em.queueEvent("bandit-ambush");
    const [entry] = em.getScheduledEvents();
    expect(entry.triggerAt).toBe(1000);
  });

  it("getScheduledEvents() returns defensive copies", () => {
    em.scheduleEvent("bandit-ambush", 0);
    const [entry] = em.getScheduledEvents();
    entry.eventId = "tampered";
    expect(em.getScheduledEvents()[0].eventId).toBe("bandit-ambush");
  });

  it("scheduleEvent() throws for unknown event id", () => {
    expect(() => em.scheduleEvent("ghost", 0)).toThrow(/unknown event id/);
  });

  it("cancelScheduled() removes matching entries and returns count", () => {
    em.scheduleEvent("bandit-ambush", 100);
    em.scheduleEvent("bandit-ambush", 200);
    expect(em.cancelScheduled("bandit-ambush")).toBe(2);
    expect(em.scheduledCount).toBe(0);
  });

  it("cancelScheduled() returns 0 when nothing matches", () => {
    expect(em.cancelScheduled("bandit-ambush")).toBe(0);
  });

  it("scheduleEvent() accepts a context payload", () => {
    em.scheduleEvent("bandit-ambush", 0, { region: "darkwood" });
    const [entry] = em.getScheduledEvents();
    expect(entry.context?.region).toBe("darkwood");
  });
});

// ── Tick ──────────────────────────────────────────────────────────────────────

describe("EventManagerSystem — tick()", () => {
  let clock: number;
  let em: EventManagerSystem;
  beforeEach(() => {
    clock = 1000;
    em = new EventManagerSystem(() => clock);
    em.registerEvent(ambushDef);
    em.configure({ eventFrequency: 1 });
  });

  it("fires due events and removes them from the queue", () => {
    em.queueEvent("bandit-ambush");
    const fired = em.tick(rngAlways);
    expect(fired).toHaveLength(1);
    expect(fired[0].id).toBe("bandit-ambush");
    expect(em.scheduledCount).toBe(0);
  });

  it("does not fire events that are not yet due", () => {
    em.scheduleEvent("bandit-ambush", 5000);
    const fired = em.tick(rngAlways);
    expect(fired).toHaveLength(0);
    expect(em.scheduledCount).toBe(1);
  });

  it("fires event when clock advances past triggerAt", () => {
    em.scheduleEvent("bandit-ambush", 2000);
    clock = 3001;
    const fired = em.tick(rngAlways);
    expect(fired).toHaveLength(1);
  });

  it("tick() invokes onEventTriggered callback", () => {
    const spy = vi.fn();
    em.onEventTriggered = spy;
    em.queueEvent("bandit-ambush", { region: "forest" });
    em.tick(rngAlways);
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(
      "bandit-ambush",
      expect.objectContaining({ id: "bandit-ambush" }),
      { region: "forest" },
    );
  });

  it("tick() returns defensive copies of definitions", () => {
    em.queueEvent("bandit-ambush");
    const [fired] = em.tick(rngAlways);
    fired.title = "Tampered";
    expect(em.getDefinition("bandit-ambush")!.title).toBe("Bandit Ambush");
  });
});

// ── Category filters ──────────────────────────────────────────────────────────

describe("EventManagerSystem — category filters", () => {
  let em: EventManagerSystem;
  beforeEach(() => {
    em = new EventManagerSystem();
    em.configure({ eventFrequency: 1 });
    [ambushDef, encounterDef, weatherDef, narrativeDef, mysteryDef].forEach(
      (d) => em.registerEvent(d),
    );
  });

  it("disabling ambushes suppresses ambush-category events", () => {
    em.configure({ enableAmbushes: false });
    expect(em.triggerEvent("bandit-ambush", undefined, rngAlways)).toBe(false);
  });

  it("disabling encounters suppresses encounter-category events", () => {
    em.configure({ enableRandomEncounters: false });
    expect(em.triggerEvent("merchant-meeting", undefined, rngAlways)).toBe(false);
  });

  it("disabling weather suppresses weather-category events", () => {
    em.configure({ enableWeatherEvents: false });
    expect(em.triggerEvent("sudden-storm", undefined, rngAlways)).toBe(false);
  });

  it("disabling NPC interactions suppresses narrative-category events", () => {
    em.configure({ enableNPCInteractions: false });
    expect(em.triggerEvent("npc-lore", undefined, rngAlways)).toBe(false);
  });

  it("mystery events are always allowed regardless of toggles", () => {
    expect(em.triggerEvent("strange-rune", undefined, rngAlways)).toBe(true);
  });

  it("re-enabling a category allows events again", () => {
    em.configure({ enableAmbushes: false });
    em.configure({ enableAmbushes: true });
    expect(em.triggerEvent("bandit-ambush", undefined, rngAlways)).toBe(true);
  });
});

// ── Difficulty gate ───────────────────────────────────────────────────────────

describe("EventManagerSystem — difficulty gate", () => {
  let em: EventManagerSystem;
  beforeEach(() => {
    em = new EventManagerSystem();
    em.registerEvent(hardDef);
    em.configure({ eventFrequency: 1 });
  });

  it("does not fire an event below its minDifficulty", () => {
    em.configure({ difficulty: "normal" });
    expect(em.triggerEvent("death-knight", undefined, rngAlways)).toBe(false);
  });

  it("fires an event at exactly its minDifficulty", () => {
    em.configure({ difficulty: "hard" });
    expect(em.triggerEvent("death-knight", undefined, rngAlways)).toBe(true);
  });

  it("fires an event above its minDifficulty", () => {
    em.configure({ difficulty: "legendary" });
    expect(em.triggerEvent("death-knight", undefined, rngAlways)).toBe(true);
  });
});

// ── Cooldown ──────────────────────────────────────────────────────────────────

describe("EventManagerSystem — cooldown", () => {
  let clock: number;
  let em: EventManagerSystem;
  beforeEach(() => {
    clock = 1000;
    em = new EventManagerSystem(() => clock);
    em.registerEvent(cooldownDef);
    em.configure({ eventFrequency: 1 });
  });

  it("fires the first time (no prior fire)", () => {
    expect(em.triggerEvent("wolf-pack", undefined, rngAlways)).toBe(true);
  });

  it("does not fire again while on cooldown", () => {
    em.triggerEvent("wolf-pack", undefined, rngAlways);
    clock = 3000; // only 2 s elapsed, cooldown is 5 s
    expect(em.triggerEvent("wolf-pack", undefined, rngAlways)).toBe(false);
  });

  it("fires again after cooldown expires", () => {
    em.triggerEvent("wolf-pack", undefined, rngAlways);
    clock = 7000; // 6 s elapsed, cooldown is 5 s
    expect(em.triggerEvent("wolf-pack", undefined, rngAlways)).toBe(true);
  });
});

// ── One-shot ──────────────────────────────────────────────────────────────────

describe("EventManagerSystem — one-shot", () => {
  let em: EventManagerSystem;
  beforeEach(() => {
    em = new EventManagerSystem();
    em.registerEvent(oneShotDef);
    em.configure({ eventFrequency: 1 });
  });

  it("fires a one-shot event the first time", () => {
    expect(em.triggerEvent("dragon-sighting", undefined, rngAlways)).toBe(true);
  });

  it("does not fire a one-shot event a second time", () => {
    em.triggerEvent("dragon-sighting", undefined, rngAlways);
    expect(em.triggerEvent("dragon-sighting", undefined, rngAlways)).toBe(false);
  });
});

// ── triggerEvent + resolveEvent ───────────────────────────────────────────────

describe("EventManagerSystem — triggerEvent / resolveEvent", () => {
  let em: EventManagerSystem;
  beforeEach(() => {
    em = new EventManagerSystem();
    em.registerEvent(ambushDef);
    em.configure({ eventFrequency: 1 });
  });

  it("triggerEvent() returns false for unknown event", () => {
    expect(em.triggerEvent("ghost", undefined, rngAlways)).toBe(false);
  });

  it("triggerEvent() fires onEventTriggered", () => {
    const spy = vi.fn();
    em.onEventTriggered = spy;
    em.triggerEvent("bandit-ambush", { loc: "crossroads" }, rngAlways);
    expect(spy).toHaveBeenCalledWith(
      "bandit-ambush",
      expect.objectContaining({ id: "bandit-ambush" }),
      { loc: "crossroads" },
    );
  });

  it("resolveEvent() fires onEventResolved", () => {
    const spy = vi.fn();
    em.onEventResolved = spy;
    em.resolveEvent("bandit-ambush");
    expect(spy).toHaveBeenCalledWith("bandit-ambush");
  });
});

// ── Frequency gate ────────────────────────────────────────────────────────────

describe("EventManagerSystem — event frequency gate", () => {
  it("eventFrequency 0 prevents all events", () => {
    const em = new EventManagerSystem();
    em.registerEvent(ambushDef);
    em.configure({ eventFrequency: 0 });
    expect(em.triggerEvent("bandit-ambush", undefined, rngAlways)).toBe(false);
  });

  it("eventFrequency 1 allows events when rng returns 0", () => {
    const em = new EventManagerSystem();
    em.registerEvent(ambushDef);
    em.configure({ eventFrequency: 1 });
    expect(em.triggerEvent("bandit-ambush", undefined, rngAlways)).toBe(true);
  });
});

// ── rollEvent ─────────────────────────────────────────────────────────────────

describe("EventManagerSystem — rollEvent()", () => {
  let em: EventManagerSystem;
  beforeEach(() => {
    em = new EventManagerSystem();
    em.configure({ eventFrequency: 1 });
    em.registerEvent(ambushDef);
    em.registerEvent(encounterDef);
  });

  it("returns null when no events registered", () => {
    const fresh = new EventManagerSystem();
    fresh.configure({ eventFrequency: 1 });
    expect(fresh.rollEvent(rngAlways)).toBeNull();
  });

  it("selects the first (heaviest) event when rng → 0", () => {
    // ambushDef has weight 2, encounterDef weight 1 → first cursor hits ambush.
    const result = em.rollEvent(() => 0);
    expect(result?.id).toBe("bandit-ambush");
  });

  it("returns null when frequency gate blocks", () => {
    // Pass rngNever — second rng call (for frequency) returns 0.9999 > 1 → blocked.
    // But rollEvent passes rng twice: once for weighted select, once for frequency.
    // To ensure the frequency check blocks, supply a rng that always returns 1.
    const em2 = new EventManagerSystem();
    em2.registerEvent(ambushDef);
    em2.configure({ eventFrequency: 0 });
    expect(em2.rollEvent(rngAlways)).toBeNull();
  });

  it("fires onEventTriggered on a successful roll", () => {
    const spy = vi.fn();
    em.onEventTriggered = spy;
    em.rollEvent(rngAlways);
    expect(spy).toHaveBeenCalledOnce();
  });

  it("records the roll in the event log", () => {
    em.rollEvent(rngAlways);
    expect(em.totalFired).toBe(1);
  });
});

// ── Event log + query helpers ─────────────────────────────────────────────────

describe("EventManagerSystem — event log and queries", () => {
  let clock: number;
  let em: EventManagerSystem;
  beforeEach(() => {
    clock = 2000;
    em = new EventManagerSystem(() => clock);
    em.registerEvent(ambushDef);
    em.configure({ eventFrequency: 1 });
  });

  it("wasEventFired() returns false before any firing", () => {
    expect(em.wasEventFired("bandit-ambush")).toBe(false);
  });

  it("wasEventFired() returns true after firing", () => {
    em.triggerEvent("bandit-ambush", undefined, rngAlways);
    expect(em.wasEventFired("bandit-ambush")).toBe(true);
  });

  it("getLastFiredAt() returns the clock timestamp", () => {
    em.triggerEvent("bandit-ambush", undefined, rngAlways);
    expect(em.getLastFiredAt("bandit-ambush")).toBe(2000);
  });

  it("getLastFiredAt() returns undefined before any firing", () => {
    expect(em.getLastFiredAt("bandit-ambush")).toBeUndefined();
  });

  it("totalFired increments on each firing", () => {
    em.triggerEvent("bandit-ambush", undefined, rngAlways);
    clock = 99999;
    em.triggerEvent("bandit-ambush", undefined, rngAlways);
    expect(em.totalFired).toBe(2);
  });

  it("getEventLog() returns defensive copies", () => {
    em.triggerEvent("bandit-ambush", undefined, rngAlways);
    const [entry] = em.getEventLog();
    entry.eventId = "tampered";
    expect(em.getEventLog()[0].eventId).toBe("bandit-ambush");
  });

  it("clearLog() resets the log without affecting cooldowns", () => {
    em.registerEvent(cooldownDef);
    em.triggerEvent("wolf-pack", undefined, rngAlways);
    em.clearLog();
    expect(em.totalFired).toBe(0);
    // Cooldown is still active because _lastFiredAt is not cleared.
    expect(em.getLastFiredAt("wolf-pack")).toBe(2000);
  });
});

// ── Snapshot / restore ────────────────────────────────────────────────────────

describe("EventManagerSystem — getSaveState() / restoreFromSave()", () => {
  let clock: number;
  let em: EventManagerSystem;
  beforeEach(() => {
    clock = 5000;
    em = new EventManagerSystem(() => clock);
    em.registerEvent(ambushDef);
    em.registerEvent(oneShotDef);
    em.registerEvent(cooldownDef);
    em.configure({ eventFrequency: 1, difficulty: "hard", narrativeTone: "grim" });
  });

  it("getSaveState() captures personality", () => {
    const state = em.getSaveState();
    expect(state.personality.difficulty).toBe("hard");
    expect(state.personality.narrativeTone).toBe("grim");
  });

  it("getSaveState() captures event log", () => {
    em.triggerEvent("bandit-ambush", undefined, rngAlways);
    const state = em.getSaveState();
    expect(state.eventLog).toHaveLength(1);
    expect(state.eventLog[0].eventId).toBe("bandit-ambush");
  });

  it("getSaveState() captures scheduled events", () => {
    em.scheduleEvent("bandit-ambush", 3000);
    const state = em.getSaveState();
    expect(state.scheduledEvents).toHaveLength(1);
  });

  it("restoreFromSave() round-trips personality", () => {
    const state = em.getSaveState();
    const em2 = new EventManagerSystem(() => clock);
    em2.restoreFromSave(state);
    expect(em2.personality.difficulty).toBe("hard");
    expect(em2.personality.narrativeTone).toBe("grim");
  });

  it("restoreFromSave() round-trips event log", () => {
    em.triggerEvent("bandit-ambush", undefined, rngAlways);
    const state = em.getSaveState();
    const em2 = new EventManagerSystem(() => clock);
    em2.registerEvent(ambushDef);
    em2.restoreFromSave(state);
    expect(em2.wasEventFired("bandit-ambush")).toBe(true);
    expect(em2.totalFired).toBe(1);
  });

  it("restoreFromSave() restores cooldown state from log", () => {
    em.triggerEvent("wolf-pack", undefined, rngAlways);
    const state = em.getSaveState();

    const em2 = new EventManagerSystem(() => clock);
    em2.registerEvent(cooldownDef);
    em2.configure({ eventFrequency: 1 });
    em2.restoreFromSave(state);

    // Cooldown is still active right after restore (same clock = 5000, fired at 5000).
    expect(em2.triggerEvent("wolf-pack", undefined, rngAlways)).toBe(false);
  });

  it("restoreFromSave() restores one-shot guard from log", () => {
    em.triggerEvent("dragon-sighting", undefined, rngAlways);
    const state = em.getSaveState();

    const em2 = new EventManagerSystem(() => clock);
    em2.registerEvent(oneShotDef);
    em2.configure({ eventFrequency: 1 });
    em2.restoreFromSave(state);

    expect(em2.triggerEvent("dragon-sighting", undefined, rngAlways)).toBe(false);
  });

  it("restoreFromSave() round-trips scheduled events", () => {
    em.scheduleEvent("bandit-ambush", 9000);
    const state = em.getSaveState();

    const em2 = new EventManagerSystem(() => clock);
    em2.registerEvent(ambushDef);
    em2.restoreFromSave(state);

    expect(em2.scheduledCount).toBe(1);
    expect(em2.getScheduledEvents()[0].eventId).toBe("bandit-ambush");
  });

  it("restoreFromSave() is defensive against null/undefined state", () => {
    expect(() =>
      em.restoreFromSave(null as unknown as ReturnType<EventManagerSystem["getSaveState"]>),
    ).not.toThrow();
  });
});
