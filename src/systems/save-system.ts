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

const SAVE_KEY = "camelot_save";
const SAVE_VERSION = 7;

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
}

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
}

export class SaveSystem {
  private _player: Player;
  private _inventory: InventorySystem;
  private _equipment: EquipmentSystem;
  private _quests: QuestSystem | null = null;
  private _skills: SkillTreeSystem | null = null;
  private _frameworkRuntime: FrameworkRuntime | null = null;
  private _frameworkSaveEngine = new FrameworkSaveEngine();
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
  private _autosaveIntervalSeconds = 30;
  private _autosaveAccumulator = 0;
  private _autosaveDirty = false;

  /** Called after a successful load so Game can clean up world state (e.g. remove already-collected loot). */
  public onAfterLoad: (() => void) | null = null;

  constructor(player: Player, inventory: InventorySystem, equipment: EquipmentSystem, ui: UIManager) {
    this._player = player;
    this._inventory = inventory;
    this._equipment = equipment;
    this._ui = ui;
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
  public setTimeSystem(s: TimeSystem): void            { this._timeSystem = s; }
  public setCrimeSystem(s: CrimeSystem): void          { this._crimeSystem = s; }
  public setContainerSystem(s: ContainerSystem): void  { this._containerSystem = s; }
  public setBarterSystem(s: BarterSystem): void        { this._barterSystem = s; }
  public setCellManager(s: CellManager): void          { this._cellManager = s; }

  // ── v6 system injection ───────────────────────────────────────────────────

  public setSpellSystem(s: SpellSystem): void          { this._spellSystem = s; }
  public setPersuasionSystem(s: PersuasionSystem): void { this._persuasionSystem = s; }

  // ── v7 system injection ───────────────────────────────────────────────────

  public setAlchemySystem(s: AlchemySystem): void      { this._alchemySystem = s; }

  public save(): void {
    const equipmentEntries: EquipmentEntry[] = [];
    for (const [slot, item] of this._equipment.getEquipped()) {
      equipmentEntries.push({ slot, item });
    }

    const questSaveStates: QuestSaveState[] = this._quests
      ? this._quests.getQuests().map(q => ({
          id: q.id,
          isCompleted: q.isCompleted,
          isActive: q.isActive,
          objectives: q.objectives.map(o => ({
            id: o.id,
            current: o.current,
            completed: o.completed,
          })),
        }))
      : [];

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
    if (this._attributes)       data.attributes  = this._attributes.getSaveState();
    if (this._timeSystem)       data.time        = this._timeSystem.getSaveState();
    if (this._crimeSystem)      data.crime       = this._crimeSystem.getSaveState();
    if (this._containerSystem)  data.containers  = this._containerSystem.getSaveState();
    if (this._barterSystem)     data.barter      = this._barterSystem.getSaveState();
    if (this._cellManager)      data.cell        = this._cellManager.getSaveState();
    if (this._spellSystem)      data.spells      = this._spellSystem.getSaveState();
    if (this._persuasionSystem) data.persuasion  = this._persuasionSystem.getSaveState();
    if (this._alchemySystem)    data.alchemy     = this._alchemySystem.getSaveState();

    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    this._ui.showNotification("Game Saved!", 2500);
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

    this.save();
  }

  /**
   * Configures autosave cadence in seconds. Set to <= 0 to disable autosave.
   */
  public setAutosaveInterval(seconds: number): void {
    this._autosaveIntervalSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    this._autosaveAccumulator = 0;
  }

  public load(): boolean {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      this._ui.showNotification("No save file found.", 2500);
      return false;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this._ui.showNotification("Save file is corrupt.", 2500);
      return false;
    }

    const data = this._parseAndValidateSaveData(parsed);
    if (!data) {
      this._ui.showNotification("Save file is corrupt.", 2500);
      return false;
    }

    if (data.version !== SAVE_VERSION) {
      this._ui.showNotification("Incompatible save version.", 2500);
      return false;
    }

    // Restore player position and stats
    this._player.camera.position = new Vector3(
      data.player.position.x,
      data.player.position.y,
      data.player.position.z,
    );
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

    // Restore inventory
    this._inventory.items = data.inventory;

    // Clear all equipment silently, then restore from save
    for (const slot of Array.from(this._equipment.getEquipped().keys())) {
      this._equipment.unequipSilent(slot);
    }
    for (const { slot, item } of data.equipment) {
      this._equipment.equipSilent(item, slot as EquipSlot);
    }

    // Restore quest progress
    if (this._quests && data.quests?.length) {
      this._quests.restoreState(data.quests);
    }

    // Restore skill tree state. Always pass an array so loading a save with
    // no skills correctly clears any in-session skill ranks/effects.
    this._player.skillPoints = data.skillPoints ?? 0;
    if (this._skills) {
      this._skills.restoreState(Array.isArray(data.skills) ? data.skills : []);
    }

    if (this._frameworkRuntime && typeof data.framework === "string") {
      try {
        const frameworkSave = this._frameworkSaveEngine.deserialize(data.framework);
        this._frameworkRuntime.restoreFromSave(frameworkSave);
      } catch {
        this._ui.showNotification("Framework save data was invalid; loaded legacy state only.", 2500);
      }
    }

    // v5 systems
    if (this._attributes && data.attributes)   this._attributes.restoreFromSave(data.attributes);
    if (this._timeSystem && data.time)         this._timeSystem.restoreFromSave(data.time);
    if (this._crimeSystem && data.crime)       this._crimeSystem.restoreFromSave(data.crime);
    if (this._containerSystem && data.containers) this._containerSystem.restoreFromSave(data.containers);
    if (this._barterSystem && data.barter)     this._barterSystem.restoreFromSave(data.barter);
    if (this._cellManager && data.cell)        this._cellManager.restoreFromSave(data.cell);

    // v6 systems
    if (this._spellSystem && data.spells)           this._spellSystem.restoreFromSave(data.spells);
    if (this._persuasionSystem && data.persuasion)  this._persuasionSystem.restoreFromSave(data.persuasion);

    // v7 systems
    if (this._alchemySystem && data.alchemy)        this._alchemySystem.restoreFromSave(data.alchemy);

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
    this.onAfterLoad?.();

    return true;
  }

  public hasSave(): boolean {
    return localStorage.getItem(SAVE_KEY) !== null;
  }

  public deleteSave(): void {
    localStorage.removeItem(SAVE_KEY);
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
    const raw = localStorage.getItem(SAVE_KEY);
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
    } catch {
      this._ui.showNotification("Import failed: invalid JSON.", 2500);
      return false;
    }

    const data = this._parseAndValidateSaveData(parsed);
    if (!data) {
      this._ui.showNotification("Import failed: corrupt save structure.", 2500);
      return false;
    }

    if (data?.version !== SAVE_VERSION) {
      this._ui.showNotification("Import failed: incompatible save version.", 2500);
      return false;
    }

    // Write into localStorage then immediately load
    localStorage.setItem(SAVE_KEY, json);
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
    };
  }

  private _isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
  }
}
