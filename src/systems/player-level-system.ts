/**
 * PlayerLevelSystem — Oblivion-style skill-based character leveling.
 *
 * In Oblivion, your character level advances when you have earned 10 level-ups
 * across your class's major skills.  At that point you enter a level-up screen
 * where you choose 3 attributes to improve; each attribute's bonus (+1 to +5)
 * is proportional to how many of its governing skills you leveled during that
 * character level.
 *
 * How it works in Camelot:
 *   1. Call `attachToClassSystem()` so the system knows which skills are major.
 *   2. Call `handleSkillLevelUp(skillId)` whenever a skill levels up (hook it
 *      into `SkillProgressionSystem.onSkillLevelUp`).
 *   3. When 10 major-skill level-ups accumulate the `onLevelUpReady` callback
 *      fires with the available attribute bonuses.
 *   4. Call `confirmLevelUp(primary, secondary1, secondary2)` to apply three
 *      chosen attribute bonuses and advance `characterLevel`.
 *   5. `onLevelUpComplete(newLevel)` fires after the attributes are applied.
 *
 * Skill → governing attribute mapping (adapted from Oblivion):
 *   blade        → strength
 *   block        → endurance
 *   destruction  → willpower
 *   restoration  → willpower
 *   marksman     → agility
 *   sneak        → speed
 *   speechcraft  → luck
 *   alchemy      → intelligence
 *
 * Attribute bonus formula (Oblivion multiplier table):
 *   0 governing skill level-ups this level → +1
 *   1–4  → +2
 *   5–7  → +3
 *   8–9  → +4
 *   10+  → +5
 *
 * Wire-up example (game.ts):
 * ```ts
 * this.playerLevelSystem = new PlayerLevelSystem();
 * this.playerLevelSystem.attachToClassSystem(this.classSystem);
 * this.playerLevelSystem.attachToAttributeSystem(this.attributeSystem);
 * this.skillProgressionSystem.onSkillLevelUp = (skillId, newLevel) => {
 *   this.playerLevelSystem.handleSkillLevelUp(skillId);
 *   // ... rest of existing handler ...
 * };
 * this.playerLevelSystem.onLevelUpReady = (bonuses) => {
 *   this.ui.showNotification("Level up ready! Press G to apply attribute bonuses.", 4000);
 * };
 * this.playerLevelSystem.onLevelUpComplete = (newLevel) => {
 *   this.ui.showNotification(`Character Level ${newLevel}!`, 4000);
 * };
 * ```
 */

import type { AttributeSystem, AttributeName } from "./attribute-system";
import type { ClassSystem } from "./class-system";
import type { ProgressionSkillId } from "./skill-progression-system";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Number of major-skill level-ups required to trigger a character level-up. */
export const MAJOR_LEVELUPS_REQUIRED = 10;

// ── Skill → Governing Attribute Mapping ──────────────────────────────────────

/**
 * Maps each skill to the attribute it governs (following Oblivion conventions
 * adapted for Camelot's attribute and skill sets).
 */
export const SKILL_GOVERNING_ATTRIBUTE: Readonly<Record<ProgressionSkillId, AttributeName>> = {
  blade:       "strength",
  block:       "endurance",
  destruction: "willpower",
  restoration: "willpower",
  marksman:    "agility",
  sneak:       "speed",
  speechcraft: "luck",
  alchemy:     "intelligence",
};

// ── Types ─────────────────────────────────────────────────────────────────────

/** Per-attribute level-up counts for the current character level. */
export type AttributeLevelUpCounts = Record<AttributeName, number>;

/** Available attribute bonuses at a pending level-up. */
export type AttributeBonuses = Record<AttributeName, number>;

/** Saved state written to disk. */
export interface PlayerLevelSaveState {
  /** Oblivion-style character level (separate from XP-based player.level). */
  characterLevel: number;
  /** Major-skill level-ups accumulated this character level. */
  majorLevelUpsThisLevel: number;
  /** Per-attribute governing-skill level-up counts this character level. */
  attributeLevelUpCounts: AttributeLevelUpCounts;
  /** Whether a level-up is currently pending (player has not yet confirmed). */
  levelUpPending: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Oblivion's multiplier table: converts skill level-ups for a governing
 * attribute into the flat bonus awarded when that attribute is chosen.
 */
export function attributeBonusForLevelUps(levelUpCount: number): number {
  if (levelUpCount >= 10) return 5;
  if (levelUpCount >= 8)  return 4;
  if (levelUpCount >= 5)  return 3;
  if (levelUpCount >= 1)  return 2;
  return 1;
}

/** Build the default (all-zero) level-up count record. */
function makeEmptyAttributeCounts(): AttributeLevelUpCounts {
  return {
    strength:     0,
    endurance:    0,
    intelligence: 0,
    agility:      0,
    willpower:    0,
    speed:        0,
    luck:         0,
  };
}

// ── System ────────────────────────────────────────────────────────────────────

export class PlayerLevelSystem {
  // ── Linked systems ──────────────────────────────────────────────────────────

  private _classSystem: ClassSystem | null = null;
  private _attributeSystem: AttributeSystem | null = null;

  // ── Runtime state ───────────────────────────────────────────────────────────

  /** Oblivion-style character level (starts at 1, advances when confirmed). */
  private _characterLevel = 1;

  /** Cumulative major-skill level-ups since the last character level-up. */
  private _majorLevelUpsThisLevel = 0;

  /**
   * Per-attribute governing-skill level-up counter for the current level.
   * Used to compute the bonus when the player chooses which attributes to raise.
   */
  private _attributeLevelUpCounts: AttributeLevelUpCounts = makeEmptyAttributeCounts();

  /** True while a level-up is pending and has not yet been confirmed. */
  private _levelUpPending = false;

  // ── Callbacks ───────────────────────────────────────────────────────────────

  /**
   * Fired when 10 major-skill level-ups have been accumulated and a character
   * level-up is now available.  The `bonuses` argument contains the maximum
   * available bonus for every attribute — pass it to the UI to let the player
   * choose 3 attributes to increase.
   */
  public onLevelUpReady: ((bonuses: AttributeBonuses) => void) | null = null;

  /**
   * Fired after `confirmLevelUp()` successfully applies the bonuses.
   * @param newLevel The new `characterLevel`.
   */
  public onLevelUpComplete: ((newLevel: number) => void) | null = null;

  // ── Injection ───────────────────────────────────────────────────────────────

  /** Attach the ClassSystem so `isMajorSkill()` can be queried. */
  public attachToClassSystem(cs: ClassSystem): void {
    this._classSystem = cs;
  }

  /** Attach the AttributeSystem so `confirmLevelUp()` can apply bonuses. */
  public attachToAttributeSystem(as: AttributeSystem): void {
    this._attributeSystem = as;
  }

  // ── Accessors ────────────────────────────────────────────────────────────────

  /** Current Oblivion-style character level (1-based). */
  public get characterLevel(): number {
    return this._characterLevel;
  }

  /** How many major-skill level-ups have been earned since the last level-up. */
  public get majorLevelUpsThisLevel(): number {
    return this._majorLevelUpsThisLevel;
  }

  /** True when a level-up is pending and waiting for `confirmLevelUp()`. */
  public get levelUpPending(): boolean {
    return this._levelUpPending;
  }

  /**
   * Returns the available attribute bonus for every attribute based on how many
   * times its governing skills were leveled during this character level.
   */
  public get availableBonuses(): AttributeBonuses {
    const bonuses: AttributeBonuses = {} as AttributeBonuses;
    const attrs: AttributeName[] = [
      "strength", "endurance", "intelligence", "agility", "willpower", "speed", "luck",
    ];
    for (const attr of attrs) {
      bonuses[attr] = attributeBonusForLevelUps(this._attributeLevelUpCounts[attr]);
    }
    return bonuses;
  }

  /**
   * Returns the three attributes with the highest available bonuses,
   * as a convenience when the caller wants to auto-apply the best choices.
   * In case of ties the canonical attribute order is used as a tiebreaker.
   */
  public get suggestedAttributes(): [AttributeName, AttributeName, AttributeName] {
    const bonuses = this.availableBonuses;
    const sorted = (Object.keys(bonuses) as AttributeName[]).sort(
      (a, b) => bonuses[b] - bonuses[a],
    );
    return [sorted[0], sorted[1], sorted[2]] as [AttributeName, AttributeName, AttributeName];
  }

  // ── Core API ─────────────────────────────────────────────────────────────────

  /**
   * Notify the system that a skill has leveled up.  Wire this into the
   * `SkillProgressionSystem.onSkillLevelUp` callback.
   *
   * @param skillId  The skill that gained a level.
   */
  public handleSkillLevelUp(skillId: ProgressionSkillId): void {
    // Always track the governing-attribute count (all skills, not just major).
    const govAttr = SKILL_GOVERNING_ATTRIBUTE[skillId];
    if (govAttr) {
      this._attributeLevelUpCounts[govAttr]++;
    }

    // Only major skills advance the level-up counter.
    if (this._classSystem && !this._classSystem.isMajorSkill(skillId)) return;
    // If no class has been chosen every skill is treated as non-major.
    if (!this._classSystem) return;

    if (this._levelUpPending) return; // already waiting for confirmation

    this._majorLevelUpsThisLevel++;

    if (this._majorLevelUpsThisLevel >= MAJOR_LEVELUPS_REQUIRED) {
      this._levelUpPending = true;
      this.onLevelUpReady?.(this.availableBonuses);
    }
  }

  /**
   * Apply the chosen attribute bonuses and advance the character level.
   *
   * The primary attribute receives its full computed bonus (1–5); each secondary
   * attribute also receives its full computed bonus.  The three chosen attributes
   * must be distinct.
   *
   * @param primary     Attribute to receive the primary bonus.
   * @param secondary1  First secondary attribute.
   * @param secondary2  Second secondary attribute.
   * @returns `true` on success; `false` if no level-up is pending, if the
   *          attribute system is not attached, or if duplicate attributes are
   *          given.
   */
  public confirmLevelUp(
    primary: AttributeName,
    secondary1: AttributeName,
    secondary2: AttributeName,
  ): boolean {
    if (!this._levelUpPending) return false;
    if (!this._attributeSystem) return false;
    if (primary === secondary1 || primary === secondary2 || secondary1 === secondary2) return false;

    const bonuses = this.availableBonuses;

    // Apply bonuses by incrementing the base value through setBase.
    this._applyAttributeBonus(primary, bonuses[primary]);
    this._applyAttributeBonus(secondary1, bonuses[secondary1]);
    this._applyAttributeBonus(secondary2, bonuses[secondary2]);

    // Advance character level and reset per-level counters.
    this._characterLevel++;
    this._majorLevelUpsThisLevel = 0;
    this._attributeLevelUpCounts = makeEmptyAttributeCounts();
    this._levelUpPending = false;

    this.onLevelUpComplete?.(this._characterLevel);
    return true;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private _applyAttributeBonus(attr: AttributeName, bonus: number): void {
    if (!this._attributeSystem || bonus <= 0) return;
    const current = this._attributeSystem.get(attr);
    this._attributeSystem.setBase(attr, current + bonus);
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  public getSaveState(): PlayerLevelSaveState {
    return {
      characterLevel: this._characterLevel,
      majorLevelUpsThisLevel: this._majorLevelUpsThisLevel,
      attributeLevelUpCounts: { ...this._attributeLevelUpCounts },
      levelUpPending: this._levelUpPending,
    };
  }

  public restoreFromSave(state: PlayerLevelSaveState): void {
    if (typeof state.characterLevel === "number") {
      this._characterLevel = Math.max(1, Math.floor(state.characterLevel));
    }
    if (typeof state.majorLevelUpsThisLevel === "number") {
      this._majorLevelUpsThisLevel = Math.max(0, Math.floor(state.majorLevelUpsThisLevel));
    }
    if (state.attributeLevelUpCounts && typeof state.attributeLevelUpCounts === "object") {
      const counts = makeEmptyAttributeCounts();
      for (const key of Object.keys(counts) as AttributeName[]) {
        const v = (state.attributeLevelUpCounts as Record<string, unknown>)[key];
        if (typeof v === "number" && Number.isFinite(v)) {
          counts[key] = Math.max(0, Math.floor(v));
        }
      }
      this._attributeLevelUpCounts = counts;
    }
    if (typeof state.levelUpPending === "boolean") {
      this._levelUpPending = state.levelUpPending;
    }
  }
}
