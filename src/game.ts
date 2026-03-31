import { Scene } from "@babylonjs/core/scene";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType, PhysicsMotionType } from "@babylonjs/core/Physics";
import { SkyMaterial } from "@babylonjs/materials/sky/skyMaterial";
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
import { MapEditorValidationPanel } from "./ui/map-editor-validation-panel";
import { MapEditorPalettePanel } from "./ui/map-editor-palette-panel";
import { MapEditorLayerPanel } from "./ui/map-editor-layer-panel";
import { MapEditorNotesPanel } from "./ui/map-editor-notes-panel";
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
import { GraphicsSystem } from "./systems/graphics-system";
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
import { PlayerLevelSystem } from "./systems/player-level-system";
import { CharacterCreationUI } from "./ui/character-creation-ui";
import { TutorialSystem } from "./systems/tutorial-system";
import {
  hasCompletedOnboardingTips,
  persistOnboardingTipsCompleted,
  persistSkipOnboardingTips,
  shouldSkipOnboardingTips,
} from "./onboarding-preferences";
import { QuestCreatorSystem } from "./systems/quest-creator-system";
import { QuestCreatorUI } from "./ui/quest-creator-ui";
import { DialogueCreatorSystem } from "./systems/dialogue-creator-system";
import { DialogueCreatorUI } from "./ui/dialogue-creator-ui";
import { resolveDialogueIdForNpcMeshName } from "./systems/dialogue-npc-resolve";
import { NpcCreatorSystem } from "./systems/npc-creator-system";
import { NpcCreatorUI } from "./ui/npc-creator-ui";
import { ItemCreatorSystem } from "./systems/item-creator-system";
import { ItemCreatorUI } from "./ui/item-creator-ui";
import { FactionCreatorSystem } from "./systems/faction-creator-system";
import { FactionCreatorUI } from "./ui/faction-creator-ui";
import { LootTableCreatorSystem } from "./systems/loot-table-creator-system";
import { LootTableCreatorUI } from "./ui/loot-table-creator-ui";
import { SpawnCreatorSystem } from "./systems/spawn-creator-system";
import { SpawnCreatorUI } from "./ui/spawn-creator-ui";
import { ContentBundleSystem } from "./systems/content-bundle-system";
import { ContentBundleUI } from "./ui/content-bundle-ui";
import { EditorHubUI } from "./ui/editor-hub-ui";
import { EditorLayout } from "./ui/editor-layout";
import { buildHelpOverlayLines, summarizeValidationReport } from "./ui/editor-help-overlay";
import { FastTravelUI } from "./ui/fast-travel-ui";
import { SpellMakingUI } from "./ui/spell-making-ui";
import { GuardEncounterUI, type GuardEncounterAction } from "./ui/guard-encounter-ui";
import { LevelUpUI } from "./ui/level-up-ui";
import { StableUI } from "./ui/stable-ui";
import { SaddlebagUI } from "./ui/saddlebag-ui";
import { DailyScheduleSystem } from "./systems/daily-schedule-system";
import { HorseSystem } from "./systems/horse-system";
import { SwimmingSystem } from "./systems/swimming-system";
import { DiseaseSystem } from "./systems/disease-system";
import { EventManagerSystem } from "./systems/event-manager-system";
import { AnimationSystem } from "./systems/animation-system";
import { PetSystem } from "./systems/pet-system";
import type { Pet } from "./systems/pet-system";
import { PetUI } from "./ui/pet-ui";
import { AssetBrowserSystem } from "./systems/asset-browser-system";
import { AssetBrowserUI } from "./ui/asset-browser-ui";
import { BundleMergeSystem } from "./systems/bundle-merge-system";
import { BundleMergeUI } from "./ui/bundle-merge-ui";
import { WorkspaceDraftSystem } from "./systems/workspace-draft-system";
import { ModManifestSystem } from "./systems/mod-manifest-system";
import { ModManifestUI } from "./ui/mod-manifest-ui";
import { BarterUI } from "./ui/barter-ui";
import type { Item } from "./systems/inventory-system";

/** XP awarded to the Sneak skill for each second of active sneaking. */
const SNEAK_XP_PER_SECOND = 2;
/** Inventory item ID used for player gold (bounty payment check). */
const GOLD_ITEM_ID = "gold_coins";
/** Map framework bundle item ids to Babylon inventory ids when they differ. */
const FRAMEWORK_ITEM_TO_GAME: Readonly<Record<string, string>> = {
  health_potion: "potion_hp_01",
  iron_sword: "sword_01",
};
/** Persisted local author identity for layer ownership workflows. */
const MAP_EDITOR_AUTHOR_STORAGE_KEY = "camelot_map_editor_author";

export class Game {
  public scene: Scene;
  public canvas: HTMLCanvasElement;
  public engine: Engine | WebGPUEngine;
  public player: Player;
  public ui: UIManager;
  public world: WorldManager;

  /** Shadow generator driven by the directional sun light. */
  public shadowGenerator: ShadowGenerator | null = null;
  /** Rendering configuration preset (lighting, sky, post-processing, fog). */
  public readonly graphics: GraphicsSystem = new GraphicsSystem();
  /** Procedural sky-dome mesh (skybox).  Null before _initPostProcessing() runs. */
  public skyDome: Mesh | null = null;
  /** Procedural sky-dome material.  Null before _initPostProcessing() runs. */
  public skyMaterial: SkyMaterial | null = null;
  /** DefaultRenderingPipeline (bloom, FXAA, sharpen, tone-mapping, vignette). */
  public renderingPipeline: DefaultRenderingPipeline | null = null;
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
  public mapEditorValidationPanel: MapEditorValidationPanel;
  public mapEditorPalettePanel: MapEditorPalettePanel;
  public mapEditorLayerPanel: MapEditorLayerPanel;
  public mapEditorNotesPanel: MapEditorNotesPanel;
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
  public spawnCreatorSystem: SpawnCreatorSystem;
  public spawnCreatorUI: SpawnCreatorUI;
  public contentBundleSystem: ContentBundleSystem;
  public contentBundleUI: ContentBundleUI;
  public assetBrowserSystem: AssetBrowserSystem;
  public assetBrowserUI: AssetBrowserUI;
  public bundleMergeSystem: BundleMergeSystem;
  public bundleMergeUI: BundleMergeUI;
  public modManifestSystem: ModManifestSystem;
  public modManifestUI: ModManifestUI;
  public workspaceDraftSystem: WorkspaceDraftSystem;
  public editorHubUI: EditorHubUI;
  public editorLayout: EditorLayout;
  public fastTravelUI: FastTravelUI;
  public spellMakingUI: SpellMakingUI;
  public guardEncounterUI: GuardEncounterUI;
  public levelUpUI: LevelUpUI;
  public stableUI: StableUI;
  public saddlebagUI: SaddlebagUI;

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

  // v12 systems (Oblivion depth: character progression — skill-based level-up)
  public playerLevelSystem: PlayerLevelSystem;

  // v18 systems
  public dailyScheduleSystem: DailyScheduleSystem;

  // v19 systems
  public horseSystem: HorseSystem;

  // v20 systems
  public swimSystem: SwimmingSystem;

  // v21 systems
  public diseaseSystem: DiseaseSystem;

  // v22 systems
  public eventManagerSystem: EventManagerSystem;

  // v23 systems
  public animationSystem: AnimationSystem;
  public petSystem: PetSystem;
  public petUI: PetUI;

  private readonly _barterUI = new BarterUI();
  /** When set, open barter after dialogue teardown (pointer lock restored first). */
  private _pendingBarterMerchantId: string | null = null;

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

  // Pet world state — in-world capsule mesh + physics body for the active companion
  private _petMesh: Mesh | null = null;
  private _petPhysicsAggregate: PhysicsAggregate | null = null;
  private _petAttackTimer: number = 0;
  // Cache for pet HUD dirty-checking
  private _lastPetHealth: number = -1;
  private _lastPetId: string | null = null;
  private _helpOverlayEl: HTMLDivElement | null = null;
  private _helpOverlayVisible: boolean = false;
  private _activeGuardChallenge: { guard: NPC; factionId: string; bounty: number } | null = null;

  /** Short post-creation tips; advances on Space or when the hinted action occurs. */
  private readonly _onboardingTutorial = new TutorialSystem();
  private _onboardingTipEl: HTMLDivElement | null = null;

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
    const { undo, redo } = this.mapEditorSystem.historySize;
    this.mapEditorToolbar.update({
      placementType:      this.mapEditorSystem.currentPlacementType,
      gizmoMode:          this.mapEditorSystem.mode,
      terrainTool:        this.mapEditorSystem.terrainTool,
      entityCount:        this.mapEditorSystem.entityCount,
      activePatrolGroupId: this.mapEditorSystem.activePatrolGroupId,
      snapSize:           this.mapEditorSystem.snapSize,
      undoCount:          undo,
      redoCount:          redo,
      typeCounts:         this.mapEditorSystem.getTypeCounts(),
    });
    this.mapEditorPalettePanel.setActivePlacementType(this.mapEditorSystem.currentPlacementType);
  }

  /** Refresh the layer panel after any layer or entity change. */
  private _refreshLayerPanel(): void {
    this.mapEditorLayerPanel.currentAuthor = this.mapEditorSystem.currentAuthor;
    this.mapEditorLayerPanel.activeLayerName = this.mapEditorSystem.activeLayerName;
    this.mapEditorLayerPanel.refresh(
      this.mapEditorSystem.getLayers(),
      this.mapEditorSystem.getLayerEntityCounts(),
    );
  }

  private _loadMapEditorAuthor(): string {
    if (typeof localStorage === "undefined") {
      return "Local Author";
    }
    return localStorage.getItem(MAP_EDITOR_AUTHOR_STORAGE_KEY)?.trim() || "Local Author";
  }

  private _persistMapEditorAuthor(author: string): void {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(MAP_EDITOR_AUTHOR_STORAGE_KEY, author);
  }

  init(): void {
    this._setLight();
    this.player = new Player(this.scene, this.canvas);
    // Post-processing and skybox require the camera, so initialise after Player.
    this._initPostProcessing();
    this.ui = new UIManager(this.scene);
    this.world = new WorldManager(this.scene, this.shadowGenerator);
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
    this.questSystem.onOpen = () => {
      if (this._onboardingTutorial.isActive && this._onboardingTutorial.currentStep?.id === "quests") {
        this._onboardingTutorial.advance();
      }
    };
    this.saveSystem.setQuestSystem(this.questSystem);
    this.saveSystem.onAfterLoad = () => {
      this._cleanupCollectedLoot();
      this._hydrateCellAfterLoad();
      this._syncInventoryGoldToFramework();
    };
    this.interactionSystem  = new InteractionSystem(this.scene, this.player, this.inventorySystem, this.dialogueSystem, this.ui);
    this.interactionSystem.cellManager = this.cellManager;
    this.inventorySystem.onOpen = () => {
      if (this._onboardingTutorial.isActive && this._onboardingTutorial.currentStep?.id === "inventory") {
        this._onboardingTutorial.advance();
      }
    };
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
    this.mapEditorSystem.currentAuthor = this._loadMapEditorAuthor();

    // ── Editor layout — panel registry and unified selection model ────────────
    this.editorLayout = new EditorLayout();
    this.editorLayout.registerPanel("hierarchy",  { side: "left",   size: 240, isVisible: false });
    this.editorLayout.registerPanel("palette",    { side: "left",   size: 220, isVisible: false });
    this.editorLayout.registerPanel("layers",     { side: "left",   size: 220, isVisible: false });
    this.editorLayout.registerPanel("notes",      { side: "float",             isVisible: false });
    this.editorLayout.registerPanel("properties", { side: "right",  size: 300, isVisible: false });
    this.editorLayout.registerPanel("validation", { side: "bottom", size: 200, isVisible: false });

    // ── Map editor property panel ─────────────────────────────────────────────
    this.mapEditorPropertyPanel = new MapEditorPropertyPanel(this.ui.uiTexture);
    this.mapEditorPropertyPanel.onApply = (entityId, props, layerName) => {
      this.mapEditorSystem.setEntityProperties(entityId, props);
      this.mapEditorSystem.setEntityLayer(entityId, layerName);
      this.mapEditorHierarchyPanel.refresh(this.mapEditorSystem.listEntitySummaries());
      this._refreshLayerPanel();
      this.ui.showNotification("Properties applied", 1200);
    };
    this.mapEditorPropertyPanel.onDelete = (entityId) => {
      this.mapEditorSystem.removeEntity(entityId);
      this.ui.showNotification("Entity deleted", 1200);
      this.mapEditorHierarchyPanel.refresh(this.mapEditorSystem.listEntitySummaries());
      this._refreshLayerPanel();
      this._refreshEditorToolbar();
    };
    // Route entity selection through the unified EditorLayout selection model.
    this.mapEditorSystem.onEntitySelectionChanged = (entityId) => {
      this.editorLayout.setSelection(entityId);
    };
    this.editorLayout.onSelectionChanged = (entityId) => {
      if (entityId === null) {
        this.mapEditorPropertyPanel.hide();
        this.editorLayout.setVisible("properties", false);
        this.mapEditorHierarchyPanel.setSelection(null);
        return;
      }
      const entity = this.mapEditorSystem.getEntityProperties(entityId);
      const mesh = this.scene.getMeshByName(entityId);
      const type = mesh?.metadata?.editorType;
      const position = this.mapEditorSystem.getEntityPosition(entityId) ?? undefined;
      if (type && entity !== null) {
        this.mapEditorPropertyPanel.show(
          entityId,
          type,
          entity,
          position,
          this.mapEditorSystem.getEntityLayer(entityId) ?? "objects",
        );
        this.editorLayout.setVisible("properties", true);
      }
      this.mapEditorHierarchyPanel.setSelection(entityId);
    };
    // Drive panel show/hide from layout changes (enables hideAll() to work).
    this.editorLayout.onLayoutChanged = (state) => {
      switch (state.panelId) {
        case "hierarchy":
          state.isVisible ? this.mapEditorHierarchyPanel.show() : this.mapEditorHierarchyPanel.hide();
          break;
        case "palette":
          state.isVisible ? this.mapEditorPalettePanel.show() : this.mapEditorPalettePanel.hide();
          break;
        case "layers":
          if (state.isVisible) {
            this._refreshLayerPanel();
            this.mapEditorLayerPanel.show();
          } else {
            this.mapEditorLayerPanel.hide();
          }
          break;
        case "notes":
          state.isVisible
            ? this.mapEditorNotesPanel.show(this.mapEditorSystem.notes)
            : this.mapEditorNotesPanel.hide();
          break;
        case "properties":
          if (!state.isVisible) this.mapEditorPropertyPanel.hide();
          break;
        case "validation":
          if (!state.isVisible) this.mapEditorValidationPanel.hide();
          break;
      }
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
    this.mapEditorToolbar.onSnapSizeChange = (delta) => {
      const SNAP_MIN = 0.25;
      const SNAP_MAX = 16;
      this.mapEditorSystem.snapSize = Math.min(SNAP_MAX, Math.max(SNAP_MIN, this.mapEditorSystem.snapSize + delta));
      this._refreshEditorToolbar();
    };

    // ── Map editor hierarchy panel ────────────────────────────────────────────
    this.mapEditorHierarchyPanel = new MapEditorHierarchyPanel(this.ui.uiTexture);
    this.mapEditorHierarchyPanel.onEntityClick = (entityId) => {
      this.mapEditorSystem.selectEntityById(entityId);
    };

    // ── Map editor validation panel ───────────────────────────────────────────
    this.mapEditorValidationPanel = new MapEditorValidationPanel(this.ui.uiTexture);
    this.mapEditorValidationPanel.onRevalidate = () => {
      const report = this.mapEditorSystem.validateMap(0.5, {
        knownLootTableIds: this.lootTableSystem.getTableIds(),
      });
      this.mapEditorValidationPanel.update(report);
    };
    this.mapEditorValidationPanel.onEntityFocus = (entityId) => {
      this.mapEditorSystem.selectEntityById(entityId);
    };

    // ── Map editor palette panel ──────────────────────────────────────────────
    this.mapEditorPalettePanel = new MapEditorPalettePanel(this.ui.uiTexture);
    this.mapEditorPalettePanel.onPlacementTypeChange = (ptype) => {
      this.mapEditorSystem.currentPlacementType = ptype;
      this._refreshEditorToolbar();
    };
    this.mapEditorPalettePanel.onPlace = (ptype) => {
      this.mapEditorSystem.currentPlacementType = ptype;
      const placeAt = this.player.camera.position.add(this.player.getForwardDirection(8).scale(4));
      placeAt.y = Math.max(1, placeAt.y);
      this.mapEditorSystem.placeEntity(placeAt, ptype);
      this.ui.showNotification(`Placed: ${ptype}`, 1200);
      this._refreshEditorToolbar();
      this.mapEditorHierarchyPanel.refresh(this.mapEditorSystem.listEntitySummaries());
      this._refreshLayerPanel();
    };
    this.mapEditorPalettePanel.onDuplicate = () => {
      const selId = this.mapEditorSystem.selectedEntityId;
      if (!selId) {
        this.ui.showNotification("No entity selected", 1200);
        return;
      }
      const newMesh = this.mapEditorSystem.duplicateEntity(selId);
      if (newMesh) {
        this.ui.showNotification("Entity duplicated", 1200);
        this._refreshEditorToolbar();
        this.mapEditorHierarchyPanel.refresh(this.mapEditorSystem.listEntitySummaries());
        this._refreshLayerPanel();
      }
    };
    this.mapEditorPalettePanel.onDelete = () => {
      const selId = this.mapEditorSystem.selectedEntityId;
      if (!selId) {
        this.ui.showNotification("No entity selected", 1200);
        return;
      }
      this.mapEditorSystem.removeEntity(selId);
      this.ui.showNotification("Entity deleted", 1200);
      this._refreshEditorToolbar();
      this.mapEditorHierarchyPanel.refresh(this.mapEditorSystem.listEntitySummaries());
      this._refreshLayerPanel();
    };

    // ── Map editor property panel: copy ID + position ─────────────────────────
    this.mapEditorPropertyPanel.onCopyId = (entityId) => {
      this.ui.showNotification(`Copied: ${entityId}`, 1200);
    };

    // ── Map editor system: entity moved (gizmo drag-end) ──────────────────────
    this.mapEditorSystem.onEntityMoved = (_entityId, position) => {
      this.mapEditorPropertyPanel.updatePosition(position);
      this.mapEditorHierarchyPanel.refresh(this.mapEditorSystem.listEntitySummaries());
    };

    // ── Map editor layer panel ────────────────────────────────────────────────
    this.mapEditorLayerPanel = new MapEditorLayerPanel(this.ui.uiTexture);
    this.mapEditorLayerPanel.onLayerVisibilityChange = (name, visible) => {
      this.mapEditorSystem.setLayerVisible(name, visible);
      this._refreshLayerPanel();
    };
    this.mapEditorLayerPanel.onLayerActivate = (name) => {
      const next = this.mapEditorSystem.activeLayerName === name ? null : name;
      this.mapEditorSystem.setActiveLayer(next);
      this._refreshLayerPanel();
      const msg = next === null
        ? "Layer targeting reset to placement defaults"
        : `New placements now target "${name}"`;
      this.ui.showNotification(msg, 1400);
    };
    this.mapEditorLayerPanel.onLayerLockChange = (name, locked) => {
      this.mapEditorSystem.setLayerLocked(name, locked);
      this._refreshLayerPanel();
      const msg = locked ? `Layer "${name}" locked` : `Layer "${name}" unlocked`;
      this.ui.showNotification(msg, 1200);
    };
    this.mapEditorLayerPanel.onLayerOwnerChange = (name, owner) => {
      this.mapEditorSystem.setLayerOwner(name, owner);
      this._persistMapEditorAuthor(this.mapEditorSystem.currentAuthor);
      this._refreshLayerPanel();
      const trimmedOwner = owner.trim();
      const msg = trimmedOwner === ""
        ? `Cleared owner for "${name}"`
        : `Layer "${name}" claimed by ${trimmedOwner}`;
      this.ui.showNotification(msg, 1400);
    };
    this.mapEditorSystem.onLayerChanged = () => {
      this._refreshLayerPanel();
    };

    // ── Map editor notes panel ────────────────────────────────────────────────
    this.mapEditorNotesPanel = new MapEditorNotesPanel(this.ui.uiTexture);
    this.mapEditorNotesPanel.onSave = (text) => {
      this.mapEditorSystem.notes = text;
      this.ui.showNotification("Scene notes saved", 1200);
    };

    // ── Toolbar: camera frame callbacks ──────────────────────────────────────
    this.mapEditorToolbar.onFrameSelected = () => {
      const selId = this.mapEditorSystem.selectedEntityId;
      if (!selId) { this.ui.showNotification("No entity selected", 1000); return; }
      const pos = this.mapEditorSystem.getEntityPosition(selId);
      if (pos) {
        this.player.camera.target.set(pos.x, pos.y, pos.z);
        this.ui.showNotification("Framed selected entity", 1000);
      }
    };
    this.mapEditorToolbar.onFrameAll = () => {
      const summaries = this.mapEditorSystem.listEntitySummaries();
      if (summaries.length === 0) { this.ui.showNotification("No entities to frame", 1000); return; }
      let cx = 0, cy = 0, cz = 0;
      for (const s of summaries) { cx += s.position.x; cy += s.position.y; cz += s.position.z; }
      cx /= summaries.length; cy /= summaries.length; cz /= summaries.length;
      this.player.camera.target.set(cx, cy, cz);
      this.ui.showNotification(`Framed ${summaries.length} entities`, 1000);
    };

    // ── Quest Creator ──────────────────────────────────────────────────────────
    this.questCreatorSystem = new QuestCreatorSystem();
    this.questCreatorUI = new QuestCreatorUI(this.questCreatorSystem);
    this.questCreatorUI.onClose = () => {
      this.interactionSystem.isBlocked = this.mapEditorSystem.isEnabled;
      this.workspaceDraftSystem.markDirty();
    };

    // ── Dialogue Creator ───────────────────────────────────────────────────────
    this.dialogueCreatorSystem = new DialogueCreatorSystem();
    this.dialogueCreatorUI = new DialogueCreatorUI(this.dialogueCreatorSystem);
    this.dialogueCreatorUI.onClose = () => {
      this.interactionSystem.isBlocked = this.mapEditorSystem.isEnabled;
      this.workspaceDraftSystem.markDirty();
    };

    // ── NPC Creator ────────────────────────────────────────────────────────────
    this.npcCreatorSystem = new NpcCreatorSystem();
    this.npcCreatorUI = new NpcCreatorUI(this.npcCreatorSystem);
    this.npcCreatorUI.onClose = () => {
      this.interactionSystem.isBlocked = this.mapEditorSystem.isEnabled;
      this.workspaceDraftSystem.markDirty();
    };

    // ── Item Creator ───────────────────────────────────────────────────────────
    this.itemCreatorSystem = new ItemCreatorSystem();
    this.itemCreatorUI = new ItemCreatorUI(this.itemCreatorSystem);
    this.itemCreatorUI.onClose = () => {
      this.interactionSystem.isBlocked = this.mapEditorSystem.isEnabled;
      this.workspaceDraftSystem.markDirty();
    };

    // ── Faction Creator ────────────────────────────────────────────────────────
    this.factionCreatorSystem = new FactionCreatorSystem();
    this.factionCreatorUI = new FactionCreatorUI(this.factionCreatorSystem);
    this.factionCreatorUI.onClose = () => {
      this.interactionSystem.isBlocked = this.mapEditorSystem.isEnabled;
      this.workspaceDraftSystem.markDirty();
    };

    // ── Loot Table Creator ─────────────────────────────────────────────────────
    this.lootTableCreatorSystem = new LootTableCreatorSystem();
    this.lootTableCreatorUI = new LootTableCreatorUI(this.lootTableCreatorSystem);
    this.lootTableCreatorUI.onClose = () => {
      this.interactionSystem.isBlocked = this.mapEditorSystem.isEnabled;
      this.workspaceDraftSystem.markDirty();
    };

    // ── Spawn Creator ──────────────────────────────────────────────────────────
    this.spawnCreatorSystem = new SpawnCreatorSystem();
    this.spawnCreatorUI = new SpawnCreatorUI(this.spawnCreatorSystem);
    this.spawnCreatorUI.onClose = () => {
      this.interactionSystem.isBlocked = this.mapEditorSystem.isEnabled;
      this.workspaceDraftSystem.markDirty();
    };

    // ── Content Bundle ─────────────────────────────────────────────────────────
    this.contentBundleSystem = new ContentBundleSystem();
    this.contentBundleSystem
      .attachQuest(this.questCreatorSystem)
      .attachDialogue(this.dialogueCreatorSystem)
      .attachFaction(this.factionCreatorSystem)
      .attachLootTable(this.lootTableCreatorSystem)
      .attachNpc(this.npcCreatorSystem)
      .attachItem(this.itemCreatorSystem)
      .attachSpawn(this.spawnCreatorSystem);
    this.contentBundleUI = new ContentBundleUI(this.contentBundleSystem);
    this.contentBundleUI.onClose = () => {
      this.interactionSystem.isBlocked = this.mapEditorSystem.isEnabled;
      if (this.mapEditorSystem.isEnabled || this.isPaused) return;
      this.canvas.requestPointerLock();
      this.player.camera.attachControl(this.canvas, true);
    };
    this.contentBundleUI.onPlayFromHere = (systemId) => {
      this.interactionSystem.isBlocked = true;
      document.exitPointerLock();
      this.player.camera.detachControl();
      switch (systemId) {
        case "map":
          if (!this.mapEditorSystem.isEnabled) {
            this.mapEditorSystem.toggle();
            this.mapEditorToolbar.show();
            this.editorLayout.setVisible("hierarchy", true);
            this.editorLayout.setVisible("palette", true);
            this.editorLayout.setVisible("layers", true);
            this.mapEditorHierarchyPanel.refresh(this.mapEditorSystem.listEntitySummaries());
            this._refreshEditorToolbar();
          }
          break;
        case "quest":     this.questCreatorUI.open();     break;
        case "dialogue":  this.dialogueCreatorUI.open();  break;
        case "faction":   this.factionCreatorUI.open();   break;
        case "lootTable": this.lootTableCreatorUI.open(); break;
        case "npc":       this.npcCreatorUI.open();       break;
        case "item":      this.itemCreatorUI.open();      break;
        case "spawn":     this.spawnCreatorUI.open();     break;
        default: break;
      }
    };

    // ── Asset Browser ──────────────────────────────────────────────────────────
    this.assetBrowserSystem = new AssetBrowserSystem();
    this.assetBrowserUI = new AssetBrowserUI(this.assetBrowserSystem);
    this.assetBrowserUI.onClose = () => {
      this.interactionSystem.isBlocked = this.mapEditorSystem.isEnabled;
      if (this.mapEditorSystem.isEnabled || this.isPaused) return;
      this.canvas.requestPointerLock();
      this.player.camera.attachControl(this.canvas, true);
    };
    this.assetBrowserUI.onImportBundle = () => {
      const inp = document.createElement("input");
      inp.type = "file";
      inp.accept = ".json,.bundle.json";
      inp.addEventListener("change", () => {
        const file = inp.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const parsed = JSON.parse(reader.result as string);
            const n = this.assetBrowserSystem.importFromBundle(parsed);
            this.assetBrowserUI.refresh();
            this.editorHubUI.setBadge("assets", this.assetBrowserSystem.size);
            this.ui.showNotification(`Asset Browser: imported ${n} asset${n !== 1 ? "s" : ""} from bundle.`, 2500);
          } catch {
            this.ui.showNotification("Asset Browser: failed to parse bundle JSON.", 2500);
          }
        };
        reader.readAsText(file);
      });
      inp.click();
    };

    // ── Bundle Merge ────────────────────────────────────────────────────────────
    this.bundleMergeSystem = new BundleMergeSystem();
    this.bundleMergeUI = new BundleMergeUI(this.bundleMergeSystem);
    this.bundleMergeUI.onClose = () => {
      this.interactionSystem.isBlocked = this.mapEditorSystem.isEnabled;
      if (this.mapEditorSystem.isEnabled || this.isPaused) return;
      this.canvas.requestPointerLock();
      this.player.camera.attachControl(this.canvas, true);
    };

    // ── Mod Manifest ────────────────────────────────────────────────────────────
    this.modManifestSystem = new ModManifestSystem();
    this.modManifestUI = new ModManifestUI(this.modManifestSystem);
    this.modManifestUI.onClose = () => {
      this.interactionSystem.isBlocked = this.mapEditorSystem.isEnabled;
      if (this.mapEditorSystem.isEnabled || this.isPaused) return;
      this.canvas.requestPointerLock();
      this.player.camera.attachControl(this.canvas, true);
    };

    // ── Workspace Draft ─────────────────────────────────────────────────────────
    this.workspaceDraftSystem = new WorkspaceDraftSystem();
    this.workspaceDraftSystem
      .attachQuest(this.questCreatorSystem)
      .attachDialogue(this.dialogueCreatorSystem)
      .attachFaction(this.factionCreatorSystem)
      .attachLootTable(this.lootTableCreatorSystem)
      .attachNpc(this.npcCreatorSystem)
      .attachItem(this.itemCreatorSystem)
      .attachSpawn(this.spawnCreatorSystem)
      .attachMap(this.mapEditorSystem);
    this.workspaceDraftSystem.onSaved = () => {
      this.ui.showNotification("Workspace draft auto-saved.", 1500);
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
              this.editorLayout.setVisible("hierarchy", true);
              this.editorLayout.setVisible("palette", true);
              this.editorLayout.setVisible("layers", true);
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
          case "spawn":
            this.spawnCreatorUI.open();
            break;
          case "bundle":
            this.contentBundleUI.open();
            break;
          case "assets":
            this.assetBrowserUI.open();
            break;
          case "merge":
            this.bundleMergeUI.open();
            break;
          case "modManifest":
            this.modManifestUI.open();
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

    this.guardEncounterUI = new GuardEncounterUI();
    this.guardEncounterUI.onResolve = (action) => this._resolveGuardEncounter(action);

    this.levelUpUI = new LevelUpUI();
    this.levelUpUI.onConfirm = (primary, sec1, sec2) => {
      this.playerLevelSystem.confirmLevelUp(primary, sec1, sec2);
      this.interactionSystem.isBlocked = false;
      this.canvas.requestPointerLock();
      this.player.camera.attachControl(this.canvas, true);
    };

    // ── v2 system wiring ──────────────────────────────────────────────────────
    this.stealthSystem   = new StealthSystem(this.player, this.scheduleSystem.npcs, this.ui);
    this.crimeSystem     = new CrimeSystem(this.player, this.scheduleSystem.npcs, this.ui);
    this.containerSystem = new ContainerSystem(this.scene, this.player, this.inventorySystem, this.ui);
    this.projectileSystem = new ProjectileSystem(this.scene, this.player, this.scheduleSystem.npcs, this.ui);
    this.projectileSystem.stealthSystem = this.stealthSystem;
    this.barterSystem    = new BarterSystem(this.inventorySystem, this.ui);
    this.barterSystem.onTransaction = () => {
      this._mirrorBarterGoldToInventory();
      this._syncInventoryGoldToFramework();
    };
    this.frameworkRuntime.setDialogueHostHooks({
      onDialogueHostEvent: (eventId, payload) => this._handleDialogueHostEvent(eventId, payload),
      onDialogueConsumeItem: (itemId, quantity) => this._dialogueConsumeInventoryItem(itemId, quantity),
      onDialogueGiveItem: (itemId, quantity) => this._giveDialogueItemToPlayer(itemId, quantity),
      dialogueInventoryCount: (itemId) => this._dialogueInventoryCountForFramework(itemId),
    });

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
      { ambientBase: this.graphics.lighting.ambientBase, sunBase: this.graphics.lighting.sunBase },
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
      // Notify PlayerLevelSystem so it can track major-skill level-ups.
      this.playerLevelSystem?.handleSkillLevelUp(skillId);
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
    // Auto-discover locations when the player enters a new cell (portals use fade + tryTransition)
    this.cellManager.onCellChanged = (cellId, cellName) => {
      this._onCellEntered(cellId, cellName);
    };
    this.interactionSystem.onPortalTransition = (portalId) => this._beginPortalTransition(portalId);
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

    this.spellMakingUI = new SpellMakingUI((components) => this.spellMakingSystem.computeCost(components));
    this.spellMakingUI.onForge = ({ name, components }) => {
      this.barterSystem.playerGold = this._getInventoryGold();
      const result = this.spellMakingSystem.forgeSpell(name, components, this.barterSystem);
      if (result.ok) {
        if (result.goldCost && result.goldCost > 0) {
          this._consumeInventoryGold(result.goldCost);
        }
        this.barterSystem.playerGold = this._getInventoryGold();
        this.spellMakingUI.showStatus(
          `Forged "${result.spell!.name}" for ${result.goldCost} gold. Press Z to cycle spells.`,
        );
      } else {
        const reasonMsg: Record<string, string> = {
          insufficient_gold: "Not enough gold to forge this spell.",
          duplicate_name: "A custom spell with that name already exists.",
          no_components: "Add at least one spell component.",
          too_many_components: "You can only combine up to two components.",
          invalid_name: "Enter a valid spell name.",
        };
        this.spellMakingUI.showStatus(
          reasonMsg[result.reason ?? ""] ?? `Cannot forge spell (${result.reason ?? "unknown"}).`,
          true,
        );
      }
    };
    this.spellMakingUI.onClose = () => {
      this.interactionSystem.isBlocked = this.mapEditorSystem.isEnabled;
      if (this.mapEditorSystem.isEnabled || this.isPaused) return;
      this.canvas.requestPointerLock();
      this.player.camera.attachControl(this.canvas, true);
    };

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
    this.merchantRestockSystem.registerMerchant(
      "merchant_general_01",
      [
        { id: "potion_hp_01", name: "Health Potion", description: "Restores 50 health.", stackable: true, quantity: 8, weight: 0.3, stats: { value: 25 } },
        { id: "arrow_bundle", name: "Arrows (20)", description: "A bundle of iron arrows.", stackable: true, quantity: 4, weight: 1, stats: { value: 15 } },
      ],
      450,
      72,
      this.timeSystem.gameTime,
    );
    this.merchantRestockSystem.registerMerchant(
      "merchant_weapons_01",
      [
        { id: "iron_sword", name: "Iron Sword", description: "A basic iron sword.", stackable: false, quantity: 2, slot: "mainHand", weight: 3, stats: { damage: 10, value: 80 } },
        { id: "arrow_bundle", name: "Arrows (20)", description: "A bundle of iron arrows.", stackable: true, quantity: 6, weight: 1, stats: { value: 15 } },
      ],
      800,
      72,
      this.timeSystem.gameTime,
    );
    this.merchantRestockSystem.registerMerchant(
      "merchant_armor_01",
      [
        { id: "leather_chest_01", name: "Leather Chest", description: "Light armor. +15 Armor Rating.", stackable: false, quantity: 1, slot: "chest", weight: 4, stats: { armor: 15, value: 55 } },
        { id: "iron_helm_01", name: "Iron Helm", description: "A sturdy iron helmet. +12 Armor Rating.", stackable: false, quantity: 2, slot: "head", weight: 2.5, stats: { armor: 12, value: 45 } },
      ],
      650,
      72,
      this.timeSystem.gameTime,
    );
    this.merchantRestockSystem.registerMerchant(
      "merchant_alchemist_01",
      [{ id: "potion_hp_01", name: "Health Potion", description: "Restores 50 health.", stackable: true, quantity: 12, weight: 0.3, stats: { value: 25 } }],
      520,
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
      // Sync water breathing ability (Argonian racial trait)
      this.swimSystem.hasWaterBreathing = race.waterBreathing ?? false;
      // Sync disease immunity (Argonian racial trait — 100 % resistance)
      this.diseaseSystem.diseaseResistanceChance = race.id === "argonian" ? 1.0 : 0;
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

    // ── v12 system wiring (Oblivion depth: skill-based character progression) ──
    this.playerLevelSystem = new PlayerLevelSystem();
    this.playerLevelSystem.attachToClassSystem(this.classSystem);
    this.playerLevelSystem.attachToAttributeSystem(this.attributeSystem);
    this.playerLevelSystem.onLevelUpReady = (bonuses) => {
      // Open the interactive level-up dialog so the player can choose 3 attributes.
      this.interactionSystem.isBlocked = true;
      document.exitPointerLock();
      this.player.camera.detachControl();
      this.levelUpUI.open(this.playerLevelSystem.characterLevel + 1, bonuses);
    };
    this.playerLevelSystem.onLevelUpComplete = (newLevel) => {
      // Sync derived stats after attribute bonuses have been applied.
      this.player.maxHealth      = this.attributeSystem.maxHealth;
      this.player.maxMagicka     = this.attributeSystem.maxMagicka;
      this.player.maxStamina     = this.attributeSystem.maxStamina;
      this.player.maxCarryWeight = this.attributeSystem.carryWeight;
      this.ui.showNotification(`Character Level ${newLevel}!`, 4000);
      this.eventBus.emit("player:levelUp", { newLevel });
      this.saveSystem.markDirty();
    };
    this.saveSystem.setPlayerLevelSystem(this.playerLevelSystem);

    // ── v18 DailyScheduleSystem ───────────────────────────────────────────────
    // Connects TimeSystem → ScheduleSystem so NPC daily behaviours are driven
    // automatically by the in-game clock.  Also enforces non-interactivity for
    // sleeping NPCs by clearing their mesh.metadata during sleep windows.
    this.dailyScheduleSystem = new DailyScheduleSystem(
      this.scheduleSystem,
      this.timeSystem,
    );
    this.dailyScheduleSystem.onNPCSleep = (npc) => {
      this.ui.showNotification(`${npc.mesh.name} has gone to sleep.`, 2000);
      this.saveSystem.markDirty();
    };
    this.dailyScheduleSystem.onNPCWake = (npc) => {
      this.ui.showNotification(`${npc.mesh.name} has woken up.`, 2000);
      this.saveSystem.markDirty();
    };
    this.saveSystem.setDailyScheduleSystem(this.dailyScheduleSystem);

    // ── v19: Horse system ──────────────────────────────────────────────────
    this.horseSystem = new HorseSystem();
    // Register starter horses available at world stables
    this.horseSystem.registerHorse({ id: "bay_mare", name: "Bay Mare", speed: 1.8, saddlebagCapacity: 8, stableId: "starter_stable" });
    this.horseSystem.registerHorse({ id: "black_stallion", name: "Black Stallion", speed: 2.2, saddlebagCapacity: 6, stableId: "starter_stable" });
    this.horseSystem.registerHorse({ id: "grey_gelding", name: "Grey Gelding", speed: 2.0, saddlebagCapacity: 10, stableId: "starter_stable" });
    this.horseSystem.registerStableNPC({
      npcName: "Stable Master",
      availableHorseIds: ["bay_mare", "black_stallion", "grey_gelding"],
      prices: { bay_mare: 500, black_stallion: 1000, grey_gelding: 750 },
    });
    this.horseSystem.onMount = (horse, speed) => {
      (this.player as unknown as { moveSpeedMultiplier?: number }).moveSpeedMultiplier = speed;
      this.ui.showNotification(`Mounted ${horse.name}`, 1800);
      this.saveSystem.markDirty();
    };
    this.horseSystem.onDismount = (horse) => {
      (this.player as unknown as { moveSpeedMultiplier?: number }).moveSpeedMultiplier = 1;
      this.ui.showNotification(`Dismounted ${horse.name}`, 1800);
      this.saveSystem.markDirty();
    };
    this.horseSystem.onHorsePurchased = (horse) => {
      this.ui.showNotification(`Purchased ${horse.name}!`, 2500);
      this.saveSystem.markDirty();
    };
    this.saveSystem.setHorseSystem(this.horseSystem);

    // ── v20: Swimming system ───────────────────────────────────────────────
    this.swimSystem = new SwimmingSystem();
    // Argonian racial water breathing — suppress breath drain for this race
    if (this.raceSystem.chosenRace?.waterBreathing) {
      this.swimSystem.hasWaterBreathing = true;
    }
    this.swimSystem.onEnterWater = () => {
      this.ui.showNotification("Entered water.", 1500);
    };
    this.swimSystem.onExitWater = () => {
      this.ui.showNotification("Surfaced.", 1500);
    };
    this.swimSystem.onBreathLow = () => {
      this.ui.showNotification("Running out of breath!", 2000);
    };
    this.swimSystem.onDrowning = (_dmg) => {
      this.player.notifyDamageTaken();
    };
    this.saveSystem.setSwimmingSystem(this.swimSystem);

    // ── v21: Disease system ────────────────────────────────────────────────
    this.diseaseSystem = new DiseaseSystem();
    // Argonian racial disease immunity — 100 % resistance
    if (this.raceSystem.chosenRace?.id === "argonian") {
      this.diseaseSystem.diseaseResistanceChance = 1.0;
    }
    this.diseaseSystem.onDiseaseContracted = (id) => {
      const def = this.diseaseSystem.getDefinition(id);
      this.ui.showNotification(`Contracted ${def?.name ?? id}!`, 3000);
    };
    this.diseaseSystem.onDiseaseCured = (id) => {
      const def = this.diseaseSystem.getDefinition(id);
      this.ui.showNotification(`Cured of ${def?.name ?? id}.`, 2000);
    };
    this.saveSystem.setDiseaseSystem(this.diseaseSystem);

    // ── v22: Event Manager (Dungeon Master) ───────────────────────────────
    this.eventManagerSystem = new EventManagerSystem();
    this.eventManagerSystem.onEventTriggered = (_id, def) => {
      this.ui.showNotification(`📜 ${def.title}`, 3000);
    };
    this.saveSystem.setEventManagerSystem(this.eventManagerSystem);

    // ── v23 Animation System ───────────────────────────────────────────────
    this.animationSystem = new AnimationSystem(this.scene);

    // ── v23 Pet System ─────────────────────────────────────────────────────
    this.petSystem = new PetSystem();
    this.petSystem.onPetAcquired = (pet) => {
      this.ui.showNotification(`You gained a companion: ${pet.name}!`, 3000);
      this.eventBus.emit("pet:acquired", { petId: pet.id, petName: pet.name, species: pet.species });
    };
    this.petSystem.onPetSummoned = (pet) => {
      this._spawnPetMesh(pet);
      this.eventBus.emit("pet:summoned", { petId: pet.id, petName: pet.name });
    };
    this.petSystem.onPetDismissed = (pet) => {
      this._despawnPetMesh();
      this.eventBus.emit("pet:dismissed", { petId: pet.id, petName: pet.name });
    };
    this.petSystem.onPetDied = (pet) => {
      this.ui.showNotification(`${pet.name} has fallen in battle!`, 3500);
      this.eventBus.emit("pet:died", { petId: pet.id, petName: pet.name });

      // Capture refs before clearing so the death animation can play on the mesh
      const dyingMesh     = this._petMesh;
      const dyingPhysics  = this._petPhysicsAggregate;
      this._petMesh              = null;
      this._petPhysicsAggregate  = null;

      if (dyingMesh && dyingPhysics) {
        dyingPhysics.body.setMotionType(PhysicsMotionType.STATIC);
        this.animationSystem.playDeath(dyingMesh);
        setTimeout(() => {
          this.animationSystem.unregisterMesh(dyingMesh.name);
          dyingPhysics.dispose();
          dyingMesh.dispose();
        }, 3000);
      }
    };
    this.petSystem.onPetLevelUp = (pet, newLevel) => {
      this.ui.showNotification(`${pet.name} reached level ${newLevel}!`, 2500);
      this.eventBus.emit("pet:levelUp", { petId: pet.id, petName: pet.name, newLevel });
    };
    this.saveSystem.setPetSystem(this.petSystem);
    // Grant a starter wolf companion for new games
    this.petSystem.grantPet("pet_wolf");

    // ── v23 Pet UI ─────────────────────────────────────────────────────────
    this.petUI = new PetUI();
    this.petUI.onSummon = (petId) => {
      this.petSystem.summonPet(petId);
      this.petUI.refresh(this.petSystem.pets, this.petSystem.activePet?.id ?? null);
    };
    this.petUI.onDismiss = () => {
      this.petSystem.dismissPet();
      this.petUI.refresh(this.petSystem.pets, null);
    };
    this.petUI.onClose = () => {
      this.interactionSystem.isBlocked = false;
      this.canvas.requestPointerLock();
      this.player.camera.attachControl(this.canvas, true);
    };

    // ── Stable UI ─────────────────────────────────────────────────────────
    this.stableUI = new StableUI();
    this.stableUI.onClose = () => {
      this.interactionSystem.isBlocked = false;
      this.canvas.requestPointerLock();
      this.player.camera.attachControl(this.canvas, true);
    };
    this.stableUI.onPurchase = (horseId) => {
      const stable = this.horseSystem.getStableNPC("Stable Master");
      if (!stable) return;
      const playerGold = this._getInventoryGold();
      const price = this.horseSystem.purchaseHorse("Stable Master", horseId, playerGold);
      if (price === -2) {
        this.stableUI.showStatus("You already own this horse.", true);
      } else if (price < 0) {
        this.stableUI.showStatus("Unable to complete the purchase.", true);
      } else {
        this._consumeInventoryGold(price);
        this.stableUI.markOwned(horseId);
        this.stableUI.setPlayerGold(this._getInventoryGold());
        this.stableUI.showStatus(`You purchased a horse for ${price}g.`);
      }
    };

    // ── Saddlebag UI ───────────────────────────────────────────────────────
    this.saddlebagUI = new SaddlebagUI();
    this.saddlebagUI.onClose = () => {
      this.interactionSystem.isBlocked = false;
      this.canvas.requestPointerLock();
      this.player.camera.attachControl(this.canvas, true);
    };
    this.saddlebagUI.onRemoveItem = (itemId) => {
      const horse = this.horseSystem.currentHorse;
      if (!horse) return;
      const bag = this.horseSystem.getSaddlebag(horse.id);
      const entry = bag?.find(i => i.id === itemId);
      if (!entry) return;
      if (this.horseSystem.saddlebagRemoveItem(horse.id, itemId)) {
        this.inventorySystem.addItem({ ...entry, quantity: 1 });
        const updatedBag = this.horseSystem.getSaddlebag(horse.id) ?? [];
        this.saddlebagUI.refresh(
          updatedBag.map(i => ({ id: i.id, name: i.name, quantity: i.quantity, stackable: i.stackable })),
          updatedBag.length,
          horse.saddlebagCapacity,
        );
        this.saddlebagUI.showStatus(`Took ${entry.name}.`);
      }
    };

    this._wireOnboardingTutorialUi();

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

    // Crime encounter: present an interactive guard challenge modal.
    this.crimeSystem.onGuardChallenge = (guardNpc, factionId, bounty) => {
      this._activeGuardChallenge = { guard: guardNpc, factionId, bounty };
      const speechLevel = this.skillProgressionSystem.getSkill("speechcraft")?.level ?? 0;
      this.guardEncounterUI.open({
        guardName: guardNpc.mesh.name,
        factionId,
        bounty,
        playerGold: this._getInventoryGold(),
        canPersuade: this.persuasionSystem.canAttemptPersuasion(guardNpc.mesh.name, speechLevel),
      });
      this.interactionSystem.isBlocked = true;
      document.exitPointerLock();
      this.player.camera.detachControl();
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

    // Register merchants (dialogue `barter:open` uses payload.merchantId)
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
    this.barterSystem.registerMerchant({
      id: "merchant_general_01",
      name: "Village General Goods",
      factionId: "merchants_guild",
      inventory: [
        { id: "potion_hp_01", name: "Health Potion", description: "Restores 50 health.", stackable: true, quantity: 8, weight: 0.3, stats: { value: 25 } },
        { id: "arrow_bundle", name: "Arrows (20)", description: "A bundle of iron arrows.", stackable: true, quantity: 4, weight: 1, stats: { value: 15 } },
      ],
      gold: 450,
      priceMultiplier: 1.05,
      isOpen: true,
      openHour: 7,
      closeHour: 21,
    });
    this.barterSystem.registerMerchant({
      id: "merchant_weapons_01",
      name: "Roadside Arms",
      factionId: "merchants_guild",
      inventory: [
        { id: "iron_sword", name: "Iron Sword", description: "A basic iron sword.", stackable: false, quantity: 2, slot: "mainHand", weight: 3, stats: { damage: 10, value: 80 } },
        { id: "arrow_bundle", name: "Arrows (20)", description: "A bundle of iron arrows.", stackable: true, quantity: 6, weight: 1, stats: { value: 15 } },
      ],
      gold: 800,
      priceMultiplier: 1.15,
      isOpen: true,
      openHour: 8,
      closeHour: 19,
    });
    this.barterSystem.registerMerchant({
      id: "merchant_armor_01",
      name: "Shield & Hauberk",
      factionId: "merchants_guild",
      inventory: [
        { id: "leather_chest_01", name: "Leather Chest", description: "Light armor. +15 Armor Rating.", stackable: false, quantity: 1, slot: "chest", weight: 4, stats: { armor: 15, value: 55 } },
        { id: "iron_helm_01", name: "Iron Helm", description: "A sturdy iron helmet. +12 Armor Rating.", stackable: false, quantity: 2, slot: "head", weight: 2.5, stats: { armor: 12, value: 45 } },
      ],
      gold: 650,
      priceMultiplier: 1.12,
      isOpen: true,
      openHour: 8,
      closeHour: 19,
    });
    this.barterSystem.registerMerchant({
      id: "merchant_alchemist_01",
      name: "Stillwater Reagents",
      factionId: "mages_college",
      inventory: [
        { id: "potion_hp_01", name: "Health Potion", description: "Restores 50 health.", stackable: true, quantity: 12, weight: 0.3, stats: { value: 25 } },
      ],
      gold: 520,
      priceMultiplier: 1.2,
      isOpen: true,
      openHour: 9,
      closeHour: 18,
    });

    this._barterUI.onBuy = (itemId) => {
      const mid = this.barterSystem.activeMerchantId;
      if (!mid) return;
      this.barterSystem.buyItem(mid, itemId);
      this._barterUI.update(this.barterSystem, this.inventorySystem.items);
      this.saveSystem.markDirty();
    };
    this._barterUI.onSell = (itemId) => {
      const mid = this.barterSystem.activeMerchantId;
      if (!mid) return;
      this.barterSystem.sellItem(mid, itemId);
      this._barterUI.update(this.barterSystem, this.inventorySystem.items);
      this.saveSystem.markDirty();
    };
    this._barterUI.onClose = () => {
      this._barterUI.hide();
      this.barterSystem.closeBarter();
      this.interactionSystem.isBlocked = this.mapEditorSystem.isEnabled;
      if (this.mapEditorSystem.isEnabled || this.isPaused) return;
      this.canvas.requestPointerLock();
      this.player.camera.attachControl(this.canvas, true);
    };

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
    this.combatSystem.onPlayerHit = () => {
        this.audioSystem.playPlayerHit();
        // Small chance to contract a random disease on each hit (Oblivion-style).
        // ~5 % base chance per strike; resistance is factored inside contractDisease().
        if (Math.random() < 0.05) {
            const diseasePool = [
                "rust_chancre", "swamp_rot", "witbane",
                "collywobbles", "yellow_tick",
            ];
            const pick = diseasePool[Math.floor(Math.random() * diseasePool.length)];
            this.diseaseSystem.contractDisease(pick);
        }
    };
    this.combatSystem.onBlockSuccess = () => {
        this.skillProgressionSystem.gainXP("block", 5 * this.classSystem.xpMultiplierFor("block"));
    };
    this.interactionSystem.onLootPickup = (id) => {
        this.questSystem.onPickup(id);
        this._applyFrameworkQuestEvent("pickup", id);
        const frameworkItemId = this._toFrameworkInventoryItemId(id);
        if (frameworkItemId) this.frameworkRuntime.inventoryEngine.addItem(frameworkItemId, 1);
        if (this._onboardingTutorial.isActive && this._onboardingTutorial.currentStep?.id === "interact") {
          this._onboardingTutorial.advance();
        }
    };
    this.dialogueSystem.onTalkStart  = (name)  => {
        this.questSystem.onTalk(name);
        this._applyFrameworkQuestEvent("talk", this._toFrameworkTargetId(name));
        // Speechcraft XP each time dialogue is initiated
        this.skillProgressionSystem.gainXP("speechcraft", 8 * this.classSystem.xpMultiplierFor("speechcraft"));
        if (this._onboardingTutorial.isActive && this._onboardingTutorial.currentStep?.id === "interact") {
          this._onboardingTutorial.advance();
        }
    };
    this.dialogueSystem.onDialogueClosed = () => {
      this.barterSystem.playerGold = this._getInventoryGold();
      this._syncInventoryGoldToFramework();
      this._flushPendingBarter();
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
            if (kbInfo.event.key === " " || kbInfo.event.code === "Space") {
                const keyEv = kbInfo.event as KeyboardEvent;
                if (!keyEv.repeat && this._tryAdvanceOnboardingTutorial()) {
                    kbInfo.event.preventDefault();
                }
            } else if (kbInfo.event.key === "Escape") {
                if (this.dialogueSystem.isInDialogue) return;

                if (this.levelUpUI.isVisible) {
                    // Level-up is a mandatory choice — Escape is intentionally blocked.
                    return;
                } else if (this.guardEncounterUI.isVisible) {
                    this._resolveGuardEncounter("resist_arrest");
                } else if (this.mapEditorSystem.isEnabled) {
                    this.mapEditorSystem.toggle();
                    this.interactionSystem.isBlocked = false;
                    this.canvas.requestPointerLock();
                    this.player.camera.attachControl(this.canvas, true);
                    this.mapEditorToolbar.hide();
                    this.editorLayout.setVisible("hierarchy", false);
                    this.editorLayout.setVisible("palette", false);
                    this.editorLayout.setVisible("validation", false);
                    this.editorLayout.setVisible("layers", false);
                    this.editorLayout.setVisible("notes", false);
                    this.editorLayout.setVisible("properties", false);
                    this.editorLayout.clearSelection();
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
                } else if (this.spellMakingUI.isVisible) {
                    this.spellMakingUI.close();
                } else if (this._barterUI.isVisible) {
                    this._barterUI.onClose?.();
                } else if (this.fastTravelUI.isVisible) {
                    this.fastTravelUI.close();
                } else if (this.petUI.isVisible) {
                    this.petUI.close();
                    this.interactionSystem.isBlocked = false;
                    this.canvas.requestPointerLock();
                    this.player.camera.attachControl(this.canvas, true);
                } else if (this.stableUI.isVisible) {
                    this.stableUI.close();
                } else if (this.saddlebagUI.isVisible) {
                    this.saddlebagUI.close();
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
                } else if (this.spawnCreatorUI.isVisible) {
                    this.spawnCreatorUI.close();
                    this.canvas.requestPointerLock();
                    this.player.camera.attachControl(this.canvas, true);
                } else if (this.contentBundleUI.isVisible) {
                    this.contentBundleUI.close();
                    this.canvas.requestPointerLock();
                    this.player.camera.attachControl(this.canvas, true);
                } else if (this.assetBrowserUI.isVisible) {
                    this.assetBrowserUI.close();
                    this.canvas.requestPointerLock();
                    this.player.camera.attachControl(this.canvas, true);
                } else if (this.bundleMergeUI.isVisible) {
                    this.bundleMergeUI.close();
                    this.canvas.requestPointerLock();
                    this.player.camera.attachControl(this.canvas, true);
                } else if (this.modManifestUI.isVisible) {
                    this.modManifestUI.close();
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
                // Begin drawing bow (draw-time mechanic; arrow fires on key-up)
                if (!this._isCombatInputBlocked()) {
                    const drawing = this.projectileSystem.beginDraw();
                    if (drawing) {
                        // Push a noise spike for drawing the string
                        this.stealthSystem.pushNoise(0.4);
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
                    this.editorLayout.setVisible("hierarchy", true);
                    this.editorLayout.setVisible("palette", true);
                    this.editorLayout.setVisible("layers", true);
                    this._refreshEditorToolbar();
                    this.mapEditorHierarchyPanel.refresh(this.mapEditorSystem.listEntitySummaries());
                } else {
                    this.canvas.requestPointerLock();
                    this.player.camera.attachControl(this.canvas, true);
                    this.mapEditorToolbar.hide();
                    this.editorLayout.setVisible("hierarchy", false);
                    this.editorLayout.setVisible("palette", false);
                    this.editorLayout.setVisible("validation", false);
                    this.editorLayout.setVisible("layers", false);
                    this.editorLayout.setVisible("notes", false);
                    this.editorLayout.setVisible("properties", false);
                    this.editorLayout.clearSelection();
                }
                this.ui.showNotification(isEnabled ? "Map editor mode enabled" : "Map editor mode disabled", 1800);
                this._refreshHelpOverlayIfVisible();
            } else if (kbInfo.event.key === "f" || kbInfo.event.key === "F") {
                if (!this.mapEditorSystem.isEnabled) return;
                if (kbInfo.event.shiftKey) {
                    // Shift+F: Frame All
                    const summaries = this.mapEditorSystem.listEntitySummaries();
                    if (summaries.length === 0) { this.ui.showNotification("No entities to frame", 1000); return; }
                    let cx = 0, cy = 0, cz = 0;
                    for (const s of summaries) { cx += s.position.x; cy += s.position.y; cz += s.position.z; }
                    cx /= summaries.length; cy /= summaries.length; cz /= summaries.length;
                    this.player.camera.target.set(cx, cy, cz);
                    this.ui.showNotification(`Framed ${summaries.length} entities`, 1000);
                } else {
                    // F: Frame Selected
                    const selId = this.mapEditorSystem.selectedEntityId;
                    if (!selId) { this.ui.showNotification("No entity selected to frame", 1000); return; }
                    const pos = this.mapEditorSystem.getEntityPosition(selId);
                    if (pos) {
                        this.player.camera.target.set(pos.x, pos.y, pos.z);
                        this.ui.showNotification("Framed selected entity", 1000);
                    }
                }
            } else if (kbInfo.event.key === "l" || kbInfo.event.key === "L") {
                if (!this.mapEditorSystem.isEnabled) return;
                const layerVisible = this.editorLayout.getPanelState("layers")?.isVisible ?? false;
                if (layerVisible) {
                    this.editorLayout.setVisible("layers", false);
                } else {
                    this.editorLayout.setVisible("layers", true);
                    this.ui.showNotification("Layers panel opened", 1000);
                }
            } else if ((kbInfo.event.key === "M") && (kbInfo.event.ctrlKey || kbInfo.event.metaKey) && kbInfo.event.shiftKey) {
                // Ctrl+Shift+M — key is "M" (uppercase) because Shift is held; shiftKey guard
                // disambiguates from plain Ctrl+M (Scene Notes) which produces lowercase "m".
                // → Mod Manifest Editor (global)
                if (this.modManifestUI.isVisible) {
                    this.modManifestUI.close();
                } else {
                    this.interactionSystem.isBlocked = true;
                    document.exitPointerLock();
                    this.player.camera.detachControl();
                    this.modManifestUI.open();
                }
            } else if ((kbInfo.event.key === "m") && (kbInfo.event.ctrlKey || kbInfo.event.metaKey) && !kbInfo.event.shiftKey) {
                // Ctrl+M (lowercase "m", no Shift) → Scene Notes (editor mode only)
                if (!this.mapEditorSystem.isEnabled) return;
                const notesVisible = this.editorLayout.getPanelState("notes")?.isVisible ?? false;
                this.editorLayout.setVisible("notes", !notesVisible);
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
                    this._refreshLayerPanel();
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
                    this._refreshLayerPanel();
                }
            } else if (kbInfo.event.key === "F6") {
                if (kbInfo.event.shiftKey) {
                    // Shift+F6 → Asset Browser
                    if (this.assetBrowserUI.isVisible) {
                        this.assetBrowserUI.close();
                    } else {
                        this.assetBrowserUI.open();
                        this.interactionSystem.isBlocked = true;
                        document.exitPointerLock();
                        this.player.camera.detachControl();
                    }
                } else {
                    if (!this.mapEditorSystem.isEnabled) return;
                    this._triggerMapImport();
                }
            } else if (kbInfo.event.key === "F7") {
                if (kbInfo.event.shiftKey) {
                    // Shift+F7 → Content Bundle Dashboard
                    if (this.contentBundleUI.isVisible) {
                        this.contentBundleUI.close();
                    } else {
                        this.contentBundleSystem.attachMap(this.mapEditorSystem);
                        this.contentBundleUI.open();
                        this.interactionSystem.isBlocked = true;
                        document.exitPointerLock();
                        this.player.camera.detachControl();
                    }
                } else {
                    // F7 → Map validation panel (editor mode only)
                    if (!this.mapEditorSystem.isEnabled) return;
                    const validationVisible = this.editorLayout.getPanelState("validation")?.isVisible ?? false;
                    if (validationVisible) {
                        this.editorLayout.setVisible("validation", false);
                    } else {
                        const validation = this.mapEditorSystem.validateMap(0.5, {
                          knownLootTableIds: this.lootTableSystem.getTableIds(),
                        });
                        this.mapEditorValidationPanel.show(validation);
                        this.editorLayout.setVisible("validation", true);
                        if (!validation.isValid) {
                          console.warn("[MapEditorValidation]", validation.issues);
                        }
                    }
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
                if (kbInfo.event.shiftKey) {
                    // Shift+F11 → Spawn Creator
                    if (this.spawnCreatorUI.isVisible) {
                        this.spawnCreatorUI.close();
                    } else {
                        this.spawnCreatorUI.open();
                        this.interactionSystem.isBlocked = true;
                        document.exitPointerLock();
                        this.player.camera.detachControl();
                    }
                } else {
                    // F11 → Editor Hub
                    const isNowOpen = this.editorHubUI.toggle();
                    if (isNowOpen) {
                        this.interactionSystem.isBlocked = true;
                        document.exitPointerLock();
                        this.player.camera.detachControl();
                    } else {
                        this.interactionSystem.isBlocked = this.mapEditorSystem.isEnabled;
                    }
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
                this._refreshLayerPanel();
            } else if (kbInfo.event.key === "d" || kbInfo.event.key === "D") {
                if (!this.mapEditorSystem.isEnabled) return;
                const selId = this.mapEditorSystem.selectedEntityId;
                if (!selId) {
                    this.ui.showNotification("No entity selected to duplicate", 1400);
                    return;
                }
                const newMesh = this.mapEditorSystem.duplicateEntity(selId);
                if (newMesh) {
                    this.ui.showNotification("Entity duplicated", 1200);
                    this._refreshEditorToolbar();
                    this.mapEditorHierarchyPanel.refresh(this.mapEditorSystem.listEntitySummaries());
                    this._refreshLayerPanel();
                }
            } else if (kbInfo.event.key === "F5") {
                if (kbInfo.event.shiftKey) {
                    // Shift+F5 → Bundle Merge Assistant
                    if (this.bundleMergeUI.isVisible) {
                        this.bundleMergeUI.close();
                    } else {
                        this.bundleMergeUI.open();
                        this.interactionSystem.isBlocked = true;
                        document.exitPointerLock();
                        this.player.camera.detachControl();
                    }
                } else {
                    if (!this.isPaused) this.saveSystem.save();
                }
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
                if (!this._isCombatInputBlocked()) {
                    if (this.combatSystem.activeWeaponArchetype === "staff") {
                        // Staff archetype: begin charge attack instead of instant spell cast
                        this.combatSystem.beginStaffCharge();
                    } else {
                        // Default: cast equipped spell
                        this.spellSystem.castSpell();
                    }
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
                if (!this.isPaused && !this.dialogueSystem.isInDialogue) {
                    if (this.spellMakingUI.isVisible) {
                        this.spellMakingUI.close();
                    } else {
                        this.spellMakingUI.open();
                        this.interactionSystem.isBlocked = true;
                        document.exitPointerLock();
                        this.player.camera.detachControl();
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
            } else if (kbInfo.event.key === "p" || kbInfo.event.key === "P") {
                // P: Open/close companion panel
                if (!this.isPaused && !this.dialogueSystem.isInDialogue) {
                    if (this.petUI.isVisible) {
                        this.petUI.close();
                        this.interactionSystem.isBlocked = false;
                        this.canvas.requestPointerLock();
                        this.player.camera.attachControl(this.canvas, true);
                    } else {
                        if (!this.petSystem.hasPet) {
                            this.ui.showNotification("You have no companions yet.", 2000);
                        } else {
                            this.petUI.open(this.petSystem.pets, this.petSystem.activePet?.id ?? null);
                            this.interactionSystem.isBlocked = true;
                            document.exitPointerLock();
                            this.player.camera.detachControl();
                        }
                    }
                }
            } else if (kbInfo.event.key === "o" || kbInfo.event.key === "O") {
                // O: Mount/Dismount · Shift+O: Stable (unmounted) or Saddlebag (mounted)
                if (!this.isPaused && !this.dialogueSystem.isInDialogue) {
                    if (kbInfo.event.shiftKey) {
                        if (this.horseSystem.isMounted) {
                            // Shift+O while mounted — toggle saddlebag
                            const horse = this.horseSystem.currentHorse!;
                            if (this.saddlebagUI.isVisible) {
                                this.saddlebagUI.close();
                            } else {
                                const bag = this.horseSystem.getSaddlebag(horse.id) ?? [];
                                this.saddlebagUI.open(
                                    horse.name,
                                    bag.map(i => ({ id: i.id, name: i.name, quantity: i.quantity, stackable: i.stackable })),
                                    bag.length,
                                    horse.saddlebagCapacity,
                                );
                                this.interactionSystem.isBlocked = true;
                                document.exitPointerLock();
                                this.player.camera.detachControl();
                            }
                        } else {
                            // Shift+O while unmounted — toggle stable dialog
                            if (this.stableUI.isVisible) {
                                this.stableUI.close();
                            } else {
                                const stable = this.horseSystem.getStableNPC("Stable Master");
                                if (stable) {
                                    const horses = stable.availableHorseIds.map(id => {
                                        const h = this.horseSystem.getHorse(id)!;
                                        return {
                                            id: h.id,
                                            name: h.name,
                                            speed: h.speed,
                                            saddlebagCapacity: h.saddlebagCapacity,
                                            price: stable.prices[id] ?? 0,
                                            isOwned: h.isOwned,
                                        };
                                    });
                                    this.stableUI.open("Stable Master", horses, this._getInventoryGold());
                                    this.interactionSystem.isBlocked = true;
                                    document.exitPointerLock();
                                    this.player.camera.detachControl();
                                } else {
                                    this.ui.showNotification("No stable nearby.", 1500);
                                }
                            }
                        }
                    } else if (this.horseSystem.isMounted) {
                        // O while mounted — dismount
                        this.horseSystem.dismountHorse();
                    } else {
                        // O while unmounted — mount the first owned horse
                        const owned = this.horseSystem.ownedHorses;
                        if (owned.length === 0) {
                            this.ui.showNotification("You don't own a horse. Visit a stable (Shift+O).", 2500);
                        } else {
                            this.horseSystem.mountHorse(owned[0].id);
                        }
                    }
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
        } else if (kbInfo.type === KeyboardEventTypes.KEYUP) {
            // Release drawn arrow when the bow key is released
            if (kbInfo.event.key === "r" || kbInfo.event.key === "R") {
                if (this.projectileSystem.isDrawing) {
                    const fired = this.projectileSystem.releaseArrow();
                    if (fired) {
                        this.audioSystem.playMeleeAttack(); // reuse existing SFX placeholder
                        this.skillProgressionSystem.gainXP("marksman", 5 * this.classSystem.xpMultiplierFor("marksman"));
                    }
                }
            }
            // Release staff charge when Q is released
            if (kbInfo.event.key === "q" || kbInfo.event.key === "Q") {
                if (this.combatSystem.isChargingStaff) {
                    const fired = this.combatSystem.releaseStaffCharge();
                    if (fired) {
                        this.skillProgressionSystem.gainXP("destruction", 8 * this.classSystem.xpMultiplierFor("destruction"));
                    }
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

    persistSkipOnboardingTips(selection.skipGameplayTips);
    this._startOnboardingTutorialIfNeeded();

    this.ui.showNotification(`Welcome, ${this.player.name}! Character creation complete.`, 2800);
    this.interactionSystem.isBlocked = false;
    this.isPaused = false;
    this.canvas.requestPointerLock();
    this.player.camera.attachControl(this.canvas, true);

    // ── Workspace draft restore ───────────────────────────────────────────────
    if (this.workspaceDraftSystem.hasDraft()) {
      const result = this.workspaceDraftSystem.restore();
      if (result.restoredCount > 0) {
        const ts = result.savedAt ? new Date(result.savedAt).toLocaleTimeString() : "unknown";
        this.ui.showNotification(
          `Workspace draft restored (${result.restoredSystems.join(", ")}) — saved at ${ts}`,
          4000,
        );
      }
    }
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
    this._startOnboardingTutorialIfNeeded();
  }

  private _wireOnboardingTutorialUi(): void {
    this._onboardingTutorial.onStepBegin = (_index, step) => {
      this._showOnboardingTipBanner(step.message, step.advanceHint);
    };
    this._onboardingTutorial.onStepComplete = () => {
      /* next step's onStepBegin refreshes the banner */
    };
    this._onboardingTutorial.onTutorialComplete = () => {
      this._removeOnboardingTipBanner();
      persistOnboardingTipsCompleted();
      this.ui.showNotification("Tutorial tips dismissed. Press Esc for pause anytime.", 3200);
    };
    this._onboardingTutorial.onTutorialSkipped = () => {
      this._removeOnboardingTipBanner();
    };
  }

  private _showOnboardingTipBanner(message: string, advanceHint?: string): void {
    if (typeof document === "undefined") return;
    this._removeOnboardingTipBanner();
    const wrap = document.createElement("div");
    wrap.className = "onboarding-tip";
    wrap.setAttribute("role", "status");
    wrap.setAttribute("aria-live", "polite");
    const title = document.createElement("p");
    title.className = "onboarding-tip__title";
    title.textContent = "Getting started";
    const msg = document.createElement("p");
    msg.className = "onboarding-tip__msg";
    msg.textContent = message;
    wrap.appendChild(title);
    wrap.appendChild(msg);
    const hintText =
      advanceHint?.trim() ||
      "Press Space to continue when you are ready (or perform the highlighted action).";
    const hint = document.createElement("p");
    hint.className = "onboarding-tip__hint";
    hint.textContent = hintText;
    wrap.appendChild(hint);
    document.body.appendChild(wrap);
    this._onboardingTipEl = wrap;
  }

  private _removeOnboardingTipBanner(): void {
    if (this._onboardingTipEl?.parentNode) {
      this._onboardingTipEl.parentNode.removeChild(this._onboardingTipEl);
    }
    this._onboardingTipEl = null;
  }

  /** @returns true if Space was consumed to advance onboarding */
  private _tryAdvanceOnboardingTutorial(): boolean {
    if (!this._onboardingTutorial.isActive) return false;
    if (
      this.isPaused ||
      this.dialogueSystem.isInDialogue ||
      this.inventorySystem.isOpen ||
      this.questSystem.isLogOpen ||
      this.mapEditorSystem.isEnabled
    ) {
      return false;
    }
    this._onboardingTutorial.advance();
    return true;
  }

  private _startOnboardingTutorialIfNeeded(): void {
    if (typeof document === "undefined") return;
    if (shouldSkipOnboardingTips() || hasCompletedOnboardingTips()) return;

    this._onboardingTutorial.clearSteps();
    this._onboardingTutorial.addStep({
      id: "move",
      message: "Move with W A S D and look with the mouse. Click the game view if the cursor does not turn.",
      advanceHint: "Press Space when you have tried moving.",
    });
    this._onboardingTutorial.addStep({
      id: "inventory",
      message: "Press I to open your inventory. Equip gear from there when you find items in the world.",
      advanceHint: "Open inventory with I, or press Space to skip ahead.",
    });
    this._onboardingTutorial.addStep({
      id: "interact",
      message: "Face loot or a friendly NPC and press E to take items or start a conversation.",
      advanceHint: "Use E on something, or press Space to continue.",
    });
    this._onboardingTutorial.addStep({
      id: "quests",
      message: "Press J to open the quest log and track objectives.",
      advanceHint: "Open the log with J, or press Space to finish tips.",
    });

    this._onboardingTutorial.start();
  }

  private _setLight(): void {
    // The sky dome covers the entire background, so the clear colour is used
    // only for pixels not covered by any geometry.  Keep a deep sky-blue fallback
    // for the very first frame before the skybox is initialised.
    this.scene.clearColor = new Color4(0.28, 0.46, 0.74, 1.0);

    // Ambient hemisphere light — rich warm sunlit sky above, deep earthy tones below
    const hLight = new HemisphericLight("hLight", new Vector3(0, 1, 0), this.scene);
    hLight.intensity   = this.graphics.lighting.ambientBase;
    hLight.diffuse     = new Color3(0.92, 0.88, 0.72);
    hLight.groundColor = new Color3(0.18, 0.14, 0.08);
    hLight.specular    = new Color3(0.08, 0.07, 0.05);

    // Directional sun light — warm golden angle with deep shadow contrast
    const sun = new DirectionalLight("sun", new Vector3(-1.0, -2.5, -0.6).normalize(), this.scene);
    sun.intensity = this.graphics.lighting.sunBase;
    sun.diffuse   = new Color3(1.0, 0.92, 0.72);
    sun.specular  = new Color3(0.55, 0.48, 0.30);
    // Position the light far away so the shadow frustum covers the visible world.
    sun.position  = new Vector3(80, 120, 50);

    // Shadow generator — high-quality PCSS soft shadows cast by the directional sun
    const shadows = new ShadowGenerator(this.graphics.shadow.mapSize, sun);
    shadows.useBlurExponentialShadowMap = true;
    shadows.blurKernel = this.graphics.shadow.blurKernel;
    shadows.bias = 0.0005;
    this.shadowGenerator = shadows;

    // Atmospheric distance fog — initial values match WeatherSystem's "clear"
    // state so the first frame is consistent before WeatherSystem takes over.
    this.scene.fogMode    = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = this.graphics.fog.density;
    this.scene.fogColor   = new Color3(
      this.graphics.fog.color.r,
      this.graphics.fog.color.g,
      this.graphics.fog.color.b,
    );
  }

  /**
   * Initialise post-processing effects and the procedural sky dome.
   * Must be called after `Player` is created so its camera is available.
   */
  private _initPostProcessing(): void {
    // ── Procedural sky dome ──────────────────────────────────────────────────
    const skybox = MeshBuilder.CreateBox("skyBox", { size: 2000 }, this.scene);
    skybox.infiniteDistance = true;
    // Disable picking so raycasts pass through the sky dome and hit world geometry.
    skybox.isPickable = false;
    this.skyDome = skybox;

    const skyMat = new SkyMaterial("skyMat", this.scene);
    skyMat.backFaceCulling = false;
    // Atmospheric parameters — vivid clear-day atmosphere
    const sky = this.graphics.sky;
    skyMat.turbidity       = sky.turbidity;
    skyMat.luminance       = sky.luminance;
    skyMat.rayleigh        = sky.rayleigh;
    skyMat.mieCoefficient  = sky.mieCoefficient;
    skyMat.mieDirectionalG = sky.mieDirectionalG;
    skyMat.inclination     = sky.inclination;
    skyMat.azimuth         = sky.azimuth;
    skybox.material = skyMat;
    this.skyMaterial = skyMat;

    // ── DefaultRenderingPipeline ─────────────────────────────────────────────
    // Skip on WebGPU to avoid driver-level incompatibilities at startup.
    if (this.engine.name !== "WebGPU") {
      const pp = this.graphics.postProcess;
      const pipeline = new DefaultRenderingPipeline(
        "defaultPipeline",
        true,              // HDR
        this.scene,
        [this.player.camera],
      );

      // Bloom — cinematic glow on bright surfaces (sun highlights, emissive torches)
      pipeline.bloomEnabled   = pp.bloom.enabled;
      pipeline.bloomThreshold = pp.bloom.threshold;
      pipeline.bloomWeight    = pp.bloom.weight;
      pipeline.bloomKernel    = pp.bloom.kernel;
      pipeline.bloomScale     = pp.bloom.scale;

      // FXAA — smooth jagged edges
      pipeline.fxaaEnabled = pp.fxaa;

      // Sharpen — recover crisp detail that FXAA softens
      pipeline.sharpenEnabled = true;
      pipeline.sharpen.edgeAmount = pp.sharpenEdgeAmount;

      // Depth of field — subtle focus falloff for cinematic depth
      pipeline.depthOfFieldEnabled = false; // disabled by default; enable per-scene as needed

      // Image processing — ACES filmic tone mapping + colour grading
      pipeline.imageProcessingEnabled = true;
      pipeline.imageProcessing.toneMappingEnabled = pp.toneMappingType !== "none";
      pipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
      pipeline.imageProcessing.exposure  = pp.exposure;
      pipeline.imageProcessing.contrast  = pp.contrast;
      pipeline.imageProcessing.vignetteEnabled = true;
      pipeline.imageProcessing.vignetteWeight  = pp.vignetteWeight;
      pipeline.imageProcessing.vignetteBlendMode = ImageProcessingConfiguration.VIGNETTEMODE_MULTIPLY;
      pipeline.imageProcessing.colorCurvesEnabled = true;

      this.renderingPipeline = pipeline;
    }
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
      const archetypes = this.frameworkRuntime.contentRegistry.getAllNpcArchetypes();
      const dialogueId = resolveDialogueIdForNpcMeshName(npcName, archetypes);
      if (!dialogueId) return null;
      if (!this.frameworkRuntime.dialogueEngine.hasDialogue(dialogueId)) {
          if (import.meta.env.DEV) {
              console.warn(`[Game] No registered dialogue '${dialogueId}' for NPC mesh '${npcName}'.`);
          }
          return null;
      }
      try {
          return this.frameworkRuntime.createDialogueSession(dialogueId);
      } catch (err) {
          if (import.meta.env.DEV) {
              console.warn(`[Game] createDialogueSession('${dialogueId}') failed for '${npcName}'.`, err);
          }
          return null;
      }
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

      // DailyScheduleSystem syncs ScheduleSystem.currentHour automatically via
      // TimeSystem.onHourChange — no manual per-frame assignment needed here.

      this.scheduleSystem.update(deltaTime);
      this.combatSystem.updateNPCAI(deltaTime);

      // Drive procedural animations from current NPC AI state
      for (const npc of this.scheduleSystem.npcs) {
        const hitReact = npc.justTakenDamageVisual;
        if (hitReact) {
          npc.justTakenDamageVisual = false;
        }
        this.animationSystem.updateNPCAnimation(
          npc.mesh,
          npc.aiState,
          npc.isAttackTelegraphing,
          npc.isStaggered,
          npc.isDead,
          hitReact,
        );
      }

      // Update active companion AI + mood
      this._updatePetAI(deltaTime);

      this.interactionSystem.update();

      this.stealthSystem.shadowFactor = this.timeSystem.ambientIntensity;
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

      // v20 swimming — drain breath / apply drowning damage while submerged
      this.swimSystem.update(deltaTime, this.player);

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
      const cx = Math.floor(this.player.camera.position.x / this.world.chunkSize);
      const cz = Math.floor(this.player.camera.position.z / this.world.chunkSize);
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

      // Pet HUD — update when active pet or health changes
      {
        const ap = this.petSystem?.activePet ?? null;
        const apId = ap?.id ?? null;
        if (apId !== this._lastPetId || (ap && ap.health !== this._lastPetHealth)) {
          this._lastPetId     = apId;
          this._lastPetHealth = ap?.health ?? -1;
          this.petUI?.updateHUD(ap);
        }
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

  private _onCellEntered(cellId: string, cellName: string): void {
      const isNew = this.fastTravelSystem.discoverLocation(
          cellId, cellName, this.player.camera.position.clone()
      );
      this.ui.showNotification(
          isNew ? `Discovered: ${cellName}` : `Entered: ${cellName}`, 2500
      );
      this.lodSystem?.clear();
  }

  private _beginPortalTransition(portalId: string): void {
      if (!this.cellManager.portals.has(portalId)) return;
      if (this.ui.isScreenFadeActive) return;
      this.ui.playScreenFadeSequence({
          fadeOutMs: 420,
          holdMs: 140,
          fadeInMs: 480,
          onBlack: () => {
              this.cellManager.tryTransition(portalId);
          },
      });
  }

  /** Rebuild interior geometry after load so cell save state matches the scene. */
  private _hydrateCellAfterLoad(): void {
      this.cellManager.hydrateActiveCellFromState();
      const cell = this.cellManager.currentCell;
      if (cell) {
          this.fastTravelSystem.discoverLocation(
              cell.id, cell.name, this.player.camera.position.clone()
          );
      }
  }

  private _attemptFastTravel(locationId: string): void {
      const hours = this.fastTravelSystem.estimateTravelHours(this.player.camera.position, locationId);
      if (hours === null) {
          this.ui.showNotification("Unknown destination.", 2000);
          return;
      }

      if (this._isPlayerInCombat()) {
          this.ui.showNotification("Cannot fast travel while in combat.", 2200);
          return;
      }
      if (this.stealthSystem.isCrouching) {
          this.ui.showNotification("Cannot fast travel while sneaking.", 2200);
          return;
      }

      const loc = this.fastTravelSystem.getDiscoveredLocation(locationId);
      if (!loc) {
          this.ui.showNotification(`Location "${locationId}" has not been discovered.`, 2200);
          return;
      }

      const cellDef = this.cellManager.getCellDefinition(locationId);
      const targetIsInterior = cellDef?.type === "interior";
      const needsFade = targetIsInterior || this.cellManager.isInterior;
      const dest = new Vector3(loc.position.x, loc.position.y, loc.position.z);
      const message = `Fast travelled to ${loc.name}.`;

      const applyTimeAndClose = () => {
          this.timeSystem.advanceHours(hours);
          this.respawnSystem.update(this.timeSystem.gameTime);
          this.merchantRestockSystem.update(this.timeSystem.gameTime, this.barterSystem);
          this.ui.showNotification(
              `${message} (${hours.toFixed(1)}h passed) — ${this.timeSystem.timeString}`,
              3200,
          );
          this.fastTravelUI.close();
          this.saveSystem.markDirty();
      };

      if (needsFade) {
          this.ui.playScreenFadeSequence({
              fadeOutMs: 400,
              holdMs: 120,
              fadeInMs: 450,
              onBlack: () => {
                  if (targetIsInterior) {
                      this.cellManager.enterCellById(locationId, dest, true);
                  } else {
                      this.cellManager.enterCellById("exterior", dest, true);
                  }
              },
              onComplete: () => {
                  this.fastTravelSystem.discoverLocation(
                      targetIsInterior ? locationId : (this.cellManager.currentCell?.id ?? "exterior"),
                      targetIsInterior ? loc.name : (this.cellManager.currentCell?.name ?? "Exterior World"),
                      this.player.camera.position.clone(),
                  );
                  this.lodSystem?.clear();
                  applyTimeAndClose();
              },
          });
      } else {
          this.player.camera.position.copyFrom(dest);
          this.lodSystem?.clear();
          applyTimeAndClose();
      }
  }

  private _getInventoryGold(): number {
      const goldEntry = this.inventorySystem.items.find((item) => item.id === GOLD_ITEM_ID);
      return goldEntry?.quantity ?? 0;
  }

  /** Sync framework engine gold count from the live inventory (for dialogue conditions). */
  private _syncInventoryGoldToFramework(): void {
      const qty = this._getInventoryGold();
      const eng = this.frameworkRuntime.inventoryEngine;
      const cur = eng.getItemCount("gold_coins");
      if (cur === qty) return;
      if (cur > qty) {
        eng.removeItem("gold_coins", cur - qty);
      } else {
        eng.addItem("gold_coins", qty - cur);
      }
  }

  /** Keep the gold stack aligned with BarterSystem's running total after trades. */
  private _mirrorBarterGoldToInventory(): void {
      const target = Math.max(0, Math.floor(this.barterSystem.playerGold));
      const current = this._getInventoryGold();
      if (current === target) return;
      if (current > target) {
        this.inventorySystem.removeItem(GOLD_ITEM_ID, current - target);
      } else {
        this.inventorySystem.addItem({
          id: GOLD_ITEM_ID,
          name: "Gold Coins",
          description: "Currency for trade and fines.",
          stackable: true,
          quantity: target - current,
          weight: 0.1,
          stats: { value: 1 },
        });
      }
  }

  private _dialogueInventoryCountForFramework(itemId: string): number {
      if (itemId === "gold_coins") return this._getInventoryGold();
      const gameId = FRAMEWORK_ITEM_TO_GAME[itemId] ?? itemId;
      return this.inventorySystem.items.find((i) => i.id === gameId)?.quantity ?? 0;
  }

  private _dialogueConsumeInventoryItem(itemId: string, quantity: number): boolean {
      if (itemId === "gold_coins") {
        return this._consumeInventoryGold(quantity);
      }
      const gameId = FRAMEWORK_ITEM_TO_GAME[itemId] ?? itemId;
      return this.inventorySystem.removeItem(gameId, quantity);
  }

  private _giveDialogueItemToPlayer(itemId: string, quantity: number): void {
      const def = this.frameworkRuntime.contentRegistry.getItemDefinition(itemId);
      if (!def) return;
      const gameId = FRAMEWORK_ITEM_TO_GAME[itemId] ?? itemId;
      const existing = this.inventorySystem.items.find((i) => i.id === gameId);
      if (existing) {
        this.inventorySystem.addItem({ ...existing, quantity });
        return;
      }
      const item: Item = {
        id: gameId,
        name: def.name,
        description: def.description,
        stackable: def.stackable,
        quantity,
        weight: 0.3,
        stats: { value: 10 },
      };
      if (def.slot) item.slot = def.slot;
      this.inventorySystem.addItem(item);
  }

  private _handleDialogueHostEvent(eventId: string, payload?: Record<string, unknown>): void {
      if (eventId === "barter:open") {
        const merchantId = typeof payload?.merchantId === "string" ? payload.merchantId : "merchant_01";
        this._pendingBarterMerchantId = merchantId;
        return;
      }
      if (eventId === "rest:inn") {
        const hoursRaw = payload?.hours;
        const hours = typeof hoursRaw === "number" && Number.isFinite(hoursRaw)
          ? Math.round(hoursRaw)
          : 8;
        const result = this.waitSystem.rest(hours, this.timeSystem, this.player);
        if (result.ok) {
          this.ui.showNotification(`You slept soundly. ${result.message}`, 3200);
          this.skillProgressionSystem.gainXP("speechcraft", 6 * this.classSystem.xpMultiplierFor("speechcraft"));
          this.saveSystem.markDirty();
        }
      }
  }

  private _flushPendingBarter(): void {
      const merchantId = this._pendingBarterMerchantId;
      this._pendingBarterMerchantId = null;
      if (!merchantId) return;

      const hour = this.timeSystem.hour;
      if (!this.barterSystem.openBarter(merchantId, hour)) {
        return;
      }

      this.barterSystem.playerGold = this._getInventoryGold();
      this._barterUI.show();
      this._barterUI.update(this.barterSystem, this.inventorySystem.items);
      this.interactionSystem.isBlocked = true;
      document.exitPointerLock();
      this.player.camera.detachControl();
  }

  private _consumeInventoryGold(amount: number): boolean {
      if (amount <= 0) return true;
      const available = this._getInventoryGold();
      if (available < amount) return false;
      return this.inventorySystem.removeItem(GOLD_ITEM_ID, amount);
  }

  private _refreshGuardEncounterView(statusMessage?: string, isError: boolean = false): void {
      const challenge = this._activeGuardChallenge;
      if (!challenge) return;
      const speechLevel = this.skillProgressionSystem.getSkill("speechcraft")?.level ?? 0;
      this.guardEncounterUI.open({
          guardName: challenge.guard.mesh.name,
          factionId: challenge.factionId,
          bounty: challenge.bounty,
          playerGold: this._getInventoryGold(),
          canPersuade: this.persuasionSystem.canAttemptPersuasion(challenge.guard.mesh.name, speechLevel),
      });
      if (statusMessage) this.guardEncounterUI.showStatus(statusMessage, isError);
  }

  private _closeGuardEncounter(): void {
      this.guardEncounterUI.close();
      this._activeGuardChallenge = null;
      this.interactionSystem.isBlocked = this.mapEditorSystem.isEnabled;
      if (this.mapEditorSystem.isEnabled || this.isPaused) return;
      this.canvas.requestPointerLock();
      this.player.camera.attachControl(this.canvas, true);
  }

  private _engageGuardCombat(guard: NPC): void {
      guard.isAggressive = true;
      guard.aiState = AIState.CHASE;
      guard.lastKnownPlayerPos = this.player.camera.position.clone();
      this.ui.showNotification(`${guard.mesh.name} attacks!`, 2500);
  }

  private _resolveGuardEncounter(action: GuardEncounterAction): void {
      const challenge = this._activeGuardChallenge;
      if (!challenge) return;

      const speechLevel = this.skillProgressionSystem.getSkill("speechcraft")?.level ?? 0;
      const speechMultiplier = this.classSystem.xpMultiplierFor("speechcraft");

      switch (action) {
          case "pay_fine": {
              const playerGold = this._getInventoryGold();
              const paid = this.crimeSystem.payBounty(challenge.factionId, playerGold);
              if (paid <= 0 || !this._consumeInventoryGold(paid)) {
                  this._refreshGuardEncounterView("You do not have enough gold to pay the fine.", true);
                  return;
              }
              this.ui.showNotification(`Fine paid (${paid}g). You are free to go.`, 2500);
              this.skillProgressionSystem.gainXP("speechcraft", 4 * speechMultiplier);
              this.saveSystem.markDirty();
              this._closeGuardEncounter();
              return;
          }
          case "go_to_jail": {
              const result = this.jailSystem.serveJailTime(
                  challenge.bounty,
                  challenge.factionId,
                  this.timeSystem,
                  this.skillProgressionSystem,
                  this.crimeSystem,
                  this.timeSystem.gameTime,
              );
              this.fameSystem.addInfamy(Math.ceil(challenge.bounty / 12));
              this.ui.showNotification(result.message, 4200);
              this.saveSystem.markDirty();
              this._closeGuardEncounter();
              return;
          }
          case "resist_arrest": {
              const surcharge = Math.max(10, Math.ceil(challenge.bounty * 0.25));
              challenge.bounty = this.crimeSystem.adjustBounty(challenge.factionId, surcharge);
              this.fameSystem.addInfamy(Math.ceil(surcharge / 5));
              this._engageGuardCombat(challenge.guard);
              this.saveSystem.markDirty();
              this._closeGuardEncounter();
              return;
          }
          case "persuade": {
              if (!this.persuasionSystem.canAttemptPersuasion(challenge.guard.mesh.name, speechLevel)) {
                  this._refreshGuardEncounterView("Your Speechcraft is too low to attempt persuasion.", true);
                  return;
              }

              const oldDisposition = this.persuasionSystem.getDisposition(challenge.guard.mesh.name);
              const persuasionAction = challenge.bounty >= 300 ? "coerce" : "boast";
              const result = this.persuasionSystem.attemptPersuasionAction(
                  challenge.guard.mesh.name,
                  speechLevel,
                  persuasionAction,
              );
              this.eventBus.emit("disposition:changed", {
                  npcId: challenge.guard.mesh.name,
                  oldValue: oldDisposition,
                  newValue: result.newDisposition,
              });

              if (result.outcome === "critical_success") {
                  this.crimeSystem.clearBounty(challenge.factionId);
                  this.fameSystem.addFame(2);
                  this.skillProgressionSystem.gainXP("speechcraft", 18 * speechMultiplier);
                  this.ui.showNotification(`${challenge.guard.mesh.name} withdraws the charges.`, 2800);
                  this.saveSystem.markDirty();
                  this._closeGuardEncounter();
                  return;
              }

              if (result.outcome === "success") {
                  challenge.bounty = this.crimeSystem.setBounty(challenge.factionId, Math.floor(challenge.bounty * 0.5));
                  this.skillProgressionSystem.gainXP("speechcraft", 12 * speechMultiplier);
                  if (challenge.bounty <= 0) {
                      this.ui.showNotification("Persuasion successful. Your bounty has been cleared.", 2800);
                      this.saveSystem.markDirty();
                      this._closeGuardEncounter();
                  } else {
                      this._refreshGuardEncounterView(`Persuasion worked. Reduced bounty to ${challenge.bounty}g.`);
                      this.saveSystem.markDirty();
                  }
                  return;
              }

              if (result.outcome === "critical_failure") {
                  const surcharge = Math.max(20, Math.ceil(challenge.bounty * 0.3));
                  challenge.bounty = this.crimeSystem.adjustBounty(challenge.factionId, surcharge);
                  this.fameSystem.addInfamy(3);
                  this.skillProgressionSystem.gainXP("speechcraft", 3 * speechMultiplier);
                  this.ui.showNotification("Persuasion backfired!", 2200);
                  this._engageGuardCombat(challenge.guard);
                  this.saveSystem.markDirty();
                  this._closeGuardEncounter();
                  return;
              }

              // Normal failure
              const surcharge = Math.max(5, Math.ceil(challenge.bounty * 0.1));
              challenge.bounty = this.crimeSystem.adjustBounty(challenge.factionId, surcharge);
              this.skillProgressionSystem.gainXP("speechcraft", 5 * speechMultiplier);
              this._refreshGuardEncounterView(`Persuasion failed. Bounty increased to ${challenge.bounty}g.`, true);
              this.saveSystem.markDirty();
              return;
          }
      }
  }

  private _isCombatInputBlocked(): boolean {
      return (
          this.isPaused ||
          this.mapEditorSystem.isEnabled ||
          this.inventorySystem.isOpen ||
          this.questSystem.isLogOpen ||
          this.skillTreeSystem.isOpen ||
          this.levelUpUI.isVisible ||
          this.guardEncounterUI.isVisible ||
          this.spellMakingUI.isVisible ||
          this._barterUI.isVisible ||
          this.fastTravelUI.isVisible ||
          this.stableUI.isVisible ||
          this.saddlebagUI.isVisible ||
          this.petUI.isVisible ||
          this.dialogueSystem.isInDialogue ||
          this.interactionSystem.isBlocked
      );
  }

  // ── Pet world management ───────────────────────────────────────────────────

  /**
   * Create a capsule mesh + physics body for the given pet near the player.
   * Called via petSystem.onPetSummoned.
   */
  private _spawnPetMesh(pet: Pet): void {
    this._despawnPetMesh();

    const spawnPos = this.player.camera.position.clone();
    spawnPos.y = Math.max(1.5, spawnPos.y - 0.5);
    spawnPos.x += 2; // offset so it doesn't spawn inside the player

    const s     = pet.meshScale;
    const meshName = `pet_${pet.id}`;

    const mesh = MeshBuilder.CreateCapsule(
      meshName,
      { radius: 0.5 * s, height: 2 * s },
      this.scene,
    );
    mesh.position = spawnPos.clone();

    const mat = new StandardMaterial(`${meshName}_mat`, this.scene);
    mat.diffuseColor  = new Color3(pet.meshColor.r, pet.meshColor.g, pet.meshColor.b);
    mat.specularColor = new Color3(0.1, 0.08, 0.06);
    mat.specularPower = 18;
    mesh.material = mat;
    mesh.receiveShadows = true;

    this._petPhysicsAggregate = new PhysicsAggregate(
      mesh,
      PhysicsShapeType.CAPSULE,
      { mass: 0.5, restitution: 0 },
      this.scene,
    );
    this._petPhysicsAggregate.body.setMotionType(PhysicsMotionType.DYNAMIC);
    // Lock rotation axes so the capsule stays upright
    this._petPhysicsAggregate.body.setMassProperties({ inertia: new Vector3(0, 0, 0) });

    this._petMesh        = mesh;
    this._petAttackTimer = 0;

    this.animationSystem.playIdle(mesh);
  }

  /** Remove the pet mesh and physics body from the scene immediately. */
  private _despawnPetMesh(): void {
    if (!this._petMesh) return;
    this.animationSystem.unregisterMesh(this._petMesh.name);
    this._petPhysicsAggregate?.dispose();
    this._petMesh.dispose();
    this._petMesh              = null;
    this._petPhysicsAggregate  = null;
  }

  // ── Pet AI update ──────────────────────────────────────────────────────────

  private static readonly _PET_ATTACK_COOLDOWN = 2.0;

  /** Follow-player + attack-enemy AI for the active companion. */
  private _updatePetAI(deltaTime: number): void {
    const pet = this.petSystem?.activePet;
    if (!pet || !this._petMesh || !this._petPhysicsAggregate?.body) return;

    this.petSystem.updateMood(deltaTime);

    const petPos   = this._petMesh.position;
    const playerPos = this.player.camera.position;
    const body     = this._petPhysicsAggregate.body;

    // ── Follow player ─────────────────────────────────────────────────────────
    const dx      = playerPos.x - petPos.x;
    const dz      = playerPos.z - petPos.z;
    const distSq  = dx * dx + dz * dz;
    const follow  = pet.followDistance + 0.8;

    const curVel  = new Vector3();
    body.getLinearVelocityToRef(curVel);

    if (distSq > follow * follow) {
      const dist  = Math.sqrt(distSq);
      const speed = dist > pet.followDistance + 5 ? pet.moveSpeed : pet.moveSpeed * 0.65;
      const nx    = (dx / dist) * speed;
      const nz    = (dz / dist) * speed;
      const blend = Math.min(1, 8 * deltaTime);

      body.setLinearVelocity(new Vector3(
        curVel.x + (nx - curVel.x) * blend,
        curVel.y,
        curVel.z + (nz - curVel.z) * blend,
      ));

      // Face movement direction
      this._petMesh.lookAt(new Vector3(petPos.x + nx, petPos.y, petPos.z + nz));

      if (dist > pet.followDistance + 5) {
        this.animationSystem.playRun(this._petMesh);
      } else {
        this.animationSystem.playWalk(this._petMesh);
      }
    } else {
      body.setLinearVelocity(new Vector3(0, curVel.y, 0));
      this.animationSystem.playIdle(this._petMesh);
    }

    // ── Attack nearby hostile NPCs ─────────────────────────────────────────────
    this._petAttackTimer -= deltaTime;
    if (this._petAttackTimer > 0) return;

    let closestNpc: NPC | null = null;
    let closestDistSq = pet.attackRange * pet.attackRange;

    for (const npc of this.scheduleSystem.npcs) {
      if (npc.isDead) continue;
      if (npc.aiState !== AIState.CHASE && npc.aiState !== AIState.ATTACK && !npc.isAggressive) continue;
      const ex = npc.mesh.position.x - petPos.x;
      const ez = npc.mesh.position.z - petPos.z;
      const dSq = ex * ex + ez * ez;
      if (dSq < closestDistSq) {
        closestDistSq = dSq;
        closestNpc    = npc;
      }
    }

    if (closestNpc) {
      const damage   = this.petSystem.getEffectiveAttackDamage();
      closestNpc.takeDamage(damage);
      const levelled = this.petSystem.petGainXP(5);
      if (levelled) {
        this.petUI.refresh(this.petSystem.pets, this.petSystem.activePet?.id ?? null);
      }
      this._petAttackTimer = Game._PET_ATTACK_COOLDOWN;
    } else {
      this._petAttackTimer = 0.4; // re-poll soon if no target found
    }
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
