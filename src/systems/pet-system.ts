/**
 * PetSystem — Companion/pet management for Camelot.
 *
 * Manages pet ownership, summoning, stats, levelling, and persistence.
 * Intentionally headless (no Babylon.js dependencies) so it can be tested
 * in isolation and mirrors the pattern established by HorseSystem.
 *
 * The in-world mesh, physics body, and AI movement are handled in game.ts,
 * which listens to `onPetSummoned` / `onPetDismissed` / `onPetDied` callbacks
 * to create and remove the Babylon scene objects.
 *
 * Built-in species:
 *   wolf   — High health, strong attacker, moderate speed
 *   cat    — Low health, quick and agile, medium damage
 *   raven  — Fragile flier, low damage, long attack range
 *
 * SAVE_VERSION: 23
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type PetSpecies = "wolf" | "cat" | "raven";

/**
 * Immutable template that describes a species/variant of pet.
 * Registered at startup; never mutated at runtime.
 */
export interface PetTemplate {
  /** Unique identifier — also used as the save/restore key. */
  id: string;
  /** Display name shown in the UI (e.g. "Grey Wolf"). */
  name: string;
  species: PetSpecies;
  /** Base maximum health at level 1. */
  maxHealth: number;
  /** Base attack damage at level 1. */
  attackDamage: number;
  /** World movement speed (units/s). */
  moveSpeed: number;
  /** Preferred following distance behind the player (metres). */
  followDistance: number;
  /** Melee/ranged attack reach (metres). */
  attackRange: number;
  /** RGB colour for the capsule mesh (0–1 each channel). */
  meshColor: { r: number; g: number; b: number };
  /** Capsule radius scale relative to a standard NPC (1.0). */
  meshScale: number;
}

/**
 * Runtime mutable state of an owned pet.
 * Extends PetTemplate so callers can read species data from one object.
 */
export interface Pet extends PetTemplate {
  /** Current health (never exceeds maxHealth). */
  health: number;
  /** Current level (starts at 1, increases via gainXP). */
  level: number;
  /** XP accumulated toward the next level. */
  experience: number;
  /**
   * Mood (0–100).  High mood slightly buffs damage; very low mood may cause
   * the pet to disobey commands.  Increases over time when active.
   */
  mood: number;
  /** True once health reaches 0.  Dead pets cannot be summoned. */
  isDead: boolean;
  /** True while the pet is spawned in the world (summoned). */
  isActive: boolean;
}

export interface PetSaveState {
  activePetId: string | null;
  pets: Array<{
    id: string;
    health: number;
    level: number;
    experience: number;
    mood: number;
    isDead: boolean;
  }>;
}

// ── Built-in templates ─────────────────────────────────────────────────────

const DEFAULT_TEMPLATES: PetTemplate[] = [
  {
    id: "pet_wolf",
    name: "Wolf",
    species: "wolf",
    maxHealth: 120,
    attackDamage: 12,
    moveSpeed: 5.5,
    followDistance: 2.5,
    attackRange: 2.0,
    meshColor: { r: 0.45, g: 0.40, b: 0.35 },
    meshScale: 0.65,
  },
  {
    id: "pet_cat",
    name: "Cat",
    species: "cat",
    maxHealth: 60,
    attackDamage: 8,
    moveSpeed: 6.5,
    followDistance: 1.8,
    attackRange: 1.5,
    meshColor: { r: 0.62, g: 0.50, b: 0.32 },
    meshScale: 0.4,
  },
  {
    id: "pet_raven",
    name: "Raven",
    species: "raven",
    maxHealth: 40,
    attackDamage: 6,
    moveSpeed: 8.0,
    followDistance: 3.0,
    attackRange: 3.5,
    meshColor: { r: 0.14, g: 0.14, b: 0.20 },
    meshScale: 0.35,
  },
];

// XP required to level up = XP_PER_LEVEL * currentLevel
const XP_PER_LEVEL = 100;
/** Max health multiplier per level-up. */
const HEALTH_SCALE_PER_LEVEL = 1.1;
/** Attack damage multiplier per level-up. */
const DAMAGE_SCALE_PER_LEVEL = 1.08;
/** Mood decay per second while summoned. */
const MOOD_DECAY_PER_SECOND = 0.5;
/** Mood recovery per second while dismissed. */
const MOOD_RECOVER_PER_SECOND = 1.0;
/** Maximum level a pet can reach. */
const PET_MAX_LEVEL = 20;

// ── PetSystem ──────────────────────────────────────────────────────────────

export class PetSystem {
  private readonly _templates: Map<string, PetTemplate> = new Map();
  private readonly _pets: Map<string, Pet> = new Map();
  private _activePetId: string | null = null;

  // ── Callbacks ──────────────────────────────────────────────────────────────

  /** Fired when a pet is first granted to the player. */
  public onPetAcquired: ((pet: Pet) => void) | null = null;
  /** Fired when a pet is summoned into the world. */
  public onPetSummoned: ((pet: Pet) => void) | null = null;
  /** Fired when a pet is dismissed from the world. */
  public onPetDismissed: ((pet: Pet) => void) | null = null;
  /** Fired when the active pet's health changes (including 0). */
  public onPetHealthChanged: ((pet: Pet) => void) | null = null;
  /** Fired when the active pet dies (health reaches 0). */
  public onPetDied: ((pet: Pet) => void) | null = null;
  /** Fired when the active pet gains a level. */
  public onPetLevelUp: ((pet: Pet, newLevel: number) => void) | null = null;

  constructor() {
    for (const tpl of DEFAULT_TEMPLATES) {
      this._templates.set(tpl.id, tpl);
    }
  }

  // ── Template registry ──────────────────────────────────────────────────────

  /** Register a custom pet template (e.g. from a mod or quest reward). */
  public registerTemplate(template: PetTemplate): void {
    this._templates.set(template.id, { ...template });
  }

  public getTemplate(id: string): PetTemplate | null {
    return this._templates.get(id) ?? null;
  }

  public get templates(): PetTemplate[] {
    return Array.from(this._templates.values());
  }

  // ── Ownership ──────────────────────────────────────────────────────────────

  /**
   * Grant the player ownership of a pet (e.g. quest reward, purchase).
   * Returns the new Pet, or null if the template is unknown or already owned.
   * The pet starts unsummoned with full health.
   */
  public grantPet(templateId: string, overrideName?: string): Pet | null {
    const tpl = this._templates.get(templateId);
    if (!tpl) return null;
    if (this._pets.has(templateId)) return null; // already owned

    const pet: Pet = {
      ...tpl,
      name: overrideName ?? tpl.name,
      health: tpl.maxHealth,
      level: 1,
      experience: 0,
      mood: 80,
      isDead: false,
      isActive: false,
    };
    this._pets.set(templateId, pet);
    this.onPetAcquired?.(pet);
    return pet;
  }

  /** All pets the player currently owns. */
  public get pets(): Pet[] {
    return Array.from(this._pets.values());
  }

  public getPet(templateId: string): Pet | null {
    return this._pets.get(templateId) ?? null;
  }

  /** True if the player owns at least one pet. */
  public get hasPet(): boolean {
    return this._pets.size > 0;
  }

  // ── Summoning ──────────────────────────────────────────────────────────────

  /** The currently summoned (active) pet, or null. */
  public get activePet(): Pet | null {
    return this._activePetId ? (this._pets.get(this._activePetId) ?? null) : null;
  }

  /** True while any pet is active in the world. */
  public get hasSummonedPet(): boolean {
    return this._activePetId !== null;
  }

  /**
   * Summon a pet into the world.  Any previously summoned pet is automatically
   * dismissed first.  Returns false if the pet is unknown or dead.
   */
  public summonPet(templateId: string): boolean {
    const pet = this._pets.get(templateId);
    if (!pet || pet.isDead) return false;

    if (this._activePetId && this._activePetId !== templateId) {
      this._dismissCurrent();
    }

    pet.isActive = true;
    this._activePetId = templateId;
    this.onPetSummoned?.(pet);
    return true;
  }

  /**
   * Dismiss the currently summoned pet.
   * Returns false if no pet is active.
   */
  public dismissPet(): boolean {
    if (!this._activePetId) return false;
    this._dismissCurrent();
    return true;
  }

  // ── Combat & stats ─────────────────────────────────────────────────────────

  /**
   * Deal damage to the active pet.
   * Returns false if no active pet or already dead.
   */
  public petTakeDamage(amount: number): boolean {
    const pet = this.activePet;
    if (!pet || pet.isDead) return false;

    pet.health = Math.max(0, pet.health - amount);
    this.onPetHealthChanged?.(pet);

    if (pet.health <= 0) {
      pet.isDead = true;
      pet.isActive = false;
      this._activePetId = null;
      this.onPetDied?.(pet);
    }
    return true;
  }

  /**
   * Heal the active pet.
   * Returns false if no active pet or already dead.
   */
  public petHeal(amount: number): boolean {
    const pet = this.activePet;
    if (!pet || pet.isDead) return false;

    pet.health = Math.min(pet.maxHealth, pet.health + amount);
    this.onPetHealthChanged?.(pet);
    return true;
  }

  /**
   * Award XP to the active pet.  Handles levelling automatically.
   * Returns true if a level-up occurred.
   */
  public petGainXP(xp: number): boolean {
    const pet = this.activePet;
    if (!pet || pet.isDead) return false;
    if (pet.level >= PET_MAX_LEVEL) return false;

    pet.experience += xp;
    const threshold = XP_PER_LEVEL * pet.level;

    if (pet.experience >= threshold) {
      pet.experience -= threshold;
      pet.level = Math.min(pet.level + 1, PET_MAX_LEVEL);
      pet.maxHealth = Math.floor(pet.maxHealth * HEALTH_SCALE_PER_LEVEL);
      pet.attackDamage = Math.floor(pet.attackDamage * DAMAGE_SCALE_PER_LEVEL);
      pet.health = pet.maxHealth; // full heal on level-up
      this.onPetLevelUp?.(pet, pet.level);
      return true;
    }
    return false;
  }

  /**
   * Compute effective attack damage factoring in mood.
   * Mood 80–100 → +10% bonus; mood 0–20 → −20% penalty.
   */
  public getEffectiveAttackDamage(): number {
    const pet = this.activePet;
    if (!pet) return 0;
    const moodFactor = 0.8 + (pet.mood / 100) * 0.4; // 0.8 – 1.2 range
    return Math.max(1, Math.round(pet.attackDamage * moodFactor));
  }

  /**
   * Advance pet mood every game frame.
   * Active pets slowly lose mood; dismissed pets slowly recover.
   */
  public updateMood(deltaSeconds: number): void {
    for (const pet of this._pets.values()) {
      if (pet.isDead) continue;
      if (pet.isActive) {
        pet.mood = Math.max(0, pet.mood - MOOD_DECAY_PER_SECOND * deltaSeconds);
      } else {
        pet.mood = Math.min(100, pet.mood + MOOD_RECOVER_PER_SECOND * deltaSeconds);
      }
    }
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  public getSaveState(): PetSaveState {
    return {
      activePetId: this._activePetId,
      pets: Array.from(this._pets.values()).map(p => ({
        id: p.id,
        health: p.health,
        level: p.level,
        experience: p.experience,
        mood: p.mood,
        isDead: p.isDead,
      })),
    };
  }

  public restoreFromSave(state: PetSaveState): void {
    this._pets.clear();
    this._activePetId = null;

    for (const saved of state.pets) {
      const tpl = this._templates.get(saved.id);
      if (!tpl) continue;

      // Recompute scaled stats by replaying level-ups from the template base.
      let maxHealth = tpl.maxHealth;
      let attackDamage = tpl.attackDamage;
      for (let i = 1; i < saved.level; i++) {
        maxHealth = Math.floor(maxHealth * HEALTH_SCALE_PER_LEVEL);
        attackDamage = Math.floor(attackDamage * DAMAGE_SCALE_PER_LEVEL);
      }

      const pet: Pet = {
        ...tpl,
        health: saved.health,
        level: saved.level,
        experience: saved.experience,
        mood: saved.mood,
        isDead: saved.isDead,
        isActive: false,
        maxHealth,
        attackDamage,
      };
      this._pets.set(saved.id, pet);
    }

    // Re-summon active pet and fire the callback so game.ts can recreate its mesh.
    if (state.activePetId) {
      const pet = this._pets.get(state.activePetId);
      if (pet && !pet.isDead) {
        pet.isActive = true;
        this._activePetId = state.activePetId;
        this.onPetSummoned?.(pet);
      }
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private _dismissCurrent(): void {
    if (!this._activePetId) return;
    const pet = this._pets.get(this._activePetId);
    if (pet) {
      pet.isActive = false;
      this.onPetDismissed?.(pet);
    }
    this._activePetId = null;
  }
}
