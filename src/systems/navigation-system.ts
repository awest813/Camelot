import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { RecastJSPlugin } from "@babylonjs/core/Navigation/Plugins/recastJSPlugin";
import { buildNavmeshData, geometryFromMeshes, isNavObstacle, loadRecast, type RecastModule } from "./navmesh-build";
import type { NavBuildReply, NavBuildRequest } from "./navmesh.worker";

/** On unless the build turns it off (`VITE_ENABLE_NAVMESH=false`); unit tests opt in. */
const NAVMESH_ENABLED = import.meta.env.VITE_ENABLE_NAVMESH !== "false" && import.meta.env.MODE !== "test";

/**
 * NavigationSystem — Recast/Detour navmesh for NPC pathfinding.
 *
 * The navmesh covers the loaded area: every ground chunk plus the meshes
 * marked as obstacles (building walls, the village well; see
 * `navmesh-build.ts`), so paths go around buildings and in through their
 * doorways.  Recast builds it in tiles.
 *
 * Lifecycle
 * ---------
 * 1. When chunks load or unload, call `requestRebuild()`.  The rebuild is
 *    debounced (REBUILD_DELAY) so a burst of chunk loads builds once.
 * 2. The build runs in a worker (`navmesh.worker.ts`): the geometry goes
 *    over, the serialized navmesh comes back, and the main thread loads it.
 *    Without workers (Node) it builds in place.
 * 3. Recast (recast-detour) is loaded lazily, after boot, in the worker and
 *    here (to load built navmeshes and answer path queries).
 * 4. `findPath(from, to)` returns waypoints, or [] until the first navmesh
 *    is in (callers fall back to walking straight).
 */
export class NavigationSystem {
  private _plugin: RecastJSPlugin | null = null;
  private _recast: RecastModule | null = null;
  private readonly _scene: Scene;
  private readonly _enabled: boolean;
  private _ready = false;
  private _worker: Worker | null = null;
  private _buildId = 0;
  /** A finished build that arrived before Recast loaded on this thread. */
  private _pendingData: Uint8Array | null = null;
  private _loading: Promise<void> | null = null;

  // Debounced rebuild state
  private _rebuildPending = false;
  private _rebuildTimer = 0;

  /** Seconds after the last `requestRebuild()` before the navmesh rebuilds. */
  private static readonly REBUILD_DELAY = 2.0;

  /** How many navmeshes have been loaded (tests and the debug overlay read it). */
  public builds = 0;

  constructor(scene: Scene, opts: { enabled?: boolean } = {}) {
    this._scene = scene;
    this._enabled = opts.enabled ?? NAVMESH_ENABLED;
    if (this._enabled) this.requestRebuild();
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /** True once a navmesh is loaded; until then callers walk straight. */
  public get isReady(): boolean {
    return this._ready;
  }

  /** Load Recast on this thread (queries and loading built navmeshes need it). */
  public load(): Promise<void> {
    this._loading ??= (async () => {
      const { default: Recast } = await import("recast-detour");
      this._recast = (await loadRecast(Recast)) as RecastModule;
      this._plugin = new RecastJSPlugin(this._recast);
      if (this._pendingData) this._apply(this._pendingData);
    })().catch((e) => {
      console.warn("[Nav] recast-detour failed to load; NPCs walk straight.", e);
    });
    return this._loading;
  }

  /** The meshes the navmesh is built from: the ground chunks and the obstacles. */
  public collectInputMeshes(): AbstractMesh[] {
    return this._scene.meshes.filter((m) => !m.isDisposed() && (m.name.startsWith("chunk_") || isNavObstacle(m)));
  }

  /**
   * Build now from `meshes`, on this thread (Recast must be loaded).  The
   * game builds through the worker; this is for tools and tests.
   */
  public buildNow(meshes: readonly AbstractMesh[] = this.collectInputMeshes()): boolean {
    if (!this._recast || meshes.length === 0) return false;
    this._apply(buildNavmeshData(this._recast, geometryFromMeshes(meshes)));
    return true;
  }

  /** Rebuild soon (terrain or obstacles changed). Safe to call every frame. */
  public requestRebuild(): void {
    if (!this._enabled) return;
    this._rebuildPending = true;
    this._rebuildTimer = 0;
  }

  /** Waypoints from `from` to `to` on the navmesh, or [] when there is none yet. */
  public findPath(from: Vector3, to: Vector3): Vector3[] {
    if (!this._ready || !this._plugin) return [];
    try {
      return this._plugin.computePath(from, to) ?? [];
    } catch {
      return [];
    }
  }

  /** The nearest navmesh point to `position` (the position itself when there is no navmesh). */
  public getClosestPoint(position: Vector3): Vector3 {
    if (!this._ready || !this._plugin) return position.clone();
    try {
      return this._plugin.getClosestPoint(position) ?? position.clone();
    } catch {
      return position.clone();
    }
  }

  /** Per-frame tick: runs the debounced rebuild. */
  public update(deltaTime: number): void {
    if (!this._enabled || !this._rebuildPending) return;
    this._rebuildTimer += deltaTime;
    if (this._rebuildTimer < NavigationSystem.REBUILD_DELAY) return;
    this._rebuildPending = false;
    this._rebuildTimer = 0;
    this._startBuild();
  }

  public dispose(): void {
    this._worker?.terminate();
    this._worker = null;
    this._plugin?.dispose();
    this._plugin = null;
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private _startBuild(): void {
    const meshes = this.collectInputMeshes();
    if (meshes.length === 0) { this.requestRebuild(); return; }
    void this.load();
    const geometry = geometryFromMeshes(meshes);
    const id = ++this._buildId;
    const worker = this._ensureWorker();
    if (!worker) {
      // No workers here: build in place once Recast is loaded.
      void this.load().then(() => {
        if (id === this._buildId && this._recast) this._apply(buildNavmeshData(this._recast, geometry));
      });
      return;
    }
    worker.postMessage({ id, geometry } satisfies NavBuildRequest, [geometry.positions.buffer, geometry.indices.buffer]);
  }

  private _ensureWorker(): Worker | null {
    if (this._worker || typeof Worker === "undefined") return this._worker;
    try {
      this._worker = new Worker(new URL("./navmesh.worker.ts", import.meta.url), { type: "module" });
      this._worker.onmessage = (e: MessageEvent<NavBuildReply>) => {
        const reply = e.data;
        if (reply.id !== this._buildId) return; // a newer build is on its way
        if ("error" in reply) { console.warn("[Nav] navmesh build failed:", reply.error); return; }
        if (this._plugin) this._apply(reply.data);
        else this._pendingData = reply.data;
      };
    } catch (e) {
      console.warn("[Nav] navmesh worker unavailable; building on the main thread.", e);
      this._worker = null;
    }
    return this._worker;
  }

  private _apply(data: Uint8Array): void {
    this._pendingData = null;
    if (!this._plugin) { this._pendingData = data; return; }
    try {
      this._plugin.buildFromNavmeshData(data);
      this._ready = true;
      this.builds++;
    } catch (e) {
      console.warn("[Nav] loading the navmesh failed:", e);
    }
  }
}
