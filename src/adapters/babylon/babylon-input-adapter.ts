/**
 * BabylonInputAdapter — Decouples input action mapping from the game loop.
 *
 * The adapter defines a set of named input actions (e.g. "meleeAttack",
 * "toggleInventory", "castSpell") and maps keyboard/mouse events to them.
 * Game code subscribes to actions instead of raw key codes, which:
 *
 *   - Allows headless input simulation for testing (call `simulateAction()`).
 *   - Makes keybinding remapping trivial (swap entries in the binding map).
 *   - Decouples the Babylon observable wiring from gameplay logic.
 *
 * This adapter is designed to sit alongside the existing `game.ts` input
 * handling.  game.ts can adopt it incrementally without a rewrite.
 *
 * Usage (Babylon runtime):
 * ```ts
 * const input = new BabylonInputAdapter();
 * input.onAction("meleeAttack", () => combatSystem.meleeAttack());
 * input.attachToScene(scene);
 * ```
 *
 * Usage (headless test):
 * ```ts
 * const input = new BabylonInputAdapter();
 * input.onAction("meleeAttack", () => attacks++);
 * input.simulateAction("meleeAttack");
 * expect(attacks).toBe(1);
 * ```
 */

// ── Types ──────────────────────────────────────────────────────────────────────

/**
 * Named gameplay action that can be triggered by a key, mouse button,
 * or programmatic simulation.
 */
export type InputAction =
  // Combat
  | "meleeAttack"
  | "powerAttack"
  | "block"
  | "blockRelease"
  | "castSpell"
  | "cycleSpell"
  | "drawBow"
  | "releaseBow"
  | "racialPower"
  // Movement / stance
  | "toggleCrouch"
  | "jump"
  // UI panels
  | "toggleInventory"
  | "toggleQuestLog"
  | "toggleSkillTree"
  | "toggleAttributePanel"
  | "toggleAlchemy"
  | "toggleEnchanting"
  | "toggleSpellMaking"
  | "toggleFastTravel"
  | "togglePetPanel"
  | "toggleWaitDialog"
  | "mountDismount"
  | "stableOrSaddlebag"
  | "showFameStatus"
  // Quick-slots
  | "quickSlot7"
  | "quickSlot8"
  | "quickSlot9"
  | "quickSlot0"
  // Combat archetypes
  | "archetype1"
  | "archetype2"
  | "archetype3"
  | "archetype4"
  | "archetype5"
  | "archetype6"
  // System
  | "pause"
  | "save"
  | "load"
  | "toggleMute"
  | "toggleDebugOverlay"
  | "screenshot"
  | "helpOverlay"
  | "advanceTutorial"
  // Editor (high-level — editor-specific keys are left to the map editor)
  | "toggleMapEditor";

/**
 * Binding entry: maps a keyboard key (or mouse button) to a named action.
 * `phase` determines when the action fires:
 *   - `"down"` — on key-down / pointer-down  (default).
 *   - `"up"`   — on key-up / pointer-up.
 */
export interface InputBinding {
  /** The `KeyboardEvent.key` value (e.g. `"i"`, `"Escape"`, `"F5"`). */
  key: string;
  /** Action to dispatch. */
  action: InputAction;
  /** Fire on key-down or key-up.  Defaults to `"down"`. */
  phase?: "down" | "up";
  /** When true, the key match is case-insensitive (e.g. `"i"` matches `"I"`). */
  caseInsensitive?: boolean;
  /** When true, Shift must be held. */
  shift?: boolean;
  /** When true, Ctrl/Cmd must be held. */
  ctrlOrMeta?: boolean;
}

export type ActionCallback = (action: InputAction) => void;

// ── Default bindings ──────────────────────────────────────────────────────────

export const DEFAULT_BINDINGS: readonly InputBinding[] = [
  // Combat
  { key: "e", action: "powerAttack", caseInsensitive: true },
  { key: "q", action: "castSpell", caseInsensitive: true },
  { key: "q", action: "castSpell", phase: "up", caseInsensitive: true },
  { key: "z", action: "cycleSpell", caseInsensitive: true },
  { key: "r", action: "drawBow", caseInsensitive: true },
  { key: "r", action: "releaseBow", phase: "up", caseInsensitive: true },
  { key: "v", action: "racialPower", caseInsensitive: true },

  // Movement / stance
  { key: "c", action: "toggleCrouch", caseInsensitive: true },

  // UI panels
  { key: "i", action: "toggleInventory", caseInsensitive: true },
  { key: "j", action: "toggleQuestLog", caseInsensitive: true },
  { key: "k", action: "toggleSkillTree", caseInsensitive: true },
  { key: "u", action: "toggleAttributePanel", caseInsensitive: true },
  { key: "l", action: "toggleAlchemy", caseInsensitive: true },
  { key: "b", action: "toggleEnchanting", caseInsensitive: true },
  { key: "x", action: "toggleSpellMaking", caseInsensitive: true },
  { key: "y", action: "toggleFastTravel", caseInsensitive: true },
  { key: "p", action: "togglePetPanel", caseInsensitive: true },
  { key: "t", action: "toggleWaitDialog", caseInsensitive: true },
  { key: "o", action: "mountDismount", caseInsensitive: true },
  { key: "O", action: "stableOrSaddlebag", shift: true },
  { key: "h", action: "showFameStatus", caseInsensitive: true },

  // Quick-slots
  { key: "7", action: "quickSlot7" },
  { key: "8", action: "quickSlot8" },
  { key: "9", action: "quickSlot9" },
  { key: "0", action: "quickSlot0" },

  // Combat archetypes
  { key: "1", action: "archetype1" },
  { key: "2", action: "archetype2" },
  { key: "3", action: "archetype3" },
  { key: "4", action: "archetype4" },
  { key: "5", action: "archetype5" },
  { key: "6", action: "archetype6" },

  // System
  { key: "Escape", action: "pause" },
  { key: "F5", action: "save" },
  { key: "F9", action: "load" },
  { key: "m", action: "toggleMute", caseInsensitive: true },
  { key: "F3", action: "toggleDebugOverlay" },
  { key: "PrintScreen", action: "screenshot" },
  { key: "F1", action: "helpOverlay" },
  { key: " ", action: "advanceTutorial" },

  // Editor
  { key: "F2", action: "toggleMapEditor" },
];

// ── System ─────────────────────────────────────────────────────────────────────

export class BabylonInputAdapter {
  /** Current binding table.  Mutable — call `rebind()` to change at runtime. */
  private _bindings: InputBinding[];

  /** Registered action listeners. */
  private _listeners = new Map<InputAction, Set<ActionCallback>>();

  /** Tracks which actions are currently "active" (key held). */
  private _activeActions = new Set<InputAction>();

  constructor(bindings?: readonly InputBinding[]) {
    this._bindings = [...(bindings ?? DEFAULT_BINDINGS)];
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Subscribe to a named action.  Returns a dispose function. */
  onAction(action: InputAction, callback: ActionCallback): () => void {
    let set = this._listeners.get(action);
    if (!set) {
      set = new Set();
      this._listeners.set(action, set);
    }
    set.add(callback);
    return () => { set!.delete(callback); };
  }

  /** Remove all listeners for a specific action (or all actions). */
  off(action?: InputAction): void {
    if (action) {
      this._listeners.delete(action);
    } else {
      this._listeners.clear();
    }
  }

  /** Returns true while the action's trigger key is held down. */
  isActive(action: InputAction): boolean {
    return this._activeActions.has(action);
  }

  /** All currently active (held-down) actions. */
  get activeActions(): ReadonlySet<InputAction> {
    return this._activeActions;
  }

  /**
   * Fire an action programmatically (for headless testing or scripted input).
   * Calls all registered listeners immediately.
   */
  simulateAction(action: InputAction): void {
    this._dispatch(action);
  }

  /**
   * Simulate a full press-release cycle for an action.
   * Adds the action to active set, dispatches, then removes it.
   */
  simulatePress(action: InputAction): void {
    this._activeActions.add(action);
    this._dispatch(action);
    this._activeActions.delete(action);
  }

  /** Replace the binding table at runtime (e.g. user rebind settings). */
  rebind(bindings: readonly InputBinding[]): void {
    this._bindings = [...bindings];
  }

  /** Return a read-only copy of the current bindings. */
  get bindings(): readonly InputBinding[] {
    return this._bindings;
  }

  /** Find all bindings for a given action. */
  getBindingsForAction(action: InputAction): readonly InputBinding[] {
    return this._bindings.filter((b) => b.action === action);
  }

  /**
   * Process a raw key event.  This is the low-level entry point that
   * Babylon scene keyboard observables call, or that test code can invoke
   * directly without needing a real DOM.
   */
  handleKeyEvent(
    key: string,
    phase: "down" | "up",
    modifiers: { shift?: boolean; ctrlOrMeta?: boolean } = {},
  ): InputAction | null {
    for (const binding of this._bindings) {
      const bindingPhase = binding.phase ?? "down";
      if (bindingPhase !== phase) continue;

      // Key match
      const bindingKey = binding.key;
      const eventKey = key;
      const match = binding.caseInsensitive
        ? bindingKey.toLowerCase() === eventKey.toLowerCase()
        : bindingKey === eventKey;
      if (!match) continue;

      // Modifier guards
      if (binding.shift && !modifiers.shift) continue;
      if (binding.ctrlOrMeta && !modifiers.ctrlOrMeta) continue;

      // Track active state
      if (phase === "down") {
        this._activeActions.add(binding.action);
      } else {
        this._activeActions.delete(binding.action);
      }

      this._dispatch(binding.action);
      return binding.action;
    }
    return null;
  }

  /**
   * Process a raw mouse-button event (pointer down/up).
   * Fires `meleeAttack` for left-click, `block`/`blockRelease` for right-click.
   */
  handlePointerEvent(
    button: number,
    phase: "down" | "up",
  ): InputAction | null {
    if (button === 0 && phase === "down") {
      this._activeActions.add("meleeAttack");
      this._dispatch("meleeAttack");
      return "meleeAttack";
    }
    if (button === 0 && phase === "up") {
      this._activeActions.delete("meleeAttack");
      return null;
    }
    if (button === 2 && phase === "down") {
      this._activeActions.add("block");
      this._dispatch("block");
      return "block";
    }
    if (button === 2 && phase === "up") {
      this._activeActions.delete("block");
      this._dispatch("blockRelease");
      return "blockRelease";
    }
    return null;
  }

  /** Reset all active actions (call when focus is lost or game pauses). */
  reset(): void {
    this._activeActions.clear();
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _dispatch(action: InputAction): void {
    const set = this._listeners.get(action);
    if (!set) return;
    for (const cb of set) {
      cb(action);
    }
  }
}
