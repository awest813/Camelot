/**
 * viewmodel — first-person weapon held in front of the camera.
 *
 * Models: KayKit Adventurers weapons (CC0), `public/model/kaykit/weapons/`.
 * Drawn in rendering group 1 with its own depth clear, so it never clips
 * into walls.  Procedural motion: walk bob, look sway, swing arcs (normal and
 * power), and a raised guard while blocking.
 */
import type { Scene } from "@babylonjs/core/scene";
import type { Camera } from "@babylonjs/core/Cameras/camera";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import "@babylonjs/loaders/glTF";
import type { WeaponArchetype } from "../systems/combat-shared";

interface Pose { px: number; py: number; pz: number; rx: number; ry: number; rz: number }

interface WeaponSpec {
  file: string;
  scale: number;
  /** Resting pose of the grip relative to the camera. */
  rest: Pose;
  /** Optional off-hand shield. */
  shield?: boolean;
}

const SPECS: Record<WeaponArchetype, WeaponSpec> = {
  sword:      { file: "sword_1handed.gltf", scale: 0.32, rest: { px: 0.52, py: -0.5, pz: 1.1, rx: 0.6, ry: -0.15, rz: 0.3 }, shield: true },
  greatsword: { file: "sword_2handed.gltf", scale: 0.32, rest: { px: 0.42, py: -0.5, pz: 1.0, rx: 0.65, ry: -0.2, rz: 0.55 } },
  axe:        { file: "axe_1handed.gltf",   scale: 0.36, rest: { px: 0.52, py: -0.46, pz: 1.0, rx: 0.5, ry: -0.4, rz: 0.3 }, shield: true },
  mace:       { file: "axe_2handed.gltf",   scale: 0.3, rest: { px: 0.46, py: -0.5, pz: 1.0, rx: 0.55, ry: -0.4, rz: 0.45 } },
  dagger:     { file: "dagger.gltf",        scale: 0.5,  rest: { px: 0.42, py: -0.4, pz: 0.95, rx: 1.1, ry: 0.0, rz: 0.2 } },
  staff:      { file: "staff.gltf",         scale: 0.42, rest: { px: 0.42, py: -0.62, pz: 1.05, rx: 0.25, ry: 0.0, rz: 0.12 } },
  bow:        { file: "crossbow_1handed.gltf", scale: 0.5, rest: { px: 0.3, py: -0.36, pz: 1.0, rx: 1.45, ry: 0.0, rz: 0.0 } },
};

const SHIELD_REST: Pose = { px: -0.62, py: -0.48, pz: 1.1, rx: 0.15, ry: 0.55, rz: -0.1 };
const RENDER_GROUP = 1;

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const easeOut = (t: number): number => 1 - (1 - t) * (1 - t);
const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function applyPose(node: TransformNode, p: Pose): void {
  node.position.set(p.px, p.py, p.pz);
  node.rotation.set(p.rx, p.ry, p.rz);
}

export class WeaponViewModel {
  private readonly _root: TransformNode;
  private readonly _hand: TransformNode;
  private readonly _off: TransformNode;
  private readonly _cache = new Map<string, Promise<AbstractMesh[] | null>>();
  private _weapon: WeaponArchetype | null = null;
  private _weaponMeshes: AbstractMesh[] = [];
  private _shieldMeshes: AbstractMesh[] = [];
  private _swingT = -1;
  private _swingDur = 0.32;
  private _swingPower = false;
  private _swingDir = 1;
  private _block = 0;
  private _bobPhase = 0;
  private _bobAmt = 0;
  private _swayX = 0;
  private _swayY = 0;
  private _lastYaw = 0;
  private _lastPitch = 0;
  private readonly _lastPos = new Vector3();
  private _visible = true;
  private _generation = 0;

  constructor(private readonly _scene: Scene, private readonly _camera: Camera, private readonly _baseUrl: string) {
    // The weapon sits ~1 unit from the eye; pull the near plane in so it
    // isn't clipped.  (Far plane trimmed to keep depth precision.)
    _camera.minZ = 0.1;
    _camera.maxZ = 2400;
    _scene.setRenderingAutoClearDepthStencil(RENDER_GROUP, true, true, true);
    this._root = new TransformNode("viewmodelRoot", _scene);
    this._root.parent = _camera;
    this._hand = new TransformNode("viewmodelHand", _scene);
    this._hand.parent = this._root;
    this._off = new TransformNode("viewmodelOffHand", _scene);
    this._off.parent = this._root;
    applyPose(this._off, SHIELD_REST);
    this._lastPos.copyFrom(_camera.position);
  }

  private _load(file: string): Promise<AbstractMesh[] | null> {
    let p = this._cache.get(file);
    if (!p) {
      p = SceneLoader.ImportMeshAsync("", this._baseUrl, file, this._scene)
        .then((res) => {
          for (const m of res.meshes) {
            m.isPickable = false;
            m.renderingGroupId = RENDER_GROUP;
            m.receiveShadows = false;
            m.setEnabled(false);
            m.doNotSyncBoundingInfo = true;
            m.alwaysSelectAsActiveMesh = true;
          }
          return res.meshes;
        })
        .catch((err) => {
          console.warn(`[viewmodel] failed to load ${file}`, err);
          return null;
        });
      this._cache.set(file, p);
    }
    return p;
  }

  /** Show the model for a combat weapon archetype. */
  public setWeapon(archetype: WeaponArchetype): void {
    if (archetype === this._weapon) return;
    this._weapon = archetype;
    const spec = SPECS[archetype] ?? SPECS.sword;
    const gen = ++this._generation;
    for (const m of this._weaponMeshes) m.setEnabled(false);
    void this._load(spec.file).then((meshes) => {
      if (!meshes || gen !== this._generation) return;
      const root = meshes[0];
      root.parent = this._hand;
      root.position.setAll(0);
      root.scaling.setAll(spec.scale);
      this._weaponMeshes = meshes;
      for (const m of meshes) m.setEnabled(this._visible);
    });
    if (spec.shield) {
      void this._load("shield_round.gltf").then((meshes) => {
        if (!meshes || gen !== this._generation) return;
        const root = meshes[0];
        root.parent = this._off;
        root.position.setAll(0);
        root.scaling.setAll(0.34);
        this._shieldMeshes = meshes;
        for (const m of meshes) m.setEnabled(this._visible);
      });
    } else {
      for (const m of this._shieldMeshes) m.setEnabled(false);
      this._shieldMeshes = [];
    }
  }

  /** Start a swing arc.  Alternates direction for combos. */
  public swing(power = false): void {
    this._swingT = 0;
    this._swingPower = power;
    this._swingDur = power ? 0.55 : 0.32;
    this._swingDir = -this._swingDir;
  }

  public setVisible(visible: boolean): void {
    if (visible === this._visible) return;
    this._visible = visible;
    for (const m of this._weaponMeshes) m.setEnabled(visible);
    for (const m of this._shieldMeshes) m.setEnabled(visible);
  }

  /** Per frame. */
  public update(dt: number, opts: { blocking: boolean; sprinting: boolean }): void {
    if (dt <= 0) return;
    const spec = SPECS[this._weapon ?? "sword"];
    const cam = this._camera as Camera & { rotation?: Vector3 };

    // Walk bob from horizontal camera speed.
    const dx = this._camera.position.x - this._lastPos.x;
    const dz = this._camera.position.z - this._lastPos.z;
    this._lastPos.copyFrom(this._camera.position);
    const speed = Math.min(12, Math.sqrt(dx * dx + dz * dz) / dt);
    const targetBob = Math.min(1, speed / 4);
    this._bobAmt += (targetBob - this._bobAmt) * Math.min(1, dt * 8);
    this._bobPhase += dt * (opts.sprinting ? 11 : 7.5) * (0.4 + this._bobAmt * 0.6);

    // Look sway: lag behind rotation deltas.
    const yaw = cam.rotation?.y ?? 0;
    const pitch = cam.rotation?.x ?? 0;
    let dyaw = yaw - this._lastYaw;
    if (dyaw > Math.PI) dyaw -= Math.PI * 2;
    if (dyaw < -Math.PI) dyaw += Math.PI * 2;
    const dpitch = pitch - this._lastPitch;
    this._lastYaw = yaw;
    this._lastPitch = pitch;
    this._swayX += (-dyaw * 1.6 - this._swayX) * Math.min(1, dt * 10);
    this._swayY += (dpitch * 1.6 - this._swayY) * Math.min(1, dt * 10);

    this._block += ((opts.blocking ? 1 : 0) - this._block) * Math.min(1, dt * 12);

    const r = spec.rest;
    const bobX = Math.sin(this._bobPhase) * 0.018 * this._bobAmt;
    const bobY = -Math.abs(Math.cos(this._bobPhase)) * 0.022 * this._bobAmt;
    const pose: Pose = {
      px: r.px + bobX + this._swayX * 0.3,
      py: r.py + bobY + this._swayY * 0.3 + (opts.sprinting ? -0.05 : 0),
      pz: r.pz,
      rx: r.rx + (opts.sprinting ? 0.25 : 0),
      ry: r.ry + this._swayX * 0.5,
      rz: r.rz,
    };

    // Guard: weapon across the body.
    if (this._block > 0.01) {
      const b = easeInOut(this._block);
      pose.px = lerp(pose.px, 0.12, b);
      pose.py = lerp(pose.py, -0.22, b);
      pose.rx = lerp(pose.rx, 0.2, b);
      pose.ry = lerp(pose.ry, -0.2, b);
      pose.rz = lerp(pose.rz, 1.35, b);
    }

    // Swing: wind-up, slash across, recover.
    if (this._swingT >= 0) {
      this._swingT += dt / this._swingDur;
      const t = Math.min(1, this._swingT);
      const dir = this._swingDir;
      const amp = this._swingPower ? 1.35 : 1.0;
      // Offsets for the wind-up (W) and follow-through (F) key poses.
      const W = { px: 0.12 * dir, py: 0.16, pz: -0.05, rx: -0.6, rz: -0.55 * dir };
      const F = { px: -0.38 * dir, py: -0.16, pz: 0.12, rx: 1.05, rz: 1.0 * dir };
      let a: typeof W, b: typeof W, u: number;
      const zero = { px: 0, py: 0, pz: 0, rx: 0, rz: 0 };
      if (t < 0.25) { a = zero; b = W; u = easeOut(t / 0.25); }
      else if (t < 0.55) { a = W; b = F; u = easeInOut((t - 0.25) / 0.3); }
      else { a = F; b = zero; u = easeInOut((t - 0.55) / 0.45); }
      pose.px += lerp(a.px, b.px, u) * amp;
      pose.py += lerp(a.py, b.py, u) * amp;
      pose.pz += lerp(a.pz, b.pz, u);
      pose.rx += lerp(a.rx, b.rx, u) * amp;
      pose.rz += lerp(a.rz, b.rz, u) * amp;
      if (this._swingT >= 1) this._swingT = -1;
    }

    applyPose(this._hand, pose);
    const s = SHIELD_REST;
    this._off.position.set(s.px + bobX * 0.8 + this._swayX * 0.25 + this._block * 0.25, s.py + bobY + this._block * 0.18, s.pz);
    this._off.rotation.set(s.rx, s.ry - this._block * 0.4, s.rz);
  }

  public dispose(): void {
    this._root.dispose(false, false);
  }
}
