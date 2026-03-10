/**
 * BirthsignSystem — Oblivion-style birthsign selection and passive bonuses.
 *
 * At character creation the player selects one of 13 birthsigns (grouped under
 * three Guardian constellations: Warrior, Mage, and Thief).  Each sign applies
 * permanent passive bonuses to attributes, maximum stats, or carry capacity,
 * and many also grant a rechargeable once-per-day special power.
 *
 * Integration points:
 *   - `chooseBirthsign(id, attributeSystem?, skillSystem?)` applies all passive
 *     bonuses immediately and stores the selection for save/load.
 *   - `activatePower(currentGameTimeMinutes)` uses the birthsign's special power
 *     if it is off cooldown.
 *   - `getStatBonuses()` returns extra max-stat deltas to apply on top of the
 *     attribute-derived values (e.g. the Mage's +50 Magicka).
 *   - `stunted` signals that the player has no natural magicka regeneration
 *     (Atronach sign); query this in the regeneration loop.
 *
 * Wire-up example (game.ts):
 * ```ts
 * this.birthsignSystem = new BirthsignSystem();
 * // At character creation:
 * this.birthsignSystem.chooseBirthsign(
 *   "mage",
 *   this.attributeSystem,
 *   this.skillProgressionSystem,
 * );
 * // Each frame — adjust player max stats:
 * const bonuses = this.birthsignSystem.getStatBonuses();
 * this.player.maxMagicka = this.attributeSystem.maxMagicka + bonuses.maxMagicka;
 * // Once-per-day power:
 * this.birthsignSystem.activatePower(this.timeSystem.gameTime);
 * ```
 */

import type { AttributeSystem, AttributeSet } from "./attribute-system";
import type { SkillProgressionSystem, ProgressionSkillId } from "./skill-progression-system";

// ── Types ──────────────────────────────────────────────────────────────────────

/** Guardian constellation grouping. */
export type BirthsignGuardian = "warrior" | "mage" | "thief";

/** Rechargeable special power granted by some birthsigns. */
export interface BirthsignPower {
  /** Unique identifier. */
  id: string;
  /** Display name shown in UI. */
  name: string;
  /** Short description of what the power does. */
  description: string;
  /** Recharge time in in-game hours (usually 24 = once per day). */
  cooldownHours: number;
}

/** Full birthsign definition. */
export interface BirthsignDefinition {
  /** Unique identifier (slug). */
  id: string;
  /** Display name. */
  name: string;
  /** Flavour description shown at character creation. */
  description: string;
  /** Guardian constellation this sign belongs to. */
  guardian: BirthsignGuardian;
  /**
   * Permanent attribute base increases applied when the sign is chosen.
   * Each key increases that attribute's base value by the given amount.
   */
  attributeBonus?: Partial<AttributeSet>;
  /**
   * Skill level bonuses applied once at character-creation time via
   * `SkillProgressionSystem.setSkillLevel`.
   */
  skillBonus?: Partial<Record<ProgressionSkillId, number>>;
  /** Flat bonus added to max Magicka (independent of intelligence/willpower). */
  maxMagickaBonus?: number;
  /** Flat bonus added to max Health (independent of endurance). */
  maxHealthBonus?: number;
  /** Flat bonus added to max Stamina (independent of strength/endurance). */
  maxStaminaBonus?: number;
  /** Flat carry-weight bonus. */
  carryWeightBonus?: number;
  /**
   * When `true` the player's magicka does not regenerate naturally.
   * (Atronach birthsign — Stunted Magicka.)
   */
  stunted?: boolean;
  /**
   * Percentage weakness to fire damage [0, 1].
   * Query with `fireWeakness` to apply in the combat system.
   */
  fireWeakness?: number;
  /** Once-per-day (or per-cooldown) special power. */
  power?: BirthsignPower;
}

/** State saved to disk. */
export interface BirthsignSaveState {
  /** The chosen birthsign id, or null if none chosen. */
  chosenId: string | null;
  /** Game time (minutes) when the power was last used, or null if never. */
  lastPowerUseTime: number | null;
}

/** Flat extra max-stat bonuses contributed by the chosen birthsign. */
export interface BirthsignStatBonuses {
  maxHealth: number;
  maxMagicka: number;
  maxStamina: number;
  carryWeight: number;
}

// ── Birthsign catalogue ────────────────────────────────────────────────────────

/**
 * The thirteen birthsigns mirroring Oblivion's constellations.
 * Attribute bonus values are designed to be meaningful but not overpowering.
 */
export const BIRTHSIGNS: ReadonlyArray<BirthsignDefinition> = [
  // ── Warrior signs ──────────────────────────────────────────────────────────
  {
    id: "warrior",
    name: "The Warrior",
    guardian: "warrior",
    description:
      "The Warrior is the most common Guardian sign. Those born under it are more " +
      "skilled with weapons and recover stamina quickly.",
    attributeBonus: { strength: 10, endurance: 10 },
  },
  {
    id: "lady",
    name: "The Lady",
    guardian: "warrior",
    description:
      "The Lady is one of the Warrior signs. Those born under her sign recover " +
      "health and willpower faster and are more durable in a fight.",
    attributeBonus: { endurance: 10, willpower: 10 },
  },
  {
    id: "lord",
    name: "The Lord",
    guardian: "warrior",
    description:
      "The Lord is a Warrior sign associated with protection and endurance, but " +
      "those born under it share a weakness to fire.",
    fireWeakness: 0.25,
    power: {
      id: "blood_of_the_north",
      name: "Blood of the North",
      description: "Restore 150 points of Health.",
      cooldownHours: 24,
    },
  },
  {
    id: "steed",
    name: "The Steed",
    guardian: "warrior",
    description:
      "Those born under the sign of the Steed are swift of foot and can carry " +
      "heavier burdens than most.",
    attributeBonus: { speed: 20 },
    carryWeightBonus: 100,
  },
  {
    id: "ritual",
    name: "The Ritual",
    guardian: "warrior",
    description:
      "The Ritual is a Warrior sign with two magic effects. Those born under it " +
      "may call upon Mara's Gift to restore their health once a day.",
    power: {
      id: "maras_gift",
      name: "Mara's Gift",
      description: "Restore 200 points of Health.",
      cooldownHours: 24,
    },
  },
  // ── Mage signs ─────────────────────────────────────────────────────────────
  {
    id: "mage",
    name: "The Mage",
    guardian: "mage",
    description:
      "The Mage is a Guardian sign. Those born under it have more Magicka and " +
      "are more skilled in the magical arts.",
    maxMagickaBonus: 50,
  },
  {
    id: "apprentice",
    name: "The Apprentice",
    guardian: "mage",
    description:
      "Those born under the sign of the Apprentice have a larger Magicka pool " +
      "than most, but are vulnerable to magic.",
    maxMagickaBonus: 100,
  },
  {
    id: "atronach",
    name: "The Atronach",
    guardian: "mage",
    description:
      "The Atronach sign grants a massive Magicka pool, but those born under it " +
      "cannot regenerate Magicka naturally — they must absorb or restore it.",
    maxMagickaBonus: 150,
    stunted: true,
  },
  {
    id: "tower",
    name: "The Tower",
    guardian: "thief",
    description:
      "Those born under the Tower can use the Tower Key ability once per day to " +
      "open a lock of any difficulty.",
    power: {
      id: "tower_key",
      name: "Tower Key",
      description: "Open any lock.",
      cooldownHours: 24,
    },
  },
  // ── Thief signs ────────────────────────────────────────────────────────────
  {
    id: "thief",
    name: "The Thief",
    guardian: "thief",
    description:
      "The Thief is the last of the Guardian signs. Those born under it are more " +
      "nimble and lucky, though perhaps not as reliable.",
    attributeBonus: { agility: 10, speed: 10, luck: 10 },
  },
  {
    id: "shadow",
    name: "The Shadow",
    guardian: "thief",
    description:
      "Those born under the Shadow can call upon Moonshadow to make themselves " +
      "invisible for a short time once per day.",
    power: {
      id: "moonshadow",
      name: "Moonshadow",
      description: "Become invisible for 60 seconds.",
      cooldownHours: 24,
    },
  },
  {
    id: "lover",
    name: "The Lover",
    guardian: "thief",
    description:
      "Those born under the Lover sign can use the Lover's Kiss ability once " +
      "per day to paralyze an opponent.",
    power: {
      id: "lovers_kiss",
      name: "Lover's Kiss",
      description: "Paralyze a target for 10 seconds.",
      cooldownHours: 24,
    },
  },
  {
    id: "serpent",
    name: "The Serpent",
    guardian: "thief",
    description:
      "The Serpent is the most powerful and most rare sign. Those born under it " +
      "can poison those who try to harm them, but have no other advantage.",
    power: {
      id: "serpents_spell",
      name: "Serpent's Spell",
      description: "Poison a target for 3 points per second over 20 seconds.",
      cooldownHours: 24,
    },
  },
];

// ── System ────────────────────────────────────────────────────────────────────

export class BirthsignSystem {
  private _chosenId: string | null = null;
  private _lastPowerUseTime: number | null = null;
  /** Quick-lookup map built from the catalogue. */
  private static readonly _catalogue: ReadonlyMap<string, BirthsignDefinition> = new Map(
    BIRTHSIGNS.map((b) => [b.id, b]),
  );

  /**
   * Fired once when a birthsign is chosen.
   * @param birthsign  The chosen birthsign definition.
   */
  public onBirthsignChosen: ((birthsign: BirthsignDefinition) => void) | null = null;

  /**
   * Fired when the birthsign's special power is successfully activated.
   * @param power  The power that was activated.
   */
  public onPowerActivated: ((power: BirthsignPower) => void) | null = null;

  // ── Catalogue queries ─────────────────────────────────────────────────────

  /** All available birthsign definitions. */
  public get all(): ReadonlyArray<BirthsignDefinition> {
    return BIRTHSIGNS;
  }

  /** Look up a birthsign by id. Returns `undefined` for unknown ids. */
  public getDefinition(id: string): BirthsignDefinition | undefined {
    return BirthsignSystem._catalogue.get(id);
  }

  // ── Selection ─────────────────────────────────────────────────────────────

  /** The currently selected birthsign definition, or `null` if none chosen. */
  public get chosenBirthsign(): BirthsignDefinition | null {
    return this._chosenId ? (BirthsignSystem._catalogue.get(this._chosenId) ?? null) : null;
  }

  /**
   * Choose a birthsign and apply its passive bonuses.
   *
   * Can only be called once per session (returns `false` if already chosen).
   * Applies attribute base increases to `attributeSystem` and starting skill
   * bonuses to `skillSystem` if those systems are provided.
   *
   * @param id               Birthsign id (e.g. `"mage"`, `"warrior"`).
   * @param attributeSystem  Optional: system to receive attribute bonuses.
   * @param skillSystem      Optional: system to receive skill starting bonuses.
   * @returns `true` if the birthsign was chosen successfully.
   */
  public chooseBirthsign(
    id: string,
    attributeSystem?: AttributeSystem,
    skillSystem?: SkillProgressionSystem,
  ): boolean {
    if (this._chosenId !== null) return false;

    const def = BirthsignSystem._catalogue.get(id);
    if (!def) return false;

    this._chosenId = id;

    // Apply attribute bonuses
    if (attributeSystem && def.attributeBonus) {
      for (const [attr, bonus] of Object.entries(def.attributeBonus)) {
        if (typeof bonus === "number" && bonus !== 0) {
          const current = attributeSystem.get(attr as keyof AttributeSet);
          attributeSystem.setBase(attr as keyof AttributeSet, current + bonus);
        }
      }
    }

    // Apply skill starting bonuses
    if (skillSystem && def.skillBonus) {
      for (const [skill, bonus] of Object.entries(def.skillBonus)) {
        if (typeof bonus === "number" && bonus > 0) {
          const current = skillSystem.getSkill(skill as ProgressionSkillId)?.level ?? 0;
          skillSystem.setSkillLevel(skill as ProgressionSkillId, current + bonus);
        }
      }
    }

    this.onBirthsignChosen?.(def);
    return true;
  }

  // ── Special power ─────────────────────────────────────────────────────────

  /** Whether the chosen birthsign has a special power. */
  public get hasPower(): boolean {
    return !!this.chosenBirthsign?.power;
  }

  /**
   * Returns `true` when the special power is available (not on cooldown).
   *
   * @param currentGameTimeMinutes  Current game time from TimeSystem.
   */
  public canActivatePower(currentGameTimeMinutes: number): boolean {
    const def = this.chosenBirthsign;
    if (!def?.power) return false;
    if (this._lastPowerUseTime === null) return true;
    const cooldownMinutes = def.power.cooldownHours * 60;
    return (currentGameTimeMinutes - this._lastPowerUseTime) >= cooldownMinutes;
  }

  /**
   * Activate the birthsign's special power if it is not on cooldown.
   *
   * @param currentGameTimeMinutes  Current game time from TimeSystem.
   * @returns `true` if the power was activated; `false` if on cooldown or no power.
   */
  public activatePower(currentGameTimeMinutes: number): boolean {
    if (!this.canActivatePower(currentGameTimeMinutes)) return false;

    const power = this.chosenBirthsign!.power!;
    this._lastPowerUseTime = currentGameTimeMinutes;
    this.onPowerActivated?.(power);
    return true;
  }

  /**
   * Remaining cooldown in minutes before the power can be used again.
   * Returns 0 when ready.
   */
  public powerCooldownRemaining(currentGameTimeMinutes: number): number {
    const def = this.chosenBirthsign;
    if (!def?.power || this._lastPowerUseTime === null) return 0;
    const cooldownMinutes = def.power.cooldownHours * 60;
    const elapsed = currentGameTimeMinutes - this._lastPowerUseTime;
    return Math.max(0, cooldownMinutes - elapsed);
  }

  // ── Passive flags ─────────────────────────────────────────────────────────

  /**
   * `true` if the chosen birthsign prevents natural magicka regeneration
   * (Atronach sign).  Query this in the stamina/magicka regen loop.
   */
  public get stunted(): boolean {
    return this.chosenBirthsign?.stunted === true;
  }

  /**
   * Percentage fire-damage weakness contributed by the birthsign [0, 1].
   * Returns 0 when no weakness applies.
   */
  public get fireWeakness(): number {
    return this.chosenBirthsign?.fireWeakness ?? 0;
  }

  // ── Stat bonuses ──────────────────────────────────────────────────────────

  /**
   * Returns the flat max-stat bonuses from the chosen birthsign.
   * Add these to the attribute-derived maximums when computing player caps.
   */
  public getStatBonuses(): BirthsignStatBonuses {
    const def = this.chosenBirthsign;
    return {
      maxHealth:   def?.maxHealthBonus   ?? 0,
      maxMagicka:  def?.maxMagickaBonus  ?? 0,
      maxStamina:  def?.maxStaminaBonus  ?? 0,
      carryWeight: def?.carryWeightBonus ?? 0,
    };
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  public getSaveState(): BirthsignSaveState {
    return {
      chosenId:         this._chosenId,
      lastPowerUseTime: this._lastPowerUseTime,
    };
  }

  /**
   * Restores from save without re-applying attribute/skill bonuses
   * (those are already baked into the saved AttributeSystem/SkillProgressionSystem
   * states that are restored by their own systems).
   */
  public restoreFromSave(state: BirthsignSaveState): void {
    if (!state || typeof state !== "object") return;

    const id = state.chosenId;
    if (typeof id === "string" && BirthsignSystem._catalogue.has(id)) {
      this._chosenId = id;
    } else if (id === null) {
      this._chosenId = null;
    }

    if (typeof state.lastPowerUseTime === "number" && Number.isFinite(state.lastPowerUseTime)) {
      this._lastPowerUseTime = state.lastPowerUseTime;
    } else {
      this._lastPowerUseTime = null;
    }
  }
}
