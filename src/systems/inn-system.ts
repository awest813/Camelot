/**
 * InnSystem — manages inn rooms, bar menus (food/drink), and room-rental
 * transactions at player-visited inns.
 *
 * Responsibilities:
 *   - Register named inn definitions (room price, menu items, operating hours).
 *   - Validate open/closed status before any purchase.
 *   - Process room-rental and menu-item purchases, deducting gold from the
 *     caller-supplied `playerGold` value and returning the updated balance.
 *   - Fire optional callbacks so external systems (UI, rest mechanic, audio)
 *     can react without coupling to this system directly.
 *   - Persist and restore gold-earned totals per inn.
 *
 * Wire-up example (game.ts):
 * ```ts
 * this.innSystem = new InnSystem();
 * this.innSystem.registerInn({
 *   id: "inn_broken_lantern",
 *   name: "The Broken Lantern",
 *   factionId: "town",
 *   roomPrice: 10,
 *   openHour: 6,
 *   closeHour: 24,
 *   roomCount: 4,
 *   menuItems: [
 *     { id: "ale", name: "Ale", description: "A frothy mug of ale.", price: 2, type: "drink", itemId: "ale" },
 *     { id: "stew", name: "Hot Stew", description: "A hearty bowl.", price: 4, type: "food", itemId: "stew" },
 *   ],
 * });
 *
 * this.innSystem.onRentRoom = (innId, price) => {
 *   this.ui.showNotification(`Room rented for ${price}g. Rest well.`, 3000);
 *   this.waitSystem.rest(8);
 * };
 *
 * this.innSystem.onPurchaseMenuItem = (innId, item) => {
 *   if (item.itemId) this.inventorySystem.addItem({ id: item.itemId, name: item.name, quantity: 1 });
 *   this.ui.showNotification(`You bought a ${item.name} for ${item.price}g.`, 2000);
 * };
 * ```
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export type InnMenuItemType = "food" | "drink";

export interface InnMenuItem {
  /** Unique identifier within the inn's menu (e.g. "ale", "stew"). */
  id: string;
  name: string;
  description: string;
  /** Gold cost. */
  price: number;
  type: InnMenuItemType;
  /**
   * Optional inventory item ID to add to the player's inventory on purchase.
   * When absent the item is consumed on the spot (e.g. a drink at the bar).
   */
  itemId?: string;
}

export interface InnDef {
  id: string;
  name: string;
  factionId?: string;
  /** Gold cost for one room-night. */
  roomPrice: number;
  /** Hour the inn opens (0-23, inclusive). */
  openHour: number;
  /** Hour the inn closes (0-23, exclusive — 24 means "open all night"). */
  closeHour: number;
  /** Number of rooms available simultaneously (for capacity tracking). */
  roomCount: number;
  /** Food and drink items sold at the bar. */
  menuItems: InnMenuItem[];
}

export interface InnRentResult {
  success: boolean;
  /** Actual cost charged. 0 on failure. */
  cost: number;
  /** Player gold after the transaction. Unchanged on failure. */
  newGold: number;
  /** Human-readable reason for failure, if any. */
  reason?: string;
}

export interface InnPurchaseResult {
  success: boolean;
  cost: number;
  newGold: number;
  item: InnMenuItem | null;
  reason?: string;
}

export interface InnSaveState {
  inns: Array<{ id: string; goldEarned: number }>;
}

// ── System ────────────────────────────────────────────────────────────────────

export class InnSystem {
  private readonly _inns: Map<string, InnDef> = new Map();
  /** Gold earned per inn since last load (persisted). */
  private readonly _goldEarned: Map<string, number> = new Map();

  // ── Callbacks ───────────────────────────────────────────────────────────────

  /**
   * Fired after a successful room rental.
   * @param innId  The inn identifier.
   * @param price  Gold that was charged.
   */
  public onRentRoom: ((innId: string, price: number) => void) | null = null;

  /**
   * Fired after a successful food or drink purchase.
   * @param innId  The inn identifier.
   * @param item   The purchased menu item.
   */
  public onPurchaseMenuItem: ((innId: string, item: InnMenuItem) => void) | null = null;

  // ── Registration ────────────────────────────────────────────────────────────

  /** Register a new inn definition.  Replaces any previous definition with the same id. */
  public registerInn(def: InnDef): void {
    this._inns.set(def.id, { ...def, menuItems: def.menuItems.map((m) => ({ ...m })) });
    if (!this._goldEarned.has(def.id)) {
      this._goldEarned.set(def.id, 0);
    }
  }

  // ── Accessors ───────────────────────────────────────────────────────────────

  /** Returns the inn definition for `id`, or `undefined` if not registered. */
  public getInn(id: string): Readonly<InnDef> | undefined {
    return this._inns.get(id);
  }

  /** All registered inn IDs. */
  public get registeredIds(): string[] {
    return Array.from(this._inns.keys());
  }

  /**
   * Returns the menu items for an inn, optionally filtered by type.
   * Returns an empty array if the inn is not registered.
   */
  public getMenuItems(innId: string, type?: InnMenuItemType): InnMenuItem[] {
    const inn = this._inns.get(innId);
    if (!inn) return [];
    return type ? inn.menuItems.filter((m) => m.type === type) : [...inn.menuItems];
  }

  /** Total gold earned by `innId` since registration (or last save restore). */
  public getGoldEarned(innId: string): number {
    return this._goldEarned.get(innId) ?? 0;
  }

  // ── Hours ───────────────────────────────────────────────────────────────────

  /**
   * Returns `true` when the inn is currently open.
   * `closeHour` of 24 is treated as "open through the end of day (hours openHour–23)".
   * Supports midnight-crossing schedules (e.g. `openHour: 20, closeHour: 6`).
   */
  public isOpen(innId: string, currentHour: number): boolean {
    const inn = this._inns.get(innId);
    if (!inn) return false;
    const hour = Math.floor(currentHour);
    if (inn.closeHour === 24) return hour >= inn.openHour;
    // Midnight-crossing: open spans two calendar days (e.g. 20→6)
    if (inn.closeHour < inn.openHour) {
      return hour >= inn.openHour || hour < inn.closeHour;
    }
    return hour >= inn.openHour && hour < inn.closeHour;
  }

  // ── Transactions ────────────────────────────────────────────────────────────

  /**
   * Attempt to rent a room at the inn.
   *
   * Fails when:
   *   - The inn is not registered.
   *   - The current hour is outside operating hours.
   *   - `playerGold` is less than the room price.
   */
  public rentRoom(innId: string, currentHour: number, playerGold: number): InnRentResult {
    const inn = this._inns.get(innId);
    if (!inn) {
      return { success: false, cost: 0, newGold: playerGold, reason: "Inn not found." };
    }
    if (!this.isOpen(innId, currentHour)) {
      return { success: false, cost: 0, newGold: playerGold, reason: `${inn.name} is closed at this hour.` };
    }
    if (playerGold < inn.roomPrice) {
      return {
        success: false,
        cost: 0,
        newGold: playerGold,
        reason: `Not enough gold. Need ${inn.roomPrice}g.`,
      };
    }

    const newGold = playerGold - inn.roomPrice;
    this._goldEarned.set(innId, (this._goldEarned.get(innId) ?? 0) + inn.roomPrice);
    this.onRentRoom?.(innId, inn.roomPrice);
    return { success: true, cost: inn.roomPrice, newGold };
  }

  /**
   * Attempt to purchase a menu item (food or drink) from the inn bar.
   *
   * Fails when:
   *   - The inn or item is not found.
   *   - The inn is closed at `currentHour`.
   *   - `playerGold` is insufficient.
   */
  public purchaseMenuItem(
    innId: string,
    menuItemId: string,
    currentHour: number,
    playerGold: number,
  ): InnPurchaseResult {
    const inn = this._inns.get(innId);
    if (!inn) {
      return { success: false, cost: 0, newGold: playerGold, item: null, reason: "Inn not found." };
    }
    if (!this.isOpen(innId, currentHour)) {
      return { success: false, cost: 0, newGold: playerGold, item: null, reason: `${inn.name} is closed at this hour.` };
    }
    const item = inn.menuItems.find((m) => m.id === menuItemId);
    if (!item) {
      return { success: false, cost: 0, newGold: playerGold, item: null, reason: "Item not on menu." };
    }
    if (playerGold < item.price) {
      return {
        success: false,
        cost: 0,
        newGold: playerGold,
        item,
        reason: `Not enough gold. Need ${item.price}g.`,
      };
    }

    const newGold = playerGold - item.price;
    this._goldEarned.set(innId, (this._goldEarned.get(innId) ?? 0) + item.price);
    this.onPurchaseMenuItem?.(innId, item);
    return { success: true, cost: item.price, newGold, item };
  }

  // ── Persistence ─────────────────────────────────────────────────────────────

  public getSaveState(): InnSaveState {
    return {
      inns: Array.from(this._inns.keys()).map((id) => ({
        id,
        goldEarned: this._goldEarned.get(id) ?? 0,
      })),
    };
  }

  public restoreFromSave(state: InnSaveState): void {
    if (!state || !Array.isArray(state.inns)) return;
    for (const saved of state.inns) {
      if (this._inns.has(saved.id) && typeof saved.goldEarned === "number" && saved.goldEarned >= 0) {
        this._goldEarned.set(saved.id, Math.round(saved.goldEarned));
      }
    }
  }
}
