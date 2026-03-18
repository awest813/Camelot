// ── Types ─────────────────────────────────────────────────────────────────────

/** An item reward granted on landmark discovery. */
export interface LandmarkItemReward {
  /** ID of the item (matches `InventorySystem` / framework item ids). */
  itemId: string;
  /** Number of copies awarded.  Must be ≥ 1. */
  quantity: number;
}

/**
 * Static definition of a named world landmark.
 *
 * Landmarks represent significant points of interest — ruins, shrines, vista
 * points, hidden caches — that reward the player for exploring off the beaten
 * path.
 */
export interface LandmarkDefinition {
  /** Stable unique identifier. */
  id: string;
  /** Human-readable display name shown in HUD/journal. */
  name: string;
  /** Optional flavour description. */
  description?: string;
  /** World-space position of the landmark's discovery trigger. */
  position: { x: number; y: number; z: number };
  /**
   * XP granted on first discovery (or on every discovery when
   * `isOneTime === false`).
   */
  rewardXp: number;
  /**
   * Items awarded on discovery.  Empty array means no item reward.
   */
  rewardItems: LandmarkItemReward[];
  /**
   * When `true` (default) the discovery rewards are granted only once.
   * Setting `isOneTime` to `false` allows repeated rewards every time
   * `discover()` is called.
   */
  isOneTime: boolean;
}

// ── Discovery result ──────────────────────────────────────────────────────────

/** Summary returned by {@link LandmarkSystem.discover}. */
export interface LandmarkDiscoveryResult {
  /** The landmark that was discovered. */
  landmark: LandmarkDefinition;
  /**
   * `true` when the landmark was already discovered before this call.
   * Rewards are still granted when `isOneTime === false`, but
   * `alreadyDiscovered` lets the UI decide whether to show a "first visit"
   * banner.
   */
  alreadyDiscovered: boolean;
  /** XP awarded this discovery (0 if already discovered + isOneTime). */
  xpAwarded: number;
  /** Items awarded this discovery (empty if already discovered + isOneTime). */
  itemsAwarded: LandmarkItemReward[];
}

// ── Persistence ───────────────────────────────────────────────────────────────

/** Serialisable save payload for {@link LandmarkSystem}. */
export interface LandmarkSaveState {
  /** IDs of all landmarks that have been discovered at least once. */
  discoveredIds: string[];
}

// ── System ────────────────────────────────────────────────────────────────────

/**
 * Registry of world landmarks with discovery-reward tracking.
 *
 * Typical usage:
 * ```ts
 * const landmarks = new LandmarkSystem();
 * landmarks.registerLandmark({
 *   id: "shrine_dawn",
 *   name: "Shrine of Dawn",
 *   description: "An ancient shrine bathed in golden light.",
 *   position: { x: 120, y: 0, z: 85 },
 *   rewardXp: 250,
 *   rewardItems: [{ itemId: "amulet_dawn", quantity: 1 }],
 *   isOneTime: true,
 * });
 *
 * landmarks.onDiscovered = (result) => {
 *   hud.showNotification(`Discovered: ${result.landmark.name}  +${result.xpAwarded} XP`);
 * };
 *
 * // Called when the player enters the landmark trigger volume:
 * landmarks.discover("shrine_dawn");
 * ```
 */
export class LandmarkSystem {
  private readonly _landmarks  = new Map<string, LandmarkDefinition>();
  private readonly _discovered = new Set<string>();

  // ── Callbacks ─────────────────────────────────────────────────────────────

  /**
   * Fired after a successful `discover()` call (whether or not it was the
   * first discovery).  The result object includes `alreadyDiscovered`,
   * `xpAwarded`, and `itemsAwarded` so the game layer can drive HUD
   * notifications and stat updates.
   */
  public onDiscovered: ((result: LandmarkDiscoveryResult) => void) | null = null;

  // ── Landmark CRUD ─────────────────────────────────────────────────────────

  /**
   * Register or replace a landmark definition.
   * Silently replaces an existing entry with the same id.
   */
  public registerLandmark(definition: LandmarkDefinition): void {
    this._landmarks.set(definition.id, { ...definition });
  }

  /**
   * Remove a landmark.  Discovery status for the id is also cleared.
   * Safe to call with an unknown id.
   */
  public unregisterLandmark(id: string): void {
    this._landmarks.delete(id);
    this._discovered.delete(id);
  }

  /** Returns the landmark definition for `id`, or `undefined`. */
  public getLandmark(id: string): LandmarkDefinition | undefined {
    return this._landmarks.get(id);
  }

  /** All registered landmark definitions. */
  public get landmarks(): LandmarkDefinition[] {
    return Array.from(this._landmarks.values());
  }

  // ── Discovery ─────────────────────────────────────────────────────────────

  /**
   * Discover a landmark by id.
   *
   * - If the landmark is unknown, returns `null`.
   * - If `isOneTime` and already discovered, fires `onDiscovered` with
   *   `alreadyDiscovered: true` and `xpAwarded: 0` / `itemsAwarded: []`.
   * - Otherwise grants `rewardXp` and `rewardItems` and marks the landmark
   *   as discovered.
   *
   * @returns The discovery result, or `null` if the landmark is not registered.
   */
  public discover(id: string): LandmarkDiscoveryResult | null {
    const landmark = this._landmarks.get(id);
    if (!landmark) return null;

    const alreadyDiscovered = this._discovered.has(id);
    const shouldReward = !alreadyDiscovered || !landmark.isOneTime;

    const xpAwarded    = shouldReward ? landmark.rewardXp : 0;
    const itemsAwarded = shouldReward ? landmark.rewardItems.map((r) => ({ ...r })) : [];

    // Mark as discovered (idempotent).
    this._discovered.add(id);

    const result: LandmarkDiscoveryResult = {
      landmark,
      alreadyDiscovered,
      xpAwarded,
      itemsAwarded,
    };

    this.onDiscovered?.(result);
    return result;
  }

  /** Returns `true` when the landmark has been discovered at least once. */
  public isDiscovered(id: string): boolean {
    return this._discovered.has(id);
  }

  /** IDs of all landmarks that have been discovered. */
  public getDiscoveredIds(): string[] {
    return Array.from(this._discovered);
  }

  /** IDs of registered landmarks that have NOT yet been discovered. */
  public getUndiscoveredIds(): string[] {
    const result: string[] = [];
    for (const id of this._landmarks.keys()) {
      if (!this._discovered.has(id)) result.push(id);
    }
    return result;
  }

  // ── Spatial query ─────────────────────────────────────────────────────────

  /**
   * Returns all landmarks whose position is within `radius` world-units of
   * `(x, y, z)` (Euclidean distance).
   */
  public getLandmarksNearPoint(
    x: number,
    y: number,
    z: number,
    radius: number,
  ): LandmarkDefinition[] {
    const r2 = radius * radius;
    const result: LandmarkDefinition[] = [];
    for (const def of this._landmarks.values()) {
      const dx = def.position.x - x;
      const dy = def.position.y - y;
      const dz = def.position.z - z;
      if (dx * dx + dy * dy + dz * dz <= r2) result.push(def);
    }
    return result;
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  /** Capture discovered landmark ids for save persistence. */
  public getSaveState(): LandmarkSaveState {
    return { discoveredIds: Array.from(this._discovered) };
  }

  /**
   * Restore discovery status from a saved state.
   * IDs that are not currently registered are silently ignored so that saves
   * remain compatible when landmarks are removed from the world data.
   */
  public restoreFromSave(state: LandmarkSaveState): void {
    this._discovered.clear();
    for (const id of state.discoveredIds) {
      if (this._landmarks.has(id)) this._discovered.add(id);
    }
  }

  /** Clear all discovered flags (does not remove landmark definitions). */
  public resetDiscoveries(): void {
    this._discovered.clear();
  }

  /** Remove all landmarks and clear all discovery state. */
  public clear(): void {
    this._landmarks.clear();
    this._discovered.clear();
  }
}
