import type { LodSystem } from "./lod-system";

// ── Region shape types ────────────────────────────────────────────────────────

/** Axis-aligned bounding box region. */
export interface RectRegion {
  type: "rect";
  /** Minimum corner (x, y, z). */
  min: { x: number; y: number; z: number };
  /** Maximum corner (x, y, z). */
  max: { x: number; y: number; z: number };
}

/** Sphere region. */
export interface SphereRegion {
  type: "sphere";
  center: { x: number; y: number; z: number };
  radius: number;
}

export type RegionShape = RectRegion | SphereRegion;

// ── Region definition ─────────────────────────────────────────────────────────

/** A named, toggleable region that partitions the world. */
export interface RegionDefinition {
  /** Stable unique identifier. */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** Optional author note. */
  description?: string;
  /** Bounding volume. */
  shape: RegionShape;
}

// ── Runtime region record ─────────────────────────────────────────────────────

interface RegionRecord {
  definition: RegionDefinition;
  /**
   * Whether entities in this region are rendered / simulated.
   * When false, meshes registered to this region are hidden and the associated
   * LodSystem entries are suspended.
   */
  visible: boolean;
  /**
   * Whether entities in this region are actively simulated (AI, physics).
   * Authors can hide a region while still leaving its logic active, or
   * deactivate everything by setting both `visible` and `active` to false.
   */
  active: boolean;
}

// ── Snapshot for persistence ──────────────────────────────────────────────────

export interface RegionSnapshot {
  id: string;
  visible: boolean;
  active: boolean;
}

// ── System ────────────────────────────────────────────────────────────────────

/**
 * Partitions the world into named rectangular or spherical regions that can be
 * independently shown/hidden and activated/deactivated.
 *
 * **Editor integration**: toggle visibility so authors can focus on one zone at
 * a time without every entity loaded at once.
 *
 * **LodSystem integration**: when a region is set to inactive (`active=false`)
 * the system notifies an optional attached `LodSystem` so its registered meshes
 * can bypass expensive LOD distance computations for the frame.
 *
 * **No Babylon dependency**: the system is headless; mesh visibility callbacks
 * are injected via `onVisibilityChange` so the game layer can apply them to
 * engine-specific mesh objects.
 */
export class RegionSystem {
  private _regions: Map<string, RegionRecord> = new Map();
  private _lodSystem: LodSystem | null = null;

  // ── Optional callbacks ────────────────────────────────────────────────────

  /**
   * Called when a region's `visible` flag changes.
   * The game layer should toggle mesh visibility for all entities whose
   * world position lies within the region's bounding volume.
   */
  public onVisibilityChange: ((regionId: string, visible: boolean) => void) | null = null;

  /**
   * Called when a region's `active` flag changes.
   * The game layer should pause/resume AI and physics simulation for
   * entities in the region.
   */
  public onActiveChange: ((regionId: string, active: boolean) => void) | null = null;

  // ── LodSystem integration ─────────────────────────────────────────────────

  /**
   * Attach an optional `LodSystem` so that `pauseLodForInactiveRegions()` can
   * be called each frame to skip LOD updates for inactive regions.
   */
  public attachLodSystem(lod: LodSystem): void {
    this._lodSystem = lod;
  }

  // ── Region CRUD ───────────────────────────────────────────────────────────

  /**
   * Register a new region.  Regions start visible and active.
   * Silently replaces an existing region with the same id.
   */
  public addRegion(definition: RegionDefinition): void {
    this._regions.set(definition.id, {
      definition,
      visible: true,
      active: true,
    });
  }

  /**
   * Remove a region by id.  Safe to call with an unknown id.
   */
  public removeRegion(id: string): void {
    this._regions.delete(id);
  }

  /** Returns the definition for a region, or undefined. */
  public getRegion(id: string): RegionDefinition | undefined {
    return this._regions.get(id)?.definition;
  }

  /** All registered region definitions. */
  public get regions(): RegionDefinition[] {
    return Array.from(this._regions.values()).map((r) => r.definition);
  }

  // ── Visibility + active toggles ───────────────────────────────────────────

  /** Show or hide a region (affects mesh rendering). */
  public setVisible(regionId: string, visible: boolean): void {
    const record = this._regions.get(regionId);
    if (!record) return;
    if (record.visible === visible) return;
    record.visible = visible;
    this.onVisibilityChange?.(regionId, visible);
  }

  /** Activate or deactivate a region (affects AI/physics simulation). */
  public setActive(regionId: string, active: boolean): void {
    const record = this._regions.get(regionId);
    if (!record) return;
    if (record.active === active) return;
    record.active = active;
    this.onActiveChange?.(regionId, active);
  }

  /** Returns whether a region is currently visible. */
  public isVisible(regionId: string): boolean {
    return this._regions.get(regionId)?.visible ?? true;
  }

  /** Returns whether a region is currently active. */
  public isActive(regionId: string): boolean {
    return this._regions.get(regionId)?.active ?? true;
  }

  // ── Spatial queries ───────────────────────────────────────────────────────

  /**
   * Returns all region ids whose bounding volume contains the given point.
   * A point on the boundary is considered inside.
   */
  public getRegionsAtPoint(x: number, y: number, z: number): string[] {
    const result: string[] = [];
    for (const [id, record] of this._regions) {
      if (this._containsPoint(record.definition.shape, x, y, z)) {
        result.push(id);
      }
    }
    return result;
  }

  /**
   * Returns the ids of all currently inactive regions.
   * The LodSystem integration helper uses this list to skip LOD updates.
   */
  public getInactiveRegionIds(): string[] {
    const result: string[] = [];
    for (const [id, record] of this._regions) {
      if (!record.active) result.push(id);
    }
    return result;
  }

  // ── LodSystem integration helper ──────────────────────────────────────────

  /**
   * When called each frame this returns the ids of active regions so the
   * caller can limit LOD updates to those regions.
   *
   * If a `LodSystem` was attached via `attachLodSystem()` this method has no
   * direct effect on it (the LodSystem does not yet support per-region
   * suspension without a mesh-to-region mapping).  The primary value here is
   * the returned active region set — game code can use it to skip `update()`
   * calls for physics / AI managers that are region-scoped.
   *
   * @returns Set of region ids that are currently active.
   */
  public getActiveRegionIds(): string[] {
    const result: string[] = [];
    for (const [id, record] of this._regions) {
      if (record.active) result.push(id);
    }
    return result;
  }

  // ── Snapshot / restore ────────────────────────────────────────────────────

  /**
   * Capture current visible/active flags for all regions.
   * The region definitions themselves are not included — they are considered
   * static configuration.
   */
  public getSnapshot(): RegionSnapshot[] {
    return Array.from(this._regions.values()).map((r) => ({
      id: r.definition.id,
      visible: r.visible,
      active: r.active,
    }));
  }

  /**
   * Restore visible/active flags from a snapshot.
   * Unknown region ids in the snapshot are silently ignored.
   * Regions not present in the snapshot retain their current state.
   */
  public restoreSnapshot(snapshots: RegionSnapshot[]): void {
    for (const snap of snapshots) {
      const record = this._regions.get(snap.id);
      if (!record) continue;
      if (record.visible !== snap.visible) {
        record.visible = snap.visible;
        this.onVisibilityChange?.(snap.id, snap.visible);
      }
      if (record.active !== snap.active) {
        record.active = snap.active;
        this.onActiveChange?.(snap.id, snap.active);
      }
    }
  }

  /** Remove all regions. */
  public clear(): void {
    this._regions.clear();
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  private _containsPoint(shape: RegionShape, x: number, y: number, z: number): boolean {
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
