import { Scene } from "@babylonjs/core/scene";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import { Player } from "./entities/player";
import { UIManager } from "./ui/ui-manager";
import { WorldManager } from "./world/world-manager";
import { LevelManager } from "./world/level-manager";
import { ScheduleSystem } from "./systems/schedule-system";
import { CombatSystem } from "./systems/combat-system";
import { DialogueSystem } from "./systems/dialogue-system";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import { KeyboardEventTypes } from "@babylonjs/core/Events/keyboardEvents";
import { InventorySystem } from "./systems/inventory-system";
import { InteractionSystem } from "./systems/interaction-system";

export class Game {
  public scene: Scene;
  public canvas: HTMLCanvasElement;
  public engine: Engine | WebGPUEngine;
  public player: Player;
  public ui: UIManager;
  public world: WorldManager;
  public levelManager: LevelManager;
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
    this.levelManager = new LevelManager(this.scene, this.scheduleSystem);

    this.combatSystem = new CombatSystem(this.scene, this.player, this.scheduleSystem.npcs, this.ui);
    this.dialogueSystem = new DialogueSystem(this.scene, this.player, this.scheduleSystem.npcs, this.canvas);
    this.inventorySystem = new InventorySystem(this.player, this.ui, this.canvas);
    this.interactionSystem = new InteractionSystem(this.scene, this.player, this.inventorySystem, this.dialogueSystem);

    // Load initial level
    this.levelManager.loadLevel();

    // Input handling for combat
    this.scene.onPointerObservable.add((pointerInfo) => {
        if (this.isPaused || this.inventorySystem.isOpen) return;

        if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
            // Need to check if clicking on GUI?
            // Babylon GUI usually blocks pointer events if isPointerBlocker is true.
            // But just in case, we have the isOpen check.

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
    this.ui.saveButton.onPointerUpObservable.add(() => console.log("Save Game (Mock)"));
    this.ui.loadButton.onPointerUpObservable.add(() => console.log("Load Game (Mock)"));
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
