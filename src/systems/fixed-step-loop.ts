export interface FixedStepLoopOptions {
  fixedDeltaSeconds?: number;
  maxSubSteps?: number;
  maxAccumulatedSeconds?: number;
}

/**
 * Deterministic gameplay ticker that consumes variable frame delta values
 * and emits one or more fixed simulation steps.
 */
export class FixedStepLoop {
  private readonly _fixedDeltaSeconds: number;
  private readonly _maxSubSteps: number;
  private readonly _maxAccumulatedSeconds: number;
  private _accumulator = 0;

  constructor(options: FixedStepLoopOptions = {}) {
    this._fixedDeltaSeconds = options.fixedDeltaSeconds ?? 1 / 60;
    this._maxSubSteps = options.maxSubSteps ?? 5;
    this._maxAccumulatedSeconds = options.maxAccumulatedSeconds ?? 0.25;
  }

  public tick(frameDeltaSeconds: number, onStep: (fixedDeltaSeconds: number) => void): number {
    if (!Number.isFinite(frameDeltaSeconds) || frameDeltaSeconds <= 0) return 0;

    this._accumulator += Math.min(frameDeltaSeconds, this._maxAccumulatedSeconds);

    let steps = 0;
    while (this._accumulator >= this._fixedDeltaSeconds && steps < this._maxSubSteps) {
      onStep(this._fixedDeltaSeconds);
      this._accumulator -= this._fixedDeltaSeconds;
      steps += 1;
    }

    if (steps === this._maxSubSteps && this._accumulator > this._fixedDeltaSeconds) {
      // Drop excess accumulated time to avoid endless catch-up spirals.
      this._accumulator = this._fixedDeltaSeconds;
    }

    return steps;
  }

  public get alpha(): number {
    if (this._fixedDeltaSeconds <= 0) return 0;
    return this._accumulator / this._fixedDeltaSeconds;
  }

  public reset(): void {
    this._accumulator = 0;
  }
}
