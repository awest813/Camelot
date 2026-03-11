import {
  AdvancedDynamicTexture,
  Control,
  Rectangle,
  StackPanel,
  TextBlock,
  Button,
  ScrollViewer,
} from "@babylonjs/gui/2D";
import type { EditorPlacementType } from "../systems/map-editor-system";

// ── Design tokens (aligned with MapEditorPropertyPanel) ──────────────────────
const T = {
  PANEL_BG:      "rgba(6, 4, 2, 0.92)",
  PANEL_BORDER:  "#6B4F12",
  TITLE:         "#D4A017",
  TEXT:          "#EEE0C0",
  DIM:           "#998877",
  ITEM_BG:       "rgba(20, 14, 4, 0.80)",
  ITEM_HOVER:    "rgba(50, 36, 8, 0.90)",
  ITEM_ACTIVE:   "rgba(80, 56, 10, 0.98)",
  BTN_BG:        "rgba(28, 20, 6, 0.95)",
  BTN_HOVER:     "rgba(50, 36, 8, 0.90)",
};

/** Short prefix icons for each placement type in the list. */
const TYPE_ICONS: Record<EditorPlacementType, string> = {
  marker:         "◆",
  loot:           "✦",
  "npc-spawn":    "⬡",
  "quest-marker": "◎",
  structure:      "▣",
};

/** Color for each placement type icon. */
const TYPE_COLORS: Record<EditorPlacementType, string> = {
  marker:         "#40B2FF",
  loot:           "#FFD91A",
  "npc-spawn":    "#FF8010",
  "quest-marker": "#26E64D",
  structure:      "#BE44FF",
};

export interface HierarchyEntitySummary {
  id: string;
  type: EditorPlacementType;
}

/**
 * Scrollable hierarchy panel listing all placed editor entities.
 *
 * Call `refresh()` after any entity is placed or removed to rebuild the list.
 * The `selectedEntityId` property tracks the currently highlighted item;
 * set it via `setSelection()` or let it be driven by `onEntityClick`.
 */
export class MapEditorHierarchyPanel {
  /**
   * Fired when the user clicks an entity row in the hierarchy.
   * The caller should call `mapEditorSystem.selectEntityById(id)` and then
   * `setSelection(id)` to synchronise the highlight.
   */
  public onEntityClick: ((entityId: string) => void) | null = null;

  private readonly _ui: AdvancedDynamicTexture;
  private readonly _panel: Rectangle;
  private readonly _listStack: StackPanel;
  private readonly _countLabel: TextBlock;
  private readonly _rowMap: Map<string, Rectangle> = new Map();
  private _selectedEntityId: string | null = null;

  constructor(ui: AdvancedDynamicTexture) {
    this._ui = ui;

    // ── Outer panel ──────────────────────────────────────────────────────────
    this._panel = new Rectangle("editorHierarchyPanel");
    this._panel.width  = "210px";
    this._panel.height = "380px";
    this._panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this._panel.verticalAlignment   = Control.VERTICAL_ALIGNMENT_TOP;
    this._panel.top  = "92px";  // below the toolbar
    this._panel.left = "4px";
    this._panel.background  = T.PANEL_BG;
    this._panel.color       = T.PANEL_BORDER;
    this._panel.thickness   = 2;
    this._panel.cornerRadius = 4;
    this._panel.paddingTop    = "4px";
    this._panel.paddingBottom = "4px";
    this._panel.isVisible = false;
    this._ui.addControl(this._panel);

    // ── Header ────────────────────────────────────────────────────────────
    const headerRow = new StackPanel("editorHierarchyHeader");
    headerRow.isVertical = false;
    headerRow.height     = "22px";
    headerRow.paddingLeft  = "8px";
    headerRow.paddingRight = "8px";
    this._panel.addControl(headerRow);

    const headerTitle = new TextBlock("editorHierarchyTitle", "Scene Hierarchy");
    headerTitle.color    = T.TITLE;
    headerTitle.fontSize = 12;
    headerTitle.fontStyle = "bold";
    headerTitle.width    = "140px";
    headerTitle.height   = "22px";
    headerTitle.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    headerRow.addControl(headerTitle);

    this._countLabel = new TextBlock("editorHierarchyCount", "(0)");
    this._countLabel.color    = T.DIM;
    this._countLabel.fontSize = 11;
    this._countLabel.width    = "36px";
    this._countLabel.height   = "22px";
    this._countLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    headerRow.addControl(this._countLabel);

    // ── Thin separator ────────────────────────────────────────────────────
    const sep = new Rectangle("editorHierarchySep");
    sep.height     = "1px";
    sep.width      = "100%";
    sep.background = T.PANEL_BORDER;
    sep.thickness  = 0;
    this._panel.addControl(sep);

    // ── Scroll viewer ─────────────────────────────────────────────────────
    const scroll = new ScrollViewer("editorHierarchyScroll");
    scroll.width   = "100%";
    scroll.height  = "340px";
    scroll.barSize = 6;
    scroll.thickness = 0;
    this._panel.addControl(scroll);

    // ── Scrollable list ────────────────────────────────────────────────────
    this._listStack = new StackPanel("editorHierarchyList");
    this._listStack.isVertical = true;
    this._listStack.width = "200px";
    scroll.addControl(this._listStack);
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  get isVisible(): boolean {
    return this._panel.isVisible;
  }

  /** Show the hierarchy panel. */
  show(): void {
    this._panel.isVisible = true;
  }

  /** Hide the hierarchy panel. */
  hide(): void {
    this._panel.isVisible = false;
  }

  /**
   * Rebuild the entity list from a fresh snapshot.
   * Call this after any place / remove / undo / redo operation.
   */
  refresh(entities: ReadonlyArray<HierarchyEntitySummary>): void {
    this._listStack.clearControls();
    this._rowMap.clear();

    for (const { id, type } of entities) {
      const row = this._buildRow(id, type);
      this._listStack.addControl(row);
      this._rowMap.set(id, row);
    }

    this._countLabel.text = `(${entities.length})`;

    // Re-apply highlight for the currently selected entity (if still present)
    if (this._selectedEntityId !== null) {
      this._applyRowHighlight(this._selectedEntityId);
    }
  }

  /**
   * Highlight the row for `entityId` as the selected item.
   * Pass `null` to clear the highlight.
   */
  setSelection(entityId: string | null): void {
    const prev = this._selectedEntityId;
    this._selectedEntityId = entityId;

    if (prev !== null) {
      const prevRow = this._rowMap.get(prev);
      if (prevRow) prevRow.background = T.ITEM_BG;
    }
    if (entityId !== null) {
      this._applyRowHighlight(entityId);
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _buildRow(id: string, type: EditorPlacementType): Rectangle {
    const row = new Rectangle(`editorHRow_${id}`);
    row.width           = "200px";
    row.height          = "26px";
    row.background      = T.ITEM_BG;
    row.thickness       = 0;
    row.paddingBottom   = "1px";
    row.isPointerBlocker = true;

    const inner = new StackPanel(`editorHRowInner_${id}`);
    inner.isVertical = false;
    inner.width      = "200px";
    inner.height     = "26px";
    row.addControl(inner);

    // Icon
    const icon = new TextBlock(`editorHIcon_${id}`, TYPE_ICONS[type]);
    icon.color    = TYPE_COLORS[type];
    icon.fontSize = 13;
    icon.width    = "22px";
    icon.height   = "26px";
    icon.paddingLeft = "6px";
    icon.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    inner.addControl(icon);

    // ID (truncated to fit)
    const label = new TextBlock(`editorHLabel_${id}`, this._truncateId(id));
    label.color    = T.TEXT;
    label.fontSize = 11;
    label.width    = "170px";
    label.height   = "26px";
    label.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    inner.addControl(label);

    // Hover / click behaviour
    row.onPointerEnterObservable.add(() => {
      if (id !== this._selectedEntityId) row.background = T.ITEM_HOVER;
    });
    row.onPointerOutObservable.add(() => {
      if (id !== this._selectedEntityId) row.background = T.ITEM_BG;
    });
    row.onPointerUpObservable.add(() => {
      this.setSelection(id);
      this.onEntityClick?.(id);
    });

    return row;
  }

  private _applyRowHighlight(entityId: string): void {
    const row = this._rowMap.get(entityId);
    if (row) row.background = T.ITEM_ACTIVE;
  }

  /** Trim a long entity ID to fit in the hierarchy label. */
  private _truncateId(id: string): string {
    const MAX = 24;
    return id.length <= MAX ? id : `…${id.slice(-(MAX - 1))}`;
  }
}
