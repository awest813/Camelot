// ─── Event Manager System ────────────────────────────────────────────────────
// A headless "Dungeon Master" that owns, schedules, and fires managed world
// events.  The DM's *personality* (DMPersonality) acts as a set of personal
// options that shape which events are allowed, how often they fire, and how
// hostile or narrative the experience feels.
// ─────────────────────────────────────────────────────────────────────────────

// ── Difficulty ────────────────────────────────────────────────────────────────

export type DMDifficulty = "easy" | "normal" | "hard" | "legendary";

/** Maps each difficulty level to a numeric rank used for min-difficulty gates. */
const DIFFICULTY_RANK: Record<DMDifficulty, number> = {
  easy: 0,
  normal: 1,
  hard: 2,
  legendary: 3,
};

// ── Narrative tone ────────────────────────────────────────────────────────────

export type DMNarrativeTone = "heroic" | "grim" | "balanced";

// ── Event category ────────────────────────────────────────────────────────────

export type ManagedEventCategory =
  | "ambush"
  | "encounter"
  | "weather"
  | "narrative"
  | "mystery";

// ── DM Personality ────────────────────────────────────────────────────────────

/**
 * Personal options for the EventManager (Dungeon Master).  Each field controls
 * a distinct aspect of the DM's behaviour.
 */
export interface DMPersonality {
  /** Overall challenge level — gates events behind `minDifficulty`. */
  difficulty: DMDifficulty;
  /**
   * How often a freshly-eligible event is actually fired.
   * Range [0, 1].  0 = never, 1 = always.  Default 0.5.
   */
  eventFrequency: number;
  /**
   * Preference for hostile events (ambushes, hard encounters).
   * Range [0, 1].  0 = passive, 1 = maximally aggressive.  Default 0.5.
   */
  aggressiveness: number;
  /** Flavour modifier that content-layer systems can read. */
  narrativeTone: DMNarrativeTone;
  /** When false all ambush-category events are suppressed. */
  enableAmbushes: boolean;
  /** When false all encounter-category events are suppressed. */
  enableRandomEncounters: boolean;
  /** When false all weather-category events are suppressed. */
  enableWeatherEvents: boolean;
  /** When false all narrative-category NPC-interaction events are suppressed. */
  enableNPCInteractions: boolean;
}

const DEFAULT_PERSONALITY: DMPersonality = {
  difficulty: "normal",
  eventFrequency: 0.5,
  aggressiveness: 0.5,
  narrativeTone: "balanced",
  enableAmbushes: true,
  enableRandomEncounters: true,
  enableWeatherEvents: true,
  enableNPCInteractions: true,
};

// ── Event definition ──────────────────────────────────────────────────────────

/** A registered managed-event template. */
export interface ManagedEventDefinition {
  /** Unique identifier. */
  id: string;
  category: ManagedEventCategory;
  /** Short display title. */
  title: string;
  /** Longer description / flavour text. */
  description: string;
  /**
   * Relative selection weight used by `rollEvent()`.
   * Defaults to 1 when omitted.
   */
  weight?: number;
  /**
   * Minimum milliseconds that must elapse between successive firings of this
   * event.  Omit or set to 0 to disable cooldown.
   */
  cooldownMs?: number;
  /**
   * When true the event may only fire once per game session/save.
   * Subsequent attempts are silently skipped.
   */
  oneShot?: boolean;
  /**
   * If set, the event will not fire unless the DM's current difficulty is at
   * least this level.
   */
  minDifficulty?: DMDifficulty;
}

// ── Scheduled event ───────────────────────────────────────────────────────────

/** An event that has been queued for future dispatch. */
export interface ScheduledEvent {
  eventId: string;
  /** Timestamp (ms) when `scheduleEvent()` was called. */
  scheduledAt: number;
  /** Timestamp (ms) at or after which `tick()` may fire the event. */
  triggerAt: number;
  /** Arbitrary context payload forwarded to the fired event's callback. */
  context?: Record<string, unknown>;
}

// ── Save state ────────────────────────────────────────────────────────────────

export interface EventManagerSaveState {
  personality: DMPersonality;
  eventLog: Array<{ eventId: string; firedAt: number }>;
  scheduledEvents: ScheduledEvent[];
}

// ── System ────────────────────────────────────────────────────────────────────

export class EventManagerSystem {
  private _personality: DMPersonality = { ...DEFAULT_PERSONALITY };
  private _definitions = new Map<string, ManagedEventDefinition>();
  private _scheduledEvents: ScheduledEvent[] = [];
  private _eventLog: Array<{ eventId: string; firedAt: number }> = [];
  /** Tracks the timestamp of the last firing of each event (for cooldowns). */
  private _lastFiredAt = new Map<string, number>();
  /** Tracks events that have already fired and are `oneShot`. */
  private _firedOnce = new Set<string>();

  // ── Callbacks ──────────────────────────────────────────────────────────────

  /**
   * Invoked each time an event is fired.
   * Receives the event definition and any context payload.
   */
  public onEventTriggered:
    | ((eventId: string, def: ManagedEventDefinition, context?: Record<string, unknown>) => void)
    | null = null;

  /**
   * Invoked when `resolveEvent()` is called to explicitly close an active
   * event.
   */
  public onEventResolved: ((eventId: string) => void) | null = null;

  // ── Constructor ────────────────────────────────────────────────────────────

  /**
   * @param _now Clock function — injectable for deterministic testing.
   */
  constructor(private readonly _now: () => number = Date.now) {}

  // ── Personality / personal options ────────────────────────────────────────

  /**
   * Partially update the DM's personal options.  Unspecified fields keep their
   * current values.
   */
  public configure(options: Partial<DMPersonality>): void {
    this._personality = { ...this._personality, ...options };
    // Clamp numeric fields to valid ranges.
    this._personality.eventFrequency = Math.min(
      1,
      Math.max(0, this._personality.eventFrequency),
    );
    this._personality.aggressiveness = Math.min(
      1,
      Math.max(0, this._personality.aggressiveness),
    );
  }

  /** Returns a defensive copy of the current personality options. */
  public get personality(): Readonly<DMPersonality> {
    return { ...this._personality };
  }

  // ── Event registration ────────────────────────────────────────────────────

  /** Register or replace a managed-event definition. */
  public registerEvent(def: ManagedEventDefinition): void {
    this._definitions.set(def.id, { ...def });
  }

  /** Remove a registered event definition.  Returns true if it existed. */
  public unregisterEvent(id: string): boolean {
    return this._definitions.delete(id);
  }

  /** Retrieve a registered definition by id. */
  public getDefinition(id: string): ManagedEventDefinition | undefined {
    const d = this._definitions.get(id);
    return d ? { ...d } : undefined;
  }

  /** All registered definitions (defensive copies). */
  public getAllDefinitions(): ManagedEventDefinition[] {
    return Array.from(this._definitions.values()).map((d) => ({ ...d }));
  }

  /** Number of registered event definitions. */
  public get definitionCount(): number {
    return this._definitions.size;
  }

  // ── Scheduling ────────────────────────────────────────────────────────────

  /**
   * Schedule an event to be fired after `delayMs` milliseconds.
   * Multiple schedules of the same event are allowed.
   */
  public scheduleEvent(
    eventId: string,
    delayMs: number,
    context?: Record<string, unknown>,
  ): void {
    if (!this._definitions.has(eventId)) {
      throw new Error(`EventManagerSystem: unknown event id "${eventId}"`);
    }
    const now = this._now();
    this._scheduledEvents.push({
      eventId,
      scheduledAt: now,
      triggerAt: now + Math.max(0, delayMs),
      context,
    });
  }

  /**
   * Queue an event for immediate dispatch on the next `tick()` call.
   * Equivalent to `scheduleEvent(eventId, 0, context)`.
   */
  public queueEvent(eventId: string, context?: Record<string, unknown>): void {
    this.scheduleEvent(eventId, 0, context);
  }

  /**
   * Remove all pending scheduled entries for the given `eventId`.
   * Returns the number of entries removed.
   */
  public cancelScheduled(eventId: string): number {
    const before = this._scheduledEvents.length;
    this._scheduledEvents = this._scheduledEvents.filter(
      (e) => e.eventId !== eventId,
    );
    return before - this._scheduledEvents.length;
  }

  /** All currently pending scheduled events (defensive copies). */
  public getScheduledEvents(): ScheduledEvent[] {
    return this._scheduledEvents.map((e) => ({ ...e }));
  }

  /** Number of events currently in the scheduled queue. */
  public get scheduledCount(): number {
    return this._scheduledEvents.length;
  }

  // ── Tick ──────────────────────────────────────────────────────────────────

  /**
   * Process the scheduled queue.  All entries whose `triggerAt` ≤ `now()` are
   * dequeued and fired (subject to personality filters, cooldowns, one-shot
   * guards, and difficulty gates).
   *
   * Returns an array of the definitions that were actually fired this tick.
   */
  public tick(rng: () => number = Math.random): ManagedEventDefinition[] {
    const now = this._now();
    const due: ScheduledEvent[] = [];
    const remaining: ScheduledEvent[] = [];

    for (const entry of this._scheduledEvents) {
      if (entry.triggerAt <= now) {
        due.push(entry);
      } else {
        remaining.push(entry);
      }
    }

    this._scheduledEvents = remaining;

    const fired: ManagedEventDefinition[] = [];
    for (const entry of due) {
      const def = this._definitions.get(entry.eventId);
      if (!def) continue;
      if (!this._canFire(def, rng)) continue;

      this._recordFiring(def.id, now);
      fired.push({ ...def });
      this.onEventTriggered?.(def.id, { ...def }, entry.context);
    }

    return fired;
  }

  // ── Manual trigger ────────────────────────────────────────────────────────

  /**
   * Immediately fire an event, bypassing the scheduled queue.
   * Personality filters, cooldowns, one-shot guards, and difficulty gates
   * still apply.
   *
   * Returns `true` if the event fired.
   */
  public triggerEvent(
    eventId: string,
    context?: Record<string, unknown>,
    rng: () => number = Math.random,
  ): boolean {
    const def = this._definitions.get(eventId);
    if (!def) return false;
    if (!this._canFire(def, rng)) return false;

    const now = this._now();
    this._recordFiring(def.id, now);
    this.onEventTriggered?.(def.id, { ...def }, context);
    return true;
  }

  /**
   * Explicitly resolve (close) a previously-fired event.
   * Fires `onEventResolved` callback if set.
   */
  public resolveEvent(eventId: string): void {
    this.onEventResolved?.(eventId);
  }

  // ── Weighted roll ─────────────────────────────────────────────────────────

  /**
   * Randomly pick an eligible event from all registered definitions using
   * weighted selection, then fire it.
   *
   * "Eligible" means: category is enabled, passes difficulty gate, not on
   * cooldown, and not a spent one-shot.
   *
   * Returns the fired definition or `null` if nothing was eligible / selected.
   */
  public rollEvent(
    rng: () => number = Math.random,
    context?: Record<string, unknown>,
  ): ManagedEventDefinition | null {
    const eligible = Array.from(this._definitions.values()).filter((def) =>
      // Pass skipFreq=true so that the frequency gate is applied once below on
      // the final selected event, not redundantly on every candidate.
      this._canFire(def, rng, true),
    );
    if (eligible.length === 0) return null;

    // Weighted selection.
    const totalWeight = eligible.reduce(
      (sum, d) => sum + (d.weight ?? 1),
      0,
    );
    let cursor = rng() * totalWeight;
    let chosen: ManagedEventDefinition | null = null;
    for (const def of eligible) {
      cursor -= def.weight ?? 1;
      if (cursor <= 0) {
        chosen = def;
        break;
      }
    }
    // Floating-point fallback: pick last eligible.
    if (!chosen) chosen = eligible[eligible.length - 1];

    // Apply frequency gate before committing.
    if (rng() >= this._personality.eventFrequency) return null;

    const now = this._now();
    this._recordFiring(chosen.id, now);
    this.onEventTriggered?.(chosen.id, { ...chosen }, context);
    return { ...chosen };
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  /** Chronological list of every event that has been fired this session. */
  public getEventLog(): Array<{ eventId: string; firedAt: number }> {
    return this._eventLog.map((e) => ({ ...e }));
  }

  /** Returns the timestamp the given event last fired, or `undefined`. */
  public getLastFiredAt(eventId: string): number | undefined {
    return this._lastFiredAt.get(eventId);
  }

  /** Returns `true` if the given event has fired at least once. */
  public wasEventFired(eventId: string): boolean {
    return this._lastFiredAt.has(eventId);
  }

  /** Total number of events fired. */
  public get totalFired(): number {
    return this._eventLog.length;
  }

  /** Clear the in-memory event log. Does NOT reset cooldowns or one-shot flags. */
  public clearLog(): void {
    this._eventLog = [];
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  public getSaveState(): EventManagerSaveState {
    return {
      personality: { ...this._personality },
      eventLog: this._eventLog.map((e) => ({ ...e })),
      scheduledEvents: this._scheduledEvents.map((e) => ({ ...e })),
    };
  }

  public restoreFromSave(state: EventManagerSaveState): void {
    if (!state) return;

    if (state.personality && typeof state.personality === "object") {
      this.configure(state.personality);
    }

    this._eventLog = [];
    this._lastFiredAt.clear();
    this._firedOnce.clear();
    for (const entry of state.eventLog ?? []) {
      if (typeof entry.eventId === "string" && typeof entry.firedAt === "number") {
        this._eventLog.push({ ...entry });
        // Rebuild cooldown / one-shot state from the log.
        const prev = this._lastFiredAt.get(entry.eventId);
        if (prev === undefined || entry.firedAt > prev) {
          this._lastFiredAt.set(entry.eventId, entry.firedAt);
        }
        const def = this._definitions.get(entry.eventId);
        if (def?.oneShot) {
          this._firedOnce.add(entry.eventId);
        }
      }
    }

    this._scheduledEvents = [];
    for (const entry of state.scheduledEvents ?? []) {
      if (
        typeof entry.eventId === "string" &&
        typeof entry.scheduledAt === "number" &&
        typeof entry.triggerAt === "number"
      ) {
        this._scheduledEvents.push({ ...entry });
      }
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Returns `true` if the event is allowed to fire given the current
   * personality, cooldown state, one-shot flags, and difficulty gates.
   *
   * @param rng         Random number generator used for the frequency gate.
   * @param skipFreq    When `true` the stochastic frequency gate is skipped
   *                    (used by `rollEvent`'s eligibility pass so that the gate
   *                    is applied once on the final selected event rather than
   *                    during candidate filtering).
   */
  private _canFire(
    def: ManagedEventDefinition,
    rng: () => number,
    skipFreq = false,
  ): boolean {
    // Category toggles.
    if (!this._isCategoryEnabled(def.category)) return false;

    // Difficulty gate.
    if (def.minDifficulty !== undefined) {
      if (
        DIFFICULTY_RANK[this._personality.difficulty] <
        DIFFICULTY_RANK[def.minDifficulty]
      ) {
        return false;
      }
    }

    // One-shot guard.
    if (def.oneShot && this._firedOnce.has(def.id)) return false;

    // Cooldown.
    const cooldownMs = def.cooldownMs ?? 0;
    if (cooldownMs > 0) {
      const last = this._lastFiredAt.get(def.id);
      if (last !== undefined && this._now() - last < cooldownMs) {
        return false;
      }
    }

    // Stochastic frequency gate.
    // rng() is in [0, 1). Using >= means eventFrequency 0 ⟹ never fires,
    // eventFrequency 1 ⟹ always fires (since rng() < 1 always).
    if (!skipFreq && rng() >= this._personality.eventFrequency) return false;

    return true;
  }

  /** Returns `true` when the given category is currently enabled. */
  private _isCategoryEnabled(category: ManagedEventCategory): boolean {
    switch (category) {
      case "ambush":
        return this._personality.enableAmbushes;
      case "encounter":
        return this._personality.enableRandomEncounters;
      case "weather":
        return this._personality.enableWeatherEvents;
      case "narrative":
        return this._personality.enableNPCInteractions;
      case "mystery":
        return true; // Mystery events are always allowed.
      default:
        return true;
    }
  }

  /** Record a firing in the log, cooldown tracker, and one-shot set. */
  private _recordFiring(eventId: string, now: number): void {
    this._eventLog.push({ eventId, firedAt: now });
    this._lastFiredAt.set(eventId, now);
    const def = this._definitions.get(eventId);
    if (def?.oneShot) {
      this._firedOnce.add(eventId);
    }
  }
}
