/**
 * DynamicWorldEventSystem — Crimson Desert-inspired reactive world events.
 *
 * Extends the encounter-scheduling model with:
 *   - **Faction threat weighting**: when hostile factions are active in the area
 *     the spawn chance of tagged encounters is multiplied.
 *   - **Weather modifiers**: certain weather conditions boost or dampen encounter
 *     chance (e.g. storms bring more predators).
 *   - **Time-of-day windows**: separate day/night multipliers so night encounters
 *     feel more dangerous.
 *   - **Reward tables**: each event template declares structured rewards (XP and
 *     gold) delivered via `onRewardGranted` when the event fires.
 *   - **Event chains**: a template can declare a `chainEventId` that becomes
 *     eligible immediately after the first event fires (one follow-on per chain).
 *
 * Headless: no BabylonJS dependencies — all context is caller-supplied.
 * SAVE_VERSION: 28
 *
 * Wire-up example (game.ts):
 * ```ts
 * this.dynamicWorldEventSystem = new DynamicWorldEventSystem();
 * this.dynamicWorldEventSystem.onEventFired = (result) => {
 *   ui.showNotification(`Encounter: ${result.label}!`);
 *   spawnSystem.spawnGroup(result.tableId, result.count, result.playerLevel);
 * };
 * this.dynamicWorldEventSystem.onRewardGranted = (reward) => {
 *   player.experience += reward.xp ?? 0;
 *   inventory.addGold(reward.gold ?? 0);
 *   if (reward.label) ui.showNotification(reward.label);
 * };
 * // Each in-game hour:
 * this.dynamicWorldEventSystem.update({
 *   gameTimeHours:   timeSystem.gameTime / 60,
 *   playerLevel:     player.level,
 *   activeBiomeIds:  biomeSystem.getCurrentBiomeIds(),
 *   activeFactionIds: factionSystem.getActiveFactionIds(),
 *   weatherId:       weatherSystem.currentWeather,
 * });
 * ```
 */

// ── Reward ────────────────────────────────────────────────────────────────────

/** Reward delivered via `onRewardGranted` when an event fires. */
export interface DynamicEventReward {
  /** Experience points to grant to the player. */
  xp?: number;
  /** Gold coins to grant. */
  gold?: number;
  /** Human-readable label shown in the HUD (e.g. "Recovered bandit cache"). */
  label?: string;
}

// ── Template ──────────────────────────────────────────────────────────────────

/** Static configuration for a dynamic world event template. */
export interface DynamicEventTemplate {
  /** Stable unique identifier. */
  id: string;
  /** Human-readable label used in notifications and debug overlays. */
  label: string;
  /** Optional lore/design description. */
  description?: string;

  // ── Spawn table ──────────────────────────────────────────────────────────
  /** Encounter/loot table id passed to `onEventFired` for spawn resolution. */
  tableId: string;
  /** Minimum entity count to spawn (≥ 1, default 1). */
  minCount?: number;
  /** Maximum entity count to spawn (≥ minCount, default 1). */
  maxCount?: number;

  // ── Eligibility filters ──────────────────────────────────────────────────
  /** Biome ids — at least one must be in `context.activeBiomeIds`. Empty = any biome. */
  biomeIds?: string[];
  /** Minimum player level. */
  minLevel?: number;
  /** Maximum player level. */
  maxLevel?: number;
  /** Cooldown in in-game hours before this template can trigger again. */
  cooldownHours: number;

  // ── Base probability ──────────────────────────────────────────────────────
  /** Base spawn chance [0, 1] per `update()` evaluation tick. */
  baseChance: number;

  // ── Contextual modifiers ──────────────────────────────────────────────────
  /**
   * Faction ids that are considered hostile.  When any of these faction ids
   * appear in `context.activeFactionIds` the effective spawn chance is
   * multiplied by `factionThreatMultiplier` (default 1.5).
   */
  hostileFactionIds?: string[];
  /** Multiplier applied when a hostile faction is active (default 1.5). */
  factionThreatMultiplier?: number;

  /**
   * Weather ids that boost this event's probability.  When `context.weatherId`
   * is in this list the effective spawn chance is multiplied by
   * `weatherBoostMultiplier` (default 1.5).
   */
  boostedWeatherIds?: string[];
  /** Multiplier applied during boosted weather (default 1.5). */
  weatherBoostMultiplier?: number;

  /**
   * Multiplier applied between 18:00 and 06:00 in-game hours (night).
   * Defaults to 1.0 (no night bonus).
   */
  nightMultiplier?: number;

  // ── Rewards ───────────────────────────────────────────────────────────────
  /** Rewards delivered when this event fires. */
  rewards?: DynamicEventReward;

  // ── Event chaining ────────────────────────────────────────────────────────
  /**
   * Id of another registered template to make immediately eligible
   * (cooldown reset to zero) after this template fires.
   */
  chainEventId?: string;
}

// ── Context ───────────────────────────────────────────────────────────────────

/** Runtime context supplied to `update()` and `triggerEvent()`. */
export interface DynamicEventContext {
  /** Current in-game time in fractional hours [0, 24). */
  gameTimeHours: number;
  /** Current player level. */
  playerLevel?: number;
  /** Biome ids the player is currently inside. */
  activeBiomeIds?: string[];
  /** Faction ids with active presence in the current area. */
  activeFactionIds?: string[];
  /** Active weather state id. */
  weatherId?: string;
}

// ── Result ────────────────────────────────────────────────────────────────────

/** Data delivered to `onEventFired` when an event triggers. */
export interface DynamicEventResult {
  /** The template that triggered. */
  templateId:  string;
  /** Human-readable label. */
  label:       string;
  /** Encounter/spawn table id for the game layer to resolve. */
  tableId:     string;
  /** Resolved entity count in [minCount, maxCount]. */
  count:       number;
  /** Player level at time of trigger. */
  playerLevel: number;
  /** Effective spawn chance that was used (after modifiers). */
  effectiveChance: number;
}

// ── Snapshot ──────────────────────────────────────────────────────────────────

/** Persisted per-template runtime state. */
export interface DynamicEventSnapshot {
  id: string;
  lastTriggeredAt: number | null;
  triggerCount:    number;
}

// ── Runtime record ────────────────────────────────────────────────────────────

interface DynamicEventRecord {
  template: DynamicEventTemplate;
  lastTriggeredAt: number | null;
  triggerCount:    number;
}

// ── System ────────────────────────────────────────────────────────────────────

/**
 * Evaluates registered dynamic world-event templates on each game-clock
 * tick and fires eligible ones via `onEventFired`.
 */
export class DynamicWorldEventSystem {
  private _templates: Map<string, DynamicEventRecord> = new Map();

  // ── Callbacks ─────────────────────────────────────────────────────────────

  /**
   * Fired when a dynamic world event triggers.
   * The game layer uses `result.tableId` and `result.count` to spawn entities.
   */
  public onEventFired: ((result: DynamicEventResult) => void) | null = null;

  /**
   * Fired immediately after `onEventFired` if the template declares rewards.
   * The game layer should credit XP / gold to the player.
   */
  public onRewardGranted: ((reward: DynamicEventReward) => void) | null = null;

  // ── Template CRUD ──────────────────────────────────────────────────────────

  /**
   * Register a dynamic event template.
   * Silently replaces any existing template with the same id, resetting its
   * runtime state.
   */
  public addTemplate(template: DynamicEventTemplate): void {
    this._templates.set(template.id, {
      template,
      lastTriggeredAt: null,
      triggerCount: 0,
    });
  }

  /** Remove a template by id.  Safe to call with an unknown id. */
  public removeTemplate(id: string): void {
    this._templates.delete(id);
  }

  /** Returns the template definition for the given id, or `undefined`. */
  public getTemplate(id: string): DynamicEventTemplate | undefined {
    return this._templates.get(id)?.template;
  }

  /** All registered dynamic event templates. */
  public get templates(): DynamicEventTemplate[] {
    return Array.from(this._templates.values()).map((r) => r.template);
  }

  /** Remove all templates and reset all runtime state. */
  public clear(): void {
    this._templates.clear();
  }

  // ── Manual trigger ────────────────────────────────────────────────────────

  /**
   * Manually trigger a specific event template.
   *
   * Bypasses the probabilistic spawn-chance roll but still applies cooldown
   * and level-gate checks.  Returns `null` when the template is unknown or
   * gated out.
   *
   * @param templateId Template to trigger.
   * @param context    Current game context.
   * @param rng        Optional RNG (defaults to `Math.random`).
   */
  public triggerEvent(
    templateId: string,
    context: DynamicEventContext,
    rng: () => number = Math.random,
  ): DynamicEventResult | null {
    const record = this._templates.get(templateId);
    if (!record) return null;
    if (!this._isEligible(record, context)) return null;

    return this._fire(record, context, 1.0, rng);
  }

  // ── Auto-scheduling ───────────────────────────────────────────────────────

  /**
   * Evaluate all registered templates and fire eligible ones.
   *
   * For each template:
   * 1. Check biome overlap (skip if template has biome list and none match).
   * 2. Check cooldown and level gate.
   * 3. Compute effective spawn chance with faction/weather/time modifiers.
   * 4. Roll against effective chance.
   * 5. Fire, grant rewards, and process chain events.
   *
   * Call this once per in-game hour from a `TimeSystem.onHourChange` hook.
   *
   * @param context        Current game context.
   * @param rng            Optional RNG (defaults to `Math.random`).
   * @returns Array of results for every event that actually fired.
   */
  public update(
    context: DynamicEventContext,
    rng: () => number = Math.random,
  ): DynamicEventResult[] {
    const fired: DynamicEventResult[] = [];

    for (const record of this._templates.values()) {
      const t = record.template;

      // Biome filter — must have at least one matching biome if list is non-empty
      if (t.biomeIds && t.biomeIds.length > 0) {
        const active = context.activeBiomeIds ?? [];
        if (!t.biomeIds.some((b) => active.includes(b))) continue;
      }

      // Eligibility (cooldown + level gate)
      if (!this._isEligible(record, context)) continue;

      // Compute effective chance with all modifiers
      const effectiveChance = this._effectiveChance(t, context);
      if (effectiveChance <= 0) continue;
      if (rng() > effectiveChance) continue;

      const result = this._fire(record, context, effectiveChance, rng);
      if (result) fired.push(result);
    }

    return fired;
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  /** Returns the in-game hour when a template last triggered, or `null`. */
  public getLastTriggeredAt(id: string): number | null {
    return this._templates.get(id)?.lastTriggeredAt ?? null;
  }

  /** Returns how many times a template has triggered in total. */
  public getTriggerCount(id: string): number {
    return this._templates.get(id)?.triggerCount ?? 0;
  }

  /**
   * Returns all templates currently eligible to trigger given `context`
   * (off-cooldown and within level range), without actually triggering them.
   * Biome filtering is NOT applied — useful for manual scheduling.
   */
  public getEligibleTemplates(context: DynamicEventContext): DynamicEventTemplate[] {
    const result: DynamicEventTemplate[] = [];
    for (const record of this._templates.values()) {
      if (this._isEligible(record, context)) result.push(record.template);
    }
    return result;
  }

  /**
   * Compute the effective spawn chance for a template given `context`.
   * Returns the base chance multiplied by all applicable contextual modifiers,
   * clamped to [0, 1].
   */
  public computeEffectiveChance(id: string, context: DynamicEventContext): number {
    const record = this._templates.get(id);
    if (!record) return 0;
    return this._effectiveChance(record.template, context);
  }

  // ── Snapshot / restore ────────────────────────────────────────────────────

  /** Capture per-template runtime state for save-file persistence. */
  public getSnapshot(): DynamicEventSnapshot[] {
    return Array.from(this._templates.values()).map((r) => ({
      id:              r.template.id,
      lastTriggeredAt: r.lastTriggeredAt,
      triggerCount:    r.triggerCount,
    }));
  }

  /**
   * Restore per-template runtime state from a snapshot.
   * Unknown ids are silently ignored.
   * Does NOT fire `onEventFired` or `onRewardGranted` during restore.
   */
  public restoreSnapshot(snapshots: DynamicEventSnapshot[]): void {
    for (const snap of snapshots) {
      const record = this._templates.get(snap.id);
      if (!record) continue;
      record.lastTriggeredAt = typeof snap.lastTriggeredAt === "number"
        ? snap.lastTriggeredAt : null;
      record.triggerCount = typeof snap.triggerCount === "number"
        ? snap.triggerCount : 0;
    }
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  private _isEligible(record: DynamicEventRecord, ctx: DynamicEventContext): boolean {
    const t     = record.template;
    const level = ctx.playerLevel ?? 1;

    if (t.minLevel !== undefined && level < t.minLevel) return false;
    if (t.maxLevel !== undefined && level > t.maxLevel) return false;

    if (record.lastTriggeredAt !== null && t.cooldownHours > 0) {
      const elapsed = this._hoursDelta(record.lastTriggeredAt, ctx.gameTimeHours);
      if (elapsed < t.cooldownHours) return false;
    }

    return true;
  }

  /**
   * Compute effective spawn chance with all contextual modifiers.
   * Result is clamped to [0, 1].
   */
  private _effectiveChance(t: DynamicEventTemplate, ctx: DynamicEventContext): number {
    let chance = t.baseChance;

    // Faction threat multiplier
    if (
      t.hostileFactionIds &&
      t.hostileFactionIds.length > 0 &&
      ctx.activeFactionIds &&
      t.hostileFactionIds.some((f) => ctx.activeFactionIds!.includes(f))
    ) {
      chance *= t.factionThreatMultiplier ?? 1.5;
    }

    // Weather boost multiplier
    if (
      t.boostedWeatherIds &&
      t.boostedWeatherIds.length > 0 &&
      ctx.weatherId &&
      t.boostedWeatherIds.includes(ctx.weatherId)
    ) {
      chance *= t.weatherBoostMultiplier ?? 1.5;
    }

    // Night multiplier (18:00–06:00)
    const hour = ctx.gameTimeHours;
    const isNight = hour >= 18 || hour < 6;
    if (isNight && t.nightMultiplier !== undefined) {
      chance *= t.nightMultiplier;
    }

    return Math.max(0, Math.min(1, chance));
  }

  private _fire(
    record: DynamicEventRecord,
    ctx: DynamicEventContext,
    effectiveChance: number,
    rng: () => number,
  ): DynamicEventResult {
    const t     = record.template;
    const min   = t.minCount ?? 1;
    const max   = t.maxCount ?? min;
    const count = min + Math.floor(rng() * (max - min + 1));

    record.lastTriggeredAt = ctx.gameTimeHours;
    record.triggerCount   += 1;

    const result: DynamicEventResult = {
      templateId:      t.id,
      label:           t.label,
      tableId:         t.tableId,
      count,
      playerLevel:     ctx.playerLevel ?? 1,
      effectiveChance,
    };

    this.onEventFired?.(result);

    // Deliver rewards
    if (t.rewards && this.onRewardGranted) {
      this.onRewardGranted(t.rewards);
    }

    // Chain event: reset cooldown of the chained template so it is immediately eligible
    if (t.chainEventId) {
      const chained = this._templates.get(t.chainEventId);
      if (chained) {
        chained.lastTriggeredAt = null;
      }
    }

    return result;
  }

  private _hoursDelta(from: number, to: number): number {
    if (to >= from) return to - from;
    return 24 - from + to; // wrapped past midnight
  }
}
