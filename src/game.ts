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
import { NPC, AIState } from "./entities/npc";
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
import { MapEditorPropertyPanel } from "./ui/map-editor-property-panel";
import { MapEditorToolbar } from "./ui/map-editor-toolbar";
import { MapEditorHierarchyPanel } from "./ui/map-editor-hierarchy-panel";
import { AttributeSystem } from "./systems/attribute-system";
import { TimeSystem } from "./systems/time-system";
import { StealthSystem } from "./systems/stealth-system";
import { CrimeSystem } from "./systems/crime-system";
import { ContainerSystem } from "./systems/container-system";
import { ProjectileSystem } from "./systems/projectile-system";
import { BarterSystem } from "./systems/barter-system";
import { CellManager } from "./world/cell-manager";
import { SpellSystem } from "./systems/spell-system";
import { PersuasionSystem } from "./systems/persuasion-system";
import { GameEventBus } from "./systems/event-bus";
import { LootTableSystem, STARTER_LOOT_TABLES } from "./systems/loot-table-system";
import { NpcArchetypeSystem } from "./systems/npc-archetype-system";
import { FixedStepLoop } from "./systems/fixed-step-loop";
import { AlchemySystem } from "./systems/alchemy-system";
import { AlchemyUI } from "./ui/alchemy-ui";
import { EnchantingSystem } from "./systems/enchanting-system";
import { EnchantingUI } from "./ui/enchanting-ui";
import { LodSystem } from "./systems/lod-system";
import { WeatherSystem } from "./systems/weather-system";
import { QuickSlotSystem } from "./systems/quickslot-system";
import { WaitSystem } from "./systems/wait-system";
import { SkillProgressionSystem } from "./systems/skill-progression-system";
import { FastTravelSystem } from "./systems/fast-travel-system";
import { LevelScalingSystem } from "./systems/level-scaling-system";
import { FameSystem } from "./systems/fame-system";
import { ActiveEffectsSystem } from "./systems/active-effects-system";
import { JailSystem } from "./systems/jail-system";
import { SpellMakingSystem } from "./systems/spell-making-system";
import { RespawnSystem } from "./systems/respawn-system";
import { MerchantRestockSystem } from "./systems/merchant-restock-system";
import { BirthsignSystem } from "./systems/birthsign-system";
import { ClassSystem } from "./systems/class-system";
import { RaceSystem } from "./systems/race-system";
import { CharacterCreationUI } from "./ui/character-creation-ui";
import { QuestCreatorSystem } from "./systems/quest-creator-system";
import { QuestCreatorUI } from "./ui/quest-creator-ui";
import { DialogueCreatorSystem } from "./systems/dialogue-creator-system";
import { DialogueCreatorUI } from "./ui/dialogue-creator-ui";
import { NpcCreatorSystem } from "./systems/npc-creator-system";
import { NpcCreatorUI } from "./ui/npc-creator-ui";
import { ItemCreatorSystem } from "./systems/item-creator-system";
import { ItemCreatorUI } from "./ui/item-creator-ui";
import { FactionCreatorSystem } from "./systems/faction-creator-system";
import { FactionCreatorUI } from "./ui/faction-creator-ui";
import { LootTableCreatorSystem } from "./systems/loot-table-creator-system";
import { LootTableCreatorUI } from "./ui/loot-table-creator-ui";
import { EditorHubUI } from "./ui/editor-hub-ui";
import { buildHelpOverlayLines, summarizeValidationReport } from "./ui/editor-help-overlay";
import { FastTravelUI } from "./ui/fast-travel-ui";

/** XP awarded to the Sneak skill for each second of active sneaking. */
const SNEAK_XP_PER_SECOND = 2;
/** Inventory item ID used for player gold (bounty payment check). */
const GOLD_ITEM_ID = "gold_coins";

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
  public mapEditorPropertyPanel: MapEditorPropertyPanel;
  public mapEditorToolbar: MapEditorToolbar;
  public mapEditorHierarchyPanel: MapEditorHierarchyPanel;
  public questCreatorSystem: QuestCreatorSystem;
  public questCreatorUI: QuestCreatorUI;
  public dialogueCreatorSystem: DialogueCreatorSystem;
  public dialogueCreatorUI: DialogueCreatorUI;
  public npcCreatorSystem: NpcCreatorSystem;
  public npcCreatorUI: NpcCreatorUI;
  public itemCreatorSystem: ItemCreatorSystem;
  public itemCreatorUI: ItemCreatorUI;
  public factionCreatorSystem: FactionCreatorSystem;
  public factionCreatorUI: FactionCreatorUI;
  public lootTableCreatorSystem: LootTableCreatorSystem;
  public lootTableCreatorUI: LootTableCreatorUI;
  public editorHubUI: EditorHubUI;
  public fastTravelUI: FastTravelUI;

  // v2 systems (Oblivion-lite)
  public attributeSystem: AttributeSystem;
  public timeSystem: TimeSystem;
  public stealthSystem: StealthSystem;
  public crimeSystem: CrimeSystem;
  public containerSystem: ContainerSystem;
  public projectileSystem: ProjectileSystem;
  public barterSystem: BarterSystem;
  public cellManager: CellManager;

  // v3 systems (Oblivion-lite depth)
  public spellSystem: SpellSystem;
  public persuasionSystem: PersuasionSystem;
  public eventBus: GameEventBus;
  public lootTableSystem: LootTableSystem;
  public npcArchetypeSystem: NpcArchetypeSystem;

  // v4 systems (Oblivion-lite: alchemy)
  public alchemySystem: AlchemySystem;
  public alchemyUI: AlchemyUI;

  // v5 systems (Oblivion parity: enchanting)
  public enchantingSystem: EnchantingSystem;
  public enchantingUI: EnchantingUI;

  // v4 browser optimisation: LOD culling
  public lodSystem: LodSystem;

  // v6 systems (Oblivion atmosphere + hotkeys)
  public weatherSystem: WeatherSystem;
  public quickSlotSystem: QuickSlotSystem;

  // v7 systems (QoL + polish)
  public waitSystem: WaitSystem;

  // v8 systems (Oblivion depth: skill progression, fast travel, level scaling)
  public skillProgressionSystem: SkillProgressionSystem;
  public fastTravelSystem: FastTravelSystem;
  public levelScalingSystem: LevelScalingSystem;

  // v9 systems (Oblivion parity: fame/infamy, active effects, jail)
  public fameSystem: FameSystem;
  public activeEffectsSystem: ActiveEffectsSystem;
  public jailSystem: JailSystem;

  // v10 systems (Oblivion depth: spell making, respawn, merchant restock)
  public spellMakingSystem: SpellMakingSystem;
  public respawnSystem: RespawnSystem;
  public merchantRestockSystem: MerchantRestockSystem;

  // v11 systems (Oblivion depth: character creation — birthsign and class)
  public birthsignSystem: BirthsignSystem;
  public classSystem: ClassSystem;
  public raceSystem: RaceSystem;

  public isPaused: boolean = false;

  private readonly _gameplayLoop = new FixedStepLoop({
    fixedDeltaSeconds: 1 / 60,
    maxSubSteps: 5,
    maxAccumulatedSeconds: 0.25,
  });

  // Chunk tracking for navmesh rebuild triggers
  private _lastNavChunkX: number = NaN;
  private _lastNavChunkZ: number = NaN;

  // Cached stat values to avoid redundant UI bar updates every frame
  private _lastHealth: number = -1;
  private _lastMagicka: number = -1;
  private _lastStamina: number = -1;
  private _lastExperience: number = -1;
  private _lastLevel: number = -1;

  // Last LOD culled count for the debug overlay (updated from lodSystem.update())
  private _lastLodCulled: number = 0;

  // Death feedback: true while health is at 0 so the notification fires once per "death"
  private _playerAtZeroHP: boolean = false;
  private _helpOverlayEl: HTMLDivElement | null = null;
  private _helpOverlayVisible: boolean = false;

  constructor(scene: Scene, canvas: HTMLCanvasElement, engine: Engine | WebGPUEngine) {
    this.scene = scene;
    this.canvas = canvas;
    this.engine = engine;

    this.init();
  }


  private _toggleHelpOverlay(): void {
    if (!this._helpOverlayEl) {
      const panel = document.createElement("div");
      panel.style.position = "fixed";
      panel.style.top = "12px";
      panel.style.left = "12px";
      panel.style.maxWidth = "420px";
      panel.style.padding = "10px 12px";
      panel.style.borderRadius = "8px";
      panel.style.background = "rgba(16, 22, 30, 0.86)";
      panel.style.color = "#dbe9ff";
      panel.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
      panel.style.fontSize = "12px";
      panel.style.lineHeight = "1.4";
      panel.style.whiteSpace = "pre-wrap";
      panel.style.zIndex = "2200";
      panel.style.border = "1px solid rgba(170, 205, 255, 0.2)";
      panel.style.pointerEvents = "none";
      panel.style.display = "none";
      document.body.appendChild(panel);
      this._helpOverlayEl = panel;
    }

    this._helpOverlayVisible = !this._helpOverlayVisible;
    if (!this._helpOverlayEl) return;

    if (this._helpOverlayVisible) {
      this._helpOverlayEl.textContent = buildHelpOverlayLines(this.mapEditorSystem.isEnabled).join("\n");
      this._helpOverlayEl.style.display = "block";
    } else {
      this._helpOverlayEl.style.display = "none";
    }
  }

  private _refreshHelpOverlayIfVisible(): void {
    if (!this._helpOverlayVisible || !this._helpOverlayEl) return;
    this._helpOverlayEl.textContent = buildHelpOverlayLines(this.mapEditorSystem.isEnabled).join("\n");
  }

  private _refreshEditorToolbar(): void {
    this.mapEditorToolbar.update({
      placementType:      this.mapEditorSystem.currentPlacementType,
      gizmoMode:          this.mapEditorSystem.mode,
      terrainTool:        this.mapEditorSystem.terrainTool,
      entityCount:        this.mapEditorSystem.entityCount,
      activePatrolGroupId: this.mapEditorSystem.activePatrolGroupId,
    });
  }

  init(): void {
    this._setLight();
    this.player = new Player(this.scene, this.canvas);
    this.ui = new UIManager(this.scene);
    this.world = new WorldManager(this.scene);
    this.navigationSystem = new NavigationSystem(this.scene);
    this.scheduleSystem = new ScheduleSystem();

    // ── v2 Oblivion-lite systems ──────────────────────────────────────────────
    this.attributeSystem = new AttributeSystem();
    this.timeSystem      = new TimeSystem(120, 8);  // 2-min real day, start at 08:00
    this.cellManager     = new CellManager(this.scene, this.player);

    // Sync initial derived stats from attributes
    this.player.maxHealth      = this.attributeSystem.maxHealth;
    this.player.maxMagicka     = this.attributeSystem.maxMagicka;
    this.player.maxStamina     = this.attributeSystem.maxStamina;
    this.player.maxCarryWeight = this.attributeSystem.carryWeight;
    this.player.health         = this.player.maxHealth;
    this.player.magicka        = this.player.maxMagicka;
    this.player.stamina        = this.player.maxStamina;

    // Notify player of location changes; clear LOD registry on cell transition
    // so stale mesh references from the previous cell don't linger.
    // (onCellChanged is wired fully in the v8 block below once fastTravelSystem is ready)

    // Test NPC
    const npc = new NPC(this.scene, new Vector3(10, 2, 10), "Guard");
    npc.patrolPoints = [new Vector3(10, 2, 10), new Vector3(10, 2, 20), new Vector3(20, 2, 20), new Vector3(20, 2, 10)];
    this.scheduleSystem.addNPC(npc);

    // Wire up structure NPC spawning so guards are tracked by schedule & combat.
    // (Full wiring including level scaling is done in the v8 block below.)

    this.combatSystem       = new CombatSystem(this.scene, this.player, this.scheduleSystem.npcs, this.ui, this.navigationSystem);
    this.dialogueSystem     = new DialogueSystem(this.scene, this.player, this.scheduleSystem.npcs, this.canvas);
    this.inventorySystem    = new InventorySystem(this.player, this.ui, this.canvas);
    this.equipmentSystem    = new EquipmentSystem(this.player, this.inventorySystem, this.ui);
    this.ui.onInventoryItemClick = (item) => this.equipmentSystem.handleItemClick(item);
    this.saveSystem         = new SaveSystem(this.player, this.inventorySystem, this.equipmentSystem, this.ui);
    this.questSystem        = new QuestSystem(this.ui);
    this.saveSystem.setQuestSystem(this.questSystem);
    this.saveSystem.onAfterLoad = () => this._cleanupCollectedLoot();
    this.interactionSystem  = new InteractionSystem(this.scene, this.player, this.inventorySystem, this.dialogueSystem, this.ui);
    this.skillTreeSystem    = new SkillTreeSystem(this.player, this.ui);
    this.ui.onSkillPurchase = (treeIdx, skillIdx) => this.skillTreeSystem.purchaseSkill(treeIdx, skillIdx);
    this.saveSystem.setSkillTreeSystem(this.skillTreeSystem);
    this.audioSystem        = new AudioSystem();
    this.frameworkRuntime   = new FrameworkRuntime(frameworkBaseContent, {
      inventoryCapacity: this.inventorySystem.maxCapacity,
      fetchImpl: (url: string) => fetch(url),
      skillLevelProvider: (skillId: string) => this.skillTreeSystem.getSkillRank(skillId),
    });
    this.frameworkRuntime.questEngine.activateQuest("quest_guard_resolution");
    this.saveSystem.setFrameworkRuntime(this.frameworkRuntime);
    this.dialogueSystem.dialogueSessionProvider = (targetNpc) => this._createFrameworkDialogueSession(targetNpc.mesh.name);
    this._loadFrameworkMods();
    this.mapEditorSystem = new MapEditorSystem(this.scene);

    // ── Map editor property panel ─────────────────────────────────────────────
    this.mapEditorPropertyPanel = new MapEditorPropertyPanel(this.ui.uiTexture);
    this.mapEditorPropertyPanel.onApply = (entityId, props) => {
      this.mapEditorSystem.setEntityProperties(entityId, props);
      this.ui.showNotification("Properties applied", 1200);
    };
    this.mapEditorPropertyPanel.onDelete = (entityId) => {
      this.mapEditorSystem.removeEntity(entityId);
      this.ui.showNotification("Entity deleted", 1200);
      this.mapEditorHierarchyPanel.refresh(this.mapEditorSystem.listEntitySummaries());
    };
    this.mapEditorSystem.onEntitySelectionChanged = (entityId) => {
      if (entityId === null) {
        this.mapEditorPropertyPanel.hide();
        this.mapEditorHierarchyPanel.setSelection(null);
        return;
      }
      const entity = this.mapEditorSystem.getEntityProperties(entityId);
      const mesh = this.scene.getMeshByName(entityId);
      const type = mesh?.metadata?.editorType;
      if (type && entity !== null) {
        this.mapEditorPropertyPanel.show(entityId, type, entity);
      }
      this.mapEditorHierarchyPanel.setSelection(entityId);
    };

    // ── Map editor toolbar ────────────────────────────────────────────────────
    this.mapEditorToolbar = new MapEditorToolbar(this.ui.uiTexture);
    this.mapEditorToolbar.onPlacementTypeChange = (ptype) => {
      this.mapEditorSystem.currentPlacementType = ptype;
      this._refreshEditorToolbar();
    };
    this.mapEditorToolbar.onGizmoModeChange = (gmode) => {
      this.mapEditorSystem.setGizmoMode(gmode);
      this._refreshEditorToolbar();
    };

    // ── Map editor hierarchy panel ────────────────────────────────────────────
    this.mapEditorHierarchyPanel = new MapEditorHierarchyPanel(this.ui.uiTexture);
    this.mapEditorHierarchyPanel.onEntityClick = (entityId) => {
      this.mapEditorSystem.selectEntityById(entityId);
    };

    // ── Quest Creator ──────────────────────────────────────────────────────────
    this.questCreatorSystem = new QuestCreatorSystem();
    this.questCreatorUI = new QuestCreatorUI(this.questCreatorSystem);
    this.questCreatorUI.onClose = () => {
      this.interactionSystem.isBlocked = this.mapEditorSystem.isEnabled;
    };

    // ── Dialogue Creator ───────────────────────────────────────────────────────
    this.dialogueCreatorSystem = new DialogueCreatorSystem();
    this.dialogueCreatorUI = new DialogueCreatorUI(this.dialogueCreatorSystem);
    this.dialogueCreatorUI.onClose = () => {
      this.interactionSystem.isBlocked = this.mapEditorSystem.isEnabled;
    };

    // ── NPC Creator ────────────────────────────────────────────────────────────
    this.npcCreatorSystem = new NpcCreatorSystem();
    this.npcCreatorUI = new NpcCreatorUI(this.npcCreatorSystem);
    this.npcCreatorUI.onClose = () => {
      this.interactionSystem.isBlocked = this.mapEditorSystem.isEnabled;
    };

    // ── Item Creator ───────────────────────────────────────────────────────────
    this.itemCreatorSystem = new ItemCreatorSystem();
    this.itemCreatorUI = new ItemCreatorUI(this.itemCreatorSystem);
    this.itemCreatorUI.onClose = () => {
      this.interactionSystem.isBlocked = this.mapEditorSystem.isEnabled;
    };

    // ── Faction Creator ────────────────────────────────────────────────────────
    this.factionCreatorSystem = new FactionCreatorSystem();
    this.factionCreatorUI = new FactionCreatorUI(this.factionCreatorSystem);
    this.factionCreatorUI.onClose = () => {
      this.interactionSystem.isBlocked = this.mapEditorSystem.isEnabled;
    };

    // ── Loot Table Creator ─────────────────────────────────────────────────────
    this.lootTableCreatorSystem = new LootTableCreatorSystem();
    this.lootTableCreatorUI = new LootTableCreatorUI(this.lootTableCreatorSystem);
    this.lootTableCreatorUI.onClose = () => {
      this.interactionSystem.isBlocked = this.mapEditorSystem.isEnabled;
    };

    // ── Editor Hub ─────────────────────────────────────────────────────────────
    this.editorHubUI = new EditorHubUI({
      onOpen: (tool) => {
        this.interactionSystem.isBlocked = true;
        document.exitPointerLock();
        this.player.camera.detachControl();
        switch (tool) {
          case "map":
            if (!this.mapEditorSystem.isEnabled) {
              this.mapEditorSystem.toggle();
              this.mapEditorToolbar.show();
              this.mapEditorHierarchyPanel.show();
              this.mapEditorHierarchyPanel.refresh(this.mapEditorSystem.listEntitySummaries());
              this._refreshEditorToolbar();
              this.ui.showNotification("Map Editor enabled (F2 to exit)", 2500);
            }
            break;
          case "quest":
            this.questCreatorUI.open();
            break;
          case "dialogue":
            this.dialogueCreatorUI.open();
            break;
          case "npc":
            this.npcCreatorUI.open();
            break;
          case "item":
            this.itemCreatorUI.open();
            break;
          case "faction":
            this.factionCreatorUI.open();
            break;
          case "lootTable":
            this.lootTableCreatorUI.open();
            break;
        }
      },
    });
    this.editorHubUI.onClose = () => {
      this.interactionSystem.isBlocked = this.mapEditorSystem.isEnabled;
    };

    // ── Fast Travel UI ────────────────────────────────────────────────────────
    this.fastTravelUI = new FastTravelUI();
    this.fastTravelUI.onClose = () => {
      this.interactionSystem.isBlocked = this.mapEditorSystem.isEnabled;
      if (this.mapEditorSystem.isEnabled || this.isPaused) return;
      this.canvas.requestPointerLock();
      this.player.camera.attachControl(this.canvas, true);
    };

    // ── v2 system wiring ──────────────────────────────────────────────────────
    this.stealthSystem   = new StealthSystem(this.player, this.scheduleSystem.npcs, this.ui);
    this.crimeSystem     = new CrimeSystem(this.player, this.scheduleSystem.npcs, this.ui);
    this.containerSystem = new ContainerSystem(this.scene, this.player, this.inventorySystem, this.ui);
    this.projectileSystem = new ProjectileSystem(this.scene, this.player, this.scheduleSystem.npcs, this.ui);
    this.barterSystem    = new BarterSystem(this.inventorySystem, this.ui);

    // Register v2 systems with save
    this.saveSystem.setAttributeSystem(this.attributeSystem);
    this.saveSystem.setTimeSystem(this.timeSystem);
    this.saveSystem.setCrimeSystem(this.crimeSystem);
    this.saveSystem.setContainerSystem(this.containerSystem);
    this.saveSystem.setBarterSystem(this.barterSystem);
    this.saveSystem.setCellManager(this.cellManager);

    // ── v3 system wiring ──────────────────────────────────────────────────────
    this.eventBus        = new GameEventBus();
    this.lootTableSystem = new LootTableSystem();
    for (const t of STARTER_LOOT_TABLES) this.lootTableSystem.registerTable(t);

    // NPC archetype factory — pre-load archetypes from base content
    this.npcArchetypeSystem = new NpcArchetypeSystem();
    this.npcArchetypeSystem.registerAll(frameworkBaseContent.npcArchetypes);

    this.spellSystem     = new SpellSystem(this.player, this.scheduleSystem.npcs, this.ui, this.scene);
    // Seed the player with the two starter spells
    this.spellSystem.learnSpell("flames");
    this.spellSystem.learnSpell("healing");
    this.spellSystem.equipSpell("flames");
    // Sync magic damage bonus from attributes
    this.spellSystem.magicDamageBonus = this.attributeSystem.magicDamageBonus;

    this.persuasionSystem = new PersuasionSystem();

    // ── v4 system wiring (browser optimisation) ──────────────────────────────
    // LOD system: run the visibility pass every 5 frames for performance.
    // WorldManager and CellManager wire their spawned meshes in via onMeshSpawned.
    this.lodSystem = new LodSystem(5);

    // Register v3 systems with save
    this.saveSystem.setSpellSystem(this.spellSystem);
    this.saveSystem.setPersuasionSystem(this.persuasionSystem);

    // ── v4 system wiring (Alchemy) ────────────────────────────────────────────
    this.alchemySystem = new AlchemySystem(this.player, this.ui);

    // Seed the player with a starter set of ingredients
    this.alchemySystem.addIngredient("aloe_vera_leaves", 5);
    this.alchemySystem.addIngredient("cairn_bolete_cap", 4);
    this.alchemySystem.addIngredient("fennel_seeds", 4);
    this.alchemySystem.addIngredient("dragon_tongue", 3);
    this.alchemySystem.addIngredient("bergamot_seeds", 3);

    this.alchemyUI = new AlchemyUI(this.ui.uiTexture, this.alchemySystem);
    this.alchemyUI.onCraft = (ingredientIds) => {
      this.alchemySystem.craftPotion(ingredientIds);
      this.alchemyUI.refresh();
    };
    this.alchemyUI.onDrink = (potionId) => {
      this.alchemySystem.drinkPotion(potionId);
      this.saveSystem.markDirty();
    };

    this.saveSystem.setAlchemySystem(this.alchemySystem);

    // ── v5 system wiring (Enchanting) ─────────────────────────────────────────
    this.enchantingSystem = new EnchantingSystem(
      this.player,
      this.inventorySystem,
      this.equipmentSystem,
      this.ui,
    );

    // Seed the player with a starter set of soul gems
    this.enchantingSystem.addSoulGem("petty", 3);
    this.enchantingSystem.addSoulGem("lesser", 2);
    this.enchantingSystem.addSoulGem("common", 1);

    this.enchantingUI = new EnchantingUI(this.ui.uiTexture, this.enchantingSystem);
    this.enchantingUI.onEnchant = (itemId, effectId, gemType) => {
      this.enchantingSystem.enchantItem(itemId, effectId, gemType);
      this.enchantingUI.refresh();
      this.saveSystem.markDirty();
    };

    this.saveSystem.setEnchantingSystem(this.enchantingSystem);

    // ── v6 system wiring (Weather + QuickSlots) ────────────────────────────────
    // WeatherSystem: Markov-chain atmospheric weather with fog/light integration.
    // Pass scene and light references so it can directly update visuals each tick.
    this.weatherSystem = new WeatherSystem(
      "clear",
      this.scene,
      this.scene.getLightByName("hLight") as any,
      this.scene.getLightByName("sun") as any,
      { ambientBase: 0.55, sunBase: 0.85 },
    );
    this.weatherSystem.onWeatherChange = (state) => {
      this.ui.showNotification(`Weather: ${this.weatherSystem.label}`, 2500);
      this.eventBus.emit("weather:changed" as any, { state });
    };
    this.saveSystem.setWeatherSystem(this.weatherSystem);

    // QuickSlotSystem: bind consumable items to hotkeys 7, 8, 9, 0.
    this.quickSlotSystem = new QuickSlotSystem(this.inventorySystem, this.player, this.ui);
    // Seed slot 7 with the starter health potion (if the player has one)
    this.quickSlotSystem.bindSlot("7", "potion_hp_01");
    this.quickSlotSystem.onItemConsumed = (item, _key) => {
      this.eventBus.emit("player:consumeItem" as any, { itemId: item.id });
      this.saveSystem.markDirty();
    };
    this.saveSystem.setQuickSlotSystem(this.quickSlotSystem);

    // ── v7 system wiring (QoL: Wait + Compass) ────────────────────────────────
    this.waitSystem = new WaitSystem();
    this.saveSystem.setWaitSystem(this.waitSystem);
    // Wire the Wait Dialog confirm callback
    this.ui.onWaitConfirm = (hours) => {
      const result = this.waitSystem.wait(hours, this.timeSystem, this.player);
      if (result.ok) {
        this.ui.showNotification(result.message, 2800);
        this.saveSystem.markDirty();
      }
    };

    // ── v8 system wiring (Oblivion depth: skill progression, fast travel, level scaling) ──
    this.skillProgressionSystem = new SkillProgressionSystem();
    this.skillProgressionSystem.onSkillLevelUp = (skillId, newLevel) => {
      const skill = this.skillProgressionSystem.getSkill(skillId);
      const name  = skill?.name ?? skillId;
      this.ui.showNotification(`${name} skill increased to ${newLevel}!`, 2500);
      this.eventBus.emit("skill:levelUp" as any, { skillId, newLevel });
      this.saveSystem.markDirty();
    };
    this.saveSystem.setSkillProgressionSystem(this.skillProgressionSystem);
    this.combatSystem.setScalingSystems({
      skillSystem: this.skillProgressionSystem,
      attributeSystem: this.attributeSystem,
    });

    this.fastTravelSystem = new FastTravelSystem();
    // Seed the starting village as a discovered location
    this.fastTravelSystem.discoverLocation("start_village", "Starting Village", new Vector3(0, 2, 0));
    // Auto-discover locations when the player enters a new cell
    this.cellManager.onCellChanged = (_cellId, cellName) => {
      const isNew = this.fastTravelSystem.discoverLocation(
        _cellId, cellName, this.player.camera.position.clone()
      );
      this.ui.showNotification(
        isNew ? `Discovered: ${cellName}` : `Entered: ${cellName}`, 2500
      );
      this.lodSystem?.clear();
    };
    this.saveSystem.setFastTravelSystem(this.fastTravelSystem);
    this.fastTravelUI.onTravel = (locationId) => this._attemptFastTravel(locationId);

    this.levelScalingSystem = new LevelScalingSystem();
    // Scale the test NPC on spawn (guard if the npcs list is unexpectedly empty)
    if (this.scheduleSystem.npcs[0]) {
      this.levelScalingSystem.scaleNPC(this.scheduleSystem.npcs[0], this.player.level);
    }
    // Scale newly spawned structure NPCs
    this.world.structures.onNPCSpawn = (npc) => {
      this.scheduleSystem.addNPC(npc);
      this.levelScalingSystem.scaleNPC(npc, this.player.level);
    };

    // Wire skill XP into spell cast and potion craft callbacks
    this.alchemySystem.onPotionCrafted = (_potion) => {
      this.skillProgressionSystem.gainXP("alchemy", 15 * this.classSystem.xpMultiplierFor("alchemy"));
    };
    this.spellSystem.onSpellCast = (spell, result) => {
      // Spell school XP
      if (result.damage && result.damage > 0) {
        this.skillProgressionSystem.gainXP("destruction", 10 * this.classSystem.xpMultiplierFor("destruction"));
      } else if (result.heal && result.heal > 0) {
        this.skillProgressionSystem.gainXP("restoration", 10 * this.classSystem.xpMultiplierFor("restoration"));
      }
      this.eventBus.emit("spell:cast", { spellId: spell.id, spellName: spell.name, magickaCost: spell.magickaCost });
      if (result.hitNpc && result.damage) {
        this.eventBus.emit("spell:hit", { spellId: spell.id, npcName: result.hitNpc, damage: result.damage });
      }
      if (result.heal) {
        this.eventBus.emit("spell:heal", { spellId: spell.id, amount: result.heal });
      }
    };

    // ── v9 system wiring (Oblivion parity: fame, active effects, jail) ─────────
    this.fameSystem = new FameSystem();
    this.fameSystem.onFameChange = (fame, infamy) => {
      this.eventBus.emit("fame:changed" as any, { fame, infamy });
    };
    this.saveSystem.setFameSystem(this.fameSystem);

    this.activeEffectsSystem = new ActiveEffectsSystem();
    this.activeEffectsSystem.onEffectExpired = (effect) => {
      this.ui.showNotification(`${effect.name} has worn off.`, 1800);
    };
    this.saveSystem.setActiveEffectsSystem(this.activeEffectsSystem);

    this.jailSystem = new JailSystem();
    this.saveSystem.setJailSystem(this.jailSystem);

    // ── v10 system wiring (Oblivion depth: spell making, respawn, merchant restock) ──
    this.spellMakingSystem = new SpellMakingSystem(this.spellSystem);
    this.spellMakingSystem.onSpellForged = (spell, goldCost) => {
      this.ui.showNotification(`Spell forged: "${spell.name}" (${goldCost}g)`, 3000);
      this.skillProgressionSystem.gainXP("destruction", 20 * this.classSystem.xpMultiplierFor("destruction"));
      this.saveSystem.markDirty();
    };
    this.saveSystem.setSpellMakingSystem(this.spellMakingSystem);

    // RespawnSystem — register the test cave as a respawnable zone (72 game-hours)
    this.respawnSystem = new RespawnSystem();
    this.respawnSystem.registerZone("cave_01", 72);
    this.respawnSystem.onZoneRespawn = (zoneId) => {
      this.ui.showNotification(`${zoneId} has respawned — new dangers await!`, 2500);
      this.eventBus.emit("zone:respawned" as any, { zoneId });
    };
    this.saveSystem.setRespawnSystem(this.respawnSystem);

    // MerchantRestockSystem — restock the starter merchant every 72 game-hours
    this.merchantRestockSystem = new MerchantRestockSystem();
    const merchantTemplate = [
      { id: "potion_hp_01", name: "Health Potion", description: "Restores 50 health.", stackable: true, quantity: 5, weight: 0.3, stats: { value: 25 } },
      { id: "arrow_bundle", name: "Arrows (20)", description: "A bundle of iron arrows.", stackable: true, quantity: 3, weight: 1, stats: { value: 15 } },
    ];
    this.merchantRestockSystem.registerMerchant(
      "merchant_01",
      merchantTemplate,
      500,
      72,
      this.timeSystem.gameTime,
    );
    this.merchantRestockSystem.onRestock = (merchantId) => {
      const merchant = this.barterSystem.getMerchant(merchantId);
      const name = merchant?.name ?? merchantId;
      this.ui.showNotification(`${name} has restocked their wares.`, 2000);
      this.saveSystem.markDirty();
    };
    this.saveSystem.setMerchantRestockSystem(this.merchantRestockSystem);

    // ── v11 systems (Oblivion depth: character creation) ────────────────────
    this.raceSystem = new RaceSystem();
    this.raceSystem.onRaceChosen = (race) => {
      this.ui.showNotification(
        `Race chosen: ${race.name} (${race.heritage})${race.power ? ` — Power: ${race.power.name}` : ""}`,
        3000,
      );
      // Sync derived stats after race attribute bonuses have been applied
      this.player.maxHealth      = this.attributeSystem.maxHealth;
      this.player.maxMagicka     = this.attributeSystem.maxMagicka;
      this.player.maxStamina     = this.attributeSystem.maxStamina;
      this.player.maxCarryWeight = this.attributeSystem.carryWeight;
      this.saveSystem.markDirty();
    };
    this.saveSystem.setRaceSystem(this.raceSystem);
    this.raceSystem.onPowerActivated = (power) => {
      this.ui.showNotification(`${power.name}: ${power.description}`, 3000);
      this.saveSystem.markDirty();
    };

    this.birthsignSystem = new BirthsignSystem();
    this.birthsignSystem.onBirthsignChosen = (birthsign) => {
      this.ui.showNotification(
        `Birthsign chosen: ${birthsign.name}${birthsign.power ? ` — Power: ${birthsign.power.name}` : ""}`,
        3000,
      );
      // Apply any max-stat bonuses from the birthsign
      const bonuses = this.birthsignSystem.getStatBonuses();
      this.player.maxHealth  += bonuses.maxHealth;
      this.player.maxMagicka += bonuses.maxMagicka;
      this.player.maxStamina += bonuses.maxStamina;
      this.player.maxCarryWeight += bonuses.carryWeight;
      this.saveSystem.markDirty();
    };
    this.birthsignSystem.onPowerActivated = (power) => {
      this.ui.showNotification(`${power.name}: ${power.description}`, 3000);
      this.saveSystem.markDirty();
    };
    this.saveSystem.setBirthsignSystem(this.birthsignSystem);

    this.classSystem = new ClassSystem();
    this.classSystem.onClassChosen = (cls) => {
      this.ui.showNotification(
        `Class chosen: ${cls.name} (${cls.specialization}) — Major skills: ${cls.majorSkills.join(", ")}`,
        4000,
      );
      // Sync derived stats now that attributes may have changed
      this.player.maxHealth      = this.attributeSystem.maxHealth;
      this.player.maxMagicka     = this.attributeSystem.maxMagicka;
      this.player.maxStamina     = this.attributeSystem.maxStamina;
      this.player.maxCarryWeight = this.attributeSystem.carryWeight;
      this.saveSystem.markDirty();
    };
    this.saveSystem.setClassSystem(this.classSystem);

    this._runCharacterCreation().catch((error: unknown) => {
      console.error("Character creation failed; applying defaults", error);
      this._applyDefaultCharacterCreation();
      this.interactionSystem.isBlocked = false;
      this.isPaused = false;
      this.canvas.requestPointerLock();
      this.player.camera.attachControl(this.canvas, true);
    });
    this.questSystem.onQuestComplete = (xp) => {
      this.player.addExperience(xp);
      this.fameSystem.addFame(10);
      this.ui.showNotification(
        `+${xp} XP  |  Fame: ${this.fameSystem.fame} (${this.fameSystem.fameLabel})`, 3000
      );
    };

    // Crime infamy — upgrade the guard challenge to offer a jail option
    this.crimeSystem.onGuardChallenge = (guardNpc, factionId, bounty) => {
      this.ui.showNotification(
        `${guardNpc.mesh.name}: "Stop! You have a ${bounty}g bounty in ${factionId}!"`, 4000
      );
      // Auto-jail if player cannot pay — check inventory for gold_coins.
      // Full Oblivion-style would use a dialogue; for now auto-jail fires when
      // the player has insufficient gold.
      const goldEntry = this.inventorySystem.items.find(i => i.id === GOLD_ITEM_ID);
      const playerGold = goldEntry ? (goldEntry.quantity ?? 0) : 0;
      if (playerGold < bounty) {
        const result = this.jailSystem.serveJailTime(
          bounty, factionId,
          this.timeSystem,
          this.skillProgressionSystem,
          this.crimeSystem,
          this.timeSystem.gameTime,
        );
        this.ui.showNotification(result.message, 4000);
        this.fameSystem.addInfamy(Math.ceil(bounty / 10));
      }
      this.eventBus.emit("crime:committed", { crimeType: "challenge", factionId, bounty });
    };

    this.ui.onAttributeSpend = (name) => {
      const spent = this.attributeSystem.spendPoint(name);
      if (spent) {
        // Sync derived stats back to player after spending
        this.player.maxHealth      = this.attributeSystem.maxHealth;
        this.player.maxMagicka     = this.attributeSystem.maxMagicka;
        this.player.maxStamina     = this.attributeSystem.maxStamina;
        this.player.maxCarryWeight = this.attributeSystem.carryWeight;
        this.spellSystem.magicDamageBonus = this.attributeSystem.magicDamageBonus;
        // Refresh the attribute panel display
        this.ui.refreshAttributePanel(this.attributeSystem);
      }
    };

    // Level-up awards attribute points
    this.player.onLevelUp = (newLevel) => {
      this.ui.showNotification(`Level Up! You are now level ${newLevel}! [U] to spend attributes.`, 4000);
      this.attributeSystem.awardLevelUpPoints(1);
      // Sync magic damage bonus after level-up attribute award
      this.spellSystem.magicDamageBonus = this.attributeSystem.magicDamageBonus;
      this.eventBus.emit("player:levelUp", { newLevel });
      // Auto-open attribute panel on level-up
      if (!this.isPaused && !this.ui.isAttributePanelOpen) {
        this.ui.toggleAttributePanel(true);
        this.ui.refreshAttributePanel(this.attributeSystem);
        this.interactionSystem.isBlocked = true;
        document.exitPointerLock?.();
        this.player.camera.detachControl?.();
      }
    };

    // Guard crime challenge is wired in the v9 block above.

    // Stealth detection notification
    this.stealthSystem.onDetected = (detectedBy) => {
      this.ui.showNotification(`${detectedBy.mesh.name} spotted you!`, 2000);
      this.eventBus.emit("stealth:detected", { npcName: detectedBy.mesh.name });
    };

    // Spell cast events forwarded to event bus
    // Spawn a test container chest
    this.containerSystem.spawnContainer({
      id: "chest_01",
      name: "Old Chest",
      position: new Vector3(5, 1, 5),
      contents: [
        { id: "gold_coins", name: "Gold Coins", description: "A handful of gold coins.", stackable: true, quantity: 50, weight: 0.1, stats: { value: 1 } },
        { id: "iron_sword", name: "Iron Sword", description: "A basic iron sword.", stackable: false, quantity: 1, slot: "mainHand", weight: 3, stats: { damage: 10, value: 80 } },
      ],
    });

    // Spawn a test cave entrance portal near the starting area
    this.cellManager.buildSimpleInterior(
      "cave_01",
      "Old Cave",
      "portal_cave_entrance",
      new Vector3(-8, 1, 8),
      new Vector3(-8, 2, 8),  // return position after exiting
    );

    // Register a sample merchant
    this.barterSystem.registerMerchant({
      id: "merchant_01",
      name: "Trader Elan",
      factionId: "town",
      inventory: [
        { id: "potion_hp_01", name: "Health Potion", description: "Restores 50 health.", stackable: true, quantity: 5, weight: 0.3, stats: { value: 25 } },
        { id: "arrow_bundle", name: "Arrows (20)", description: "A bundle of iron arrows.", stackable: true, quantity: 3, weight: 1, stats: { value: 15 } },
      ],
      gold: 500,
      priceMultiplier: 1.1,
      isOpen: true,
      openHour: 8,
      closeHour: 20,
    });

    // Prevent browser context menu from capturing right-click combat input.
    this.canvas.addEventListener("contextmenu", (event) => event.preventDefault());

    // Wire quest event callbacks
    this.combatSystem.onNPCDeath = (name, xp, npc) => {
        this.questSystem.onKill(name);
        this._applyFrameworkQuestEvent("kill", this._toFrameworkTargetId(name));
        this.player.addExperience(xp);
        this.ui.showNotification(`+${xp} XP`, 2000);
        this.audioSystem.playNPCDeath();

        // Drop loot from the NPC's loot table
        if (npc.lootTableId) {
            const lootContext = { playerLevel: this.player.level };
            const drops = this.lootTableSystem.rollTable(npc.lootTableId, undefined, lootContext).items;
            if (drops.length > 0) {
                const dropPos = npc.mesh.position.clone();
                dropPos.y += 0.5;
                for (const drop of drops) {
                    new Loot(this.scene, dropPos.add(new Vector3(
                        (Math.random() - 0.5) * 1.2,
                        0,
                        (Math.random() - 0.5) * 1.2,
                    )), {
                        id: drop.id,
                        name: drop.name,
                        description: drop.description ?? "",
                        stackable: drop.stackable ?? false,
                        quantity: drop.quantity ?? 1,
                        weight: drop.weight,
                        stats: drop.stats,
                        slot: drop.slot as any,
                    });
                }
            }
        }
    };
    this.combatSystem.onPlayerHit = () => this.audioSystem.playPlayerHit();
    this.combatSystem.onBlockSuccess = () => {
        this.skillProgressionSystem.gainXP("block", 5 * this.classSystem.xpMultiplierFor("block"));
    };
    this.interactionSystem.onLootPickup = (id) => {
        this.questSystem.onPickup(id);
        this._applyFrameworkQuestEvent("pickup", id);
        const frameworkItemId = this._toFrameworkInventoryItemId(id);
        if (frameworkItemId) this.frameworkRuntime.inventoryEngine.addItem(frameworkItemId, 1);
    };
    this.dialogueSystem.onTalkStart  = (name)  => {
        this.questSystem.onTalk(name);
        this._applyFrameworkQuestEvent("talk", this._toFrameworkTargetId(name));
        // Speechcraft XP each time dialogue is initiated
        this.skillProgressionSystem.gainXP("speechcraft", 8 * this.classSystem.xpMultiplierFor("speechcraft"));
    };

    // Quest XP and fame callbacks are wired in the v9 block above.
    // Note: player.onLevelUp is wired above in the v2 system wiring block

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
        description: "Light armor. +15 Armor Rating.",
        stackable: false,
        quantity: 1,
        slot: "chest",
        stats: { armor: 15 }
    });

    new Loot(this.scene, new Vector3(8, 1, 7), {
        id: "iron_helm_01",
        name: "Iron Helm",
        description: "A sturdy iron helmet. +12 Armor Rating.",
        stackable: false,
        quantity: 1,
        slot: "head",
        stats: { armor: 12 }
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
            if (pointerInfo.event.button === 0) { // Left Click — melee attack
                const attacked = this.combatSystem.meleeAttack();
                if (attacked) {
                  this.audioSystem.playMeleeAttack();
                  // Blade skill XP on every successful swing (hit or miss)
                  this.skillProgressionSystem.gainXP("blade", 4 * this.classSystem.xpMultiplierFor("blade"));
                }
            } else if (pointerInfo.event.button === 2) { // Right Click held — begin block
                pointerInfo.event.preventDefault();
                this.combatSystem.beginBlock();
            }
        } else if (pointerInfo.type === PointerEventTypes.POINTERUP) {
            if (pointerInfo.event.button === 2) { // Right Click released — stop blocking
                this.combatSystem.endBlock();
            }
        }
    });

    // Input handling for pause
    this.scene.onKeyboardObservable.add((kbInfo) => {
        if (kbInfo.type === KeyboardEventTypes.KEYDOWN) {
            if (kbInfo.event.key === "Escape") {
                if (this.dialogueSystem.isInDialogue) return;

                if (this.mapEditorSystem.isEnabled) {
                    this.mapEditorSystem.toggle();
                    this.interactionSystem.isBlocked = false;
                    this.canvas.requestPointerLock();
                    this.player.camera.attachControl(this.canvas, true);
                    this.mapEditorToolbar.hide();
                    this.mapEditorHierarchyPanel.hide();
                    this.ui.showNotification("Map editor mode disabled", 1800);
                } else if (this.inventorySystem.isOpen) {
                    this.inventorySystem.toggleInventory();
                } else if (this.questSystem.isLogOpen) {
                    this.questSystem.toggleQuestLog();
                    this.interactionSystem.isBlocked = false;
                    this.canvas.requestPointerLock();
                    this.player.camera.attachControl(this.canvas, true);
                } else if (this.skillTreeSystem.isOpen) {
                    this.skillTreeSystem.toggle();
                    this.interactionSystem.isBlocked = false;
                    this.canvas.requestPointerLock();
                    this.player.camera.attachControl(this.canvas, true);
                } else if (this.ui.isAttributePanelOpen) {
                    this.ui.toggleAttributePanel(false);
                    this.interactionSystem.isBlocked = false;
                    this.canvas.requestPointerLock();
                    this.player.camera.attachControl(this.canvas, true);
                } else if (this.alchemyUI.isVisible) {
                    this.alchemyUI.toggle(false);
                    this.interactionSystem.isBlocked = false;
                    this.canvas.requestPointerLock();
                    this.player.camera.attachControl(this.canvas, true);
                } else if (this.enchantingUI.isVisible) {
                    this.enchantingUI.toggle(false);
                    this.interactionSystem.isBlocked = false;
                    this.canvas.requestPointerLock();
                    this.player.camera.attachControl(this.canvas, true);
                } else if (this.fastTravelUI.isVisible) {
                    this.fastTravelUI.close();
                } else if (this.questCreatorUI.isVisible) {
                    this.questCreatorUI.close();
                    this.canvas.requestPointerLock();
                    this.player.camera.attachControl(this.canvas, true);
                } else if (this.dialogueCreatorUI.isVisible) {
                    this.dialogueCreatorUI.close();
                    this.canvas.requestPointerLock();
                    this.player.camera.attachControl(this.canvas, true);
                } else if (this.npcCreatorUI.isVisible) {
                    this.npcCreatorUI.close();
                    this.canvas.requestPointerLock();
                    this.player.camera.attachControl(this.canvas, true);
                } else if (this.itemCreatorUI.isVisible) {
                    this.itemCreatorUI.close();
                    this.canvas.requestPointerLock();
                    this.player.camera.attachControl(this.canvas, true);
                } else if (this.factionCreatorUI.isVisible) {
                    this.factionCreatorUI.close();
                    this.canvas.requestPointerLock();
                    this.player.camera.attachControl(this.canvas, true);
                } else if (this.lootTableCreatorUI.isVisible) {
                    this.lootTableCreatorUI.close();
                    this.canvas.requestPointerLock();
                    this.player.camera.attachControl(this.canvas, true);
                } else if (this.editorHubUI.isVisible) {
                    this.editorHubUI.close();
                    this.canvas.requestPointerLock();
                    this.player.camera.attachControl(this.canvas, true);
                } else if (this.ui.isWaitDialogOpen) {
                    this.ui.toggleWaitDialog(false);
                    this.interactionSystem.isBlocked = false;
                    this.canvas.requestPointerLock();
                    this.player.camera.attachControl(this.canvas, true);
                } else {
                    this.togglePause();
                }
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
            } else if (kbInfo.event.key === "u" || kbInfo.event.key === "U") {
                // Toggle Attribute Panel
                if (!this.isPaused && !this.inventorySystem.isOpen && !this.dialogueSystem.isInDialogue) {
                    const open = !this.ui.isAttributePanelOpen;
                    this.ui.toggleAttributePanel(open);
                    if (open) {
                        this.ui.refreshAttributePanel(this.attributeSystem);
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
            } else if (kbInfo.event.key === "e" || kbInfo.event.key === "E") {
                // Power attack (Oblivion-style — costs more stamina, staggers enemies)
                if (!this._isCombatInputBlocked()) {
                    const powered = this.combatSystem.powerAttack();
                    if (powered) {
                        this.audioSystem.playMeleeAttack();
                        this.skillProgressionSystem.gainXP("blade", 6 * this.classSystem.xpMultiplierFor("blade"));
                    }
                }
            } else if (kbInfo.event.key === "r" || kbInfo.event.key === "R") {
                // Fire arrow (bow mode)
                if (!this._isCombatInputBlocked()) {
                    const fired = this.projectileSystem.fireArrow();
                    if (fired) {
                      this.audioSystem.playMeleeAttack(); // reuse existing SFX placeholder
                      // Marksman skill XP on arrow fire
                      this.skillProgressionSystem.gainXP("marksman", 5 * this.classSystem.xpMultiplierFor("marksman"));
                    }
                }
            } else if ((kbInfo.event.key === "y" || kbInfo.event.key === "Y")
                    && !kbInfo.event.ctrlKey
                    && !kbInfo.event.metaKey) {
                // Fast Travel — open destination picker
                if (this.fastTravelUI.isVisible) {
                    this.fastTravelUI.close();
                    return;
                }
                if (!this.isPaused && !this.dialogueSystem.isInDialogue && !this.inventorySystem.isOpen && !this.mapEditorSystem.isEnabled) {
                    const locs = this.fastTravelSystem.discoveredLocations;
                    if (locs.length === 0) {
                        this.ui.showNotification("No locations discovered yet.", 2000);
                    } else {
                        this.fastTravelUI.open(
                            locs.map((loc) => ({
                                id: loc.id,
                                name: loc.name,
                                estimatedHours: this.fastTravelSystem.estimateTravelHours(this.player.camera.position, loc.id) ?? 1,
                            })),
                        );
                        this.interactionSystem.isBlocked = true;
                        document.exitPointerLock();
                        this.player.camera.detachControl();
                    }
                }
            } else if (kbInfo.event.key === "c" || kbInfo.event.key === "C") {
                // Toggle crouch / stealth
                if (!this.isPaused && !this.dialogueSystem.isInDialogue) {
                    const crouching = this.stealthSystem.toggleCrouch();
                    this.ui.showNotification(crouching ? "Sneaking..." : "Standing", 1200);
                }
            } else if (kbInfo.event.key === "m" || kbInfo.event.key === "M") {
                this.audioSystem.toggleMute();
                this.ui.showNotification(this.audioSystem.isMuted ? "Audio muted" : "Audio unmuted", 1500);
            } else if (kbInfo.event.key === "t" || kbInfo.event.key === "T") {
                // Wait / Rest dialog  (T = classic Oblivion wait key)
                if (this.mapEditorSystem.isEnabled) return; // T is reserved for placement type in editor
                if (!this.isPaused && !this.dialogueSystem.isInDialogue && !this.inventorySystem.isOpen) {
                    const open = !this.ui.isWaitDialogOpen;
                    this.ui.toggleWaitDialog(open);
                    if (open) {
                        this.interactionSystem.isBlocked = true;
                        document.exitPointerLock();
                        this.player.camera.detachControl();
                    } else {
                        this.interactionSystem.isBlocked = false;
                        this.canvas.requestPointerLock();
                        this.player.camera.attachControl(this.canvas, true);
                    }
                }
            } else if (kbInfo.event.key === "F2") {
                const isEnabled = this.mapEditorSystem.toggle();
                this.interactionSystem.isBlocked = isEnabled;
                if (isEnabled) {
                    document.exitPointerLock();
                    this.player.camera.detachControl();
                    this.mapEditorToolbar.show();
                    this.mapEditorHierarchyPanel.show();
                    this._refreshEditorToolbar();
                    this.mapEditorHierarchyPanel.refresh(this.mapEditorSystem.listEntitySummaries());
                } else {
                    this.canvas.requestPointerLock();
                    this.player.camera.attachControl(this.canvas, true);
                    this.mapEditorToolbar.hide();
                    this.mapEditorHierarchyPanel.hide();
                }
                this.ui.showNotification(isEnabled ? "Map editor mode enabled" : "Map editor mode disabled", 1800);
                this._refreshHelpOverlayIfVisible();
            } else if (kbInfo.event.key === "g" || kbInfo.event.key === "G") {
                if (!this.mapEditorSystem.isEnabled) return;
                const mode = this.mapEditorSystem.cycleGizmoMode();
                this.ui.showNotification(`Editor gizmo: ${mode}`, 1400);
                this._refreshEditorToolbar();
            } else if (kbInfo.event.key === "t" || kbInfo.event.key === "T") {
                if (!this.mapEditorSystem.isEnabled) return;
                const ptype = this.mapEditorSystem.cyclePlacementType();
                this.ui.showNotification(`Place type: ${ptype}`, 1400);
                this._refreshEditorToolbar();
            } else if (kbInfo.event.key === "p" || kbInfo.event.key === "P") {
                if (!this.mapEditorSystem.isEnabled) return;
                const groupId = this.mapEditorSystem.startNewPatrolGroup();
                this.ui.showNotification(`New patrol group: ${groupId}`, 1600);
                this._refreshEditorToolbar();
            } else if (kbInfo.event.key === "h" || kbInfo.event.key === "H") {
                if (!this.mapEditorSystem.isEnabled) return;
                const terrainTool = this.mapEditorSystem.cycleTerrainTool();
                this.ui.showNotification(`Terrain tool: ${terrainTool}`, 1600);
                this._refreshEditorToolbar();
            } else if (kbInfo.event.key === "[") {
                if (!this.mapEditorSystem.isEnabled) return;
                const step = this.mapEditorSystem.adjustTerrainSculptStep(-0.1);
                this.ui.showNotification(`Terrain sculpt step: ${step.toFixed(1)}`, 1200);
            } else if (kbInfo.event.key === "]") {
                if (!this.mapEditorSystem.isEnabled) return;
                const step = this.mapEditorSystem.adjustTerrainSculptStep(0.1);
                this.ui.showNotification(`Terrain sculpt step: ${step.toFixed(1)}`, 1200);
            } else if (kbInfo.event.key === "F4") {
                if (!this.mapEditorSystem.isEnabled) return;
                this.mapEditorSystem.exportToFile();
                this.ui.showNotification("Map exported to file", 2000);
            } else if (kbInfo.event.key === "z" && (kbInfo.event.ctrlKey || kbInfo.event.metaKey) && !kbInfo.event.shiftKey) {
                if (!this.mapEditorSystem.isEnabled) return;
                const undone = this.mapEditorSystem.undo();
                this.ui.showNotification(undone ? "Undo" : "Nothing to undo", 1000);
                if (undone) {
                    this._refreshEditorToolbar();
                    this.mapEditorHierarchyPanel.refresh(this.mapEditorSystem.listEntitySummaries());
                }
            } else if (
                (kbInfo.event.key === "y" && (kbInfo.event.ctrlKey || kbInfo.event.metaKey)) ||
                (kbInfo.event.key === "z" && (kbInfo.event.ctrlKey || kbInfo.event.metaKey) && kbInfo.event.shiftKey)
            ) {
                if (!this.mapEditorSystem.isEnabled) return;
                const redone = this.mapEditorSystem.redo();
                this.ui.showNotification(redone ? "Redo" : "Nothing to redo", 1000);
                if (redone) {
                    this._refreshEditorToolbar();
                    this.mapEditorHierarchyPanel.refresh(this.mapEditorSystem.listEntitySummaries());
                }
            } else if (kbInfo.event.key === "F6") {
                if (!this.mapEditorSystem.isEnabled) return;
                this._triggerMapImport();
            } else if (kbInfo.event.key === "F7") {
                if (!this.mapEditorSystem.isEnabled) return;
                const validation = this.mapEditorSystem.validateMap(0.5, {
                  knownLootTableIds: this.lootTableSystem.getTableIds(),
                });
                this.ui.showNotification(summarizeValidationReport(validation), 3200);
                if (!validation.isValid) {
                  console.warn("[MapEditorValidation]", validation.issues);
                }
            } else if (kbInfo.event.key === "F8") {
                if (kbInfo.event.shiftKey) {
                    // Shift+F8 → Loot Table Creator
                    if (this.lootTableCreatorUI.isVisible) {
                        this.lootTableCreatorUI.close();
                    } else {
                        this.lootTableCreatorUI.open();
                        this.interactionSystem.isBlocked = true;
                        document.exitPointerLock();
                        this.player.camera.detachControl();
                    }
                } else {
                    // F8 → Framework quest graph validation
                    const reports = frameworkBaseContent.quests.map((quest) => {
                      return this.frameworkRuntime.questEngine.validateGraph(quest.id);
                    });
                    const totalIssues = reports.reduce((sum, report) => sum + report.issues.length, 0);
                    const invalidGraphs = reports.filter((report) => !report.valid).length;
                    this.ui.showNotification(
                      totalIssues === 0
                        ? `Quest graph validation passed (${reports.length} graphs).`
                        : `Quest graph validation: ${invalidGraphs} invalid graph(s), ${totalIssues} issue(s).`,
                      3200,
                    );
                    if (totalIssues > 0) {
                      console.warn("[QuestGraphValidation]", reports);
                    }
                }
            } else if (kbInfo.event.key === "F10") {
                if (kbInfo.event.shiftKey) {
                    // Shift+F10 → NPC Creator
                    if (this.npcCreatorUI.isVisible) {
                        this.npcCreatorUI.close();
                    } else {
                        this.npcCreatorUI.open();
                        this.interactionSystem.isBlocked = true;
                        document.exitPointerLock();
                        this.player.camera.detachControl();
                    }
                } else {
                    // F10 → Quest Creator
                    if (this.questCreatorUI.isVisible) {
                        this.questCreatorUI.close();
                    } else {
                        this.questCreatorUI.open();
                        this.interactionSystem.isBlocked = true;
                        document.exitPointerLock();
                        this.player.camera.detachControl();
                    }
                }
            } else if (kbInfo.event.key === "F11") {
                // F11 → Editor Hub
                const isNowOpen = this.editorHubUI.toggle();
                if (isNowOpen) {
                    this.interactionSystem.isBlocked = true;
                    document.exitPointerLock();
                    this.player.camera.detachControl();
                } else {
                    this.interactionSystem.isBlocked = this.mapEditorSystem.isEnabled;
                }
            } else if (kbInfo.event.key === "F12") {
                if (kbInfo.event.shiftKey) {
                    // Shift+F12 → Item Creator
                    if (this.itemCreatorUI.isVisible) {
                        this.itemCreatorUI.close();
                    } else {
                        this.itemCreatorUI.open();
                        this.interactionSystem.isBlocked = true;
                        document.exitPointerLock();
                        this.player.camera.detachControl();
                    }
                } else {
                    // F12 → Dialogue Creator
                    if (this.dialogueCreatorUI.isVisible) {
                        this.dialogueCreatorUI.close();
                    } else {
                        this.dialogueCreatorUI.open();
                        this.interactionSystem.isBlocked = true;
                        document.exitPointerLock();
                        this.player.camera.detachControl();
                    }
                }
            } else if (kbInfo.event.key === "n" || kbInfo.event.key === "N") {
                if (!this.mapEditorSystem.isEnabled) return;
                const placeAt = this.player.camera.position.add(this.player.getForwardDirection(8).scale(4));
                placeAt.y = Math.max(1, placeAt.y);
                this.mapEditorSystem.placeEntity(placeAt);
                const ptype = this.mapEditorSystem.currentPlacementType;
                this.ui.showNotification(`Placed: ${ptype}`, 1200);
                this._refreshEditorToolbar();
                this.mapEditorHierarchyPanel.refresh(this.mapEditorSystem.listEntitySummaries());
            } else if (kbInfo.event.key === "F5") {
                if (!this.isPaused) this.saveSystem.save();
            } else if (kbInfo.event.key === "F9") {
                if (kbInfo.event.shiftKey) {
                    // Shift+F9 → Faction Creator
                    if (this.factionCreatorUI.isVisible) {
                        this.factionCreatorUI.close();
                    } else {
                        this.factionCreatorUI.open();
                        this.interactionSystem.isBlocked = true;
                        document.exitPointerLock();
                        this.player.camera.detachControl();
                    }
                } else {
                    // F9 → Load game
                    if (!this.isPaused) this.saveSystem.load();
                }
            } else if (kbInfo.event.key === "q" || kbInfo.event.key === "Q") {
                // Cast equipped spell
                if (!this._isCombatInputBlocked()) {
                    this.spellSystem.castSpell();
                }
            } else if (kbInfo.event.key === "z" || kbInfo.event.key === "Z") {
                // Cycle through known spells
                if (!this.isPaused && !this.dialogueSystem.isInDialogue) {
                    const spells = this.spellSystem.knownSpells;
                    if (spells.length > 0) {
                        const current = this.spellSystem.equippedSpell;
                        const idx = current ? spells.findIndex(s => s.id === current.id) : -1;
                        const next = spells[(idx + 1) % spells.length];
                        this.spellSystem.equipSpell(next.id);
                    }
                }
            } else if (kbInfo.event.key === "l" || kbInfo.event.key === "L") {
                // Toggle Alchemy workbench
                if (!this.isPaused && !this.dialogueSystem.isInDialogue) {
                    const open = !this.alchemyUI.isVisible;
                    this.alchemyUI.toggle(open);
                    if (open) {
                        this.interactionSystem.isBlocked = true;
                        document.exitPointerLock();
                        this.player.camera.detachControl();
                    } else {
                        this.interactionSystem.isBlocked = false;
                        this.canvas.requestPointerLock();
                        this.player.camera.attachControl(this.canvas, true);
                    }
                }
            } else if (kbInfo.event.key === "b" || kbInfo.event.key === "B") {
                // Toggle Enchanting altar (B = enchanting Bench)
                if (!this.isPaused && !this.dialogueSystem.isInDialogue) {
                    const open = !this.enchantingUI.isVisible;
                    this.enchantingUI.toggle(open);
                    if (open) {
                        this.interactionSystem.isBlocked = true;
                        document.exitPointerLock();
                        this.player.camera.detachControl();
                    } else {
                        this.interactionSystem.isBlocked = false;
                        this.canvas.requestPointerLock();
                        this.player.camera.attachControl(this.canvas, true);
                    }
                }
            } else if (kbInfo.event.key === "x" || kbInfo.event.key === "X") {
                // Spell Making — forge a sample custom spell (X = eXperimental magic)
                // A full UI would present a form; here we demonstrate the system with a
                // hardcoded sample so the feature is exercisable from the keyboard.
                if (!this.isPaused && !this.dialogueSystem.isInDialogue) {
                    const result = this.spellMakingSystem.forgeSpell(
                        `Custom Bolt ${this.spellMakingSystem.customSpells.length + 1}`,
                        [{ effectType: "damage", school: "destruction", magnitude: 15, duration: 4, damageType: "shock" }],
                        this.barterSystem,
                    );
                    if (result.ok) {
                        this.ui.showNotification(
                            `Spell forged: "${result.spell!.name}" — ${result.goldCost}g spent.  Z to cycle spells.`,
                            3500,
                        );
                    } else {
                        const reasonMsg: Record<string, string> = {
                            insufficient_gold: "Not enough gold to forge a spell.",
                            duplicate_name:    "A spell with that name already exists.",
                        };
                        this.ui.showNotification(
                            reasonMsg[result.reason ?? ""] ?? `Cannot forge spell: ${result.reason}`,
                            2500,
                        );
                    }
                }
            } else if (kbInfo.event.key === "v" || kbInfo.event.key === "V") {
                // Activate racial power (V = racial Virtue)
                if (!this._isCombatInputBlocked()) {
                    const race = this.raceSystem.chosenRace;
                    if (!race?.power) {
                        this.ui.showNotification("No racial power available.", 2000);
                    } else if (!this.raceSystem.canActivatePower(this.timeSystem.gameTime)) {
                        const mins = Math.ceil(this.raceSystem.powerCooldownRemaining(this.timeSystem.gameTime));
                        this.ui.showNotification(
                            `${race.power.name} is recharging (${mins} game-minutes remaining).`,
                            2500,
                        );
                    } else {
                        this.raceSystem.activatePower(this.timeSystem.gameTime, this.activeEffectsSystem);
                    }
                }
            } else if (kbInfo.event.key === "h" || kbInfo.event.key === "H") {
                // Show Fame / Infamy status (H = Honours)
                if (!this.isPaused && !this.dialogueSystem.isInDialogue) {
                    const effects = this.activeEffectsSystem.activeEffects;
                    const effectStr = effects.length > 0
                      ? `  Active effects: ${effects.map(e => e.name).join(", ")}`
                      : "";
                    const customSpellCount = this.spellMakingSystem.customSpells.length;
                    const spellStr = customSpellCount > 0 ? `  Custom spells: ${customSpellCount}` : "";
                    this.ui.showNotification(
                      `Fame: ${this.fameSystem.fame} (${this.fameSystem.fameLabel})` +
                      `  Infamy: ${this.fameSystem.infamy} (${this.fameSystem.infamyLabel})` +
                      `  Sentences: ${this.jailSystem.totalSentences}` +
                      effectStr +
                      spellStr,
                      4000,
                    );
                }
            } else if (kbInfo.event.key === "F3") {
                const shown = this.ui.toggleDebugOverlay();
                this.ui.showNotification(shown ? "Debug overlay ON" : "Debug overlay OFF", 1200);
            } else if (kbInfo.event.key === "F1") {
                this._toggleHelpOverlay();
            } else if (kbInfo.event.key === "7" || kbInfo.event.key === "8" ||
                       kbInfo.event.key === "9" || kbInfo.event.key === "0") {
                // Quick-slot consumable use
                if (!this._isCombatInputBlocked()) {
                    this.quickSlotSystem.useSlot(kbInfo.event.key as "7" | "8" | "9" | "0");
                }
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
          this._gameplayLoop.reset();
          if (this.mapEditorSystem.isEnabled) {
              this.mapEditorSystem.toggle();
          }
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

  private async _runCharacterCreation(): Promise<void> {
    this.isPaused = true;
    this.interactionSystem.isBlocked = true;
    document.exitPointerLock();
    this.player.camera.detachControl();

    const creator = new CharacterCreationUI();
    const selection = await creator.open();

    // Apply player name
    this.player.name = selection.name;

    const raceApplied = this.raceSystem.chooseRace(
      selection.raceId,
      this.attributeSystem,
      this.skillProgressionSystem,
    );
    const birthsignApplied = this.birthsignSystem.chooseBirthsign(
      selection.birthsignId,
      this.attributeSystem,
      this.skillProgressionSystem,
    );
    const classApplied = this.classSystem.chooseClass(
      selection.classId,
      this.attributeSystem,
      this.skillProgressionSystem,
    );

    if (!raceApplied || !birthsignApplied || !classApplied) {
      this._applyDefaultCharacterCreation();
    }

    this.ui.showNotification(`Welcome, ${this.player.name}! Character creation complete.`, 2800);
    this.interactionSystem.isBlocked = false;
    this.isPaused = false;
    this.canvas.requestPointerLock();
    this.player.camera.attachControl(this.canvas, true);
  }

  private _applyDefaultCharacterCreation(): void {
    this.raceSystem.chooseRace(
      "nord",
      this.attributeSystem,
      this.skillProgressionSystem,
    );
    this.birthsignSystem.chooseBirthsign(
      "warrior",
      this.attributeSystem,
      this.skillProgressionSystem,
    );
    this.classSystem.chooseClass(
      "warrior",
      this.attributeSystem,
      this.skillProgressionSystem,
    );
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

  private _updateGameplayStep(deltaTime: number): void {
      this.player.update(deltaTime);
      this.audioSystem.updateFootsteps(deltaTime, this.player.camera.position);
      this.world.update(this.player.camera.position);

      // v2 system updates (time must update before schedule so hour is current)
      this.timeSystem.update(deltaTime);

      // Sync in-game hour to ScheduleSystem so NPC daily behaviors are time-aware
      this.scheduleSystem.currentHour = this.timeSystem.hour;

      this.scheduleSystem.update(deltaTime);
      this.combatSystem.updateNPCAI(deltaTime);
      this.interactionSystem.update();

      this.stealthSystem.update(deltaTime, this.timeSystem.ambientIntensity);
      // Sneak XP: trickle XP while actively sneaking near NPCs
      if (this.stealthSystem.isCrouching) {
        this.skillProgressionSystem.gainXP(
          "sneak",
          deltaTime * SNEAK_XP_PER_SECOND * this.classSystem.xpMultiplierFor("sneak"),
        );
      }
      this.crimeSystem.update(deltaTime);
      this.projectileSystem.update(deltaTime);
      this.spellSystem.update(deltaTime);

      // v6 atmospheric weather update (fog + light blending)
      this.weatherSystem.update(deltaTime);

      // v9 active effects tick (DoT heals/damage, duration countdown)
      this.activeEffectsSystem.update(deltaTime, this.player);

      // v10 respawn and merchant restock checks (low-frequency, time-comparison only)
      const currentGameTime = this.timeSystem.gameTime;
      this.respawnSystem.update(currentGameTime);
      this.merchantRestockSystem.update(currentGameTime, this.barterSystem);

      // v4 browser optimisation: distance-based LOD culling
      this._lastLodCulled = this.lodSystem.update(this.player.camera.position);

      // Tick the navmesh rebuild debounce; request a rebuild whenever the player
      // crosses into a new terrain chunk (new ground meshes may have loaded).
      this.navigationSystem.update(deltaTime);
      this.saveSystem.markDirty();
      this.saveSystem.tickAutosave(deltaTime);
      const chunkSize = 50;
      const cx = Math.floor(this.player.camera.position.x / chunkSize);
      const cz = Math.floor(this.player.camera.position.z / chunkSize);
      if (cx !== this._lastNavChunkX || cz !== this._lastNavChunkZ) {
        this._lastNavChunkX = cx;
        this._lastNavChunkZ = cz;
        this.navigationSystem.requestRebuild();
      }
  }

  update(): void {
      if (this.isPaused) return;

      const frameDelta = this.engine.getDeltaTime() / 1000;
      this._gameplayLoop.tick(frameDelta, (deltaTime) => {
          this._updateGameplayStep(deltaTime);
      });

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

      // Update clock display every frame (cheap text update)
      this.ui.updateClock(this.timeSystem.timeString);

      // Update compass heading from camera yaw
      this.ui.updateCompass(this.player.camera.rotation.y);

      // Update stealth HUD when crouching
      if (this.stealthSystem.isCrouching) {
          this.ui.updateStealthHUD(this.stealthSystem.stealthLabel);
      } else {
          this.ui.updateStealthHUD(null);
      }

      // Update debug overlay (rate-limited to every ~60 frames)
      if (this.ui.isDebugVisible) {
          const eng = this.engine;
          this.ui.updateDebugOverlay({
              fps:           eng.getFps(),
              // _drawCalls is a private Babylon.js PerfCounter; no public API
              // is currently available. This may break on major engine upgrades.
              drawCalls:     eng._drawCalls?.current ?? 0,
              activeMeshes:  this.scene.getActiveMeshes().length,
              totalVertices: this.scene.getTotalVertices(),
              playerPos: {
                  x: this.player.camera.position.x,
                  y: this.player.camera.position.y,
                  z: this.player.camera.position.z,
              },
              carryWeight:    this.player.carryWeight,
              maxCarryWeight: this.player.maxCarryWeight,
              currentCell:    this.cellManager.currentCell?.name ?? "exterior",
              gameTime:       this.timeSystem.timeString,
              stealthLabel:   this.stealthSystem.stealthLabel,
              lodCulled:      this._lastLodCulled,
              weather:        this.weatherSystem.label,
          });
      }
  }

  private _isPlayerInCombat(): boolean {
      return this.scheduleSystem.npcs.some((npc) =>
          !npc.isDead &&
          (npc.aiState === AIState.ALERT ||
           npc.aiState === AIState.INVESTIGATE ||
           npc.aiState === AIState.CHASE ||
           npc.aiState === AIState.ATTACK)
      );
  }

  private _attemptFastTravel(locationId: string): void {
      const hours = this.fastTravelSystem.estimateTravelHours(this.player.camera.position, locationId);
      if (hours === null) {
          this.ui.showNotification("Unknown destination.", 2000);
          return;
      }

      const result = this.fastTravelSystem.fastTravelTo(
          locationId,
          this.player,
          this._isPlayerInCombat(),
          this.stealthSystem.isCrouching,
      );
      if (!result.ok) {
          this.ui.showNotification(result.message, 2200);
          return;
      }

      this.timeSystem.advanceHours(hours);
      this.respawnSystem.update(this.timeSystem.gameTime);
      this.merchantRestockSystem.update(this.timeSystem.gameTime, this.barterSystem);
      this.ui.showNotification(
          `${result.message} (${hours.toFixed(1)}h passed) — ${this.timeSystem.timeString}`,
          3200,
      );
      this.fastTravelUI.close();
      this.saveSystem.markDirty();
  }

  private _isCombatInputBlocked(): boolean {
      return (
          this.isPaused ||
          this.mapEditorSystem.isEnabled ||
          this.inventorySystem.isOpen ||
          this.questSystem.isLogOpen ||
          this.skillTreeSystem.isOpen ||
          this.fastTravelUI.isVisible ||
          this.dialogueSystem.isInDialogue ||
          this.interactionSystem.isBlocked
      );
  }

  /** Opens a hidden file-input to let the user choose a map JSON to import. */
  private _triggerMapImport(): void {
      if (typeof document === "undefined") return;
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json,application/json";
      input.style.display = "none";
      input.addEventListener("change", async () => {
          const file = input.files?.[0];
          document.body.removeChild(input);
          if (!file) return;
          const ok = await this.mapEditorSystem.importFromFile(file);
          this.ui.showNotification(ok ? "Map imported successfully" : "Map import failed: invalid file", 2500);
          if (ok) {
              this._refreshEditorToolbar();
              this.mapEditorHierarchyPanel.refresh(this.mapEditorSystem.listEntitySummaries());
          }
      });
      document.body.appendChild(input);
      input.click();
  }
}
