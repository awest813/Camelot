export type AttributeName =
  | "strength"
  | "endurance"
  | "intelligence"
  | "agility"
  | "willpower"
  | "speed"
  | "luck";

export interface AttributeSet {
  strength: number;
  endurance: number;
  intelligence: number;
  agility: number;
  willpower: number;
  speed: number;
  luck: number;
}

export interface AttributeSaveState {
  base: AttributeSet;
  pendingPoints: number;
}

const ATTRIBUTE_MIN = 1;
const ATTRIBUTE_MAX = 100;
export const ATTRIBUTE_POINTS_PER_LEVEL = 5;
export const ATTRIBUTE_NAMES: AttributeName[] = [
  "strength",
  "endurance",
  "intelligence",
  "agility",
  "willpower",
  "speed",
  "luck",
];

const DEFAULT_ATTRIBUTES: AttributeSet = {
  strength: 40,
  endurance: 40,
  intelligence: 40,
  agility: 40,
  willpower: 40,
  speed: 40,
  luck: 40,
};

/**
 * Manages character attributes (Strength, Endurance, Intelligence, Agility,
 * Willpower, Speed, Luck) and derives gameplay modifiers from them.
 *
 * Derived stat formulas (at base 40 → stock values):
 *   maxHealth     = 100 + endurance * 2          (base 40 → 180)
 *   maxMagicka    = 100 + (intelligence + willpower) * 0.5  (base 40+40 → 140)
 *   maxStamina    = 100 + (endurance + strength) * 0.5      (base 40+40 → 140)
 *   carryWeight   = 100 + strength * 5            (base 40 → 300)
 *   meleeDamageBonus = strength * 0.2             (base 40 → +8)
 *   magicDamageBonus = intelligence * 0.2         (base 40 → +8)
 *   critChance    = luck / 1000                   (base 40 → 4 %)
 *   speedMultiplier = 1 + (agility − 40) * 0.005  (base 40 → ×1.0)
 */
export class AttributeSystem {
  private _base: AttributeSet;
  private _modifiers: Partial<Record<AttributeName, number>>;
  public pendingPoints: number;

  constructor(base: Partial<AttributeSet> = {}) {
    this._base = { ...DEFAULT_ATTRIBUTES, ...base };
    this._modifiers = {};
    this.pendingPoints = 0;
  }

  // ── Accessors ──────────────────────────────────────────────────────────────

  /** Total effective value for an attribute (base + modifiers), clamped [1, 100]. */
  public get(name: AttributeName): number {
    const base = this._base[name];
    const mod = this._modifiers[name] ?? 0;
    return Math.min(ATTRIBUTE_MAX, Math.max(ATTRIBUTE_MIN, base + mod));
  }

  /** Override the base value directly (e.g. on restore from save). */
  public setBase(name: AttributeName, value: number): void {
    this._base[name] = Math.min(ATTRIBUTE_MAX, Math.max(ATTRIBUTE_MIN, Math.round(value)));
  }

  // ── Modifiers (equipment / spells / buffs) ──────────────────────────────────

  /** Apply a temporary modifier delta.  Multiple calls accumulate. */
  public applyModifier(name: AttributeName, delta: number): void {
    this._modifiers[name] = (this._modifiers[name] ?? 0) + delta;
  }

  /** Remove all temporary modifiers (e.g. when recalculating equipment). */
  public clearModifiers(): void {
    this._modifiers = {};
  }

  // ── Level-up point pool ───────────────────────────────────────────────────

  /** Award free attribute points for the given number of level-ups. */
  public awardLevelUpPoints(levels: number = 1): void {
    this.pendingPoints += ATTRIBUTE_POINTS_PER_LEVEL * levels;
  }

  /** Spend one pending point on the given attribute. Returns false if none available. */
  public spendPoint(name: AttributeName): boolean {
    if (this.pendingPoints <= 0) return false;
    if (this._base[name] >= ATTRIBUTE_MAX) return false;
    this._base[name] = Math.min(ATTRIBUTE_MAX, this._base[name] + 1);
    this.pendingPoints--;
    return true;
  }

  // ── Derived stats ─────────────────────────────────────────────────────────

  public get maxHealth(): number {
    return 100 + this.get("endurance") * 2;
  }

  public get maxMagicka(): number {
    return 100 + (this.get("intelligence") + this.get("willpower")) * 0.5;
  }

  public get maxStamina(): number {
    return 100 + (this.get("endurance") + this.get("strength")) * 0.5;
  }

  public get carryWeight(): number {
    return 100 + this.get("strength") * 5;
  }

  public get meleeDamageBonus(): number {
    return this.get("strength") * 0.2;
  }

  public get magicDamageBonus(): number {
    return this.get("intelligence") * 0.2;
  }

  /** Critical-hit probability in [0, 0.1]. */
  public get critChance(): number {
    return Math.min(0.1, this.get("luck") / 1000);
  }

  /** Movement speed multiplier based on agility.  ±0.5 % per point away from 40. */
  public get speedMultiplier(): number {
    return 1 + (this.get("agility") - 40) * 0.005;
  }

  // ── Snapshot ──────────────────────────────────────────────────────────────

  /** Snapshot of all effective attribute values (base + modifiers). */
  public getAll(): AttributeSet {
    return ATTRIBUTE_NAMES.reduce((acc, name) => {
      acc[name] = this.get(name);
      return acc;
    }, {} as AttributeSet);
  }

  public getSaveState(): AttributeSaveState {
    return {
      base: { ...this._base },
      pendingPoints: this.pendingPoints,
    };
  }

  public restoreFromSave(state: AttributeSaveState): void {
    if (state?.base) {
      for (const name of ATTRIBUTE_NAMES) {
        if (typeof state.base[name] === "number") {
          this._base[name] = state.base[name];
        }
      }
    }
    this.pendingPoints = state?.pendingPoints ?? 0;
  }
}
