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

const SAVE_KEY = "camelot_save";
const SAVE_VERSION = 5;

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

    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    this._ui.showNotification("Game Saved!", 2500);
  }

  public load(): boolean {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      this._ui.showNotification("No save file found.", 2500);
      return false;
    }

    let data: SaveData;
    try {
      data = JSON.parse(raw);
    } catch {
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
  }
}
