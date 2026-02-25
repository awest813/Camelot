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
    // Optimization: Clone a base mesh if possible, but for now CreateBox is fine.
    // However, we should freeze the world matrix if it was purely static.
    // But since we are rotating it in _rotate, we CANNOT freeze the world matrix.
    // We can however freeze the material if it doesn't change color.

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
    material.freeze();
    this.physicsAggregate = new PhysicsAggregate(this.mesh, PhysicsShapeType.BOX, { mass: 0, restitution: 0.5 }, this.scene);
    this.physicsAggregate.body.setMotionType(PhysicsMotionType.STATIC);

    // Make it rotate
    this.scene.onBeforeRenderObservable.add(this._rotate);
  }

  private _rotate = (): void => {
      if (this.mesh) {
          this.mesh.rotation.y += 0.01;
      }
  };

  public dispose(): void {
      this.scene.onBeforeRenderObservable.removeCallback(this._rotate);
      this.mesh.dispose();
      this.physicsAggregate.dispose();
  }
}
