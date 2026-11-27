import type { InventorySystem, Item } from "./inventory-system";
import type { EquipmentSystem } from "./equipment-system";
import type { Player } from "../entities/player";
import type { UIManager } from "../ui/ui-manager";

// ── Spirit vessels (spirit vessels, in code) ────────────────────────────────────────────────────────────

export type VesselType = "clay" | "pewter" | "silver" | "gold" | "grail";

export interface VesselDefinition {
  type: VesselType;
  name: string;
  description: string;
  /** Multiplier applied to baseMagnitude when this gem is used. */
  magnitudeMultiplier: number;
  /** Gold value of one gem. */
  value: number;
}

export const SPIRIT_VESSELS: Record<VesselType, VesselDefinition> = {
  clay:   { type: "clay",   name: "Clay Vessel",   description: "A little clay flask that holds a faint spirit. Enables minor enchantments.",   magnitudeMultiplier: 0.5,  value: 25  },
  pewter: { type: "pewter", name: "Pewter Vessel", description: "A pewter flask that holds a small spirit. Enables moderate enchantments.",   magnitudeMultiplier: 0.75, value: 50  },
  silver: { type: "silver", name: "Silver Vessel", description: "A silver flask that holds a spirit of fair strength. Enables standard enchantments.", magnitudeMultiplier: 1.0, value: 100 },
  gold:   { type: "gold",   name: "Gold Vessel",   description: "A gold flask that holds a strong spirit. Enables powerful enchantments.",   magnitudeMultiplier: 1.5,  value: 200 },
  grail:  { type: "grail",  name: "Grail Vessel",  description: "A cup fit for the grail itself; it holds the greatest spirits. Enables the strongest enchantments.", magnitudeMultiplier: 2.0, value: 400 },
};

// ── Enchantment effect types ──────────────────────────────────────────────────

/** Which equipment category an enchantment can be applied to. */
export type EnchantmentCategory = "weapon" | "armor";

export interface EnchantmentEffectDefinition {
  id: string;
  name: string;
  description: string;
  /** Whether this enchantment applies to weapons or armor. */
  category: EnchantmentCategory;
  /**
   * Base magnitude before spirit-vessel and skill scaling.
   * For weapon enchants this is added to item.stats.damage.
   * For armor enchants this maps to the stat field below.
   */
  baseMagnitude: number;
  /**
   * Which item stat this enchantment modifies when equipped.
   * Undefined means a narrative-only / special-purpose effect.
   */
  statField?: "damage" | "armor" | "healthBonus" | "magickaBonus" | "staminaBonus";
  /** Label prefix applied to the renamed item, e.g. "Flaming". */
  namePrefix: string;
}

export const ENCHANTMENT_EFFECTS: EnchantmentEffectDefinition[] = [
  // ── Weapon enchantments ───────────────────────────────────────────────────
  {
    id: "fire_damage",
    name: "Fire Damage",
    description: "Sets the weapon alight, dealing bonus fire damage on each hit.",
    category: "weapon",
    baseMagnitude: 5,
    // Lands with each blow (CombatSystem reads the weapon's enchantment).
    namePrefix: "Flaming",
  },
  {
    id: "frost_damage",
    name: "Frost Damage",
    description: "Coats the blade with frost, dealing bonus frost damage on each hit.",
    category: "weapon",
    baseMagnitude: 5,
    // Lands with each blow (CombatSystem reads the weapon's enchantment).
    namePrefix: "Frozen",
  },
  {
    id: "shock_damage",
    name: "Shock Damage",
    description: "Charges the weapon with lightning, dealing bonus shock damage on each hit.",
    category: "weapon",
    baseMagnitude: 5,
    // Lands with each blow (CombatSystem reads the weapon's enchantment).
    namePrefix: "Shocking",
  },
  {
    id: "absorb_health",
    name: "Absorb Health",
    description: "Drains the target's life force, transferring it to the wielder.",
    category: "weapon",
    baseMagnitude: 4,
    // Lands with each blow (CombatSystem reads the weapon's enchantment).
    namePrefix: "Vampiric",
  },
  {
    id: "drain_magicka",
    name: "Drain Magicka",
    description: "Siphons magicka from the target on each strike.",
    category: "weapon",
    baseMagnitude: 5,
    // Lands with each blow (CombatSystem reads the weapon's enchantment).
    namePrefix: "Mystic",
  },
  // ── Armor enchantments ────────────────────────────────────────────────────
  {
    id: "fortify_health",
    name: "Fortify Health",
    description: "Increases the wearer's maximum health.",
    category: "armor",
    baseMagnitude: 10,
    statField: "healthBonus",
    namePrefix: "Resolute",
  },
  {
    id: "fortify_magicka",
    name: "Fortify Magicka",
    description: "Increases the wearer's maximum magicka.",
    category: "armor",
    baseMagnitude: 10,
    statField: "magickaBonus",
    namePrefix: "Scholar's",
  },
  {
    id: "fortify_stamina",
    name: "Fortify Stamina",
    description: "Increases the wearer's maximum stamina.",
    category: "armor",
    baseMagnitude: 10,
    statField: "staminaBonus",
    namePrefix: "Enduring",
  },
  {
    id: "fortify_strength",
    name: "Fortify Strength",
    description: "Boosts the wearer's strength, improving melee damage.",
    category: "armor",
    baseMagnitude: 5,
    statField: "damage",
    namePrefix: "Mighty",
  },
  {
    id: "resist_damage",
    name: "Resist Damage",
    description: "Imbues the armor with a ward against physical and magical harm.",
    category: "armor",
    baseMagnitude: 5,
    statField: "armor",
    namePrefix: "Warding",
  },
];

// ── Enchantment result stored on an item ─────────────────────────────────────

export interface ItemEnchantment {
  effectId: string;
  magnitude: number;
  vesselType: VesselType;
}

// ── Save state ────────────────────────────────────────────────────────────────

export interface EnchantingSaveState {
  /** Count of each spirit vessel type in the player's collection. */
  vessels: Partial<Record<VesselType, number>>;
  /** Enchanting skill level (0–100). */
  enchantingSkill: number;
}

// ── Helper: item category from equip slot ────────────────────────────────────

const WEAPON_SLOTS = new Set(["mainHand", "offHand"]);
const ARMOR_SLOTS  = new Set(["head", "chest", "legs", "feet"]);

/** Returns the enchantment category for a given equip slot, or null if not enchantable. */
export function getItemEnchantmentCategory(slot: string | undefined): EnchantmentCategory | null {
  if (!slot) return null;
  if (WEAPON_SLOTS.has(slot)) return "weapon";
  if (ARMOR_SLOTS.has(slot))  return "armor";
  return null;
}

// ── EnchantingSystem ──────────────────────────────────────────────────────────

/**
 * Enchanting: binding a spirit held in a vessel into a weapon or armour.
 *
 * Core loop:
 *  1. Player collects spirit vessels (addVessel).
 *  2. At the enchanting altar (E key), the player selects:
 *     a. An enchantable item from their inventory (weapon or armor).
 *     b. An enchantment effect appropriate for that item category.
 *     c. A spirit vessel to power the enchantment.
 *  3. enchantItem() validates prerequisites, consumes the spirit vessel,
 *     modifies the item's stats, renames the item, and raises the skill.
 *
 * Skill integration:
 *  - enchantingSkill (0–100) scales the final magnitude.
 *  - Every successful enchantment raises the skill by 1–3 points.
 *
 * Save integration:
 *  - spirit vessel counts and skill are persisted via getSaveState / restoreFromSave.
 *  - Enchanted item stats are already captured by the inventory/equipment save.
 */
export class EnchantingSystem {
  private _player: Player;
  private _inventory: InventorySystem;
  private _equipment: EquipmentSystem;
  private _ui: UIManager;

  /** spirit vessel inventory: type → count. */
  private _vessels: Map<VesselType, number> = new Map();

  /** Enchanting skill (0–100). Scales enchantment magnitude. */
  public enchantingSkill: number = 10;

  /** Effect index lookup for fast access. */
  private _effectById: Map<string, EnchantmentEffectDefinition> = new Map(
    ENCHANTMENT_EFFECTS.map(e => [e.id, e]),
  );

  /** Fired after a successful enchantment. */
  public onItemEnchanted: ((item: Item, enchantment: ItemEnchantment) => void) | null = null;

  constructor(player: Player, inventory: InventorySystem, equipment: EquipmentSystem, ui: UIManager) {
    this._player    = player;
    this._inventory = inventory;
    this._equipment = equipment;
    this._ui        = ui;
  }

  // ── spirit vessel management ──────────────────────────────────────────────────

  /** Add `quantity` spirit vessels of the given type. */
  public addVessel(type: VesselType, quantity: number = 1): void {
    this._vessels.set(type, (this._vessels.get(type) ?? 0) + quantity);
  }

  /** Remove one spirit vessel of the given type. Returns false if none available. */
  public removeVessel(type: VesselType): boolean {
    const current = this._vessels.get(type) ?? 0;
    if (current < 1) return false;
    if (current === 1) {
      this._vessels.delete(type);
    } else {
      this._vessels.set(type, current - 1);
    }
    return true;
  }

  /** Current count of a spirit vessel type. */
  public getVesselCount(type: VesselType): number {
    return this._vessels.get(type) ?? 0;
  }

  /** All spirit vessel types the player currently holds (count > 0). */
  public getAvailableVessels(): Array<{ def: VesselDefinition; count: number }> {
    const result: Array<{ def: VesselDefinition; count: number }> = [];
    for (const [type, count] of this._vessels) {
      if (count > 0) result.push({ def: SPIRIT_VESSELS[type], count });
    }
    return result;
  }

  // ── Effect catalogue ─────────────────────────────────────────────────────

  /** All defined enchantment effects. */
  public getEffectDefinitions(): EnchantmentEffectDefinition[] {
    return ENCHANTMENT_EFFECTS.slice();
  }

  /** Effects valid for a specific enchantment category. */
  public getEffectsForCategory(category: EnchantmentCategory): EnchantmentEffectDefinition[] {
    return ENCHANTMENT_EFFECTS.filter(e => e.category === category);
  }

  // ── Enchantable items ────────────────────────────────────────────────────

  /**
   * Returns items from the player's inventory that can be enchanted
   * (i.e., have an equip slot of weapon or armor type AND are not already enchanted).
   */
  public getEnchantableItems(): Item[] {
    return this._inventory.items.filter(item => {
      if (!getItemEnchantmentCategory(item.slot)) return false;
      // Skip already-enchanted items (only one enchantment per item)
      if (item.stats?.enchantment) return false;
      return true;
    });
  }

  // ── Enchantment crafting ─────────────────────────────────────────────────

  /**
   * Attempt to enchant an item.
   *
   * @param itemId    - ID of the inventory item to enchant.
   * @param effectId  - Enchantment effect to apply.
   * @param gemType   - spirit vessel type to consume.
   * @returns The enchanted item on success, or null with a UI notification on failure.
   */
  public enchantItem(
    itemId: string,
    effectId: string,
    gemType: VesselType,
  ): Item | null {
    // Validate spirit vessel availability
    if ((this._vessels.get(gemType) ?? 0) < 1) {
      this._ui.showNotification(`No ${SPIRIT_VESSELS[gemType].name} available.`, 2000);
      return null;
    }

    // Find the item in inventory
    const itemIndex = this._inventory.items.findIndex(i => i.id === itemId);
    if (itemIndex === -1) {
      this._ui.showNotification("Item not found in inventory.", 2000);
      return null;
    }
    const item = this._inventory.items[itemIndex];

    // Validate item is enchantable
    const category = getItemEnchantmentCategory(item.slot);
    if (!category) {
      this._ui.showNotification(`${item.name} cannot be enchanted.`, 2000);
      return null;
    }
    if (item.stats?.enchantment) {
      this._ui.showNotification(`${item.name} is already enchanted.`, 2000);
      return null;
    }

    // Validate effect definition and category match
    const effectDef = this._effectById.get(effectId);
    if (!effectDef) {
      this._ui.showNotification("Unknown enchantment effect.", 2000);
      return null;
    }
    if (effectDef.category !== category) {
      this._ui.showNotification(
        `${effectDef.name} can only be applied to ${effectDef.category === "weapon" ? "weapons" : "armor"}.`,
        2000,
      );
      return null;
    }

    // Compute magnitude: baseMagnitude × gemMultiplier × skillMultiplier
    const gemDef       = SPIRIT_VESSELS[gemType];
    const skillMult    = 0.5 + (this.enchantingSkill / 100) * 1.5;
    const magnitude    = Math.max(1, Math.round(effectDef.baseMagnitude * gemDef.magnitudeMultiplier * skillMult));

    // Consume the spirit vessel
    this.removeVessel(gemType);

    // Apply stats to the item copy
    const enchantment: ItemEnchantment = { effectId, magnitude, vesselType: gemType };
    const updatedStats = { ...(item.stats ?? {}), enchantment };

    if (effectDef.statField) {
      const prev = (updatedStats[effectDef.statField] as number | undefined) ?? 0;
      updatedStats[effectDef.statField] = prev + magnitude;
    }

    // Rename item with the enchantment prefix
    const newName = `${effectDef.namePrefix} ${item.name}`;
    const enchantedItem: Item = {
      ...item,
      name: newName,
      stats: updatedStats,
    };

    // Replace item in inventory
    this._inventory.items[itemIndex] = enchantedItem;

    // If the item is currently equipped, re-apply stat delta
    if (this._equipment.isEquipped(itemId) && effectDef.statField) {
      this._applyStatDelta(effectDef.statField, magnitude);
    }

    // Raise skill (more complex enchants from larger vessels = more XP)
    const gemTiers: Record<VesselType, number> = { clay: 1, pewter: 2, silver: 3, gold: 4, grail: 5 };
    this.enchantingSkill = Math.min(100, this.enchantingSkill + gemTiers[gemType]);

    this._ui.showNotification(`Enchanted: ${newName} (+${magnitude} ${effectDef.name})`, 3000);
    this.onItemEnchanted?.(enchantedItem, enchantment);
    return enchantedItem;
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  /** Apply a direct stat delta to the player (used when enchanting an equipped item). */
  private _applyStatDelta(statField: string, delta: number): void {
    switch (statField) {
      case "damage":       this._player.bonusDamage   += delta; break;
      case "armor":        this._player.bonusArmor    += delta; break;
      case "healthBonus":  this._player.maxHealth     += delta; break;
      case "magickaBonus": this._player.maxMagicka    += delta; break;
      case "staminaBonus": this._player.maxStamina    += delta; break;
    }
  }

  // ── Persistence ──────────────────────────────────────────────────────────

  public getSaveState(): EnchantingSaveState {
    const vessels: Partial<Record<VesselType, number>> = {};
    for (const [type, count] of this._vessels) {
      vessels[type] = count;
    }
    return { vessels, enchantingSkill: this.enchantingSkill };
  }

  public restoreFromSave(state: EnchantingSaveState): void {
    if (!state) return;

    this._vessels.clear();
    // (Saves from before the rename call it `soulGems`.)
    const vessels = state.vessels ?? (state as { soulGems?: EnchantingSaveState["vessels"] }).soulGems;
    if (vessels && typeof vessels === "object") {
      for (const [type, count] of Object.entries(vessels)) {
        if (type in SPIRIT_VESSELS && typeof count === "number" && count > 0) {
          this._vessels.set(type as VesselType, count);
        }
      }
    }

    if (typeof state.enchantingSkill === "number" && Number.isFinite(state.enchantingSkill)) {
      this.enchantingSkill = Math.max(0, Math.min(100, state.enchantingSkill));
    }
  }
}
