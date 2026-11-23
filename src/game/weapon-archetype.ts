/**
 * Which combat archetype a weapon fights as, from its id and name
 * (default: sword).  Moved out of game.ts (engine overhaul, Phase 1).
 */
import type { Item } from "../systems/inventory-system";
import type { WeaponArchetype } from "../systems/combat-shared";

export function weaponArchetypeOf(item: Item | undefined): WeaponArchetype {
  if (!item) return "sword";
  const hay = `${item.id} ${item.name}`.toLowerCase();
  if (hay.includes("bow")) return "bow";
  if (hay.includes("staff")) return "staff";
  if (hay.includes("dagger")) return "dagger";
  if (/greatsword|great_|two-handed|two_handed/.test(hay)) return "greatsword";
  if (hay.includes("mace") || hay.includes("hammer")) return "mace";
  if (hay.includes("axe")) return "axe";
  return "sword";
}
