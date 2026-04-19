/**
 * PerkSystem — Skill-level-gated character perks.
 *
 * Each of the nine ProgressionSkills (blade, blunt, block, destruction,
 * restoration, marksman, sneak, speechcraft, alchemy) has a four-tier perk
 * tree.  Perks unlock when the corresponding skill reaches a milestone level
 * (25 / 50 / 75 / 100) and cost one perk point each.
 *
 * Perk points are earned by the game layer (typically one per character
 * level-up) and deposited via `addPerkPoints()`.  The PerkSystem is
 * intentionally free of Babylon.js dependencies.
 *
 * Wire-up example (game.ts):
 * ```ts
 * this.perkSystem = new PerkSystem(this.player, this.skillProgressionSystem);
 * // Grant 1 perk point on each character level-up:
 * this.playerLevelSystem.onLevelUpComplete = (newLevel) => {
 *   this.perkSystem.addPerkPoints(1);
 *   // ... existing handler ...
 * };
 * this.perkSystem.onPerkUnlocked = (id, name) => {
 *   this.ui.showNotification(`Perk unlocked: ${name}!`, 3000);
 * };
 * this.saveSystem.setPerkSystem(this.perkSystem);
 * ```
 */

import type { Player } from "../entities/player";
import type { SkillProgressionSystem } from "./skill-progression-system";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PerkSkillId =
  | "blade" | "blunt" | "block"
  | "destruction" | "restoration"
  | "marksman" | "sneak" | "speechcraft" | "alchemy";

export interface PerkDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly skillId: PerkSkillId;
  /** Minimum skill level required to purchase this perk. */
  readonly requiredLevel: 25 | 50 | 75 | 100;
  /** IDs of perks in the same tree that must be unlocked first. */
  readonly prerequisites: readonly string[];
  /** Applied once when the perk is first unlocked, and re-applied on save-restore. */
  readonly apply: (player: Player) => void;
}

export interface PerkEntry extends PerkDefinition {
  readonly isUnlocked: boolean;
  readonly canUnlock: boolean;
}

export interface PerkSaveState {
  unlockedPerkIds: string[];
  perkPoints: number;
}

// ── Perk Definitions (36 total — 9 skills × 4 tiers) ─────────────────────────

export const PERK_DEFINITIONS: readonly PerkDefinition[] = [
  // ─── BLADE ────────────────────────────────────────────────────────────────
  {
    id: "blade_finesse", name: "Blade Finesse", skillId: "blade", requiredLevel: 25,
    description: "Precise bladework finds weak points more reliably. +5% critical hit chance.",
    prerequisites: [],
    apply: (p) => { p.critChance += 0.05; },
  },
  {
    id: "blade_adept", name: "Blade Adept", skillId: "blade", requiredLevel: 50,
    description: "Expert technique increases overall cutting force. +5 melee damage.",
    prerequisites: ["blade_finesse"],
    apply: (p) => { p.bonusDamage += 5; },
  },
  {
    id: "blade_power_strikes", name: "Power Strikes", skillId: "blade", requiredLevel: 75,
    description: "Efficient technique reduces power attack stamina cost by 20%.",
    prerequisites: ["blade_adept"],
    apply: (p) => { p.perkPowerAttackStaminaMultiplier *= 0.8; },
  },
  {
    id: "blade_master", name: "Blade Master", skillId: "blade", requiredLevel: 100,
    description: "The pinnacle of swordsmanship. +10 melee damage and +10% critical hit chance.",
    prerequisites: ["blade_power_strikes"],
    apply: (p) => { p.bonusDamage += 10; p.critChance += 0.10; },
  },

  // ─── BLUNT ────────────────────────────────────────────────────────────────
  {
    id: "blunt_heavy_handed", name: "Heavy Handed", skillId: "blunt", requiredLevel: 25,
    description: "Raw power behind each swing. +8 melee damage.",
    prerequisites: [],
    apply: (p) => { p.bonusDamage += 8; },
  },
  {
    id: "blunt_crushing_force", name: "Crushing Force", skillId: "blunt", requiredLevel: 50,
    description: "Shattering impacts. +10 melee damage.",
    prerequisites: ["blunt_heavy_handed"],
    apply: (p) => { p.bonusDamage += 10; },
  },
  {
    id: "blunt_tower_of_strength", name: "Tower of Strength", skillId: "blunt", requiredLevel: 75,
    description: "Gruelling training builds endurance. +30 max stamina.",
    prerequisites: ["blunt_crushing_force"],
    apply: (p) => { p.maxStamina += 30; },
  },
  {
    id: "blunt_unstoppable", name: "Unstoppable", skillId: "blunt", requiredLevel: 100,
    description: "Legendary crushing force. +15 melee damage.",
    prerequisites: ["blunt_tower_of_strength"],
    apply: (p) => { p.bonusDamage += 15; },
  },

  // ─── BLOCK ────────────────────────────────────────────────────────────────
  {
    id: "block_shield_wall", name: "Shield Wall", skillId: "block", requiredLevel: 25,
    description: "Mastery of defensive technique. +15 armor.",
    prerequisites: [],
    apply: (p) => { p.bonusArmor += 15; },
  },
  {
    id: "block_fortitude", name: "Fortitude", skillId: "block", requiredLevel: 50,
    description: "Near-impenetrable defense. +20 armor.",
    prerequisites: ["block_shield_wall"],
    apply: (p) => { p.bonusArmor += 20; },
  },
  {
    id: "block_recovery", name: "Recovery", skillId: "block", requiredLevel: 75,
    description: "Efficient blocking wastes less energy. +3 stamina regen.",
    prerequisites: ["block_fortitude"],
    apply: (p) => { p.staminaRegen += 3; },
  },
  {
    id: "block_immovable", name: "Immovable", skillId: "block", requiredLevel: 100,
    description: "No force can break your guard. +25 armor.",
    prerequisites: ["block_recovery"],
    apply: (p) => { p.bonusArmor += 25; },
  },

  // ─── DESTRUCTION ──────────────────────────────────────────────────────────
  {
    id: "destruction_intensify", name: "Intensify", skillId: "destruction", requiredLevel: 25,
    description: "Your spells carry greater destructive force. +8 magic damage.",
    prerequisites: [],
    apply: (p) => { p.bonusMagicDamage += 8; },
  },
  {
    id: "destruction_efficiency", name: "Mana Efficiency", skillId: "destruction", requiredLevel: 50,
    description: "Optimized casting reduces mental fatigue. +1 magicka regen.",
    prerequisites: ["destruction_intensify"],
    apply: (p) => { p.magickaRegen += 1; },
  },
  {
    id: "destruction_impact", name: "Devastating Impact", skillId: "destruction", requiredLevel: 75,
    description: "Your spells strike with devastating force. +12 magic damage.",
    prerequisites: ["destruction_efficiency"],
    apply: (p) => { p.bonusMagicDamage += 12; },
  },
  {
    id: "destruction_augmented", name: "Augmented Power", skillId: "destruction", requiredLevel: 100,
    description: "Master-level destruction magic. +20 magic damage.",
    prerequisites: ["destruction_impact"],
    apply: (p) => { p.bonusMagicDamage += 20; },
  },

  // ─── RESTORATION ──────────────────────────────────────────────────────────
  {
    id: "restoration_healer", name: "Healer", skillId: "restoration", requiredLevel: 25,
    description: "Healing spells restore 20% more health.",
    prerequisites: [],
    apply: (p) => { p.perkHealingMultiplier += 0.20; },
  },
  {
    id: "restoration_empowered", name: "Empowered Healing", skillId: "restoration", requiredLevel: 50,
    description: "Even more potent healing. +20% healing effectiveness.",
    prerequisites: ["restoration_healer"],
    apply: (p) => { p.perkHealingMultiplier += 0.20; },
  },
  {
    id: "restoration_wellspring", name: "Wellspring", skillId: "restoration", requiredLevel: 75,
    description: "Deep reserves of magical power. +30 max magicka.",
    prerequisites: ["restoration_empowered"],
    apply: (p) => { p.maxMagicka += 30; },
  },
  {
    id: "restoration_master", name: "Restoration Master", skillId: "restoration", requiredLevel: 100,
    description: "Your body heals at an accelerated rate. +1 health regen.",
    prerequisites: ["restoration_wellspring"],
    apply: (p) => { p.healthRegen += 1; },
  },

  // ─── MARKSMAN ─────────────────────────────────────────────────────────────
  {
    id: "marksman_steady_aim", name: "Steady Aim", skillId: "marksman", requiredLevel: 25,
    description: "Still nerves allow for more precise shots. +4% critical hit chance.",
    prerequisites: [],
    apply: (p) => { p.critChance += 0.04; },
  },
  {
    id: "marksman_quick_draw", name: "Quick Draw", skillId: "marksman", requiredLevel: 50,
    description: "Efficient technique preserves stamina. +2 stamina regen.",
    prerequisites: ["marksman_steady_aim"],
    apply: (p) => { p.staminaRegen += 2; },
  },
  {
    id: "marksman_bullseye", name: "Bullseye", skillId: "marksman", requiredLevel: 75,
    description: "You reliably find vital spots. +6% critical hit chance.",
    prerequisites: ["marksman_quick_draw"],
    apply: (p) => { p.critChance += 0.06; },
  },
  {
    id: "marksman_legendary_shot", name: "Legendary Shot", skillId: "marksman", requiredLevel: 100,
    description: "The apex of ranged combat. +10 damage and +5% critical hit chance.",
    prerequisites: ["marksman_bullseye"],
    apply: (p) => { p.bonusDamage += 10; p.critChance += 0.05; },
  },

  // ─── SNEAK ────────────────────────────────────────────────────────────────
  {
    id: "sneak_shadow_step", name: "Shadow Step", skillId: "sneak", requiredLevel: 25,
    description: "Efficient movement preserves stamina. +2 stamina regen.",
    prerequisites: [],
    apply: (p) => { p.staminaRegen += 2; },
  },
  {
    id: "sneak_blur", name: "Blur", skillId: "sneak", requiredLevel: 50,
    description: "Anticipating strikes lets you partially deflect them. +10 armor.",
    prerequisites: ["sneak_shadow_step"],
    apply: (p) => { p.bonusArmor += 10; },
  },
  {
    id: "sneak_phantom", name: "Phantom", skillId: "sneak", requiredLevel: 75,
    description: "Unexpected strikes find vital spots. +5% critical hit chance.",
    prerequisites: ["sneak_blur"],
    apply: (p) => { p.critChance += 0.05; },
  },
  {
    id: "sneak_silent_death", name: "Silent Death", skillId: "sneak", requiredLevel: 100,
    description: "Undetected attacks deal double damage.",
    prerequisites: ["sneak_phantom"],
    apply: (p) => { p.perkSneakAttackMultiplier += 1.0; },
  },

  // ─── SPEECHCRAFT ──────────────────────────────────────────────────────────
  {
    id: "speech_empathy", name: "Empathy", skillId: "speechcraft", requiredLevel: 25,
    description: "Understanding others sharpens your instincts. +50 carry weight.",
    prerequisites: [],
    apply: (p) => { p.maxCarryWeight += 50; },
  },
  {
    id: "speech_rapport", name: "Rapport", skillId: "speechcraft", requiredLevel: 50,
    description: "Social ease reduces personal fatigue. +2 stamina regen.",
    prerequisites: ["speech_empathy"],
    apply: (p) => { p.staminaRegen += 2; },
  },
  {
    id: "speech_presence", name: "Commanding Presence", skillId: "speechcraft", requiredLevel: 75,
    description: "Your force of personality strengthens resolve. +20 max health.",
    prerequisites: ["speech_rapport"],
    apply: (p) => { p.maxHealth += 20; },
  },
  {
    id: "speech_voice_of_authority", name: "Voice of Authority", skillId: "speechcraft", requiredLevel: 100,
    description: "Mastery of speech heals body and mind. +0.5 health regen, +0.5 magicka regen.",
    prerequisites: ["speech_presence"],
    apply: (p) => { p.healthRegen += 0.5; p.magickaRegen += 0.5; },
  },

  // ─── ALCHEMY ──────────────────────────────────────────────────────────────
  {
    id: "alchemy_experimenter", name: "Experimenter", skillId: "alchemy", requiredLevel: 25,
    description: "Deep understanding of ingredients fuels magical insight. +1 magicka regen.",
    prerequisites: [],
    apply: (p) => { p.magickaRegen += 1; },
  },
  {
    id: "alchemy_potency", name: "Potency", skillId: "alchemy", requiredLevel: 50,
    description: "Your healing potions and spells are 15% more effective.",
    prerequisites: ["alchemy_experimenter"],
    apply: (p) => { p.perkHealingMultiplier += 0.15; },
  },
  {
    id: "alchemy_snakeblood", name: "Snake Blood", skillId: "alchemy", requiredLevel: 75,
    description: "Repeated exposure to toxins hardens the body. +25 max health.",
    prerequisites: ["alchemy_potency"],
    apply: (p) => { p.maxHealth += 25; },
  },
  {
    id: "alchemy_master", name: "Alchemy Master", skillId: "alchemy", requiredLevel: 100,
    description: "Complete mastery of alchemical arts. +1 magicka regen, +20% healing effectiveness.",
    prerequisites: ["alchemy_snakeblood"],
    apply: (p) => { p.magickaRegen += 1; p.perkHealingMultiplier += 0.20; },
  },
] as const;

// ── PerkSystem ────────────────────────────────────────────────────────────────

export class PerkSystem {
  private readonly _player: Player;
  private readonly _skillSystem: SkillProgressionSystem;
  private readonly _perks: Map<string, PerkDefinition>;
  private readonly _unlockedIds: Set<string> = new Set();
  private _perkPoints: number = 0;

  /** Fired after a perk is successfully unlocked. */
  public onPerkUnlocked: ((perkId: string, perkName: string) => void) | null = null;

  constructor(player: Player, skillSystem: SkillProgressionSystem) {
    this._player = player;
    this._skillSystem = skillSystem;
    this._perks = new Map(PERK_DEFINITIONS.map((p) => [p.id, p]));
  }

  // ── Perk points ───────────────────────────────────────────────────────────

  public get perkPoints(): number { return this._perkPoints; }

  public addPerkPoints(amount: number): void {
    if (amount > 0) this._perkPoints += amount;
  }

  // ── Query ─────────────────────────────────────────────────────────────────

  public hasPerk(perkId: string): boolean {
    return this._unlockedIds.has(perkId);
  }

  /**
   * Returns whether the given perk can currently be purchased.
   * Checks: perk exists, not already unlocked, points available,
   * skill level requirement met, prerequisites unlocked.
   */
  public canUnlock(perkId: string): { allowed: boolean; reason?: string } {
    const perk = this._perks.get(perkId);
    if (!perk) return { allowed: false, reason: "Unknown perk." };
    if (this._unlockedIds.has(perkId)) return { allowed: false, reason: "Already unlocked." };
    if (this._perkPoints <= 0) return { allowed: false, reason: "No perk points available." };

    const skillLevel = this._skillSystem.getSkill(perk.skillId)?.level ?? 0;
    if (skillLevel < perk.requiredLevel) {
      return {
        allowed: false,
        reason: `Requires ${perk.skillId} level ${perk.requiredLevel} (current: ${skillLevel}).`,
      };
    }

    for (const prereqId of perk.prerequisites) {
      if (!this._unlockedIds.has(prereqId)) {
        const prereq = this._perks.get(prereqId);
        return { allowed: false, reason: `Requires perk: ${prereq?.name ?? prereqId}.` };
      }
    }

    return { allowed: true };
  }

  // ── Unlock ────────────────────────────────────────────────────────────────

  /**
   * Attempts to unlock a perk.
   * @returns true on success, false if the perk cannot be unlocked.
   */
  public unlock(perkId: string): boolean {
    const check = this.canUnlock(perkId);
    if (!check.allowed) return false;

    const perk = this._perks.get(perkId)!;
    this._unlockedIds.add(perkId);
    this._perkPoints--;
    perk.apply(this._player);
    this.onPerkUnlocked?.(perkId, perk.name);
    return true;
  }

  // ── View helpers ──────────────────────────────────────────────────────────

  /** Returns all perks for a skill, annotated with unlock/eligibility status. */
  public getPerksForSkill(skillId: PerkSkillId): ReadonlyArray<PerkEntry> {
    return PERK_DEFINITIONS
      .filter((p) => p.skillId === skillId)
      .map((p) => ({
        ...p,
        isUnlocked: this._unlockedIds.has(p.id),
        canUnlock: this.canUnlock(p.id).allowed,
      }));
  }

  /** Returns every perk annotated with unlock/eligibility status. */
  public getAllPerks(): ReadonlyArray<PerkEntry> {
    return PERK_DEFINITIONS.map((p) => ({
      ...p,
      isUnlocked: this._unlockedIds.has(p.id),
      canUnlock: this.canUnlock(p.id).allowed,
    }));
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  public getSaveState(): PerkSaveState {
    return {
      unlockedPerkIds: Array.from(this._unlockedIds),
      perkPoints: this._perkPoints,
    };
  }

  /**
   * Restores perk state from a save.
   *
   * Assumes the caller has already reset all perk-modified Player fields to
   * their base values (the SaveSystem does this before calling restoreFromSave
   * on each system, following the same pattern as SkillTreeSystem).
   */
  public restoreFromSave(data: PerkSaveState): void {
    this._unlockedIds.clear();
    this._perkPoints = typeof data.perkPoints === "number" ? Math.max(0, data.perkPoints) : 0;

    for (const perkId of Array.isArray(data.unlockedPerkIds) ? data.unlockedPerkIds : []) {
      const perk = this._perks.get(perkId);
      if (perk) {
        this._unlockedIds.add(perkId);
        perk.apply(this._player);
      }
    }
  }
}
