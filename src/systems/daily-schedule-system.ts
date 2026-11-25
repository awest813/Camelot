import type { NPC, ScheduleBehaviorType } from "../entities/npc";
import { scheduledBehaviorAt, type ScheduleSystem } from "./schedule-system";
import type { TimeSystem } from "./time-system";
import type { GameEventBus } from "./event-bus";

/**
 * DailyScheduleSystem — Connects TimeSystem to ScheduleSystem for automatic
 * time-of-day NPC behaviour switching, and marks who is asleep.
 *
 * Responsibilities:
 *   - Hooks into `TimeSystem.onHourChange` so `ScheduleSystem.currentHour` is
 *     kept in sync without a per-frame manual assignment in the game loop.
 *   - When an NPC enters a `"sleep"` schedule block it is marked asleep (the
 *     `Asleep` actor tag, `npc.isAsleep`); the interaction system won't let
 *     the player talk to it.  It wakes when the block ends.  (This used to
 *     blank the NPC's mesh metadata, hiding it from interaction entirely.)
 *   - Reports `npc:slept` / `npc:woke` on its event bus (`events`).
 *   - Provides `getSaveState` / `restoreFromSave` (SAVE_VERSION 18).
 *
 * Wire-up example (game.ts):
 * ```ts
 * this.dailyScheduleSystem = new DailyScheduleSystem(
 *   this.scheduleSystem,
 *   this.timeSystem,
 * );
 *
 * this.dailyScheduleSystem.events = this.eventBus;
 * this.eventBus.on("npc:woke", ({ npc }) => …);
 * ```
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export interface DailyScheduleSaveState {
  /** Names of NPCs that were sleeping at the time of the save. */
  sleepingNpcNames: string[];
}

// ── System ────────────────────────────────────────────────────────────────────

export class DailyScheduleSystem {
  /** Where this system reports what happened (the game's event bus). */
  public events: GameEventBus | null = null;

  private _scheduleSystem: ScheduleSystem;
  private _timeSystem: TimeSystem;

  /** The NPCs this system put to sleep. */
  private _sleepingNpcs = new Set<NPC>();

  // ── Callbacks ──────────────────────────────────────────────────────────────



  // ── Constructor ────────────────────────────────────────────────────────────

  constructor(scheduleSystem: ScheduleSystem, timeSystem: TimeSystem) {
    this._scheduleSystem = scheduleSystem;
    this._timeSystem = timeSystem;

    // Register the hour-change hook so we no longer need a per-frame sync.
    this._timeSystem.onHourChange = (hour) => this._onHourChange(hour);

    // Apply initial state immediately so NPCs that spawn into a sleep window
    // are non-interactive from the first frame.
    this._syncHour(this._timeSystem.hour);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Returns `true` if the named NPC is currently in a sleep state managed by
   * this system.
   */
  public isSleeping(npcKey: string): boolean {
    for (const npc of this._sleepingNpcs) {
      if (npc.key === npcKey) return true;
    }
    return false;
  }

  /**
   * Returns the active scheduled behavior for the given NPC at the current
   * in-game hour, or `null` when no block matches (or the NPC has no blocks).
   */
  public getActiveBehavior(npc: NPC): ScheduleBehaviorType | null {
    return this._getScheduledBehavior(npc, this._timeSystem.hour);
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  /**
   * Returns the current sleep-state snapshot.  `sleepingNpcNames` is recorded
   * for debuggability and future migration support, but `restoreFromSave` does
   * not depend on it — sleep state is fully re-derived from the restored game
   * time plus each NPC's schedule blocks.
   */
  public getSaveState(): DailyScheduleSaveState {
    const sleepingNpcNames: string[] = [];
    for (const npc of this._sleepingNpcs) {
      sleepingNpcNames.push(npc.key);
    }
    return { sleepingNpcNames };
  }

  /**
   * Re-derives sleep/wake state from the current in-game hour after all other
   * systems (TimeSystem, ScheduleSystem, NPC setup) have been restored.
   *
   * The `state` parameter is accepted for interface consistency and future
   * migration support, but sleep state is intentionally re-derived from the
   * restored game time rather than from the persisted flag list — this ensures
   * correctness even when NPCs are recreated fresh on load.
   */
  public restoreFromSave(_state: DailyScheduleSaveState): void {
    this._syncHour(this._timeSystem.hour);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private _onHourChange(hour: number): void {
    this._scheduleSystem.currentHour = hour;
    this._applyScheduledInteractivity();
  }

  private _syncHour(hour: number): void {
    this._scheduleSystem.currentHour = hour;
    this._applyScheduledInteractivity();
  }

  /**
   * Iterate all registered NPCs and toggle interactivity based on whether
   * their current schedule block is "sleep".
   */
  private _applyScheduledInteractivity(): void {
    // Forget sleepers that have left the world.
    const tracked = new Set(this._scheduleSystem.npcs);
    for (const npc of this._sleepingNpcs) if (!tracked.has(npc)) this._sleepingNpcs.delete(npc);
    for (const npc of this._scheduleSystem.npcs) {
      if (npc.isDead) continue;

      const behavior = this._getScheduledBehavior(npc, this._scheduleSystem.currentHour);
      const isSleeping = behavior === "sleep";
      const wasSleeping = this._sleepingNpcs.has(npc);

      if (isSleeping && !wasSleeping) {
        this._sleepingNpcs.add(npc);
        npc.isAsleep = true;
        this.events?.emit("npc:slept", { npc });
      } else if (!isSleeping && wasSleeping) {
        this._sleepingNpcs.delete(npc);
        npc.isAsleep = false;
        this.events?.emit("npc:woke", { npc });
      }
    }
  }

  private _getScheduledBehavior(npc: NPC, hour: number): ScheduleBehaviorType | null {
    return scheduledBehaviorAt(npc.scheduleBlocks, hour);
  }

}
