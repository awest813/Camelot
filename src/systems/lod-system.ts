import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

export interface LodEntry {
  mesh: Mesh;
  /**
   * Distance beyond which the mesh is hidden (distance-culled).
   * Squared internally for performance.
   */
  cullDistance: number;
}

/**
 * A set of meshes representing the same object at decreasing levels of detail.
 * Levels must be supplied in ascending `maxDistance` order.
 *
 * Example for a tree:
 * ```ts
 * lod.registerLevels([
 *   { mesh: highPolyTree,  maxDistance: 40  },   // full detail within  40 u
 *   { mesh: medPolyTree,   maxDistance: 100 },   // medium detail 40–100 u
 *   { mesh: lowPolyTree,   maxDistance: 200 },   // billboard  100–200 u
 *   // beyond 200 u all meshes are hidden (distance-culled)
 * ]);
 * ```
 */
export interface LodLevel {
  /** One of the detail meshes for this object. */
  mesh: Mesh;
  /**
   * Maximum distance (in world units) at which this mesh should be visible.
   * When the player is further than the last level's `maxDistance`, all
   * meshes are hidden.
   */
  maxDistance: number;
}

/** Internal record for a multi-level LOD group. */
interface LodLevelEntry {
  levels: LodLevel[];
}

/**
 * Simple distance-based LOD / culling system for browser performance.
 *
 * The LOD model used here is conservative:
 *   - Each registered mesh has a `cullDistance`.
 *   - When the player is further than `cullDistance` from a mesh, the mesh is
 *     made invisible.  BabylonJS skips invisible meshes in the render pipeline,
 *     reducing draw calls and vertex throughput significantly for dense scenes.
 *   - Meshes are restored to visible when the player moves back inside the cull
 *     distance.
 *
 * Multi-level LOD:
 *   Use `registerLevels()` to associate multiple meshes (high/medium/low
 *   detail) with a single world object.  On each `update()` call the system
 *   shows only the appropriate detail level and hides the others, so
 *   polygon count decreases gracefully with distance rather than switching
 *   abruptly from full-detail to invisible.
 *
 * Usage:
 *   ```ts
 *   const lod = new LodSystem();
 *   lod.register(treeMesh, 120);      // hide trees beyond 120 units
 *   lod.register(ruinMesh, 200);      // hide ruins beyond 200 units
 *
 *   // Multi-level LOD:
 *   lod.registerLevels([
 *     { mesh: highMesh, maxDistance: 50  },
 *     { mesh: medMesh,  maxDistance: 120 },
 *     { mesh: lowMesh,  maxDistance: 250 },
 *   ]);
 *
 *   // In update loop:
 *   lod.update(player.camera.position);
 *   ```
 *
 * Performance notes:
 *   - `update()` runs the visibility pass only every `updateEveryNFrames` calls
 *     (default 5), amortising the cost across multiple frames.
 *   - Distance comparisons use squared distances to avoid expensive sqrt calls.
 *   - Disposed meshes are silently skipped and cleaned up on the next `update()`
 *     call.
 */
export class LodSystem {
  private _entries: LodEntry[] = [];
  private _levelGroups: LodLevelEntry[] = [];
  private _frameCounter: number = 0;
  private readonly _updateInterval: number;

  /**
   * @param updateEveryNFrames - How often (in frames) to run the visibility
   *   pass.  Higher values reduce CPU overhead at the cost of slightly delayed
   *   visibility transitions.  Defaults to 5.
   */
  constructor(updateEveryNFrames: number = 5) {
    this._updateInterval = Math.max(1, updateEveryNFrames);
  }

  /**
   * Register a mesh for distance-based culling.
   *
   * Duplicate registrations for the same mesh are silently ignored.
   *
   * @param mesh         - The mesh to manage.  Must not be disposed.
   * @param cullDistance - Distance in world units beyond which the mesh is
   *   hidden.  Must be a positive finite number; invalid values are clamped to 1.
   */
  public register(mesh: Mesh, cullDistance: number): void {
    if (this._entries.some(e => e.mesh === mesh)) return;
    const safeDist = Number.isFinite(cullDistance) && cullDistance > 0 ? cullDistance : 1;
    this._entries.push({ mesh, cullDistance: safeDist });
  }

  /**
   * Unregister a mesh and restore its visibility before removing it from the
   * tracking list.  Safe to call with a mesh that was never registered.
   */
  public unregister(mesh: Mesh): void {
    const idx = this._entries.findIndex(e => e.mesh === mesh);
    if (idx === -1) return;
    const entry = this._entries[idx];
    if (!entry.mesh.isDisposed()) entry.mesh.isVisible = true;
    this._entries.splice(idx, 1);
  }

  /**
   * Register a set of meshes representing the same world object at decreasing
   * levels of detail.
   *
   * `levels` must be provided in ascending `maxDistance` order.  On each
   * `update()` call only the mesh whose `maxDistance` band contains the current
   * player distance is made visible; all others are hidden.  When the player is
   * beyond the last level's `maxDistance`, every mesh is hidden (fully culled).
   *
   * Duplicate group registrations (same mesh array reference) are silently
   * ignored.
   *
   * @param levels  Array of `{ mesh, maxDistance }` from closest to furthest.
   */
  public registerLevels(levels: LodLevel[]): void {
    if (levels.length === 0) return;
    // Silently ignore if any mesh in the new group is already part of an existing group
    const newMeshes = new Set(levels.map(l => l.mesh));
    const alreadyTracked = this._levelGroups.some(g =>
      g.levels.some(l => newMeshes.has(l.mesh)),
    );
    if (alreadyTracked) return;
    this._levelGroups.push({ levels: [...levels] });
  }

  /**
   * Unregister a multi-level LOD group by its first mesh reference and restore
   * all mesh visibilities.  Safe to call with a mesh that was never registered.
   */
  public unregisterLevels(firstMesh: Mesh): void {
    const idx = this._levelGroups.findIndex(g => g.levels[0]?.mesh === firstMesh);
    if (idx === -1) return;
    for (const level of this._levelGroups[idx].levels) {
      if (!level.mesh.isDisposed()) level.mesh.isVisible = true;
    }
    this._levelGroups.splice(idx, 1);
  }

  /**
   * Run the distance-culling pass.  Should be called once per render frame.
   *
   * Returns the number of meshes currently culled (hidden) — useful for the
   * debug/performance overlay.
   *
   * Disposed meshes are pruned from the tracking list during the pass so they
   * do not accumulate over time.
   */
  public update(playerPosition: Vector3): number {
    if (++this._frameCounter % this._updateInterval !== 0) {
      return this._countCulled();
    }

    // ── Simple binary-cull entries ─────────────────────────────────────────
    const aliveEntries: LodEntry[] = [];
    let culled = 0;

    for (const entry of this._entries) {
      if (entry.mesh.isDisposed()) continue; // drop disposed meshes
      aliveEntries.push(entry);

      const distSq = Vector3.DistanceSquared(entry.mesh.position, playerPosition);
      const cullSq  = entry.cullDistance * entry.cullDistance;
      const shouldCull = distSq > cullSq;
      entry.mesh.isVisible = !shouldCull;
      if (shouldCull) culled++;
    }

    this._entries = aliveEntries;

    // ── Multi-level LOD groups ─────────────────────────────────────────────
    const aliveLevelGroups: LodLevelEntry[] = [];

    for (const group of this._levelGroups) {
      // Prune groups where every mesh has been disposed
      const anyAlive = group.levels.some(l => !l.mesh.isDisposed());
      if (!anyAlive) continue;
      aliveLevelGroups.push(group);

      // Use the first non-disposed mesh position as the object's origin
      const originMesh = group.levels.find(l => !l.mesh.isDisposed());
      if (!originMesh) continue;

      const distSq = Vector3.DistanceSquared(originMesh.mesh.position, playerPosition);

      // Find the first level whose maxDistance >= sqrt(distSq) — show it, hide
      // others.  Compare using squared values to avoid an expensive sqrt.
      let chosen = false;
      for (const level of group.levels) {
        if (level.mesh.isDisposed()) continue;
        if (!chosen && distSq <= level.maxDistance * level.maxDistance) {
          level.mesh.isVisible = true;
          chosen = true;
        } else {
          level.mesh.isVisible = false;
          culled++;
        }
      }

      // chosen=false means every level was out of range — meshes were already
      // hidden in the else branch above; no extra loop needed.
    }

    this._levelGroups = aliveLevelGroups;
    return culled;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private _countCulled(): number {
    let culled = this._entries.filter(e => !e.mesh.isDisposed() && !e.mesh.isVisible).length;
    for (const group of this._levelGroups) {
      culled += group.levels.filter(l => !l.mesh.isDisposed() && !l.mesh.isVisible).length;
    }
    return culled;
  }

  // ── Debug accessors ───────────────────────────────────────────────────────────

  /** Total number of currently tracked meshes (registered and not yet disposed). */
  public get entryCount(): number {
    const singles = this._entries.filter(e => !e.mesh.isDisposed()).length;
    const levels  = this._levelGroups.reduce(
      (sum, g) => sum + g.levels.filter(l => !l.mesh.isDisposed()).length,
      0,
    );
    return singles + levels;
  }

  /**
   * Restore visibility on all registered meshes and clear the registry.
   * Call when transitioning between cells so stale mesh references are released.
   */
  public clear(): void {
    for (const entry of this._entries) {
      if (!entry.mesh.isDisposed()) entry.mesh.isVisible = true;
    }
    this._entries = [];

    for (const group of this._levelGroups) {
      for (const level of group.levels) {
        if (!level.mesh.isDisposed()) level.mesh.isVisible = true;
      }
    }
    this._levelGroups = [];

    this._frameCounter = 0;
  }
}
