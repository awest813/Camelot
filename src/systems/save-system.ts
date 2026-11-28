import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Player } from "../entities/player";
import { Item, InventorySystem } from "./inventory-system";
import { EquipmentSystem, EquipSlot } from "./equipment-system";
import { QuestSystem, QuestSaveState } from "./quest-system";
import { SkillTreeSystem, SkillSaveState } from "./skill-tree-system";
import { UIManager } from "../ui/ui-manager";
import { SaveEngine as FrameworkSaveEngine } from "../framework/save/save-engine";
import type { FrameworkRuntime } from "../framework/runtime/framework-runtime";
import type { AttributeSystem } from "./attribute-system";
import type { TimeSystem } from "./time-system";
import type { CrimeSystem } from "./crime-system";
import type { ContainerSystem } from "./container-system";
import type { BarterSystem } from "./barter-system";
import type { CellManager } from "../world/cell-manager";
import type { SpellSystem } from "./spell-system";
import type { PersuasionSystem } from "./persuasion-system";
import type { AlchemySystem } from "./alchemy-system";
import type { EnchantingSystem } from "./enchanting-system";
import type { WeatherSystem } from "./weather-system";
import type { QuickSlotSystem } from "./quickslot-system";
import type { WaitSystem } from "./wait-system";
import type { SkillProgressionSystem } from "./skill-progression-system";
import type { FastTravelSystem } from "./fast-travel-system";
import type { FameSystem } from "./fame-system";
import type { ActiveEffectsSystem } from "./active-effects-system";
import type { JailSystem } from "./jail-system";
import type { RespawnSystem } from "./respawn-system";
import type { MerchantRestockSystem } from "./merchant-restock-system";
import type { BirthsignSystem } from "./birthsign-system";
import type { ClassSystem } from "./class-system";
import type { RaceSystem } from "./race-system";
import type { PlayerLevelSystem } from "./player-level-system";
import type { SwimmingSystem } from "./swimming-system";
import type { DiseaseSystem } from "./disease-system";
import type { EventManagerSystem } from "./event-manager-system";
import type { MarkRecallSystem } from "./mark-recall-system";
import type { TrainerSystem } from "./trainer-system";
import type { ItemConditionSystem } from "./item-condition-system";
import type { PerkSystem } from "./perk-system";
import type { DynamicWorldEventSystem } from "./dynamic-world-event-system";
import type { TravelEventSystem } from "./travel-event-system";
import type { AmbientEventSystem } from "./ambient-event-system";
import type { StealthSystem } from "./stealth-system";
import type { CombatSystem } from "./combat-system";
import { SAVE_STORAGE_KEY } from "../platform/constants";
import type { SaveStore } from "../platform/save-store";
import type { GameEventBus } from "./event-bus";

const SAVE_KEY = SAVE_STORAGE_KEY;
// v29: stealth crouch state + player combat status effects.
const SAVE_VERSION = 30;
/**
 * Oldest save version that can still be loaded.  Version 30 is the game's
 * own setting (docs/original-setting-plan.md): its ids replaced the borrowed
 * ones, and saves from before it are not migrated.
 */
const SAVE_VERSION_MIN = 30;
/** What the player is told when a save is too old (or too new) to load. */
export const OLD_SAVE_MESSAGE = "This save is from another version of Camelot and can't be loaded.";

interface PlayerSaveData {
  position: { x: number; y: number; z: number };
  health: number;
  magicka: number;
  stamina: number;
  level: number;
  experience: number;
  experienceToNextLevel: number;
  carryWeight?: number;
  maxCarryWeight?: number;
  /** Player character name (added in v15). */
  name?: string;
}

interface ParsedSaveData {
  version: number;
  timestamp: number;
  player: PlayerSaveData;
  inventory: Item[];
  equipment: EquipmentEntry[];
  quests: QuestSaveState[];
  skills?: SkillSaveState[];
  skillPoints?: number;
  framework?: string;
  attributes?: unknown;
  time?: unknown;
  crime?: unknown;
  containers?: unknown;
  barter?: unknown;
  cell?: unknown;
  spells?: unknown;
  persuasion?: unknown;
  alchemy?: unknown;
  enchanting?: unknown;
  weather?: unknown;
  quickSlots?: unknown;
  wait?: unknown;
  // v11 additions
  skillProgression?: unknown;
  fastTravel?: unknown;
  // v12 additions
  fame?: unknown;
  activeEffects?: unknown;
  jail?: unknown;
  // v13 additions
  spellMaking?: unknown;
  respawn?: unknown;
  merchantRestock?: unknown;
  // v14 additions
  birthsign?: unknown;
  characterClass?: unknown;
  // v15 additions
  race?: unknown;
  // v16 additions (race power cooldown baked into race save state)
  // v17 additions
  playerLevel?: unknown;
  // v18 additions
  dailySchedule?: unknown;
  // v19 additions
  horse?: unknown;
  // v20 additions
  swimming?: unknown;
  // v21 additions
  disease?: unknown;
  // v22 additions
  eventManager?: unknown;
  // v23 additions
  pets?: unknown;
  // v24 additions
  markRecall?: unknown;
  trainer?: unknown;
  // v25 additions
  pickpocket?: unknown;
  itemCondition?: unknown;
  /** Smithing recipe craft counts + discoveries (optional; no version bump). */
  crafting?: unknown;
  /** Village job board (innkeeper work): active jobs + jobs done per board. */
  villageJobs?: unknown;
  villageRaids?: unknown;
  // v26 additions (the Words of the Old Tongue)
  oldTongue?: unknown;
  follower?: unknown;
  // v27 additions
  perks?: unknown;
  // v28 additions
  survival?: unknown;
  dynamicWorldEvents?: unknown;
  // Flavor event cooldown state (post-v28 wiring)
  travelEvents?: unknown;
  ambientEvents?: unknown;
  // v29 additions
  stealth?: unknown;
  combatEffects?: unknown;
}

/**
 * One piece of the save, owned by whoever registers it (usually a feature).
 * `save` returns the value to store under `key`, or undefined for nothing.
 * `load` gets what is stored under `key`, or undefined when the save has
 * none (an older save): it should reset to a fresh state then.
 */
export interface SaveCodec {
  readonly key: string;
  /**
   * When it loads relative to the others (lower first).  The save system's
   * own parts use 10–360, in the order they have always loaded; features
   * default to {@link FEATURE_CODEC_ORDER}, after all of them.
   */
  readonly order?: number;
  save(): unknown;
  load(data: unknown): void;
}

/** Save parts renamed since version 30: the key a save from before the rename used. */
const FORMER_KEYS: Readonly<Record<string, string>> = { oldTongue: "dragonShouts" };

/** Default load order for feature codecs: after every built-in part. */
export const FEATURE_CODEC_ORDER = 1000;

interface EquipmentEntry {
  slot: string;
  item: Item;
}

export interface SaveData {
  version: number;
  timestamp: number;
  player: PlayerSaveData;
  inventory: Item[];
  equipment: EquipmentEntry[];
  quests: QuestSaveState[];
  skills?: SkillSaveState[];
  skillPoints?: number;
  framework?: string;
  // v5 additions
  attributes?: any;
  time?: any;
  crime?: any;
  containers?: any;
  barter?: any;
  cell?: any;
  // v6 additions
  spells?: any;
  persuasion?: any;
  // v7 additions
  alchemy?: any;
  // v8 additions
  enchanting?: any;
  // v9 additions
  weather?: any;
  quickSlots?: any;
  // v10 additions
  wait?: any;
  // v11 additions
  skillProgression?: any;
  fastTravel?: any;
  // v12 additions
  fame?: any;
  activeEffects?: any;
  jail?: any;
  // v13 additions
  spellMaking?: any;
  respawn?: any;
  merchantRestock?: any;
  // v14 additions
  birthsign?: any;
  characterClass?: any;
  // v15 additions
  race?: any;
  // v16: race power cooldown baked into race save state — no new top-level field
  // v17 additions
  playerLevel?: any;
  // v18 additions
  dailySchedule?: any;
  // v19 additions
  horse?: any;
  // v20 additions
  swimming?: any;
  // v21 additions
  disease?: any;
  // v22 additions
  eventManager?: any;
  // v23 additions
  pets?: any;
  // v24 additions
  markRecall?: any;
  trainer?: any;
  // v25 additions
  pickpocket?: any;
  itemCondition?: any;
  crafting?: any;
  villageJobs?: any;
  villageRaids?: any;
  // v26 additions (the Words of the Old Tongue)
  oldTongue?: any;
  follower?: any;
  // v27 additions
  perks?: any;
  // v28 additions
  survival?: any;
  dynamicWorldEvents?: any;
  travelEvents?: any;
  ambientEvents?: any;
  // v29 additions
  stealth?: any;
  combatEffects?: any;
}

export class SaveSystem {
  /** Where this reports what happened (the game's event bus). */
  public events: GameEventBus | null = null;

  private _player: Player;
  private _inventory: InventorySystem;
  private _equipment: EquipmentSystem;
  private _quests: QuestSystem | null = null;
  private _skills: SkillTreeSystem | null = null;
  private _frameworkRuntime: FrameworkRuntime | null = null;
  private _frameworkSaveEngine = new FrameworkSaveEngine();
  /** Feature-owned parts of the save, by key, in registration order. */
  private readonly _codecs = new Map<string, SaveCodec>();
  private _ui: UIManager;

  // v5 optional systems
  private _attributes: AttributeSystem | null = null;
  private _timeSystem: TimeSystem | null = null;
  private _crimeSystem: CrimeSystem | null = null;
  private _containerSystem: ContainerSystem | null = null;
  private _barterSystem: BarterSystem | null = null;
  private _cellManager: CellManager | null = null;

  // v6 optional systems
  private _spellSystem: SpellSystem | null = null;
  private _persuasionSystem: PersuasionSystem | null = null;

  // v7 optional systems
  private _alchemySystem: AlchemySystem | null = null;

  // v8 optional systems
  private _enchantingSystem: EnchantingSystem | null = null;

  // v9 optional systems
  private _weatherSystem: WeatherSystem | null = null;
  private _quickSlotSystem: QuickSlotSystem | null = null;

  // v10 optional systems
  private _waitSystem: WaitSystem | null = null;

  // v11 optional systems
  private _skillProgressionSystem: SkillProgressionSystem | null = null;
  private _fastTravelSystem: FastTravelSystem | null = null;

  // v12 optional systems
  private _fameSystem: FameSystem | null = null;
  private _activeEffectsSystem: ActiveEffectsSystem | null = null;
  private _jailSystem: JailSystem | null = null;

  // v13 optional systems
  private _respawnSystem: RespawnSystem | null = null;
  private _merchantRestockSystem: MerchantRestockSystem | null = null;

  // v14 optional systems
  private _birthsignSystem: BirthsignSystem | null = null;
  private _classSystem: ClassSystem | null = null;

  // v15 optional systems
  private _raceSystem: RaceSystem | null = null;

  // v17 optional systems
  private _playerLevelSystem: PlayerLevelSystem | null = null;

  // v18 optional systems

  // v19 optional systems

  // v20 optional systems
  private _swimmingSystem: SwimmingSystem | null = null;

  // v21 optional systems
  private _diseaseSystem: DiseaseSystem | null = null;
  // ── v22 optional systems ──────────────────────────────────────────────────
  private _eventManagerSystem: EventManagerSystem | null = null;
  // ── v23 optional systems ──────────────────────────────────────────────────
  // ── v24 optional systems ──────────────────────────────────────────────────
  private _markRecallSystem: MarkRecallSystem | null = null;
  private _trainerSystem: TrainerSystem | null = null;
  // ── v25 optional systems ──────────────────────────────────────────────────
  private _itemConditionSystem: ItemConditionSystem | null = null;
  // ── v26 optional systems ──────────────────────────────────────────────────
  // ── v27 optional systems ──────────────────────────────────────────────────
  private _perkSystem: PerkSystem | null = null;
  // ── v28 optional systems ──────────────────────────────────────────────────
  private _dynamicWorldEventSystem: DynamicWorldEventSystem | null = null;
  private _travelEventSystem: TravelEventSystem | null = null;
  private _ambientEventSystem: AmbientEventSystem | null = null;
  // ── v29 optional systems ──────────────────────────────────────────────────
  private _stealthSystem: StealthSystem | null = null;
  private _combatSystem: CombatSystem | null = null;

  private _autosaveIntervalSeconds = 30;
  private _autosaveAccumulator = 0;
  private _autosaveDirty = false;
  /** Optional store. The default reads localStorage at call time so tests can stub it. */
  private _store: SaveStore | null = null;

  constructor(player: Player, inventory: InventorySystem, equipment: EquipmentSystem, ui: UIManager) {
    this._player = player;
    this._inventory = inventory;
    this._equipment = equipment;
    this._ui = ui;
  }

  /**
   * Replace the save slot backend. The desktop shell passes a store that
   * mirrors the primary slot to a file Steam Auto-Cloud can watch.
   */
  public setStorage(store: SaveStore): void {
    this._store = store;
  }

  private _storage(): SaveStore {
    if (this._store) return this._store;
    return {
      getItem: (key) => localStorage.getItem(key),
      setItem: (key, value) => { localStorage.setItem(key, value); },
      removeItem: (key) => { localStorage.removeItem(key); },
    };
  }

  /** Inject QuestSystem after construction (avoids circular init order in Game). */
  public setQuestSystem(qs: QuestSystem): void {
    this._quests = qs;
  }

  /** Inject SkillTreeSystem after construction. */
  public setSkillTreeSystem(sts: SkillTreeSystem): void {
    this._skills = sts;
  }

  /** Inject framework runtime so modern headless state can be persisted with legacy save payloads. */
  public setFrameworkRuntime(runtime: FrameworkRuntime): void {
    this._frameworkRuntime = runtime;
  }

  // ── v5 system injection ───────────────────────────────────────────────────

  public setAttributeSystem(s: AttributeSystem): void { this._attributes = s; }
  public setTimeSystem(s: TimeSystem): void            { this._timeSystem = s; this._own("time", 10, () => s.getSaveState(), (d) => s.restoreFromSave(d as any)); }
  public setCrimeSystem(s: CrimeSystem): void          { this._crimeSystem = s; this._own("crime", 20, () => s.getSaveState(), (d) => s.restoreFromSave(d as any)); }
  public setContainerSystem(s: ContainerSystem): void  { this._containerSystem = s; this._own("containers", 30, () => s.getSaveState(), (d) => s.restoreFromSave(d as any)); }
  public setBarterSystem(s: BarterSystem): void        { this._barterSystem = s; this._own("barter", 40, () => s.getSaveState(), (d) => s.restoreFromSave(d as any)); }
  public setCellManager(s: CellManager): void          { this._cellManager = s; this._own("cell", 50, () => s.getSaveState(), (d) => s.restoreFromSave(d as any)); }

  // ── v6 system injection ───────────────────────────────────────────────────

  public setSpellSystem(s: SpellSystem): void          { this._spellSystem = s; this._own("spells", 60, () => s.getSaveState(), (d) => s.restoreFromSave(d as any)); }
  public setPersuasionSystem(s: PersuasionSystem): void { this._persuasionSystem = s; this._own("persuasion", 70, () => s.getSaveState(), (d) => s.restoreFromSave(d as any)); }

  // ── v7 system injection ───────────────────────────────────────────────────

  public setAlchemySystem(s: AlchemySystem): void      { this._alchemySystem = s; this._own("alchemy", 80, () => s.getSaveState(), (d) => s.restoreFromSave(d as any)); }

  // ── v8 system injection ───────────────────────────────────────────────────

  public setEnchantingSystem(s: EnchantingSystem): void { this._enchantingSystem = s; this._own("enchanting", 90, () => s.getSaveState(), (d) => s.restoreFromSave(d as any)); }

  // ── v9 system injection ───────────────────────────────────────────────────

  public setWeatherSystem(s: WeatherSystem): void       { this._weatherSystem = s; this._own("weather", 100, () => s.getSaveState(), (d) => s.restoreFromSave(d as any)); }
  public setQuickSlotSystem(s: QuickSlotSystem): void   { this._quickSlotSystem = s; this._own("quickSlots", 110, () => s.getSaveState(), (d) => s.restoreFromSave(d as any)); }

  // ── v10 system injection ──────────────────────────────────────────────────

  public setWaitSystem(s: WaitSystem): void              { this._waitSystem = s; this._own("wait", 120, () => s.getSaveState(), (d) => s.restoreFromSave(d as any)); }

  // ── v11 system injection ──────────────────────────────────────────────────

  public setSkillProgressionSystem(s: SkillProgressionSystem): void { this._skillProgressionSystem = s; this._own("skillProgression", 130, () => s.getSaveState(), (d) => s.restoreFromSave(d as any)); }
  public setFastTravelSystem(s: FastTravelSystem): void              { this._fastTravelSystem = s; this._own("fastTravel", 140, () => s.getSaveState(), (d) => s.restoreFromSave(d as any)); }

  // ── v12 system injection ──────────────────────────────────────────────────

  public setFameSystem(s: FameSystem): void                { this._fameSystem = s; this._own("fame", 150, () => s.getSaveState(), (d) => s.restoreFromSave(d as any)); }
  public setActiveEffectsSystem(s: ActiveEffectsSystem): void { this._activeEffectsSystem = s; this._own("activeEffects", 160, () => s.getSaveState(), (d) => s.restoreFromSave(d as any)); }
  public setJailSystem(s: JailSystem): void                { this._jailSystem = s; this._own("jail", 170, () => s.getSaveState(), (d) => s.restoreFromSave(d as any)); }

  // ── v13 system injection ──────────────────────────────────────────────────

  public setRespawnSystem(s: RespawnSystem): void               { this._respawnSystem = s; this._own("respawn", 180, () => s.getSaveState(), (d) => s.restoreFromSave(d as any)); }
  public setMerchantRestockSystem(s: MerchantRestockSystem): void { this._merchantRestockSystem = s; this._own("merchantRestock", 190, () => s.getSaveState(), (d) => s.restoreFromSave(d as any)); }

  // ── v14 system injection ──────────────────────────────────────────────────

  /**
   * Called on load once every part is restored (the maxima rebuilt from the
   * attributes, gear and skill ranks), before current health/magicka/stamina
   * are clamped to them: the game puts back what else it keeps on the maxima
   * (the omen, diseases).
   */
  public setMaximaRestorer(restore: () => void): void {
    this._restoreMaxima = restore;
  }
  private _restoreMaxima: (() => void) | null = null;

  public setBirthsignSystem(s: BirthsignSystem): void           { this._birthsignSystem = s; this._own("birthsign", 200, () => s.getSaveState(), (d) => s.restoreFromSave(d as any)); }
  public setClassSystem(s: ClassSystem): void                   { this._classSystem = s; this._own("characterClass", 210, () => s.getSaveState(), (d) => s.restoreFromSave(d as any)); }

  // ── v15 system injection ──────────────────────────────────────────────────

  public setRaceSystem(s: RaceSystem): void                     { this._raceSystem = s; this._own("race", 220, () => s.getSaveState(), (d) => s.restoreFromSave(d as any)); }

  // ── v17 system injection ──────────────────────────────────────────────────

  public setPlayerLevelSystem(s: PlayerLevelSystem): void       { this._playerLevelSystem = s; this._own("playerLevel", 230, () => s.getSaveState(), (d) => s.restoreFromSave(d as any)); }

  // ── v18 system injection ──────────────────────────────────────────────────

  /** Who sleeps by their schedule (the schedule system's `sleep` part; re-derived from the clock on load). */
  public setScheduleSleep(s: { getSaveState(): unknown; restoreFromSave(d: unknown): void }): void { this._own("dailySchedule", 240, () => s.getSaveState(), (d) => s.restoreFromSave(d)); }

  // ── v19 system injection ──────────────────────────────────────────────────

  // ── v20 system injection ──────────────────────────────────────────────────

  public setSwimmingSystem(s: SwimmingSystem): void            { this._swimmingSystem = s; this._own("swimming", 250, () => s.getSaveState(), (d) => s.restoreFromSave(d as any)); }

  // ── v21 system injection ──────────────────────────────────────────────────

  public setDiseaseSystem(s: DiseaseSystem): void              { this._diseaseSystem = s; this._own("disease", 260, () => s.getSaveState(), (d) => s.restoreFromSave(d as any)); }

  // ── v22 system injection ──────────────────────────────────────────────────

  public setEventManagerSystem(s: EventManagerSystem): void   { this._eventManagerSystem = s; this._own("eventManager", 270, () => s.getSaveState(), (d) => s.restoreFromSave(d as any)); }

  // ── v23 system injection ──────────────────────────────────────────────────

  // ── v24 system injection ──────────────────────────────────────────────────

  public setMarkRecallSystem(s: MarkRecallSystem): void       { this._markRecallSystem = s; this._own("markRecall", 280, () => s.getSaveState(), (d) => s.restoreFromSave(d as any)); }
  public setTrainerSystem(s: TrainerSystem): void             { this._trainerSystem = s; this._own("trainer", 290, () => s.getSaveState(), (d) => s.restoreFromSave(d as any)); }

  // ── v25 system injection ──────────────────────────────────────────────────

  public setItemConditionSystem(s: ItemConditionSystem): void { this._itemConditionSystem = s; this._own("itemCondition", 300, () => s.getSaveState(), (d) => s.restoreFromSave(d as any)); }

  // ── v26 system injection ──────────────────────────────────────────────────

  // ── v27 system injection ──────────────────────────────────────────────────

  public setPerkSystem(s: PerkSystem): void               { this._perkSystem = s; this._own("perks", 310, () => s.getSaveState(), (d) => s.restoreFromSave(d as any)); }

  // ── v28 system injection ──────────────────────────────────────────────────

  public setDynamicWorldEventSystem(s: DynamicWorldEventSystem): void { this._dynamicWorldEventSystem = s; this._own("dynamicWorldEvents", 320, () => s.getSnapshot(), (d) => s.restoreSnapshot(d as any)); }
  public setTravelEventSystem(s: TravelEventSystem): void { this._travelEventSystem = s; this._own("travelEvents", 330, () => s.getSnapshot(), (d) => s.restoreSnapshot(d as any)); }
  public setAmbientEventSystem(s: AmbientEventSystem): void { this._ambientEventSystem = s; this._own("ambientEvents", 340, () => s.getSnapshot(), (d) => s.restoreSnapshot(d as any)); }

  // ── v29 system injection ──────────────────────────────────────────────────

  public setStealthSystem(s: StealthSystem): void           { this._stealthSystem = s; this._own("stealth", 350, () => s.getSaveState(), (d) => s.restoreFromSave(d as any)); }
  public setCombatSystem(s: CombatSystem): void             { this._combatSystem = s; this._own("combatEffects", 360, () => s.getSaveState(), (d) => s.restoreFromSave(d as any)); }

  /**
   * Serialize the full game state to localStorage.
   * @param silent suppress the "Game Saved!" notification (used by autosave)
   */
  /**
   * Own a part of the save.  It is written under `codec.key` on every save
   * and read back after the built-in state on every load.  Returns the
   * unregister function.
   */
  public registerCodec(codec: SaveCodec): () => void {
    if (this._codecs.has(codec.key)) throw new Error(`[SaveSystem] save key "${codec.key}" is already owned`);
    this._codecs.set(codec.key, codec);
    return () => { if (this._codecs.get(codec.key) === codec) this._codecs.delete(codec.key); };
  }

  /**
   * A built-in part of the save: a system attached by one of the setters.
   * Attaching again replaces it.  Missing in the save (an older one) means
   * the system keeps its current state, as it always has.
   */
  private _own(key: string, order: number, save: () => unknown, load: (data: unknown) => void): void {
    this._codecs.delete(key);
    this._codecs.set(key, { key, order, save, load: (data) => { if (data) load(data); } });
  }

  /** Codecs in load order (stable for equal orders). */
  private _codecsInOrder(): SaveCodec[] {
    return [...this._codecs.values()]
      .map((codec, i) => ({ codec, i }))
      .sort((a, b) => (a.codec.order ?? FEATURE_CODEC_ORDER) - (b.codec.order ?? FEATURE_CODEC_ORDER) || a.i - b.i)
      .map(({ codec }) => codec);
  }

  public save(silent = false): void {
    this.events?.emit("save:beforeSave", {});
    const equipmentEntries: EquipmentEntry[] = [];
    for (const [slot, item] of this._equipment.getEquipped()) {
      equipmentEntries.push({ slot, item });
    }

    // The quest log keeps nothing of its own (the engine's snapshot holds the
    // quests); the legacy section stays in the format, empty.
    const questSaveStates: QuestSaveState[] = [];

    const data: SaveData = {
      version: SAVE_VERSION,
      timestamp: Date.now(),
      player: {
        position: {
          x: this._player.camera.position.x,
          y: this._player.camera.position.y,
          z: this._player.camera.position.z,
        },
        health: this._player.health,
        magicka: this._player.magicka,
        stamina: this._player.stamina,
        level: this._player.level,
        experience: this._player.experience,
        experienceToNextLevel: this._player.experienceToNextLevel,
        carryWeight: this._player.carryWeight,
        maxCarryWeight: this._player.maxCarryWeight,
        name: this._player.name,
      },
      inventory: [...this._inventory.items],
      equipment: equipmentEntries,
      quests: questSaveStates,
      skills: this._skills ? this._skills.getSaveState() : [],
      skillPoints: this._player.skillPoints,
    };

    if (this._frameworkRuntime) {
      data.framework = this._frameworkSaveEngine.serialize(this._frameworkRuntime.getSaveSnapshot(), "default");
    }
    if (this._attributes) data.attributes = this._attributes.getSaveState();
    const record = data as unknown as Record<string, unknown>;
    for (const codec of this._codecsInOrder()) {
      const value = codec.save();
      if (value !== undefined) record[codec.key] = value;
    }

    this._storage().setItem(SAVE_KEY, JSON.stringify(data));
    if (!silent) this._ui.showNotification("Game Saved!", 2500);
    this._autosaveDirty = false;
    this._autosaveAccumulator = 0;
  }

  /**
   * Marks runtime state as dirty so the next autosave window persists changes.
   * Call this from gameplay systems on meaningful state transitions.
   */
  public markDirty(): void {
    this._autosaveDirty = true;
  }

  /**
   * Advances the autosave timer and performs a save when:
   * - autosave is enabled (interval > 0),
   * - gameplay state is marked dirty, and
   * - interval has elapsed.
   */
  public tickAutosave(deltaSeconds: number): void {
    if (this._autosaveIntervalSeconds <= 0) return;
    if (!this._autosaveDirty) return;
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;

    this._autosaveAccumulator += deltaSeconds;
    if (this._autosaveAccumulator < this._autosaveIntervalSeconds) return;

    this.save(true);
  }

  /**
   * Configures autosave cadence in seconds. Set to <= 0 to disable autosave.
   */
  public setAutosaveInterval(seconds: number): void {
    this._autosaveIntervalSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    this._autosaveAccumulator = 0;
  }

  public load(): boolean {
    const raw = this._storage().getItem(SAVE_KEY);
    if (!raw) {
      this._ui.showNotification("No save file found.", 2500);
      return false;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      console.error("[SaveSystem] Save file is corrupt (invalid JSON):", error);
      this._ui.showNotification("Save file is corrupt.", 2500);
      return false;
    }

    const data = this._parseAndValidateSaveData(parsed);
    if (!data) {
      this._ui.showNotification("Save file is corrupt.", 2500);
      return false;
    }

    if (data.version < SAVE_VERSION_MIN || data.version > SAVE_VERSION) {
      this._ui.showNotification(OLD_SAVE_MESSAGE, 4000);
      return false;
    }

    // Restore player position and stats
    this._player.camera.position = new Vector3(
      data.player.position.x,
      data.player.position.y,
      data.player.position.z,
    );
    // Take off this session's gear first, while its bonuses are still on the
    // player (they come off with it); the stats below are then reset, and the
    // saved gear goes back on after the maxima are.
    for (const slot of Array.from(this._equipment.getEquipped().keys())) {
      this._equipment.unequipSilent(slot);
    }

    this._player.health = data.player.health;
    this._player.magicka = data.player.magicka;
    this._player.stamina = data.player.stamina;

    // Restore level & XP; recalculate max stats from level
    this._player.level = data.player.level ?? 1;
    this._player.experience = data.player.experience ?? 0;
    this._player.experienceToNextLevel = data.player.experienceToNextLevel ?? (this._player.level * 100);
    const levelBonus = (this._player.level - 1) * 10;
    this._player.maxHealth = 100 + levelBonus;
    this._player.maxMagicka = 100 + levelBonus;
    this._player.maxStamina = 100 + levelBonus;

    // Reset all derived stat bonuses so equipment and skills can be applied cleanly
    // without doubling effects that were already active in this session.
    this._player.bonusDamage = 0;
    this._player.bonusArmor = 0;
    this._player.bonusMagicDamage = 0;
    this._player.healthRegen = 0.5;
    this._player.magickaRegen = 2;
    this._player.staminaRegen = 5;
    // Reset perk-modified fields so PerkSystem can re-apply them cleanly.
    this._player.perkPowerAttackStaminaMultiplier = 1.0;
    this._player.perkSneakAttackMultiplier = 1.0;
    this._player.perkHealingMultiplier = 1.0;
    this._player.perkRepairMultiplier = 1.0;
    this._player.perkWearMultiplier = 1.0;
    this._player.perkSmithingQualityBonus = 0;

    // Restore inventory
    this._inventory.items = data.inventory;


    // Restore quest progress
    if (this._quests && data.quests?.length) {
      this._quests.restoreState(data.quests);
    }


    if (this._frameworkRuntime && typeof data.framework === "string") {
      try {
        const frameworkSave = this._frameworkSaveEngine.deserialize(data.framework);
        this._frameworkRuntime.restoreFromSave(frameworkSave);
      } catch (error) {
        console.error("[SaveSystem] Framework save data was invalid:", error);
        this._ui.showNotification("Framework save data was invalid; loaded legacy state only.", 2500);
      }
    }

    // v5 systems
    if (this._attributes && data.attributes) {
      this._attributes.restoreFromSave(data.attributes as any);
      // Attribute-derived maxima supersede the XP-level estimate above — same
      // sync the game layer applies after every attribute spend. Without this,
      // every load silently collapsed the maxima to the level-based values.
      this._player.maxHealth      = this._attributes.maxHealth;
      this._player.maxMagicka     = this._attributes.maxMagicka;
      this._player.maxStamina     = this._attributes.maxStamina;
      this._player.maxCarryWeight = this._attributes.carryWeight;
    }

    // Gear and skill ranks go back on after the maxima are reset above, so
    // what they add to a maximum (an amulet's +health, a rank's +25 stamina)
    // lands on top instead of being wiped.
    for (const { slot, item } of data.equipment) {
      this._equipment.equipSilent(item, slot as EquipSlot);
    }

    // Restore skill tree state. Always pass an array so loading a save with
    // no skills correctly clears any in-session skill ranks/effects.
    this._player.skillPoints = data.skillPoints ?? 0;
    if (this._skills) {
      this._skills.restoreState(Array.isArray(data.skills) ? data.skills : []);
    }

    // Every registered part, in load order: the save system's own systems
    // (10–360) then features.  Read from the raw save; the validator above
    // only knows the core fields.
    for (const codec of this._codecsInOrder()) {
      try {
        const raw = parsed as Record<string, unknown>;
        codec.load(raw[codec.key] ?? (FORMER_KEYS[codec.key] ? raw[FORMER_KEYS[codec.key]] : undefined));
      } catch (error) {
        console.error(`[SaveSystem] "${codec.key}" save data was invalid:`, error);
      }
    }

    // Every part is back (the omen, diseases …): the game puts its share of the
    // maxima back on, then current resources are clamped to them.
    this._restoreMaxima?.();
    this._player.health  = Math.min(this._player.health, this._player.maxHealth);
    this._player.magicka = Math.min(this._player.magicka, this._player.maxMagicka);
    this._player.stamina = Math.min(this._player.stamina, this._player.maxStamina);

    // Restore player name (v15+; keep default "Hero" for older saves)
    if (typeof data.player.name === "string" && data.player.name.trim()) {
      this._player.name = data.player.name;
    }

    // Restore encumbrance stats
    if (typeof data.player.maxCarryWeight === "number") {
      this._player.maxCarryWeight = data.player.maxCarryWeight;
    }
    // Recompute carryWeight from restored inventory
    this._player.carryWeight = this._inventory.totalWeight;

    // Sync UI once after all state is restored
    this._equipment.refreshUI();
    this._ui.showNotification("Game Loaded!", 2500);

    // Let Game clean up world objects that are now in inventory/equipment
    this.events?.emit("save:loaded", {});

    return true;
  }

  /**
   * The stored save in brief (for a "Continue" line); null when there is none
   * or it can't be read.  `old` marks a save from another version (it won't load).
   */
  public peekSummary(): { name: string; level: number; savedAt: number; old?: true } | null {
    try {
      const raw = this._storage().getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw) as { version?: number; timestamp?: number; player?: { name?: string; level?: number }; playerLevel?: { characterLevel?: unknown } };
      if (!data.player) return null;
      const v = data.version ?? 0;
      const old = v < SAVE_VERSION_MIN || v > SAVE_VERSION;
      // The character level the HUD shows (player.level is the experience level).
      const shown = data.playerLevel?.characterLevel;
      const level = typeof shown === "number" && Number.isFinite(shown) ? shown : data.player.level ?? 1;
      return { name: data.player.name?.trim() || "Hero", level, savedAt: data.timestamp ?? 0, ...(old ? { old: true as const } : {}) };
    } catch {
      return null;
    }
  }

  public hasSave(): boolean {
    return this._storage().getItem(SAVE_KEY) !== null;
  }

  public deleteSave(): void {
    this._storage().removeItem(SAVE_KEY);
    this._autosaveDirty = false;
    this._autosaveAccumulator = 0;
  }

  // ── File export / import (browser-safe) ───────────────────────────────────

  /**
   * Export the current save to a JSON file download in the browser.
   * Silently no-ops in non-browser environments (e.g. tests).
   *
   * The exported file can be re-imported with `importFromFile()`.
   */
  public exportToFile(): void {
    const raw = this._storage().getItem(SAVE_KEY);
    if (!raw) {
      this._ui.showNotification("Nothing to export — save first.", 2500);
      return;
    }

    if (typeof document === "undefined") return; // headless / SSR guard

    const blob = new Blob([raw], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `camelot_save_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this._ui.showNotification("Save exported!", 2000);
  }

  /**
   * Import a save from a File object (from an `<input type="file">` element).
   * Returns a Promise that resolves to `true` on success, `false` on failure.
   */
  public async importFromFile(file: File): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const json = e.target?.result as string;
        const ok = this._applyImportedJson(json);
        resolve(ok);
      };
      reader.onerror = () => {
        this._ui.showNotification("Failed to read save file.", 2500);
        resolve(false);
      };
      reader.readAsText(file);
    });
  }

  /**
   * Import a save from a raw JSON string.
   * Useful for programmatic imports (e.g. copy-paste in a debug UI).
   * Returns `true` on success.
   */
  public importFromJson(json: string): boolean {
    return this._applyImportedJson(json);
  }

  private _applyImportedJson(json: string): boolean {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch (error) {
      console.error("[SaveSystem] Import failed (invalid JSON):", error);
      this._ui.showNotification("Import failed: invalid JSON.", 2500);
      return false;
    }

    const data = this._parseAndValidateSaveData(parsed);
    if (!data) {
      this._ui.showNotification("Import failed: corrupt save structure.", 2500);
      return false;
    }

    if (data?.version === undefined || data.version < SAVE_VERSION_MIN || data.version > SAVE_VERSION) {
      this._ui.showNotification(`Import failed. ${OLD_SAVE_MESSAGE}`, 4000);
      return false;
    }

    // Write into the active slot then immediately load
    this._storage().setItem(SAVE_KEY, json);
    const ok = this.load();
    if (ok) {
      this._ui.showNotification("Save imported successfully!", 2500);
      this._autosaveDirty = false;
      this._autosaveAccumulator = 0;
    }
    return ok;
  }

  private _parseAndValidateSaveData(value: unknown): ParsedSaveData | null {
    if (!value || typeof value !== "object") return null;

    const data = value as Partial<SaveData>;
    if (!this._isFiniteNumber(data.version) || !this._isFiniteNumber(data.timestamp)) return null;

    const player = this._validatePlayerData(data.player);
    if (!player) return null;

    if (!Array.isArray(data.inventory) || !Array.isArray(data.equipment) || !Array.isArray(data.quests)) {
      return null;
    }

    if (data.framework !== undefined && typeof data.framework !== "string") return null;
    if (data.skillPoints !== undefined && !this._isFiniteNumber(data.skillPoints)) return null;
    if (data.skills !== undefined && !Array.isArray(data.skills)) return null;

    return {
      version: data.version,
      timestamp: data.timestamp,
      player,
      inventory: data.inventory,
      equipment: data.equipment,
      quests: data.quests,
      skills: data.skills,
      skillPoints: data.skillPoints,
      framework: data.framework,
      attributes: data.attributes,
      time: data.time,
      crime: data.crime,
      containers: data.containers,
      barter: data.barter,
      cell: data.cell,
      spells: data.spells,
      persuasion: data.persuasion,
      alchemy: data.alchemy,
      enchanting: data.enchanting,
      weather: data.weather,
      quickSlots: data.quickSlots,
      wait: data.wait,
      skillProgression: data.skillProgression,
      fastTravel: data.fastTravel,
      fame: data.fame,
      activeEffects: data.activeEffects,
      jail: data.jail,
      spellMaking: data.spellMaking,
      respawn: data.respawn,
      merchantRestock: data.merchantRestock,
      birthsign: data.birthsign,
      characterClass: data.characterClass,
      race: data.race,
      playerLevel: data.playerLevel,
      dailySchedule: data.dailySchedule,
      horse: data.horse,
      swimming: data.swimming,
      disease: data.disease,
      eventManager: data.eventManager,
      // v23+ fields — previously dropped here, which silently discarded
      // pets, pickpocket stats, follower state, etc. on every load.
      pets: data.pets,
      markRecall: data.markRecall,
      trainer: data.trainer,
      pickpocket: data.pickpocket,
      itemCondition: data.itemCondition,
      crafting: data.crafting,
      villageJobs: data.villageJobs,
      villageRaids: data.villageRaids,
      oldTongue: data.oldTongue,
      follower: data.follower,
      perks: data.perks,
      survival: data.survival,
      dynamicWorldEvents: data.dynamicWorldEvents,
      travelEvents: data.travelEvents,
      ambientEvents: data.ambientEvents,
      // v29 fields
      stealth: data.stealth,
      combatEffects: data.combatEffects,
    };
  }

  private _validatePlayerData(player: SaveData["player"] | undefined): PlayerSaveData | null {
    if (!player || typeof player !== "object") return null;
    const position = player.position;
    if (!position || typeof position !== "object") return null;

    if (
      !this._isFiniteNumber(position.x) ||
      !this._isFiniteNumber(position.y) ||
      !this._isFiniteNumber(position.z) ||
      !this._isFiniteNumber(player.health) ||
      !this._isFiniteNumber(player.magicka) ||
      !this._isFiniteNumber(player.stamina) ||
      !this._isFiniteNumber(player.level) ||
      !this._isFiniteNumber(player.experience) ||
      !this._isFiniteNumber(player.experienceToNextLevel)
    ) {
      return null;
    }

    if (player.carryWeight !== undefined && !this._isFiniteNumber(player.carryWeight)) return null;
    if (player.maxCarryWeight !== undefined && !this._isFiniteNumber(player.maxCarryWeight)) return null;

    return {
      position: { x: position.x, y: position.y, z: position.z },
      health: player.health,
      magicka: player.magicka,
      stamina: player.stamina,
      level: player.level,
      experience: player.experience,
      experienceToNextLevel: player.experienceToNextLevel,
      carryWeight: player.carryWeight,
      maxCarryWeight: player.maxCarryWeight,
      // Pass through only non-blank names; older saves (and blank ones)
      // restore as undefined so load() keeps the default.
      name: typeof player.name === "string" && player.name.trim() ? player.name : undefined,
    };
  }

  private _isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
  }
}
