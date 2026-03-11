/**
 * SpellMakingSystem — Oblivion-style custom spell creation.
 *
 * At the Altar of Spellmaking (Mage's Guild) the player can forge a personal
 * spell by combining 1–2 effect components.  A gold cost is computed from the
 * total magnitude and duration; if the player can afford it the spell is added
 * to their SpellSystem's known-spell pool.
 *
 * Effect components map to SpellDefinition fields:
 *   damage / heal           → damage or heal amount
 *   restore_magicka/stamina → restore amounts baked as heal-equivalent
 *   silence / burden        → debuff magnitude
 *
 * Cost formula (per component):
 *   cost = magnitude × max(1, duration) × COST_FACTOR
 *   Total spell cost = Σ component costs  (clamped to [MIN_COST, MAX_COST])
 *
 * Wire-up example (game.ts):
 * ```ts
 * this.spellMakingSystem = new SpellMakingSystem(this.spellSystem);
 * // On forge:
 * const result = this.spellMakingSystem.forgeSpell(
 *   "My Inferno",
 *   [{ effectType: "damage", school: "destruction", magnitude: 30, duration: 3, damageType: "fire" }],
 *   this.barterSystem,
 * );
 * if (result.ok) this.ui.showNotification(`Spell created! Cost: ${result.goldCost}g`, 2500);
 * ```
 */

import type { SpellSystem, SpellDefinition, SpellSchool, DamageType } from "./spell-system";
import type { BarterSystem } from "./barter-system";

// ── Constants ──────────────────────────────────────────────────────────────────

/** Gold multiplier per (magnitude × duration) unit. */
const COST_FACTOR   = 2;
/** Minimum spell forge cost in gold. */
export const MIN_SPELL_COST = 50;
/** Maximum spell forge cost in gold. */
export const MAX_SPELL_COST = 2000;
/** Maximum number of effect components per custom spell. */
export const MAX_COMPONENTS = 2;

// ── Types ──────────────────────────────────────────────────────────────────────

export type SpellComponentEffect =
  | "damage"
  | "heal"
  | "restore_magicka"
  | "restore_stamina"
  | "silence"
  | "burden";

export const SPELL_COMPONENT_EFFECTS: readonly SpellComponentEffect[] = [
  "damage",
  "heal",
  "restore_magicka",
  "restore_stamina",
  "silence",
  "burden",
];

export const SPELL_COMPONENT_SCHOOLS: readonly SpellSchool[] = [
  "destruction",
  "restoration",
  "illusion",
  "conjuration",
  "alteration",
];

export const SPELL_COMPONENT_DAMAGE_TYPES: readonly DamageType[] = [
  "fire",
  "frost",
  "shock",
  "magic",
  "poison",
];

export interface SpellComponent {
  /** Category of this effect. */
  effectType: SpellComponentEffect;
  /** Spell school the effect belongs to. */
  school: SpellSchool;
  /** Effect strength — damage/heal HP, or debuff magnitude. */
  magnitude: number;
  /** Duration in seconds (0 = instant application). */
  duration: number;
  /** Elemental flavour for damage effects. */
  damageType?: DamageType;
}

export interface SpellMakingResult {
  ok: boolean;
  reason?: "insufficient_gold" | "no_components" | "too_many_components" | "invalid_name" | "duplicate_name";
  /** The newly forged SpellDefinition, present only when ok === true. */
  spell?: SpellDefinition;
  /** Gold deducted, present only when ok === true. */
  goldCost?: number;
}

export interface SpellMakingSaveState {
  customSpells: Array<SpellDefinition & { _custom: true }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Compute the raw gold cost for one component. */
function componentCost(c: SpellComponent): number {
  return c.magnitude * Math.max(1, c.duration) * COST_FACTOR;
}

/** Build a SpellDefinition id that is safe for use as a map key. */
function makeSpellId(name: string, suffix: number): string {
  return `custom_${name.toLowerCase().replace(/\s+/g, "_")}_${suffix}`;
}

// ── System ────────────────────────────────────────────────────────────────────

export class SpellMakingSystem {
  private _spellSystem: SpellSystem;
  /** Spells forged this session (also re-registered on load). */
  private _customSpells: Map<string, SpellDefinition & { _custom: true }> = new Map();
  /** Auto-incrementing suffix used to guarantee unique ids. */
  private _counter: number = 0;

  /**
   * Fired after a spell is successfully forged.
   * @param spell     The resulting SpellDefinition.
   * @param goldCost  Gold deducted from the player.
   */
  public onSpellForged: ((spell: SpellDefinition, goldCost: number) => void) | null = null;

  constructor(spellSystem: SpellSystem) {
    this._spellSystem = spellSystem;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Returns all custom spells forged by the player.
   */
  public get customSpells(): ReadonlyArray<Readonly<SpellDefinition>> {
    return Array.from(this._customSpells.values());
  }

  /**
   * Calculate the gold cost for the given set of components without forging.
   * Useful for displaying the cost in the UI before confirmation.
   */
  public computeCost(components: SpellComponent[]): number {
    if (components.length === 0) return 0;
    const raw = components.reduce((sum, c) => sum + componentCost(c), 0);
    return Math.max(MIN_SPELL_COST, Math.min(MAX_SPELL_COST, Math.round(raw)));
  }

  /**
   * Forge a custom spell.
   *
   * Validates inputs, deducts gold from `barterSystem.playerGold` (if
   * provided), registers the new spell into the SpellSystem, and stores
   * it for save/load.
   *
   * @param name        Player-chosen name for the spell.
   * @param components  1–2 effect components.
   * @param barter      BarterSystem used to deduct gold.  Pass `null` in tests.
   */
  public forgeSpell(
    name: string,
    components: SpellComponent[],
    barter: BarterSystem | null,
  ): SpellMakingResult {
    // Validate name
    const cleanName = name.trim();
    if (!cleanName) {
      return { ok: false, reason: "invalid_name" };
    }

    // Validate component count
    if (components.length === 0) {
      return { ok: false, reason: "no_components" };
    }
    if (components.length > MAX_COMPONENTS) {
      return { ok: false, reason: "too_many_components" };
    }

    // Duplicate name guard
    for (const existing of this._customSpells.values()) {
      if (existing.name.toLowerCase() === cleanName.toLowerCase()) {
        return { ok: false, reason: "duplicate_name" };
      }
    }

    const goldCost = this.computeCost(components);

    // Gold check
    if (barter !== null && barter.playerGold < goldCost) {
      return { ok: false, reason: "insufficient_gold" };
    }

    // Build SpellDefinition from the first component (primary effect)
    const primary = components[0];
    this._counter++;
    const id = makeSpellId(cleanName, this._counter);

    const spell: SpellDefinition & { _custom: true } = {
      _custom: true,
      id,
      name: cleanName,
      description: this._buildDescription(components),
      school:       primary.school,
      delivery:     primary.effectType === "heal" || primary.effectType === "restore_magicka" || primary.effectType === "restore_stamina"
                    ? "self"
                    : "target",
      magickaCost:  Math.round(goldCost / 5),  // magicka roughly proportional to gold cost
      cooldown:     Math.max(0.5, Math.min(4, components.reduce((s, c) => s + c.duration * 0.1 + 0.3, 0))),
      damage:       undefined,
      heal:         undefined,
      duration:     undefined,
      range:        20,
    };

    // Apply component effects to spell definition
    let totalDamage = 0;
    let totalHeal   = 0;
    for (const c of components) {
      if (c.effectType === "damage") {
        totalDamage += c.magnitude;
        spell.damageType = c.damageType ?? "magic";
        spell.duration   = Math.max(spell.duration ?? 0, c.duration);
      } else if (c.effectType === "heal") {
        totalHeal += c.magnitude;
        spell.delivery = "self";
      } else if (c.effectType === "restore_magicka" || c.effectType === "restore_stamina") {
        totalHeal += Math.round(c.magnitude * 0.5);
        spell.delivery = "self";
      } else if (c.effectType === "silence" || c.effectType === "burden") {
        // These are debuff-style effects — piggyback a small damage value
        totalDamage += Math.round(c.magnitude * 0.4);
        spell.delivery = "target";
      }
    }
    if (totalDamage > 0) spell.damage = totalDamage;
    if (totalHeal > 0)   spell.heal   = totalHeal;

    // Deduct gold
    if (barter !== null) {
      barter.playerGold = Math.max(0, barter.playerGold - goldCost);
    }

    // Register and remember
    this._customSpells.set(id, spell);
    this._spellSystem.registerSpell(spell);
    this._spellSystem.learnSpell(id);

    this.onSpellForged?.(spell, goldCost);

    return { ok: true, spell, goldCost };
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  public getSaveState(): SpellMakingSaveState {
    return {
      customSpells: Array.from(this._customSpells.values()),
    };
  }

  public restoreFromSave(state: SpellMakingSaveState): void {
    this._customSpells.clear();
    if (!state || !Array.isArray(state.customSpells)) return;
    for (const s of state.customSpells) {
      if (typeof s.id !== "string" || typeof s.name !== "string") continue;
      const spell = { ...s, _custom: true as const };
      this._customSpells.set(s.id, spell);
      this._spellSystem.registerSpell(spell);
      this._spellSystem.learnSpell(s.id);
      // Keep the counter above any restored id suffix to avoid collisions
      const match = s.id.match(/_(\d+)$/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n >= this._counter) this._counter = n + 1;
      }
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private _buildDescription(components: SpellComponent[]): string {
    return components.map((c) => {
      switch (c.effectType) {
        case "damage":
          return `${c.magnitude} ${c.damageType ?? "magic"} damage${c.duration > 0 ? ` for ${c.duration}s` : ""}`;
        case "heal":
          return `Restore ${c.magnitude} health${c.duration > 0 ? ` over ${c.duration}s` : ""}`;
        case "restore_magicka":
          return `Restore ${c.magnitude} magicka${c.duration > 0 ? ` over ${c.duration}s` : ""}`;
        case "restore_stamina":
          return `Restore ${c.magnitude} stamina${c.duration > 0 ? ` over ${c.duration}s` : ""}`;
        case "silence":
          return `Silence target for ${c.duration}s`;
        case "burden":
          return `Burden target by ${c.magnitude} units for ${c.duration}s`;
        default:
          return "Unknown effect";
      }
    }).join("; ") + ".";
  }
}
