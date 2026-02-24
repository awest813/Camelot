import { Scene } from "@babylonjs/core/scene";
import { Ray } from "@babylonjs/core/Culling/ray";
import { Player } from "../entities/player";
import { DialogueSystem } from "./dialogue-system";
import { NPC } from "../entities/npc";

export class InteractionSystem {
  public scene: Scene;
  public player: Player;
  public dialogueSystem: DialogueSystem;
  public npcs: NPC[]; // Or a general list of interactables

  constructor(scene: Scene, player: Player, dialogueSystem: DialogueSystem, npcs: NPC[]) {
    this.scene = scene;
    this.player = player;
    this.dialogueSystem = dialogueSystem;
    this.npcs = npcs;
  }

  public interact(): void {
    // If already in dialogue, maybe advance it?
    // DialogueSystem handles its own UI clicks, but maybe 'E' can skip/advance?
    // For now, assume DialogueSystem manages itself once active.

    // Raycast forward
    const origin = this.player.camera.position;
    const forward = this.player.camera.getForwardRay(3).direction;
    const ray = new Ray(origin, forward, 3);

    const hit = this.scene.pickWithRay(ray, (mesh) => {
       return mesh.name !== "playerBody" && !mesh.name.startsWith("chunk_");
    });

    if (hit && hit.pickedMesh) {
      console.log(`Interacted with ${hit.pickedMesh.name}`);

      // Check for generic IInteractable via metadata
      if (hit.pickedMesh.metadata && hit.pickedMesh.metadata.interactable) {
          hit.pickedMesh.metadata.interactable.interact(this.player);
      }

      // Special handling for NPC Dialogue (since NPC.interact doesn't know about DialogueSystem)
      const npc = this.npcs.find(n => n.mesh === hit.pickedMesh);
      if (npc) {
        this.dialogueSystem.startDialogue(npc);
        return;
      }
    }
  }
}
