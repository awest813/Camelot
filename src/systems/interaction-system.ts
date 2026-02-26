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

  public update(): void {
      if (this.inventorySystem.isOpen) {
          this.inventorySystem._ui.setInteractionText("");
          return;
      }

      const hit = this._raycast();
      if (hit && hit.pickedMesh && hit.pickedMesh.metadata) {
          const metadata = hit.pickedMesh.metadata;
          if (metadata.type === 'npc') {
              this.inventorySystem._ui.setInteractionText(`Press E to Talk to ${metadata.npc.mesh.name}`);
          } else if (metadata.type === 'loot') {
              this.inventorySystem._ui.setInteractionText(`Press E to Take ${metadata.loot.item.name}`);
          }
      } else {
          this.inventorySystem._ui.setInteractionText("");
      }
  }

  public interact(): void {
    if (this.inventorySystem.isOpen) {
        this.inventorySystem.toggleInventory();
        return;
    }

    const hit = this._raycast();

    if (hit && hit.pickedMesh && hit.pickedMesh.metadata) {
      const metadata = hit.pickedMesh.metadata;

      if (metadata.type === 'npc') {
          this.dialogueSystem.startDialogue(metadata.npc);
      } else if (metadata.type === 'loot') {
          const loot = metadata.loot;
          if (this.inventorySystem.addItem(loot.item)) {
              loot.dispose();
          }
      }
    }
  }

  private _raycast() {
    const origin = this.player.camera.position;
    const forward = this.player.camera.getForwardRay(3).direction;
    const ray = new Ray(origin, forward, 3);

    return this.scene.pickWithRay(ray, (mesh) => {
       return mesh.isVisible && mesh.name !== "playerBody" && !mesh.name.startsWith("chunk_");
    });
  }
}
