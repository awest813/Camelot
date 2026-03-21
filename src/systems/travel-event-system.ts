/**
 * TravelEventSystem — Random events during fast travel for Camelot.
 *
 * Manages named travel-event templates each carrying conditions (biome,
 * weather, player level, flags) and an outcome (notification, flags, emitted
 * events, landmark discovery).  When the game layer calls
 * `rollEvent(context, rng?)`, the system performs a weighted random draw
 * among all eligible events, applies the outcome, and fires
 * `onTravelEventFired`.
 *
 * Headless: no BabylonJS dependencies — all state is supplied by the caller
 * via a lightweight `TravelContext`.
 */

// ── Conditions ────────────────────────────────────────────────────────────────

/**
 * Conditions that must ALL be satisfied for a travel event to be eligible.
 * Every field is optional; an empty conditions object always matches.
 */
export interface TravelEventCondition {
  /**
   * At least one of these biome ids must be present in
   * `context.activeBiomeIds` for the event to be eligible.
   * When omitted, any biome (or no biome) matches.
   */
  biomeIds?: string[];
  /**
   * Allowed weather state ids (e.g. "Clear", "Rain", "Storm").
   * At least one must match `context.weatherId` when provided.
   * When omitted, any weather (or no weather) matches.
   */
  weather?: string[];
  /** Minimum player character level required. */
  minPlayerLevel?: number;
  /** All listed flags must be truthy in `context.getFlag()`. */
  requiredFlags?: string[];
  /** None of these flags may be truthy in `context.getFlag()`. */
  forbiddenFlags?: string[];
}

// ── Outcome ───────────────────────────────────────────────────────────────────

/**
 * Side-effects delivered when a travel event fires.
 * All fields are optional; the game layer wires them to HUD, EventBus, etc.
 */
export interface TravelEventOutcome {
  /** Notification text to display to the player. */
  notification?: string;
  /** Game flag to set when the event fires. */
  setFlag?: string;
  /** Game event id to emit via `context.emitEvent`. */
  emitEvent?: string;
  /**
   * Landmark id to auto-discover (via `context.discoverLandmark`) when the
   * event fires.  Useful for "you stumble across a ruin" moments during travel.
   */
  landmarkId?: string;
}

// ── Definition ────────────────────────────────────────────────────────────────

/** Static configuration for a named travel event. */
export interface TravelEventDefinition {
  /** Stable unique identifier. */
  id: string;
  /** Human-readable label used in logs / debug overlays. */
  label: string;
  /** Optional lore/design description. */
  description?: string;
  /**
   * Conditions that must ALL be satisfied for this event to be eligible.
   * An empty object means the event is always eligible (subject to cooldown).
   */
  conditions: TravelEventCondition;
  /** Outcome delivered when the event fires. */
  outcome: TravelEventOutcome;
  /**
   * Relative probability weight for the weighted-random draw.
   * Higher weight = appears more often when eligible.  Defaults to 1.
   */
  weight?: number;
  /**
   * Minimum in-game hours before this event can fire again.
   * Defaults to 0 (no cooldown).
   */
  cooldownHours?: number;
  /**
   * When `true` the event fires exactly once in a play-through and is then
   * permanently suppressed regardless of cooldown.
   */
  oneShot?: boolean;
}

// ── Context ───────────────────────────────────────────────────────────────────

/**
 * Runtime context supplied by the game layer when calling `rollEvent()`.
 * All optional fields are treated as "unknown / not applicable" when absent.
 */
export interface TravelContext {
  /** Current in-game time expressed as fractional hours in [0, 24). */
  gameTimeHours: number;
  /** Biome ids the player is travelling through. */
  activeBiomeIds?: string[];
  /** Active weather state id (e.g. "Clear", "Storm"). */
  weatherId?: string;
  /** Current player character level. */
  playerLevel?: number;
  /** Read a named game flag. */
  getFlag?: (flag: string) => boolean;
  /** Write a named game flag (used to apply `setFlag` outcomes). */
  setFlag?: (flag: string, value: boolean) => void;
  /** Emit a game event by id (used to apply `emitEvent` outcomes). */
  emitEvent?: (eventId: string) => void;
  /**
   * Discover a landmark by id (used to apply `landmarkId` outcomes).
   * The game layer wires this to `LandmarkSystem.discoverLandmark()`.
   */
  discoverLandmark?: (landmarkId: string) => void;
}

// ── Runtime record ────────────────────────────────────────────────────────────

interface TravelEventRecord {
  definition: TravelEventDefinition;
  /** In-game hours when this event last fired; `null` = never. */
  lastFiredAt: number | null;
  /** Whether a one-shot event has already fired. */
  fired: boolean;
}

// ── Snapshot ──────────────────────────────────────────────────────────────────

/** Persisted per-event runtime state. */
export interface TravelEventSnapshot {
  id: string;
  lastFiredAt: number | null;
  fired: boolean;
}

// ── System ────────────────────────────────────────────────────────────────────

/**
 * Schedules and fires random travel events during fast travel.
 *
 * **Typical game-layer usage:**
 * ```ts
 * travelEventSystem.onTravelEventFired = (id, outcome) => {
 *   if (outcome.notification)  hud.notify(outcome.notification);
 *   if (outcome.emitEvent)     eventBus.emit(outcome.emitEvent);
 *   if (outcome.landmarkId)    landmarkSystem.discoverLandmark(outcome.landmarkId);
 * };
 *
 * // Called by FastTravelSystem once per simulated hour of travel:
 * travelEventSystem.rollEvent({
 *   gameTimeHours: timeSystem.gameHour,
 *   activeBiomeIds: biomeSystem.getCurrentBiomeIds(),
 *   weatherId:      weatherSystem.currentWeather,
 *   playerLevel:    playerLevelSystem.characterLevel,
 *   getFlag:        (f) => flags.get(f) ?? false,
 *   setFlag:        (f, v) => flags.set(f, v),
 *   emitEvent:      (e) => eventBus.emit(e),
 *   discoverLandmark: (id) => landmarkSystem.discoverLandmark(id),
 * });
 * ```
 */
export class TravelEventSystem {
  private _events: Map<string, TravelEventRecord> = new Map();
  private _totalEventsFired: number = 0;

  // ── Callbacks ─────────────────────────────────────────────────────────────

  /**
   * Fired when a travel event is selected and its outcome applied.
   * The game layer should handle remaining side-effects (HUD, EventBus, etc.).
   */
  public onTravelEventFired:
    | ((eventId: string, outcome: TravelEventOutcome) => void)
    | null = null;

  // ── CRUD ──────────────────────────────────────────────────────────────────

  /**
   * Register a travel event.  Silently replaces any existing event with the
   * same id, resetting its runtime state.
   */
  public addEvent(definition: TravelEventDefinition): void {
    this._events.set(definition.id, {
      definition,
      lastFiredAt: null,
      fired: false,
    });
  }

  /**
   * Remove a travel event by id.  Safe to call with an unknown id.
   */
  public removeEvent(id: string): void {
    this._events.delete(id);
  }

  /** Returns the definition for an event, or `undefined` if not registered. */
  public getEvent(id: string): TravelEventDefinition | undefined {
    return this._events.get(id)?.definition;
  }

  /** All registered travel event definitions. */
  public get events(): TravelEventDefinition[] {
    return Array.from(this._events.values()).map((r) => r.definition);
  }

  /** Remove all events and reset all runtime state. */
  public clear(): void {
    this._events.clear();
    this._totalEventsFired = 0;
  }

  // ── Rolling ───────────────────────────────────────────────────────────────

  /**
   * Perform a weighted random draw among all eligible travel events and fire
   * the selected one.
   *
   * Returns the `TravelEventOutcome` of the fired event, or `null` if no
   * eligible events exist.
   *
   * @param context - Current travel context.
   * @param rng     - Optional RNG function; defaults to `Math.random`.
   */
  public rollEvent(
    context: TravelContext,
    rng: () => number = Math.random,
  ): TravelEventOutcome | null {
    const eligible = this._getEligibleRecords(context);
    if (eligible.length === 0) return null;

    const selected = this._weightedSelect(eligible, rng);
    if (!selected) return null;

    selected.lastFiredAt = context.gameTimeHours;
    selected.fired = true;
    this._totalEventsFired += 1;

    this._applyOutcome(selected.definition.outcome, context);
    this.onTravelEventFired?.(selected.definition.id, selected.definition.outcome);

    return selected.definition.outcome;
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  /**
   * Returns the definitions of all currently eligible travel events without
   * triggering any of them.  Useful for debug overlays and previews.
   *
   * @param context - Current travel context.
   */
  public getEligibleEvents(context: TravelContext): TravelEventDefinition[] {
    return this._getEligibleRecords(context).map((r) => r.definition);
  }

  /** Returns the in-game hour when an event last fired, or `null`. */
  public getLastFiredAt(id: string): number | null {
    return this._events.get(id)?.lastFiredAt ?? null;
  }

  /** Returns `true` if the event has ever fired (relevant for one-shot events). */
  public hasFired(id: string): boolean {
    return this._events.get(id)?.fired ?? false;
  }

  /** Total number of travel events fired across all `rollEvent()` calls. */
  public getTotalEventsFired(): number {
    return this._totalEventsFired;
  }

  // ── Snapshot / restore ────────────────────────────────────────────────────

  /** Capture per-event runtime state for save persistence. */
  public getSnapshot(): TravelEventSnapshot[] {
    return Array.from(this._events.values()).map((r) => ({
      id: r.definition.id,
      lastFiredAt: r.lastFiredAt,
      fired: r.fired,
    }));
  }

  /**
   * Restore per-event runtime state from a snapshot.
   * Unknown ids are silently ignored.
   * Does NOT fire `onTravelEventFired` during restore.
   */
  public restoreSnapshot(snapshots: TravelEventSnapshot[]): void {
    for (const snap of snapshots) {
      const record = this._events.get(snap.id);
      if (!record) continue;
      record.lastFiredAt = snap.lastFiredAt;
      record.fired = snap.fired;
    }
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  private _getEligibleRecords(ctx: TravelContext): TravelEventRecord[] {
    const result: TravelEventRecord[] = [];
    for (const record of this._events.values()) {
      if (this._isEligible(record, ctx)) result.push(record);
    }
    return result;
  }

  private _isEligible(record: TravelEventRecord, ctx: TravelContext): boolean {
    const def = record.definition;

    // One-shot already fired
    if (def.oneShot && record.fired) return false;

    // Cooldown check
    const cooldown = def.cooldownHours ?? 0;
    if (cooldown > 0 && record.lastFiredAt !== null) {
      const elapsed = this._hoursDelta(record.lastFiredAt, ctx.gameTimeHours);
      if (elapsed < cooldown) return false;
    }

    return this._conditionsMet(def.conditions, ctx);
  }

  private _conditionsMet(cond: TravelEventCondition, ctx: TravelContext): boolean {
    // Biome ids (at least one match)
    if (cond.biomeIds && cond.biomeIds.length > 0) {
      const active = ctx.activeBiomeIds ?? [];
      if (!cond.biomeIds.some((b) => active.includes(b))) return false;
    }

    // Weather (at least one match)
    if (cond.weather && cond.weather.length > 0) {
      if (!ctx.weatherId) return false;
      if (!cond.weather.includes(ctx.weatherId)) return false;
    }

    // Player level
    if (cond.minPlayerLevel !== undefined) {
      const lvl = ctx.playerLevel ?? 0;
      if (lvl < cond.minPlayerLevel) return false;
    }

    // Required flags
    if (cond.requiredFlags && cond.requiredFlags.length > 0) {
      const getFlag = ctx.getFlag ?? (() => false);
      if (!cond.requiredFlags.every((f) => getFlag(f))) return false;
    }

    // Forbidden flags
    if (cond.forbiddenFlags && cond.forbiddenFlags.length > 0) {
      const getFlag = ctx.getFlag ?? (() => false);
      if (cond.forbiddenFlags.some((f) => getFlag(f))) return false;
    }

    return true;
  }

  /**
   * Weighted random selection from a list of eligible records.
   * Each record's weight defaults to 1 when not specified.
   */
  private _weightedSelect(
    records: TravelEventRecord[],
    rng: () => number,
  ): TravelEventRecord | null {
    if (records.length === 0) return null;

    const totalWeight = records.reduce(
      (sum, r) => sum + (r.definition.weight ?? 1),
      0,
    );
    let roll = rng() * totalWeight;

    for (const record of records) {
      roll -= record.definition.weight ?? 1;
      if (roll <= 0) return record;
    }

    // Fallback (floating-point edge case): return last record
    return records[records.length - 1];
  }

  private _applyOutcome(outcome: TravelEventOutcome, ctx: TravelContext): void {
    if (outcome.setFlag && ctx.setFlag) {
      ctx.setFlag(outcome.setFlag, true);
    }
    if (outcome.emitEvent && ctx.emitEvent) {
      ctx.emitEvent(outcome.emitEvent);
    }
    if (outcome.landmarkId && ctx.discoverLandmark) {
      ctx.discoverLandmark(outcome.landmarkId);
    }
  }

  /**
   * Compute elapsed in-game hours from `from` to `to`, wrapping correctly
   * across midnight (24-hour boundary).
   */
  private _hoursDelta(from: number, to: number): number {
    return (to - from + 24) % 24;
  }
}
