/**
 * JailSystem — Oblivion-style prison consequence for unpaid bounties.
 *
 * When a guard challenges the player and they cannot (or will not) pay the
 * bounty, `serveJailTime()` provides the "go to jail" option:
 *
 * 1. Sentence length is derived from the bounty amount (10 gold ≈ 1 in-game
 *    hour, minimum 1 hour, maximum 72 hours).
 * 2. The in-game clock is advanced by the sentence length via TimeSystem.
 * 3. Skills are penalised proportionally to time served (heavy sentences
 *    cause more skill loss) — this mirrors Oblivion's mechanic where
 *    prisoners lose skill XP while incarcerated.
 * 4. The player is released at a fixed "jail exit" position (caller-supplied).
 * 5. A structured record of the sentence is stored for the player to review.
 *
 * Affected skills (same as Oblivion's "trainable" skills):
 *   blade, marksman, sneak, alchemy, speechcraft, destruction, restoration
 *
 * Wire-up example (game.ts):
 * ```ts
 * this.jailSystem = new JailSystem();
 * this.crimeSystem.onGuardChallenge = (guard, factionId, bounty) => {
 *   // … open dialogue offering pay/jail/resist …
 *   const result = this.jailSystem.serveJailTime(
 *     bounty, factionId,
 *     this.timeSystem, this.skillProgressionSystem,
 *     this.crimeSystem,
 *   );
 *   this.ui.showNotification(result.message, 3000);
 * };
 * ```
 */

import type { TimeSystem }               from "./time-system";
import type { SkillProgressionSystem, ProgressionSkillId } from "./skill-progression-system";
import type { CrimeSystem }              from "./crime-system";

// ── Constants ──────────────────────────────────────────────────────────────────

/** Gold per in-game hour of sentence. */
const GOLD_PER_HOUR = 10;
/** Minimum sentence regardless of bounty. */
const MIN_SENTENCE_HOURS = 1;
/** Maximum sentence (3 in-game days). */
const MAX_SENTENCE_HOURS = 72;
/**
 * Skill-level points lost per sentence hour.
 * Loss is applied as negative XP so the level may drop on the next XP query.
 * We subtract directly from the skill level to stay simple.
 */
const SKILL_LOSS_PER_HOUR = 0.5;

/** Skills degraded during imprisonment (matching Oblivion's governing skills). */
const JAIL_AFFECTED_SKILLS: ProgressionSkillId[] = [
  "blade",
  "marksman",
  "sneak",
  "alchemy",
  "speechcraft",
  "destruction",
  "restoration",
];

// ── Types ──────────────────────────────────────────────────────────────────────

export interface JailRecord {
  factionId:    string;
  bounty:       number;
  hoursServed:  number;
  /** Total skill levels lost across all affected skills. */
  skillLoss:    number;
  /** In-game timestamp when sentenced (minutes). */
  timestamp:    number;
}

export interface JailSaveState {
  records: JailRecord[];
}

export interface JailResult {
  ok:          boolean;
  hoursServed: number;
  skillLoss:   number;
  message:     string;
}

// ── System ─────────────────────────────────────────────────────────────────────

export class JailSystem {
  private _records: JailRecord[] = [];

  // ── Accessors ──────────────────────────────────────────────────────────────

  /**
   * Returns a copy of all jail records (most recent last).
   */
  public get records(): ReadonlyArray<JailRecord> {
    return [...this._records];
  }

  /**
   * Total number of times the player has served jail time.
   */
  public get totalSentences(): number {
    return this._records.length;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Serve a jail sentence for the given bounty.
   *
   * Side-effects (all optional — systems may be null for testing):
   * - Advances the in-game clock by `hoursServed` hours.
   * - Reduces skill levels proportionally.
   * - Clears all bounties on the CrimeSystem.
   *
   * @param bounty           Bounty amount (gold) to convert into a sentence.
   * @param factionId        Faction the bounty belongs to.
   * @param timeSystem       Pass the game's TimeSystem to advance the clock.
   * @param skillSystem      Pass the SkillProgressionSystem to apply skill loss.
   * @param crimeSystem      Pass the CrimeSystem to clear bounties on release.
   * @param gameTimeMinutes  Current game-time in minutes (for the record).
   */
  public serveJailTime(
    bounty:            number,
    factionId:         string,
    timeSystem?:       TimeSystem | null,
    skillSystem?:      SkillProgressionSystem | null,
    crimeSystem?:      CrimeSystem | null,
    gameTimeMinutes:   number = 0,
  ): JailResult {
    if (bounty <= 0) {
      return { ok: false, hoursServed: 0, skillLoss: 0, message: "No bounty to serve." };
    }

    const hoursServed = Math.max(
      MIN_SENTENCE_HOURS,
      Math.min(MAX_SENTENCE_HOURS, Math.floor(bounty / GOLD_PER_HOUR)),
    );

    // Advance time
    timeSystem?.advanceHours?.(hoursServed);

    // Apply skill loss
    let skillLoss = 0;
    if (skillSystem) {
      const totalLoss = hoursServed * SKILL_LOSS_PER_HOUR;
      // Integer floor per skill; sentences shorter than 14 hours (< 7 levels total)
      // produce 0 loss per individual skill — short stays are mainly a time penalty.
      const lossPerSkill = Math.floor(totalLoss / JAIL_AFFECTED_SKILLS.length);
      if (lossPerSkill > 0) {
        for (const skillId of JAIL_AFFECTED_SKILLS) {
          const skill = skillSystem.getSkill(skillId);
          if (!skill) continue;
          const newLevel = Math.max(0, skill.level - lossPerSkill);
          const lost = skill.level - newLevel;
          if (lost > 0) {
            skillSystem.setSkillLevel(skillId, newLevel);
            skillLoss += lost;
          }
        }
      }
    }

    // Clear bounties
    crimeSystem?.clearAllBounties();

    // Record
    this._records.push({ factionId, bounty, hoursServed, skillLoss, timestamp: gameTimeMinutes });

    const skillMsg = skillLoss > 0 ? ` Lost ${skillLoss} skill levels.` : "";
    return {
      ok:          true,
      hoursServed,
      skillLoss,
      message:     `Served ${hoursServed} hour${hoursServed !== 1 ? "s" : ""} in jail.${skillMsg} Released.`,
    };
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  public getSaveState(): JailSaveState {
    return { records: [...this._records] };
  }

  public restoreFromSave(state: JailSaveState): void {
    this._records = [];
    if (!state || !Array.isArray(state.records)) return;
    for (const r of state.records) {
      if (
        typeof r.factionId   !== "string" ||
        typeof r.bounty      !== "number" ||
        typeof r.hoursServed !== "number" ||
        typeof r.skillLoss   !== "number" ||
        typeof r.timestamp   !== "number"
      ) continue;
      this._records.push({ ...r });
    }
  }
}
