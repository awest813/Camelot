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

    // Small sphere — more visible and gem-like than a plain box
    this.mesh = MeshBuilder.CreateSphere("loot_" + item.id, { diameter: 0.45, segments: 6 }, scene);
    this.mesh.position = position;

    // Color by category: equipment = silvery-blue, consumable/misc = golden
    const material = new StandardMaterial("lootMat_" + item.id, scene);
    if (item.slot) {
      material.diffuseColor  = new Color3(0.55, 0.72, 1.00);
      material.emissiveColor = new Color3(0.10, 0.16, 0.40);
      material.specularColor = new Color3(1.00, 1.00, 1.00);
      material.specularPower = 64;
    } else {
      material.diffuseColor  = new Color3(1.00, 0.82, 0.18);
      material.emissiveColor = new Color3(0.30, 0.18, 0.00);
      material.specularColor = new Color3(1.00, 0.92, 0.50);
      material.specularPower = 32;
    }
    this.mesh.material = material;

    // Physics (sphere shape)
    this.physicsAggregate = new PhysicsAggregate(this.mesh, PhysicsShapeType.SPHERE, { mass: 1, restitution: 0.5 }, scene);
    this.physicsAggregate.body.setMotionType(PhysicsMotionType.DYNAMIC);

    // Metadata for interaction
    this.mesh.metadata = { type: "loot", loot: this };
  }

  public dispose(): void {
      this.mesh.dispose();
      this.physicsAggregate.dispose();
  }
}
