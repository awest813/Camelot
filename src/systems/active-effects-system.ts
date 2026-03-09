/**
 * ActiveEffectsSystem — track all time-limited magical and alchemical effects
 * currently active on the player.
 *
 * Every spell, potion, or enchantment proc registers an effect entry here.
 * The system ticks down durations every frame and fires `onEffectExpired` when
 * an effect runs out.  Other systems (SpellSystem, AlchemySystem, etc.) add
 * entries; the game loop calls `update(dt)`.
 *
 * Effect types:
 *   health_restore   – restores health over duration (DoT heal)
 *   magicka_restore  – restores magicka over duration
 *   stamina_restore  – restores stamina over duration
 *   fortify_health   – temporarily raises max health
 *   fortify_magicka  – temporarily raises max magicka
 *   fortify_strength – temporarily raises strength (carry/damage)
 *   resist_damage    – damage reduction percentage
 *   fire_damage      – burn damage each second (for DoT attacks)
 *   frost_damage     – frost damage each second
 *   shock_damage     – shock damage each second
 *   silence          – blocks spell casting
 *   burden           – reduces carry capacity
 *
 * Wire-up example (game.ts):
 * ```ts
 * this.activeEffectsSystem = new ActiveEffectsSystem();
 * // When a health potion is drunk:
 * this.activeEffectsSystem.addEffect({
 *   id: "potion_heal_01_" + Date.now(),
 *   name: "Health Restore",
 *   effectType: "health_restore",
 *   magnitude: 5,   // HP/s
 *   duration: 10,   // seconds
 * });
 * // In update loop:
 * this.activeEffectsSystem.update(deltaTime, this.player);
 * ```
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export type ActiveEffectType =
  | "health_restore"
  | "magicka_restore"
  | "stamina_restore"
  | "fortify_health"
  | "fortify_magicka"
  | "fortify_strength"
  | "resist_damage"
  | "fire_damage"
  | "frost_damage"
  | "shock_damage"
  | "silence"
  | "burden";

export interface ActiveEffect {
  /** Unique instance id (e.g. "flames_dot_<timestamp>"). */
  id: string;
  /** Display name shown in the HUD. */
  name: string;
  /** Category of the effect. */
  effectType: ActiveEffectType;
  /**
   * Effect strength.  Interpretation varies by type:
   *   health/magicka/stamina restore → HP (or MP/SP) restored per second
   *   fortify_*     → flat bonus to the stat
   *   resist_damage → damage reduction % (0–100)
   *   *_damage      → damage per second dealt to the player
   *   silence       → 1 = silenced (magnitude unused)
   *   burden        → weight units added to carry load
   */
  magnitude: number;
  /**
   * Remaining duration in real seconds.
   * Set to `Infinity` for permanent effects (e.g. enchantment auras).
   */
  duration: number;
  /** Original duration for UI progress display. */
  readonly totalDuration: number;
}

export interface ActiveEffectSaveEntry {
  id: string;
  name: string;
  effectType: ActiveEffectType;
  magnitude: number;
  duration: number;
  totalDuration: number;
}

export interface ActiveEffectsSaveState {
  effects: ActiveEffectSaveEntry[];
}

/** Minimal player interface required by ActiveEffectsSystem.update(). */
export interface AffectablePlayer {
  health: number;
  maxHealth: number;
  magicka: number;
  maxMagicka: number;
  stamina: number;
  maxStamina: number;
}

// ── System ─────────────────────────────────────────────────────────────────────

export class ActiveEffectsSystem {
  private _effects: Map<string, ActiveEffect> = new Map();

  /**
   * Fired when an effect's duration reaches zero.
   * @param effect A snapshot of the expired effect.
   */
  public onEffectExpired: ((effect: ActiveEffect) => void) | null = null;

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Register a new active effect.  If an effect with the same `id` is already
   * present its duration is refreshed (not stacked) to avoid snowballing.
   */
  public addEffect(effect: Omit<ActiveEffect, "totalDuration"> & { totalDuration?: number }): void {
    const total = effect.totalDuration ?? effect.duration;
    const entry: ActiveEffect = {
      id:            effect.id,
      name:          effect.name,
      effectType:    effect.effectType,
      magnitude:     effect.magnitude,
      duration:      effect.duration,
      totalDuration: total,
    };
    this._effects.set(effect.id, entry);
  }

  /**
   * Remove an effect before it expires (e.g. dispel).
   */
  public removeEffect(id: string): void {
    this._effects.delete(id);
  }

  /**
   * Returns the active effect with the given id, or `undefined`.
   */
  public getEffect(id: string): Readonly<ActiveEffect> | undefined {
    return this._effects.get(id);
  }

  /**
   * Returns a stable snapshot of all active effects sorted by name.
   */
  public get activeEffects(): ReadonlyArray<Readonly<ActiveEffect>> {
    return Array.from(this._effects.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }

  /**
   * Returns the summed magnitude for a given effect type across all active
   * effects (useful for computing total resist_damage bonus, etc.).
   */
  public totalMagnitude(effectType: ActiveEffectType): number {
    let sum = 0;
    for (const e of this._effects.values()) {
      if (e.effectType === effectType) sum += e.magnitude;
    }
    return sum;
  }

  /**
   * Returns true if any silence effect is active (blocks spell casting).
   */
  public get isSilenced(): boolean {
    for (const e of this._effects.values()) {
      if (e.effectType === "silence") return true;
    }
    return false;
  }

  /**
   * Tick all active effects by `deltaTime` seconds.
   * - Decrements durations (infinite-duration effects are skipped).
   * - Applies per-second restoration/damage to `player` (pro-rated by dt).
   * - Removes expired finite effects and fires `onEffectExpired`.
   *
   * @param deltaTime  Elapsed seconds since last update.
   * @param player     The player receiving/suffering the effects.
   */
  public update(deltaTime: number, player: AffectablePlayer): void {
    const expired: ActiveEffect[] = [];

    for (const effect of this._effects.values()) {
      // Apply per-second stat changes, scaled to dt
      this._applyPerSecond(effect, deltaTime, player);

      // Tick duration
      if (effect.duration !== Infinity) {
        effect.duration -= deltaTime;
        if (effect.duration <= 0) {
          effect.duration = 0;
          expired.push(effect);
        }
      }
    }

    for (const e of expired) {
      this._effects.delete(e.id);
      this.onEffectExpired?.(e);
    }
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  public getSaveState(): ActiveEffectsSaveState {
    const effects: ActiveEffectSaveEntry[] = [];
    for (const e of this._effects.values()) {
      // Skip infinite-duration effects — they are re-applied by their source
      // (enchantments, etc.) on load.  Only save finite timed effects.
      if (e.duration === Infinity) continue;
      effects.push({
        id:            e.id,
        name:          e.name,
        effectType:    e.effectType,
        magnitude:     e.magnitude,
        duration:      e.duration,
        totalDuration: e.totalDuration,
      });
    }
    return { effects };
  }

  public restoreFromSave(state: ActiveEffectsSaveState): void {
    this._effects.clear();
    if (!state || !Array.isArray(state.effects)) return;
    for (const entry of state.effects) {
      if (
        typeof entry.id           !== "string" ||
        typeof entry.name         !== "string" ||
        typeof entry.effectType   !== "string" ||
        typeof entry.magnitude    !== "number" ||
        typeof entry.duration     !== "number" ||
        typeof entry.totalDuration !== "number" ||
        entry.duration <= 0
      ) continue;
      this._effects.set(entry.id, {
        id:            entry.id,
        name:          entry.name,
        effectType:    entry.effectType as ActiveEffectType,
        magnitude:     entry.magnitude,
        duration:      entry.duration,
        totalDuration: entry.totalDuration,
      });
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private _applyPerSecond(effect: ActiveEffect, dt: number, player: AffectablePlayer): void {
    const delta = effect.magnitude * dt;
    switch (effect.effectType) {
      case "health_restore":
        player.health = Math.min(player.maxHealth, player.health + delta);
        break;
      case "magicka_restore":
        player.magicka = Math.min(player.maxMagicka, player.magicka + delta);
        break;
      case "stamina_restore":
        player.stamina = Math.min(player.maxStamina, player.stamina + delta);
        break;
      case "fire_damage":
      case "frost_damage":
      case "shock_damage":
        player.health = Math.max(0, player.health - delta);
        break;
      // fortify_* and resist_damage are passive modifiers queried externally
      // via totalMagnitude(); silence and burden have no per-second tick.
      default:
        break;
    }
  }
}
