/**
 * SurvivalSystem — Skyrim Anniversary Edition-inspired survival needs.
 *
 * Tracks three player needs — hunger, fatigue, and cold — each on a [0, 100]
 * scale (100 = fully satisfied, 0 = critically depleted).  Each need
 * transitions through named threshold levels and applies stat penalties or
 * bonuses to the player when thresholds are crossed.
 *
 * Threshold levels:
 *   Hunger  — "satiated" (>60) | "normal" (>25) | "hungry" (>10) | "starving"
 *   Fatigue — "rested"  (>60) | "normal" (>25) | "tired"  (>10) | "exhausted"
 *   Cold    — "warm"    (>60) | "chilly" (>25) | "cold"   (>10) | "freezing"
 *
 * Derived penalties (read by the game layer and applied to player stats):
 *   staminaRegenPenalty — hungry: −2/s, starving: −5/s
 *   maxStaminaPenalty   — exhausted: −15
 *   maxMagickaPenalty   — freezing: −10
 *   frostDamagePerSecond — freezing: 2 HP/s
 *   xpMultiplier        — satiated: +10%, rested: +5%
 *
 * Integration:
 * ```ts
 * this.survivalSystem = new SurvivalSystem();
 * this.survivalSystem.onHungerLevelChanged = (lvl) =>
 *   ui.setSurvivalIndicator("hunger", lvl);
 * // Each frame:
 * this.survivalSystem.update(deltaTime, weatherSystem.isCold);
 * // On eating food:
 * this.survivalSystem.eat(40);
 * // On resting (WaitSystem hook):
 * this.survivalSystem.rest(hoursSlept * 8);
 * ```
 *
 * Headless: no BabylonJS dependencies.
 * SAVE_VERSION: 28
 */

// ── Threshold level types ────────────────────────────────────────────────────

export type HungerLevel  = "satiated" | "normal" | "hungry"  | "starving";
export type FatigueLevel = "rested"   | "normal" | "tired"   | "exhausted";
export type ColdLevel    = "warm"     | "chilly" | "cold"    | "freezing";

// ── Config ───────────────────────────────────────────────────────────────────

/**
 * Drain and recovery rates in need-points per real second.
 *
 * Default timing assumes the default TimeSystem day-length of 120 real
 * seconds (12 in-game minutes per real second):
 *   - Hunger depletes fully in 2 in-game days (240 real seconds).
 *   - Fatigue depletes fully in 1 in-game day  (120 real seconds).
 *   - Cold depletes fully in 1 in-game day when cold; recovers in 0.5 days.
 */
export interface SurvivalConfig {
  hungerDrainRate:   number;
  fatigueDrainRate:  number;
  coldDrainRate:     number;
  coldRecoveryRate:  number;
}

export const DEFAULT_CONFIG: Readonly<SurvivalConfig> = {
  hungerDrainRate:  100 / 240, // ~0.417 pts/s → empty in 2 game-days
  fatigueDrainRate: 100 / 120, // ~0.833 pts/s → empty in 1 game-day
  coldDrainRate:    100 / 120, // ~0.833 pts/s → empty in 1 game-day
  coldRecoveryRate: 100 / 60,  // ~1.667 pts/s → full in 0.5 game-days
};

// ── Threshold constants ──────────────────────────────────────────────────────

const HUNGER_SATIATED_THRESHOLD  = 60;
const HUNGER_NORMAL_THRESHOLD    = 25;
const HUNGER_HUNGRY_THRESHOLD    = 10;

const FATIGUE_RESTED_THRESHOLD   = 60;
const FATIGUE_NORMAL_THRESHOLD   = 25;
const FATIGUE_TIRED_THRESHOLD    = 10;

const COLD_WARM_THRESHOLD        = 60;
const COLD_CHILLY_THRESHOLD      = 25;
const COLD_COLD_THRESHOLD        = 10;

// ── Save state ───────────────────────────────────────────────────────────────

export interface SurvivalSaveState {
  hunger:  number;
  fatigue: number;
  cold:    number;
}

// ── System ────────────────────────────────────────────────────────────────────

export class SurvivalSystem {
  private _hunger:  number = 100;
  private _fatigue: number = 100;
  private _cold:    number = 100;

  private _hungerLevel:  HungerLevel  = "satiated";
  private _fatigueLevel: FatigueLevel = "rested";
  private _coldLevel:    ColdLevel    = "warm";

  /** Drain / recovery rates. Mutate to tune pacing per game/difficulty. */
  public config: SurvivalConfig = { ...DEFAULT_CONFIG };

  // ── Callbacks ─────────────────────────────────────────────────────────────

  /** Fired when the hunger need crosses a named threshold. */
  public onHungerLevelChanged:  ((level: HungerLevel)  => void) | null = null;
  /** Fired when the fatigue need crosses a named threshold. */
  public onFatigueLevelChanged: ((level: FatigueLevel) => void) | null = null;
  /** Fired when the cold need crosses a named threshold. */
  public onColdLevelChanged:    ((level: ColdLevel)    => void) | null = null;

  // ── Update ────────────────────────────────────────────────────────────────

  /**
   * Advance all survival needs by `dt` real seconds.
   *
   * @param dt               Elapsed real seconds since last update.
   * @param isColdEnvironment When true the cold meter drains; otherwise it
   *                          recovers toward 100 (e.g. near a fire or indoors).
   */
  public update(dt: number, isColdEnvironment = false): void {
    if (!Number.isFinite(dt) || dt <= 0) return;

    this._hunger  = Math.max(0, this._hunger  - this.config.hungerDrainRate  * dt);
    this._fatigue = Math.max(0, this._fatigue - this.config.fatigueDrainRate * dt);

    if (isColdEnvironment) {
      this._cold = Math.max(0, this._cold - this.config.coldDrainRate * dt);
    } else {
      this._cold = Math.min(100, this._cold + this.config.coldRecoveryRate * dt);
    }

    this._refreshLevels();
  }

  // ── Need restoration ──────────────────────────────────────────────────────

  /**
   * Consume food, restoring `nutrition` hunger points.
   * Clamps the hunger meter to 100; ignores zero or negative values.
   */
  public eat(nutrition: number): void {
    if (!Number.isFinite(nutrition) || nutrition <= 0) return;
    this._hunger = Math.min(100, this._hunger + nutrition);
    this._refreshLevels();
  }

  /**
   * Rest or sleep, restoring `quality` fatigue points.
   * Clamps the fatigue meter to 100; ignores zero or negative values.
   */
  public rest(quality: number): void {
    if (!Number.isFinite(quality) || quality <= 0) return;
    this._fatigue = Math.min(100, this._fatigue + quality);
    this._refreshLevels();
  }

  /**
   * Warm up (e.g. near a campfire or entering shelter), restoring `amount`
   * cold points.  Clamps to 100; ignores zero or negative values.
   */
  public warmUp(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) return;
    this._cold = Math.min(100, this._cold + amount);
    this._refreshLevels();
  }

  // ── Derived stat modifiers ────────────────────────────────────────────────

  /**
   * Flat penalty to stamina regeneration (HP/s).
   * Apply additively to the player's staminaRegen each frame.
   * Hungry: −2; Starving: −5.
   */
  public get staminaRegenPenalty(): number {
    if (this._hungerLevel === "starving") return -5;
    if (this._hungerLevel === "hungry")   return -2;
    return 0;
  }

  /**
   * Flat penalty to the player's maximum stamina.
   * Exhausted: −15.
   */
  public get maxStaminaPenalty(): number {
    if (this._fatigueLevel === "exhausted") return -15;
    return 0;
  }

  /**
   * Flat penalty to the player's maximum magicka.
   * Freezing: −10.
   */
  public get maxMagickaPenalty(): number {
    if (this._coldLevel === "freezing") return -10;
    return 0;
  }

  /**
   * Frost damage dealt to the player per real second.
   * Freezing: 2 HP/s.  Apply via `player.health -= frostDamagePerSecond * dt`.
   */
  public get frostDamagePerSecond(): number {
    if (this._coldLevel === "freezing") return 2;
    return 0;
  }

  /**
   * XP gain multiplier from well-fed and/or rested bonuses.
   * Satiated: +10%; Rested: +5%; both active: +15%.
   */
  public get xpMultiplier(): number {
    let mult = 1.0;
    if (this._hungerLevel === "satiated") mult += 0.10;
    if (this._fatigueLevel === "rested")  mult += 0.05;
    return mult;
  }

  // ── Getters ───────────────────────────────────────────────────────────────

  /** Current hunger value [0, 100]. */
  public get hunger():  number { return this._hunger;  }
  /** Current fatigue value [0, 100]. */
  public get fatigue(): number { return this._fatigue; }
  /** Current cold value [0, 100]. */
  public get cold():    number { return this._cold;    }

  /** Current named hunger threshold level. */
  public get hungerLevel():  HungerLevel  { return this._hungerLevel;  }
  /** Current named fatigue threshold level. */
  public get fatigueLevel(): FatigueLevel { return this._fatigueLevel; }
  /** Current named cold threshold level. */
  public get coldLevel():    ColdLevel    { return this._coldLevel;    }

  // ── Persistence ───────────────────────────────────────────────────────────

  /** Serialize survival state for save-file storage. */
  public getSaveState(): SurvivalSaveState {
    return {
      hunger:  this._hunger,
      fatigue: this._fatigue,
      cold:    this._cold,
    };
  }

  /**
   * Restore survival state from a previously serialised snapshot.
   * Missing or invalid numeric fields default to 100 (fully satisfied).
   */
  public restoreFromSave(state: SurvivalSaveState): void {
    this._hunger  = this._clamp(typeof state?.hunger  === "number" ? state.hunger  : 100);
    this._fatigue = this._clamp(typeof state?.fatigue === "number" ? state.fatigue : 100);
    this._cold    = this._clamp(typeof state?.cold    === "number" ? state.cold    : 100);
    this._refreshLevels();
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _clamp(v: number): number {
    return Math.max(0, Math.min(100, v));
  }

  private _refreshLevels(): void {
    const h = this._calcHungerLevel();
    const f = this._calcFatigueLevel();
    const c = this._calcColdLevel();

    if (h !== this._hungerLevel) {
      this._hungerLevel = h;
      this.onHungerLevelChanged?.(h);
    }
    if (f !== this._fatigueLevel) {
      this._fatigueLevel = f;
      this.onFatigueLevelChanged?.(f);
    }
    if (c !== this._coldLevel) {
      this._coldLevel = c;
      this.onColdLevelChanged?.(c);
    }
  }

  private _calcHungerLevel(): HungerLevel {
    if (this._hunger > HUNGER_SATIATED_THRESHOLD) return "satiated";
    if (this._hunger > HUNGER_NORMAL_THRESHOLD)   return "normal";
    if (this._hunger > HUNGER_HUNGRY_THRESHOLD)   return "hungry";
    return "starving";
  }

  private _calcFatigueLevel(): FatigueLevel {
    if (this._fatigue > FATIGUE_RESTED_THRESHOLD) return "rested";
    if (this._fatigue > FATIGUE_NORMAL_THRESHOLD) return "normal";
    if (this._fatigue > FATIGUE_TIRED_THRESHOLD)  return "tired";
    return "exhausted";
  }

  private _calcColdLevel(): ColdLevel {
    if (this._cold > COLD_WARM_THRESHOLD)   return "warm";
    if (this._cold > COLD_CHILLY_THRESHOLD) return "chilly";
    if (this._cold > COLD_COLD_THRESHOLD)   return "cold";
    return "freezing";
  }
}
