/**
 * A companion's body in the world: an upright capsule that walks after a
 * point (the player), with a physics body when the scene has a physics
 * engine (headless tests have none: it then stands still).
 *
 * Followers use it; behaviour (whom to follow, whom to strike) is the
 * owner's.
 */
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsMotionType, PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import type { Scene } from "@babylonjs/core/scene";

export interface CompanionLook {
  name: string;
  radius: number;
  height: number;
  color: { r: number; g: number; b: number };
}

export type CompanionGait = "idle" | "walk" | "run";

/** Further than this (m) from the player, a companion catches up at once (fast travel, a doorway). */
export const COMPANION_CATCH_UP = 60;

export class CompanionBody {
  public readonly mesh: Mesh;
  private readonly _agg: PhysicsAggregate | null = null;
  private readonly _vel = new Vector3();
  private readonly _look = new Vector3();

  constructor(scene: Scene, look: CompanionLook, at: { x: number; y: number; z: number }) {
    const mesh = MeshBuilder.CreateCapsule(look.name, { radius: look.radius, height: look.height }, scene);
    mesh.position.set(at.x, at.y, at.z);
    const mat = new StandardMaterial(`${look.name}_mat`, scene);
    mat.diffuseColor = new Color3(look.color.r, look.color.g, look.color.b);
    mat.specularColor = new Color3(0.08, 0.07, 0.06);
    mesh.material = mat;
    mesh.receiveShadows = true;
    if (scene.getPhysicsEngine?.()) {
      const agg = new PhysicsAggregate(mesh, PhysicsShapeType.CAPSULE, { mass: 1, restitution: 0 }, scene);
      agg.body.setMotionType(PhysicsMotionType.DYNAMIC);
      agg.body.setMassProperties({ inertia: new Vector3(0, 0, 0) });
      this._agg = agg;
    }
    this.mesh = mesh;
  }

  public get position(): Vector3 { return this.mesh.position; }

  /** Put the body somewhere at once (catching up after travel). */
  public placeAt(at: { x: number; y: number; z: number }): void {
    this.mesh.position.set(at.x, at.y, at.z);
    const b = this._agg?.body;
    if (!b) return;
    b.setLinearVelocity(this._vel.set(0, 0, 0));
    // Let one physics step read the moved transform.
    b.disablePreStep = false;
    this.mesh.getScene().onAfterPhysicsObservable.addOnce(() => { b.disablePreStep = true; });
  }

  /** Walk toward `to`, stopping `keep` metres short; how it is moving now. */
  public steer(to: { x: number; z: number }, keep: number, speed: number, dt: number): CompanionGait {
    const p = this.mesh.position;
    const dx = to.x - p.x, dz = to.z - p.z;
    const distSq = dx * dx + dz * dz;
    const body = this._agg?.body;
    if (distSq <= keep * keep) {
      this.stop();
      return "idle";
    }
    if (!body) return "idle";
    const dist = Math.sqrt(distSq);
    const far = dist > keep + 5;
    const v = far ? speed : speed * 0.6;
    const nx = (dx / dist) * v, nz = (dz / dist) * v;
    body.getLinearVelocityToRef(this._vel);
    const blend = Math.min(1, 8 * dt);
    const cur = this._vel;
    body.setLinearVelocity(cur.set(cur.x + (nx - cur.x) * blend, cur.y, cur.z + (nz - cur.z) * blend));
    this.face(p.x + nx, p.z + nz);
    return far ? "run" : "walk";
  }

  /** Stand still (keeping any fall). */
  public stop(): void {
    const body = this._agg?.body;
    if (!body) return;
    body.getLinearVelocityToRef(this._vel);
    body.setLinearVelocity(this._vel.set(0, this._vel.y, 0));
  }

  public face(x: number, z: number): void {
    this._look.set(x, this.mesh.position.y, z);
    this.mesh.lookAt(this._look);
  }

  /** Freeze in place (a death pose plays on the mesh). */
  public freeze(): void {
    this._agg?.body.setMotionType(PhysicsMotionType.STATIC);
  }

  public dispose(): void {
    this._agg?.dispose();
    this.mesh.dispose();
  }
}
