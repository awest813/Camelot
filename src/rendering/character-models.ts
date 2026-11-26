/**
 * character-models — rigged, animated humanoids for NPCs.
 *
 * Models:
 *  • Humans: Quaternius "Modular Character Outfits – Fantasy" peasants and
 *    rangers plus a "Characters – Fantasy Races" orc (CC0), imported into
 *    `public/model/quaternius/characters/` by `tools/import-quaternius.mjs`.
 *    They ship without clips; animation comes from Quaternius' Universal
 *    Animation Library (same 65-bone rig), compacted to
 *    `public/model/quaternius/animations/UAL_Clips.glb` and cloned onto each
 *    rig by bone name.
 *  • Undead: KayKit "Skeletons" (CC0, dark-graded) in `public/model/kaykit/`,
 *    compacted to the clips we play with `tools/compact-glb.py`.
 *
 * Each GLB is loaded once into an AssetContainer and instantiated per NPC
 * (cloned skeleton + animation groups, shared materials).  The rig is
 * parented to the NPC's physics capsule, which stops rendering
 * (`visibility = 0`) but stays pickable, so interaction, combat raycasts and
 * physics are untouched.
 */
import { asyncWork } from "../core/async-work";
import type { Scene } from "@babylonjs/core/scene";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import type { AssetContainer } from "@babylonjs/core/assetContainer";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import "@babylonjs/loaders/glTF";
import type { AnimationClip } from "../systems/animation-system";

export type QuaterniusHumanId = "Peasant_Male" | "Peasant_Female" | "Ranger_Male" | "Ranger_Female" | "Orc_Brute";

export type CharacterModelId =
  | "Knight" | "Barbarian" | "Mage" | "Rogue" | "Rogue_Hooded"
  | "Skeleton_Warrior" | "Skeleton_Mage" | "Skeleton_Rogue" | "Skeleton_Minion"
  | QuaterniusHumanId;

export const CHARACTER_MODEL_IDS: readonly CharacterModelId[] = [
  "Knight", "Barbarian", "Mage", "Rogue", "Rogue_Hooded",
  "Skeleton_Warrior", "Skeleton_Mage", "Skeleton_Rogue", "Skeleton_Minion",
  "Peasant_Male", "Peasant_Female", "Ranger_Male", "Ranger_Female", "Orc_Brute",
];

/** Models worth fetching at boot (the rest load on first use). */
export const CHARACTER_MODELS_PRELOAD: readonly CharacterModelId[] = [
  "Ranger_Male", "Peasant_Male", "Skeleton_Warrior",
];

/** Quaternius humans: file under `model/quaternius/characters/` (see tools/quaternius-slot-map.json). */
export const QUATERNIUS_HUMAN_FILES: Readonly<Record<QuaterniusHumanId, string>> = {
  Peasant_Male:   "VillagerMale.glb",
  Peasant_Female: "VillagerFemale.glb",
  Ranger_Male:    "Archer.glb",
  Ranger_Female:  "Rogue.glb",
  Orc_Brute:      "Barbarian.glb",
};

/** Shared Universal Animation Library clips for the Quaternius rig. */
export const UAL_CLIPS_FILE = "UAL_Clips.glb";

export const isQuaterniusHuman = (m: CharacterModelId): m is QuaterniusHumanId =>
  Object.prototype.hasOwnProperty.call(QUATERNIUS_HUMAN_FILES, m);

const isSkeleton = (m: CharacterModelId): boolean => m.startsWith("Skeleton_");

/** Stable 0..1 hash of a name (for per-NPC variety that survives reloads). */
function nameHash(name: string): number {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

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
  // Humans are Quaternius outfit characters; gender varies by name hash.
  const female = nameHash(name) < 0.45;
  if (/chief|warlord|brute|barbarian|orc/.test(n)) return "Orc_Brute";
  if (/guard|knight|soldier|captain|bandit|outlaw|robber|pirate|archer|ranger|hunter|scout|thief|rogue|assassin|instructor|battlemage|mage|wizard|sorcer|witch|priest|healer/.test(n)) {
    return female ? "Ranger_Female" : "Ranger_Male";
  }
  return female ? "Peasant_Female" : "Peasant_Male";
}

/** UAL clip for an AnimationSystem clip on a Quaternius human. */
function ualClipFor(clip: AnimationClip, model: QuaterniusHumanId): { name: string; loop: boolean } {
  const armed = model.startsWith("Ranger") || model === "Orc_Brute";
  switch (clip) {
    case "idle":        return { name: "Idle_Loop", loop: true };
    case "walk":
    case "return":      return { name: "Walk_Loop", loop: true };
    case "investigate": return { name: "Walk_Formal_Loop", loop: true };
    case "run":         return { name: "Jog_Fwd_Loop", loop: true };
    case "alert":       return { name: armed ? "Sword_Idle" : "Idle_Loop", loop: true };
    case "victory":     return { name: "Idle_Talking_Loop", loop: true };
    case "spawn":       return { name: "Idle_Loop", loop: false };
    case "telegraph":   return { name: armed ? "Sword_Attack" : "Punch_Jab", loop: false };
    case "stagger":     return { name: "Hit_Head", loop: false };
    case "hit":         return { name: "Hit_Chest", loop: false };
    case "death":       return { name: "Death01", loop: false };
    default:            return { name: "Idle_Loop", loop: true };
  }
}

/** Skeletal clip names played for each AnimationSystem clip, per model. */
export function skeletalClipFor(clip: AnimationClip, model: CharacterModelId): { name: string; loop: boolean } {
  if (isQuaterniusHuman(model)) return ualClipFor(clip, model);
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
/** Detail level: 0 the full model, 1 its LOD (NPCs 40 m and farther). */
export type RigDetail = 0 | 1;

/** Makes a rig's LOD meshes, bound to the rig's skeleton (null: the model has none). */
export type LodMaker = (rig: CharacterRig) => Promise<AbstractMesh[] | null>;

export class CharacterRig {
  /** Yaw pivot under the capsule; rotate this to face a direction. */
  public readonly pivot: TransformNode;
  public readonly meshes: AbstractMesh[];
  /** The LOD's meshes, once made. */
  public lodMeshes: AbstractMesh[] | null = null;
  private _detail: RigDetail = 0;
  private _lodRequested = false;
  /** Set by the library when the model has a LOD. */
  public makeLod: LodMaker | null = null;
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
    const group = this._groups.get(name) ?? this._groups.get("Idle") ?? this._groups.get("Idle_Loop");
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
    const clipName = this._currentName;
    const running = clipName.startsWith("Running") || clipName.startsWith("Jog") || clipName.startsWith("Sprint");
    if (g && (running || clipName.startsWith("Walk"))) {
      const base = running ? 5.5 : 1.8;
      g.speedRatio = Math.max(0.6, Math.min(1.6, this.speed / base || 1));
    }

    if (this._flashTimer > 0) {
      this._flashTimer -= dt;
      const on = this._flashTimer > 0;
      for (const m of this.lodMeshes ? [...this.meshes, ...this.lodMeshes] : this.meshes) {
        m.renderOverlay = on;
        if (on) { m.overlayColor = HIT_FLASH; m.overlayAlpha = 0.55; }
      }
    }
  }

  public get detail(): RigDetail {
    return this._detail;
  }

  /**
   * Full model (0) or its LOD (1).  The LOD is made on first use; until it
   * is ready (or when the model has none) the full model stays.
   */
  public setDetail(detail: RigDetail): void {
    if (this._disposed) return;
    this._detail = detail;
    if (detail === 1 && !this.lodMeshes && !this._lodRequested && this.makeLod) {
      this._lodRequested = true;
      void this.makeLod(this).then((lod) => {
        if (!lod) return;
        if (this._disposed) { for (const m of lod) m.dispose(false, false); return; }
        this.lodMeshes = lod;
        this._applyDetail();
      });
    }
    this._applyDetail();
  }

  private _applyDetail(): void {
    const lod = this._detail === 1 && !!this.lodMeshes;
    // Only parts with geometry: the empty glTF parent nodes hold LOD parts too.
    for (const m of this.meshes) if (m.getTotalVertices() > 0 && m.isEnabled(false) === lod) m.setEnabled(!lod);
    for (const m of this.lodMeshes ?? []) if (m.isEnabled(false) !== lod) m.setEnabled(lod);
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
    for (const m of this.lodMeshes ?? []) this._shadows?.removeShadowCaster(m, false);
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
    // Parts can only merge when they carry the same vertex attributes
    // (Quaternius outfit pieces differ in extra UV / colour sets).
    const kinds = m.getVerticesDataKinds().slice().sort().join(",");
    const key = `${m.parent?.uniqueId ?? "root"}|${m.skeleton.uniqueId}|${m.material.uniqueId}|${kinds}`;
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

/**
 * A rig's parts smaller than this share of its largest part (bounding
 * radius) cast no shadow: eyes and eyebrows sit inside the body's
 * silhouette, and each part is a draw per shadow cascade.
 */
export const MIN_SHADOW_PART_SHARE = 0.2;
/** The parts of a rig (or of its LOD) that cast shadows. */
export function shadowParts(parts: AbstractMesh[]): AbstractMesh[] {
  const drawn = parts.filter((m) => m.getTotalVertices() > 0);
  const largest = Math.max(0, ...drawn.map((m) => m.getBoundingInfo().boundingSphere.radius));
  return drawn.filter((m) => m.getBoundingInfo().boundingSphere.radius >= largest * MIN_SHADOW_PART_SHARE);
}

/** The last name segment: "<tag>|<lod>|Body" → "Body". */
const baseName = (name: string): string => name.slice(name.lastIndexOf("|") + 1);

/** public/model/manifest.json (tools/build-character-lods.mjs): which models have a LOD. */
interface ModelManifest { models: Record<string, { lod1?: { file: string } }> }

/** Marks a rig's shadow-only proxy (see buildShadowProxies). */
const SHADOW_PROXY = "shadowProxy";

/**
 * One shadow caster per skeleton: the model's skinned parts merged into a
 * single mesh (positions, indices and skin only) that the camera never
 * draws (layer mask 0; the shadow pass doesn't check layers) but the
 * shadow map does.  A rig casts in one draw per cascade instead of one per
 * part.  Built on the template, so every rig clones it with its skeleton.
 */
export function buildShadowProxies(container: AssetContainer, scene: Scene): void {
  const bySkeleton = new Map<unknown, Mesh[]>();
  for (const m of container.meshes) {
    if (!(m instanceof Mesh) || !m.skeleton || m.getTotalVertices() === 0) continue;
    const list = bySkeleton.get(m.skeleton) ?? [];
    list.push(m);
    bySkeleton.set(m.skeleton, list);
  }
  for (const parts of bySkeleton.values()) {
    if (parts.length < 2) continue;
    const kinds = [VertexBuffer.PositionKind, VertexBuffer.MatricesIndicesKind, VertexBuffer.MatricesWeightsKind];
    const extra = parts.every((p) => p.isVerticesDataPresent(VertexBuffer.MatricesIndicesExtraKind));
    if (extra) kinds.push(VertexBuffer.MatricesIndicesExtraKind, VertexBuffer.MatricesWeightsExtraKind);
    const data: Record<string, number[]> = Object.fromEntries(kinds.map((k) => [k, [] as number[]]));
    const indices: number[] = [];
    let base = 0;
    for (const p of parts) {
      const n = p.getTotalVertices();
      for (const k of kinds) {
        const d = p.getVerticesData(k);
        if (!d) return; // a part without skin data: leave this skeleton alone
        for (let i = 0; i < d.length; i++) data[k].push(d[i]);
      }
      const idx = p.getIndices() ?? [];
      for (let i = 0; i < idx.length; i++) indices.push(idx[i] + base);
      base += n;
    }
    const proxy = new Mesh(`${parts[0].name}_${SHADOW_PROXY}`, scene);
    for (const k of kinds) proxy.setVerticesData(k, data[k], false);
    proxy.setIndices(indices);
    scene.removeMesh(proxy);
    proxy.parent = parts[0].parent;
    proxy.position.copyFrom(parts[0].position);
    if (parts[0].rotationQuaternion) proxy.rotationQuaternion = parts[0].rotationQuaternion.clone();
    proxy.scaling.copyFrom(parts[0].scaling);
    proxy.skeleton = parts[0].skeleton;
    proxy.numBoneInfluencers = parts[0].numBoneInfluencers;
    proxy.layerMask = 0;
    proxy.isPickable = false;
    proxy.metadata = { [SHADOW_PROXY]: true };
    container.meshes.push(proxy);
  }
}

const isShadowProxy = (m: AbstractMesh): boolean => !!(m.metadata as Record<string, unknown> | null)?.[SHADOW_PROXY];

interface LibraryEntry {
  /** The model's path under public/model ("kaykit/Knight.glb"), the manifest's key. */
  key: string;
  /** Its LOD's container (loaded on first use), or null when it has none. */
  lod: Promise<AssetContainer | null> | null;
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
  private _ualClips: Promise<AssetContainer | null> | null = null;
  private _manifest: Promise<ModelManifest | null> | null = null;
  /** Folder holding the Quaternius humans (characters/) and UAL clips (animations/). */
  private readonly _quaterniusBase: string;

  constructor(
    private readonly _scene: Scene,
    private readonly _baseUrl: string,
    private readonly _shadows: ShadowGenerator | null,
    quaterniusBase?: string,
  ) {
    this._quaterniusBase = quaterniusBase ?? _baseUrl.replace(/kaykit\/?$/, "quaternius/");
  }

  /** The shared Universal Animation Library clip container (loaded once). */
  private _loadUalClips(): Promise<AssetContainer | null> {
    if (!this._ualClips) {
      this._ualClips = asyncWork.ordered(SceneLoader.LoadAssetContainerAsync(`${this._quaterniusBase}animations/`, UAL_CLIPS_FILE, this._scene))
        .catch((err) => {
          console.warn("[character-models] failed to load UAL clips", err);
          return null;
        });
    }
    return this._ualClips;
  }

  /** The model folder (parent of kaykit/ and quaternius/). */
  private get _modelRoot(): string {
    return this._baseUrl.replace(/kaykit\/?$/, "");
  }

  private _loadManifest(): Promise<ModelManifest | null> {
    this._manifest ??= asyncWork.ordered(fetch(`${this._modelRoot}manifest.json`))
      .then((r) => (r.ok ? (r.json() as Promise<ModelManifest>) : null))
      .catch(() => null);
    return this._manifest;
  }

  /** A model's LOD container, prepared like the full model (loaded once, on first use). */
  private _loadLod(e: LibraryEntry): Promise<AssetContainer | null> {
    e.lod ??= this._loadManifest().then((manifest) => {
      const file = manifest?.models[e.key]?.lod1?.file;
      if (!file) return null;
      const slash = file.lastIndexOf("/");
      return asyncWork.ordered(SceneLoader.LoadAssetContainerAsync(this._modelRoot + file.slice(0, slash + 1), file.slice(slash + 1), this._scene))
        .then((c) => { optimizeCharacterContainer(c, this._scene); return c; });
    }).catch((err) => {
      console.warn(`[character-models] no LOD for ${e.key}`, err);
      return null;
    });
    return e.lod;
  }

  /**
   * The rig's LOD meshes: the LOD stamped out, each skinned mesh moved onto
   * the rig's skeleton (same joints, same order: the LOD is the same skin),
   * under the rig's node of the same name, with the rig's material of the
   * same name.  The LOD's own nodes and skeleton are dropped.
   */
  private async _makeLod(rig: CharacterRig, e: LibraryEntry, tag: string): Promise<AbstractMesh[] | null> {
    const container = await this._loadLod(e);
    if (!container) return null;
    const inst = container.instantiateModelsToScene((n) => `${tag}|lod|${n}`, false, { doNotInstantiate: true });
    for (const g of inst.animationGroups) g.dispose();
    const skeletons = new Set(rig.meshes.map((m) => m.skeleton).filter((k): k is NonNullable<typeof k> => !!k));
    const nodes = new Map<string, TransformNode>();
    // Parents: the rig's nodes (bones' nodes, empty glTF parents), never a drawn part.
    for (const n of rig.pivot.getDescendants(false)) {
      if (n instanceof TransformNode && !(n instanceof Mesh && n.getTotalVertices() > 0)) nodes.set(baseName(n.name), n);
    }
    const materials = new Map(rig.meshes.filter((m) => m.material).map((m) => [baseName(m.material!.name), m.material!]));
    const out: AbstractMesh[] = [];
    for (const root of inst.rootNodes) {
      for (const m of [root, ...root.getDescendants(false)]) {
        if (!(m instanceof Mesh) || m.getTotalVertices() === 0) continue;
        const own = m.skeleton;
        const target = own
          ? [...skeletons].find((k) => k.bones.length === own.bones.length
            && k.bones.every((b, i) => baseName(b.name) === baseName(own.bones[i].name)))
          : undefined;
        if (own && !target) continue; // no matching skeleton: leave this part out
        // Same hierarchy, so the local transform carries over as it is.
        const parent = m.parent ? nodes.get(baseName(m.parent.name)) : undefined;
        m.parent = parent ?? rig.pivot;
        if (target) m.skeleton = target;
        const mat = m.material ? materials.get(baseName(m.material.name)) : undefined;
        if (mat) m.material = mat;
        m.isPickable = false;
        m.receiveShadows = true;
        m.setEnabled(false);
        out.push(m);
      }
    }
    const kept = new Set<unknown>(out);
    // The rest of the stamp (its nodes and skeleton) is not needed; the
    // kept meshes have moved out from under it.
    for (const root of inst.rootNodes) if (!kept.has(root)) root.dispose(false, false);
    for (const k of inst.skeletons) k.dispose();
    // At LOD distance eyes and eyebrows are below a pixel: leave them out
    // (each is a draw).  The full model's shadow proxy keeps casting.
    const visible = new Set(shadowParts(out));
    for (const m of out) if (!visible.has(m)) m.dispose(false, false);
    const lod = out.filter((m) => visible.has(m));
    return lod.length > 0 ? lod : null;
  }

  public preload(ids: readonly CharacterModelId[] = CHARACTER_MODELS_PRELOAD): void {
    for (const id of ids) this._load(id);
  }

  private _load(id: CharacterModelId): LibraryEntry {
    let entry = this._entries.get(id);
    if (entry) return entry;
    const [root, file] = isQuaterniusHuman(id)
      ? [`${this._quaterniusBase}characters/`, QUATERNIUS_HUMAN_FILES[id]]
      : [this._baseUrl, `${id}.glb`];
    const key = (root + file).slice(this._modelRoot.length);
    const e: LibraryEntry = { key, lod: null, container: null, failed: false, scale: 1, promise: Promise.resolve(null) };
    if (isQuaterniusHuman(id)) void this._loadUalClips();
    e.promise = asyncWork.ordered(SceneLoader.LoadAssetContainerAsync(root, file, this._scene))
      .then((container) => {
        optimizeCharacterContainer(container, this._scene);
        buildShadowProxies(container, this._scene);
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
    const clips = isQuaterniusHuman(id) ? await this._loadUalClips() : null;
    if (!container || capsule.isDisposed()) return null;

    const tag = `${capsule.name}#${++this._counter}`;
    const inst = container.instantiateModelsToScene((n) => `${tag}|${n}`, false, { doNotInstantiate: true });
    // Group names: keep "<tag>|<clip>" so CharacterRig can strip the prefix.
    for (const g of inst.animationGroups) {
      const clip = g.name.slice(g.name.lastIndexOf("|") + 1);
      g.name = `${tag}|${clip}`;
    }
    if (clips) {
      // Retarget the shared UAL clips onto this rig's bone nodes by name.
      const byName = new Map<string, unknown>();
      for (const root of inst.rootNodes) {
        for (const node of [root, ...root.getDescendants(false)]) {
          byName.set(node.name.slice(node.name.lastIndexOf("|") + 1), node);
        }
      }
      for (const group of clips.animationGroups) {
        const cloned = new AnimationGroup(`${tag}|${group.name}`, this._scene);
        for (const ta of group.targetedAnimations) {
          const target = byName.get((ta.target as { name?: string })?.name ?? "");
          if (target) cloned.addTargetedAnimation(ta.animation, target);
        }
        cloned.normalize(group.from, group.to);
        inst.animationGroups.push(cloned);
      }
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
    }
    // Casters: the shadow proxy for the skinned parts (one draw), and the
    // other parts big enough to show (weapons, shields).
    const proxies = meshes.filter(isShadowProxy);
    const skinnedCovered = proxies.length > 0;
    for (const m of proxies) this._shadows?.addShadowCaster(m, false);
    for (const m of shadowParts(meshes.filter((m) => !isShadowProxy(m)))) {
      if (!(skinnedCovered && m.skeleton)) this._shadows?.addShadowCaster(m, false);
    }
    // The proxy is not part of the drawn rig (detail switching, hit flash).
    const drawn = meshes.filter((m) => !isShadowProxy(m));
    meshes.length = 0;
    meshes.push(...drawn);

    // The capsule keeps physics + picking but no longer draws; decorative
    // primitive accessories (helmets, staffs…) are superseded by the model.
    capsule.visibility = 0;
    for (const child of capsule.getChildMeshes(true)) child.setEnabled(false);

    const rig = new CharacterRig(id, pivot, meshes, inst.animationGroups, this._shadows);
    rig.makeLod = (r) => this._makeLod(r, entry, tag);
    capsule.onDisposeObservable.addOnce(() => rig.dispose());
    rig.play("idle");
    return rig;
  }
}
