import type { TimeSystem } from "./time-system";
import type { Player } from "../entities/player";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Minimum hours the player can choose to wait. */
export const WAIT_MIN_HOURS = 1;
/** Maximum hours the player can choose to wait. */
export const WAIT_MAX_HOURS = 24;
/**
 * Fraction of each stat restored per hour waited.
 * At full 24 h the player is completely restored, matching Oblivion bed-rest
 * behaviour where sleeping fully recovers all resources.
 */
const RESTORE_RATE_PER_HOUR = 1 / 24;

// ── Save / load ───────────────────────────────────────────────────────────────

export interface WaitSaveState {
  /** Cumulative in-game hours the player has waited across the whole session. */
  totalHoursWaited: number;
}

// ── System ────────────────────────────────────────────────────────────────────

/**
 * WaitSystem — Oblivion-style time-skip rest mechanic.
 *
 * Press T (wired in game.ts) to open the Wait dialog.  The player chooses
 * 1–24 hours; `wait()` then advances the TimeSystem clock and restores
 * Health / Magicka / Stamina proportionally to hours rested.
 *
 * Wire-up example (game.ts):
 * ```ts
 * this.waitSystem = new WaitSystem();
 * // In keyboard handler for "t":
 * if (!this.isPaused && !this.dialogueSystem.isInDialogue) {
 *   this.ui.showWaitDialog((hours) => {
 *     const result = this.waitSystem.wait(hours, this.timeSystem, this.player);
 *     if (result.ok) this.ui.showNotification(result.message, 2500);
 *   });
 * }
 * ```
 */
export class WaitSystem {
  private _totalHoursWaited: number = 0;

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Wait for `hours` in-game hours.
   *
   * - Validates the requested hour count is within [WAIT_MIN_HOURS, WAIT_MAX_HOURS].
   * - Advances the provided TimeSystem.
   * - Restores player HP / Magicka / Stamina proportionally.
   * - Accumulates `totalHoursWaited` for save-state persistence.
   *
   * @returns `{ ok: true, message }` on success, `{ ok: false, message }` if
   *          the hour count is invalid.
   */
  public wait(
    hours: number,
    timeSystem: TimeSystem,
    player: Player,
  ): { ok: boolean; message: string } {
    const h = Math.round(hours);
    if (h < WAIT_MIN_HOURS || h > WAIT_MAX_HOURS) {
      return { ok: false, message: `Wait hours must be between ${WAIT_MIN_HOURS} and ${WAIT_MAX_HOURS}.` };
    }

    timeSystem.advanceHours(h);
    this._totalHoursWaited += h;

    const rate = Math.min(1, RESTORE_RATE_PER_HOUR * h);
    player.health  = Math.min(player.maxHealth,  player.health  + player.maxHealth  * rate);
    player.magicka = Math.min(player.maxMagicka, player.magicka + player.maxMagicka * rate);
    player.stamina = Math.min(player.maxStamina, player.stamina + player.maxStamina * rate);

    const newTime = timeSystem.timeString;
    const plural  = h === 1 ? "hour" : "hours";
    return { ok: true, message: `Waited ${h} ${plural}. Time is now ${newTime}.` };
  }

  // ── Getters ───────────────────────────────────────────────────────────────

  /** Cumulative in-game hours the player has waited (lifetime total). */
  public get totalHoursWaited(): number {
    return this._totalHoursWaited;
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  public getSaveState(): WaitSaveState {
    return { totalHoursWaited: this._totalHoursWaited };
  }

  public restoreFromSave(data: WaitSaveState): void {
    if (typeof data?.totalHoursWaited === "number") {
      this._totalHoursWaited = data.totalHoursWaited;
    }
  }
}
