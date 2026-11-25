import { Scene } from "@babylonjs/core/scene";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import type { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { AtmosphereController } from "./rendering/sky-dome";
import { createTerrainMaterial } from "./rendering/terrain-material";
import { WeaponViewModel } from "./rendering/viewmodel";
import { AdaptiveResolution } from "./rendering/adaptive-resolution";
import { NpcVisuals } from "./rendering/npc-visuals";
import { NpcTierSystem } from "./systems/npc-tier-system";
import { actors } from "./entities/actors";
import { teleportNpc } from "./entities/npc-teleport";
import { Dead, Engaged } from "./core/ecs/actors";
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
import { EquipmentSystem } from "./systems/equipment-system";
import { SaveSystem } from "./systems/save-system";
import { AchievementSystem } from "./platform/achievement-system";
import { getDesktopBridge } from "./platform/desktop-bridge";
import { desktopMirroredSaveStore } from "./platform/save-store";
import type { CreditsUI } from "./ui/credits-ui";
import { QuestSystem } from "./systems/quest-system";
import { InteractionSystem } from "./systems/interaction-system";
import { SkillTreeSystem } from "./systems/skill-tree-system";
import { AudioSystem } from "./systems/audio-system";
import { NavigationSystem } from "./systems/navigation-system";
import { FrameworkRuntime } from "./framework/runtime/framework-runtime";
import { frameworkBaseContent } from "./framework/content/base-content";
import { AttributeSystem } from "./systems/attribute-system";
import { TimeSystem } from "./systems/time-system";
import { StealthSystem } from "./systems/stealth-system";
import { CrimeSystem } from "./systems/crime-system";
import { ContainerSystem } from "./systems/container-system";
import { ProjectileSystem } from "./systems/projectile-system";
import { BarterSystem } from "./systems/barter-system";
import { ShopSystem } from "./systems/shop-system";
import { registerStarterMerchants } from "./content/starter-merchants";
import { seedStartingArea, STARTER_QUESTS } from "./content/starting-area";
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
import { RaidsKey, type RaidsService } from "./features/village-raids/raid-feature";
import { VillagesKey, type VillagesService } from "./features/villages/villages-feature";
import { WorldSitesKey, type WorldSitesService } from "./features/world-sites/world-sites-feature";
import { MountsKey, type MountsService } from "./features/mounts/mounts-feature";
import { WorldEventsKey } from "./features/world-events/world-events-feature";
import { JobsKey, type JobsService } from "./features/village-jobs/jobs-feature";
import type { ForgeRegistry, SmithingController } from "./systems/smithing-controller";
import type { EnchantingSystem } from "./systems/enchanting-system";
import type { EnchantingUI } from "./ui/enchanting-ui";
import { LodSystem } from "./systems/lod-system";
import { WorldEnvironment } from "./rendering/world-environment";
import { ChunkContent, type ChunkRecord } from "./world/chunk-content";
import { dressInterior } from "./world/interior-dressing";
import { WeatherSystem } from "./systems/weather-system";
import { GraphicsSystem } from "./systems/graphics-system";
import { QuickSlotSystem, isConsumableItem, type QuickSlotKey } from "./systems/quickslot-system";
import { WaitSystem } from "./systems/wait-system";
import { SkillProgressionSystem } from "./systems/skill-progression-system";
import type { FastTravelSystem } from "./systems/fast-travel-system";
import { FastTravelFeature, TravelKey } from "./features/fast-travel/fast-travel-feature";
import { CharacterFeature, CharacterKey } from "./features/character/character-feature";
import { ProgressionFeature, ProgressionKey } from "./features/progression/progression-feature";
import { SurvivalFeature } from "./features/survival/survival-feature";
import { LevelScalingSystem } from "./systems/level-scaling-system";
import { FameSystem } from "./systems/fame-system";
import { ActiveEffectsSystem } from "./systems/active-effects-system";
import { JailSystem } from "./systems/jail-system";
import type { SpellMakingSystem } from "./systems/spell-making-system";
import { SpellMakingFeature, SpellMakingKey } from "./features/spell-making/spell-making-feature";
import { RespawnSystem } from "./systems/respawn-system";
import { MerchantRestockSystem } from "./systems/merchant-restock-system";
import type { BirthsignSystem } from "./systems/birthsign-system";
import type { ClassSystem } from "./systems/class-system";
import type { RaceSystem } from "./systems/race-system";
import type { PlayerLevelSystem } from "./systems/player-level-system";
import type { CharacterSheetUI } from "./ui/character-sheet-ui";
import { OnboardingKey, type OnboardingService } from "./features/onboarding/onboarding-feature";
import { resolveDialogueIdForNpcMeshName } from "./systems/dialogue-npc-resolve";
import { buildHelpOverlayLines } from "./ui/editor-help-overlay";
import type { EditorFactory, EditorPlugin } from "./game/editor-plugin";
import type { FastTravelUI } from "./ui/fast-travel-ui";
import type { SpellMakingUI } from "./ui/spell-making-ui";
import type { GuardEncounterUI } from "./ui/guard-encounter-ui";
import { ArrestKey } from "./features/arrest/arrest-feature";
import type { LevelUpUI } from "./ui/level-up-ui";
import { StableUI } from "./ui/stable-ui";
import { SaddlebagUI } from "./ui/saddlebag-ui";
import { DailyScheduleSystem } from "./systems/daily-schedule-system";
import { HorseSystem } from "./systems/horse-system";
import { SwimmingSystem } from "./systems/swimming-system";
import { DiseaseSystem } from "./systems/disease-system";
import type { SurvivalSystem } from "./systems/survival-system";
import type { TravelEventSystem } from "./systems/travel-event-system";
import { AmbientEventSystem } from "./systems/ambient-event-system";
import { LeveledListSystem, ALL_BUILT_IN_LEVELED_LISTS } from "./systems/leveled-list-system";
import { EventManagerSystem } from "./systems/event-manager-system";
import { AnimationSystem } from "./systems/animation-system";
import { FantasyAssetLoader } from "./systems/fantasy-asset-loader";
import type { PetSystem } from "./systems/pet-system";
import type { PetUI } from "./ui/pet-ui";
import { PetsKey, type PetsService } from "./features/pets/pets-feature";
import type { PickpocketSystem } from "./systems/pickpocket-system";
import type { PickpocketUI } from "./ui/pickpocket-ui";
import { PickpocketFeature, PickpocketKey, COIN_PURSE } from "./features/pickpocket/pickpocket-feature";
import type { BarterUI } from "./ui/barter-ui";
import type { ContainerUI } from "./ui/container-ui";
import { TradeFeature } from "./features/trade/trade-feature";
import type { Item } from "./systems/inventory-system";
import { ScreenshotSystem } from "./systems/screenshot-system";
import { UIAnimator } from "./ui/ui-animator";
import { MarkRecallSystem } from "./systems/mark-recall-system";
import { TrainerSystem } from "./systems/trainer-system";
import type { FollowerSystem } from "./systems/follower-system";
import type { FollowerUI } from "./ui/follower-ui";
import { FollowersKey, type FollowersService } from "./features/followers/followers-feature";
import { ActiveEffectHUD } from "./ui/active-effect-hud";
import { HudPresenter, type HudSources } from "./ui/hud-presenter";
import { ModalRegistry } from "./ui/modal-registry";
import { PlayerPack } from "./game/player-pack";
import { QuestBridge } from "./game/quest-bridge";
import { NpcRoster } from "./game/npc-roster";
import { CombatControls } from "./game/combat-controls";
import { PlayFocus } from "./input/play-focus";
import { CameraDirector, DeathCamera } from "./rendering/camera-director";
import { seedGameRandomness, installGameFeatures } from "./game/game-services";
import { weaponArchetypeOf } from "./game/weapon-archetype";
import { QuickSlotHUD } from "./ui/quickslot-hud";
import { PerkSystem } from "./systems/perk-system";
import { DynamicWorldEventSystem } from "./systems/dynamic-world-event-system";
import type { DynamicEventReward } from "./systems/dynamic-world-event-system";
import type { DragonShoutSystem } from "./systems/dragon-shout-system";
import type { ShoutUI } from "./ui/shout-ui";
import { ShoutsKey, type ShoutsService } from "./features/shouts/shouts-feature";
import type { GraphicsSettingsUI } from "./ui/graphics-settings-ui";
import { SettingsFeature, SettingsKey } from "./features/settings/settings-feature";

/** XP awarded to the Sneak skill for each second of active sneaking. */
const SNEAK_XP_PER_SECOND = 2;
/** NPCs below this height fell through the world (e.g. spawned before their chunk). */
const NPC_FALL_RECOVERY_Y = -30;
/** Inventory item ID used for player gold (bounty payment check). */

export class Game {
  public scene: Scene;
  public canvas: HTMLCanvasElement;
  public engine: Engine | WebGPUEngine;
  public player: Player;
  public ui: UIManager;
  public world: WorldManager;

  /** Light, sky, post-processing, water, grass, particles and their per-frame blend. */
  private _env!: WorldEnvironment;
  /** Shadow generator driven by the directional sun light. */
  public get shadowGenerator(): ShadowGenerator | null { return this._env?.shadows ?? null; }
  /** Rendering configuration preset (lighting, sky, post-processing, fog). */
  public readonly graphics: GraphicsSystem = GraphicsSystem.fromSavedOrAutoDetect();
  /** Procedural sky-dome mesh (skybox).  Null before the sky is set up. */
  public get skyDome(): Mesh | null { return this._env?.sky ?? null; }
  /** Time-of-day sky, sun/moon light and fog driver.  Null before the sky is set up. */
  public get atmosphere(): AtmosphereController | null { return this._env?.atmosphere ?? null; }
  /** Dynamic render scale defending the tier's target FPS. */
  private _adaptiveRes: AdaptiveResolution | null = null;
  /** First-person weapon (CC0 KayKit weapons). */
  private _viewModel: WeaponViewModel | null = null;
  /** Rigged NPC models (CC0 KayKit characters). */
  private _npcVisuals!: NpcVisuals;
  private readonly _npcTiers = new NpcTierSystem(actors);
  /** Village plans by chunk key (null = no village there); deterministic, cached. */
  /** DefaultRenderingPipeline (bloom, FXAA, sharpen, tone-mapping, vignette). */
  public get renderingPipeline(): DefaultRenderingPipeline | null { return this._env?.pipeline ?? null; }
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
  public get spellMakingUI(): SpellMakingUI { return this._spellMaking.panel; }
  public get guardEncounterUI(): GuardEncounterUI { return this.kernel.services.get(ArrestKey).panel; }
  private readonly _progression = new ProgressionFeature();
  public get levelUpUI(): LevelUpUI { return this._progression.levelUp; }
  /** Tab-open HTML overlay — identity, attributes, skills, reputation. */
  public get characterSheetUI(): CharacterSheetUI { return this._progression.sheet; }
  public get stableUI(): StableUI { return this.mounts.stable; }
  public get saddlebagUI(): SaddlebagUI { return this.mounts.saddlebag; }
  public uiAnimator: UIAnimator = new UIAnimator();
  private readonly _settings = new SettingsFeature();
  public get graphicsSettingsUI(): GraphicsSettingsUI { return this._settings.dialog; }

  // v2 systems (Oblivion-lite)
  public attributeSystem: AttributeSystem;
  public timeSystem: TimeSystem;
  public stealthSystem: StealthSystem;
  public crimeSystem: CrimeSystem;
  /** Pickpocketing (built with the game: NPCs register what they carry first). */
  private readonly _thief = new PickpocketFeature((id) => this.frameworkRuntime?.contentRegistry.getItemDefinition(id)?.name);
  public get pickpocketSystem(): PickpocketSystem { return this._thief.system; }
  public get pickpocketUI(): PickpocketUI { return this._thief.panel; }
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
  /** The editor suite, when the editor app plugged it in (see game/editor-plugin.ts). */
  public editors: EditorPlugin | null = null;
  /** True while the map editor holds the world. */
  public get mapEditorActive(): boolean { return this.editors?.mapEditorActive ?? false; }

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
  private _spellMaking!: SpellMakingFeature;
  public get spellMakingSystem(): SpellMakingSystem { return this._spellMaking.altar; }
  public respawnSystem: RespawnSystem;
  public merchantRestockSystem: MerchantRestockSystem;

  // v11 systems (Oblivion depth: character creation — birthsign and class)
  /** Race, birthsign, class and the creation wizard. */
  private readonly _character = new CharacterFeature();
  public get birthsignSystem(): BirthsignSystem { return this._character.birthsigns; }
  public get classSystem(): ClassSystem { return this._character.classes; }
  public get raceSystem(): RaceSystem { return this._character.races; }

  // v12 systems (Oblivion depth: character progression — skill-based level-up)
  public get playerLevelSystem(): PlayerLevelSystem { return this._progression.levels; }

  // v18 systems
  public dailyScheduleSystem: DailyScheduleSystem;

  // v19 systems
  public get horseSystem(): HorseSystem { return this.mounts.horses; }

  // v20 systems
  public swimSystem: SwimmingSystem;

  // v21 systems
  public diseaseSystem: DiseaseSystem;

  // v28+ survival / flavor-event systems
  private readonly _survival = new SurvivalFeature();
  public get survivalSystem(): SurvivalSystem { return this._survival.needs; }
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

  private readonly _trade = new TradeFeature();
  private get _barterUI(): BarterUI { return this._trade.barterPanel; }
  private get _containerUI(): ContainerUI { return this._trade.containerPanel; }
  /** When set, open barter after dialogue teardown (pointer lock restored first). */
  /** Set by the smith's "use your forge" dialogue choice; opened once dialogue closes. */
  /** Shared parchment material for village notice boards. */

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

  /** Debounce for witnessed-assault crime reports (one per 3s per combat burst). */
  /** True once the Bandit Bounty framework quest has been activated by a bandit kill. */
  private _banditQuestStarted: boolean = false;
  /** Active difficulty setting (scales NPC→player damage). */
  /** Active camera look sensitivity setting. */
  /** Mesh name of the NPC the player is currently talking to (persuasion pricing). */
  private _currentDialogueNpcName: string | null = null;
  /** True while the character-creation wizard is up (Escape must not pause beneath it). */
  private _inCharacterCreation: boolean = false;

  /** Gold and items: the one player inventory (dialogue and quests use it too). */
  private readonly _pack = new PlayerPack(
    () => this.inventorySystem,
    (id) => this.frameworkRuntime.contentRegistry.getItemDefinition(id) ?? undefined,
  );
  /** Bringing NPCs into the world and taking them out, the same way every time. */
  private readonly _roster = new NpcRoster({
    schedule: () => this.scheduleSystem,
    trackers: () => [this.combatSystem, this.stealthSystem, this.crimeSystem, this.spellSystem, this.projectileSystem],
    lod: () => this.lodSystem,
    scale: (npc, regional) => {
      const level = this.player.level;
      if (!regional) { this.levelScalingSystem?.scaleNPC(npc, level); return; }
      const p = npc.mesh.position, size = this.world.chunkSize;
      this.levelScalingSystem?.scaleNPC(npc, level, this.world.getRegionAt(Math.floor(p.x / size), Math.floor(p.z / size))?.dangerLevel);
    },
    pockets: () => ({ registerNpc: (npc) => this._thief.registerNpc(npc), forget: (name) => { this.pickpocketSystem.removeNpcInventory(name); } }),
    events: () => this.eventBus,
  });
  /** Quest events in, framework quest rewards and failures out. */
  private readonly _quests = new QuestBridge({
    framework: () => this.frameworkRuntime,
    refreshLog: () => this.questSystem.refresh(),
    events: () => this.eventBus,
    pack: this._pack,
    addXp: (xp) => this.player.addExperience(xp),
    addFame: (amount) => this.fameSystem.addFame(amount),
    notify: (text, ms) => this.ui.showNotification(text, ms),
    markDirty: () => this.saveSystem.markDirty(),
  });
  /** What the combat keys and mouse do. */
  private readonly _combatControls = new CombatControls({
    combat: () => this.combatSystem,
    projectiles: () => this.projectileSystem,
    stealth: () => this.stealthSystem,
    spells: () => this.spellSystem,
    races: () => this.raceSystem,
    effects: () => this.activeEffectsSystem,
    gameTime: () => this.timeSystem.gameTime,
    blocked: () => this._isCombatInputBlocked(),
    free: () => !this.isPaused && !this.dialogueSystem.isInDialogue,
    swing: (power) => { this._viewModel?.swing(power); this.audioSystem.playMeleeAttack(); },
    twang: () => this.audioSystem.playMeleeAttack(),
    notify: (text, ms) => this.ui.showNotification(text, ms),
  });
  /** Who has the player's input; the one place pointer lock changes. */
  private readonly _focus = new PlayFocus({
    lockPointer: () => this.canvas.requestPointerLock(),
    unlockPointer: () => { if (typeof document !== "undefined") document.exitPointerLock(); },
    attachCamera: () => this.player.camera.attachControl(this.canvas, true),
    detachCamera: () => this.player.camera.detachControl(),
    setInteractionBlocked: (b) => { if (this.interactionSystem) this.interactionSystem.isBlocked = b; },
  });
  /** The camera stack: the player's view unless a shot (dialogue framing, the death fall) runs. */
  private readonly _camera = new CameraDirector();
  private readonly _deathCamera = new DeathCamera(() => this.player?.camera ?? null);
  /** Panels that take over the screen (Escape, pause, input blocking). */
  private readonly _modals = new ModalRegistry();
  /** Bars, clock, compass, readouts and the debug overlay. */
  private readonly _hud = new HudPresenter(() => this._hudSources());

  // Last LOD culled count for the debug overlay (updated from lodSystem.update())
  private _lastLodCulled: number = 0;

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
  private get _creditsUI(): CreditsUI { return this._settings.credits; }

  /** Short post-creation tips; advances on Space or when the hinted action occurs. */
  /** First-run tips (the onboarding feature). */
  private get _tips(): OnboardingService { return this.kernel.services.get(OnboardingKey); }
  private _lastDynamicWorldEventHour = -1;

  constructor(scene: Scene, canvas: HTMLCanvasElement, engine: Engine | WebGPUEngine, private readonly _editorFactory?: EditorFactory) {
    this.scene = scene;
    this.canvas = canvas;
    this.engine = engine;

    this.init();
  }

  /**
   * The game's reactions that must come before the features' own (they are
   * subscribed first): after a load, the world is cleaned up and the cell
   * rebuilt before features reset; after a conversation, the barter purse
   * is synced before features act on it; a loaded chunk opens its scope
   * before anything is put in it.
   */
  private _wireEarlyReactions(): void {
    const bus = this.eventBus;
    bus.on("save:loaded", () => {
      this._cleanupCollectedLoot();
      this._hydrateCellAfterLoad();
      // Saved equipment bypasses equip() — re-sync the weapon archetype.
      this._syncWeaponArchetype();
      // Don't re-announce the bandit bounty if it's already live/finished.
      if (this.frameworkRuntime.questEngine.getQuestStatus("quest_bandit_bounty") !== "inactive") {
        this._banditQuestStarted = true;
      }
    });
    bus.on("dialogue:closed", () => { this.barterSystem.playerGold = this._pack.gold(); });
    bus.on("chunk:loaded", ({ chunkKey, cx, cz, biome }) => {
      this._chunks.open(chunkKey);
      // What goes where lives in the world-sites feature (villages, camps,
      // inns, homesteads, the dragon, wild nature).
      this.worldSites.populate(chunkKey, cx, cz, biome);
      // New ground and walls: the navmesh rebuilds (debounced, in a worker).
      this.navigationSystem.requestRebuild();
    });
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
      this._helpOverlayEl.innerHTML = buildHelpOverlayLines(this.mapEditorActive).join("<br>");
      this._helpOverlayEl.style.display = "block";
    } else {
      this._helpOverlayEl.style.display = "none";
    }
  }

  private _refreshHelpOverlayIfVisible(): void {
    if (!this._helpOverlayVisible || !this._helpOverlayEl) return;
    this._helpOverlayEl.textContent = buildHelpOverlayLines(this.mapEditorActive).join("\n");
  }



  init(): void {
    // The event bus first: systems report on it as they are made.
    this.eventBus = new GameEventBus();
    this.kernel = new Kernel({ events: this.eventBus });
    this._wireEarlyReactions();
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
    this._env = new WorldEnvironment({
      scene: this.scene,
      graphics: this.graphics,
      dayFraction: () => this.timeSystem?.normalizedTime ?? null,
      weather: () => this.weatherSystem ?? null,
      playerPosition: () => this.player?.camera.position ?? null,
    });
    this._env.initLights();
    this.player = new Player(this.scene, this.canvas);
    // Post-processing and skybox require the camera, so initialise after Player.
    this._env.initSky(this.player.camera);
    this._npcVisuals = new NpcVisuals({
      scene: this.scene,
      shadows: this.shadowGenerator,
      modelBase: `${import.meta.env.BASE_URL ?? "/"}model/kaykit/`,
      animation: () => this.animationSystem,
    });
    this._npcVisuals.init();
    this._viewModel = new WeaponViewModel(
      this.scene, this.player.camera, `${import.meta.env.BASE_URL ?? "/"}model/kaykit/weapons/`,
    );
    this.ui = new UIManager(this.scene);
    this.world = new WorldManager(this.scene, this.shadowGenerator, null, this.graphics.texture);
    this.world.terrainMaterial = createTerrainMaterial(this.scene, this.world.textureManager);
    // Village settlements keep their footprint clear of trees, rocks and ruins.
    // (Called once chunks stream in, after the villages feature is installed.)
    this.world.clearingAt = (cx, cz) => this.villages.clearingAt(cx, cz);
    this._env.initFoliage(this.world);
    this.navigationSystem = new NavigationSystem(this.scene);
    this.scheduleSystem = new ScheduleSystem();
    // Villagers walking to work, home or a wander spot follow navmesh routes.
    this.scheduleSystem.nav = this.navigationSystem;
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

    // Wire up structure NPC spawning so guards are tracked by schedule & combat.
    // (Full wiring including level scaling is done in the v8 block below.)

    this.combatSystem       = new CombatSystem(this.scene, this.player, this.scheduleSystem.npcs, this.ui, this.navigationSystem);
    this.dialogueSystem     = new DialogueSystem(this.scene, this.player, this.scheduleSystem.npcs, this.canvas);
    this.inventorySystem    = new InventorySystem(this.player, this.ui, this.canvas);
    this.inventorySystem.events = this.eventBus;
    this.equipmentSystem    = new EquipmentSystem(this.player, this.inventorySystem, this.ui);
    // Equipped weapon drives the combat weapon archetype (sword/bow/staff/...).
    this.equipmentSystem.events = this.eventBus;
    // Gear changed: the weapon archetype follows; equipped gear is saved state.
    // (Wear tracking listens in the crafting feature.)
    this.eventBus.on("equipment:changed", () => {
      this._syncWeaponArchetype();
      this.saveSystem.markDirty();
    });
    this._syncWeaponArchetype();
    this.saveSystem         = new SaveSystem(this.player, this.inventorySystem, this.equipmentSystem, this.ui);
    const mirroredSaves = desktopMirroredSaveStore();
    if (mirroredSaves) this.saveSystem.setStorage(mirroredSaves);
    this.saveSystem.setCombatSystem(this.combatSystem);
    this.questSystem        = new QuestSystem(this.ui);
    this.questSystem.events = this.eventBus;
    this.saveSystem.setQuestSystem(this.questSystem);
    this.saveSystem.events = this.eventBus;
    this.interactionSystem  = new InteractionSystem(this.scene, this.player, this.inventorySystem, this.dialogueSystem, this.ui);
    this.interactionSystem.cellManager = this.cellManager;
    this.dialogueSystem.focus = this._focus;
    // The camera stack runs the dialogue framing (and outranks it with the death fall).
    this.dialogueSystem.driveCamera = false;
    const framing = this.dialogueSystem.camera;
    this._camera.add({ id: "dialogue", get active() { return framing.phase !== "idle"; }, update: (dt) => framing.update(dt) });
    this._camera.add(this._deathCamera);
    this.inventorySystem.focus = this._focus;
    this.skillTreeSystem    = new SkillTreeSystem(this.player, this.ui);
    this.ui.events = this.eventBus;
    this.eventBus.on("ui:skillPurchase", ({ treeIndex, skillIndex }) => this.skillTreeSystem.purchaseSkill(treeIndex, skillIndex));
    this.saveSystem.setSkillTreeSystem(this.skillTreeSystem);
    this.audioSystem        = new AudioSystem();
    // The base content plus the starter quests (one quest engine for all).
    this.frameworkRuntime   = new FrameworkRuntime({ ...frameworkBaseContent, quests: [...frameworkBaseContent.quests, ...STARTER_QUESTS] }, {
      inventoryCapacity: this.inventorySystem.maxCapacity,
      fetchImpl: (url: string) => fetch(url),
      skillLevelProvider: (skillId: string) => this.skillTreeSystem.getSkillRank(skillId),
      // Dialogue chance rolls come from a seeded stream (the kernel is built later).
      random: () => this.kernel.rng.stream("dialogue").next(),
    });
    this.frameworkRuntime.questEngine.activateQuest("quest_guard_resolution");
    for (const q of STARTER_QUESTS) this.frameworkRuntime.questEngine.activateQuest(q.id);
    this.questSystem.setFramework(() => this.frameworkRuntime?.questEngine ?? null);
    this.saveSystem.setFrameworkRuntime(this.frameworkRuntime);
    this.dialogueSystem.dialogueSessionProvider = (targetNpc) => {
      this._currentDialogueNpcName = targetNpc.key;
      return this._createFrameworkDialogueSession(targetNpc.key);
    };
    this._loadFrameworkMods();
    // Editor tools (map editor, creators, bundles, asset browser, hub): only
    // in the editor app, which passes them in.
    this.editors = this._editorFactory?.(this, {
      suspendGameplay: () => this._suspendGameplayInput(),
      restoreGameplay: () => this._restoreGameplayInput(),
      editorMode: (on) => {
        // The editor holds input, and its own chords replace the play bindings.
        if (on) this._focus.take("editor"); else this._focus.give("editor");
        this._inputAdapter.setContext(on ? "editor" : "play");
      },
      modeChanged: () => this._refreshHelpOverlayIfVisible(),
    }) ?? null;


    // ── v2 system wiring ──────────────────────────────────────────────────────
    this.stealthSystem   = new StealthSystem(this.player, this.scheduleSystem.npcs, this.ui, this.scene);
    this.crimeSystem     = new CrimeSystem(this.player, this.scheduleSystem.npcs, this.ui, this.scene);
    this.containerSystem = new ContainerSystem(this.scene, this.player, this.inventorySystem, this.ui);
    this.projectileSystem = new ProjectileSystem(this.scene, this.player, this.scheduleSystem.npcs, this.ui);
    this.projectileSystem.stealthSystem = this.stealthSystem;
    this.barterSystem    = new BarterSystem(this.inventorySystem, this.ui);
    this.shopSystem      = new ShopSystem();
    this.barterSystem.events = this.eventBus;
    this.eventBus.on("barter:transaction", () => this._pack.setGold(this.barterSystem.playerGold));
    this.frameworkRuntime.setDialogueHostHooks({
      onDialogueHostEvent: (eventId, payload) => this._handleDialogueHostEvent(eventId, payload),
      onDialogueConsumeItem: (itemId, quantity) => this._pack.consume(itemId, quantity),
      onDialogueGiveItem: (itemId, quantity) => this._pack.give(itemId, quantity),
      dialogueInventoryCount: (itemId) => this._pack.count(itemId),
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
    this.interactionSystem.stealthSystem = this.stealthSystem;
    this.interactionSystem.pickpocketSystem = this.pickpocketSystem;
    this.interactionSystem.sneakLevelProvider = () =>
      this.skillProgressionSystem.getSkill("sneak")?.level ?? 0;
    this.interactionSystem.events = this.eventBus;
    this.eventBus.on("interact:pickpocket", ({ npc }) => this.kernel.services.get(PickpocketKey).open(npc));
    // Seed the starting cast (structure/archetype spawns register on arrival).
    for (const npc of this.scheduleSystem.npcs) this._thief.registerNpc(npc);

    // ── v3 system wiring ──────────────────────────────────────────────────────
    this._achievements = new AchievementSystem();
    this.eventBus.on("achievement:unlocked", ({ definition }) => {
      this.ui.showNotification(`Achievement unlocked: ${definition.name}`, 4000);
      const bridge = getDesktopBridge();
      if (bridge) void bridge.unlockAchievement(definition.id);
    });
    this._achievements.bind(this.eventBus);
    void this._achievements.syncWithDesktop();
    this.lootTableSystem = new LootTableSystem();
    for (const t of STARTER_LOOT_TABLES) this.lootTableSystem.registerTable(t);

    // NPC archetype factory — pre-load archetypes from base content
    this.npcScheduleSystem = new NpcScheduleSystem();
    this.npcArchetypeSystem = new NpcArchetypeSystem();
    this.npcArchetypeSystem.scheduleSystem = this.npcScheduleSystem;
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
    // Registered meshes are pruned when disposed; no global clear on cell travel.
    this.lodSystem = new LodSystem({ updateEveryNFrames: 5 });
    this.lodSystem.setQuality(this.graphics.tier);
    this.lodSystem.setCamera(this.player.camera);
    this.world.setLodSystem(this.lodSystem);
    this._gamepadInput.setCamera(this.player.camera);

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
    this._installFeatures();
    // Forget condition for gear that left the world (dropped, or wiped by a shop restock).
    this.eventBus.on("save:beforeSave", () => {
      this.smithing.pruneConditions([
        ...this.inventorySystem.items,
        ...this.equipmentSystem.getEquipped().values(),
        ...(this.horseSystem?.ownedHorses ?? []).flatMap((h) => this.horseSystem.getSaddlebag(h.id) ?? []),
        // Sold gear keeps its wear while it sits in a shop (no free repair by buyback).
        ...[...(this.barterSystem?.merchants.values() ?? [])].flatMap((m) => m.inventory),
      ]);
    });
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
    this.weatherSystem.events = this.eventBus;
    this.saveSystem.setWeatherSystem(this.weatherSystem);

    // QuickSlotSystem: bind consumable items to hotkeys 7, 8, 9, 0.
    this.quickSlotSystem = new QuickSlotSystem(this.inventorySystem, this.player, this.ui);
    // Seed slot 7 with the starter health potion (if the player has one)
    this.quickSlotSystem.bindSlot("7", "potion_hp_01");
    this.quickSlotSystem.events = this.eventBus;
    this.eventBus.on("item:consumed", ({ item, source }) => {
      // Food restores hunger via the survival system (potions restore stats
      // directly inside QuickSlotSystem).
      const nutrition = item.stats?.nutrition;
      if (typeof nutrition === "number" && nutrition > 0) {
        this.survivalSystem.eat(nutrition);
        this.ui.showNotification(`Ate ${item.name}.`, 1600);
      }
      this.eventBus.emit("player:consumeItem" as any, { itemId: item.id, source });
      this.saveSystem.markDirty();
    });
    this.saveSystem.setQuickSlotSystem(this.quickSlotSystem);

    this.eventBus.on("ui:inventoryItemClick", ({ item }) => {
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
    });
    this.ui.isConsumableItem = isConsumableItem;

    // ── v7 system wiring (QoL: Wait + Compass) ────────────────────────────────
    this.waitSystem = new WaitSystem();
    this.saveSystem.setWaitSystem(this.waitSystem);
    // Wire the Wait Dialog confirm callback
    this.eventBus.on("ui:waitConfirm", ({ hours }) => {
      const result = this.waitSystem.wait(hours, this.timeSystem, this.player);
      if (result.ok) {
        // Waiting counts as light sleep — resting at an inn restores more.
        this.survivalSystem.rest(hours * 14);
        this.ui.showNotification(result.message, 2800);
        this.saveSystem.markDirty();
      }
    });
    // Panels the player closes from inside go through the modal registry.
    this.eventBus.on("ui:panelClosed", ({ id }) => this._modals.close(id));

    // ── v8 system wiring (Oblivion depth: skill progression, fast travel, level scaling) ──
    this.skillProgressionSystem = new SkillProgressionSystem();
    this.skillProgressionSystem.events = this.eventBus;
    this.saveSystem.setSkillProgressionSystem(this.skillProgressionSystem);
    this.combatSystem.setScalingSystems({
      skillSystem: this.skillProgressionSystem,
      attributeSystem: this.attributeSystem,
    });
    // Lets ranged/magic NPCs fire arrows and bolts at the player.
    this.combatSystem.setProjectileSystem(this.projectileSystem);
    // Bolt-riding status effects (burn, freeze, …) land on the player.
    // Combat reports (hits, blocks, blows taken) go on the bus; gear wear
    // listens in the crafting feature.
    this.projectileSystem.events = this.eventBus;
    this.spellSystem.events = this.eventBus;
    this.combatSystem.events = this.eventBus;
    this.eventBus.on("projectile:playerHit", ({ statusEffect }) => {
      if (statusEffect) this.combatSystem.applyPlayerStatusEffect(statusEffect);
    });
    this.projectileSystem.isPlayerDodging = () => this.combatSystem.isDodging;
    // An arrow or spell that hurts a hostile alerts it, as a blow would.
    this.eventBus.on("combat:hostileHit", ({ npc, damage }) => this.combatSystem.notifyHostileHit(npc, damage));
    this.projectileSystem.setScalingSystems({
      skillSystem: this.skillProgressionSystem,
      attributeSystem: this.attributeSystem,
    });

    // Auto-discover locations when the player enters a new cell (portals use fade + tryTransition)
    this.cellManager.events = this.eventBus;
    this.eventBus.on("cell:changed", ({ cellId, cellName }) => this._onCellEntered(cellId, cellName));
    this.eventBus.on("portal:entered", ({ portalId }) => this._beginPortalTransition(portalId));

    this.levelScalingSystem = new LevelScalingSystem();
    // Scale newly spawned structure NPCs and register them for cleanup
    this.world.structures.events = this.eventBus;
    this.eventBus.on("npc:spawned", ({ npc }) => this._roster.add(npc));
    // The structure disposes its own NPCs.
    this.eventBus.on("npc:removed", ({ npc }) => this._roster.remove(npc, { dispose: false }));

    /** Unified world-state persistence: check if an item belongs to the player or was already taken. */
    // One-off loot the player already holds is not placed again.
    this.world.structures.isLootCollected = (itemId) =>
      this.inventorySystem.items.some((item) => item.id === itemId)
      || [...this.equipmentSystem.getEquipped().values()].some((item) => item.id === itemId);

    // Wire skill XP into spell cast and potion craft callbacks
    // Spell school XP.
    this.eventBus.on("spell:cast", ({ damage, heal }) => {
      if (damage && damage > 0) {
        this.skillProgressionSystem.gainXP("destruction", 10 * this.classSystem.xpMultiplierFor("destruction"));
      } else if (heal && heal > 0) {
        this.skillProgressionSystem.gainXP("restoration", 10 * this.classSystem.xpMultiplierFor("restoration"));
      }
    });

    // ── v9 system wiring (Oblivion parity: fame, active effects, jail) ─────────
    this.fameSystem = new FameSystem();
    this.fameSystem.events = this.eventBus;
    this.saveSystem.setFameSystem(this.fameSystem);

    this.activeEffectsSystem = new ActiveEffectsSystem();
    this.activeEffectsSystem.events = this.eventBus;
    this.saveSystem.setActiveEffectsSystem(this.activeEffectsSystem);

    this.jailSystem = new JailSystem();
    this.saveSystem.setJailSystem(this.jailSystem);

    // ── v10 system wiring (Oblivion depth: spell making, respawn, merchant restock) ──
    this.spellMakingUI.setAnimator(this.uiAnimator);

    this.levelUpUI.setAnimator(this.uiAnimator);

    // RespawnSystem — register the test cave as a respawnable zone (72 game-hours)
    this.respawnSystem = new RespawnSystem();
    this.respawnSystem.registerZone("cave_01", 72);
    this.respawnSystem.events = this.eventBus;
    this.saveSystem.setRespawnSystem(this.respawnSystem);

    // MerchantRestockSystem — restock the starter merchant every 72 game-hours
    this.merchantRestockSystem = new MerchantRestockSystem();
    this.merchantRestockSystem.events = this.eventBus;
    this.saveSystem.setMerchantRestockSystem(this.merchantRestockSystem);

    // Race, birthsign and class: the character feature.
    this.saveSystem.setRaceSystem(this.raceSystem);
    this.saveSystem.setBirthsignSystem(this.birthsignSystem);
    this.saveSystem.setClassSystem(this.classSystem);

    // ── v12 system wiring (Oblivion depth: skill-based character progression) ──
    this.saveSystem.setPlayerLevelSystem(this.playerLevelSystem);

    // ── v18 DailyScheduleSystem ───────────────────────────────────────────────
    // Connects TimeSystem → ScheduleSystem so NPC daily behaviours are driven
    // automatically by the in-game clock.  Also enforces non-interactivity for
    // sleeping NPCs by clearing their mesh.metadata during sleep windows.
    this.dailyScheduleSystem = new DailyScheduleSystem(
      this.scheduleSystem,
      this.timeSystem,
    );
    // No toasts: a village going to bed would post a dozen of them.
    this.dailyScheduleSystem.events = this.eventBus;
    // Villagers who reach their door at bedtime go inside until morning.
    // (The indoors feature takes them inside.)
    this.scheduleSystem.events = this.eventBus;
    this.saveSystem.setDailyScheduleSystem(this.dailyScheduleSystem);

    // ── v20: Swimming system ───────────────────────────────────────────────
    this.swimSystem = new SwimmingSystem();
    // Argonian racial water breathing — suppress breath drain for this race
    if (this.raceSystem.chosenRace?.waterBreathing) {
      this.swimSystem.hasWaterBreathing = true;
    }
    this.swimSystem.events = this.eventBus;
    this.eventBus.on("swim:drowning", () => this.player.notifyDamageTaken());
    this.saveSystem.setSwimmingSystem(this.swimSystem);

    // ── v21: Disease system ────────────────────────────────────────────────
    this.diseaseSystem = new DiseaseSystem();
    // Argonian racial disease immunity — 100 % resistance
    if (this.raceSystem.chosenRace?.id === "argonian") {
      this.diseaseSystem.diseaseResistanceChance = 1.0;
    }
    this.diseaseSystem.events = this.eventBus;
    this.saveSystem.setDiseaseSystem(this.diseaseSystem);

    // Survival needs (hunger / fatigue / cold): the survival feature.

    // ── v22: Event Manager (Dungeon Master) ───────────────────────────────
    this.eventManagerSystem = new EventManagerSystem();
    this.eventManagerSystem.events = this.eventBus;
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
        fireFx: () => this._env.fireFx,
        forges: () => this.forges,
        releaseNpc: (npc) => this._releaseNpc(npc),
      });

      // ── Chunk content (placement rules: world-sites feature) ──────────────
    this.world.events = this.eventBus;

      // Dispose chunk-scoped CDN props and NPCs when their chunk unloads so
      // revisiting an area never accumulates duplicate props or entities.
    // After the features' own chunk:unloaded handlers (registered earlier).
    this.eventBus.on("chunk:unloaded", ({ chunkKey }) => {
      this._chunks.close(chunkKey);
      this.navigationSystem.requestRebuild();
    });
    }

    // ── v24: Mark & Recall ────────────────────────────────────────────────
    this.markRecallSystem = new MarkRecallSystem();
    this.markRecallSystem.events = this.eventBus;
    this.eventBus.on("mark:recalled", ({ position }) => this.player.camera.position.set(position.x, position.y, position.z));
    this.saveSystem.setMarkRecallSystem(this.markRecallSystem);

    // ── v24: Trainer System ───────────────────────────────────────────────
    this.trainerSystem = new TrainerSystem();
    this.trainerSystem.events = this.eventBus;
    this.eventBus.on("trainer:trained", ({ skillId, newLevel, goldSpent }) => {
      // Gold sufficiency is pre-validated by TrainerSystem.train() via canTrain();
      // this callback only fires on a successful, already-approved session.
      this.skillProgressionSystem.setSkillLevel(skillId, newLevel);
      this._pack.spendGold(goldSpent);
      this.ui.showNotification(`${skillId} raised to ${newLevel}!  (−${goldSpent}g)`, 3000);
      this.saveSystem.markDirty();
    });
    this.saveSystem.setTrainerSystem(this.trainerSystem);

    // ── v27: Perk System ──────────────────────────────────────────────────
    this.perkSystem = new PerkSystem(this.player, this.skillProgressionSystem);
    this.perkSystem.events = this.eventBus;
    this.saveSystem.setPerkSystem(this.perkSystem);

    this._lastDynamicWorldEventHour = Math.floor(this.timeSystem.elapsedGameHours);

    // ── Leveled lists (tiered boss loot) ─────────────────────────────────────
    this.leveledListSystem = new LeveledListSystem();
    this.leveledListSystem.registerAll(ALL_BUILT_IN_LEVELED_LISTS);

    // Wire sneak-attack detection into combat.
    this.combatSystem.setStealthSystem(this.stealthSystem);

    // Suspicion (partial detection) routes NPCs to investigate where the
    // player was seen/heard — full detection still triggers ALERT.
    this.stealthSystem.events = this.eventBus;
    this.eventBus.on("stealth:noticed", ({ npc, playerPos }) => {
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
    });

    // ── Active Effects HUD ──────────────────────────────────────────────────
    this.activeEffectHUD = new ActiveEffectHUD();
    this.activeEffectHUD.show();

    // ── Quick Slot HUD ────────────────────────────────────────────────────
    this.quickSlotHUD = new QuickSlotHUD();
    // Quick-slot assign mode: clicking a HUD slot opens the inventory; the
    // next consumable clicked there is bound to that slot.
    this.quickSlotHUD.events = this.eventBus;
    this.eventBus.on("quickslot:assign", ({ key }) => {
      if (this.isPaused || this.mapEditorActive || this.dialogueSystem.isInDialogue) return;
      this._quickSlotAssignKey = key;
      this.ui.showNotification(`Pick a consumable in your inventory for slot ${key}.`, 3000);
      if (!this.inventorySystem.isOpen) {
        this.inventorySystem.toggleInventory();
      }
    });
    // Leaving the inventory cancels a pending quick-slot assignment.
    this.eventBus.on("ui:inventoryClosed", () => { this._quickSlotAssignKey = null; });
    this.quickSlotHUD.show();
    this.quickSlotHUD.update(this.quickSlotSystem);

    // ── UI animations (Motion library) ─────────────────────────────────────────
    const uiAnimator = new UIAnimator();
    this.levelUpUI.setAnimator(uiAnimator);
    this.spellMakingUI.setAnimator(uiAnimator);
    this.guardEncounterUI.setAnimator(uiAnimator);
    this.saddlebagUI.setAnimator(uiAnimator);

    void this.kernel.services.get(CharacterKey).create();

    this.eventBus.on("ui:attributeSpend", ({ name }) => {
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
    });

    // Hit-stop effect wired to FixedStepLoop
    this.eventBus.on("ui:hitStop", ({ durationMs }) => {
      this._gameplayLoop.timeScale = 0.05; // heavy slow-mo
      setTimeout(() => {
        this._gameplayLoop.timeScale = 1.0;
      }, durationMs);
    });

    // Level-up awards attribute points
    this.player.events = this.eventBus;
    this.eventBus.on("player:combatLevelUp", () => {
      // Combat XP level-up — no notification (spam). Character level-up
      // fires via onLevelUpComplete and shows the meaningful notification.
      this.attributeSystem.awardLevelUpPoints(1);
      this.saveSystem.markDirty();
      // Sync magic damage bonus after level-up attribute award
      this.spellSystem.magicDamageBonus = this.attributeSystem.magicDamageBonus;
    });

    // Guard crime challenge is wired in the v9 block above.

    // Stealth detection notification

    // The starting area: the guard, a forge, a chest, the Old Cave, weapons on the ground.
    seedStartingArea({
      scene: this.scene,
      addNpc: (npc) => this._roster.add(npc),
      guardSchedule: (npc) => { this.npcScheduleSystem.applySchedule(npc, SCHED_GUARD); },
      placeSmithy: (x, z) => this._chunks.placeSmithy(null, null, x, z),
      assets: this.fantasyAssets,
      containers: this.containerSystem,
      cells: this.cellManager,
      castShadow: (root) => this.shadowGenerator?.addShadowCaster(root, true),
    });

    // The starting region's merchants (dialogue `barter:open` uses payload.merchantId).
    registerStarterMerchants(this.barterSystem, this.merchantRestockSystem, this.shopSystem, this.timeSystem.elapsedGameTime);

    this.interactionSystem.containerSystem = this.containerSystem;

    // Prevent browser context menu from capturing right-click combat input.
    this.canvas.addEventListener("contextmenu", (event) => event.preventDefault());

    // Wire quest event callbacks
    this.eventBus.on("npc:killed", ({ npcName: name, xp, npc }) => {
        const npcName = /dragon/i.test(npc.key) ? npc.key : name;
        const p = npc.mesh.position;
        this.eventBus.emit("player:kill", {
          npcId: npc.key, npcName, xp, at: { x: p.x, y: p.y, z: p.z }, lootTableId: npc.lootTableId ?? undefined,
          civilian: this._isSettlementNpc(npc), factionId: npc.factionId ?? "village_guard",
        });
        // Bandit Bounty: activate on the first bandit kill so that kill counts.
        if (!this._banditQuestStarted && this._quests.targetId(name) === "Bandit") {
            this._banditQuestStarted = true;
            this.frameworkRuntime.questEngine.activateQuest("quest_bandit_bounty");
            this.ui.showNotification("📜 New quest: Bandit Bounty — bring proof to collect.", 3500);
        }
        this._quests.apply("kill", this._quests.targetId(name));
        // Killing someone a quest needed alive fails the dependent quests.
        this._quests.failForDead(name);
        this.player.addExperience(xp);
        this.ui.showNotification(`+${xp} XP`, 2000);
        this.audioSystem.playNPCDeath();

    });
    // (Arrow and spell kills report npc:killed too.)
    // Striking a peaceful settler is an assault (the arrest feature books it).
    this.eventBus.on("combat:npcDamaged", ({ npc }) => {
      if (npc.isDead || !this._isSettlementNpc(npc)) return;
      this.eventBus.emit("player:assault", { npcId: npc.key, factionId: npc.factionId ?? "village_guard" });
    });
    this.eventBus.on("combat:playerStruck", () => {
        this.audioSystem.playPlayerHit();
        // Small chance to contract a random disease on each hit (Oblivion-style).
        // ~5 % base chance per strike; resistance is factored inside contractDisease().
        const contagion = this.kernel.rng.stream("disease");
        if (contagion.chance(0.05)) {
            this.diseaseSystem.contractDisease(contagion.pick(["rust_chancre", "swamp_rot", "witbane", "collywobbles", "yellow_tick"]));
        }
    });
    this.eventBus.on("combat:blocked", () => {
        this.skillProgressionSystem.gainXP("block", 5 * this.classSystem.xpMultiplierFor("block"));
    });
    this.eventBus.on("loot:pickedUp", ({ itemId: id }) => {
        this._quests.apply("pickup", id);
        this.saveSystem.markDirty();
        this._tips.did("interact");
    });
    this.dialogueSystem.events = this.eventBus;
    this.eventBus.on("dialogue:started", ({ npcName }) => {
        this._quests.apply("talk", this._quests.targetId(npcName));
        // Speechcraft XP each time dialogue is initiated
        this.skillProgressionSystem.gainXP("speechcraft", 8 * this.classSystem.xpMultiplierFor("speechcraft"));
        this._tips.did("interact");
    });
    // After the features' dialogue:closed handlers: forget who we spoke to.
    this.eventBus.on("dialogue:closed", () => { this._currentDialogueNpcName = null; });

    // Quest XP and fame callbacks are wired in the v9 block above.
    // Note: player.onLevelUp is wired above in the v2 system wiring block

    // Gameplay rolls draw from the kernel's seeded streams (replays).
    seedGameRandomness(this);

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
            // Left mouse up looses a drawn arrow.
            if (pointerInfo.event.button === 0) this._combatControls.releaseBow();
        }
    });

    // DOM dialogs take keyboard focus from the canvas, and the observable below
    // only hears the canvas — so a panel opened with P/G/N/K/… could not be
    // closed with the same key. Forward panel-toggle keys from inside dialogs.
    if (typeof window !== "undefined") {
      window.addEventListener("keydown", (ev) => this._forwardDialogToggleKey(ev));
    }

    // Keys: the input adapter's bindings for the live context (play or the
    // map editor) first; whatever they don't take is the editors' (map editor
    // chords, Shift+F-key creator tools).
    this.scene.onKeyboardObservable.add((kbInfo) => {
        const ev = kbInfo.event as KeyboardEvent;
        const down = kbInfo.type === KeyboardEventTypes.KEYDOWN;
        if (!down && kbInfo.type !== KeyboardEventTypes.KEYUP) return;
        const handled = this._inputAdapter.handleKeyEvent(ev.key, down ? "down" : "up", {
          shift: ev.shiftKey, ctrlOrMeta: ev.ctrlKey || ev.metaKey, repeat: ev.repeat,
        });
        if (handled !== null) { ev.preventDefault(); return; }
        if (down) this.editors?.handleKey(ev);
    });

    // What the pause menu's buttons do.
    const desktop = getDesktopBridge();
    this.ui.setPauseActions({
      resume: () => this.togglePause(),
      save: () => this.saveSystem.save(),
      load: () => this.saveSystem.load(),
      // Export the CURRENT state, not the last persisted one.
      exportSave: () => { this.saveSystem.save(true); this.saveSystem.exportToFile(); },
      importSave: () => this._openSaveImportPicker(),
      settings: () => this.kernel.services.get(SettingsKey).open(),
      credits: () => this.kernel.services.get(SettingsKey).openCredits(),
      quit: desktop ? () => desktop.quit() : () => window.location.reload(),
      quitLabel: desktop ? "Quit to Desktop" : "Quit to Menu",
    });

    // Wire decoupled input adapter after all systems are initialized
    this._registerModals();
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

  /** A jump: 10 stamina for a 3 m hop (only with gravity on, i.e. not flying in the editor). */
  private _hop(): void {
      if (!this.player.camera.applyGravity || this.player.stamina < 10) return;
      this.player.stamina = Math.max(0, this.player.stamina - 10);
      this.player.notifyResourceSpent("stamina");
      this.player.camera.position.y += 3;
  }

  private _wireInputAdapter(): void {
    const adapter = this._inputAdapter;

    // Combat
    this._combatControls.bind(adapter);

    // Movement
    adapter.onAction("toggleCrouch", () => {
        if (!this.isPaused && !this.dialogueSystem.isInDialogue) {
        const crouching = this.stealthSystem.toggleCrouch();
        this.ui.showNotification(crouching ? "Sneaking..." : "Standing", 1200);
        this._tips.did("sneak");
      }
    });

    // UI panels — every toggle closes its own menu first, and only opens when
    // no other modal owns the screen (prevents stacked menus).
    adapter.onAction("toggleInventory", () => this._togglePanel("inventory", () => this.inventorySystem.toggleInventory()));
    adapter.onAction("toggleQuestLog", () => this._togglePanel("quest-log", () => this.questSystem.toggleQuestLog()));
    adapter.onAction("toggleSkillTree", () => this._togglePanel("skill-tree", () => this.skillTreeSystem.toggle()));
    adapter.onAction("toggleAttributePanel", () => this._togglePanel("attributes", () => {
      this.ui.toggleAttributePanel(true);
      this.ui.refreshAttributePanel(this.attributeSystem);
    }));
    adapter.onAction("toggleAlchemy", () => this.crafting.toggleAlchemy());
    adapter.onAction("toggleEnchanting", () => this.crafting.toggleEnchanting());
    adapter.onAction("toggleSmithing", () => this.crafting.toggleSmithing());
    adapter.onAction("toggleSpellMaking", () => this.kernel.services.get(SpellMakingKey).toggle());
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
      if (this.editors?.mapEditorActive) {
        this.editors.cycleGizmo();
        return;
      }
      this.followers.togglePanel();
    });
    adapter.onAction("toggleShoutMenu", () => this.shouts.togglePanel());
    adapter.onAction("useShout", () => this.shouts.use());
    adapter.onAction("toggleWaitDialog", () => this._togglePanel("wait", () => this.ui.toggleWaitDialog(true)));
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

    // Combat stances (Shift + 1–6): three melee, three magic.
    const stances = [["melee", "duelist"], ["melee", "soldier"], ["melee", "bruiser"], ["magic", "spark"], ["magic", "bolt"], ["magic", "surge"]] as const;
    stances.forEach(([kind, stance], i) => adapter.onAction(`archetype${i + 1}` as never, () => {
      if (this.isPaused || this.dialogueSystem.isInDialogue) return;
      if (kind === "melee") this.combatSystem.setMeleeArchetype(stance as never);
      else this.combatSystem.setMagicArchetype(stance as never);
    }));

    // System
    adapter.onAction("pause", () => {
      // Character creation owns the screen — Escape must not unpause beneath it.
      if (this._inCharacterCreation) return;
      if (this.dialogueSystem.isInDialogue) return;
      if (this.levelUpUI.isVisible) return;
      if (this.guardEncounterUI.isVisible) { this.kernel.services.get(ArrestKey).resist(); return; }
      if (this.editors?.mapEditorActive) { this.editors.exitMapEditor(); return; }
      // Otherwise close the top panel, or pause.
      if (this._modals.closeTop()) return;
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
    adapter.onAction("toggleMapEditor", () => this.editors?.toggleMapEditor());
    adapter.onAction("toggleCharacterSheet", () => this.kernel.services.get(ProgressionKey).toggleSheet());

    // ── Skyrim/Oblivion-style action handlers ─────────────────────────────
    adapter.onAction("jump", () => {
      // Space also advances the onboarding tutorial when active
      if (this._tips.space()) return;

      if (!this._isCombatInputBlocked()) this._hop();
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
      if (this._raycastInteract()) this.interactionSystem.interact();
      else this._hop();
    });


    adapter.onAction("favoritesMenu", () => {
      if (!this.isPaused && !this.dialogueSystem.isInDialogue) {
        this.ui.showNotification("Favorites — assign with quick-slot keys (1-0)", 2500);
      }
    });

    adapter.onAction("togglePOV", () => {
      if (this.mapEditorActive) return;
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
          this.editors?.exitMapEditor({ quiet: true });
          this._modals.closeAll();
          this.ui.setInteractionText("");
          this._focus.take("pause");
      } else {
          this._focus.give("pause");
      }
  }




  /**
   * Put an NPC that fell through the world back at its spawn point.  Bodies
   * spawned before their ground chunk existed (e.g. the boot-time test guard)
   * otherwise fall forever.
   */
  private _recoverFallenNpc(npc: NPC): void {
    teleportNpc(npc, npc.spawnPosition.x, Math.max(npc.spawnPosition.y, 2), npc.spawnPosition.z);
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


  /**
   * True when the victim is a non-hostile settlement NPC (villager, merchant,
   * guard…) whose death counts as murder. Structure guards (Ruin/Tower),
   * dragon bosses, and anything already aggressive are excluded.
   */
  private _isSettlementNpc(npc: NPC): boolean {
      // Natural hostiles are never "settlement" victims, whatever their state.
      if (npc.factionId === "bandits") return false;
      if (/^(RuinGuard|TowerGuard|DragonBoss)/.test(npc.key)) return false;
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
      chunkRecord: ChunkRecord,
      x: number,
      z: number,
  ): NPC | null {
      const npc = this.npcArchetypeSystem.spawnNpc(archetypeId, this.scene, new Vector3(x, 2, z));
      if (!npc) return null;
      this._roster.add(npc, { regional: true });
      chunkRecord.addNpc(npc);
      return npc;
  }

  /** Map the equipped main-hand item to a combat weapon archetype (default: sword). */
  private _syncWeaponArchetype(): void {
      const weapon = this.equipmentSystem.getEquipped().get("mainHand");
      const archetype = weaponArchetypeOf(weapon);
      this.combatSystem.setWeaponArchetype(archetype);
      this._viewModel?.setWeapon(archetype);
  }





  private _updateGameplayStep(deltaTime: number): void {
      this.player.update(deltaTime);
      this.audioSystem.updateFootsteps(deltaTime, this.player.camera.position);
      this.world.update(this.player.camera.position);

      this.timeSystem.update(deltaTime);
      this._updateDynamicWorldEventsOnHourChange();

      // LOD tiers first: the schedules and NPC visuals read them.
      this._npcTiers.update(this.player.camera.position, this.scheduleSystem.npcs);
      this.scheduleSystem.update(deltaTime);
      // Kernel features (indoors, raids, …) run their fixed-step systems here,
      // right after the schedules they react to.
      this.kernel.phases.run("sim", deltaTime);
      this.combatSystem.update(deltaTime);
      // Slow Time squeezes the NPC AI clock (movement, telegraphs, strikes).
      this.combatSystem.updateNPCAI(deltaTime * this.shouts.hostileTimeScale());

      for (const npc of this.scheduleSystem.npcs) {
        if (npc.mesh.position.y < NPC_FALL_RECOVERY_Y && !npc.isDead) this._recoverFallenNpc(npc);
      }
      this._npcVisuals.update(deltaTime, this.player.camera.position, this.scheduleSystem.npcs);
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
      this._env.update(frameDelta);

      // Conversation framing (turn to the speaker, zoom in / back out), and
      // ending it if the speaker is gone or the player was moved away.
      this.dialogueSystem.update(frameDelta);
      this._camera.update(frameDelta);

      if (this._viewModel) {
        this._viewModel.setVisible(
          this.player.health > 0 && !this.dialogueSystem.isInDialogue && !this.mapEditorActive,
        );
        this._viewModel.update(frameDelta, {
          blocking: this.combatSystem.isBlocking,
          sprinting: this.stealthSystem.movementMode === "running",
        });
      }

      // Features' HUD pieces (companion, follower, shout chips), then the bars and readouts.
      this.kernel.phases.run("ui", frameDelta);
      this._hud.update();
  }

  private _hudSourcesCache: HudSources | null = null;
  private _hudSources(): HudSources {
      // eslint-disable-next-line @typescript-eslint/no-this-alias -- getters below
      const game = this;
      return this._hudSourcesCache ??= {
        get engine() { return game.engine; },
        get scene() { return game.scene; },
        get ui() { return game.ui; },
        get player() { return game.player; },
        get time() { return game.timeSystem; },
        get stealth() { return game.stealthSystem; },
        get combat() { return game.combatSystem; },
        get effects() { return game.activeEffectsSystem; },
        get effectsHud() { return game.activeEffectHUD; },
        get quickSlots() { return game.quickSlotSystem; },
        get quickSlotsHud() { return game.quickSlotHUD; },
        characterLevel: () => this.playerLevelSystem.characterLevel,
        inventoryOpen: () => this.inventorySystem.isOpen,
        talking: () => this.dialogueSystem.isInDialogue,
        // Any registered panel, plus the two that Escape can't close.
        overlayOpen: () => this._modals.anyOpen() || this.levelUpUI.isVisible || this.guardEncounterUI.isVisible,
        cellName: () => this.cellManager.currentCell?.name ?? "exterior",
        weatherLabel: () => this.weatherSystem.label,
        lodCulled: () => this._lastLodCulled,
      };
  }

  private _isPlayerInCombat(): boolean {
      // Anyone alive in a fighting state (the Engaged tag).
      return actors.bodies([Engaged], [Dead]).length > 0;
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

      this._presentCell(cellId);
  }

  /** Hide the outdoors inside an interior, and dress a freshly built room. */
  private _presentCell(cellId: string): void {
      const isInterior = this.cellManager.isInterior;
      this.world.setVisible(!isInterior);
      if (isInterior) dressInterior(cellId, { scene: this.scene, textures: this.world.textureManager, fireFx: this._env.fireFx });
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
        this._pack.addGold(gold);
        this.ui.showNotification(`+${gold} gold`, 1800);
      }

      if (reward.label) {
        this.ui.showNotification(reward.label, 2500);
      }

      if (xp > 0 || gold > 0) {
        this.saveSystem.markDirty();
      }
  }






  /** Move a successfully lifted item into the player inventory. */
  private _grantPickpocketItem(itemId: string): void {
      if (itemId === COIN_PURSE) {
          this._pack.addGold(8);
          this.ui.showNotification("Coin purse: +8 gold", 2200);
          return;
      }
      this._pack.receive(itemId, () => ({
          id: itemId, name: this._thief.label(itemId), description: "Lifted.",
          stackable: false, quantity: 1, weight: 0.5, stats: { value: 10 },
      }));
  }


  private _handleDialogueHostEvent(eventId: string, payload?: Record<string, unknown>): void {
      // Features act on dialogue actions ("jobs:ask", "barter:open",
      // "smithing:open", "trainer:train", "rest:inn", …).
      this.eventBus.emit("dialogue:action", { eventId, npcName: this._currentDialogueNpcName, payload });
  }




  /** Unregister an NPC from every system and dispose it. */
  private _releaseNpc(npc: NPC): void {
      this._roster.remove(npc);
  }

  /** Wire the features to the game (src/game/game-services.ts). */
  private _installFeatures(): void {
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- the internals' getters
    const self = this;
    installGameFeatures(this, {
      get achievements() { return self._achievements; },
      get barterUI() { return self._barterUI; },
      get character() { return self._character; },
      get chunks() { return self._chunks; },
      get containerUI() { return self._containerUI; },
      get crafting() { return self._crafting; },
      get currentDialogueNpcName() { return self._currentDialogueNpcName; },
      get fastTravel() { return self._fastTravel; },
      get focus() { return self._focus; },
      get deathCamera() { return self._deathCamera; },
      get inCharacterCreation() { return self._inCharacterCreation; },
      set inCharacterCreation(v) { self._inCharacterCreation = v; },
      get npcVisuals() { return self._npcVisuals; },
      get pack() { return self._pack; },
      get progression() { return self._progression; },
      get roster() { return self._roster; },
      get settings() { return self._settings; },
      get spellMaking() { return self._spellMaking; },
      set spellMaking(v) { self._spellMaking = v; },
      get survival() { return self._survival; },
      get thief() { return self._thief; },
      get tips() { return self._tips; },
      get trade() { return self._trade; },
      despawnNpc: (...a: Parameters<Game["_despawnNpc"]>) => self._despawnNpc(...a),
      grantDynamicWorldEventReward: (...a: Parameters<Game["_grantDynamicWorldEventReward"]>) => self._grantDynamicWorldEventReward(...a),
      grantPickpocketItem: (...a: Parameters<Game["_grantPickpocketItem"]>) => self._grantPickpocketItem(...a),
      isCombatInputBlocked: (...a: Parameters<Game["_isCombatInputBlocked"]>) => self._isCombatInputBlocked(...a),
      isPlayerInCombat: (...a: Parameters<Game["_isPlayerInCombat"]>) => self._isPlayerInCombat(...a),
      presentCell: (...a: Parameters<Game["_presentCell"]>) => self._presentCell(...a),
      restoreGameplayInput: (...a: Parameters<Game["_restoreGameplayInput"]>) => self._restoreGameplayInput(...a),
      spawnArchetypeNpc: (...a: Parameters<Game["_spawnArchetypeNpc"]>) => self._spawnArchetypeNpc(...a),
      suspendGameplayInput: (...a: Parameters<Game["_suspendGameplayInput"]>) => self._suspendGameplayInput(...a),
      updateDynamicWorldEventsOnHourChange: (...a: Parameters<Game["_updateDynamicWorldEventsOnHourChange"]>) => self._updateDynamicWorldEventsOnHourChange(...a),
    });
  }

  /** Remove one NPC from the world and every system (and its chunk's list). */
  private _despawnNpc(npc: NPC): void {
      this._chunks.forget(npc);
      this._releaseNpc(npc);
  }

  /**
   * A panel's key: close it if it is open, else open it over play (never on
   * top of another menu) and take input.
   */
  private _togglePanel(id: string, open: () => void): void {
      if (this._modals.isOpen(id)) { this._modals.close(id); return; }
      if (this._isCombatInputBlocked()) return;
      open();
      this._suspendGameplayInput();
  }

  /** Every panel that takes over the screen, in Escape order. */
  private _registerModals(): void {
      const restore = () => this._restoreGameplayInput();
      this._modals.add(
        { id: "character-sheet", isOpen: () => this.characterSheetUI.isVisible,
          close: () => this.kernel.services.get(ProgressionKey).closeSheet() },
        { id: "inventory", isOpen: () => this.inventorySystem.isOpen, close: () => { this.inventorySystem.toggleInventory(); restore(); } },
        { id: "quest-log", isOpen: () => this.questSystem.isLogOpen, close: () => { this.questSystem.toggleQuestLog(); restore(); } },
        { id: "skill-tree", isOpen: () => this.skillTreeSystem.isOpen, close: () => { this.skillTreeSystem.toggle(); restore(); } },
        { id: "attributes", isOpen: () => this.ui.isAttributePanelOpen, close: () => { this.ui.toggleAttributePanel(false); restore(); } },
        { id: "alchemy", isOpen: () => this.alchemyUI.isVisible, close: () => this.crafting.toggleAlchemy() },
        { id: "enchanting", isOpen: () => this.enchantingUI.isVisible, close: () => this.crafting.toggleEnchanting() },
        { id: "forge", isOpen: () => this.craftingUI.isVisible, close: () => this.crafting.toggleSmithing() },
        { id: "jobs", isOpen: () => this.jobs.window.isVisible, close: () => { this.jobs.window.hide(); this.jobs.window.onClose?.(); } },
        { id: "spell-making", isOpen: () => this.spellMakingUI.isVisible, close: () => this.spellMakingUI.close() },
        { id: "barter", isOpen: () => this._barterUI.isVisible, close: () => this._trade.barterPanel.onClose?.() },
        { id: "container", isOpen: () => this._containerUI.isVisible, close: () => this._trade.containerPanel.onClose?.() },
        { id: "fast-travel", isOpen: () => this.fastTravelUI.isVisible, close: () => this.fastTravelUI.close() },
        { id: "pets", isOpen: () => this.petUI.isVisible, close: () => this.pets.togglePanel() },
        { id: "followers", isOpen: () => this.followerUI.isVisible, close: () => this.followers.togglePanel() },
        { id: "shouts", isOpen: () => this.shoutUI.isVisible, close: () => this.shouts.togglePanel() },
        { id: "pickpocket", isOpen: () => this.pickpocketUI.isVisible, close: () => this.kernel.services.get(PickpocketKey).close() },
        { id: "stable", isOpen: () => this.stableUI.isVisible, close: () => this.stableUI.close() },
        { id: "saddlebag", isOpen: () => this.saddlebagUI.isVisible, close: () => this.saddlebagUI.close() },
        { id: "credits", isOpen: () => !!this._creditsUI?.isVisible, close: () => { this._creditsUI!.hide(); this._creditsUI!.onClose?.(); } },
        { id: "graphics", isOpen: () => this.graphicsSettingsUI.isVisible, close: () => { this.graphicsSettingsUI.hide(); this.graphicsSettingsUI.onClose?.(); } },
        ...(this.editors?.windows() ?? []),
        { id: "wait", isOpen: () => this.ui.isWaitDialogOpen, close: () => { this.ui.toggleWaitDialog(false); restore(); } },
      );
  }

  private _isCombatInputBlocked(): boolean {
      return (
          this.isPaused ||
          this.mapEditorActive ||
          this.levelUpUI.isVisible ||
          this.guardEncounterUI.isVisible ||
          this.dialogueSystem.isInDialogue ||
          this._modals.anyOpen() ||
          this.interactionSystem.isBlocked
      );
  }


  /** A menu takes input from play (see PlayFocus). */
  private _suspendGameplayInput(): void {
      this._focus.take("menu");
  }

  /** The menu let go; play has input again unless the pause menu, editor, … still hold it. */
  private _restoreGameplayInput(): void {
      this._focus.give("menu");
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

}
