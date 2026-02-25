import { Scene } from "@babylonjs/core/scene";
import { Ray } from "@babylonjs/core/Culling/ray";
import { Player } from "../entities/player";
import { NPC } from "../entities/npc";
import { DialogueSystem } from "./dialogue-system";
import { InventorySystem } from "./inventory-system";
import { Loot } from "../entities/loot";

export type InteractionTarget =
  | { type: 'npc', entity: NPC }
  | { type: 'loot', entity: Loot };

export class InteractionSystem {
  public scene: Scene;
  public player: Player;
  public dialogueSystem: DialogueSystem;
  public inventorySystem: InventorySystem;
  public npcs: NPC[];
  public lootItems: Loot[] = [];
  public currentTarget: InteractionTarget | null = null;

  constructor(scene: Scene, player: Player, dialogueSystem: DialogueSystem, inventorySystem: InventorySystem, npcs: NPC[]) {
    this.scene = scene;
    this.player = player;
    this.dialogueSystem = dialogueSystem;
    this.inventorySystem = inventorySystem;
    this.npcs = npcs;
  }

  public update(): void {
    // Raycast forward constantly for UI
    const origin = this.player.camera.position;
    const forward = this.player.camera.getForwardRay(3).direction;
    const ray = new Ray(origin, forward, 3);

    const hit = this.scene.pickWithRay(ray, (mesh) => {
       return mesh.name !== "playerBody" && !mesh.name.startsWith("chunk_");
    });

    this.currentTarget = null;

    if (hit && hit.pickedMesh) {
      // Check for NPC
      const npc = this.npcs.find(n => n.mesh === hit.pickedMesh);
      if (npc) {
        this.currentTarget = { type: 'npc', entity: npc };
        return;
      }

      // Check for Loot
      const loot = this.lootItems.find(l => l.mesh === hit.pickedMesh);
      if (loot) {
        this.currentTarget = { type: 'loot', entity: loot };
        return;
      }
    }
  }

  public interact(): void {
    if (!this.currentTarget) return;

    if (this.currentTarget.type === 'npc') {
        this.dialogueSystem.startDialogue(this.currentTarget.entity);
    } else if (this.currentTarget.type === 'loot') {
        const loot = this.currentTarget.entity;
        if (this.inventorySystem.addItem(loot.item)) {
            loot.dispose();
            const index = this.lootItems.indexOf(loot);
            if (index > -1) {
                this.lootItems.splice(index, 1);
            }
            // Clear target since it's gone
            this.currentTarget = null;
        }
    }
  }

  public addLoot(loot: Loot): void {
      this.lootItems.push(loot);
  }
}
