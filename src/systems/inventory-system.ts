import { Item } from "../entities/item";

export class InventorySystem {
  public items: Item[] = [];
  public capacity: number = 300;

  public addItem(item: Item): void {
      this.items.push(item);
      console.log(`Added ${item.name} to inventory.`);
  }

  public removeItem(item: Item): void {
      const index = this.items.indexOf(item);
      if (index > -1) {
          this.items.splice(index, 1);
      }
  }

  public getTotalWeight(): number {
      return this.items.reduce((sum, item) => sum + item.weight, 0);
  }
}
