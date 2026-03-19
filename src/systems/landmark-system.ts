/**
 * LandmarkSystem — Landmark-driven exploration rewards for Camelot.
 *
 * Tracks named points-of-interest (dungeons, ruins, shrines, camps, …) and
 * grants configurable rewards when the player first discovers them or fully
 * completes them (clears the encounter, activates a shrine, etc.).
 *
 * Headless: no BabylonJS dependencies — positions are plain { x, y, z }
 * vectors; reward delivery is handled by callbacks that the game layer wires
 * to its own inventory/XP/fame systems.
 */

// ── Landmark type ─────────────────────────────────────────────────────────────

export type LandmarkType =
  | "dungeon"
  | "ruin"
  | "shrine"
  | "cave"
  | "tower"
  | "camp"
  | "settlement"
  | "monument";

// ── Reward ────────────────────────────────────────────────────────────────────

/** Item quantity to grant as part of a reward. */
export interface LandmarkRewardItem {
  /** Item id that must be known to the item registry. */
  itemId: string;
  /** How many copies to grant (>= 1). */
  quantity: number;
}

/**
 * Reward delivered to the player when a landmark is discovered or completed.
 * All fields are optional — an empty reward record is valid (no-op).
 */
export interface LandmarkReward {
  /** Id of a LootTable to roll for bonus items. */
  tableId?: string;
  /** Fixed items granted unconditionally. */
  items?: LandmarkRewardItem[];
  /** Experience points granted. */
  xp?: number;
  /** Fame points granted. */
  fame?: number;
}

// ── Landmark definition ───────────────────────────────────────────────────────

/** Static configuration for a single point-of-interest. */
export interface LandmarkDefinition {
  /** Stable unique identifier. */
  id: string;
  /** Human-readable name (shown in the map legend and HUD). */
  name: string;
  /** Optional lore description. */
  description?: string;
  /** Classification used for filtering and icon selection. */
  type: LandmarkType;
  /** World-space position of the landmark anchor. */
  position: { x: number; y: number; z: number };
  /**
   * Reward granted the first time the player discovers this landmark.
   * Fires `onLandmarkDiscovered` and is then locked out.
   */
  discoveryReward?: LandmarkReward;
  /**
   * Reward granted when the player fully completes the landmark
   * (e.g. clears the dungeon, activates the shrine).
   * Fires `onLandmarkCompleted` and is then locked out.
   */
  completionReward?: LandmarkReward;
}

// ── Runtime record ────────────────────────────────────────────────────────────

interface LandmarkRecord {
  definition: LandmarkDefinition;
  discovered: boolean;
  completed: boolean;
}

// ── Reward result ─────────────────────────────────────────────────────────────

/** Data passed to the discovery / completion callbacks. */
export interface LandmarkRewardResult {
  landmarkId: string;
  rewardType: "discovery" | "completion";
  reward: LandmarkReward;
}

// ── Snapshot ──────────────────────────────────────────────────────────────────

/** Persisted per-landmark progress flags. */
export interface LandmarkSnapshot {
  id: string;
  discovered: boolean;
  completed: boolean;
}

// ── System ────────────────────────────────────────────────────────────────────

/**
 * Manages landmark definitions and player progress (discovered / completed).
 *
 * **Exploration rewards**: call `discoverLandmark(id)` when the player enters
 * the landmark's vicinity; call `completeLandmark(id)` when the player fully
 * clears / activates it.  Each action fires once per landmark.
 *
 * **Spatial queries**: `getLandmarksInRadius()` / `getNearestLandmark()` /
 * `getUndiscoveredInRadius()` support HUD map markers and discovery checks.
 */
export class LandmarkSystem {
  private _landmarks: Map<string, LandmarkRecord> = new Map();

  // ── Callbacks ─────────────────────────────────────────────────────────────

  /**
   * Fired the first time a landmark is discovered.
   * The game layer should apply the reward to the player's inventory/stats.
   */
  public onLandmarkDiscovered: ((result: LandmarkRewardResult) => void) | null = null;

  /**
   * Fired the first time a landmark is completed.
   * The game layer should apply the reward to the player's inventory/stats.
   */
  public onLandmarkCompleted: ((result: LandmarkRewardResult) => void) | null = null;

  // ── CRUD ──────────────────────────────────────────────────────────────────

  /**
   * Register a landmark.  Silently replaces any existing landmark with the
   * same id, resetting its progress.
   */
  public addLandmark(definition: LandmarkDefinition): void {
    this._landmarks.set(definition.id, {
      definition,
      discovered: false,
      completed: false,
    });
  }

  /**
   * Remove a landmark by id.  Safe to call with an unknown id.
   */
  public removeLandmark(id: string): void {
    this._landmarks.delete(id);
  }

  /** Returns the definition for a landmark, or `undefined` if unknown. */
  public getLandmark(id: string): LandmarkDefinition | undefined {
    return this._landmarks.get(id)?.definition;
  }

  /** All registered landmark definitions. */
  public get landmarks(): LandmarkDefinition[] {
    return Array.from(this._landmarks.values()).map((r) => r.definition);
  }

  /** Remove all landmarks. */
  public clear(): void {
    this._landmarks.clear();
  }

  // ── Discovery + completion ────────────────────────────────────────────────

  /**
   * Mark a landmark as discovered (idempotent after first call).
   *
   * @returns A `LandmarkRewardResult` on the first call, or `null` if already
   *   discovered or the id is unknown.
   */
  public discoverLandmark(id: string): LandmarkRewardResult | null {
    const record = this._landmarks.get(id);
    if (!record || record.discovered) return null;

    record.discovered = true;
    const reward = record.definition.discoveryReward ?? {};
    const result: LandmarkRewardResult = {
      landmarkId: id,
      rewardType: "discovery",
      reward,
    };
    this.onLandmarkDiscovered?.(result);
    return result;
  }

  /**
   * Mark a landmark as completed (idempotent after first call).
   * Auto-discovers the landmark first if not already done.
   *
   * @returns A `LandmarkRewardResult` on the first call, or `null` if already
   *   completed or the id is unknown.
   */
  public completeLandmark(id: string): LandmarkRewardResult | null {
    const record = this._landmarks.get(id);
    if (!record || record.completed) return null;

    // Auto-discover if not yet done
    if (!record.discovered) {
      this.discoverLandmark(id);
    }

    record.completed = true;
    const reward = record.definition.completionReward ?? {};
    const result: LandmarkRewardResult = {
      landmarkId: id,
      rewardType: "completion",
      reward,
    };
    this.onLandmarkCompleted?.(result);
    return result;
  }

  // ── Progress queries ──────────────────────────────────────────────────────

  /** Returns `true` if the landmark has been discovered. */
  public isDiscovered(id: string): boolean {
    return this._landmarks.get(id)?.discovered ?? false;
  }

  /** Returns `true` if the landmark has been completed. */
  public isCompleted(id: string): boolean {
    return this._landmarks.get(id)?.completed ?? false;
  }

  /** Ids of all discovered landmarks. */
  public getDiscoveredLandmarks(): string[] {
    const result: string[] = [];
    for (const [id, record] of this._landmarks) {
      if (record.discovered) result.push(id);
    }
    return result;
  }

  /** Ids of all completed landmarks. */
  public getCompletedLandmarks(): string[] {
    const result: string[] = [];
    for (const [id, record] of this._landmarks) {
      if (record.completed) result.push(id);
    }
    return result;
  }

  /** Ids of all landmarks of the given type. */
  public getLandmarksByType(type: LandmarkType): string[] {
    const result: string[] = [];
    for (const [id, record] of this._landmarks) {
      if (record.definition.type === type) result.push(id);
    }
    return result;
  }

  // ── Spatial queries ───────────────────────────────────────────────────────

  /**
   * Returns the ids of all landmarks whose anchor position is within
   * `radius` world units of the given point.
   * A landmark exactly on the boundary is included.
   */
  public getLandmarksInRadius(x: number, y: number, z: number, radius: number): string[] {
    const result: string[] = [];
    const r2 = radius * radius;
    for (const [id, record] of this._landmarks) {
      const p = record.definition.position;
      const dx = p.x - x;
      const dy = p.y - y;
      const dz = p.z - z;
      if (dx * dx + dy * dy + dz * dz <= r2) result.push(id);
    }
    return result;
  }

  /**
   * Returns the id of the single closest landmark to the given point, or
   * `null` if no landmarks are registered.
   */
  public getNearestLandmark(x: number, y: number, z: number): string | null {
    let nearestId: string | null = null;
    let nearestDist2 = Infinity;
    for (const [id, record] of this._landmarks) {
      const p = record.definition.position;
      const dx = p.x - x;
      const dy = p.y - y;
      const dz = p.z - z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < nearestDist2) {
        nearestDist2 = d2;
        nearestId = id;
      }
    }
    return nearestId;
  }

  /**
   * Returns the ids of all *undiscovered* landmarks within `radius` world
   * units of the given point.  Useful for proximity-triggered discovery.
   */
  public getUndiscoveredInRadius(x: number, y: number, z: number, radius: number): string[] {
    return this.getLandmarksInRadius(x, y, z, radius).filter(
      (id) => !this._landmarks.get(id)!.discovered
    );
  }

  // ── Snapshot / restore ────────────────────────────────────────────────────

  /**
   * Capture current discovered/completed flags for all landmarks.
   * Definitions are considered static configuration and are not included.
   */
  public getSnapshot(): LandmarkSnapshot[] {
    return Array.from(this._landmarks.values()).map((r) => ({
      id: r.definition.id,
      discovered: r.discovered,
      completed: r.completed,
    }));
  }

  /**
   * Restore discovered/completed flags from a snapshot.
   * Unknown landmark ids are silently ignored.
   * Does NOT fire discovery/completion callbacks during restore — state is
   * applied directly so callers can suppress duplicate reward grants on load.
   */
  public restoreSnapshot(snapshots: LandmarkSnapshot[]): void {
    for (const snap of snapshots) {
      const record = this._landmarks.get(snap.id);
      if (!record) continue;
      record.discovered = snap.discovered;
      record.completed = snap.completed;
    }
  }
}
