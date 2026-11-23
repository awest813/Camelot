import { Scene } from "@babylonjs/core/scene";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import type { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";

import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { AtmosphereController } from "./rendering/sky-dome";
import { createTerrainMaterial } from "./rendering/terrain-material";
import { HorizonMountains } from "./rendering/horizon";
import { WeaponViewModel } from "./rendering/viewmodel";
import { FireFx, WeatherFx } from "./rendering/particles-fx";
import { WaterRenderer } from "./rendering/water";
import { AdaptiveResolution } from "./rendering/adaptive-resolution";
import { createFoliageMaterials, GrassField, WindState } from "./rendering/foliage";
import { CharacterModelLibrary, modelForNpcName, type CharacterRig } from "./rendering/character-models";
import { createPostFx, createSunShadows, type PostFxHandle } from "./rendering/render-pipeline";
import { Player } from "./entities/player";
import { UIManager } from "./ui/ui-manager";
import { WorldManager } from "./world/world-manager";
import { NPC, AIState } from "./entities/npc";
import { ScheduleSystem } from "./systems/schedule-system";
import { CombatSystem } from "./systems/combat-system";
import { DialogueSystem } from "./systems/dialogue-system";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import { KeyboardEventTypes } from "@babylonjs/core/Events/keyboardEvents";
import { BabylonInputAdapter, type InputAction } from "./adapters/babylon/babylon-input-adapter";
import { GamepadInputSystem } from "./systems/gamepad-input-system";
import { InventorySystem } from "./systems/inventory-system";
import type { WeaponArchetype } from "./systems/combat-shared";
import { applyDamageWithResistance } from "./systems/combat-shared";
import { EquipmentSystem } from "./systems/equipment-system";
import { SaveSystem } from "./systems/save-system";
import { AchievementSystem } from "./platform/achievement-system";
import { getDesktopBridge } from "./platform/desktop-bridge";
import { desktopMirroredSaveStore } from "./platform/save-store";
import { CreditsUI } from "./ui/credits-ui";
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
import { ShopSystem } from "./systems/shop-system";
import { registerStarterMerchants, HEALTH_POTION_STATS } from "./content/starter-merchants";
import { seedStartingArea } from "./content/starting-area";
import { CellManager } from "./world/cell-manager";
import { SpellSystem } from "./systems/spell-system";
import { PersuasionSystem } from "./systems/persuasion-system";
import { GameEventBus } from "./systems/event-bus";
import { LootTableSystem, STARTER_LOOT_TABLES } from "./systems/loot-table-system";
import { NpcArchetypeSystem } from "./systems/npc-archetype-system";
import { NpcScheduleSystem, SCHED_GUARD } from "./systems/npc-schedule-system";
import { FixedStepLoop } from "./systems/fixed-step-loop";
import type { AlchemySystem } from "./systems/alchemy-system";
import type { AlchemyUI } from "./ui/alchemy-ui";
import type { CraftingSystem } from "./systems/crafting-system";
import type { CraftingUI } from "./ui/crafting-ui";
import type { ItemConditionSystem } from "./systems/item-condition-system";
import { CraftingFeature, CraftingKey, type CraftingService } from "./features/crafting/crafting-feature";
import { Kernel } from "./core/kernel";
import { EditorSuite } from "./features/editor/editor-suite";
import { VillageRaidFeature, RaidsKey, type RaidsService } from "./features/village-raids/raid-feature";
import {
  ActorsKey, AnimationKey, BuildingsKey, ClockKey, FeedbackKey, GameplayKey, InventoryKey, PurseKey, SkillsKey, LootKey, ModalKey, PlayerKey,
  QuestLogKey, ScheduleKey, SiteBuilderKey, WorldInfoKey, WorldStateKey,
} from "./features/services";
import { VillagesFeature, VillagesKey, type VillagesService } from "./features/villages/villages-feature";
import { WorldSitesFeature, WorldSitesKey, type WorldSitesService } from "./features/world-sites/world-sites-feature";
import { IndoorsFeature } from "./features/indoors/indoors-feature";
import { MountsFeature, MountsKey, MountHostKey, type MountsService } from "./features/mounts/mounts-feature";
import { WorldEventsFeature, WorldEventsKey } from "./features/world-events/world-events-feature";
import { VillageJobsFeature, JobsKey, type JobsService } from "./features/village-jobs/jobs-feature";
import type { ForgeRegistry, SmithingController } from "./systems/smithing-controller";
import type { EnchantingSystem } from "./systems/enchanting-system";
import type { EnchantingUI } from "./ui/enchanting-ui";
import { LodSystem } from "./systems/lod-system";
import { ChunkContent } from "./world/chunk-content";
import { WeatherSystem } from "./systems/weather-system";
import { GraphicsSystem, persistGraphicsTier } from "./systems/graphics-system";
import { QuickSlotSystem, isConsumableItem, type QuickSlotKey } from "./systems/quickslot-system";
import { WaitSystem } from "./systems/wait-system";
import { SkillProgressionSystem } from "./systems/skill-progression-system";
import type { FastTravelSystem } from "./systems/fast-travel-system";
import { FastTravelFeature, TravelKey, TravelHostKey } from "./features/fast-travel/fast-travel-feature";
import { DeathFeature, DeathHostKey } from "./features/death/death-feature";
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
import { hasCompletedOnboardingTips, persistOnboardingTipsCompleted, persistSkipOnboardingTips, shouldSkipOnboardingTips } from "./onboarding-preferences";
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

import { ContentBundleSystem } from "./systems/content-bundle-system";
import { ContentBundleUI } from "./ui/content-bundle-ui";
import { EditorHubUI } from "./ui/editor-hub-ui";
import { EditorLayout } from "./ui/editor-layout";
import { buildHelpOverlayLines } from "./ui/editor-help-overlay";
import type { FastTravelUI } from "./ui/fast-travel-ui";
import { SpellMakingUI } from "./ui/spell-making-ui";
import type { GuardEncounterUI } from "./ui/guard-encounter-ui";
import { ArrestFeature, ArrestKey, LawKey } from "./features/arrest/arrest-feature";
import { LevelUpUI } from "./ui/level-up-ui";
import { StableUI } from "./ui/stable-ui";
import { SaddlebagUI } from "./ui/saddlebag-ui";
import { DailyScheduleSystem } from "./systems/daily-schedule-system";
import { HorseSystem } from "./systems/horse-system";
import { SwimmingSystem } from "./systems/swimming-system";
import { DiseaseSystem } from "./systems/disease-system";
import { SurvivalSystem } from "./systems/survival-system";
import type { TravelEventSystem } from "./systems/travel-event-system";
import { AmbientEventSystem } from "./systems/ambient-event-system";
import { LeveledListSystem, ALL_BUILT_IN_LEVELED_LISTS } from "./systems/leveled-list-system";
import { EventManagerSystem } from "./systems/event-manager-system";
import { AnimationSystem } from "./systems/animation-system";
import { FantasyAssetLoader, setInstanceScale, setInstanceYaw, type FantasyAssetKey } from "./systems/fantasy-asset-loader";
import type { PetSystem } from "./systems/pet-system";
import type { PetUI } from "./ui/pet-ui";
import { PetsFeature, PetsKey, type PetsService } from "./features/pets/pets-feature";
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
import type { FollowerSystem } from "./systems/follower-system";

import type { FollowerUI } from "./ui/follower-ui";
import { FollowersFeature, FollowersKey, type FollowersService } from "./features/followers/followers-feature";
import { ActiveEffectHUD } from "./ui/active-effect-hud";
import { QuickSlotHUD } from "./ui/quickslot-hud";
import { PerkSystem } from "./systems/perk-system";
import { DynamicWorldEventSystem } from "./systems/dynamic-world-event-system";
import type { DynamicEventReward } from "./systems/dynamic-world-event-system";
import type { DragonShoutSystem } from "./systems/dragon-shout-system";
import type { ShoutUI } from "./ui/shout-ui";
import { ShoutsFeature, ShoutsKey, ShoutHostKey, type ShoutsService } from "./features/shouts/shouts-feature";
import { GraphicsSettingsUI, type CameraSensitivity } from "./ui/graphics-settings-ui";

/** XP awarded to the Sneak skill for each second of active sneaking. */
const SNEAK_XP_PER_SECOND = 2;
/** Pseudo fast-travel destination that triggers Mark & Recall teleportation. */
/** Squared distance beyond which NPC procedural animation updates are skipped. */
const NPC_ANIMATION_FAR_DISTANCE_SQ = 100 * 100;
/** NPCs below this height fell through the world (e.g. spawned before their chunk). */
const NPC_FALL_RECOVERY_Y = -30;
/** Inventory item ID used for player gold (bounty payment check). */
const GOLD_ITEM_ID = "gold_coins";
/** Map framework bundle item ids to Babylon inventory ids when they differ. */
const FRAMEWORK_ITEM_TO_GAME: Readonly<Record<string, string>> = {
  health_potion: "potion_hp_01",
  iron_sword: "sword_01",
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
/** Persisted local author identity for layer ownership workflows. */

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
  /** Time-of-day sky, sun/moon light and fog driver.  Null before _initPostProcessing() runs. */
  public atmosphere: AtmosphereController | null = null;
  /** Dynamic render scale defending the tier's target FPS. */
  private _adaptiveRes: AdaptiveResolution | null = null;
  /** Pond water surfaces. */
  private _water: WaterRenderer | null = null;
  /** Torch / campfire particles + flicker + nearest-light management. */
  private _fireFx: FireFx | null = null;
  /** Rain, snow, lightning, dust motes, fireflies. */
  private _weatherFx: WeatherFx | null = null;
  private _precipitation = 0;
  /** First-person weapon (CC0 KayKit weapons). */
  private _viewModel: WeaponViewModel | null = null;
  /** Distant mountain rings on the horizon. */
  private _horizon: HorizonMountains | null = null;
  /** Instanced, wind-blown grass around the player (null when the tier disables it). */
  private _grass: GrassField | null = null;
  /** Rigged NPC models (CC0 KayKit characters). */
  private _characterModels: CharacterModelLibrary | null = null;
  private readonly _npcRigs: Map<NPC, CharacterRig> = new Map();
  /** Village plans by chunk key (null = no village there); deterministic, cached. */
  /** Dragon bosses' bodies (generated dark-fantasy dragon parented to the capsule). */
  private readonly _dragonVisuals = new Map<NPC, { root: AbstractMesh; yaw: number; last: Vector3; t: number }>();
  /** SSAO / god rays / lens flare / HDR pipeline handle. */
  private _postFx: PostFxHandle | null = null;
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
  /** Fast travel (built with the game: the editor suite reads `fastTravelSystem`). */
  private readonly _fastTravel = new FastTravelFeature();
  public get fastTravelUI(): FastTravelUI { return this._fastTravel.menu; }
  public spellMakingUI: SpellMakingUI;
  public get guardEncounterUI(): GuardEncounterUI { return this.kernel.services.get(ArrestKey).panel; }
  public levelUpUI: LevelUpUI;
  /** Tab-open HTML overlay — identity, attributes, skills, reputation. */
  public characterSheetUI!: CharacterSheetUI;
  public get stableUI(): StableUI { return this.mounts.stable; }
  public get saddlebagUI(): SaddlebagUI { return this.mounts.saddlebag; }
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
  /** Alchemy, enchanting and smithing (built early: see CraftingFeature). */
  private _crafting!: CraftingFeature;
  public get alchemySystem(): AlchemySystem { return this._crafting.alchemy; }
  public get alchemyUI(): AlchemyUI { return this._crafting.alchemyPanel; }

  // Smithing + gear wear (CraftingSystem / ItemConditionSystem, glued by SmithingController)
  public get craftingSystem(): CraftingSystem { return this._crafting.recipes; }
  public get itemConditionSystem(): ItemConditionSystem { return this._crafting.conditions; }
  public get smithing(): SmithingController { return this._crafting.smithing; }
  /** World forges (smithies, armorer inns, the starting forge) — steel work needs one in reach. */
  public get forges(): ForgeRegistry { return this._crafting.forges; }
  public get craftingUI(): CraftingUI { return this._crafting.forgePanel; }
  /** Radiant work offered by innkeepers ("Any work going?"). */
  /** In-game editor tools (moves to the separate editor app in Phase 9). */
  public editors!: EditorSuite;
  public get mapEditorSystem(): MapEditorSystem { return this.editors.mapEditorSystem; }
  public get mapEditorPropertyPanel(): MapEditorPropertyPanel { return this.editors.mapEditorPropertyPanel; }
  public get mapEditorToolbar(): MapEditorToolbar { return this.editors.mapEditorToolbar; }
  public get mapEditorHierarchyPanel(): MapEditorHierarchyPanel { return this.editors.mapEditorHierarchyPanel; }
  public get mapEditorValidationPanel(): MapEditorValidationPanel { return this.editors.mapEditorValidationPanel; }
  public get mapEditorPalettePanel(): MapEditorPalettePanel { return this.editors.mapEditorPalettePanel; }
  public get mapEditorLayerPanel(): MapEditorLayerPanel { return this.editors.mapEditorLayerPanel; }
  public get mapEditorNotesPanel(): MapEditorNotesPanel { return this.editors.mapEditorNotesPanel; }
  public get questCreatorSystem(): QuestCreatorSystem { return this.editors.questCreatorSystem; }
  public get questCreatorUI(): QuestCreatorUI { return this.editors.questCreatorUI; }
  public get dialogueCreatorSystem(): DialogueCreatorSystem { return this.editors.dialogueCreatorSystem; }
  public get dialogueCreatorUI(): DialogueCreatorUI { return this.editors.dialogueCreatorUI; }
  public get npcCreatorSystem(): NpcCreatorSystem { return this.editors.npcCreatorSystem; }
  public get npcCreatorUI(): NpcCreatorUI { return this.editors.npcCreatorUI; }
  public get itemCreatorSystem(): ItemCreatorSystem { return this.editors.itemCreatorSystem; }
  public get itemCreatorUI(): ItemCreatorUI { return this.editors.itemCreatorUI; }
  public get factionCreatorSystem(): FactionCreatorSystem { return this.editors.factionCreatorSystem; }
  public get factionCreatorUI(): FactionCreatorUI { return this.editors.factionCreatorUI; }
  public get lootTableCreatorSystem(): LootTableCreatorSystem { return this.editors.lootTableCreatorSystem; }
  public get lootTableCreatorUI(): LootTableCreatorUI { return this.editors.lootTableCreatorUI; }
  public get spawnCreatorSystem(): SpawnCreatorSystem { return this.editors.spawnCreatorSystem; }
  public get spawnCreatorUI(): SpawnCreatorUI { return this.editors.spawnCreatorUI; }
  public get worldBuilderSystem(): WorldBuilderSystem { return this.editors.worldBuilderSystem; }
  public get worldBuilderUI(): WorldBuilderUI { return this.editors.worldBuilderUI; }
  public get contentBundleSystem(): ContentBundleSystem { return this.editors.contentBundleSystem; }
  public get contentBundleUI(): ContentBundleUI { return this.editors.contentBundleUI; }
  public get assetBrowserSystem(): AssetBrowserSystem { return this.editors.assetBrowserSystem; }
  public get assetBrowserUI(): AssetBrowserUI { return this.editors.assetBrowserUI; }
  public get bundleMergeSystem(): BundleMergeSystem { return this.editors.bundleMergeSystem; }
  public get bundleMergeUI(): BundleMergeUI { return this.editors.bundleMergeUI; }
  public get modManifestSystem(): ModManifestSystem { return this.editors.modManifestSystem; }
  public get modManifestUI(): ModManifestUI { return this.editors.modManifestUI; }
  public get workspaceDraftSystem(): WorkspaceDraftSystem { return this.editors.workspaceDraftSystem; }
  public get editorHubUI(): EditorHubUI { return this.editors.editorHubUI; }
  public get editorLayout(): EditorLayout { return this.editors.editorLayout; }

  /** Feature runtime (engine overhaul): events, phases, services, RNG, scopes. */
  public kernel!: Kernel;

  /** The raids feature's service (tests and the indoor loop use it). */
  public get raids(): RaidsService {
    return this.kernel.services.get(RaidsKey);
  }

  /** The villages feature's service (plans, loaded villages, where the player is). */
  public get villages(): VillagesService {
    return this.kernel.services.get(VillagesKey);
  }

  /** Horses, the stable and saddlebags (mounts feature). */
  public get mounts(): MountsService {
    return this.kernel.services.get(MountsKey);
  }

  /** What goes where as chunks load (world-sites feature). */
  public get worldSites(): WorldSitesService {
    return this.kernel.services.get(WorldSitesKey);
  }

  /** The village jobs feature's service (job window, rules). */
  public get crafting(): CraftingService { return this.kernel.services.get(CraftingKey); }
  public get jobs(): JobsService {
    return this.kernel.services.get(JobsKey);
  }

  // v5 systems (Oblivion parity: enchanting)
  public get enchantingSystem(): EnchantingSystem { return this._crafting.enchanting; }
  public get enchantingUI(): EnchantingUI { return this._crafting.enchantingPanel; }

  // v4 browser optimisation: LOD culling
  public lodSystem: LodSystem;

  // v6 systems (Oblivion atmosphere + hotkeys)
  public weatherSystem: WeatherSystem;
  public quickSlotSystem: QuickSlotSystem;

  // v7 systems (QoL + polish)
  public waitSystem: WaitSystem;

  // v8 systems (Oblivion depth: skill progression, fast travel, level scaling)
  public skillProgressionSystem: SkillProgressionSystem;
  public get fastTravelSystem(): FastTravelSystem { return this._fastTravel.places; }
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
  public get horseSystem(): HorseSystem { return this.mounts.horses; }

  // v20 systems
  public swimSystem: SwimmingSystem;

  // v21 systems
  public diseaseSystem: DiseaseSystem;

  // v28+ survival / flavor-event systems
  public survivalSystem!: SurvivalSystem;
  public get travelEventSystem(): TravelEventSystem { return this.kernel.services.get(WorldEventsKey).travel; }
  public get ambientEventSystem(): AmbientEventSystem { return this.kernel.services.get(WorldEventsKey).ambient; }
  public leveledListSystem!: LeveledListSystem;

  // v22 systems
  public eventManagerSystem: EventManagerSystem;

  // v23 systems
  public animationSystem: AnimationSystem;
  public get pets(): PetsService { return this.kernel.services.get(PetsKey); }
  public get petSystem(): PetSystem { return this.pets.pets; }
  public get petUI(): PetUI { return this.pets.panel; }

  // v24 systems
  public markRecallSystem: MarkRecallSystem;
  public trainerSystem: TrainerSystem;

  // v26 systems
  public get followers(): FollowersService { return this.kernel.services.get(FollowersKey); }
  public get followerSystem(): FollowerSystem { return this.followers.followers; }
  public get followerUI(): FollowerUI { return this.followers.panel; }

  // v27 systems
  public perkSystem!: PerkSystem;

  // v28 systems
  public get dynamicWorldEventSystem(): DynamicWorldEventSystem { return this.kernel.services.get(WorldEventsKey).dynamic; }

  // Thu'um — dragon shouts (wired post-alpha; state persists via saveSystem)
  public get shouts(): ShoutsService { return this.kernel.services.get(ShoutsKey); }
  public get dragonShoutSystem(): DragonShoutSystem { return this.shouts.shouts; }
  public get shoutUI(): ShoutUI { return this.shouts.panel; }

  /** Fantasy asset loader — streams BabylonJS CDN models (weapons, structures, creatures). */
  public fantasyAssets: FantasyAssetLoader;

  /** Captures the WebGL canvas as a PNG/JPEG and triggers a browser download. */
  public readonly screenshotSystem = new ScreenshotSystem();

  private readonly _barterUI = new BarterUI();
  private readonly _containerUI = new ContainerUI();
  /** When set, open barter after dialogue teardown (pointer lock restored first). */
  private _pendingBarterMerchantId: string | null = null;
  /** Set by the smith's "use your forge" dialogue choice; opened once dialogue closes. */
  /** Shared parchment material for village notice boards. */
  private _hudInDialogue = false;
  private _windowGlass: Array<{ emissiveColor?: Color3 }> = [];
  private _windowGlassScan = -1;
  private _windowGlow = -1;



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

  /** What each loaded chunk holds (props, buildings, its NPCs); goes with the chunk. */
  private _chunks!: ChunkContent;

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


  private _helpOverlayEl: HTMLDivElement | null = null;
  private _helpOverlayVisible: boolean = false;
  public activeEffectHUD: ActiveEffectHUD;
  public quickSlotHUD: QuickSlotHUD;

  /** Decoupled input action adapter — maps named actions to key/mouse/gamepad events. */
  private readonly _inputAdapter = new BabylonInputAdapter();
  /** Gamepad input polling system — feeds controller input into the adapter. */
  private readonly _gamepadInput = new GamepadInputSystem(this._inputAdapter);
  /** Launch achievements. Forwarded to Steamworks when the desktop shell is up. */
  private _achievements: AchievementSystem | null = null;
  private _creditsUI: CreditsUI | null = null;
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







  private _refreshEditorToolbar(): void { return this.editors.refreshToolbar(); }

  private _refreshLayerPanel(): void { return this.editors.refreshLayerPanel(); }

  init(): void {
    // Apply the tier's hardware scaling level before the first render.
    this.engine.setHardwareScalingLevel(this.graphics.performance.hardwareScalingLevel);
    this._adaptiveRes = new AdaptiveResolution({
      baseLevel: this.graphics.performance.hardwareScalingLevel,
      targetFps: this.graphics.performance.targetFps,
    });
    // `camelot_adaptive_res=0` pins the resolution (benchmarks, screenshot tests).
    try {
      if (typeof localStorage !== "undefined" && localStorage.getItem("camelot_adaptive_res") === "0") {
        this._adaptiveRes.enabled = false;
      }
    } catch { /* storage unavailable */ }
    // All picking is explicit (raycasts, editor clicks); skip Babylon's
    // automatic pick on every pointer move.
    this.scene.skipPointerMovePicking = true;
    this._setLight();
    this.player = new Player(this.scene, this.canvas);
    // Post-processing and skybox require the camera, so initialise after Player.
    this._initPostProcessing();
    this._initCharacterModels();
    this._viewModel = new WeaponViewModel(
      this.scene, this.player.camera, `${import.meta.env.BASE_URL ?? "/"}model/kaykit/weapons/`,
    );
    this.ui = new UIManager(this.scene);
    this.world = new WorldManager(this.scene, this.shadowGenerator, null, this.graphics.texture);
    this.world.terrainMaterial = createTerrainMaterial(this.scene, this.world.textureManager);
    // Village settlements keep their footprint clear of trees, rocks and ruins.
    // (Called once chunks stream in, after the villages feature is installed.)
    this.world.clearingAt = (cx, cz) => this.villages.clearingAt(cx, cz);
    this._initFoliage();
    this.navigationSystem = new NavigationSystem(this.scene);
    this.scheduleSystem = new ScheduleSystem();
    this.scheduleSystem.walkable = (x, z) => this._chunks.isWalkable(x, z);

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
      // New gear starts pristine; swapping pieces changes the wear penalty.
      this.smithing?.trackEquippedGear();
      this.smithing?.refreshPenalties();
      // Equipped gear is persistent state — keep the dirty-gated autosave aware.
      this.saveSystem.markDirty();
    };
    this._syncWeaponArchetype();
    this.saveSystem         = new SaveSystem(this.player, this.inventorySystem, this.equipmentSystem, this.ui);
    const mirroredSaves = desktopMirroredSaveStore();
    if (mirroredSaves) this.saveSystem.setStorage(mirroredSaves);
    this.saveSystem.setCombatSystem(this.combatSystem);
    this.questSystem        = new QuestSystem(this.ui);
    this.questSystem.onOpen = () => {
      this.eventBus.emit("questlog:opened", {});
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
      // Features reset their transient state (e.g. a raid in progress).
      this.eventBus.emit("save:loaded", {});
      // Restored condition values change the wear penalty on the player.
      this.smithing?.trackEquippedGear();
      this.smithing?.refreshPenalties();
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
    // Editor tools (map editor, creators, bundles, asset browser, hub).
    this.editors = new EditorSuite(this);



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
    this.kernel          = new Kernel({ events: this.eventBus });
    this._achievements = new AchievementSystem();
    this._achievements.onUnlocked = (definition) => {
      this.ui.showNotification(`Achievement unlocked: ${definition.name}`, 4000);
      const bridge = getDesktopBridge();
      if (bridge) void bridge.unlockAchievement(definition.id);
    };
    this._achievements.bind(this.eventBus);
    void this._achievements.syncWithDesktop();
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

    // ── Crafting: alchemy, enchanting, smithing + gear wear ─────────────────
    // Shift+B opens the forge.  Gear wears in combat; Repair Hammers mend it.
    this._crafting = new CraftingFeature({
      player: this.player,
      ui: this.ui,
      inventory: this.inventorySystem,
      equipment: this.equipmentSystem,
    });
    this.saveSystem.setAlchemySystem(this.alchemySystem);
    this.saveSystem.setEnchantingSystem(this.enchantingSystem);
    this.saveSystem.setCraftingSystem(this.craftingSystem);
    this._installFeatures();
    // Forget condition for gear that left the world (dropped, or wiped by a shop restock).
    this.saveSystem.onBeforeSave = () => {
      this.smithing.pruneConditions([
        ...this.inventorySystem.items,
        ...this.equipmentSystem.getEquipped().values(),
        ...(this.horseSystem?.ownedHorses ?? []).flatMap((h) => this.horseSystem.getSaddlebag(h.id) ?? []),
        // Sold gear keeps its wear while it sits in a shop (no free repair by buyback).
        ...[...(this.barterSystem?.merchants.values() ?? [])].flatMap((m) => m.inventory),
      ]);
    };
    // Worn gear trades for less, and barter rows show each piece's condition.
    this.barterSystem.itemValueMultiplier = (item) => this.smithing.getValueMultiplier(item);
    this._barterUI.itemTag = (item) => {
      const c = this.smithing.getItemCondition(item);
      return c === null ? null : `${Math.round(c)}%`;
    };
    // Hovering a piece of gear in the inventory shows its condition.
    this.ui.itemDetailSuffix = (item) => {
      const c = this.smithing.getItemCondition(item);
      return c === null ? "" : `\nCondition: ${Math.round(c)}%`;
    };
    this.saveSystem.setItemConditionSystem(this.itemConditionSystem);

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
      if (this.smithing.tryUseRepairItem(item)) {
        this.saveSystem.markDirty();
        return;
      }
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
      this.smithing.onPlayerStruck();
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

    // Auto-discover locations when the player enters a new cell (portals use fade + tryTransition)
    this.cellManager.onCellChanged = (cellId, cellName) => {
      this._onCellEntered(cellId, cellName);
    };
    this.interactionSystem.onPortalTransition = (portalId) => this._beginPortalTransition(portalId);

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
    if (getDesktopBridge()) {
      this.graphicsSettingsUI.onToggleFullscreen = () => {
        void getDesktopBridge()?.toggleFullscreen();
      };
    }
    this._wireGraphicsSettingsButton();

    // ── v18 DailyScheduleSystem ───────────────────────────────────────────────
    // Connects TimeSystem → ScheduleSystem so NPC daily behaviours are driven
    // automatically by the in-game clock.  Also enforces non-interactivity for
    // sleeping NPCs by clearing their mesh.metadata during sleep windows.
    this.dailyScheduleSystem = new DailyScheduleSystem(
      this.scheduleSystem,
      this.timeSystem,
    );
    // No toasts: a village going to bed would post a dozen of them.
    this.dailyScheduleSystem.onNPCSleep = () => {
      this.saveSystem.markDirty();
    };
    this.dailyScheduleSystem.onNPCWake = () => {
      this.saveSystem.markDirty();
    };
    // Villagers who reach their door at bedtime go inside until morning.
    // (The indoors feature takes them inside.)
    this.scheduleSystem.onSleepArrive = (npc) => this.eventBus.emit("npc:atBed", { npc });
    this.saveSystem.setDailyScheduleSystem(this.dailyScheduleSystem);

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
    // Remote (Babylon CDN) props stay off unless VITE_ENABLE_REMOTE_PROPS=true, so
    // the offline Steam depot never touches the network.  World *population*
    // (settlement NPCs, shops, trainers, bandit camps, smithies) always runs:
    // with remote props off, CDN buildings are simply absent and local props
    // (Quaternius) still load.  Previously the whole block below was gated,
    // which silently removed every inn/cottage/fort NPC from default builds.
    const remotePropsEnabled = import.meta.env.VITE_ENABLE_REMOTE_PROPS === "true";
    this.fantasyAssets = new FantasyAssetLoader(this.scene, { allowRemote: remotePropsEnabled });
    {
      if (remotePropsEnabled) this.fantasyAssets.preloadRemoteCdnAssets();
      this._chunks = new ChunkContent({
        scene: this.scene,
        assets: this.fantasyAssets,
        lod: this.lodSystem,
        shadows: () => this.shadowGenerator,
        fireFx: () => this._fireFx,
        forges: () => this.forges,
        releaseNpc: (npc) => this._releaseNpc(npc),
      });

      // ── Chunk content (placement rules: world-sites feature) ──────────────
      this.world.onChunkLoaded = (cx, cz, biome) => {
        const chunkKey = `${cx},${cz}`;
        this._chunks.open(chunkKey);
        // What goes where lives in the world-sites feature (villages, camps,
        // inns, homesteads, the dragon, wild nature).
        this.worldSites.populate(chunkKey, cx, cz, biome);
      };

      // Dispose chunk-scoped CDN props and NPCs when their chunk unloads so
      // revisiting an area never accumulates duplicate props or entities.
      this.world.onChunkUnloaded = (cx, cz) => {
        const key = `${cx},${cz}`;
        this.eventBus.emit("chunk:unloaded", { chunkKey: key });
        this._chunks.close(key);
      };
    }

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

    // ── v27: Perk System ──────────────────────────────────────────────────
    this.perkSystem = new PerkSystem(this.player, this.skillProgressionSystem);
    this.perkSystem.onPerkUnlocked = (_id, name) => {
      this.ui.showNotification(`Perk unlocked: ${name}!`, 3500);
      this.saveSystem.markDirty();
    };
    this.saveSystem.setPerkSystem(this.perkSystem);

    this._lastDynamicWorldEventHour = Math.floor(this.timeSystem.elapsedGameHours);

    // ── Leveled lists (tiered boss loot) ─────────────────────────────────────
    this.leveledListSystem = new LeveledListSystem();
    this.leveledListSystem.registerAll(ALL_BUILT_IN_LEVELED_LISTS);

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
    this.questSystem.onQuestComplete = (xp: number, questId?: string) => {
      this.eventBus.emit("quest:completed", { questId: questId ?? "legacy", xpReward: xp });
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
    // A forge near the starting area so steel work is reachable from day one.
    this._chunks.placeSmithy(null, null, -4, -5);

    // The starting area: a chest, the Old Cave, weapons on the ground, the first quests.
    seedStartingArea({
      scene: this.scene,
      assets: this.fantasyAssets,
      quests: this.questSystem,
      containers: this.containerSystem,
      cells: this.cellManager,
      castShadow: (root) => this.shadowGenerator?.addShadowCaster(root, true),
    });

    // The starting region's merchants (dialogue `barter:open` uses payload.merchantId).
    registerStarterMerchants(this.barterSystem, this.merchantRestockSystem, this.shopSystem, this.timeSystem.elapsedGameTime);

    this._barterUI.onBuy = (itemId, instanceId) => {
      const mid = this.barterSystem.activeMerchantId;
      if (!mid) return;
      this.barterSystem.buyItem(mid, itemId, instanceId);
      this._barterUI.update(this.barterSystem, this.inventorySystem.items);
      this.saveSystem.markDirty();
    };
    this._barterUI.onSell = (itemId, instanceId) => {
      const mid = this.barterSystem.activeMerchantId;
      if (!mid) return;
      this.barterSystem.sellItem(mid, itemId, instanceId);
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
        const npcName = /dragon/i.test(npc.mesh.name) ? npc.mesh.name : name;
        this.eventBus.emit("player:kill", { npcId: npc.mesh.name, npcName, xp });
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
                    const scatter = this.kernel.rng.stream("death-drops");
                    new Loot(this.scene, dropPos.add(new Vector3(
                        (scatter.next() - 0.5) * 1.2,
                        0,
                        (scatter.next() - 0.5) * 1.2,
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
            const listId = this.kernel.rng.stream("elite-drops").chance(0.6) ? "ll_weapon_melee" : "ll_armor_heavy";
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
            this.shouts.absorbDragonSoul();
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
    this.combatSystem.onWeaponHit = (powerAttack) => this.smithing.onWeaponHit(powerAttack);
    this.combatSystem.onPlayerHit = () => {
        this.audioSystem.playPlayerHit();
        this.smithing.onPlayerStruck();
        // Small chance to contract a random disease on each hit (Oblivion-style).
        // ~5 % base chance per strike; resistance is factored inside contractDisease().
        const contagion = this.kernel.rng.stream("disease");
        if (contagion.chance(0.05)) {
            this.diseaseSystem.contractDisease(contagion.pick(["rust_chancre", "swamp_rot", "witbane", "collywobbles", "yellow_tick"]));
        }
    };
    this.combatSystem.onBlockSuccess = () => {
        this.smithing.onBlock();
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
      // Features waiting on the conversation (e.g. the job window) act now.
      this.eventBus.emit("dialogue:closed", {});
      this._currentDialogueNpcName = null;
    };

    // Quest XP and fame callbacks are wired in the v9 block above.
    // Note: player.onLevelUp is wired above in the v2 system wiring block

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

    // DOM dialogs take keyboard focus from the canvas, and the observable below
    // only hears the canvas — so a panel opened with P/G/N/K/… could not be
    // closed with the same key. Forward panel-toggle keys from inside dialogs.
    if (typeof window !== "undefined") {
      window.addEventListener("keydown", (ev) => this._forwardDialogToggleKey(ev));
    }

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
            if (kbInfo.event.key === "Tab") {
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
            }
        } else if (kbInfo.type === KeyboardEventTypes.KEYUP) {
            // A bow drawn (or staff charged) before entering the editor is
            // released here, where the editor sends key-ups.
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
    this._creditsUI = new CreditsUI();
    this._creditsUI.onClose = () => {
      if (this.isPaused) return;
      this.interactionSystem.isBlocked = false;
      this.canvas.requestPointerLock();
      this.player.camera.attachControl(this.canvas, true);
    };
    this.ui.creditsButton.onPointerUpObservable.add(() => {
      this._creditsUI?.show();
    });
    const desktop = getDesktopBridge();
    if (desktop) {
      this.ui.setQuitButtonLabel("Quit to Desktop");
      this.ui.quitButton.onPointerUpObservable.add(() => {
        desktop.quit();
      });
    } else {
      this.ui.quitButton.onPointerUpObservable.add(() => window.location.reload());
    }

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

  /** Panel toggles that may be pressed again from inside their open DOM dialog. */
  private static readonly _DIALOG_TOGGLE_ACTIONS: ReadonlySet<InputAction> = new Set<InputAction>([
    "toggleInventory", "toggleQuestLog", "toggleSkillTree", "toggleAttributePanel",
    "toggleAlchemy", "toggleEnchanting", "toggleSmithing", "toggleSpellMaking", "toggleFastTravel",
    "toggleWaitDialog", "togglePetPanel", "toggleFollowerPanel", "toggleShoutMenu",
    "stableOrSaddlebag", "favoritesMenu",
  ]);

  /**
   * Route a panel-toggle key pressed while focus is inside an open dialog to the
   * input adapter (the canvas observable never sees it). Keys typed into text
   * fields, Escape/Tab (dialogs own those), and canvas-origin events — already
   * handled by the observable — are left alone.
   */
  private _forwardDialogToggleKey(ev: KeyboardEvent): void {
    if (ev.repeat || ev.defaultPrevented || this._inCharacterCreation) return;
    const target = ev.target;
    if (!(target instanceof HTMLElement) || target === this.canvas) return;
    if (!target.closest('[role="dialog"], [aria-modal="true"]')) return;
    if (target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return;
    const modifiers = { shift: ev.shiftKey, ctrlOrMeta: ev.ctrlKey || ev.metaKey };
    const action = this._inputAdapter.matchAction(ev.key, "down", modifiers);
    if (!action || !Game._DIALOG_TOGGLE_ACTIONS.has(action)) return;
    ev.preventDefault();
    this._inputAdapter.handleKeyEvent(ev.key, "down", modifiers);
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
            this._viewModel?.swing(false);
            this.audioSystem.playMeleeAttack();
          }
        }
      }
    });
    adapter.onAction("powerAttack", () => {
      if (!this._isCombatInputBlocked()) {
        const powered = this.combatSystem.powerAttack();
        if (powered) {
            this._viewModel?.swing(true);
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
    adapter.onAction("toggleAlchemy", () => this.crafting.toggleAlchemy());
    adapter.onAction("toggleEnchanting", () => this.crafting.toggleEnchanting());
    adapter.onAction("toggleSmithing", () => this.crafting.toggleSmithing());
    adapter.onAction("toggleSpellMaking", () => {
      if (this.spellMakingUI.isVisible) {
        this.spellMakingUI.close();
        return;
      }
      if (this._isCombatInputBlocked()) return;
      this.spellMakingUI.open();
      this._suspendGameplayInput();
    });
    adapter.onAction("toggleFastTravel", () => this.kernel.services.get(TravelKey).toggleMenu());
    adapter.onAction("markPosition", () => {
      if (this._isCombatInputBlocked()) return;
      const p = this.player.camera.position;
      this.markRecallSystem.mark({ x: p.x, y: p.y, z: p.z });
      this.saveSystem.markDirty();
    });
    adapter.onAction("togglePetPanel", () => this.pets.togglePanel());
    adapter.onAction("toggleFollowerPanel", () => {
      // In map-editor mode G cycles the gizmo (the adapter consumes the key
      // before the legacy editor branch can see it).
      if (this.mapEditorSystem.isEnabled) {
        const mode = this.mapEditorSystem.cycleGizmoMode();
        this.ui.showNotification(`Editor gizmo: ${mode}`, 1400);
        this._refreshEditorToolbar();
        return;
      }
      this.followers.togglePanel();
    });
    adapter.onAction("toggleShoutMenu", () => this.shouts.togglePanel());
    adapter.onAction("useShout", () => this.shouts.use());
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
    adapter.onAction("mountDismount", () => this.mounts.toggleMount());
    adapter.onAction("stableOrSaddlebag", () => this.mounts.toggleStableOrSaddlebag());
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
      if (this.guardEncounterUI.isVisible) { this.kernel.services.get(ArrestKey).resist(); return; }
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
      if (this.craftingUI.isVisible) { this.craftingUI.hide(); this._restoreGameplayInput(); return; }
      if (this.jobs.window.isVisible) { this.jobs.window.hide(); this.jobs.window.onClose?.(); return; }
      if (this.spellMakingUI.isVisible) { this.spellMakingUI.close(); return; }
      if (this._barterUI.isVisible) { this._barterUI.onClose?.(); return; }
      if (this._containerUI.isVisible) { this._containerUI.onClose?.(); return; }
      if (this.fastTravelUI.isVisible) { this.fastTravelUI.close(); return; }
      if (this.petUI.isVisible) { this.petUI.close(); this._restoreGameplayInput(); return; }
      if (this.followerUI.isVisible) { this.followerUI.close(); this._restoreGameplayInput(); return; }
      if (this.pickpocketUI.isVisible) { this._pickpocketTargetId = null; this.pickpocketUI.hide(); this._restoreGameplayInput(); return; }
      if (this.stableUI.isVisible) { this.stableUI.close(); return; }
      if (this.saddlebagUI.isVisible) { this.saddlebagUI.close(); return; }
      if (this._creditsUI?.isVisible) { this._creditsUI.hide(); this._creditsUI.onClose?.(); return; }
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
          if (this.craftingUI.isVisible) { this.craftingUI.hide(); }
          if (this.jobs.window.isVisible) this.jobs.window.hide();
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
      // Feature randomness (raids, …) derives from the world seed too.
      this.kernel.rng.reseed(selection.worldSeed.seedString);
    }

    persistSkipOnboardingTips(selection.skipGameplayTips);
    this._startOnboardingTutorialIfNeeded();
    this._inCharacterCreation = false;
    this._achievements?.unlock("ACH_TAKE_UP_THE_SWORD");

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
    this._achievements?.unlock("ACH_TAKE_UP_THE_SWORD");
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
      this.craftingUI.isVisible ||
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
      if (this._inCharacterCreation || this.graphicsSettingsUI.isVisible || this._creditsUI?.isVisible || this._isCombatInputBlocked()) return;
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

    // Shadows are driven by the active graphics quality tier: cascaded PCF
    // shadows on medium+, a single soft map on low.
    this.shadowGenerator = createSunShadows(this.scene, sun, this.graphics);

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

  /** Leaf-card trees, wind sway and the grass field. */
  private _initFoliage(): void {
    this._water = new WaterRenderer(this.scene);
    this.world.water = this._water;
    const foliage = createFoliageMaterials(this.scene, this.world.textureManager, this.graphics.effects.wind);
    this.world.foliage = foliage;
    const density = this.graphics.effects.grassDensity;
    if (density > 0) {
      this._grass = new GrassField(
        this.scene, foliage.grass, density, this.world.chunkSize,
        (cx, cz) => this.world.getBiome(cx, cz),
        (x, z) => this.world.isInPond(x, z, 0.5),
      );
    }
    const particleScale = Math.min(1.5, this.graphics.performance.maxParticles / 512);
    this._fireFx = new FireFx(this.scene, particleScale);
    this.world.structures.onFire = (info) => this._fireFx?.attach(info);
    this.world.structures.mergeStatic = true;
    this._weatherFx = new WeatherFx(this.scene, this.graphics.effects.ambientParticles ? particleScale : particleScale * 0.5);

    this.world.onVisibilityChanged = (visible) => {
      this._grass?.setVisible(visible);
      this._horizon?.setVisible(visible);
      this.atmosphere?.mesh.setEnabled(visible);
      if (this._postFx) this._postFx.outdoors = visible;
    };
  }

  /**
   * Give every NPC a rigged, animated body.  The physics capsule keeps doing
   * collision and picking; the model follows it, faces its travel direction
   * (or the player in combat) and plays skeletal clips routed through
   * AnimationSystem.
   */
  private _initCharacterModels(): void {
    const base = `${import.meta.env.BASE_URL ?? "/"}model/kaykit/`;
    const library = new CharacterModelLibrary(this.scene, base, this.shadowGenerator);
    this._characterModels = library;
    library.preload();
    NPC.onCreated = (npc) => {
      const id = modelForNpcName(npc.mesh.name);
      if (!id) return;
      void library.attach(npc.mesh, id).then((rig) => {
        if (!rig) return;
        this._npcRigs.set(npc, rig);
        npc.mesh.onDisposeObservable.addOnce(() => {
          this._npcRigs.delete(npc);
          this.animationSystem?.unregisterSkeletal(npc.mesh.name);
        });
        this.animationSystem?.registerSkeletal(npc.mesh.name, rig);
      });
    };
  }

  /**
   * Put an NPC that fell through the world back at its spawn point.  Bodies
   * spawned before their ground chunk existed (e.g. the boot-time test guard)
   * otherwise fall forever.
   */
  private _recoverFallenNpc(npc: NPC): void {
    const body = npc.physicsAggregate?.body;
    npc.mesh.position.set(npc.spawnPosition.x, Math.max(npc.spawnPosition.y, 2), npc.spawnPosition.z);
    if (!body) return;
    body.setLinearVelocity(Vector3.Zero());
    // Let the physics step read the teleported transform once.
    body.disablePreStep = false;
    this.scene.onAfterPhysicsObservable.addOnce(() => { body.disablePreStep = true; });
  }

  /** Dragon bodies: face the player when fighting, else the travel direction; collapse on death. */
  private _updateDragonVisuals(dt: number): void {
    const playerPos = this.player.camera.position;
    for (const [npc, v] of this._dragonVisuals) {
      if (v.root.isDisposed()) { this._dragonVisuals.delete(npc); continue; }
      v.t += dt;
      const pos = npc.mesh.position;
      if (npc.isDead) {
        // Slump into the ground over a couple of seconds.
        v.root.position.y = Math.max(-2.4, v.root.position.y - dt * 0.7);
        continue;
      }
      let target: number | null = null;
      if (npc.isAggressive || npc.aiState === AIState.ALERT) {
        target = Math.atan2(playerPos.x - pos.x, playerPos.z - pos.z);
      } else {
        const dx = pos.x - v.last.x, dz = pos.z - v.last.z;
        if (dx * dx + dz * dz > 1e-4) target = Math.atan2(dx, dz);
      }
      v.last.copyFrom(pos);
      if (target !== null) {
        let d = target - v.yaw;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        v.yaw += d * Math.min(1, dt * 3);
        setInstanceYaw(v.root, v.yaw);
      }
      // Slow breathing bob.
      v.root.position.y = -1 + Math.sin(v.t * 1.6) * 0.06;
    }
  }

  /** Per-frame rig facing, gait speed, hit flash and distance LOD. */
  private _updateNpcRigs(dt: number): void {
    this._updateDragonVisuals(dt);
    if (this._npcRigs.size === 0) return;
    const playerPos = this.player.camera.position;
    for (const [npc, rig] of this._npcRigs) {
      // Follow the LodSystem's capsule cull so culled NPCs stop drawing too.
      const shown = npc.mesh.isVisible;
      if (rig.pivot.isEnabled(false) !== shown) rig.pivot.setEnabled(shown);
      const far = Vector3.DistanceSquared(npc.mesh.position, playerPos) > NPC_ANIMATION_FAR_DISTANCE_SQ;
      rig.setPaused(far && !npc.isDead);
      if (far) continue;
      // Fighters track the player; so does whoever the player is talking to.
      const engaged = !npc.isDead
        && (npc.isAggressive || npc.aiState === AIState.ALERT || npc.isAttackTelegraphing || npc.isInDialogue);
      rig.update(dt, npc.mesh.position, engaged ? playerPos : null);
    }
  }

  /**
   * Drive sun/moon direction, light colours, sky and fog from the clock and
   * weather, and keep the shadow frustum centred on the player.
   */
  private _updateAtmosphere(dt: number): void {
    const atmo = this.atmosphere;
    if (!atmo) return;
    const weather = this.weatherSystem?.visuals;
    if (weather) {
      // Light loss from the weather doubles as a smooth cloudiness signal.
      atmo.cloudiness = 0.15 + 0.85 * Math.min(1, Math.max(0, (1 - weather.sunScale) / 0.8));
      atmo.weatherFog = atmo.weatherFog ?? new Color3();
      atmo.weatherFog.set(weather.fogColor.r, weather.fogColor.g, weather.fogColor.b);
      atmo.weatherFogWeight = Math.min(0.85, Math.max(0, (weather.fogDensity - 0.006) / 0.02));
    }
    const hour = (this.timeSystem?.normalizedTime ?? 8 / 24) * 24;
    const state = atmo.update(hour, dt, {
      sun: this._sunLight,
      ambient: this.scene.getLightByName("hLight") as HemisphericLight | null,
      sunBase: this.graphics.lighting.sunBase,
      ambientBase: this.graphics.lighting.ambientBase,
      sunWeatherScale: weather?.sunScale,
      ambientWeatherScale: weather?.ambientScale,
    });
    // Weather particles + lightning.
    let flash = 0;
    if (this._weatherFx && this.player) {
      const ws = this.weatherSystem?.state ?? "clear";
      const target = ws === "storm" ? 1 : ws === "rain" ? 0.55 : 0;
      this._precipitation += (target - this._precipitation) * Math.min(1, dt * 0.25);
      const p = this.player.camera.position;
      const biome = this.world?.getBiome(Math.floor(p.x / this.world.chunkSize), Math.floor(p.z / this.world.chunkSize));
      this._weatherFx.update(dt, p, {
        precipitation: this._precipitation,
        snow: biome === "tundra",
        storm: ws === "storm",
        daylight: Math.max(0, Math.min(1, (state.ambientIntensity - 0.42) / 0.58)),
        outdoors: this.world?.visible ?? true,
        windX: WindState.dirX * WindState.strength * 3,
        windZ: WindState.dirZ * WindState.strength * 3,
      });
      flash = this._weatherFx.flashLight;
      if (flash > 0) {
        const amb = this.scene.getLightByName("hLight") as HemisphericLight | null;
        if (amb) {
          amb.intensity += flash * 1.4;
          amb.diffuse.set(0.75, 0.82, 1.0);
        }
      }
    }
    const daylight = Math.max(0, Math.min(1, (state.ambientIntensity - 0.42) / 0.58));
    if (this._fireFx && this.player) {
      this._fireFx.night = daylight < 0.3;
      this._fireFx.update(dt, this.player.camera.position);
    }
    this._updateWindowGlow(daylight);
    this._water?.update(dt, state, { x: WindState.dirX * WindState.strength, z: WindState.dirZ * WindState.strength });

    if (this.renderingPipeline) {
      this.renderingPipeline.imageProcessing.exposure = this.graphics.postProcess.exposure * state.exposure * (1 + flash * 0.8);
      // Night raises exposure, which also amplifies sharpening halos and
      // grain into crawling speckle on dark surfaces: ease both off after dark.
      const rp = this.renderingPipeline;
      if (rp.sharpenEnabled) rp.sharpen.edgeAmount = this.graphics.postProcess.sharpenEdgeAmount * (0.4 + 0.6 * daylight);
      if (rp.grainEnabled) rp.grain.intensity = 4 * (0.5 + 0.5 * daylight);
    }

    // Interiors: no daylight pouring in, and fog is dark rather than sky-blue.
    if (this.world && !this.world.visible) {
      if (this._sunLight) this._sunLight.intensity *= 0.12;
      const amb = this.scene.getLightByName("hLight") as HemisphericLight | null;
      if (amb) amb.intensity *= 0.7;
      this.scene.fogColor.set(0.02, 0.02, 0.025);
    }
    this._postFx?.update(state, atmo.cloudiness);
    if (this._horizon && this.player) this._horizon.update(this.player.camera.position, state, this.scene.fogColor, atmo.cloudiness);
    // Wind picks up with the weather.
    WindState.time += dt;
    WindState.strength += ((0.22 + atmo.cloudiness * 0.75) - WindState.strength) * Math.min(1, dt * 0.5);
    if (this._grass && this.world?.visible && this.player) {
      this._grass.update(this.player.camera.position.x, this.player.camera.position.z);
      this._grass.pump(2);
    }
    // Keep the shadow frustum centred on the player, placed up-light.
    const sun = this._sunLight;
    if (sun && this.player) {
      const p = this.player.camera.position;
      sun.position.set(
        p.x - state.lightDir[0] * 150,
        p.y - state.lightDir[1] * 150,
        p.z - state.lightDir[2] * 150,
      );
    }
  }

  /**
   * Initialise post-processing effects and the procedural sky dome.
   * Must be called after `Player` is created so its camera is available.
   */
  private _initPostProcessing(): void {
    // ── Procedural sky dome + time-of-day atmosphere ─────────────────────────
    // A custom sky shader (gradient, sun/moon, clouds, stars) whose horizon
    // colour is also the scene fog colour, so distant terrain melts into it.
    this.atmosphere = new AtmosphereController(this.scene);
    this.skyDome = this.atmosphere.mesh;
    this._horizon = new HorizonMountains(this.scene);
    this._updateAtmosphere(0);

    // ── Post-processing stack ────────────────────────────────────────────────
    // HDR pipeline (bloom, AA, grade, grain…), SSAO, god rays and lens flare,
    // each gated by the quality tier.  Skipped on WebGPU (driver issues).
    this._postFx = createPostFx(this.scene, this.player.camera, this.graphics, this.skyDome);
    this.renderingPipeline = this._postFx.pipeline;
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
          .loadModsFromManifest(`${import.meta.env.BASE_URL ?? "/"}mods/mods-manifest.json`)
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
  ): NPC | null {
      const npc = this.npcArchetypeSystem.spawnNpc(archetypeId, this.scene, new Vector3(x, 2, z));
      if (!npc) return null;
      this.scheduleSystem.addNPC(npc);
      const cx = Math.floor(x / this.world.chunkSize);
      const cz = Math.floor(z / this.world.chunkSize);
      const reg = this.world.getRegionAt(cx, cz);
      this.levelScalingSystem?.scaleNPC(npc, this.player.level, reg?.dangerLevel);
      this._registerPickpocketInventory(npc);
      this.lodSystem.register(npc.mesh, 120);
      chunkRecord.npcs.push(npc);
      return npc;
  }

  /** Map the equipped main-hand item to a combat weapon archetype (default: sword). */
  private _syncWeaponArchetype(): void {
      const weapon = this.equipmentSystem.getEquipped().get("mainHand");
      const archetype = this._weaponArchetypeForItem(weapon);
      this.combatSystem.setWeaponArchetype(archetype);
      this._viewModel?.setWeapon(archetype);
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
          this.eventBus.emit("quest:completed", { questId: update.questId, xpReward: update.xpReward });
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

  private _updateGameplayStep(deltaTime: number): void {
      this.player.update(deltaTime);
      this.audioSystem.updateFootsteps(deltaTime, this.player.camera.position);
      this.world.update(this.player.camera.position);

      this.timeSystem.update(deltaTime);
      this._updateDynamicWorldEventsOnHourChange();

      this.scheduleSystem.update(deltaTime);
      // Kernel features (indoors, raids, …) run their fixed-step systems here,
      // right after the schedules they react to.
      this.kernel.phases.run("sim", deltaTime);
      this.combatSystem.update(deltaTime);
      // Slow Time squeezes the NPC AI clock (movement, telegraphs, strikes).
      this.combatSystem.updateNPCAI(deltaTime * this.shouts.hostileTimeScale());

      for (const npc of this.scheduleSystem.npcs) {
        if (npc.mesh.position.y < NPC_FALL_RECOVERY_Y && !npc.isDead) this._recoverFallenNpc(npc);
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

      this._updateNpcRigs(deltaTime);
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

      const scaleLevel = this._adaptiveRes?.update(frameDelta, this.engine.getFps());
      if (scaleLevel) this.engine.setHardwareScalingLevel(scaleLevel);

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

      this._gameplayLoop.tick(frameDelta, (deltaTime) => {
          this._updateGameplayStep(deltaTime);
      });

      // After the gameplay step: WeatherSystem writes raw light/fog values on
      // its ticks, and the atmosphere composes the final ones on top.
      this._updateAtmosphere(frameDelta);

      // Conversation framing (turn to the speaker, zoom in / back out), and
      // ending it if the speaker is gone or the player was moved away.
      this.dialogueSystem.update(frameDelta);

      if (this._viewModel) {
        this._viewModel.setVisible(
          this.player.health > 0 && !this.dialogueSystem.isInDialogue && !this.mapEditorSystem.isEnabled,
        );
        this._viewModel.update(frameDelta, {
          blocking: this.combatSystem.isBlocking,
          sprinting: this.stealthSystem.movementMode === "running",
        });
      }

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

      // Features' HUD pieces (companion, follower, shout chips).
      this.kernel.phases.run("ui", frameDelta);

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
      // Conversations hide the crosshair and the quick-slot bar (Bethesda-style).
      const talking = this.dialogueSystem.isInDialogue;
      if (talking !== this._hudInDialogue) {
        this._hudInDialogue = talking;
        document.body.classList.toggle("is-in-dialogue", talking);
      }
      this.ui.setHtmlOverlayActive(
          talking ||
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
          this.craftingUI.isVisible ||
          this.jobs.window.isVisible ||
          this.graphicsSettingsUI.isVisible ||
          !!this._creditsUI?.isVisible
      );

      // Update active effects HUD (30 Hz, same as activeEffectsSystem)
      if (this._systemTickCounter % 2 === 0) {
        this.activeEffectHUD.update(this.activeEffectsSystem.activeEffects);
        this.quickSlotHUD.update(this.quickSlotSystem);
      }

      if (!this.ui.isDebugVisible) {
          // Primed so the first visible frame fills the overlay (otherwise it
          // sat empty for 12 frames — seconds at low frame rates).
          this._debugOverlayFrameSkip = 11;
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
      // Interiors become fast-travel destinations; the open world ("exterior",
      // entered on the way out of one) is not a place to travel to.
      if (this.cellManager.currentCell?.type !== "exterior") {
        const isNew = this.fastTravelSystem.discoverLocation(
            cellId, cellName, this.player.camera.position.clone()
        );
        this.ui.showNotification(
            isNew ? `Discovered: ${cellName}` : `Entered: ${cellName}`, 2500
        );
      }

      // LodSystem prunes disposed meshes in update(); chunk CDN props keep stable
      // refs for the exterior world, so we do not clear the registry here.

      // Sync world visibility with cell type (hide exterior when in interior)
      const isInterior = this.cellManager.isInterior;
      this.world.setVisible(!isInterior);
      if (isInterior) this._dressInterior(cellId);
  }

  /**
   * Give a freshly built interior cell real surfaces (rock walls, earthen
   * floor) and torchlight.  Torch meshes are named after the cell's walls so
   * they go when the cell's meshes are disposed on exit.
   */
  private _dressInterior(cellId: string): void {
      const tm = this.world.textureManager;
      const anchor = this.scene.getMeshByName("floor_" + cellId);
      for (const mesh of this.scene.meshes) {
          const mat = mesh.material;
          if (!(mat instanceof StandardMaterial) || mat.metadata?.dressed) continue;
          if (mat.name === "intFloor_" + cellId) {
              tm.applySurface(mat, "dirt", 3, 3, { tintStrength: 0 });
              mat.specularColor = new Color3(0.06, 0.05, 0.04);
              mat.metadata = { dressed: true };
          } else if (mat.name === "intWall_" + cellId) {
              tm.applySurface(mat, "rock", 4, 1, { tintStrength: 0 });
              mat.specularColor = new Color3(0.1, 0.09, 0.08);
              mat.specularPower = 32;
              mat.metadata = { dressed: true };
          }
      }
      if (!anchor) return;
      const torchMat = new StandardMaterial(`intTorchFlame_${cellId}`, this.scene);
      torchMat.emissiveColor = new Color3(1.0, 0.4, 0.05);
      torchMat.disableLighting = true;
      for (const [x, z] of [[-5.7, 0], [5.7, 0]] as const) {
          const flame = MeshBuilder.CreateCylinder(
              `intTorch_${cellId}_${x}`, { height: 0.3, diameterTop: 0, diameterBottom: 0.13, tessellation: 6 }, this.scene,
          );
          flame.position.set(x, 2.1, z);
          flame.material = torchMat;
          flame.isPickable = false;
          // Disposed with the room.
          flame.parent = anchor;
          flame.position.set(x - anchor.position.x, 2.1 - anchor.position.y, z - anchor.position.z);
          const light = new PointLight(`intTorch_${cellId}_${x}_light`, new Vector3(x, 2.2, z), this.scene);
          light.diffuse = new Color3(1.0, 0.6, 0.2);
          light.intensity = 1.1;
          light.range = 10;
          flame.onDisposeObservable.addOnce(() => light.dispose());
          this._fireFx?.attach({ flame, light, kind: "torch" });
      }
      anchor.onDisposeObservable.addOnce(() => torchMat.dispose());
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
          // (Only interiors are destinations; see _onCellEntered.)
          if (cell.type !== "exterior") {
            this.fastTravelSystem.discoverLocation(cell.id, cell.name, this.player.camera.position.clone());
          }
          // Sync world visibility with cell type
          this.world.setVisible(cell.type !== "interior");
      }
  }

  private _getInventoryGold(): number {
      const goldEntry = this.inventorySystem.items.find((item) => item.id === GOLD_ITEM_ID);
      return goldEntry?.quantity ?? 0;
  }

  /** Once per in-game hour: features (world events, raids, …) react to `time:hour`. */
  private _updateDynamicWorldEventsOnHourChange(): void {
      const elapsedHour = Math.floor(this.timeSystem.elapsedGameHours);
      if (elapsedHour === this._lastDynamicWorldEventHour) return;
      this._lastDynamicWorldEventHour = elapsedHour;
      this.eventBus.emit("time:hour", { hour: this.timeSystem.hour, elapsedHours: this.timeSystem.elapsedGameHours });
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
      // Features react to dialogue actions through the bus (e.g. "jobs:ask").
      this.eventBus.emit("dialogue:action", { eventId, npcName: this._currentDialogueNpcName });
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
      // "smithing:open" is the crafting feature's (it opens the forge after the talk).
      if (eventId === "smithing:open") return;
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
      gearCondition:   this.smithing.getEquippedConditionSummary(),
    });
  }






  /**
   * Windows glow warm after dark: the Medieval Village window-glass material
   * (shared by every building) gets an emissive tint scaled by darkness.
   */
  private _updateWindowGlow(daylight: number): void {
      const glow = Math.max(0, Math.min(1, 1 - daylight * 2.2));
      if (Math.abs(glow - this._windowGlow) < 0.02 && this.scene.materials.length === this._windowGlassScan) return;
      if (this.scene.materials.length !== this._windowGlassScan) {
        this._windowGlassScan = this.scene.materials.length;
        this._windowGlass = this.scene.materials.filter((m) => /WindowGlass/i.test(m.name)) as Array<{ emissiveColor?: Color3 }>;
      }
      this._windowGlow = glow;
      for (const m of this._windowGlass) {
        if (!m.emissiveColor) continue;
        // A uniform, so no markDirty() / shader rebuild is needed.
        m.emissiveColor.set(1.0 * glow, 0.58 * glow, 0.22 * glow);
      }
  }

  /**
   * The tundra dragon boss: an NPC the combat AI tracks, with the
   * Quaternius dragon body parented to its capsule.  Owned by the chunk.
   */
  private _spawnDragon(chunkKey: string, x: number, z: number, yaw: number): void {
        const chunkRecord = this._chunks.record(chunkKey);
        if (!chunkRecord) return;
        const [cx, cz] = chunkKey.split(",").map(Number);
        // Register the boss NPC first so the AI/combat system tracks it
        const dragonNpc = new NPC(this.scene, new Vector3(x, 2, z), `DragonBoss_${cx}_${cz}`);
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

        // Local dark-fantasy dragon body, parented to the capsule so it moves,
        // turns and fights with the boss (works offline; the old CDN model
        // was static and never followed the NPC).
        this.fantasyAssets.getInstance("qDragonSmall", (root) => {
          if (!root) return;
          if (dragonNpc.isDead || dragonNpc.mesh.isDisposed() || this._chunks.record(chunkKey) !== chunkRecord) {
            root.dispose();
            return;
          }
          root.parent = dragonNpc.mesh;
          root.position.set(0, -1, 0); // capsule origin sits 1 unit above its feet
          setInstanceScale(root, 2.5);
          setInstanceYaw(root, yaw);
          for (const m of root.getChildMeshes(false)) m.isPickable = false;
          this._dragonVisuals.set(dragonNpc, { root, yaw, last: dragonNpc.mesh.position.clone(), t: 0 });
          dragonNpc.mesh.onDisposeObservable.addOnce(() => this._dragonVisuals.delete(dragonNpc));
          this._chunks.track(chunkKey, chunkRecord, root, "boss");
        });
  }

  /** Unregister an NPC from every system and dispose it. */
  private _releaseNpc(npc: NPC): void {
      this.scheduleSystem.removeNPC(npc);
      this.combatSystem.removeNPC(npc);
      this.stealthSystem.removeNPC(npc);
      this.crimeSystem.removeNPC(npc);
      this.spellSystem.removeNPC(npc);
      this.projectileSystem.removeNPC(npc);
      this.lodSystem.unregister(npc.mesh);
      this.eventBus.emit("npc:released", { npcName: npc.mesh.name });
      npc.mesh.dispose();
  }

  /**
   * Provide the services features use and install the features
   * (engine overhaul, Phase 1).  Services resolve lazily, so systems created
   * later in the constructor are fine.
   */
  private _installFeatures(): void {
      const k = this.kernel;
      // eslint-disable-next-line @typescript-eslint/no-this-alias -- getters below
      const game = this;
      k.services.provide(ClockKey, {
        hour: () => this.timeSystem.hour,
        elapsedHours: () => this.timeSystem.elapsedGameHours,
      });
      k.services.provide(PlayerKey, {
        position: () => this.player.camera.position,
        level: () => this.playerLevelSystem.characterLevel,
      });
      k.services.provide(FeedbackKey, {
        notify: (text, ms) => this.ui.showNotification(text, ms ?? 3000),
        grant: (reward) => this._grantDynamicWorldEventReward(reward),
        addFame: (n) => this.fameSystem.addFame(n),
        markDirty: () => this.saveSystem.markDirty(),
      });
      k.services.provide(ActorsKey, {
        residents: (chunkKey) => this._chunks.record(chunkKey)?.npcs ?? [],
        spawnArchetype: (chunkKey, archetype, x, z) => {
          const record = this._chunks.record(chunkKey);
          return record ? this._spawnArchetypeNpc(archetype, record, x, z) : null;
        },
        despawn: (npc) => this._despawnNpc(npc),
        isTalkingTo: (npc) => npc.isInDialogue || npc.mesh.name === this._currentDialogueNpcName,
        byName: (name) => this.scheduleSystem.npcs.find((n) => n.mesh.name === name),
        all: () => this.scheduleSystem.npcs,
      });
      k.services.provide(WorldInfoKey, {
        get chunkSize() { return game.world.chunkSize; },
        biome: (cx, cz) => this.world.getBiome(cx, cz),
        pondAt: (cx, cz) => !!this.world.pondAt(cx, cz),
      });
      k.services.provide(TravelHostKey, {
        position: () => this.player.camera.position,
        teleport: (to) => { this.player.camera.position.copyFrom(to); },
        inCombat: () => this._isPlayerInCombat(),
        sneaking: () => this.stealthSystem.isCrouching,
        encumbered: () => this.player.isEncumbered,
        isInterior: (id) => this.cellManager.getCellDefinition(id)?.type === "interior",
        indoors: () => this.cellManager.isInterior,
        enterCell: (id, at) => { this.cellManager.enterCellById(id, at, true); },
        fade: (onBlack, onDone) => this.ui.playScreenFadeSequence({
          fadeOutMs: 400, holdMs: 120, fadeInMs: 450, onBlack, onComplete: onDone,
        }),
        passHours: (hours) => {
          this.timeSystem.advanceHours(hours);
          this.respawnSystem.update(this.timeSystem.elapsedGameTime);
          this.merchantRestockSystem.update(this.timeSystem.elapsedGameTime, this.barterSystem);
          this._updateDynamicWorldEventsOnHourChange();
          return this.timeSystem.timeString;
        },
        arrivalEvent: (at) => this.travelEventSystem.rollEvent({
          gameTimeHours: this.timeSystem.elapsedGameHours % 24,
          activeBiomeIds: [this.world.getBiome(Math.floor(at.x / this.world.chunkSize), Math.floor(at.z / this.world.chunkSize))],
          weatherId: this.weatherSystem.state,
          playerLevel: this.playerLevelSystem.characterLevel,
          getFlag: (flag) => this.frameworkRuntime.getFlag(flag),
          setFlag: (flag, value) => this.frameworkRuntime.setFlag(flag, value),
        })?.notification ?? null,
        hasMark: () => this.markRecallSystem.hasMarked,
        recall: () => !!this.markRecallSystem.recall(),
      });
      k.install(this._fastTravel);
      k.services.provide(DeathHostKey, {
        health: () => this.player.health,
        maxHealth: () => this.player.maxHealth,
        setHealth: (v) => { this.player.health = v; },
        position: () => this.player.camera.position,
        flash: () => this.ui.showHitFlash("rgba(180, 0, 0, 0.55)"),
        closeScreens: () => {
          if (this.dialogueSystem.isInDialogue) this.dialogueSystem.endDialogue();
          if (this.inventorySystem.isOpen) this.inventorySystem.toggleInventory();
          if (this._containerUI.isVisible) this._containerUI.onClose?.();
          if (this._barterUI.isVisible) this._barterUI.onClose?.();
          this._restoreGameplayInput();
        },
        purgeEffects: () => {
          for (const effect of this.activeEffectsSystem.activeEffects) this.activeEffectsSystem.removeEffect(effect.id);
        },
        calmAttackers: () => {
          // So the waking place is not a fight (and fast travel isn't blocked).
          for (const npc of this.scheduleSystem.npcs) {
            if (npc.isDead) continue;
            if (npc.aiState === AIState.ALERT || npc.aiState === AIState.INVESTIGATE || npc.aiState === AIState.CHASE || npc.aiState === AIState.ATTACK) {
              npc.aiState = npc.patrolPoints.length > 0 ? AIState.RETURN : AIState.IDLE;
              npc.isAggressive = false;
            }
          }
        },
      });
      k.install(new DeathFeature());
      this.saveSystem.setFastTravelSystem(this._fastTravel.places);
      const record = (chunkKey: string) => this._chunks.record(chunkKey);
      k.services.provide(SiteBuilderKey, {
        get scene() { return game.scene; },
        isLive: (chunkKey) => !!record(chunkKey),
        placeBuilding: (chunkKey, kind, origin) => {
          const r = record(chunkKey);
          if (r) this._chunks.placeBuilding(chunkKey, r, kind, origin);
        },
        placeProp: (chunkKey, key, x, z, rot) => {
          const r = record(chunkKey);
          if (r) this._chunks.placeProp(chunkKey, r, key, { x: 0, z: 0, rot: 0 }, x, z, rot);
        },
        placeSmithy: (chunkKey, x, z, rot) => {
          const r = record(chunkKey);
          if (r) this._chunks.placeSmithy(chunkKey, r, x, z, rot);
        },
        ownStructure: (chunkKey, mesh) => {
          const r = record(chunkKey);
          if (r) this._chunks.track(chunkKey, r, mesh, "structure");
          else mesh.dispose();
        },
        own: (chunkKey, mesh) => {
          const r = record(chunkKey);
          if (r) r.roots.push(mesh);
          else mesh.dispose();
        },
        addKeepOut: (fp) => {
          return this._chunks.addKeepOut(fp);
        },
        nightFlame: (name, x, y, z) => this._chunks.nightFlame(name, x, y, z),
        placeAsset: (chunkKey, key, at) => {
          if (!record(chunkKey)) return;
          this.fantasyAssets.getInstance(key, (root) => {
            if (!root) return;
            const r = record(chunkKey);
            if (!r) { root.dispose(); return; }
            root.position.set(at.x, at.y ?? 0, at.z);
            setInstanceYaw(root, at.yaw);
            if (at.scale !== undefined) setInstanceScale(root, at.scale);
            this._chunks.track(chunkKey, r, root, at.tier ?? "prop");
          });
        },
        spawnDragon: (chunkKey, x, z, yaw) => this._spawnDragon(chunkKey, x, z, yaw),
      });
      k.services.provide(InventoryKey, {
        count: (id) => this.inventorySystem.items.reduce((n, i) => (i.id === id ? n + i.quantity : n), 0),
        remove: (id, amount) => this.inventorySystem.removeQuantity(id, amount),
      });
      k.services.provide(QuestLogKey, {
        quests: () => this.questSystem.getQuests(),
        add: (quest) => this.questSystem.addQuest(quest, true),
      });
      k.services.provide(ScheduleKey, {
        behaviorOf: (npc) => this.scheduleSystem.behaviorOf(npc),
      });
      k.services.provide(BuildingsKey, {
        nearBuilding: (x, z, margin) => this._chunks.nearBuilding(x, z, margin),
      });
      k.services.provide(ModalKey, {
        suspendGameplay: () => this._suspendGameplayInput(),
        restoreGameplay: () => this._restoreGameplayInput(),
      });

      k.services.provide(WorldStateKey, {
        weather: () => this.weatherSystem.state,
        hasBounty: () => this.crimeSystem.getTotalBounty() > 0,
        biomeAt: (x, z) => this.world.getBiome(Math.floor(x / this.world.chunkSize), Math.floor(z / this.world.chunkSize)),
      });
      const lootRng = k.rng.stream("loot-drops");
      k.services.provide(LootKey, {
        dropNear: (tableId, count) => {
          const context = { playerLevel: this.player.level };
          for (let i = 0; i < count; i++) {
            const drop = this.lootTableSystem.rollTable(tableId, undefined, context).items[0];
            if (!drop) continue;
            const angle = lootRng.next() * Math.PI * 2;
            const dist = 6 + lootRng.next() * 6;
            const p = this.player.camera.position;
            new Loot(this.scene, new Vector3(p.x + Math.cos(angle) * dist, 0.5, p.z + Math.sin(angle) * dist), {
              id: drop.id,
              name: drop.name,
              description: drop.description ?? "",
              stackable: drop.stackable ?? false,
              quantity: drop.quantity ?? 1,
              weight: drop.weight,
              stats: drop.stats,
              slot: drop.slot as Item["slot"],
            });
          }
        },
      });

      const worldEvents = new WorldEventsFeature();
      k.install(worldEvents);
      this.saveSystem.setDynamicWorldEventSystem(worldEvents.dynamic);
      // Persist flavor-event cooldowns so reloading can't reroll one-shots.
      this.saveSystem.setTravelEventSystem(worldEvents.travel);
      this.saveSystem.setAmbientEventSystem(worldEvents.ambient);

      k.services.provide(AnimationKey, {
        idle: (m) => this.animationSystem.playIdle(m),
        walk: (m) => this.animationSystem.playWalk(m),
        run: (m) => this.animationSystem.playRun(m),
        death: (m) => this.animationSystem.playDeath(m),
        release: (name) => this.animationSystem.unregisterMesh(name),
      });
      k.services.provide(GameplayKey, { canAct: () => !this._isCombatInputBlocked() });
      k.services.provide(SkillsKey, {
        level: (id) => this.skillProgressionSystem?.getSkill(id)?.level ?? 0,
        gainXP: (id, base) => this.skillProgressionSystem?.gainXP(id, base * (this.classSystem?.xpMultiplierFor(id) ?? 1)),
      });
      k.install(this._crafting);
      k.services.provide(LawKey, {
        get crime() { return game.crimeSystem; },
        get persuasion() { return game.persuasionSystem; },
        serveJail: (bounty, factionId) => this.jailSystem.serveJailTime(
          bounty, factionId, this.timeSystem, this.skillProgressionSystem, this.crimeSystem, this.timeSystem.gameTime,
        ),
        addInfamy: (n) => this.fameSystem.addInfamy(n),
      });
      k.install(new ArrestFeature());
      k.services.provide(PurseKey, {
        gold: () => this._getInventoryGold(),
        spend: (amount) => this._consumeInventoryGold(amount),
      });
      const pets = new PetsFeature(this.scene);
      k.install(pets);
      this.saveSystem.setPetSystem(pets.pets);
      k.services.provide(ShoutHostKey, {
        gameTime: () => this.timeSystem.gameTime,
        stance: () => {
          const forward = this.player.getForwardDirection(1);
          forward.y = 0;
          forward.normalize();
          return { origin: this.player.camera.position, forward };
        },
        targets: () => this.combatSystem.npcs,
        dash: (distance) => {
          const f = this.player.getForwardDirection(1);
          const flat = new Vector3(f.x, 0, f.z);
          if (flat.lengthSquared() <= 0.001) return;
          flat.normalize();
          // Stop short of any wall between the player and the dash target.
          const pick = this.player.raycastForward(distance);
          const reach = pick?.hit ? Math.max(1, pick.distance - 0.8) : distance;
          this.player.camera.position.addInPlace(flat.scale(reach));
        },
        addEffect: (effect) => this.activeEffectsSystem.addEffect(effect),
        damage: (npc, raw, type) => {
          if (npc.isDead) return;
          const damage = applyDamageWithResistance(raw, npc, type);
          npc.takeDamage(damage);
          this.combatSystem.notifyHostileHit(npc, damage);
          if (npc.isDead) {
            this.ui.showNotification(`${npc.mesh.name} defeated!`);
            this.combatSystem.onNPCDeath?.(npc.mesh.name, npc.xpReward, npc);
          }
        },
        setAttackSpeedMultiplier: (m) => { this.combatSystem.externalAttackSpeedMultiplier = m; },
        clearWeather: () => this.weatherSystem.forceWeather("clear"),
      });
      const shouts = new ShoutsFeature();
      k.install(shouts);
      this.saveSystem.setDragonShoutSystem(shouts.shouts);
      const followers = new FollowersFeature();
      k.install(followers);
      this.saveSystem.setFollowerSystem(followers.followers);
      // A starter wolf companion for new games.
      pets.pets.grantPet("pet_wolf");

      k.services.provide(MountHostKey, {
        canAct: () => !this.isPaused && !this.dialogueSystem.isInDialogue,
        setMoveSpeedMultiplier: (m) => { (this.player as unknown as { moveSpeedMultiplier?: number }).moveSpeedMultiplier = m; },
        unlockAchievement: (id) => { this._achievements?.unlock(id as never); },
        give: (item) => { this.inventorySystem.addItem(item); },
      });
      const mounts = new MountsFeature();
      k.install(mounts);
      this.saveSystem.setHorseSystem(mounts.horses);

      k.install(new IndoorsFeature());
      k.install(new VillagesFeature());
      k.install(new WorldSitesFeature());

      const raids = new VillageRaidFeature();
      k.install(raids);
      this.saveSystem.setVillageRaids(raids.rules);

      const jobs = new VillageJobsFeature();
      k.install(jobs);
      this.saveSystem.setVillageJobs(jobs.rules);
  }

  /** Remove one NPC from the world and every system (and its chunk's list). */
  private _despawnNpc(npc: NPC): void {
      this._chunks.forget(npc);
      this._releaseNpc(npc);
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
          this.craftingUI.isVisible ||
          this.jobs.window.isVisible ||
          this.characterSheetUI.isVisible ||
          this.graphicsSettingsUI.isVisible ||
          !!this._creditsUI?.isVisible ||
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
