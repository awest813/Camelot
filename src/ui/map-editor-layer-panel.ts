import {
  AdvancedDynamicTexture,
  Control,
  Rectangle,
  StackPanel,
  TextBlock,
  Button,
} from "@babylonjs/gui/2D";
import type { EditorLayer } from "../systems/map-editor-system";

// ── Design tokens ─────────────────────────────────────────────────────────────
const L = {
  PANEL_BG:      "rgba(6, 4, 2, 0.93)",
  PANEL_BORDER:  "#6B4F12",
  TITLE:         "#D4A017",
  TEXT:          "#EEE0C0",
  DIM:           "#998877",
  ACCENT:        "#5EC45E",
  LOCK_COLOR:    "#E08830",
  ROW_BG:        "rgba(20, 14, 4, 0.80)",
  ROW_HOVER:     "rgba(50, 36, 8, 0.90)",
  BTN_BG:        "rgba(28, 20, 6, 0.95)",
  BTN_ON:        "rgba(16, 60, 16, 0.95)",
  BTN_LOCKED:    "rgba(60, 30, 4, 0.95)",
  HIDDEN_TEXT:   "rgba(100, 100, 100, 0.6)",
};

/** Colors and icons per layer (builtin layers). Custom layers fall back to a generic icon/color. */
const LAYER_META: Record<string, { icon: string; color: string }> = {
  terrain:  { icon: "⛰",  color: "#9B8860" },
  objects:  { icon: "📦", color: "#5EC45E" },
  events:   { icon: "◎",  color: "#26E64D" },
  npcs:     { icon: "⬡",  color: "#FF8010" },
  triggers: { icon: "⚡", color: "#7EC8E3" },
};

/**
 * Layer panel for the map editor.
 *
 * Displays all editor layers with per-layer visibility and lock toggles,
 * plus the entity count badge.  Inspired by RPG Maker's layer selector.
 *
 * Call `refresh(layers, counts)` whenever layers change to update the display.
 */
export class MapEditorLayerPanel {
  /** Fired when the user toggles layer visibility. */
  public onLayerVisibilityChange: ((name: string, visible: boolean) => void) | null = null;

  /** Fired when the user toggles layer lock. */
  public onLayerLockChange: ((name: string, locked: boolean) => void) | null = null;

  /** Fired when the user claims, reassigns, or clears a layer owner. */
  public onLayerOwnerChange: ((name: string, owner: string) => void) | null = null;

  /** Fired when the user marks a layer as the active placement target. */
  public onLayerActivate: ((name: string) => void) | null = null;

  /**
   * The current author name; used to visually distinguish foreign-author
   * layers (shown with a muted badge).  Set before calling `refresh()`.
   */
  public currentAuthor: string = "";
  public activeLayerName: string | null = null;

  private readonly _ui: AdvancedDynamicTexture;
  private readonly _panel: Rectangle;
  private readonly _listStack: StackPanel;

  constructor(ui: AdvancedDynamicTexture) {
    this._ui = ui;

    // ── Outer panel ──────────────────────────────────────────────────────────
    this._panel = new Rectangle("editorLayerPanel");
    this._panel.width  = "210px";
    this._panel.height = "auto";
    this._panel.adaptHeightToChildren = true;
    this._panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this._panel.verticalAlignment   = Control.VERTICAL_ALIGNMENT_TOP;
    this._panel.top  = "510px";
    this._panel.left = "4px";
    this._panel.background  = L.PANEL_BG;
    this._panel.color       = L.PANEL_BORDER;
    this._panel.thickness   = 2;
    this._panel.cornerRadius = 4;
    this._panel.paddingTop    = "4px";
    this._panel.paddingBottom = "4px";
    this._panel.isVisible = false;
    this._ui.addControl(this._panel);

    // ── Header ────────────────────────────────────────────────────────────────
    const headerRow = new StackPanel("editorLayerHeader");
    headerRow.isVertical = false;
    headerRow.height     = "22px";
    headerRow.paddingLeft  = "8px";
    headerRow.paddingRight = "8px";
    this._panel.addControl(headerRow);

    const headerTitle = new TextBlock("editorLayerTitle", "🗂 Layers");
    headerTitle.color    = L.TITLE;
    headerTitle.fontSize = 12;
    headerTitle.fontStyle = "bold";
    headerTitle.width    = "100px";
    headerTitle.height   = "22px";
    headerTitle.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    headerRow.addControl(headerTitle);

    const hint = new TextBlock("editorLayerHint", "👁 = visible  🔒 = lock");
    hint.color    = L.DIM;
    hint.fontSize = 9;
    hint.width    = "94px";
    hint.height   = "22px";
    hint.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    headerRow.addControl(hint);

    // ── Separator ─────────────────────────────────────────────────────────────
    const sep = new Rectangle("editorLayerSep");
    sep.height     = "1px";
    sep.width      = "100%";
    sep.background = L.PANEL_BORDER;
    sep.thickness  = 0;
    this._panel.addControl(sep);

    // ── Layer list ────────────────────────────────────────────────────────────
    this._listStack = new StackPanel("editorLayerList");
    this._listStack.isVertical = true;
    this._listStack.width = "210px";
    this._panel.addControl(this._listStack);
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  get isVisible(): boolean {
    return this._panel.isVisible;
  }

  show(): void {
    this._panel.isVisible = true;
  }

  hide(): void {
    this._panel.isVisible = false;
  }

  /**
   * Rebuild the layer list.
   * @param layers  Current layer states from `mapEditorSystem.getLayers()`.
   * @param counts  Entity count per layer from `mapEditorSystem.getLayerEntityCounts()`.
   */
  refresh(layers: ReadonlyArray<EditorLayer>, counts: Record<string, number>): void {
    this._listStack.clearControls();
    for (const layer of layers) {
      this._listStack.addControl(this._buildRow(layer, counts[layer.name] ?? 0));
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _buildRow(layer: EditorLayer, count: number): Rectangle {
    const { icon, color } = LAYER_META[layer.name] ?? { icon: "◼", color: "#AAAAAA" };
    const currentAuthor = this.currentAuthor.trim();
    const isForeign =
      currentAuthor !== "" &&
      layer.owner !== undefined &&
      layer.owner !== "" &&
      layer.owner !== currentAuthor;
    const isActive = this.activeLayerName === layer.name;

    const hasOwner = layer.owner !== undefined && layer.owner !== "";
    const canEditOwnership = currentAuthor !== "";
    const showOwnerRow = hasOwner || canEditOwnership;
    // Row height expands to show the owner sub-row and claim/clear actions.
    const rowHeight = showOwnerRow ? "46px" : "30px";

    const row = new Rectangle(`editorLayerRow_${layer.name}`);
    row.width           = "210px";
    row.height          = rowHeight;
    row.background      = this._getRowBackground(isForeign, isActive);
    row.thickness       = 0;
    row.paddingBottom   = "1px";
    row.isPointerBlocker = true;
    row.onPointerEnterObservable.add(() => {
      row.background = this._getRowBackground(isForeign, isActive, true);
    });
    row.onPointerOutObservable.add(() => {
      row.background = this._getRowBackground(isForeign, isActive);
    });

    // Outer vertical stack (controls row + optional owner sub-row)
    const outerStack = new StackPanel(`editorLayerOuter_${layer.name}`);
    outerStack.isVertical = true;
    outerStack.width      = "210px";
    outerStack.height     = rowHeight;
    row.addControl(outerStack);

    // ── Controls row ─────────────────────────────────────────────────────────
    const inner = new StackPanel(`editorLayerRowInner_${layer.name}`);
    inner.isVertical = false;
    inner.width      = "210px";
    inner.height     = "30px";
    outerStack.addControl(inner);

    // Type icon
    const iconBlock = new TextBlock(`editorLayerIcon_${layer.name}`, icon);
    iconBlock.color    = color;
    iconBlock.fontSize = 13;
    iconBlock.width    = "24px";
    iconBlock.height   = "30px";
    iconBlock.paddingLeft = "4px";
    iconBlock.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    inner.addControl(iconBlock);

    // Layer name
    const nameBlock = new TextBlock(`editorLayerName_${layer.name}`, layer.label);
    nameBlock.color    = layer.isVisible ? L.TEXT : L.HIDDEN_TEXT;
    nameBlock.fontSize = 11;
    nameBlock.width    = "68px";
    nameBlock.height   = "30px";
    nameBlock.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    inner.addControl(nameBlock);

    // Entity count badge
    const countBadge = new TextBlock(`editorLayerCount_${layer.name}`, `(${count})`);
    countBadge.color    = L.DIM;
    countBadge.fontSize = 10;
    countBadge.width    = "26px";
    countBadge.height   = "30px";
    countBadge.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    inner.addControl(countBadge);

    const activeBtn = Button.CreateSimpleButton(
      `editorLayerActiveBtn_${layer.name}`,
      isActive ? "●" : "○",
    );
    activeBtn.width        = "24px";
    activeBtn.height       = "22px";
    activeBtn.fontSize     = 11;
    activeBtn.color        = isActive ? L.TITLE : L.DIM;
    activeBtn.background   = isActive ? L.BTN_ON : L.BTN_BG;
    activeBtn.cornerRadius = 3;
    activeBtn.thickness    = 1;
    activeBtn.onPointerUpObservable.add(() => {
      this.onLayerActivate?.(layer.name);
    });
    inner.addControl(activeBtn);

    // Visibility toggle button
    const visBtn = Button.CreateSimpleButton(
      `editorLayerVisBtn_${layer.name}`,
      layer.isVisible ? "👁" : "🚫",
    );
    visBtn.width        = "28px";
    visBtn.height       = "22px";
    visBtn.fontSize     = 12;
    visBtn.color        = layer.isVisible ? L.ACCENT : L.DIM;
    visBtn.background   = layer.isVisible ? L.BTN_ON : L.BTN_BG;
    visBtn.cornerRadius = 3;
    visBtn.thickness    = 1;
    visBtn.onPointerUpObservable.add(() => {
      this.onLayerVisibilityChange?.(layer.name, !layer.isVisible);
    });
    inner.addControl(visBtn);

    // Spacer
    const spacer = new Rectangle(`editorLayerSpacer_${layer.name}`);
    spacer.width     = "4px";
    spacer.height    = "22px";
    spacer.thickness = 0;
    spacer.background = "transparent";
    inner.addControl(spacer);

    // Lock toggle button
    const lockBtn = Button.CreateSimpleButton(
      `editorLayerLockBtn_${layer.name}`,
      layer.isLocked ? "🔒" : "🔓",
    );
    lockBtn.width        = "28px";
    lockBtn.height       = "22px";
    lockBtn.fontSize     = 12;
    lockBtn.color        = layer.isLocked ? L.LOCK_COLOR : L.DIM;
    lockBtn.background   = layer.isLocked ? L.BTN_LOCKED : L.BTN_BG;
    lockBtn.cornerRadius = 3;
    lockBtn.thickness    = 1;
    lockBtn.onPointerUpObservable.add(() => {
      this.onLayerLockChange?.(layer.name, !layer.isLocked);
    });
    inner.addControl(lockBtn);

    // ── Owner sub-row ─────────────────────────────────────────────────────────
    if (showOwnerRow) {
      const ownerRow = new StackPanel(`editorLayerOwnerRow_${layer.name}`);
      ownerRow.isVertical = false;
      ownerRow.width      = "210px";
      ownerRow.height     = "16px";
      ownerRow.paddingLeft = "28px";
      outerStack.addControl(ownerRow);

      const ownerIcon = new TextBlock(`editorLayerOwnerIcon_${layer.name}`, isForeign ? "🔐" : "✍");
      ownerIcon.color    = isForeign ? "#E08830" : L.DIM;
      ownerIcon.fontSize = 9;
      ownerIcon.width    = "14px";
      ownerIcon.height   = "16px";
      ownerIcon.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
      ownerRow.addControl(ownerIcon);

      const ownerLabel = new TextBlock(
        `editorLayerOwnerLabel_${layer.name}`,
        hasOwner ? layer.owner! : "Unowned",
      );
      ownerLabel.color    = isForeign ? "#E08830" : L.DIM;
      ownerLabel.fontSize = 9;
      ownerLabel.width    = canEditOwnership ? "98px" : "150px";
      ownerLabel.height   = "16px";
      ownerLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      ownerRow.addControl(ownerLabel);

      if (canEditOwnership) {
        const nextOwner = hasOwner && !isForeign ? "" : currentAuthor;
        const ownerActionLabel = hasOwner && !isForeign ? "Clear" : "Claim";
        const ownerBtn = Button.CreateSimpleButton(
          `editorLayerOwnerBtn_${layer.name}`,
          ownerActionLabel,
        );
        ownerBtn.width        = "48px";
        ownerBtn.height       = "14px";
        ownerBtn.fontSize     = 8;
        ownerBtn.thickness    = 1;
        ownerBtn.cornerRadius = 3;
        ownerBtn.color        = hasOwner && !isForeign ? L.LOCK_COLOR : L.ACCENT;
        ownerBtn.background   = hasOwner && !isForeign ? L.BTN_LOCKED : L.BTN_ON;
        ownerBtn.onPointerUpObservable.add(() => {
          this.onLayerOwnerChange?.(layer.name, nextOwner);
        });
        ownerRow.addControl(ownerBtn);
      }
    }

    return row;
  }

  private _getRowBackground(isForeign: boolean, isActive: boolean, isHover: boolean = false): string {
    if (isForeign) return isHover ? "rgba(80, 30, 30, 0.85)" : "rgba(60, 20, 20, 0.70)";
    if (isActive) return isHover ? "rgba(95, 68, 12, 0.98)" : "rgba(80, 56, 10, 0.96)";
    return isHover ? L.ROW_HOVER : L.ROW_BG;
  }
}
