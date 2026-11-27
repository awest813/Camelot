/**
 * RaceSystem — the heritages: the peoples of the realm a hero can be born to.
 *
 * At character creation the player selects one of eight heritages (called
 * races in code).  Each race
 * applies permanent passive bonuses to base attributes and starting skill
 * levels, and all races carry a once-per-day rechargeable special power.
 *
 * Integration points:
 *   - `chooseRace(id, attributeSystem?, skillSystem?)` applies all passive
 *     bonuses immediately and stores the selection for save/load.
 *   - `activatePower(currentGameTimeMinutes, activeEffectsSystem?)` uses the
 *     racial power if it is off cooldown; dispatches real ActiveEffects.
 *   - `canActivatePower(currentGameTimeMinutes)` checks whether the power is
 *     ready to use (once per in-game day by default).
 *   - `powerCooldownRemaining(currentGameTimeMinutes)` returns minutes left.
 *   - `getSaveState()` / `restoreFromSave()` round-trip the chosen race id
 *     and power cooldown timestamp.
 *
 * Wire-up example (game.ts):
 * ```ts
 * this.raceSystem = new RaceSystem();
 * // At character creation:
 * this.raceSystem.chooseRace("hillfolk", this.attributeSystem, this.skillProgressionSystem);
 * // V key — activate racial power:
 * this.raceSystem.activatePower(this.timeSystem.gameTime, this.activeEffectsSystem);
 * ```
 */

import type { AttributeSystem, AttributeName } from "./attribute-system";
import type { SkillProgressionSystem, ProgressionSkillId } from "./skill-progression-system";
import type { ActiveEffectsSystem, ActiveEffectType } from "./active-effects-system";

// ── Types ──────────────────────────────────────────────────────────────────────

/** Base attribute set (partial) used for race bonuses. */
export type RaceAttributeBonus = Partial<Record<AttributeName, number>>;

/** Base skill bonus applied at character creation. */
export type RaceSkillBonus = Partial<Record<ProgressionSkillId, number>>;

/**
 * A single active effect dispatched when a racial power is activated.
 * The `effectType` maps directly to `ActiveEffectType` from ActiveEffectsSystem.
 */
export interface RacePowerEffect {
  /** Display label shown in the HUD while the effect is active. */
  name: string;
  /** Category; must match an `ActiveEffectType`. */
  effectType: ActiveEffectType;
  /**
   * Effect strength.  Interpretation follows `ActiveEffect.magnitude`:
   *   restore types  → units per second
   *   fortify types  → flat bonus amount
   *   resist_damage  → damage reduction percentage (0–100)
   */
  magnitude: number;
  /** Duration in real-time seconds. */
  duration: number;
}

/** Rechargeable special power granted to every race. */
export interface RacePower {
  /** Unique identifier (used as a prefix for ActiveEffect ids). */
  id: string;
  /** Display name shown in the HUD when activated. */
  name: string;
  /** Short description of what the power does. */
  description: string;
  /**
   * Recharge time in in-game hours.
   * Default: 24 (once per in-game day).
   */
  cooldownHours: number;
  /**
   * The actual `ActiveEffect` entries dispatched to `ActiveEffectsSystem`
   * when this power is activated.
   */
  effects: RacePowerEffect[];
}

/** A playable race definition. */
export interface RaceDefinition {
  /** Unique identifier (slug). */
  id: string;
  /** Display name. */
  name: string;
  /** Flavour description shown at character creation. */
  description: string;
  /** Where the people come from: the settled lands, the wild places, or the Otherworld. */
  heritage: "hearth" | "wild" | "fae";
  /**
   * Permanent attribute base increases applied when the race is chosen.
   * Positive values raise the base; negative values lower it.
   */
  attributeBonus?: RaceAttributeBonus;
  /**
   * Starting skill level bonuses applied once at character-creation time via
   * `SkillProgressionSystem.setSkillLevel`.
   */
  skillBonus?: RaceSkillBonus;
  /** Flat bonus added to max Magicka (independent of intelligence/willpower). */
  maxMagickaBonus?: number;
  /** Rechargeable racial power (once per in-game day by default). */
  power?: RacePower;
  /**
   * Elemental damage resistances / weaknesses expressed as a fraction in
   * [-1, 1].  Negative = weakness; positive = resistance.
   * e.g. `{ fire: 0.5 }` = 50 % fire resistance.
   */
  resistance?: {
    fire?: number;
    frost?: number;
    poison?: number;
    magic?: number;
  };
  /**
   * When `true` the race can breathe underwater indefinitely.
   * Used by `SwimmingSystem` to suppress breath drain for this race.
   */
  waterBreathing?: boolean;
  /** When `true` diseases never take hold (the Fen-folk). */
  diseaseImmune?: boolean;
}

/** State saved to disk. */
export interface RaceSaveState {
  /** Chosen race id, or null if none chosen. */
  chosenId: string | null;
  /** Game time (minutes) when the power was last used, or null if never used. */
  lastPowerUseTime: number | null;
}

// ── Race attribute/skill starting bonus magnitudes ────────────────────────────

/** Attribute base bonus for each racial attribute bonus. */
export const RACE_ATTRIBUTE_BONUS = 10;
/** Skill level bonus applied to racial favoured skills. */
export const RACE_SKILL_BONUS = 10;

// ── Race catalogue ────────────────────────────────────────────────────────────

/**
 * The eight heritages: the peoples of the realm of Camelot (invented, not
 * real-world peoples).  Each sets two attributes and two skills a little
 * ahead, may resist an element, and has a power usable once a day.
 */
export const RACES: ReadonlyArray<RaceDefinition> = [
  // ── Folk of the settled lands ─────────────────────────────────────────────
  {
    id: "lowlander",
    name: "Lowland-born",
    heritage: "hearth",
    description:
      "Raised in the market towns and manors of the heartland, the Lowland-born " +
      "learn courtesy before they learn the sword.  They talk their way through " +
      "most doors and mend what they cannot talk past.",
    attributeBonus: { willpower: RACE_ATTRIBUTE_BONUS, luck: RACE_ATTRIBUTE_BONUS },
    skillBonus: { speechcraft: RACE_SKILL_BONUS, restoration: RACE_SKILL_BONUS },
    power: {
      id: "kingsvoice",
      name: "Kingsvoice",
      description: "Speak with a lord's authority: take less harm and mend steadily for 30 seconds.",
      cooldownHours: 24,
      effects: [
        { name: "Kingsvoice",       effectType: "resist_damage",  magnitude: 25, duration: 30 },
        { name: "Steady Heart",     effectType: "health_restore", magnitude: 5,  duration: 30 },
      ],
    },
  },
  {
    id: "seaborn",
    name: "Sea-born",
    heritage: "hearth",
    description:
      "Fisher-folk and raiders of the western coves, the Sea-born are quick on a " +
      "pitching deck and hard to tire.  Salt and hard living have made them proof " +
      "against most poisons.",
    attributeBonus: { agility: RACE_ATTRIBUTE_BONUS, endurance: RACE_ATTRIBUTE_BONUS },
    skillBonus: { blade: RACE_SKILL_BONUS, marksman: RACE_SKILL_BONUS },
    resistance: { poison: 0.75 },
    power: {
      id: "second_wind",
      name: "Second Wind",
      description: "Find the strength of the last oar-stroke: stronger, and quick to recover, for 60 seconds.",
      cooldownHours: 24,
      effects: [
        { name: "Second Wind",      effectType: "fortify_strength", magnitude: 15, duration: 60 },
        { name: "Sea Legs",         effectType: "stamina_restore",  magnitude: 4,  duration: 60 },
      ],
    },
  },
  {
    id: "ashkin",
    name: "Ash-kin",
    heritage: "hearth",
    description:
      "From the burnt marches where the old wars were fought, the Ash-kin are " +
      "wiry and clever, as handy with a spell as with a blade.  Fire troubles " +
      "them less than it troubles others.",
    attributeBonus: { agility: RACE_ATTRIBUTE_BONUS, intelligence: RACE_ATTRIBUTE_BONUS },
    skillBonus: { blade: RACE_SKILL_BONUS, destruction: RACE_SKILL_BONUS },
    resistance: { fire: 0.5 },
    power: {
      id: "ember_blood",
      name: "Ember-blood",
      description: "Let the old fire rise: take less harm and keep your breath for 30 seconds.",
      cooldownHours: 24,
      effects: [
        { name: "Ember Ward",       effectType: "resist_damage",   magnitude: 30, duration: 30 },
        { name: "Ember-blood",      effectType: "stamina_restore", magnitude: 4,  duration: 30 },
      ],
    },
  },
  // ── Folk of the wild places ───────────────────────────────────────────────
  {
    id: "hillfolk",
    name: "Hill-folk",
    heritage: "wild",
    description:
      "Shepherds and spearmen of the high northern fells, the Hill-folk are strong " +
      "and enduring, and winters that would kill a lowlander only make them " +
      "grumble.  They are at home with a blade in hand.",
    attributeBonus: { strength: RACE_ATTRIBUTE_BONUS, endurance: RACE_ATTRIBUTE_BONUS },
    skillBonus: { blade: RACE_SKILL_BONUS },
    resistance: { frost: 0.5 },
    power: {
      id: "hill_fury",
      name: "Hill-fury",
      description: "Rouse the fury of the fells: stronger, and quick to recover, for 60 seconds.",
      cooldownHours: 24,
      effects: [
        { name: "Hill-fury",        effectType: "fortify_strength", magnitude: 20, duration: 60 },
        { name: "Fell-wind",        effectType: "stamina_restore",  magnitude: 5,  duration: 60 },
      ],
    },
  },
  {
    id: "forestkin",
    name: "Forest-kin",
    heritage: "wild",
    description:
      "Born under the great woods, the Forest-kin move without a sound and shoot " +
      "straighter than anyone in the realm.  They know which berries kill, and " +
      "shrug off the lesser poisons.",
    attributeBonus: { agility: RACE_ATTRIBUTE_BONUS, speed: RACE_ATTRIBUTE_BONUS },
    skillBonus: { marksman: RACE_SKILL_BONUS, sneak: RACE_SKILL_BONUS },
    resistance: { poison: 0.5 },
    power: {
      id: "hunters_stride",
      name: "Hunter's Stride",
      description: "Run with the hunt: stronger, and untiring, for 45 seconds.",
      cooldownHours: 24,
      effects: [
        { name: "Hunter's Stride",  effectType: "fortify_strength", magnitude: 10, duration: 45 },
        { name: "Deer's Wind",      effectType: "stamina_restore",  magnitude: 3,  duration: 45 },
      ],
    },
  },
  {
    id: "fenfolk",
    name: "Fen-folk",
    heritage: "wild",
    description:
      "The eel-catchers and reed-cutters of the eastern fens breathe the marsh as " +
      "easily as air: they can stay under water as long as they like, and the " +
      "fen-fevers and poisons that kill outsiders pass them by.",
    attributeBonus: { endurance: RACE_ATTRIBUTE_BONUS, agility: RACE_ATTRIBUTE_BONUS },
    skillBonus: { sneak: RACE_SKILL_BONUS, restoration: RACE_SKILL_BONUS },
    resistance: { poison: 1.0 },
    waterBreathing: true,
    diseaseImmune: true,
    power: {
      id: "marsh_mending",
      name: "Marsh-mending",
      description: "Draw on the slow strength of the fen to heal quickly for 15 seconds.",
      cooldownHours: 24,
      effects: [
        { name: "Marsh-mending",    effectType: "health_restore", magnitude: 20, duration: 15 },
      ],
    },
  },
  {
    id: "giantblood",
    name: "Giant-blooded",
    heritage: "wild",
    description:
      "Their grandmothers' grandmothers wed the giants of the old hills, the " +
      "stories say, and the Giant-blooded are the strongest folk in the realm. " +
      "They are slow to anger, and slower to stop.",
    attributeBonus: { strength: RACE_ATTRIBUTE_BONUS, endurance: RACE_ATTRIBUTE_BONUS, agility: -5 },
    skillBonus: { blade: RACE_SKILL_BONUS, block: RACE_SKILL_BONUS },
    resistance: { frost: 0.25 },
    power: {
      id: "berserk",
      name: "Berserk",
      description: "Let the giant's anger out: far stronger, and harder to hurt, for 60 seconds.",
      cooldownHours: 24,
      effects: [
        { name: "Giant's Anger",    effectType: "fortify_strength", magnitude: 30, duration: 60 },
        { name: "Thick Hide",       effectType: "resist_damage",    magnitude: 25, duration: 60 },
      ],
    },
  },
  // ── The fae-touched ───────────────────────────────────────────────────────
  {
    id: "faeblood",
    name: "Fae-blooded",
    heritage: "fae",
    description:
      "Somewhere in their line a mortal danced with the Fair Folk and came home " +
      "changed.  The Fae-blooded have deep wells of magicka and a gift for " +
      "spells, but cold iron and hard frost bite them deeper.",
    attributeBonus: { intelligence: RACE_ATTRIBUTE_BONUS, willpower: RACE_ATTRIBUTE_BONUS, endurance: -RACE_ATTRIBUTE_BONUS },
    skillBonus: { destruction: RACE_SKILL_BONUS, restoration: RACE_SKILL_BONUS },
    maxMagickaBonus: 100,
    resistance: { fire: -0.25, frost: -0.25, magic: 0.25 },
    power: {
      id: "glamour",
      name: "Glamour",
      description: "Call on the Otherworld: magicka floods back and the well runs deeper for 30 seconds.",
      cooldownHours: 24,
      effects: [
        { name: "Glamour",          effectType: "magicka_restore", magnitude: 25, duration: 15 },
        { name: "Deep Well",        effectType: "fortify_magicka", magnitude: 20, duration: 30 },
      ],
    },
  },
];

// ── System ────────────────────────────────────────────────────────────────────

export class RaceSystem {
  private _chosenId: string | null = null;
  private _lastPowerUseTime: number | null = null;

  /** Quick-lookup map built from the catalogue. */
  private static readonly _catalogue: ReadonlyMap<string, RaceDefinition> = new Map(
    RACES.map((r) => [r.id, r]),
  );

  /**
   * Fired once when a race is chosen.
   * @param race  The chosen RaceDefinition.
   */
  public onRaceChosen: ((race: RaceDefinition) => void) | null = null;

  /**
   * Fired whenever the racial power is successfully activated.
   * @param power  The power that was activated.
   */
  public onPowerActivated: ((power: RacePower) => void) | null = null;

  // ── Catalogue queries ─────────────────────────────────────────────────────

  /** All available race definitions. */
  public get all(): ReadonlyArray<RaceDefinition> {
    return RACES;
  }

  /** Look up a race by id.  Returns `undefined` for unknown ids. */
  public getDefinition(id: string): RaceDefinition | undefined {
    return RaceSystem._catalogue.get(id);
  }

  // ── Selection ─────────────────────────────────────────────────────────────

  /** The currently chosen race definition, or `null` if none chosen. */
  public get chosenRace(): RaceDefinition | null {
    return this._chosenId ? (RaceSystem._catalogue.get(this._chosenId) ?? null) : null;
  }

  /**
   * Choose a race and apply its starting bonuses.
   *
   * Can only be called once per session (returns `false` if already chosen).
   *
   * Bonuses applied:
   *   - Attribute bonuses: added to each attribute's base value.
   *   - Skill bonuses:     `setSkillLevel` to current + bonus amount.
   *
   * @param id               Race id (e.g. `"hillfolk"`, `"faeblood"`).
   * @param attributeSystem  Optional: system to receive attribute bonuses.
   * @param skillSystem      Optional: system to receive skill starting bonuses.
   * @returns `true` if the race was chosen successfully.
   */
  public chooseRace(
    id: string,
    attributeSystem?: AttributeSystem,
    skillSystem?: SkillProgressionSystem,
  ): boolean {
    if (this._chosenId !== null) return false;

    const def = RaceSystem._catalogue.get(id);
    if (!def) return false;

    this._chosenId = id;

    // Apply attribute bonuses
    if (attributeSystem && def.attributeBonus) {
      for (const [attr, delta] of Object.entries(def.attributeBonus) as [AttributeName, number][]) {
        if (delta === 0) continue;
        const current = attributeSystem.get(attr);
        attributeSystem.setBase(attr, current + delta);
      }
    }

    // Apply skill bonuses
    if (skillSystem && def.skillBonus) {
      for (const [skillId, delta] of Object.entries(def.skillBonus) as [ProgressionSkillId, number][]) {
        if (!delta) continue;
        const current = skillSystem.getSkill(skillId)?.level ?? 0;
        skillSystem.setSkillLevel(skillId, current + delta);
      }
    }

    this.onRaceChosen?.(def);
    return true;
  }

  // ── Racial power ──────────────────────────────────────────────────────────

  /**
   * Returns `true` when the racial power is available (not on cooldown).
   * Also returns `false` when no race has been chosen or the race has no power.
   *
   * @param currentGameTimeMinutes  Current game time from `TimeSystem.gameTime`.
   */
  public canActivatePower(currentGameTimeMinutes: number): boolean {
    const def = this.chosenRace;
    if (!def?.power) return false;
    if (this._lastPowerUseTime === null) return true;
    const cooldownMinutes = def.power.cooldownHours * 60;
    return (currentGameTimeMinutes - this._lastPowerUseTime) >= cooldownMinutes;
  }

  /**
   * Activate the racial power if it is not on cooldown.
   *
   * Dispatches each `RacePowerEffect` from the power definition as a timed
   * `ActiveEffect` into `activeEffectsSystem` (when provided), then fires the
   * `onPowerActivated` callback.
   *
   * @param currentGameTimeMinutes  Current game time from `TimeSystem.gameTime`.
   * @param activeEffectsSystem     Optional: system that receives the dispatched effects.
   * @returns `true` if the power was activated; `false` if on cooldown or no power.
   */
  public activatePower(
    currentGameTimeMinutes: number,
    activeEffectsSystem?: ActiveEffectsSystem,
  ): boolean {
    if (!this.canActivatePower(currentGameTimeMinutes)) return false;

    const def = this.chosenRace!;
    const power = def.power!;

    this._lastPowerUseTime = currentGameTimeMinutes;

    if (activeEffectsSystem) {
      for (const eff of power.effects) {
        activeEffectsSystem.addEffect({
          id:        `racial_${power.id}_${eff.effectType}`,
          name:      eff.name,
          effectType: eff.effectType,
          magnitude: eff.magnitude,
          duration:  eff.duration,
        });
      }
    }

    this.onPowerActivated?.(power);
    return true;
  }

  /**
   * Remaining cooldown in minutes before the racial power can be used again.
   * Returns 0 when the power is ready.
   *
   * @param currentGameTimeMinutes  Current game time from `TimeSystem.gameTime`.
   */
  public powerCooldownRemaining(currentGameTimeMinutes: number): number {
    const def = this.chosenRace;
    if (!def?.power || this._lastPowerUseTime === null) return 0;
    const cooldownMinutes = def.power.cooldownHours * 60;
    const elapsed = currentGameTimeMinutes - this._lastPowerUseTime;
    return Math.max(0, cooldownMinutes - elapsed);
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  public getSaveState(): RaceSaveState {
    return {
      chosenId: this._chosenId,
      lastPowerUseTime: this._lastPowerUseTime,
    };
  }

  /**
   * Restores from save without re-applying starting bonuses (those are already
   * baked into the saved AttributeSystem / SkillProgressionSystem states).
   */
  public restoreFromSave(state: RaceSaveState): void {
    if (!state || typeof state !== "object") return;
    const id = state.chosenId;
    if (typeof id === "string" && RaceSystem._catalogue.has(id)) {
      this._chosenId = id;
    } else {
      this._chosenId = null;
    }
    if (typeof state.lastPowerUseTime === "number" && Number.isFinite(state.lastPowerUseTime)) {
      this._lastPowerUseTime = state.lastPowerUseTime;
    } else {
      this._lastPowerUseTime = null;
    }
  }
}
