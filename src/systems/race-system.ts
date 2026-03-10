/**
 * RaceSystem — Bethesda-inspired playable race selection.
 *
 * At character creation the player selects one of ten races.  Each race
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
 * this.raceSystem.chooseRace("nord", this.attributeSystem, this.skillProgressionSystem);
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
   * Default: 24 (once per in-game day), matching Oblivion's racial powers.
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
  /** Heritage grouping (human / elven / beast). */
  heritage: "human" | "elven" | "beast";
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
 * Ten playable races inspired by The Elder Scrolls, adapted to the attributes
 * and skills available in this engine.
 */
export const RACES: ReadonlyArray<RaceDefinition> = [
  // ── Human races ───────────────────────────────────────────────────────────
  {
    id: "nord",
    name: "Nord",
    heritage: "human",
    description:
      "Hardy warriors from the frozen north, Nords possess great strength and " +
      "endurance honed by a lifetime of brutal cold.  They are naturally resistant " +
      "to frost and excel with a blade in hand.",
    attributeBonus: { strength: RACE_ATTRIBUTE_BONUS, endurance: RACE_ATTRIBUTE_BONUS },
    skillBonus: { blade: RACE_SKILL_BONUS },
    resistance: { frost: 0.5 },
    power: {
      id: "nords_fury",
      name: "Nord's Fury",
      description: "Channel Nordic rage to boost strength and stamina recovery for 60 seconds.",
      cooldownHours: 24,
      effects: [
        { name: "Nordic Strength",   effectType: "fortify_strength", magnitude: 20, duration: 60 },
        { name: "Nordic Endurance",  effectType: "stamina_restore",  magnitude: 5,  duration: 60 },
      ],
    },
  },
  {
    id: "imperial",
    name: "Imperial",
    heritage: "human",
    description:
      "Natives of the fertile heartlands, Imperials are natural diplomats and " +
      "traders.  Their silver tongues and tactical discipline make them " +
      "well-rounded adventurers equally at home in courts or on battlefields.",
    attributeBonus: { willpower: RACE_ATTRIBUTE_BONUS, luck: RACE_ATTRIBUTE_BONUS },
    skillBonus: { speechcraft: RACE_SKILL_BONUS, restoration: RACE_SKILL_BONUS },
    power: {
      id: "voice_of_the_emperor",
      name: "Voice of the Emperor",
      description: "Project commanding authority, reducing incoming damage and restoring health for 30 seconds.",
      cooldownHours: 24,
      effects: [
        { name: "Imperial Authority", effectType: "resist_damage",   magnitude: 25, duration: 30 },
        { name: "Imperial Resolve",   effectType: "health_restore",  magnitude: 5,  duration: 30 },
      ],
    },
  },
  {
    id: "breton",
    name: "Breton",
    heritage: "human",
    description:
      "Part human, part elven in ancestry, Bretons are gifted in the arcane arts " +
      "and possess a natural aptitude for absorbing and resisting spells. " +
      "Their intelligence and willpower make them formidable spellcasters.",
    attributeBonus: { intelligence: RACE_ATTRIBUTE_BONUS, willpower: RACE_ATTRIBUTE_BONUS },
    skillBonus: { restoration: RACE_SKILL_BONUS, alchemy: RACE_SKILL_BONUS },
    maxMagickaBonus: 50,
    resistance: { magic: 0.25 },
    power: {
      id: "spell_absorption",
      name: "Spell Absorption",
      description: "Absorb ambient magic, rapidly restoring Magicka and fortifying the Magicka pool for 30 seconds.",
      cooldownHours: 24,
      effects: [
        { name: "Spell Absorption",  effectType: "magicka_restore",  magnitude: 20, duration: 15 },
        { name: "Fortified Magicka", effectType: "fortify_magicka",  magnitude: 30, duration: 30 },
      ],
    },
  },
  {
    id: "redguard",
    name: "Redguard",
    heritage: "human",
    description:
      "The finest swordsmen in the world, Redguards are naturally gifted " +
      "warriors who combine speed and agility with extraordinary endurance.  " +
      "Their adrenaline rush makes them terrifying in close combat.",
    attributeBonus: { agility: RACE_ATTRIBUTE_BONUS, endurance: RACE_ATTRIBUTE_BONUS },
    skillBonus: { blade: RACE_SKILL_BONUS, marksman: RACE_SKILL_BONUS },
    resistance: { poison: 0.75 },
    power: {
      id: "adrenaline_rush",
      name: "Adrenaline Rush",
      description: "Surge with adrenaline, boosting strength and rapidly restoring stamina for 60 seconds.",
      cooldownHours: 24,
      effects: [
        { name: "Adrenaline Strength", effectType: "fortify_strength", magnitude: 15, duration: 60 },
        { name: "Adrenaline Rush",     effectType: "stamina_restore",  magnitude: 4,  duration: 60 },
      ],
    },
  },
  // ── Elven races ───────────────────────────────────────────────────────────
  {
    id: "altmer",
    name: "High Elf",
    heritage: "elven",
    description:
      "The Altmer are the tallest and most gifted of the elven races.  " +
      "Their vast intelligence and willpower grant an enormous Magicka pool " +
      "at the cost of slight physical frailty and a weakness to elemental magic.",
    attributeBonus: { intelligence: RACE_ATTRIBUTE_BONUS, willpower: RACE_ATTRIBUTE_BONUS, endurance: -RACE_ATTRIBUTE_BONUS },
    skillBonus: { destruction: RACE_SKILL_BONUS, restoration: RACE_SKILL_BONUS },
    maxMagickaBonus: 100,
    resistance: { fire: -0.25, frost: -0.25 },
    power: {
      id: "highborn",
      name: "Highborn",
      description: "Channel elven heritage to rapidly regenerate Magicka and fortify the Magicka pool for 15 seconds.",
      cooldownHours: 24,
      effects: [
        { name: "Highborn Regeneration", effectType: "magicka_restore",  magnitude: 25, duration: 15 },
        { name: "Highborn Fortitude",    effectType: "fortify_magicka",   magnitude: 20, duration: 30 },
      ],
    },
  },
  {
    id: "dunmer",
    name: "Dark Elf",
    heritage: "elven",
    description:
      "The Dunmer are a cunning people, equally adept at bladeplay and sorcery.  " +
      "Their natural agility and intelligence, combined with an ancestral resistance " +
      "to fire, make them feared and versatile adventurers.",
    attributeBonus: { agility: RACE_ATTRIBUTE_BONUS, intelligence: RACE_ATTRIBUTE_BONUS },
    skillBonus: { blade: RACE_SKILL_BONUS, destruction: RACE_SKILL_BONUS },
    resistance: { fire: 0.5 },
    power: {
      id: "ancestors_wrath",
      name: "Ancestor's Wrath",
      description: "Invoke ancestral fury, shrouding yourself in fire and reducing incoming damage for 30 seconds.",
      cooldownHours: 24,
      effects: [
        { name: "Ancestor's Ward",     effectType: "resist_damage",   magnitude: 30, duration: 30 },
        { name: "Ancestor's Wrath",    effectType: "stamina_restore", magnitude: 4,  duration: 30 },
      ],
    },
  },
  {
    id: "bosmer",
    name: "Wood Elf",
    heritage: "elven",
    description:
      "The Bosmer are the best archers in Tamriel, swift and stealthy hunters " +
      "who thrive in the wilderness.  Their agility and speed allow them to " +
      "strike from the shadows before their prey even notices them.",
    attributeBonus: { agility: RACE_ATTRIBUTE_BONUS, speed: RACE_ATTRIBUTE_BONUS },
    skillBonus: { marksman: RACE_SKILL_BONUS, sneak: RACE_SKILL_BONUS },
    resistance: { poison: 0.5 },
    power: {
      id: "beast_tongue",
      name: "Beast Tongue",
      description: "Commune with the wild, fortifying strength and restoring stamina for 45 seconds.",
      cooldownHours: 24,
      effects: [
        { name: "Beast Strength",   effectType: "fortify_strength", magnitude: 10, duration: 45 },
        { name: "Beast Endurance",  effectType: "stamina_restore",  magnitude: 3,  duration: 45 },
      ],
    },
  },
  // ── Beast races ───────────────────────────────────────────────────────────
  {
    id: "orsimer",
    name: "Orc",
    heritage: "beast",
    description:
      "The Orsimer are the most physically powerful of the civilised races.  " +
      "Their legendary berserker fury and natural armour allow them to wade into " +
      "battle and shrug off blows that would fell lesser warriors.",
    attributeBonus: { strength: RACE_ATTRIBUTE_BONUS, endurance: RACE_ATTRIBUTE_BONUS, agility: -5 },
    skillBonus: { blade: RACE_SKILL_BONUS, alchemy: RACE_SKILL_BONUS },
    resistance: { frost: 0.25 },
    power: {
      id: "berserk",
      name: "Berserk",
      description: "Enter a berserker fury, greatly increasing strength and reducing incoming damage for 60 seconds.",
      cooldownHours: 24,
      effects: [
        { name: "Berserker Fury",    effectType: "fortify_strength", magnitude: 30, duration: 60 },
        { name: "Berserker Defense", effectType: "resist_damage",    magnitude: 25, duration: 60 },
      ],
    },
  },
  {
    id: "khajiit",
    name: "Khajiit",
    heritage: "beast",
    description:
      "The cat-folk of Elsweyr are fleet of foot and razor-sharp of claw.  " +
      "Khajiit excel at thievery, alchemy, and infiltration, and their " +
      "natural night vision makes them deadly hunters in the darkness.",
    attributeBonus: { agility: RACE_ATTRIBUTE_BONUS, speed: RACE_ATTRIBUTE_BONUS },
    skillBonus: { sneak: RACE_SKILL_BONUS, alchemy: RACE_SKILL_BONUS },
    power: {
      id: "eye_of_fear",
      name: "Eye of Fear",
      description: "Project primal terror, greatly reducing incoming damage for 20 seconds.",
      cooldownHours: 24,
      effects: [
        { name: "Fearsome Aspect", effectType: "resist_damage", magnitude: 50, duration: 20 },
      ],
    },
  },
  {
    id: "argonian",
    name: "Argonian",
    heritage: "beast",
    description:
      "The reptilian Argonians are masters of the dark arts of stealth and " +
      "restoration magic.  They are immune to poison, can breathe underwater, " +
      "and heal at a remarkable rate when injured.",
    attributeBonus: { endurance: RACE_ATTRIBUTE_BONUS, agility: RACE_ATTRIBUTE_BONUS },
    skillBonus: { sneak: RACE_SKILL_BONUS, restoration: RACE_SKILL_BONUS },
    resistance: { poison: 1.0 },
    power: {
      id: "histskin",
      name: "Histskin",
      description: "Invoke the power of the Hist to rapidly regenerate health for 15 seconds.",
      cooldownHours: 24,
      effects: [
        { name: "Histskin", effectType: "health_restore", magnitude: 20, duration: 15 },
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
   * @param id               Race id (e.g. `"nord"`, `"altmer"`).
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
