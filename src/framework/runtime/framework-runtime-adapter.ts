/**
 * FrameworkRuntimeAdapter — host-game integration bridge for FrameworkRuntime.
 *
 * The `FrameworkRuntime` is a self-contained, headless RPG framework.  In a
 * full game, host systems (skill progression, time, UI notifications) live
 * outside the framework.  This adapter provides a lightweight integration layer
 * so the host game can:
 *
 *  1. **Supply runtime values** via pluggable adapters:
 *     - `SkillAdapter` — wires a skill-level lookup (e.g. SkillProgressionSystem)
 *       into the framework's dialogue `skill_min` condition checks.
 *     - `TimeAdapter`  — exposes the current in-game time for time-gated effects.
 *
 *  2. **React to framework events** via `NotificationListener` callbacks:
 *     - `onQuestActivated`    — fired when a quest transitions to "active".
 *     - `onQuestCompleted`    — fired (with XP reward) when a quest fully completes.
 *     - `onItemConsumed`      — fired when dialogue consumes an item.
 *     - `onItemGiven`         — fired when dialogue gives an item.
 *     - `onFactionRepChanged` — fired when dialogue adjusts faction reputation.
 *     - `onFlagChanged`       — fired when dialogue sets a flag.
 *
 *  3. **Create instrumented dialogue sessions** — `createInstrumentedDialogueSession`
 *     returns a `DialogueSession` whose side-effects fire all registered
 *     `NotificationListener` callbacks, giving the host game a reactive event
 *     stream without tight coupling to the dialogue engine's internals.
 *
 * Usage:
 * ```ts
 * const adapter = new FrameworkRuntimeAdapter(frameworkRuntime, {
 *   skill: { getSkillLevel: (id) => skillSystem.getSkillRank(id) },
 *   time:  { getGameTimeMinutes: () => timeSystem.gameTime },
 * });
 *
 * adapter.addListener({
 *   onQuestCompleted: (id, xp) => ui.showNotification(`Quest done! +${xp} XP`),
 *   onItemGiven: (id, qty) => ui.showNotification(`Received ${qty}× ${id}`),
 * });
 *
 * // Quest events also fire listeners:
 * adapter.applyQuestEvent({ type: "kill", targetId: "wolf", amount: 1 });
 *
 * // Instrumented session fires listeners on every dialogue effect:
 * const session = adapter.createInstrumentedDialogueSession("npc_innkeeper_01");
 * ```
 */

import { FrameworkRuntime } from "./framework-runtime";
import { DialogueSession } from "../dialogue/dialogue-engine";
import { DialogueContext } from "../dialogue/dialogue-types";
import { QuestEvent, QuestEventResult } from "../quests/quest-types";
import { FrameworkSaveFile, FrameworkStateSnapshot } from "../save/save-types";

// ── Adapter interfaces ────────────────────────────────────────────────────────

/**
 * Provides skill level lookups from the host game.
 * Wire to `SkillProgressionSystem.getSkillRank(id)` or equivalent.
 */
export interface SkillAdapter {
  /** Returns the player's current rank (0–100) for the given skill id. */
  getSkillLevel: (skillId: string) => number;
}

/**
 * Provides the current in-game time from the host game's TimeSystem.
 */
export interface TimeAdapter {
  /** Current game time in minutes (matches `TimeSystem.gameTime`). */
  getGameTimeMinutes: () => number;
}

export interface GameBridgeAdapters {
  skill?: SkillAdapter;
  time?: TimeAdapter;
}

// ── Notification listener ─────────────────────────────────────────────────────

/**
 * Subscribe to events emitted by the framework during dialogue / quest execution.
 * All fields are optional — implement only what your game needs.
 */
export interface NotificationListener {
  /** A quest was activated (status changed to "active"). */
  onQuestActivated?: (questId: string) => void;
  /** A quest was completed; `xpReward` is the quest's configured reward (may be 0). */
  onQuestCompleted?: (questId: string, xpReward: number) => void;
  /** Dialogue effect consumed an item from the player's inventory. */
  onItemConsumed?: (itemId: string, quantity: number) => void;
  /** Dialogue effect gave an item to the player. */
  onItemGiven?: (itemId: string, quantity: number) => void;
  /**
   * Faction reputation was adjusted by a dialogue or quest effect.
   * `delta` is the amount added (may be negative).
   * `newRep` is the reputation value after the adjustment.
   */
  onFactionRepChanged?: (factionId: string, newRep: number, delta: number) => void;
  /** A boolean flag was set via a dialogue effect or directly through the adapter. */
  onFlagChanged?: (flag: string, value: boolean) => void;
}

// ── Adapter ───────────────────────────────────────────────────────────────────

export class FrameworkRuntimeAdapter {
  private readonly _runtime: FrameworkRuntime;
  private _adapters: GameBridgeAdapters;
  private _listeners: NotificationListener[] = [];

  constructor(runtime: FrameworkRuntime, adapters: GameBridgeAdapters = {}) {
    this._runtime = runtime;
    this._adapters = { ...adapters };
  }

  // ── Adapter management ────────────────────────────────────────────────────

  /** Replace or add runtime adapter implementations at any time. */
  public setAdapters(adapters: Partial<GameBridgeAdapters>): void {
    this._adapters = { ...this._adapters, ...adapters };
  }

  /** Returns the current skill adapter, if any. */
  public get skillAdapter(): SkillAdapter | undefined {
    return this._adapters.skill;
  }

  /** Returns the current time adapter, if any. */
  public get timeAdapter(): TimeAdapter | undefined {
    return this._adapters.time;
  }

  // ── Listener management ───────────────────────────────────────────────────

  /**
   * Register a `NotificationListener`.
   * @returns An unsubscribe function — call it to remove the listener.
   */
  public addListener(listener: NotificationListener): () => void {
    this._listeners.push(listener);
    return () => {
      const idx = this._listeners.indexOf(listener);
      if (idx !== -1) this._listeners.splice(idx, 1);
    };
  }

  /** Number of currently registered listeners. */
  public get listenerCount(): number {
    return this._listeners.length;
  }

  // ── Flag management ───────────────────────────────────────────────────────

  /**
   * Read a named boolean flag.
   * Delegates to `FrameworkRuntime.getFlag()`.
   */
  public getFlag(flag: string): boolean {
    return this._runtime.getFlag(flag);
  }

  /**
   * Set a named boolean flag and fire `onFlagChanged` on all listeners.
   */
  public setFlag(flag: string, value: boolean): void {
    this._runtime.setFlag(flag, value);
    for (const l of this._listeners) l.onFlagChanged?.(flag, value);
  }

  // ── Dialogue ──────────────────────────────────────────────────────────────

  /**
   * Create a standard `DialogueSession` (no listener interception).
   * Passthrough to `FrameworkRuntime.createDialogueSession()`.
   */
  public createDialogueSession(dialogueId: string): DialogueSession {
    return this._runtime.createDialogueSession(dialogueId);
  }

  /**
   * Create an instrumented `DialogueSession` whose side-effects (item give/consume,
   * flag changes, faction deltas, quest activation, quest completion) fire all
   * registered `NotificationListener` callbacks.
   *
   * Use this instead of `createDialogueSession` to keep the host game reactive
   * to framework events without polling engine state.
   */
  public createInstrumentedDialogueSession(dialogueId: string): DialogueSession {
    const runtime = this._runtime;
    const listeners = this._listeners;
    const skillLevel = this._adapters.skill?.getSkillLevel;

    const context: DialogueContext = {
      getFlag: (flag) => runtime.getFlag(flag),
      setFlag: (flag, value) => {
        runtime.setFlag(flag, value);
        for (const l of listeners) l.onFlagChanged?.(flag, value);
      },
      getFactionReputation: (factionId) => runtime.factionEngine.getReputation(factionId),
      adjustFactionReputation: (factionId, amount) => {
        runtime.factionEngine.adjustReputation(factionId, amount);
        const newRep = runtime.factionEngine.getReputation(factionId);
        for (const l of listeners) l.onFactionRepChanged?.(factionId, newRep, amount);
      },
      getQuestStatus: (questId) => runtime.questEngine.getQuestStatus(questId),
      getInventoryCount: (itemId) => runtime.inventoryEngine.getItemCount(itemId),
      getSkillLevel: skillLevel,
      emitEvent: (eventId, payload) => {
        // Re-use the runtime's event translation by applying the event directly.
        const results = runtime.applyQuestEvent(
          _parseDialogueEventId(eventId, payload),
        );
        if (results) {
          for (const result of results) {
            if (result.questCompleted) {
              for (const l of listeners) l.onQuestCompleted?.(result.questId, result.xpReward);
            }
          }
        }
      },
      activateQuest: (questId) => {
        runtime.questEngine.activateQuest(questId);
        for (const l of listeners) l.onQuestActivated?.(questId);
      },
      consumeItem: (itemId, quantity) => {
        const ok = runtime.inventoryEngine.removeItem(itemId, quantity).success;
        if (ok) {
          for (const l of listeners) l.onItemConsumed?.(itemId, quantity);
        }
        return ok;
      },
      giveItem: (itemId, quantity) => {
        runtime.inventoryEngine.addItem(itemId, quantity);
        for (const l of listeners) l.onItemGiven?.(itemId, quantity);
      },
    };

    return runtime.dialogueEngine.createSession(dialogueId, context);
  }

  // ── Quest events ──────────────────────────────────────────────────────────

  /**
   * Apply a quest event and fire `onQuestCompleted` listeners for any quests
   * that complete as a result.
   *
   * Drop-in replacement for `FrameworkRuntime.applyQuestEvent()`.
   */
  public applyQuestEvent(event: QuestEvent): QuestEventResult[] {
    const results = this._runtime.applyQuestEvent(event);
    for (const result of results) {
      if (result.questCompleted) {
        for (const l of this._listeners) {
          l.onQuestCompleted?.(result.questId, result.xpReward);
        }
      }
    }
    return results;
  }

  // ── Save / restore ────────────────────────────────────────────────────────

  public getSaveSnapshot(): FrameworkStateSnapshot {
    return this._runtime.getSaveSnapshot();
  }

  public createSave(profileId: string = "default"): FrameworkSaveFile {
    return this._runtime.createSave(profileId);
  }

  public restoreFromSave(saveFile: FrameworkSaveFile): void {
    this._runtime.restoreFromSave(saveFile);
  }

  // ── Pass-through accessors ────────────────────────────────────────────────

  /** Direct access to the framework's quest engine. */
  public get questEngine() {
    return this._runtime.questEngine;
  }

  /** Direct access to the framework's inventory engine. */
  public get inventoryEngine() {
    return this._runtime.inventoryEngine;
  }

  /** Direct access to the framework's faction engine. */
  public get factionEngine() {
    return this._runtime.factionEngine;
  }

  /** Direct access to the framework's dialogue engine. */
  public get dialogueEngine() {
    return this._runtime.dialogueEngine;
  }

  /** Direct access to the framework's content registry. */
  public get contentRegistry() {
    return this._runtime.contentRegistry;
  }

  /** Direct access to the underlying FrameworkRuntime. */
  public get runtime(): FrameworkRuntime {
    return this._runtime;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Parse a dialogue `emit_event` id string (format: `quest:<type>:<targetId>`)
 * into a `QuestEvent`.  Returns a no-op event for unrecognised ids.
 */
function _parseDialogueEventId(
  eventId: string,
  payload?: Record<string, unknown>,
): QuestEvent {
  const parts = eventId.split(":");
  const type = parts[1] as QuestEvent["type"];
  const targetId = parts[2] ?? "";
  const validTypes = new Set<string>(["kill", "pickup", "talk", "custom"]);
  if (!validTypes.has(type) || !targetId) {
    return { type: "custom", targetId: eventId, amount: 0 };
  }
  return {
    type,
    targetId,
    amount: typeof payload?.amount === "number" ? payload.amount : 1,
  };
}
