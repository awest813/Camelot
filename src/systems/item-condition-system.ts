/**
 * ItemConditionSystem — Weapon and armor durability for Camelot.
 *
 * Tracks a condition value (0–100) for each registered item.  Condition
 * degrades during combat and affects how effective the item is:
 *
 *   getDamageMult(itemId)  — [0.50 at condition 0, 1.00 at condition 100]
 *   getArmorMult(itemId)   — same formula (shared with damage)
 *
 * Items are repaired either by a flat amount (e.g. from an in-world service)
 * or via a RepairKit scaled by the caller-supplied armorerSkill value.
 *
 * Condition tiers:
 *   flawless  80–100
 *   good      60–79
 *   worn      40–59
 *   damaged   20–39
 *   broken     0–19
 *
 * Headless: no BabylonJS dependencies — integrates via callbacks.
 * SAVE_VERSION: 25
 */

// ── Constants ─────────────────────────────────────────────────────────────────

/** Condition at which an item is considered new/pristine. */
export const MAX_CONDITION = 100;
/** Minimum condition; item is at its worst but still usable (unless broken). */
export const MIN_CONDITION = 0;
/** Damage/armor multiplier at full condition. */
export const MULT_AT_MAX_CONDITION = 1.0;
/** Damage/armor multiplier at zero condition. */
export const MULT_AT_MIN_CONDITION = 0.5;
/** Base repair amount per RepairKit use when armorerSkill is 0. */
export const BASE_REPAIR_KIT_AMOUNT = 10;
/** Additional repair points per 1 armorerSkill level (0–100). */
export const REPAIR_KIT_SKILL_SCALE = 0.5;
/** Default degradation amount applied per combat action. */
export const DEFAULT_DEGRADE_AMOUNT = 1;

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Named quality band for an item's current condition.
 * Used for display and gameplay thresholds.
 */
export type ConditionTier = "flawless" | "good" | "worn" | "damaged" | "broken";

// ── Save state ────────────────────────────────────────────────────────────────

export interface ItemConditionSaveState {
  /** Map of itemId → condition [0–100] for all registered items. */
  conditions: Record<string, number>;
}

// ── System ────────────────────────────────────────────────────────────────────

/**
 * Manages per-item condition values with degradation and repair mechanics.
 *
 * Usage:
 * ```ts
 * const condition = new ItemConditionSystem();
 *
 * // Wire callbacks
 * condition.onItemBroken   = (id) => ui.showNotification(`${id} broke!`);
 * condition.onItemRepaired = (id, _old, nw) => ui.showNotification(`Repaired to ${nw}%`);
 *
 * // Register items on equip
 * condition.initItem("iron_sword");
 *
 * // Degrade on hit
 * condition.degradeItem("iron_sword");
 *
 * // Use damage multiplier
 * const mult = condition.getDamageMult("iron_sword");
 * const damage = baseDamage * mult;
 *
 * // Repair with a kit
 * condition.repairWithKit("iron_sword", armorerSkill);
 * ```
 */
export class ItemConditionSystem {
  private _conditions: Map<string, number> = new Map();

  // ── Callbacks ──────────────────────────────────────────────────────────────

  /**
   * Fired when an item's condition changes due to degradation.
   * @param itemId       The item that degraded.
   * @param oldCondition Condition before the degrade call.
   * @param newCondition Condition after the degrade call.
   */
  public onItemDegraded:
    | ((itemId: string, oldCondition: number, newCondition: number) => void)
    | null = null;

  /**
   * Fired the first time an item's condition reaches 0 (i.e. when it
   * transitions into the broken tier from above 0).
   * @param itemId The item that just broke.
   */
  public onItemBroken: ((itemId: string) => void) | null = null;

  /**
   * Fired when an item's condition increases due to a repair action.
   * @param itemId       The item that was repaired.
   * @param oldCondition Condition before the repair call.
   * @param newCondition Condition after the repair call.
   */
  public onItemRepaired:
    | ((itemId: string, oldCondition: number, newCondition: number) => void)
    | null = null;

  // ── Registration ───────────────────────────────────────────────────────────

  /**
   * Register an item with an initial condition.
   * If the item is already registered, its condition is updated.
   *
   * @param itemId           Stable item identifier.
   * @param initialCondition Starting condition [0–100], defaults to MAX_CONDITION.
   */
  public initItem(itemId: string, initialCondition = MAX_CONDITION): void {
    const clamped = Math.max(MIN_CONDITION, Math.min(MAX_CONDITION, initialCondition));
    this._conditions.set(itemId, clamped);
  }

  /**
   * Remove an item from tracking.
   * @returns `true` if the item existed and was removed.
   */
  public removeItem(itemId: string): boolean {
    return this._conditions.delete(itemId);
  }

  /** Returns all currently registered item ids. */
  public get registeredItemIds(): ReadonlyArray<string> {
    return Array.from(this._conditions.keys());
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  /**
   * Returns the current condition of `itemId` [0–100],
   * or `undefined` if the item is not registered.
   */
  public getCondition(itemId: string): number | undefined {
    return this._conditions.get(itemId);
  }

  /**
   * Returns the named quality tier for `itemId`,
   * or `undefined` if the item is not registered.
   */
  public getConditionTier(itemId: string): ConditionTier | undefined {
    const c = this._conditions.get(itemId);
    if (c === undefined) return undefined;
    if (c >= 80) return "flawless";
    if (c >= 60) return "good";
    if (c >= 40) return "worn";
    if (c >= 20) return "damaged";
    return "broken";
  }

  /**
   * Returns the effectiveness multiplier for a weapon's damage or an armor's
   * protection value based on its current condition.
   *
   * Formula: MULT_AT_MIN + (condition / MAX_CONDITION) × (MULT_AT_MAX − MULT_AT_MIN)
   *   → 1.0 at full condition, 0.5 at zero condition.
   *
   * Returns MULT_AT_MAX_CONDITION (1.0) if the item is not registered so that
   * callers do not need to guard against unknown items.
   */
  public getDamageMult(itemId: string): number {
    const c = this._conditions.get(itemId);
    if (c === undefined) return MULT_AT_MAX_CONDITION;
    return MULT_AT_MIN_CONDITION
      + (c / MAX_CONDITION) * (MULT_AT_MAX_CONDITION - MULT_AT_MIN_CONDITION);
  }

  /**
   * Same formula as {@link getDamageMult} — for semantic clarity when
   * applying to armor effectiveness rather than weapon damage.
   */
  public getArmorMult(itemId: string): number {
    return this.getDamageMult(itemId);
  }

  /**
   * Returns all items whose condition is currently 0 (broken tier floor).
   */
  public getBrokenItems(): ReadonlyArray<string> {
    const broken: string[] = [];
    for (const [id, c] of this._conditions) {
      if (c === 0) broken.push(id);
    }
    return broken;
  }

  /**
   * Returns a snapshot of all registered condition values.
   * The returned map is a defensive copy.
   */
  public getAllConditions(): ReadonlyMap<string, number> {
    return new Map(this._conditions);
  }

  // ── Degradation ────────────────────────────────────────────────────────────

  /**
   * Reduce an item's condition by `amount`.
   *
   * - Clamps the result to [MIN_CONDITION, MAX_CONDITION].
   * - Fires `onItemDegraded` whenever the condition decreases (even by 0 if
   *   already at min — guard at call site if needed).
   * - Fires `onItemBroken` the first time condition reaches 0 (old > 0 → new = 0).
   *
   * @param itemId  Item to degrade.
   * @param amount  Positive amount to subtract. Defaults to DEFAULT_DEGRADE_AMOUNT.
   * @returns New condition value, or `undefined` if the item is not registered.
   */
  public degradeItem(itemId: string, amount = DEFAULT_DEGRADE_AMOUNT): number | undefined {
    const current = this._conditions.get(itemId);
    if (current === undefined) return undefined;
    if (amount <= 0) return current;

    const next = Math.max(MIN_CONDITION, current - amount);
    this._conditions.set(itemId, next);
    this.onItemDegraded?.(itemId, current, next);

    if (current > 0 && next === 0) {
      this.onItemBroken?.(itemId);
    }

    return next;
  }

  // ── Repair ─────────────────────────────────────────────────────────────────

  /**
   * Increase an item's condition by a flat `amount`.
   *
   * - Clamps the result to [MIN_CONDITION, MAX_CONDITION].
   * - Fires `onItemRepaired` when the condition actually increases.
   * - No-op when `amount <= 0` or the item is already at max condition.
   *
   * @param itemId Item to repair.
   * @param amount Positive amount to restore.
   * @returns New condition value, or `undefined` if the item is not registered.
   */
  public repairItem(itemId: string, amount: number): number | undefined {
    const current = this._conditions.get(itemId);
    if (current === undefined) return undefined;
    if (amount <= 0 || current >= MAX_CONDITION) return current;

    const next = Math.min(MAX_CONDITION, current + amount);
    this._conditions.set(itemId, next);
    this.onItemRepaired?.(itemId, current, next);
    return next;
  }

  /**
   * Repair an item using a RepairKit scaled by the caller's Armorer skill.
   *
   * Formula: amount = BASE_REPAIR_KIT_AMOUNT + armorerSkill × REPAIR_KIT_SKILL_SCALE
   *   → skill 0 → +10 condition, skill 100 → +60 condition.
   *
   * @param itemId       Item to repair.
   * @param armorerSkill Player's Armorer skill level [0–100].
   * @returns New condition value, or `undefined` if the item is not registered.
   */
  public repairWithKit(itemId: string, armorerSkill: number): number | undefined {
    const clampedSkill = Math.max(0, Math.min(100, armorerSkill));
    const amount = BASE_REPAIR_KIT_AMOUNT + clampedSkill * REPAIR_KIT_SKILL_SCALE;
    return this.repairItem(itemId, amount);
  }

  /**
   * Repair every registered item using a single RepairKit + armorerSkill.
   * Fires `onItemRepaired` for each item whose condition actually increases.
   *
   * @param armorerSkill Player's Armorer skill level [0–100].
   */
  public repairAll(armorerSkill: number): void {
    for (const itemId of this._conditions.keys()) {
      this.repairWithKit(itemId, armorerSkill);
    }
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  /** Serialize all condition values for save-file storage. */
  public getSaveState(): ItemConditionSaveState {
    const conditions: Record<string, number> = {};
    for (const [id, c] of this._conditions) {
      conditions[id] = c;
    }
    return { conditions };
  }

  /**
   * Restore condition values from a previously serialized snapshot.
   * Unknown keys are ignored; known keys are clamped to [0, 100].
   * Callbacks are NOT fired on restore.
   */
  public restoreFromSave(state: ItemConditionSaveState): void {
    this._conditions.clear();
    if (!state?.conditions) return;
    for (const [id, c] of Object.entries(state.conditions)) {
      if (typeof c === "number") {
        this._conditions.set(id, Math.max(MIN_CONDITION, Math.min(MAX_CONDITION, c)));
      }
    }
  }
}
