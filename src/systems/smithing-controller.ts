/**
 * SmithingController — game-layer glue that makes CraftingSystem (smithing)
 * and ItemConditionSystem (gear wear + repair) playable.
 *
 * Both engines are headless: CraftingSystem only validates recipes and
 * ItemConditionSystem only tracks numbers.  This controller owns the parts
 * that touch the real game:
 *
 * - **Smithing**: counts materials from the player's inventory, removes them
 *   on a successful craft, builds the output item (stats scaled by the
 *   quality the player's Armorer skill earns), and awards Armorer XP.
 * - **Wear**: equipped weapons lose condition when they land blows, shields
 *   when they block, and armor when the player is struck.  Worn gear is
 *   weaker — the lost damage/armor is published on the player as
 *   `gearDamagePenalty` / `gearArmorPenalty`, which combat subtracts.
 * - **Repair**: using a Repair Hammer from the inventory mends the most
 *   damaged equipped piece by an amount that scales with Armorer skill.
 *
 * Condition is tracked per piece: every wearable gets an `instanceId` the
 * first time it is forged, equipped or worn, so two Iron Swords wear
 * independently.  The id travels with the item through equip/unequip, barter
 * and saves (items are serialized whole).
 */

import {
  CraftingSystem,
  ITEM_QUALITY_LABELS,
  type CraftingStationId,
  type CraftingRecipe,
  type CraftOutcome,
  type ItemQuality,
  type MaterialInventory,
} from "./crafting-system";
import {
  ItemConditionSystem,
  MAX_CONDITION,
  BASE_REPAIR_KIT_AMOUNT,
  REPAIR_KIT_SKILL_SCALE,
} from "./item-condition-system";
import type { Item } from "./inventory-system";

// ── Collaborator interfaces (narrow, so the controller tests headlessly) ─────

export interface SmithingInventory {
  items: Item[];
  maxCapacity: number;
  addItem(item: Item): boolean;
  removeItem(itemId: string, amount?: number): boolean;
  /** Remove `amount` units across every stack of `itemId` (all or nothing). */
  removeQuantity(itemId: string, amount: number): boolean;
}

export interface SmithingEquipment {
  getEquipped(): ReadonlyMap<string, Item>;
}

export interface SmithingPlayer {
  gearDamagePenalty: number;
  gearArmorPenalty: number;
  /** Armorer perk: multiplier on repair-hammer restoration (default 1). */
  perkRepairMultiplier?: number;
  /** Armorer perk: multiplier on wear per hit (default 1; lower = slower wear). */
  perkWearMultiplier?: number;
  /** Armorer perk: extra effective skill when judging crafted quality (default 0). */
  perkSmithingQualityBonus?: number;
}

export interface SmithingControllerDeps {
  inventory: SmithingInventory;
  equipment: SmithingEquipment;
  player: SmithingPlayer;
  /** Current Armorer skill level [0–100]. */
  getArmorerSkill: () => number;
  /** Award Armorer XP (class multipliers are the caller's concern). */
  gainArmorerXp: (amount: number) => void;
  notify: (message: string, durationMs?: number) => void;
  /** RNG for picking which armor piece takes a hit (tests inject one). */
  random?: () => number;
  /** Instance-id factory (tests inject a deterministic one). */
  newInstanceId?: (itemId: string) => string;
}

let _instanceCounter = 0;
function defaultInstanceId(itemId: string): string {
  _instanceCounter = (_instanceCounter + 1) % 1_679_616;
  return `${itemId}#${Date.now().toString(36)}${_instanceCounter.toString(36)}`;
}

/** Key under which an item's condition is stored (its instance id, else its item id). */
export function conditionKey(item: Item): string {
  return item.instanceId ?? item.id;
}

// ── Item catalog ──────────────────────────────────────────────────────────────

/** Item id of the consumable that repairs gear. */
export const REPAIR_HAMMER_ID = "repair_hammer";

/** Smithing materials and the repair hammer, as inventory items (quantity 1). */
export const SMITHING_MATERIAL_ITEMS: Readonly<Record<string, Item>> = {
  iron_ingot: {
    id: "iron_ingot", name: "Iron Ingot", description: "A bar of smelted iron. Used at the forge (Shift+B).",
    stackable: true, quantity: 1, weight: 1, stats: { value: 7 },
  },
  steel_ingot: {
    id: "steel_ingot", name: "Steel Ingot", description: "Tempered steel, stronger than iron. Used at the forge (Shift+B).",
    stackable: true, quantity: 1, weight: 1, stats: { value: 20 },
  },
  leather_strips: {
    id: "leather_strips", name: "Leather Strips", description: "Cured hide cut into strips for grips and straps.",
    stackable: true, quantity: 1, weight: 0.1, stats: { value: 3 },
  },
  [REPAIR_HAMMER_ID]: {
    id: REPAIR_HAMMER_ID, name: "Repair Hammer",
    description: "Click to mend your most worn equipped piece. Armorer skill makes each use count for more.",
    stackable: true, quantity: 1, weight: 0.5, stats: { value: 12 },
  },
};

/** Returns a fresh inventory stack of a smithing material. */
export function smithingMaterialStack(itemId: string, quantity: number): Item {
  const base = SMITHING_MATERIAL_ITEMS[itemId];
  if (!base) throw new Error(`Unknown smithing material "${itemId}"`);
  return { ...base, stats: { ...base.stats }, quantity };
}

/** Base (pre-quality) templates for everything the forge produces. */
export const SMITHING_OUTPUT_ITEMS: Readonly<Record<string, Omit<Item, "quantity">>> = {
  iron_dagger:      { id: "iron_dagger",      name: "Iron Dagger",      description: "Short, quick and easy to hide.",         stackable: false, slot: "mainHand", weight: 1.5, stats: { damage: 7,  value: 30 } },
  iron_sword:       { id: "iron_sword",       name: "Iron Sword",       description: "A basic iron sword.",                    stackable: false, slot: "mainHand", weight: 3,   stats: { damage: 10, value: 80 } },
  iron_helm_01:     { id: "iron_helm_01",     name: "Iron Helm",        description: "A sturdy iron helmet.",                  stackable: false, slot: "head",     weight: 2.5, stats: { armor: 12,  value: 45 } },
  iron_shield:      { id: "iron_shield",      name: "Iron Shield",      description: "A round shield of riveted iron.",        stackable: false, slot: "offHand",  weight: 5,   stats: { armor: 6,   value: 60 } },
  iron_cuirass:     { id: "iron_cuirass",     name: "Iron Cuirass",     description: "Heavy plated protection.",               stackable: false, slot: "chest",    weight: 8,   stats: { armor: 12,  value: 120 } },
  leather_chest_01: { id: "leather_chest_01", name: "Leather Chest",    description: "Light armor stitched from cured hide.",  stackable: false, slot: "chest",    weight: 4,   stats: { armor: 15,  value: 55 } },
  steel_sword:      { id: "steel_sword",      name: "Steel Sword",      description: "Forged with superior steel.",            stackable: false, slot: "mainHand", weight: 4,   stats: { damage: 16, value: 220 } },
  steel_shield:     { id: "steel_shield",     name: "Steel Shield",     description: "A kite shield of tempered steel.",       stackable: false, slot: "offHand",  weight: 6,   stats: { armor: 10,  value: 160 } },
  steel_cuirass:    { id: "steel_cuirass",    name: "Steel Cuirass",    description: "Well-tempered steel plate.",             stackable: false, slot: "chest",    weight: 10,  stats: { armor: 18,  value: 300 } },
  steel_ingot:      SMITHING_MATERIAL_ITEMS.steel_ingot,
  [REPAIR_HAMMER_ID]: SMITHING_MATERIAL_ITEMS[REPAIR_HAMMER_ID],
};

/** Stat multiplier earned by the crafted quality (skill above the recipe's requirement). */
export const QUALITY_STAT_MULTIPLIERS: Readonly<Record<ItemQuality, number>> = {
  base:       1.0,
  fine:       1.1,
  superior:   1.2,
  exquisite:  1.3,
  masterwork: 1.45,
};

/**
 * Default smithing recipes.  Iron basics and hammers can be field-smithed
 * anywhere; smelting steel, steel gear and the iron cuirass need a forge.
 */
export const SMITHING_RECIPES: readonly CraftingRecipe[] = [
  { id: "smith_repair_hammer", label: "Repair Hammers (×2)", category: "misc", tier: "iron",
    requiredMaterials: [{ materialId: "iron_ingot", quantity: 1 }, { materialId: "leather_strips", quantity: 1 }],
    outputItemId: REPAIR_HAMMER_ID, outputItemName: "Repair Hammer", outputQuantity: 2, craftingXp: 6,
    description: "Mend worn gear in the field. Click one in your inventory to use it." },
  { id: "smith_iron_dagger", label: "Iron Dagger", category: "weapon", tier: "iron",
    requiredMaterials: [{ materialId: "iron_ingot", quantity: 1 }, { materialId: "leather_strips", quantity: 1 }],
    outputItemId: "iron_dagger", outputItemName: "Iron Dagger", craftingXp: 10 },
  { id: "smith_iron_sword", label: "Iron Sword", category: "weapon", tier: "iron",
    requiredMaterials: [{ materialId: "iron_ingot", quantity: 2 }, { materialId: "leather_strips", quantity: 1 }],
    outputItemId: "iron_sword", outputItemName: "Iron Sword", craftingXp: 12 },
  { id: "smith_iron_helm", label: "Iron Helm", category: "armor", tier: "iron",
    requiredMaterials: [{ materialId: "iron_ingot", quantity: 2 }],
    outputItemId: "iron_helm_01", outputItemName: "Iron Helm", craftingXp: 12 },
  { id: "smith_leather_chest", label: "Leather Chest", category: "armor", tier: "iron",
    requiredMaterials: [{ materialId: "leather_strips", quantity: 4 }],
    outputItemId: "leather_chest_01", outputItemName: "Leather Chest", requiredSkill: 5, craftingXp: 12 },
  { id: "smith_iron_shield", label: "Iron Shield", category: "armor", tier: "iron",
    requiredMaterials: [{ materialId: "iron_ingot", quantity: 3 }, { materialId: "leather_strips", quantity: 1 }],
    outputItemId: "iron_shield", outputItemName: "Iron Shield", requiredSkill: 5, craftingXp: 14 },
  { id: "smith_iron_cuirass", label: "Iron Cuirass", stationId: "forge", category: "armor", tier: "iron",
    requiredMaterials: [{ materialId: "iron_ingot", quantity: 5 }, { materialId: "leather_strips", quantity: 2 }],
    outputItemId: "iron_cuirass", outputItemName: "Iron Cuirass", requiredSkill: 10, craftingXp: 18 },
  { id: "smith_steel_ingot", label: "Steel Ingot (smelt)", stationId: "forge", category: "misc", tier: "steel",
    requiredMaterials: [{ materialId: "iron_ingot", quantity: 2 }],
    outputItemId: "steel_ingot", outputItemName: "Steel Ingot", requiredSkill: 15, craftingXp: 8,
    description: "Fold two iron ingots into one bar of steel." },
  { id: "smith_steel_sword", label: "Steel Sword", stationId: "forge", category: "weapon", tier: "steel",
    requiredMaterials: [{ materialId: "steel_ingot", quantity: 2 }, { materialId: "leather_strips", quantity: 1 }],
    outputItemId: "steel_sword", outputItemName: "Steel Sword", requiredSkill: 25, craftingXp: 16 },
  { id: "smith_steel_shield", label: "Steel Shield", stationId: "forge", category: "armor", tier: "steel",
    requiredMaterials: [{ materialId: "steel_ingot", quantity: 3 }, { materialId: "leather_strips", quantity: 1 }],
    outputItemId: "steel_shield", outputItemName: "Steel Shield", requiredSkill: 30, craftingXp: 18 },
  { id: "smith_steel_cuirass", label: "Steel Cuirass", stationId: "forge", category: "armor", tier: "steel",
    requiredMaterials: [{ materialId: "steel_ingot", quantity: 5 }, { materialId: "leather_strips", quantity: 2 }],
    outputItemId: "steel_cuirass", outputItemName: "Steel Cuirass", requiredSkill: 35, craftingXp: 22 },
];

// ── Wear tuning ───────────────────────────────────────────────────────────────

/** Condition lost by the main-hand weapon per landed melee blow. */
export const WEAPON_WEAR_PER_HIT = 0.5;
/** Condition lost by the main-hand weapon per landed power attack. */
export const WEAPON_WEAR_PER_POWER_ATTACK = 1;
/** Condition lost by one armor piece each time the player is struck. */
export const ARMOR_WEAR_PER_HIT = 1;
/** Condition lost by the shield (or weapon, when parrying) per blocked blow. */
export const BLOCK_WEAR_PER_BLOCK = 1;
/** Trade value of a broken (0%) piece, as a fraction of its full value. */
export const MIN_VALUE_FACTOR = 0.25;
/** Armorer XP per successful repair. */
export const REPAIR_XP = 4;

const ARMOR_SLOTS = ["head", "chest", "legs", "feet", "offHand"] as const;

// ── Forges in the world ───────────────────────────────────────────────────────

/** How close (world units, XZ plane) the player must be to use a forge. */
export const FORGE_USE_RADIUS = 8;

/**
 * Positions of usable forges.  Forges are registered when their site is
 * generated (not when the mesh finishes loading) and removed with their chunk.
 */
export class ForgeRegistry {
  private readonly _forges = new Map<string, { x: number; z: number; group: string | null }>();

  /** Register (or move) a forge.  `group` is usually the owning chunk key. */
  public add(id: string, x: number, z: number, group: string | null = null): void {
    this._forges.set(id, { x, z, group });
  }

  /** Remove every forge registered under `group` (e.g. on chunk unload). */
  public removeGroup(group: string): void {
    for (const [id, f] of this._forges) {
      if (f.group === group) this._forges.delete(id);
    }
  }

  public get size(): number {
    return this._forges.size;
  }

  /** Distance from (x, z) to the nearest forge, or Infinity when there is none. */
  public nearestDistance(x: number, z: number): number {
    let best = Infinity;
    for (const f of this._forges.values()) {
      const d = Math.hypot(f.x - x, f.z - z);
      if (d < best) best = d;
    }
    return best;
  }

  /** The station the player is standing at: "forge" when one is in reach. */
  public stationAt(x: number, z: number, radius = FORGE_USE_RADIUS): CraftingStationId | undefined {
    return this.nearestDistance(x, z) <= radius ? "forge" : undefined;
  }
}

// ── Controller ────────────────────────────────────────────────────────────────

export class SmithingController {
  public readonly crafting: CraftingSystem;
  public readonly condition: ItemConditionSystem;
  private readonly _deps: SmithingControllerDeps;
  private readonly _random: () => number;

  constructor(crafting: CraftingSystem, condition: ItemConditionSystem, deps: SmithingControllerDeps) {
    this.crafting = crafting;
    this.condition = condition;
    this._deps = deps;
    this._random = deps.random ?? Math.random;

    for (const recipe of SMITHING_RECIPES) {
      if (!crafting.getRecipe(recipe.id)) crafting.addRecipe(recipe);
    }
    crafting.materialLabel = (id) => SMITHING_MATERIAL_ITEMS[id]?.name ?? id;

    condition.onItemBroken = (itemId) => {
      const name = this._equippedName(itemId) ?? itemId;
      deps.notify(`Your ${name} is broken! Use a Repair Hammer.`, 3200);
    };
  }

  // ── Smithing ────────────────────────────────────────────────────────────────

  /** Material counts drawn from the player's inventory. */
  public getMaterials(): MaterialInventory {
    const out: MaterialInventory = {};
    for (const item of this._deps.inventory.items) {
      out[item.id] = (out[item.id] ?? 0) + item.quantity;
    }
    return out;
  }

  /**
   * Craft a recipe for real: validate, check bag space, consume materials,
   * add the output (quality-scaled) and award XP.  Notifies the player either way.
   */
  public craft(recipeId: string, stationId?: CraftingStationId): CraftOutcome {
    const recipe = this.crafting.getRecipe(recipeId);
    const skill = this._deps.getArmorerSkill();
    const materials = this.getMaterials();

    const blocked = this.crafting.whyCannotCraft(recipeId, materials, skill, stationId);
    if (blocked) {
      this._deps.notify(blocked.message, 2400);
      return blocked;
    }
    if (recipe && !this._hasRoomFor(recipe)) {
      const failure: CraftOutcome = {
        success: false,
        reason: "missing_materials",
        message: "Inventory full — make room before smithing.",
      };
      this._deps.notify(failure.message, 2400);
      return failure;
    }

    // Requirements were checked at the real skill above; the Master Craftsman
    // perk only lifts the skill the forge uses to judge quality.
    const qualitySkill = skill + (this._deps.player.perkSmithingQualityBonus ?? 0);
    const outcome = this.crafting.craft(recipeId, materials, qualitySkill, stationId);
    if (!outcome.success || !recipe) return outcome;

    for (const m of recipe.requiredMaterials) {
      // Materials may sit in several stacks — getMaterials() counted them all.
      this._deps.inventory.removeQuantity(m.materialId, m.quantity);
    }
    const item = this.buildOutputItem(outcome.result.outputItemId, outcome.result.quality, outcome.result.quantity);
    if (this._isWearable(item)) {
      // Fresh from the anvil: its own instance, pristine.
      item.instanceId = this._newInstanceId(item.id);
      this.condition.initItem(item.instanceId, MAX_CONDITION);
    }
    // addItem announces "Added <item>" itself; no second toast here.
    this._deps.inventory.addItem(item);
    this._deps.gainArmorerXp(outcome.result.xpAwarded);
    return outcome;
  }

  /**
   * Build the inventory item a recipe produces.  Equippable gear above base
   * quality gets a distinct id (e.g. `steel_sword_fine`), a prefixed name and
   * scaled damage/armor/value; materials and hammers are quality-agnostic.
   */
  public buildOutputItem(outputItemId: string, quality: ItemQuality, quantity: number): Item {
    const template = SMITHING_OUTPUT_ITEMS[outputItemId];
    if (!template) {
      return { id: outputItemId, name: outputItemId, description: "", stackable: true, quantity };
    }
    const stats = { ...(template.stats ?? {}) };
    if (!template.slot || quality === "base") {
      return { ...template, stats, quantity };
    }
    const mult = QUALITY_STAT_MULTIPLIERS[quality];
    if (typeof stats.damage === "number") stats.damage = Math.round(stats.damage * mult);
    if (typeof stats.armor === "number") stats.armor = Math.round(stats.armor * mult);
    if (typeof stats.value === "number") stats.value = Math.round(stats.value * mult);
    return {
      ...template,
      id: `${template.id}_${quality}`,
      name: `${ITEM_QUALITY_LABELS[quality]} ${template.name}`,
      stats,
      quantity,
    };
  }

  private _hasRoomFor(recipe: CraftingRecipe): boolean {
    const inv = this._deps.inventory;
    let freed = 0;
    for (const m of recipe.requiredMaterials) {
      const have = inv.items.filter((i) => i.id === m.materialId).reduce((n, i) => n + i.quantity, 0);
      if (have === m.quantity) freed += inv.items.filter((i) => i.id === m.materialId).length;
    }
    const template = SMITHING_OUTPUT_ITEMS[recipe.outputItemId];
    const stacksOntoExisting = !!template?.stackable && inv.items.some((i) => i.id === recipe.outputItemId);
    const needed = stacksOntoExisting ? 0 : 1;
    return inv.items.length - freed + needed <= inv.maxCapacity;
  }

  // ── Wear ────────────────────────────────────────────────────────────────────

  /** Start tracking any equipped gear that has no condition yet (new items start pristine). */
  public trackEquippedGear(): void {
    for (const item of this._deps.equipment.getEquipped().values()) {
      if (this._isWearable(item)) this._ensureTracked(item);
    }
  }

  /** The main-hand weapon landed a blow. */
  public onWeaponHit(powerAttack = false): void {
    const weapon = this._deps.equipment.getEquipped().get("mainHand");
    if (!weapon || !this._isWearable(weapon)) return;
    this._wear(weapon, powerAttack ? WEAPON_WEAR_PER_POWER_ATTACK : WEAPON_WEAR_PER_HIT);
  }

  /** The player was struck: one random worn armor piece takes the wear. */
  public onPlayerStruck(): void {
    const equipped = this._deps.equipment.getEquipped();
    const pieces: Item[] = [];
    for (const slot of ARMOR_SLOTS) {
      const item = equipped.get(slot);
      if (item && typeof item.stats?.armor === "number" && item.stats.armor > 0) pieces.push(item);
    }
    if (pieces.length === 0) return;
    const pick = pieces[Math.min(pieces.length - 1, Math.floor(this._random() * pieces.length))];
    this._wear(pick, ARMOR_WEAR_PER_HIT);
  }

  /** A blow was blocked: the shield takes it, or the weapon when parrying bare-handed. */
  public onBlock(): void {
    const equipped = this._deps.equipment.getEquipped();
    const shield = equipped.get("offHand");
    const target = shield && this._isWearable(shield) ? shield : equipped.get("mainHand");
    if (!target || !this._isWearable(target)) return;
    this._wear(target, BLOCK_WEAR_PER_BLOCK);
  }

  private _wear(item: Item, amount: number): void {
    const key = this._ensureTracked(item);
    const scaled = amount * Math.max(0, this._deps.player.perkWearMultiplier ?? 1);
    if (scaled <= 0) return;
    this.condition.degradeItem(key, scaled);
    this.refreshPenalties();
  }

  /**
   * Give a wearable its own instance id (mutating the item in place, so the
   * equipped copy carries it back to the bag) and a condition entry.
   * Returns the condition key.
   */
  private _ensureTracked(item: Item): string {
    if (!item.instanceId) {
      item.instanceId = this._newInstanceId(item.id);
      // Saves from before per-piece tracking keyed condition by item id.
      const legacy = this.condition.getCondition(item.id);
      this.condition.initItem(item.instanceId, legacy ?? MAX_CONDITION);
    } else if (this.condition.getCondition(item.instanceId) === undefined) {
      this.condition.initItem(item.instanceId, MAX_CONDITION);
    }
    return item.instanceId;
  }

  private _newInstanceId(itemId: string): string {
    return (this._deps.newInstanceId ?? defaultInstanceId)(itemId);
  }

  /**
   * Recompute how much damage/armor the equipped set has lost to wear and
   * publish it on the player.  Call after any equip change, wear, repair or load.
   */
  public refreshPenalties(): void {
    let damagePenalty = 0;
    let armorPenalty = 0;
    for (const item of this._deps.equipment.getEquipped().values()) {
      const stats = item.stats;
      if (!stats) continue;
      const lost = 1 - this.condition.getDamageMult(conditionKey(item));
      if (lost <= 0) continue;
      if (typeof stats.damage === "number" && stats.damage > 0) damagePenalty += stats.damage * lost;
      if (typeof stats.armor === "number" && stats.armor > 0) armorPenalty += stats.armor * lost;
    }
    this._deps.player.gearDamagePenalty = Math.round(damagePenalty * 10) / 10;
    this._deps.player.gearArmorPenalty = Math.round(armorPenalty * 10) / 10;
  }

  // ── Repair ──────────────────────────────────────────────────────────────────

  /**
   * Handle an inventory click on a repair hammer.  Returns `true` when the
   * click was a repair hammer (consumed or not), so the caller stops there.
   */
  public tryUseRepairItem(item: Item): boolean {
    if (item.id !== REPAIR_HAMMER_ID) return false;
    const target = this._mostWornEquipped();
    if (!target) {
      this._deps.notify("Your equipped gear is in good repair.", 2000);
      return true;
    }
    const key = this._ensureTracked(target);
    const before = this.condition.getCondition(key) ?? MAX_CONDITION;
    const skill = Math.max(0, Math.min(100, this._deps.getArmorerSkill()));
    const amount = (BASE_REPAIR_KIT_AMOUNT + skill * REPAIR_KIT_SKILL_SCALE)
      * Math.max(0, this._deps.player.perkRepairMultiplier ?? 1);
    const after = this.condition.repairItem(key, amount) ?? before;
    this._deps.inventory.removeItem(REPAIR_HAMMER_ID, 1);
    this._deps.gainArmorerXp(REPAIR_XP);
    this.refreshPenalties();
    this._deps.notify(`Repaired ${target.name}: ${Math.round(before)}% → ${Math.round(after)}%`, 2400);
    return true;
  }

  /** Condition summary for each equipped wearable, most worn first. */
  public getEquippedConditionSummary(): Array<{ slot: string; name: string; condition: number }> {
    const rows: Array<{ slot: string; name: string; condition: number }> = [];
    for (const [slot, item] of this._deps.equipment.getEquipped()) {
      if (!this._isWearable(item)) continue;
      rows.push({ slot, name: item.name, condition: Math.round(this.condition.getCondition(conditionKey(item)) ?? MAX_CONDITION) });
    }
    return rows.sort((a, b) => a.condition - b.condition);
  }

  private _mostWornEquipped(): Item | null {
    let worst: Item | null = null;
    let worstCondition = MAX_CONDITION;
    for (const item of this._deps.equipment.getEquipped().values()) {
      if (!this._isWearable(item)) continue;
      const c = this.condition.getCondition(conditionKey(item)) ?? MAX_CONDITION;
      if (c < worstCondition) {
        worst = item;
        worstCondition = c;
      }
    }
    return worst;
  }

  private _equippedName(key: string): string | null {
    for (const item of this._deps.equipment.getEquipped().values()) {
      if (conditionKey(item) === key) return item.name;
    }
    return null;
  }

  /** Condition (0–100) of any item, or null when it has never been tracked. */
  public getItemCondition(item: Item): number | null {
    if (!this._isWearable(item)) return null;
    const c = this.condition.getCondition(conditionKey(item));
    return c === undefined ? null : c;
  }

  /**
   * Trade-value factor for an item: 1 for untracked or pristine gear, falling
   * linearly to {@link MIN_VALUE_FACTOR} for a broken piece.
   */
  public getValueMultiplier(item: Item): number {
    const c = this.getItemCondition(item);
    if (c === null) return 1;
    return MIN_VALUE_FACTOR + (1 - MIN_VALUE_FACTOR) * (c / MAX_CONDITION);
  }

  /**
   * Drop condition entries for pieces the player no longer has (sold, dropped).
   * Pass every item the player owns (bag + equipped).
   */
  public pruneConditions(owned: Iterable<Item>): void {
    const keep = new Set<string>();
    for (const item of owned) keep.add(conditionKey(item));
    for (const key of this.condition.registeredItemIds) {
      if (!keep.has(key)) this.condition.removeItem(key);
    }
  }

  /** Gear with combat stats wears; rings, amulets and clothes without stats do not. */
  private _isWearable(item: Item): boolean {
    const s = item.stats;
    return !!s && ((typeof s.damage === "number" && s.damage > 0) || (typeof s.armor === "number" && s.armor > 0));
  }
}
