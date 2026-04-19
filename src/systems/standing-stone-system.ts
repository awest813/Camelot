/**
 * StandingStoneSystem — Skyrim-style Guardian Stone blessings.
 *
 * Standing Stones dot the wilderness of Skyrim and bestow a single passive
 * blessing on whoever touches them.  Unlike the Oblivion-style
 * {@link BirthsignSystem} — which applies *permanent* bonuses at character
 * creation — Standing Stone blessings are *switchable* at any time by walking
 * up to a new stone.  Only one stone blessing may be active at a time.
 *
 * Each stone is statically defined in {@link STANDING_STONES}; the runtime
 * tracks which stones have been discovered (visible on the compass / map) and
 * which one is currently active.
 *
 * Integration points:
 *   - `discoverStone(id)` — mark a stone as found; fires `onStoneDiscovered`.
 *   - `activateStone(id)` — swap to a new stone blessing; fires
 *     `onStoneActivated` with both the new and previous definitions.
 *   - `getStatBonuses()` — extra max-stat deltas to stack on top of
 *     attribute-derived values (identical shape to the birthsign bonuses).
 *   - `getSkillXpMultiplier(skill)` — query while granting XP to apply the
 *     Warrior / Mage / Thief Guardian Stones' 20% bonus to a whole skill
 *     family.
 *   - `stunted` — signal that the Atronach Stone suppresses natural magicka
 *     regeneration.  Query in the regen loop.
 *   - `spellAbsorption` — chance [0, 1] that an incoming spell is absorbed
 *     into the player's magicka pool (Atronach Stone).
 *   - `getSpecialPower()` / `activateSpecialPower()` — once-per-day power for
 *     stones that offer one (Lord, Lover, Ritual, Shadow, Tower).
 *
 * Wire-up example (game.ts):
 * ```ts
 * this.standingStoneSystem = new StandingStoneSystem();
 * // Player touches the Warrior Stone mesh:
 * this.standingStoneSystem.discoverStone("warrior_stone");
 * this.standingStoneSystem.activateStone("warrior_stone");
 * // Granting melee XP:
 * const mult = this.standingStoneSystem.getSkillXpMultiplier("one_handed");
 * this.skillProgressionSystem.addXP("one_handed", baseXp * mult);
 * ```
 *
 * Headless: no BabylonJS dependencies.  Interacts with the world through the
 * callbacks above and the ids of the stones placed by the structure manager.
 * SAVE_VERSION: 27
 */

import type { ProgressionSkillId } from "./skill-progression-system";

// ── Types ──────────────────────────────────────────────────────────────────────

/**
 * Guardian constellation the stone belongs to.  Shares vocabulary with the
 * Birthsign system but lives in a separate namespace because the two systems
 * can coexist (a player can have a birthsign *and* a standing stone blessing).
 */
export type StandingStoneGuardian = "warrior" | "mage" | "thief" | "other";

/** Skill families for the three primary Guardian Stones' XP bonus. */
export type StandingStoneSkillFamily = "combat" | "magic" | "stealth";

/** Skyrim Guardian Stones grant +20% XP to a whole family of skills. */
export const GUARDIAN_STONE_XP_BONUS = 0.2;

/**
 * Mapping from a progression skill id to its Guardian family.
 * The Warrior / Mage / Thief stones each accelerate one family at a time.
 * Skills not in this map receive no XP bonus from any stone.
 *
 * The progression system uses Oblivion-era skill names (blade/blunt/marksman),
 * so we group them the same way Oblivion did under its Guardian constellations.
 */
export const SKILL_FAMILY: Readonly<Partial<Record<ProgressionSkillId, StandingStoneSkillFamily>>> = {
  // ── Combat (Warrior family) ───────────────────────────────────────────────
  blade:    "combat",
  blunt:    "combat",
  block:    "combat",
  marksman: "combat",
  // ── Magic (Mage family) ───────────────────────────────────────────────────
  destruction: "magic",
  restoration: "magic",
  // ── Stealth (Thief family) ────────────────────────────────────────────────
  sneak:       "stealth",
  speechcraft: "stealth",
  alchemy:     "stealth",
};

/** Optional once-per-day power granted by some stones. */
export interface StandingStonePower {
  id: string;
  name: string;
  description: string;
  /** Recharge time in in-game hours (usually 24 = once per day). */
  cooldownHours: number;
}

/** Full standing stone definition. */
export interface StandingStoneDefinition {
  /** Unique identifier (slug). */
  id: string;
  /** Display name. */
  name: string;
  /** Flavour description shown when the stone is inspected. */
  description: string;
  /** Guardian constellation. */
  guardian: StandingStoneGuardian;
  /**
   * Skill family that receives a +20% XP bonus while this stone is active.
   * Only the three primary Guardian Stones (Warrior / Mage / Thief) set this.
   */
  skillFamily?: StandingStoneSkillFamily;
  /** Flat bonus added to max Health. */
  maxHealthBonus?: number;
  /** Flat bonus added to max Magicka. */
  maxMagickaBonus?: number;
  /** Flat bonus added to max Stamina. */
  maxStaminaBonus?: number;
  /** Flat carry-weight bonus (Steed Stone adds 100). */
  carryWeightBonus?: number;
  /**
   * Health / Magicka / Stamina regeneration multiplier while the stone is
   * active (1.0 = no change; 1.25 = +25%).
   */
  healthRegenMult?: number;
  magickaRegenMult?: number;
  staminaRegenMult?: number;
  /**
   * When `true` this stone prevents natural magicka regeneration.  The
   * Atronach Stone sets this in exchange for spell absorption.
   */
  stunted?: boolean;
  /**
   * Chance in [0, 1] that an incoming hostile spell is absorbed into the
   * player's magicka pool instead of dealing damage.  Atronach Stone = 0.5.
   */
  spellAbsorption?: number;
  /**
   * Multiplier applied to armor weight encumbrance while wearing heavy armor
   * (Steed Stone fully negates heavy armor weight — set to 0).
   */
  armorWeightMult?: number;
  /**
   * Resistance to a specific damage school while the stone is active,
   * as a fraction in [0, 1] (0.25 = 25% reduction).
   */
  magicResist?: number;
  diseaseResist?: number;
  poisonResist?: number;
  /** Once-per-day special power (Lord, Lover, Ritual, Shadow, Tower). */
  power?: StandingStonePower;
}

/** Save-file snapshot. */
export interface StandingStoneSaveState {
  /** Currently active stone id, or `null` if none active. */
  activeId: string | null;
  /** Ids of stones the player has touched at least once. */
  discovered: string[];
  /** Game time (minutes) when the active stone's power was last used. */
  lastPowerUseTime: number | null;
}

/** Flat extra max-stat bonuses contributed by the active stone. */
export interface StandingStoneStatBonuses {
  maxHealth: number;
  maxMagicka: number;
  maxStamina: number;
  carryWeight: number;
}

// ── Stone catalogue ────────────────────────────────────────────────────────────

/**
 * The thirteen Standing Stones of Skyrim.
 *
 * Values are designed to be meaningful but not overpowering and to be safely
 * stackable with the Oblivion-style {@link BirthsignSystem}.  Consumers may
 * extend the catalogue by registering custom stones through the system's
 * public constructor argument.
 */
export const STANDING_STONES: ReadonlyArray<StandingStoneDefinition> = [
  // ── Three Guardian Stones (the primary XP stones) ────────────────────────
  {
    id: "warrior_stone",
    name: "The Warrior Stone",
    guardian: "warrior",
    description:
      "The Warrior Stone increases the rate at which combat skills improve.",
    skillFamily: "combat",
  },
  {
    id: "mage_stone",
    name: "The Mage Stone",
    guardian: "mage",
    description:
      "The Mage Stone increases the rate at which magic skills improve.",
    skillFamily: "magic",
  },
  {
    id: "thief_stone",
    name: "The Thief Stone",
    guardian: "thief",
    description:
      "The Thief Stone increases the rate at which stealth skills improve.",
    skillFamily: "stealth",
  },
  // ── Serpent — offensive poison, independent of family ─────────────────────
  {
    id: "serpent_stone",
    name: "The Serpent Stone",
    guardian: "other",
    description:
      "Once a day, paralyze and poison an opponent. The Serpent aligns to no Guardian.",
    power: {
      id: "serpent_strike",
      name: "Serpent's Strike",
      description:
        "Paralyze a target for 5 seconds and poison them for 25 points of damage over 5 seconds.",
      cooldownHours: 24,
    },
  },
  // ── Lady ──────────────────────────────────────────────────────────────────
  {
    id: "lady_stone",
    name: "The Lady Stone",
    guardian: "other",
    description:
      "Those under the sign of The Lady regenerate Health and Stamina faster.",
    healthRegenMult:  1.25,
    staminaRegenMult: 1.25,
  },
  // ── Lord ──────────────────────────────────────────────────────────────────
  {
    id: "lord_stone",
    name: "The Lord Stone",
    guardian: "other",
    description:
      "The Lord Stone grants 50 points of armor and 25% magic resistance.",
    maxHealthBonus: 25,
    magicResist:    0.25,
  },
  // ── Steed — the carry-weight mule ─────────────────────────────────────────
  {
    id: "steed_stone",
    name: "The Steed Stone",
    guardian: "other",
    description:
      "Those under the sign of The Steed can carry more and their armor does not slow them down.",
    carryWeightBonus: 100,
    armorWeightMult:  0,
  },
  // ── Apprentice ────────────────────────────────────────────────────────────
  {
    id: "apprentice_stone",
    name: "The Apprentice Stone",
    guardian: "other",
    description:
      "Those under the sign of The Apprentice regenerate Magicka faster, but are more susceptible to magic.",
    magickaRegenMult: 2.0,
    magicResist:     -1.0,
  },
  // ── Atronach ──────────────────────────────────────────────────────────────
  {
    id: "atronach_stone",
    name: "The Atronach Stone",
    guardian: "other",
    description:
      "Increases maximum Magicka by 50 points and grants a 50% chance to absorb the magicka from incoming spells, but Magicka does not regenerate naturally.",
    maxMagickaBonus: 50,
    stunted:         true,
    spellAbsorption: 0.5,
  },
  // ── Ritual ────────────────────────────────────────────────────────────────
  {
    id: "ritual_stone",
    name: "The Ritual Stone",
    guardian: "other",
    description:
      "Once a day, The Ritual Stone can be used to reanimate nearby corpses to fight for you.",
    power: {
      id: "ritual_reanimate",
      name: "Ritual",
      description:
        "Reanimate all nearby corpses for 200 seconds to fight for you.",
      cooldownHours: 24,
    },
  },
  // ── Lover ─────────────────────────────────────────────────────────────────
  {
    id: "lover_stone",
    name: "The Lover Stone",
    guardian: "other",
    description:
      "The Lover's Comfort: all skills improve 15% faster.",
  },
  // ── Shadow ────────────────────────────────────────────────────────────────
  {
    id: "shadow_stone",
    name: "The Shadow Stone",
    guardian: "other",
    description:
      "Once a day, The Shadow Stone can be used to become invisible for 60 seconds.",
    power: {
      id: "shadowcloak",
      name: "Shadowcloak of Nocturnal",
      description: "Become invisible for 60 seconds.",
      cooldownHours: 24,
    },
  },
  // ── Tower ─────────────────────────────────────────────────────────────────
  {
    id: "tower_stone",
    name: "The Tower Stone",
    guardian: "other",
    description:
      "Once a day, The Tower Stone can be used to automatically unlock any non-magical lock.",
    power: {
      id: "tower_key",
      name: "Tower Key",
      description: "Open any expert-or-lower lock once per day.",
      cooldownHours: 24,
    },
  },
];

/** The Lover Stone's universal XP multiplier (15% across all skills). */
export const LOVER_STONE_XP_BONUS = 0.15;

// ── System ────────────────────────────────────────────────────────────────────

export class StandingStoneSystem {
  private readonly _catalogue: Map<string, StandingStoneDefinition>;
  private _activeId: string | null = null;
  private _discovered: Set<string> = new Set();
  private _lastPowerUseTime: number | null = null;

  /**
   * @param extraStones  Optional extra stones to register alongside the
   *                     built-in Skyrim catalogue (e.g. from mods).  Any id
   *                     collision overwrites the built-in entry.
   */
  constructor(extraStones: ReadonlyArray<StandingStoneDefinition> = []) {
    this._catalogue = new Map(STANDING_STONES.map((s) => [s.id, s]));
    for (const s of extraStones) this._catalogue.set(s.id, s);
  }

  // ── Callbacks ───────────────────────────────────────────────────────────────

  /** Fired when the player touches a new stone for the first time. */
  public onStoneDiscovered:
    | ((stone: StandingStoneDefinition) => void)
    | null = null;

  /**
   * Fired when the active stone changes.
   * @param next     The newly active stone.
   * @param previous The stone that was active before, or `null`.
   */
  public onStoneActivated:
    | ((next: StandingStoneDefinition, previous: StandingStoneDefinition | null) => void)
    | null = null;

  /** Fired when the active stone's once-per-day power is successfully used. */
  public onPowerActivated:
    | ((power: StandingStonePower, stone: StandingStoneDefinition) => void)
    | null = null;

  // ── Catalogue queries ───────────────────────────────────────────────────────

  /** Every registered stone (built-in + any extras). */
  public get all(): ReadonlyArray<StandingStoneDefinition> {
    return Array.from(this._catalogue.values());
  }

  /** Look up a stone by id. */
  public getDefinition(id: string): StandingStoneDefinition | undefined {
    return this._catalogue.get(id);
  }

  // ── Discovery ──────────────────────────────────────────────────────────────

  /**
   * Mark a stone as discovered.  Idempotent — re-discovering an already-known
   * stone returns `false` without firing the callback.  Returns `false` for
   * unknown stone ids.
   */
  public discoverStone(id: string): boolean {
    const def = this._catalogue.get(id);
    if (!def) return false;
    if (this._discovered.has(id)) return false;
    this._discovered.add(id);
    this.onStoneDiscovered?.(def);
    return true;
  }

  /** Returns `true` if the given stone has been discovered. */
  public isDiscovered(id: string): boolean {
    return this._discovered.has(id);
  }

  /** All discovered stone ids. */
  public get discoveredIds(): ReadonlyArray<string> {
    return Array.from(this._discovered);
  }

  // ── Activation ─────────────────────────────────────────────────────────────

  /**
   * Activate a stone's blessing, replacing any currently active stone.
   *
   * Activating a stone also discovers it (idempotent).  Activating the same
   * stone twice in a row is a no-op and returns `false`.
   *
   * Returns `false` for unknown ids or when the stone is already active.
   */
  public activateStone(id: string): boolean {
    const def = this._catalogue.get(id);
    if (!def) return false;
    if (this._activeId === id) return false;

    // First visit discovers
    if (!this._discovered.has(id)) {
      this._discovered.add(id);
      this.onStoneDiscovered?.(def);
    }

    const previous = this._activeId ? (this._catalogue.get(this._activeId) ?? null) : null;
    this._activeId = id;
    // Swapping stones resets any outstanding power cooldown — Skyrim does not
    // bank cooldowns across stone switches.
    this._lastPowerUseTime = null;
    this.onStoneActivated?.(def, previous);
    return true;
  }

  /** The currently active stone definition, or `null`. */
  public get activeStone(): StandingStoneDefinition | null {
    return this._activeId ? (this._catalogue.get(this._activeId) ?? null) : null;
  }

  /** Currently active stone id. */
  public get activeId(): string | null {
    return this._activeId;
  }

  /** Clear the active stone blessing (e.g. debug, narrative reset). */
  public clearActive(): void {
    this._activeId = null;
    this._lastPowerUseTime = null;
  }

  // ── Passive query helpers ──────────────────────────────────────────────────

  /**
   * Returns the XP multiplier to apply when awarding progression XP for the
   * given skill.  Multipliers from the Guardian family bonus and the Lover
   * Stone's universal bonus compose multiplicatively.
   *
   * @returns 1.0 when no active stone applies.
   */
  public getSkillXpMultiplier(skill: ProgressionSkillId): number {
    const stone = this.activeStone;
    if (!stone) return 1.0;

    let mult = 1.0;

    // Lover Stone — 15% to all skills
    if (stone.id === "lover_stone") mult *= 1 + LOVER_STONE_XP_BONUS;

    // Guardian Stones — 20% to a single family
    if (stone.skillFamily) {
      const family = SKILL_FAMILY[skill];
      if (family === stone.skillFamily) {
        mult *= 1 + GUARDIAN_STONE_XP_BONUS;
      }
    }

    return mult;
  }

  /** Flat max-stat bonuses contributed by the active stone. */
  public getStatBonuses(): StandingStoneStatBonuses {
    const s = this.activeStone;
    return {
      maxHealth:   s?.maxHealthBonus   ?? 0,
      maxMagicka:  s?.maxMagickaBonus  ?? 0,
      maxStamina:  s?.maxStaminaBonus  ?? 0,
      carryWeight: s?.carryWeightBonus ?? 0,
    };
  }

  /** Regeneration multiplier for the given resource (1.0 when no effect). */
  public getRegenMultiplier(resource: "health" | "magicka" | "stamina"): number {
    const s = this.activeStone;
    if (!s) return 1.0;
    switch (resource) {
      case "health":  return s.healthRegenMult  ?? 1.0;
      case "magicka": return s.magickaRegenMult ?? 1.0;
      case "stamina": return s.staminaRegenMult ?? 1.0;
    }
  }

  /** Atronach Stone — `true` when the active stone suppresses magicka regen. */
  public get stunted(): boolean {
    return this.activeStone?.stunted === true;
  }

  /** Spell absorption chance in [0, 1] (Atronach Stone). */
  public get spellAbsorption(): number {
    return this.activeStone?.spellAbsorption ?? 0;
  }

  /**
   * Armor-weight multiplier (Steed Stone = 0 negates heavy armor encumbrance).
   * Returns 1.0 when no modifier is active.
   */
  public get armorWeightMult(): number {
    return this.activeStone?.armorWeightMult ?? 1.0;
  }

  /** Resistance fractions in [-1, 1] — negative values represent weakness. */
  public get magicResist():   number { return this.activeStone?.magicResist   ?? 0; }
  public get diseaseResist(): number { return this.activeStone?.diseaseResist ?? 0; }
  public get poisonResist():  number { return this.activeStone?.poisonResist  ?? 0; }

  // ── Once-per-day power ─────────────────────────────────────────────────────

  /** The power definition for the active stone, or `null`. */
  public getSpecialPower(): StandingStonePower | null {
    return this.activeStone?.power ?? null;
  }

  /** `true` when the active stone's power is off cooldown. */
  public canActivatePower(currentGameTimeMinutes: number): boolean {
    const power = this.getSpecialPower();
    if (!power) return false;
    if (this._lastPowerUseTime === null) return true;
    const cooldownMinutes = power.cooldownHours * 60;
    return (currentGameTimeMinutes - this._lastPowerUseTime) >= cooldownMinutes;
  }

  /**
   * Activate the stone's once-per-day power.
   * @returns `true` if the power was activated; `false` if there is no power
   *          or it is still on cooldown.
   */
  public activateSpecialPower(currentGameTimeMinutes: number): boolean {
    const stone = this.activeStone;
    const power = stone?.power;
    if (!stone || !power) return false;
    if (!this.canActivatePower(currentGameTimeMinutes)) return false;

    this._lastPowerUseTime = currentGameTimeMinutes;
    this.onPowerActivated?.(power, stone);
    return true;
  }

  /** Remaining cooldown on the active stone's power in minutes (0 = ready). */
  public powerCooldownRemaining(currentGameTimeMinutes: number): number {
    const power = this.getSpecialPower();
    if (!power || this._lastPowerUseTime === null) return 0;
    const cooldownMinutes = power.cooldownHours * 60;
    const elapsed = currentGameTimeMinutes - this._lastPowerUseTime;
    return Math.max(0, cooldownMinutes - elapsed);
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  public getSaveState(): StandingStoneSaveState {
    return {
      activeId:         this._activeId,
      discovered:       Array.from(this._discovered),
      lastPowerUseTime: this._lastPowerUseTime,
    };
  }

  public restoreFromSave(state: StandingStoneSaveState): void {
    if (!state || typeof state !== "object") return;

    this._activeId = (typeof state.activeId === "string" && this._catalogue.has(state.activeId))
      ? state.activeId
      : null;

    this._discovered = new Set(
      Array.isArray(state.discovered)
        ? state.discovered.filter((id): id is string =>
            typeof id === "string" && this._catalogue.has(id),
          )
        : [],
    );

    this._lastPowerUseTime =
      typeof state.lastPowerUseTime === "number" && Number.isFinite(state.lastPowerUseTime)
        ? state.lastPowerUseTime
        : null;
  }
}
