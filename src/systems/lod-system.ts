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
 * Usage:
 *   ```ts
 *   const lod = new LodSystem();
 *   lod.register(treeMesh, 120);      // hide trees beyond 120 units
 *   lod.register(ruinMesh, 200);      // hide ruins beyond 200 units
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

    const alive: LodEntry[] = [];
    let culled = 0;

    for (const entry of this._entries) {
      if (entry.mesh.isDisposed()) continue; // drop disposed meshes
      alive.push(entry);

      const distSq = Vector3.DistanceSquared(entry.mesh.position, playerPosition);
      const cullSq  = entry.cullDistance * entry.cullDistance;
      const shouldCull = distSq > cullSq;
      entry.mesh.isVisible = !shouldCull;
      if (shouldCull) culled++;
    }

    this._entries = alive;
    return culled;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private _countCulled(): number {
    return this._entries.filter(e => !e.mesh.isDisposed() && !e.mesh.isVisible).length;
  }

  // ── Debug accessors ───────────────────────────────────────────────────────────

  /** Total number of currently tracked meshes (registered and not yet disposed). */
  public get entryCount(): number {
    return this._entries.filter(e => !e.mesh.isDisposed()).length;
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
    this._frameCounter = 0;
  }
}
