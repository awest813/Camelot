/**
 * EncounterSystem — Dynamic random encounter scheduling for Camelot.
 *
 * Manages named encounter templates each linked to a BiomeSystem encounter
 * table id.  The game layer drives scheduling by calling
 * `triggerEncounter(templateId, context)` or letting the system
 * auto-schedule via `update(gameTimeHours, activeBiomeIds, rng)`.
 *
 * Each template carries its own cooldown so encounters with the same
 * underlying table can be rate-limited independently.  An optional
 * level gate ensures high-tier encounters are withheld from low-level players.
 *
 * Headless: no BabylonJS dependencies — NPC spawning and UI are handled
 * by callbacks that the game layer wires to its own AI and encounter systems.
 */

// ── Template ──────────────────────────────────────────────────────────────────

/**
 * Static configuration for a named encounter template.
 * A template describes *what* can spawn; the system tracks *when* it last did.
 */
export interface EncounterTemplate {
  /** Stable unique identifier. */
  id: string;
  /** Human-readable label used in logs / debug overlays. */
  label: string;
  /** Optional design/lore description. */
  description?: string;
  /**
   * Encounter/loot table id (from BiomeSystem or LootTableSystem) that the
   * game layer uses to roll actual spawn content.
   */
  tableId: string;
  /**
   * Biome ids that this template is associated with.
   * Used by `update()` to auto-trigger eligible templates when the player is
   * inside one of these biomes.  Leave empty to disable auto-triggering.
   */
  biomeIds?: string[];
  /** Minimum number of entities to spawn (>= 1, default 1). */
  minCount?: number;
  /** Maximum number of entities to spawn (>= minCount, default 1). */
  maxCount?: number;
  /** Minimum player level for the encounter to be eligible. */
  minLevel?: number;
  /** Maximum player level for the encounter to be eligible. */
  maxLevel?: number;
  /**
   * Minimum in-game hours before this template can trigger again.
   * Defaults to 0 (no cooldown — trigger on every eligible call).
   */
  cooldownHours: number;
  /**
   * Base probability [0, 1] that the encounter fires on each `update()` tick
   * when the player is in a matching biome.  Defaults to 1.0 (always fires
   * when conditions are met and cooldown has elapsed).
   */
  spawnChance?: number;
}

// ── Context ───────────────────────────────────────────────────────────────────

/** Runtime context supplied to `triggerEncounter()` and `update()`. */
export interface EncounterContext {
  /** Current in-game time in fractional hours [0, 24). */
  gameTimeHours: number;
  /** Current player character level (used for level-range gating). */
  playerLevel?: number;
}

// ── Result ────────────────────────────────────────────────────────────────────

/**
 * Data delivered to `onEncounterStarted` when an encounter triggers.
 * The game layer uses this to spawn the appropriate NPCs / loot.
 */
export interface EncounterResult {
  /** The template that triggered. */
  templateId: string;
  /** The encounter table id to roll. */
  tableId: string;
  /**
   * Resolved spawn count in [minCount, maxCount] drawn at trigger time.
   * The game layer uses this to determine how many entities to spawn.
   */
  count: number;
  /** Player level captured at trigger time (for post-processing). */
  playerLevel: number;
}

// ── Runtime record ────────────────────────────────────────────────────────────

interface EncounterRecord {
  template: EncounterTemplate;
  /** In-game hours when the encounter last triggered; `null` = never. */
  lastTriggeredAt: number | null;
  /** Total number of times this template has triggered. */
  triggerCount: number;
}

// ── Snapshot ──────────────────────────────────────────────────────────────────

/** Persisted per-template runtime state. */
export interface EncounterSnapshot {
  id: string;
  lastTriggeredAt: number | null;
  triggerCount: number;
}

// ── System ────────────────────────────────────────────────────────────────────

/**
 * Schedules and fires dynamic random encounters.
 *
 * **Manual trigger** — call `triggerEncounter(templateId, context)` in
 * response to a BiomeSystem `onBiomeEntered` callback or a world-event hook:
 * ```ts
 * biomeSystem.onBiomeEntered = (biomeId) => {
 *   const template = encounterSystem.getTemplateForBiome(biomeId);
 *   if (template) encounterSystem.triggerEncounter(template, context);
 * };
 * ```
 *
 * **Auto scheduling** — call `update(gameTimeHours, activeBiomeIds, context)`
 * on each in-game hour tick to let the system roll eligible templates:
 * ```ts
 * timeSystem.onHourChange = (h) => {
 *   encounterSystem.update(
 *     { gameTimeHours: h, playerLevel: player.level },
 *     biomeSystem.getCurrentBiomeIds(),
 *   );
 * };
 * ```
 */
export class EncounterSystem {
  private _templates: Map<string, EncounterRecord> = new Map();

  // ── Callback ──────────────────────────────────────────────────────────────

  /**
   * Fired when an encounter triggers (manually or via `update()`).
   * The game layer should use `result.tableId` and `result.count` to spawn
   * enemies, place loot, etc.
   */
  public onEncounterStarted: ((result: EncounterResult) => void) | null = null;

  // ── CRUD ──────────────────────────────────────────────────────────────────

  /**
   * Register an encounter template.  Silently replaces any existing template
   * with the same id, resetting its runtime state.
   */
  public addTemplate(template: EncounterTemplate): void {
    this._templates.set(template.id, {
      template,
      lastTriggeredAt: null,
      triggerCount: 0,
    });
  }

  /**
   * Remove a template by id.  Safe to call with an unknown id.
   */
  public removeTemplate(id: string): void {
    this._templates.delete(id);
  }

  /** Returns the template for a given id, or `undefined` if unknown. */
  public getTemplate(id: string): EncounterTemplate | undefined {
    return this._templates.get(id)?.template;
  }

  /** All registered encounter templates. */
  public get templates(): EncounterTemplate[] {
    return Array.from(this._templates.values()).map((r) => r.template);
  }

  /** Remove all templates and reset all state. */
  public clear(): void {
    this._templates.clear();
  }

  // ── Trigger ───────────────────────────────────────────────────────────────

  /**
   * Attempt to trigger a specific encounter template.
   *
   * Returns a `EncounterResult` and fires `onEncounterStarted` when the
   * template is eligible (off-cooldown, level gate satisfied).
   * Returns `null` if the template is unknown or gated out.
   *
   * @param templateId - Template to trigger.
   * @param context    - Current game time and player level.
   * @param rng        - Optional RNG; defaults to `Math.random`.
   */
  public triggerEncounter(
    templateId: string,
    context: EncounterContext,
    rng: () => number = Math.random,
  ): EncounterResult | null {
    const record = this._templates.get(templateId);
    if (!record) return null;

    if (!this._isEligible(record, context)) return null;

    const result = this._buildResult(record.template, context, rng);
    record.lastTriggeredAt = context.gameTimeHours;
    record.triggerCount += 1;
    this.onEncounterStarted?.(result);
    return result;
  }

  // ── Auto-scheduling ───────────────────────────────────────────────────────

  /**
   * For each registered template whose `biomeIds` intersects `activeBiomeIds`,
   * attempt to trigger it (subject to cooldown, level gate, and `spawnChance`).
   *
   * Call this once per in-game hour (or similar cadence) from a TimeSystem
   * `onHourChange` hook.
   *
   * @param context       - Current game time and player level.
   * @param activeBiomeIds - Biomes the player is currently inside.
   * @param rng           - Optional RNG; defaults to `Math.random`.
   * @returns Array of results for every encounter that actually fired.
   */
  public update(
    context: EncounterContext,
    activeBiomeIds: string[] = [],
    rng: () => number = Math.random,
  ): EncounterResult[] {
    const fired: EncounterResult[] = [];
    for (const record of this._templates.values()) {
      const t = record.template;

      // Must have biome ids and overlap with the active set
      if (!t.biomeIds || t.biomeIds.length === 0) continue;
      if (!t.biomeIds.some((b) => activeBiomeIds.includes(b))) continue;

      // Standard eligibility (cooldown + level gate)
      if (!this._isEligible(record, context)) continue;

      // Probabilistic spawn chance
      const chance = t.spawnChance ?? 1.0;
      if (rng() > chance) continue;

      const result = this._buildResult(t, context, rng);
      record.lastTriggeredAt = context.gameTimeHours;
      record.triggerCount += 1;
      this.onEncounterStarted?.(result);
      fired.push(result);
    }
    return fired;
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  /**
   * Returns all templates whose `biomeIds` includes the given biome id.
   * Useful for manual encounter scheduling on `BiomeSystem.onBiomeEntered`.
   */
  public getTemplatesForBiome(biomeId: string): EncounterTemplate[] {
    const result: EncounterTemplate[] = [];
    for (const record of this._templates.values()) {
      if (record.template.biomeIds?.includes(biomeId)) result.push(record.template);
    }
    return result;
  }

  /**
   * Returns all templates that are currently eligible given `context`
   * (off-cooldown and within level range) without triggering them.
   */
  public getEligibleTemplates(context: EncounterContext): EncounterTemplate[] {
    const result: EncounterTemplate[] = [];
    for (const record of this._templates.values()) {
      if (this._isEligible(record, context)) result.push(record.template);
    }
    return result;
  }

  /** Returns the in-game hour when a template last triggered, or `null`. */
  public getLastTriggeredAt(id: string): number | null {
    return this._templates.get(id)?.lastTriggeredAt ?? null;
  }

  /** Returns the total number of times a template has triggered. */
  public getTriggerCount(id: string): number {
    return this._templates.get(id)?.triggerCount ?? 0;
  }

  // ── Snapshot / restore ────────────────────────────────────────────────────

  /** Capture per-template runtime state for save persistence. */
  public getSnapshot(): EncounterSnapshot[] {
    return Array.from(this._templates.values()).map((r) => ({
      id: r.template.id,
      lastTriggeredAt: r.lastTriggeredAt,
      triggerCount: r.triggerCount,
    }));
  }

  /**
   * Restore per-template runtime state from a snapshot.
   * Unknown ids are silently ignored.
   * Does NOT fire `onEncounterStarted` during restore.
   */
  public restoreSnapshot(snapshots: EncounterSnapshot[]): void {
    for (const snap of snapshots) {
      const record = this._templates.get(snap.id);
      if (!record) continue;
      record.lastTriggeredAt = snap.lastTriggeredAt;
      record.triggerCount = snap.triggerCount;
    }
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  private _isEligible(record: EncounterRecord, ctx: EncounterContext): boolean {
    const t = record.template;
    const level = ctx.playerLevel ?? 1;

    // Level gate
    if (t.minLevel !== undefined && level < t.minLevel) return false;
    if (t.maxLevel !== undefined && level > t.maxLevel) return false;

    // Cooldown
    if (t.cooldownHours > 0 && record.lastTriggeredAt !== null) {
      const elapsed = this._hoursDelta(record.lastTriggeredAt, ctx.gameTimeHours);
      if (elapsed < t.cooldownHours) return false;
    }

    return true;
  }

  private _buildResult(
    t: EncounterTemplate,
    ctx: EncounterContext,
    rng: () => number,
  ): EncounterResult {
    const minCount = t.minCount ?? 1;
    const maxCount = t.maxCount ?? minCount;
    const count = minCount + Math.floor(rng() * (maxCount - minCount + 1));
    return {
      templateId: t.id,
      tableId: t.tableId,
      count,
      playerLevel: ctx.playerLevel ?? 1,
    };
  }

  /**
   * Compute elapsed in-game hours from `from` to `to`, wrapping correctly
   * across midnight (24-hour boundary).
   */
  private _hoursDelta(from: number, to: number): number {
    if (to >= from) return to - from;
    return 24 - from + to;
  }
}
