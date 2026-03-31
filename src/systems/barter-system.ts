import { Item } from "./inventory-system";
import { InventorySystem } from "./inventory-system";
import { UIManager } from "../ui/ui-manager";

export interface MerchantDef {
  id: string;
  name: string;
  factionId: string;
  inventory: Item[];
  /** Gold the merchant has available to buy items from the player. */
  gold: number;
  /** Price multiplier applied on top of the base item value. >1 = expensive. */
  priceMultiplier?: number;
  isOpen: boolean;
  openHour: number;
  closeHour: number;
}

export interface BarterSaveState {
  merchants: Array<{ id: string; inventory: Item[]; gold: number }>;
  playerGold: number;
  merchantRapport?: Record<string, number>;
}

/**
 * Manages merchant inventories, gold, and buy/sell transactions.
 *
 * Price model:
 *   Buy price  = baseValue × priceMultiplier × barterBuyFactor
 *   Sell price = baseValue × barterSellFactor
 *
 *   barterBuyFactor  ∈ [1.0, 1.4] — decreases as barterSkill increases.
 *   barterSellFactor ∈ [0.3, 0.55] — increases as barterSkill increases.
 *
 * Usage:
 *   1. Register merchants with `registerMerchant()`.
 *   2. `openBarter(id, currentHour)` — validate merchant is open.
 *   3. `buyItem(id, itemId)` / `sellItem(id, itemId)` — transfer items.
 *   4. `closeBarter()` — clean up active session.
 */
export class BarterSystem {
  private _inventory: InventorySystem;
  private _ui: UIManager;

  private _merchants: Map<string, MerchantDef> = new Map();
  public activeMerchantId: string | null = null;

  /** Player's barter skill (1-100).  Higher = better buy/sell ratios. */
  public barterSkill: number = 20;

  /** Player's current gold. */
  public playerGold: number = 100;

  /** Fired after each transaction. */
  public onTransaction: ((type: "buy" | "sell", itemName: string, goldAmount: number) => void) | null = null;

  /** Merchant-specific trust/loyalty from repeated business. */
  private _merchantRapport: Map<string, number> = new Map();

  constructor(inventory: InventorySystem, ui: UIManager) {
    this._inventory = inventory;
    this._ui        = ui;
  }

  // ── Registration ───────────────────────────────────────────────────────────

  public registerMerchant(def: MerchantDef): void {
    this._merchants.set(def.id, { ...def, inventory: [...def.inventory] });
    if (!this._merchantRapport.has(def.id)) this._merchantRapport.set(def.id, 0);
  }

  // ── Pricing ────────────────────────────────────────────────────────────────

  /**
   * Price the player pays to buy one unit of `item` from `merchantId`.
   * Improves (decreases) as `barterSkill` increases.
   */
  public getBuyPrice(item: Item, merchantId: string): number {
    const merchant = this._merchants.get(merchantId);
    const priceMultiplier = merchant?.priceMultiplier ?? 1.0;
    // Factor: 1.4 at skill 0 → 1.0 at skill 100
    const barterFactor = 1.4 - this.barterSkill / 250;
    const rapportFactor = 1 - this._getRapport(merchantId) * 0.003;
    const baseValue = item.stats?.value ?? 10;
    return Math.max(1, Math.round(baseValue * priceMultiplier * barterFactor * rapportFactor));
  }

  /**
   * Price the player receives when selling one unit of `item`.
   * Improves (increases) as `barterSkill` increases.
   */
  public getSellPrice(item: Item, merchantId?: string): number {
    // Factor: 0.30 at skill 0 → 0.55 at skill 100
    const barterFactor = 0.30 + this.barterSkill / 400;
    const rapportFactor = merchantId ? (1 + this._getRapport(merchantId) * 0.0015) : 1;
    const demandFactor = merchantId ? this._getDemandFactor(merchantId, item.id) : 1;
    const baseValue = item.stats?.value ?? 10;
    return Math.max(1, Math.round(baseValue * barterFactor * rapportFactor * demandFactor));
  }

  // ── Session management ─────────────────────────────────────────────────────

  /**
   * Open a barter session.  Validates the merchant exists and is open.
   * @returns false if the merchant is unavailable.
   */
  public openBarter(merchantId: string, currentHour: number): boolean {
    const merchant = this._merchants.get(merchantId);
    if (!merchant) return false;

    if (!merchant.isOpen) {
      this._ui.showNotification(`${merchant.name} is closed`, 2000);
      return false;
    }
    if (currentHour < merchant.openHour || currentHour >= merchant.closeHour) {
      this._ui.showNotification(`${merchant.name} is closed at this hour`, 2000);
      return false;
    }

    this.activeMerchantId = merchantId;
    return true;
  }

  public closeBarter(): void {
    this.activeMerchantId = null;
  }

  // ── Transactions ───────────────────────────────────────────────────────────

  /**
   * Buy one unit of `itemId` from the merchant.
   * @returns false if insufficient gold or item not in stock.
   */
  public buyItem(merchantId: string, itemId: string): boolean {
    const merchant = this._merchants.get(merchantId);
    if (!merchant) return false;

    const idx = merchant.inventory.findIndex((i) => i.id === itemId);
    if (idx === -1) return false;

    const item  = merchant.inventory[idx];
    const price = this.getBuyPrice(item, merchantId);

    if (this.playerGold < price) {
      this._ui.showNotification(`Not enough gold! Need ${price}g`, 2000);
      return false;
    }

    const added = this._inventory.addItem({ ...item, quantity: 1 });
    if (!added) return false;

    this.playerGold -= price;
    merchant.gold += price;

    if (item.quantity > 1) {
      merchant.inventory[idx] = { ...item, quantity: item.quantity - 1 };
    } else {
      merchant.inventory.splice(idx, 1);
    }

    const verify = this._inventory.items.find((i) => i.id === item.id);
    if (!verify || verify.quantity < 1) {
      this._inventory.removeItem(item.id, 1);
      this.playerGold += price;
      merchant.gold -= price;
      if (item.quantity > 1) {
        merchant.inventory[idx] = { ...item, quantity: item.quantity };
      } else {
        merchant.inventory.splice(idx, 0, { ...item, quantity: 1 });
      }
      this._ui.showNotification("Inventory full — purchase cancelled.", 2200);
      return false;
    }

    this.onTransaction?.("buy", item.name, price);
    this._adjustRapport(merchantId, 1);
    this._ui.showNotification(`Bought ${item.name} for ${price}g`, 1800);
    return true;
  }

  /**
   * Sell one unit of `itemId` from the player's inventory to the merchant.
   * @returns false if the merchant can't afford it or the item isn't in inventory.
   */
  public sellItem(merchantId: string, itemId: string): boolean {
    const merchant = this._merchants.get(merchantId);
    if (!merchant) return false;

    const inventoryItem = this._inventory.items.find((i) => i.id === itemId);
    if (!inventoryItem) return false;

    const sellPrice = this.getSellPrice(inventoryItem, merchantId);
    if (merchant.gold < sellPrice) {
      this._ui.showNotification(`Merchant can't afford that (${sellPrice}g)`, 2000);
      return false;
    }

    const removed = this._inventory.removeItem(itemId, 1);
    if (!removed) return false;

    this.playerGold  += sellPrice;
    merchant.gold    -= sellPrice;

    // Return item to merchant stock
    const existing = merchant.inventory.find((i) => i.id === itemId);
    if (existing && inventoryItem.stackable) {
      existing.quantity += 1;
    } else {
      merchant.inventory.push({ ...inventoryItem, quantity: 1 });
    }

    this.onTransaction?.("sell", inventoryItem.name, sellPrice);
    this._adjustRapport(merchantId, 1);
    this._ui.showNotification(`Sold ${inventoryItem.name} for ${sellPrice}g`, 1800);
    return true;
  }

  // ── Accessors ──────────────────────────────────────────────────────────────

  public get merchants(): Map<string, MerchantDef> {
    return this._merchants;
  }

  public getMerchant(id: string): MerchantDef | undefined {
    return this._merchants.get(id);
  }

  public getMerchantRapport(merchantId: string): number {
    return this._getRapport(merchantId);
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  public getSaveState(): BarterSaveState {
    const merchants: BarterSaveState["merchants"] = [];
    for (const m of this._merchants.values()) {
      merchants.push({ id: m.id, inventory: [...m.inventory], gold: m.gold });
    }
    return {
      merchants,
      playerGold: this.playerGold,
      merchantRapport: Object.fromEntries(this._merchantRapport),
    };
  }

  public restoreFromSave(state: BarterSaveState): void {
    for (const saved of state?.merchants ?? []) {
      const merchant = this._merchants.get(saved.id);
      if (merchant) {
        merchant.inventory = [...saved.inventory];
        merchant.gold      = saved.gold;
      }
    }
    if (typeof state?.playerGold === "number") {
      this.playerGold = state.playerGold;
    }

    if (state?.merchantRapport) {
      for (const [merchantId, value] of Object.entries(state.merchantRapport)) {
        if (this._merchants.has(merchantId)) {
          this._merchantRapport.set(merchantId, this._clampRapport(value));
        }
      }
    }
  }

  private _adjustRapport(merchantId: string, delta: number): void {
    this._merchantRapport.set(merchantId, this._clampRapport(this._getRapport(merchantId) + delta));
  }

  private _getRapport(merchantId: string): number {
    return this._merchantRapport.get(merchantId) ?? 0;
  }

  private _clampRapport(value: number): number {
    return Math.max(0, Math.min(25, Math.round(value)));
  }

  private _getDemandFactor(merchantId: string, itemId: string): number {
    const merchant = this._merchants.get(merchantId);
    if (!merchant) return 1;

    const totalInStock = merchant.inventory
      .filter((item) => item.id === itemId)
      .reduce((acc, item) => acc + Math.max(1, item.quantity || 1), 0);

    return Math.max(0.55, Math.min(1.05, 1 - totalInStock * 0.05));
  }
}
