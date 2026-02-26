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
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import { KeyboardEventTypes } from "@babylonjs/core/Events/keyboardEvents";
import { InventorySystem } from "./systems/inventory-system";
import { InteractionSystem } from "./systems/interaction-system";
import { Loot } from "./entities/loot";

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
  public inventorySystem: InventorySystem;
  public interactionSystem: InteractionSystem;

  public isPaused: boolean = false;

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

    this.combatSystem = new CombatSystem(this.scene, this.player, this.scheduleSystem.npcs, this.ui);
    this.dialogueSystem = new DialogueSystem(this.scene, this.player, this.scheduleSystem.npcs, this.canvas);
    this.inventorySystem = new InventorySystem(this.player, this.ui, this.canvas);
    this.interactionSystem = new InteractionSystem(this.scene, this.player, this.inventorySystem, this.dialogueSystem);

    // Test Loot
    new Loot(this.scene, new Vector3(5, 1, 5), {
        id: "sword_01",
        name: "Iron Sword",
        description: "A rusty iron sword. +10 damage",
        stackable: false,
        quantity: 1,
        slot: "mainHand",
        stats: { damage: 10 }
    });

    new Loot(this.scene, new Vector3(7, 1, 5), {
        id: "potion_hp_01",
        name: "Health Potion",
        description: "Restores 50 HP.",
        stackable: true,
        quantity: 1,
        stats: { heal: 50 }
    });

    new Loot(this.scene, new Vector3(8, 1, 8), {
        id: "armor_leather_01",
        name: "Leather Armor",
        description: "Light leather armor. +3 armor, +20 max health",
        stackable: false,
        quantity: 1,
        slot: "armor",
        stats: { armor: 3, maxHealth: 20 }
    });

    new Loot(this.scene, new Vector3(9, 1, 9), {
        id: "shield_01",
        name: "Iron Shield",
        description: "A sturdy iron shield. +5 armor, -10% stamina regen",
        stackable: false,
        quantity: 1,
        slot: "offHand",
        stats: { armor: 5, staminaRegen: -0.2 }
    });

    new Loot(this.scene, new Vector3(6, 1, 6), {
        id: "helmet_01",
        name: "Iron Helmet",
        description: "Protective iron helmet. +2 armor",
        stackable: false,
        quantity: 1,
        slot: "head",
        stats: { armor: 2 }
    });

    // Input handling for combat
    this.scene.onPointerObservable.add((pointerInfo) => {
        if (this.isPaused || this.inventorySystem.isOpen) return;

        if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
            if (pointerInfo.event.button === 0) { // Left Click
                this.combatSystem.meleeAttack();
            } else if (pointerInfo.event.button === 2) { // Right Click
                this.combatSystem.magicAttack();
            }
        }
    });

    // Input handling for pause
    this.scene.onKeyboardObservable.add((kbInfo) => {
        if (kbInfo.type === KeyboardEventTypes.KEYDOWN) {
            if (kbInfo.event.key === "Escape") {
                this.togglePause();
            }
        }
    });

    // Wire up Pause Menu buttons
    this.ui.resumeButton.onPointerUpObservable.add(() => this.togglePause());
    this.ui.saveButton.onPointerUpObservable.add(() => this.ui.showNotification("Save Game (Coming Soon)", 2000));
    this.ui.loadButton.onPointerUpObservable.add(() => this.ui.showNotification("Load Game (Coming Soon)", 2000));
    this.ui.quitButton.onPointerUpObservable.add(() => window.location.reload());

    // Game loop logic will go here
    this.scene.onBeforeRenderObservable.add(() => {
        this.update();
    });
  }

  togglePause(): void {
      this.isPaused = !this.isPaused;
      this.ui.togglePauseMenu(this.isPaused);

      if (this.isPaused) {
          // Clear interaction label when paused
          this.ui.setInteractionText("");
          document.exitPointerLock();
          this.player.camera.detachControl();
      } else {
          this.canvas.requestPointerLock();
          this.player.camera.attachControl(this.canvas, true);
      }
  }

  _setLight(): void {
    const light = new HemisphericLight("light", new Vector3(0, 1, 0), this.scene);
    light.intensity = 0.5;
  }

  update(): void {
      if (this.isPaused) return;

      const deltaTime = this.engine.getDeltaTime() / 1000;

      this.player.update(deltaTime);
      this.world.update(this.player.camera.position);
      this.scheduleSystem.update(deltaTime);
      this.combatSystem.updateNPCAI(deltaTime);
      this.interactionSystem.update();

      this.ui.updateHealth(this.player.health, this.player.maxHealth);
      this.ui.updateMagicka(this.player.magicka, this.player.maxMagicka);
      this.ui.updateStamina(this.player.stamina, this.player.maxStamina);

      // Update stats only if inventory is open (optimization)
      if (this.inventorySystem.isOpen) {
          this.ui.updateStats(this.player);
      }
  }
}
