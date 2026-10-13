/**
 * character-models — rigged, animated humanoids for NPCs.
 *
 * Models: KayKit "Adventurers" character pack by Kay Lousberg (CC0), vendored
 * under `public/model/kaykit/` and compacted to the clips we play with
 * `tools/compact-glb.py`.
 *
 * Each GLB is loaded once into an AssetContainer and instantiated per NPC
 * (cloned skeleton + animation groups, shared materials).  The rig is
 * parented to the NPC's physics capsule, which stops rendering
 * (`visibility = 0`) but stays pickable, so interaction, combat raycasts and
 * physics are untouched.
 */
import type { Scene } from "@babylonjs/core/scene";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import type { AssetContainer } from "@babylonjs/core/assetContainer";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import "@babylonjs/loaders/glTF";
import type { AnimationClip } from "../systems/animation-system";

export type CharacterModelId =
  | "Knight" | "Barbarian" | "Mage" | "Rogue" | "Rogue_Hooded"
  | "Skeleton_Warrior" | "Skeleton_Mage" | "Skeleton_Rogue" | "Skeleton_Minion";

export const CHARACTER_MODEL_IDS: readonly CharacterModelId[] = [
  "Knight", "Barbarian", "Mage", "Rogue", "Rogue_Hooded",
  "Skeleton_Warrior", "Skeleton_Mage", "Skeleton_Rogue", "Skeleton_Minion",
];

/** Models worth fetching at boot (the rest load on first use). */
export const CHARACTER_MODELS_PRELOAD: readonly CharacterModelId[] = [
  "Knight", "Rogue", "Barbarian", "Skeleton_Warrior",
];

const isSkeleton = (m: CharacterModelId): boolean => m.startsWith("Skeleton_");

/** Standing height NPC rigs are normalised to (world units ≈ metres). */
export const CHARACTER_HEIGHT = 1.85;

/** Pick a model for an NPC from its mesh name / archetype words. */
export function modelForNpcName(name: string): CharacterModelId | null {
  const n = name.toLowerCase();
  if (n.startsWith("dragon")) return null;
  // Ruin guards are the restless dead of the old ruins.
  if (/undead|skeleton|draugr|zombie|wight|barrow|lich|ruinguard/.test(n)) {
    if (/mage|lich|necro/.test(n)) return "Skeleton_Mage";
    if (/archer|rogue|ranger/.test(n)) return "Skeleton_Rogue";
    if (/minion|thrall|lesser/.test(n)) return "Skeleton_Minion";
    return "Skeleton_Warrior";
  }
  if (/guard|knight|soldier|captain/.test(n)) return "Knight";
  if (/mage|wizard|sorcer|witch|priest|healer|trainer/.test(n)) return "Mage";
  if (/archer|ranger|hunter|scout/.test(n)) return "Rogue_Hooded";
  if (/bandit|outlaw|robber|chief|boss|lord|barbarian|pirate|smith|blacksmith/.test(n)) return "Barbarian";
  if (/thief|rogue|assassin/.test(n)) return "Rogue_Hooded";
  return "Rogue";
}

/** Skeletal clip names played for each AnimationSystem clip, per model. */
export function skeletalClipFor(clip: AnimationClip, model: CharacterModelId): { name: string; loop: boolean } {
  if (isSkeleton(model)) {
    switch (clip) {
      case "walk":
      case "return":
      case "investigate": return { name: "Walking_D_Skeletons", loop: true };
      case "run":         return { name: "Running_C", loop: true };
      case "alert":       return { name: "Idle_Combat", loop: true };
      case "victory":     return { name: "Taunt", loop: true };
      case "spawn":       return { name: "Spawn_Ground_Skeletons", loop: false };
      case "death":       return { name: "Death_C_Skeletons", loop: false };
      case "telegraph":
        if (model === "Skeleton_Mage") return { name: "Spellcast_Shoot", loop: false };
        if (model === "Skeleton_Rogue") return { name: "1H_Ranged_Shoot", loop: false };
        return { name: "1H_Melee_Attack_Chop", loop: false };
      default: break;
    }
  }
  switch (clip) {
    case "idle":        return { name: "Idle", loop: true };
    case "walk":
    case "return":      return { name: "Walking_A", loop: true };
    case "investigate": return { name: "Walking_B", loop: true };
    case "run":         return { name: "Running_A", loop: true };
    case "alert":       return { name: model === "Mage" ? "Idle" : "2H_Melee_Idle", loop: true };
    case "victory":     return { name: "Cheer", loop: true };
    case "spawn":       return { name: "Idle", loop: false };
    case "telegraph":
      if (model === "Mage") return { name: "Spellcast_Shoot", loop: false };
      if (model === "Rogue_Hooded") return { name: "1H_Ranged_Shoot", loop: false };
      if (model === "Barbarian") return { name: "2H_Melee_Attack_Chop", loop: false };
      return { name: "1H_Melee_Attack_Chop", loop: false };
    case "stagger":     return { name: "Hit_B", loop: false };
    case "hit":         return { name: "Hit_A", loop: false };
    case "death":       return { name: "Death_A", loop: false };
  }
}

const HIT_FLASH = new Color3(1, 0.25, 0.2);

/** One NPC's instantiated, animated model. */
export class CharacterRig {
  /** Yaw pivot under the capsule; rotate this to face a direction. */
  public readonly pivot: TransformNode;
  public readonly meshes: AbstractMesh[];
  private readonly _groups = new Map<string, AnimationGroup>();
  private _current: AnimationGroup | null = null;
  private _currentName = "";
  private _yaw = 0;
  private _flashTimer = 0;
  private _disposed = false;
  private readonly _lastPos = new Vector3();
  private _hasLastPos = false;
  /** Smoothed horizontal speed (units / s) measured from capsule motion. */
  public speed = 0;

  constructor(
    public readonly model: CharacterModelId,
    pivot: TransformNode,
    meshes: AbstractMesh[],
    groups: AnimationGroup[],
    private readonly _shadows: ShadowGenerator | null,
  ) {
    this.pivot = pivot;
    this.meshes = meshes;
    for (const g of groups) {
      // Clone names come back prefixed; key by the source clip name.
      const key = g.name.replace(/^.*?\|/, "");
      g.stop();
      g.enableBlending = true;
      g.blendingSpeed = 0.08;
      this._groups.set(key, g);
    }
  }

  /** Play the skeletal clip for an AnimationSystem clip. */
  public play(clip: AnimationClip, onDone?: () => void): void {
    if (this._disposed) return;
    const { name, loop } = skeletalClipFor(clip, this.model);
    const group = this._groups.get(name) ?? this._groups.get("Idle");
    if (!group) { onDone?.(); return; }
    if (clip === "hit" || clip === "stagger") this._flashTimer = 0.15;
    if (group === this._current && loop && group.isPlaying) return;

    const prev = this._current;
    this._current = group;
    this._currentName = name;
    group.onAnimationGroupEndObservable.clear();
    if (!loop) {
      group.onAnimationGroupEndObservable.addOnce(() => {
        if (this._current === group) onDone?.();
      });
    }
    group.start(loop, 1.0, group.from, group.to, false);
    if (prev && prev !== group) prev.stop();
  }

  public get currentClip(): string {
    return this._currentName;
  }

  /**
   * Per-frame: measure motion, turn toward the travel direction (or the
   * given look target), scale walk/run playback to ground speed, hit flash.
   */
  public update(dt: number, capsulePos: Vector3, lookAt: Vector3 | null): void {
    if (this._disposed || dt <= 0) return;
    if (this._hasLastPos) {
      const dx = capsulePos.x - this._lastPos.x;
      const dz = capsulePos.z - this._lastPos.z;
      const inst = Math.sqrt(dx * dx + dz * dz) / dt;
      this.speed += (Math.min(inst, 20) - this.speed) * Math.min(1, dt * 8);
      let targetYaw: number | null = null;
      if (lookAt) {
        targetYaw = Math.atan2(lookAt.x - capsulePos.x, lookAt.z - capsulePos.z);
      } else if (inst > 0.4) {
        targetYaw = Math.atan2(dx, dz);
      }
      if (targetYaw !== null) {
        let d = targetYaw - this._yaw;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        this._yaw += d * Math.min(1, dt * 8);
        this.pivot.rotation.y = this._yaw;
      }
    }
    this._lastPos.copyFrom(capsulePos);
    this._hasLastPos = true;

    const g = this._current;
    if (g && (this._currentName.startsWith("Walking") || this._currentName.startsWith("Running"))) {
      const base = this._currentName.startsWith("Running") ? 5.5 : 1.8;
      g.speedRatio = Math.max(0.6, Math.min(1.6, this.speed / base || 1));
    }

    if (this._flashTimer > 0) {
      this._flashTimer -= dt;
      const on = this._flashTimer > 0;
      for (const m of this.meshes) {
        m.renderOverlay = on;
        if (on) { m.overlayColor = HIT_FLASH; m.overlayAlpha = 0.55; }
      }
    }
  }

  /** Pause skeletal evaluation (distance LOD) without losing the clip. */
  public setPaused(paused: boolean): void {
    const g = this._current;
    if (!g) return;
    if (paused && g.isPlaying) g.pause();
    else if (!paused && !g.isPlaying && g.loopAnimation) g.play(true);
  }

  public dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    for (const g of this._groups.values()) g.dispose();
    this._groups.clear();
    for (const m of this.meshes) this._shadows?.removeShadowCaster(m, false);
    this.pivot.dispose(false, false);
  }
}

/**
 * Prepare a loaded KayKit container for cheap instancing:
 *  • the packs enable every weapon/shield variant at once — keep one item per
 *    hand slot (a shield on the left when there is one, a one-hander on the
 *    right);
 *  • merge the skinned body parts that share a material into a single skinned
 *    mesh (6 draw calls + 6 shadow casters → 1 per character).
 */
export function optimizeCharacterContainer(container: AssetContainer, scene: Scene): void {
  const remove = (m: AbstractMesh) => {
    const i = container.meshes.indexOf(m);
    if (i >= 0) container.meshes.splice(i, 1);
    m.dispose(false, false);
  };

  // ── One item per hand slot ───────────────────────────────────────────────
  const slots = new Map<string, AbstractMesh[]>();
  for (const m of container.meshes) {
    const parent = m.parent?.name ?? "";
    if (/handslot/i.test(parent)) {
      const list = slots.get(parent) ?? [];
      list.push(m);
      slots.set(parent, list);
    }
  }
  for (const [slot, items] of slots) {
    const left = /\.l$|left/i.test(slot);
    const score = (name: string) => {
      if (left) return /shield/i.test(name) ? (/badge|round/i.test(name) ? 3 : 2) : /book|offhand/i.test(name) ? 0 : 1;
      if (/^1H|staff|wand|crossbow/i.test(name)) return /offhand/i.test(name) ? 1 : 3;
      return /^2H/i.test(name) ? 1 : 2;
    };
    const keep = items.slice().sort((a, b) => score(b.name) - score(a.name))[0];
    for (const m of items) if (m !== keep) remove(m);
  }

  // ── Merge skinned parts per (parent, skeleton, material) ─────────────────
  const groups = new Map<string, Mesh[]>();
  for (const m of container.meshes) {
    if (!(m instanceof Mesh) || !m.skeleton || !m.material || m.getTotalVertices() === 0) continue;
    const identity = m.position.lengthSquared() < 1e-8
      && (!m.rotationQuaternion || Math.abs(m.rotationQuaternion.w) > 0.99999)
      && m.rotation.lengthSquared() < 1e-8
      && Math.abs(m.scaling.x - 1) + Math.abs(m.scaling.y - 1) + Math.abs(m.scaling.z - 1) < 1e-6;
    if (!identity) continue;
    const key = `${m.parent?.uniqueId ?? "root"}|${m.skeleton.uniqueId}|${m.material.uniqueId}`;
    const g = groups.get(key) ?? [];
    g.push(m);
    groups.set(key, g);
  }
  for (const parts of groups.values()) {
    if (parts.length < 2) continue;
    const parent = parts[0].parent;
    const skeleton = parts[0].skeleton;
    const influencers = parts[0].numBoneInfluencers;
    // Unparent so the merge bakes identity transforms (skinning stays valid).
    for (const p of parts) { p.parent = null; p.computeWorldMatrix(true); }
    const merged = Mesh.MergeMeshes(parts, false, true);
    if (!merged) {
      for (const p of parts) p.parent = parent;
      continue;
    }
    scene.removeMesh(merged);
    merged.name = parts.map((p) => p.name).join("+").slice(0, 60);
    merged.parent = parent;
    merged.skeleton = skeleton;
    merged.numBoneInfluencers = influencers;
    container.meshes.push(merged);
    for (const p of parts) remove(p);
  }
}

interface LibraryEntry {
  container: AssetContainer | null;
  failed: boolean;
  promise: Promise<AssetContainer | null>;
  /** Uniform scale normalising the model to CHARACTER_HEIGHT. */
  scale: number;
}

/** Loads each character GLB once and stamps out rigs. */
export class CharacterModelLibrary {
  private readonly _entries = new Map<CharacterModelId, LibraryEntry>();
  private _counter = 0;

  constructor(
    private readonly _scene: Scene,
    private readonly _baseUrl: string,
    private readonly _shadows: ShadowGenerator | null,
  ) {}

  public preload(ids: readonly CharacterModelId[] = CHARACTER_MODELS_PRELOAD): void {
    for (const id of ids) this._load(id);
  }

  private _load(id: CharacterModelId): LibraryEntry {
    let entry = this._entries.get(id);
    if (entry) return entry;
    const e: LibraryEntry = { container: null, failed: false, scale: 1, promise: Promise.resolve(null) };
    e.promise = SceneLoader.LoadAssetContainerAsync(this._baseUrl, `${id}.glb`, this._scene)
      .then((container) => {
        optimizeCharacterContainer(container, this._scene);
        // Measure standing height from the bind pose.
        let minY = Infinity, maxY = -Infinity;
        for (const m of container.meshes) {
          if (!m.getTotalVertices || m.getTotalVertices() === 0) continue;
          m.computeWorldMatrix(true);
          const bb = m.getBoundingInfo().boundingBox;
          minY = Math.min(minY, bb.minimumWorld.y);
          maxY = Math.max(maxY, bb.maximumWorld.y);
        }
        const h = maxY - minY;
        e.scale = Number.isFinite(h) && h > 0.1 ? CHARACTER_HEIGHT / h : 1;
        for (const mat of container.materials) {
          // Matte, slightly lifted: the pack's flat palette reads better that way.
          const anyMat = mat as unknown as { roughness?: number; metallic?: number; specularColor?: Color3 };
          if (anyMat.roughness !== undefined) anyMat.roughness = Math.max(anyMat.roughness, 0.75);
          if (anyMat.metallic !== undefined) anyMat.metallic = Math.min(anyMat.metallic, 0.1);
        }
        e.container = container;
        return container;
      })
      .catch((err) => {
        console.warn(`[character-models] failed to load ${id}`, err);
        e.failed = true;
        return null;
      });
    this._entries.set(id, e);
    return e;
  }

  /**
   * Attach a rig of `id` to an NPC capsule.  Resolves with null when the
   * model failed to load or the capsule was disposed meanwhile.
   */
  public async attach(capsule: Mesh, id: CharacterModelId): Promise<CharacterRig | null> {
    const entry = this._load(id);
    const container = await entry.promise;
    if (!container || capsule.isDisposed()) return null;

    const tag = `${capsule.name}#${++this._counter}`;
    const inst = container.instantiateModelsToScene((n) => `${tag}|${n}`, false, { doNotInstantiate: true });
    // Group names: keep "<tag>|<clip>" so CharacterRig can strip the prefix.
    for (const g of inst.animationGroups) {
      const clip = g.name.slice(g.name.lastIndexOf("|") + 1);
      g.name = `${tag}|${clip}`;
    }

    const pivot = new TransformNode(`${tag}|pivot`, this._scene);
    pivot.parent = capsule;
    // Capsule origin sits 1 unit above its feet.
    pivot.position.set(0, -1, 0);
    pivot.scaling.setAll(entry.scale);
    for (const node of inst.rootNodes) node.parent = pivot;

    const meshes: AbstractMesh[] = [];
    for (const node of inst.rootNodes) {
      for (const m of node.getChildMeshes(false)) meshes.push(m);
      if ((node as AbstractMesh).getTotalVertices) meshes.push(node as AbstractMesh);
    }
    for (const m of meshes) {
      m.isPickable = false;
      m.receiveShadows = true;
      m.alwaysSelectAsActiveMesh = false;
      this._shadows?.addShadowCaster(m, false);
    }

    // The capsule keeps physics + picking but no longer draws; decorative
    // primitive accessories (helmets, staffs…) are superseded by the model.
    capsule.visibility = 0;
    for (const child of capsule.getChildMeshes(true)) child.setEnabled(false);

    const rig = new CharacterRig(id, pivot, meshes, inst.animationGroups, this._shadows);
    capsule.onDisposeObservable.addOnce(() => rig.dispose());
    rig.play("idle");
    return rig;
  }
}
