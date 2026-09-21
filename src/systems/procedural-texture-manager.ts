import { Scene } from "@babylonjs/core/scene";
import { RawTexture } from "@babylonjs/core/Materials/Textures/rawTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import type { BiomeType } from "../world/world-manager";
import type { TextureConfig } from "./graphics-system";

export type StructureTextureType =
  | "stone_ruins"
  | "desert_sandstone"
  | "watchtower_timber"
  | "bark_timber"
  | "mossy_stone"
  | "foliage_canopy"
  | "iron_metal";
export type TextureResolution = 64 | 128 | 256;

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
  public defaultResolution: TextureResolution;
  public anisotropicFiltering: number;
  public generateMipMaps: boolean;

  constructor(scene: Scene, config?: Partial<TextureConfig>) {
    this._scene = scene;
    this.defaultResolution = config?.resolution ?? 128;
    this.anisotropicFiltering = config?.anisotropicFiltering ?? 4;
    this.generateMipMaps = config?.mipmaps ?? true;
  }

  /**
   * Get or create a tileable procedural ground texture for a given biome.
   */
  public getBiomeTexture(biome: BiomeType, resolution: TextureResolution = this.defaultResolution): RawTexture | null {
    if (!this._scene || typeof (this._scene as any).getEngine !== "function") return null;

    const key = `biome_${biome}_${resolution}`;
    let tex = this._textures.get(key);
    if (tex) return tex;

    const data = this._generateBiomeBuffer(biome, resolution);
    tex = RawTexture.CreateRGBATexture(
      data,
      resolution,
      resolution,
      this._scene,
      this.generateMipMaps,
      false, // invertY
      Texture.TRILINEAR_SAMPLINGMODE,
    );
    tex.wrapU = Texture.WRAP_ADDRESSMODE;
    tex.wrapV = Texture.WRAP_ADDRESSMODE;
    if (this.anisotropicFiltering > 1) {
      tex.anisotropicFilteringLevel = this.anisotropicFiltering;
    }
    tex.name = `tex_${key}`;

    this._textures.set(key, tex);
    return tex;
  }

  /**
   * Get or create a tileable procedural material texture for structures.
   */
  public getStructureTexture(type: StructureTextureType, resolution: TextureResolution = this.defaultResolution): RawTexture | null {
    if (!this._scene || typeof (this._scene as any).getEngine !== "function") return null;

    const key = `struct_${type}_${resolution}`;
    let tex = this._textures.get(key);
    if (tex) return tex;

    const data = this._generateStructureBuffer(type, resolution);
    tex = RawTexture.CreateRGBATexture(
      data,
      resolution,
      resolution,
      this._scene,
      this.generateMipMaps,
      false,
      Texture.TRILINEAR_SAMPLINGMODE,
    );
    tex.wrapU = Texture.WRAP_ADDRESSMODE;
    tex.wrapV = Texture.WRAP_ADDRESSMODE;
    if (this.anisotropicFiltering > 1) {
      tex.anisotropicFilteringLevel = this.anisotropicFiltering;
    }
    tex.name = `tex_${key}`;

    this._textures.set(key, tex);
    return tex;
  }

  /**
   * Dispose all cached textures and free GPU memory.
   */
  public dispose(): void {
    for (const tex of this._textures.values()) {
      tex.dispose();
    }
    this._textures.clear();
  }

  // ── Procedural Buffer Generators ───────────────────────────────────────────

  private _generateBiomeBuffer(biome: BiomeType, size: number): Uint8Array {
    const buffer = new Uint8Array(size * size * 4);
    const twoPi = Math.PI * 2;

    for (let y = 0; y < size; y++) {
      const v = y / size;
      const sinV1 = Math.sin(v * twoPi);
      const cosV1 = Math.cos(v * twoPi);
      const sinV2 = Math.sin(v * twoPi * 3);
      const sinV4 = Math.sin(v * twoPi * 7);

      for (let x = 0; x < size; x++) {
        const u = x / size;
        const sinU1 = Math.sin(u * twoPi);
        const cosU1 = Math.cos(u * twoPi);
        const sinU2 = Math.sin(u * twoPi * 3);
        const sinU4 = Math.sin(u * twoPi * 7);

        // Multi-octave toroidal harmonic noise in [0, 1]
        const n1 = (sinU1 * cosV1 + cosU1 * sinV1) * 0.25 + 0.5;
        const n2 = (sinU2 * sinV2) * 0.15 + 0.15;
        const n3 = (sinU4 * sinV4) * 0.10 + 0.10;
        const noise = Math.min(1, Math.max(0, n1 + n2 + n3));

        // High frequency pseudo-random grain (seamless hash)
        const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        const grain = (h - Math.floor(h)) * 0.14;

        let r = 0;
        let g = 0;
        let b = 0;

        switch (biome) {
          case "plains": {
            // Vibrant grassy meadow with warm earth undertones and lush clover accents
            const factor = Math.min(1, Math.max(0, noise * 0.88 + grain * 0.9));
            r = Math.round(52  + factor * 38);
            g = Math.round(140 + factor * 55);
            b = Math.round(38  + factor * 28);
            break;
          }
          case "forest": {
            // Deep woodland moss, rich humus undertones, and dark leafy canopy speckles
            const factor = Math.min(1, Math.max(0, noise * 0.85 + grain * 1.15));
            r = Math.round(22 + factor * 28);
            g = Math.round(78 + factor * 40);
            b = Math.round(20 + factor * 24);
            break;
          }
          case "desert": {
            // Dune ripples with warm sunlit amber crests and granular quartz sparkle
            const ripple = Math.sin((u * 4 + v * 8) * twoPi) * 0.12;
            const factor = Math.min(1, Math.max(0, noise * 0.68 + ripple + grain * 0.85));
            r = Math.round(214 + factor * 36);
            g = Math.round(178 + factor * 32);
            b = Math.round(102 + factor * 26);
            break;
          }
          case "tundra": {
            // Frosted snow crust with subtle sub-surface glacial ice veining
            const vein = Math.abs(Math.sin((u * 3 - v * 3) * twoPi)) * 0.14;
            const factor = Math.min(1, Math.max(0, noise * 0.62 + vein + grain * 0.55));
            r = Math.round(218 + factor * 32);
            g = Math.round(230 + factor * 24);
            b = Math.round(244 + factor * 11);
            break;
          }
        }

        const idx = (y * size + x) * 4;
        buffer[idx]     = Math.min(255, Math.max(0, r));
        buffer[idx + 1] = Math.min(255, Math.max(0, g));
        buffer[idx + 2] = Math.min(255, Math.max(0, b));
        buffer[idx + 3] = 255;
      }
    }

    return buffer;
  }

  private _generateStructureBuffer(type: StructureTextureType, size: number): Uint8Array {
    const buffer = new Uint8Array(size * size * 4);
    const twoPi = Math.PI * 2;

    for (let y = 0; y < size; y++) {
      const v = y / size;
      for (let x = 0; x < size; x++) {
        const u = x / size;

        // Periodic seamless grain
        const h = Math.sin(x * 9.123 + y * 41.567) * 28734.123;
        const grain = (h - Math.floor(h)) * 0.15;

        let r = 0;
        let g = 0;
        let b = 0;

        if (type === "stone_ruins") {
          // Weathered stone blocks with defined mortar lines
          const brickY = Math.floor(v * 8);
          const brickX = Math.floor(u * 8 + (brickY % 2 === 0 ? 0 : 0.5));
          const fracX = (u * 8 + (brickY % 2 === 0 ? 0 : 0.5)) - brickX;
          const fracY = v * 8 - brickY;
          const isMortar = fracX < 0.075 || fracY < 0.075;

          if (isMortar) {
            r = Math.round(66 + grain * 28);
            g = Math.round(62 + grain * 24);
            b = Math.round(54 + grain * 20);
          } else {
            const stoneNoise = Math.sin(u * twoPi * 4) * Math.cos(v * twoPi * 4) * 0.16;
            const factor = Math.min(1, Math.max(0, 0.5 + stoneNoise + grain));
            r = Math.round(118 + factor * 38);
            g = Math.round(112 + factor * 34);
            b = Math.round(96  + factor * 28);
          }
        } else if (type === "desert_sandstone") {
          // Layered sedimentary sandstone with geological strata
          const layer = Math.sin(v * twoPi * 6 + Math.sin(u * twoPi * 2) * 0.5) * 0.16;
          const factor = Math.min(1, Math.max(0, 0.5 + layer + grain * 0.8));
          r = Math.round(198 + factor * 36);
          g = Math.round(154 + factor * 26);
          b = Math.round(98  + factor * 22);
        } else if (type === "watchtower_timber") {
          // Watchtower timber: warm directional wood grain along V axis
          const grainLine = Math.sin(u * twoPi * 12) * 0.22;
          const factor = Math.min(1, Math.max(0, 0.5 + grainLine + grain));
          r = Math.round(98  + factor * 32);
          g = Math.round(64  + factor * 26);
          b = Math.round(38  + factor * 16);
        } else if (type === "bark_timber") {
          // Organic tree bark: furrowed vertical grain
          const furrow = Math.sin(u * twoPi * 16 + Math.sin(v * twoPi * 4) * 0.75) * 0.32;
          const factor = Math.min(1, Math.max(0, 0.45 + furrow + grain));
          r = Math.round(76 + factor * 42);
          g = Math.round(46 + factor * 32);
          b = Math.round(26 + factor * 22);
        } else if (type === "mossy_stone") {
          // Weathered stone with organic creeping moss patches
          const stoneNoise = Math.sin(u * twoPi * 3) * Math.cos(v * twoPi * 3) * 0.20;
          const mossThreshold = Math.sin(u * twoPi * 2 + v * twoPi * 2) * 0.5 + 0.5;
          if (mossThreshold > 0.52) {
            const factor = Math.min(1, Math.max(0, 0.5 + stoneNoise + grain));
            r = Math.round(44 + factor * 36);
            g = Math.round(88 + factor * 48);
            b = Math.round(30 + factor * 26);
          } else {
            const factor = Math.min(1, Math.max(0, 0.5 + stoneNoise + grain));
            r = Math.round(88 + factor * 36);
            g = Math.round(88 + factor * 36);
            b = Math.round(82 + factor * 32);
          }
        } else if (type === "foliage_canopy") {
          // Stippled needle and leaf clusters
          const cluster1 = Math.sin(u * twoPi * 8) * Math.cos(v * twoPi * 8) * 0.22;
          const cluster2 = Math.sin((u + v) * twoPi * 14) * 0.16;
          const factor = Math.min(1, Math.max(0, 0.45 + cluster1 + cluster2 + grain * 1.2));
          r = Math.round(26 + factor * 36);
          g = Math.round(88 + factor * 58);
          b = Math.round(22 + factor * 28);
        } else {
          // Iron metal: brushed cold metal with subtle highlight sheen
          const brush = Math.sin(v * twoPi * 32) * 0.09;
          const mottle = (Math.sin(u * twoPi * 4) + Math.cos(v * twoPi * 4)) * 0.10;
          const factor = Math.min(1, Math.max(0, 0.5 + brush + mottle + grain * 0.6));
          r = Math.round(78 + factor * 36);
          g = Math.round(82 + factor * 36);
          b = Math.round(90 + factor * 42);
        }

        const idx = (y * size + x) * 4;
        buffer[idx]     = Math.min(255, Math.max(0, r));
        buffer[idx + 1] = Math.min(255, Math.max(0, g));
        buffer[idx + 2] = Math.min(255, Math.max(0, b));
        buffer[idx + 3] = 255;
      }
    }

    return buffer;
  }
}
