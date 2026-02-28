import { Scene } from "@babylonjs/core/scene";
import { KeyboardEventTypes } from "@babylonjs/core/Events/keyboardEvents";
import { Player } from "../entities/player";
import { InventorySystem } from "./inventory-system";
import { DialogueSystem } from "./dialogue-system";

export class InteractionSystem {
  public scene: Scene;
  public player: Player;
  public inventorySystem: InventorySystem;
  public dialogueSystem: DialogueSystem;

  /** Fired with the item's id when loot is successfully picked up. */
  public onLootPickup: ((itemId: string) => void) | null = null;

  /** Set to true while the game is paused or a UI overlay owns focus. */
  public isBlocked: boolean = false;

  // Throttle raycast: only run every N frames
  private _frameCounter: number = 0;
  private _raycastInterval: number = 3;

  constructor(scene: Scene, player: Player, inventorySystem: InventorySystem, dialogueSystem: DialogueSystem) {
    this.scene = scene;
    this.player = player;
    this.inventorySystem = inventorySystem;
    this.dialogueSystem = dialogueSystem;

    this._initInput();
  }

  private _initInput(): void {
    this.scene.onKeyboardObservable.add((kbInfo) => {
      if (this.isBlocked) return;
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
      if (this.dialogueSystem.isInDialogue || this.inventorySystem.isOpen) {
          this.inventorySystem._ui.setInteractionText("");
          this.inventorySystem._ui.setCrosshairActive(false);
          this.inventorySystem._ui.hideTargetInfo();
          return;
      }

      // Throttle the raycast — only re-check every _raycastInterval frames
      if (++this._frameCounter % this._raycastInterval !== 0) return;

      const hit = this._raycast();
      if (hit && hit.pickedMesh && hit.pickedMesh.metadata) {
          const metadata = hit.pickedMesh.metadata;
          if (metadata.type === 'npc') {
              const npc = metadata.npc;
              this.inventorySystem._ui.setInteractionText(`Press E to Talk to ${npc.mesh.name}`);
              this.inventorySystem._ui.setCrosshairActive(true);
              this.inventorySystem._ui.showTargetInfo(npc.mesh.name, npc.health, npc.maxHealth);
          } else if (metadata.type === 'loot') {
              this.inventorySystem._ui.setInteractionText(`Press E to Take ${metadata.loot.item.name}`);
              this.inventorySystem._ui.setCrosshairActive(true);
              this.inventorySystem._ui.hideTargetInfo();
          }
      } else {
          this.inventorySystem._ui.setInteractionText("");
          this.inventorySystem._ui.setCrosshairActive(false);
          this.inventorySystem._ui.hideTargetInfo();
      }
  }

  public interact(): void {
    if (this.dialogueSystem.isInDialogue) return;
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
              console.log(`Picked up ${loot.item.name}`);
              loot.dispose();
              if (this.onLootPickup) this.onLootPickup(loot.item.id);
          }
      }
    }
  }

  private _raycast() {
    return this.player.raycastForward(3, true); // true to require isVisible
  }
}
