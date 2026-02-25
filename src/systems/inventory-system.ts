import { Player } from "../entities/player";
import { UIManager } from "../ui/ui-manager";

export interface Item {
  id: string;
  name: string;
  description: string;
  icon?: string;
  stackable: boolean;
  quantity: number;
  slot?: string;
  stats?: any;
}

export class InventorySystem {
  public items: Item[] = [];
  public maxCapacity: number = 20;
  public isOpen: boolean = false;
  public _player: Player;
  public _ui: UIManager;
  public _canvas: HTMLCanvasElement;

  constructor(player: Player, ui: UIManager, canvas: HTMLCanvasElement) {
    this._player = player;
    this._ui = ui;
    this._canvas = canvas;
  }

  public addItem(newItem: Item): boolean {
    // Check if stackable
    if (newItem.stackable) {
      const existingItem = this.items.find(i => i.id === newItem.id);
      if (existingItem) {
        existingItem.quantity += newItem.quantity;
        this._updateUI();
        return true;
      }
    }

    if (this.items.length >= this.maxCapacity) {
      console.log("Inventory full!");
      return false;
    }

    // Add new item
    this.items.push({ ...newItem });
    this._updateUI();
    return true;
  }

  public removeItem(itemId: string, amount: number = 1): boolean {
    const index = this.items.findIndex(i => i.id === itemId);
    if (index === -1) return false;

    const item = this.items[index];
    if (item.quantity > amount) {
      item.quantity -= amount;
    } else {
      this.items.splice(index, 1);
    }
    this._updateUI();
    return true;
  }

  public toggleInventory(): void {
    this.isOpen = !this.isOpen;

    if (this.isOpen) {
      this._ui.toggleInventory(true);
      document.exitPointerLock();
      this._player.camera.detachControl();
      this._updateUI();
    } else {
      this._ui.toggleInventory(false);
      this._canvas.requestPointerLock();
      this._player.camera.attachControl(this._canvas, true);
    }
  }

  private _updateUI(): void {
    this._ui.updateInventory(this.items);
  }
}
