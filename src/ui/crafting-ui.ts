import type {
  CraftingCategory,
  CraftingMaterial,
  CraftingRecipe,
  CraftingSystem,
  MaterialInventory,
} from "../systems/crafting-system";

// ── Constants ──────────────────────────────────────────────────────────────────

/** Ordered category tabs shown above the recipe list. */
const CATEGORY_TABS: Array<{ key: CraftingCategory | "all"; label: string }> = [
  { key: "all",     label: "All"     },
  { key: "weapon",  label: "Weapon"  },
  { key: "armor",   label: "Armor"   },
  { key: "jewelry", label: "Jewelry" },
  { key: "misc",    label: "Misc"    },
];

// ── CraftingUI ─────────────────────────────────────────────────────────────────

/**
 * CraftingUI — player-facing crafting workbench overlay.
 *
 * Surfaces a {@link CraftingSystem} through a two-panel HTML overlay: a
 * scrollable recipe list on the left (filterable by category tab) and a
 * detail pane on the right showing material requirements and the "Craft"
 * button.  Material rows are coloured green when available and red when
 * insufficient.  The button is disabled when any material is missing or the
 * player's skill level is too low.
 *
 * Call `update(system, materials, skill)` whenever the inventory or skill
 * changes to keep the panel in sync without re-creating the DOM.
 *
 * Wire-up example:
 * ```ts
 * const ui = new CraftingUI();
 *
 * ui.onCraft = (recipeId) => {
 *   const outcome = craftingSystem.craft(recipeId, player.materials, player.craftingSkill);
 *   if (outcome.success) {
 *     player.addItem(outcome.result.outputItemId, outcome.result.quantity);
 *     player.deductMaterials(outcome.result.recipeId);
 *     skillProgressionSystem.gainXP("alchemy", outcome.result.xpAwarded);
 *   }
 *   ui.update(craftingSystem, player.materials, player.craftingSkill);
 * };
 *
 * // Open / close via keybinding (C):
 * window.addEventListener("keydown", (e) => {
 *   if (e.key === "c" || e.key === "C") {
 *     ui.isVisible ? ui.hide() : ui.show();
 *     if (ui.isVisible) ui.update(craftingSystem, player.materials, player.craftingSkill);
 *   }
 * });
 * ```
 */
export class CraftingUI {
  public isVisible: boolean = false;

  /**
   * Called when the player clicks "Craft" on the detail pane.
   * Argument is the recipe id being crafted.
   */
  public onCraft: ((recipeId: string) => void) | null = null;

  private _root:        HTMLDivElement   | null = null;
  private _tabBar:      HTMLDivElement   | null = null;
  private _listEl:      HTMLDivElement   | null = null;
  private _detailEl:    HTMLDivElement   | null = null;

  /** Currently active category filter. */
  private _activeFilter: CraftingCategory | "all" = "all";
  /** Id of the recipe currently shown in the detail pane. */
  private _selectedId:   string | null = null;

  /** Cached recipes from the last `update()` call. */
  private _lastRecipes:    CraftingRecipe[]    = [];
  /** Cached materials from the last `update()` call. */
  private _lastMaterials:  MaterialInventory   = {};
  /** Cached skill level from the last `update()` call. */
  private _lastSkill:      number              = 0;
  /** Cached system reference from the last `update()` call. */
  private _lastSystem:     CraftingSystem | null = null;

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Make the panel visible. Creates the root DOM lazily on first call. */
  public show(): void {
    if (typeof document === "undefined") return;
    this._ensureDom();
    if (this._root) this._root.style.display = "flex";
    this.isVisible = true;
  }

  /** Hide the panel without destroying its DOM. */
  public hide(): void {
    if (this._root) this._root.style.display = "none";
    this.isVisible = false;
  }

  /**
   * Refresh the display from the current system, inventory, and skill state.
   * Call after any inventory change or after a craft.
   *
   * @param system    — The {@link CraftingSystem} providing the recipe list.
   * @param materials — The player's current material inventory (read-only).
   * @param skill     — The player's current crafting skill level (default 0).
   */
  public update(
    system: CraftingSystem,
    materials: MaterialInventory,
    skill: number = 0,
  ): void {
    if (typeof document === "undefined") return;
    this._ensureDom();

    this._lastSystem    = system;
    this._lastMaterials = materials;
    this._lastSkill     = skill;

    // Gather recipes for the active tab.
    const recipes: CraftingRecipe[] =
      this._activeFilter === "all"
        ? system.recipes
        : system.getRecipesByCategory(this._activeFilter);

    this._lastRecipes = recipes;
    this._renderTabs();
    this._renderList(recipes, system, materials, skill);
    this._refreshDetail(system, materials, skill);
  }

  /**
   * Currently active category filter.
   * Exposed for test access.
   */
  public get activeFilter(): CraftingCategory | "all" {
    return this._activeFilter;
  }

  /**
   * Currently selected recipe id.
   * Exposed for test access.
   */
  public get selectedId(): string | null {
    return this._selectedId;
  }

  /** Remove the DOM element entirely and reset state. */
  public destroy(): void {
    this._root?.remove();
    this._root        = null;
    this._tabBar      = null;
    this._listEl      = null;
    this._detailEl    = null;
    this._selectedId  = null;
    this._activeFilter = "all";
    this._lastRecipes  = [];
    this._lastMaterials = {};
    this._lastSkill    = 0;
    this._lastSystem   = null;
    this.isVisible     = false;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private _ensureDom(): void {
    if (this._root || typeof document === "undefined") return;

    const root = document.createElement("div");
    root.className = "crafting-ui";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "Crafting Workbench");
    root.style.display = "none";

    // ── Header ────────────────────────────────────────────────────────────────
    const header = document.createElement("header");
    header.className = "crafting-ui__header";
    root.appendChild(header);

    const titleEl = document.createElement("h2");
    titleEl.className = "crafting-ui__title";
    titleEl.textContent = "Crafting Workbench";
    header.appendChild(titleEl);

    // ── Tab bar ───────────────────────────────────────────────────────────────
    const tabBar = document.createElement("div");
    tabBar.className = "crafting-ui__tabs";
    tabBar.setAttribute("role", "tablist");
    tabBar.setAttribute("aria-label", "Recipe categories");
    root.appendChild(tabBar);
    this._tabBar = tabBar;

    // ── Two-panel body ────────────────────────────────────────────────────────
    const body = document.createElement("div");
    body.className = "crafting-ui__body";
    root.appendChild(body);

    const listEl = document.createElement("div");
    listEl.className = "crafting-ui__list";
    listEl.setAttribute("role", "list");
    body.appendChild(listEl);
    this._listEl = listEl;

    const detailEl = document.createElement("div");
    detailEl.className = "crafting-ui__detail";
    detailEl.setAttribute("aria-live", "polite");
    body.appendChild(detailEl);
    this._detailEl = detailEl;

    // ── Close button ──────────────────────────────────────────────────────────
    const closeBtn = document.createElement("button");
    closeBtn.className = "crafting-ui__close";
    closeBtn.type = "button";
    closeBtn.textContent = "✕";
    closeBtn.setAttribute("aria-label", "Close crafting workbench");
    closeBtn.addEventListener("click", () => this.hide());
    root.appendChild(closeBtn);

    document.body.appendChild(root);
    this._root = root;
  }

  private _renderTabs(): void {
    if (!this._tabBar) return;
    this._tabBar.innerHTML = "";

    for (const tab of CATEGORY_TABS) {
      const isActive = tab.key === this._activeFilter;
      const btn = document.createElement("button");
      btn.className = "crafting-ui__tab" + (isActive ? " is-active" : "");
      btn.type = "button";
      btn.textContent = tab.label;
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
      btn.setAttribute("data-category", tab.key);
      btn.addEventListener("click", () => {
        this._activeFilter = tab.key;
        this._selectedId   = null;
        if (this._lastSystem) {
          this.update(this._lastSystem, this._lastMaterials, this._lastSkill);
        } else {
          this._renderTabs();
        }
      });
      this._tabBar.appendChild(btn);
    }
  }

  private _renderList(
    recipes: CraftingRecipe[],
    system: CraftingSystem,
    materials: MaterialInventory,
    skill: number,
  ): void {
    if (!this._listEl) return;
    this._listEl.innerHTML = "";

    if (recipes.length === 0) {
      const empty = document.createElement("p");
      empty.className = "crafting-ui__empty";
      empty.textContent = "No recipes in this category.";
      this._listEl.appendChild(empty);
      return;
    }

    for (const recipe of recipes) {
      const canCraft = system.canCraft(recipe.id, materials, skill);
      const craftCount = system.getTotalCrafted(recipe.id);
      const isSelected = recipe.id === this._selectedId;

      const item = document.createElement("div");
      item.className =
        "crafting-ui__recipe-row" +
        (canCraft ? " can-craft" : " cannot-craft") +
        (isSelected ? " is-selected" : "");
      item.setAttribute("role", "listitem");
      item.setAttribute("data-recipe-id", recipe.id);

      const nameEl = document.createElement("span");
      nameEl.className = "crafting-ui__recipe-name";
      nameEl.textContent = recipe.label;
      item.appendChild(nameEl);

      const badgeEl = document.createElement("span");
      badgeEl.className = "crafting-ui__category-badge";
      badgeEl.textContent = recipe.category;
      item.appendChild(badgeEl);

      if (craftCount > 0) {
        const countEl = document.createElement("span");
        countEl.className = "crafting-ui__craft-count";
        countEl.textContent = `×${craftCount}`;
        item.appendChild(countEl);
      }

      const availEl = document.createElement("span");
      availEl.className = "crafting-ui__avail-indicator";
      availEl.textContent = canCraft ? "✓" : "✗";
      availEl.setAttribute("aria-label", canCraft ? "Available" : "Unavailable");
      item.appendChild(availEl);

      item.addEventListener("click", () => {
        this._selectedId = recipe.id;
        this._renderList(recipes, system, materials, skill);
        this._refreshDetail(system, materials, skill);
      });

      this._listEl.appendChild(item);
    }
  }

  private _refreshDetail(
    system: CraftingSystem,
    materials: MaterialInventory,
    skill: number,
  ): void {
    if (!this._detailEl) return;
    this._detailEl.innerHTML = "";

    if (!this._selectedId) {
      const hint = document.createElement("p");
      hint.className = "crafting-ui__detail-hint";
      hint.textContent = "Select a recipe to see details.";
      this._detailEl.appendChild(hint);
      return;
    }

    const recipe = system.getRecipe(this._selectedId);
    if (!recipe) {
      this._selectedId = null;
      const hint = document.createElement("p");
      hint.className = "crafting-ui__detail-hint";
      hint.textContent = "Select a recipe to see details.";
      this._detailEl.appendChild(hint);
      return;
    }

    // Recipe title
    const titleEl = document.createElement("h3");
    titleEl.className = "crafting-ui__detail-title";
    titleEl.textContent = recipe.label;
    this._detailEl.appendChild(titleEl);

    // Description
    if (recipe.description) {
      const descEl = document.createElement("p");
      descEl.className = "crafting-ui__detail-desc";
      descEl.textContent = recipe.description;
      this._detailEl.appendChild(descEl);
    }

    // Output
    const outputQty = recipe.outputQuantity ?? 1;
    const outputEl = document.createElement("p");
    outputEl.className = "crafting-ui__detail-output";
    outputEl.textContent =
      `Produces: ${outputQty > 1 ? `${outputQty}× ` : ""}${recipe.outputItemName}`;
    this._detailEl.appendChild(outputEl);

    // Skill requirement
    const requiredSkill = recipe.requiredSkill ?? 0;
    if (requiredSkill > 0) {
      const skillEl = document.createElement("p");
      skillEl.className =
        "crafting-ui__detail-skill" +
        (skill >= requiredSkill ? " skill-met" : " skill-missing");
      skillEl.textContent = `Required skill: ${requiredSkill} (yours: ${skill})`;
      this._detailEl.appendChild(skillEl);
    }

    // Materials section
    const matsLabel = document.createElement("p");
    matsLabel.className = "crafting-ui__mats-label";
    matsLabel.textContent = "Materials required:";
    this._detailEl.appendChild(matsLabel);

    const matsList = document.createElement("ul");
    matsList.className = "crafting-ui__mats-list";
    this._detailEl.appendChild(matsList);

    for (const mat of recipe.requiredMaterials) {
      matsList.appendChild(this._buildMaterialRow(mat, materials));
    }

    // Craft button
    const canCraft = system.canCraft(recipe.id, materials, skill);
    const craftBtn = document.createElement("button");
    craftBtn.className = "crafting-ui__craft-btn";
    craftBtn.type = "button";
    craftBtn.textContent = "Craft";
    craftBtn.disabled = !canCraft;
    craftBtn.setAttribute("aria-disabled", canCraft ? "false" : "true");
    craftBtn.addEventListener("click", () => {
      if (!craftBtn.disabled) {
        this.onCraft?.(recipe.id);
      }
    });
    this._detailEl.appendChild(craftBtn);

    // Craft count
    const craftCount = system.getTotalCrafted(recipe.id);
    if (craftCount > 0) {
      const countEl = document.createElement("p");
      countEl.className = "crafting-ui__detail-count";
      countEl.textContent = `Crafted ${craftCount} time${craftCount !== 1 ? "s" : ""}`;
      this._detailEl.appendChild(countEl);
    }
  }

  private _buildMaterialRow(
    mat: CraftingMaterial,
    materials: MaterialInventory,
  ): HTMLLIElement {
    const available = materials[mat.materialId] ?? 0;
    const hasMat    = available >= mat.quantity;

    const li = document.createElement("li");
    li.className = "crafting-ui__mat-row" + (hasMat ? " mat-ok" : " mat-missing");
    li.setAttribute("data-material-id", mat.materialId);

    const nameEl = document.createElement("span");
    nameEl.className = "crafting-ui__mat-name";
    nameEl.textContent = mat.materialId;
    li.appendChild(nameEl);

    const qtyEl = document.createElement("span");
    qtyEl.className = "crafting-ui__mat-qty";
    qtyEl.textContent = `${available}/${mat.quantity}`;
    qtyEl.setAttribute("aria-label", `Have ${available}, need ${mat.quantity}`);
    li.appendChild(qtyEl);

    return li;
  }
}
