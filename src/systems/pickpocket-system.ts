/**
 * PickpocketSystem — Oblivion/Morrowind-style pickpocketing for Camelot.
 *
 * Allows the player to steal items from NPC inventories while crouching
 * and undetected.  Success probability scales with the Sneak skill and is
 * penalised by item weight, item value, and NPC awareness.
 *
 * Success formula:
 *   chance = (sneakLevel × 1.5) − npcAwareness − (itemWeight × WEIGHT_PENALTY)
 *            − (itemValue / VALUE_DIVISOR)
 *   clamped to [MIN_SUCCESS_CHANCE, MAX_SUCCESS_CHANCE] = [5, 90]
 *
 * If the attempt fails **and** the success chance was below CAUGHT_THRESHOLD,
 * `onCaught` fires so the game layer can call CrimeSystem.commitCrime().
 *
 * Headless: no BabylonJS dependencies — integrates via callbacks.
 * SAVE_VERSION: 25
 */

// ── Constants ─────────────────────────────────────────────────────────────────

/** Absolute floor for success probability [0–100]. */
export const MIN_SUCCESS_CHANCE = 5;
/** Absolute ceiling for success probability [0–100]. */
export const MAX_SUCCESS_CHANCE = 90;
/**
 * If the success chance is below this value and the attempt fails,
 * the player is considered caught (crime committed).
 */
export const CAUGHT_THRESHOLD = 50;
/** Sneak XP awarded per successful pickpocket. */
export const SNEAK_XP_PER_PICKPOCKET = 15;
/** Penalty applied per unit of item weight in the success formula. */
export const WEIGHT_PENALTY = 5;
/** Divisor applied to item value in the success formula. */
export const VALUE_DIVISOR = 10;

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * An item that can be stolen from an NPC's inventory.
 * Callers register these via {@link PickpocketSystem.registerNpcInventory}.
 */
export interface PickpocketableItem {
  /** Stable item identifier (e.g. `"gold_ring"`). */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** Weight of the item — heavier items are harder to steal. */
  weight: number;
  /** Gold value of the item — higher-value items are harder to steal. */
  value: number;
}

/** Reasons an attempt can be denied before the dice are rolled. */
export type PickpocketFailReason =
  | "unknown_npc"        // no inventory registered for this NPC
  | "not_crouching"      // player must be crouching
  | "already_detected"   // NPC has already spotted the player
  | "empty_inventory"    // NPC has no items to steal
  | "unknown_item";      // itemId not found in the NPC's inventory

/** Non-mutating eligibility check result. */
export interface PickpocketCheckResult {
  canAttempt: boolean;
  reason?: PickpocketFailReason;
  /**
   * Estimated success probability [0–100].
   * `null` when `canAttempt` is false for a reason unrelated to the target
   * item (e.g. player is not crouching).
   */
  successChance: number | null;
}

/** Discriminated result of a {@link PickpocketSystem.attempt} call. */
export type PickpocketResult =
  | { success: true;  itemId: string; sneakXpAwarded: number }
  | { success: false; reason: PickpocketFailReason | "failed_roll"; caught: boolean };

// ── Save state ────────────────────────────────────────────────────────────────

export interface PickpocketSaveState {
  totalAttempts:  number;
  totalSuccesses: number;
  totalCaught:    number;
}

// ── System ────────────────────────────────────────────────────────────────────

/**
 * Manages NPC pickpocketable inventories and pickpocket attempt resolution.
 *
 * Usage:
 * ```ts
 * const pickpocket = new PickpocketSystem();
 *
 * // Wire callbacks
 * pickpocket.onPickpocketSuccess = (npcId, itemId, xp) => {
 *   inventorySystem.addItem(item);
 *   skillProgressionSystem.gainXP("sneak", xp);
 * };
 * pickpocket.onCaught = (npcId) => {
 *   crimeSystem.commitCrime("theft", "town_guard", gameTime);
 * };
 *
 * // Register NPC inventory
 * pickpocket.registerNpcInventory("merchant_01", [
 *   { id: "gold_ring", name: "Gold Ring", weight: 0.1, value: 50 },
 * ]);
 *
 * // Before showing UI: check eligibility
 * const check = pickpocket.canAttempt("merchant_01", true, false);
 *
 * // Player selects item and confirms
 * const result = pickpocket.attempt(
 *   "merchant_01", "gold_ring",
 *   sneakLevel, npcAwareness,
 *   isCrouching, isDetected,
 * );
 * ```
 */
export class PickpocketSystem {
  private _inventories: Map<string, PickpocketableItem[]> = new Map();
  private _totalAttempts  = 0;
  private _totalSuccesses = 0;
  private _totalCaught    = 0;

  // ── Callbacks ──────────────────────────────────────────────────────────────

  /**
   * Fired after a successful steal.
   * @param npcId          The NPC that was pickpocketed.
   * @param itemId         The item that was taken.
   * @param sneakXpAwarded Sneak XP the caller should award via SkillProgressionSystem.
   */
  public onPickpocketSuccess:
    | ((npcId: string, itemId: string, sneakXpAwarded: number) => void)
    | null = null;

  /**
   * Fired after a failed attempt.
   * @param npcId  The NPC that was targeted.
   * @param itemId The item that was attempted.
   * @param caught Whether the player was caught (should trigger a crime event).
   */
  public onPickpocketFailed:
    | ((npcId: string, itemId: string, caught: boolean) => void)
    | null = null;

  /**
   * Fired specifically when the player is caught mid-attempt.
   * Use this to call `CrimeSystem.commitCrime("theft", factionId, gameTime)`.
   * @param npcId The NPC that caught the player.
   */
  public onCaught: ((npcId: string) => void) | null = null;

  // ── NPC inventory registration ─────────────────────────────────────────────

  /**
   * Register or replace the pickpocketable item list for an NPC.
   * Stores a defensive copy of the provided array.
   */
  public registerNpcInventory(npcId: string, items: PickpocketableItem[]): void {
    this._inventories.set(npcId, items.map(i => ({ ...i })));
  }

  /**
   * Remove an NPC's registered inventory.
   * @returns `true` if an inventory existed and was removed.
   */
  public removeNpcInventory(npcId: string): boolean {
    return this._inventories.delete(npcId);
  }

  /**
   * Returns the registered pickpocketable items for the given NPC,
   * or `undefined` if none are registered.
   * Returns a defensive copy to prevent external mutation.
   */
  public getNpcInventory(npcId: string): ReadonlyArray<Readonly<PickpocketableItem>> | undefined {
    const items = this._inventories.get(npcId);
    return items ? items.map(i => ({ ...i })) : undefined;
  }

  /** Returns all registered NPC ids. */
  public get registeredNpcIds(): ReadonlyArray<string> {
    return Array.from(this._inventories.keys());
  }

  // ── Success chance ─────────────────────────────────────────────────────────

  /**
   * Calculate success probability for stealing `itemId` from `npcId`.
   *
   * @param npcId         NPC to target.
   * @param itemId        Item to steal.
   * @param sneakLevel    Player's current Sneak skill level [0–100].
   * @param npcAwareness  NPC awareness modifier [0–100]; higher = harder.
   *                      Defaults to 30 (average NPC).
   * @returns Success probability [MIN_SUCCESS_CHANCE, MAX_SUCCESS_CHANCE],
   *          or `null` if the NPC or item is unknown.
   */
  public getSuccessChance(
    npcId: string,
    itemId: string,
    sneakLevel: number,
    npcAwareness = 30,
  ): number | null {
    const items = this._inventories.get(npcId);
    if (!items) return null;
    const item = items.find(i => i.id === itemId);
    if (!item) return null;

    const raw =
      sneakLevel * 1.5
      - npcAwareness
      - item.weight * WEIGHT_PENALTY
      - item.value / VALUE_DIVISOR;

    return Math.max(MIN_SUCCESS_CHANCE, Math.min(MAX_SUCCESS_CHANCE, raw));
  }

  // ── Eligibility check ──────────────────────────────────────────────────────

  /**
   * Non-mutating eligibility check for a pickpocket attempt.
   *
   * @param npcId       NPC to target.
   * @param itemId      Item to attempt to steal (pass empty string to check NPC-level gates only).
   * @param isCrouching Whether the player is currently crouching.
   * @param isDetected  Whether the NPC has already detected the player.
   * @param sneakLevel  Player's Sneak level (used to calculate successChance).
   * @param npcAwareness NPC awareness modifier, defaults to 30.
   */
  public canAttempt(
    npcId: string,
    isCrouching: boolean,
    isDetected: boolean,
    itemId = "",
    sneakLevel = 0,
    npcAwareness = 30,
  ): PickpocketCheckResult {
    const items = this._inventories.get(npcId);
    if (!items) {
      return { canAttempt: false, reason: "unknown_npc", successChance: null };
    }
    if (!isCrouching) {
      return { canAttempt: false, reason: "not_crouching", successChance: null };
    }
    if (isDetected) {
      return { canAttempt: false, reason: "already_detected", successChance: null };
    }
    if (items.length === 0) {
      return { canAttempt: false, reason: "empty_inventory", successChance: null };
    }
    if (itemId) {
      const found = items.find(i => i.id === itemId);
      if (!found) {
        return { canAttempt: false, reason: "unknown_item", successChance: null };
      }
      const successChance = this.getSuccessChance(npcId, itemId, sneakLevel, npcAwareness);
      return { canAttempt: true, successChance };
    }

    // NPC-level check only — compute chance for the easiest (lightest/cheapest) item
    const easiest = [...items].sort(
      (a, b) => (a.weight * WEIGHT_PENALTY + a.value / VALUE_DIVISOR)
                - (b.weight * WEIGHT_PENALTY + b.value / VALUE_DIVISOR),
    )[0];
    const successChance = this.getSuccessChance(npcId, easiest.id, sneakLevel, npcAwareness);
    return { canAttempt: true, successChance };
  }

  // ── Attempt ────────────────────────────────────────────────────────────────

  /**
   * Attempt to steal `itemId` from `npcId`.
   *
   * On success:
   * - Removes the item from the NPC's registered inventory.
   * - Increments `totalAttempts` and `totalSuccesses`.
   * - Fires `onPickpocketSuccess`.
   *
   * On failure with catch:
   * - Increments `totalAttempts` and `totalCaught`.
   * - Fires `onPickpocketFailed` (caught = true).
   * - Fires `onCaught`.
   *
   * On failure without catch:
   * - Increments `totalAttempts`.
   * - Fires `onPickpocketFailed` (caught = false).
   *
   * @param npcId        NPC to target.
   * @param itemId       Item to steal.
   * @param sneakLevel   Player's current Sneak skill level [0–100].
   * @param npcAwareness NPC awareness modifier, defaults to 30.
   * @param isCrouching  Whether the player is crouching.
   * @param isDetected   Whether the NPC has already detected the player.
   * @param rng          Optional seeded RNG for deterministic tests — receives
   *                     a single call returning a value in [0, 100).
   */
  public attempt(
    npcId: string,
    itemId: string,
    sneakLevel: number,
    npcAwareness: number,
    isCrouching: boolean,
    isDetected: boolean,
    rng: () => number = () => Math.random() * 100,
  ): PickpocketResult {
    const eligibility = this.canAttempt(npcId, isCrouching, isDetected, itemId, sneakLevel, npcAwareness);

    if (!eligibility.canAttempt) {
      return { success: false, reason: eligibility.reason!, caught: false };
    }

    this._totalAttempts += 1;

    const chance = eligibility.successChance!;
    const roll   = rng();

    if (roll < chance) {
      // Success — remove item from NPC's inventory
      const items = this._inventories.get(npcId)!;
      const idx   = items.findIndex(i => i.id === itemId);
      if (idx !== -1) items.splice(idx, 1);

      this._totalSuccesses += 1;
      this.onPickpocketSuccess?.(npcId, itemId, SNEAK_XP_PER_PICKPOCKET);

      return { success: true, itemId, sneakXpAwarded: SNEAK_XP_PER_PICKPOCKET };
    }

    // Failure — determine if caught
    const caught = chance < CAUGHT_THRESHOLD;
    if (caught) {
      this._totalCaught += 1;
      this.onPickpocketFailed?.(npcId, itemId, true);
      this.onCaught?.(npcId);
    } else {
      this.onPickpocketFailed?.(npcId, itemId, false);
    }

    return { success: false, reason: "failed_roll", caught };
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  /** Total pickpocket attempts (successes + failures). */
  public get totalAttempts(): number {
    return this._totalAttempts;
  }

  /** Total successful steals. */
  public get totalSuccesses(): number {
    return this._totalSuccesses;
  }

  /** Total times the player was caught. */
  public get totalCaught(): number {
    return this._totalCaught;
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  /** Serialize cumulative stats for save-file storage. */
  public getSaveState(): PickpocketSaveState {
    return {
      totalAttempts:  this._totalAttempts,
      totalSuccesses: this._totalSuccesses,
      totalCaught:    this._totalCaught,
    };
  }

  /**
   * Restore state from a previously serialized snapshot.
   * NPC inventories are not persisted — they are re-registered at runtime.
   * Callbacks are NOT fired on restore.
   */
  public restoreFromSave(state: PickpocketSaveState): void {
    this._totalAttempts  = Math.max(0, state.totalAttempts  ?? 0);
    this._totalSuccesses = Math.max(0, state.totalSuccesses ?? 0);
    this._totalCaught    = Math.max(0, state.totalCaught    ?? 0);
  }
}
