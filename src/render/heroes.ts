import { Color3 } from "@babylonjs/core/Maths/math.color";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import type { Scene } from "@babylonjs/core/scene";
import "@babylonjs/loaders/glTF";

import type { ModelId } from "../moba/types";

const HEIGHT = 1.85;

export class Rig {
  private current: AnimationGroup | null = null;
  private currentName = "";

  constructor(
    readonly pivot: TransformNode,
    private readonly groups: AnimationGroup[],
  ) {
    for (const group of groups) group.stop();
  }

  play(name: string, loop: boolean): void {
    const group = this.find(name) ?? this.find("Idle");
    if (!group) return;
    if (this.current === group && loop && group.isPlaying) return;
    if (this.current && this.current !== group) this.current.stop();
    this.current = group;
    this.currentName = name;
    group.start(loop, loop ? 1 : 1.15, group.from, group.to, false);
  }

  get clip(): string {
    return this.currentName;
  }

  dispose(): void {
    for (const group of this.groups) group.dispose();
    this.pivot.dispose(false, true);
  }

  private find(name: string): AnimationGroup | undefined {
    return this.groups.find((group) => {
      const clip = group.name.slice(group.name.lastIndexOf("|") + 1);
      return clip === name || group.name === name;
    });
  }
}

interface Entry {
  container: Awaited<ReturnType<typeof SceneLoader.LoadAssetContainerAsync>> | null;
  scale: number;
  promise: Promise<void>;
}

/** KayKit adventurers, loaded once and stamped onto each champion. */
export class HeroLibrary {
  private readonly entries = new Map<ModelId, Entry>();

  constructor(
    private readonly scene: Scene,
    private readonly rootUrl: string,
  ) {}

  preload(ids: readonly ModelId[]): void {
    for (const id of ids) this.entry(id);
  }

  async attach(parent: TransformNode, id: ModelId, tint: "none" | "fey", token: { alive: boolean }): Promise<Rig | null> {
    const entry = this.entry(id);
    await entry.promise;
    if (!token.alive || !entry.container) return null;
    const tag = `${id}-${parent.uniqueId}`;
    const inst = entry.container.instantiateModelsToScene((name) => `${tag}|${name}`, true);
    const pivot = new TransformNode(`${tag}-pivot`, this.scene);
    pivot.parent = parent;
    pivot.scaling.setAll(entry.scale);
    for (const node of inst.rootNodes) node.parent = pivot;
    const meshes: AbstractMesh[] = [];
    for (const node of inst.rootNodes) {
      if ("getTotalVertices" in node) meshes.push(node as AbstractMesh);
      for (const child of node.getChildMeshes(false)) meshes.push(child);
    }
    for (const mesh of meshes) {
      mesh.isPickable = false;
      if (tint === "fey") tintFey(mesh);
    }
    return new Rig(pivot, inst.animationGroups);
  }

  private entry(id: ModelId): Entry {
    const existing = this.entries.get(id);
    if (existing) return existing;
    const created: Entry = { container: null, scale: 1, promise: Promise.resolve() };
    created.promise = SceneLoader.LoadAssetContainerAsync(this.rootUrl, `${id}.glb`, this.scene)
      .then((container) => {
        keepOneWeapon(container.meshes);
        created.scale = standingScale(container.meshes);
        created.container = container;
      })
      .catch((error: unknown) => {
        console.warn(`Hero model ${id} failed to load`, error);
      });
    this.entries.set(id, created);
    return created;
  }
}

function standingScale(meshes: AbstractMesh[]): number {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const mesh of meshes) {
    if (!mesh.getTotalVertices || mesh.getTotalVertices() === 0) continue;
    mesh.computeWorldMatrix(true);
    const box = mesh.getBoundingInfo().boundingBox;
    minY = Math.min(minY, box.minimumWorld.y);
    maxY = Math.max(maxY, box.maximumWorld.y);
  }
  const height = maxY - minY;
  return Number.isFinite(height) && height > 0.2 ? HEIGHT / height : 1;
}

function keepOneWeapon(meshes: AbstractMesh[]): void {
  const slots = new Map<string, AbstractMesh[]>();
  for (const mesh of meshes) {
    const parent = mesh.parent?.name ?? "";
    if (!/handslot/i.test(parent)) continue;
    const list = slots.get(parent) ?? [];
    list.push(mesh);
    slots.set(parent, list);
  }
  for (const [slot, items] of slots) {
    const left = /left|\.l$/i.test(slot);
    const score = (name: string) => {
      if (left) return /shield/i.test(name) ? 3 : 1;
      if (/staff|wand|crossbow|1H/i.test(name)) return 3;
      return /2H/i.test(name) ? 2 : 1;
    };
    const ranked = items.slice().sort((a, b) => score(b.name) - score(a.name));
    for (const extra of ranked.slice(1)) extra.setEnabled(false);
  }
}

function tintFey(mesh: AbstractMesh): void {
  const material = mesh.material as { emissiveColor?: Color3; albedoColor?: Color3 } | null;
  if (!material) return;
  if (material.albedoColor) material.albedoColor = material.albedoColor.multiply(new Color3(0.8, 0.62, 1));
  material.emissiveColor = new Color3(0.22, 0.04, 0.32);
}
