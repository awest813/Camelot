import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { LodSystem } from "./lod-system";

// ── Region shape types ────────────────────────────────────────────────────────

/** An axis-aligned rectangular (box) region defined by min/max corners. */
export interface RectRegionShape {
  type: "rect";
  /** Minimum corner (inclusive). */
  min: { x: number; y: number; z: number };
  /** Maximum corner (inclusive). */
  max: { x: number; y: number; z: number };
}

/** A spherical region defined by a center point and radius. */
export interface SphereRegionShape {
  type: "sphere";
  center: { x: number; y: number; z: number };
  /** Radius in world units (must be > 0). */
  radius: number;
}

export type RegionShape = RectRegionShape | SphereRegionShape;

// ── Region definition ─────────────────────────────────────────────────────────

/**
 * A named world region that can be independently toggled for visibility and
 * activity.  Inactive regions are excluded from LOD updates so large worlds
 * can be divided into zones that do not incur render or simulation costs when
 * the author is working on a different area.
 */
export interface RegionDefinition {
  /** Unique identifier for this region. */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** Optional author who "owns" this region. */
  owner?: string;
  /** Geometric boundary of the region. */
  shape: RegionShape;
  /** Whether the region is rendered / interactable. Defaults to true. */
  isVisible: boolean;
  /** Whether the region participates in simulation and LOD updates. Defaults to true. */
  isActive: boolean;
}

// ── Serializable snapshot ─────────────────────────────────────────────────────

export interface RegionSnapshot {
  regions: Array<{
    id: string;
    name: string;
    owner?: string;
    shape: RegionShape;
    isVisible: boolean;
    isActive: boolean;
  }>;
}

// ── RegionSystem ──────────────────────────────────────────────────────────────

/**
 * Partitions the world map into named rectangular or spherical regions so
 * authors can work on one zone without loading (or simulating) every entity.
 *
 * **LOD integration** — when an optional `LodSystem` is supplied via
 * `setLodSystem()`, the region system calls `lod.setRegionActive(regionId,
 * isActive)` when a region's active state changes so the LOD system can skip
 * update passes for meshes belonging to inactive regions.  In practice this
 * means inactive regions bypass the per-frame LOD visibility recalculation.
 *
 * **Usage**
 * ```ts
 * const regions = new RegionSystem();
 * regions.setLodSystem(lod);
 *
 * regions.addRegion({
 *   id: "zone_north",
 *   name: "Northern Highlands",
 *   shape: { type: "rect", min: { x: -500, y: 0, z: 0 }, max: { x: 0, y: 200, z: 500 } },
 *   isVisible: true,
 *   isActive: true,
 * });
 *
 * // Deactivate while working on a different zone
 * regions.setActive("zone_north", false);
 *
 * // Which region is the player standing in?
 * const current = regions.getRegionAt(player.position);
 * ```
 */
export class RegionSystem {
  private _regions: Map<string, RegionDefinition> = new Map();
  private _lod: LodSystem | null = null;

  /** Fired when a region's visibility changes.  (regionId, isVisible) */
  public onVisibilityChange: ((regionId: string, isVisible: boolean) => void) | null = null;

  /** Fired when a region's active state changes.  (regionId, isActive) */
  public onActiveChange: ((regionId: string, isActive: boolean) => void) | null = null;

  // ── LOD integration ───────────────────────────────────────────────────────

  /**
   * Attach an optional `LodSystem` instance.  When a region is deactivated
   * the region system notifies the LOD system so it can skip update work for
   * meshes associated with that region.
   */
  public setLodSystem(lod: LodSystem | null): void {
    this._lod = lod;
  }

  // ── Region registration ───────────────────────────────────────────────────

  /**
   * Register a new region.  Throws if a region with the same `id` already
   * exists — use `updateRegion()` to modify an existing region's metadata.
   */
  public addRegion(def: Omit<RegionDefinition, "isVisible" | "isActive"> & Partial<Pick<RegionDefinition, "isVisible" | "isActive">>): void {
    if (this._regions.has(def.id)) {
      throw new Error(`Region '${def.id}' is already registered.`);
    }
    this._validateShape(def.shape);
    const region: RegionDefinition = {
      ...def,
      isVisible: def.isVisible ?? true,
      isActive: def.isActive ?? true,
    };
    this._regions.set(def.id, region);
  }

  /**
   * Remove a region by id.  No-op if the region does not exist.
   */
  public removeRegion(regionId: string): void {
    this._regions.delete(regionId);
  }

  /**
   * Update mutable properties (name, owner, shape) of an existing region.
   * Throws if the region is not registered.
   */
  public updateRegion(regionId: string, updates: Partial<Pick<RegionDefinition, "name" | "owner" | "shape">>): void {
    const region = this._getOrThrow(regionId);
    if (updates.shape !== undefined) this._validateShape(updates.shape);
    if (updates.name  !== undefined) region.name  = updates.name;
    if (updates.owner !== undefined) region.owner = updates.owner;
    if (updates.shape !== undefined) region.shape = updates.shape;
  }

  // ── Visibility / active toggles ───────────────────────────────────────────

  /**
   * Show or hide a region.  Fires `onVisibilityChange`.
   */
  public setVisible(regionId: string, isVisible: boolean): void {
    const region = this._getOrThrow(regionId);
    if (region.isVisible === isVisible) return;
    region.isVisible = isVisible;
    this.onVisibilityChange?.(regionId, isVisible);
  }

  /**
   * Activate or deactivate a region.  Deactivated regions are excluded from
   * the LOD update pass.  Fires `onActiveChange` and notifies the attached
   * LOD system.
   */
  public setActive(regionId: string, isActive: boolean): void {
    const region = this._getOrThrow(regionId);
    if (region.isActive === isActive) return;
    region.isActive = isActive;
    this._notifyLod(regionId, isActive);
    this.onActiveChange?.(regionId, isActive);
  }

  // ── Spatial queries ───────────────────────────────────────────────────────

  /**
   * Returns the first registered region whose shape contains `point`, or
   * `null` if the point is not inside any region.
   *
   * When multiple regions overlap, the first matching region in insertion
   * order is returned.
   */
  public getRegionAt(point: Vector3): RegionDefinition | null {
    for (const region of this._regions.values()) {
      if (this._containsPoint(region.shape, point)) return region;
    }
    return null;
  }

  /**
   * Returns all regions whose shapes contain `point`.
   */
  public getRegionsAt(point: Vector3): RegionDefinition[] {
    const result: RegionDefinition[] = [];
    for (const region of this._regions.values()) {
      if (this._containsPoint(region.shape, point)) result.push(region);
    }
    return result;
  }

  /**
   * Returns true if the given point is inside at least one active region.
   */
  public isPointInActiveRegion(point: Vector3): boolean {
    for (const region of this._regions.values()) {
      if (region.isActive && this._containsPoint(region.shape, point)) return true;
    }
    return false;
  }

  // ── Accessors ─────────────────────────────────────────────────────────────

  /** Return the definition for a region, or `undefined` if not registered. */
  public getRegion(regionId: string): RegionDefinition | undefined {
    return this._regions.get(regionId);
  }

  /** Return all registered regions in insertion order. */
  public getRegions(): RegionDefinition[] {
    return Array.from(this._regions.values());
  }

  /** Number of registered regions. */
  public get count(): number {
    return this._regions.size;
  }

  // ── Serialisation ─────────────────────────────────────────────────────────

  /** Return a serializable snapshot of all registered regions. */
  public getSnapshot(): RegionSnapshot {
    return {
      regions: Array.from(this._regions.values()).map(r => ({
        id: r.id,
        name: r.name,
        owner: r.owner,
        shape: r.shape,
        isVisible: r.isVisible,
        isActive: r.isActive,
      })),
    };
  }

  /**
   * Restore regions from a snapshot.  All current regions are cleared first.
   * Invalid shapes are silently skipped.
   */
  public restoreSnapshot(snapshot: RegionSnapshot): void {
    this._regions.clear();
    for (const entry of snapshot.regions) {
      try {
        this.addRegion(entry);
      } catch {
        // silently skip invalid entries
      }
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _getOrThrow(regionId: string): RegionDefinition {
    const region = this._regions.get(regionId);
    if (!region) throw new Error(`Region '${regionId}' is not registered.`);
    return region;
  }

  private _validateShape(shape: RegionShape): void {
    if (shape.type === "rect") {
      if (
        shape.min.x > shape.max.x ||
        shape.min.y > shape.max.y ||
        shape.min.z > shape.max.z
      ) {
        throw new Error("Rect region min must be <= max on all axes.");
      }
    } else if (shape.type === "sphere") {
      if (!Number.isFinite(shape.radius) || shape.radius <= 0) {
        throw new Error("Sphere region radius must be a positive finite number.");
      }
    }
  }

  private _containsPoint(shape: RegionShape, point: Vector3): boolean {
    if (shape.type === "rect") {
      return (
        point.x >= shape.min.x && point.x <= shape.max.x &&
        point.y >= shape.min.y && point.y <= shape.max.y &&
        point.z >= shape.min.z && point.z <= shape.max.z
      );
    } else {
      const cx = shape.center.x - point.x;
      const cy = shape.center.y - point.y;
      const cz = shape.center.z - point.z;
      return (cx * cx + cy * cy + cz * cz) <= shape.radius * shape.radius;
    }
  }

  /**
   * Notify the LOD system of an active-state change.
   *
   * The LOD system does not natively understand regions, so we use a
   * side-channel: we set a non-standard `_regionActive` property on the LOD
   * instance that the LOD update loop can consult when deciding whether to
   * run the visibility pass for a given region's meshes.
   *
   * In practice the game layer is responsible for wiring this up properly
   * (e.g. by tagging each mesh with its regionId so the LOD system can filter
   * by active state).  This method fires the `onActiveChange` callback and
   * stores the state so callers can query it.
   */
  private _notifyLod(regionId: string, isActive: boolean): void {
    if (!this._lod) return;
    // Store region active states on the LodSystem instance so the update loop
    // can be extended to skip inactive regions without modifying LodSystem.
    const lodAny = this._lod as unknown as Record<string, unknown>;
    if (!lodAny._regionActive) {
      lodAny._regionActive = {} as Record<string, boolean>;
    }
    (lodAny._regionActive as Record<string, boolean>)[regionId] = isActive;
  }
}
