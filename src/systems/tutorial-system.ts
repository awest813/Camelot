/**
 * TutorialSystem — guided first-time-user tutorial engine.
 *
 * Allows game authors to define a linear sequence of tutorial steps that walk
 * new players through game controls and mechanics.  Steps are added via
 * `addStep()`.  Call `start()` to begin the tutorial and `advance()` to
 * complete the current step and reveal the next one.  The tutorial finishes
 * automatically after all steps have been advanced through.  Calling `skip()`
 * ends the tutorial early without marking it complete.  Call `reset()` to
 * return the system to its initial state.
 *
 * Usage:
 * ```ts
 * const tutorial = new TutorialSystem();
 * tutorial.addStep({ id: "move",   message: "Use WASD to move.", highlightTarget: "compass" });
 * tutorial.addStep({ id: "attack", message: "Left-click to attack." });
 *
 * tutorial.onStepBegin       = (index, step) => ui.showTip(step.message, step.highlightTarget);
 * tutorial.onStepComplete    = (index, step) => ui.dismissTip(step.id);
 * tutorial.onTutorialComplete = ()            => console.log("Tutorial finished!");
 *
 * tutorial.start();
 * // …later, when the player performs the expected action:
 * tutorial.advance();
 * ```
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TutorialStep {
  /** Unique identifier for this step. */
  id: string;
  /** Message shown to the player during this step. */
  message: string;
  /**
   * Optional identifier of a UI element or control to highlight.
   * The host game interprets this string (e.g. a CSS selector or element id).
   */
  highlightTarget?: string;
  /**
   * Optional human-readable label for the action that advances this step
   * (e.g. `"Press WASD"`, `"Open Inventory"`).  Used by UIs to hint at what
   * the player should do.
   */
  advanceHint?: string;
}

export interface TutorialSystemSaveState {
  started: boolean;
  completed: boolean;
  skipped: boolean;
  /** Index of the step currently shown; -1 when inactive. */
  currentStepIndex: number;
}

// ── System ────────────────────────────────────────────────────────────────────

export class TutorialSystem {
  private _steps: TutorialStep[] = [];
  private _currentStepIndex = -1;
  private _started = false;
  private _completed = false;
  private _skipped = false;

  // ── Callbacks ──────────────────────────────────────────────────────────────

  /**
   * Fired when a new step begins (either on `start()` or after each
   * successful `advance()`).
   * @param stepIndex Zero-based index of the step that is now active.
   * @param step      The step definition.
   */
  public onStepBegin: ((stepIndex: number, step: TutorialStep) => void) | null = null;

  /**
   * Fired when the player advances past a step (before `onStepBegin` fires
   * for the next one, or before `onTutorialComplete` fires on the last step).
   * @param stepIndex Zero-based index of the step that just completed.
   * @param step      The step definition.
   */
  public onStepComplete: ((stepIndex: number, step: TutorialStep) => void) | null = null;

  /** Fired when the final step is advanced through and the tutorial finishes. */
  public onTutorialComplete: (() => void) | null = null;

  /** Fired when `skip()` is called while the tutorial is active. */
  public onTutorialSkipped: (() => void) | null = null;

  // ── Step management ────────────────────────────────────────────────────────

  /**
   * Append a step to the end of the tutorial sequence.
   * Safe to call before or after `start()` — new steps added while the
   * tutorial is active extend the remaining sequence.
   */
  public addStep(step: TutorialStep): void {
    this._steps.push({ ...step });
  }

  /**
   * Remove the step with the given id.
   * No-op when no matching step exists.
   */
  public removeStep(id: string): void {
    this._steps = this._steps.filter((s) => s.id !== id);
  }

  /** Remove all registered steps and reset the system to its initial state. */
  public clearSteps(): void {
    this._steps = [];
    this._reset();
  }

  /** Returns the step with the given id, or `undefined`. */
  public getStep(id: string): TutorialStep | undefined {
    return this._steps.find((s) => s.id === id);
  }

  /** Returns a shallow copy of all registered steps in order. */
  public getAllSteps(): TutorialStep[] {
    return this._steps.map((s) => ({ ...s }));
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  /**
   * Begin the tutorial from the first step.
   *
   * @returns `true` if the tutorial started successfully, `false` if:
   *   - There are no registered steps.
   *   - The tutorial is already running (`isActive` is `true`).
   *   - The tutorial has already completed or been skipped.
   */
  public start(): boolean {
    if (this._steps.length === 0) return false;
    if (this._started) return false;

    this._started = true;
    this._currentStepIndex = 0;
    this.onStepBegin?.(0, { ...this._steps[0] });
    return true;
  }

  /**
   * Complete the current step and advance to the next one.
   *
   * Fires `onStepComplete` for the departing step, then either:
   *  - Fires `onStepBegin` for the next step, or
   *  - Sets `isCompleted` to `true` and fires `onTutorialComplete` when the
   *    last step was just completed.
   *
   * @returns `true` if the advance succeeded, `false` if the tutorial is not
   *          currently active (not started, already completed, or skipped).
   */
  public advance(): boolean {
    if (!this.isActive) return false;

    const completedIndex = this._currentStepIndex;
    const completedStep = this._steps[completedIndex];

    this.onStepComplete?.(completedIndex, { ...completedStep });

    const nextIndex = completedIndex + 1;
    if (nextIndex >= this._steps.length) {
      // All steps done — tutorial complete.
      this._currentStepIndex = -1;
      this._completed = true;
      this.onTutorialComplete?.();
    } else {
      this._currentStepIndex = nextIndex;
      this.onStepBegin?.(nextIndex, { ...this._steps[nextIndex] });
    }

    return true;
  }

  /**
   * Skip the tutorial.  Fires `onTutorialSkipped`.
   * No-op when the tutorial is not currently active.
   */
  public skip(): void {
    if (!this.isActive) return;
    this._currentStepIndex = -1;
    this._skipped = true;
    this.onTutorialSkipped?.();
  }

  /**
   * Reset the tutorial to its initial (not-started) state.
   * Does NOT clear registered steps.  No callbacks are fired.
   */
  public reset(): void {
    this._reset();
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  /** `true` once `start()` has been called successfully. */
  public get isStarted(): boolean {
    return this._started;
  }

  /** `true` after all steps have been advanced through. */
  public get isCompleted(): boolean {
    return this._completed;
  }

  /** `true` after `skip()` was called while the tutorial was active. */
  public get isSkipped(): boolean {
    return this._skipped;
  }

  /**
   * `true` while the tutorial has been started and is neither completed nor
   * skipped — i.e., `advance()` and `skip()` will have an effect.
   */
  public get isActive(): boolean {
    return this._started && !this._completed && !this._skipped;
  }

  /** The zero-based index of the step currently shown, or `-1` when inactive. */
  public get currentStepIndex(): number {
    return this._currentStepIndex;
  }

  /** The step currently being shown, or `null` when the tutorial is inactive. */
  public get currentStep(): TutorialStep | null {
    if (this._currentStepIndex < 0 || this._currentStepIndex >= this._steps.length) return null;
    return { ...this._steps[this._currentStepIndex] };
  }

  /** Total number of registered steps. */
  public get totalSteps(): number {
    return this._steps.length;
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  public getSnapshot(): TutorialSystemSaveState {
    return {
      started: this._started,
      completed: this._completed,
      skipped: this._skipped,
      currentStepIndex: this._currentStepIndex,
    };
  }

  /**
   * Restore state from a saved snapshot.
   * Callbacks are NOT fired on restore to prevent duplicate effects on load.
   */
  public restoreSnapshot(state: TutorialSystemSaveState): void {
    if (!state) return;
    this._started = typeof state.started === "boolean" ? state.started : false;
    this._completed = typeof state.completed === "boolean" ? state.completed : false;
    this._skipped = typeof state.skipped === "boolean" ? state.skipped : false;
    this._currentStepIndex = typeof state.currentStepIndex === "number" ? state.currentStepIndex : -1;
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private _reset(): void {
    this._currentStepIndex = -1;
    this._started = false;
    this._completed = false;
    this._skipped = false;
  }
}
