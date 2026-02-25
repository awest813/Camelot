import { Scene } from "@babylonjs/core/scene";
import { Ray } from "@babylonjs/core/Culling/ray";
import { KeyboardEventTypes } from "@babylonjs/core/Events/keyboardEvents";
import { Player } from "../entities/player";
import { InventorySystem } from "./inventory-system";
import { DialogueSystem } from "./dialogue-system";

export class InteractionSystem {
  public scene: Scene;
  public player: Player;
  public inventorySystem: InventorySystem;
  public dialogueSystem: DialogueSystem;

  constructor(scene: Scene, player: Player, inventorySystem: InventorySystem, dialogueSystem: DialogueSystem) {
    this.scene = scene;
    this.player = player;
    this.inventorySystem = inventorySystem;
    this.dialogueSystem = dialogueSystem;

    this._initInput();
  }

  private _initInput(): void {
    this.scene.onKeyboardObservable.add((kbInfo) => {
      if (kbInfo.type === KeyboardEventTypes.KEYDOWN) {
        if (kbInfo.event.key === 'e' || kbInfo.event.key === 'E') {
          this.interact();
        } else if (kbInfo.event.key === 'i' || kbInfo.event.key === 'I') {
            this.inventorySystem.toggleInventory();
        }
      }
    });
  }

  public interact(): void {
    // If inventory is open, maybe 'E' closes it? Or does nothing.
    if (this.inventorySystem.isOpen) {
        this.inventorySystem.toggleInventory();
        return;
    }

    const origin = this.player.camera.position;
    const forward = this.player.camera.getForwardRay(3).direction;
    const ray = new Ray(origin, forward, 3);

    const hit = this.scene.pickWithRay(ray, (mesh) => {
       return mesh.isVisible && mesh.name !== "playerBody" && !mesh.name.startsWith("chunk_");
    });

    if (hit && hit.pickedMesh && hit.pickedMesh.metadata) {
      const metadata = hit.pickedMesh.metadata;

      if (metadata.type === 'npc') {
          this.dialogueSystem.startDialogue(metadata.npc);
      } else if (metadata.type === 'loot') {
          const loot = metadata.loot;
          if (this.inventorySystem.addItem(loot.item)) {
              console.log(`Picked up ${loot.item.name}`);
              loot.dispose();
          }
      }
    }
  }
}
