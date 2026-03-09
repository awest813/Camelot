/**
 * SkillProgressionSystem — Oblivion-style use-based skill leveling.
 *
 * Unlike the SkillTreeSystem (which is a point-buy perk tree), this system
 * mirrors Oblivion's core: skills improve by *doing*.  Every time the player
 * swings a sword, casts a spell, sneaks past enemies, etc. the corresponding
 * skill gains XP.  Enough XP advances the skill level; higher levels improve
 * a stat multiplier that is queried by other systems.
 *
 * Skills and their natural triggers:
 *   blade        – melee attacks that connect
 *   destruction  – damaging spells cast
 *   restoration  – healing spells cast
 *   marksman     – arrows that connect
 *   sneak        – each second of active sneaking near NPCs
 *   speechcraft  – successful persuasion checks
 *   alchemy      – potions crafted
 *
 * Wire-up example (game.ts):
 * ```ts
 * this.skillProgressionSystem = new SkillProgressionSystem();
 * // When melee hits land:
 * this.skillProgressionSystem.gainXP("blade", 6);
 * // Query a multiplier (0-level→1.0, 100-level→2.0):
 * const bonus = this.skillProgressionSystem.multiplier("blade");
 * ```
 */

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum level any single skill can reach. */
export const SKILL_MAX_LEVEL = 100;

/**
 * XP required to advance from level N to N+1.
 * Formula: base + level × 12  (level 0→1 costs 50, level 99→100 costs 1,238)
 */
function xpToNext(level: number): number {
  return 50 + level * 12;
}

/**
 * Multiplier returned by `multiplier(skill)`.
 * Linear from 1.0 at level 0 to 2.0 at level 100.
 */
function levelToMultiplier(level: number): number {
  return 1 + level / SKILL_MAX_LEVEL;
}
// ── Types ─────────────────────────────────────────────────────────────────────

export type ProgressionSkillId =
  | "blade"
  | "destruction"
  | "restoration"
  | "marksman"
  | "sneak"
  | "speechcraft"
  | "alchemy";

export interface ProgressionSkill {
  id: ProgressionSkillId;
  /** Display name shown in notifications and UI. */
  name: string;
  /** Current level (0–100). */
  level: number;
  /** XP accumulated toward the next level. */
  xp: number;
  /** XP threshold for the *next* level-up. */
  xpToNext: number;
}

export interface SkillProgressionSaveState {
  skills: Array<{ id: ProgressionSkillId; level: number; xp: number }>;
}

// ── System ────────────────────────────────────────────────────────────────────

export class SkillProgressionSystem {
  private _skills: Map<ProgressionSkillId, ProgressionSkill>;

  /**
   * Fired whenever a skill levels up.
   * @param skillId  The skill that leveled up.
   * @param newLevel The new level (1–100).
   */
  public onSkillLevelUp: ((skillId: ProgressionSkillId, newLevel: number) => void) | null = null;

  constructor() {
    this._skills = new Map<ProgressionSkillId, ProgressionSkill>();
    const definitions: Array<{ id: ProgressionSkillId; name: string }> = [
      { id: "blade",       name: "Blade" },
      { id: "destruction", name: "Destruction" },
      { id: "restoration", name: "Restoration" },
      { id: "marksman",    name: "Marksman" },
      { id: "sneak",       name: "Sneak" },
      { id: "speechcraft", name: "Speechcraft" },
      { id: "alchemy",     name: "Alchemy" },
    ];
    for (const def of definitions) {
      this._skills.set(def.id, {
        id: def.id,
        name: def.name,
        level: 0,
        xp: 0,
        xpToNext: xpToNext(0),
      });
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Award XP to a skill.  If XP reaches the threshold the skill levels up
   * (potentially multiple times if a large amount is granted at once) and
   * `onSkillLevelUp` is fired for each level gained.
   *
   * @param skillId  The skill receiving XP.
   * @param amount   XP to add (clamped to a minimum of 0).
   */
  public gainXP(skillId: ProgressionSkillId, amount: number): void {
    const skill = this._skills.get(skillId);
    if (!skill) return;
    if (amount <= 0 || skill.level >= SKILL_MAX_LEVEL) return;

    skill.xp += amount;

    while (skill.xp >= skill.xpToNext && skill.level < SKILL_MAX_LEVEL) {
      skill.xp      -= skill.xpToNext;
      skill.level   += 1;
      skill.xpToNext = xpToNext(skill.level);
      this.onSkillLevelUp?.(skill.id, skill.level);
    }

    // Prevent XP overflow at max level
    if (skill.level >= SKILL_MAX_LEVEL) {
      skill.xp = 0;
    }
  }

  /**
   * Returns the combat/effect multiplier for a skill in [1.0, 2.0].
   * Level 0 → 1.0 (no bonus), level 100 → 2.0 (+100% bonus).
   */
  public multiplier(skillId: ProgressionSkillId): number {
    const skill = this._skills.get(skillId);
    return skill ? levelToMultiplier(skill.level) : 1;
  }

  /**
   * Returns the skill object for reading level/xp values.
   * Returns `undefined` for unknown skill IDs.
   */
  public getSkill(skillId: ProgressionSkillId): Readonly<ProgressionSkill> | undefined {
    return this._skills.get(skillId);
  }

  /**
   * Returns all tracked skills in a stable order.
   */
  public getAllSkills(): ReadonlyArray<Readonly<ProgressionSkill>> {
    return Array.from(this._skills.values());
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  public getSaveState(): SkillProgressionSaveState {
    return {
      skills: Array.from(this._skills.values()).map(s => ({
        id: s.id,
        level: s.level,
        xp: s.xp,
      })),
    };
  }

  public restoreFromSave(data: SkillProgressionSaveState): void {
    if (!Array.isArray(data?.skills)) return;
    for (const entry of data.skills) {
      const skill = this._skills.get(entry.id);
      if (!skill) continue;
      if (typeof entry.level === "number") {
        skill.level = Math.max(0, Math.min(SKILL_MAX_LEVEL, Math.round(entry.level)));
      }
      if (typeof entry.xp === "number") {
        skill.xp = Math.max(0, entry.xp);
      }
      skill.xpToNext = xpToNext(skill.level);
    }
  }
}
