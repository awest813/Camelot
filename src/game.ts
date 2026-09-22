import { Scene } from "@babylonjs/core/scene";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
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
import { BabylonInputAdapter } from "./adapters/babylon/babylon-input-adapter";
import { GamepadInputSystem } from "./systems/gamepad-input-system";
import { InventorySystem } from "./systems/inventory-system";
import type { WeaponArchetype } from "./systems/combat-shared";
import { applyDamageWithResistance } from "./systems/combat-shared";
import type { DamageType } from "./entities/npc";
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
import { ShopSystem, type ShopDef } from "./systems/shop-system";
import { CellManager } from "./world/cell-manager";
import { SpellSystem } from "./systems/spell-system";
import { PersuasionSystem } from "./systems/persuasion-system";
import { GameEventBus } from "./systems/event-bus";
import { LootTableSystem, STARTER_LOOT_TABLES } from "./systems/loot-table-system";
import { NpcArchetypeSystem } from "./systems/npc-archetype-system";
import { NpcScheduleSystem, SCHED_GUARD } from "./systems/npc-schedule-system";
import { FixedStepLoop } from "./systems/fixed-step-loop";
import { AlchemySystem } from "./systems/alchemy-system";
import { AlchemyUI } from "./ui/alchemy-ui";
import { EnchantingSystem } from "./systems/enchanting-system";
import { EnchantingUI } from "./ui/enchanting-ui";
import { LodSystem } from "./systems/lod-system";
import { WeatherSystem } from "./systems/weather-system";
import { GraphicsSystem, persistGraphicsTier } from "./systems/graphics-system";
import { QuickSlotSystem, isConsumableItem, type QuickSlotKey } from "./systems/quickslot-system";
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
import { CharacterSheetUI } from "./ui/character-sheet-ui";
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
import { WorldBuilderSystem } from "./systems/world-builder-system";
import { WorldBuilderUI } from "./ui/world-builder-ui";
import { DungeonGenerator } from "./world/dungeon-generator";
import { ContentBundleSystem } from "./systems/content-bundle-system";
import { ContentBundleUI } from "./ui/content-bundle-ui";
import { EditorHubUI, type EditorToolId } from "./ui/editor-hub-ui";
import { EditorLayout } from "./ui/editor-layout";
import { buildHelpOverlayLines, summarizeValidationReport } from "./ui/editor-help-overlay";
import { FastTravelUI, type FastTravelOptionView } from "./ui/fast-travel-ui";
import { SpellMakingUI } from "./ui/spell-making-ui";
import { GuardEncounterUI, type GuardEncounterAction } from "./ui/guard-encounter-ui";
import { LevelUpUI } from "./ui/level-up-ui";
import { StableUI } from "./ui/stable-ui";
import { SaddlebagUI } from "./ui/saddlebag-ui";
import { DailyScheduleSystem } from "./systems/daily-schedule-system";
import { HorseSystem } from "./systems/horse-system";
import { SwimmingSystem } from "./systems/swimming-system";
import { DiseaseSystem } from "./systems/disease-system";
import { SurvivalSystem } from "./systems/survival-system";
import { TravelEventSystem, type TravelContext } from "./systems/travel-event-system";
import { AmbientEventSystem } from "./systems/ambient-event-system";
import { LeveledListSystem, ALL_BUILT_IN_LEVELED_LISTS } from "./systems/leveled-list-system";
import { EventManagerSystem } from "./systems/event-manager-system";
import { AnimationSystem } from "./systems/animation-system";
import { FantasyAssetLoader } from "./systems/fantasy-asset-loader";
import { PetSystem } from "./systems/pet-system";
import type { Pet } from "./systems/pet-system";
import { PetUI } from "./ui/pet-ui";
import { PickpocketSystem } from "./systems/pickpocket-system";
import type { PickpocketableItem } from "./systems/pickpocket-system";
import { PickpocketUI } from "./ui/pickpocket-ui";
import { AssetBrowserSystem } from "./systems/asset-browser-system";
import { AssetBrowserUI } from "./ui/asset-browser-ui";
import { BundleMergeSystem } from "./systems/bundle-merge-system";
import { BundleMergeUI } from "./ui/bundle-merge-ui";
import { WorkspaceDraftSystem } from "./systems/workspace-draft-system";
import { ModManifestSystem } from "./systems/mod-manifest-system";
import { ModManifestUI } from "./ui/mod-manifest-ui";
import { BarterUI } from "./ui/barter-ui";
import { ContainerUI } from "./ui/container-ui";
import type { Item } from "./systems/inventory-system";
import { ScreenshotSystem } from "./systems/screenshot-system";
import { UIAnimator } from "./ui/ui-animator";
import { MarkRecallSystem } from "./systems/mark-recall-system";
import { TrainerSystem } from "./systems/trainer-system";
import { FollowerSystem } from "./systems/follower-system";
import type { ActiveFollowerState } from "./systems/follower-system";
import { FollowerUI } from "./ui/follower-ui";
import { ActiveEffectHUD } from "./ui/active-effect-hud";
import { QuickSlotHUD } from "./ui/quickslot-hud";
import { PerkSystem } from "./systems/perk-system";
import { DynamicWorldEventSystem } from "./systems/dynamic-world-event-system";
import type { DynamicEventReward } from "./systems/dynamic-world-event-system";
import { DragonShoutSystem, type ShoutTierEffect } from "./systems/dragon-shout-system";
import { ShoutUI, type ShoutView } from "./ui/shout-ui";
import { GraphicsSettingsUI, type CameraSensitivity } from "./ui/graphics-settings-ui";

/** XP awarded to the Sneak skill for each second of active sneaking. */
const SNEAK_XP_PER_SECOND = 2;
/** Pseudo fast-travel destination that triggers Mark & Recall teleportation. */
const MARK_RECALL_TRAVEL_ID = "__recall";
/** Squared distance beyond which NPC procedural animation updates are skipped. */
const NPC_ANIMATION_FAR_DISTANCE_SQ = 100 * 100;
/** Inventory item ID used for player gold (bounty payment check). */
const GOLD_ITEM_ID = "gold_coins";
/** Map framework bundle item ids to Babylon inventory ids when they differ. */
const FRAMEWORK_ITEM_TO_GAME: Readonly<Record<string, string>> = {
  health_potion: "potion_hp_01",
  iron_sword: "sword_01",
};
/**
 * Asset Browser type → hub tool for the "Insert" action (opens the asset's
 * authoring tool through the same dispatch as the Editor Hub).
 */
const ASSET_TYPE_TO_EDITOR_TOOL: Readonly<Record<string, EditorToolId>> = {
  item: "item",
  npc: "npc",
  quest: "quest",
  dialogue: "dialogue",
  faction: "faction",
  lootTable: "lootTable",
  spawn: "spawn",
  map: "map",
};

/**
 * Item templates for leveled-list drops (LeveledListSystem values).
 * Stats scale with tier so boss loot stays relevant to the player's level.
 */
const LEVEL_ITEM_TEMPLATES: Readonly<Record<string, {
  name: string; description: string; weight: number; slot: string; stats: Record<string, number>;
}>> = {
  iron_sword:      { name: "Iron Sword",      description: "A dependable blade.",            weight: 3.5, slot: "mainHand", stats: { damage: 10, value: 80 } },
  steel_sword:     { name: "Steel Sword",     description: "Forged with superior steel.",    weight: 4.0, slot: "mainHand", stats: { damage: 16, value: 220 } },
  silver_sword:    { name: "Silver Sword",    description: "Blessed silver etched with runes.", weight: 4.0, slot: "mainHand", stats: { damage: 22, value: 500 } },
  daedric_sword:   { name: "Daedric Sword",   description: "A blade of blackened obsidian.", weight: 5.0, slot: "mainHand", stats: { damage: 30, value: 1500 } },
  iron_bow:        { name: "Iron Bow",        description: "A sturdy shortbow.",             weight: 2.5, slot: "mainHand", stats: { damage: 8, value: 100 } },
  steel_bow:       { name: "Steel Bow",       description: "A recurve bow with steel limbs.", weight: 3.0, slot: "mainHand", stats: { damage: 13, value: 280 } },
  elven_bow:       { name: "Elven Bow",       description: "A lightweight bow of moon-metal.", weight: 2.0, slot: "mainHand", stats: { damage: 18, value: 700 } },
  iron_cuirass:    { name: "Iron Cuirass",    description: "Heavy plated protection.",       weight: 8.0, slot: "chest", stats: { armor: 12, value: 120 } },
  steel_cuirass:   { name: "Steel Cuirass",   description: "Well-tempered steel plate.",     weight: 10,  slot: "chest", stats: { armor: 18, value: 300 } },
  orcish_cuirass:  { name: "Orcish Cuirass",  description: "Brutal, functional craftsmanship.", weight: 12, slot: "chest", stats: { armor: 26, value: 800 } },
  daedric_cuirass: { name: "Daedric Cuirass", description: "Armor carved from raw Oblivion.", weight: 14, slot: "chest", stats: { armor: 36, value: 2000 } },
};
/** Merchant / restock health potions: `value` for barter pricing, `heal` for consumable use. */
const HEALTH_POTION_STATS = { value: 25, heal: 50 } as const;
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
  /** Directional sun — its position is offset from the player each frame to keep the shadow frustum centred. */
  private _sunLight: DirectionalLight | null = null;
  /** Rendering configuration preset (lighting, sky, post-processing, fog). */
  public readonly graphics: GraphicsSystem = GraphicsSystem.fromSavedOrAutoDetect();
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
  public worldBuilderSystem: WorldBuilderSystem;
  public worldBuilderUI: WorldBuilderUI;
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
  /** Tab-open HTML overlay — identity, attributes, skills, reputation. */
  public characterSheetUI!: CharacterSheetUI;
  public stableUI: StableUI;
  public saddlebagUI: SaddlebagUI;
  public uiAnimator: UIAnimator = new UIAnimator();
  public graphicsSettingsUI: GraphicsSettingsUI;

  // v2 systems (Oblivion-lite)
  public attributeSystem: AttributeSystem;
  public timeSystem: TimeSystem;
  public stealthSystem: StealthSystem;
  public crimeSystem: CrimeSystem;
  public pickpocketSystem: PickpocketSystem;
  public pickpocketUI: PickpocketUI;
  public containerSystem: ContainerSystem;
  public projectileSystem: ProjectileSystem;
  public barterSystem: BarterSystem;
  /** Registered storefronts linked to {@link barterSystem} merchants (hours, categories). */
  public shopSystem: ShopSystem;
  public cellManager: CellManager;

  // v3 systems (Oblivion-lite depth)
  public spellSystem: SpellSystem;
  public persuasionSystem: PersuasionSystem;
  public eventBus: GameEventBus;
  public lootTableSystem: LootTableSystem;
  public npcArchetypeSystem: NpcArchetypeSystem;
  /** Named schedule definitions; linked to {@link npcArchetypeSystem} for archetype `scheduleId`. */
  public npcScheduleSystem: NpcScheduleSystem;

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

  // v28+ survival / flavor-event systems
  public survivalSystem!: SurvivalSystem;
  public travelEventSystem!: TravelEventSystem;
  public ambientEventSystem!: AmbientEventSystem;
  public leveledListSystem!: LeveledListSystem;

  // v22 systems
  public eventManagerSystem: EventManagerSystem;

  // v23 systems
  public animationSystem: AnimationSystem;
  public petSystem: PetSystem;
  public petUI: PetUI;

  // v24 systems
  public markRecallSystem: MarkRecallSystem;
  public trainerSystem: TrainerSystem;

  // v26 systems
  public followerSystem: FollowerSystem;
  public followerUI: FollowerUI;

  // v27 systems
  public perkSystem!: PerkSystem;

  // v28 systems
  public dynamicWorldEventSystem!: DynamicWorldEventSystem;

  // Thu'um — dragon shouts (wired post-alpha; state persists via saveSystem)
  public dragonShoutSystem: DragonShoutSystem;
  public shoutUI: ShoutUI;
  /** Multiplier applied to NPC AI updates while Slow Time is active (1 = normal). */
  private _hostileTimeScale: number = 1;
  /** Real seconds remaining on the Slow Time shout effect. */
  private _slowTimeRemaining: number = 0;
  /** Real seconds remaining on the Elemental Fury shout effect. */
  private _attackSpeedBuffRemaining: number = 0;

  /** Fantasy asset loader — streams BabylonJS CDN models (weapons, structures, creatures). */
  public fantasyAssets: FantasyAssetLoader;

  /** Captures the WebGL canvas as a PNG/JPEG and triggers a browser download. */
  public readonly screenshotSystem = new ScreenshotSystem();

  private readonly _barterUI = new BarterUI();
  private readonly _containerUI = new ContainerUI();
  /** When set, open barter after dialogue teardown (pointer lock restored first). */
  private _pendingBarterMerchantId: string | null = null;

  public isPaused: boolean = false;

  private readonly _gameplayLoop = new FixedStepLoop({
    fixedDeltaSeconds: 1 / 60,
    // Two substeps cover 30 fps exactly; beyond that the simulation slows
    // slightly instead of multiplying AI/stealth cost up to 5× per frame
    // (which fed a feedback loop — lower fps → more substeps → more load).
    maxSubSteps: 2,
    maxAccumulatedSeconds: 0.25,
  });

  // Chunk tracking for navmesh rebuild triggers
  private _lastNavChunkX: number = NaN;
  private _lastNavChunkZ: number = NaN;
  private _lastRegionId: string | null = null;

  /** CDN props and chunk-scoped NPCs spawned per chunk key ("cx,cz") — disposed on chunk unload. */
  private readonly _chunkFantasyContent = new Map<string, { roots: AbstractMesh[]; npcs: NPC[] }>();

  /** Last integer in-game minute rendered to the clock HUD. */
  private _lastClockMinutes: number = Number.NaN;

  /** Debounce for witnessed-assault crime reports (one per 3s per combat burst). */
  private _lastAssaultCrimeMs: number = Number.NEGATIVE_INFINITY;
  /** True once the Bandit Bounty framework quest has been activated by a bandit kill. */
  private _banditQuestStarted: boolean = false;
  /** Active difficulty setting (scales NPC→player damage). */
  private _difficulty: "easy" | "normal" | "hard" = "normal";
  /** Active camera look sensitivity setting. */
  private _cameraSensitivity: CameraSensitivity = "standard";
  /** Mesh name of the NPC the player is currently talking to (persuasion pricing). */
  private _currentDialogueNpcName: string | null = null;
  /** Mesh name of the NPC currently shown in the pickpocket picker (null when closed). */
  private _pickpocketTargetId: string | null = null;
  /** True while the character-creation wizard is up (Escape must not pause beneath it). */
  private _inCharacterCreation: boolean = false;

  // Cached stat values to avoid redundant UI bar updates every frame
  private _lastHealth: number = -1;
  private _lastMagicka: number = -1;
  private _lastStamina: number = -1;
  private _lastExperience: number = -1;
  private _lastLevel: number = -1;
  private _lastCharacterLevel: number = -1;

  // Last LOD culled count for the debug overlay (updated from lodSystem.update())
  private _lastLodCulled: number = 0;

  /** Throttles expensive scene queries in the debug HUD (see `update()`). */
  private _debugOverlayFrameSkip: number = 0;

  /** Frame counter for throttling non-critical subsystem updates. */
  private _systemTickCounter: number = 0;

  // Death feedback: true while health is at 0 so the notification fires once per "death"
  private _playerAtZeroHP: boolean = false;

  // Pet world state — in-world capsule mesh + physics body for the active companion
  private _petMesh: Mesh | null = null;
  private _petPhysicsAggregate: PhysicsAggregate | null = null;
  private _petAttackTimer: number = 0;
  private _petScratchVec = new Vector3();
  private _petLookTarget = new Vector3();
  // Cache for pet HUD dirty-checking
  private _lastPetHealth: number = -1;
  private _lastPetId: string | null = null;
  // Cache for follower HUD dirty-checking
  private _lastFollowerHealth: number = -1;
  private _lastFollowerId: string | null = null;
  private _helpOverlayEl: HTMLDivElement | null = null;
  private _helpOverlayVisible: boolean = false;
  public activeEffectHUD: ActiveEffectHUD;
  public quickSlotHUD: QuickSlotHUD;
  private _lastSleepNotificationPerNPC: Map<NPC, number> = new Map();
  private _activeGuardChallenge: { guard: NPC; factionId: string; bounty: number } | null = null;

  /** Decoupled input action adapter — maps named actions to key/mouse/gamepad events. */
  private readonly _inputAdapter = new BabylonInputAdapter();
  /** Gamepad input polling system — feeds controller input into the adapter. */
  private readonly _gamepadInput = new GamepadInputSystem(this._inputAdapter);
  /** Tracks whether the current key event was consumed by the input adapter. */
  private _keyConsumedByAdapter: boolean = false;
  /**
   * Adapter keys that stay live while the map editor owns the keyboard.
   * Every editor chord (T/G/P/H/L, F4–F12, Shift+F*, Ctrl+M/Z/Y, [/]) is
   * handled by the legacy key branches, so while the editor is enabled the
   * gameplay adapter only sees keys with no editor meaning.
   */
  private static readonly _EDITOR_ADAPTER_KEYS: ReadonlySet<string> = new Set([
    "Escape", "F1", "F3", "PrintScreen", "m", "M",
  ]);

  /** Short post-creation tips; advances on Space or when the hinted action occurs. */
  private readonly _onboardingTutorial = new TutorialSystem();
  private _onboardingTipEl: HTMLDivElement | null = null;
  private _lastDynamicWorldEventHour = -1;

  constructor(scene: Scene, canvas: HTMLCanvasElement, engine: Engine | WebGPUEngine) {
    this.scene = scene;
    this.canvas = canvas;
    this.engine = engine;

    this.init();
  }


  private _toggleHelpOverlay(): void {
    if (!this._helpOverlayEl) {
      const panel = document.createElement("div");
      panel.className = "game-help-overlay";
      panel.style.display = "none";
      document.body.appendChild(panel);
      this._helpOverlayEl = panel;
    }

    this._helpOverlayVisible = !this._helpOverlayVisible;
    if (!this._helpOverlayEl) return;

    if (this._helpOverlayVisible) {
      this._helpOverlayEl.innerHTML = buildHelpOverlayLines(this.mapEditorSystem.isEnabled).join("<br>");
      this._helpOverlayEl.style.display = "block";
    } else {
      this._helpOverlayEl.style.display = "none";
    }
  }

  private _refreshHelpOverlayIfVisible(): void {
    if (!this._helpOverlayVisible || !this._helpOverlayEl) return;
    this._helpOverlayEl.textContent = buildHelpOverlayLines(this.mapEditorSystem.isEnabled).join("\n");
  }

  /**
   * Register a CDN prop spawned on the terrain for distance culling (root uses world-space position).
   * Parented loot overlays skip this — their world origin is not on the root transform.
   */
  private _registerFantasyChunkLod(
    root: AbstractMesh,
    tier: "structure" | "scene" | "prop" | "boss",
  ): void {
    const dist = tier === "boss" ? 210 : tier === "scene" ? 185 : tier === "structure" ? 145 : 88;
    this.lodSystem.register(root, dist);
  }

  /**
   * Track a chunk-scoped CDN prop so the chunk unload handler can dispose it.
   * If the chunk already unloaded while the asset was loading (record identity
   * mismatch — also covers unload → re-mount windows), the root is discarded
   * immediately instead of leaking into the scene.
   */
  private _trackChunkProp(
    chunkKey: string,
    record: { roots: AbstractMesh[]; npcs: NPC[] },
    root: AbstractMesh,
    tier: "structure" | "scene" | "prop" | "boss",
  ): void {
    if (this._chunkFantasyContent.get(chunkKey) !== record) {
      root.dispose();
      return;
    }
    record.roots.push(root);
    this.shadowGenerator?.addShadowCaster(root, true);
    this._registerFantasyChunkLod(root, tier);
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
    // Apply the tier's hardware scaling level before the first render.
    this.engine.setHardwareScalingLevel(this.graphics.performance.hardwareScalingLevel);
    this._setLight();
    this.player = new Player(this.scene, this.canvas);
    // Post-processing and skybox require the camera, so initialise after Player.
    this._initPostProcessing();
    this.ui = new UIManager(this.scene);
    this.world = new WorldManager(this.scene, this.shadowGenerator, null, this.graphics.texture);
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

    // Notify player of location changes (full wiring in the v8 block once
    // fastTravelSystem is ready). Exterior CDN props stay in LodSystem across
    // interior transitions; disposed meshes are pruned in lodSystem.update().

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
    // Equipped weapon drives the combat weapon archetype (sword/bow/staff/...).
    this.equipmentSystem.onEquipmentChanged = () => {
      this._syncWeaponArchetype();
      // Equipped gear is persistent state — keep the dirty-gated autosave aware.
      this.saveSystem.markDirty();
    };
    this._syncWeaponArchetype();
    this.saveSystem         = new SaveSystem(this.player, this.inventorySystem, this.equipmentSystem, this.ui);
    this.saveSystem.setCombatSystem(this.combatSystem);
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
      // Saved equipment bypasses equip() — re-sync the weapon archetype.
      this._syncWeaponArchetype();
      // Don't re-announce the bandit bounty if it's already live/finished.
      if (this.frameworkRuntime.questEngine.getQuestStatus("quest_bandit_bounty") !== "inactive") {
        this._banditQuestStarted = true;
      }
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
    this.dialogueSystem.dialogueSessionProvider = (targetNpc) => {
      this._currentDialogueNpcName = targetNpc.mesh.name;
      return this._createFrameworkDialogueSession(targetNpc.mesh.name);
    };
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

    // ── World Builder ───────────────────────────────────────────────────────────
    this.worldBuilderSystem = new WorldBuilderSystem();
    this.worldBuilderUI = new WorldBuilderUI(this.worldBuilderSystem);
    this.worldBuilderUI.onClose = () => {
      this.interactionSystem.isBlocked = this.mapEditorSystem.isEnabled;
      this.workspaceDraftSystem.markDirty();
      if (this.mapEditorSystem.isEnabled || this.isPaused) return;
      this.canvas.requestPointerLock();
      this.player.camera.attachControl(this.canvas, true);
    };
    this.worldBuilderUI.onApplyToWorld = (worldSeed, config) => {
      this.world.setSeed(worldSeed);
      if (config) {
        this.world.vegetationDensity = config.vegetationDensity;
        this.world.elevationScale = config.elevationScale;
      }
      this.world.setRegions(this.worldBuilderSystem.regions);

      // Register procedural settlements as discoverable fast-travel landmarks
      if (this.fastTravelSystem && this.worldBuilderSystem.settlements.length > 0) {
        for (const s of this.worldBuilderSystem.settlements) {
          const wp = new Vector3(s.cx * this.world.chunkSize, 2, s.cz * this.world.chunkSize);
          this.fastTravelSystem.discoverLocation(`settlement_${s.id}`, s.name, wp);
        }
      }

      // Generate seeded Arthurian barrows & crypts and register with CellManager and fast travel
      if (this.cellManager) {
        for (const d of this.worldBuilderSystem.dungeons) {
          const dungeonGen = new DungeonGenerator({
            seed: `${worldSeed.seedString}_${d.id}`,
            dangerLevel: d.dangerLevel,
            maxRooms: d.roomCount,
            theme: d.theme,
          });
          const cellDef = dungeonGen.toCellDefinition();
          cellDef.id = d.id;
          cellDef.name = d.name;
          this.cellManager.registerCell(cellDef);

          if (this.fastTravelSystem) {
            const dwp = new Vector3(d.cx * this.world.chunkSize, 2, d.cz * this.world.chunkSize);
            this.fastTravelSystem.discoverLocation(`dungeon_${d.id}`, d.name, dwp);
          }
        }
      }

      this.ui.showNotification(
        `Applied world seed: ${worldSeed.seedString} (${worldSeed.options.worldType} / ${worldSeed.options.biomeScale})`,
        3000,
      );
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
      .attachSpawn(this.spawnCreatorSystem)
      .attachWorldBuilder(this.worldBuilderSystem);
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
        case "quest":        this.questCreatorUI.open();        break;
        case "dialogue":     this.dialogueCreatorUI.open();     break;
        case "faction":      this.factionCreatorUI.open();      break;
        case "lootTable":    this.lootTableCreatorUI.open();    break;
        case "npc":          this.npcCreatorUI.open();          break;
        case "item":         this.itemCreatorUI.open();         break;
        case "spawn":        this.spawnCreatorUI.open();        break;
        case "worldBuilder": this.worldBuilderUI.open();        break;
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
    // Insert opens the asset's authoring tool (same dispatch as the hub).
    this.assetBrowserUI.onInsert = (asset) => {
      const tool = ASSET_TYPE_TO_EDITOR_TOOL[asset.type];
      if (tool) this._openEditorTool(tool);
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
      .attachMap(this.mapEditorSystem)
      .attachWorldBuilder(this.worldBuilderSystem);
    this.workspaceDraftSystem.onSaved = () => {
      this.ui.showNotification("Workspace draft auto-saved.", 1500);
    };

    // ── Editor Hub ─────────────────────────────────────────────────────────────
    this.editorHubUI = new EditorHubUI({
      onOpen: (tool) => this._openEditorTool(tool),
    });
    this.editorHubUI.onClose = () => {
      this.interactionSystem.isBlocked = this.mapEditorSystem.isEnabled;
    };
    this._seedAssetBrowser();

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
    this.stealthSystem   = new StealthSystem(this.player, this.scheduleSystem.npcs, this.ui, this.scene);
    this.crimeSystem     = new CrimeSystem(this.player, this.scheduleSystem.npcs, this.ui, this.scene);
    this.containerSystem = new ContainerSystem(this.scene, this.player, this.inventorySystem, this.ui);
    this.projectileSystem = new ProjectileSystem(this.scene, this.player, this.scheduleSystem.npcs, this.ui);
    this.projectileSystem.stealthSystem = this.stealthSystem;
    this.barterSystem    = new BarterSystem(this.inventorySystem, this.ui);
    this.shopSystem      = new ShopSystem();
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
    this.saveSystem.setStealthSystem(this.stealthSystem);

    // ── Pickpocket wiring (sneak-thief loop) ────────────────────────────────
    this.pickpocketSystem = new PickpocketSystem();
    this.saveSystem.setPickpocketSystem(this.pickpocketSystem);
    this.pickpocketUI = new PickpocketUI();
    this.pickpocketSystem.onPickpocketSuccess = (npcId, itemId, xp) => {
      this._grantPickpocketItem(npcId, itemId);
      const mult = this.classSystem.xpMultiplierFor("sneak");
      this.skillProgressionSystem.gainXP("sneak", xp * mult);
      this.ui.showNotification(`Lifted ${this._pickpocketItemLabel(itemId)}!`, 2200);
      this.saveSystem.markDirty();
      this._refreshPickpocketUI(npcId);
    };
    this.pickpocketSystem.onPickpocketFailed = (_npcId, _itemId, caught) => {
      if (!caught) this.ui.showNotification("Your fingers slip — unnoticed. Try again.", 2200);
    };
    this.pickpocketSystem.onCaught = (npcId) => {
      const npc = this.scheduleSystem.npcs.find(n => n.mesh.name === npcId);
      this.crimeSystem.commitCrime("theft", npc?.factionId ?? "village_guard", this.timeSystem.elapsedGameTime);
      this.ui.showNotification("Caught pickpocketing!", 2600);
      if (this.pickpocketUI.isVisible) {
        this._pickpocketTargetId = null;
        this.pickpocketUI.hide();
        this._restoreGameplayInput();
      }
    };
    this.pickpocketUI.onStealItem = (itemId) => this._attemptPickpocketSteal(itemId);
    this.pickpocketUI.onClose = () => this._restoreGameplayInput();
    this.interactionSystem.stealthSystem = this.stealthSystem;
    this.interactionSystem.pickpocketSystem = this.pickpocketSystem;
    this.interactionSystem.sneakLevelProvider = () =>
      this.skillProgressionSystem.getSkill("sneak")?.level ?? 0;
    this.interactionSystem.onPickpocketNpc = (npc) => this._openPickpocketUI(npc);
    // Seed the starting cast (structure/archetype spawns register on arrival).
    for (const npc of this.scheduleSystem.npcs) this._registerPickpocketInventory(npc);

    // ── v3 system wiring ──────────────────────────────────────────────────────
    this.eventBus        = new GameEventBus();
    this.lootTableSystem = new LootTableSystem();
    for (const t of STARTER_LOOT_TABLES) this.lootTableSystem.registerTable(t);

    // NPC archetype factory — pre-load archetypes from base content
    this.npcScheduleSystem = new NpcScheduleSystem();
    this.npcArchetypeSystem = new NpcArchetypeSystem();
    this.npcArchetypeSystem.scheduleSystem = this.npcScheduleSystem;
    this.npcArchetypeSystem.registerAll(frameworkBaseContent.npcArchetypes);

    // Demo guard: day/night schedule (patrol vs sleep) driven by TimeSystem → DailyScheduleSystem.
    const demoGuard = this.scheduleSystem.npcs.find((n) => n.mesh.name === "Guard");
    if (demoGuard) {
      this.npcScheduleSystem.applySchedule(demoGuard, SCHED_GUARD);
    }

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
    // Registered meshes are pruned when disposed; no global clear on cell travel.
    this.lodSystem = new LodSystem({ updateEveryNFrames: 5 });
    this.lodSystem.setQuality(this.graphics.tier);
    this.lodSystem.setCamera(this.player.camera);
    this.world.setLodSystem(this.lodSystem);
    this._gamepadInput.setCamera(this.player.camera);
    // Distance-cull the demo guard's capsule alongside the world props.
    if (this.scheduleSystem.npcs[0]) {
      this.lodSystem.register(this.scheduleSystem.npcs[0].mesh, 120);
    }

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
    this.quickSlotSystem.onItemConsumed = (item, source) => {
      // Food restores hunger via the survival system (potions restore stats
      // directly inside QuickSlotSystem).
      const nutrition = item.stats?.nutrition;
      if (typeof nutrition === "number" && nutrition > 0) {
        this.survivalSystem.eat(nutrition);
        this.ui.showNotification(`Ate ${item.name}.`, 1600);
      }
      this.eventBus.emit("player:consumeItem" as any, { itemId: item.id, source });
      this.saveSystem.markDirty();
    };
    this.saveSystem.setQuickSlotSystem(this.quickSlotSystem);

    this.ui.onInventoryItemClick = (item) => {
      if (this._tryAssignQuickSlotFromClick(item)) return;
      if (this.quickSlotSystem.tryConsumeFromInventoryRow(item)) {
        this.saveSystem.markDirty();
        return;
      }
      this.equipmentSystem.handleItemClick(item);
    };
    this.ui.isConsumableItem = isConsumableItem;

    // ── v7 system wiring (QoL: Wait + Compass) ────────────────────────────────
    this.waitSystem = new WaitSystem();
    this.saveSystem.setWaitSystem(this.waitSystem);
    // Wire the Wait Dialog confirm callback
    this.ui.onWaitConfirm = (hours) => {
      const result = this.waitSystem.wait(hours, this.timeSystem, this.player);
      if (result.ok) {
        // Waiting counts as light sleep — resting at an inn restores more.
        this.survivalSystem.rest(hours * 14);
        this.ui.showNotification(result.message, 2800);
        this.saveSystem.markDirty();
      }
    };
    // Wait-dialog buttons close the panel themselves — restore input like Escape does.
    this.ui.onWaitDialogClosed = () => this._restoreGameplayInput();
    // Attribute panel ✕ button closes without going through a game toggle.
    this.ui.onAttributePanelClosed = () => this._restoreGameplayInput();
    // Alchemy/enchanting ✕ buttons likewise.
    this.alchemyUI.onClosed = () => this._restoreGameplayInput();
    this.enchantingUI.onClosed = () => this._restoreGameplayInput();

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
    // Lets ranged/magic NPCs fire arrows and bolts at the player.
    this.combatSystem.setProjectileSystem(this.projectileSystem);
    // Bolt-riding status effects (burn, freeze, …) land on the player.
    this.projectileSystem.onPlayerDamaged = (_dmg, _sourceName, effect) => {
      if (effect) this.combatSystem.applyPlayerStatusEffect(effect);
    };
    this.projectileSystem.isPlayerDodging = () => this.combatSystem.isDodging;
    this.projectileSystem.onHostileHit = (npc, damage) => {
      this.combatSystem.notifyHostileHit(npc, damage);
    };
    this.spellSystem.onHostileHit = (npc, damage) => {
      this.combatSystem.notifyHostileHit(npc, damage);
    };
    this.projectileSystem.setScalingSystems({
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
    // Scale newly spawned structure NPCs and register them for cleanup
    this.world.structures.onNPCSpawn = (npc) => {
      this.scheduleSystem.addNPC(npc);
      this.levelScalingSystem.scaleNPC(npc, this.player.level);
      this.lodSystem.register(npc.mesh, 120);
      this._registerPickpocketInventory(npc);
    };

    this.world.structures.onNPCRemove = (npc) => {
      this.scheduleSystem.removeNPC(npc);
      this.combatSystem.removeNPC(npc);
      this.stealthSystem.removeNPC(npc);
      this.crimeSystem.removeNPC(npc);
      this.spellSystem.removeNPC(npc);
      this.projectileSystem.removeNPC(npc);
      this.pickpocketSystem.removeNpcInventory(npc.mesh.name);
      this.lodSystem.unregister(npc.mesh);
    };

    /** Unified world-state persistence: check if an item belongs to the player or was already taken. */
    this.world.structures.onCheckLootCollected = (itemId) => {
      // Check inventory
      for (const item of this.inventorySystem.items) {
          if (item.id === itemId) return true;
      }
      // Check equipment
      for (const item of this.equipmentSystem.getEquipped().values()) {
          if (item.id === itemId) return true;
      }
      return false;
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
    this.spellMakingUI.setAnimator(this.uiAnimator);

    this.levelUpUI = new LevelUpUI();
    this.levelUpUI.setAnimator(this.uiAnimator);

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
      { id: "potion_hp_01", name: "Health Potion", description: "Restores 50 health.", stackable: true, quantity: 5, weight: 0.3, stats: { ...HEALTH_POTION_STATS } },
      { id: "arrow_bundle", name: "Arrows (20)", description: "A bundle of iron arrows.", stackable: true, quantity: 3, weight: 1, stats: { value: 15 } },
    ];
    this.merchantRestockSystem.registerMerchant(
      "merchant_01",
      merchantTemplate,
      500,
      72,
      this.timeSystem.elapsedGameTime,
    );
    this.merchantRestockSystem.registerMerchant(
      "merchant_general_01",
      [
        { id: "potion_hp_01", name: "Health Potion", description: "Restores 50 health.", stackable: true, quantity: 8, weight: 0.3, stats: { ...HEALTH_POTION_STATS } },
        { id: "arrow_bundle", name: "Arrows (20)", description: "A bundle of iron arrows.", stackable: true, quantity: 4, weight: 1, stats: { value: 15 } },
      ],
      450,
      72,
      this.timeSystem.elapsedGameTime,
    );
    this.merchantRestockSystem.registerMerchant(
      "merchant_weapons_01",
      [
        { id: "iron_sword", name: "Iron Sword", description: "A basic iron sword.", stackable: false, quantity: 2, slot: "mainHand", weight: 3, stats: { damage: 10, value: 80 } },
        { id: "arrow_bundle", name: "Arrows (20)", description: "A bundle of iron arrows.", stackable: true, quantity: 6, weight: 1, stats: { value: 15 } },
      ],
      800,
      72,
      this.timeSystem.elapsedGameTime,
    );
    this.merchantRestockSystem.registerMerchant(
      "merchant_armor_01",
      [
        { id: "leather_chest_01", name: "Leather Chest", description: "Light armor. +15 Armor Rating.", stackable: false, quantity: 1, slot: "chest", weight: 4, stats: { armor: 15, value: 55 } },
        { id: "iron_helm_01", name: "Iron Helm", description: "A sturdy iron helmet. +12 Armor Rating.", stackable: false, quantity: 2, slot: "head", weight: 2.5, stats: { armor: 12, value: 45 } },
      ],
      650,
      72,
      this.timeSystem.elapsedGameTime,
    );
    this.merchantRestockSystem.registerMerchant(
      "merchant_alchemist_01",
      [{ id: "potion_hp_01", name: "Health Potion", description: "Restores 50 health.", stackable: true, quantity: 12, weight: 0.3, stats: { ...HEALTH_POTION_STATS } }],
      520,
      72,
      this.timeSystem.elapsedGameTime,
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
      this.trainerSystem.onCharacterLevelUp();
      // Grant one perk point per character level-up.
      this.perkSystem.addPerkPoints(1);
      this.saveSystem.markDirty();
      if (this.characterSheetUI.isVisible) this._refreshCharacterSheet();
      // Auto-open attribute panel on character level-up — only when no other
      // modal owns the screen.
      if (!this.isPaused && !this.ui.isAttributePanelOpen && !this._isCombatInputBlocked()) {
        this.ui.toggleAttributePanel(true);
        this.ui.refreshAttributePanel(this.attributeSystem);
        this._suspendGameplayInput();
      }
    };
    this.saveSystem.setPlayerLevelSystem(this.playerLevelSystem);

    this.characterSheetUI = new CharacterSheetUI();
    // Character sheet ✕ button (its Escape path is owned by the game cascade).
    // Must wire after construction — assigning earlier throws and aborts Game.init
    // (boot-smoke / character-create never appear).
    this.characterSheetUI.onClose = () => {
      this.ui.setCharacterSheetOpen(false);
      this._restoreGameplayInput();
    };
    // Perk spending from the character sheet (points come from level-ups).
    this.characterSheetUI.onPerkUnlock = (perkId) => {
      if (this.perkSystem.unlock(perkId)) {
        this.saveSystem.markDirty();
        this._refreshCharacterSheet();
      }
    };

    // ── Graphics Settings UI ──────────────────────────────────────────────────
    this.graphicsSettingsUI = new GraphicsSettingsUI();
    this.graphicsSettingsUI.onTierSelect = (tier) => {
      persistGraphicsTier(tier);
      this.lodSystem?.setQuality(tier);
      location.reload();
    };
    // Difficulty applies immediately — it only scales NPC→player damage.
    this.graphicsSettingsUI.onDifficultySelect = (difficulty) => {
      this._difficulty = difficulty;
      this.combatSystem.difficultyMultiplier =
        difficulty === "easy" ? 0.6 : difficulty === "hard" ? 1.5 : 1.0;
      this.ui.showNotification(`Difficulty: ${difficulty[0].toUpperCase()}${difficulty.slice(1)}`, 2400);
    };
    this.graphicsSettingsUI.onAudioMuteToggle = (isMuted) => {
      if (this.audioSystem.isMuted !== isMuted) {
        this.audioSystem.toggleMute();
      }
      this.ui.showNotification(isMuted ? "Audio muted" : "Audio unmuted", 1500);
    };
    this.graphicsSettingsUI.onVolumeChange = (volume) => {
      this.audioSystem.setMasterVolume(volume);
      this.ui.showNotification(`Master volume: ${Math.round(volume * 100)}%`, 1500);
    };
    this.graphicsSettingsUI.onCameraSensitivityChange = (sens) => {
      this._cameraSensitivity = sens;
      const sensMap: Record<CameraSensitivity, number> = {
        low: 1200,
        standard: 800,
        high: 500,
      };
      if (this.player?.camera) {
        this.player.camera.angularSensibility = sensMap[sens];
      }
      this.ui.showNotification(`Look Sensitivity: ${sens[0].toUpperCase()}${sens.slice(1)}`, 1500);
    };
    this.graphicsSettingsUI.onClose = () => {
      this.interactionSystem.isBlocked = false;
      if (!this.isPaused) {
        this.canvas.requestPointerLock();
        this.player.camera.attachControl(this.canvas, true);
      }
    };
    this._wireGraphicsSettingsButton();

    // ── v18 DailyScheduleSystem ───────────────────────────────────────────────
    // Connects TimeSystem → ScheduleSystem so NPC daily behaviours are driven
    // automatically by the in-game clock.  Also enforces non-interactivity for
    // sleeping NPCs by clearing their mesh.metadata during sleep windows.
    this.dailyScheduleSystem = new DailyScheduleSystem(
      this.scheduleSystem,
      this.timeSystem,
    );
    this.dailyScheduleSystem.onNPCSleep = (npc) => {
      const now = this._systemTickCounter;
      if ((this._lastSleepNotificationPerNPC.get(npc) ?? -9999) + 1800 > now) return;
      this._lastSleepNotificationPerNPC.set(npc, now);
      this.ui.showNotification(`${npc.mesh.name} has gone to sleep.`, 2000);
      this.saveSystem.markDirty();
    };
    this.dailyScheduleSystem.onNPCWake = (npc) => {
      const now = this._systemTickCounter;
      if ((this._lastSleepNotificationPerNPC.get(npc) ?? -9999) + 1800 > now) return;
      this._lastSleepNotificationPerNPC.set(npc, now);
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

    // ── v28: Survival needs (hunger / fatigue / cold) ──────────────────────
    this.survivalSystem = new SurvivalSystem();
    this.survivalSystem.onHungerLevelChanged = (level) => {
      if (level === "hungry") this.ui.showNotification("You are getting hungry. Find some food.", 3000);
      if (level === "starving") this.ui.showNotification("You are starving!", 3500);
    };
    this.survivalSystem.onFatigueLevelChanged = (level) => {
      if (level === "tired") this.ui.showNotification("You are getting tired. Rest soon (T).", 3000);
      if (level === "exhausted") this.ui.showNotification("You are exhausted!", 3500);
    };
    this.survivalSystem.onColdLevelChanged = (level) => {
      if (level === "cold") this.ui.showNotification("You are cold. Seek shelter or fire.", 3000);
      if (level === "freezing") this.ui.showNotification("You are freezing! Health is draining.", 3500);
    };
    this.saveSystem.setSurvivalSystem(this.survivalSystem);

    // ── v22: Event Manager (Dungeon Master) ───────────────────────────────
    this.eventManagerSystem = new EventManagerSystem();
    this.eventManagerSystem.onEventTriggered = (_id, def) => {
      this.ui.showNotification(`📜 ${def.title}`, 3000);
    };
    this.saveSystem.setEventManagerSystem(this.eventManagerSystem);

    // ── v23 Animation System ───────────────────────────────────────────────
    this.animationSystem = new AnimationSystem(this.scene);

    // ── Fantasy Asset Loader ───────────────────────────────────────────────
    // Preload Babylon CDN models only; Quaternius packs load on first `getInstance`
    // to avoid startup bandwidth, decode work, and memory spikes from ~80+ local GLBs.
    this.fantasyAssets = new FantasyAssetLoader(this.scene);
    const remotePropsEnabled = import.meta.env.VITE_ENABLE_REMOTE_PROPS === "true";
    if (remotePropsEnabled) {
      this.fantasyAssets.preloadRemoteCdnAssets();

      // ── CDN model world placement via chunk lifecycle ──────────────────────
      // Deterministic seeding: same chunk always produces same props.
      const _chunkRand = (cx: number, cz: number, slot: number) =>
        Math.abs(Math.sin(cx * 311.7 + cz * 127.1 + slot * 59.3)) % 1;

      this.world.onChunkLoaded = (cx, cz, biome) => {
        const worldX = cx * this.world.chunkSize;
        const worldZ = cz * this.world.chunkSize;
        const chunkKey = `${cx},${cz}`;
        const chunkRecord: { roots: AbstractMesh[]; npcs: NPC[] } = { roots: [], npcs: [] };
        this._chunkFantasyContent.set(chunkKey, chunkRecord);

      // ── Obelisks in desert / plains (1-in-8 chance per chunk) ────────────
      if ((biome === "desert" || biome === "plains") && _chunkRand(cx, cz, 0) < 0.125) {
        const ox = worldX + (_chunkRand(cx, cz, 1) - 0.5) * this.world.chunkSize * 0.7;
        const oz = worldZ + (_chunkRand(cx, cz, 2) - 0.5) * this.world.chunkSize * 0.7;
        this.fantasyAssets.getInstance("obelisk", (root) => {
          if (!root) return;
          const s = 0.8 + _chunkRand(cx, cz, 3) * 0.6;
          root.position.set(ox, 0, oz);
          root.rotation.y = _chunkRand(cx, cz, 4) * Math.PI * 2;
          root.scaling.setAll(s);
          this._trackChunkProp(chunkKey, chunkRecord, root, "structure");
        });
      }

      // ── Cottage in plains (1-in-12 chance) ───────────────────────────────
      if (biome === "plains" && _chunkRand(cx, cz, 5) < 0.083) {
        const cx2 = worldX + (_chunkRand(cx, cz, 6) - 0.5) * this.world.chunkSize * 0.5;
        const cz2 = worldZ + (_chunkRand(cx, cz, 7) - 0.5) * this.world.chunkSize * 0.5;
        this.fantasyAssets.getInstance("cottage", (root) => {
          if (!root) return;
          root.position.set(cx2, 0, cz2);
          root.rotation.y = _chunkRand(cx, cz, 8) * Math.PI * 2;
          root.scaling.setAll(1.0);
          this._trackChunkProp(chunkKey, chunkRecord, root, "structure");
        });
        // Homestead: a villager and a visiting instructor rotating per chunk.
        this._spawnArchetypeNpc("archetype_villager", chunkRecord, cx2 + 2, cz2 + 2);
        const cottageTrainer = [
          "archetype_trainer_blade",
          "archetype_trainer_alchemy",
          "archetype_trainer_destruction",
        ][((cx + cz) % 3 + 3) % 3];
        this._spawnArchetypeNpc(cottageTrainer, chunkRecord, cx2 - 2, cz2 + 1);
        if (_chunkRand(cx, cz, 91) < 0.3) {
          this._spawnArchetypeNpc("archetype_guard", chunkRecord, cx2 + 3, cz2 - 2);
        }
      }

      // ── Dragon encounter in tundra (1-in-20 chance — very rare) ──────────
      if (biome === "tundra" && _chunkRand(cx, cz, 9) < 0.05) {
        const dx = worldX + (_chunkRand(cx, cz, 10) - 0.5) * this.world.chunkSize * 0.6;
        const dz = worldZ + (_chunkRand(cx, cz, 11) - 0.5) * this.world.chunkSize * 0.6;
        // Register the boss NPC first so the AI/combat system tracks it
        const dragonNpc = new NPC(this.scene, new Vector3(dx, 2, dz), `DragonBoss_${cx}_${cz}`);
        dragonNpc.maxHealth    = 500;
        dragonNpc.health       = 500;
        dragonNpc.attackDamage = 40;
        dragonNpc.aggroRange   = 25;
        dragonNpc.xpReward     = 500;
        dragonNpc.armorRating  = 60;
        dragonNpc.lootTableId  = "boss_loot";
        // Hide the default capsule — the CDN model provides the visual
        dragonNpc.mesh.isVisible = false;
        this.scheduleSystem.addNPC(dragonNpc);
        const reg = this.world.getRegionAt(cx, cz);
        this.levelScalingSystem?.scaleNPC(dragonNpc, this.player.level, reg?.dangerLevel);
        chunkRecord.npcs.push(dragonNpc);
        // NOTE: the capsule stays unregistered in LodSystem — visibility toggling
        // would reveal it; the CDN model root is LOD-tracked via _trackChunkProp.

        // Attach CDN dragon model once loaded
        this.fantasyAssets.getInstance("dragon", (root) => {
          if (!root) return;
          if (dragonNpc.isDead || this._chunkFantasyContent.get(chunkKey) !== chunkRecord) {
            root.dispose();
            return;
          }
          root.position.set(dx, 0, dz);
          root.rotation.y = _chunkRand(cx, cz, 12) * Math.PI * 2;
          root.scaling.setAll(2.5);
          this._trackChunkProp(chunkKey, chunkRecord, root, "boss");
        });
      }

      // ── Inn in forest (1-in-15 chance) ────────────────────────────────────
      if (biome === "forest" && _chunkRand(cx, cz, 13) < 0.067) {
        const ix = worldX + (_chunkRand(cx, cz, 14) - 0.5) * this.world.chunkSize * 0.5;
        const iz = worldZ + (_chunkRand(cx, cz, 15) - 0.5) * this.world.chunkSize * 0.5;
        this.fantasyAssets.getInstance("inn", (root) => {
          if (!root) return;
          root.position.set(ix, 0, iz);
          root.rotation.y = _chunkRand(cx, cz, 16) * Math.PI * 2;
          root.scaling.setAll(1.0);
          this._trackChunkProp(chunkKey, chunkRecord, root, "structure");
        });
        // Settle the inn: proprietor, barkeep, and a rotating specialist
        // shopkeeper (deterministic per chunk) — occasionally a guard.
        this._spawnArchetypeNpc("archetype_innkeeper", chunkRecord, ix + 2.5, iz + 2.5);
        this._spawnArchetypeNpc("archetype_barkeeper", chunkRecord, ix - 2.5, iz + 2);
        const innSpecial = [
          "archetype_shopkeeper_general",
          "archetype_shopkeeper_weapons",
          "archetype_shopkeeper_armor",
          "archetype_shopkeeper_alchemist",
          "archetype_merchant",
        ][((cx + cz) % 5 + 5) % 5];
        this._spawnArchetypeNpc(innSpecial, chunkRecord, ix + 4, iz - 3);
        if (_chunkRand(cx, cz, 90) < 0.4) {
          this._spawnArchetypeNpc("archetype_guard", chunkRecord, ix - 4, iz - 3);
        }
      }

      // ── Haunted house in tundra (1-in-10 chance — Skyrim abandoned shacks) ──
      if (biome === "tundra" && _chunkRand(cx, cz, 17) < 0.10) {
        const hx = worldX + (_chunkRand(cx, cz, 18) - 0.5) * this.world.chunkSize * 0.55;
        const hz = worldZ + (_chunkRand(cx, cz, 19) - 0.5) * this.world.chunkSize * 0.55;
        this.fantasyAssets.getInstance("hauntedHouse", (root) => {
          if (!root) return;
          root.position.set(hx, 0, hz);
          root.rotation.y = _chunkRand(cx, cz, 20) * Math.PI * 2;
          root.scaling.setAll(1.2);
          this._trackChunkProp(chunkKey, chunkRecord, root, "structure");
        });
      }

      // ── Graveyard near ruins in plains/forest (1-in-10 chance) ───────────
      if ((biome === "plains" || biome === "forest") && _chunkRand(cx, cz, 21) < 0.10) {
        const gx = worldX + (_chunkRand(cx, cz, 22) - 0.5) * this.world.chunkSize * 0.6;
        const gz = worldZ + (_chunkRand(cx, cz, 23) - 0.5) * this.world.chunkSize * 0.6;
        this.fantasyAssets.getInstance("graveYardScene", (root) => {
          if (!root) return;
          root.position.set(gx, 0, gz);
          root.rotation.y = _chunkRand(cx, cz, 24) * Math.PI * 2;
          root.scaling.setAll(1.0);
          this._trackChunkProp(chunkKey, chunkRecord, root, "scene");
        });
      }

      // ── Pirate fort + cannon in desert (bandit camp) ─────────────────────
      if (biome === "desert" && _chunkRand(cx, cz, 40) < 0.048) {
        const fx = worldX + (_chunkRand(cx, cz, 41) - 0.5) * this.world.chunkSize * 0.62;
        const fz = worldZ + (_chunkRand(cx, cz, 42) - 0.5) * this.world.chunkSize * 0.62;
        const fortRot = _chunkRand(cx, cz, 43) * Math.PI * 2;
        this.fantasyAssets.getInstance("pirateFort", (root) => {
          if (!root) return;
          root.position.set(fx, 0, fz);
          root.rotation.y = fortRot;
          root.scaling.setAll(1.0);
          this._trackChunkProp(chunkKey, chunkRecord, root, "structure");
        });
        const rad = 6 + _chunkRand(cx, cz, 44) * 4;
        const cannonX = fx + Math.cos(fortRot + 0.7) * rad;
        const cannonZ = fz + Math.sin(fortRot + 0.7) * rad;
        this.fantasyAssets.getInstance("cannon", (root) => {
          if (!root) return;
          root.position.set(cannonX, 0, cannonZ);
          root.rotation.y = fortRot + Math.PI * 0.35;
          root.scaling.setAll(1.0);
          this._trackChunkProp(chunkKey, chunkRecord, root, "prop");
        });
        // Garrison the bandit camp: two lookouts, an archer on the edge,
        // and their chief. Bandits carry bandit_loot (including the
        // Bandit Bounty quest token).
        this._spawnArchetypeNpc("archetype_bandit", chunkRecord, fx + 3, fz + 2);
        this._spawnArchetypeNpc("archetype_bandit", chunkRecord, fx - 3, fz - 2);
        this._spawnArchetypeNpc("archetype_bandit_archer", chunkRecord, fx, fz + 5);
        this._spawnArchetypeNpc("archetype_bandit_chief", chunkRecord, fx, fz);
      }

      // ── Tundra snow-field patch (ground dressing) ─────────────────────────
      if (biome === "tundra" && _chunkRand(cx, cz, 45) < 0.085) {
        const sx = worldX + (_chunkRand(cx, cz, 46) - 0.5) * this.world.chunkSize * 0.75;
        const sz = worldZ + (_chunkRand(cx, cz, 47) - 0.5) * this.world.chunkSize * 0.75;
        this.fantasyAssets.getInstance("snowField", (root) => {
          if (!root) return;
          root.position.set(sx, 0, sz);
          root.rotation.y = _chunkRand(cx, cz, 48) * Math.PI * 2;
          const s = 0.85 + _chunkRand(cx, cz, 49) * 0.35;
          root.scaling.setAll(s);
          this._trackChunkProp(chunkKey, chunkRecord, root, "structure");
        });
      }

      // ── Forest / plains wildlife & props ──────────────────────────────────
      if ((biome === "forest" || biome === "plains") && _chunkRand(cx, cz, 50) < 0.055) {
        const rx = worldX + (_chunkRand(cx, cz, 51) - 0.5) * this.world.chunkSize * 0.85;
        const rz = worldZ + (_chunkRand(cx, cz, 52) - 0.5) * this.world.chunkSize * 0.85;
        this.fantasyAssets.getInstance("rabbit", (root) => {
          if (!root) return;
          root.position.set(rx, 0, rz);
          root.rotation.y = _chunkRand(cx, cz, 53) * Math.PI * 2;
          root.scaling.setAll(0.9 + _chunkRand(cx, cz, 54) * 0.25);
          this._trackChunkProp(chunkKey, chunkRecord, root, "prop");
        });
      }

      if (biome === "forest" && _chunkRand(cx, cz, 55) < 0.038) {
        const px = worldX + (_chunkRand(cx, cz, 56) - 0.5) * this.world.chunkSize * 0.55;
        const pz = worldZ + (_chunkRand(cx, cz, 57) - 0.5) * this.world.chunkSize * 0.55;
        this.fantasyAssets.getInstance("pumpkinCarved", (root) => {
          if (!root) return;
          root.position.set(px, 0, pz);
          root.rotation.y = _chunkRand(cx, cz, 58) * Math.PI * 2;
          root.scaling.setAll(1.0);
          this._trackChunkProp(chunkKey, chunkRecord, root, "prop");
        });
      }

      if (biome === "plains" && _chunkRand(cx, cz, 59) < 0.032) {
        const dx = worldX + (_chunkRand(cx, cz, 60) - 0.5) * this.world.chunkSize * 0.5;
        const dz = worldZ + (_chunkRand(cx, cz, 61) - 0.5) * this.world.chunkSize * 0.5;
        this.fantasyAssets.getInstance("d20Animated", (root) => {
          if (!root) return;
          root.position.set(dx, 0.15, dz);
          root.rotation.y = _chunkRand(cx, cz, 62) * Math.PI * 2;
          root.scaling.setAll(1.0);
          this._trackChunkProp(chunkKey, chunkRecord, root, "prop");
        });
      }

      if (biome === "plains" && _chunkRand(cx, cz, 63) < 0.028) {
        const cx3 = worldX + (_chunkRand(cx, cz, 64) - 0.5) * this.world.chunkSize * 0.45;
        const cz3 = worldZ + (_chunkRand(cx, cz, 65) - 0.5) * this.world.chunkSize * 0.45;
        this.fantasyAssets.getInstance("sheenChair", (root) => {
          if (!root) return;
          root.position.set(cx3, 0, cz3);
          root.rotation.y = _chunkRand(cx, cz, 66) * Math.PI * 2;
          root.scaling.setAll(1.0);
          this._trackChunkProp(chunkKey, chunkRecord, root, "prop");
        });
      }

      if (biome === "desert" && _chunkRand(cx, cz, 67) < 0.022) {
        const ax = worldX + (_chunkRand(cx, cz, 68) - 0.5) * this.world.chunkSize * 0.7;
        const az = worldZ + (_chunkRand(cx, cz, 69) - 0.5) * this.world.chunkSize * 0.7;
        this.fantasyAssets.getInstance("alien", (root) => {
          if (!root) return;
          root.position.set(ax, 0.2, az);
          root.rotation.y = _chunkRand(cx, cz, 70) * Math.PI * 2;
          root.scaling.setAll(1.0);
          this._trackChunkProp(chunkKey, chunkRecord, root, "prop");
        });
      }

      // ── Skull scatter (desert / tundra) ─────────────────────────────────────
      if ((biome === "desert" || biome === "tundra") && _chunkRand(cx, cz, 71) < 0.065) {
        const kx = worldX + (_chunkRand(cx, cz, 72) - 0.5) * this.world.chunkSize * 0.9;
        const kz = worldZ + (_chunkRand(cx, cz, 73) - 0.5) * this.world.chunkSize * 0.9;
        this.fantasyAssets.getInstance("skull", (root) => {
          if (!root) return;
          root.position.set(kx, 0, kz);
          root.rotation.y = _chunkRand(cx, cz, 74) * Math.PI * 2;
          root.scaling.setAll(0.55 + _chunkRand(cx, cz, 75) * 0.5);
          this._trackChunkProp(chunkKey, chunkRecord, root, "prop");
        });
      }

      // ── Extra BabylonJS CDN samples (underwater / shoreline) ───────────────
      if (biome === "forest" && _chunkRand(cx, cz, 76) < 0.017) {
        const ux = worldX + (_chunkRand(cx, cz, 77) - 0.5) * this.world.chunkSize * 0.65;
        const uz = worldZ + (_chunkRand(cx, cz, 78) - 0.5) * this.world.chunkSize * 0.65;
        this.fantasyAssets.getInstance("underwaterScene", (root) => {
          if (!root) return;
          root.position.set(ux, -0.5, uz);
          root.rotation.y = _chunkRand(cx, cz, 79) * Math.PI * 2;
          root.scaling.setAll(1.0);
          this._trackChunkProp(chunkKey, chunkRecord, root, "scene");
        });
      }
      if ((biome === "forest" || biome === "plains") && _chunkRand(cx, cz, 80) < 0.02) {
        const opx = worldX + (_chunkRand(cx, cz, 81) - 0.5) * this.world.chunkSize * 0.72;
        const opz = worldZ + (_chunkRand(cx, cz, 82) - 0.5) * this.world.chunkSize * 0.72;
        this.fantasyAssets.getInstance("octopusCustomRig", (root) => {
          if (!root) return;
          root.position.set(opx, 0.4, opz);
          root.rotation.y = _chunkRand(cx, cz, 83) * Math.PI * 2;
          root.scaling.setAll(1.0);
          this._trackChunkProp(chunkKey, chunkRecord, root, "prop");
        });
      }
      if (biome === "plains" && _chunkRand(cx, cz, 84) < 0.014) {
        const bx = worldX + (_chunkRand(cx, cz, 85) - 0.5) * this.world.chunkSize * 0.8;
        const bz = worldZ + (_chunkRand(cx, cz, 86) - 0.5) * this.world.chunkSize * 0.8;
        this.fantasyAssets.getInstance("babylonBuoy", (root) => {
          if (!root) return;
          root.position.set(bx, 0, bz);
          root.rotation.y = _chunkRand(cx, cz, 87) * Math.PI * 2;
          root.scaling.setAll(1.0);
          this._trackChunkProp(chunkKey, chunkRecord, root, "prop");
        });
      }
      };

      // Dispose chunk-scoped CDN props and NPCs when their chunk unloads so
      // revisiting an area never accumulates duplicate props or entities.
      this.world.onChunkUnloaded = (cx, cz) => {
        const key = `${cx},${cz}`;
        const record = this._chunkFantasyContent.get(key);
        if (!record) return;
        this._chunkFantasyContent.delete(key);

        for (const root of record.roots) {
          this.lodSystem.unregister(root);
          this.shadowGenerator?.removeShadowCaster(root, true);
          // Materials/textures belong to the shared asset template — preserve them.
          root.dispose();
        }

        for (const npc of record.npcs) {
          this.scheduleSystem.removeNPC(npc);
          this.combatSystem.removeNPC(npc);
          this.stealthSystem.removeNPC(npc);
          this.crimeSystem.removeNPC(npc);
          this.spellSystem.removeNPC(npc);
          this.projectileSystem.removeNPC(npc);
          this.lodSystem.unregister(npc.mesh);
          npc.mesh.dispose();
        }
      };
    }

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

    // ── v24: Mark & Recall ────────────────────────────────────────────────
    this.markRecallSystem = new MarkRecallSystem();
    this.markRecallSystem.onMark = (_pos, _cellId) => {
      this.ui.showNotification("Position Marked.", 2000);
    };
    this.markRecallSystem.onRecall = (pos, _cellId) => {
      this.player.camera.position.set(pos.x, pos.y, pos.z);
      this.ui.showNotification("Recalled to marked position.", 2000);
    };
    this.saveSystem.setMarkRecallSystem(this.markRecallSystem);

    // ── v24: Trainer System ───────────────────────────────────────────────
    this.trainerSystem = new TrainerSystem();
    this.trainerSystem.onTrainingComplete = (_trainerId, skillId, newLevel, goldSpent) => {
      // Gold sufficiency is pre-validated by TrainerSystem.train() via canTrain();
      // this callback only fires on a successful, already-approved session.
      this.skillProgressionSystem.setSkillLevel(skillId, newLevel);
      this._consumeInventoryGold(goldSpent);
      this.ui.showNotification(`${skillId} raised to ${newLevel}!  (−${goldSpent}g)`, 3000);
      this.saveSystem.markDirty();
    };
    this.saveSystem.setTrainerSystem(this.trainerSystem);

    // ── Thu'um: Dragon Shouts ─────────────────────────────────────────────
    // Souls + word discovery come from slaying dragons (see the elite drop
    // branch in onNPCDeath); souls are spent in the shouts panel [N].
    this.dragonShoutSystem = new DragonShoutSystem();
    this.dragonShoutSystem.onShoutUsed = (shoutId, _wordCount, tier) => {
      this._applyShoutEffects(shoutId, tier);
    };
    this.dragonShoutSystem.onWordLearned = (_shoutId, _wordIndex, word) => {
      this.ui.showNotification(`Word of Power learned: ${word.dragonWord} — "${word.translation}"`, 3600);
    };
    this.dragonShoutSystem.onWordUnlocked = (shoutId, wordIndex, word) => {
      const def = this.dragonShoutSystem.getShout(shoutId);
      this.ui.showNotification(
        `${def?.name ?? shoutId}: "${word.dragonWord}" unlocked (${wordIndex + 1}/3 words).`,
        3000,
      );
      if (this.shoutUI.isVisible) {
        this.shoutUI.refresh(this._buildShoutViews(), this.dragonShoutSystem.dragonSouls, this.dragonShoutSystem.equippedShoutId);
      }
      this.saveSystem.markDirty();
    };
    this.dragonShoutSystem.onDragonSoulGained = (total) => {
      this.ui.showNotification(`Dragon soul absorbed (${total} held).`, 3000);
    };
    this.saveSystem.setDragonShoutSystem(this.dragonShoutSystem);

    this.shoutUI = new ShoutUI();
    this.shoutUI.onEquip = (shoutId) => {
      if (this.dragonShoutSystem.equipShout(shoutId)) {
        this.shoutUI.refresh(this._buildShoutViews(), this.dragonShoutSystem.dragonSouls, shoutId);
        const def = this.dragonShoutSystem.getShout(shoutId);
        this.ui.showNotification(`${def?.name ?? shoutId} equipped — Shift+N to shout.`, 2400);
        this.saveSystem.markDirty();
      }
    };
    this.shoutUI.onUnlockWord = (shoutId, wordIndex) => {
      if (!this.dragonShoutSystem.unlockWord(shoutId, wordIndex)) {
        this.ui.showNotification("Cannot unlock that word — a dragon soul is required.", 2400);
      }
    };
    this.shoutUI.onClose = () => {
      this.interactionSystem.isBlocked = false;
      this.canvas.requestPointerLock();
      this.player.camera.attachControl(this.canvas, true);
    };

    // ── v26: Follower System ──────────────────────────────────────────────
    this.followerSystem = new FollowerSystem();
    this.followerSystem.onFollowerRecruited = (_templateId, name) => {
      this.ui.showNotification(`${name} has joined you.`, 3000);
    };
    this.followerSystem.onFollowerDismissed = (_templateId, name, homeLocation) => {
      this.ui.showNotification(`${name} has returned to ${homeLocation}.`, 3000);
    };
    this.followerSystem.onFollowerDied = (_templateId, name) => {
      this.ui.showNotification(`${name} has fallen in battle and cannot be rehired!`, 4000);
    };
    this.followerSystem.onCommandIssued = (command) => {
      this.ui.showNotification(`Follower command: ${command}`, 1500);
    };
    this.followerSystem.onFollowerDamaged = (_amount, remaining) => {
      if (remaining <= 0) {
        this.ui.showNotification("Your follower needs help!", 2000);
      }
    };
    this.saveSystem.setFollowerSystem(this.followerSystem);

    // ── v27: Perk System ──────────────────────────────────────────────────
    this.perkSystem = new PerkSystem(this.player, this.skillProgressionSystem);
    this.perkSystem.onPerkUnlocked = (_id, name) => {
      this.ui.showNotification(`Perk unlocked: ${name}!`, 3500);
      this.saveSystem.markDirty();
    };
    this.saveSystem.setPerkSystem(this.perkSystem);

    // ── v28: Dynamic world events ─────────────────────────────────────────
    this.dynamicWorldEventSystem = new DynamicWorldEventSystem();
    this.dynamicWorldEventSystem.addTemplate({
      id: "roadside_bandit_cache",
      label: "Roadside Bandit Cache",
      description: "Fresh tracks lead to a small stash left by raiders.",
      tableId: "treasure_chest",
      minCount: 1,
      maxCount: 1,
      cooldownHours: 36,
      baseChance: 0.08,
      hostileFactionIds: ["bandits"],
      factionThreatMultiplier: 1.75,
      nightMultiplier: 1.4,
      rewards: { xp: 20, gold: 15, label: "Recovered a roadside cache" },
      chainEventId: "hidden_cache_followup",
    });
    this.dynamicWorldEventSystem.addTemplate({
      id: "storm_lost_supplies",
      label: "Lost Supplies",
      description: "Bad weather uncovers a dropped bundle near the road.",
      tableId: "common_loot",
      minCount: 1,
      maxCount: 2,
      cooldownHours: 24,
      baseChance: 0.05,
      boostedWeatherIds: ["rain", "storm"],
      weatherBoostMultiplier: 2.5,
      rewards: { xp: 10, gold: 8, label: "Found storm-scattered supplies" },
    });
    this.dynamicWorldEventSystem.addTemplate({
      id: "hidden_cache_followup",
      label: "Hidden Cache",
      description: "The first stash points toward a better-hidden cache nearby.",
      tableId: "treasure_chest",
      minCount: 1,
      maxCount: 1,
      cooldownHours: 72,
      baseChance: 0.12,
      rewards: { xp: 35, gold: 30, label: "Uncovered a hidden cache" },
    });
    this.dynamicWorldEventSystem.onEventFired = (result) => {
      this.ui.showNotification(`World event: ${result.label}`, 2500);
      // Materialize the event's loot table as findable caches near the player —
      // the XP/gold reward arrives via onRewardGranted; these are the goods.
      const context = { playerLevel: this.player.level };
      const caches = Math.max(1, Math.min(3, result.count));
      for (let i = 0; i < caches; i++) {
        const drop = this.lootTableSystem.rollTable(result.tableId, undefined, context).items[0];
        if (!drop) continue;
        const angle = Math.random() * Math.PI * 2;
        const dist = 6 + Math.random() * 6;
        new Loot(this.scene, new Vector3(
          this.player.camera.position.x + Math.cos(angle) * dist,
          0.5,
          this.player.camera.position.z + Math.sin(angle) * dist,
        ), {
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
    };
    this.dynamicWorldEventSystem.onRewardGranted = (reward) => {
      this._grantDynamicWorldEventReward(reward);
    };
    this.saveSystem.setDynamicWorldEventSystem(this.dynamicWorldEventSystem);
    this._lastDynamicWorldEventHour = Math.floor(this.timeSystem.elapsedGameHours);

    // ── Travel events (rolled on fast-travel arrival) ────────────────────────
    this.travelEventSystem = new TravelEventSystem();
    this.travelEventSystem.addEvent({
      id: "travel_wanderer_rumor",
      label: "Wandering Hunter",
      description: "A hunter by the road shares rumors of old ruins.",
      conditions: { biomeIds: ["plains", "forest"] },
      outcome: { notification: "A wandering hunter trades rumors with you about old ruins nearby." },
      weight: 2,
      cooldownHours: 24,
    });
    this.travelEventSystem.addEvent({
      id: "travel_sandstorm_tales",
      label: "Desert Caravan",
      description: "A caravan merchant warns of sandstorms ahead.",
      conditions: { biomeIds: ["desert"] },
      outcome: { notification: "A caravan merchant warns you: 'The dunes are restless this season.'" },
      weight: 2,
      cooldownHours: 24,
    });
    this.travelEventSystem.addEvent({
      id: "travel_storm_refuge",
      label: "Storm Refuge",
      description: "You share shelter with a fellow traveler during a downpour.",
      conditions: { weather: ["rain", "storm"] },
      outcome: { notification: "You shelter from the storm beside a fellow traveler and swap stories." },
      weight: 3,
      cooldownHours: 12,
    });
    this.travelEventSystem.addEvent({
      id: "travel_frost_warning",
      label: "Frostbitten Scout",
      description: "A half-frozen scout stumbles out of the snow.",
      conditions: { biomeIds: ["tundra"], minPlayerLevel: 2 },
      outcome: { notification: "A frostbitten scout mutters about shapes moving in the whiteout before wandering off." },
      weight: 2,
      cooldownHours: 24,
    });

    // ── Ambient events (hourly flavor) ──────────────────────────────────────
    this.ambientEventSystem = new AmbientEventSystem();
    this.ambientEventSystem.addEvent({
      id: "ambient_wolf_howl",
      label: "Wolf Howl",
      conditions: { timeRange: { minHour: 20, maxHour: 5 }, biomeIds: ["forest", "tundra"] },
      effect: { notification: "A wolf howls somewhere in the dark." },
      cooldownHours: 8,
    });
    this.ambientEventSystem.addEvent({
      id: "ambient_shooting_star",
      label: "Shooting Star",
      conditions: { timeRange: { minHour: 22, maxHour: 4 }, weather: ["clear"] },
      effect: { notification: "A shooting star streaks across the night sky." },
      cooldownHours: 12,
    });
    this.ambientEventSystem.addEvent({
      id: "ambient_market_news",
      label: "Traveling News",
      conditions: { timeRange: { minHour: 8, maxHour: 18 } },
      effect: { notification: "You overhear travelers gossiping about bandit trouble on the trade road." },
      cooldownHours: 10,
    });
    this.ambientEventSystem.addEvent({
      id: "ambient_birdsong",
      label: "Birdsong",
      conditions: { timeRange: { minHour: 6, maxHour: 10 }, biomeIds: ["forest", "plains"], weather: ["clear", "overcast"] },
      effect: { notification: "Birdsong fills the morning air." },
      cooldownHours: 6,
    });
    this.ambientEventSystem.onEventTriggered = (_id, effect) => {
      if (effect.notification) this.ui.showNotification(effect.notification, 3000);
    };

    // ── Leveled lists (tiered boss loot) ─────────────────────────────────────
    this.leveledListSystem = new LeveledListSystem();
    this.leveledListSystem.registerAll(ALL_BUILT_IN_LEVELED_LISTS);
    // Persist flavor-event cooldowns so reloading can't reroll one-shots.
    this.saveSystem.setTravelEventSystem(this.travelEventSystem);
    this.saveSystem.setAmbientEventSystem(this.ambientEventSystem);

    // Wire sneak-attack detection into combat.
    this.combatSystem.setStealthSystem(this.stealthSystem);

    // Suspicion (partial detection) routes NPCs to investigate where the
    // player was seen/heard — full detection still triggers ALERT.
    this.stealthSystem.onPartialDetection = (npc, playerPos) => {
      if (npc.isDead || npc.isAggressive) return;
      if (!npc.lastKnownPlayerPos) npc.lastKnownPlayerPos = playerPos.clone();
      else npc.lastKnownPlayerPos.copyFrom(playerPos);
      if (npc.aiState === AIState.IDLE || npc.aiState === AIState.PATROL) {
        npc.aiState = AIState.INVESTIGATE;
        npc.investigateTimer = 0;
        // Sync the visual channel (amber tint) without the combat transition,
        // which would flag the suspicious NPC as hostile.
        this.combatSystem.paintNpcInvestigating(npc);
      }
    };

    // ── v26: Follower UI ──────────────────────────────────────────────────
    this.followerUI = new FollowerUI();
    this.followerUI.onRecruit = (templateId) => {
      const playerGold = this._getInventoryGold();
      const follower = this.followerSystem.recruitFollower(templateId, playerGold);
      if (follower) {
        const tmpl = this.followerSystem.getFollowerTemplate(templateId);
        if (tmpl && tmpl.hireCost > 0) {
          this._consumeInventoryGold(tmpl.hireCost);
        }
        this._refreshFollowerUI();
      }
    };
    this.followerUI.onDismiss = () => {
      this.followerSystem.dismissFollower();
      this._refreshFollowerUI();
    };
    this.followerUI.onCommand = (command) => {
      this.followerSystem.commandFollower(command);
      this._refreshFollowerUI();
    };
    this.followerUI.onClose = () => {
      this.interactionSystem.isBlocked = false;
      this.canvas.requestPointerLock();
      this.player.camera.attachControl(this.canvas, true);
    };

    // ── Active Effects HUD ──────────────────────────────────────────────────
    this.activeEffectHUD = new ActiveEffectHUD();
    this.activeEffectHUD.show();

    // ── Quick Slot HUD ────────────────────────────────────────────────────
    this.quickSlotHUD = new QuickSlotHUD();
    // Quick-slot assign mode: clicking a HUD slot opens the inventory; the
    // next consumable clicked there is bound to that slot.
    this.quickSlotHUD.onAssign = (key, _currentItemId) => {
      if (this.isPaused || this.mapEditorSystem.isEnabled || this.dialogueSystem.isInDialogue) return;
      this._quickSlotAssignKey = key;
      this.ui.showNotification(`Pick a consumable in your inventory for slot ${key}.`, 3000);
      if (!this.inventorySystem.isOpen) {
        this.inventorySystem.toggleInventory();
        this.interactionSystem.isBlocked = true;
        document.exitPointerLock();
        this.player.camera.detachControl();
      }
    };
    // Leaving the inventory cancels a pending quick-slot assignment.
    this.ui.onInventoryClosed = () => { this._quickSlotAssignKey = null; };
    this.quickSlotHUD.show();
    this.quickSlotHUD.update(this.quickSlotSystem);

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

    // ── UI animations (Motion library) ─────────────────────────────────────────
    const uiAnimator = new UIAnimator();
    this.levelUpUI.setAnimator(uiAnimator);
    this.spellMakingUI.setAnimator(uiAnimator);
    this.guardEncounterUI.setAnimator(uiAnimator);
    this.saddlebagUI.setAnimator(uiAnimator);

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
      this.saveSystem.markDirty();
      this.ui.showNotification(
        `+${xp} XP  |  Fame: ${this.fameSystem.fame} (${this.fameSystem.fameLabel})`, 3000
      );
    };
    this.questSystem.onQuestFailed = () => {
      this.saveSystem.markDirty();
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
        this.saveSystem.markDirty();
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

    // Hit-stop effect wired to FixedStepLoop
    this.ui.onHitStopRequested = (durationMs) => {
      this._gameplayLoop.timeScale = 0.05; // heavy slow-mo
      setTimeout(() => {
        this._gameplayLoop.timeScale = 1.0;
      }, durationMs);
    };

    // Level-up awards attribute points
    this.player.onLevelUp = (_newLevel) => {
      // Combat XP level-up — no notification (spam). Character level-up
      // fires via onLevelUpComplete and shows the meaningful notification.
      this.attributeSystem.awardLevelUpPoints(1);
      this.saveSystem.markDirty();
      // Sync magic damage bonus after level-up attribute award
      this.spellSystem.magicDamageBonus = this.attributeSystem.magicDamageBonus;
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
        { id: "potion_hp_01", name: "Health Potion", description: "Restores 50 health.", stackable: true, quantity: 5, weight: 0.3, stats: { ...HEALTH_POTION_STATS } },
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
        { id: "potion_hp_01", name: "Health Potion", description: "Restores 50 health.", stackable: true, quantity: 8, weight: 0.3, stats: { ...HEALTH_POTION_STATS } },
        { id: "arrow_bundle", name: "Arrows (20)", description: "A bundle of iron arrows.", stackable: true, quantity: 4, weight: 1, stats: { value: 15 } },
        { id: "bread", name: "Loaf of Bread", description: "Hearty bread. Restores hunger.", stackable: true, quantity: 6, weight: 0.2, stats: { value: 5, nutrition: 30 } },
        { id: "ale", name: "Mug of Ale", description: "Watered-down but filling.", stackable: true, quantity: 6, weight: 0.4, stats: { value: 4, nutrition: 15 } },
        { id: "stew", name: "Bowl of Stew", description: "Hot and hearty. Restores a lot of hunger.", stackable: true, quantity: 4, weight: 0.5, stats: { value: 8, nutrition: 50 } },
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
        { id: "potion_hp_01", name: "Health Potion", description: "Restores 50 health.", stackable: true, quantity: 12, weight: 0.3, stats: { ...HEALTH_POTION_STATS } },
      ],
      gold: 520,
      priceMultiplier: 1.2,
      isOpen: true,
      openHour: 9,
      closeHour: 18,
    });

    const starterShops: ShopDef[] = [
      {
        id: "shop_trader_elan",
        name: "Trader Elan's Stall",
        type: "general",
        merchantId: "merchant_01",
        factionId: "town",
        openHour: 8,
        closeHour: 20,
        description: "Roadside trader with potions and arrows.",
      },
      {
        id: "shop_village_general",
        name: "Village General Goods",
        type: "general",
        merchantId: "merchant_general_01",
        factionId: "merchants_guild",
        openHour: 7,
        closeHour: 21,
      },
      {
        id: "shop_roadside_arms",
        name: "Roadside Arms",
        type: "weapons",
        merchantId: "merchant_weapons_01",
        factionId: "merchants_guild",
        openHour: 8,
        closeHour: 19,
      },
      {
        id: "shop_shield_hauberk",
        name: "Shield & Hauberk",
        type: "armor",
        merchantId: "merchant_armor_01",
        factionId: "merchants_guild",
        openHour: 8,
        closeHour: 19,
      },
      {
        id: "shop_stillwater_reagents",
        name: "Stillwater Reagents",
        type: "alchemist",
        merchantId: "merchant_alchemist_01",
        factionId: "mages_college",
        openHour: 9,
        closeHour: 18,
      },
    ];
    this.shopSystem.registerAll(starterShops);

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

    // ── Container loot ────────────────────────────────────────────────────
    this.containerSystem.onContainerOpen = () => {
      this._containerUI.show();
      this._containerUI.update(this.containerSystem);
      this._suspendGameplayInput();
    };
    this._containerUI.onTakeItem = (itemId) => {
      const active = this.containerSystem.activeContainer;
      if (!active) return;
      if (this.containerSystem.takeItem(active.id, itemId)) {
        this.saveSystem.markDirty();
      }
      this._containerUI.update(this.containerSystem);
      if (this.containerSystem.activeContainer?.contents.length === 0) {
        this._closeContainerUI();
      }
    };
    this._containerUI.onTakeAll = () => {
      const active = this.containerSystem.activeContainer;
      if (active) this.containerSystem.takeAll(active.id);
      this.saveSystem.markDirty();
      this._closeContainerUI();
    };
    this._containerUI.onClose = () => this._closeContainerUI();
    this.interactionSystem.containerSystem = this.containerSystem;

    // Prevent browser context menu from capturing right-click combat input.
    this.canvas.addEventListener("contextmenu", (event) => event.preventDefault());

    // Wire quest event callbacks
    this.combatSystem.onNPCDeath = (name, xp, npc) => {
        // Bandit Bounty: activate on the first bandit kill so that kill counts.
        if (!this._banditQuestStarted && this._toFrameworkTargetId(name) === "Bandit") {
            this._banditQuestStarted = true;
            this.frameworkRuntime.questEngine.activateQuest("quest_bandit_bounty");
            this.ui.showNotification("📜 New quest: Bandit Bounty — bring proof to collect.", 3500);
        }
        // Murder: killing a non-hostile settlement NPC is a crime; witnessed
        // kills post a bounty and nearby guards will challenge the player.
        if (this._isSettlementNpc(npc)) {
            this.crimeSystem.commitCrime("murder", npc.factionId ?? "village_guard", this.timeSystem.elapsedGameTime);
        }
        this.questSystem.onKill(name);
        this._applyFrameworkQuestEvent("kill", this._toFrameworkTargetId(name));
        // Killing someone a quest needed alive fails the dependent quests.
        this._failQuestsForDeadTarget(name, this._toFrameworkTargetId(name));
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

        // Elites (dragons, bandit chiefs) drop tiered gear from the leveled
        // lists — the reward scales with the player's level.
        if (/^(DragonBoss|Bandit Chief)/.test(npc.mesh.name)) {
            const listId = Math.random() < 0.6 ? "ll_weapon_melee" : "ll_armor_heavy";
            const resolved = this.leveledListSystem.resolve(listId, this.player.level);
            const template = resolved.value ? LEVEL_ITEM_TEMPLATES[resolved.value] : undefined;
            if (template) {
                const eliteDropPos = npc.mesh.position.clone();
                eliteDropPos.y += 0.6;
                new Loot(this.scene, eliteDropPos, {
                    id: resolved.value!,
                    name: template.name,
                    description: template.description,
                    stackable: false,
                    quantity: 1,
                    weight: template.weight,
                    slot: template.slot as any,
                    stats: { ...template.stats },
                });
                this.ui.showNotification(`The elite drops ${template.name}!`, 2600);
            }
        }

        // Slaying a dragon absorbs its soul and echoes a new Word of Power
        // into the player's mind (unlock it in the shouts panel [N]).
        if (/^DragonBoss/.test(npc.mesh.name)) {
            this.dragonShoutSystem.gainDragonSoul();
            this._learnNextWordOfTheVoice();
            this.saveSystem.markDirty();
        }
    };
    this.projectileSystem.onNPCDeath = this.combatSystem.onNPCDeath;
    this.combatSystem.onNpcDamaged = (npc) => {
        // Assault: attacking non-hostile settlement NPCs is a crime.
        // Debounced so a multi-hit combo doesn't stack five bounties.
        if (npc.isDead || !this._isSettlementNpc(npc)) return;
        const nowMs = performance.now();
        if (nowMs - this._lastAssaultCrimeMs < 3000) return;
        this._lastAssaultCrimeMs = nowMs;
        this.crimeSystem.commitCrime("assault", npc.factionId ?? "village_guard", this.timeSystem.elapsedGameTime);
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
        this.saveSystem.markDirty();
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
      this._currentDialogueNpcName = null;
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
        stats: { ...HEALTH_POTION_STATS }
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

    // ── Fantasy weapon loot (with CDN 3D model overlays) ─────────────────
    // Each weapon is a standard Loot sphere for physics/pickup, with a
    // BabylonJS Assets CDN model parented to it as the visual representation.
    const _placeWeaponLoot = (
      lootPos: Vector3,
      item: { id: string; name: string; description: string; slot: string; stats: Record<string, number> },
      assetKey: "runeSword" | "frostAxe" | "moltenDagger",
      modelScale: number,
      modelOffsetY: number,
    ) => {
      const loot = new Loot(this.scene, lootPos, { ...item, stackable: false, quantity: 1 });
      // Dim the sphere so the CDN model is the main visual
      (loot.mesh.material as any).alpha = 0.0;
      this.fantasyAssets.getInstance(assetKey, (root) => {
        if (!root) {
          // Fallback: restore sphere visibility
          (loot.mesh.material as any).alpha = 1.0;
          return;
        }
        root.parent   = loot.mesh;
        root.position = new Vector3(0, modelOffsetY, 0);
        root.scaling.setAll(modelScale);
        this.shadowGenerator?.addShadowCaster(root, true);
      });
      return loot;
    };

    _placeWeaponLoot(
      new Vector3(3, 1, 3),
      { id: "rune_sword_01", name: "Runesword", description: "A blade etched with glowing runes. +22 Damage, +8 Magicka.", slot: "mainHand", stats: { damage: 22, magicka: 8 } },
      "runeSword", 0.6, -0.2,
    );

    _placeWeaponLoot(
      new Vector3(9, 1, 4),
      { id: "frost_axe_01", name: "Frost Axe", description: "A frost-enchanted axe. +18 Damage, +12 frost resist.", slot: "mainHand", stats: { damage: 18, frostResist: 12 } },
      "frostAxe", 0.55, -0.15,
    );

    _placeWeaponLoot(
      new Vector3(5, 1, 10),
      { id: "molten_dagger_01", name: "Molten Dagger", description: "Forged in volcanic glass. +14 Damage, 5 fire DoT.", slot: "mainHand", stats: { damage: 14, fireDot: 5 } },
      "moltenDagger", 0.5, -0.1,
    );

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
            this._inputAdapter.handlePointerEvent(pointerInfo.event.button, "down");
            if (pointerInfo.event.button === 2) {
                pointerInfo.event.preventDefault();
            }
        } else if (pointerInfo.type === PointerEventTypes.POINTERUP) {
            this._inputAdapter.handlePointerEvent(pointerInfo.event.button, "up");
            // Release bow on left mouse up when arrow is drawn
            if (pointerInfo.event.button === 0 && this.projectileSystem.isDrawing) {
                const fired = this.projectileSystem.releaseArrow();
                if (fired) this.audioSystem.playMeleeAttack();
            }
        }
    });

    // Input handling for pause
    this.scene.onKeyboardObservable.add((kbInfo) => {
        this._keyConsumedByAdapter = false;

        // Forward key events through the input adapter for decoupled action dispatch
        if (kbInfo.type === KeyboardEventTypes.KEYDOWN || kbInfo.type === KeyboardEventTypes.KEYUP) {
            const phase = kbInfo.type === KeyboardEventTypes.KEYDOWN ? "down" : "up";
            if (this.mapEditorSystem.isEnabled && !Game._EDITOR_ADAPTER_KEYS.has(kbInfo.event.key)) {
                // Editor mode: let the legacy editor branches see every chord;
                // clear stuck held-actions (sprint, bow draw, …) as we skip.
                this._inputAdapter.reset();
            } else {
                const handled = this._inputAdapter.handleKeyEvent(
                    kbInfo.event.key,
                    phase,
                    { shift: kbInfo.event.shiftKey, ctrlOrMeta: kbInfo.event.ctrlKey || kbInfo.event.metaKey },
                );
                if (handled !== null) {
                    this._keyConsumedByAdapter = true;
                    kbInfo.event.preventDefault();
                    return;
                }
            }
        }

        if (kbInfo.type === KeyboardEventTypes.KEYDOWN) {
            if (kbInfo.event.key === " " || kbInfo.event.code === "Space") {
                const keyEv = kbInfo.event as KeyboardEvent;
                if (!keyEv.repeat && this._tryAdvanceOnboardingTutorial()) {
                    kbInfo.event.preventDefault();
                }
            } else if (kbInfo.event.key === "Escape") {
                if (this._inCharacterCreation) return;
                if (this.dialogueSystem.isInDialogue) { this.dialogueSystem.endDialogue(); return; }

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
                    this._refreshHelpOverlayIfVisible();
                } else if (this.characterSheetUI.isVisible) {
                    this.characterSheetUI.hide();
                    this.ui.setCharacterSheetOpen(false);
                    this.interactionSystem.isBlocked = false;
                    this.canvas.requestPointerLock();
                    this.player.camera.attachControl(this.canvas, true);
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
                } else if (this._containerUI.isVisible) {
                    this._containerUI.onClose?.();
                } else if (this.fastTravelUI.isVisible) {
                    this.fastTravelUI.close();
                } else if (this.petUI.isVisible) {
                    this.petUI.close();
                    this.interactionSystem.isBlocked = false;
                    this.canvas.requestPointerLock();
                    this.player.camera.attachControl(this.canvas, true);
                } else if (this.followerUI.isVisible) {
                    this.followerUI.close();
                    this.interactionSystem.isBlocked = false;
                    this.canvas.requestPointerLock();
                    this.player.camera.attachControl(this.canvas, true);
                } else if (this.shoutUI.isVisible) {
                    this.shoutUI.close();
                    this.interactionSystem.isBlocked = false;
                    this.canvas.requestPointerLock();
                    this.player.camera.attachControl(this.canvas, true);
                } else if (this.pickpocketUI.isVisible) {
                    this._pickpocketTargetId = null;
                    this.pickpocketUI.hide();
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
                } else if (this.worldBuilderUI.isVisible) {
                    this.worldBuilderUI.close();
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
                } else if (this.graphicsSettingsUI.isVisible) {
                    this.graphicsSettingsUI.hide();
                    this.graphicsSettingsUI.onClose?.();
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
            } else if (kbInfo.event.key === "Tab") {
                const tabEv = kbInfo.event as KeyboardEvent;
                if (tabEv.repeat) return;
                tabEv.preventDefault();
                if (this.characterSheetUI.isVisible) {
                    this.characterSheetUI.hide();
                    this.ui.setCharacterSheetOpen(false);
                    if (!this.mapEditorSystem.isEnabled && !this.isPaused) {
                        this.interactionSystem.isBlocked = false;
                        this.canvas.requestPointerLock();
                        this.player.camera.attachControl(this.canvas, true);
                    }
                    return;
                }
                if (
                    this.isPaused ||
                    this.dialogueSystem.isInDialogue ||
                    this.mapEditorSystem.isEnabled ||
                    this.levelUpUI.isVisible ||
                    this.inventorySystem.isOpen ||
                    this.questSystem.isLogOpen ||
                    this.skillTreeSystem.isOpen ||
                    this.ui.isAttributePanelOpen ||
                    this.guardEncounterUI.isVisible ||
                    this.spellMakingUI.isVisible ||
                    this._barterUI.isVisible ||
                    this._containerUI.isVisible ||
                    this.fastTravelUI.isVisible ||
                    this.stableUI.isVisible ||
                    this.saddlebagUI.isVisible ||
                    this.petUI.isVisible ||
                    this.followerUI.isVisible ||
                    this.shoutUI.isVisible ||
                    this.pickpocketUI.isVisible ||
                    this.interactionSystem.isBlocked
                ) {
                    return;
                }
                this._refreshCharacterSheet();
                this.characterSheetUI.show();
                this.ui.setCharacterSheetOpen(true);
                this.interactionSystem.isBlocked = true;
                document.exitPointerLock();
                this.player.camera.detachControl();
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
                        // Weapon-skill XP is awarded inside CombatSystem on hit.
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
                    this._openFastTravelMenu();
                }
            } else if (kbInfo.event.key === "c" || kbInfo.event.key === "C") {
                // Toggle crouch / stealth
                if (!this.isPaused && !this.dialogueSystem.isInDialogue) {
                    const crouching = this.stealthSystem.toggleCrouch();
                    this.ui.showNotification(crouching ? "Sneaking..." : "Standing", 1200);
                    this._advanceOnboardingStep("sneak");
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
                if (kbInfo.event.shiftKey) {
                    // Shift+F4 → World Builder
                    if (this.worldBuilderUI.isVisible) {
                        this.worldBuilderUI.close();
                    } else {
                        this.worldBuilderUI.open();
                        this.interactionSystem.isBlocked = true;
                        document.exitPointerLock();
                        this.player.camera.detachControl();
                    }
                } else {
                    if (!this.mapEditorSystem.isEnabled) return;
                    this.mapEditorSystem.exportToFile();
                    this.ui.showNotification("Map exported to file", 2000);
                }
            } else if (
                (kbInfo.event.key === "w" || kbInfo.event.key === "W") &&
                (kbInfo.event.ctrlKey || kbInfo.event.metaKey) &&
                kbInfo.event.shiftKey
            ) {
                // Ctrl+Shift+W → World Builder
                if (this.worldBuilderUI.isVisible) {
                    this.worldBuilderUI.close();
                } else {
                    this.worldBuilderUI.open();
                    this.interactionSystem.isBlocked = true;
                    document.exitPointerLock();
                    this.player.camera.detachControl();
                }
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
                      this._suspendGameplayInput();
                    } else {
                      this._restoreGameplayInput();
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
            } else if (kbInfo.event.key === "PrintScreen") {
                this.screenshotSystem.download(this.canvas);
                this.ui.showNotification("Screenshot saved", 1500);
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
    this.ui.exportButton.onPointerUpObservable.add(() => {
      // Export the CURRENT state, not the last persisted one.
      this.saveSystem.save(true);
      this.saveSystem.exportToFile();
    });
    this.ui.importButton.onPointerUpObservable.add(() => this._openSaveImportPicker());
    this.ui.settingsButton?.onPointerUpObservable.add(() => {
      this.graphicsSettingsUI.show(
        this.graphics.tier,
        this._difficulty,
        this.audioSystem.isMuted,
        this.audioSystem.masterVolume,
        this._cameraSensitivity,
      );
    });
    this.ui.quitButton.onPointerUpObservable.add(() => window.location.reload());

    // Wire decoupled input adapter after all systems are initialized
    this._wireInputAdapter();
    this._gamepadInput.connect();

    // Game loop logic will go here
    this.scene.onBeforeRenderObservable.add(() => {
        this.update();
    });
  }

  /** Currently pending quick-slot assign mode (HUD slot clicked, awaiting an inventory pick). */
  private _quickSlotAssignKey: QuickSlotKey | null = null;

  /**
   * Assign-mode click: bind the clicked consumable to the pending quick-slot.
   * @returns true when the click was consumed by assign mode.
   */
  private _tryAssignQuickSlotFromClick(item: Item): boolean {
      const key = this._quickSlotAssignKey;
      if (!key) return false;
      if (!isConsumableItem(item)) {
          this.ui.showNotification(`${item.name} is not a consumable — pick a potion or food.`, 2400);
          return true;
      }
      this.quickSlotSystem.bindSlot(key, item.id);
      this._quickSlotAssignKey = null;
      this.quickSlotHUD.update(this.quickSlotSystem);
      this.ui.showNotification(`Slot ${key} bound to ${item.name}.`, 2200);
      this.saveSystem.markDirty();
      return true;
  }

  /**
   * Open a browser file picker and import the chosen save JSON
   * (pause menu → Import Save).  Must run inside the button's user gesture.
   */
  private _openSaveImportPicker(): void {
      if (typeof document === "undefined") return;
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json,application/json";
      input.style.display = "none";
      const cleanup = () => input.remove();
      input.addEventListener("change", () => {
          const file = input.files?.[0];
          if (file) void this.saveSystem.importFromFile(file);
          cleanup();
      });
      input.addEventListener("cancel", cleanup);
      document.body.appendChild(input);
      input.click();
  }

  private _wireInputAdapter(): void {
    const adapter = this._inputAdapter;

    // Combat
    adapter.onAction("meleeAttack", () => {
      if (!this._isCombatInputBlocked()) {
        if (this.combatSystem.activeWeaponArchetype === "bow") {
          const drawing = this.projectileSystem.beginDraw();
          if (drawing) this.stealthSystem.pushNoise(0.4);
        } else {
          const attacked = this.combatSystem.meleeAttack();
          // Weapon-skill XP is awarded inside CombatSystem on hit (correct skill for blade/blunt).
          if (attacked) {
            this.audioSystem.playMeleeAttack();
          }
        }
      }
    });
    adapter.onAction("powerAttack", () => {
      if (!this._isCombatInputBlocked()) {
        const powered = this.combatSystem.powerAttack();
        if (powered) {
          this.audioSystem.playMeleeAttack();
        }
      }
    });
    adapter.onAction("dodgeRoll", () => {
      if (!this._isCombatInputBlocked()) {
        this.combatSystem.tryDodgeRoll();
      }
    });
    adapter.onAction("block", () => {
      if (!this._isCombatInputBlocked()) this.combatSystem.beginBlock();
    });
    adapter.onAction("blockRelease", () => {
      this.combatSystem.endBlock();
    });
    adapter.onAction("castSpell", () => {
      if (this._isCombatInputBlocked()) return;

      // KEYUP = release staff charge
      if (!this._inputAdapter.isActive("castSpell")) {
        if (this.combatSystem.isChargingStaff) {
          const fired = this.combatSystem.releaseStaffCharge();
          // Destruction XP is awarded inside CombatSystem on a successful hit.
          void fired;
        }
        return;
      }

      // KEYDOWN = cast or begin charge
      if (this.combatSystem.activeWeaponArchetype === "staff") {
        this.combatSystem.beginStaffCharge();
      } else {
        this.spellSystem.castSpell();
      }
    });
    adapter.onAction("cycleSpell", () => {
      if (!this.isPaused && !this.dialogueSystem.isInDialogue) {
        const spells = this.spellSystem.knownSpells;
        if (spells.length > 0) {
          const current = this.spellSystem.equippedSpell;
          const idx = current ? spells.findIndex(s => s.id === current.id) : -1;
          const next = spells[(idx + 1) % spells.length];
          this.spellSystem.equipSpell(next.id);
        }
      }
    });
    adapter.onAction("drawBow", () => {
      if (!this._isCombatInputBlocked()) {
        const drawing = this.projectileSystem.beginDraw();
        if (drawing) this.stealthSystem.pushNoise(0.4);
      }
    });
    adapter.onAction("releaseBow", () => {
      if (this.projectileSystem.isDrawing) {
        const fired = this.projectileSystem.releaseArrow();
        if (fired) this.audioSystem.playMeleeAttack();
      }
    });
    adapter.onAction("racialPower", () => {
      if (!this._isCombatInputBlocked()) {
        const race = this.raceSystem.chosenRace;
        if (!race?.power) {
          this.ui.showNotification("No racial power available.", 2000);
        } else if (!this.raceSystem.canActivatePower(this.timeSystem.gameTime)) {
          const mins = Math.ceil(this.raceSystem.powerCooldownRemaining(this.timeSystem.gameTime));
          this.ui.showNotification(`${race.power.name} is recharging (${mins} game-minutes remaining).`, 2500);
        } else {
          this.raceSystem.activatePower(this.timeSystem.gameTime, this.activeEffectsSystem);
        }
      }
    });

    // Movement
    adapter.onAction("toggleCrouch", () => {
        if (!this.isPaused && !this.dialogueSystem.isInDialogue) {
        const crouching = this.stealthSystem.toggleCrouch();
        this.ui.showNotification(crouching ? "Sneaking..." : "Standing", 1200);
        this._advanceOnboardingStep("sneak");
      }
    });

    // UI panels — every toggle closes its own menu first, and only opens when
    // no other modal owns the screen (prevents stacked menus).
    adapter.onAction("toggleInventory", () => {
      if (this.inventorySystem.isOpen) {
        this.inventorySystem.toggleInventory();
        this._restoreGameplayInput();
        return;
      }
      if (this._isCombatInputBlocked()) return;
      this.inventorySystem.toggleInventory();
      this._suspendGameplayInput();
    });
    adapter.onAction("toggleQuestLog", () => {
      if (this.questSystem.isLogOpen) {
        this.questSystem.toggleQuestLog();
        this._restoreGameplayInput();
        return;
      }
      if (this._isCombatInputBlocked()) return;
      this.questSystem.toggleQuestLog();
      this._suspendGameplayInput();
    });
    adapter.onAction("toggleSkillTree", () => {
      if (this.skillTreeSystem.isOpen) {
        this.skillTreeSystem.toggle();
        this._restoreGameplayInput();
        return;
      }
      if (this._isCombatInputBlocked()) return;
      this.skillTreeSystem.toggle();
      this._suspendGameplayInput();
    });
    adapter.onAction("toggleAttributePanel", () => {
      if (this.ui.isAttributePanelOpen) {
        this.ui.toggleAttributePanel(false);
        this._restoreGameplayInput();
        return;
      }
      if (this._isCombatInputBlocked()) return;
      this.ui.toggleAttributePanel(true);
      this.ui.refreshAttributePanel(this.attributeSystem);
      this._suspendGameplayInput();
    });
    adapter.onAction("toggleAlchemy", () => {
      if (this.alchemyUI.isVisible) {
        this.alchemyUI.toggle(false);
        this._restoreGameplayInput();
        return;
      }
      if (this._isCombatInputBlocked()) return;
      this.alchemyUI.toggle(true);
      this._suspendGameplayInput();
    });
    adapter.onAction("toggleEnchanting", () => {
      if (this.enchantingUI.isVisible) {
        this.enchantingUI.toggle(false);
        this._restoreGameplayInput();
        return;
      }
      if (this._isCombatInputBlocked()) return;
      this.enchantingUI.toggle(true);
      this._suspendGameplayInput();
    });
    adapter.onAction("toggleSpellMaking", () => {
      if (this.spellMakingUI.isVisible) {
        this.spellMakingUI.close();
        return;
      }
      if (this._isCombatInputBlocked()) return;
      this.spellMakingUI.open();
      this._suspendGameplayInput();
    });
    adapter.onAction("toggleFastTravel", () => {
      if (this.fastTravelUI.isVisible) {
        this.fastTravelUI.close();
        return;
      }
      if (this._isCombatInputBlocked()) return;
      this._openFastTravelMenu();
    });
    adapter.onAction("markPosition", () => {
      if (this._isCombatInputBlocked()) return;
      const p = this.player.camera.position;
      this.markRecallSystem.mark({ x: p.x, y: p.y, z: p.z });
      this.saveSystem.markDirty();
    });
    adapter.onAction("togglePetPanel", () => {
      if (this.petUI.isVisible) {
        this.petUI.close();
        this._restoreGameplayInput();
        return;
      }
      if (this._isCombatInputBlocked()) return;
      if (!this.petSystem.hasPet) {
        this.ui.showNotification("You have no companions yet.", 2000);
        return;
      }
      this.petUI.open(this.petSystem.pets, this.petSystem.activePet?.id ?? null);
      this._suspendGameplayInput();
    });
    adapter.onAction("toggleFollowerPanel", () => {
      // In map-editor mode G cycles the gizmo (the adapter consumes the key
      // before the legacy editor branch can see it).
      if (this.mapEditorSystem.isEnabled) {
        const mode = this.mapEditorSystem.cycleGizmoMode();
        this.ui.showNotification(`Editor gizmo: ${mode}`, 1400);
        this._refreshEditorToolbar();
        return;
      }
      if (this.followerUI.isVisible) {
        this.followerUI.close();
        this._restoreGameplayInput();
        return;
      }
      if (this._isCombatInputBlocked()) return;
      const activeFollower = this.followerSystem.getActiveFollower();
      const deceasedIds: string[] = [];
      for (const templateId of this.followerSystem.registeredTemplateIds) {
        if (this.followerSystem.isFollowerDeceased(templateId)) {
          deceasedIds.push(templateId);
        }
      }
      const templates = this.followerSystem.registeredTemplateIds.map(id =>
        this.followerSystem.getFollowerTemplate(id)
      ).filter((t): t is NonNullable<typeof t> => t !== undefined);
      this.followerUI.open(templates, activeFollower, deceasedIds, this._getInventoryGold());
      this._suspendGameplayInput();
    });
    adapter.onAction("toggleShoutMenu", () => {
      if (this.shoutUI.isVisible) {
        this.shoutUI.close();
        this._restoreGameplayInput();
        return;
      }
      if (this._isCombatInputBlocked()) return;
      this.shoutUI.open(
        this._buildShoutViews(),
        this.dragonShoutSystem.dragonSouls,
        this.dragonShoutSystem.equippedShoutId,
      );
      this._suspendGameplayInput();
    });
    adapter.onAction("useShout", () => {
      if (this._isCombatInputBlocked()) return;
      const result = this.dragonShoutSystem.useShout(this.timeSystem.gameTime);
      if (result.success) return; // effects applied via onShoutUsed
      switch (result.reason) {
        case "no_shout_equipped":
          this.ui.showNotification("No shout equipped — open the shouts panel (N).", 2200);
          break;
        case "no_words_unlocked":
          this.ui.showNotification("That shout has no unlocked words — spend a dragon soul (N).", 2600);
          break;
        case "on_cooldown":
          this.ui.showNotification(`The Thu'um needs ${Math.ceil(result.cooldownRemainingSeconds ?? 0)}s to recover.`, 1800);
          break;
        default:
          break;
      }
    });
    adapter.onAction("toggleWaitDialog", () => {
      if (this.ui.isWaitDialogOpen) {
        this.ui.toggleWaitDialog(false);
        this._restoreGameplayInput();
        return;
      }
      if (this._isCombatInputBlocked()) return;
      this.ui.toggleWaitDialog(true);
      this._suspendGameplayInput();
    });
    adapter.onAction("mountDismount", () => {
      if (!this.isPaused && !this.dialogueSystem.isInDialogue) {
        if (this.horseSystem.isMounted) {
          this.horseSystem.dismountHorse();
        } else {
          const owned = this.horseSystem.ownedHorses;
          if (owned.length === 0) {
            this.ui.showNotification("You don't own a horse. Visit a stable (Shift+O).", 2500);
          } else {
            this.horseSystem.mountHorse(owned[0].id);
          }
        }
      }
    });
    adapter.onAction("stableOrSaddlebag", () => {
      if (!this.isPaused && !this.dialogueSystem.isInDialogue) {
        if (this.horseSystem.isMounted) {
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
          if (this.stableUI.isVisible) {
            this.stableUI.close();
          } else {
            const stable = this.horseSystem.getStableNPC("Stable Master");
            if (stable) {
              const horses = stable.availableHorseIds.map(id => {
                const h = this.horseSystem.getHorse(id)!;
                return {
                  id: h.id, name: h.name, speed: h.speed,
                  saddlebagCapacity: h.saddlebagCapacity, price: stable.prices[id] ?? 0, isOwned: h.isOwned,
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
      }
    });
    adapter.onAction("showFameStatus", () => {
      if (!this.isPaused && !this.dialogueSystem.isInDialogue) {
        const effects = this.activeEffectsSystem.activeEffects;
        const effectStr = effects.length > 0 ? `  Active effects: ${effects.map(e => e.name).join(", ")}` : "";
        const customSpellCount = this.spellMakingSystem.customSpells.length;
        const spellStr = customSpellCount > 0 ? `  Custom spells: ${customSpellCount}` : "";
        this.ui.showNotification(
          `Fame: ${this.fameSystem.fame} (${this.fameSystem.fameLabel})` +
          `  Infamy: ${this.fameSystem.infamy} (${this.fameSystem.infamyLabel})` +
          `  Sentences: ${this.jailSystem.totalSentences}${effectStr}${spellStr}`,
          4000,
        );
      }
    });

    // Quick-slots (1-0 all bound)
    const allQKeys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"] as const;
    for (const key of allQKeys) {
      const action = `quickSlot${key === "0" ? "0" : key}`;
      adapter.onAction(action as any, () => {
        if (!this._isCombatInputBlocked()) {
          this.quickSlotSystem.useSlot(key as any);
        }
      });
    }

    // Combat archetypes
    const archetypeMap: Record<string, () => void> = {
      archetype1: () => { if (!this.isPaused && !this.dialogueSystem.isInDialogue) this.combatSystem.setMeleeArchetype("duelist"); },
      archetype2: () => { if (!this.isPaused && !this.dialogueSystem.isInDialogue) this.combatSystem.setMeleeArchetype("soldier"); },
      archetype3: () => { if (!this.isPaused && !this.dialogueSystem.isInDialogue) this.combatSystem.setMeleeArchetype("bruiser"); },
      archetype4: () => { if (!this.isPaused && !this.dialogueSystem.isInDialogue) this.combatSystem.setMagicArchetype("spark"); },
      archetype5: () => { if (!this.isPaused && !this.dialogueSystem.isInDialogue) this.combatSystem.setMagicArchetype("bolt"); },
      archetype6: () => { if (!this.isPaused && !this.dialogueSystem.isInDialogue) this.combatSystem.setMagicArchetype("surge"); },
    };
    for (const [action, fn] of Object.entries(archetypeMap)) {
      adapter.onAction(action as any, fn);
    }

    // System
    adapter.onAction("pause", () => {
      // Character creation owns the screen — Escape must not unpause beneath it.
      if (this._inCharacterCreation) return;
      if (this.dialogueSystem.isInDialogue) return;
      if (this.levelUpUI.isVisible) return;
      if (this.guardEncounterUI.isVisible) { this._resolveGuardEncounter("resist_arrest"); return; }
      if (this.mapEditorSystem.isEnabled) {
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
        this._refreshHelpOverlayIfVisible();
        return;
      }
      if (this.characterSheetUI.isVisible) { this.characterSheetUI.hide(); this.ui.setCharacterSheetOpen(false); this._restoreGameplayInput(); return; }
      // Closing the inventory must clear isBlocked like the I-key path does.
      if (this.inventorySystem.isOpen) { this.inventorySystem.toggleInventory(); this._restoreGameplayInput(); return; }
      if (this.questSystem.isLogOpen) { this.questSystem.toggleQuestLog(); this._restoreGameplayInput(); return; }
      if (this.skillTreeSystem.isOpen) { this.skillTreeSystem.toggle(); this._restoreGameplayInput(); return; }
      if (this.ui.isAttributePanelOpen) { this.ui.toggleAttributePanel(false); this._restoreGameplayInput(); return; }
      if (this.alchemyUI.isVisible) { this.alchemyUI.toggle(false); this._restoreGameplayInput(); return; }
      if (this.enchantingUI.isVisible) { this.enchantingUI.toggle(false); this._restoreGameplayInput(); return; }
      if (this.spellMakingUI.isVisible) { this.spellMakingUI.close(); return; }
      if (this._barterUI.isVisible) { this._barterUI.onClose?.(); return; }
      if (this._containerUI.isVisible) { this._containerUI.onClose?.(); return; }
      if (this.fastTravelUI.isVisible) { this.fastTravelUI.close(); return; }
      if (this.petUI.isVisible) { this.petUI.close(); this._restoreGameplayInput(); return; }
      if (this.followerUI.isVisible) { this.followerUI.close(); this._restoreGameplayInput(); return; }
      if (this.pickpocketUI.isVisible) { this._pickpocketTargetId = null; this.pickpocketUI.hide(); this._restoreGameplayInput(); return; }
      if (this.stableUI.isVisible) { this.stableUI.close(); return; }
      if (this.saddlebagUI.isVisible) { this.saddlebagUI.close(); return; }
      if (this.graphicsSettingsUI.isVisible) { this.graphicsSettingsUI.hide(); this.graphicsSettingsUI.onClose?.(); return; }
      if (this.questCreatorUI.isVisible) { this.questCreatorUI.close(); this.canvas.requestPointerLock(); this.player.camera.attachControl(this.canvas, true); return; }
      if (this.dialogueCreatorUI.isVisible) { this.dialogueCreatorUI.close(); this.canvas.requestPointerLock(); this.player.camera.attachControl(this.canvas, true); return; }
      if (this.npcCreatorUI.isVisible) { this.npcCreatorUI.close(); this.canvas.requestPointerLock(); this.player.camera.attachControl(this.canvas, true); return; }
      if (this.itemCreatorUI.isVisible) { this.itemCreatorUI.close(); this.canvas.requestPointerLock(); this.player.camera.attachControl(this.canvas, true); return; }
      if (this.factionCreatorUI.isVisible) { this.factionCreatorUI.close(); this.canvas.requestPointerLock(); this.player.camera.attachControl(this.canvas, true); return; }
      if (this.lootTableCreatorUI.isVisible) { this.lootTableCreatorUI.close(); this.canvas.requestPointerLock(); this.player.camera.attachControl(this.canvas, true); return; }
      if (this.spawnCreatorUI.isVisible) { this.spawnCreatorUI.close(); this.canvas.requestPointerLock(); this.player.camera.attachControl(this.canvas, true); return; }
      if (this.contentBundleUI.isVisible) { this.contentBundleUI.close(); this.canvas.requestPointerLock(); this.player.camera.attachControl(this.canvas, true); return; }
      if (this.assetBrowserUI.isVisible) { this.assetBrowserUI.close(); this.canvas.requestPointerLock(); this.player.camera.attachControl(this.canvas, true); return; }
      if (this.bundleMergeUI.isVisible) { this.bundleMergeUI.close(); this.canvas.requestPointerLock(); this.player.camera.attachControl(this.canvas, true); return; }
      if (this.modManifestUI.isVisible) { this.modManifestUI.close(); this.canvas.requestPointerLock(); this.player.camera.attachControl(this.canvas, true); return; }
      if (this.editorHubUI.isVisible) { this.editorHubUI.close(); this._restoreGameplayInput(); return; }
      if (this.ui.isWaitDialogOpen) { this.ui.toggleWaitDialog(false); this._restoreGameplayInput(); return; }
      this.togglePause();
    });
    adapter.onAction("save", () => { if (!this.isPaused) this.saveSystem.save(); });
    adapter.onAction("load", () => { if (!this.isPaused) this.saveSystem.load(); });
    adapter.onAction("toggleMute", () => {
      this.audioSystem.toggleMute();
      this.ui.showNotification(this.audioSystem.isMuted ? "Audio muted" : "Audio unmuted", 1500);
    });
    adapter.onAction("toggleDebugOverlay", () => {
      const shown = this.ui.toggleDebugOverlay();
      this.ui.showNotification(shown ? "Debug overlay ON" : "Debug overlay OFF", 1200);
    });
    adapter.onAction("screenshot", () => {
      this.screenshotSystem.download(this.canvas);
      this.ui.showNotification("Screenshot saved", 1500);
    });
    adapter.onAction("helpOverlay", () => {
      this._toggleHelpOverlay();
    });
    adapter.onAction("toggleMapEditor", () => {
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
    });

    // ── Skyrim/Oblivion-style action handlers ─────────────────────────────
    adapter.onAction("jump", () => {
      // Space also advances the onboarding tutorial when active
      if (this._tryAdvanceOnboardingTutorial()) return;

      if (this._isCombatInputBlocked() || !this.player.camera.applyGravity) return;
      if (this.player.stamina >= 10) {
        this.player.stamina = Math.max(0, this.player.stamina - 10);
        this.player.notifyResourceSpent("stamina");
        this.player.camera.position.y += 3;
      }
    });

    adapter.onAction("sprint", () => {
      if (this._isCombatInputBlocked()) return;
      this.stealthSystem.movementMode = "running";
      if (this.stealthSystem.isCrouching) {
        this.stealthSystem.isCrouching = false;
      }
    });
    adapter.onAction("sprintRelease", () => {
      this.stealthSystem.movementMode = "walking";
    });

    adapter.onAction("autoRun", () => {
      if (this._isCombatInputBlocked()) return;
      this.ui.showNotification("Auto-run toggled", 1000);
    });

    adapter.onAction("interact", () => {
      if (this.dialogueSystem.isInDialogue) return;
      if (this.inventorySystem.isOpen) {
        this.inventorySystem.toggleInventory();
        // Closing with E must clear isBlocked exactly like the Escape path.
        this._restoreGameplayInput();
        return;
      }

      // A paused game or an open modal owns the screen: no world interaction
      // (and no E-jump fallback) may bleed through.
      if (this._isCombatInputBlocked()) return;

      // Skyrim-style: if nothing is within interact range, jump instead
      const interactHit = this._raycastInteract();
      if (interactHit) {
        this.interactionSystem.interact();
      } else if (this.player.camera.applyGravity && this.player.stamina >= 10) {
        this.player.stamina = Math.max(0, this.player.stamina - 10);
        this.player.notifyResourceSpent("stamina");
        this.player.camera.position.y += 3;
      }
    });

    adapter.onAction("readyWeapon", () => {
      if (this._isCombatInputBlocked()) return;
      if (this.combatSystem.activeWeaponArchetype === "bow" && this.projectileSystem.isDrawing) {
        const fired = this.projectileSystem.releaseArrow();
        if (fired) this.audioSystem.playMeleeAttack();
      }
      this.ui.showNotification("Weapon ready — switch with archetype keys (1-6)", 2000);
    });

    adapter.onAction("favoritesMenu", () => {
      if (!this.isPaused && !this.dialogueSystem.isInDialogue) {
        this.ui.showNotification("Favorites — assign with quick-slot keys (1-0)", 2500);
      }
    });

    adapter.onAction("togglePOV", () => {
      if (this.mapEditorSystem.isEnabled) return;
      if (!this.isPaused && !this.dialogueSystem.isInDialogue) {
        const curFov = this.player.camera.fov;
        this.player.camera.fov = curFov >= 1.8 ? 0.8 : 1.8;
        this.ui.showNotification(
          curFov >= 1.8 ? "First-person view" : "Third-person view",
          1200,
        );
      }
    });
  }

  togglePause(): void {
      this.isPaused = !this.isPaused;
      this.ui.togglePauseMenu(this.isPaused);

      if (this.isPaused) {
          this._gameplayLoop.reset();
          if (this.mapEditorSystem.isEnabled) {
              this.mapEditorSystem.toggle();
              this.mapEditorToolbar.hide();
              this.editorLayout.setVisible("hierarchy", false);
              this.editorLayout.setVisible("palette", false);
              this.editorLayout.setVisible("validation", false);
              this.editorLayout.setVisible("layers", false);
              this.editorLayout.setVisible("notes", false);
              this.editorLayout.setVisible("properties", false);
              this.editorLayout.clearSelection();
              this._refreshHelpOverlayIfVisible();
          }
          // Close any open overlays
          if (this.inventorySystem.isOpen) {
              this.inventorySystem.isOpen = false;
              this.ui.toggleInventory(false);
          }
          if (this.questSystem.isLogOpen) {
              this.questSystem.isLogOpen = false;
              this.ui.toggleQuestLog(false);
          }
          if (this.skillTreeSystem.isOpen) {
              this.skillTreeSystem.isOpen = false;
              this.ui.toggleSkillTree(false);
          }
          if (this.characterSheetUI.isVisible) {
              this.characterSheetUI.hide();
              this.ui.setCharacterSheetOpen(false);
          }
          if (this.alchemyUI.isVisible) { this.alchemyUI.toggle(false); }
          if (this.enchantingUI.isVisible) { this.enchantingUI.toggle(false); }
          if (this.spellMakingUI.isVisible) { this.spellMakingUI.close(); }
          if (this.fastTravelUI.isVisible) { this.fastTravelUI.close(); }
          if (this.petUI.isVisible) { this.petUI.close(); }
          if (this.followerUI.isVisible) { this.followerUI.close(); }
          if (this.shoutUI.isVisible) { this.shoutUI.close(); }
          if (this.pickpocketUI.isVisible) { this._pickpocketTargetId = null; this.pickpocketUI.hide(); }
          if (this.stableUI.isVisible) { this.stableUI.close(); }
          if (this.saddlebagUI.isVisible) { this.saddlebagUI.close(); }
          if (this.ui.isAttributePanelOpen) { this.ui.toggleAttributePanel(false); }
          if (this.ui.isWaitDialogOpen) { this.ui.toggleWaitDialog(false); }
          if (this._barterUI.isVisible) { this._barterUI.onClose?.(); }
          if (this._containerUI.isVisible) { this._containerUI.onClose?.(); }
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
    this._inCharacterCreation = true;
    this.isPaused = true;
    this.interactionSystem.isBlocked = true;
    this.ui.toggleCrosshair(false);
    document.exitPointerLock();
    this.player.camera.detachControl();

    const creator = new CharacterCreationUI();
    creator.setAnimator(this.uiAnimator);
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

    // Refresh current health/magicka/stamina to match max values after race/birthsign/class bonuses
    this.player.health   = this.attributeSystem.maxHealth;
    this.player.magicka  = this.attributeSystem.maxMagicka;
    this.player.stamina  = this.attributeSystem.maxStamina;
    // Add birthsign flat bonuses on top (Mage/Apprentice/Atronach magicka, Steed carry, etc.)
    const signBonuses = this.birthsignSystem.getStatBonuses();
    this.player.health   += signBonuses.maxHealth;
    this.player.magicka  += signBonuses.maxMagicka;
    this.player.stamina  += signBonuses.maxStamina;

    if (selection.worldSeed) {
      this.world.setSeed(selection.worldSeed);
    }

    persistSkipOnboardingTips(selection.skipGameplayTips);
    this._startOnboardingTutorialIfNeeded();
    this._inCharacterCreation = false;

    this.ui.showNotification(`Welcome, ${this.player.name}! Character creation complete.`, 2800);
    this.interactionSystem.isBlocked = false;
    this.isPaused = false;
    this.ui.toggleCrosshair(true);
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
    // Space must never skip a tip while any blocking overlay owns the screen.
    // `_isCombatInputBlocked()` covers pause, dialogue, editor, inventory, quest
    // log, skill tree, level-up, guard encounter, spellmaking, barter, container,
    // fast travel, stable, saddlebag, pet, pickpocket, character sheet, graphics
    // settings, and any overlay that sets `interactionSystem.isBlocked`.
    if (this._isCombatInputBlocked()) return false;
    if (
      this.ui.isAttributePanelOpen ||
      this.ui.isWaitDialogOpen ||
      this.alchemyUI.isVisible ||
      this.enchantingUI.isVisible ||
      this.spellMakingUI.isVisible ||
      this.editorHubUI.isVisible
    ) {
      return false;
    }
    this._onboardingTutorial.advance();
    return true;
  }

  /**
   * Auto-advance the onboarding tutorial when the player performs the action
   * the active step teaches (e.g. crouching during the sneak step).
   */
  private _advanceOnboardingStep(stepId: string): void {
    if (this._onboardingTutorial.isActive && this._onboardingTutorial.currentStep?.id === stepId) {
      this._onboardingTutorial.advance();
    }
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
      id: "sneak",
      message: "Press C to crouch and sneak. Stay undetected and press E behind an NPC to pickpocket.",
      advanceHint: "Try crouching with C, or press Space to continue.",
    });
    this._onboardingTutorial.addStep({
      id: "quests",
      message: "Press J to open the quest log and track objectives.",
      advanceHint: "Open the log with J, or press Space to finish tips.",
    });

    this._onboardingTutorial.start();
  }

  /**
   * Attach a persistent gear button (⚙) to the DOM that opens the graphics
   * settings dialog.  The button is always visible so players can adjust
   * quality without a keyboard shortcut.
   */
  private _wireGraphicsSettingsButton(): void {
    if (typeof document === "undefined") return;
    const btn = document.createElement("button");
    btn.className = "graphics-settings-btn";
    btn.setAttribute("aria-label", "Open graphics settings");
    btn.textContent = "⚙";
    btn.addEventListener("click", () => {
      if (this._inCharacterCreation || this.graphicsSettingsUI.isVisible || this._isCombatInputBlocked()) return;
      this.graphicsSettingsUI.show(
        this.graphics.tier,
        this._difficulty,
        this.audioSystem.isMuted,
        this.audioSystem.masterVolume,
        this._cameraSensitivity,
      );
      this._suspendGameplayInput();
    });
    document.body.appendChild(btn);
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
    // update() keeps it offset from the player so the frustum stays centred.
    sun.position  = new Vector3(80, 120, 50);
    this._sunLight = sun;

    // Shadows are driven by the active graphics quality tier.
    if (this.graphics.performance.shadowsEnabled) {
      const shadows = new ShadowGenerator(this.graphics.shadow.mapSize, sun);
      shadows.useBlurExponentialShadowMap = this.graphics.performance.softShadows;
      shadows.blurKernel = this.graphics.shadow.blurKernel;
      shadows.bias = 0.0005;
      // Halve the shadow-map render rate — a one-frame-old shadow is
      // imperceptible and the caster pass is a large share of frame time.
      if (shadows.getShadowMap()) {
        shadows.getShadowMap()!.refreshRate = 2;
      }
      this.shadowGenerator = shadows;
    } else {
      this.shadowGenerator = null;
    }

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
    // Skip on WebGPU (driver incompatibilities) and when the active quality
    // tier disables post-processing entirely (e.g. the "low" preset).
    if (this.engine.name !== "WebGPU" && this.graphics.performance.postProcessEnabled) {
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
      pipeline.sharpenEnabled = pp.sharpenEdgeAmount > 0;
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
      pipeline.imageProcessing.colorCurvesEnabled = false;

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

  /**
   * True when the victim is a non-hostile settlement NPC (villager, merchant,
   * guard…) whose death counts as murder. Structure guards (Ruin/Tower),
   * dragon bosses, and anything already aggressive are excluded.
   */
  private _isSettlementNpc(npc: NPC): boolean {
      // Natural hostiles are never "settlement" victims, whatever their state.
      if (npc.factionId === "bandits") return false;
      if (/^(RuinGuard|TowerGuard|DragonBoss)/.test(npc.mesh.name)) return false;
      // Actively fighting NPCs are combat kills; suspicion (ALERT after
      // spotting a sneaking player) does NOT make a civilian kill lawful.
      if (
          npc.aiState === AIState.CHASE ||
          npc.aiState === AIState.ATTACK ||
          npc.aiState === AIState.FLEE
      ) return false;
      return true;
  }

  /**
   * Spawn an archetype NPC and register it as chunk-scoped world content:
   * schedule/combat/stealth/crime systems (shared NPC list), level scaling,
   * LOD culling, and disposal with its chunk via `chunkRecord`.
   */
  private _spawnArchetypeNpc(
      archetypeId: string,
      chunkRecord: { npcs: NPC[] },
      x: number,
      z: number,
  ): boolean {
      const npc = this.npcArchetypeSystem.spawnNpc(archetypeId, this.scene, new Vector3(x, 2, z));
      if (!npc) return false;
      this.scheduleSystem.addNPC(npc);
      const cx = Math.floor(x / this.world.chunkSize);
      const cz = Math.floor(z / this.world.chunkSize);
      const reg = this.world.getRegionAt(cx, cz);
      this.levelScalingSystem?.scaleNPC(npc, this.player.level, reg?.dangerLevel);
      this._registerPickpocketInventory(npc);
      this.lodSystem.register(npc.mesh, 120);
      chunkRecord.npcs.push(npc);
      return true;
  }

  /** Map the equipped main-hand item to a combat weapon archetype (default: sword). */
  private _syncWeaponArchetype(): void {
      const weapon = this.equipmentSystem.getEquipped().get("mainHand");
      this.combatSystem.setWeaponArchetype(this._weaponArchetypeForItem(weapon));
  }

  private _weaponArchetypeForItem(item: Item | undefined): WeaponArchetype {
      if (!item) return "sword";
      const hay = `${item.id} ${item.name}`.toLowerCase();
      if (hay.includes("bow")) return "bow";
      if (hay.includes("staff")) return "staff";
      if (hay.includes("dagger")) return "dagger";
      if (hay.includes("greatsword") || hay.includes("great_") || hay.includes("two-handed") || hay.includes("two_handed")) return "greatsword";
      if (hay.includes("mace") || hay.includes("hammer")) return "mace";
      if (hay.includes("axe")) return "axe";
      return "sword";
  }

  private _toFrameworkInventoryItemId(itemId: string): string | null {
      if (itemId === "potion_hp_01") return "health_potion";
      if (itemId === "sword_01") return "iron_sword";
      if (itemId === "guard_token") return "guard_token";
      return null;
  }

  /**
   * Open an editor tool: suspends gameplay input, then dispatches to the
   * matching creator UI. Shared by the Editor Hub and Asset Browser Insert.
   */
  private _openEditorTool(tool: EditorToolId): void {
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
        case "worldBuilder":
          this.worldBuilderUI.open();
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
  }

  /**
   * Register shipped base content so the Asset Browser opens populated
   * instead of empty (bundle imports add to the same registry).
   */
  private _seedAssetBrowser(): void {
      const bundle = frameworkBaseContent;
      for (const d of bundle.dialogues) {
          this.assetBrowserSystem.register({
              id: d.id,
              name: `Dialogue: ${d.id}`,
              type: "dialogue",
              tags: ["dialogue"],
              description: `${d.nodes.length} dialogue nodes.`,
              dependencies: [],
          });
      }
      for (const q of bundle.quests) {
          this.assetBrowserSystem.register({
              id: q.id,
              name: q.name,
              type: "quest",
              tags: ["quest"],
              description: q.description ?? "",
              dependencies: [],
          });
      }
      for (const i of bundle.items) {
          this.assetBrowserSystem.register({
              id: i.id,
              name: i.name,
              type: "item",
              tags: ["item", ...(i.tags ?? [])],
              description: i.description,
              dependencies: [],
          });
      }
      for (const f of bundle.factions) {
          this.assetBrowserSystem.register({
              id: f.id,
              name: f.name,
              type: "faction",
              tags: ["faction"],
              description: f.description ?? "",
              dependencies: [],
          });
      }
      for (const n of bundle.npcArchetypes) {
          this.assetBrowserSystem.register({
              id: n.id,
              name: n.name,
              type: "npc",
              tags: ["npc", n.role],
              description: n.description ?? "",
              dependencies: [],
          });
      }
      this.editorHubUI.setBadge("assets", this.assetBrowserSystem.size);
  }

  /**
   * Fail quests that needed the killed NPC alive: framework quests with an
   * incomplete "talk" node targeting them, and legacy quests with a matching
   * incomplete talk objective. (E.g. killing the Guard fails "Parley with
   * the Guard" and "The Guard's Plea" while "Eliminate the Guard" completes.)
   */
  private _failQuestsForDeadTarget(npcName: string, frameworkTargetId: string): void {
      for (const questId of this.frameworkRuntime.questEngine.getActiveQuestIds()) {
          const definition = this.frameworkRuntime.questEngine.getQuestDefinition(questId);
          const state = this.frameworkRuntime.questEngine.getQuestState(questId);
          if (!definition || !state) continue;
          const neededAlive = definition.nodes.some(n =>
              n.triggerType === "talk" && n.targetId === frameworkTargetId &&
              !state.nodes[n.id]?.completed);
          if (neededAlive && this.frameworkRuntime.questEngine.failQuest(questId)) {
              this.ui.showNotification(`Quest failed: ${definition.name} — ${npcName} is dead.`, 4000);
          }
      }
      for (const quest of this.questSystem.getActiveQuests()) {
          const neededAlive = quest.objectives.some(o =>
              !o.completed && o.type === "talk" && o.targetId === npcName);
          if (neededAlive) this.questSystem.failQuest(quest.id);
      }
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
          // Quest rewards: gold and items declared on the quest definition.
          const definition = this.frameworkRuntime.questEngine.getQuestDefinition(update.questId);
          const gold = Math.max(0, Math.floor(definition?.rewardGold ?? 0));
          if (gold > 0) {
              this.inventorySystem.addItem({
                  id: GOLD_ITEM_ID,
                  name: "Gold Coins",
                  description: "Currency for trade and fines.",
                  stackable: true,
                  quantity: gold,
                  weight: 0.1,
                  stats: { value: 1 },
              });
              this._syncInventoryGoldToFramework();
              this.ui.showNotification(`Quest reward: +${gold} gold`, 2400);
          }
          for (const reward of definition?.rewardItems ?? []) {
              const quantity = Math.max(1, Math.floor(reward.quantity ?? 1));
              this._grantFrameworkItem(reward.itemId, quantity);
          }
          if (gold > 0 || (definition?.rewardItems?.length ?? 0) > 0) {
              this.saveSystem.markDirty();
          }
      }
  }

  // ── Thu'um: dragon shout helpers ──────────────────────────────────────────

  /**
   * Learn the next undiscovered Word of Power, walking the shout catalogue in
   * registration order.  Silent when every word is already known.
   */
  private _learnNextWordOfTheVoice(): void {
    for (const def of this.dragonShoutSystem.getAllShouts()) {
      for (let i = 0 as 0 | 1 | 2; i < def.words.length; i = (i + 1) as 0 | 1 | 2) {
        if (!this.dragonShoutSystem.isWordLearned(def.id, i)) {
          this.dragonShoutSystem.learnWord(def.id, i);
          return;
        }
      }
    }
  }

  /** Snapshot all registered shouts for the shouts panel. */
  private _buildShoutViews(): ShoutView[] {
    return this.dragonShoutSystem.getAllShouts().map((def) => {
      const learned: boolean[] = [];
      const unlocked: boolean[] = [];
      for (let i = 0 as 0 | 1 | 2; i < def.words.length; i = (i + 1) as 0 | 1 | 2) {
        learned.push(this.dragonShoutSystem.isWordLearned(def.id, i));
        unlocked.push(this.dragonShoutSystem.isWordUnlocked(def.id, i));
      }
      return { def, learned, unlocked };
    });
  }

  /**
   * Deliver a shout's tier effects to the world.  Called from
   * `dragonShoutSystem.onShoutUsed` after the headless system validated
   * cooldown and unlocked words.
   */
  private _applyShoutEffects(shoutId: string, tier: ShoutTierEffect): void {
    const def = this.dragonShoutSystem.getShout(shoutId);
    if (!def) return;
    const fx = tier.effects;
    const words = def.words.slice(0, this.dragonShoutSystem.getUnlockedTier(shoutId))
      .map(w => w!.dragonWord)
      .join(" ");
    this.ui.showNotification(`"${words}!" — ${tier.description}`, 2400);

    // Cone in front of the player: shouts are voice-borne, so they only reach
    // what the player is facing (generous 16u reach, ~75° half-angle).
    const forward = this.player.getForwardDirection(1);
    forward.y = 0;
    forward.normalize();
    const origin = this.player.camera.position;
    const inCone = (npc: NPC): boolean => {
      if (npc.isDead) return false;
      const toNpc = npc.mesh.position.subtract(origin);
      toNpc.y = 0;
      const dist = toNpc.length();
      if (dist > 16) return false;
      if (dist < 0.001) return true;
      return Vector3.Dot(forward, toNpc.scale(1 / dist)) > 0.25;
    };

    if (fx.knockback_force) {
      const staggerSeconds = fx.stagger_duration ?? 1.0;
      const impulseMag = fx.knockback_force / 10;
      for (const npc of this.combatSystem.npcs) {
        if (!inCone(npc)) continue;
        if (npc.physicsAggregate?.body) {
          npc.physicsAggregate.body.applyImpulse(
            forward.scale(impulseMag),
            npc.mesh.position,
          );
        }
        npc.isStaggered = true;
        npc.isAttackTelegraphing = false;
        npc.attackTelegraphTimer = 0;
        npc.staggerTimer = staggerSeconds;
        if (fx.knockback_damage) this._dealShoutDamage(npc, fx.knockback_damage, "physical");
      }
    }

    if (fx.dash_distance) {
      const wanted = Math.min(fx.dash_distance, 30);
      const flat = new Vector3(forward.x, 0, forward.z);
      if (flat.lengthSquared() > 0.001) {
        flat.normalize();
        // Stop short of any wall between the player and the dash target.
        const pick = this.player.raycastForward(wanted);
        const reach = pick?.hit ? Math.max(1, pick.distance - 0.8) : wanted;
        this.player.camera.position.addInPlace(flat.scale(reach));
      }
    }

    if (fx.ethereal_duration) {
      this.activeEffectsSystem.addEffect({
        id: `shout_ethereal_${Date.now()}`,
        name: "Become Ethereal",
        effectType: "resist_damage",
        magnitude: 100,
        duration: fx.ethereal_duration,
      });
    }

    if (fx.fire_damage) {
      for (const npc of this.combatSystem.npcs) {
        if (!inCone(npc)) continue;
        this._dealShoutDamage(npc, fx.fire_damage, "fire");
        if (fx.fire_dot_damage && fx.fire_dot_duration && !npc.isDead) {
          npc.applyStatusEffect({
            type: "burn",
            damagePerTick: fx.fire_dot_damage,
            tickInterval: 1,
            tickTimer: 1,
            remainingDuration: fx.fire_dot_duration,
          });
        }
      }
    }

    if (fx.freeze_duration) {
      // Ice Form freezes a single opponent — the closest one in the cone.
      let target: NPC | null = null;
      let bestDist = Infinity;
      for (const npc of this.combatSystem.npcs) {
        if (!inCone(npc)) continue;
        const d = Vector3.DistanceSquared(npc.mesh.position, origin);
        if (d < bestDist) { bestDist = d; target = npc; }
      }
      if (target) {
        target.applyStatusEffect({
          type: "freeze",
          damagePerTick: 0,
          tickInterval: 1,
          tickTimer: 1,
          remainingDuration: fx.freeze_duration,
        });
        target.isStaggered = true;
        target.isAttackTelegraphing = false;
        target.attackTelegraphTimer = 0;
        target.staggerTimer = fx.freeze_duration;
        if (fx.frost_damage) this._dealShoutDamage(target, fx.frost_damage, "frost");
      }
    }

    if (fx.time_scale && fx.slow_duration) {
      this._hostileTimeScale = fx.time_scale;
      this._slowTimeRemaining = fx.slow_duration;
    }

    if (fx.attack_speed_mult && fx.attack_speed_duration) {
      this.combatSystem.externalAttackSpeedMultiplier = fx.attack_speed_mult;
      this._attackSpeedBuffRemaining = fx.attack_speed_duration;
    }

    if (fx.clear_fog) {
      this.weatherSystem.forceWeather("clear");
    }
  }

  /**
   * Apply shout-originated damage through the shared resistance formula and
   * route kills exactly like arrows do (hostile-hit aggro + onNPCDeath).
   */
  private _dealShoutDamage(npc: NPC, rawDamage: number, damageType: DamageType): void {
    if (npc.isDead) return;
    const damage = applyDamageWithResistance(rawDamage, npc, damageType);
    npc.takeDamage(damage);
    this.combatSystem.notifyHostileHit(npc, damage);
    if (npc.isDead) {
      this.ui.showNotification(`${npc.mesh.name} defeated!`);
      this.combatSystem.onNPCDeath?.(npc.mesh.name, npc.xpReward, npc);
    }
  }

  /** Tick shout buff timers; expires Slow Time and Elemental Fury. */
  private _updateShoutBuffs(deltaTime: number): void {
    if (this._slowTimeRemaining > 0) {
      this._slowTimeRemaining = Math.max(0, this._slowTimeRemaining - deltaTime);
      if (this._slowTimeRemaining === 0) {
        this._hostileTimeScale = 1;
        this.ui.showNotification("Time resumes its flow.", 1600);
      }
    }
    if (this._attackSpeedBuffRemaining > 0) {
      this._attackSpeedBuffRemaining = Math.max(0, this._attackSpeedBuffRemaining - deltaTime);
      if (this._attackSpeedBuffRemaining === 0) {
        this.combatSystem.externalAttackSpeedMultiplier = 1;
        this.ui.showNotification("The fury of the wind fades.", 1600);
      }
    }
  }

  private _updateGameplayStep(deltaTime: number): void {
      this.player.update(deltaTime);
      this.audioSystem.updateFootsteps(deltaTime, this.player.camera.position);
      this.world.update(this.player.camera.position);

      this.timeSystem.update(deltaTime);
      this._updateDynamicWorldEventsOnHourChange();

      this.scheduleSystem.update(deltaTime);
      this.combatSystem.update(deltaTime);
      this._updateShoutBuffs(deltaTime);
      // Slow Time squeezes the NPC AI clock (movement, telegraphs, strikes).
      this.combatSystem.updateNPCAI(deltaTime * this._hostileTimeScale);

      for (const npc of this.scheduleSystem.npcs) {
        const hitReact = npc.justTakenDamageVisual;
        if (hitReact) npc.justTakenDamageVisual = false;
        // Animation LOD: beyond 100u a capsule is a few pixels and its loop
        // re-syncs from aiState on the next near update — skip the work.
        // Dead NPCs always route so death animations play.
        if (
          !npc.isDead &&
          !hitReact &&
          Vector3.DistanceSquared(npc.mesh.position, this.player.camera.position) > NPC_ANIMATION_FAR_DISTANCE_SQ
        ) {
          continue;
        }
        this.animationSystem.updateNPCAnimation(
          npc.mesh, npc.aiState, npc.isAttackTelegraphing,
          npc.isStaggered, npc.isDead, hitReact,
        );
      }

      this._updatePetAI(deltaTime);
      this.interactionSystem.update();

      const weatherScale = this.weatherSystem?.state === "clear" ? 1.0 : (this.weatherSystem?.fogDensity ? 0.7 : 1.0);
      const compositeLight = this.timeSystem.ambientIntensity * weatherScale;
      this.stealthSystem.shadowFactor = compositeLight;
      // Detection (and its occlusion raycasts) pauses while any modal UI is
      // open — the player can't act, so detection shouldn't build or expire.
      if (!this._isCombatInputBlocked()) {
        this.stealthSystem.update(deltaTime, compositeLight);
        if (this.stealthSystem.isCrouching) {
          this.skillProgressionSystem.gainXP(
            "sneak", deltaTime * SNEAK_XP_PER_SECOND * this.classSystem.xpMultiplierFor("sneak"),
          );
        }
      }

      // ── Survival needs ────────────────────────────────────────────────────
      // Cold drains in the tundra and in bad weather; elsewhere it recovers.
      {
        const p = this.player.camera.position;
        const biome = this.world.getBiome(
          Math.floor(p.x / this.world.chunkSize),
          Math.floor(p.z / this.world.chunkSize),
        );
        const weather = this.weatherSystem?.state ?? "clear";
        const isCold = biome === "tundra" || weather === "rain" || weather === "storm";
        this.survivalSystem.update(deltaTime, isCold);
        this.skillProgressionSystem.globalXpMultiplier = this.survivalSystem.xpMultiplier;

        // Apply derived penalties to the player.
        const staminaRegenPenalty = this.survivalSystem.staminaRegenPenalty;
        if (staminaRegenPenalty < 0) {
          this.player.stamina = Math.max(0, this.player.stamina + staminaRegenPenalty * deltaTime);
        }
        const maxStamina = this.player.maxStamina + this.survivalSystem.maxStaminaPenalty;
        if (this.player.stamina > maxStamina) this.player.stamina = maxStamina;
        const maxMagicka = this.player.maxMagicka + this.survivalSystem.maxMagickaPenalty;
        if (this.player.magicka > maxMagicka) this.player.magicka = maxMagicka;
        const frost = this.survivalSystem.frostDamagePerSecond;
        if (frost > 0) {
          this.player.health = Math.max(0, this.player.health - frost * deltaTime);
          this.player.notifyDamageTaken();
        }
      }

      this.projectileSystem.update(deltaTime);
      this.spellSystem.update(deltaTime);

      this._lastLodCulled = this.lodSystem.update(this.player.camera.position);
      this.navigationSystem.update(deltaTime);
      // Autosave only fires when real state changes mark the save dirty — no per-tick markDirty.
      this.saveSystem.tickAutosave(deltaTime);
      const cx = Math.floor(this.player.camera.position.x / this.world.chunkSize);
      const cz = Math.floor(this.player.camera.position.z / this.world.chunkSize);
      if (cx !== this._lastNavChunkX || cz !== this._lastNavChunkZ) {
        this._lastNavChunkX = cx;
        this._lastNavChunkZ = cz;
        this.navigationSystem.requestRebuild();

        // Dynamic region transition check
        const currentRegion = this.world.getRegionAt(cx, cz);
        const regId = currentRegion ? currentRegion.id : null;
        if (regId !== this._lastRegionId) {
          this._lastRegionId = regId;
          if (currentRegion) {
            this.ui.showNotification(
              `📍 Entered ${currentRegion.name} (Danger ${currentRegion.dangerLevel}/10)`,
              3500,
            );
          }
        }
      }

      // ── Throttled systems (don't run every frame) ──────────────────────────
      this._systemTickCounter++;
      const tick = this._systemTickCounter;

      // weatherSystem: 10 Hz (every 6th frame at 60fps).  The clock is blended
      // into its light application so day/night darken the scene (sun dies at
      // night, ambient keeps a readable floor, fog follows).
      this.weatherSystem.daylightScale = this.timeSystem.ambientIntensity;
      if (tick % 6 === 0) this.weatherSystem.update(deltaTime);

      // activeEffectsSystem: 30 Hz (every 2nd frame)
      if (tick % 2 === 0) this.activeEffectsSystem.update(deltaTime, this.player);

      // swimSystem: 20 Hz (every 3rd frame)
      if (tick % 3 === 0) this.swimSystem.update(deltaTime, this.player);

      // crimeSystem: every step — its guard-challenge cooldown decays by the
      // passed delta, so starving it to a 1 Hz call made the 15 s cooldown
      // take ~15 real minutes. It early-returns while no bounty is active.
      this.crimeSystem.update(deltaTime);

      // merchantRestockSystem: ~1 Hz (every 60 frames)
      if (tick % 60 === 0) {
        const gameTime = this.timeSystem.elapsedGameTime;
        this.respawnSystem.update(gameTime);
        this.merchantRestockSystem.update(gameTime, this.barterSystem);
      }

      if (tick >= 3600) this._systemTickCounter = 0;
  }

  update(): void {
      if (this.isPaused) return;

      const frameDelta = this.engine.getDeltaTime() / 1000;

      // Poll gamepad state every frame
      this._gamepadInput.update(frameDelta);

      // Apply gamepad left stick to camera movement (smooth analog)
      if (this._gamepadInput.isConnected && !this._isCombatInputBlocked()) {
        const lx = this._gamepadInput.leftStickX;
        const ly = this._gamepadInput.leftStickY;
        if (Math.abs(lx) > 0.15 || Math.abs(ly) > 0.15) {
          const speed = this.player.camera.speed * frameDelta * 60;
          const forward = this.player.getForwardDirection(1);
          const right = Vector3.Cross(forward, Vector3.Up()).normalize();
          const moveVec = forward.scale(ly * speed).add(right.scale(lx * speed));
          this.player.camera.position.addInPlace(moveVec);
        }
      }

      // Keep the shadow frustum centred on the player — only the light position
      // moves (uniform update); direction, colour, and intensity are constant.
      this._sunLight?.position.set(
          this.player.camera.position.x + 80,
          this.player.camera.position.y + 120,
          this.player.camera.position.z + 50,
      );

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
               this.ui.showNotification("You have fallen...", 4000);
               // Death has consequences: after 4 seconds you wake at the
               // nearest discovered location, lighter by 10% of your gold.
               // (Health regen is suppressed at 0 HP, so this timer is the
               // only path back above zero.)
               setTimeout(() => {
                 if (this.player.health > 0) return;
                 this.player.health = Math.round(this.player.maxHealth * 0.5);
                 this._playerAtZeroHP = false;

                 // Tear down any screen state owned at the moment of death so
                 // the player does not wake up inside a stale modal/conversation.
                 if (this.dialogueSystem.isInDialogue) this.dialogueSystem.endDialogue();
                 if (this.inventorySystem.isOpen) this.inventorySystem.toggleInventory();
                 if (this._containerUI.isVisible) this._containerUI.onClose?.();
                 if (this._barterUI.isVisible) this._barterUI.onClose?.();

                 // Death purges active status effects (burn/freeze DoTs etc.).
                 for (const effect of this.activeEffectsSystem.activeEffects) {
                   this.activeEffectsSystem.removeEffect(effect.id);
                 }

                 // Disengage every living attacker so the revive point is not
                 // a combat zone (and fast travel is not immediately blocked).
                 for (const npc of this.scheduleSystem.npcs) {
                   if (npc.isDead) continue;
                   if (
                     npc.aiState === AIState.ALERT ||
                     npc.aiState === AIState.INVESTIGATE ||
                     npc.aiState === AIState.CHASE ||
                     npc.aiState === AIState.ATTACK
                   ) {
                     npc.aiState = npc.patrolPoints.length > 0 ? AIState.RETURN : AIState.IDLE;
                     npc.isAggressive = false;
                   }
                 }
                 this._restoreGameplayInput();

                 const pos = this.player.camera.position;
                 let nearest: { name: string; position: { x: number; y: number; z: number } } | null = null;
                 let nearestDistSq = Number.POSITIVE_INFINITY;
                 for (const loc of this.fastTravelSystem.discoveredLocations) {
                   const dx = loc.position.x - pos.x;
                   const dy = loc.position.y - pos.y;
                   const dz = loc.position.z - pos.z;
                   const dSq = dx * dx + dy * dy + dz * dz;
                   if (dSq < nearestDistSq) {
                     nearestDistSq = dSq;
                     nearest = loc;
                   }
                 }
                 if (nearest) {
                   pos.set(nearest.position.x, nearest.position.y, nearest.position.z);
                 }
                 const lost = Math.floor(this._getInventoryGold() * 0.1);
                 if (lost > 0) this._consumeInventoryGold(lost);
                 this.ui.showNotification(
                   nearest
                     ? `You awaken at ${nearest.name}.${lost > 0 ? ` (${lost} gold lost)` : ""}`
                     : "You feel the will to continue...",
                   4000,
                 );
                 this.saveSystem.markDirty();
               }, 4000);
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

      if (this.player.experience !== this._lastExperience || this.player.level !== this._lastLevel || this.playerLevelSystem.characterLevel !== this._lastCharacterLevel) {
          this._lastExperience = this.player.experience;
          this._lastLevel = this.player.level;
          this._lastCharacterLevel = this.playerLevelSystem.characterLevel;
          this.ui.updateXP(this.player.experience, this.player.experienceToNextLevel, this.player.level, this.playerLevelSystem.characterLevel);
      }

      // Refresh the stats panel every frame while inventory is open so live values
      // (health regen, damage taken, equipment changes) are always current.
      if (this.inventorySystem.isOpen) {
          this.ui.updateStats(this.player, this.playerLevelSystem.characterLevel);
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

      // Follower HUD — update when active follower or health changes
      {
        const af = this.followerSystem?.getActiveFollower() ?? null;
        const afId = af?.templateId ?? null;
        if (afId !== this._lastFollowerId || (af && af.health !== this._lastFollowerHealth)) {
          this._lastFollowerId     = afId;
          this._lastFollowerHealth = af?.health ?? -1;
          this.followerUI?.updateHUD(af);
        }
      }

      // Shout HUD chip — equipped shout name, word pips, cooldown countdown.
      // updateHUD() skips DOM writes when nothing changed, so per-frame calls
      // are cheap.
      {
        const equippedId = this.dragonShoutSystem?.equippedShoutId ?? null;
        if (equippedId) {
          const def = this.dragonShoutSystem.getShout(equippedId);
          const tier = this.dragonShoutSystem.getUnlockedTier(equippedId);
          this.shoutUI?.updateHUD({
            name: def?.name ?? equippedId,
            tier,
            cooldownSeconds: this.dragonShoutSystem.cooldownRemaining(equippedId, this.timeSystem.gameTime),
          });
        } else {
          this.shoutUI?.updateHUD(null);
        }
      }

      // Update clock display only when the displayed in-game minute changes —
      // the timeString getter allocates, so don't build it every frame.
      const clockMinutes = Math.floor(this.timeSystem.gameTime);
      if (clockMinutes !== this._lastClockMinutes) {
          this._lastClockMinutes = clockMinutes;
          this.ui.updateClock(this.timeSystem.timeString);
      }

      // Update compass heading from camera yaw
      this.ui.updateCompass(this.player.camera.rotation.y);

      // Update stealth HUD when crouching
      if (this.stealthSystem.isCrouching) {
          this.ui.updateStealthHUD(this.stealthSystem.stealthLabel);
      } else {
          this.ui.updateStealthHUD(null);
      }

      // Combat-state readout: combo chain, finisher, and riposte window.
      {
          const combat = this.combatSystem;
          let combatLabel: string | null = null;
          if (combat.isDodging) combatLabel = "Dodging!";
          else if (combat.finisherReady && combat.activeWeaponArchetype !== "bow") combatLabel = "⚔ FINISHER READY";
          else if (combat.riposteReady) combatLabel = "Riposte ready!";
          else if (combat.comboStack > 1) combatLabel = `Combo ×${combat.comboStack}`;
          this.ui.updateCombatState(combatLabel);
      }

      // Hide the crosshair while any HTML modal overlay owns the screen
      // (barter, level-up, guard challenge, travel, stable, settings, …).
      this.ui.setHtmlOverlayActive(
          this._barterUI.isVisible ||
          this._containerUI.isVisible ||
          this.levelUpUI.isVisible ||
          this.guardEncounterUI.isVisible ||
          this.spellMakingUI.isVisible ||
          this.fastTravelUI.isVisible ||
          this.stableUI.isVisible ||
          this.saddlebagUI.isVisible ||
          this.petUI.isVisible ||
          this.followerUI.isVisible ||
          this.pickpocketUI.isVisible ||
          this.graphicsSettingsUI.isVisible
      );

      // Update active effects HUD (30 Hz, same as activeEffectsSystem)
      if (this._systemTickCounter % 2 === 0) {
        this.activeEffectHUD.update(this.activeEffectsSystem.activeEffects);
        this.quickSlotHUD.update(this.quickSlotSystem);
      }

      if (!this.ui.isDebugVisible) {
          this._debugOverlayFrameSkip = 0;
      } else if (++this._debugOverlayFrameSkip >= 12) {
          this._debugOverlayFrameSkip = 0;
          const eng = this.engine;
          const drawCounter = (eng as { _drawCalls?: { current: number } })._drawCalls;
          this.ui.updateDebugOverlay({
              fps:           eng.getFps(),
              drawCalls:     drawCounter?.current ?? 0,
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

      // LodSystem prunes disposed meshes in update(); chunk CDN props keep stable
      // refs for the exterior world, so we do not clear the registry here.

      // Sync world visibility with cell type (hide exterior when in interior)
      const isInterior = this.cellManager.isInterior;
      this.world.setVisible(!isInterior);
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
          // Sync world visibility with cell type
          this.world.setVisible(cell.type !== "interior");
      }
  }

  /**
   * Build the fast-travel option list (with a Recall row when a mark exists)
   * and open the destination picker.
   */
  private _openFastTravelMenu(): void {
      const locs = this.fastTravelSystem.discoveredLocations;
      const options: FastTravelOptionView[] = locs.map((loc) => ({
          id: loc.id,
          name: loc.name,
          estimatedHours: this.fastTravelSystem.estimateTravelHours(this.player.camera.position, loc.id) ?? 1,
      }));
      if (this.markRecallSystem.hasMarked) {
          options.push({
              id: MARK_RECALL_TRAVEL_ID,
              name: "✦ Recall to Mark",
              estimatedHours: 0,
              detail: "instant",
          });
      }
      if (options.length === 0) {
          this.ui.showNotification("No locations discovered yet.", 2000);
          return;
      }
      this.fastTravelUI.open(options);
      this._suspendGameplayInput();
  }

  private _attemptFastTravel(locationId: string): void {
      if (locationId === MARK_RECALL_TRAVEL_ID) {
          this._attemptRecall();
          return;
      }
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
      if (this.player.isEncumbered) {
          this.ui.showNotification("Cannot fast travel while overencumbered.", 2200);
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
          this.respawnSystem.update(this.timeSystem.elapsedGameTime);
          this.merchantRestockSystem.update(this.timeSystem.elapsedGameTime, this.barterSystem);
          this._updateDynamicWorldEventsOnHourChange();
          this.ui.showNotification(
              `${message} (${hours.toFixed(1)}h passed) — ${this.timeSystem.timeString}`,
              3200,
          );
          this.fastTravelUI.close();
          // Travel events: a chance of an encounter-flavor moment on arrival.
          if (Math.random() < 0.35) {
              const travelContext: TravelContext = {
                  gameTimeHours: this.timeSystem.elapsedGameHours % 24,
                  activeBiomeIds: [this.world.getBiome(
                      Math.floor(dest.x / this.world.chunkSize),
                      Math.floor(dest.z / this.world.chunkSize),
                  )],
                  weatherId: this.weatherSystem.state,
                  playerLevel: this.playerLevelSystem.characterLevel,
                  getFlag: (flag) => this.frameworkRuntime.getFlag(flag),
                  setFlag: (flag, value) => this.frameworkRuntime.setFlag(flag, value),
              };
              const outcome = this.travelEventSystem.rollEvent(travelContext);
              if (outcome?.notification) {
                  this.ui.showNotification(`🌫 ${outcome.notification}`, 4000);
              }
          }
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
                  applyTimeAndClose();
              },
          });
      } else {
          this.player.camera.position.copyFrom(dest);
          applyTimeAndClose();
      }
  }

  /**
   * Recall to the marked position (via the travel menu's Recall row).
   * Teleportation + notification happen in the markRecallSystem.onRecall
   * callback; this only guards, closes the picker, and flags the autosave.
   */
  private _attemptRecall(): void {
      if (this._isPlayerInCombat()) {
          this.ui.showNotification("Cannot recall while in combat.", 2200);
          this.fastTravelUI.close();
          return;
      }
      if (this.stealthSystem.isCrouching) {
          this.ui.showNotification("Cannot recall while sneaking.", 2200);
          this.fastTravelUI.close();
          return;
      }
      const result = this.markRecallSystem.recall();
      this.fastTravelUI.close();
      if (!result) {
          this.ui.showNotification("No mark has been placed.", 2000);
          return;
      }
      this.saveSystem.markDirty();
  }

  private _getInventoryGold(): number {
      const goldEntry = this.inventorySystem.items.find((item) => item.id === GOLD_ITEM_ID);
      return goldEntry?.quantity ?? 0;
  }

  private _updateDynamicWorldEventsOnHourChange(): void {
      const elapsedHour = Math.floor(this.timeSystem.elapsedGameHours);
      if (elapsedHour === this._lastDynamicWorldEventHour) return;
      this._lastDynamicWorldEventHour = elapsedHour;

      this.dynamicWorldEventSystem.update({
        gameTimeHours: this.timeSystem.elapsedGameHours,
        playerLevel: this.playerLevelSystem.characterLevel,
        activeFactionIds: this.crimeSystem.getTotalBounty() > 0 ? ["bandits"] : [],
        weatherId: this.weatherSystem.state,
      });

      // Ambient flavor events share the same hourly tick.
      const p = this.player.camera.position;
      this.ambientEventSystem.update({
        gameTimeHours: this.timeSystem.elapsedGameHours % 24,
        weatherId: this.weatherSystem.state,
        activeBiomeIds: [this.world.getBiome(
          Math.floor(p.x / this.world.chunkSize),
          Math.floor(p.z / this.world.chunkSize),
        )],
        playerLevel: this.playerLevelSystem.characterLevel,
      });
  }

  private _grantDynamicWorldEventReward(reward: DynamicEventReward): void {
      const xp = Math.max(0, Math.floor(reward.xp ?? 0));
      const gold = Math.max(0, Math.floor(reward.gold ?? 0));

      if (xp > 0) {
        this.player.addExperience(xp);
        this.ui.showNotification(`+${xp} XP`, 1800);
      }

      if (gold > 0) {
        this.inventorySystem.addItem({
          id: GOLD_ITEM_ID,
          name: "Gold Coins",
          description: "Currency for trade and fines.",
          stackable: true,
          quantity: gold,
          weight: 0.1,
          stats: { value: 1 },
        });
        this._syncInventoryGoldToFramework();
        this.ui.showNotification(`+${gold} gold`, 1800);
      }

      if (reward.label) {
        this.ui.showNotification(reward.label, 2500);
      }

      if (xp > 0 || gold > 0) {
        this.saveSystem.markDirty();
      }
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
        stats:
          itemId === "health_potion"
            ? { ...HEALTH_POTION_STATS }
            : { value: 10 },
      };
      if (def.slot) item.slot = def.slot;
      this.inventorySystem.addItem(item);
  }

  /**
   * Register an NPC's liftable inventory: authored starting equipment plus a
   * coin purse for non-hostiles (settlers carry coin — without this, nobody
   * in the demo has anything worth stealing).
   */
  private _registerPickpocketInventory(npc: NPC): void {
      const items: PickpocketableItem[] = [];
      for (const id of npc.startingEquipmentIds) {
          const def = this.frameworkRuntime.contentRegistry.getItemDefinition(id);
          items.push({ id, name: def?.name ?? this._humanizeItemId(id), weight: 0.5, value: 10 });
      }
      if (!npc.isAggressive) {
          items.push({ id: "coin_purse", name: "Coin Purse", weight: 0.1, value: 12 });
      }
      this.pickpocketSystem.registerNpcInventory(npc.mesh.name, items);
  }

  /** Open the pickpocket picker for a mark (called from the E interaction). */
  private _openPickpocketUI(npc: NPC): void {
      const npcId = npc.mesh.name;
      const items = this.pickpocketSystem.getNpcInventory(npcId);
      if (!items || items.length === 0) {
          this.ui.showNotification("Nothing worth taking.", 1800);
          return;
      }
      this._pickpocketTargetId = npcId;
      this.pickpocketUI.show(npcId);
      this._refreshPickpocketUI(npcId);
      this._suspendGameplayInput();
      this._advanceOnboardingStep("sneak");
  }

  /** Re-render the picker with live chances; auto-close when cleaned out. */
  private _refreshPickpocketUI(npcId: string): void {
      if (!this.pickpocketUI.isVisible) return;
      const items = this.pickpocketSystem.getNpcInventory(npcId) ?? [];
      const sneak = this.skillProgressionSystem.getSkill("sneak")?.level ?? 0;
      this.pickpocketUI.update(items.map(i => ({
          id: i.id,
          name: i.name,
          chance: this.pickpocketSystem.getSuccessChance(npcId, i.id, sneak, 30) ?? 0,
      })));
      if (items.length === 0) {
          this._pickpocketTargetId = null;
          this.pickpocketUI.hide();
          this._restoreGameplayInput();
      }
  }

  /** Resolve one steal click: live eligibility check, then the dice roll. */
  private _attemptPickpocketSteal(itemId: string): void {
      const npcId = this._pickpocketTargetId;
      if (!npcId) return;
      const npc = this.scheduleSystem.npcs.find(n => n.mesh.name === npcId);
      const sneak = this.skillProgressionSystem.getSkill("sneak")?.level ?? 0;
      const detected = npc ? this.stealthSystem.getDetectionLevel(npc) >= 30 : true;
      const result = this.pickpocketSystem.attempt(
          npcId, itemId, sneak, 30, this.stealthSystem.isCrouching, detected);
      if (!result.success && result.reason !== "failed_roll") {
          // Eligibility lapsed mid-panel (stood up, spotted, emptied).
          const msg: Record<string, string> = {
              unknown_npc: "There's nothing to steal there.",
              not_crouching: "You must stay crouched to pickpocket.",
              already_detected: "You've been spotted — too late to lift anything.",
              empty_inventory: "Nothing worth taking.",
              unknown_item: "That item is already gone.",
          };
          this.ui.showNotification(msg[result.reason] ?? "Can't steal that.", 2200);
          if (result.reason === "empty_inventory" || result.reason === "unknown_npc") {
              this._pickpocketTargetId = null;
              this.pickpocketUI.hide();
              this._restoreGameplayInput();
          }
      }
      // Rolled success/failure feedback + picker refresh arrive via the
      // onPickpocketSuccess / onPickpocketFailed / onCaught callbacks above.
  }

  /** Display name for a stolen item (framework def, else humanized id). */
  private _pickpocketItemLabel(itemId: string): string {
      if (itemId === "coin_purse") return "Coin Purse";
      return this.frameworkRuntime.contentRegistry.getItemDefinition(itemId)?.name
          ?? this._humanizeItemId(itemId);
  }

  private _humanizeItemId(itemId: string): string {
      return itemId.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  }

  /** Move a successfully lifted item into the player inventory. */
  private _grantPickpocketItem(_npcId: string, itemId: string): void {
      if (itemId === "coin_purse") {
          this.inventorySystem.addItem({
              id: GOLD_ITEM_ID,
              name: "Gold Coins",
              description: "Currency for trade and fines.",
              stackable: true,
              quantity: 8,
              weight: 0.1,
              stats: { value: 1 },
          });
          this._syncInventoryGoldToFramework();
          this.ui.showNotification("Coin purse: +8 gold", 2200);
          return;
      }
      const gameId = FRAMEWORK_ITEM_TO_GAME[itemId] ?? itemId;
      const existing = this.inventorySystem.items.find((i) => i.id === gameId);
      if (existing) {
          this.inventorySystem.addItem({ ...existing, quantity: 1 });
          return;
      }
      if (this.frameworkRuntime.contentRegistry.getItemDefinition(itemId)) {
          this._giveDialogueItemToPlayer(itemId, 1);
          return;
      }
      this.inventorySystem.addItem({
          id: gameId,
          name: this._humanizeItemId(itemId),
          description: "Lifted.",
          stackable: false,
          quantity: 1,
          weight: 0.5,
          stats: { value: 10 },
      });
  }

  /** Hide the container panel, clear the active container, restore input. */
  private _closeContainerUI(): void {
      this._containerUI.hide();
      this.containerSystem.closeContainer();
      this._restoreGameplayInput();
  }

  /** Grant quest reward items (same pipeline as dialogue give-item effects). */
  private _grantFrameworkItem(itemId: string, quantity: number): void {
      const def = this.frameworkRuntime.contentRegistry.getItemDefinition(itemId);
      this._giveDialogueItemToPlayer(itemId, quantity);
      if (def) this.ui.showNotification(`Quest reward: ${def.name} ×${quantity}`, 2400);
  }

  private _handleDialogueHostEvent(eventId: string, payload?: Record<string, unknown>): void {
      if (eventId === "trainer:train") {
        const trainerId = typeof payload?.trainerId === "string" ? payload.trainerId : "";
        if (!trainerId) return;
        const def = this.trainerSystem.getTrainer(trainerId);
        if (!def) {
          this.ui.showNotification("That trainer is not available.", 2000);
          return;
        }
        const skillState = this.skillProgressionSystem.getSkill(def.skillId);
        const currentLevel = skillState?.level ?? 0;
        const skillName = skillState?.name ?? def.skillId;
        const gold = this._getInventoryGold();
        const result = this.trainerSystem.train(trainerId, currentLevel, gold);
        if (!result.success) {
          const cost = this.trainerSystem.getCost(trainerId, currentLevel);
          const reasonMsg: Record<string, string> = {
            unknown_trainer: "That trainer is not available.",
            skill_at_cap: `Your ${skillName} is as high as I can train you.`,
            session_limit_reached:
              "You've trained enough for now. Gain a character level, then return.",
            insufficient_gold: `You need ${cost ?? 0} gold for the next lesson.`,
          };
          this.ui.showNotification(
            reasonMsg[result.reason] ?? `Cannot train (${result.reason}).`,
            3200,
          );
        }
        return;
      }
      if (eventId === "barter:open") {
        const merchantId = typeof payload?.merchantId === "string" ? payload.merchantId : "merchant_01";
        if (this._barterUI.isVisible) {
          this._barterUI.hide();
          this.barterSystem.closeBarter();
          this.interactionSystem.isBlocked = this.mapEditorSystem.isEnabled;
          if (!this.mapEditorSystem.isEnabled && !this.isPaused) {
            this.canvas.requestPointerLock();
            this.player.camera.attachControl(this.canvas, true);
          }
        }
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
          this.survivalSystem.rest(hours * 22);
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
      const shop = this.shopSystem.getShopByMerchantId(merchantId);
      if (shop && !this.shopSystem.isOpen(shop.id, hour)) {
        this.ui.showNotification(`${shop.name} is closed right now.`, 2600);
        return;
      }
      if (!this.barterSystem.openBarter(merchantId, hour)) {
        return;
      }

      // Reputation pricing: fame-based disposition shifts the price factor,
      // and the merchant's persuasion disposition refines it further
      // (allied/friendly merchants give real discounts; hostile ones gouge).
      const fameFactor = 1 - (this.fameSystem.dispositionModifier / 20) * 0.15;
      const persuasionFactor = this._currentDialogueNpcName
        ? this.persuasionSystem.getMerchantPriceMultiplier(this._currentDialogueNpcName)
        : 1.0;
      this.barterSystem.sessionBuyPriceFactor =
        Math.min(1.5, Math.max(0.7, fameFactor * persuasionFactor));

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

  private _refreshFollowerUI(): void {
      const activeFollower = this.followerSystem.getActiveFollower();
      const deceasedIds: string[] = [];
      for (const templateId of this.followerSystem.registeredTemplateIds) {
          if (this.followerSystem.isFollowerDeceased(templateId)) {
              deceasedIds.push(templateId);
          }
      }
      const templates = this.followerSystem.registeredTemplateIds.map(id =>
          this.followerSystem.getFollowerTemplate(id)
      ).filter((t): t is NonNullable<typeof t> => t !== undefined);

      this.followerUI.refresh(
          templates,
          activeFollower,
          deceasedIds,
          this._getInventoryGold()
      );
      this.followerUI.updateHUD(activeFollower);
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

  /** Push latest progression snapshot into the Character Sheet DOM overlay. */
  private _refreshCharacterSheet(): void {
    const sb = this.birthsignSystem.getStatBonuses();
    this.characterSheetUI.update({
      name:            this.player.name,
      level:           this.playerLevelSystem.characterLevel,
      xpLevel:         this.player.level,
      raceName:        this.raceSystem.chosenRace?.name,
      className:       this.classSystem.chosenClass?.name,
      birthsignName:   this.birthsignSystem.chosenBirthsign?.name,
      specialization:  this.classSystem.chosenClass?.specialization,
      attributes:      this.attributeSystem.getAll(),
      skills:          this.skillProgressionSystem.getAllSkills(),
      maxHealth:       this.attributeSystem.maxHealth + sb.maxHealth,
      maxMagicka:      this.attributeSystem.maxMagicka + sb.maxMagicka,
      maxStamina:      this.attributeSystem.maxStamina + sb.maxStamina,
      carryWeight:     this.attributeSystem.carryWeight + sb.carryWeight,
      fame:            this.fameSystem.fame,
      infamy:          this.fameSystem.infamy,
      fameLabel:       this.fameSystem.fameLabel,
      infamyLabel:     this.fameSystem.infamyLabel,
      perkPoints:      this.perkSystem.perkPoints,
      perks:           this.perkSystem.getAllPerks(),
    });
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
          this._containerUI.isVisible ||
          this.fastTravelUI.isVisible ||
          this.stableUI.isVisible ||
          this.saddlebagUI.isVisible ||
          this.petUI.isVisible ||
          this.pickpocketUI.isVisible ||
          this.characterSheetUI.isVisible ||
          this.graphicsSettingsUI.isVisible ||
          this.dialogueSystem.isInDialogue ||
          this.interactionSystem.isBlocked
      );
  }

  /**
   * Suspend player input while a modal menu is open: block interaction,
   * release the pointer, and detach camera control.
   */
  private _suspendGameplayInput(): void {
      this.interactionSystem.isBlocked = true;
      document.exitPointerLock();
      this.player.camera.detachControl();
  }

  /**
   * Restore player input after a modal menu closes: re-attach camera control
   * and re-lock the pointer (unless a superseding mode — pause, map editor,
   * character creation — still owns the screen).
   */
  private _restoreGameplayInput(): void {
      this.interactionSystem.isBlocked = this.mapEditorSystem.isEnabled;
      if (!this.mapEditorSystem.isEnabled && !this.isPaused && !this._inCharacterCreation) {
          this.canvas.requestPointerLock();
          this.player.camera.attachControl(this.canvas, true);
      }
  }

  /** Check if the player is looking at an interactable object or NPC within 3 units. */
  private _raycastInteract(): boolean {
    const hit = this.player.raycastForward(3, true);
    if (hit?.pickedMesh?.metadata) {
      const m = hit.pickedMesh.metadata;
      return m.type === "npc" || m.type === "loot" || m.type === "portal" || m.type === "container";
    }
    return false;
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

    const dx      = playerPos.x - petPos.x;
    const dz      = playerPos.z - petPos.z;
    const distSq  = dx * dx + dz * dz;
    const follow  = pet.followDistance + 0.8;

    body.getLinearVelocityToRef(this._petScratchVec);

    if (distSq > follow * follow) {
      const dist  = Math.sqrt(distSq);
      const speed = dist > pet.followDistance + 5 ? pet.moveSpeed : pet.moveSpeed * 0.65;
      const nx    = (dx / dist) * speed;
      const nz    = (dz / dist) * speed;
      const blend = Math.min(1, 8 * deltaTime);

      const cvx = this._petScratchVec.x;
      const cvy = this._petScratchVec.y;
      const cvz = this._petScratchVec.z;

      body.setLinearVelocity(this._petScratchVec.set(
        cvx + (nx - cvx) * blend,
        cvy,
        cvz + (nz - cvz) * blend,
      ));

      this._petLookTarget.set(petPos.x + nx, petPos.y, petPos.z + nz);
      this._petMesh.lookAt(this._petLookTarget);

      if (dist > pet.followDistance + 5) {
        this.animationSystem.playRun(this._petMesh);
      } else {
        this.animationSystem.playWalk(this._petMesh);
      }
    } else {
      body.setLinearVelocity(this._petScratchVec.set(0, this._petScratchVec.y, 0));
      this.animationSystem.playIdle(this._petMesh);
    }

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
      this._petAttackTimer = 0.4;
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
