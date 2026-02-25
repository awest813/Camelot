import { Color3 } from "@babylonjs/core/Maths/math.color";

export interface Item {
  id: string;
  name: string;
  type: string; // "Consumable", "Weapon", etc.
  description: string;
  color: string; // Color string for UI (e.g., "red", "blue")
}

export class InventorySystem {
  public items: Item[] = [];
  public maxItems: number = 20;

  constructor() {}

  public addItem(item: Item): boolean {
    if (this.items.length < this.maxItems) {
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
}
