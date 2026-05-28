import type { QualityTier } from "../systems/graphics-system";

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

// ── GraphicsSettingsUI ────────────────────────────────────────────────────────

/**
 * GraphicsSettingsUI — modal overlay for switching graphics quality tiers.
 *
 * Presents four tier buttons (Low / Medium / High / Ultra) with short
 * descriptions.  When the player selects a tier, {@link onTierSelect} is
 * called with the new tier.  The caller is responsible for persisting the
 * choice and reloading the page.
 *
 * Wire-up example:
 * ```ts
 * const settingsUI = new GraphicsSettingsUI();
 *
 * settingsUI.onTierSelect = (tier) => {
 *   persistGraphicsTier(tier);
 *   location.reload();
 * };
 *
 * settingsUI.onClose = () => settingsUI.hide();
 *
 * // Open with Escape or a settings button:
 * settingsUI.show("high");
 * ```
 */
export class GraphicsSettingsUI {
  public isVisible: boolean = false;

  /** Called when the player selects a quality tier. */
  public onTierSelect: ((tier: QualityTier) => void) | null = null;
  /** Called when the dialog is dismissed without selecting a tier. */
  public onClose: (() => void) | null = null;

  private _root: HTMLDivElement | null = null;
  private _tierBtns: Map<QualityTier, HTMLButtonElement> = new Map();

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Make the dialog visible.  Creates DOM lazily on first call.
   *
   * @param currentTier — The active quality tier; its button will be
   *   highlighted so the player sees their current setting.
   */
  public show(currentTier: QualityTier): void {
    if (typeof document === "undefined") return;
    this._ensureDom();
    this._highlightTier(currentTier);
    if (this._root) this._root.style.display = "flex";
    this.isVisible = true;
  }

  /** Hide the dialog without destroying its DOM. */
  public hide(): void {
    if (this._root) this._root.style.display = "none";
    this.isVisible = false;
  }

  /** Remove the DOM element entirely and reset state. */
  public destroy(): void {
    this._root?.remove();
    this._root = null;
    this._tierBtns.clear();
    this.isVisible = false;
  }

  // ── DOM helpers ────────────────────────────────────────────────────────────

  private _highlightTier(tier: QualityTier): void {
    for (const [t, btn] of this._tierBtns) {
      btn.classList.toggle("is-active", t === tier);
      btn.setAttribute("aria-pressed", String(t === tier));
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
    closeBtn.addEventListener("click", () => this.onClose?.());
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

      const labelEl = document.createElement("span");
      labelEl.className = "graphics-settings__card-label";
      labelEl.textContent = TIER_LABELS[tier];

      const descEl = document.createElement("span");
      descEl.className = "graphics-settings__card-desc";
      descEl.textContent = TIER_DESCRIPTIONS[tier];

      card.appendChild(labelEl);
      card.appendChild(descEl);
      card.addEventListener("click", () => this.onTierSelect?.(tier));

      this._tierBtns.set(tier, card);
      grid.appendChild(card);
    }

    panel.appendChild(grid);
    root.appendChild(panel);

    // Close when clicking the backdrop (outside the panel)
    root.addEventListener("click", (e) => {
      if (e.target === root) this.onClose?.();
    });

    document.body.appendChild(root);
    this._root = root;
  }
}
