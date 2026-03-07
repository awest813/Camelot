export interface TimeSnapshot {
  /** In-game minutes since midnight (0 – <1440). */
  gameTime: number;
}

/**
 * Manages an in-game clock with configurable real-time day length.
 *
 * Mapping:
 *   1 real second → (24 × 60) / dayLengthSeconds  in-game minutes
 *
 * Default day length (120 real seconds per 24-hour day) means:
 *   1 real second ≈ 12 in-game minutes.
 *
 * Canonical hours:
 *   06:00 – sunrise / NPC wake     18:00 – dusk / NPC return home
 *   08:00 – shops open             20:00 – sunset / shops close
 *   22:00 – night begins           05:00 – pre-dawn
 */
export class TimeSystem {
  private _gameTime: number; // in-game minutes since midnight
  private _dayLengthSeconds: number;
  private _lastHour: number = -1;

  /** Fired once per in-game hour change, passing the new integer hour 0-23. */
  public onHourChange: ((hour: number) => void) | null = null;

  constructor(dayLengthSeconds: number = 120, startHour: number = 8) {
    this._dayLengthSeconds = Math.max(1, dayLengthSeconds);
    this._gameTime = Math.max(0, startHour) * 60;
    // Initialize _lastHour to the start hour so onHourChange doesn't fire
    // on the very first update for a transition that was never a change.
    this._lastHour = Math.floor(this._gameTime / 60);
  }

  // ── Update ────────────────────────────────────────────────────────────────

  /** Advance the clock.  Call every frame with deltaTime in real seconds. */
  public update(deltaTime: number): void {
    const minutesPerSecond = (24 * 60) / this._dayLengthSeconds;
    this._gameTime += deltaTime * minutesPerSecond;

    // Wrap to [0, 1440)
    while (this._gameTime >= 24 * 60) {
      this._gameTime -= 24 * 60;
    }

    const hour = Math.floor(this._gameTime / 60);
    if (hour !== this._lastHour) {
      this._lastHour = hour;
      this.onHourChange?.(hour);
    }
  }

  // ── Getters ───────────────────────────────────────────────────────────────

  /** Total in-game minutes since midnight (0 – <1440). */
  public get gameTime(): number {
    return this._gameTime;
  }

  /** Integer hour of day, 0-23. */
  public get hour(): number {
    return Math.floor(this._gameTime / 60);
  }

  /** Integer minute of hour, 0-59. */
  public get minute(): number {
    return Math.floor(this._gameTime % 60);
  }

  public get isDaytime(): boolean {
    const h = this.hour;
    return h >= 6 && h < 20;
  }

  public get isNight(): boolean {
    return !this.isDaytime;
  }

  /** Formatted "HH:MM" string. */
  public get timeString(): string {
    return `${String(this.hour).padStart(2, "0")}:${String(this.minute).padStart(2, "0")}`;
  }

  /** Normalised day progress [0, 1) where 0.5 = noon. */
  public get normalizedTime(): number {
    return this._gameTime / (24 * 60);
  }

  /**
   * Ambient light intensity scalar [0.08, 1.0] based on time of day.
   * Useful for darkening hemisphere/directional lights at night.
   */
  public get ambientIntensity(): number {
    const h = this.hour + this.minute / 60;
    if (h < 5 || h >= 22) return 0.08;
    if (h < 6)  return 0.08 + (h - 5)  * 0.30;  // dawn ramp
    if (h < 8)  return 0.38 + (h - 6)  * 0.17;  // early morning
    if (h < 12) return 0.72 + (h - 8)  * 0.07;  // morning
    if (h <= 14) return 1.0;                       // noon peak
    if (h < 18) return 1.0  - (h - 14) * 0.07;  // afternoon
    if (h < 20) return 0.72 - (h - 18) * 0.24;  // dusk
    if (h < 22) return 0.24 - (h - 20) * 0.08;  // evening
    return 0.08;
  }

  // ── NPC schedule helpers ──────────────────────────────────────────────────

  /** True between openHour (inclusive) and closeHour (exclusive). */
  public isOpen(openHour: number, closeHour: number): boolean {
    return this.hour >= openHour && this.hour < closeHour;
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  public getSaveState(): TimeSnapshot {
    return { gameTime: this._gameTime };
  }

  public restoreFromSave(snapshot: TimeSnapshot): void {
    if (typeof snapshot?.gameTime === "number") {
      this._gameTime = snapshot.gameTime;
      this._lastHour = Math.floor(this._gameTime / 60);
    }
  }
}
