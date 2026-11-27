/**
 * A horse made of simple shapes (no horse model ships with the game): a
 * standing body for when it waits where you left it, and the rider's view
 * (neck, head and mane in front of the camera) for when you are mounted.
 */
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Ray } from "@babylonjs/core/Culling/ray";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Scene } from "@babylonjs/core/scene";
import type { Node } from "@babylonjs/core/node";
import type { AssetContainer } from "@babylonjs/core/assetContainer";
import type { Material } from "@babylonjs/core/Materials/material";
import type { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { asyncWork } from "../core/async-work";

export type HorseCoat = { r: number; g: number; b: number };

/** Coats by horse id (anything else is a bay). */
export const HORSE_COATS: Record<string, HorseCoat> = {
  bay_mare: { r: 0.42, g: 0.24, b: 0.11 },
  black_stallion: { r: 0.07, g: 0.06, b: 0.06 },
  grey_gelding: { r: 0.5, g: 0.28, b: 0.12 },
};

function materials(scene: Scene, name: string, coat: HorseCoat) {
  const hide = new StandardMaterial(`${name}_hide`, scene);
  hide.diffuseColor = new Color3(coat.r, coat.g, coat.b);
  hide.specularColor = new Color3(0.05, 0.05, 0.05);
  const dark = new StandardMaterial(`${name}_mane`, scene);
  const d = Math.min(coat.r, coat.g, coat.b) * 0.5;
  dark.diffuseColor = new Color3(d, d * 0.9, d * 0.8);
  dark.specularColor = new Color3(0, 0, 0);
  return { hide, dark };
}

function box(scene: Scene, name: string, parent: Node, size: [number, number, number], at: [number, number, number], mat: StandardMaterial, tiltX = 0): Mesh {
  const m = MeshBuilder.CreateBox(name, { width: size[0], height: size[1], depth: size[2] }, scene);
  m.parent = parent;
  m.position.set(...at);
  m.rotation.x = tiltX;
  m.material = mat;
  m.isPickable = false;
  return m;
}

/** A whole horse standing on the ground at its root (facing +Z). */
export function buildStandingHorse(scene: Scene, name: string, coat: HorseCoat): TransformNode {
  const root = new TransformNode(name, scene);
  const { hide, dark } = materials(scene, name, coat);
  box(scene, `${name}_body`, root, [0.7, 0.7, 1.7], [0, 1.25, 0], hide);
  for (const [x, z] of [[-0.24, 0.6], [0.24, 0.6], [-0.24, -0.6], [0.24, -0.6]] as const) {
    box(scene, `${name}_leg`, root, [0.16, 0.95, 0.16], [x, 0.48, z], hide);
  }
  box(scene, `${name}_neck`, root, [0.3, 0.8, 0.35], [0, 1.75, 0.85], hide, -0.6);
  box(scene, `${name}_head`, root, [0.28, 0.3, 0.6], [0, 2.1, 1.2], hide, 0.35);
  box(scene, `${name}_mane`, root, [0.08, 0.7, 0.3], [0, 1.85, 0.75], dark, -0.6);
  box(scene, `${name}_tail`, root, [0.12, 0.7, 0.12], [0, 1.15, -0.95], dark, 0.35);
  box(scene, `${name}_saddle`, root, [0.74, 0.08, 0.6], [0, 1.62, -0.05], dark);
  return root;
}

/** The rider's view: neck, head and mane ahead of and below the camera (parent it to the camera). */
export function buildRiderView(scene: Scene, name: string, coat: HorseCoat): TransformNode {
  const root = new TransformNode(name, scene);
  const { hide, dark } = materials(scene, name, coat);
  // Low in the view, above the hotbar: the neck rising toward the head.
  box(scene, `${name}_neck`, root, [0.17, 0.5, 0.2], [0, -0.5, 1.05], hide, -0.8);
  box(scene, `${name}_mane`, root, [0.05, 0.45, 0.14], [0, -0.42, 0.99], dark, -0.8);
  box(scene, `${name}_head`, root, [0.16, 0.17, 0.36], [0, -0.3, 1.38], hide, 0.3);
  for (const x of [-0.05, 0.05]) box(scene, `${name}_ear`, root, [0.035, 0.09, 0.035], [x, -0.19, 1.27], hide);
  for (const m of root.getChildMeshes()) m.renderingGroupId = 1; // drawn over the world it rides through
  return root;
}

/** The ground's height under (x, z), from a ray down through the collidable world. */
export function groundUnder(scene: Scene, x: number, y: number, z: number): number | null {
  const ray = new Ray(new Vector3(x, y + 2, z), new Vector3(0, -1, 0), 50);
  const hit = scene.pickWithRay(ray, (m) => m.isPickable && m.checkCollisions && m.isEnabled());
  return hit?.hit && hit.pickedPoint ? hit.pickedPoint.y : null;
}

// ── The horse model (public/model/horse/Horse.glb) ────────────────────────────

/** Its four clips, and "stand": the walk's first pose held (head up; idle grazes). */
export type HorseClip = "idle" | "walk" | "run" | "lie" | "stand";

/** One placed horse: its root (set position and yaw on it) and its clips. */
export interface HorseInstance {
  readonly root: TransformNode;
  play(clip: HorseClip): void;
  dispose(): void;
}

/** Turns the model (head toward −Z once loaded) to face +Z like the rest of the world. */
export const HORSE_MODEL_YAW = Math.PI;

let horseContainer: Promise<AssetContainer | null> | null = null;
let horseScene: Scene | null = null;

/** Load the horse model once per scene (null when it can't load: the shape horse stands in). */
export function loadHorseModel(scene: Scene): Promise<AssetContainer | null> {
  if (horseContainer && horseScene === scene) return horseContainer;
  horseScene = scene;
  const base = `${import.meta.env?.BASE_URL ?? "/"}model/horse/`;
  horseContainer = asyncWork.ordered(SceneLoader.LoadAssetContainerAsync(base, "Horse.glb", scene))
    .catch((err) => {
      console.warn("[horse] model failed to load; the shape horse stands in", err);
      return null;
    });
  return horseContainer;
}

/** The model is a chestnut; a darker horse multiplies its coat (linear colour; only darker: a tint can't lighten). */
export const HORSE_MODEL_TINT: Record<string, HorseCoat | undefined> = {
  black_stallion: { r: 0.045, g: 0.04, b: 0.04 },
};

/** A new horse from the model, idling at the origin (its coat tinted, if given); null when the model can't load. */
export async function spawnHorseModel(scene: Scene, name: string, tint?: HorseCoat): Promise<HorseInstance | null> {
  const container = await loadHorseModel(scene);
  if (!container || scene.isDisposed) return null;
  // A tinted horse gets its own copies of the materials (the coat is shared otherwise).
  const inst = container.instantiateModelsToScene((n) => `${name}|${n}`, !!tint, { doNotInstantiate: true });
  const root = new TransformNode(name, scene);
  const turn = new TransformNode(`${name}|turn`, scene);
  turn.parent = root;
  turn.rotation.y = HORSE_MODEL_YAW;
  for (const node of inst.rootNodes) node.parent = turn;
  for (const m of root.getChildMeshes()) {
    m.isPickable = false;
    m.receiveShadows = true;
    const mat = m.material as (Material & { albedoColor?: Color3 }) | null;
    if (tint && mat?.albedoColor && !/eye/i.test(mat.name)) {
      if (mat.isFrozen) mat.unfreeze(); // a copy of a frozen material is frozen too
      mat.albedoColor = new Color3(tint.r, tint.g, tint.b);
      mat.markDirty();
    }
  }
  const clips = new Map<string, AnimationGroup>();
  for (const g of inst.animationGroups) clips.set(g.name.slice(g.name.lastIndexOf("|") + 1), g);
  let current: AnimationGroup | null = null;
  let standing = false;
  const horse: HorseInstance = {
    root,
    play(clip) {
      const g = clips.get(clip === "stand" ? "walk" : clip);
      if (!g) return;
      const held = clip === "stand";
      if (g === current && held === standing) return;
      current?.stop();
      current = g;
      standing = held;
      g.start(clip !== "lie" && !held, 1.0, g.from, g.to);
      if (held) { g.goToFrame(g.from); g.pause(); }
    },
    dispose() {
      for (const g of inst.animationGroups) g.dispose();
      // Not the textures (every horse shares the loaded model's); a tinted horse's own material copies go.
      const own = tint ? root.getChildMeshes().map((m) => m.material).filter((m): m is Material => !!m) : [];
      root.dispose(false, false);
      for (const m of new Set(own)) m.dispose(false, false);
    },
  };
  horse.play("idle");
  return horse;
}
