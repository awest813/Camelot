import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType, PhysicsMotionType } from "@babylonjs/core/Physics";
import { Item } from "../systems/inventory-system";

export class Loot {
  public mesh: Mesh;
  public item: Item;
  public scene: Scene;
  public physicsAggregate: PhysicsAggregate;

  constructor(scene: Scene, position: Vector3, item: Item) {
    this.scene = scene;
    this.item = item;
    this._createMesh(position);
  }

  private _createMesh(position: Vector3): void {
    // Simple visual: A small box or sphere based on item type?
    // Let's use a small box for now.
    this.mesh = MeshBuilder.CreateBox("loot_" + this.item.id, { size: 0.5 }, this.scene);
    this.mesh.position = position;

    const material = new StandardMaterial("lootMat_" + this.item.id, this.scene);
    // Parse color string (simple map for now)
    switch(this.item.color) {
        case "red": material.diffuseColor = Color3.Red(); break;
        case "blue": material.diffuseColor = Color3.Blue(); break;
        case "green": material.diffuseColor = Color3.Green(); break;
        case "yellow": material.diffuseColor = Color3.Yellow(); break;
        default: material.diffuseColor = Color3.White(); break;
    }
    this.mesh.material = material;

    this.physicsAggregate = new PhysicsAggregate(this.mesh, PhysicsShapeType.BOX, { mass: 1, restitution: 0.5 }, this.scene);
    this.physicsAggregate.body.setMotionType(PhysicsMotionType.DYNAMIC);
  }

  public dispose(): void {
      this.mesh.dispose();
      this.physicsAggregate.dispose();
  }
}
