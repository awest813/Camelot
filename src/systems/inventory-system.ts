import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Player } from "../entities/player";

export interface Item {
  id: string;
  name: string;
  type: string; // "Consumable", "Weapon", etc.
  description: string;
  color: string; // Color string for UI (e.g., "red", "blue")
  slot?: 'mainHand' | 'offHand';
  stats?: {
      damage?: number;
      armor?: number;
  };
}

export class InventorySystem {
  public static readonly CAPACITY: number = 20;
  public items: Item[] = [];
  private _player: Player;

  constructor(player: Player) {
      this._player = player;
  }

  public addItem(item: Item): boolean {
    if (this.items.length < InventorySystem.CAPACITY) {
      this.items.push(item);
      console.log(`Added ${item.name} to inventory.`);
      return true;
    }
    console.log("Inventory full!");
    return false;
  }

  public removeItem(item: Item): void {
    const index = this.items.indexOf(item);
    if (index > -1) {
      this.items.splice(index, 1);
      console.log(`Removed ${item.name} from inventory.`);
    }
  }

  public hasItem(itemId: string): boolean {
    return this.items.some(i => i.id === itemId);
  }

  public useItem(item: Item): void {
      console.log(`Using ${item.name}...`);
      if (item.slot === 'mainHand') {
          this._player.equip(item);
      } else if (item.type === "Consumable") {
          // Placeholder for logic (e.g., heal player)
          console.log(`Consumed ${item.name}. Restored health.`);
          this.removeItem(item);
      } else {
          console.log(`Equipped ${item.name} (No slot defined).`);
      }
  }
}
