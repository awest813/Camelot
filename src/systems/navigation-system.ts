import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { RecastJSPlugin } from "@babylonjs/core/Navigation/Plugins/recastJSPlugin";
import { INavMeshParameters } from "@babylonjs/core/Navigation/INavigationEngine";

/**
 * Recast/Detour navmesh parameters tuned for a humanoid-scale RPG world.
 *
 * cs / ch    — voxel resolution (smaller = more accurate, more expensive)
 * walkable*  — agent shape / terrain constraints
 * maxEdgeLen — maximum polygon edge length in the simplified mesh
 */
const NAV_PARAMS: INavMeshParameters = {
  cs: 0.3,
  ch: 0.2,
  walkableSlopeAngle: 35,
  walkableHeight: 2,       // voxels of clear headroom required
  walkableClimb: 0.5,      // max step height an agent can climb
  walkableRadius: 0.5,     // NPC capsule radius in world units
  maxEdgeLen: 12,
  maxSimplificationError: 1.3,
  minRegionArea: 8,
  mergeRegionArea: 20,
  maxVertsPerPoly: 6,
  detailSampleDist: 6,
  detailSampleMaxError: 1,
};

/**
 * NavigationSystem — Recast/Detour integration for NPC pathfinding.
 *
 * Wraps Babylon.js's RecastJSPlugin which itself is a thin TypeScript
 * binding over the recast-detour WebAssembly port of the C++ Recast/Detour
 * navigation-mesh library (https://github.com/recastnavigation/recastnavigation).
 *
 * Lifecycle
 * ---------
 * 1. Construction kicks off async WASM loading (non-blocking).
 * 2. Once loaded, the plugin builds an initial navmesh from any already-loaded
 *    ground chunk meshes.
 * 3. When terrain changes (new chunks load), call requestRebuild(). The rebuild
 *    is debounced by REBUILD_DELAY seconds so rapid chunk loads don't spam Recast.
 * 4. Call update(deltaTime) every frame to tick the debounce timer.
 * 5. NPCs use findPath(from, to) → Vector3[] to get a list of waypoints; they
 *    then follow the waypoints via their existing physics-based movement code.
 *    If the plugin is not yet ready, findPath returns [] and the caller should
 *    fall back to direct line movement.
 */
export class NavigationSystem {
  private _plugin: RecastJSPlugin | null = null;
  private _scene: Scene;
  private _ready: boolean = false;

  // Debounced rebuild state
  private _rebuildPending: boolean = false;
  private _rebuildTimer: number = 0;

  /**
   * Seconds of inactivity after requestRebuild() before the navmesh is actually
   * rebuilt. Prevents rebuilding dozens of times as multiple chunks load at once.
   */
  private static readonly REBUILD_DELAY = 2.0;

  constructor(scene: Scene) {
    this._scene = scene;
    this._init();
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * True once Recast/Detour is loaded and a navmesh has been successfully built.
   * NPCs should fall back to direct-line movement when this is false.
   */
  public get isReady(): boolean {
    return this._ready;
  }

  /**
   * Build (or rebuild) the navigation mesh from the given ground meshes.
   * Only call this when the mesh collection has settled — prefer requestRebuild()
   * to let the debounce handle timing automatically.
   */
  public buildNavMesh(groundMeshes: Mesh[]): void {
    if (!this._plugin || groundMeshes.length === 0) return;
    try {
      this._plugin.createNavMesh(groundMeshes, NAV_PARAMS);
      this._ready = true;
      console.log(`[Nav] Navmesh built from ${groundMeshes.length} ground mesh(es).`);
    } catch (e) {
      console.warn("[Nav] createNavMesh failed:", e);
      this._ready = false;
    }
  }

  /**
   * Request a navmesh rebuild after terrain has changed (e.g. new chunk loaded).
   * The actual rebuild fires REBUILD_DELAY seconds after the last call, so calling
   * this every frame while chunks load is safe.
   */
  public requestRebuild(): void {
    this._rebuildPending = true;
    this._rebuildTimer = 0;
  }

  /**
   * Compute a world-space path between two positions using the navmesh.
   *
   * @returns Array of Vector3 waypoints from `from` to `to`, or [] when the
   *          navmesh is not ready or the query fails (caller should use direct
   *          line movement as fallback).
   */
  public findPath(from: Vector3, to: Vector3): Vector3[] {
    if (!this._ready || !this._plugin) return [];
    try {
      return this._plugin.computePath(from, to) ?? [];
    } catch {
      return [];
    }
  }

  /**
   * Snap an arbitrary world position onto the nearest point on the navmesh.
   * Useful for clamping NPC spawn positions or target waypoints to walkable area.
   * Falls back to the original position when the navmesh is not ready.
   */
  public getClosestPoint(position: Vector3): Vector3 {
    if (!this._ready || !this._plugin) return position.clone();
    try {
      return this._plugin.getClosestPoint(position) ?? position.clone();
    } catch {
      return position.clone();
    }
  }

  /**
   * Collect all currently-loaded ground chunk meshes from the scene.
   * WorldManager names ground chunks "chunk_<x>,<z>", so this filters by prefix.
   */
  public collectGroundMeshes(): Mesh[] {
    return this._scene.meshes.filter(
      m => m.name.startsWith("chunk_") && !m.isDisposed()
    ) as Mesh[];
  }

  /**
   * Per-frame tick — handles the debounced navmesh rebuild.
   * Must be called once per frame from Game.update().
   */
  public update(deltaTime: number): void {
    if (!this._plugin || !this._rebuildPending) return;
    this._rebuildTimer += deltaTime;
    if (this._rebuildTimer >= NavigationSystem.REBUILD_DELAY) {
      this._rebuildPending = false;
      this._rebuildTimer = 0;
      this.buildNavMesh(this.collectGroundMeshes());
    }
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  /**
   * Asynchronously load the recast-detour WASM module and initialise the plugin.
   *
   * Uses a dynamic import so the rest of the game initialises synchronously and
   * pathfinding becomes available in the background. If the package is absent
   * (e.g. `npm install` not yet run) the warning is logged and NPCs silently use
   * direct-line movement as a fallback.
   *
   * To enable: `npm install recast-detour`
   * npm: https://www.npmjs.com/package/recast-detour
   */
  private async _init(): Promise<void> {
    try {
      // recast-detour is a WASM port of the Recast/Detour C++ navigation library,
      // packaged specifically for use with Babylon.js's RecastJSPlugin.
      const { default: Recast } = await import("recast-detour");
      const recast = await Recast();
      this._plugin = new RecastJSPlugin(recast);
      console.log("[Nav] Recast/Detour plugin ready.");

      // Attempt an initial navmesh build from whatever chunks are already loaded.
      const meshes = this.collectGroundMeshes();
      if (meshes.length > 0) {
        this.buildNavMesh(meshes);
      } else {
        // Schedule a rebuild once the world has had time to generate its first chunks.
        this.requestRebuild();
      }
    } catch (e) {
      console.warn(
        "[Nav] recast-detour unavailable — install with `npm install recast-detour`.\n" +
        "      NPCs will use direct line-of-sight movement as fallback.",
        e
      );
    }
  }
}
