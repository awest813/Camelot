import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Ray } from "@babylonjs/core/Culling/ray";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType, PhysicsMotionType } from "@babylonjs/core/Physics";
import { NPC } from "../entities/npc";
import { Player } from "../entities/player";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { UIManager } from "../ui/ui-manager";

export class CombatSystem {
  public scene: Scene;
  public player: Player;
  public npcs: NPC[]; // Reference to NPC list from ScheduleSystem or Game
  public ui: UIManager;

  constructor(scene: Scene, player: Player, npcs: NPC[], ui: UIManager) {
    this.scene = scene;
    this.player = player;
    this.npcs = npcs;
    this.ui = ui;
  }

  public meleeAttack(): void {
    if (this.player.stamina < 15) {
        this.ui.addNotification("Not enough stamina!");
        return;
    }
    this.player.stamina -= 15;

    // Play animation (todo)
    // Raycast forward
    const origin = this.player.camera.position;
    const forward = this.player.camera.getForwardRay(3).direction;
    const ray = new Ray(origin, forward, 3);

    const hit = this.scene.pickWithRay(ray, (mesh) => {
      // Filter logic: only pick NPCs
      // We need a way to identify NPCs. We can check metadata or if it belongs to an NPC in our list.
      // For now, let's just pick anything that is not player
      return mesh.name !== "playerBody" && !mesh.name.startsWith("chunk_"); // Don't hit self or ground
    });

    if (hit && hit.pickedMesh) {
      console.log(`Hit ${hit.pickedMesh.name}`);
      // Apply impulse if it has physics
      // Note: pickWithRay returns pickedMesh.
      // If we used PhysicsAggregate, we might need to access the body.

      // If it's an NPC
      const npc = this.npcs.find(n => n.mesh === hit.pickedMesh);
      if (npc) {
        console.log("Hit NPC!");
        // Apply knockback
        if (npc.physicsAggregate && npc.physicsAggregate.body) {
            const impulse = forward.scale(10);
            npc.physicsAggregate.body.applyImpulse(impulse, hit.pickedPoint!);
        }
      }
    }
  }

  public magicAttack(): void {
    if (this.player.magicka < 20) {
        this.ui.addNotification("Not enough magicka!");
        return;
    }
    this.player.magicka -= 20;

    // Spawn projectile
    const origin = this.player.camera.position.add(this.player.camera.getForwardRay(1).direction);
    const projectile = MeshBuilder.CreateSphere("fireball", { diameter: 0.5 }, this.scene);
    projectile.position = origin;

    const material = new StandardMaterial("fireballMat", this.scene);
    material.diffuseColor = Color3.Red();
    material.emissiveColor = Color3.Red();
    projectile.material = material;

    const agg = new PhysicsAggregate(projectile, PhysicsShapeType.SPHERE, { mass: 0.5, restitution: 0.5 }, this.scene);
    agg.body.setMotionType(PhysicsMotionType.DYNAMIC);

    // Apply impulse
    const forward = this.player.camera.getForwardRay(1).direction;
    agg.body.applyImpulse(forward.scale(20), origin);

    // Clean up after 5 seconds
    setTimeout(() => {
      projectile.dispose();
      agg.dispose(); // Important to dispose physics body too
    }, 5000);
  }
}
