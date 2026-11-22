import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Scene } from "@babylonjs/core/scene";

/**
 * The village well: a curb of irregular stones, dark water, two timber
 * posts with a winch, rope and bucket, and a small tiled gable roof.
 *
 * Built from primitives using the Medieval Village textures (already
 * dark-graded), then merged into one multi-material mesh, so each well is
 * a single draw-call group. Origin at ground level, centred, with the winch
 * axis along local X.
 */

/** Radius of the stone curb (for colliders and keep-out checks). */
export const WELL_RADIUS = 0.95;

interface WellMaterials {
  stone: StandardMaterial;
  wood: StandardMaterial;
  roof: StandardMaterial;
  water: StandardMaterial;
}

const _materials = new WeakMap<Scene, WellMaterials>();

function texturedMaterial(scene: Scene, name: string, url: string, u: number, v: number, tint: Color3): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  const tex = new Texture(url, scene);
  tex.uScale = u;
  tex.vScale = v;
  m.diffuseTexture = tex;
  m.diffuseColor = tint;
  m.specularColor = new Color3(0.03, 0.03, 0.03);
  return m;
}

function materials(scene: Scene, textureBase: string): WellMaterials {
  let mats = _materials.get(scene);
  if (mats) return mats;
  const t = (file: string) => `${textureBase}${file}`;
  const water = new StandardMaterial("well_water", scene);
  water.diffuseColor = new Color3(0.02, 0.03, 0.035);
  water.specularColor = new Color3(0.25, 0.28, 0.3);
  water.specularPower = 96;
  mats = {
    stone: texturedMaterial(scene, "well_stone", t("T_RockTrim_BaseColor.jpg"), 0.35, 0.35, new Color3(0.82, 0.8, 0.78)),
    wood: texturedMaterial(scene, "well_wood", t("T_WoodTrim_BaseColor.jpg"), 0.5, 1, new Color3(0.8, 0.74, 0.68)),
    roof: texturedMaterial(scene, "well_roof", t("T_RoundTiles_BaseColor.jpg"), 1.5, 0.75, new Color3(0.85, 0.82, 0.8)),
    water,
  };
  _materials.set(scene, mats);
  return mats;
}

/** Small deterministic jitter so every well looks the same (and less regular). */
function jitter(seed: number): number {
  const s = Math.sin(seed * 12.9898) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

/**
 * Build one well. `textureBase` is the folder holding the Medieval Village
 * textures (with a trailing slash).
 */
export function buildVillageWell(scene: Scene, name: string, textureBase: string): Mesh {
  const mats = materials(scene, textureBase);
  const parts: Mesh[] = [];
  const add = (m: Mesh, mat: StandardMaterial) => { m.material = mat; parts.push(m); return m; };

  // ── Curb: three courses of stones in a ring, staggered like masonry ──
  const ring = WELL_RADIUS - 0.14;
  const perCourse = 13;
  for (let course = 0; course < 3; course++) {
    for (let i = 0; i < perCourse; i++) {
      const k = course * perCourse + i;
      const a = ((i + (course % 2) * 0.5) / perCourse) * Math.PI * 2;
      const w = (2 * Math.PI * ring) / perCourse - 0.03 + jitter(k) * 0.03;
      const h = 0.22 + jitter(k + 100) * 0.025;
      const d = 0.28 + jitter(k + 200) * 0.03;
      const stone = add(MeshBuilder.CreateBox(`${name}_stone`, { width: w, height: h, depth: d }, scene), mats.stone);
      stone.position.set(Math.sin(a) * ring, 0.12 + course * 0.235, Math.cos(a) * ring);
      stone.rotation.set(jitter(k + 300) * 0.04, a, jitter(k + 400) * 0.04);
    }
  }
  // Cap: a flattened stone ring on top.
  const cap = add(MeshBuilder.CreateTorus(`${name}_cap`, { diameter: ring * 2, thickness: 0.26, tessellation: 26 }, scene), mats.stone);
  cap.position.y = 0.76;
  cap.scaling.y = 0.45;

  // ── Water, well down the shaft ──
  const water = add(MeshBuilder.CreateDisc(`${name}_water`, { radius: ring - 0.1, tessellation: 20 }, scene), mats.water);
  water.rotation.x = Math.PI / 2;
  water.position.y = 0.32;

  // ── Posts, winch, rope and bucket ──
  const postX = ring + 0.02;
  for (const side of [-1, 1]) {
    const post = add(MeshBuilder.CreateBox(`${name}_post`, { width: 0.14, height: 2.36, depth: 0.14 }, scene), mats.wood);
    post.position.set(side * postX, 1.18, 0);
    // A short brace from the curb to each post.
    const brace = add(MeshBuilder.CreateBox(`${name}_brace`, { width: 0.08, height: 0.6, depth: 0.08 }, scene), mats.wood);
    brace.position.set(side * (postX - 0.16), 1.0, 0);
    brace.rotation.z = side * 0.5;
  }
  const winch = add(MeshBuilder.CreateCylinder(`${name}_winch`, { diameter: 0.13, height: postX * 2 + 0.16, tessellation: 10 }, scene), mats.wood);
  winch.rotation.z = Math.PI / 2;
  winch.position.y = 1.55;
  const crank = add(MeshBuilder.CreateBox(`${name}_crank`, { width: 0.06, height: 0.32, depth: 0.06 }, scene), mats.wood);
  crank.position.set(postX + 0.14, 1.43, 0);
  const handle = add(MeshBuilder.CreateCylinder(`${name}_handle`, { diameter: 0.05, height: 0.2, tessellation: 6 }, scene), mats.wood);
  handle.rotation.z = Math.PI / 2;
  handle.position.set(postX + 0.24, 1.3, 0);
  const rope = add(MeshBuilder.CreateCylinder(`${name}_rope`, { diameter: 0.03, height: 0.52, tessellation: 5 }, scene), mats.wood);
  rope.position.set(0.12, 1.27, 0);
  const bucket = add(MeshBuilder.CreateCylinder(`${name}_bucket`, { diameterTop: 0.3, diameterBottom: 0.24, height: 0.27, tessellation: 12 }, scene), mats.wood);
  bucket.position.set(0.12, 0.9, 0);

  // ── Gable roof along X: two tiled slabs, a ridge beam and gable ties ──
  const ridgeY = 2.44;
  const slope = 0.62;
  const slabDepth = 0.95;
  for (const side of [-1, 1]) {
    const slab = add(MeshBuilder.CreateBox(`${name}_roof`, { width: postX * 2 + 0.5, height: 0.06, depth: slabDepth }, scene), mats.roof);
    slab.rotation.x = side * slope;
    slab.position.set(0, ridgeY - Math.sin(slope) * slabDepth / 2, side * Math.cos(slope) * slabDepth / 2);
  }
  const ridge = add(MeshBuilder.CreateBox(`${name}_ridge`, { width: postX * 2 + 0.56, height: 0.1, depth: 0.1 }, scene), mats.wood);
  ridge.position.y = ridgeY + 0.03;

  const merged = Mesh.MergeMeshes(parts, true, true, undefined, false, true);
  if (!merged) throw new Error("well merge failed");
  merged.name = name;
  merged.isPickable = false;
  return merged;
}
