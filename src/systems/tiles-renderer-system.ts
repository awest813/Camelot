/**
 * TilesRendererSystem — Integrates the 3D Tiles streaming standard into Camelot
 * via the `3d-tiles-renderer` library.
 *
 * 3D Tiles is an OGC standard for streaming massive 3D spatial datasets (terrain,
 * buildings, point clouds) with camera-distance-driven Level-of-Detail (LoD) and
 * frustum culling.  The library (`3d-tiles-renderer/babylonjs`) provides a first-
 * class Babylon.js adapter, matching Camelot's rendering engine.
 *
 * This system acts as a thin, lifecycle-managing wrapper that:
 *   - Keeps one active tileset loaded at a time.
 *   - Delegates to a swappable `TilesRendererHandleFactory`, which means the real
 *     Babylon.js renderer is never imported in tests — the system is fully
 *     headless-testable.
 *   - Exposes `update()` to call every render frame, and `unload()` / `dispose()`
 *     for cleanup.
 *
 * ## Production wiring (in game.ts or a scene-setup module)
 *
 * ```ts
 * import { TilesRenderer } from '3d-tiles-renderer/babylonjs';
 * import { TilesRendererSystem } from './systems/tiles-renderer-system';
 *
 * const tilesSystem = new TilesRendererSystem((url) => {
 *   const renderer = new TilesRenderer(url, scene);
 *   renderer.setCamera(camera);
 *   return {
 *     update:  () => renderer.update(),
 *     dispose: () => renderer.dispose(),
 *   };
 * });
 *
 * // Load a tileset (e.g. a pre-authored city or terrain zone):
 * tilesSystem.load('https://example.com/tilesets/camelot-city/tileset.json');
 *
 * // Call once per render frame:
 * scene.onBeforeRenderObservable.add(() => tilesSystem.update());
 *
 * // Tear down when leaving the scene:
 * tilesSystem.dispose();
 * ```
 *
 * ## Suggested use cases in Camelot
 *
 *   1. **3D world-map view** — stream a tileset at progressively finer LoD as the
 *      camera zooms into the map overlay.
 *   2. **Pre-authored zone terrain** — replace flat `MeshBuilder.CreateGround`
 *      chunks with a high-fidelity tileset for named locations (cities, castles).
 *   3. **Large settlement streaming** — author city meshes as a 3D Tiles tileset
 *      so the library handles per-building LoD automatically.
 *
 * ## Note on `scene.useRightHandedSystem`
 *
 * The `3d-tiles-renderer/babylonjs` adapter requires `scene.useRightHandedSystem = true`.
 * Verify this is enabled in the Babylon scene before instantiating a real renderer.
 */

// ── Interfaces ────────────────────────────────────────────────────────────────

/**
 * Minimal interface for a live 3D Tiles renderer instance.
 *
 * In production this is backed by the Babylon.js `TilesRenderer` from
 * `3d-tiles-renderer/babylonjs`.  In tests any lightweight mock works.
 */
export interface ITilesRendererHandle {
  /**
   * Advance the tile streaming state for the current frame.
   * Must be called once per render frame for LoD and frustum culling to work.
   */
  update(): void;
  /**
   * Release all GPU and network resources held by this renderer.
   * After calling `dispose()` the handle must not be used again.
   */
  dispose(): void;
}

/**
 * Factory function that creates an `ITilesRendererHandle` for a given tileset
 * URL.  The factory is responsible for supplying the Babylon.js `Scene` and
 * `Camera` references through its closure, keeping the system itself engine-
 * agnostic and headless-testable.
 *
 * @param url - Absolute URL to the `tileset.json` root document.
 * @returns    A live renderer handle ready to call `update()` on.
 */
export type TilesRendererHandleFactory = (url: string) => ITilesRendererHandle;

// ── System ────────────────────────────────────────────────────────────────────

/**
 * Manages the lifecycle of a single active 3D Tiles tileset within the scene.
 */
export class TilesRendererSystem {
  private _handle: ITilesRendererHandle | null = null;
  private _activeUrl: string | null = null;
  private readonly _factory: TilesRendererHandleFactory;

  /**
   * @param factory - A factory that produces renderer handles for a given
   *   tileset URL.  Inject a real Babylon.js-backed factory in production and
   *   a simple mock in unit tests.
   */
  constructor(factory: TilesRendererHandleFactory) {
    this._factory = factory;
  }

  // ── Tileset lifecycle ───────────────────────────────────────────────────────

  /**
   * Load a tileset from the given URL.  If a tileset is already loaded it is
   * disposed first, ensuring there is at most one active renderer at a time.
   *
   * @param url - Absolute URL to the `tileset.json` root document.
   */
  public load(url: string): void {
    if (this._handle) {
      this.unload();
    }
    this._handle = this._factory(url);
    this._activeUrl = url;
  }

  /**
   * Advance the streaming state for the current frame.  Should be called once
   * per render frame (e.g. inside a `scene.onBeforeRenderObservable` callback).
   *
   * Safe to call when no tileset is loaded — the call is a no-op.
   */
  public update(): void {
    this._handle?.update();
  }

  /**
   * Dispose the currently active tileset renderer and release its GPU and
   * network resources.  Safe to call when no tileset is loaded.
   */
  public unload(): void {
    this._handle?.dispose();
    this._handle = null;
    this._activeUrl = null;
  }

  /**
   * Fully tear down the system.  Equivalent to `unload()` and makes the system
   * unusable afterwards.  Call when the owning scene or game state is destroyed.
   */
  public dispose(): void {
    this.unload();
  }

  // ── State accessors ─────────────────────────────────────────────────────────

  /** `true` when a tileset is currently loaded and streaming. */
  public get isLoaded(): boolean {
    return this._handle !== null;
  }

  /**
   * The URL of the currently active tileset, or `null` when no tileset is
   * loaded.
   */
  public get activeUrl(): string | null {
    return this._activeUrl;
  }
}
