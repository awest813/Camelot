/**
 * ShopSystem — categorises and registers named shops (general store, weapons
 * dealer, armorer, alchemist, inn bar) so the rest of the game can discover
 * them by type and check whether they are currently open.
 *
 * Each shop definition is linked to a `merchantId` in the BarterSystem so
 * the caller can open a barter session once a shop is confirmed to be open.
 *
 * Wire-up example (game.ts):
 * ```ts
 * this.shopSystem = new ShopSystem();
 * this.shopSystem.registerShop({
 *   id: "shop_iron_forge",
 *   name: "The Iron Forge",
 *   type: "weapons",
 *   merchantId: "merchant_iron_forge",
 *   factionId: "merchants_guild",
 *   openHour: 8,
 *   closeHour: 20,
 *   description: "Fine weapons and repair services.",
 * });
 *
 * // Open the shop if it's daytime
 * const hour = this.timeSystem.currentHour;
 * const weaponsShops = this.shopSystem.getShopsByType("weapons");
 * for (const shop of weaponsShops) {
 *   if (this.shopSystem.isOpen(shop.id, hour)) {
 *     this.barterSystem.openBarter(shop.merchantId, hour);
 *   }
 * }
 * ```
 */

// ── Types ──────────────────────────────────────────────────────────────────────

/**
 * Broad category of a shop.
 *   - `general`   — Mixed goods (food, tools, common supplies).
 *   - `weapons`   — Melee and ranged weapons.
 *   - `armor`     — Protective gear.
 *   - `alchemist` — Potions, ingredients, alchemical tools.
 *   - `inn_bar`   — Bar within an inn (drinks, food).
 */
export type ShopType = "general" | "weapons" | "armor" | "alchemist" | "inn_bar";

export interface ShopDef {
  /** Unique shop identifier. */
  id: string;
  /** Display name shown in the UI. */
  name: string;
  /** Broad category used for discovery by type. */
  type: ShopType;
  /** Merchant ID in the BarterSystem. */
  merchantId: string;
  factionId?: string;
  /** Hour the shop opens (0–23, inclusive). */
  openHour: number;
  /**
   * Hour the shop closes (0–23, exclusive).
   * Use 24 to indicate "open until end of day / midnight".
   */
  closeHour: number;
  description?: string;
}

// ── System ────────────────────────────────────────────────────────────────────

export class ShopSystem {
  private readonly _shops: Map<string, ShopDef> = new Map();

  // ── Registration ────────────────────────────────────────────────────────────

  /** Register a shop definition.  Replaces any previous definition with the same id. */
  public registerShop(def: ShopDef): void {
    this._shops.set(def.id, { ...def });
  }

  /** Register multiple shop definitions at once. */
  public registerAll(defs: ShopDef[]): void {
    for (const def of defs) {
      this.registerShop(def);
    }
  }

  // ── Accessors ───────────────────────────────────────────────────────────────

  /** Returns the shop definition for `id`, or `undefined` if not registered. */
  public getShop(id: string): Readonly<ShopDef> | undefined {
    return this._shops.get(id);
  }

  /** All registered shop IDs. */
  public get registeredIds(): string[] {
    return Array.from(this._shops.keys());
  }

  /** Returns all registered shop definitions. */
  public getAllShops(): ReadonlyArray<Readonly<ShopDef>> {
    return Array.from(this._shops.values());
  }

  /**
   * Returns all shops of the given `type`.
   * Returns an empty array when no shops of that type are registered.
   */
  public getShopsByType(type: ShopType): ReadonlyArray<Readonly<ShopDef>> {
    return Array.from(this._shops.values()).filter((s) => s.type === type);
  }

  // ── Hours ───────────────────────────────────────────────────────────────────

  /**
   * Returns `true` when the shop is currently open.
   * `closeHour` of 24 is treated as "open through the end of day (hours openHour–23)".
   * Supports midnight-crossing schedules (e.g. `openHour: 20, closeHour: 4`).
   * Returns `false` for an unregistered shop id.
   */
  public isOpen(shopId: string, currentHour: number): boolean {
    const shop = this._shops.get(shopId);
    if (!shop) return false;
    const hour = Math.floor(currentHour);
    if (shop.closeHour === 24) return hour >= shop.openHour;
    // Midnight-crossing: open spans two calendar days (e.g. 20→4)
    if (shop.closeHour < shop.openHour) {
      return hour >= shop.openHour || hour < shop.closeHour;
    }
    return hour >= shop.openHour && hour < shop.closeHour;
  }

  /**
   * Returns all shops of `type` that are currently open at `currentHour`.
   */
  public getOpenShopsByType(type: ShopType, currentHour: number): ReadonlyArray<Readonly<ShopDef>> {
    return this.getShopsByType(type).filter((s) => this.isOpen(s.id, currentHour));
  }
}
