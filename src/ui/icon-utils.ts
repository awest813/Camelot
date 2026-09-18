import type { Item } from "../systems/inventory-system";
import type { AttributeName } from "../systems/attribute-system";

/**
 * Resolves a thematic visual icon glyph for an inventory or equipment item.
 * Prioritizes explicit `item.icon`, followed by slot mappings, name/id pattern heuristics,
 * and finally falls back to a generic item crate icon.
 */
export function getItemIcon(
  item?: Partial<Item> | { id?: string; name?: string; slot?: string; icon?: string } | null,
): string {
  if (!item) return "📦";
  if (item.icon && item.icon.trim().length > 0) return item.icon;

  const slot = item.slot?.toLowerCase();
  if (slot === "mainhand") return "⚔";
  if (slot === "offhand") return "🛡";
  if (slot === "head") return "🪖";
  if (slot === "chest") return "🥋";
  if (slot === "legs") return "👖";
  if (slot === "feet") return "👢";
  if (slot === "ring" || slot === "finger" || slot === "neck" || slot === "amulet") return "💍";

  const target = `${item.id ?? ""} ${item.name ?? ""}`.toLowerCase();

  if (/potion|elixir|draught|brew|flask|philter/.test(target)) return "🧪";
  if (/poison|venom|toxin/.test(target)) return "☠";
  if (/scroll|tome|book|note|letter|parchment|journal/.test(target)) return "📜";
  if (/ring|amulet|necklace|choker|circlet/.test(target)) return "💍";
  if (/key|latchkey/.test(target)) return "🗝";
  if (/bow|crossbow|arrow|quiver/.test(target)) return "🏹";
  if (/axe|battleaxe|hatchet|cleaver/.test(target)) return "🪓";
  if (/hammer|mace|warhammer|club|maul|flail/.test(target)) return "🔨";
  if (/staff|wand|scepter|rod/.test(target)) return "🪄";
  if (/shield|buckler|targe|aegis/.test(target)) return "🛡";
  if (/sword|blade|dagger|saber|rapier|katana|scimitar|halberd|spear/.test(target)) return "⚔";
  if (/helm|helmet|hood|coif|crown/.test(target)) return "🪖";
  if (/armor|cuirass|mail|plate|robe|tunic|vest/.test(target)) return "🥋";
  if (/greaves|leggings|pants|breeches/.test(target)) return "👖";
  if (/boots|shoes|sandals/.test(target)) return "👢";
  if (/gold|coin|septim|currency|money/.test(target)) return "🪙";
  if (/torch|candle|lantern/.test(target)) return "🪵";
  if (/meat|bread|cheese|apple|berry|food|ration|fish/.test(target)) return "🍖";
  if (/gem|ruby|sapphire|emerald|diamond|ore|ingot|crystal/.test(target)) return "💎";
  if (/flower|herb|leaf|root|mushroom|spore/.test(target)) return "🌿";

  return "📦";
}

/**
 * Returns a distinct visual icon for the primary character attributes.
 */
export function getAttributeIcon(attribute: AttributeName | string): string {
  switch (attribute.toLowerCase()) {
    case "strength":     return "💪";
    case "endurance":    return "🛡";
    case "intelligence": return "🧠";
    case "agility":      return "🏹";
    case "willpower":    return "🔮";
    case "speed":        return "⚡";
    case "luck":         return "🍀";
    default:             return "✦";
  }
}

/**
 * Returns a distinct visual icon for derived stats and reputation.
 */
export function getStatIcon(stat: string): string {
  switch (stat.toLowerCase()) {
    case "health":
    case "hp":
    case "maxhealth":    return "❤";
    case "magicka":
    case "mp":
    case "maxmagicka":   return "✦";
    case "stamina":
    case "sp":
    case "maxstamina":   return "⚡";
    case "carryweight":
    case "weight":       return "⚖";
    case "fame":         return "🌟";
    case "infamy":       return "💀";
    case "level":
    case "xp":
    case "xplevel":      return "⭐";
    default:             return "✦";
  }
}

/**
 * Returns a specialization icon.
 */
export function getSpecializationIcon(spec: string): string {
  switch (spec.toLowerCase()) {
    case "combat":  return "⚔";
    case "magic":   return "✦";
    case "stealth": return "🌙";
    default:        return "✦";
  }
}

/**
 * Returns a category icon for crafting tabs.
 */
export function getCraftingCategoryIcon(category: string): string {
  switch (category.toLowerCase()) {
    case "all":     return "✦";
    case "weapon":  return "⚔";
    case "armor":   return "🛡";
    case "jewelry": return "💍";
    case "misc":    return "📦";
    default:        return "✦";
  }
}

/**
 * Returns a category icon for journal browser tabs.
 */
export function getJournalCategoryIcon(category: string): string {
  switch (category.toLowerCase()) {
    case "all":         return "✦";
    case "quest":       return "📜";
    case "lore":        return "📖";
    case "note":        return "📝";
    case "rumor":       return "👂";
    case "observation": return "👁";
    case "misc":        return "🗂";
    case "favorites":   return "⭐";
    default:            return "📜";
  }
}

/**
 * Returns an icon for graphics quality tier presets.
 */
export function getGraphicsTierIcon(tier: string): string {
  switch (tier.toLowerCase()) {
    case "low":    return "⚡";
    case "medium": return "⚖";
    case "high":   return "🌟";
    case "ultra":  return "💎";
    default:       return "✦";
  }
}

/**
 * Returns an icon for combat difficulty settings.
 */
export function getDifficultyIcon(difficulty: string): string {
  switch (difficulty.toLowerCase()) {
    case "easy":   return "🛡";
    case "normal": return "⚔";
    case "hard":   return "💀";
    default:       return "⚔";
  }
}
