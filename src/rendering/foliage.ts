/**
 * foliage — wind-animated trees and grass.
 *
 *  • WindPlugin: StandardMaterial plugin that sways vertices in world space
 *    (height-weighted, with gusts and per-leaf flutter) and can dissolve
 *    geometry out with distance (grass).
 *  • buildPineTree / buildBroadleafTree: trunks + crossed alpha-tested leaf
 *    cards whose normals point away from the crown centre, so canopies shade
 *    like soft volumes instead of flat quads.
 *  • GrassField: thin-instanced grass clumps in pooled patches around the
 *    player, density driven by biome weights.
 */
import type { Scene } from "@babylonjs/core/scene";
import { MaterialPluginBase } from "@babylonjs/core/Materials/materialPluginBase";
import { MaterialDefines } from "@babylonjs/core/Materials/materialDefines";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Material } from "@babylonjs/core/Materials/material";
import type { UniformBuffer } from "@babylonjs/core/Materials/uniformBuffer";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import "@babylonjs/core/Meshes/thinInstanceMesh";
import type { ProceduralTextureManager } from "../systems/procedural-texture-manager";
import type { BiomeType } from "../world/world-manager";
import { biomeWeightsAt } from "./terrain-material";

// ── Wind ──────────────────────────────────────────────────────────────────────

class WindDefines extends MaterialDefines {
  WIND = false;
  WIND_FADE = false;
}

/** Shared wind clock/strength for every WindPlugin. */
export const WindState = {
  time: 0,
  /** 0 calm … 1 gale. Driven by weather. */
  strength: 0.35,
  /** Unit XZ direction the wind blows toward. */
  dirX: 0.8,
  dirZ: 0.6,
};

export class WindPlugin extends MaterialPluginBase {
  /** Height (local units) at which sway reaches full amplitude. */
  public height = 6;
  /** Amplitude multiplier (world units at full height and strength). */
  public amplitude = 0.35;
  /** High-frequency per-vertex flutter (leaves). */
  public flutter = 0.0;
  /** Dissolve-out distance band [start, end] (0 = disabled). */
  public fadeStart = 0;
  public fadeEnd = 0;

  constructor(material: Material, opts: { fade?: boolean } = {}) {
    super(material, "Wind", 210, new WindDefines());
    this._fade = !!opts.fade;
    this._enable(true);
  }
  private readonly _fade: boolean;

  public override prepareDefines(defines: WindDefines): void {
    defines.WIND = true;
    defines.WIND_FADE = this._fade;
  }

  public override getClassName(): string {
    return "WindPlugin";
  }

  public override getUniforms(): { ubo: { name: string; size: number; type: string }[]; vertex: string; fragment: string } {
    return {
      ubo: [
        { name: "windParams", size: 4, type: "vec4" },
        { name: "windShape", size: 4, type: "vec4" },
      ],
      vertex: `#ifdef WIND
uniform vec4 windParams;
uniform vec4 windShape;
#endif`,
      fragment: `#ifdef WIND
uniform vec4 windParams;
uniform vec4 windShape;
#endif`,
    };
  }

  public override bindForSubMesh(ubo: UniformBuffer): void {
    // windParams: time, strength, dirX, dirZ ; windShape: height, amplitude, flutter, fadeStart|fadeEnd
    ubo.updateFloat4("windParams", WindState.time, WindState.strength, WindState.dirX, WindState.dirZ);
    ubo.updateFloat4("windShape", this.height, this.amplitude, this.flutter, this.fadeEnd > 0 ? this.fadeStart + this.fadeEnd * 1000 : 0);
  }

  public override getCustomCode(shaderType: string): { [pointName: string]: string } | null {
    if (shaderType === "vertex") {
      return {
        CUSTOM_VERTEX_UPDATE_WORLDPOS: `#ifdef WIND
{
  float t = windParams.x;
  float s = windParams.y;
  vec2 dir = windParams.zw;
  float h = clamp(positionUpdated.y / windShape.x, 0.0, 1.0);
  h *= h;
  float ph = dot(worldPos.xz, vec2(0.13, 0.09));
  float gust = 0.6 + 0.4 * sin(t * 0.35 + dot(worldPos.xz, dir) * 0.02);
  float sway = sin(t * 1.4 + ph) * 0.6 + sin(t * 3.1 + ph * 2.7) * 0.25;
  vec2 off = dir * (s * gust * (0.6 + sway)) + vec2(-dir.y, dir.x) * sway * 0.25 * s;
  worldPos.xz += off * windShape.y * h;
  worldPos.y -= length(off) * windShape.y * h * 0.15;
  if (windShape.z > 0.0) {
    float f = sin(t * 7.0 + dot(positionUpdated, vec3(3.1, 2.3, 4.7)) + ph * 5.0);
    worldPos.xyz += vec3(f, f * 0.5, -f) * windShape.z * (0.4 + s) * h;
  }
}
#endif`,
      };
    }
    if (!this._fade) return null;
    return {
      CUSTOM_FRAGMENT_DEFINITIONS: `#ifdef WIND_FADE
float windDither(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
#endif`,
      CUSTOM_FRAGMENT_MAIN_BEGIN: `#ifdef WIND_FADE
{
  float packed = windShape.w;
  if (packed > 0.0) {
    float fEnd = floor(packed / 1000.0);
    float fStart = packed - fEnd * 1000.0;
    float d = length(vPositionW.xz - vEyePosition.xz);
    float k = clamp((d - fStart) / max(fEnd - fStart, 0.001), 0.0, 1.0);
    if (k > windDither(gl_FragCoord.xy)) discard;
  }
}
#endif`,
    };
  }
}

// ── Materials ─────────────────────────────────────────────────────────────────

function cutoutMaterial(name: string, scene: Scene, textures: ProceduralTextureManager, kind: "leaf_card" | "grass_blades" | "palm_frond"): StandardMaterial {
  const mat = new StandardMaterial(name, scene);
  const tex = textures.getSurfaceTexture(kind);
  if (tex) {
    mat.diffuseTexture = tex;
    mat.diffuseTexture.hasAlpha = true;
    // With an explicit transparencyMode Babylon alpha-tests the final alpha,
    // which only includes the texture alpha when this is on.
    mat.useAlphaFromDiffuseTexture = true;
  }
  mat.transparencyMode = 1; // MATERIAL_ALPHATEST
  mat.alphaCutOff = 0.45;
  mat.backFaceCulling = false;
  // Not twoSidedLighting: canopy normals are spherical (away from the crown
  // centre) and must stay the same on both faces of a card.
  mat.twoSidedLighting = false;
  mat.specularColor = new Color3(0.04, 0.05, 0.03);
  return mat;
}

export interface FoliageMaterials {
  bark: StandardMaterial;
  broadleaf: StandardMaterial;
  pine: StandardMaterial;
  palm: StandardMaterial;
  grass: StandardMaterial;
}

export function createFoliageMaterials(scene: Scene, textures: ProceduralTextureManager, wind: boolean): FoliageMaterials {
  const bark = new StandardMaterial("foliage_bark", scene);
  bark.diffuseColor = new Color3(0.92, 0.88, 0.84);
  bark.specularColor = new Color3(0.03, 0.03, 0.02);
  textures.applySurface(bark, "bark_timber", 1, 2, { tintStrength: 0 });
  bark.diffuseColor = new Color3(0.9, 0.86, 0.82);

  const broadleaf = cutoutMaterial("foliage_broadleaf", scene, textures, "leaf_card");
  broadleaf.diffuseColor = new Color3(1.0, 1.0, 0.92);
  const pine = cutoutMaterial("foliage_pine", scene, textures, "leaf_card");
  pine.diffuseColor = new Color3(0.62, 0.78, 0.66);
  const palm = cutoutMaterial("foliage_palm", scene, textures, "palm_frond");
  palm.diffuseColor = new Color3(1.0, 0.98, 0.86);
  const grass = cutoutMaterial("foliage_grass", scene, textures, "grass_blades");
  grass.diffuseColor = new Color3(0.72, 0.78, 0.62);
  grass.alphaCutOff = 0.5;
  // Grass normals all point up so it shades like the ground it grows from.

  if (wind) {
    const wb = new WindPlugin(bark);
    wb.height = 9; wb.amplitude = 0.12;
    const wl = new WindPlugin(broadleaf);
    wl.height = 8; wl.amplitude = 0.3; wl.flutter = 0.035;
    const wp = new WindPlugin(pine);
    wp.height = 9; wp.amplitude = 0.22; wp.flutter = 0.02;
    const wpa = new WindPlugin(palm);
    wpa.height = 7; wpa.amplitude = 0.35; wpa.flutter = 0.05;
  }
  const wg = new WindPlugin(grass, { fade: true });
  wg.height = 0.9; wg.amplitude = wind ? 0.35 : 0; wg.flutter = 0;
  wg.fadeStart = 26; wg.fadeEnd = 40;
  (grass as unknown as { windPlugin: WindPlugin }).windPlugin = wg;
  return { bark, broadleaf, pine, palm, grass };
}

// ── Geometry helpers ─────────────────────────────────────────────────────────

class GeoBuilder {
  positions: number[] = [];
  normals: number[] = [];
  uvs: number[] = [];
  indices: number[] = [];

  /** Quad from 4 corners (ccw), per-vertex normals supplied. */
  quad(p: Vector3[], n: Vector3[], uv: number[]): void {
    const base = this.positions.length / 3;
    for (let i = 0; i < 4; i++) {
      this.positions.push(p[i].x, p[i].y, p[i].z);
      this.normals.push(n[i].x, n[i].y, n[i].z);
      this.uvs.push(uv[i * 2], uv[i * 2 + 1]);
    }
    this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  /** Tapered cylinder (trunk / branch) between two points. */
  tube(a: Vector3, b: Vector3, ra: number, rb: number, sides: number, vRepeat: number): void {
    const axis = b.subtract(a);
    const len = axis.length();
    const up = axis.normalizeToNew();
    const ref = Math.abs(up.y) < 0.95 ? Vector3.Up() : Vector3.Right();
    const side = Vector3.Cross(up, ref).normalize();
    const fwd = Vector3.Cross(side, up).normalize();
    const base = this.positions.length / 3;
    for (let ring = 0; ring <= 1; ring++) {
      const c = ring === 0 ? a : b;
      const r = ring === 0 ? ra : rb;
      for (let i = 0; i <= sides; i++) {
        const t = (i / sides) * Math.PI * 2;
        const n = side.scale(Math.cos(t)).add(fwd.scale(Math.sin(t)));
        const p = c.add(n.scale(r));
        this.positions.push(p.x, p.y, p.z);
        this.normals.push(n.x, n.y, n.z);
        this.uvs.push(i / sides, ring * vRepeat * len / 3);
      }
    }
    const row = sides + 1;
    for (let i = 0; i < sides; i++) {
      const a0 = base + i, a1 = base + i + 1, b0 = base + row + i, b1 = base + row + i + 1;
      this.indices.push(a0, b0, a1, a1, b0, b1);
    }
  }

  /**
   * Three crossed leaf cards around `center` (star cluster).  Normals point
   * from `crown` outward, blended with the card normal.
   */
  leafCluster(center: Vector3, size: number, crown: Vector3, rot: number, tilt: number): void {
    // Scalar math throughout — this runs ~1–2k times per forest chunk.
    const cx = center.x, cy = center.y, cz = center.z;
    let ox = cx - crown.x, oy = cy - crown.y, oz = cz - crown.z;
    let ol = Math.sqrt(ox * ox + oy * oy + oz * oz);
    if (ol < 1e-2) { ox = 0; oy = 1; oz = 0; ol = 1; }
    ox /= ol; oy /= ol; oz /= ol;
    const half = size / 2;
    const P = this.positions, N = this.normals, U = this.uvs, I = this.indices;
    for (let k = 0; k < 3; k++) {
      const yaw = rot + (k * Math.PI) / 3;
      const cs = Math.cos(yaw), sn = Math.sin(yaw);
      const rx = cs * half, rz = sn * half;
      // Up vector: tilted, or nearly horizontal for the third card (fills the
      // cluster seen from below/above).
      let ux = -sn * (k === 2 ? 1 : tilt), uy = k === 2 ? 0.25 : 1, uz = cs * (k === 2 ? 1 : tilt);
      const ul = Math.sqrt(ux * ux + uy * uy + uz * uz);
      ux = ux / ul * half; uy = uy / ul * half; uz = uz / ul * half;
      const base = P.length / 3;
      for (let c = 0; c < 4; c++) {
        const sr = c === 0 || c === 3 ? -1 : 1;
        const su = c < 2 ? -1 : 1;
        const px = cx + rx * sr + ux * su, py = cy + uy * su, pz = cz + rz * sr + uz * su;
        P.push(px, py, pz);
        // Spherical canopy normal, biased up so inner/lower leaves still catch
        // sky light instead of only the dark ground hemisphere.
        let nx = px - crown.x, ny = py - crown.y, nz = pz - crown.z;
        const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        nx = nx / nl * 0.55 + ox * 0.15;
        ny = ny / nl * 0.55 + oy * 0.15 + 0.45;
        nz = nz / nl * 0.55 + oz * 0.15;
        const ml = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        N.push(nx / ml, ny / ml, nz / ml);
      }
      U.push(0, 1, 1, 1, 1, 0, 0, 0);
      I.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  build(name: string, scene: Scene): Mesh {
    const mesh = new Mesh(name, scene);
    const vd = new VertexData();
    vd.positions = this.positions;
    vd.normals = this.normals;
    vd.uvs = this.uvs;
    vd.indices = this.indices;
    vd.applyToMesh(mesh, false);
    return mesh;
  }
}

/** Deterministic PRNG for tree shapes. */
function rng(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export interface TreeMeshes { trunk: Mesh; crown: Mesh }

/**
 * Per-chunk geometry accumulators: every tree in a chunk appends into one
 * builder per material, producing pre-merged meshes (no MergeMeshes pass).
 */
export class FoliageBatch {
  readonly bark = new GeoBuilder();
  readonly pine = new GeoBuilder();
  readonly broadleaf = new GeoBuilder();
  readonly palm = new GeoBuilder();

  build(name: string, scene: Scene, mats: FoliageMaterials): Mesh[] {
    const out: Mesh[] = [];
    const pairs: Array<[GeoBuilder, StandardMaterial, string]> = [
      [this.bark, mats.bark, "bark"], [this.pine, mats.pine, "pine"],
      [this.broadleaf, mats.broadleaf, "broadleaf"], [this.palm, mats.palm, "palm"],
    ];
    for (const [b, mat, tag] of pairs) {
      if (b.indices.length === 0) continue;
      const m = b.build(`${name}_${tag}`, scene);
      m.material = mat;
      out.push(m);
    }
    return out;
  }
}

/** Conifer: straight trunk, tiers of drooping leaf clusters narrowing upward. */
export function buildPineTree(scene: Scene, name: string, x: number, z: number, scale: number, seed: number, mats: FoliageMaterials, batch?: FoliageBatch): TreeMeshes | null {
  const r = rng(seed);
  const h = (7 + scale * 6) * (0.9 + r() * 0.2);
  const trunk = batch ? batch.bark : new GeoBuilder();
  trunk.tube(new Vector3(x, -0.2, z), new Vector3(x, h, z), 0.32 + scale * 0.12, 0.06, 7, 2);
  const crown = batch ? batch.pine : new GeoBuilder();
  const crownC = new Vector3(x, h * 0.55, z);
  const tiers = 6 + Math.round(scale * 3);
  for (let t = 0; t < tiers; t++) {
    const f = t / (tiers - 1); // 0 bottom → 1 top
    const y = h * (0.28 + f * 0.7);
    const radius = (1 - f) * (2.2 + scale * 1.2) + 0.35;
    const count = Math.max(3, Math.round(radius * 3.2));
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + r() * 0.6 + t;
      const rr = radius * (0.55 + r() * 0.45);
      const c = new Vector3(x + Math.cos(a) * rr, y - rr * 0.18, z + Math.sin(a) * rr);
      crown.leafCluster(c, 1.5 + (1 - f) * 1.3, crownC, a, 0.5);
    }
  }
  crown.leafCluster(new Vector3(x, h + 0.2, z), 1.3, crownC, r() * 6, 0.1);
  if (batch) return null;
  const tm = trunk.build(`${name}_trunk`, scene);
  tm.material = mats.bark;
  const cm = crown.build(`${name}_crown`, scene);
  cm.material = mats.pine;
  return { trunk: tm, crown: cm };
}

/** Broadleaf: forked trunk with branches ending in rounded leaf-cluster masses. */
export function buildBroadleafTree(scene: Scene, name: string, x: number, z: number, scale: number, seed: number, mats: FoliageMaterials, batch?: FoliageBatch): TreeMeshes | null {
  const r = rng(seed);
  const h = (4.5 + scale * 3.5) * (0.9 + r() * 0.25);
  const trunk = batch ? batch.bark : new GeoBuilder();
  const top = new Vector3(x + (r() - 0.5) * 0.6, h, z + (r() - 0.5) * 0.6);
  trunk.tube(new Vector3(x, -0.2, z), top, 0.38 + scale * 0.14, 0.2, 8, 2);
  const crown = batch ? batch.broadleaf : new GeoBuilder();
  const crownC = new Vector3(top.x, h + 1.6 + scale, top.z);
  const branches = 4 + Math.floor(r() * 3);
  const masses: Vector3[] = [];
  for (let b = 0; b < branches; b++) {
    const a = (b / branches) * Math.PI * 2 + r() * 0.8;
    const len = 1.8 + scale * 1.4 + r();
    const end = new Vector3(top.x + Math.cos(a) * len, h + 0.8 + r() * 1.6, top.z + Math.sin(a) * len);
    const start = new Vector3(x + (top.x - x) * 0.7, h * (0.6 + r() * 0.25), z + (top.z - z) * 0.7);
    trunk.tube(start, end, 0.14, 0.05, 5, 1);
    masses.push(end);
  }
  masses.push(new Vector3(top.x, h + 2.2 + scale, top.z));
  for (const m of masses) {
    const n = 7 + Math.round(scale * 4);
    for (let i = 0; i < n; i++) {
      const u = r() * Math.PI * 2;
      const v = Math.acos(2 * r() - 1);
      const rad = (1.1 + scale * 0.8) * (0.4 + r() * 0.6);
      const c = new Vector3(
        m.x + Math.sin(v) * Math.cos(u) * rad,
        m.y + Math.cos(v) * rad * 0.75,
        m.z + Math.sin(v) * Math.sin(u) * rad,
      );
      crown.leafCluster(c, 1.6 + scale * 0.8, crownC, u, 0.35);
    }
  }
  if (batch) return null;
  const tm = trunk.build(`${name}_trunk`, scene);
  tm.material = mats.bark;
  const cm = crown.build(`${name}_crown`, scene);
  cm.material = mats.broadleaf;
  return { trunk: tm, crown: cm };
}

/** Desert palm: leaning, ringed trunk and a crown of drooping frond cards. */
export function buildPalmTree(scene: Scene, name: string, x: number, z: number, seed: number, mats: FoliageMaterials, batch?: FoliageBatch): TreeMeshes | null {
  const r = rng(seed);
  const h = 5.5 + r() * 3;
  const lean = r() * Math.PI * 2;
  const leanAmt = 0.6 + r() * 1.2;
  const trunk = batch ? batch.bark : new GeoBuilder();
  const segs = 7;
  let prev = new Vector3(x, -0.2, z);
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    const bend = t * t * leanAmt;
    const p = new Vector3(x + Math.cos(lean) * bend, h * t, z + Math.sin(lean) * bend);
    trunk.tube(prev, p, 0.26 - t * 0.08 + 0.03, 0.26 - t * 0.08, 7, 1);
    prev = p;
  }
  const top = prev;
  const crown = batch ? batch.palm : new GeoBuilder();
  const fronds = 9 + Math.floor(r() * 4);
  for (let f = 0; f < fronds; f++) {
    const a = (f / fronds) * Math.PI * 2 + r() * 0.3;
    const len = 2.6 + r() * 1.2;
    const dir = new Vector3(Math.cos(a), 0, Math.sin(a));
    const side = new Vector3(-dir.z, 0, dir.x).scale(0.55);
    // Two segments: rising then drooping.
    const mid = top.add(dir.scale(len * 0.5)).add(new Vector3(0, 0.35 + r() * 0.3, 0));
    const tip = top.add(dir.scale(len)).add(new Vector3(0, -0.9 - r() * 0.8, 0));
    const up = Vector3.Up();
    crown.quad(
      [top.subtract(side.scale(0.3)), top.add(side.scale(0.3)), mid.add(side), mid.subtract(side)],
      [up, up, up, up],
      [0, 0, 1, 0, 1, 0.5, 0, 0.5],
    );
    crown.quad(
      [mid.subtract(side), mid.add(side), tip.add(side.scale(0.2)), tip.subtract(side.scale(0.2))],
      [up, up, up, up],
      [0, 0.5, 1, 0.5, 1, 1, 0, 1],
    );
  }
  if (batch) return null;
  const tm = trunk.build(`${name}_trunk`, scene);
  tm.material = mats.bark;
  const cm = crown.build(`${name}_crown`, scene);
  cm.material = mats.palm;
  return { trunk: tm, crown: cm };
}

// ── Grass ─────────────────────────────────────────────────────────────────────

/** One grass clump: three crossed blade cards, rooted at y = 0, normals up. */
function buildGrassClump(scene: Scene): Mesh {
  const g = new GeoBuilder();
  const up = new Vector3(0, 1, 0);
  for (let k = 0; k < 3; k++) {
    const a = (k * Math.PI) / 3;
    const dx = Math.cos(a) * 0.34, dz = Math.sin(a) * 0.34;
    // Tops splay outward a little so clumps read as tufts, not boxes.
    const sx = Math.cos(a + 1.2) * 0.12, sz = Math.sin(a + 1.2) * 0.12;
    const p = [
      new Vector3(-dx, 0, -dz), new Vector3(dx, 0, dz),
      new Vector3(dx * 1.25 + sx, 0.62, dz * 1.25 + sz), new Vector3(-dx * 1.25 + sx, 0.62, -dz * 1.25 + sz),
    ];
    g.quad(p, [up, up, up, up], [0, 1, 1, 1, 1, 0, 0, 0]);
  }
  const m = g.build("grassClump", scene);
  return m;
}

const PATCH = 24;

/**
 * Pooled, thin-instanced grass patches covering a radius around the player.
 */
export class GrassField {
  public radius = 40;
  public density: number;
  private readonly _template: Mesh;
  private readonly _patches = new Map<string, Mesh>();
  private readonly _pool: Mesh[] = [];
  private readonly _queue: { px: number; pz: number; key: string; d: number }[] = [];
  private _lastCx = Number.NaN;
  private _lastCz = Number.NaN;
  private readonly _tmpM = new Matrix();
  private readonly _tmpQ = new Quaternion();
  private readonly _tmpS = new Vector3();
  private readonly _tmpT = new Vector3();
  private readonly _w: [number, number, number, number] = [0, 0, 0, 0];

  constructor(
    private readonly _scene: Scene,
    material: StandardMaterial,
    density: number,
    private readonly _chunkSize: number,
    private readonly _getBiome: (cx: number, cz: number) => BiomeType,
    private readonly _excluded: ((x: number, z: number) => boolean) | null = null,
  ) {
    this.density = density;
    this._template = buildGrassClump(_scene);
    this._template.material = material;
    this._template.isPickable = false;
    this._template.receiveShadows = true;
    this._template.setEnabled(false);
    const fade = (material as unknown as { windPlugin?: WindPlugin }).windPlugin;
    if (fade) this.radius = fade.fadeEnd + PATCH * 0.5;
  }

  /** Rebuild the patch set when the player crosses a patch boundary. */
  public update(px: number, pz: number): void {
    if (this.density <= 0) return;
    const cx = Math.floor(px / PATCH);
    const cz = Math.floor(pz / PATCH);
    if (cx === this._lastCx && cz === this._lastCz) return;
    this._lastCx = cx;
    this._lastCz = cz;
    const reach = Math.ceil(this.radius / PATCH);
    const wanted = new Set<string>();
    this._queue.length = 0;
    for (let dz = -reach; dz <= reach; dz++) {
      for (let dx = -reach; dx <= reach; dx++) {
        const ox = (cx + dx + 0.5) * PATCH - px;
        const oz = (cz + dz + 0.5) * PATCH - pz;
        const d = Math.sqrt(ox * ox + oz * oz);
        if (d > this.radius + PATCH * 0.75) continue;
        const key = `${cx + dx},${cz + dz}`;
        wanted.add(key);
        if (!this._patches.has(key)) this._queue.push({ px: cx + dx, pz: cz + dz, key, d });
      }
    }
    // Nearest first; built a few per frame in pump().
    this._queue.sort((a, b) => a.d - b.d);
    for (const [key, mesh] of this._patches) {
      if (!wanted.has(key)) {
        mesh.setEnabled(false);
        this._pool.push(mesh);
        this._patches.delete(key);
      }
    }
  }

  /**
   * Build up to `budget` queued patches.  Call every frame: spreading patch
   * builds avoids a 20–30 ms hitch each time the player crosses a boundary.
   */
  public pump(budget = 2): void {
    for (let i = 0; i < budget && this._queue.length > 0; i++) {
      const job = this._queue.shift()!;
      if (!this._patches.has(job.key)) this._buildPatch(job.px, job.pz, job.key);
    }
  }

  private _buildPatch(px: number, pz: number, key: string): void {
    // Deterministic per patch so revisiting looks identical.
    const r = rng((px * 73856093) ^ (pz * 19349663));
    const target = Math.round(PATCH * PATCH * 2.4 * this.density);
    const matrices = new Float32Array(target * 16);
    const colors = new Float32Array(target * 4);
    let n = 0;
    for (let i = 0; i < target; i++) {
      const x = (px + r()) * PATCH;
      const z = (pz + r()) * PATCH;
      if (this._excluded?.(x, z)) continue;
      biomeWeightsAt(x, z, this._chunkSize, this._getBiome, 0.45, this._w);
      // Pure grassland is full; forest floor sparse; none on sand or snow.
      const lush = Math.pow(this._w[0], 2.5) + Math.pow(this._w[1], 2.5) * 0.4;
      // Clustered: modulate by a cheap value-noise-like term.
      const clump = 0.55 + 0.45 * Math.sin(x * 0.21 + Math.sin(z * 0.17) * 2) * Math.sin(z * 0.19 + Math.sin(x * 0.13) * 2);
      if (r() > lush * clump) continue;
      const s = 0.55 + r() * 0.8;
      this._tmpS.set(s, s * (0.8 + r() * 0.5), s);
      Quaternion.RotationYawPitchRollToRef(r() * Math.PI * 2, (r() - 0.5) * 0.15, (r() - 0.5) * 0.15, this._tmpQ);
      this._tmpT.set(x, 0, z);
      Matrix.ComposeToRef(this._tmpS, this._tmpQ, this._tmpT, this._tmpM);
      this._tmpM.copyToArray(matrices, n * 16);
      const forest = this._w[1];
      const dry = this._w[2] + this._w[3];
      const tone = 0.82 + r() * 0.3;
      colors[n * 4] = tone * (1 - forest * 0.25 + dry * 0.25);
      colors[n * 4 + 1] = tone * (1 - forest * 0.1);
      colors[n * 4 + 2] = tone * (1 - forest * 0.2 - dry * 0.2);
      colors[n * 4 + 3] = 1;
      n++;
    }
    let mesh = this._pool.pop();
    if (!mesh) {
      mesh = this._template.clone(`grassPatch`, null, true, false) as Mesh;
      // Thin-instance buffers live on the geometry — each patch needs its own.
      mesh.makeGeometryUnique();
      mesh.isPickable = false;
      mesh.receiveShadows = true;
      mesh.alwaysSelectAsActiveMesh = false;
    }
    mesh.name = `grassPatch_${key}`;
    if (n === 0) {
      mesh.thinInstanceCount = 0;
      mesh.setEnabled(false);
    } else {
      mesh.thinInstanceSetBuffer("matrix", matrices.subarray(0, n * 16), 16, true);
      mesh.thinInstanceSetBuffer("color", colors.subarray(0, n * 4), 4, true);
      mesh.thinInstanceRefreshBoundingInfo(false);
      mesh.setEnabled(true);
    }
    this._patches.set(key, mesh);
  }

  public setVisible(visible: boolean): void {
    for (const m of this._patches.values()) m.setEnabled(visible && m.thinInstanceCount > 0);
  }

  public dispose(): void {
    for (const m of this._patches.values()) m.dispose();
    for (const m of this._pool) m.dispose();
    this._patches.clear();
    this._pool.length = 0;
    this._template.dispose();
  }
}
