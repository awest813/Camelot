import type { QualityTier } from "../systems/graphics-system";
import { manageDialogFocus, type DialogFocusSession } from "./dialog-focus";
import { getGraphicsTierIcon, getDifficultyIcon } from "./icon-utils";

// ── Tier metadata ─────────────────────────────────────────────────────────────

const TIER_LABELS: Record<QualityTier, string> = {
  low:    "Low",
  medium: "Medium",
  high:   "High",
  ultra:  "Ultra",
};

const TIER_DESCRIPTIONS: Record<QualityTier, string> = {
  low:    "Best for integrated GPUs. Reduced shadows, no post-processing, 75% render scale.",
  medium: "Balanced preset. Full shadows with FXAA anti-aliasing.",
  high:   "Recommended. Soft shadows with tone mapping and vignette.",
  ultra:  "High-end desktops. Bloom, sharpening, 2048² shadow map.",
};

const TIERS: QualityTier[] = ["low", "medium", "high", "ultra"];

// ── Difficulty metadata ───────────────────────────────────────────────────────

export type Difficulty = "easy" | "normal" | "hard";

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy:   "Easy",
  normal: "Normal",
  hard:   "Hard",
};

const DIFFICULTY_DESCRIPTIONS: Record<Difficulty, string> = {
  easy:   "Foes deal 40% less damage.",
  normal: "The intended challenge.",
  hard:   "Foes deal 50% more damage.",
};

const DIFFICULTIES: Difficulty[] = ["easy", "normal", "hard"];

// ── GraphicsSettingsUI ────────────────────────────────────────────────────────

/**
 * GraphicsSettingsUI — modal overlay for switching graphics quality tiers and difficulty.
 */
export class GraphicsSettingsUI {
  public isVisible: boolean = false;
  private _focusSession: DialogFocusSession | null = null;

  public onTierSelect: ((tier: QualityTier) => void) | null = null;
  public onDifficultySelect: ((difficulty: Difficulty) => void) | null = null;
  public onClose: (() => void) | null = null;

  private _root: HTMLDivElement | null = null;
  private _tierBtns: Map<QualityTier, HTMLButtonElement> = new Map();
  private _difficultyBtns: Map<Difficulty, HTMLButtonElement> = new Map();
  private _currentDifficulty: Difficulty = "normal";

  public show(currentTier: QualityTier, currentDifficulty: Difficulty = this._currentDifficulty): void {
    if (typeof document === "undefined") return;
    this._ensureDom();
    this._highlightTier(currentTier);
    this._highlightDifficulty(currentDifficulty);
    if (this._root) this._root.style.display = "flex";
    this.isVisible = true;
    if (!this._focusSession && this._root) this._focusSession = manageDialogFocus(this._root);
  }

  public hide(): void {
    if (this._root) this._root.style.display = "none";
    this.isVisible = false;
    this._focusSession?.release();
    this._focusSession = null;
  }

  public destroy(): void {
    this._root?.remove();
    this._root = null;
    this._tierBtns.clear();
    this._difficultyBtns.clear();
    this.isVisible = false;
    this._focusSession?.release();
    this._focusSession = null;
  }

  private _highlightTier(tier: QualityTier): void {
    for (const [t, btn] of this._tierBtns) {
      btn.classList.toggle("is-active", t === tier);
      btn.setAttribute("aria-pressed", String(t === tier));
    }
  }

  private _highlightDifficulty(difficulty: Difficulty): void {
    this._currentDifficulty = difficulty;
    for (const [d, btn] of this._difficultyBtns) {
      btn.classList.toggle("is-active", d === difficulty);
      btn.setAttribute("aria-pressed", String(d === difficulty));
    }
  }

  private _ensureDom(): void {
    if (this._root) return;

    // Root overlay
    const root = document.createElement("div");
    root.className = "graphics-settings";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "Graphics Settings");
    root.style.display = "none";

    // Panel
    const panel = document.createElement("div");
    panel.className = "graphics-settings__panel";

    // Header
    const header = document.createElement("div");
    header.className = "graphics-settings__header";

    const title = document.createElement("h2");
    title.className = "graphics-settings__title";
    title.textContent = "Graphics Quality";
    header.appendChild(title);

    const closeBtn = document.createElement("button");
    closeBtn.className = "graphics-settings__close";
    closeBtn.setAttribute("aria-label", "Close graphics settings");
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("click", () => {
      this.hide();
      this.onClose?.();
    });
    header.appendChild(closeBtn);

    panel.appendChild(header);

    // Subtitle
    const subtitle = document.createElement("p");
    subtitle.className = "graphics-settings__subtitle";
    subtitle.textContent = "Changes apply after the page reloads.";
    panel.appendChild(subtitle);

    // Tier buttons
    const grid = document.createElement("div");
    grid.className = "graphics-settings__grid";

    for (const tier of TIERS) {
      const card = document.createElement("button");
      card.className = "graphics-settings__card";
      card.setAttribute("aria-pressed", "false");

      const iconEl = document.createElement("span");
      iconEl.className = "graphics-settings__card-icon";
      iconEl.setAttribute("aria-hidden", "true");
      iconEl.textContent = getGraphicsTierIcon(tier);
      iconEl.style.fontSize = "18px";
      iconEl.style.marginBottom = "4px";
      iconEl.style.display = "block";

      const labelEl = document.createElement("span");
      labelEl.className = "graphics-settings__card-label";
      labelEl.textContent = TIER_LABELS[tier];

      const descEl = document.createElement("span");
      descEl.className = "graphics-settings__card-desc";
      descEl.textContent = TIER_DESCRIPTIONS[tier];

      card.appendChild(iconEl);
      card.appendChild(labelEl);
      card.appendChild(descEl);
      card.addEventListener("click", () => this.onTierSelect?.(tier));

      this._tierBtns.set(tier, card);
      grid.appendChild(card);
    }

    panel.appendChild(grid);

    // Difficulty row
    const diffTitle = document.createElement("h3");
    diffTitle.className = "graphics-settings__title";
    diffTitle.textContent = "Difficulty";
    diffTitle.style.marginTop = "18px";
    panel.appendChild(diffTitle);

    const diffGrid = document.createElement("div");
    diffGrid.className = "graphics-settings__grid";

    for (const difficulty of DIFFICULTIES) {
      const card = document.createElement("button");
      card.className = "graphics-settings__card";
      card.setAttribute("aria-pressed", "false");

      const iconEl = document.createElement("span");
      iconEl.className = "graphics-settings__card-icon";
      iconEl.setAttribute("aria-hidden", "true");
      iconEl.textContent = getDifficultyIcon(difficulty);
      iconEl.style.fontSize = "18px";
      iconEl.style.marginBottom = "4px";
      iconEl.style.display = "block";

      const labelEl = document.createElement("span");
      labelEl.className = "graphics-settings__card-label";
      labelEl.textContent = DIFFICULTY_LABELS[difficulty];

      const descEl = document.createElement("span");
      descEl.className = "graphics-settings__card-desc";
      descEl.textContent = DIFFICULTY_DESCRIPTIONS[difficulty];

      card.appendChild(iconEl);
      card.appendChild(labelEl);
      card.appendChild(descEl);
      card.addEventListener("click", () => {
        this._highlightDifficulty(difficulty);
        this.onDifficultySelect?.(difficulty);
      });

      this._difficultyBtns.set(difficulty, card);
      diffGrid.appendChild(card);
    }

    panel.appendChild(diffGrid);
    root.appendChild(panel);

    root.addEventListener("click", (e) => {
      if (e.target === root) {
        this.hide();
        this.onClose?.();
      }
    });

    document.body.appendChild(root);
    this._root = root;
  }
}
