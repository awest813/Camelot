/**
 * ClassSystem — Oblivion-style character class selection.
 *
 * At character creation the player picks (or creates) a character class.
 * Each class defines:
 *
 *   - `specialization`      — "combat", "magic", or "stealth"; gives context
 *                             for the class role and a +5 starting bonus to
 *                             all skills in that specialization group.
 *   - `favoredAttributes`   — Two attributes that start 10 points higher.
 *   - `majorSkills`         — Three to four distinct skills that start at +25
 *                             and gain 1.5× XP.
 *
 * All seven skills not listed in `majorSkills` are automatically treated as
 * minor skills (1.25× XP, starting +10).
 *
 * Integration:
 *   1. `chooseClass(id, attributeSystem, skillSystem)` applies starting bonuses once.
 *   2. Wrap every `skillProgressionSystem.gainXP()` call with the multiplier:
 *      ```ts
 *      const mult = this.classSystem.xpMultiplierFor(skillId);
 *      this.skillProgressionSystem.gainXP(skillId, rawXP * mult);
 *      ```
 *
 * Wire-up example (game.ts):
 * ```ts
 * this.classSystem = new ClassSystem();
 * // At character creation:
 * this.classSystem.chooseClass("warrior", this.attributeSystem, this.skillProgressionSystem);
 * // When gaining blade XP:
 * const xp = 6 * this.classSystem.xpMultiplierFor("blade");
 * this.skillProgressionSystem.gainXP("blade", xp);
 * ```
 */

import type { AttributeSystem, AttributeName } from "./attribute-system";
import type { SkillProgressionSystem, ProgressionSkillId } from "./skill-progression-system";

// ── Types ──────────────────────────────────────────────────────────────────────

/** Combat specialization group. */
export type ClassSpecialization = "combat" | "magic" | "stealth";

/** All seven progression skill ids in a stable order. */
const ALL_SKILL_IDS: ReadonlyArray<ProgressionSkillId> = [
  "blade",
  "block",
  "destruction",
  "restoration",
  "marksman",
  "sneak",
  "speechcraft",
  "alchemy",
];

/** A character class definition. */
export interface CharacterClass {
  /** Unique identifier (slug). */
  id: string;
  /** Display name. */
  name: string;
  /** Flavour description shown at character creation. */
  description: string;
  /** Role specialization — combat / magic / stealth. */
  specialization: ClassSpecialization;
  /**
   * Two attributes that gain +`FAVORED_ATTRIBUTE_BONUS` to their base value
   * when this class is chosen.
   */
  favoredAttributes: [AttributeName, AttributeName];
  /**
   * Major skills (3–4 distinct ids).
   * These gain `MAJOR_SKILL_XP_MULTIPLIER` (1.5×) XP and start
   * `MAJOR_SKILL_START_BONUS` (25) levels higher.
   *
   * All remaining skills are automatically treated as minor skills and gain
   * `MINOR_SKILL_XP_MULTIPLIER` (1.25×) XP + `MINOR_SKILL_START_BONUS` (10)
   * starting levels.
   */
  majorSkills: ProgressionSkillId[];
}

/** State saved to disk. */
export interface ClassSaveState {
  /** Chosen class id, or null if none chosen. */
  chosenId: string | null;
}

// ── XP multipliers ────────────────────────────────────────────────────────────

/** XP multiplier for major skills. */
export const MAJOR_SKILL_XP_MULTIPLIER = 1.5;
/** XP multiplier for minor (non-major) skills. */
export const MINOR_SKILL_XP_MULTIPLIER = 1.25;
/** Starting skill level bonus for major skills. */
export const MAJOR_SKILL_START_BONUS = 25;
/** Starting skill level bonus for minor (non-major) skills. */
export const MINOR_SKILL_START_BONUS = 10;
/** Attribute base bonus for each favored attribute. */
export const FAVORED_ATTRIBUTE_BONUS = 10;

// ── Character class catalogue ─────────────────────────────────────────────────

/**
 * Ten preset classes mirroring Oblivion's built-in class roster, adapted to
 * the seven ProgressionSkillIds available in this engine.
 *
 * Each class lists 3–4 distinct major skills; all remaining skills are
 * automatically treated as minor skills.
 */
export const CHARACTER_CLASSES: ReadonlyArray<CharacterClass> = [
  // ── Combat specialization ─────────────────────────────────────────────────
  {
    id: "warrior",
    name: "Warrior",
    specialization: "combat",
    description:
      "Fearless and heavily armoured, Warriors excel in close-quarters combat. " +
      "Their strength and endurance make them difficult to put down.",
    favoredAttributes: ["strength", "endurance"],
    majorSkills: ["blade", "block", "marksman"],
  },
  {
    id: "knight",
    name: "Knight",
    specialization: "combat",
    description:
      "Knights are warriors bound by a chivalric code. They balance swordsmanship " +
      "with persuasion and a touch of restoration magic.",
    favoredAttributes: ["strength", "endurance"],
    majorSkills: ["blade", "block", "restoration", "speechcraft"],
  },
  {
    id: "barbarian",
    name: "Barbarian",
    specialization: "combat",
    description:
      "Barbarians rely on brute force and an intimidating presence. They hit hard " +
      "but care little for subtlety or magic.",
    favoredAttributes: ["strength", "agility"],
    majorSkills: ["blade", "marksman", "alchemy"],
  },
  // ── Magic specialization ──────────────────────────────────────────────────
  {
    id: "mage",
    name: "Mage",
    specialization: "magic",
    description:
      "Mages devote themselves to the magical arts, excelling in both destructive " +
      "and restorative schools of magic.",
    favoredAttributes: ["intelligence", "willpower"],
    majorSkills: ["destruction", "restoration", "alchemy"],
  },
  {
    id: "sorcerer",
    name: "Sorcerer",
    specialization: "magic",
    description:
      "Sorcerers focus on raw destructive power, channelling vast stores of " +
      "magicka into devastating spells.",
    favoredAttributes: ["intelligence", "willpower"],
    majorSkills: ["destruction", "alchemy", "sneak"],
  },
  {
    id: "healer",
    name: "Healer",
    specialization: "magic",
    description:
      "Healers are masters of restorative magic. Their willpower and intelligence " +
      "let them mend wounds that would fell lesser adventurers.",
    favoredAttributes: ["willpower", "intelligence"],
    majorSkills: ["restoration", "alchemy", "speechcraft"],
  },
  // ── Stealth specialization ────────────────────────────────────────────────
  {
    id: "thief",
    name: "Thief",
    specialization: "stealth",
    description:
      "Thieves move silently through the shadows, relying on agility and cunning " +
      "rather than brute force.",
    favoredAttributes: ["agility", "speed"],
    majorSkills: ["sneak", "speechcraft", "marksman"],
  },
  {
    id: "scout",
    name: "Scout",
    specialization: "stealth",
    description:
      "Scouts are wilderness experts equally at home sniping from afar or " +
      "disappearing into the undergrowth.",
    favoredAttributes: ["agility", "endurance"],
    majorSkills: ["marksman", "sneak", "alchemy"],
  },
  {
    id: "rogue",
    name: "Rogue",
    specialization: "stealth",
    description:
      "Rogues blend speed and surprise, using quick blades and nimble fingers " +
      "to take down foes before they can react.",
    favoredAttributes: ["agility", "speed"],
    majorSkills: ["blade", "sneak", "speechcraft"],
  },
  // ── Mixed specialization ──────────────────────────────────────────────────
  {
    id: "battlemage",
    name: "Battlemage",
    specialization: "magic",
    description:
      "Battlemages combine swordsmanship with destructive sorcery, making them " +
      "dangerous at any range and in any situation.",
    favoredAttributes: ["intelligence", "strength"],
    majorSkills: ["blade", "destruction", "alchemy"],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Skills belonging to each specialization category.
 * The game has fewer skills than Oblivion; this mapping approximates
 * the original groupings.
 */
const SPECIALIZATION_SKILLS: Record<ClassSpecialization, ReadonlySet<ProgressionSkillId>> = {
  combat:  new Set(["blade", "block", "marksman"]),
  magic:   new Set(["destruction", "restoration", "alchemy"]),
  stealth: new Set(["sneak", "speechcraft", "marksman"]),
};

// ── System ────────────────────────────────────────────────────────────────────

export class ClassSystem {
  private _chosenId: string | null = null;

  /** Quick-lookup map built from the catalogue. */
  private static readonly _catalogue: ReadonlyMap<string, CharacterClass> = new Map(
    CHARACTER_CLASSES.map((c) => [c.id, c]),
  );

  /**
   * Fired once when a class is chosen.
   * @param cls  The chosen CharacterClass definition.
   */
  public onClassChosen: ((cls: CharacterClass) => void) | null = null;

  // ── Catalogue queries ─────────────────────────────────────────────────────

  /** All available class definitions. */
  public get all(): ReadonlyArray<CharacterClass> {
    return CHARACTER_CLASSES;
  }

  /** Look up a class by id.  Returns `undefined` for unknown ids. */
  public getDefinition(id: string): CharacterClass | undefined {
    return ClassSystem._catalogue.get(id);
  }

  // ── Selection ─────────────────────────────────────────────────────────────

  /** The currently chosen class definition, or `null` if none chosen. */
  public get chosenClass(): CharacterClass | null {
    return this._chosenId ? (ClassSystem._catalogue.get(this._chosenId) ?? null) : null;
  }

  /**
   * Choose a character class and apply its starting bonuses.
   *
   * Can only be called once per session (returns `false` if already chosen).
   *
   * Bonuses applied:
   *   - Favored attributes: +`FAVORED_ATTRIBUTE_BONUS` to each.
   *   - Major skills:       `setSkillLevel` to current + `MAJOR_SKILL_START_BONUS`.
   *   - Minor skills:       `setSkillLevel` to current + `MINOR_SKILL_START_BONUS`.
   *   - Specialization:     +5 to all skills in the specialization group.
   *
   * @param id               Class id (e.g. `"warrior"`, `"mage"`).
   * @param attributeSystem  Optional: system to receive attribute bonuses.
   * @param skillSystem      Optional: system to receive skill starting bonuses.
   * @returns `true` if the class was chosen successfully.
   */
  public chooseClass(
    id: string,
    attributeSystem?: AttributeSystem,
    skillSystem?: SkillProgressionSystem,
  ): boolean {
    if (this._chosenId !== null) return false;

    const def = ClassSystem._catalogue.get(id);
    if (!def) return false;

    this._chosenId = id;

    // Apply favored-attribute bonuses
    if (attributeSystem) {
      for (const attr of def.favoredAttributes) {
        const current = attributeSystem.get(attr);
        attributeSystem.setBase(attr, current + FAVORED_ATTRIBUTE_BONUS);
      }
    }

    if (skillSystem) {
      const majorSet = new Set(def.majorSkills);

      // Apply specialization bonus (+5) to all specialization skills
      const specSkills = SPECIALIZATION_SKILLS[def.specialization];
      for (const skillId of specSkills) {
        const current = skillSystem.getSkill(skillId)?.level ?? 0;
        skillSystem.setSkillLevel(skillId, current + 5);
      }

      // Apply major skill starting bonus (stacks with specialization)
      for (const skillId of def.majorSkills) {
        const current = skillSystem.getSkill(skillId)?.level ?? 0;
        skillSystem.setSkillLevel(skillId, current + MAJOR_SKILL_START_BONUS);
      }

      // Apply minor skill starting bonus to all non-major skills
      for (const skillId of ALL_SKILL_IDS) {
        if (!majorSet.has(skillId)) {
          const current = skillSystem.getSkill(skillId)?.level ?? 0;
          skillSystem.setSkillLevel(skillId, current + MINOR_SKILL_START_BONUS);
        }
      }
    }

    this.onClassChosen?.(def);
    return true;
  }

  // ── XP multiplier ─────────────────────────────────────────────────────────

  /**
   * Returns the XP multiplier that should be applied when a skill gains XP.
   *
   * - Major skills → `MAJOR_SKILL_XP_MULTIPLIER` (1.5×)
   * - Minor (non-major) skills → `MINOR_SKILL_XP_MULTIPLIER` (1.25×)
   * - No class chosen → 1.0×
   *
   * Usage:
   * ```ts
   * const mult = this.classSystem.xpMultiplierFor("blade");
   * this.skillProgressionSystem.gainXP("blade", rawXP * mult);
   * ```
   */
  public xpMultiplierFor(skillId: ProgressionSkillId): number {
    const def = this.chosenClass;
    if (!def) return 1;
    if (def.majorSkills.includes(skillId)) return MAJOR_SKILL_XP_MULTIPLIER;
    // Any valid skill that isn't major is a minor skill
    if (ALL_SKILL_IDS.includes(skillId)) return MINOR_SKILL_XP_MULTIPLIER;
    return 1;
  }

  /**
   * Whether the given skill is a major skill for the chosen class.
   */
  public isMajorSkill(skillId: ProgressionSkillId): boolean {
    return this.chosenClass?.majorSkills.includes(skillId) === true;
  }

  /**
   * Whether the given skill is treated as a minor skill for the chosen class
   * (i.e. it is a valid skill but not in the major list).
   */
  public isMinorSkill(skillId: ProgressionSkillId): boolean {
    if (!this.chosenClass) return false;
    return ALL_SKILL_IDS.includes(skillId) && !this.chosenClass.majorSkills.includes(skillId);
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  public getSaveState(): ClassSaveState {
    return { chosenId: this._chosenId };
  }

  /**
   * Restores from save without re-applying starting bonuses (those are already
   * baked into the saved AttributeSystem / SkillProgressionSystem states).
   */
  public restoreFromSave(state: ClassSaveState): void {
    if (!state || typeof state !== "object") return;
    const id = state.chosenId;
    if (typeof id === "string" && ClassSystem._catalogue.has(id)) {
      this._chosenId = id;
    } else {
      this._chosenId = null;
    }
  }
}

