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
 * All fields except `requiredSkill` are mandatory.
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
   * Crafting XP awarded when the recipe is successfully crafted.
   * Defaults to 10 if not specified.
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
  /** Crafting XP awarded. */
  xpAwarded: number;
}

// ── Error ─────────────────────────────────────────────────────────────────────

/** Reason why a recipe cannot be crafted. */
export type CraftingFailReason =
  | "unknown_recipe"
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

// ── System ────────────────────────────────────────────────────────────────────

/**
 * Evaluates and applies crafting recipes.
 *
 * **Typical game-layer usage:**
 * ```ts
 * craftingSystem.onItemCrafted = (result) => {
 *   inventory.addItem({ id: result.outputItemId, name: result.outputItemName, quantity: result.quantity });
 *   skillProgression.addXp("armorer", result.xpAwarded);
 *   hud.notify(`Crafted ${result.outputItemName}!`);
 * };
 *
 * // Open the forge UI and attempt a craft:
 * const materials: MaterialInventory = { iron_ingot: 2, leather_strips: 1 };
 * const outcome = craftingSystem.craft("iron_sword", materials, player.armorerSkill);
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

  // ── Callback ──────────────────────────────────────────────────────────────

  /**
   * Fired after a recipe is successfully crafted.
   * The game layer should add the output item to the player's inventory,
   * deduct materials, and award XP.
   */
  public onItemCrafted: ((result: CraftingResult) => void) | null = null;

  // ── CRUD ──────────────────────────────────────────────────────────────────

  /**
   * Register a crafting recipe.  Silently replaces any existing recipe with
   * the same id, resetting its runtime state.
   */
  public addRecipe(recipe: CraftingRecipe): void {
    this._recipes.set(recipe.id, { recipe, craftCount: 0 });
  }

  /**
   * Remove a recipe by id.  Safe to call with an unknown id.
   */
  public removeRecipe(id: string): void {
    this._recipes.delete(id);
  }

  /** Returns the recipe for a given id, or `undefined` if not registered. */
  public getRecipe(id: string): CraftingRecipe | undefined {
    return this._recipes.get(id)?.recipe;
  }

  /** All registered crafting recipes. */
  public get recipes(): CraftingRecipe[] {
    return Array.from(this._recipes.values()).map((r) => r.recipe);
  }

  /** Remove all recipes and reset all state. */
  public clear(): void {
    this._recipes.clear();
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  /**
   * Returns `true` if the recipe exists and all requirements are met.
   *
   * @param recipeId  - The recipe to check.
   * @param materials - Caller's current material inventory.
   * @param skill     - Caller's current crafting skill level (default 0).
   */
  public canCraft(
    recipeId: string,
    materials: MaterialInventory,
    skill: number = 0,
  ): boolean {
    const record = this._recipes.get(recipeId);
    if (!record) return false;
    return this._checkRequirements(record.recipe, materials, skill) === null;
  }

  /**
   * Returns all recipes that the caller can currently craft given their
   * material inventory and skill level.
   *
   * @param materials - Caller's current material inventory.
   * @param skill     - Caller's current crafting skill level (default 0).
   */
  public getAvailableRecipes(
    materials: MaterialInventory,
    skill: number = 0,
  ): CraftingRecipe[] {
    const result: CraftingRecipe[] = [];
    for (const record of this._recipes.values()) {
      if (this._checkRequirements(record.recipe, materials, skill) === null) {
        result.push(record.recipe);
      }
    }
    return result;
  }

  /**
   * Returns all recipes in the given category.
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
   * - Fires `onItemCrafted` with the result.
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
   */
  public craft(
    recipeId: string,
    materials: MaterialInventory,
    skill: number = 0,
  ): CraftOutcome {
    const record = this._recipes.get(recipeId);
    if (!record) {
      return {
        success: false,
        reason: "unknown_recipe",
        message: `Recipe "${recipeId}" is not registered.`,
      };
    }

    const failReason = this._checkRequirements(record.recipe, materials, skill);
    if (failReason !== null) return failReason;

    const result: CraftingResult = {
      recipeId,
      outputItemId: record.recipe.outputItemId,
      outputItemName: record.recipe.outputItemName,
      quantity: record.recipe.outputQuantity ?? 1,
      xpAwarded: record.recipe.craftingXp ?? 10,
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

  // ── Internal helpers ──────────────────────────────────────────────────────

  /**
   * Validates recipe requirements against the supplied materials and skill.
   * Returns `null` on success, or a `CraftingFailure` on the first failed
   * constraint.
   */
  private _checkRequirements(
    recipe: CraftingRecipe,
    materials: MaterialInventory,
    skill: number,
  ): CraftingFailure | null {
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
