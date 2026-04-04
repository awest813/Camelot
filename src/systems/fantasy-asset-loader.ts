/**
 * FantasyAssetLoader — Async CDN model loading and instance management.
 *
 * Loads fantasy RPG assets from the BabylonJS Assets CDN and caches them for
 * instancing. Models are loaded in the background; callers register callbacks
 * that fire once the model is ready (or immediately if already cached).
 *
 * Asset sources:
 *   BabylonJS Assets CDN  — https://assets.babylonjs.com/meshes/
 *   Kenney NL / Quaternius — procedural fallbacks where required
 *
 * All loads are fire-and-forget. Failures are silent and the asset simply
 * remains unavailable; callers should always code a procedural fallback.
 */

import { Scene } from "@babylonjs/core/scene";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Quaternion } from "@babylonjs/core/Maths/math.vector";
import "@babylonjs/loaders/glTF";

// ── Asset catalogue ──────────────────────────────────────────────────────────

export type FantasyAssetKey =
  | "elfAnimated"     // Animated elf character — Oblivion-style humanoid NPC
  | "runeSword"       // Rune-inscribed longsword — high-tier loot
  | "frostAxe"        // Frost-enchanted axe — ice dungeon loot (Demos path)
  | "moltenDagger"    // Molten obsidian dagger — assassin loot
  | "mausoleum"       // Stone mausoleum — graveyard structure
  | "obelisk"         // Ancient obelisk — desert shrine / standing stone
  | "cottage"         // Thatched roof cottage — settlement structure
  | "inn"             // Roadside inn — settlement structure
  | "dragon"          // Dragon — rare world encounter
  | "hauntedHouse"    // Haunted house — ruins/fort structure variant
  | "village"         // Village scene — settlement cluster
  | "valleyVillage"   // Valley village with terrain — large settlement
  | "graveYardScene"; // Graveyard scene — cemetery near ruins

const CDN      = "https://assets.babylonjs.com/meshes/";
const CDN_DEMO = CDN + "Demos/weaponsDemo/meshes/";

/** CDN URL for each asset key. */
const ASSET_URLS: Record<FantasyAssetKey, string> = {
  elfAnimated:   CDN      + "Elf_allAnimations.gltf",
  // Weapons: confirmed at both root and Demos sub-path; use Demos path as primary
  runeSword:     CDN_DEMO + "runeSword.glb",
  frostAxe:      CDN_DEMO + "frostAxe.glb",
  moltenDagger:  CDN_DEMO + "moltenDagger.glb",
  mausoleum:     CDN      + "mausoleumLarge.glb",
  obelisk:       CDN      + "obelisk1.glb",
  cottage:       CDN      + "cottage.glb",
  inn:           CDN      + "inn.glb",
  dragon:        CDN      + "dragon.glb",
  hauntedHouse:  CDN      + "haunted_house.glb",
  village:       CDN      + "village.glb",
  valleyVillage: CDN      + "valleyvillage.glb",
  graveYardScene: CDN     + "graveyardScene.glb",
};

// ── Scale overrides (world-unit scale applied after load) ────────────────────

const ASSET_SCALE: Partial<Record<FantasyAssetKey, number>> = {
  elfAnimated:   1.0,
  mausoleum:     1.0,
  obelisk:       1.0,
  cottage:       1.0,
  inn:           1.0,
  dragon:        2.0,
  hauntedHouse:  1.0,
  village:       1.0,
  valleyVillage: 1.0,
  graveYardScene: 1.0,
};

// ── Internal state per asset ──────────────────────────────────────────────────

interface AssetEntry {
  rootMesh: AbstractMesh | null;
  allMeshes: AbstractMesh[];
  loaded: boolean;
  failed: boolean;
  pendingCallbacks: Array<(root: AbstractMesh | null, allMeshes: AbstractMesh[]) => void>;
}

// ── FantasyAssetLoader ────────────────────────────────────────────────────────

export class FantasyAssetLoader {
  private readonly _scene: Scene;
  private readonly _assets: Map<FantasyAssetKey, AssetEntry> = new Map();
  private _instanceCounter = 0;

  constructor(scene: Scene) {
    this._scene = scene;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Start loading the given asset keys in the background.
   * Safe to call multiple times — duplicate keys are ignored.
   */
  public preload(keys: FantasyAssetKey[]): void {
    for (const key of keys) {
      if (!this._assets.has(key)) {
        this._startLoad(key);
      }
    }
  }

  /**
   * Preload the full fantasy asset catalogue.
   * Call once at game startup so models are ready when the world generates.
   */
  public preloadAll(): void {
    this.preload(Object.keys(ASSET_URLS) as FantasyAssetKey[]);
  }

  /**
   * Register a callback to receive a cloned instance of the named asset.
   * If the asset is already loaded the callback fires synchronously.
   * If loading fails the callback receives `null`.
   *
   * @param key       Asset identifier
   * @param onReady   Called with the instance root mesh (or null on failure)
   */
  public getInstance(
    key: FantasyAssetKey,
    onReady: (root: AbstractMesh | null, allMeshes: AbstractMesh[]) => void,
  ): void {
    let entry = this._assets.get(key);
    if (!entry) {
      this._startLoad(key);
      entry = this._assets.get(key)!;
    }

    if (entry.loaded) {
      const instance = this._cloneAsset(key, entry);
      onReady(instance.root, instance.meshes);
    } else if (entry.failed) {
      onReady(null, []);
    } else {
      entry.pendingCallbacks.push(onReady);
    }
  }

  /**
   * Returns true if the asset has finished loading (successfully or not).
   */
  public isReady(key: FantasyAssetKey): boolean {
    const entry = this._assets.get(key);
    return !!entry && (entry.loaded || entry.failed);
  }

  /**
   * Returns true if the asset loaded successfully.
   */
  public isLoaded(key: FantasyAssetKey): boolean {
    const entry = this._assets.get(key);
    return !!entry && entry.loaded;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private _startLoad(key: FantasyAssetKey): void {
    const entry: AssetEntry = {
      rootMesh: null,
      allMeshes: [],
      loaded: false,
      failed: false,
      pendingCallbacks: [],
    };
    this._assets.set(key, entry);

    const url = ASSET_URLS[key];

    SceneLoader.ImportMeshAsync("", url, "", this._scene)
      .then((result) => {
        if (result.meshes.length === 0) {
          this._markFailed(key, entry);
          return;
        }

        const root = result.meshes[0];
        const scale = ASSET_SCALE[key] ?? 1.0;

        // Store as hidden template — instances will be cloned from this
        root.setEnabled(false);
        root.name = `__fantasy_template_${key}`;
        root.scaling = new Vector3(scale, scale, scale);

        entry.rootMesh = root;
        entry.allMeshes = result.meshes;
        entry.loaded = true;

        // Flush pending callbacks with a fresh clone each
        for (const cb of entry.pendingCallbacks) {
          const instance = this._cloneAsset(key, entry);
          cb(instance.root, instance.meshes);
        }
        entry.pendingCallbacks = [];
      })
      .catch(() => {
        this._markFailed(key, entry);
      });
  }

  private _markFailed(key: FantasyAssetKey, entry: AssetEntry): void {
    entry.failed = true;
    for (const cb of entry.pendingCallbacks) {
      cb(null, []);
    }
    entry.pendingCallbacks = [];
    console.warn(`[FantasyAssetLoader] Failed to load asset: ${key}`);
  }

  private _cloneAsset(
    key: FantasyAssetKey,
    entry: AssetEntry,
  ): { root: AbstractMesh | null; meshes: AbstractMesh[] } {
    if (!entry.rootMesh) return { root: null, meshes: [] };

    const id = ++this._instanceCounter;
    const cloned = entry.rootMesh.clone(`fantasy_${key}_${id}`, null);
    if (!cloned) return { root: null, meshes: [] };

    cloned.setEnabled(true);

    // Collect all cloned descendant meshes
    const descendants = cloned.getChildMeshes(false) as AbstractMesh[];
    return { root: cloned, meshes: [cloned, ...descendants] };
  }
}
