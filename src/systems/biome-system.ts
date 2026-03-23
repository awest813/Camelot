/**
 * BiomeSystem — Biome-specific encounter tables for Camelot.
 *
 * Partitions the world into named biomes (forest, plains, desert, …).
 * Each biome carries a weighted set of encounter-table references so the
 * game layer can roll appropriate random encounters or ambient events based
 * on the player's current position.
 *
 * Headless: no BabylonJS dependencies — spatial containment is computed from
 * lightweight shape descriptors; the game layer wires position updates and
 * callback responses.
 */

// ── Re-exported shape types (mirrors RegionSystem for consistency) ─────────────

/** Axis-aligned bounding box. */
export interface BiomeRect {
  type: "rect";
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

/** Spherical bounding volume. */
export interface BiomeSphere {
  type: "sphere";
  center: { x: number; y: number; z: number };
  radius: number;
}

export type BiomeShape = BiomeRect | BiomeSphere;

// ── Encounter table reference ─────────────────────────────────────────────────

/**
 * A weighted reference to an encounter/loot table that applies inside a
 * particular biome.  Higher `weight` means this table is chosen more often
 * when `sampleEncounterTable()` is called.
 */
export interface BiomeEncounterGroup {
  /** Loot/encounter table id registered in the LootTableSystem. */
  tableId: string;
  /** Relative probability weight (must be > 0). */
  weight: number;
}

// ── Biome definition ──────────────────────────────────────────────────────────

/** Static configuration for a named biome region. */
export interface BiomeDefinition {
  /** Stable unique identifier. */
  id: string;
  /** Human-readable name shown in UI / logs. */
  name: string;
  /** Optional author note or lore description. */
  description?: string;
  /** Bounding volume that defines where this biome exists in the world. */
  shape: BiomeShape;
  /** Weighted encounter-table references for this biome. */
  encounterGroups: BiomeEncounterGroup[];
  /**
   * Base encounter rate in encounters per in-game hour.
   * Consumers multiply this by the current time delta to schedule encounters.
   */
  encounterRate?: number;
  /** Optional id of the ambient sound/event set to activate in this biome. */
  ambientId?: string;
}

// ── Snapshot ──────────────────────────────────────────────────────────────────

/** Minimal persisted state for a single biome (the definition is static config). */
export interface BiomeSnapshot {
  id: string;
  /** Whether the player was inside this biome at the time of the snapshot. */
  playerInside: boolean;
}

// ── System ────────────────────────────────────────────────────────────────────

/**
 * Manages biome definitions and the player's current biome membership.
 *
 * **Encounter sampling**: `sampleEncounterTable(biomeId)` performs a weighted
 * random draw over a biome's `encounterGroups` and returns a table id (or
 * `null` when the biome has no groups).
 *
 * **Player tracking**: `updatePlayerPosition(x, y, z)` recalculates biome
 * membership and fires `onBiomeEntered` / `onBiomeExited` on transitions.
 */
export class BiomeSystem {
  private _biomes: Map<string, BiomeDefinition> = new Map();
  /** Biome ids that currently contain the tracked player position. */
  private _currentBiomeIds: Set<string> = new Set();
  /** Reused scratch set to avoid per-frame allocations in `updatePlayerPosition()`. */
  private _nextBiomeIds: Set<string> = new Set();

  // ── Callbacks ─────────────────────────────────────────────────────────────

  /** Fired when the player enters a new biome. */
  public onBiomeEntered: ((biomeId: string) => void) | null = null;

  /** Fired when the player exits a biome they were previously inside. */
  public onBiomeExited: ((biomeId: string) => void) | null = null;

  // ── CRUD ──────────────────────────────────────────────────────────────────

  /**
   * Register a biome.  Silently replaces any existing biome with the same id.
   * The new definition becomes effective at the next `updatePlayerPosition()`.
   */
  public addBiome(definition: BiomeDefinition): void {
    this._biomes.set(definition.id, definition);
  }

  /**
   * Remove a biome by id.  Safe to call with an unknown id.
   * If the player was inside the removed biome `onBiomeExited` fires.
   */
  public removeBiome(id: string): void {
    if (!this._biomes.has(id)) return;
    this._biomes.delete(id);
    if (this._currentBiomeIds.has(id)) {
      this._currentBiomeIds.delete(id);
      this.onBiomeExited?.(id);
    }
  }

  /** Returns the definition for a biome, or `undefined` if unknown. */
  public getBiome(id: string): BiomeDefinition | undefined {
    return this._biomes.get(id);
  }

  /** All registered biome definitions. */
  public get biomes(): BiomeDefinition[] {
    return Array.from(this._biomes.values());
  }

  /** Remove all biomes and reset player tracking. */
  public clear(): void {
    this._biomes.clear();
    this._currentBiomeIds.clear();
  }

  // ── Spatial queries ───────────────────────────────────────────────────────

  /**
   * Returns the ids of all biomes whose bounding volume contains the given
   * point.  A point on the boundary is considered inside.
   */
  public getBiomesAtPoint(x: number, y: number, z: number): string[] {
    const result: string[] = [];
    for (const [id, def] of this._biomes) {
      if (this._containsPoint(def.shape, x, y, z)) result.push(id);
    }
    return result;
  }

  // ── Player position tracking ──────────────────────────────────────────────

  /**
   * Recalculate which biomes contain the player position and fire enter/exit
   * callbacks for any changes.  Call this each frame (or on significant
   * player movement) from the game layer.
   */
  public updatePlayerPosition(x: number, y: number, z: number): void {
    const nowInside = this._nextBiomeIds;
    nowInside.clear();
    for (const [id, def] of this._biomes) {
      if (this._containsPoint(def.shape, x, y, z)) {
        nowInside.add(id);
      }
    }

    // Exited biomes
    for (const id of this._currentBiomeIds) {
      if (!nowInside.has(id)) {
        this._currentBiomeIds.delete(id);
        this.onBiomeExited?.(id);
      }
    }

    // Entered biomes
    for (const id of nowInside) {
      if (!this._currentBiomeIds.has(id)) {
        this._currentBiomeIds.add(id);
        this.onBiomeEntered?.(id);
      }
    }

    nowInside.clear();
  }

  /**
   * Returns the ids of all biomes the tracked player position is currently
   * inside (as of the last `updatePlayerPosition()` call).
   */
  public getCurrentBiomeIds(): string[] {
    return Array.from(this._currentBiomeIds);
  }

  // ── Encounter table helpers ───────────────────────────────────────────────

  /**
   * Returns all weighted encounter groups for the given biome.
   * Returns an empty array if the biome is unknown or has no groups.
   */
  public getEncounterGroups(biomeId: string): BiomeEncounterGroup[] {
    return this._biomes.get(biomeId)?.encounterGroups ?? [];
  }

  /**
   * Perform a weighted random draw over a biome's encounter groups and return
   * the selected table id, or `null` when the biome has no encounter groups.
   *
   * @param biomeId - The biome to sample.
   * @param rng     - Optional random number generator (default: `Math.random`).
   *                  Must return a value in [0, 1).
   */
  public sampleEncounterTable(biomeId: string, rng: () => number = Math.random): string | null {
    const groups = this.getEncounterGroups(biomeId);
    if (groups.length === 0) return null;

    const totalWeight = groups.reduce((sum, g) => sum + g.weight, 0);
    let roll = rng() * totalWeight;
    for (const g of groups) {
      roll -= g.weight;
      if (roll <= 0) return g.tableId;
    }
    // Floating-point safety: return last entry
    return groups[groups.length - 1].tableId;
  }

  // ── Snapshot / restore ────────────────────────────────────────────────────

  /**
   * Capture which biomes currently contain the player for persistence.
   * Biome definitions are considered static configuration and are not
   * included in the snapshot.
   */
  public getSnapshot(): BiomeSnapshot[] {
    return Array.from(this._biomes.keys()).map((id) => ({
      id,
      playerInside: this._currentBiomeIds.has(id),
    }));
  }

  /**
   * Restore player-inside flags from a snapshot.
   * Unknown biome ids in the snapshot are silently ignored.
   * Fires enter/exit callbacks for any flag changes.
   */
  public restoreSnapshot(snapshots: BiomeSnapshot[]): void {
    for (const snap of snapshots) {
      if (!this._biomes.has(snap.id)) continue;
      const wasInside = this._currentBiomeIds.has(snap.id);
      if (snap.playerInside && !wasInside) {
        this._currentBiomeIds.add(snap.id);
        this.onBiomeEntered?.(snap.id);
      } else if (!snap.playerInside && wasInside) {
        this._currentBiomeIds.delete(snap.id);
        this.onBiomeExited?.(snap.id);
      }
    }
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  private _containsPoint(shape: BiomeShape, x: number, y: number, z: number): boolean {
    if (shape.type === "rect") {
      return (
        x >= shape.min.x && x <= shape.max.x &&
        y >= shape.min.y && y <= shape.max.y &&
        z >= shape.min.z && z <= shape.max.z
      );
    }
    // sphere
    const dx = x - shape.center.x;
    const dy = y - shape.center.y;
    const dz = z - shape.center.z;
    return dx * dx + dy * dy + dz * dz <= shape.radius * shape.radius;
  }
}
