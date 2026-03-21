/**
 * WeatherScheduleSystem — Authored named weather sequences for Camelot.
 *
 * Manages named weather schedules, each consisting of an ordered list of
 * timed steps that drive a `WeatherSystem` through scripted transitions.
 * Supports looping, pause/resume, step callbacks, and snapshot persistence.
 *
 * Headless: no BabylonJS dependencies — integration with `WeatherSystem` is
 * optional; weather transitions are communicated via the `onStep` callback.
 */

import type { WeatherState } from "./weather-system";

// ── Step ──────────────────────────────────────────────────────────────────────

/**
 * A single timed entry in a weather schedule.
 * The schedule advances to the next step after `durationSeconds` have elapsed.
 */
export interface WeatherScheduleStep {
  /** The weather state to transition to at this step. */
  weather: WeatherState;
  /**
   * How long (in real-time seconds) this weather state should last before the
   * schedule advances to the next step.
   */
  durationSeconds: number;
  /** Optional label for debug / UI display. */
  label?: string;
}

// ── Definition ────────────────────────────────────────────────────────────────

/**
 * Static configuration for a named weather schedule.
 */
export interface WeatherScheduleDefinition {
  /** Stable unique identifier. */
  id: string;
  /** Human-readable name. */
  label: string;
  /** Optional lore/design description. */
  description?: string;
  /** Ordered list of weather steps. Must have at least one entry. */
  steps: WeatherScheduleStep[];
  /**
   * When `true`, the schedule loops back to step 0 after the last step
   * completes rather than stopping.
   */
  loop?: boolean;
}

// ── Snapshot ──────────────────────────────────────────────────────────────────

export interface WeatherScheduleSnapshot {
  /** Id of the active schedule, or `null` when idle. */
  activeScheduleId: string | null;
  /** Current step index within the active schedule. */
  currentStepIndex: number;
  /** Seconds remaining on the current step. */
  stepTimeRemaining: number;
  /** Whether playback is paused. */
  paused: boolean;
}

// ── System ────────────────────────────────────────────────────────────────────

export class WeatherScheduleSystem {
  // ── Registry ──────────────────────────────────────────────────────────────
  private readonly _schedules = new Map<string, WeatherScheduleDefinition>();

  // ── Playback state ────────────────────────────────────────────────────────
  private _activeScheduleId: string | null = null;
  private _currentStepIndex: number = 0;
  private _stepTimeRemaining: number = 0;
  private _paused: boolean = false;
  private _suppressCallbacks: boolean = false;

  // ── Callbacks ─────────────────────────────────────────────────────────────

  /**
   * Fired when a step becomes active (either on `play()` or natural advance).
   * The game layer should call `weatherSystem.forceWeather(step.weather)`.
   */
  public onStep: ((scheduleId: string, stepIndex: number, step: WeatherScheduleStep) => void) | null = null;

  /**
   * Fired when the active schedule completes all steps and `loop` is `false`.
   */
  public onComplete: ((scheduleId: string) => void) | null = null;

  // ── CRUD ──────────────────────────────────────────────────────────────────

  /**
   * Register (or replace) a weather schedule definition.
   * Throws if `steps` is empty or any step has a non-positive `durationSeconds`.
   */
  public addSchedule(def: WeatherScheduleDefinition): void {
    if (!def.id || !def.id.trim()) {
      throw new Error("WeatherScheduleSystem: schedule id must be a non-empty string.");
    }
    if (!def.steps || def.steps.length === 0) {
      throw new Error(`WeatherScheduleSystem: schedule "${def.id}" must have at least one step.`);
    }
    for (let i = 0; i < def.steps.length; i++) {
      const step = def.steps[i];
      if (!step.weather) {
        throw new Error(`WeatherScheduleSystem: step ${i} in schedule "${def.id}" is missing a weather value.`);
      }
      if (typeof step.durationSeconds !== "number" || step.durationSeconds <= 0) {
        throw new Error(
          `WeatherScheduleSystem: step ${i} in schedule "${def.id}" must have a positive durationSeconds (got ${step.durationSeconds}).`,
        );
      }
    }
    this._schedules.set(def.id, { ...def, steps: def.steps.map((s) => ({ ...s })) });
  }

  /**
   * Remove a schedule by id.
   * If the removed schedule is currently active, playback is stopped.
   * Returns `true` if a schedule was removed, `false` if the id was not found.
   */
  public removeSchedule(id: string): boolean {
    const existed = this._schedules.delete(id);
    if (existed && this._activeScheduleId === id) {
      this._stopPlayback();
    }
    return existed;
  }

  /**
   * Look up a schedule by id.
   * Returns a shallow copy to prevent external mutation.
   */
  public getSchedule(id: string): WeatherScheduleDefinition | undefined {
    const def = this._schedules.get(id);
    if (!def) return undefined;
    return { ...def, steps: def.steps.map((s) => ({ ...s })) };
  }

  /** Returns all registered schedule ids in insertion order. */
  public getScheduleIds(): string[] {
    return Array.from(this._schedules.keys());
  }

  /** Returns the number of registered schedules. */
  public get scheduleCount(): number {
    return this._schedules.size;
  }

  // ── Playback ──────────────────────────────────────────────────────────────

  /**
   * Start playing a schedule from its first step.
   * Throws if the schedule id is not registered.
   * If another schedule is active, it is stopped first.
   */
  public play(id: string): void {
    const def = this._schedules.get(id);
    if (!def) {
      throw new Error(`WeatherScheduleSystem: no schedule with id "${id}".`);
    }
    this._activeScheduleId = id;
    this._currentStepIndex = 0;
    this._stepTimeRemaining = def.steps[0].durationSeconds;
    this._paused = false;
    this._fireStepCallback(def, 0);
  }

  /**
   * Stop playback. The system returns to idle state.
   */
  public stop(): void {
    this._stopPlayback();
  }

  /**
   * Pause playback. Has no effect if not currently playing.
   */
  public pause(): void {
    if (this._activeScheduleId !== null) {
      this._paused = true;
    }
  }

  /**
   * Resume paused playback. Has no effect if not paused.
   */
  public resume(): void {
    this._paused = false;
  }

  /**
   * Jump to a specific step index within the active schedule.
   * Throws if no schedule is active or index is out of range.
   */
  public jumpToStep(stepIndex: number): void {
    if (this._activeScheduleId === null) {
      throw new Error("WeatherScheduleSystem: no active schedule to jump within.");
    }
    const def = this._schedules.get(this._activeScheduleId)!;
    if (stepIndex < 0 || stepIndex >= def.steps.length) {
      throw new Error(
        `WeatherScheduleSystem: step index ${stepIndex} is out of range (0–${def.steps.length - 1}).`,
      );
    }
    this._currentStepIndex = stepIndex;
    this._stepTimeRemaining = def.steps[stepIndex].durationSeconds;
    this._fireStepCallback(def, stepIndex);
  }

  // ── Query ─────────────────────────────────────────────────────────────────

  /** `true` while a schedule is active and not stopped. */
  public get isPlaying(): boolean {
    return this._activeScheduleId !== null;
  }

  /** `true` when playback is active but temporarily paused. */
  public get isPaused(): boolean {
    return this._paused;
  }

  /** Id of the currently active schedule, or `null` when idle. */
  public get activeScheduleId(): string | null {
    return this._activeScheduleId;
  }

  /** Current step index within the active schedule (0-based). */
  public get currentStepIndex(): number {
    return this._currentStepIndex;
  }

  /**
   * Seconds remaining on the current step.
   * Returns 0 when idle.
   */
  public get stepTimeRemaining(): number {
    return this._stepTimeRemaining;
  }

  /**
   * The current active step definition, or `null` when idle.
   */
  public get currentStep(): WeatherScheduleStep | null {
    if (this._activeScheduleId === null) return null;
    const def = this._schedules.get(this._activeScheduleId);
    if (!def) return null;
    return { ...def.steps[this._currentStepIndex] };
  }

  // ── Update ────────────────────────────────────────────────────────────────

  /**
   * Advance the schedule simulation.
   * Call once per fixed-step game loop tick.
   *
   * @param deltaTime Elapsed real-time seconds since last tick.
   */
  public update(deltaTime: number): void {
    if (this._activeScheduleId === null || this._paused) return;

    const def = this._schedules.get(this._activeScheduleId);
    if (!def) {
      this._stopPlayback();
      return;
    }

    this._stepTimeRemaining -= deltaTime;

    while (this._stepTimeRemaining <= 0) {
      const nextIndex = this._currentStepIndex + 1;

      if (nextIndex >= def.steps.length) {
        // End of schedule
        if (def.loop) {
          // Loop back to beginning
          this._currentStepIndex = 0;
          this._stepTimeRemaining += def.steps[0].durationSeconds;
          this._fireStepCallback(def, 0);
        } else {
          // Stop and fire completion
          const completedId = this._activeScheduleId;
          this._stopPlayback();
          if (!this._suppressCallbacks) {
            this.onComplete?.(completedId);
          }
          return;
        }
      } else {
        this._currentStepIndex = nextIndex;
        this._stepTimeRemaining += def.steps[nextIndex].durationSeconds;
        this._fireStepCallback(def, nextIndex);
      }
    }
  }

  // ── Snapshot / restore ────────────────────────────────────────────────────

  public getSnapshot(): WeatherScheduleSnapshot {
    return {
      activeScheduleId: this._activeScheduleId,
      currentStepIndex: this._currentStepIndex,
      stepTimeRemaining: this._stepTimeRemaining,
      paused: this._paused,
    };
  }

  /**
   * Restore playback state from a snapshot.
   * Unknown schedule ids are silently ignored (playback stays idle).
   * Callbacks are suppressed during restore to avoid re-triggering side-effects.
   */
  public restoreSnapshot(snap: WeatherScheduleSnapshot): void {
    this._suppressCallbacks = true;
    try {
      this._stopPlayback();
      if (snap.activeScheduleId !== null) {
        const def = this._schedules.get(snap.activeScheduleId);
        if (def) {
          const stepIndex = Math.max(
            0,
            Math.min(snap.currentStepIndex ?? 0, def.steps.length - 1),
          );
          this._activeScheduleId = snap.activeScheduleId;
          this._currentStepIndex = stepIndex;
          this._stepTimeRemaining =
            typeof snap.stepTimeRemaining === "number" && Number.isFinite(snap.stepTimeRemaining)
              ? snap.stepTimeRemaining
              : def.steps[stepIndex].durationSeconds;
          this._paused = snap.paused ?? false;
        }
      }
    } finally {
      this._suppressCallbacks = false;
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _stopPlayback(): void {
    this._activeScheduleId = null;
    this._currentStepIndex = 0;
    this._stepTimeRemaining = 0;
    this._paused = false;
  }

  private _fireStepCallback(def: WeatherScheduleDefinition, stepIndex: number): void {
    if (!this._suppressCallbacks) {
      this.onStep?.(def.id, stepIndex, { ...def.steps[stepIndex] });
    }
  }
}
