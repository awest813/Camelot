// ── Types ────────────────────────────────────────────────────────────────────

export type PersuasionOutcome = "success" | "failure" | "critical_success" | "critical_failure";

export interface PersuasionAttemptResult {
  outcome: PersuasionOutcome;
  dispositionDelta: number;
  newDisposition: number;
}

export interface PersuasionSaveState {
  dispositions: Record<string, number>;
}

// ── Constants ────────────────────────────────────────────────────────────────

const DISPOSITION_MIN  = 0;
const DISPOSITION_MAX  = 100;
/** Neutral disposition — below this NPCs are unfriendly, above is friendly. */
const DISPOSITION_NEUTRAL = 50;

/** Base chance to succeed a persuasion check at speechcraft 50, disposition 50. */
const BASE_SUCCEED_CHANCE = 0.5;

/**
 * How much speechcraft above 50 shifts the success chance per point.
 * At skill 100 → +25 % base chance.
 */
const SKILL_WEIGHT = 0.005;

/** How much current disposition modifies success chance (per point from 50). */
const DISPOSITION_WEIGHT = 0.004;

/** Disposition delta on a normal success. */
const DELTA_SUCCESS  = 10;
/** Disposition delta on a critical success (roll ≤ 5 %). */
const DELTA_CRIT_SUCCESS = 20;
/** Disposition delta on a normal failure. */
const DELTA_FAILURE  = -5;
/** Disposition delta on a critical failure (roll ≥ 95 %). */
const DELTA_CRIT_FAIL = -15;

/** Min speechcraft needed to attempt persuasion at all. */
const MIN_SPEECH_TO_ATTEMPT = 5;

// ── PersuasionSystem ──────────────────────────────────────────────────────────

/**
 * Tracks per-NPC disposition and handles persuasion mechanics.
 *
 * Disposition model:
 *   - Each NPC starts at a configurable default disposition [0-100].
 *   - Faction changes, dialogue choices, and crime events feed into it.
 *   - Disposition bands drive dialogue/merchant availability:
 *       [0,  25) → hostile
 *       [25, 45) → unfriendly
 *       [45, 65) → neutral
 *       [65, 85) → friendly
 *       [85,100] → allied
 *
 * Persuasion mini-game:
 *   `attemptPersuade(npcId, speechcraftSkill)` rolls a success check
 *   influenced by the player's speechcraft skill and the NPC's current
 *   disposition.  On success the disposition goes up; on failure it goes down.
 *
 * Usage:
 * ```ts
 * const ps = new PersuasionSystem();
 * ps.setDisposition("merchant_01", 55);
 * const result = ps.attemptPersuade("merchant_01", playerSpeechSkill);
 * console.log(result.outcome, result.newDisposition);
 * ```
 */
export class PersuasionSystem {
  private _dispositions: Map<string, number> = new Map();
  /** Default starting disposition for any NPC not explicitly set. */
  public defaultDisposition: number = DISPOSITION_NEUTRAL;

  // ── Disposition accessors ─────────────────────────────────────────────────

  /** Get an NPC's current disposition (defaults to `defaultDisposition`). */
  public getDisposition(npcId: string): number {
    return this._dispositions.get(npcId) ?? this.defaultDisposition;
  }

  /**
   * Set an NPC's disposition, clamped to [0, 100].
   * Use this to establish starting values from NPC definitions.
   */
  public setDisposition(npcId: string, value: number): void {
    this._dispositions.set(npcId, this._clamp(Math.round(value)));
  }

  /**
   * Apply a delta to an NPC's disposition.
   * Returns the new clamped disposition value.
   */
  public adjustDisposition(npcId: string, delta: number): number {
    const current = this.getDisposition(npcId);
    const next = this._clamp(Math.round(current + delta));
    this._dispositions.set(npcId, next);
    return next;
  }

  // ── Disposition bands ─────────────────────────────────────────────────────

  /** Human-readable disposition band for the given NPC. */
  public getDispositionBand(npcId: string): "hostile" | "unfriendly" | "neutral" | "friendly" | "allied" {
    const d = this.getDisposition(npcId);
    if (d < 25) return "hostile";
    if (d < 45) return "unfriendly";
    if (d < 65) return "neutral";
    if (d < 85) return "friendly";
    return "allied";
  }

  /** Returns true when the NPC is willing to talk (disposition ≥ 25). */
  public isWillingToTalk(npcId: string): boolean {
    return this.getDisposition(npcId) >= 25;
  }

  /** Returns true when the NPC offers merchant services (disposition ≥ 40). */
  public isWillingToTrade(npcId: string): boolean {
    return this.getDisposition(npcId) >= 40;
  }

  // ── Persuasion checks ─────────────────────────────────────────────────────

  /**
   * Returns true if the player can attempt to persuade this NPC.
   * Requires speechcraft ≥ MIN_SPEECH_TO_ATTEMPT and disposition ≥ 25.
   */
  public canAttemptPersuasion(npcId: string, speechcraftSkill: number): boolean {
    return speechcraftSkill >= MIN_SPEECH_TO_ATTEMPT && this.getDisposition(npcId) >= 25;
  }

  /**
   * Attempt a persuasion check on the given NPC.
   *
   * Success probability:
   *   P = BASE (0.5) + (skill − 50) × SKILL_WEIGHT + (disposition − 50) × DISPOSITION_WEIGHT
   *   Clamped to [0.05, 0.95].
   *
   * @param npcId             NPC identifier.
   * @param speechcraftSkill  Player's current speechcraft skill [1–100].
   * @param randomRoll        Override the random roll [0,1) for deterministic tests.
   */
  public attemptPersuade(
    npcId: string,
    speechcraftSkill: number,
    randomRoll?: number,
  ): PersuasionAttemptResult {
    const disposition = this.getDisposition(npcId);

    const chance = Math.min(0.95, Math.max(0.05,
      BASE_SUCCEED_CHANCE
      + (speechcraftSkill - 50) * SKILL_WEIGHT
      + (disposition - DISPOSITION_NEUTRAL) * DISPOSITION_WEIGHT
    ));

    const roll = randomRoll !== undefined ? randomRoll : Math.random();

    let outcome: PersuasionOutcome;
    let delta: number;

    if (roll <= 0.05) {
      outcome = "critical_success";
      delta   = DELTA_CRIT_SUCCESS;
    } else if (roll >= 0.95) {
      outcome = "critical_failure";
      delta   = DELTA_CRIT_FAIL;
    } else if (roll <= chance) {
      outcome = "success";
      delta   = DELTA_SUCCESS;
    } else {
      outcome = "failure";
      delta   = DELTA_FAILURE;
    }

    const newDisposition = this.adjustDisposition(npcId, delta);
    return { outcome, dispositionDelta: delta, newDisposition };
  }

  // ── Merchant pricing integration ──────────────────────────────────────────

  /**
   * Returns a price multiplier based on NPC disposition.
   * A hostile NPC charges 40% more; an allied NPC gives 20% off.
   *
   *   hostile    → 1.40
   *   unfriendly → 1.20
   *   neutral    → 1.00
   *   friendly   → 0.90
   *   allied     → 0.80
   */
  public getMerchantPriceMultiplier(npcId: string): number {
    const band = this.getDispositionBand(npcId);
    const multipliers: Record<string, number> = {
      hostile:    1.40,
      unfriendly: 1.20,
      neutral:    1.00,
      friendly:   0.90,
      allied:     0.80,
    };
    return multipliers[band] ?? 1.00;
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  public getSaveState(): PersuasionSaveState {
    return { dispositions: Object.fromEntries(this._dispositions) };
  }

  public restoreFromSave(state: PersuasionSaveState): void {
    if (state?.dispositions) {
      this._dispositions = new Map(
        Object.entries(state.dispositions).map(([k, v]) => [k, this._clamp(v)])
      );
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _clamp(value: number): number {
    return Math.min(DISPOSITION_MAX, Math.max(DISPOSITION_MIN, value));
  }
}
