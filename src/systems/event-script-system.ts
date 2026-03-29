/**
 * EventScriptSystem — data-driven scripted encounter / cutscene engine.
 *
 * Allows designers to define named event scripts composed of ordered steps.
 * Scripts are driven forward by the host game calling `update(gameTimeMinutes)`.
 * Non-wait steps execute synchronously; `wait_hours` steps pause execution
 * until the game clock advances far enough.
 *
 * Supported step types:
 *  • show_notification  – Fire a UI notification message.
 *  • trigger_quest      – Activate a quest via the quest engine.
 *  • award_item         – Give item(s) to the player.
 *  • remove_item        – Remove item(s) from the player.
 *  • set_flag           – Set a named boolean flag.
 *  • faction_delta      – Adjust a faction's reputation.
 *  • wait_hours         – Pause execution for N in-game hours.
 *  • emit_event         – Dispatch a typed game event (e.g. quest:kill:enemy).
 *  • branch_on_flag     – Conditional branch based on a flag value.
 *  • branch_on_quest    – Conditional branch based on quest status.
 *  • camera_look_at     – Point the camera at a world-space position.
 *  • camera_pan_to      – Smoothly move the camera to a world-space position.
 *  • camera_fade_out    – Fade the viewport to black.
 *  • camera_fade_in     – Fade the viewport back in from black.
 *  • camera_shake       – Apply a shake impulse to the camera.
 *
 * Usage:
 * ```ts
 * const scripts = new EventScriptSystem();
 * scripts.registerScript({
 *   id: "ambush_intro",
 *   steps: [
 *     { type: "show_notification", message: "You sense danger!" },
 *     { type: "trigger_quest", questId: "q_bandit_ambush" },
 *     { type: "award_item", itemId: "health_potion", quantity: 2 },
 *   ],
 * });
 *
 * scripts.onScriptComplete = (id) => console.log(`${id} finished`);
 * scripts.run("ambush_intro", context);
 * ```
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export type QuestStatusCondition = "inactive" | "active" | "completed";

/** Simple (non-branching) steps that execute immediately. */
export type SimpleEventScriptStep =
  | { type: "show_notification"; message: string; durationMs?: number }
  | { type: "trigger_quest"; questId: string }
  | { type: "award_item"; itemId: string; quantity?: number }
  | { type: "remove_item"; itemId: string; quantity?: number }
  | { type: "set_flag"; flag: string; value: boolean }
  | { type: "faction_delta"; factionId: string; amount: number }
  | { type: "wait_hours"; hours: number }
  | { type: "emit_event"; eventType: string; targetId: string; amount?: number }
  | { type: "camera_look_at"; x: number; y: number; z: number }
  | { type: "camera_pan_to"; x: number; y: number; z: number; durationMs?: number }
  | { type: "camera_fade_out"; durationMs?: number }
  | { type: "camera_fade_in"; durationMs?: number }
  | { type: "camera_shake"; intensity?: number; durationMs?: number };

/** Branching steps (may contain sub-steps). */
export type BranchEventScriptStep =
  | {
      type: "branch_on_flag";
      flag: string;
      ifTrue: EventScriptStep[];
      ifFalse?: EventScriptStep[];
    }
  | {
      type: "branch_on_quest";
      questId: string;
      /** Branch fires when the quest matches this status. */
      status: QuestStatusCondition;
      then: EventScriptStep[];
      else?: EventScriptStep[];
    };

export type EventScriptStep = SimpleEventScriptStep | BranchEventScriptStep;

export interface EventScript {
  id: string;
  steps: EventScriptStep[];
  /**
   * When `true` the script can be run again after completing.
   * Defaults to `false` — a completed non-repeatable script is silently
   * skipped on subsequent `run()` calls.
   */
  repeatable?: boolean;
}

/**
 * Context object provided by the host game.
 * The EventScriptSystem calls these pure-function hooks to drive in-game effects.
 */
export interface EventScriptContext {
  getFlag: (flag: string) => boolean;
  setFlag: (flag: string, value: boolean) => void;
  getQuestStatus: (questId: string) => QuestStatusCondition;
  activateQuest: (questId: string) => void;
  giveItem: (itemId: string, quantity: number) => void;
  removeItem: (itemId: string, quantity: number) => boolean;
  adjustFaction: (factionId: string, amount: number) => void;
  showNotification: (message: string, durationMs?: number) => void;
  emitEvent: (eventType: string, targetId: string, amount: number) => void;
  /** Returns the current game time in minutes (from TimeSystem.gameTime). */
  getCurrentGameTimeMinutes: () => number;
  // ── Optional camera control callbacks ──────────────────────────────────────
  /** Point the camera at the given world-space position. */
  cameraLookAt?: (x: number, y: number, z: number) => void;
  /** Smoothly move the camera to the given world-space position. */
  cameraPanTo?: (x: number, y: number, z: number, durationMs: number) => void;
  /** Fade the viewport to black over the given duration. */
  cameraFadeOut?: (durationMs: number) => void;
  /** Fade the viewport back in from black over the given duration. */
  cameraFadeIn?: (durationMs: number) => void;
  /** Apply a shake impulse to the camera. */
  cameraShake?: (intensity: number, durationMs: number) => void;
}

/** Internal state for a script that is currently running. */
export interface RunningScriptState {
  scriptId: string;
  /** Flattened / branch-resolved step list built when `run()` is called. */
  resolvedSteps: SimpleEventScriptStep[];
  stepIndex: number;
  /** When non-null, execution is paused until the game clock reaches this minute mark. */
  waitUntilGameTime: number | null;
}

export interface EventScriptSaveState {
  completedScriptIds: string[];
  pendingScripts: Array<{
    scriptId: string;
    resolvedSteps: SimpleEventScriptStep[];
    stepIndex: number;
    waitUntilGameTime: number | null;
  }>;
}

// ── System ────────────────────────────────────────────────────────────────────

export class EventScriptSystem {
  private _scripts = new Map<string, EventScript>();
  private _running = new Map<string, RunningScriptState>();
  private _completed = new Set<string>();

  // ── Callbacks ──────────────────────────────────────────────────────────────

  /**
   * Fired after each step is executed.
   * @param scriptId   The script that owns the step.
   * @param stepIndex  Zero-based index in the resolved step array.
   * @param step       The step that was just executed.
   */
  public onStepExecuted:
    | ((scriptId: string, stepIndex: number, step: SimpleEventScriptStep) => void)
    | null = null;

  /** Fired when a script completes all of its steps. */
  public onScriptComplete: ((scriptId: string) => void) | null = null;

  /** Fired when a script is cancelled before completion. */
  public onScriptCancelled: ((scriptId: string) => void) | null = null;

  // ── Registration ───────────────────────────────────────────────────────────

  /**
   * Register an event script.  Safe to call multiple times with the same id
   * (re-registration replaces the script definition but does NOT interrupt an
   * in-progress run).
   */
  public registerScript(script: EventScript): void {
    this._scripts.set(script.id, script);
  }

  /**
   * Returns the registered script for the given id, or `undefined`.
   */
  public getScript(scriptId: string): EventScript | undefined {
    return this._scripts.get(scriptId);
  }

  // ── Running ────────────────────────────────────────────────────────────────

  /**
   * Start running a registered script.
   *
   * Branch steps are resolved immediately against `context` so the resolved
   * step list is a flat array of simple steps.
   *
   * @returns `true` if the script started, `false` if:
   *   - The script is not registered.
   *   - The script is already running.
   *   - The script has already completed and is not marked `repeatable`.
   */
  public run(scriptId: string, context: EventScriptContext): boolean {
    const script = this._scripts.get(scriptId);
    if (!script) return false;
    if (this._running.has(scriptId)) return false;
    if (this._completed.has(scriptId) && !script.repeatable) return false;

    const resolved = this._resolveSteps(script.steps, context);

    const running: RunningScriptState = {
      scriptId,
      resolvedSteps: resolved,
      stepIndex: 0,
      waitUntilGameTime: null,
    };
    this._running.set(scriptId, running);

    // Execute immediately until we hit a wait or finish.
    this._advance(running, context);
    return true;
  }

  /**
   * Cancel a currently running script.  Fires `onScriptCancelled`.
   * No-op if the script is not running.
   */
  public cancel(scriptId: string): void {
    if (!this._running.has(scriptId)) return;
    this._running.delete(scriptId);
    this.onScriptCancelled?.(scriptId);
  }

  /**
   * Advance all running scripts that are waiting on the game clock.
   * Call this from `TimeSystem.onHourChange` or similar.
   *
   * @param gameTimeMinutes Current game time in minutes.
   */
  public update(gameTimeMinutes: number, context: EventScriptContext): void {
    for (const running of Array.from(this._running.values())) {
      if (running.waitUntilGameTime !== null && gameTimeMinutes >= running.waitUntilGameTime) {
        running.waitUntilGameTime = null;
        this._advance(running, context);
      }
    }
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  /** Returns `true` if the script is currently paused waiting for the clock. */
  public isWaiting(scriptId: string): boolean {
    const r = this._running.get(scriptId);
    return r !== undefined && r.waitUntilGameTime !== null;
  }

  /** Returns `true` if the script is currently running (including waiting). */
  public isPending(scriptId: string): boolean {
    return this._running.has(scriptId);
  }

  /** Returns `true` if the script has completed at least once. */
  public isCompleted(scriptId: string): boolean {
    return this._completed.has(scriptId);
  }

  /** All currently running (including waiting) script states. */
  public get runningScripts(): ReadonlyArray<Readonly<RunningScriptState>> {
    return Array.from(this._running.values());
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  public getSaveState(): EventScriptSaveState {
    return {
      completedScriptIds: Array.from(this._completed),
      pendingScripts: Array.from(this._running.values()).map((r) => ({
        scriptId: r.scriptId,
        resolvedSteps: r.resolvedSteps.map((s) => ({ ...s } as SimpleEventScriptStep)),
        stepIndex: r.stepIndex,
        waitUntilGameTime: r.waitUntilGameTime,
      })),
    };
  }

  public restoreFromSave(state: EventScriptSaveState): void {
    if (!state) return;
    this._completed.clear();
    this._running.clear();

    if (Array.isArray(state.completedScriptIds)) {
      for (const id of state.completedScriptIds) {
        if (typeof id === "string") this._completed.add(id);
      }
    }

    if (Array.isArray(state.pendingScripts)) {
      for (const entry of state.pendingScripts) {
        if (typeof entry.scriptId !== "string") continue;
        if (!this._scripts.has(entry.scriptId)) continue; // script no longer registered
        this._running.set(entry.scriptId, {
          scriptId: entry.scriptId,
          resolvedSteps: Array.isArray(entry.resolvedSteps) ? entry.resolvedSteps : [],
          stepIndex: typeof entry.stepIndex === "number" ? entry.stepIndex : 0,
          waitUntilGameTime:
            typeof entry.waitUntilGameTime === "number" ? entry.waitUntilGameTime : null,
        });
      }
    }
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  /**
   * Execute steps starting from `running.stepIndex` until:
   *  - All steps are done (fires `onScriptComplete`), or
   *  - A `wait_hours` step is encountered (suspends).
   */
  private _advance(running: RunningScriptState, context: EventScriptContext): void {
    const { resolvedSteps } = running;

    while (running.stepIndex < resolvedSteps.length) {
      const step = resolvedSteps[running.stepIndex];

      if (step.type === "wait_hours") {
        const waitMinutes = Math.max(0, step.hours) * 60;
        running.waitUntilGameTime = context.getCurrentGameTimeMinutes() + waitMinutes;
        this.onStepExecuted?.(running.scriptId, running.stepIndex, step);
        running.stepIndex++;
        return; // suspend — call update() to resume
      }

      this._executeStep(running.scriptId, running.stepIndex, step, context);
      running.stepIndex++;
    }

    // All steps executed — script is complete.
    const { scriptId } = running;
    this._running.delete(scriptId);
    const script = this._scripts.get(scriptId);
    if (!script?.repeatable) {
      this._completed.add(scriptId);
    }
    this.onScriptComplete?.(scriptId);
  }

  /**
   * Dispatch a single resolved (simple) step against the context.
   */
  private _executeStep(
    scriptId: string,
    stepIndex: number,
    step: SimpleEventScriptStep,
    context: EventScriptContext,
  ): void {
    switch (step.type) {
      case "show_notification":
        context.showNotification(step.message, step.durationMs);
        break;
      case "trigger_quest":
        context.activateQuest(step.questId);
        break;
      case "award_item":
        context.giveItem(step.itemId, step.quantity ?? 1);
        break;
      case "remove_item":
        context.removeItem(step.itemId, step.quantity ?? 1);
        break;
      case "set_flag":
        context.setFlag(step.flag, step.value);
        break;
      case "faction_delta":
        context.adjustFaction(step.factionId, step.amount);
        break;
      case "emit_event":
        context.emitEvent(step.eventType, step.targetId, step.amount ?? 1);
        break;
      case "camera_look_at":
        context.cameraLookAt?.(step.x, step.y, step.z);
        break;
      case "camera_pan_to":
        context.cameraPanTo?.(step.x, step.y, step.z, step.durationMs ?? 1000);
        break;
      case "camera_fade_out":
        context.cameraFadeOut?.(step.durationMs ?? 500);
        break;
      case "camera_fade_in":
        context.cameraFadeIn?.(step.durationMs ?? 500);
        break;
      case "camera_shake":
        context.cameraShake?.(step.intensity ?? 0.5, step.durationMs ?? 500);
        break;
    }
    this.onStepExecuted?.(scriptId, stepIndex, step);
  }

  /**
   * Recursively flatten `EventScriptStep[]` into `SimpleEventScriptStep[]`
   * by evaluating branch conditions against `context`.
   */
  private _resolveSteps(
    steps: EventScriptStep[],
    context: EventScriptContext,
  ): SimpleEventScriptStep[] {
    const out: SimpleEventScriptStep[] = [];
    for (const step of steps) {
      if (step.type === "branch_on_flag") {
        const flag = context.getFlag(step.flag);
        const branch = flag ? step.ifTrue : (step.ifFalse ?? []);
        out.push(...this._resolveSteps(branch, context));
      } else if (step.type === "branch_on_quest") {
        const status = context.getQuestStatus(step.questId);
        const branch = status === step.status ? step.then : (step.else ?? []);
        out.push(...this._resolveSteps(branch, context));
      } else {
        out.push(step as SimpleEventScriptStep);
      }
    }
    return out;
  }
}
