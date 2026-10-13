/**
 * terrain-material — one shared ground material for every chunk.
 *
 * A MaterialPluginBase on StandardMaterial (so lights, cascaded shadows, fog
 * and the post stack keep working) that:
 *   • blends grass / forest floor / sand / snow by a per-vertex biome-weight
 *     attribute, so biomes cross-fade instead of meeting at square seams;
 *   • samples in world space (no per-chunk UV tiling seams);
 *   • breaks up texture repetition with a second, rotated, larger-scale
 *     sample mixed by procedural macro noise, plus dry/dirt colour patches;
 *   • blends the matching normal maps and perturbs the lighting normal.
 */
import type { Scene } from "@babylonjs/core/scene";
import { MaterialPluginBase } from "@babylonjs/core/Materials/materialPluginBase";
import { MaterialDefines } from "@babylonjs/core/Materials/materialDefines";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { UniformBuffer } from "@babylonjs/core/Materials/uniformBuffer";
import type { BaseTexture } from "@babylonjs/core/Materials/Textures/baseTexture";
import type { Material } from "@babylonjs/core/Materials/material";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import type { BiomeType } from "../world/world-manager";
import type { ProceduralTextureManager } from "../systems/procedural-texture-manager";

/** Order of biome weights in the `terrainWeights` vertex attribute. */
export const TERRAIN_BIOME_ORDER: readonly BiomeType[] = ["plains", "forest", "desert", "tundra"];

const smooth = (e0: number, e1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/**
 * Biome blend weights (plains, forest, desert, tundra) at a world position.
 *
 * Chunk (cx, cz) is centred on (cx·size, cz·size).  Weights interpolate
 * between the four surrounding chunk centres, sharpened so each biome is
 * pure across most of its chunk and cross-fades over `blend` (fraction of a
 * chunk) around the shared edge.
 */
export function biomeWeightsAt(
  x: number,
  z: number,
  chunkSize: number,
  getBiome: (cx: number, cz: number) => BiomeType,
  blend = 0.45,
  out: [number, number, number, number] = [0, 0, 0, 0],
): [number, number, number, number] {
  const gx = x / chunkSize;
  const gz = z / chunkSize;
  const ix = Math.floor(gx);
  const iz = Math.floor(gz);
  const tx = smooth(0.5 - blend / 2, 0.5 + blend / 2, gx - ix);
  const tz = smooth(0.5 - blend / 2, 0.5 + blend / 2, gz - iz);
  out[0] = out[1] = out[2] = out[3] = 0;
  const add = (cx: number, cz: number, w: number) => {
    if (w <= 0) return;
    out[TERRAIN_BIOME_ORDER.indexOf(getBiome(cx, cz))] += w;
  };
  add(ix, iz, (1 - tx) * (1 - tz));
  add(ix + 1, iz, tx * (1 - tz));
  add(ix, iz + 1, (1 - tx) * tz);
  add(ix + 1, iz + 1, tx * tz);
  return out;
}

/** Write the `terrainWeights` attribute for a ground mesh in world space. */
export function applyTerrainWeights(
  mesh: Mesh,
  chunkSize: number,
  getBiome: (cx: number, cz: number) => BiomeType,
): void {
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
  if (!positions) return;
  const count = positions.length / 3;
  const weights = new Float32Array(count * 4);
  const w: [number, number, number, number] = [0, 0, 0, 0];
  const ox = mesh.position.x;
  const oz = mesh.position.z;
  for (let i = 0; i < count; i++) {
    biomeWeightsAt(positions[i * 3] + ox, positions[i * 3 + 2] + oz, chunkSize, getBiome, 0.45, w);
    weights.set(w, i * 4);
  }
  mesh.setVerticesData(TERRAIN_WEIGHTS_KIND, weights, false, 4);
}

export const TERRAIN_WEIGHTS_KIND = "terrainWeights";

class TerrainDefines extends MaterialDefines {
  TERRAIN = false;
}

const FRAGMENT_DEFINITIONS = `
#ifdef TERRAIN
varying vec4 vTerrainW;
uniform sampler2D tAlb0; uniform sampler2D tAlb1; uniform sampler2D tAlb2; uniform sampler2D tAlb3;
uniform sampler2D tNrm0; uniform sampler2D tNrm1; uniform sampler2D tNrm2; uniform sampler2D tNrm3;
float tHash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float tNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(tHash(i), tHash(i + vec2(1.0, 0.0)), u.x), mix(tHash(i + vec2(0.0, 1.0)), tHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
vec4 tSample4(sampler2D s, vec2 a, vec2 b, float m) { return mix(texture2D(s, a), texture2D(s, b), m); }
#endif
`;

const FRAGMENT_DIFFUSE = `
#ifdef TERRAIN
{
  vec2 wp = vPositionW.xz;
  vec2 uvA = wp * terrainScale;
  // Second sample: rotated ~37°, 0.41× scale — mixed by macro noise to hide tiling.
  vec2 uvB = mat2(0.799, -0.602, 0.602, 0.799) * wp * terrainScale * 0.41 + vec2(0.37, 0.71);
  float macro = tNoise(wp * 0.015) * 0.6 + tNoise(wp * 0.06) * 0.4;
  float m = smoothstep(0.3, 0.7, tNoise(wp * 0.04 + 13.0));
  vec4 w = vTerrainW / max(dot(vTerrainW, vec4(1.0)), 0.0001);
  vec3 alb = tSample4(tAlb0, uvA, uvB, m).rgb * w.x
           + tSample4(tAlb1, uvA, uvB, m).rgb * w.y
           + tSample4(tAlb2, uvA, uvB, m).rgb * w.z
           + tSample4(tAlb3, uvA, uvB, m).rgb * w.w;
  // Large-scale tonal variation.
  alb *= mix(0.88, 1.08, macro);
  // Sun-dried patches on grass, bare earth under the forest canopy.
  float dry = smoothstep(0.62, 0.85, macro) * w.x;
  alb = mix(alb, alb * vec3(1.12, 1.05, 0.82), dry * 0.25);
  float dirt = smoothstep(0.74, 0.88, tNoise(wp * 0.11 + 41.0)) * (w.x + w.y);
  alb = mix(alb, vec3(0.40, 0.32, 0.22) * (0.8 + 0.4 * tNoise(wp * 0.7)), dirt * 0.32);
  baseColor.rgb = alb;
  terrainMix = vec3(m, dirt, 0.0);
  terrainUVA = uvA; terrainUVB = uvB;
}
#endif
`;

const FRAGMENT_BEFORE_LIGHTS = `
#ifdef TERRAIN
{
  vec4 w = vTerrainW / max(dot(vTerrainW, vec4(1.0)), 0.0001);
  float m = terrainMix.x;
  vec3 n = (tSample4(tNrm0, terrainUVA, terrainUVB, m).xyz * w.x
          + tSample4(tNrm1, terrainUVA, terrainUVB, m).xyz * w.y
          + tSample4(tNrm2, terrainUVA, terrainUVB, m).xyz * w.z
          + tSample4(tNrm3, terrainUVA, terrainUVB, m).xyz * w.w) * 2.0 - 1.0;
  n.xy *= terrainBump * (1.0 - terrainMix.y * 0.5);
  // World-space UVs: tangent = +X, bitangent = +Z on (near-)flat ground.
  vec3 N = normalW;
  vec3 T = normalize(vec3(1.0, 0.0, 0.0) - N * N.x);
  vec3 B = cross(T, N);
  normalW = normalize(T * n.x - B * n.y + N * n.z);
}
#endif
`;

/** StandardMaterial plugin implementing the blended terrain surface. */
export class TerrainMaterialPlugin extends MaterialPluginBase {
  public albedo: (BaseTexture | null)[] = [null, null, null, null];
  public normals: (BaseTexture | null)[] = [null, null, null, null];
  /** World units → texture repeats (1 / tile size in metres). */
  public scale = 1 / 5.5;
  /** Normal-map strength. */
  public bump = 1.0;

  constructor(material: Material) {
    super(material, "Terrain", 200, new TerrainDefines());
    this._enable(true);
  }

  public override prepareDefines(defines: TerrainDefines): void {
    defines.TERRAIN = true;
  }

  public override isReadyForSubMesh(): boolean {
    for (const t of this.albedo) if (t && !t.isReady()) return false;
    for (const t of this.normals) if (t && !t.isReady()) return false;
    return true;
  }

  public override getClassName(): string {
    return "TerrainMaterialPlugin";
  }

  public override getAttributes(attributes: string[]): void {
    attributes.push(TERRAIN_WEIGHTS_KIND);
  }

  public override getSamplers(samplers: string[]): void {
    samplers.push("tAlb0", "tAlb1", "tAlb2", "tAlb3", "tNrm0", "tNrm1", "tNrm2", "tNrm3");
  }

  public override getUniforms(): { ubo: { name: string; size: number; type: string }[]; fragment: string } {
    return {
      ubo: [
        { name: "terrainScale", size: 1, type: "float" },
        { name: "terrainBump", size: 1, type: "float" },
      ],
      fragment: `#ifdef TERRAIN
uniform float terrainScale;
uniform float terrainBump;
#endif`,
    };
  }

  public override bindForSubMesh(ubo: UniformBuffer): void {
    ubo.updateFloat("terrainScale", this.scale);
    ubo.updateFloat("terrainBump", this.bump);
    for (let i = 0; i < 4; i++) {
      ubo.setTexture(`tAlb${i}`, this.albedo[i]);
      ubo.setTexture(`tNrm${i}`, this.normals[i]);
    }
  }

  public override getActiveTextures(activeTextures: BaseTexture[]): void {
    for (const t of [...this.albedo, ...this.normals]) if (t) activeTextures.push(t);
  }

  public override getCustomCode(shaderType: string): { [pointName: string]: string } | null {
    if (shaderType === "vertex") {
      return {
        CUSTOM_VERTEX_DEFINITIONS: `#ifdef TERRAIN
attribute vec4 terrainWeights;
varying vec4 vTerrainW;
#endif`,
        CUSTOM_VERTEX_MAIN_END: `#ifdef TERRAIN
vTerrainW = terrainWeights;
#endif`,
      };
    }
    return {
      CUSTOM_FRAGMENT_DEFINITIONS: FRAGMENT_DEFINITIONS,
      CUSTOM_FRAGMENT_MAIN_BEGIN: `#ifdef TERRAIN
vec3 terrainMix = vec3(0.0); vec2 terrainUVA = vec2(0.0); vec2 terrainUVB = vec2(0.0);
#endif`,
      CUSTOM_FRAGMENT_UPDATE_DIFFUSE: FRAGMENT_DIFFUSE,
      CUSTOM_FRAGMENT_BEFORE_LIGHTS: FRAGMENT_BEFORE_LIGHTS,
    };
  }
}

/** Build the shared terrain material from synthesized ground surfaces. */
export function createTerrainMaterial(scene: Scene, textures: ProceduralTextureManager): StandardMaterial {
  const mat = new StandardMaterial("terrainMat", scene);
  mat.diffuseColor = new Color3(1, 1, 1);
  mat.specularColor = new Color3(0.06, 0.06, 0.05);
  mat.specularPower = 24;
  const plugin = new TerrainMaterialPlugin(mat);
  TERRAIN_BIOME_ORDER.forEach((biome, i) => {
    plugin.albedo[i] = textures.getBiomeTexture(biome);
    // Always bound (the shader samples them); flattened on tiers without bump.
    plugin.normals[i] = textures.getNormalTexture(biome);
  });
  plugin.bump = textures.normalMaps ? 1.0 : 0.15;
  (mat as unknown as { terrainPlugin: TerrainMaterialPlugin }).terrainPlugin = plugin;
  return mat;
}
