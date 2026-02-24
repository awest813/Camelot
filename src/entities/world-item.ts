import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType, PhysicsMotionType } from "@babylonjs/core/Physics";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Item } from "./item";
import { Player } from "./player";
import { IInteractable } from "./interactable";
import { InventorySystem } from "../systems/inventory-system";

export class WorldItem implements IInteractable {
  public mesh: Mesh;
  public item: Item;
  public scene: Scene;
  private inventorySystem: InventorySystem;
  private physicsAggregate: PhysicsAggregate;

  constructor(scene: Scene, item: Item, position: Vector3, inventorySystem: InventorySystem) {
    this.scene = scene;
    this.item = item;
    this.inventorySystem = inventorySystem;
    this._createMesh(position);
  }

  private _createMesh(position: Vector3): void {
    this.mesh = MeshBuilder.CreateBox("item_" + this.item.id, { size: 0.5 }, this.scene);
    this.mesh.position = position;

    const material = new StandardMaterial("itemMat", this.scene);
    material.diffuseColor = Color3.Green();
    this.mesh.material = material;

    this.physicsAggregate = new PhysicsAggregate(this.mesh, PhysicsShapeType.BOX, { mass: 1, restitution: 0.5 }, this.scene);
    this.physicsAggregate.body.setMotionType(PhysicsMotionType.DYNAMIC);

    // Link mesh to this object for interaction
    this.mesh.metadata = { interactable: this };
  }

  public interact(player: Player): void {
    console.log(`Picked up ${this.item.name} by ${player.camera.name}`);
    this.inventorySystem.addItem(this.item);

    this.mesh.dispose();
    this.physicsAggregate.dispose();
  }
}
