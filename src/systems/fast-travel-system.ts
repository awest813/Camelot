import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Player } from "../entities/player";

/**
 * FastTravelSystem — Oblivion-style discovered-location map and teleportation.
 *
 * The player discovers locations by visiting them (the caller decides when to
 * call `discoverLocation`; game.ts wires it to `cellManager.onCellChanged`
 * and to named exterior landmarks).  Once discovered, `fastTravelTo` teleports
 * the player instantly.
 *
 * Guard conditions:
 *   - Cannot fast-travel while in combat (`isInCombat` guard).
 *   - Cannot fast-travel while sneaking (`isSneaking` guard).
 *   - Cannot fast-travel to an undiscovered location.
 *
 * Wire-up example (game.ts):
 * ```ts
 * this.fastTravelSystem = new FastTravelSystem();
 * // Seed the starting town:
 * this.fastTravelSystem.discoverLocation("town_start", "Starting Village",
 *   new Vector3(0, 2, 0));
 * // On cell change:
 * this.cellManager.onCellChanged = (id, name) => {
 *   this.fastTravelSystem.discoverLocation(id, name, this.player.camera.position.clone());
 * };
 * // On M key press:
 * const result = this.fastTravelSystem.fastTravelTo(
 *   locationId, this.player, isInCombat, isSneaking);
 * if (result.ok) this.ui.showNotification(result.message, 2000);
 * ```
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FastTravelLocation {
  /** Unique identifier matching a cell/landmark ID. */
  id: string;
  /** Human-readable display name shown in the fast-travel list. */
  name: string;
  /** World-space position the player is placed at after fast-travelling. */
  position: { x: number; y: number; z: number };
}

export interface FastTravelSaveState {
  discoveredIds: string[];
  locations: FastTravelLocation[];
}

/** World-units travelled per in-game hour while fast-travelling. */
export const FAST_TRAVEL_UNITS_PER_HOUR = 180;
/** Minimum simulated travel time (hours) even for short hops. */
export const FAST_TRAVEL_MIN_HOURS = 0.5;
/** Maximum simulated travel time (hours) for very long trips. */
export const FAST_TRAVEL_MAX_HOURS = 24;

// ── System ────────────────────────────────────────────────────────────────────

export class FastTravelSystem {
  private _locations: Map<string, FastTravelLocation> = new Map();

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Register (or update) a discoverable location.
   * Calling this with an existing `id` updates the stored position/name.
   *
   * @returns `true` if this is a *newly* discovered location; `false` if it
   *          was already known (useful for "You discovered X!" notifications).
   */
  /** Returns a discovered location by id, or undefined if unknown. */
  public getDiscoveredLocation(locationId: string): FastTravelLocation | undefined {
    return this._locations.get(locationId);
  }

  public discoverLocation(
    id: string,
    name: string,
    position: Vector3 | { x: number; y: number; z: number },
  ): boolean {
    const isNew = !this._locations.has(id);
    this._locations.set(id, {
      id,
      name,
      position: { x: position.x, y: position.y, z: position.z },
    });
    return isNew;
  }

  /**
   * Attempt to fast-travel the player to a discovered location.
   *
   * @param locationId  Target location ID (must be in the discovered list).
   * @param player      The player whose position will be updated.
   * @param isInCombat  Whether the player is currently in active combat.
   * @param isSneaking  Whether the player is currently sneaking.
   *
   * @returns `{ ok: true, message }` on success or
   *          `{ ok: false, message }` with a reason string on failure.
   */
  public fastTravelTo(
    locationId: string,
    player: Player,
    isInCombat: boolean,
    isSneaking: boolean,
  ): { ok: boolean; message: string } {
    if (isInCombat) {
      return { ok: false, message: "Cannot fast travel while in combat." };
    }
    if (isSneaking) {
      return { ok: false, message: "Cannot fast travel while sneaking." };
    }

    const loc = this._locations.get(locationId);
    if (!loc) {
      return { ok: false, message: `Location "${locationId}" has not been discovered.` };
    }

    player.camera.position = new Vector3(loc.position.x, loc.position.y, loc.position.z);
    return { ok: true, message: `Fast travelled to ${loc.name}.` };
  }

  /**
   * Estimate in-game hours required to travel from `fromPosition` to a
   * discovered location.
   *
   * Travel time is distance-based and clamped to a configurable floor/ceiling
   * so short hops still consume meaningful time while very long hops remain
   * bounded.
   *
   * Returns `null` if the destination is unknown.
   */
  public estimateTravelHours(
    fromPosition: Vector3 | { x: number; y: number; z: number },
    locationId: string,
  ): number | null {
    const destination = this._locations.get(locationId);
    if (!destination) return null;

    const distance = Vector3.Distance(
      new Vector3(fromPosition.x, fromPosition.y, fromPosition.z),
      new Vector3(destination.position.x, destination.position.y, destination.position.z),
    );
    const rawHours = distance / FAST_TRAVEL_UNITS_PER_HOUR;
    return Math.max(FAST_TRAVEL_MIN_HOURS, Math.min(FAST_TRAVEL_MAX_HOURS, rawHours));
  }

  /** All discovered locations in insertion order. */
  public get discoveredLocations(): ReadonlyArray<Readonly<FastTravelLocation>> {
    return Array.from(this._locations.values());
  }

  /** Returns one discovered location by id, if present. */
  public getLocation(id: string): Readonly<FastTravelLocation> | undefined {
    return this._locations.get(id);
  }

  /** Whether the given location ID has been discovered. */
  public isDiscovered(id: string): boolean {
    return this._locations.has(id);
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  public getSaveState(): FastTravelSaveState {
    return {
      discoveredIds: Array.from(this._locations.keys()),
      locations: Array.from(this._locations.values()),
    };
  }

  public restoreFromSave(data: FastTravelSaveState): void {
    if (!Array.isArray(data?.locations)) return;
    this._locations.clear();
    for (const loc of data.locations) {
      if (
        typeof loc?.id === "string" &&
        typeof loc.name === "string" &&
        typeof loc.position?.x === "number" &&
        typeof loc.position?.y === "number" &&
        typeof loc.position?.z === "number"
      ) {
        this._locations.set(loc.id, loc);
      }
    }
  }
}
