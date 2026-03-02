import { Scene } from "@babylonjs/core/scene";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
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
import { SkillTreeSystem } from "./systems/skill-tree-system";
import { AudioSystem } from "./systems/audio-system";
import { NavigationSystem } from "./systems/navigation-system";
import { Loot } from "./entities/loot";
import { FrameworkRuntime } from "./framework/runtime/framework-runtime";
import { frameworkBaseContent } from "./framework/content/base-content";
import { MapEditorSystem } from "./systems/map-editor-system";

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
  public skillTreeSystem: SkillTreeSystem;
  public audioSystem: AudioSystem;
  public navigationSystem: NavigationSystem;
  public frameworkRuntime: FrameworkRuntime;
  public mapEditorSystem: MapEditorSystem;

  public isPaused: boolean = false;

  // Chunk tracking for navmesh rebuild triggers
  private _lastNavChunkX: number = NaN;
  private _lastNavChunkZ: number = NaN;

  // Cached stat values to avoid redundant UI bar updates every frame
  private _lastHealth: number = -1;
  private _lastMagicka: number = -1;
  private _lastStamina: number = -1;
  private _lastExperience: number = -1;
  private _lastLevel: number = -1;

  // Death feedback: true while health is at 0 so the notification fires once per "death"
  private _playerAtZeroHP: boolean = false;

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
    this.navigationSystem = new NavigationSystem(this.scene);
    this.scheduleSystem = new ScheduleSystem(this.scene);

    // Test NPC
    const npc = new NPC(this.scene, new Vector3(10, 2, 10), "Guard");
    npc.patrolPoints = [new Vector3(10, 2, 10), new Vector3(10, 2, 20), new Vector3(20, 2, 20), new Vector3(20, 2, 10)];
    this.scheduleSystem.addNPC(npc);

    // Wire up structure NPC spawning so guards are tracked by schedule & combat
    this.world.structures.onNPCSpawn = (npc) => {
      this.scheduleSystem.addNPC(npc);
    };

    this.combatSystem = new CombatSystem(this.scene, this.player, this.scheduleSystem.npcs, this.ui, this.navigationSystem);
    this.dialogueSystem = new DialogueSystem(this.scene, this.player, this.scheduleSystem.npcs, this.canvas);
    this.inventorySystem = new InventorySystem(this.player, this.ui, this.canvas);
    this.equipmentSystem = new EquipmentSystem(this.player, this.inventorySystem, this.ui);
    this.ui.onInventoryItemClick = (item) => this.equipmentSystem.handleItemClick(item);
    this.saveSystem = new SaveSystem(this.player, this.inventorySystem, this.equipmentSystem, this.ui);
    this.questSystem = new QuestSystem(this.ui);
    this.saveSystem.setQuestSystem(this.questSystem);
    this.saveSystem.onAfterLoad = () => this._cleanupCollectedLoot();
    this.interactionSystem = new InteractionSystem(this.scene, this.player, this.inventorySystem, this.dialogueSystem, this.ui);
    this.skillTreeSystem = new SkillTreeSystem(this.player, this.ui);
    this.ui.onSkillPurchase = (treeIdx, skillIdx) => this.skillTreeSystem.purchaseSkill(treeIdx, skillIdx);
    this.saveSystem.setSkillTreeSystem(this.skillTreeSystem);
    this.audioSystem = new AudioSystem();
    this.frameworkRuntime = new FrameworkRuntime(frameworkBaseContent, {
      inventoryCapacity: this.inventorySystem.maxCapacity,
      fetchImpl: (url: string) => fetch(url),
    });
    this.frameworkRuntime.questEngine.activateQuest("quest_guard_resolution");
    this.saveSystem.setFrameworkRuntime(this.frameworkRuntime);
    this.dialogueSystem.dialogueSessionProvider = (targetNpc) => this._createFrameworkDialogueSession(targetNpc.mesh.name);
    this._loadFrameworkMods();
    this.mapEditorSystem = new MapEditorSystem(this.scene);

    // Prevent browser context menu from capturing right-click combat input.
    this.canvas.addEventListener("contextmenu", (event) => event.preventDefault());

    // Wire quest event callbacks
    this.combatSystem.onNPCDeath = (name, xp) => {
        this.questSystem.onKill(name);
        this._applyFrameworkQuestEvent("kill", this._toFrameworkTargetId(name));
        this.player.addExperience(xp);
        this.ui.showNotification(`+${xp} XP`, 2000);
        this.audioSystem.playNPCDeath();
    };
    this.combatSystem.onPlayerHit = () => this.audioSystem.playPlayerHit();
    this.interactionSystem.onLootPickup = (id) => {
        this.questSystem.onPickup(id);
        this._applyFrameworkQuestEvent("pickup", id);
        const frameworkItemId = this._toFrameworkInventoryItemId(id);
        if (frameworkItemId) this.frameworkRuntime.inventoryEngine.addItem(frameworkItemId, 1);
    };
    this.dialogueSystem.onTalkStart  = (name)  => {
        this.questSystem.onTalk(name);
        this._applyFrameworkQuestEvent("talk", this._toFrameworkTargetId(name));
    };

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
        if (this._isCombatInputBlocked()) return;

        if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
            if (pointerInfo.event.button === 0) { // Left Click
                const attacked = this.combatSystem.meleeAttack();
                if (attacked) this.audioSystem.playMeleeAttack();
            } else if (pointerInfo.event.button === 2) { // Right Click
                pointerInfo.event.preventDefault();
                const casted = this.combatSystem.magicAttack();
                if (casted) this.audioSystem.playMagicAttack();
            }
        }
    });

    // Input handling for pause
    this.scene.onKeyboardObservable.add((kbInfo) => {
        if (kbInfo.type === KeyboardEventTypes.KEYDOWN) {
            if (kbInfo.event.key === "Escape") {
                if (this.dialogueSystem.isInDialogue) return;
                this.togglePause();
            } else if (kbInfo.event.key === "j" || kbInfo.event.key === "J") {
                if (!this.isPaused && !this.inventorySystem.isOpen && !this.dialogueSystem.isInDialogue && !this.skillTreeSystem.isOpen) {
                    this.questSystem.toggleQuestLog();
                    if (this.questSystem.isLogOpen) {
                        this.interactionSystem.isBlocked = true;
                        document.exitPointerLock();
                        this.player.camera.detachControl();
                    } else {
                        this.interactionSystem.isBlocked = false;
                        this.canvas.requestPointerLock();
                        this.player.camera.attachControl(this.canvas, true);
                    }
                }
            } else if (kbInfo.event.key === "k" || kbInfo.event.key === "K") {
                if (!this.isPaused && !this.inventorySystem.isOpen && !this.dialogueSystem.isInDialogue && !this.questSystem.isLogOpen) {
                    this.skillTreeSystem.toggle();
                    if (this.skillTreeSystem.isOpen) {
                        this.interactionSystem.isBlocked = true;
                        document.exitPointerLock();
                        this.player.camera.detachControl();
                    } else {
                        this.interactionSystem.isBlocked = false;
                        this.canvas.requestPointerLock();
                        this.player.camera.attachControl(this.canvas, true);
                    }
                }
            } else if (kbInfo.event.key === "1") {
                if (!this.isPaused && !this.dialogueSystem.isInDialogue) this.combatSystem.setMeleeArchetype("duelist");
            } else if (kbInfo.event.key === "2") {
                if (!this.isPaused && !this.dialogueSystem.isInDialogue) this.combatSystem.setMeleeArchetype("soldier");
            } else if (kbInfo.event.key === "3") {
                if (!this.isPaused && !this.dialogueSystem.isInDialogue) this.combatSystem.setMeleeArchetype("bruiser");
            } else if (kbInfo.event.key === "4") {
                if (!this.isPaused && !this.dialogueSystem.isInDialogue) this.combatSystem.setMagicArchetype("spark");
            } else if (kbInfo.event.key === "5") {
                if (!this.isPaused && !this.dialogueSystem.isInDialogue) this.combatSystem.setMagicArchetype("bolt");
            } else if (kbInfo.event.key === "6") {
                if (!this.isPaused && !this.dialogueSystem.isInDialogue) this.combatSystem.setMagicArchetype("surge");
            } else if (kbInfo.event.key === "m" || kbInfo.event.key === "M") {
                this.audioSystem.toggleMute();
                this.ui.showNotification(this.audioSystem.isMuted ? "Audio muted" : "Audio unmuted", 1500);
            } else if (kbInfo.event.key === "F2") {
                const isEnabled = this.mapEditorSystem.toggle();
                this.interactionSystem.isBlocked = isEnabled;
                if (isEnabled) {
                    document.exitPointerLock();
                    this.player.camera.detachControl();
                } else {
                    this.canvas.requestPointerLock();
                    this.player.camera.attachControl(this.canvas, true);
                }
                this.ui.showNotification(isEnabled ? "Map editor mode enabled" : "Map editor mode disabled", 1800);
            } else if (kbInfo.event.key === "g" || kbInfo.event.key === "G") {
                if (!this.mapEditorSystem.isEnabled) return;
                const mode = this.mapEditorSystem.cycleGizmoMode();
                this.ui.showNotification(`Editor gizmo: ${mode}`, 1400);
            } else if (kbInfo.event.key === "n" || kbInfo.event.key === "N") {
                if (!this.mapEditorSystem.isEnabled) return;
                const placeAt = this.player.camera.position.add(this.player.camera.getForwardRay(8).direction.scale(4));
                placeAt.y = Math.max(1, placeAt.y);
                this.mapEditorSystem.placeMarkerAt(placeAt);
                this.ui.showNotification("Editor marker placed", 1200);
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
              this.interactionSystem.isBlocked = true;
          }
          if (this.skillTreeSystem.isOpen) {
              this.skillTreeSystem.isOpen = false;
              this.ui.toggleSkillTree(false);
              // Pointer lock already released by togglePause path; no re-attachment needed here
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
    // Sky-blue clear color
    this.scene.clearColor = new Color4(0.42, 0.55, 0.72, 1.0);

    // Ambient hemisphere light — warm sky, cool ground
    const hLight = new HemisphericLight("hLight", new Vector3(0, 1, 0), this.scene);
    hLight.intensity = 0.55;
    hLight.diffuse    = new Color3(0.95, 0.90, 0.78);
    hLight.groundColor = new Color3(0.28, 0.22, 0.16);
    hLight.specular   = new Color3(0, 0, 0);

    // Directional sun light for depth-shading
    const sun = new DirectionalLight("sun", new Vector3(-1.4, -2.2, -1.0).normalize(), this.scene);
    sun.intensity = 0.85;
    sun.diffuse   = new Color3(1.0, 0.96, 0.82);
    sun.specular  = new Color3(0.18, 0.16, 0.10);

    // Atmospheric distance fog
    this.scene.fogMode    = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.006;
    this.scene.fogColor   = new Color3(0.50, 0.60, 0.72);
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

  private _loadFrameworkMods(): void {
      this.frameworkRuntime
          .loadModsFromManifest("/mods/mods-manifest.json")
          .then((report) => {
              if (report.loadedModIds.length > 0) {
                  this.ui.showNotification(`Framework mods loaded: ${report.loadedModIds.length}`, 2200);
              }
              if (report.failures.length > 0) {
                  this.ui.showNotification(`Framework mod failures: ${report.failures.length}`, 3000);
              }
          })
          .catch(() => {
              // Mods are optional for local runtime; ignore network/404 failures.
          });
  }

  private _createFrameworkDialogueSession(npcName: string) {
      const dialogueId = this._resolveFrameworkDialogueId(npcName);
      if (!dialogueId) return null;
      try {
          return this.frameworkRuntime.createDialogueSession(dialogueId);
      } catch {
          return null;
      }
  }

  private _resolveFrameworkDialogueId(npcName: string): string | null {
      if (npcName.includes("Guard")) return "guard_intro";
      return null;
  }

  private _toFrameworkTargetId(entityName: string): string {
      if (entityName.startsWith("RuinGuard")) return "RuinGuard";
      if (entityName.startsWith("TowerGuard")) return "TowerGuard";
      return entityName.split("_")[0];
  }

  private _toFrameworkInventoryItemId(itemId: string): string | null {
      if (itemId === "potion_hp_01") return "health_potion";
      if (itemId === "sword_01") return "iron_sword";
      if (itemId === "guard_token") return "guard_token";
      return null;
  }

  private _applyFrameworkQuestEvent(
      type: "kill" | "pickup" | "talk" | "custom",
      targetId: string,
      amount: number = 1
  ): void {
      const updates = this.frameworkRuntime.applyQuestEvent({ type, targetId, amount });
      for (const update of updates) {
          if (!update.questCompleted) continue;
          this.ui.showNotification(`Framework quest complete: ${update.questId}`, 2800);
          if (update.xpReward > 0) {
              this.player.addExperience(update.xpReward);
              this.ui.showNotification(`+${update.xpReward} XP`, 2000);
          }
      }
  }

  update(): void {
      if (this.isPaused) return;

      const deltaTime = this.engine.getDeltaTime() / 1000;

      this.player.update(deltaTime);
      this.audioSystem.updateFootsteps(deltaTime, this.player.camera.position);
      this.world.update(this.player.camera.position);
      this.scheduleSystem.update(deltaTime);
      this.combatSystem.updateNPCAI(deltaTime);
      this.interactionSystem.update();

      // Tick the navmesh rebuild debounce; request a rebuild whenever the player
      // crosses into a new terrain chunk (new ground meshes may have loaded).
      this.navigationSystem.update(deltaTime);
      const chunkSize = 50;
      const cx = Math.floor(this.player.camera.position.x / chunkSize);
      const cz = Math.floor(this.player.camera.position.z / chunkSize);
      if (cx !== this._lastNavChunkX || cz !== this._lastNavChunkZ) {
        this._lastNavChunkX = cx;
        this._lastNavChunkZ = cz;
        this.navigationSystem.requestRebuild();
      }

      // Only update UI bars when values have actually changed
      if (this.player.health !== this._lastHealth) {
          this._lastHealth = this.player.health;
          this.ui.updateHealth(this.player.health, this.player.maxHealth);

          if (this.player.health <= 0 && !this._playerAtZeroHP) {
              this._playerAtZeroHP = true;
              this.ui.showHitFlash("rgba(180, 0, 0, 0.55)");
              this.ui.showNotification("You are gravely wounded!", 3500);
          } else if (this.player.health > 0 && this._playerAtZeroHP) {
              this._playerAtZeroHP = false;
          }
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

      // Refresh the stats panel every frame while inventory is open so live values
      // (health regen, damage taken, equipment changes) are always current.
      if (this.inventorySystem.isOpen) {
          this.ui.updateStats(this.player);
      }
  }

  private _isCombatInputBlocked(): boolean {
      return (
          this.isPaused ||
          this.mapEditorSystem.isEnabled ||
          this.inventorySystem.isOpen ||
          this.questSystem.isLogOpen ||
          this.skillTreeSystem.isOpen ||
          this.dialogueSystem.isInDialogue ||
          this.interactionSystem.isBlocked
      );
  }
}
