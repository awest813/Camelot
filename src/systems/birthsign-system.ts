/**
 * BirthsignSystem — the omens a hero was born under, and their gifts.
 *
 * At character creation the player selects one of 13 omens (called birthsigns
 * in code), grouped as omens of the sword, the cup and the road.  Each sign applies
 * permanent passive bonuses to attributes, maximum stats, or carry capacity,
 * and many also grant a rechargeable once-per-day special power.
 *
 * Integration points:
 *   - `chooseBirthsign(id, attributeSystem?, skillSystem?)` applies all passive
 *     bonuses immediately and stores the selection for save/load.
 *   - `activatePower(currentGameTimeMinutes)` uses the birthsign's special power
 *     if it is off cooldown.
 *   - `getStatBonuses()` returns extra max-stat deltas to apply on top of the
 *     attribute-derived values (e.g. the Lady of the Lake's +50 Magicka).
 *   - `stunted` signals that the player has no natural magicka regeneration
 *     (the Cauldron); query this in the regeneration loop.
 *
 * Wire-up example (game.ts):
 * ```ts
 * this.birthsignSystem = new BirthsignSystem();
 * // At character creation:
 * this.birthsignSystem.chooseBirthsign(
 *   "lady_lake",
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

/** The omen's group: of the sword (warrior), the cup (mage) or the road (thief). */
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
  /** The omen's group (sword, cup or road). */
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
   * (The Cauldron: magicka does not return on its own.)
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
 * The thirteen omens of the realm.
 * Attribute bonus values are designed to be meaningful but not overpowering.
 */
export const BIRTHSIGNS: ReadonlyArray<BirthsignDefinition> = [
  // ── Omens of the sword ─────────────────────────────────────────────────────
  {
    id: "sword_stone",
    name: "The Sword in the Stone",
    guardian: "warrior",
    description:
      "Born when the sword would not leave the stone for any hand but one, you " +
      "are strong of arm and slow to tire.",
    attributeBonus: { strength: 10, endurance: 10 },
  },
  {
    id: "round_table",
    name: "The Round Table",
    guardian: "warrior",
    description:
      "Born on a feast day, when every seat at the great table was full.  You " +
      "keep your feet in a fight and your heart in a crisis.",
    attributeBonus: { endurance: 10, willpower: 10 },
  },
  {
    id: "red_dragon",
    name: "The Red Dragon",
    guardian: "warrior",
    description:
      "Born the night the red dragon of the old prophecy was seen over the hills. " +
      "Once a day the dragon's blood in you closes your wounds, but the fire " +
      "that made you still answers to you: you burn more easily.",
    fireWeakness: 0.25,
    power: {
      id: "pendragons_blood",
      name: "Pendragon's Blood",
      description: "Restore 150 points of Health.",
      cooldownHours: 24,
    },
  },
  {
    id: "white_hart",
    name: "The White Hart",
    guardian: "warrior",
    description:
      "Born while the white hart ran before the hunt and was never caught.  You " +
      "are swift of foot and carry more than most.",
    attributeBonus: { speed: 20 },
    carryWeightBonus: 100,
  },
  {
    id: "grail",
    name: "The Grail",
    guardian: "mage",
    description:
      "Born in the hour the grail was glimpsed in the hall.  Once a day its grace " +
      "makes you whole.",
    power: {
      id: "grails_grace",
      name: "Grail's Grace",
      description: "Restore 200 points of Health.",
      cooldownHours: 24,
    },
  },
  // ── Omens of the cup ───────────────────────────────────────────────────────
  {
    id: "lady_lake",
    name: "The Lady of the Lake",
    guardian: "mage",
    description:
      "Born beside still water, under the Lady's eye.  You hold more magicka than " +
      "most, and spells come easily to you.",
    maxMagickaBonus: 50,
  },
  {
    id: "isle_apples",
    name: "The Isle of Apples",
    guardian: "mage",
    description:
      "Born as the mist lifted over the isle where the wounded king was carried. " +
      "Your well of magicka runs deep.",
    maxMagickaBonus: 100,
  },
  {
    id: "cauldron",
    name: "The Cauldron",
    guardian: "mage",
    description:
      "Born under the cauldron of the Otherworld, which gives without end and " +
      "never refills itself.  Your magicka is vast, but it does not return on its " +
      "own: you must drink it back.",
    maxMagickaBonus: 150,
    stunted: true,
  },
  {
    id: "locked_door",
    name: "The Locked Door",
    guardian: "thief",
    description:
      "Born behind a door no key could open.  Once a day no lock can keep you out.",
    power: {
      id: "wardens_key",
      name: "Warden's Key",
      description: "Open any lock.",
      cooldownHours: 24,
    },
  },
  // ── Omens of the road ──────────────────────────────────────────────────────
  {
    id: "raven",
    name: "The Raven",
    guardian: "thief",
    description:
      "Born as the ravens left the tower.  You are quick, light-fingered and " +
      "luckier than you deserve.",
    attributeBonus: { agility: 10, speed: 10, luck: 10 },
  },
  {
    id: "hollow_hill",
    name: "The Hollow Hill",
    guardian: "thief",
    description:
      "Born on the night the fair folk opened their hill.  Once a day you can " +
      "step out of sight, as they do.",
    power: {
      id: "under_the_hill",
      name: "Under the Hill",
      description: "Vanish for 60 seconds: no one sees or hears you, and foes lose your trail.",
      cooldownHours: 24,
    },
  },
  {
    id: "enchantress",
    name: "The Enchantress",
    guardian: "thief",
    description:
      "Born while the enchantress sang in the wood.  Once a day you can hold " +
      "a foe spellbound.",
    power: {
      id: "spellbound",
      name: "Spellbound",
      description: "Hold a target spellbound for 10 seconds.",
      cooldownHours: 24,
    },
  },
  {
    id: "adder",
    name: "The Adder",
    guardian: "thief",
    description:
      "The rarest omen: born as the adder struck at the feast.  Once a day your " +
      "touch carries its venom, but it brings no other gift.",
    power: {
      id: "adders_bite",
      name: "Adder's Bite",
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
   * (the Cauldron).  Query this in the stamina/magicka regen loop.
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
