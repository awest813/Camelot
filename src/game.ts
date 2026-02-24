import { Scene } from "@babylonjs/core/scene";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import { Player } from "./entities/player";
import { UIManager } from "./ui/ui-manager";
import { WorldManager } from "./world/world-manager";
import { NPC } from "./entities/npc";
import { ScheduleSystem } from "./systems/schedule-system";
import { CombatSystem } from "./systems/combat-system";
import { DialogueSystem } from "./systems/dialogue-system";
import { InteractionSystem } from "./systems/interaction-system";
import { InventorySystem } from "./systems/inventory-system";
import { InventoryUI } from "./ui/inventory-ui";
import { Item, ItemType } from "./entities/item";
import { WorldItem } from "./entities/world-item";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import { KeyboardEventTypes } from "@babylonjs/core/Events/keyboardEvents";

export class Game {
  public scene: Scene;
  public canvas: HTMLCanvasElement;
  public engine: Engine | WebGPUEngine;
  public player: Player;
  public ui: UIManager;
  public world: WorldManager;
  public scheduleSystem: ScheduleSystem;
  public combatSystem: CombatSystem;
  public dialogueSystem: DialogueSystem;
  public interactionSystem: InteractionSystem;
  public inventorySystem: InventorySystem;
  public inventoryUI: InventoryUI;

  constructor(scene: Scene, canvas: HTMLCanvasElement, engine: Engine | WebGPUEngine) {
    this.scene = scene;
    this.canvas = canvas;
    this.engine = engine;

    this.init();
  }

  init(): void {
    this._setLight();
    this.player = new Player(this.scene, this.canvas);
    this.ui = new UIManager(this.scene);
    this.world = new WorldManager(this.scene);
    this.scheduleSystem = new ScheduleSystem(this.scene);

    // Test NPC
    const npc = new NPC(this.scene, new Vector3(10, 2, 10), "Guard");
    npc.patrolPoints = [new Vector3(10, 2, 10), new Vector3(10, 2, 20), new Vector3(20, 2, 20), new Vector3(20, 2, 10)];
    this.scheduleSystem.addNPC(npc);

    this.combatSystem = new CombatSystem(this.scene, this.player, this.scheduleSystem.npcs);
    this.dialogueSystem = new DialogueSystem(this.scene, this.player, this.scheduleSystem.npcs, this.canvas);
    this.interactionSystem = new InteractionSystem(this.scene, this.player, this.dialogueSystem, this.scheduleSystem.npcs);

    this.inventorySystem = new InventorySystem();
    this.inventoryUI = new InventoryUI(this.scene, this.inventorySystem);

    // Test Item
    const swordItem = new Item("sword", "Iron Sword", ItemType.WEAPON, 5, 10);
    new WorldItem(this.scene, swordItem, new Vector3(5, 1, 5), this.inventorySystem);

    // Input handling for combat
    this.scene.onPointerObservable.add((pointerInfo) => {
        if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
            if (pointerInfo.event.button === 0) { // Left Click
                this.combatSystem.meleeAttack();
            } else if (pointerInfo.event.button === 2) { // Right Click
                this.combatSystem.magicAttack();
            }
        }
    });

    // Input handling for interaction
    this.scene.onKeyboardObservable.add((kbInfo) => {
        if (kbInfo.type === KeyboardEventTypes.KEYDOWN) {
            if (kbInfo.event.key === 'e' || kbInfo.event.key === 'E') {
                this.interactionSystem.interact();
            } else if (kbInfo.event.key === 'i' || kbInfo.event.key === 'I') {
                this.inventoryUI.toggle();
            }
        }
    });

    // Game loop logic will go here
    this.scene.onBeforeRenderObservable.add(() => {
        this.update();
    });
  }

  _setLight(): void {
    const light = new HemisphericLight("light", new Vector3(0, 1, 0), this.scene);
    light.intensity = 0.5;
  }

  update(): void {
      const deltaTime = this.engine.getDeltaTime() / 1000;
      this.player.update(deltaTime);
      this.world.update(this.player.camera.position);
      this.scheduleSystem.update(deltaTime);

      this.ui.updateHealth(this.player.health, this.player.maxHealth);
      this.ui.updateMagicka(this.player.magicka, this.player.maxMagicka);
      this.ui.updateStamina(this.player.stamina, this.player.maxStamina);
  }
}
