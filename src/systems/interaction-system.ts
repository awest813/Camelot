import { Scene } from "@babylonjs/core/scene";
import { Ray } from "@babylonjs/core/Culling/ray";
import { Player } from "../entities/player";
import { NPC } from "../entities/npc";
import { DialogueSystem } from "./dialogue-system";
import { InventorySystem } from "./inventory-system";
import { Loot } from "../entities/loot";

export class InteractionSystem {
  public scene: Scene;
  public player: Player;
  public dialogueSystem: DialogueSystem;
  public inventorySystem: InventorySystem;
  public npcs: NPC[];
  public lootItems: Loot[] = [];

  constructor(scene: Scene, player: Player, dialogueSystem: DialogueSystem, inventorySystem: InventorySystem, npcs: NPC[]) {
    this.scene = scene;
    this.player = player;
    this.dialogueSystem = dialogueSystem;
    this.inventorySystem = inventorySystem;
    this.npcs = npcs;
  }

  public interact(): void {
    // Raycast forward
    const origin = this.player.camera.position;
    const forward = this.player.camera.getForwardRay(3).direction;
    const ray = new Ray(origin, forward, 3);

    const hit = this.scene.pickWithRay(ray, (mesh) => {
       return mesh.name !== "playerBody" && !mesh.name.startsWith("chunk_");
    });

    if (hit && hit.pickedMesh) {
      console.log(`Interacted with ${hit.pickedMesh.name}`);

      // Check for NPC
      const npc = this.npcs.find(n => n.mesh === hit.pickedMesh);
      if (npc) {
        this.dialogueSystem.startDialogue(npc);
        return;
      }

      // Check for Loot
      const loot = this.lootItems.find(l => l.mesh === hit.pickedMesh);
      if (loot) {
        if (this.inventorySystem.addItem(loot.item)) {
            loot.dispose();
            const index = this.lootItems.indexOf(loot);
            if (index > -1) {
                this.lootItems.splice(index, 1);
            }
        }
        return;
      }
    }
  }

  public addLoot(loot: Loot): void {
      this.lootItems.push(loot);
  }
}
