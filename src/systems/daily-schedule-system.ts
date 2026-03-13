import type { NPC, ScheduleBehaviorType } from "../entities/npc";
import type { ScheduleSystem } from "./schedule-system";
import type { TimeSystem } from "./time-system";

/**
 * DailyScheduleSystem — Connects TimeSystem to ScheduleSystem for automatic
 * time-of-day NPC behaviour switching and non-interactive sleep enforcement.
 *
 * Responsibilities:
 *   - Hooks into `TimeSystem.onHourChange` so `ScheduleSystem.currentHour` is
 *     kept in sync without a per-frame manual assignment in the game loop.
 *   - When an NPC enters a `"sleep"` schedule block, its `mesh.metadata` is
 *     cleared to prevent interaction or dialogue.
 *   - When the NPC leaves the sleep block, `mesh.metadata` is restored to the
 *     saved pre-sleep value.
 *   - Fires `onNPCSleep` / `onNPCWake` callbacks for UI notifications.
 *   - Provides `getSaveState` / `restoreFromSave` (SAVE_VERSION 18).
 *
 * Wire-up example (game.ts):
 * ```ts
 * this.dailyScheduleSystem = new DailyScheduleSystem(
 *   this.scheduleSystem,
 *   this.timeSystem,
 * );
 *
 * this.dailyScheduleSystem.onNPCSleep = (npc) =>
 *   this.ui.showNotification(`${npc.mesh.name} has gone to sleep.`, 2000);
 * this.dailyScheduleSystem.onNPCWake = (npc) =>
 *   this.ui.showNotification(`${npc.mesh.name} has woken up.`, 2000);
 * ```
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export interface DailyScheduleSaveState {
  /** Names of NPCs that were sleeping at the time of the save. */
  sleepingNpcNames: string[];
}

// ── System ────────────────────────────────────────────────────────────────────

export class DailyScheduleSystem {
  private _scheduleSystem: ScheduleSystem;
  private _timeSystem: TimeSystem;

  /**
   * Maps each sleeping NPC to the metadata value it held before sleep so that
   * we can restore it precisely when the NPC wakes up.
   */
  private _sleepingNpcs: Map<NPC, object | null> = new Map();

  // ── Callbacks ──────────────────────────────────────────────────────────────

  /** Fired when an NPC transitions into a sleep schedule block. */
  public onNPCSleep: ((npc: NPC) => void) | null = null;

  /** Fired when an NPC transitions out of a sleep schedule block. */
  public onNPCWake: ((npc: NPC) => void) | null = null;

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
  public isSleeping(npcMeshName: string): boolean {
    for (const [npc] of this._sleepingNpcs) {
      if (npc.mesh.name === npcMeshName) return true;
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
    for (const [npc] of this._sleepingNpcs) {
      sleepingNpcNames.push(npc.mesh.name);
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
    for (const npc of this._scheduleSystem.npcs) {
      if (npc.isDead) continue;

      const behavior = this._getScheduledBehavior(npc, this._scheduleSystem.currentHour);
      const isSleeping = behavior === "sleep";
      const wasSleeping = this._sleepingNpcs.has(npc);

      if (isSleeping && !wasSleeping) {
        // NPC is entering sleep — save current metadata and clear it.
        this._sleepingNpcs.set(npc, npc.mesh.metadata as object | null);
        npc.mesh.metadata = null;
        this.onNPCSleep?.(npc);
      } else if (!isSleeping && wasSleeping) {
        // NPC is waking up — restore saved metadata.
        const savedMetadata = this._sleepingNpcs.get(npc) ?? null;
        this._sleepingNpcs.delete(npc);
        npc.mesh.metadata = savedMetadata;
        this.onNPCWake?.(npc);
      }
    }
  }

  /**
   * Returns the scheduled behavior for `npc` at the given `hour`, or `null`
   * if no block matches or the NPC has no schedule defined.
   *
   * Mirrors the private block-matching logic in ScheduleSystem so that
   * DailyScheduleSystem can independently derive sleep state.
   */
  private _getScheduledBehavior(npc: NPC, hour: number): ScheduleBehaviorType | null {
    if (hour < 0 || npc.scheduleBlocks.length === 0) return null;

    for (const block of npc.scheduleBlocks) {
      // Blocks that cross midnight (e.g. startHour=22, endHour=6) wrap around.
      const wraps = block.startHour > block.endHour;
      const inBlock = wraps
        ? hour >= block.startHour || hour < block.endHour
        : hour >= block.startHour && hour < block.endHour;
      if (inBlock) return block.behavior;
    }

    return null;
  }
}
