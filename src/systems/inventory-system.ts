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
  /** Item weight in units (per single item). Used for encumbrance. */
  weight?: number;
  stats?: any;
  /**
   * Distinguishes individual copies of the same non-stackable item (e.g. two
   * Iron Swords with different wear).  Assigned lazily by SmithingController.
   */
  instanceId?: string;
}

export class InventorySystem {
  public items: Item[] = [];
  /** Who has the player's input (the game's PlayFocus); the inventory holds it while open. */
  public focus: { take(holder: "menu"): void; give(holder: "menu"): void } | null = null;
  public maxCapacity: number = 20;
  public isOpen: boolean = false;
  /** Fired once each time the inventory panel is opened (after pointer lock is released). */
  public onOpen: (() => void) | null = null;
  public _player: Player;
  public _ui: UIManager;
  public _canvas: HTMLCanvasElement;

  constructor(player: Player, ui: UIManager, canvas: HTMLCanvasElement) {
    this._player = player;
    this._ui = ui;
    this._canvas = canvas;
  }

  // ── Weight / encumbrance ──────────────────────────────────────────────────

  /** Sum of (item.weight ?? 0.5) × item.quantity across all items. */
  public get totalWeight(): number {
    return this.items.reduce((sum, item) => sum + (item.weight ?? 0.5) * item.quantity, 0);
  }

  /** Sync player.carryWeight from the current inventory contents. */
  private _syncCarryWeight(): void {
    this._player.carryWeight = this.totalWeight;
  }

  public addItem(newItem: Item): boolean {
    if (newItem.quantity <= 0) {
      this._ui.showNotification("Invalid item quantity.", 2000);
      return false;
    }

    // Check if stackable
    if (newItem.stackable) {
      const existingItem = this.items.find(i => i.id === newItem.id);
      if (existingItem) {
        existingItem.quantity += newItem.quantity;
        this._syncCarryWeight();
        this._updateUI();
        this._ui.showNotification(`Added ${newItem.quantity}x ${newItem.name}`);
        return true;
      }
    }

    if (this.items.length >= this.maxCapacity) {
      this._ui.showNotification("Inventory Full!", 2000);
      return false;
    }

    // Add new item
    this.items.push({ ...newItem });
    this._syncCarryWeight();
    this._updateUI();
    this._ui.showNotification(`Added ${newItem.name}`);
    return true;
  }

  /**
   * Remove `amount` units of `itemId` across every matching entry (stacks of
   * the same id can coexist).  Removes nothing and returns false when the
   * bag holds fewer than `amount` in total.
   */
  public removeQuantity(itemId: string, amount: number): boolean {
    if (amount <= 0) return false;
    const total = this.items.reduce((n, i) => (i.id === itemId ? n + i.quantity : n), 0);
    if (total < amount) return false;
    let left = amount;
    for (let i = 0; i < this.items.length && left > 0; ) {
      const entry = this.items[i];
      if (entry.id !== itemId) { i++; continue; }
      if (entry.quantity > left) {
        entry.quantity -= left;
        left = 0;
      } else {
        left -= entry.quantity;
        this.items.splice(i, 1);
      }
    }
    this._syncCarryWeight();
    this._updateUI();
    return true;
  }

  /**
   * Remove one specific item entry: the same object if it is in the bag,
   * else the entry with its instance id, else the first entry with its id.
   */
  public removeInstance(item: Item, amount: number = 1): boolean {
    if (amount <= 0) return false;
    let index = this.items.indexOf(item);
    if (index === -1 && item.instanceId) index = this.items.findIndex(i => i.instanceId === item.instanceId);
    if (index === -1) return this.removeItem(item.id, amount);
    const entry = this.items[index];
    if (entry.quantity > amount) {
      entry.quantity -= amount;
    } else {
      this.items.splice(index, 1);
    }
    this._syncCarryWeight();
    this._updateUI();
    return true;
  }

  public removeItem(itemId: string, amount: number = 1): boolean {
    if (amount <= 0) return false;

    const index = this.items.findIndex(i => i.id === itemId);
    if (index === -1) return false;

    const item = this.items[index];
    if (item.quantity > amount) {
      item.quantity -= amount;
    } else {
      this.items.splice(index, 1);
    }
    this._syncCarryWeight();
    this._updateUI();
    return true;
  }

  public toggleInventory(): void {
    this.isOpen = !this.isOpen;

    if (this.isOpen) {
      this._ui.toggleInventory(true);
      // Ensure crosshair is hidden (UI manager handles this via toggleInventory mostly, but double check)
      // Actually ui.toggleInventory calls toggleCrosshair(!visible), so it's handled.
      // But we need to make sure InteractionSystem clears text too.
      this._ui.setInteractionText("");

      if (this.focus) this.focus.take("menu");
      else {
        document.exitPointerLock();
        this._player.camera.detachControl();
      }
      this._updateUI();
      this.onOpen?.();
    } else {
      this._ui.toggleInventory(false);
      if (this.focus) this.focus.give("menu");
      else {
        this._canvas.requestPointerLock();
        this._player.camera.attachControl(this._canvas, true);
      }
    }
  }

  private _updateUI(): void {
    this._ui.updateInventory(this.items);
  }
}
