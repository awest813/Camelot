import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType, PhysicsMotionType } from "@babylonjs/core/Physics";
import { Item } from "../systems/inventory-system";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";

export class Loot {
  public mesh: Mesh;
  public item: Item;
  public physicsAggregate: PhysicsAggregate;

  constructor(scene: Scene, position: Vector3, item: Item) {
    this.item = item;

    // Create mesh (simple box for now)
    this.mesh = MeshBuilder.CreateBox("loot_" + item.id, { size: 0.5 }, scene);
    this.mesh.position = position;

    // Add color based on item type or just random?
    // Let's make it green for loot
    const material = new StandardMaterial("lootMat", scene);
    material.diffuseColor = Color3.Green();
    this.mesh.material = material;

    // Physics
    this.physicsAggregate = new PhysicsAggregate(this.mesh, PhysicsShapeType.BOX, { mass: 1, restitution: 0.5 }, scene);
    this.physicsAggregate.body.setMotionType(PhysicsMotionType.DYNAMIC);

    // Metadata for interaction
    this.mesh.metadata = { type: "loot", loot: this };
  }

  public dispose(): void {
      this.mesh.dispose();
      this.physicsAggregate.dispose();
  }
}
