import type { Skill, SkillTree } from "../systems/skill-tree-system";

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Render `currentRank` filled pips and `maxRank - currentRank` empty pips.
 * Returns a string like "●●○" for rank 2 / maxRank 3.
 */
export function renderRankPips(currentRank: number, maxRank: number): string {
  const filled = "●".repeat(Math.max(0, currentRank));
  const empty  = "○".repeat(Math.max(0, maxRank - currentRank));
  return filled + empty;
}

// ── SkillTreeUI ────────────────────────────────────────────────────────────────

/**
 * SkillTreeUI — visual overlay for browsing and upgrading player skill trees.
 *
 * Shows each {@link SkillTree} in its own tab. Every skill is rendered as a
 * card with its name, description, rank pips, and an "Upgrade" button.
 * Skills whose prerequisites are unmet are shown in a locked state (dimmed,
 * button disabled). Max-rank skills show a "Max" badge instead of the button.
 *
 * Call `update(trees, skillPoints, prereqFn)` whenever the skill state changes
 * to keep the panel in sync without re-creating the DOM.
 *
 * Wire-up example:
 * ```ts
 * const ui = new SkillTreeUI();
 *
 * ui.onPurchase = (treeIdx, skillIdx) => {
 *   skillTreeSystem.purchaseSkill(treeIdx, skillIdx);
 *   ui.update(skillTreeSystem.trees, player.skillPoints,
 *             (ti, si) => skillTreeSystem.arePrerequisitesMet(ti, si));
 * };
 *
 * // Open / close via keybinding (K):
 * window.addEventListener("keydown", (e) => {
 *   if (e.key === "k" || e.key === "K") {
 *     ui.isVisible ? ui.hide() : ui.show();
 *     if (ui.isVisible)
 *       ui.update(skillTreeSystem.trees, player.skillPoints,
 *                 (ti, si) => skillTreeSystem.arePrerequisitesMet(ti, si));
 *   }
 * });
 * ```
 */
export class SkillTreeUI {
  public isVisible: boolean = false;

  /**
   * Called when the player clicks "Upgrade" on a skill card.
   * Arguments are the tree index and skill index within that tree.
   */
  public onPurchase: ((treeIndex: number, skillIndex: number) => void) | null = null;

  private _root:        HTMLDivElement | null = null;
  private _tabBar:      HTMLDivElement | null = null;
  private _paneWrap:    HTMLDivElement | null = null;
  private _pointsLabel: HTMLSpanElement | null = null;

  /** Currently active tab index. */
  private _activeTab: number = 0;

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
   * Synchronise the panel with the current skill-tree state.
   *
   * @param trees        — The array of {@link SkillTree} objects from the system.
   * @param skillPoints  — Number of unspent skill points the player has.
   * @param prereqFn     — Optional function returning whether a skill's
   *                       prerequisites are met (defaults to always true).
   */
  public update(
    trees: ReadonlyArray<SkillTree>,
    skillPoints: number,
    prereqFn: (treeIndex: number, skillIndex: number) => boolean = () => true,
  ): void {
    if (typeof document === "undefined") return;
    this._ensureDom();
    this._renderPointsLabel(skillPoints);
    this._renderTabs(trees, skillPoints, prereqFn);
  }

  /** Remove the DOM element entirely and reset state. */
  public destroy(): void {
    this._root?.remove();
    this._root        = null;
    this._tabBar      = null;
    this._paneWrap    = null;
    this._pointsLabel = null;
    this._activeTab   = 0;
    this.isVisible    = false;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private _ensureDom(): void {
    if (this._root || typeof document === "undefined") return;

    const root = document.createElement("div");
    root.className = "skill-tree-ui";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "Skill Tree");
    root.style.display = "none";

    // ── Header ────────────────────────────────────────────────────────────────
    const header = document.createElement("header");
    header.className = "skill-tree-ui__header";
    root.appendChild(header);

    const titleEl = document.createElement("h2");
    titleEl.className = "skill-tree-ui__title";
    titleEl.textContent = "Skill Tree";
    header.appendChild(titleEl);

    const pointsEl = document.createElement("span");
    pointsEl.className = "skill-tree-ui__points";
    pointsEl.setAttribute("aria-live", "polite");
    header.appendChild(pointsEl);
    this._pointsLabel = pointsEl;

    // ── Tab bar ───────────────────────────────────────────────────────────────
    const tabBar = document.createElement("div");
    tabBar.className = "skill-tree-ui__tabs";
    tabBar.setAttribute("role", "tablist");
    root.appendChild(tabBar);
    this._tabBar = tabBar;

    // ── Pane area ─────────────────────────────────────────────────────────────
    const paneWrap = document.createElement("div");
    paneWrap.className = "skill-tree-ui__panes";
    root.appendChild(paneWrap);
    this._paneWrap = paneWrap;

    // ── Close button ──────────────────────────────────────────────────────────
    const closeBtn = document.createElement("button");
    closeBtn.className = "skill-tree-ui__close";
    closeBtn.type = "button";
    closeBtn.textContent = "✕";
    closeBtn.setAttribute("aria-label", "Close skill tree");
    closeBtn.addEventListener("click", () => this.hide());
    root.appendChild(closeBtn);

    document.body.appendChild(root);
    this._root = root;
  }

  private _renderPointsLabel(skillPoints: number): void {
    if (!this._pointsLabel) return;
    this._pointsLabel.textContent = `Skill Points: ${skillPoints}`;
  }

  private _renderTabs(
    trees: ReadonlyArray<SkillTree>,
    skillPoints: number,
    prereqFn: (treeIndex: number, skillIndex: number) => boolean,
  ): void {
    if (!this._tabBar || !this._paneWrap) return;

    // Clamp active tab in case the tree list shrank.
    if (this._activeTab >= trees.length) this._activeTab = 0;

    // ── Tab buttons ───────────────────────────────────────────────────────────
    this._tabBar.innerHTML = "";
    for (let ti = 0; ti < trees.length; ti++) {
      const tree = trees[ti];
      const isActive = ti === this._activeTab;

      const btn = document.createElement("button");
      btn.className = "skill-tree-ui__tab" + (isActive ? " is-active" : "");
      btn.type = "button";
      btn.textContent = tree.name;
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
      btn.setAttribute("data-tree-index", String(ti));
      btn.addEventListener("click", () => {
        this._activeTab = ti;
        this._renderTabs(trees, skillPoints, prereqFn);
      });
      this._tabBar.appendChild(btn);
    }

    // ── Active pane ───────────────────────────────────────────────────────────
    this._paneWrap.innerHTML = "";
    if (trees.length === 0) return;

    const activeTree = trees[this._activeTab];
    const pane = document.createElement("div");
    pane.className = "skill-tree-ui__pane";
    pane.setAttribute("role", "tabpanel");
    pane.setAttribute("aria-label", activeTree.name);
    this._paneWrap.appendChild(pane);

    for (let si = 0; si < activeTree.skills.length; si++) {
      const skill = activeTree.skills[si];
      const prereqMet = prereqFn(this._activeTab, si);
      pane.appendChild(this._buildSkillCard(skill, this._activeTab, si, prereqMet, skillPoints));
    }
  }

  private _buildSkillCard(
    skill: Skill,
    treeIndex: number,
    skillIndex: number,
    prereqMet: boolean,
    skillPoints: number,
  ): HTMLElement {
    const isMaxed  = skill.currentRank >= skill.maxRank;
    const isLocked = !prereqMet;
    const canBuy   = !isMaxed && !isLocked && skillPoints > 0;

    const card = document.createElement("div");
    card.className = "skill-tree-ui__card";
    if (isLocked)  card.classList.add("is-locked");
    if (isMaxed)   card.classList.add("is-maxed");
    card.setAttribute("data-skill-id", skill.id);

    // Rank pips
    const pipsEl = document.createElement("span");
    pipsEl.className = "skill-tree-ui__pips";
    pipsEl.textContent = renderRankPips(skill.currentRank, skill.maxRank);
    pipsEl.setAttribute("aria-label", `Rank ${skill.currentRank} of ${skill.maxRank}`);
    card.appendChild(pipsEl);

    // Skill name
    const nameEl = document.createElement("span");
    nameEl.className = "skill-tree-ui__skill-name";
    nameEl.textContent = skill.name;
    card.appendChild(nameEl);

    // Description
    const descEl = document.createElement("p");
    descEl.className = "skill-tree-ui__skill-desc";
    descEl.textContent = isLocked
      ? `🔒 ${skill.description}`
      : skill.description;
    card.appendChild(descEl);

    // Action — either "Upgrade" button or "Max" badge
    if (isMaxed) {
      const badge = document.createElement("span");
      badge.className = "skill-tree-ui__maxed-badge";
      badge.textContent = "Max";
      card.appendChild(badge);
    } else {
      const btn = document.createElement("button");
      btn.className = "skill-tree-ui__upgrade-btn";
      btn.type = "button";
      btn.textContent = "Upgrade";
      btn.setAttribute("aria-label", `Upgrade ${skill.name}`);
      btn.disabled = !canBuy;
      btn.setAttribute("aria-disabled", canBuy ? "false" : "true");
      if (!canBuy) {
        btn.title = isLocked ? "Prerequisites not met." : "Not enough skill points.";
      }
      btn.addEventListener("click", () => {
        if (!btn.disabled) {
          this.onPurchase?.(treeIndex, skillIndex);
        }
      });
      card.appendChild(btn);
    }

    return card;
  }
}
