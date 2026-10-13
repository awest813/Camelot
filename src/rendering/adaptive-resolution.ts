/**
 * adaptive-resolution — dynamic render scale to hold a target frame rate.
 *
 * Feeds on the measured FPS; when it stays below target the hardware
 * scaling level rises (fewer pixels), when there's sustained headroom it
 * eases back toward the tier's base level.  Hysteresis + cooldown avoid
 * oscillation.  Pure logic — `game.ts` applies the level to the engine.
 */
export interface AdaptiveResolutionOptions {
  /** Tier's configured scaling level (1 = native). */
  baseLevel: number;
  /** Frame-rate the controller defends. */
  targetFps: number;
  /** Highest scaling level allowed (lowest resolution). */
  maxLevel?: number;
  /** Level change per adjustment. */
  step?: number;
  /** Seconds between adjustments. */
  cooldown?: number;
}

export class AdaptiveResolution {
  public readonly baseLevel: number;
  public readonly targetFps: number;
  public readonly maxLevel: number;
  private readonly _step: number;
  private readonly _cooldown: number;
  private _level: number;
  private _avgFps: number;
  private _timer = 0;
  private _warmup = 4;
  public enabled = true;

  constructor(opts: AdaptiveResolutionOptions) {
    this.baseLevel = opts.baseLevel;
    this.targetFps = opts.targetFps;
    this.maxLevel = Math.max(opts.baseLevel, opts.maxLevel ?? opts.baseLevel * 1.6);
    this._step = opts.step ?? 0.1;
    this._cooldown = opts.cooldown ?? 1.5;
    this._level = opts.baseLevel;
    this._avgFps = opts.targetFps;
  }

  public get level(): number {
    return this._level;
  }

  public get averageFps(): number {
    return this._avgFps;
  }

  /**
   * Advance with the frame delta (s) and instantaneous FPS.  Returns the new
   * scaling level when it changed, otherwise null.
   */
  public update(dt: number, fps: number): number | null {
    if (!this.enabled || !(dt > 0) || !Number.isFinite(fps) || fps <= 0) return null;
    // ~1 s exponential average.
    this._avgFps += (fps - this._avgFps) * Math.min(1, dt);
    if (this._warmup > 0) {
      this._warmup -= dt;
      return null;
    }
    this._timer -= dt;
    if (this._timer > 0) return null;

    let next = this._level;
    if (this._avgFps < this.targetFps * 0.9) {
      // Bigger steps when far below target.
      const deficit = 1 - this._avgFps / this.targetFps;
      next = Math.min(this.maxLevel, this._level + this._step * (deficit > 0.35 ? 2 : 1));
    } else if (this._avgFps > this.targetFps * 1.12 && this._level > this.baseLevel) {
      next = Math.max(this.baseLevel, this._level - this._step * 0.5);
    }
    if (Math.abs(next - this._level) < 1e-6) return null;
    this._level = next;
    this._timer = this._cooldown;
    return next;
  }
}
