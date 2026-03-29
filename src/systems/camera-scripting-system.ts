/**
 * CameraScriptingSystem — data-driven cinematic camera sequence engine.
 *
 * Allows designers to define named camera sequences composed of ordered steps.
 * Sequences are driven forward by the host game calling `update(deltaMs, context)`.
 * Instant steps execute synchronously; timed steps (pan_to, fade_out, fade_in,
 * shake, wait) suspend execution until the configured duration elapses.
 *
 * Supported step types:
 *  • look_at   – Point the camera at a world-space position (instant).
 *  • pan_to    – Smoothly move the camera to a world-space position over durationMs.
 *  • fade_out  – Fade the viewport to black over durationMs.
 *  • fade_in   – Fade the viewport back in from black over durationMs.
 *  • shake     – Apply a camera shake impulse for durationMs.
 *  • wait      – Pause sequence execution for durationMs.
 *
 * Usage:
 * ```ts
 * const cam = new CameraScriptingSystem();
 * cam.registerSequence({
 *   id: "intro_cutscene",
 *   steps: [
 *     { type: "fade_out", durationMs: 800 },
 *     { type: "look_at",  x: 10, y: 2, z: 5 },
 *     { type: "fade_in",  durationMs: 800 },
 *     { type: "pan_to",   x: 0, y: 1, z: 0, durationMs: 2000, easing: "ease_in_out" },
 *   ],
 * });
 *
 * cam.onSequenceComplete = (id) => console.log(`${id} done`);
 * cam.play("intro_cutscene", context);
 *
 * // In game loop:
 * cam.update(deltaMs, context);
 * ```
 */

// ── Types ──────────────────────────────────────────────────────────────────────

/** Easing function applied to timed camera moves. */
export type CameraEasing = "linear" | "ease_in" | "ease_out" | "ease_in_out";

export type CameraScriptStep =
  | { type: "look_at"; x: number; y: number; z: number }
  | { type: "pan_to"; x: number; y: number; z: number; durationMs?: number; easing?: CameraEasing }
  | { type: "fade_out"; durationMs?: number }
  | { type: "fade_in"; durationMs?: number }
  | { type: "shake"; intensity?: number; durationMs?: number }
  | { type: "wait"; durationMs: number };

export interface CameraSequenceDefinition {
  id: string;
  steps: CameraScriptStep[];
  /**
   * When `true` the sequence restarts from step 0 after the last step completes.
   * `onSequenceComplete` is NOT fired for looping sequences.
   * Defaults to `false`.
   */
  loop?: boolean;
}

/**
 * Context callbacks provided by the host game.
 * All callbacks are optional — missing ones are silently skipped.
 */
export interface CameraScriptingContext {
  /** Point the camera at the given world-space position. */
  cameraLookAt?: (x: number, y: number, z: number) => void;
  /** Smoothly move the camera to the given world-space position. */
  cameraPanTo?: (x: number, y: number, z: number, durationMs: number, easing: CameraEasing) => void;
  /** Fade the viewport to black over the given duration. */
  cameraFadeOut?: (durationMs: number) => void;
  /** Fade the viewport back in from black over the given duration. */
  cameraFadeIn?: (durationMs: number) => void;
  /** Apply a shake impulse to the camera. */
  cameraShake?: (intensity: number, durationMs: number) => void;
}

/** Internal runtime state for a playing sequence. */
export interface PlayingSequenceState {
  sequenceId: string;
  stepIndex: number;
  /** Remaining milliseconds for the current timed step; `null` when no timer is active. */
  remainingMs: number | null;
  paused: boolean;
}

export interface CameraScriptingSaveState {
  playing: Array<{
    sequenceId: string;
    stepIndex: number;
    remainingMs: number | null;
    paused: boolean;
  }>;
}

// ── System ────────────────────────────────────────────────────────────────────

export class CameraScriptingSystem {
  private _sequences = new Map<string, CameraSequenceDefinition>();
  private _playing   = new Map<string, PlayingSequenceState>();

  // ── Callbacks ──────────────────────────────────────────────────────────────

  /**
   * Fired just before a step begins executing.
   * @param sequenceId  The sequence that owns the step.
   * @param stepIndex   Zero-based index of the step about to execute.
   * @param step        The step definition.
   */
  public onStepBegin:
    | ((sequenceId: string, stepIndex: number, step: CameraScriptStep) => void)
    | null = null;

  /**
   * Fired after a step has been fully dispatched (for instant steps) or after
   * its timer expires (for timed steps).
   */
  public onStepComplete:
    | ((sequenceId: string, stepIndex: number, step: CameraScriptStep) => void)
    | null = null;

  /** Fired when all steps in a non-looping sequence complete. */
  public onSequenceComplete: ((sequenceId: string) => void) | null = null;

  /** Fired when `stop()` is called on a playing or paused sequence. */
  public onSequenceStopped: ((sequenceId: string) => void) | null = null;

  /** Fired when `pause()` transitions a playing sequence to paused. */
  public onSequencePaused: ((sequenceId: string) => void) | null = null;

  /** Fired when `resume()` transitions a paused sequence back to playing. */
  public onSequenceResumed: ((sequenceId: string) => void) | null = null;

  // ── Registration ───────────────────────────────────────────────────────────

  /**
   * Register a camera sequence definition.
   * Safe to call multiple times with the same id — re-registration replaces
   * the definition but does NOT interrupt an in-progress playback.
   */
  public registerSequence(def: CameraSequenceDefinition): void {
    this._sequences.set(def.id, { ...def, steps: [...def.steps] });
  }

  /**
   * Remove a registered sequence.
   * Returns `false` when the id is not registered.
   * Does not stop an in-progress playback of that sequence.
   */
  public unregisterSequence(id: string): boolean {
    return this._sequences.delete(id);
  }

  /** Returns the registered definition for `id`, or `undefined`. */
  public getSequence(id: string): CameraSequenceDefinition | undefined {
    return this._sequences.get(id);
  }

  /** Returns a copy of all registered sequence definitions. */
  public getAllSequences(): CameraSequenceDefinition[] {
    return Array.from(this._sequences.values());
  }

  // ── Playback ───────────────────────────────────────────────────────────────

  /**
   * Begin playing a registered sequence.
   *
   * The first step executes immediately (or begins its timer if timed).
   *
   * @returns `true` if playback started, `false` if:
   *   - The sequence is not registered.
   *   - The sequence is already playing or paused.
   */
  public play(sequenceId: string, context: CameraScriptingContext): boolean {
    const def = this._sequences.get(sequenceId);
    if (!def) return false;
    if (this._playing.has(sequenceId)) return false;

    const state: PlayingSequenceState = {
      sequenceId,
      stepIndex: 0,
      remainingMs: null,
      paused: false,
    };
    this._playing.set(sequenceId, state);
    this._executeCurrentStep(state, def, context);
    return true;
  }

  /**
   * Stop a playing or paused sequence.  Fires `onSequenceStopped`.
   * No-op if the sequence is not currently playing or paused.
   */
  public stop(sequenceId: string): void {
    if (!this._playing.has(sequenceId)) return;
    this._playing.delete(sequenceId);
    this.onSequenceStopped?.(sequenceId);
  }

  /**
   * Pause a playing sequence.  Fires `onSequencePaused`.
   * No-op if the sequence is not currently playing, or is already paused.
   */
  public pause(sequenceId: string): void {
    const state = this._playing.get(sequenceId);
    if (!state || state.paused) return;
    state.paused = true;
    this.onSequencePaused?.(sequenceId);
  }

  /**
   * Resume a paused sequence.  Fires `onSequenceResumed`.
   * No-op if the sequence is not paused.
   */
  public resume(sequenceId: string): void {
    const state = this._playing.get(sequenceId);
    if (!state || !state.paused) return;
    state.paused = false;
    this.onSequenceResumed?.(sequenceId);
  }

  /**
   * Jump to a specific step index in a playing (or paused) sequence.
   * The step at `stepIndex` is executed immediately (starting its timer if timed).
   *
   * @returns `true` on success, `false` if the sequence is not playing or the
   *          index is out of range.
   */
  public jumpToStep(
    sequenceId: string,
    stepIndex: number,
    context: CameraScriptingContext,
  ): boolean {
    const state = this._playing.get(sequenceId);
    const def   = this._sequences.get(sequenceId);
    if (!state || !def) return false;
    if (stepIndex < 0 || stepIndex >= def.steps.length) return false;

    state.stepIndex  = stepIndex;
    state.remainingMs = null;
    this._executeCurrentStep(state, def, context);
    return true;
  }

  /**
   * Advance all playing (non-paused) sequences by `deltaMs` milliseconds.
   * Timed steps whose timers expire will complete and the next step will begin.
   *
   * Call this every frame from the game loop.
   *
   * @param deltaMs   Elapsed time since the last frame in milliseconds.
   * @param context   Camera context used to dispatch step callbacks.
   */
  public update(deltaMs: number, context: CameraScriptingContext): void {
    for (const state of Array.from(this._playing.values())) {
      if (state.paused) continue;
      if (state.remainingMs === null) continue;

      state.remainingMs -= deltaMs;
      if (state.remainingMs > 0) continue;

      // Timer expired — complete current step and advance.
      const def = this._sequences.get(state.sequenceId);
      if (!def) continue;

      const completedStep = def.steps[state.stepIndex];
      this.onStepComplete?.(state.sequenceId, state.stepIndex, completedStep);
      this._advance(state, def, context);
    }
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  /** `true` if the sequence is currently playing (including paused). */
  public isPlaying(sequenceId: string): boolean {
    return this._playing.has(sequenceId);
  }

  /** `true` if the sequence is currently paused. */
  public isPaused(sequenceId: string): boolean {
    return this._playing.get(sequenceId)?.paused ?? false;
  }

  /**
   * Returns the zero-based index of the step currently executing for the
   * given sequence, or `null` if the sequence is not playing.
   */
  public getPlayheadStep(sequenceId: string): number | null {
    return this._playing.get(sequenceId)?.stepIndex ?? null;
  }

  /** All currently playing (including paused) sequence states. */
  public get playingSequences(): ReadonlyArray<Readonly<PlayingSequenceState>> {
    return Array.from(this._playing.values());
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  public getSnapshot(): CameraScriptingSaveState {
    return {
      playing: Array.from(this._playing.values()).map((s) => ({
        sequenceId:  s.sequenceId,
        stepIndex:   s.stepIndex,
        remainingMs: s.remainingMs,
        paused:      s.paused,
      })),
    };
  }

  /**
   * Restore playback state from a saved snapshot.
   * Callbacks are NOT fired on restore to prevent duplicate effects on load.
   */
  public restoreSnapshot(state: CameraScriptingSaveState): void {
    if (!state) return;
    this._playing.clear();

    if (!Array.isArray(state.playing)) return;
    for (const entry of state.playing) {
      if (typeof entry.sequenceId !== "string") continue;
      if (!this._sequences.has(entry.sequenceId)) continue; // sequence no longer registered
      this._playing.set(entry.sequenceId, {
        sequenceId:  entry.sequenceId,
        stepIndex:   typeof entry.stepIndex  === "number" ? entry.stepIndex  : 0,
        remainingMs: typeof entry.remainingMs === "number" ? entry.remainingMs : null,
        paused:      typeof entry.paused === "boolean" ? entry.paused : false,
      });
    }
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  /**
   * Execute the step at `state.stepIndex`.
   * Instant steps dispatch their callback and immediately call `_advance`.
   * Timed steps dispatch their callback and set `remainingMs` to their duration.
   */
  private _executeCurrentStep(
    state: PlayingSequenceState,
    def: CameraSequenceDefinition,
    context: CameraScriptingContext,
  ): void {
    if (state.stepIndex >= def.steps.length) return;

    const step = def.steps[state.stepIndex];
    this.onStepBegin?.(state.sequenceId, state.stepIndex, step);

    switch (step.type) {
      case "look_at":
        context.cameraLookAt?.(step.x, step.y, step.z);
        // Instant — complete immediately and advance.
        this.onStepComplete?.(state.sequenceId, state.stepIndex, step);
        this._advance(state, def, context);
        break;

      case "pan_to": {
        const dur    = step.durationMs ?? 1000;
        const easing = step.easing    ?? "linear";
        context.cameraPanTo?.(step.x, step.y, step.z, dur, easing);
        state.remainingMs = dur;
        break;
      }

      case "fade_out": {
        const dur = step.durationMs ?? 500;
        context.cameraFadeOut?.(dur);
        state.remainingMs = dur;
        break;
      }

      case "fade_in": {
        const dur = step.durationMs ?? 500;
        context.cameraFadeIn?.(dur);
        state.remainingMs = dur;
        break;
      }

      case "shake": {
        const intensity = step.intensity ?? 0.5;
        const dur       = step.durationMs ?? 500;
        context.cameraShake?.(intensity, dur);
        state.remainingMs = dur;
        break;
      }

      case "wait":
        // No callback — pure timing pause.
        state.remainingMs = step.durationMs;
        break;
    }
  }

  /**
   * Move `state` to the next step and execute it.
   * If all steps are done, either loop or fire `onSequenceComplete`.
   */
  private _advance(
    state: PlayingSequenceState,
    def: CameraSequenceDefinition,
    context: CameraScriptingContext,
  ): void {
    state.remainingMs = null;
    state.stepIndex++;

    if (state.stepIndex < def.steps.length) {
      this._executeCurrentStep(state, def, context);
      return;
    }

    // All steps complete.
    if (def.loop) {
      state.stepIndex = 0;
      this._executeCurrentStep(state, def, context);
    } else {
      this._playing.delete(state.sequenceId);
      this.onSequenceComplete?.(state.sequenceId);
    }
  }
}
