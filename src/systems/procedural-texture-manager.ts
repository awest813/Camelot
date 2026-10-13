import { Scene } from "@babylonjs/core/scene";
import { RawTexture } from "@babylonjs/core/Materials/Textures/rawTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { BiomeType } from "../world/world-manager";
import type { TextureConfig } from "./graphics-system";
import { synthesizeSurface, heightToNormalMap, type SurfaceKind, type SynthSurface } from "../rendering/texture-synth";

export type StructureTextureType =
  | "stone_ruins"
  | "desert_sandstone"
  | "watchtower_timber"
  | "bark_timber"
  | "mossy_stone"
  | "foliage_canopy"
  | "iron_metal";
export type TextureResolution = 64 | 128 | 256 | 512;

/**
 * ProceduralTextureManager — generates and caches headless-safe, tileable
 * procedural textures using Babylon's RawTexture.
 *
 * Uses pure TypedArrays (Uint8Array) with mathematical periodic functions
 * so that textures:
 *   1. Require 0 external image assets and 0 network requests.
 *   2. Run identically in Node/Vitest/JSDOM and browser WebGL/WebGPU.
 *   3. Tile seamlessly (toroidal boundary wrapping).
 *   4. Feature automatic mipmaps and trilinear filtering for zero shimmering.
 *   5. Consume minimal VRAM (< 500 KB across all biomes and structures).
 */
export class ProceduralTextureManager {
  private readonly _scene: Scene;
  private readonly _textures: Map<string, RawTexture> = new Map();
  private readonly _surfaces: Map<string, SynthSurface> = new Map();
  private readonly _views: Map<string, Texture> = new Map();
  /** Synthesize in a Web Worker when available (browser). */
  public useWorker = true;
  /** Attach normal maps in {@link applySurface}.  Off on the low tier. */
  public normalMaps: boolean;
  public defaultResolution: TextureResolution;
  public anisotropicFiltering: number;
  public generateMipMaps: boolean;

  constructor(scene: Scene, config?: Partial<TextureConfig>) {
    this._scene = scene;
    this.defaultResolution = config?.resolution ?? 128;
    this.anisotropicFiltering = config?.anisotropicFiltering ?? 4;
    this.generateMipMaps = config?.mipmaps ?? true;
    this.normalMaps = config?.normalMaps ?? true;
  }

  /**
   * Get or create a tileable procedural ground texture for a given biome.
   */
  public getBiomeTexture(biome: BiomeType, resolution: TextureResolution = this.defaultResolution): RawTexture | null {
    return this._get(`biome_${biome}`, BIOME_SURFACE[biome], resolution, false);
  }

  /**
   * Get or create a tileable procedural material texture for structures.
   */
  public getStructureTexture(type: StructureTextureType, resolution: TextureResolution = this.defaultResolution): RawTexture | null {
    return this._get(`struct_${type}`, type, resolution, false);
  }

  /**
   * Get or create any synthesized surface (albedo).  Cut-out surfaces
   * (`leaf_card`, `grass_blades`) carry their mask in the alpha channel.
   */
  public getSurfaceTexture(kind: SurfaceKind, resolution: TextureResolution = this.defaultResolution): RawTexture | null {
    return this._get(`surf_${kind}`, kind, resolution, false);
  }

  /**
   * Tangent-space normal map matching {@link getSurfaceTexture} /
   * {@link getBiomeTexture} / {@link getStructureTexture} for the same surface.
   * Alpha holds height (usable for parallax).
   */
  public getNormalTexture(kind: SurfaceKind | BiomeType, resolution: TextureResolution = this.defaultResolution): RawTexture | null {
    const surface = (BIOME_SURFACE as Record<string, SurfaceKind>)[kind] ?? (kind as SurfaceKind);
    return this._get(`normal_${surface}`, surface, resolution, true);
  }

  /**
   * A texture sharing `base`'s GPU storage with its own UV tiling.  Cached
   * textures are shared between materials, so callers must never mutate
   * `uScale`/`vScale` on them directly — that silently retiles every other
   * user of the surface.
   */
  public getView(base: RawTexture, uScale: number, vScale: number = uScale): Texture {
    if (uScale === 1 && vScale === 1) return base;
    const key = `${base.name}@${uScale}x${vScale}`;
    let view = this._views.get(key);
    if (view) return view;
    view = new Texture(null, this._scene, !this.generateMipMaps, false, Texture.TRILINEAR_SAMPLINGMODE);
    const internal = base.getInternalTexture();
    if (internal) {
      internal.incrementReferences();
      view._texture = internal;
    }
    view.name = key;
    view.wrapU = Texture.WRAP_ADDRESSMODE;
    view.wrapV = Texture.WRAP_ADDRESSMODE;
    view.uScale = uScale;
    view.vScale = vScale;
    view.hasAlpha = base.hasAlpha;
    view.anisotropicFilteringLevel = base.anisotropicFilteringLevel;
    this._views.set(key, view);
    return view;
  }

  /**
   * Dress a StandardMaterial with a synthesized surface: albedo, matching
   * normal map (when {@link normalMaps} is on) and a near-white tint derived
   * from the material's current diffuse colour so the texture — not a dark
   * multiplier — carries the albedo.
   */
  public applySurface(
    mat: StandardMaterial,
    kind: SurfaceKind | BiomeType,
    uScale = 1,
    vScale: number = uScale,
    opts: { tintStrength?: number; normals?: boolean } = {},
  ): boolean {
    const surface = (BIOME_SURFACE as Record<string, SurfaceKind>)[kind] ?? (kind as SurfaceKind);
    const albedo = this.getSurfaceTexture(surface);
    if (!albedo) return false;
    mat.diffuseTexture = this.getView(albedo, uScale, vScale);
    mat.diffuseColor = textureTint(mat.diffuseColor, opts.tintStrength ?? 0.3);
    if (opts.normals ?? this.normalMaps) {
      const nrm = this.getNormalTexture(surface);
      if (nrm) mat.bumpTexture = this.getView(nrm, uScale, vScale);
    }
    return true;
  }

  /**
   * Dispose all cached textures and free GPU memory.
   */
  public dispose(): void {
    for (const tex of this._textures.values()) {
      tex.dispose();
    }
    this._textures.clear();
    this._surfaces.clear();
    for (const view of this._views.values()) view.dispose();
    this._views.clear();
  }

  private _surface(kind: SurfaceKind, resolution: number): SynthSurface {
    const key = `${kind}_${resolution}`;
    let surf = this._surfaces.get(key);
    if (!surf) {
      surf = synthesizeSurface(kind, resolution);
      this._surfaces.set(key, surf);
    }
    return surf;
  }

  private _get(keyBase: string, kind: SurfaceKind, resolution: TextureResolution, normal: boolean): RawTexture | null {
    if (!this._scene || typeof (this._scene as any).getEngine !== "function") return null;

    const key = `${keyBase}_${resolution}`;
    let tex = this._textures.get(key);
    if (tex) return tex;

    // Off-thread when a worker is available: the texture is created now from a
    // cheap low-res preview and filled in when the full synthesis arrives.
    const async = this.useWorker && SynthWorkerPool.available();
    const hasAlpha = CUTOUT_KINDS.has(kind);
    let data: Uint8Array;
    if (async) {
      data = previewData(kind, resolution, normal);
    } else {
      const surf = this._surface(kind, resolution);
      data = normal ? heightToNormalMap(surf.height, resolution, surf.bumpStrength) : surf.albedo;
    }
    tex = RawTexture.CreateRGBATexture(
      data,
      resolution,
      resolution,
      this._scene,
      this.generateMipMaps,
      false, // invertY
      Texture.TRILINEAR_SAMPLINGMODE,
    );
    if (async) {
      const target = tex;
      void SynthWorkerPool.request(kind, resolution).then((res) => {
        if (!target.getInternalTexture()) return;
        target.update(normal ? res.normal : res.albedo);
      });
    }
    tex.wrapU = Texture.WRAP_ADDRESSMODE;
    tex.wrapV = Texture.WRAP_ADDRESSMODE;
    if (this.anisotropicFiltering > 1) {
      tex.anisotropicFilteringLevel = this.anisotropicFiltering;
    }
    if (!normal && hasAlpha) tex.hasAlpha = true;
    tex.name = `tex_${key}`;

    this._textures.set(key, tex);
    return tex;
  }
}

const CUTOUT_KINDS = new Set<SurfaceKind>(["leaf_card", "grass_blades", "palm_frond"]);

/** 16² synthesis upscaled (nearest) — a stand-in until the worker finishes. */
function previewData(kind: SurfaceKind, size: number, normal: boolean): Uint8Array {
  const out = new Uint8Array(size * size * 4);
  if (normal) {
    for (let i = 0; i < out.length; i += 4) { out[i] = 128; out[i + 1] = 128; out[i + 2] = 255; out[i + 3] = 128; }
    return out;
  }
  const p = 16;
  const small = synthesizeSurface(kind, p).albedo;
  const step = size / p;
  for (let y = 0; y < size; y++) {
    const sy = Math.floor(y / step);
    for (let x = 0; x < size; x++) {
      const si = (sy * p + Math.floor(x / step)) * 4;
      const di = (y * size + x) * 4;
      out[di] = small[si]; out[di + 1] = small[si + 1]; out[di + 2] = small[si + 2]; out[di + 3] = small[si + 3];
    }
  }
  return out;
}

interface SynthResult { albedo: Uint8Array; normal: Uint8Array }

/** One shared synthesis worker; requests for the same surface are shared. */
const SynthWorkerPool = {
  _worker: null as Worker | null,
  _failed: false,
  _nextId: 1,
  _pending: new Map<number, { resolve: (r: SynthResult) => void; kind: SurfaceKind; size: number }>(),
  _byKey: new Map<string, Promise<SynthResult>>(),

  available(): boolean {
    if (this._failed || typeof Worker === "undefined") return false;
    if (!this._worker) {
      try {
        this._worker = new Worker(new URL("../rendering/texture-synth.worker.ts", import.meta.url), { type: "module" });
        this._worker.onmessage = (ev: MessageEvent<{ id: number } & SynthResult>) => {
          const job = this._pending.get(ev.data.id);
          this._pending.delete(ev.data.id);
          job?.resolve(ev.data);
        };
        // If the worker dies, finish outstanding jobs on the main thread.
        this._worker.onerror = () => {
          this._failed = true;
          for (const [id, job] of this._pending) {
            this._pending.delete(id);
            const surf = synthesizeSurface(job.kind, job.size);
            job.resolve({ albedo: surf.albedo, normal: heightToNormalMap(surf.height, job.size, surf.bumpStrength) });
          }
        };
      } catch {
        this._failed = true;
        return false;
      }
    }
    return true;
  },

  request(kind: SurfaceKind, size: number): Promise<SynthResult> {
    const key = `${kind}_${size}`;
    let p = this._byKey.get(key);
    if (!p) {
      p = new Promise<SynthResult>((resolve) => {
        const id = this._nextId++;
        this._pending.set(id, { resolve, kind, size });
        this._worker!.postMessage({ id, kind, size, seed: 7 });
      });
      this._byKey.set(key, p);
    }
    return p;
  },
};

/** Ground surface synthesized for each biome. */
const BIOME_SURFACE: Record<BiomeType, SurfaceKind> = {
  plains: "grass",
  forest: "forest_floor",
  desert: "sand",
  tundra: "snow",
};

/**
 * Near-white tint that keeps `color`'s hue.  Legacy materials stored their
 * final albedo in `diffuseColor`; multiplying that by a full-colour texture
 * double-darkens it (dark bark × dark texture ≈ black).
 */
export function textureTint(color: Color3, strength = 0.3): Color3 {
  const m = Math.max(color.r, color.g, color.b, 1e-3);
  const t = Math.min(1, Math.max(0, strength));
  return new Color3(
    1 + (color.r / m - 1) * t,
    1 + (color.g / m - 1) * t,
    1 + (color.b / m - 1) * t,
  );
}
