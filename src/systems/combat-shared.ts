/**
 * Weapon profiles and physical damage resolution shared by {@link CombatSystem}
 * and {@link ProjectileSystem}. Kept free of Babylon-only imports so tests can
 * import it without pulling rendering code.
 */
import type { NPC, DamageType } from "../entities/npc";
import type { ProgressionSkillId } from "./skill-progression-system";

/**
 * Applies NPC-specific resistance, weakness, and armor rating to a raw damage amount.
 *
 * Resistance/weakness pass:
 *   damage = baseDamage × max(0, 1 − resistance + weakness)
 *
 * Armor rating pass (physical damage only — Oblivion-style):
 *   effectiveAR = armorRating × (1 − armorPenFraction)
 *   damage = damage × 100 / (100 + effectiveAR)
 *
 * Resistance values are clamped to [0, 1] so that full immunity is the maximum.
 * A missing entry defaults to 0 (no modification).
 *
 * **Minimum damage floor**: The result is always at least 1.
 */
export function applyDamageWithResistance(
  baseDamage: number,
  npc: NPC,
  type: DamageType,
  armorPenFraction: number = 0,
): number {
  const resistance = Math.min(1, Math.max(0, npc.damageResistances?.[type] ?? 0));
  const weakness = Math.max(0, npc.damageWeaknesses?.[type] ?? 0);
  let damage = baseDamage * (1 - resistance + weakness);

  if (type === "physical" && npc.armorRating > 0) {
    const penClamped = Math.min(1, Math.max(0, armorPenFraction));
    const effectiveAR = npc.armorRating * (1 - penClamped);
    damage *= 100 / (100 + effectiveAR);
  }

  return Math.max(1, Math.round(damage));
}

export type WeaponArchetype =
  | "sword"
  | "axe"
  | "mace"
  | "bow"
  | "staff"
  | "dagger"
  | "greatsword";

export interface WeaponProfile {
  damageMultiplier: number;
  critChanceBonus: number;
  armorPenFraction: number;
  attackRange: number;
  skillId: ProgressionSkillId;
  label: string;
  staminaCostMultiplier: number;
  cooldownMultiplier: number;
  staggerChance: number;
  staggerDuration: number;
  canBlock: boolean;
  backstabMultiplier: number;
  sweepArcHalfAngle: number;
}

export const WEAPON_PROFILES: Record<WeaponArchetype, WeaponProfile> = {
  sword: {
    damageMultiplier: 1.0,
    critChanceBonus: 0.10,
    armorPenFraction: 0.10,
    attackRange: 3.0,
    skillId: "blade",
    label: "Sword",
    staminaCostMultiplier: 0.80,
    cooldownMultiplier:    0.85,
    staggerChance:         0.15,
    staggerDuration:       0.20,
    canBlock:              true,
    backstabMultiplier:    1.0,
    sweepArcHalfAngle:     0,
  },
  axe: {
    damageMultiplier: 1.20,
    critChanceBonus: 0.05,
    armorPenFraction: 0.25,
    attackRange: 2.8,
    skillId: "blade",
    label: "Axe",
    staminaCostMultiplier: 1.10,
    cooldownMultiplier:    1.15,
    staggerChance:         0.10,
    staggerDuration:       0.15,
    canBlock:              true,
    backstabMultiplier:    1.0,
    sweepArcHalfAngle:     0,
  },
  mace: {
    damageMultiplier: 1.45,
    critChanceBonus: 0.02,
    armorPenFraction: 0.50,
    attackRange: 2.5,
    skillId: "blunt",
    label: "Mace",
    staminaCostMultiplier: 1.40,
    cooldownMultiplier:    1.40,
    staggerChance:         0.40,
    staggerDuration:       0.45,
    canBlock:              true,
    backstabMultiplier:    1.0,
    sweepArcHalfAngle:     0,
  },
  bow: {
    damageMultiplier: 0.85,
    critChanceBonus: 0.15,
    armorPenFraction: 0.05,
    attackRange: 25.0,
    skillId: "marksman",
    label: "Bow",
    staminaCostMultiplier: 1.00,
    cooldownMultiplier:    1.00,
    staggerChance:         0.00,
    staggerDuration:       0.00,
    canBlock:              true,
    backstabMultiplier:    1.0,
    sweepArcHalfAngle:     0,
  },
  staff: {
    damageMultiplier: 0.60,
    critChanceBonus: 0.02,
    armorPenFraction: 0.00,
    attackRange: 3.0,
    skillId: "destruction",
    label: "Staff",
    staminaCostMultiplier: 1.20,
    cooldownMultiplier:    1.50,
    staggerChance:         0.05,
    staggerDuration:       0.10,
    canBlock:              true,
    backstabMultiplier:    1.0,
    sweepArcHalfAngle:     0,
  },
  dagger: {
    damageMultiplier: 0.62,
    critChanceBonus: 0.18,
    armorPenFraction: 0.12,
    attackRange: 1.7,
    skillId: "blade",
    label: "Dagger",
    staminaCostMultiplier: 0.55,
    cooldownMultiplier:    0.55,
    staggerChance:         0.04,
    staggerDuration:       0.08,
    canBlock:              true,
    backstabMultiplier:    2.5,
    sweepArcHalfAngle:     0,
  },
  greatsword: {
    damageMultiplier: 1.85,
    critChanceBonus: 0.06,
    armorPenFraction: 0.22,
    attackRange: 3.5,
    skillId: "blade",
    label: "Greatsword",
    staminaCostMultiplier: 1.90,
    cooldownMultiplier:    1.95,
    staggerChance:         0.60,
    staggerDuration:       0.60,
    canBlock:              false,
    backstabMultiplier:    1.0,
    sweepArcHalfAngle:     Math.PI / 4.5,
  },
};
