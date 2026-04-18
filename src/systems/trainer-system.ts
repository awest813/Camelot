/**
 * TrainerSystem — Morrowind-style NPC skill training for Camelot.
 *
 * Players can pay NPC trainers to directly raise a skill level, up to the
 * trainer's expertise cap (`maxLevel`).  To prevent runaway grinding the
 * system enforces a configurable `maxSessionsPerLevel` limit (default 5) —
 * the same limit Morrowind and Oblivion used — that resets whenever the
 * player's character level increases via {@link onCharacterLevelUp}.
 *
 * Cost formula:
 *   gold = baseCost + currentSkillLevel × costPerLevel
 *
 * Trainers are registered at startup and identified by a string id.
 * The system is headless (no BabylonJS dependency) and integrates with
 * `SkillProgressionSystem` via the `onTrainingComplete` callback.
 *
 * Headless: no BabylonJS dependencies — integrates via callbacks.
 * SAVE_VERSION: 24
 */

import type { ProgressionSkillId } from "./skill-progression-system";

// ── Types ──────────────────────────────────────────────────────────────────────

/**
 * Static definition for a single NPC trainer.
 * Registered once at startup; can be updated via `registerTrainer` if needed.
 */
export interface TrainerDefinition {
  /** Stable unique identifier (e.g. `"trainer_caius_cosades"`). */
  id: string;
  /** Human-readable display name (e.g. `"Caius Cosades"`). */
  name: string;
  /** The single skill this trainer teaches. */
  skillId: ProgressionSkillId;
  /**
   * Maximum skill level the trainer can teach to.
   * Training is denied when the player's current skill level is already ≥ this.
   */
  maxLevel: number;
  /** Base gold cost when the skill is at level 0. */
  baseCost: number;
  /**
   * Additional gold per current skill level.
   * Total cost = baseCost + currentSkillLevel × costPerLevel.
   */
  costPerLevel: number;
}

/** Reasons a training session can be denied. */
export type TrainingDeniedReason =
  | "unknown_trainer"        // no trainer with that id registered
  | "skill_at_cap"           // player skill >= trainer maxLevel
  | "session_limit_reached"  // used all sessions allowed this character level
  | "insufficient_gold";     // player does not have enough gold

/** Result of a `canTrain` eligibility check (non-mutating). */
export interface TrainingCheckResult {
  canTrain: boolean;
  reason?: TrainingDeniedReason;
  /** Gold cost for one session, or `null` when the trainer is unknown. */
  cost: number | null;
}

/** Result returned by `train()`. */
export type TrainingResult =
  | { success: true;  newLevel: number; goldSpent: number }
  | { success: false; reason: TrainingDeniedReason };

// ── Save state ────────────────────────────────────────────────────────────────

export interface TrainerSaveState {
  sessionsThisLevel: number;
  maxSessionsPerLevel: number;
}

// ── Built-in trainer table ─────────────────────────────────────────────────────

/**
 * Starter set of built-in trainers that the system registers automatically.
 * Callers may add more via `registerTrainer()`.
 */
export const BUILT_IN_TRAINERS: TrainerDefinition[] = [
  {
    id: "trainer_blade_master",
    name: "Blade Master",
    skillId: "blade",
    maxLevel: 50,
    baseCost: 30,
    costPerLevel: 5,
  },
  {
    id: "trainer_destruction_mage",
    name: "Destruction Mage",
    skillId: "destruction",
    maxLevel: 50,
    baseCost: 40,
    costPerLevel: 6,
  },
  {
    id: "trainer_sneak_master",
    name: "Sneak Master",
    skillId: "sneak",
    maxLevel: 50,
    baseCost: 25,
    costPerLevel: 4,
  },
  {
    id: "trainer_marksman_expert",
    name: "Marksman Expert",
    skillId: "marksman",
    maxLevel: 50,
    baseCost: 30,
    costPerLevel: 5,
  },
  {
    id: "trainer_speechcraft_mentor",
    name: "Speechcraft Mentor",
    skillId: "speechcraft",
    maxLevel: 50,
    baseCost: 20,
    costPerLevel: 4,
  },
  {
    id: "trainer_alchemy_sage",
    name: "Alchemy Sage",
    skillId: "alchemy",
    maxLevel: 50,
    baseCost: 35,
    costPerLevel: 6,
  },
  {
    id: "trainer_restoration_healer",
    name: "Restoration Healer",
    skillId: "restoration",
    maxLevel: 50,
    baseCost: 40,
    costPerLevel: 6,
  },
  {
    id: "trainer_grand_blade_master",
    name: "Grand Blade Master",
    skillId: "blade",
    maxLevel: 100,
    baseCost: 100,
    costPerLevel: 15,
  },
  {
    id: "trainer_archmage",
    name: "Archmage",
    skillId: "destruction",
    maxLevel: 100,
    baseCost: 120,
    costPerLevel: 20,
  },
];

// ── Default session limit ─────────────────────────────────────────────────────

/** Default maximum training sessions allowed per character level-up cycle. */
const DEFAULT_MAX_SESSIONS_PER_LEVEL = 5;

// ── System ────────────────────────────────────────────────────────────────────

/**
 * Manages NPC trainer registrations and skill-training sessions.
 *
 * Usage:
 * ```ts
 * const trainer = new TrainerSystem();
 *
 * // Wire callbacks
 * trainer.onTrainingComplete = (id, skill, newLevel, gold) => {
 *   skillProgressionSystem.setSkillLevel(skill, newLevel);
 *   player.gold -= gold;
 *   ui.showNotification(`${skill} raised to ${newLevel}!`);
 * };
 *
 * // On player level-up
 * playerLevelSystem.onLevelUpComplete = () => trainer.onCharacterLevelUp();
 *
 * // In dialogue: player clicks "Train me"
 * const check = trainer.canTrain("trainer_blade_master", currentSkillLevel, playerGold);
 * if (check.canTrain) {
 *   trainer.train("trainer_blade_master", currentSkillLevel, playerGold);
 * }
 * ```
 */
export class TrainerSystem {
  private _trainers: Map<string, TrainerDefinition> = new Map();
  private _sessionsThisLevel: number = 0;

  /**
   * Maximum number of training sessions allowed per character level cycle.
   * Reset to zero when `onCharacterLevelUp()` is called.
   * Default: 5 (mirrors Morrowind / Oblivion).
   */
  public maxSessionsPerLevel: number = DEFAULT_MAX_SESSIONS_PER_LEVEL;

  // ── Callbacks ────────────────────────────────────────────────────────────

  /**
   * Fired after a successful training session.
   * @param trainerId  The id of the trainer used.
   * @param skillId    The skill that was raised.
   * @param newLevel   The skill's new level (old level + 1).
   * @param goldSpent  Gold deducted for this session.
   */
  public onTrainingComplete:
    | ((trainerId: string, skillId: ProgressionSkillId, newLevel: number, goldSpent: number) => void)
    | null = null;

  // ── Constructor ──────────────────────────────────────────────────────────

  /**
   * Creates a new TrainerSystem pre-seeded with the built-in starter trainers.
   * Additional trainers can be added via {@link registerTrainer}.
   */
  constructor() {
    for (const def of BUILT_IN_TRAINERS) {
      this._trainers.set(def.id, { ...def });
    }
  }

  // ── Registration ─────────────────────────────────────────────────────────

  /**
   * Register or overwrite a trainer definition.
   */
  public registerTrainer(def: TrainerDefinition): void {
    this._trainers.set(def.id, { ...def });
  }

  /**
   * Remove a registered trainer.
   * @returns `true` if the trainer existed and was removed.
   */
  public removeTrainer(id: string): boolean {
    return this._trainers.delete(id);
  }

  /**
   * Retrieve a trainer definition by id, or `undefined` if unknown.
   */
  public getTrainer(id: string): Readonly<TrainerDefinition> | undefined {
    return this._trainers.get(id);
  }

  /**
   * Returns all registered trainer definitions in insertion order.
   */
  public getAllTrainers(): ReadonlyArray<Readonly<TrainerDefinition>> {
    return Array.from(this._trainers.values());
  }

  /**
   * Returns trainers that can teach the specified skill.
   */
  public getTrainersForSkill(skillId: ProgressionSkillId): ReadonlyArray<Readonly<TrainerDefinition>> {
    return Array.from(this._trainers.values()).filter(t => t.skillId === skillId);
  }

  // ── Cost helper ──────────────────────────────────────────────────────────

  /**
   * Returns the gold cost for one training session given the player's current
   * skill level, or `null` if the trainer id is unknown.
   */
  public getCost(trainerId: string, currentSkillLevel: number): number | null {
    const def = this._trainers.get(trainerId);
    if (!def) return null;
    return def.baseCost + Math.max(0, currentSkillLevel) * def.costPerLevel;
  }

  // ── Queries ──────────────────────────────────────────────────────────────

  /** Training sessions used during the current character level cycle. */
  public get sessionsThisLevel(): number {
    return this._sessionsThisLevel;
  }

  /** Remaining training sessions before the character needs to level up. */
  public get sessionsRemaining(): number {
    return Math.max(0, this.maxSessionsPerLevel - this._sessionsThisLevel);
  }

  /**
   * Non-mutating eligibility check for a training session.
   *
   * @param trainerId         Trainer id to check.
   * @param currentSkillLevel Player's current level in the trainer's skill.
   * @param playerGold        Player's current gold.
   */
  public canTrain(
    trainerId: string,
    currentSkillLevel: number,
    playerGold: number,
  ): TrainingCheckResult {
    const def = this._trainers.get(trainerId);
    if (!def) {
      return { canTrain: false, reason: "unknown_trainer", cost: null };
    }

    if (currentSkillLevel >= def.maxLevel) {
      return {
        canTrain: false,
        reason: "skill_at_cap",
        cost: this.getCost(trainerId, currentSkillLevel),
      };
    }

    if (this._sessionsThisLevel >= this.maxSessionsPerLevel) {
      return {
        canTrain: false,
        reason: "session_limit_reached",
        cost: this.getCost(trainerId, currentSkillLevel),
      };
    }

    const cost = this.getCost(trainerId, currentSkillLevel)!;
    if (playerGold < cost) {
      return { canTrain: false, reason: "insufficient_gold", cost };
    }

    return { canTrain: true, cost };
  }

  /**
   * Attempt a training session.
   *
   * On success:
   * - Increments `sessionsThisLevel`.
   * - Fires `onTrainingComplete` with the new skill level and gold cost
   *   (caller is responsible for deducting gold and raising the skill via
   *   `SkillProgressionSystem.setSkillLevel`).
   *
   * Returns a {@link TrainingResult} discriminated union.
   *
   * @param trainerId         Trainer id.
   * @param currentSkillLevel Player's current level in the trainer's skill.
   * @param playerGold        Player's available gold.
   */
  public train(
    trainerId: string,
    currentSkillLevel: number,
    playerGold: number,
  ): TrainingResult {
    const check = this.canTrain(trainerId, currentSkillLevel, playerGold);
    if (!check.canTrain) {
      return { success: false, reason: check.reason! };
    }

    const def = this._trainers.get(trainerId)!;
    const goldSpent = check.cost!;
    const newLevel = currentSkillLevel + 1;

    this._sessionsThisLevel += 1;
    this.onTrainingComplete?.(trainerId, def.skillId, newLevel, goldSpent);

    return { success: true, newLevel, goldSpent };
  }

  // ── Character level-up hook ──────────────────────────────────────────────

  /**
   * Call this whenever the player's character level increases.
   * Resets the training session counter so the player can train again.
   */
  public onCharacterLevelUp(): void {
    this._sessionsThisLevel = 0;
  }

  // ── Persistence ──────────────────────────────────────────────────────────

  /** Serialize current state for save-file storage. */
  public getSaveState(): TrainerSaveState {
    return {
      sessionsThisLevel: this._sessionsThisLevel,
      maxSessionsPerLevel: this.maxSessionsPerLevel,
    };
  }

  /**
   * Restore state from a previously serialized snapshot.
   * Callbacks are NOT fired on restore.
   */
  public restoreFromSave(state: TrainerSaveState): void {
    this._sessionsThisLevel = Math.max(0, state.sessionsThisLevel ?? 0);
    this.maxSessionsPerLevel = Math.max(1, state.maxSessionsPerLevel ?? DEFAULT_MAX_SESSIONS_PER_LEVEL);
  }
}
