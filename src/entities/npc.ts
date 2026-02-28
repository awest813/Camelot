import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType, PhysicsMotionType } from "@babylonjs/core/Physics";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";

export class NPC {
  public mesh: Mesh;
  public physicsAggregate: PhysicsAggregate;
  public scene: Scene;

  // Schedule/AI properties
  public targetPosition: Vector3 | null = null;
  public moveSpeed: number = 2;
  public patrolPoints: Vector3[] = [];
  public currentPatrolIndex: number = 0;
  public waitTime: number = 0;

  // Health
  public health: number = 100;
  public maxHealth: number = 100;
  public isDead: boolean = false;

  // Combat AI
  public isAggressive: boolean = false;
  public aggroRange: number = 12;
  public attackRange: number = 2.5;
  public attackDamage: number = 5;
  public attackTimer: number = 0;
  public attackCooldown: number = 2; // seconds between attacks
  public xpReward: number = 25;

  private _baseColor: Color3 = Color3.Yellow();

  constructor(scene: Scene, position: Vector3, name: string) {
    this.scene = scene;
    this._createMesh(position, name);
  }

  public takeDamage(amount: number): void {
    if (this.isDead) return;
    this.health = Math.max(0, this.health - amount);
    this._flashHit();
    if (this.health <= 0) {
      this._die();
    }
  }

  private _flashHit(): void {
    const mat = this.mesh.material as StandardMaterial;
    mat.diffuseColor = Color3.Red();
    setTimeout(() => {
      if (!this.isDead) mat.diffuseColor = this._baseColor.clone();
    }, 150);
  }

  private _die(): void {
    this.isDead = true;
    this.isAggressive = false;
    const mat = this.mesh.material as StandardMaterial;
    mat.diffuseColor = new Color3(0.3, 0.3, 0.3);
    this.physicsAggregate.body.setMotionType(PhysicsMotionType.STATIC);
    // Remove interaction metadata so dead NPCs can't be targeted
    this.mesh.metadata = null;
  }

  private _createMesh(position: Vector3, name: string): void {
    // Simple Capsule for NPC
    this.mesh = MeshBuilder.CreateCapsule(name, { radius: 0.5, height: 2 }, this.scene);
    this.mesh.position = position;

    // Color it yellow
    const material = new StandardMaterial(`${name}_mat`, this.scene);
    material.diffuseColor = Color3.Yellow();
    this.mesh.material = material;

    // Physics
    this.physicsAggregate = new PhysicsAggregate(this.mesh, PhysicsShapeType.CAPSULE, { mass: 1, restitution: 0 }, this.scene);
    this.physicsAggregate.body.setMotionType(PhysicsMotionType.DYNAMIC);

    // Lock rotation to keep upright
    this.physicsAggregate.body.setMassProperties({ inertia: new Vector3(0, 0, 0) });

    // Interaction metadata
    this.mesh.metadata = { type: "npc", npc: this };
  }
}
