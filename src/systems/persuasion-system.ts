// ── Types ────────────────────────────────────────────────────────────────────

export type PersuasionOutcome = "success" | "failure" | "critical_success" | "critical_failure";
export type PersuasionAction = "admire" | "boast" | "joke" | "coerce";

export interface PersuasionAttemptResult {
  outcome: PersuasionOutcome;
  dispositionDelta: number;
  newDisposition: number;
}

export interface PersuasionActionResult extends PersuasionAttemptResult {
  action: PersuasionAction;
  npcAffinity: number;
  chance: number;
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

/**
 * Oblivion-style action affinity modifier:
 * -2 strongly dislikes, +2 strongly likes.
 */
const ACTION_AFFINITY_MODIFIER = 0.06;

/** Action-specific disposition adjustment. */
const ACTION_DELTA_MULTIPLIER = 0.4;

// ── PersuasionSystem ──────────────────────────────────────────────────────────

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
   * Baseline persuasion check.
   */
  public attemptPersuade(
    npcId: string,
    speechcraftSkill: number,
    randomRoll?: number,
  ): PersuasionAttemptResult {
    const chance = this.getPersuasionChance(npcId, speechcraftSkill);
    return this._resolveCheck(npcId, chance, randomRoll);
  }

  /**
   * Deeper Oblivion-style check with action affinity.
   *
   * Each NPC has deterministic per-action affinity in [-2, 2] based on npcId.
   * Actions they like are easier and reward larger disposition gains.
   */
  public attemptPersuasionAction(
    npcId: string,
    speechcraftSkill: number,
    action: PersuasionAction,
    randomRoll?: number,
  ): PersuasionActionResult {
    const affinity = this.getActionAffinity(npcId, action);
    const baseChance = this.getPersuasionChance(npcId, speechcraftSkill);
    const chance = this._clamp01(baseChance + affinity * ACTION_AFFINITY_MODIFIER, 0.05, 0.95);

    const baseResult = this._resolveCheck(npcId, chance, randomRoll, (delta) => {
      const modifier = Math.round(affinity * ACTION_DELTA_MULTIPLIER * Math.abs(delta));
      return delta >= 0 ? delta + modifier : delta - modifier;
    });

    return {
      ...baseResult,
      action,
      npcAffinity: affinity,
      chance,
    };
  }

  /**
   * Deterministic action affinity in [-2, 2] to emulate NPC personality.
   */
  public getActionAffinity(npcId: string, action: PersuasionAction): number {
    const seed = this._hash(`${npcId}:${action}`);
    return (seed % 5) - 2;
  }

  /** Returns success chance (without action modifiers), clamped to [0.05, 0.95]. */
  public getPersuasionChance(npcId: string, speechcraftSkill: number): number {
    const disposition = this.getDisposition(npcId);
    return this._clamp01(
      BASE_SUCCEED_CHANCE
      + (speechcraftSkill - 50) * SKILL_WEIGHT
      + (disposition - DISPOSITION_NEUTRAL) * DISPOSITION_WEIGHT,
      0.05,
      0.95,
    );
  }

  // ── Merchant pricing integration ──────────────────────────────────────────

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

  private _resolveCheck(
    npcId: string,
    chance: number,
    randomRoll?: number,
    deltaTransform?: (delta: number) => number,
  ): PersuasionAttemptResult {
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

    const adjustedDelta = deltaTransform ? deltaTransform(delta) : delta;
    const newDisposition = this.adjustDisposition(npcId, adjustedDelta);
    return { outcome, dispositionDelta: adjustedDelta, newDisposition };
  }

  private _hash(text: string): number {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash);
  }

  private _clamp(value: number): number {
    return Math.min(DISPOSITION_MAX, Math.max(DISPOSITION_MIN, value));
  }

  private _clamp01(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}
