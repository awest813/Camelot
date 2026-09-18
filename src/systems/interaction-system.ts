import { Scene } from "@babylonjs/core/scene";
import { KeyboardEventTypes } from "@babylonjs/core/Events/keyboardEvents";
import { Player } from "../entities/player";
import type { NPC } from "../entities/npc";
import { InventorySystem } from "./inventory-system";
import { DialogueSystem } from "./dialogue-system";
import type { StealthSystem } from "./stealth-system";
import type { PickpocketSystem } from "./pickpocket-system";
import type { ContainerSystem } from "./container-system";
import { UIManager } from "../ui/ui-manager";
import type { CellManager } from "../world/cell-manager";

export class InteractionSystem {
  public scene: Scene;
  public player: Player;
  public inventorySystem: InventorySystem;
  public dialogueSystem: DialogueSystem;
  public ui: UIManager;

  /** Fired with the item's id when loot is successfully picked up. */
  public onLootPickup: ((itemId: string) => void) | null = null;

  /** Set to true while the game is paused or a UI overlay owns focus. */
  public isBlocked: boolean = false;

  /** When set, portal meshes can trigger cell transitions (E key). */
  public cellManager: CellManager | null = null;

  /** When set, chest meshes can be opened into the container UI (E key). */
  public containerSystem: ContainerSystem | null = null;

  /**
   * Optional pickpocket integration (set by the game layer).
   * When `pickpocketSystem` is present and the player is crouching undetected
   * behind a living, non-hostile NPC, the prompt offers pickpocketing and E
   * fires `onPickpocketNpc` instead of opening dialogue.
   */
  public stealthSystem: StealthSystem | null = null;
  public pickpocketSystem: PickpocketSystem | null = null;
  /** Player's current Sneak level, used for the displayed success chance. */
  public sneakLevelProvider: (() => number) | null = null;
  /** Fired with the targeted NPC when the player presses E on a pickpocket prompt. */
  public onPickpocketNpc: ((npc: NPC) => void) | null = null;

  /**
   * Runs a map/interior transition with optional screen fade. When null,
   * `cellManager.tryTransition` is used directly.
   */
  public onPortalTransition: ((portalId: string) => void) | null = null;

  // Throttle raycast: only run every N frames
  private _frameCounter: number = 0;
  private _raycastInterval: number = 3;

  constructor(scene: Scene, player: Player, inventorySystem: InventorySystem, dialogueSystem: DialogueSystem, ui: UIManager) {
    this.scene = scene;
    this.player = player;
    this.inventorySystem = inventorySystem;
    this.dialogueSystem = dialogueSystem;
    this.ui = ui;

    this._initInput();
  }

  private _initInput(): void {
    this.scene.onKeyboardObservable.add((kbInfo) => {
      if (this.isBlocked) return;
      if (kbInfo.type === KeyboardEventTypes.KEYDOWN) {
        const domEvent = kbInfo.event as KeyboardEvent;
        if (domEvent.repeat) return;
        // E and I keys are handled by the decoupled input adapter (game.ts _wireInputAdapter).
        // Only fallback handling remains here for keys not in the adapter.
      }
    });
  }

  public update(): void {
      if (this.isBlocked || this.dialogueSystem.isInDialogue || this.inventorySystem.isOpen) {
          this.ui.setInteractionText("");
          this.ui.setCrosshairActive(false);
          return;
      }

      // Throttle the raycast — only re-check every _raycastInterval frames
      if (++this._frameCounter % this._raycastInterval !== 0) return;

      const hit = this._raycast();
      if (hit && hit.pickedMesh && hit.pickedMesh.metadata) {
          const metadata = hit.pickedMesh.metadata;
          if (metadata.type === 'npc') {
              if (metadata.npc.isAggressive) {
                  this.ui.setInteractionText(`${metadata.npc.mesh.name} is hostile`);
              } else {
                  const sneakPrompt = this._pickpocketPromptFor(metadata.npc);
                  this.ui.setInteractionText(
                      sneakPrompt ?? `[E] Talk to ${metadata.npc.mesh.name}`);
              }
              this.ui.setCrosshairActive(true);
          } else if (metadata.type === 'loot') {
              this.ui.setInteractionText(`[E] Take ${metadata.loot.item.name}`);
              this.ui.setCrosshairActive(true);
          } else if (metadata.type === 'container' && metadata.container) {
              this.ui.setInteractionText(`[E] Open ${metadata.container.name}`);
              this.ui.setCrosshairActive(true);
          } else if (metadata.type === 'portal' && metadata.portal && this.cellManager) {
              if (this.cellManager.isTransitioning || this.ui.isScreenFadeActive) {
                  this.ui.setInteractionText("");
                  this.ui.setCrosshairActive(false);
              } else {
                  this.ui.setInteractionText(`[E] ${metadata.portal.labelText}`);
                  this.ui.setCrosshairActive(true);
              }
          }
      } else {
          this.ui.setInteractionText("");
          this.ui.setCrosshairActive(false);
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
          if (metadata.npc.isAggressive) {
              this.ui.showNotification(`${metadata.npc.mesh.name} is hostile!`, 1500);
              return;
          }
          if (this._pickpocketPromptFor(metadata.npc) && this.onPickpocketNpc) {
              this.onPickpocketNpc(metadata.npc);
              return;
          }
          this.dialogueSystem.startDialogue(metadata.npc);
      } else if (metadata.type === 'loot') {
          const loot = metadata.loot;
          if (this.inventorySystem.addItem(loot.item)) {
              loot.dispose();
              if (this.onLootPickup) this.onLootPickup(loot.item.id);
          }
      } else if (metadata.type === 'container' && metadata.container && this.containerSystem) {
          // No lockpick skill exists yet — locked chests report their difficulty.
          this.containerSystem.tryOpen(metadata.container, 0);
      } else if (metadata.type === 'portal' && metadata.portal && this.cellManager) {
          if (this.cellManager.isTransitioning || this.ui.isScreenFadeActive) return;
          const portalId = metadata.portal.id as string;
          if (this.onPortalTransition) {
              this.onPortalTransition(portalId);
          } else {
              this.cellManager.tryTransition(portalId);
          }
      }
    }
  }

  /**
   * Returns the pickpocket prompt text when sneaking undetected behind a
   * living, non-hostile NPC with something to steal — otherwise null.
   * Mirrors the Oblivion rule: crouch + undetected + a registered inventory.
   */
  private _pickpocketPromptFor(npc: NPC): string | null {
    if (!this.stealthSystem || !this.pickpocketSystem) return null;
    if (npc.isDead) return null;
    if (!this.stealthSystem.canSneakAttack(npc)) return null;
    const npcId = npc.mesh.name;
    const sneakLevel = this.sneakLevelProvider?.() ?? 0;
    const check = this.pickpocketSystem.canAttempt(npcId, true, false, "", sneakLevel);
    if (!check.canAttempt || check.successChance == null) return null;
    return `[E] Pickpocket ${npcId} (${Math.round(check.successChance)}%)`;
  }

  private _raycast() {
    return this.player.raycastForward(3, true); // true to require isVisible
  }
}
