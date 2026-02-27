import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Player } from "../entities/player";
import { Item, InventorySystem } from "./inventory-system";
import { EquipmentSystem, EquipSlot } from "./equipment-system";
import { UIManager } from "../ui/ui-manager";

const SAVE_KEY = "camelot_save";
const SAVE_VERSION = 1;

interface PlayerSaveData {
  position: { x: number; y: number; z: number };
  health: number;
  magicka: number;
  stamina: number;
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
}

export class SaveSystem {
  private _player: Player;
  private _inventory: InventorySystem;
  private _equipment: EquipmentSystem;
  private _ui: UIManager;

  constructor(player: Player, inventory: InventorySystem, equipment: EquipmentSystem, ui: UIManager) {
    this._player = player;
    this._inventory = inventory;
    this._equipment = equipment;
    this._ui = ui;
  }

  public save(): void {
    const equipmentEntries: EquipmentEntry[] = [];
    for (const [slot, item] of this._equipment.getEquipped()) {
      equipmentEntries.push({ slot, item });
    }

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
      },
      inventory: [...this._inventory.items],
      equipment: equipmentEntries,
    };

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

    // Restore inventory
    this._inventory.items = data.inventory;

    // Clear all equipment silently, then restore from save
    for (const slot of Array.from(this._equipment.getEquipped().keys())) {
      this._equipment.unequipSilent(slot);
    }
    for (const { slot, item } of data.equipment) {
      this._equipment.equipSilent(item, slot as EquipSlot);
    }

    // Sync UI once after all state is restored
    this._equipment.refreshUI();
    this._ui.showNotification("Game Loaded!", 2500);
    return true;
  }

  public hasSave(): boolean {
    return localStorage.getItem(SAVE_KEY) !== null;
  }

  public deleteSave(): void {
    localStorage.removeItem(SAVE_KEY);
  }
}
