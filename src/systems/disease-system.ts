/**
 * DiseaseSystem — Oblivion-style disease contraction and cure for Camelot.
 *
 * Players can contract diseases through enemy attacks, environmental hazards,
 * or scripted events.  Each disease weakens one or more attributes until it is
 * cured by a Cure Disease potion, a shrine blessing, or a racial/birthsign
 * immunity.
 *
 * - `contractDisease(id)` — try to infect the player (respects resistance chance).
 * - `cureDisease(id)` / `cureAllDiseases()` — remove one or all diseases.
 * - `getAttributePenalties()` — merged per-attribute debuff map for stat systems.
 * - `diseaseResistanceChance` — [0, 1]; Argonians set this to 1.0 for full immunity.
 *
 * Headless: no BabylonJS dependencies — integrates via callbacks.
 * SAVE_VERSION: 21
 */

// ── Disease definition ────────────────────────────────────────────────────────

/**
 * Static definition of a disease, registered once at startup.
 */
export interface DiseaseDefinition {
  /** Stable unique identifier (e.g. `"rust_chancre"`). */
  id: string;
  /** Human-readable display name (e.g. `"Rust Chancre"`). */
  name: string;
  /** Short lore description shown in the active-effects HUD. */
  description: string;
  /**
   * Attribute penalties applied while the disease is active.
   * Keys match the ids used by AttributeSystem (e.g. `"endurance"`, `"willpower"`).
   * Values are *negative* integers (e.g. `{ endurance: -5 }`).
   */
  attributeEffects: Record<string, number>;
}

// ── Save state ────────────────────────────────────────────────────────────────

export interface DiseaseSaveState {
  /** Ids of currently active (uncured) diseases. */
  activeDiseases: string[];
}

// ── Built-in disease table ────────────────────────────────────────────────────

/**
 * Canonical disease definitions mirroring Oblivion's disease roster.
 * The DiseaseSystem registers all of these automatically.
 */
export const BUILT_IN_DISEASES: DiseaseDefinition[] = [
  {
    id: "rust_chancre",
    name: "Rust Chancre",
    description: "A corrosive ailment that saps the body's endurance.",
    attributeEffects: { endurance: -5 },
  },
  {
    id: "swamp_rot",
    name: "Swamp Rot",
    description: "A festering rot that clouds the mind and weakens willpower.",
    attributeEffects: { willpower: -5 },
  },
  {
    id: "witbane",
    name: "Witbane",
    description: "A curse-disease that dulls intelligence and magical affinity.",
    attributeEffects: { intelligence: -5 },
  },
  {
    id: "collywobbles",
    name: "Collywobbles",
    description: "A stomach ailment that saps raw physical strength.",
    attributeEffects: { strength: -5 },
  },
  {
    id: "brain_rot",
    name: "Brain Rot",
    description: "A severe daedric affliction that devastates the intellect.",
    attributeEffects: { intelligence: -10 },
  },
  {
    id: "yellow_tick",
    name: "Yellow Tick",
    description: "Spread by insects and arachnids; greatly reduces agility.",
    attributeEffects: { agility: -5 },
  },
  {
    id: "porphyric_hemophilia",
    name: "Porphyric Hemophilia",
    description: "A vampiric disease that weakens body and will over time.",
    attributeEffects: { willpower: -2, endurance: -2 },
  },
];

// ── System ────────────────────────────────────────────────────────────────────

/**
 * Manages disease contraction, persistence, and attribute-penalty aggregation.
 *
 * Usage:
 * ```ts
 * const diseases = new DiseaseSystem();
 *
 * // Wire callbacks
 * diseases.onDiseaseContracted = (id) => ui.showNotification(`Contracted ${id}!`);
 * diseases.onDiseaseCured      = (id) => ui.showNotification(`Cured ${id}.`);
 *
 * // Argonian racial immunity
 * diseases.diseaseResistanceChance = 1.0;
 *
 * // On enemy hit
 * diseases.contractDisease("rust_chancre");
 *
 * // Each frame — pull merged penalties and apply to AttributeSystem
 * const penalties = diseases.getAttributePenalties();
 * // { endurance: -5 }
 *
 * // Cure Disease potion or shrine
 * diseases.cureAllDiseases();
 * ```
 */
export class DiseaseSystem {
  private _definitions: Map<string, DiseaseDefinition> = new Map();
  private _activeDiseases: Set<string> = new Set();

  // ── Callbacks ──────────────────────────────────────────────────────────────

  /**
   * Fired when the player successfully contracts a disease.
   * Receives the disease id.
   */
  public onDiseaseContracted: ((diseaseId: string) => void) | null = null;

  /**
   * Fired when a disease is cured (either individually or via cureAllDiseases).
   * Receives the disease id.
   */
  public onDiseaseCured: ((diseaseId: string) => void) | null = null;

  // ── Configuration ──────────────────────────────────────────────────────────

  /**
   * Probability [0, 1] that the player resists contracting any disease.
   * - `0.0` — no resistance (default for most races).
   * - `1.0` — full immunity (Argonian racial trait).
   * Values outside [0, 1] are clamped internally.
   */
  public diseaseResistanceChance: number = 0;

  // ── Constructor ────────────────────────────────────────────────────────────

  /**
   * Creates a new DiseaseSystem pre-seeded with the built-in Oblivion-style
   * disease roster.  Additional diseases can be registered via
   * {@link registerDisease}.
   */
  constructor() {
    for (const def of BUILT_IN_DISEASES) {
      this._definitions.set(def.id, def);
    }
  }

  // ── Registration ───────────────────────────────────────────────────────────

  /**
   * Register a custom disease definition.
   * If a definition with the same id already exists it is replaced.
   */
  public registerDisease(def: DiseaseDefinition): void {
    this._definitions.set(def.id, def);
  }

  /**
   * Returns the definition for `diseaseId`, or `undefined` if unknown.
   */
  public getDefinition(diseaseId: string): DiseaseDefinition | undefined {
    return this._definitions.get(diseaseId);
  }

  /**
   * Returns ids of all registered disease definitions.
   */
  public getRegisteredDiseaseIds(): string[] {
    return Array.from(this._definitions.keys());
  }

  // ── Contraction ────────────────────────────────────────────────────────────

  /**
   * Attempt to infect the player with `diseaseId`.
   *
   * If the player already has this disease the call is a no-op.
   * A random roll against `diseaseResistanceChance` is performed first —
   * callers may supply their own `rng` (returns [0, 1)) for deterministic tests.
   *
   * @returns `true` if the disease was contracted, `false` if resisted or
   *          the disease id is unknown.
   */
  public contractDisease(diseaseId: string, rng: () => number = Math.random): boolean {
    if (!this._definitions.has(diseaseId)) return false;
    if (this._activeDiseases.has(diseaseId)) return false;

    const resistance = Math.min(1, Math.max(0, this.diseaseResistanceChance));
    if (rng() < resistance) return false;

    this._activeDiseases.add(diseaseId);
    this.onDiseaseContracted?.(diseaseId);
    return true;
  }

  // ── Curing ─────────────────────────────────────────────────────────────────

  /**
   * Cure a single active disease.
   *
   * @returns `true` if the disease was present and removed, `false` otherwise.
   */
  public cureDisease(diseaseId: string): boolean {
    if (!this._activeDiseases.has(diseaseId)) return false;
    this._activeDiseases.delete(diseaseId);
    this.onDiseaseCured?.(diseaseId);
    return true;
  }

  /**
   * Cure all currently active diseases (Cure Disease potion / shrine blessing).
   * Fires `onDiseaseCured` once per disease removed.
   */
  public cureAllDiseases(): void {
    for (const id of Array.from(this._activeDiseases)) {
      this._activeDiseases.delete(id);
      this.onDiseaseCured?.(id);
    }
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  /**
   * Returns `true` if the player currently has `diseaseId`.
   */
  public hasDisease(diseaseId: string): boolean {
    return this._activeDiseases.has(diseaseId);
  }

  /**
   * Returns an array of all currently active disease ids.
   */
  public getActiveDiseases(): string[] {
    return Array.from(this._activeDiseases);
  }

  /**
   * Returns `true` if the player has at least one active disease.
   */
  public get hasDiseases(): boolean {
    return this._activeDiseases.size > 0;
  }

  /**
   * Returns the total count of active diseases.
   */
  public get activeDiseaseCount(): number {
    return this._activeDiseases.size;
  }

  /**
   * Aggregates all attribute penalties from every active disease into a single
   * map.  Each key is an attribute id; the value is the total negative delta.
   *
   * Example: if `rust_chancre` (Endurance −5) and `swamp_rot` (Willpower −5)
   * are both active, returns `{ endurance: -5, willpower: -5 }`.
   *
   * Returns an empty object when no diseases are active.
   */
  public getAttributePenalties(): Record<string, number> {
    const penalties: Record<string, number> = {};
    for (const id of this._activeDiseases) {
      const def = this._definitions.get(id);
      if (!def) continue;
      for (const [attr, delta] of Object.entries(def.attributeEffects)) {
        penalties[attr] = (penalties[attr] ?? 0) + delta;
      }
    }
    return penalties;
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  /** Serialize current disease state for save-file storage. */
  public getSaveState(): DiseaseSaveState {
    return {
      activeDiseases: Array.from(this._activeDiseases),
    };
  }

  /**
   * Restore disease state from a previously serialized snapshot.
   * Only diseases whose ids are still registered will be restored.
   */
  public restoreFromSave(state: DiseaseSaveState): void {
    this._activeDiseases.clear();
    for (const id of state.activeDiseases ?? []) {
      if (this._definitions.has(id)) {
        this._activeDiseases.add(id);
      }
    }
  }
}
