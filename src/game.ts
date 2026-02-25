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
import { InventorySystem } from "./systems/inventory-system";
import { InteractionSystem } from "./systems/interaction-system";
import { Loot } from "./entities/loot";
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
  public inventorySystem: InventorySystem;
  public interactionSystem: InteractionSystem;

  constructor(scene: Scene, canvas: HTMLCanvasElement, engine: Engine | WebGPUEngine) {
    this.scene = scene;
    this.canvas = canvas;
    this.engine = engine;

    this.init();
  }

  init(): void {
    this._setLight();
    this.player = new Player(this.scene, this.canvas);
    this.ui = new UIManager(this.scene, this.player);
    this.world = new WorldManager(this.scene);
    this.scheduleSystem = new ScheduleSystem(this.scene);

    // Test NPC
    const npc = new NPC(this.scene, new Vector3(10, 2, 10), "Guard");
    npc.patrolPoints = [new Vector3(10, 2, 10), new Vector3(10, 2, 20), new Vector3(20, 2, 20), new Vector3(20, 2, 10)];
    this.scheduleSystem.addNPC(npc);

    this.combatSystem = new CombatSystem(this.scene, this.player, this.scheduleSystem.npcs);
    this.dialogueSystem = new DialogueSystem(this.scene, this.player, this.scheduleSystem.npcs, this.canvas);
    this.inventorySystem = new InventorySystem(this.player);
    this.interactionSystem = new InteractionSystem(this.scene, this.player, this.dialogueSystem, this.inventorySystem, this.scheduleSystem.npcs);

    // Bind UI actions
    this.ui.onUseItem = (item) => {
        this.inventorySystem.useItem(item);
        this.ui.updateInventory(this.inventorySystem.items);
    };

    // Spawn test loot
    this._spawnTestLoot();

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
                this.ui.toggleInventory();
                this.ui.updateInventory(this.inventorySystem.items);
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

  _spawnTestLoot(): void {
      const potion = new Loot(this.scene, new Vector3(5, 5, 5), {
          id: "pot_health",
          name: "Health Potion",
          type: "Consumable",
          description: "Restores health.",
          color: "red"
      });
      this.interactionSystem.addLoot(potion);

      const sword = new Loot(this.scene, new Vector3(8, 5, 8), {
          id: "wep_sword",
          name: "Iron Sword",
          type: "Weapon",
          description: "Sharp and pointy.",
          color: "gray",
          slot: "mainHand",
          stats: { damage: 10 }
      });
      this.interactionSystem.addLoot(sword);
  }

  update(): void {
      const deltaTime = this.engine.getDeltaTime() / 1000;

      this.player.update(deltaTime);
      this.world.update(this.player.camera.position);
      this.scheduleSystem.update(deltaTime);

      // Interaction Update
      this.interactionSystem.update();
      if (this.interactionSystem.currentTarget) {
          if (this.interactionSystem.currentTarget.type === 'npc') {
              this.ui.interactionLabel.text = "E to Talk";
          } else {
              this.ui.interactionLabel.text = `E to Pick Up ${this.interactionSystem.currentTarget.entity.item.name}`;
          }
      } else {
          this.ui.interactionLabel.text = "";
      }

      this.ui.updateHealth(this.player.health, this.player.maxHealth);
      this.ui.updateMagicka(this.player.magicka, this.player.maxMagicka);
      this.ui.updateStamina(this.player.stamina, this.player.maxStamina);
  }
}
