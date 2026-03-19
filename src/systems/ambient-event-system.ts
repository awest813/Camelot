/**
 * AmbientEventSystem — Environmental storytelling for Camelot.
 *
 * Defines named ambient events (fog rolls in, birds scatter, distant thunder
 * rumbles, etc.) each with a set of conditions that must be satisfied before
 * they fire.  The game layer drives evaluation by calling `update(context)`
 * once per game-clock tick; the system fires `onEventTriggered` for every
 * eligible event subject to per-event cooldowns.
 *
 * Headless: no BabylonJS dependencies — all time/weather/biome data is
 * supplied by the caller via a lightweight `AmbientEventContext`.
 */

// ── Condition ─────────────────────────────────────────────────────────────────

/**
 * Conditions that must ALL be satisfied for an ambient event to fire.
 * Every field is optional; an empty conditions object always matches.
 */
export interface AmbientEventCondition {
  /**
   * In-game hour window [0, 24) during which the event may fire.
   * e.g. `{ minHour: 20, maxHour: 4 }` wraps midnight correctly.
   */
  timeRange?: { minHour: number; maxHour: number };
  /**
   * Allowed weather state ids (e.g. "Clear", "Rain", "Storm").
   * At least one of these must match `context.weatherId`.
   */
  weather?: string[];
  /**
   * Required active biome ids.  At least one of these biomes must be in
   * `context.activeBiomeIds`.
   */
  biomeIds?: string[];
  /** Minimum player level required. */
  minPlayerLevel?: number;
  /** All listed flags must be truthy in `context.getFlag()`. */
  requiredFlags?: string[];
  /** None of these flags may be truthy in `context.getFlag()`. */
  forbiddenFlags?: string[];
}

// ── Effect ────────────────────────────────────────────────────────────────────

/**
 * Side-effects delivered when an ambient event fires.
 * The game layer wires these to HUD notifications, the event bus, etc.
 */
export interface AmbientEventEffect {
  /** Notification text to display to the player. */
  notification?: string;
  /** Game flag to set (via `context.setFlag`, if provided). */
  setFlag?: string;
  /** Game event id to emit (via `context.emitEvent`, if provided). */
  emitEvent?: string;
}

// ── Definition ────────────────────────────────────────────────────────────────

/** Static configuration for a named ambient event. */
export interface AmbientEventDefinition {
  /** Stable unique identifier. */
  id: string;
  /** Human-readable label used in logs / debug overlays. */
  label: string;
  /** Optional lore/design description. */
  description?: string;
  /**
   * Conditions that must ALL be satisfied.
   * An empty object means the event fires every update (subject to cooldown).
   */
  conditions: AmbientEventCondition;
  /** Effects executed when the event fires. */
  effect: AmbientEventEffect;
  /**
   * Minimum in-game hours before the same event fires again.
   * Defaults to 0 (fires every eligible update tick).
   */
  cooldownHours?: number;
  /**
   * When `true` the event fires exactly once and is then permanently
   * suppressed regardless of cooldown.
   */
  oneShot?: boolean;
}

// ── Context ───────────────────────────────────────────────────────────────────

/**
 * Runtime context supplied by the game layer on each `update()` call.
 * All optional fields are treated as "unknown / not applicable" when absent.
 */
export interface AmbientEventContext {
  /** Current in-game time expressed as fractional hours in [0, 24). */
  gameTimeHours: number;
  /** Active weather state id (e.g. "Clear", "Rain"). */
  weatherId?: string;
  /** Ids of biomes the player is currently inside. */
  activeBiomeIds?: string[];
  /** Current player character level. */
  playerLevel?: number;
  /** Read a named game flag. */
  getFlag?: (flag: string) => boolean;
  /** Write a named game flag (used to apply `setFlag` effects). */
  setFlag?: (flag: string, value: boolean) => void;
  /** Emit a game event by id (used to apply `emitEvent` effects). */
  emitEvent?: (eventId: string) => void;
}

// ── Runtime record ────────────────────────────────────────────────────────────

interface AmbientEventRecord {
  definition: AmbientEventDefinition;
  /** In-game hours when the event last fired; `null` = never. */
  lastFiredAt: number | null;
  /** Whether a one-shot event has already fired. */
  fired: boolean;
}

// ── Snapshot ──────────────────────────────────────────────────────────────────

/** Persisted per-event runtime state. */
export interface AmbientEventSnapshot {
  id: string;
  lastFiredAt: number | null;
  fired: boolean;
}

// ── System ────────────────────────────────────────────────────────────────────

/**
 * Evaluates registered ambient events on each game-clock tick and fires
 * eligible ones via `onEventTriggered`.
 *
 * **Typical game-layer usage:**
 * ```ts
 * ambientEventSystem.onEventTriggered = (id, effect) => {
 *   if (effect.notification) hud.notify(effect.notification);
 *   if (effect.emitEvent)    eventBus.emit(effect.emitEvent);
 * };
 * // Each in-game hour (or more frequently if desired):
 * ambientEventSystem.update({
 *   gameTimeHours: timeSystem.gameHour,
 *   weatherId:     weatherSystem.currentWeather,
 *   activeBiomeIds: biomeSystem.getCurrentBiomeIds(),
 *   playerLevel:   playerLevelSystem.characterLevel,
 *   getFlag:       (f) => flagStore.get(f) ?? false,
 *   setFlag:       (f, v) => flagStore.set(f, v),
 *   emitEvent:     (e) => eventBus.emit(e),
 * });
 * ```
 */
export class AmbientEventSystem {
  private _events: Map<string, AmbientEventRecord> = new Map();

  // ── Callback ──────────────────────────────────────────────────────────────

  /**
   * Fired for each eligible ambient event during `update()`.
   * The game layer should apply the effect (notification, flag, event).
   */
  public onEventTriggered:
    | ((eventId: string, effect: AmbientEventEffect) => void)
    | null = null;

  // ── CRUD ──────────────────────────────────────────────────────────────────

  /**
   * Register an ambient event.  Silently replaces any existing event with
   * the same id, resetting its runtime state.
   */
  public addEvent(definition: AmbientEventDefinition): void {
    this._events.set(definition.id, {
      definition,
      lastFiredAt: null,
      fired: false,
    });
  }

  /**
   * Remove an ambient event by id.  Safe to call with an unknown id.
   */
  public removeEvent(id: string): void {
    this._events.delete(id);
  }

  /** Returns the definition for an event, or `undefined` if unknown. */
  public getEvent(id: string): AmbientEventDefinition | undefined {
    return this._events.get(id)?.definition;
  }

  /** All registered ambient event definitions. */
  public get events(): AmbientEventDefinition[] {
    return Array.from(this._events.values()).map((r) => r.definition);
  }

  /** Remove all events and reset all state. */
  public clear(): void {
    this._events.clear();
  }

  // ── Evaluation ────────────────────────────────────────────────────────────

  /**
   * Evaluate all registered events against `context` and fire eligible ones.
   * Events are processed in insertion order.
   *
   * An event fires when:
   * 1. It is not a spent one-shot.
   * 2. Its cooldown has elapsed (or it has never fired).
   * 3. All conditions in its `conditions` object are satisfied.
   *
   * After firing, `onEventTriggered` is called and any `setFlag` / `emitEvent`
   * effects are applied via the context helpers.
   */
  public update(context: AmbientEventContext): void {
    for (const record of this._events.values()) {
      if (this._shouldFire(record, context)) {
        record.lastFiredAt = context.gameTimeHours;
        record.fired = true;
        this._applyEffect(record.definition.effect, context);
        this.onEventTriggered?.(record.definition.id, record.definition.effect);
      }
    }
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  /** Returns the in-game hour when an event last fired, or `null`. */
  public getLastFiredAt(id: string): number | null {
    return this._events.get(id)?.lastFiredAt ?? null;
  }

  /** Returns `true` if a one-shot event has already fired. */
  public hasFired(id: string): boolean {
    return this._events.get(id)?.fired ?? false;
  }

  /**
   * Returns ids of all events that are currently eligible to fire given
   * `context`, without actually firing them.  Useful for debugging.
   */
  public getEligibleEventIds(context: AmbientEventContext): string[] {
    const result: string[] = [];
    for (const [id, record] of this._events) {
      if (this._shouldFire(record, context)) result.push(id);
    }
    return result;
  }

  // ── Snapshot / restore ────────────────────────────────────────────────────

  /** Capture per-event runtime state for save persistence. */
  public getSnapshot(): AmbientEventSnapshot[] {
    return Array.from(this._events.values()).map((r) => ({
      id: r.definition.id,
      lastFiredAt: r.lastFiredAt,
      fired: r.fired,
    }));
  }

  /**
   * Restore per-event runtime state from a snapshot.
   * Unknown ids are silently ignored.
   * Does NOT fire `onEventTriggered` during restore.
   */
  public restoreSnapshot(snapshots: AmbientEventSnapshot[]): void {
    for (const snap of snapshots) {
      const record = this._events.get(snap.id);
      if (!record) continue;
      record.lastFiredAt = snap.lastFiredAt;
      record.fired = snap.fired;
    }
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  private _shouldFire(record: AmbientEventRecord, ctx: AmbientEventContext): boolean {
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

  private _conditionsMet(cond: AmbientEventCondition, ctx: AmbientEventContext): boolean {
    // Time range
    if (cond.timeRange !== undefined) {
      const { minHour, maxHour } = cond.timeRange;
      if (!this._inHourRange(ctx.gameTimeHours, minHour, maxHour)) return false;
    }

    // Weather
    if (cond.weather && cond.weather.length > 0) {
      if (!ctx.weatherId) return false;
      if (!cond.weather.includes(ctx.weatherId)) return false;
    }

    // Biome ids (at least one match)
    if (cond.biomeIds && cond.biomeIds.length > 0) {
      const active = ctx.activeBiomeIds ?? [];
      if (!cond.biomeIds.some((b) => active.includes(b))) return false;
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

  private _applyEffect(effect: AmbientEventEffect, ctx: AmbientEventContext): void {
    if (effect.setFlag && ctx.setFlag) {
      ctx.setFlag(effect.setFlag, true);
    }
    if (effect.emitEvent && ctx.emitEvent) {
      ctx.emitEvent(effect.emitEvent);
    }
  }

  /**
   * Compute elapsed in-game hours from `from` to `to`, wrapping correctly
   * across midnight (24-hour boundary).
   */
  private _hoursDelta(from: number, to: number): number {
    if (to >= from) return to - from;
    return 24 - from + to; // wrapped past midnight
  }

  /**
   * Returns true if `hour` falls within [minHour, maxHour).
   * Supports wrap-around windows that cross midnight, e.g. [22, 4) = night.
   */
  private _inHourRange(hour: number, minHour: number, maxHour: number): boolean {
    if (minHour <= maxHour) {
      return hour >= minHour && hour < maxHour;
    }
    // Wrap-around window (e.g. 22 → 4)
    return hour >= minHour || hour < maxHour;
  }
}
