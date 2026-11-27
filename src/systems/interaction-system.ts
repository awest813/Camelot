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
import type { GameEventBus } from "./event-bus";

export class InteractionSystem {
  /** Where this reports what happened (the game's event bus). */
  public events: GameEventBus | null = null;

  public scene: Scene;
  public player: Player;
  public inventorySystem: InventorySystem;
  public dialogueSystem: DialogueSystem;
  public ui: UIManager;

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
   * reports `interact:pickpocket` instead of opening dialogue.
   */
  public stealthSystem: StealthSystem | null = null;
  public pickpocketSystem: PickpocketSystem | null = null;
  /** Player's current Sneak level, used for the displayed success chance. */
  public sneakLevelProvider: (() => number) | null = null;


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
                  this.ui.setInteractionText(`${metadata.npc.displayName} is hostile`);
              } else if (metadata.npc.isAsleep) {
                  this.ui.setInteractionText(`${metadata.npc.displayName} is asleep`);
              } else {
                  const sneakPrompt = this._pickpocketPromptFor(metadata.npc);
                  this.ui.setInteractionText(
                      sneakPrompt ?? `[E] Talk to ${metadata.npc.displayName}`);
              }
              this.ui.setCrosshairActive(true);
          } else if (metadata.type === 'activator' && typeof metadata.onActivate === 'function') {
              this.ui.setInteractionText(`[E] ${metadata.label ?? "Use"}`);
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
    if (this.isBlocked) return;
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
              this.ui.showNotification(`${metadata.npc.displayName} is hostile!`, 1500);
              return;
          }
          // Asleep by their schedule: no talking (or pickpocketing) until they wake.
          if (metadata.npc.isAsleep) return;
          if (this._pickpocketPromptFor(metadata.npc) && this.events) {
              this.events.emit("interact:pickpocket", { npc: metadata.npc });
              return;
          }
          this.dialogueSystem.startDialogue(metadata.npc);
      } else if (metadata.type === 'activator' && typeof metadata.onActivate === 'function') {
          // Generic world activator: { type: 'activator', label, onActivate }.
          metadata.onActivate();
      } else if (metadata.type === 'loot') {
          const loot = metadata.loot;
          if (this.inventorySystem.addItem(loot.item)) {
              loot.dispose();
              this.events?.emit("loot:pickedUp", { itemId: loot.item.id });
          }
      } else if (metadata.type === 'container' && metadata.container && this.containerSystem) {
          // No lockpick skill exists yet — locked chests report their difficulty.
          this.containerSystem.tryOpen(metadata.container, 0);
      } else if (metadata.type === 'portal' && metadata.portal && this.cellManager) {
          if (this.cellManager.isTransitioning || this.ui.isScreenFadeActive) return;
          const portalId = metadata.portal.id as string;
          if (this.events) {
              this.events.emit("portal:entered", { portalId });
          } else {
              this.cellManager.tryTransition(portalId);
          }
      }
    }
  }

  /**
   * Returns the pickpocket prompt text when sneaking undetected behind a
   * living, non-hostile NPC with something to steal — otherwise null.
   * The rule: crouch + undetected + a registered inventory.
   */
  private _pickpocketPromptFor(npc: NPC): string | null {
    if (!this.stealthSystem || !this.pickpocketSystem) return null;
    if (npc.isDead) return null;
    if (!this.stealthSystem.canSneakAttack(npc)) return null;
    const npcId = npc.key;
    const sneakLevel = this.sneakLevelProvider?.() ?? 0;
    const check = this.pickpocketSystem.canAttempt(npcId, true, false, "", sneakLevel);
    if (!check.canAttempt || check.successChance == null) return null;
    return `[E] Pickpocket ${npcId} (${Math.round(check.successChance)}%)`;
  }

  private _raycast() {
    return this.player.raycastForward(3, true); // true to require isVisible
  }
}
