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
import { EquipmentSystem } from "./systems/equipment-system";
import { SaveSystem } from "./systems/save-system";
import { QuestSystem } from "./systems/quest-system";
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
  public equipmentSystem: EquipmentSystem;
  public saveSystem: SaveSystem;
  public questSystem: QuestSystem;
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
    this.equipmentSystem = new EquipmentSystem(this.player, this.inventorySystem, this.ui);
    this.ui.onInventoryItemClick = (item) => this.equipmentSystem.handleItemClick(item);
    this.saveSystem = new SaveSystem(this.player, this.inventorySystem, this.equipmentSystem, this.ui);
    this.questSystem = new QuestSystem(this.ui);
    this.saveSystem.setQuestSystem(this.questSystem);
    this.interactionSystem = new InteractionSystem(this.scene, this.player, this.inventorySystem, this.dialogueSystem);

    // Wire quest event callbacks
    this.combatSystem.onNPCDeath    = (name)   => this.questSystem.onKill(name);
    this.interactionSystem.onLootPickup = (id) => this.questSystem.onPickup(id);
    this.dialogueSystem.onTalkStart  = (name)  => this.questSystem.onTalk(name);

    // Test Loot
    new Loot(this.scene, new Vector3(5, 1, 5), {
        id: "sword_01",
        name: "Iron Sword",
        description: "A rusty iron sword.",
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

    new Loot(this.scene, new Vector3(6, 1, 7), {
        id: "leather_chest_01",
        name: "Leather Chest",
        description: "Light armor. +3 Armor.",
        stackable: false,
        quantity: 1,
        slot: "chest",
        stats: { armor: 3 }
    });

    new Loot(this.scene, new Vector3(8, 1, 7), {
        id: "iron_helm_01",
        name: "Iron Helm",
        description: "A sturdy iron helmet. +2 Armor.",
        stackable: false,
        quantity: 1,
        slot: "head",
        stats: { armor: 2 }
    });

    // Test Quests
    this.questSystem.addQuest({
        id: "quest_kill_guard",
        name: "Eliminate the Guard",
        description: "A rogue guard threatens the village. Defeat him.",
        isCompleted: false,
        isActive: true,
        reward: "100 XP",
        objectives: [{
            id: "obj_kill_guard",
            type: "kill",
            description: "Defeat the Guard",
            targetId: "Guard",
            required: 1,
            current: 0,
            completed: false
        }]
    });
    this.questSystem.addQuest({
        id: "quest_collect_potions",
        name: "Stock the Medicine Chest",
        description: "The village healer needs supplies.",
        isCompleted: false,
        isActive: true,
        reward: "50 XP",
        objectives: [{
            id: "obj_collect_potions",
            type: "fetch",
            description: "Collect Health Potions",
            targetId: "potion_hp_01",
            required: 1,
            current: 0,
            completed: false
        }]
    });
    this.questSystem.addQuest({
        id: "quest_speak_guard",
        name: "Parley with the Guard",
        description: "Try talking to the Guard before resorting to violence.",
        isCompleted: false,
        isActive: true,
        reward: "25 XP",
        objectives: [{
            id: "obj_talk_guard",
            type: "talk",
            description: "Speak with the Guard",
            targetId: "Guard",
            required: 1,
            current: 0,
            completed: false
        }]
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
            } else if (kbInfo.event.key === "j" || kbInfo.event.key === "J") {
                this.questSystem.toggleQuestLog();
            } else if (kbInfo.event.key === "F5") {
                this.saveSystem.save();
            } else if (kbInfo.event.key === "F9") {
                this.saveSystem.load();
            }
        }
    });

    // Wire up Pause Menu buttons
    this.ui.resumeButton.onPointerUpObservable.add(() => this.togglePause());
    this.ui.saveButton.onPointerUpObservable.add(() => this.saveSystem.save());
    this.ui.loadButton.onPointerUpObservable.add(() => this.saveSystem.load());
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
