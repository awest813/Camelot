/**
 * SwimmingSystem — Underwater depth and breath management for Camelot.
 *
 * Tracks whether the player is submerged, drains a breath meter while
 * underwater, and applies drowning damage once breath is exhausted.
 * Races (e.g. Argonian) or active effects (e.g. Water Breathing spell)
 * can suppress breath drain via the `hasWaterBreathing` flag.
 *
 * Headless: no BabylonJS dependencies — integrates via callbacks.
 * SAVE_VERSION: 20
 */

// ── Constants ─────────────────────────────────────────────────────────────────

/** Default maximum breath in seconds. */
const DEFAULT_MAX_BREATH = 30;

/** Breath drained per real-world second while submerged (1/30 → empties in 30 s). */
const BREATH_DRAIN_RATE = 1;

/** Drowning damage (HP per second) applied when breath reaches 0. */
const DROWNING_DAMAGE_RATE = 3;

/** Breath fraction below which `onBreathLow` fires (20 %). */
const BREATH_LOW_THRESHOLD = 0.2;

/**
 * Movement speed multiplier applied while the player is swimming.
 * Returned by `swimSpeedMultiplier` for game-layer consumers.
 */
const SWIM_SPEED_MULTIPLIER = 0.65;

// ── Save state ────────────────────────────────────────────────────────────────

export interface SwimmingSaveState {
  currentBreath: number;
  maxBreath: number;
  isSubmerged: boolean;
}

// ── System ────────────────────────────────────────────────────────────────────

/** Minimal player interface required by the update loop. */
export interface SwimmingPlayer {
  health: number;
  maxHealth: number;
}

/**
 * Manages breath, drowning, and swim-speed while the player is underwater.
 *
 * Usage:
 * ```ts
 * const swim = new SwimmingSystem();
 * swim.onEnterWater = () => ui.showBreathBar();
 * swim.onExitWater  = () => ui.hideBreathBar();
 * swim.onDrowning   = (dmg) => player.health -= dmg;
 *
 * // Each frame:
 * swim.update(deltaTime, player);
 *
 * // When the game layer detects the player dipping below the waterline:
 * swim.enterWater();
 * swim.exitWater();
 *
 * // For Argonian race or a Water Breathing active effect:
 * swim.hasWaterBreathing = true;
 * ```
 */
export class SwimmingSystem {
  private _isSubmerged: boolean = false;
  private _maxBreath: number = DEFAULT_MAX_BREATH;
  private _currentBreath: number = DEFAULT_MAX_BREATH;
  /** Internal flag so `onBreathLow` fires only once per submersion. */
  private _breathLowFired: boolean = false;

  // ── Callbacks ─────────────────────────────────────────────────────────────

  /** Fired when the player enters water (becomes submerged). */
  public onEnterWater: (() => void) | null = null;

  /** Fired when the player exits water (surfaces or leaves the body of water). */
  public onExitWater: (() => void) | null = null;

  /**
   * Fired each frame while submerged, with the current breath ratio [0, 1].
   * Use this to drive a HUD breath indicator.
   */
  public onBreathChange: ((ratio: number) => void) | null = null;

  /**
   * Fired once when breath drops below {@link BREATH_LOW_THRESHOLD} (20 %).
   * Resets on the next surfacing so it can fire again next submersion.
   */
  public onBreathLow: (() => void) | null = null;

  /**
   * Fired each frame when the player is out of breath and taking drowning damage.
   * Receives the damage amount applied this frame.
   */
  public onDrowning: ((damage: number) => void) | null = null;

  // ── Configuration ──────────────────────────────────────────────────────────

  /**
   * When `true` the breath meter is never drained (Argonian racial ability or
   * Water Breathing spell/potion effect).
   */
  public hasWaterBreathing: boolean = false;

  // ── Queries ────────────────────────────────────────────────────────────────

  /** Whether the player is currently submerged. */
  public get isSubmerged(): boolean {
    return this._isSubmerged;
  }

  /** Current breath in seconds. */
  public get currentBreath(): number {
    return this._currentBreath;
  }

  /** Maximum breath in seconds. */
  public get maxBreath(): number {
    return this._maxBreath;
  }

  /** Current breath as a fraction [0, 1]. */
  public get breathRatio(): number {
    if (this._maxBreath <= 0) return 1;
    return this._currentBreath / this._maxBreath;
  }

  /**
   * Movement speed multiplier to apply while swimming.
   * Returns {@link SWIM_SPEED_MULTIPLIER} while submerged, 1.0 otherwise.
   */
  public get swimSpeedMultiplier(): number {
    return this._isSubmerged ? SWIM_SPEED_MULTIPLIER : 1.0;
  }

  // ── Mutators ───────────────────────────────────────────────────────────────

  /**
   * Set the maximum breath capacity (seconds).
   * Clamps `currentBreath` to the new maximum if necessary.
   */
  public setMaxBreath(seconds: number): void {
    this._maxBreath = Math.max(1, seconds);
    this._currentBreath = Math.min(this._currentBreath, this._maxBreath);
  }

  // ── State transitions ──────────────────────────────────────────────────────

  /**
   * Call this when the game layer detects the player descending below the
   * water surface.
   */
  public enterWater(): void {
    if (this._isSubmerged) return;
    this._isSubmerged = true;
    this._breathLowFired = false;
    this.onEnterWater?.();
  }

  /**
   * Call this when the player surfaces or leaves the body of water entirely.
   * Breath is fully restored on exit.
   */
  public exitWater(): void {
    if (!this._isSubmerged) return;
    this._isSubmerged = false;
    this._currentBreath = this._maxBreath;
    this._breathLowFired = false;
    this.onExitWater?.();
    this.onBreathChange?.(1);
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  /**
   * Advance the system by one frame.
   *
   * @param deltaTime  Elapsed real-world seconds since the last frame.
   * @param player     Player object whose `health` may be reduced by drowning.
   */
  public update(deltaTime: number, player: SwimmingPlayer): void {
    if (!this._isSubmerged) return;

    if (!this.hasWaterBreathing) {
      let remainingDt = deltaTime;

      if (this._currentBreath > 0) {
        // Time needed to exhaust remaining breath
        const timeToExhaustBreath = this._currentBreath / BREATH_DRAIN_RATE;
        const drainDt = Math.min(remainingDt, timeToExhaustBreath);
        this._currentBreath = Math.max(0, this._currentBreath - BREATH_DRAIN_RATE * drainDt);
        remainingDt -= drainDt;

        const ratio = this.breathRatio;
        this.onBreathChange?.(ratio);

        // Fire low-breath warning once per submersion
        if (ratio <= BREATH_LOW_THRESHOLD && !this._breathLowFired) {
          this._breathLowFired = true;
          this.onBreathLow?.();
        }
      }

      // Apply drowning damage for any time spent with breath = 0
      if (remainingDt > 0 && this._currentBreath <= 0) {
        const damage = DROWNING_DAMAGE_RATE * remainingDt;
        player.health = Math.max(0, player.health - damage);
        this.onDrowning?.(damage);
      }
    }
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  /** Serialize current state for save-file storage. */
  public getSaveState(): SwimmingSaveState {
    return {
      currentBreath: this._currentBreath,
      maxBreath: this._maxBreath,
      isSubmerged: this._isSubmerged,
    };
  }

  /** Restore state from a previously serialized snapshot. */
  public restoreFromSave(state: SwimmingSaveState): void {
    this._maxBreath = Math.max(1, state.maxBreath ?? DEFAULT_MAX_BREATH);
    this._currentBreath = Math.min(
      Math.max(0, state.currentBreath ?? this._maxBreath),
      this._maxBreath,
    );
    this._isSubmerged = state.isSubmerged ?? false;
    this._breathLowFired = false;
  }
}
