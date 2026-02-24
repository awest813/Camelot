import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType, PhysicsMotionType } from "@babylonjs/core/Physics";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { IInteractable } from "./interactable";
import { Player } from "./player";

export class NPC implements IInteractable {
  public mesh: Mesh;
  public physicsAggregate: PhysicsAggregate;
  public scene: Scene;

  // Schedule/AI properties
  public targetPosition: Vector3 | null = null;
  public moveSpeed: number = 2;
  public patrolPoints: Vector3[] = [];
  public currentPatrolIndex: number = 0;
  public waitTime: number = 0;

  constructor(scene: Scene, position: Vector3, name: string) {
    this.scene = scene;
    this._createMesh(position, name);
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

    // Link mesh to this object for interaction
    this.mesh.metadata = { interactable: this };
  }

  public interact(player: Player): void {
      console.log(`Interacting with NPC ${this.mesh.name} by ${player.camera.name}`);
  }
}
