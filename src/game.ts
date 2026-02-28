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

  // Player death/respawn state
  private _playerDead: boolean = false;
  private _respawnTimer: number = 0;
  private static readonly RESPAWN_DELAY_MS = 3000;

  // Cached stat values to avoid redundant UI bar updates every frame
  private _lastHealth: number = -1;
  private _lastMagicka: number = -1;
  private _lastStamina: number = -1;
  private _lastExperience: number = -1;
  private _lastLevel: number = -1;

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

    // Wire up structure NPC spawning so guards are tracked by schedule & combat
    this.world.structures.onNPCSpawn = (npc) => {
      this.scheduleSystem.addNPC(npc);
    };

    this.combatSystem = new CombatSystem(this.scene, this.player, this.scheduleSystem.npcs, this.ui);
    this.dialogueSystem = new DialogueSystem(this.scene, this.player, this.scheduleSystem.npcs, this.canvas);
    this.inventorySystem = new InventorySystem(this.player, this.ui, this.canvas);
    this.equipmentSystem = new EquipmentSystem(this.player, this.inventorySystem, this.ui);
    // Route consumable items (potions) to useItem; equipment items go to equip/unequip
    this.ui.onInventoryItemClick = (item) => {
        if (item.stats?.heal) {
            this.inventorySystem.useItem(item.id);
        } else {
            this.equipmentSystem.handleItemClick(item);
        }
    };
    this.saveSystem = new SaveSystem(this.player, this.inventorySystem, this.equipmentSystem, this.ui);
    this.questSystem = new QuestSystem(this.ui);
    this.saveSystem.setQuestSystem(this.questSystem);
    this.saveSystem.onAfterLoad = () => this._cleanupCollectedLoot();
    this.interactionSystem = new InteractionSystem(this.scene, this.player, this.inventorySystem, this.dialogueSystem);

    // Wire quest event callbacks
    this.combatSystem.onNPCDeath = (name, xp) => {
        this.questSystem.onKill(name);
        this.player.addExperience(xp);
        this.ui.showNotification(`+${xp} XP`, 2000);
    };
    this.interactionSystem.onLootPickup = (id) => this.questSystem.onPickup(id);
    this.dialogueSystem.onTalkStart  = (name)  => this.questSystem.onTalk(name);

    // Wire XP callbacks
    this.questSystem.onQuestComplete = (xp) => {
        this.player.addExperience(xp);
        this.ui.showNotification(`+${xp} XP`, 2000);
    };
    this.player.onLevelUp = (newLevel) => {
        this.ui.showNotification(`Level Up! You are now level ${newLevel}!`, 4000);
    };

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
        xpReward: 100,
        objectives: [{
            id: "obj_kill_guard",
            type: "kill",
            description: "Defeat the Guard",
            targetId: "Guard",
            required: 1,
            current: 0,
            completed: false
        }]
    }, true);
    this.questSystem.addQuest({
        id: "quest_collect_potions",
        name: "Stock the Medicine Chest",
        description: "The village healer needs supplies.",
        isCompleted: false,
        isActive: true,
        reward: "50 XP",
        xpReward: 50,
        objectives: [{
            id: "obj_collect_potions",
            type: "fetch",
            description: "Collect Health Potions",
            targetId: "potion_hp_01",
            required: 1,
            current: 0,
            completed: false
        }]
    }, true);
    this.questSystem.addQuest({
        id: "quest_speak_guard",
        name: "Parley with the Guard",
        description: "Try talking to the Guard before resorting to violence.",
        isCompleted: false,
        isActive: true,
        reward: "25 XP",
        xpReward: 25,
        objectives: [{
            id: "obj_talk_guard",
            type: "talk",
            description: "Speak with the Guard",
            targetId: "Guard",
            required: 1,
            current: 0,
            completed: false
        }]
    }, true);

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
                if (!this.isPaused && !this.inventorySystem.isOpen && !this.dialogueSystem.isInDialogue) this.questSystem.toggleQuestLog();
            } else if (kbInfo.event.key === "F5") {
                if (!this.isPaused) this.saveSystem.save();
            } else if (kbInfo.event.key === "F9") {
                if (!this.isPaused) this.saveSystem.load();
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

  /** Respawn the player at origin with half health, reset NPC aggro. */
  private _respawn(): void {
      this._playerDead = false;
      this.player.health = Math.floor(this.player.maxHealth * 0.5);
      this.player.magicka = this.player.maxMagicka;
      this.player.stamina = this.player.maxStamina;
      this.player.camera.position = new Vector3(0, 5, 0);
      this.player.camera.attachControl(this.canvas, true);
      // De-aggro all living NPCs
      for (const npc of this.scheduleSystem.npcs) {
          if (!npc.isDead) npc.isAggressive = false;
      }
      this.ui.showNotification("Respawned. Stay vigilant!", 2500);
  }

  togglePause(): void {
      this.isPaused = !this.isPaused;
      this.ui.togglePauseMenu(this.isPaused);

      if (this.isPaused) {
          // Close any open overlays
          if (this.inventorySystem.isOpen) {
              this.inventorySystem.isOpen = false;
              this.ui.toggleInventory(false);
          }
          if (this.questSystem.isLogOpen) {
              this.questSystem.isLogOpen = false;
              this.ui.toggleQuestLog(false);
          }
          this.interactionSystem.isBlocked = true;
          this.ui.setInteractionText("");
          document.exitPointerLock();
          this.player.camera.detachControl();
      } else {
          this.interactionSystem.isBlocked = false;
          this.canvas.requestPointerLock();
          this.player.camera.attachControl(this.canvas, true);
      }
  }

  _setLight(): void {
    const light = new HemisphericLight("light", new Vector3(0, 1, 0), this.scene);
    light.intensity = 0.5;
  }

  /** Remove world loot objects whose item IDs are now in inventory or equipment (called after load). */
  private _cleanupCollectedLoot(): void {
      const collectedIds = new Set<string>();
      for (const item of this.inventorySystem.items) {
          collectedIds.add(item.id);
      }
      for (const item of this.equipmentSystem.getEquipped().values()) {
          collectedIds.add(item.id);
      }
      // Iterate a snapshot to avoid mutation during iteration
      for (const mesh of this.scene.meshes.slice()) {
          if (mesh.metadata?.type === 'loot') {
              const loot = mesh.metadata.loot;
              if (collectedIds.has(loot.item.id)) {
                  loot.dispose();
              }
          }
      }
  }

  update(): void {
      if (this.isPaused) return;

      const deltaTime = this.engine.getDeltaTime() / 1000;

      // Handle player death / respawn
      if (this.player.health <= 0 && !this._playerDead) {
          this._playerDead = true;
          this._respawnTimer = Game.RESPAWN_DELAY_MS;
          this.ui.showNotification("You have been defeated! Respawning...", Game.RESPAWN_DELAY_MS);
          this.player.camera.detachControl();
      }

      if (this._playerDead) {
          this._respawnTimer -= deltaTime * 1000;
          if (this._respawnTimer <= 0) {
              this._respawn();
          }
          return; // skip remaining systems while dead
      }

      this.player.update(deltaTime);
      this.world.update(this.player.camera.position);
      this.scheduleSystem.update(deltaTime);
      this.combatSystem.updateNPCAI(deltaTime);
      this.interactionSystem.update();

      // Update compass from camera forward direction
      const forward = this.player.camera.getForwardRay(1).direction;
      const yawDeg = Math.atan2(forward.x, forward.z) * (180 / Math.PI);
      this.ui.updateCompass(yawDeg);

      // Only update UI bars when values have actually changed
      if (this.player.health !== this._lastHealth) {
          this._lastHealth = this.player.health;
          this.ui.updateHealth(this.player.health, this.player.maxHealth);
      }
      if (this.player.magicka !== this._lastMagicka) {
          this._lastMagicka = this.player.magicka;
          this.ui.updateMagicka(this.player.magicka, this.player.maxMagicka);
      }
      if (this.player.stamina !== this._lastStamina) {
          this._lastStamina = this.player.stamina;
          this.ui.updateStamina(this.player.stamina, this.player.maxStamina);
      }

      if (this.player.experience !== this._lastExperience || this.player.level !== this._lastLevel) {
          this._lastExperience = this.player.experience;
          this._lastLevel = this.player.level;
          this.ui.updateXP(this.player.experience, this.player.experienceToNextLevel, this.player.level);
      }

      // Update stats only if inventory is open (optimization)
      if (this.inventorySystem.isOpen) {
          this.ui.updateStats(this.player);
      }
  }
}
