/**
 * The player's maxima (health, magicka, stamina, carry weight) are a sum of
 * parts kept by different systems: the attributes, the omen's bonus, the
 * diseases' penalties, and the perks and enchantments, which add their own
 * deltas straight onto the player.
 *
 * The ledger owns the first three. `sync()` moves the player's maxima by how
 * much its parts changed since the last sync, so whatever the other systems
 * added stays put (an overwrite used to drop the omen's bonus at every level
 * up, and the perks' and enchantments' with it).
 */
export interface MaxStats {
  maxHealth: number;
  maxMagicka: number;
  maxStamina: number;
  carryWeight: number;
}

export interface MaxStatBody {
  maxHealth: number;
  maxMagicka: number;
  maxStamina: number;
  maxCarryWeight: number;
  health: number;
  magicka: number;
  stamina: number;
}

export const NO_STATS: Readonly<MaxStats> = { maxHealth: 0, maxMagicka: 0, maxStamina: 0, carryWeight: 0 };

/** What attribute deltas do to the maxima (the attribute system's formulas). */
export function maxStatsFromAttributeDeltas(d: Readonly<Record<string, number>>): MaxStats {
  const at = (k: string) => d[k] ?? 0;
  return {
    maxHealth: at("endurance") * 2,
    maxMagicka: (at("intelligence") + at("willpower")) * 0.5,
    maxStamina: (at("endurance") + at("strength")) * 0.5,
    carryWeight: at("strength") * 5,
  };
}

export function addStats(...parts: ReadonlyArray<Readonly<MaxStats>>): MaxStats {
  const out = { ...NO_STATS };
  for (const p of parts) {
    out.maxHealth += p.maxHealth;
    out.maxMagicka += p.maxMagicka;
    out.maxStamina += p.maxStamina;
    out.carryWeight += p.carryWeight;
  }
  return out;
}

export class MaxStatLedger {
  private _applied: MaxStats;

  /**
   * @param _parts what the ledger's parts add up to now
   * @param _body  the player
   * @param held   what the body's maxima already hold of the parts
   */
  constructor(private readonly _parts: () => MaxStats, private readonly _body: MaxStatBody, held: MaxStats) {
    this._applied = { ...held };
  }

  /** The body's maxima were just reset to hold `held` of the parts (a load). */
  public adopt(held: MaxStats): void {
    this._applied = { ...held };
  }

  /** Move the maxima by what the parts changed; current values stay within them. */
  public sync(): void {
    const next = this._parts();
    const b = this._body, a = this._applied;
    b.maxHealth += next.maxHealth - a.maxHealth;
    b.maxMagicka += next.maxMagicka - a.maxMagicka;
    b.maxStamina += next.maxStamina - a.maxStamina;
    b.maxCarryWeight += next.carryWeight - a.carryWeight;
    b.maxHealth = Math.max(1, b.maxHealth);
    b.maxMagicka = Math.max(0, b.maxMagicka);
    b.maxStamina = Math.max(0, b.maxStamina);
    b.health = Math.min(b.health, b.maxHealth);
    b.magicka = Math.min(b.magicka, b.maxMagicka);
    b.stamina = Math.min(b.stamina, b.maxStamina);
    this._applied = next;
  }
}

/** The player's ledger: attributes + the omen's bonus + diseases' penalties + fortify / burden effects. */
export function playerMaxStats(d: {
  attributes: MaxStatsOf<"maxHealth" | "maxMagicka" | "maxStamina" | "carryWeight">;
  /** Lazily: these may be built after the ledger. */
  omen: () => { getStatBonuses(): MaxStats } | undefined;
  diseases: () => { getAttributePenalties(): Record<string, number> } | undefined;
  effects: () => { totalMagnitude(type: "fortify_health" | "fortify_magicka" | "burden"): number } | undefined;
  body: MaxStatBody;
}): PlayerMaxStats {
  const a = d.attributes;
  const fromAttributes = (): MaxStats => ({ maxHealth: a.maxHealth, maxMagicka: a.maxMagicka, maxStamina: a.maxStamina, carryWeight: a.carryWeight });
  const fx = (t: "fortify_health" | "fortify_magicka" | "burden") => d.effects()?.totalMagnitude(t) ?? 0;
  const ledger = new MaxStatLedger(() => addStats(
    fromAttributes(),
    d.omen()?.getStatBonuses() ?? NO_STATS,
    maxStatsFromAttributeDeltas(d.diseases()?.getAttributePenalties() ?? {}),
    { maxHealth: fx("fortify_health"), maxMagicka: fx("fortify_magicka"), maxStamina: 0, carryWeight: -fx("burden") },
  ), d.body, fromAttributes());
  return {
    sync: () => ledger.sync(),
    // The save system just reset the maxima to the attributes' own.
    afterLoad: () => { ledger.adopt(fromAttributes()); ledger.sync(); },
  };
}

type MaxStatsOf<K extends string> = { readonly [P in K]: number };

export interface PlayerMaxStats {
  sync(): void;
  /** After a load reset the maxima to the attributes': put the rest back on. */
  afterLoad(): void;
}
