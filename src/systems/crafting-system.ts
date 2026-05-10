/**
 * CraftingSystem — Material-based item crafting for Camelot.
 *
 * Manages named crafting recipes, each specifying required materials, an
 * optional skill gate, and an output item.  The game layer supplies a live
 * material inventory and current skill level via lightweight context objects;
 * the system never touches BabylonJS or game-specific player state directly.
 *
 * Headless: no BabylonJS dependencies — all state is supplied by the caller.
 */

// ── Category ──────────────────────────────────────────────────────────────────

/**
 * Broad category used for recipe filtering and UI grouping.
 * Extend with additional values as the game grows.
 */
export type CraftingCategory = "weapon" | "armor" | "jewelry" | "misc";

// ── Station ───────────────────────────────────────────────────────────────────

/**
 * Physical crafting station a recipe requires.
 * The game layer passes the active station id into `craft()` / `canCraft()`.
 */
export type CraftingStationId =
  | "forge"
  | "workbench"
  | "smelter"
  | "tanning_rack"
  | "grinding_stone";

/** Display names for each station type. */
export const CRAFTING_STATION_LABELS: Record<CraftingStationId, string> = {
  forge:          "Forge",
  workbench:      "Workbench",
  smelter:        "Smelter",
  tanning_rack:   "Tanning Rack",
  grinding_stone: "Grinding Stone",
};

// ── Tier ──────────────────────────────────────────────────────────────────────

/**
 * Material quality tier of a recipe.
 * Higher tiers award more XP and indicate more valuable materials.
 */
export type CraftingTier =
  | "iron"
  | "steel"
  | "dwarven"
  | "elven"
  | "glass"
  | "ebony"
  | "daedric";

/** XP multipliers applied per tier on top of the base `craftingXp` value. */
export const CRAFTING_TIER_XP_MULTIPLIERS: Record<CraftingTier, number> = {
  iron:    1.0,
  steel:   1.2,
  dwarven: 1.4,
  elven:   1.6,
  glass:   1.8,
  ebony:   2.0,
  daedric: 2.5,
};

/** Human-readable display names for each material tier. */
export const CRAFTING_TIER_LABELS: Record<CraftingTier, string> = {
  iron:    "Iron",
  steel:   "Steel",
  dwarven: "Dwarven",
  elven:   "Elven",
  glass:   "Glass",
  ebony:   "Ebony",
  daedric: "Daedric",
};

// ── Quality ───────────────────────────────────────────────────────────────────

/**
 * Output quality of a crafted item, determined by how far the player's skill
 * exceeds the recipe's `requiredSkill`.
 *
 * | Surplus (skill − requiredSkill) | Quality     |
 * |---------------------------------|-------------|
 * |  0 – 9                          | base        |
 * | 10 – 24                         | fine        |
 * | 25 – 49                         | superior    |
 * | 50 – 74                         | exquisite   |
 * | 75+                             | masterwork  |
 */
export type ItemQuality = "base" | "fine" | "superior" | "exquisite" | "masterwork";

/** Human-readable display labels for each quality level. */
export const ITEM_QUALITY_LABELS: Record<ItemQuality, string> = {
  base:       "Base",
  fine:       "Fine",
  superior:   "Superior",
  exquisite:  "Exquisite",
  masterwork: "Masterwork",
};

/**
 * Compute output quality from the surplus of skill over the required skill.
 */
export function computeItemQuality(skill: number, requiredSkill: number): ItemQuality {
  const surplus = Math.max(0, skill - requiredSkill);
  if (surplus >= 75) return "masterwork";
  if (surplus >= 50) return "exquisite";
  if (surplus >= 25) return "superior";
  if (surplus >= 10) return "fine";
  return "base";
}

// ── Recipe ────────────────────────────────────────────────────────────────────

/** One ingredient entry in a crafting recipe. */
export interface CraftingMaterial {
  /** The material item id (e.g. "iron_ingot", "leather_strips"). */
  materialId: string;
  /** Required quantity of this material. */
  quantity: number;
}

/**
 * Static configuration for a named crafting recipe.
 * All fields except optional ones are mandatory.
 */
export interface CraftingRecipe {
  /** Stable unique identifier for this recipe. */
  id: string;
  /** Human-readable name (e.g. "Iron Sword"). */
  label: string;
  /** Optional lore/design description. */
  description?: string;
  /** Broad category for filtering and UI grouping. */
  category: CraftingCategory;
  /**
   * Physical crafting station required to craft this recipe.
   * When omitted the recipe can be crafted at any station (or no station).
   */
  stationId?: CraftingStationId;
  /**
   * Material quality tier of this recipe.
   * Higher tiers multiply the final XP awarded.
   */
  tier?: CraftingTier;
  /**
   * Whether the recipe is known by the player from the start.
   * Defaults to `true`.  Set to `false` for recipes that must be discovered
   * through exploration, quests, or `discoverRecipe()`.
   */
  knownByDefault?: boolean;
  /**
   * Materials consumed from the caller's inventory when the recipe is crafted.
   * Each entry must have a positive quantity.
   */
  requiredMaterials: CraftingMaterial[];
  /** Item id that is produced (e.g. "iron_sword"). */
  outputItemId: string;
  /** Display name of the produced item. */
  outputItemName: string;
  /** Number of output items produced per craft (>= 1, default 1). */
  outputQuantity?: number;
  /**
   * Minimum skill level required to craft this recipe.
   * When omitted (or 0) the recipe is always accessible regardless of skill.
   */
  requiredSkill?: number;
  /**
   * Crafting XP awarded when the recipe is successfully crafted (before tier
   * scaling).  Defaults to 10 if not specified.
   */
  craftingXp?: number;
}

// ── Context / inventory ───────────────────────────────────────────────────────

/**
 * Abstracted material inventory supplied by the caller.
 * Maps material item ids to available quantities.
 */
export type MaterialInventory = Record<string, number>;

// ── Result ────────────────────────────────────────────────────────────────────

/**
 * Delivered to `onItemCrafted` when a recipe is successfully crafted.
 */
export interface CraftingResult {
  /** The recipe that was used. */
  recipeId: string;
  /** The output item id. */
  outputItemId: string;
  /** The output item display name. */
  outputItemName: string;
  /** Number of output items produced. */
  quantity: number;
  /** Crafting XP awarded (after tier scaling). */
  xpAwarded: number;
  /**
   * Quality of the crafted item, determined by skill surplus.
   * The game layer should attach this to the created inventory item if items
   * track quality (e.g. `item.quality = result.quality`).
   */
  quality: ItemQuality;
}

// ── Error ─────────────────────────────────────────────────────────────────────

/** Reason why a recipe cannot be crafted. */
export type CraftingFailReason =
  | "unknown_recipe"
  | "not_discovered"
  | "wrong_station"
  | "missing_materials"
  | "skill_too_low";

/** Returned by `craft()` when the craft failed. */
export interface CraftingFailure {
  success: false;
  reason: CraftingFailReason;
  /** Human-readable description of what is missing. */
  message: string;
}

/** Returned by `craft()` when the craft succeeded. */
export interface CraftingSuccess {
  success: true;
  result: CraftingResult;
}

export type CraftOutcome = CraftingSuccess | CraftingFailure;

// ── Runtime record ────────────────────────────────────────────────────────────

interface CraftingRecord {
  recipe: CraftingRecipe;
  /** How many times this recipe has been successfully crafted. */
  craftCount: number;
}

// ── Snapshot ──────────────────────────────────────────────────────────────────

/** Persisted per-recipe runtime state. */
export interface CraftingSnapshot {
  id: string;
  craftCount: number;
}

/**
 * Full persisted state for the crafting system, including discovery.
 * Use `getSystemState()` / `restoreSystemState()` for save persistence.
 */
export interface CraftingSystemState {
  /** Per-recipe craft counts. */
  recipeSnapshots: CraftingSnapshot[];
  /** Ids of recipes that have been discovered by the player. */
  discoveredRecipeIds: string[];
}

// ── System ────────────────────────────────────────────────────────────────────

/**
 * Evaluates and applies crafting recipes.
 *
 * **Typical game-layer usage:**
 * ```ts
 * craftingSystem.onItemCrafted = (result) => {
 *   inventory.addItem({ id: result.outputItemId, name: result.outputItemName, quantity: result.quantity });
 *   // If items track quality, persist `result.quality` (e.g. on `stats`) when creating the stack.
 *   // skillProgression.gainXP(<skillId>, result.xpAwarded);
 *   hud.notify(`Crafted ${result.outputItemName} (${result.quality})!`);
 * };
 *
 * // Open the forge UI and attempt a craft:
 * const materials: MaterialInventory = { iron_ingot: 2, leather_strips: 1 };
 * const outcome = craftingSystem.craft("iron_sword", materials, player.armorerSkill, "forge");
 * if (outcome.success) {
 *   // deduct materials from real inventory
 *   for (const m of craftingSystem.getRecipe("iron_sword")!.requiredMaterials) {
 *     inventory.removeItem(m.materialId, m.quantity);
 *   }
 * }
 * ```
 */
export class CraftingSystem {
  private _recipes: Map<string, CraftingRecord> = new Map();
  private _discovered: Set<string> = new Set();

  /** Validates recipe shape; throws on invalid data. Exposed for tests. */
  public static assertValidRecipe(recipe: CraftingRecipe): void {
    const id = recipe.id?.trim() ?? "";
    if (!id) {
      throw new Error("CraftingRecipe.id must be a non-empty string.");
    }
    if (!recipe.label?.trim()) {
      throw new Error(`CraftingRecipe "${id}": label must be non-empty.`);
    }
    if (!Array.isArray(recipe.requiredMaterials)) {
      throw new Error(`CraftingRecipe "${id}": requiredMaterials must be an array.`);
    }
    for (const m of recipe.requiredMaterials) {
      const mid = m.materialId?.trim() ?? "";
      if (!mid) {
        throw new Error(`CraftingRecipe "${id}": each material must have a non-empty materialId.`);
      }
      const q = m.quantity;
      if (!Number.isFinite(q) || !Number.isInteger(q) || q < 1) {
        throw new Error(
          `CraftingRecipe "${id}": material "${mid}" quantity must be a positive integer.`,
        );
      }
    }
    if (!recipe.outputItemId?.trim()) {
      throw new Error(`CraftingRecipe "${id}": outputItemId must be non-empty.`);
    }
    if (!recipe.outputItemName?.trim()) {
      throw new Error(`CraftingRecipe "${id}": outputItemName must be non-empty.`);
    }
    const outQ = recipe.outputQuantity ?? 1;
    if (!Number.isFinite(outQ) || !Number.isInteger(outQ) || outQ < 1) {
      throw new Error(`CraftingRecipe "${id}": outputQuantity must be an integer ≥ 1.`);
    }
    const reqSk = recipe.requiredSkill ?? 0;
    if (!Number.isFinite(reqSk) || reqSk < 0 || !Number.isInteger(reqSk)) {
      throw new Error(`CraftingRecipe "${id}": requiredSkill must be a non-negative integer.`);
    }
    const xp = recipe.craftingXp ?? 10;
    if (!Number.isFinite(xp) || xp < 0 || !Number.isInteger(xp)) {
      throw new Error(`CraftingRecipe "${id}": craftingXp must be a non-negative integer.`);
    }
    if (recipe.stationId !== undefined && !(recipe.stationId in CRAFTING_STATION_LABELS)) {
      throw new Error(`CraftingRecipe "${id}": unknown stationId "${String(recipe.stationId)}".`);
    }
    if (recipe.tier !== undefined && !(recipe.tier in CRAFTING_TIER_XP_MULTIPLIERS)) {
      throw new Error(`CraftingRecipe "${id}": unknown tier "${String(recipe.tier)}".`);
    }
  }

  // ── Callback ──────────────────────────────────────────────────────────────

  /**
   * Fired after a recipe is successfully crafted.
   * The game layer should add the output item to the player's inventory,
   * deduct materials, and award XP.
   */
  public onItemCrafted: ((result: CraftingResult) => void) | null = null;

  // ── CRUD ──────────────────────────────────────────────────────────────────

  /**
   * Register a crafting recipe.  Replaces any existing recipe with the same id,
   * resetting its runtime state.
   *
   * If `recipe.knownByDefault` is not explicitly `false` the recipe is
   * automatically added to the discovery set.
   *
   * @throws Error if the recipe fails validation (bad quantities, unknown tier/station, etc.).
   */
  public addRecipe(recipe: CraftingRecipe): void {
    CraftingSystem.assertValidRecipe(recipe);
    this._recipes.set(recipe.id, { recipe, craftCount: 0 });
    if (recipe.knownByDefault !== false) {
      this._discovered.add(recipe.id);
    }
  }

  /**
   * Remove a recipe by id.  Safe to call with an unknown id.
   * Also removes the recipe from the discovery set.
   */
  public removeRecipe(id: string): void {
    this._recipes.delete(id);
    this._discovered.delete(id);
  }

  /** Returns the recipe for a given id, or `undefined` if not registered. */
  public getRecipe(id: string): CraftingRecipe | undefined {
    return this._recipes.get(id)?.recipe;
  }

  /** All registered crafting recipes (including undiscovered). */
  public get recipes(): CraftingRecipe[] {
    return Array.from(this._recipes.values()).map((r) => r.recipe);
  }

  /** Remove all recipes, reset all craft counts, and clear all discoveries. */
  public clear(): void {
    this._recipes.clear();
    this._discovered.clear();
  }

  // ── Discovery ─────────────────────────────────────────────────────────────

  /**
   * Mark a recipe as discovered.  Safe to call with an unknown recipe id;
   * the id will be stored so that if the recipe is added later it is already
   * discovered.
   */
  public discoverRecipe(id: string): void {
    this._discovered.add(id);
  }

  /**
   * Returns `true` if the recipe has been discovered (or was known by default).
   */
  public isDiscovered(id: string): boolean {
    return this._discovered.has(id);
  }

  /**
   * Returns all recipes that the player has discovered.
   */
  public getKnownRecipes(): CraftingRecipe[] {
    return Array.from(this._recipes.values())
      .filter((r) => this._discovered.has(r.recipe.id))
      .map((r) => r.recipe);
  }

  /**
   * Returns all discovered recipes in the given category.
   */
  public getKnownRecipesByCategory(category: CraftingCategory): CraftingRecipe[] {
    return this.getKnownRecipes().filter((r) => r.category === category);
  }

  // ── Station queries ───────────────────────────────────────────────────────

  /**
   * Returns all registered recipes (discovered or not) that require the
   * given station.
   */
  public getRecipesByStation(stationId: CraftingStationId): CraftingRecipe[] {
    return Array.from(this._recipes.values())
      .filter((r) => r.recipe.stationId === stationId)
      .map((r) => r.recipe);
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  /**
   * Returns `true` if the recipe exists, has been discovered, all
   * requirements are met, and (when provided) the active station matches.
   *
   * @param recipeId  - The recipe to check.
   * @param materials - Caller's current material inventory.
   * @param skill     - Caller's current crafting skill level (default 0).
   * @param stationId - Active crafting station, if any.
   */
  public canCraft(
    recipeId: string,
    materials: MaterialInventory,
    skill: number = 0,
    stationId?: CraftingStationId,
  ): boolean {
    const record = this._recipes.get(recipeId);
    if (!record) return false;
    return this._checkRequirements(record.recipe, materials, skill, stationId) === null;
  }

  /**
   * When the recipe cannot be crafted, returns the same failure object `craft()`
   * would return (without side effects). Useful for UI hints.
   */
  public whyCannotCraft(
    recipeId: string,
    materials: MaterialInventory,
    skill: number = 0,
    stationId?: CraftingStationId,
  ): CraftingFailure | null {
    const record = this._recipes.get(recipeId);
    if (!record) {
      return {
        success: false,
        reason: "unknown_recipe",
        message: `Recipe "${recipeId}" is not registered.`,
      };
    }
    return this._checkRequirements(record.recipe, materials, skill, stationId);
  }

  /**
   * Returns all recipes that the caller can currently craft given their
   * material inventory and skill level.
   *
   * @param materials - Caller's current material inventory.
   * @param skill     - Caller's current crafting skill level (default 0).
   * @param stationId - Active crafting station, if any.
   */
  public getAvailableRecipes(
    materials: MaterialInventory,
    skill: number = 0,
    stationId?: CraftingStationId,
  ): CraftingRecipe[] {
    const result: CraftingRecipe[] = [];
    for (const record of this._recipes.values()) {
      if (this._checkRequirements(record.recipe, materials, skill, stationId) === null) {
        result.push(record.recipe);
      }
    }
    return result;
  }

  /**
   * Returns all recipes in the given category (including undiscovered).
   *
   * @param category - Category to filter by.
   */
  public getRecipesByCategory(category: CraftingCategory): CraftingRecipe[] {
    const result: CraftingRecipe[] = [];
    for (const record of this._recipes.values()) {
      if (record.recipe.category === category) result.push(record.recipe);
    }
    return result;
  }

  /**
   * Returns the number of times a recipe has been successfully crafted.
   * Returns 0 for unknown recipes.
   */
  public getTotalCrafted(recipeId: string): number {
    return this._recipes.get(recipeId)?.craftCount ?? 0;
  }

  // ── Crafting ──────────────────────────────────────────────────────────────

  /**
   * Attempt to craft the given recipe.
   *
   * On success:
   * - Increments the recipe's `craftCount`.
   * - Fires `onItemCrafted` with the result (including `quality`).
   * - Returns `{ success: true, result }`.
   *
   * **The game layer is responsible for deducting materials from the real
   * inventory and awarding XP.**  The system only tracks craft counts and
   * fires the callback.
   *
   * On failure, returns `{ success: false, reason, message }` without side
   * effects.
   *
   * @param recipeId  - The recipe to craft.
   * @param materials - Caller's current material inventory (read-only check).
   * @param skill     - Caller's current crafting skill level (default 0).
   * @param stationId - Active crafting station, if any.
   */
  public craft(
    recipeId: string,
    materials: MaterialInventory,
    skill: number = 0,
    stationId?: CraftingStationId,
  ): CraftOutcome {
    const record = this._recipes.get(recipeId);
    if (!record) {
      return {
        success: false,
        reason: "unknown_recipe",
        message: `Recipe "${recipeId}" is not registered.`,
      };
    }

    const failReason = this._checkRequirements(record.recipe, materials, skill, stationId);
    if (failReason !== null) return failReason;

    const baseXp   = record.recipe.craftingXp ?? 10;
    const tierMult = record.recipe.tier ? CRAFTING_TIER_XP_MULTIPLIERS[record.recipe.tier] : 1;
    const xpAwarded = Math.round(baseXp * tierMult);
    const quality  = computeItemQuality(skill, record.recipe.requiredSkill ?? 0);

    const result: CraftingResult = {
      recipeId,
      outputItemId:   record.recipe.outputItemId,
      outputItemName: record.recipe.outputItemName,
      quantity:       record.recipe.outputQuantity ?? 1,
      xpAwarded,
      quality,
    };

    record.craftCount += 1;
    this.onItemCrafted?.(result);

    return { success: true, result };
  }

  // ── Snapshot / restore ────────────────────────────────────────────────────

  /** Capture per-recipe craft counts for save persistence. */
  public getSnapshot(): CraftingSnapshot[] {
    return Array.from(this._recipes.values()).map((r) => ({
      id: r.recipe.id,
      craftCount: r.craftCount,
    }));
  }

  /**
   * Restore per-recipe craft counts from a snapshot.
   * Unknown ids are silently ignored.
   */
  public restoreSnapshot(snapshots: CraftingSnapshot[]): void {
    for (const snap of snapshots) {
      const record = this._recipes.get(snap.id);
      if (!record) continue;
      record.craftCount = snap.craftCount;
    }
  }

  /**
   * Capture full system state — craft counts plus discovery set —
   * for save persistence.
   */
  public getSystemState(): CraftingSystemState {
    return {
      recipeSnapshots:     this.getSnapshot(),
      discoveredRecipeIds: Array.from(this._discovered),
    };
  }

  /**
   * Restore full system state from a previously captured state.
   * Unknown recipe ids in the snapshot are silently ignored.
   */
  public restoreSystemState(state: CraftingSystemState): void {
    this.restoreSnapshot(state.recipeSnapshots);
    for (const id of state.discoveredRecipeIds) {
      this._discovered.add(id);
    }
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  /**
   * Validates recipe requirements against the supplied materials, skill,
   * and optional station.
   * Returns `null` on success, or a `CraftingFailure` on the first failed
   * constraint.
   */
  private _checkRequirements(
    recipe: CraftingRecipe,
    materials: MaterialInventory,
    skill: number,
    stationId?: CraftingStationId,
  ): CraftingFailure | null {
    // Discovery gate
    if (!this._discovered.has(recipe.id)) {
      return {
        success: false,
        reason: "not_discovered",
        message: `Recipe "${recipe.id}" has not been discovered yet.`,
      };
    }

    // Station gate
    if (recipe.stationId && recipe.stationId !== stationId) {
      const expected = CRAFTING_STATION_LABELS[recipe.stationId];
      return {
        success: false,
        reason: "wrong_station",
        message: `Recipe "${recipe.id}" requires a ${expected}.`,
      };
    }

    // Skill gate
    const requiredSkill = recipe.requiredSkill ?? 0;
    if (skill < requiredSkill) {
      return {
        success: false,
        reason: "skill_too_low",
        message: `Requires skill level ${requiredSkill}; current level is ${skill}.`,
      };
    }

    // Material check
    const missing: string[] = [];
    for (const mat of recipe.requiredMaterials) {
      const available = materials[mat.materialId] ?? 0;
      if (available < mat.quantity) {
        missing.push(`${mat.quantity}× ${mat.materialId} (have ${available})`);
      }
    }
    if (missing.length > 0) {
      return {
        success: false,
        reason: "missing_materials",
        message: `Missing materials: ${missing.join(", ")}.`,
      };
    }

    return null;
  }
}
