/**
 * MerchantRestockSystem — Oblivion-style timed merchant inventory restocking.
 *
 * In Oblivion, merchant inventories refresh every 72–120 in-game hours.
 * This system tracks per-merchant restock schedules using game-time (minutes)
 * from the TimeSystem.  When a merchant's restock window elapses their
 * inventory and gold are reset to a registered template snapshot.
 *
 * Key design decisions:
 *   - The template inventory and gold are captured at registration time.
 *     Items sold *to* the player are effectively replenished after each cycle.
 *   - Only BarterSystem's live merchant record is mutated; no direct dependency
 *     on other systems is needed.
 *   - Works transparently with BarterSystem — merchants registered here must
 *     also be registered in BarterSystem.
 *
 * Wire-up example (game.ts):
 * ```ts
 * this.merchantRestockSystem = new MerchantRestockSystem();
 * this.merchantRestockSystem.registerMerchant(
 *   "merchant_01",
 *   [...initialInventory],
 *   500,
 *   72,   // restock every 72 game-hours
 * );
 *
 * // In the game-loop update (or hooked to TimeSystem.advanceHours):
 * this.merchantRestockSystem.update(this.timeSystem.gameTime, this.barterSystem);
 *
 * this.merchantRestockSystem.onRestock = (merchantId) => {
 *   this.ui.showNotification(`${merchantId} has restocked their wares.`, 2000);
 * };
 * ```
 */

import type { Item } from "./inventory-system";
import type { BarterSystem } from "./barter-system";

// ── Constants ──────────────────────────────────────────────────────────────────

/** Default restock interval in game-hours. */
export const DEFAULT_RESTOCK_HOURS = 72;
/** Minimum allowed restock interval. */
export const MIN_RESTOCK_HOURS = 1;
/** Maximum allowed restock interval. */
export const MAX_RESTOCK_HOURS = 720;

// ── Types ──────────────────────────────────────────────────────────────────────

export interface RestockEntry {
  merchantId: string;
  /** Deep-copied snapshot of the inventory to restore on each restock. */
  templateInventory: Item[];
  /** Gold to reset to on each restock. */
  templateGold: number;
  /** Restock interval in game-hours. */
  intervalHours: number;
  /**
   * Game time (minutes) when the next restock is due.
   * Set to `currentGameTime + intervalHours * 60` on registration and after
   * each restock fires.
   */
  nextRestockAt: number;
}

export interface MerchantRestockSaveState {
  entries: Array<{
    merchantId: string;
    intervalHours: number;
    nextRestockAt: number;
  }>;
}

// ── System ────────────────────────────────────────────────────────────────────

export class MerchantRestockSystem {
  private _entries: Map<string, RestockEntry> = new Map();

  /**
   * Fired after a merchant is restocked.
   * @param merchantId  The id of the merchant that just restocked.
   */
  public onRestock: ((merchantId: string) => void) | null = null;

  // ── Registration ───────────────────────────────────────────────────────────

  /**
   * Register a merchant for periodic restocking.
   *
   * @param merchantId         Merchant identifier (must match BarterSystem id).
   * @param templateInventory  Starting inventory to restore on each restock.
   * @param templateGold       Starting gold to restore on each restock.
   * @param intervalHours      Game-hours between restocks.
   * @param currentGameTimeMinutes  Current game time (for the first due-at calc).
   */
  public registerMerchant(
    merchantId: string,
    templateInventory: Item[],
    templateGold: number,
    intervalHours: number = DEFAULT_RESTOCK_HOURS,
    currentGameTimeMinutes: number = 0,
  ): void {
    const clamped = Math.max(MIN_RESTOCK_HOURS, Math.min(MAX_RESTOCK_HOURS, Math.round(intervalHours)));
    this._entries.set(merchantId, {
      merchantId,
      templateInventory: templateInventory.map((i) => ({ ...i })),
      templateGold: Math.max(0, Math.round(templateGold)),
      intervalHours: clamped,
      nextRestockAt: currentGameTimeMinutes + clamped * 60,
    });
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Returns the restock entry for `merchantId`, or `undefined`.
   */
  public getEntry(merchantId: string): Readonly<RestockEntry> | undefined {
    return this._entries.get(merchantId);
  }

  /**
   * Returns all registered restock entries.
   */
  public get entries(): ReadonlyArray<Readonly<RestockEntry>> {
    return Array.from(this._entries.values());
  }

  /**
   * Check all registered merchants and restock any whose interval has elapsed.
   *
   * This must be called regularly — either every game-loop tick (cheap since
   * it is purely time-comparison arithmetic) or at minimum whenever the game
   * clock advances (e.g. after wait/rest or fast-travel).
   *
   * @param currentGameTimeMinutes  Current game time from `TimeSystem.gameTime`.
   * @param barterSystem            Live BarterSystem to update merchant records.
   */
  public update(currentGameTimeMinutes: number, barterSystem: BarterSystem): void {
    for (const entry of this._entries.values()) {
      if (currentGameTimeMinutes < entry.nextRestockAt) continue;

      // Advance the next restock deadline (handle multiple elapsed cycles)
      while (entry.nextRestockAt <= currentGameTimeMinutes) {
        entry.nextRestockAt += entry.intervalHours * 60;
      }

      // Mutate the live merchant record inside BarterSystem
      this._restockMerchant(entry, barterSystem);
      this.onRestock?.(entry.merchantId);
    }
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  /**
   * Only the interval and next-restock deadline need persisting.
   * Template inventory/gold never change and are re-supplied at registration.
   */
  public getSaveState(): MerchantRestockSaveState {
    return {
      entries: Array.from(this._entries.values()).map((e) => ({
        merchantId:    e.merchantId,
        intervalHours: e.intervalHours,
        nextRestockAt: e.nextRestockAt,
      })),
    };
  }

  public restoreFromSave(state: MerchantRestockSaveState): void {
    if (!state || !Array.isArray(state.entries)) return;
    for (const saved of state.entries) {
      const entry = this._entries.get(saved.merchantId);
      if (!entry) continue; // only restore registered merchants
      if (typeof saved.intervalHours === "number" && Number.isFinite(saved.intervalHours)) {
        entry.intervalHours = Math.max(MIN_RESTOCK_HOURS, Math.min(MAX_RESTOCK_HOURS, Math.round(saved.intervalHours)));
      }
      if (typeof saved.nextRestockAt === "number" && Number.isFinite(saved.nextRestockAt)) {
        entry.nextRestockAt = saved.nextRestockAt;
      }
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Reset the BarterSystem's merchant record to the template snapshot.
   * Accesses the internal `_merchants` map via the public `getMerchant` accessor.
   * If the accessor is not available the restock silently skips rather than
   * crashing — BarterSystem will show the stale inventory until next session.
   */
  private _restockMerchant(entry: RestockEntry, barterSystem: BarterSystem): void {
    const merchant = barterSystem.getMerchant(entry.merchantId);
    if (!merchant) return;
    merchant.inventory = entry.templateInventory.map((i) => ({ ...i }));
    merchant.gold = entry.templateGold;
  }
}
