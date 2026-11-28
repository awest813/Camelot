/**
 * What the game holds: its systems, panels, features' handles and the
 * composition root's own parts (the underscore members), with the getters
 * that reach into features.  `Game` (src/game.ts) builds and runs them.
 */
import type { Game } from "../game";
import { Scene } from "@babylonjs/core/scene";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import type { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { AtmosphereController } from "../rendering/sky-dome";
import { WeaponViewModel } from "../rendering/viewmodel";
import { AdaptiveResolution } from "../rendering/adaptive-resolution";
import { NpcVisuals } from "../rendering/npc-visuals";
import { NpcTierSystem } from "../systems/npc-tier-system";
import { actors } from "../entities/actors";
import { Player } from "../entities/player";
import { UIManager } from "../ui/ui-manager";
import { WorldManager } from "../world/world-manager";
import { NPC } from "../entities/npc";
import { ScheduleSystem } from "../systems/schedule-system";
import { CombatSystem } from "../systems/combat-system";
import { DialogueSystem } from "../systems/dialogue-system";
import { BabylonInputAdapter } from "../adapters/babylon/babylon-input-adapter";
import type { GamepadInputSystem } from "../systems/gamepad-input-system";
import { InventorySystem } from "../systems/inventory-system";
import { EquipmentSystem } from "../systems/equipment-system";
import { SaveSystem } from "../systems/save-system";
import { AchievementSystem } from "../platform/achievement-system";
import type { CreditsUI } from "../ui/credits-ui";
import { QuestSystem } from "../systems/quest-system";
import { InteractionSystem } from "../systems/interaction-system";
import { SkillTreeSystem } from "../systems/skill-tree-system";
import { AudioSystem } from "../systems/audio-system";
import { NavigationSystem } from "../systems/navigation-system";
import { FrameworkRuntime } from "../framework/runtime/framework-runtime";
import { AttributeSystem } from "../systems/attribute-system";
import { TimeSystem } from "../systems/time-system";
import { StealthSystem } from "../systems/stealth-system";
import { CrimeSystem } from "../systems/crime-system";
import { ContainerSystem } from "../systems/container-system";
import { ProjectileSystem } from "../systems/projectile-system";
import { BarterSystem } from "../systems/barter-system";
import { ShopSystem } from "../systems/shop-system";
import { CellManager } from "../world/cell-manager";
import { SpellSystem } from "../systems/spell-system";
import { PersuasionSystem } from "../systems/persuasion-system";
import { GameEventBus } from "../systems/event-bus";
import { LootTableSystem } from "../systems/loot-table-system";
import { NpcArchetypeSystem } from "../systems/npc-archetype-system";
import { NpcScheduleSystem } from "../systems/npc-schedule-system";
import { FixedStepLoop } from "../systems/fixed-step-loop";
import type { AlchemySystem } from "../systems/alchemy-system";
import type { AlchemyUI } from "../ui/alchemy-ui";
import type { CraftingSystem } from "../systems/crafting-system";
import type { CraftingUI } from "../ui/crafting-ui";
import type { ItemConditionSystem } from "../systems/item-condition-system";
import { CraftingFeature, CraftingKey, type CraftingService } from "../features/crafting/crafting-feature";
import { Kernel } from "../core/kernel";
import { RaidsKey, type RaidsService } from "../features/village-raids/raid-feature";
import { VillagesKey, type VillagesService } from "../features/villages/villages-feature";
import { WorldSitesKey, type WorldSitesService } from "../features/world-sites/world-sites-feature";
import { MountsKey, type MountsService } from "../features/mounts/mounts-feature";
import { WorldEventsKey } from "../features/world-events/world-events-feature";
import { JobsKey, type JobsService } from "../features/village-jobs/jobs-feature";
import type { ForgeRegistry, SmithingController } from "../systems/smithing-controller";
import type { EnchantingSystem } from "../systems/enchanting-system";
import type { EnchantingUI } from "../ui/enchanting-ui";
import { LodSystem } from "../systems/lod-system";
import { WorldEnvironment } from "../rendering/world-environment";
import { ChunkContent, type ChunkRecord } from "../world/chunk-content";
import { WeatherSystem } from "../systems/weather-system";
import { GraphicsSystem } from "../systems/graphics-system";
import { QuickSlotSystem, type QuickSlotKey } from "../systems/quickslot-system";
import { WaitSystem } from "../systems/wait-system";
import { SkillProgressionSystem } from "../systems/skill-progression-system";
import type { FastTravelSystem } from "../systems/fast-travel-system";
import { FastTravelFeature } from "../features/fast-travel/fast-travel-feature";
import { CharacterFeature } from "../features/character/character-feature";
import { ProgressionFeature } from "../features/progression/progression-feature";
import { SurvivalFeature } from "../features/survival/survival-feature";
import { LevelScalingSystem } from "../systems/level-scaling-system";
import { FameSystem } from "../systems/fame-system";
import { ActiveEffectsSystem } from "../systems/active-effects-system";
import { JailSystem } from "../systems/jail-system";
import type { SpellMakingSystem } from "../systems/spell-making-system";
import { SpellMakingFeature } from "../features/spell-making/spell-making-feature";
import { RespawnSystem } from "../systems/respawn-system";
import { MerchantRestockSystem } from "../systems/merchant-restock-system";
import type { BirthsignSystem } from "../systems/birthsign-system";
import type { ClassSystem } from "../systems/class-system";
import type { RaceSystem } from "../systems/race-system";
import type { PlayerLevelSystem } from "../systems/player-level-system";
import type { CharacterSheetUI } from "../ui/character-sheet-ui";
import { OnboardingKey, type OnboardingService } from "../features/onboarding/onboarding-feature";
import type { EditorPlugin } from "./editor-plugin";
import type { FastTravelUI } from "../ui/fast-travel-ui";
import type { SpellMakingUI } from "../ui/spell-making-ui";
import type { GuardEncounterUI } from "../ui/guard-encounter-ui";
import { ArrestKey } from "../features/arrest/arrest-feature";
import type { LevelUpUI } from "../ui/level-up-ui";
import type { StableUI } from "../ui/stable-ui";
import type { SaddlebagUI } from "../ui/saddlebag-ui";
import type { LazyPanel } from "../ui/lazy-panel";
import { HorseSystem } from "../systems/horse-system";
import { SwimmingSystem } from "../systems/swimming-system";
import { DiseaseSystem } from "../systems/disease-system";
import type { SurvivalSystem } from "../systems/survival-system";
import type { TravelEventSystem } from "../systems/travel-event-system";
import { AmbientEventSystem } from "../systems/ambient-event-system";
import { LeveledListSystem } from "../systems/leveled-list-system";
import { EventManagerSystem } from "../systems/event-manager-system";
import { AnimationSystem } from "../systems/animation-system";
import { FantasyAssetLoader } from "../systems/fantasy-asset-loader";
import type { PetSystem } from "../systems/pet-system";
import type { PetUI } from "../ui/pet-ui";
import { PetsKey, type PetsService } from "../features/pets/pets-feature";
import type { PickpocketSystem } from "../systems/pickpocket-system";
import type { PickpocketUI } from "../ui/pickpocket-ui";
import { PickpocketFeature } from "../features/pickpocket/pickpocket-feature";
import type { BarterUI } from "../ui/barter-ui";
import type { ContainerUI } from "../ui/container-ui";
import { TradeFeature } from "../features/trade/trade-feature";
import { ScreenshotSystem } from "../systems/screenshot-system";
import { UIAnimator } from "../ui/ui-animator";
import { MarkRecallSystem } from "../systems/mark-recall-system";
import { TrainerSystem } from "../systems/trainer-system";
import type { FollowerSystem } from "../systems/follower-system";
import type { FollowerUI } from "../ui/follower-ui";
import { FollowersKey, type FollowersService } from "../features/followers/followers-feature";
import { ActiveEffectHUD } from "../ui/active-effect-hud";
import { HudPresenter, type HudSources } from "../ui/hud-presenter";
import { ModalRegistry } from "../ui/modal-registry";
import { PlayerPack } from "./player-pack";
import { QuestBridge } from "./quest-bridge";
import { NpcRoster } from "./npc-roster";
import { CombatControls } from "./combat-controls";
import { PlayFocus } from "../input/play-focus";
import { CameraDirector, DeathCamera } from "../rendering/camera-director";
import { QuickSlotHUD } from "../ui/quickslot-hud";
import { PerkSystem } from "../systems/perk-system";
import { DynamicWorldEventSystem } from "../systems/dynamic-world-event-system";
import type { OldTongueSystem } from "../systems/old-tongue-system";
import type { ShoutUI } from "../ui/shout-ui";
import { ShoutsKey, type ShoutsService } from "../features/shouts/shouts-feature";
import type { GraphicsSettingsUI } from "../ui/graphics-settings-ui";
import { SettingsFeature } from "../features/settings/settings-feature";
import { hudSources } from "./game-loop";
import { isCombatInputBlocked } from "./play-focus";

export class GameState {
  /** This, as the Game it always is (GameState is only ever built as one). */
  protected get asGame(): Game { return this as unknown as Game; }

  public scene: Scene;
  public canvas: HTMLCanvasElement;
  public engine: Engine | WebGPUEngine;
  public player: Player;
  public ui: UIManager;
  public world: WorldManager;

  /** Light, sky, post-processing, water, grass, particles and their per-frame blend. */
  public _env!: WorldEnvironment;
  /** Shadow generator driven by the directional sun light. */
  public get shadowGenerator(): ShadowGenerator | null { return this._env?.shadows ?? null; }
  /** Rendering configuration preset (lighting, sky, post-processing, fog). */
  public readonly graphics: GraphicsSystem = GraphicsSystem.fromSavedOrAutoDetect();
  /** Procedural sky-dome mesh (skybox).  Null before the sky is set up. */
  public get skyDome(): Mesh | null { return this._env?.sky ?? null; }
  /** Time-of-day sky, sun/moon light and fog driver.  Null before the sky is set up. */
  public get atmosphere(): AtmosphereController | null { return this._env?.atmosphere ?? null; }
  /** Dynamic render scale defending the tier's target FPS. */
  public _adaptiveRes: AdaptiveResolution | null = null;
  /** First-person weapon (CC0 KayKit weapons). */
  public _viewModel: WeaponViewModel | null = null;
  /** Rigged NPC models (CC0 KayKit characters). */
  public _npcVisuals!: NpcVisuals;
  public readonly _npcTiers = new NpcTierSystem(actors);
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
  public readonly _fastTravel = new FastTravelFeature();
  public get fastTravelUI(): FastTravelUI { return this._fastTravel.menu; }
  public get spellMakingUI(): LazyPanel<SpellMakingUI> { return this._spellMaking.panel; }
  public get guardEncounterUI(): GuardEncounterUI { return this.kernel.services.get(ArrestKey).panel; }
  public readonly _progression = new ProgressionFeature();
  public get levelUpUI(): LevelUpUI { return this._progression.levelUp; }
  /** Tab-open HTML overlay — identity, attributes, skills, reputation. */
  public get characterSheetUI(): LazyPanel<CharacterSheetUI> { return this._progression.sheet; }
  public get stableUI(): LazyPanel<StableUI> { return this.mounts.stable; }
  public get saddlebagUI(): LazyPanel<SaddlebagUI> { return this.mounts.saddlebag; }
  public uiAnimator: UIAnimator = new UIAnimator();
  public readonly _settings = new SettingsFeature();
  public get graphicsSettingsUI(): LazyPanel<GraphicsSettingsUI> { return this._settings.dialog; }

  // v2 systems 
  public attributeSystem: AttributeSystem;
  public timeSystem: TimeSystem;
  public stealthSystem: StealthSystem;
  public crimeSystem: CrimeSystem;
  /** Pickpocketing (built with the game: NPCs register what they carry first). */
  public readonly _thief = new PickpocketFeature((id) => this.frameworkRuntime?.contentRegistry.getItemDefinition(id)?.name);
  public get pickpocketSystem(): PickpocketSystem { return this._thief.system; }
  public get pickpocketUI(): PickpocketUI { return this._thief.panel; }
  public containerSystem: ContainerSystem;
  public projectileSystem: ProjectileSystem;
  public barterSystem: BarterSystem;
  /** Registered storefronts linked to {@link barterSystem} merchants (hours, categories). */
  public shopSystem: ShopSystem;
  public cellManager: CellManager;

  // v3 systems (depth)
  public spellSystem: SpellSystem;
  public persuasionSystem: PersuasionSystem;
  public eventBus: GameEventBus;
  public lootTableSystem: LootTableSystem;
  public npcArchetypeSystem: NpcArchetypeSystem;
  /** Named schedule definitions; linked to {@link npcArchetypeSystem} for archetype `scheduleId`. */
  public npcScheduleSystem: NpcScheduleSystem;

  // v4 systems (alchemy)
  /** Alchemy, enchanting and smithing (built early: see CraftingFeature). */
  public _crafting!: CraftingFeature;
  public get alchemySystem(): AlchemySystem { return this._crafting.alchemy; }
  public get alchemyUI(): LazyPanel<AlchemyUI> { return this._crafting.alchemyPanel; }

  // Smithing + gear wear (CraftingSystem / ItemConditionSystem, glued by SmithingController)
  public get craftingSystem(): CraftingSystem { return this._crafting.recipes; }
  public get itemConditionSystem(): ItemConditionSystem { return this._crafting.conditions; }
  public get smithing(): SmithingController { return this._crafting.smithing; }
  /** World forges (smithies, armorer inns, the starting forge) — steel work needs one in reach. */
  public get forges(): ForgeRegistry { return this._crafting.forges; }
  public get craftingUI(): LazyPanel<CraftingUI> { return this._crafting.forgePanel; }
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

  // v5 systems (enchanting)
  public get enchantingSystem(): EnchantingSystem { return this._crafting.enchanting; }
  public get enchantingUI(): LazyPanel<EnchantingUI> { return this._crafting.enchantingPanel; }

  // v4 browser optimisation: LOD culling
  public lodSystem: LodSystem;

  // v6 systems (hotkeys)
  public weatherSystem: WeatherSystem;
  public quickSlotSystem: QuickSlotSystem;

  // v7 systems (QoL + polish)
  public waitSystem: WaitSystem;

  // v8 systems (skill progression, fast travel, level scaling)
  public skillProgressionSystem: SkillProgressionSystem;
  public get fastTravelSystem(): FastTravelSystem { return this._fastTravel.places; }
  public levelScalingSystem: LevelScalingSystem;

  // v9 systems (fame/infamy, active effects, jail)
  public fameSystem: FameSystem;
  public activeEffectsSystem: ActiveEffectsSystem;
  public jailSystem: JailSystem;

  // v10 systems (spell making, respawn, merchant restock)
  public _spellMaking!: SpellMakingFeature;
  public get spellMakingSystem(): SpellMakingSystem { return this._spellMaking.altar; }
  public respawnSystem: RespawnSystem;
  public merchantRestockSystem: MerchantRestockSystem;

  // v11 systems (character creation — birthsign and class)
  /** Race, birthsign, class and the creation wizard. */
  public readonly _character = new CharacterFeature();
  public get birthsignSystem(): BirthsignSystem { return this._character.birthsigns; }
  public get classSystem(): ClassSystem { return this._character.classes; }
  public get raceSystem(): RaceSystem { return this._character.races; }

  // v12 systems (character progression — skill-based level-up)
  public get playerLevelSystem(): PlayerLevelSystem { return this._progression.levels; }

  // v18 systems

  // v19 systems
  public get horseSystem(): HorseSystem { return this.mounts.horses; }

  // v20 systems
  public swimSystem: SwimmingSystem;

  // v21 systems
  public diseaseSystem: DiseaseSystem;

  // v28+ survival / flavor-event systems
  public readonly _survival = new SurvivalFeature();
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
  public get petUI(): LazyPanel<PetUI> { return this.pets.panel; }

  // v24 systems
  public markRecallSystem: MarkRecallSystem;
  public trainerSystem: TrainerSystem;

  // v26 systems
  public get followers(): FollowersService { return this.kernel.services.get(FollowersKey); }
  public get followerSystem(): FollowerSystem { return this.followers.followers; }
  public get followerUI(): LazyPanel<FollowerUI> { return this.followers.panel; }

  // v27 systems
  public perkSystem!: PerkSystem;

  // v28 systems
  public get dynamicWorldEventSystem(): DynamicWorldEventSystem { return this.kernel.services.get(WorldEventsKey).dynamic; }

  // Words of the Old Tongue (shouts in code; state persists via saveSystem)
  public get shouts(): ShoutsService { return this.kernel.services.get(ShoutsKey); }
  public get oldTongueSystem(): OldTongueSystem { return this.shouts.shouts; }
  public get shoutUI(): LazyPanel<ShoutUI> { return this.shouts.panel; }

  /** Fantasy asset loader — streams BabylonJS CDN models (weapons, structures, creatures). */
  public fantasyAssets: FantasyAssetLoader;

  /** Captures the WebGL canvas as a PNG/JPEG and triggers a browser download. */
  public readonly screenshotSystem = new ScreenshotSystem();

  public readonly _trade = new TradeFeature();
  public get _barterUI(): LazyPanel<BarterUI> { return this._trade.barterPanel; }
  public get _containerUI(): ContainerUI { return this._trade.containerPanel; }
  /** When set, open barter after dialogue teardown (pointer lock restored first). */
  /** Set by the smith's "use your forge" dialogue choice; opened once dialogue closes. */
  /** Shared parchment material for village notice boards. */

  public isPaused: boolean = false;

  public readonly _gameplayLoop = new FixedStepLoop({
    fixedDeltaSeconds: 1 / 60,
    // Two substeps cover 30 fps exactly; beyond that the simulation slows
    // slightly instead of multiplying AI/stealth cost up to 5× per frame
    // (which fed a feedback loop — lower fps → more substeps → more load).
    maxSubSteps: 2,
    maxAccumulatedSeconds: 0.25,
  });

  // Chunk tracking for navmesh rebuild triggers
  public _lastNavChunkX: number = NaN;
  public _lastNavChunkZ: number = NaN;
  public _lastRegionId: string | null = null;

  /** What each loaded chunk holds (props, buildings, its NPCs); goes with the chunk. */
  public _chunks!: ChunkContent;

  /** Debounce for witnessed-assault crime reports (one per 3s per combat burst). */
  /** True once the Bandit Bounty framework quest has been activated by a bandit kill. */
  public _banditQuestStarted: boolean = false;
  /** Active difficulty setting (scales NPC→player damage). */
  /** Active camera look sensitivity setting. */
  /** Mesh name of the NPC the player is currently talking to (persuasion pricing). */
  public _currentDialogueNpcName: string | null = null;
  /** True while the character-creation wizard is up (Escape must not pause beneath it). */
  public _inCharacterCreation: boolean = false;

  /** Gold and items: the one player inventory (dialogue and quests use it too). */
  public readonly _pack = new PlayerPack(
    () => this.inventorySystem,
    (id) => this.frameworkRuntime.contentRegistry.getItemDefinition(id) ?? undefined,
  );
  /** Bringing NPCs into the world and taking them out, the same way every time. */
  public readonly _roster = new NpcRoster({
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
  public readonly _quests = new QuestBridge({
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
  public readonly _combatControls = new CombatControls({
    combat: () => this.combatSystem,
    projectiles: () => this.projectileSystem,
    stealth: () => this.stealthSystem,
    spells: () => this.spellSystem,
    races: () => this.raceSystem, omens: () => this.birthsignSystem, containers: () => this.containerSystem,
    effects: () => this.activeEffectsSystem,
    gameTime: () => this.timeSystem.elapsedGameTime, // monotonic: the daily powers' cooldowns span midnight
    blocked: () => isCombatInputBlocked(this.asGame),
    free: () => !this.isPaused && !this.dialogueSystem.isInDialogue,
    swing: (power) => { this._viewModel?.swing(power); this.audioSystem.playMeleeAttack(); },
    twang: () => this.audioSystem.playBowShot(),
    notify: (text, ms) => this.ui.showNotification(text, ms),
  });
  /** Who has the player's input; the one place pointer lock changes. */
  public readonly _focus = new PlayFocus({
    lockPointer: () => this.canvas.requestPointerLock(),
    unlockPointer: () => { if (typeof document !== "undefined") document.exitPointerLock(); },
    attachCamera: () => this.player.camera.attachControl(this.canvas, true),
    detachCamera: () => this.player.camera.detachControl(),
    setInteractionBlocked: (b) => { if (this.interactionSystem) this.interactionSystem.isBlocked = b; }, focusGame: () => this.canvas.focus({ preventScroll: true }),
    onHeldChange: (held) => document.body.classList.toggle("is-input-held", held),
  });
  /** The camera stack: the player's view unless a shot (dialogue framing, the death fall) runs. */
  public readonly _camera = new CameraDirector();
  public readonly _deathCamera = new DeathCamera(() => this.player?.camera ?? null);
  /** Panels that take over the screen (Escape, pause, input blocking). */
  public readonly _modals = new ModalRegistry();
  /** Bars, clock, compass, readouts and the debug overlay. */
  public readonly _hud = new HudPresenter(() => hudSources(this.asGame));

  // Last LOD culled count for the debug overlay (updated from lodSystem.update())
  public _lastLodCulled: number = 0;

  /** Frame counter for throttling non-critical subsystem updates. */
  public _systemTickCounter: number = 0;

  public _helpOverlayEl: HTMLDivElement | null = null;
  public _helpOverlayVisible: boolean = false;
  public activeEffectHUD: ActiveEffectHUD;
  public quickSlotHUD: QuickSlotHUD;

  /** Decoupled input action adapter — maps named actions to key/mouse/gamepad events. */
  public readonly _inputAdapter = new BabylonInputAdapter();
  /** Gamepad input polling system — feeds controller input into the adapter. */
  /** Gamepad support: loaded when the first gamepad connects (see setup-wiring). */
  public _gamepadInput: GamepadInputSystem | null = null;
  /** Launch achievements. Forwarded to Steamworks when the desktop shell is up. */
  public _achievements: AchievementSystem | null = null;
  public get _creditsUI(): CreditsUI { return this._settings.credits; }

  /** Short post-creation tips; advances on Space or when the hinted action occurs. */
  /** First-run tips (the onboarding feature). */
  public get _tips(): OnboardingService { return this.kernel.services.get(OnboardingKey); }
  public _lastDynamicWorldEventHour = -1;

  /** Currently pending quick-slot assign mode (HUD slot clicked, awaiting an inventory pick). */
  public _quickSlotAssignKey: QuickSlotKey | null = null;

  /**
   * Spawn an archetype NPC and register it as chunk-scoped world content:
   * schedule/combat/stealth/crime systems (shared NPC list), level scaling,
   * LOD culling, and disposal with its chunk via `chunkRecord`.
   */
  public _spawnArchetypeNpc(
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

  public _hudSourcesCache: HudSources | null = null;
}
