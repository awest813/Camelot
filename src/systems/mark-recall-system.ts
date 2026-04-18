/**
 * MarkRecallSystem — Morrowind-style Mark & Recall teleportation for Camelot.
 *
 * Two iconic Morrowind Mysticism spells:
 *   - **Mark**   — Records the player's current world position (and optional
 *                  interior cell id) as a single persistent waypoint.
 *                  Casting Mark again moves the waypoint to the new location.
 *   - **Recall** — Teleports the player back to the marked position.
 *                  Returns the stored position/cell to the caller; the game
 *                  layer is responsible for actually moving the player.
 *
 * Only one mark can be active at a time (mirroring the original game).
 *
 * Headless: no BabylonJS dependencies — integrates via callbacks.
 * SAVE_VERSION: 24
 */

// ── Types ──────────────────────────────────────────────────────────────────────

/** 3-D world-space coordinates for a marked position. */
export interface MarkPosition {
  x: number;
  y: number;
  z: number;
}

/** Data returned by a successful `recall()`. */
export interface RecallResult {
  position: Readonly<MarkPosition>;
  /** Interior cell id, or `null` if marked in the open world. */
  cellId: string | null;
}

// ── Save state ────────────────────────────────────────────────────────────────

export interface MarkRecallSaveState {
  hasMarked: boolean;
  position: MarkPosition | null;
  cellId: string | null;
}

// ── System ────────────────────────────────────────────────────────────────────

/**
 * Manages a single persistent Mark waypoint and exposes a Recall query.
 *
 * Usage:
 * ```ts
 * const markRecall = new MarkRecallSystem();
 *
 * // Wire callbacks
 * markRecall.onMark   = (pos, cell) => ui.showNotification("Position Marked.");
 * markRecall.onRecall = (pos, cell) => teleportPlayer(pos, cell);
 *
 * // Player casts Mark spell
 * markRecall.mark({ x: 100, y: 0, z: -200 }, "cell_interior_ald_ruhn");
 *
 * // Player casts Recall spell
 * const result = markRecall.recall();
 * if (result) {
 *   teleportPlayerTo(result.position, result.cellId);
 * }
 * ```
 */
export class MarkRecallSystem {
  private _hasMarked: boolean = false;
  private _position: MarkPosition | null = null;
  private _cellId: string | null = null;

  // ── Callbacks ────────────────────────────────────────────────────────────

  /**
   * Fired when the player successfully casts Mark.
   * Receives the stored position and optional cell id.
   */
  public onMark: ((position: Readonly<MarkPosition>, cellId: string | null) => void) | null = null;

  /**
   * Fired when the player successfully casts Recall.
   * Receives the recalled position and optional cell id.
   * The game layer should use these values to teleport the player.
   */
  public onRecall: ((position: Readonly<MarkPosition>, cellId: string | null) => void) | null = null;

  /**
   * Fired when the mark is explicitly cleared via {@link clearMark}.
   */
  public onMarkCleared: (() => void) | null = null;

  // ── Queries ───────────────────────────────────────────────────────────────

  /** Whether a mark is currently stored. */
  public get hasMarked(): boolean {
    return this._hasMarked;
  }

  /**
   * The world-space position of the current mark, or `null` if no mark exists.
   * Returns a defensive copy so callers cannot mutate internal state.
   */
  public get markedPosition(): Readonly<MarkPosition> | null {
    if (!this._position) return null;
    return { ...this._position };
  }

  /**
   * The interior cell id associated with the current mark, or `null` when
   * marked in the open world or when no mark exists.
   */
  public get markedCellId(): string | null {
    return this._cellId;
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  /**
   * Cast Mark at `position`.
   *
   * Records the position (and optional `cellId` for interior cells) as the
   * single active waypoint.  Any previous mark is silently overwritten.
   * Fires `onMark` after the position is stored.
   *
   * @param position  World-space coordinates to mark.
   * @param cellId    Optional interior-cell identifier.  Pass `null` or omit
   *                  when marking a position in the open world.
   */
  public mark(position: MarkPosition, cellId: string | null = null): void {
    this._position = { ...position };
    this._cellId = cellId ?? null;
    this._hasMarked = true;
    this.onMark?.(this.markedPosition!, this._cellId);
  }

  /**
   * Cast Recall.
   *
   * Returns the stored {@link RecallResult} and fires `onRecall`.
   * Returns `null` (no-op) when no mark has been set.
   *
   * The system does **not** clear the mark after a Recall — the player can
   * recall to the same spot multiple times, just as in Morrowind.
   */
  public recall(): RecallResult | null {
    if (!this._hasMarked || !this._position) return null;

    const result: RecallResult = {
      position: { ...this._position },
      cellId: this._cellId,
    };
    this.onRecall?.(result.position, result.cellId);
    return result;
  }

  /**
   * Explicitly remove the current mark (e.g. for scripted events or cheats).
   * Fires `onMarkCleared`.  No-op if no mark exists.
   */
  public clearMark(): void {
    if (!this._hasMarked) return;
    this._hasMarked = false;
    this._position = null;
    this._cellId = null;
    this.onMarkCleared?.();
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  /** Serialize current state for save-file storage. */
  public getSaveState(): MarkRecallSaveState {
    return {
      hasMarked: this._hasMarked,
      position: this._position ? { ...this._position } : null,
      cellId: this._cellId,
    };
  }

  /**
   * Restore state from a previously serialized snapshot.
   * Callbacks are NOT fired on restore to prevent duplicate side-effects.
   */
  public restoreFromSave(state: MarkRecallSaveState): void {
    this._hasMarked = state.hasMarked ?? false;
    this._position = state.position ? { ...state.position } : null;
    this._cellId = state.cellId ?? null;

    // Safety: if hasMarked is true but position is missing, reset to unmarked.
    if (this._hasMarked && !this._position) {
      this._hasMarked = false;
      this._cellId = null;
    }
  }
}
