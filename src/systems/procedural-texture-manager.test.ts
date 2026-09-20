import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { ProceduralTextureManager } from "./procedural-texture-manager";
import type { BiomeType } from "../world/world-manager";

describe("ProceduralTextureManager", () => {
  let engine: NullEngine;
  let scene: Scene;
  let manager: ProceduralTextureManager;

  beforeEach(() => {
    engine = new NullEngine();
    scene = new Scene(engine);
    manager = new ProceduralTextureManager(scene);
  });

  afterEach(() => {
    manager.dispose();
    scene.dispose();
    engine.dispose();
  });

  it("creates valid RawTextures for all biomes", () => {
    const biomes: BiomeType[] = ["plains", "forest", "desert", "tundra"];
    for (const biome of biomes) {
      const tex = manager.getBiomeTexture(biome, 64);
      expect(tex).toBeDefined();
      expect(tex!.wrapU).toBe(Texture.WRAP_ADDRESSMODE);
      expect(tex!.wrapV).toBe(Texture.WRAP_ADDRESSMODE);
      expect(tex!.name).toBe(`tex_biome_${biome}_64`);
    }
  });

  it("caches and reuses textures with the same key", () => {
    const tex1 = manager.getBiomeTexture("plains", 128);
    const tex2 = manager.getBiomeTexture("plains", 128);
    expect(tex1).toBe(tex2);
  });

  it("creates separate textures for different resolutions", () => {
    const tex64 = manager.getBiomeTexture("desert", 64);
    const tex128 = manager.getBiomeTexture("desert", 128);
    expect(tex64).not.toBe(tex128);
  });

  it("creates valid RawTextures for structure types", () => {
    const types = [
      "stone_ruins",
      "desert_sandstone",
      "watchtower_timber",
      "bark_timber",
      "mossy_stone",
      "foliage_canopy",
      "iron_metal",
    ] as const;
    for (const type of types) {
      const tex = manager.getStructureTexture(type, 64);
      expect(tex).toBeDefined();
      expect(tex!.wrapU).toBe(Texture.WRAP_ADDRESSMODE);
      expect(tex!.wrapV).toBe(Texture.WRAP_ADDRESSMODE);
      expect(tex!.name).toBe(`tex_struct_${type}_64`);
    }
  });

  it("disposes textures without error", () => {
    manager.getBiomeTexture("plains", 64);
    manager.getStructureTexture("stone_ruins", 64);
    expect(() => manager.dispose()).not.toThrow();
  });

  it("respects TextureConfig custom resolution and anisotropic filtering", () => {
    const customMgr = new ProceduralTextureManager(scene, {
      resolution: 256,
      anisotropicFiltering: 8,
      mipmaps: true,
    });
    const tex = customMgr.getBiomeTexture("tundra");
    expect(tex).toBeDefined();
    expect(tex!.name).toBe("tex_biome_tundra_256");
    expect(tex!.anisotropicFilteringLevel).toBe(8);
    customMgr.dispose();
  });
});
