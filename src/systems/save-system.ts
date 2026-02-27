import { Player } from "../entities/player";
import { InventorySystem, Item } from "./inventory-system";
import { EquipmentSystem, EquipSlot } from "./equipment-system";
import { UIManager } from "../ui/ui-manager";

const SAVE_KEY = "camelot_save";
const SAVE_VERSION = 1;

interface PlayerSaveData {
  position: { x: number; y: number; z: number };
  health: number;
  magicka: number;
  stamina: number;
  maxHealth: number;
  maxMagicka: number;
  maxStamina: number;
  bonusDamage: number;
  bonusArmor: number;
}

interface SaveData {
  version: number;
  timestamp: number;
  player: PlayerSaveData;
  inventory: Item[];
  equipment: Record<string, Item>;
}

export class SaveSystem {
  constructor(
    private _player: Player,
    private _inventory: InventorySystem,
    private _equipment: EquipmentSystem,
    private _ui: UIManager
  ) {}

  public save(): void {
    const pos = this._player.camera.position;
    const equipped: Record<string, Item> = {};
    for (const [slot, item] of this._equipment.getEquipped()) {
      equipped[slot] = item;
    }

    const data: SaveData = {
      version: SAVE_VERSION,
      timestamp: Date.now(),
      player: {
        position: { x: pos.x, y: pos.y, z: pos.z },
        health: this._player.health,
        magicka: this._player.magicka,
        stamina: this._player.stamina,
        maxHealth: this._player.maxHealth,
        maxMagicka: this._player.maxMagicka,
        maxStamina: this._player.maxStamina,
        bonusDamage: this._player.bonusDamage,
        bonusArmor: this._player.bonusArmor,
      },
      inventory: [...this._inventory.items],
      equipment: equipped,
    };

    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    this._ui.showNotification("Game Saved!", 2000);
  }

  public load(): void {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      this._ui.showNotification("No save file found.", 2000);
      return;
    }

    try {
      const data: SaveData = JSON.parse(raw);
      if (data.version !== SAVE_VERSION) {
        this._ui.showNotification("Save file incompatible.", 2000);
        return;
      }

      // Restore player position and stats
      const p = data.player;
      this._player.camera.position.set(p.position.x, p.position.y, p.position.z);
      this._player.health = p.health;
      this._player.magicka = p.magicka;
      this._player.stamina = p.stamina;
      this._player.maxHealth = p.maxHealth;
      this._player.maxMagicka = p.maxMagicka;
      this._player.maxStamina = p.maxStamina;
      this._player.bonusDamage = p.bonusDamage;
      this._player.bonusArmor = p.bonusArmor;

      // Restore inventory
      this._inventory.items = [...data.inventory];

      // Restore equipment slots without re-applying stats (stats are restored above)
      const slots = new Map<EquipSlot, Item>();
      for (const [slot, item] of Object.entries(data.equipment)) {
        slots.set(slot as EquipSlot, item);
      }
      this._equipment.restoreFromSave(slots);

      this._ui.showNotification("Game Loaded!", 2000);
    } catch {
      this._ui.showNotification("Failed to load save.", 2000);
    }
  }

  public hasSave(): boolean {
    return localStorage.getItem(SAVE_KEY) !== null;
  }
}
