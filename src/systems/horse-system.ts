/**
 * HorseSystem — Mount system for Camelot.
 *
 * Manages horse registration, mounting/dismounting, stable NPCs,
 * and per-horse saddlebag inventories.
 *
 * Headless: no BabylonJS dependencies — integrates via callbacks.
 * SAVE_VERSION: 19
 */

import type { Item } from "./inventory-system";

/** Maximum number of items a saddlebag can hold (per horse). */
const DEFAULT_SADDLEBAG_CAPACITY = 10;

/** Speed multiplier applied to the player while mounted. */
const DEFAULT_MOUNT_SPEED = 2.0;

export interface Horse {
  /** Unique identifier. */
  id: string;
  /** Display name (e.g. "Shadowmere"). */
  name: string;
  /** Speed multiplier while mounted (default 2.0). */
  speed: number;
  /** Max saddlebag item slots. */
  saddlebagCapacity: number;
  /** True when registered as owned by the player. */
  isOwned: boolean;
  /** World-position tag for stable bookkeeping (not persisted as Vector3). */
  stableId: string | null;
}

export interface StableNPC {
  /** Unique NPC name. */
  npcName: string;
  /** Horse IDs offered by this stable. */
  availableHorseIds: string[];
  /** Gold cost to purchase each horse (indexed by horse id). */
  prices: Record<string, number>;
}

export interface HorseSaveState {
  horses: Array<{
    id: string;
    name: string;
    speed: number;
    saddlebagCapacity: number;
    isOwned: boolean;
    stableId: string | null;
    saddlebag: Item[];
  }>;
  currentHorseId: string | null;
  isMounted: boolean;
}

export class HorseSystem {
  private _horses: Map<string, Horse> = new Map();
  private _saddlebags: Map<string, Item[]> = new Map();
  private _stableNpcs: Map<string, StableNPC> = new Map();
  private _currentHorseId: string | null = null;
  private _isMounted: boolean = false;

  /**
   * Fired when the player mounts a horse.
   * Receives the horse and the speed multiplier to apply.
   */
  public onMount: ((horse: Horse, speedMultiplier: number) => void) | null = null;

  /**
   * Fired when the player dismounts.
   * Receives the horse that was dismounted.
   */
  public onDismount: ((horse: Horse) => void) | null = null;

  /**
   * Fired when a horse is purchased from a stable NPC.
   */
  public onHorsePurchased: ((horse: Horse) => void) | null = null;

  // ── Horse registration ────────────────────────────────────────────────────

  /**
   * Register a horse definition.
   * Does not make the horse available for mounting until owned or purchased.
   */
  public registerHorse(opts: {
    id: string;
    name: string;
    speed?: number;
    saddlebagCapacity?: number;
    stableId?: string;
  }): void {
    const horse: Horse = {
      id: opts.id,
      name: opts.name,
      speed: opts.speed ?? DEFAULT_MOUNT_SPEED,
      saddlebagCapacity: opts.saddlebagCapacity ?? DEFAULT_SADDLEBAG_CAPACITY,
      isOwned: false,
      stableId: opts.stableId ?? null,
    };
    this._horses.set(opts.id, horse);
    this._saddlebags.set(opts.id, []);
  }

  /**
   * Grant ownership of a horse directly (e.g. quest reward).
   * Returns false if the horse is unknown.
   */
  public grantHorse(horseId: string): boolean {
    const horse = this._horses.get(horseId);
    if (!horse) return false;
    horse.isOwned = true;
    return true;
  }

  /** Returns a horse by id, or null if not found. */
  public getHorse(horseId: string): Horse | null {
    return this._horses.get(horseId) ?? null;
  }

  /** Returns all registered horses. */
  public get horses(): Horse[] {
    return Array.from(this._horses.values());
  }

  /** Returns all owned horses. */
  public get ownedHorses(): Horse[] {
    return Array.from(this._horses.values()).filter(h => h.isOwned);
  }

  // ── Stable NPCs ───────────────────────────────────────────────────────────

  /**
   * Register a stable NPC that sells horses.
   * Horse ids in availableHorseIds must already be registered via registerHorse().
   */
  public registerStableNPC(opts: {
    npcName: string;
    availableHorseIds: string[];
    prices: Record<string, number>;
  }): void {
    this._stableNpcs.set(opts.npcName, {
      npcName: opts.npcName,
      availableHorseIds: opts.availableHorseIds,
      prices: opts.prices,
    });
  }

  /** Returns the StableNPC record for the given NPC name, or null if not found. */
  public getStableNPC(npcName: string): StableNPC | null {
    return this._stableNpcs.get(npcName) ?? null;
  }

  /**
   * Attempt to purchase a horse from a stable NPC.
   * Returns the price on success, -1 if the NPC/horse is unknown,
   * or -2 if the horse is already owned.
   */
  public purchaseHorse(npcName: string, horseId: string, playerGold: number): number {
    const stable = this._stableNpcs.get(npcName);
    if (!stable) return -1;
    if (!stable.availableHorseIds.includes(horseId)) return -1;

    const horse = this._horses.get(horseId);
    if (!horse) return -1;
    if (horse.isOwned) return -2;

    const price = stable.prices[horseId] ?? 0;
    if (playerGold < price) return -1;

    horse.isOwned = true;
    this.onHorsePurchased?.(horse);
    return price;
  }

  // ── Mounting / dismounting ────────────────────────────────────────────────

  /** True while the player is riding a horse. */
  public get isMounted(): boolean {
    return this._isMounted;
  }

  /** The currently mounted horse, or null. */
  public get currentHorse(): Horse | null {
    if (!this._currentHorseId) return null;
    return this._horses.get(this._currentHorseId) ?? null;
  }

  /**
   * Mount the specified owned horse.
   * Returns false if the horse is unknown, not owned, or already mounted.
   */
  public mountHorse(horseId: string): boolean {
    if (this._isMounted) return false;

    const horse = this._horses.get(horseId);
    if (!horse || !horse.isOwned) return false;

    this._currentHorseId = horseId;
    this._isMounted = true;
    this.onMount?.(horse, horse.speed);
    return true;
  }

  /**
   * Dismount the current horse.
   * Returns false if not currently mounted.
   */
  public dismountHorse(): boolean {
    if (!this._isMounted || !this._currentHorseId) return false;

    const horse = this._horses.get(this._currentHorseId)!;
    this._isMounted = false;
    this._currentHorseId = null;
    this.onDismount?.(horse);
    return true;
  }

  // ── Saddlebag inventory ───────────────────────────────────────────────────

  /**
   * Get the saddlebag contents for a horse.
   * Returns null if the horse is unknown.
   */
  public getSaddlebag(horseId: string): Item[] | null {
    return this._saddlebags.get(horseId) ?? null;
  }

  /**
   * Add an item to a horse's saddlebag.
   * Returns false if the horse is unknown or the saddlebag is full.
   */
  public saddlebagAddItem(horseId: string, item: Item): boolean {
    const horse = this._horses.get(horseId);
    const bag = this._saddlebags.get(horseId);
    if (!horse || !bag) return false;

    // Each unique item entry (stack or single) occupies one slot.
    const itemCount = bag.length;
    if (itemCount >= horse.saddlebagCapacity) return false;

    const existing = item.stackable ? bag.find(i => i.id === item.id) : null;
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      bag.push({ ...item });
    }
    return true;
  }

  /**
   * Remove one unit of an item from a horse's saddlebag by id.
   * Returns true if the item was found and removed.
   */
  public saddlebagRemoveItem(horseId: string, itemId: string, quantity = 1): boolean {
    const bag = this._saddlebags.get(horseId);
    if (!bag) return false;

    const idx = bag.findIndex(i => i.id === itemId);
    if (idx === -1) return false;

    const item = bag[idx];
    if (item.stackable && item.quantity > quantity) {
      item.quantity -= quantity;
    } else {
      bag.splice(idx, 1);
    }
    return true;
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  public getSaveState(): HorseSaveState {
    const horses = Array.from(this._horses.values()).map(horse => ({
      id: horse.id,
      name: horse.name,
      speed: horse.speed,
      saddlebagCapacity: horse.saddlebagCapacity,
      isOwned: horse.isOwned,
      stableId: horse.stableId,
      saddlebag: [...(this._saddlebags.get(horse.id) ?? [])],
    }));

    return {
      horses,
      currentHorseId: this._currentHorseId,
      isMounted: this._isMounted,
    };
  }

  public restoreFromSave(state: HorseSaveState): void {
    for (const saved of state.horses) {
      const horse = this._horses.get(saved.id);
      if (horse) {
        horse.isOwned = saved.isOwned;
        horse.stableId = saved.stableId;
        this._saddlebags.set(saved.id, saved.saddlebag ?? []);
      }
    }

    // Restore mount state
    if (state.isMounted && state.currentHorseId) {
      const horse = this._horses.get(state.currentHorseId);
      if (horse && horse.isOwned) {
        this._currentHorseId = state.currentHorseId;
        this._isMounted = true;
        // Re-fire onMount so the game can reapply the speed multiplier
        this.onMount?.(horse, horse.speed);
      }
    } else {
      this._currentHorseId = null;
      this._isMounted = false;
    }
  }
}
