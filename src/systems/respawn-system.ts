/**
 * RespawnSystem — Oblivion-style zone respawning.
 *
 * Oblivion's encounter zones and dungeons respawn their enemies and loot
 * containers after a fixed period of in-game time (default 3 in-game days =
 * 72 game-hours).  This system tracks when each zone was last cleared and
 * notifies the game when a zone is ready to be refilled.
 *
 * Usage pattern:
 *   1. Register encounter zones with `registerZone(zoneId, respawnAfterHours)`.
 *   2. When the player clears a zone (kills last enemy, empties chest, etc.)
 *      call `markCleared(zoneId, gameTimeMinutes)`.
 *   3. Call `update(currentGameTimeMinutes)` every game tick (or on clock
 *      changes).  It fires `onZoneRespawn(zoneId)` for every zone that has
 *      passed its respawn window.
 *   4. In `onZoneRespawn` re-spawn the zone's NPCs / refill containers.
 *
 * Wire-up example (game.ts):
 * ```ts
 * this.respawnSystem = new RespawnSystem();
 * this.respawnSystem.registerZone("cave_01", 72);
 *
 * // On last enemy death in a zone:
 * this.respawnSystem.markCleared("cave_01", this.timeSystem.gameTime);
 *
 * this.respawnSystem.onZoneRespawn = (zoneId) => {
 *   this.ui.showNotification(`Zone ${zoneId} has respawned.`, 2000);
 *   // re-spawn enemies and refill containers for this zone
 * };
 * ```
 */

// ── Constants ──────────────────────────────────────────────────────────────────

/** Default number of game-hours before a cleared zone respawns. */
export const DEFAULT_RESPAWN_HOURS = 72;
/** Minimum allowed respawn window (hours). */
export const MIN_RESPAWN_HOURS = 1;
/** Maximum allowed respawn window (hours). */
export const MAX_RESPAWN_HOURS = 720; // 30 game-days

// ── Types ──────────────────────────────────────────────────────────────────────

export interface RespawnZone {
  zoneId: string;
  /** Respawn interval in game-hours. */
  respawnAfterHours: number;
  /**
   * Game time (minutes) when the zone was last cleared.
   * `null` means the zone has never been cleared; it will not respawn until
   * it is explicitly marked cleared at least once.
   */
  lastClearedAt: number | null;
  /**
   * True while the zone is waiting to respawn (cleared but window not yet met).
   * False once the respawn fires or if the zone was never cleared.
   */
  pendingRespawn: boolean;
}

export interface RespawnSaveState {
  zones: Array<{
    zoneId: string;
    respawnAfterHours: number;
    lastClearedAt: number | null;
    pendingRespawn: boolean;
  }>;
}

// ── System ────────────────────────────────────────────────────────────────────

export class RespawnSystem {
  private _zones: Map<string, RespawnZone> = new Map();

  /**
   * Fired when a zone's respawn window has elapsed.
   * The zone is reset to `pendingRespawn = false` before this callback fires.
   * Implementors should re-spawn enemies, refill containers, etc.
   *
   * @param zoneId  The identifier of the zone that has respawned.
   */
  public onZoneRespawn: ((zoneId: string) => void) | null = null;

  // ── Registration ───────────────────────────────────────────────────────────

  /**
   * Register an encounter zone.  Safe to call repeatedly for the same id
   * (subsequent calls are no-ops so existing cleared/respawn state is preserved).
   *
   * @param zoneId           Unique identifier for the zone.
   * @param respawnAfterHours  Game-hours to wait after clearing before respawn.
   *                           Defaults to `DEFAULT_RESPAWN_HOURS` (72 h).
   */
  public registerZone(
    zoneId: string,
    respawnAfterHours: number = DEFAULT_RESPAWN_HOURS,
  ): void {
    if (this._zones.has(zoneId)) return;
    const clamped = Math.max(MIN_RESPAWN_HOURS, Math.min(MAX_RESPAWN_HOURS, Math.round(respawnAfterHours)));
    this._zones.set(zoneId, {
      zoneId,
      respawnAfterHours: clamped,
      lastClearedAt: null,
      pendingRespawn: false,
    });
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Mark a zone as just cleared.  The respawn countdown begins from
   * `gameTimeMinutes` and will fire once `respawnAfterHours * 60` minutes
   * have elapsed.
   *
   * @param zoneId            Zone to mark cleared.
   * @param gameTimeMinutes   Current game time in minutes (from TimeSystem.gameTime).
   */
  public markCleared(zoneId: string, gameTimeMinutes: number): void {
    const zone = this._zones.get(zoneId);
    if (!zone) return;
    zone.lastClearedAt = gameTimeMinutes;
    zone.pendingRespawn = true;
  }

  /**
   * Returns `true` if the zone exists and its respawn timer has elapsed.
   * Does NOT trigger the `onZoneRespawn` callback — call `update()` for that.
   */
  public isDue(zoneId: string, currentGameTimeMinutes: number): boolean {
    const zone = this._zones.get(zoneId);
    if (!zone || !zone.pendingRespawn || zone.lastClearedAt === null) return false;
    const elapsedMinutes = currentGameTimeMinutes - zone.lastClearedAt;
    return elapsedMinutes >= zone.respawnAfterHours * 60;
  }

  /**
   * Returns the zone record for the given id, or `undefined`.
   */
  public getZone(zoneId: string): Readonly<RespawnZone> | undefined {
    return this._zones.get(zoneId);
  }

  /**
   * Returns all registered zones in registration order.
   */
  public get zones(): ReadonlyArray<Readonly<RespawnZone>> {
    return Array.from(this._zones.values());
  }

  /**
   * Advance the system clock.  For every pending zone whose respawn window
   * has elapsed `onZoneRespawn` is fired and the zone's `pendingRespawn`
   * flag is cleared.
   *
   * Call this from the game loop (or from TimeSystem's advanceHours callback)
   * with the current game time in minutes.
   *
   * @param currentGameTimeMinutes  Current game time in minutes.
   */
  public update(currentGameTimeMinutes: number): void {
    for (const zone of this._zones.values()) {
      if (!zone.pendingRespawn || zone.lastClearedAt === null) continue;
      const elapsedMinutes = currentGameTimeMinutes - zone.lastClearedAt;
      if (elapsedMinutes >= zone.respawnAfterHours * 60) {
        zone.pendingRespawn = false;
        this.onZoneRespawn?.(zone.zoneId);
      }
    }
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  public getSaveState(): RespawnSaveState {
    return {
      zones: Array.from(this._zones.values()).map((z) => ({
        zoneId:            z.zoneId,
        respawnAfterHours: z.respawnAfterHours,
        lastClearedAt:     z.lastClearedAt,
        pendingRespawn:    z.pendingRespawn,
      })),
    };
  }

  public restoreFromSave(state: RespawnSaveState): void {
    if (!state || !Array.isArray(state.zones)) return;
    for (const entry of state.zones) {
      if (typeof entry.zoneId !== "string") continue;
      const zone = this._zones.get(entry.zoneId);
      if (!zone) continue; // only restore registered zones
      if (typeof entry.lastClearedAt === "number" || entry.lastClearedAt === null) {
        zone.lastClearedAt = entry.lastClearedAt;
      }
      if (typeof entry.pendingRespawn === "boolean") {
        zone.pendingRespawn = entry.pendingRespawn;
      }
      if (typeof entry.respawnAfterHours === "number" && Number.isFinite(entry.respawnAfterHours)) {
        zone.respawnAfterHours = Math.max(
          MIN_RESPAWN_HOURS,
          Math.min(MAX_RESPAWN_HOURS, Math.round(entry.respawnAfterHours)),
        );
      }
    }
  }
}
