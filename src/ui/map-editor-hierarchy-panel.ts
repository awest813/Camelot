import {
  AdvancedDynamicTexture,
  Control,
  Rectangle,
  StackPanel,
  TextBlock,
  Button,
  ScrollViewer,
  InputText,
} from "@babylonjs/gui/2D";
import type { EditorPlacementType, EditorLayerName } from "../systems/map-editor-system";

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
  /** Optional human-readable label from entity properties, shown alongside the ID. */
  label?: string;
  /** Layer this entity is assigned to. */
  layerName?: EditorLayerName;
  /** World position for tooltip display. */
  position?: { x: number; y: number; z: number };
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
  private readonly _filterInput: InputText;
  private readonly _filterCountLabel: TextBlock;
  private readonly _rowMap: Map<string, Rectangle> = new Map();
  private _selectedEntityId: string | null = null;
  private _allEntities: ReadonlyArray<HierarchyEntitySummary> = [];
  private _filterText: string = "";

  constructor(ui: AdvancedDynamicTexture) {
    this._ui = ui;

    // ── Outer panel ──────────────────────────────────────────────────────────
    this._panel = new Rectangle("editorHierarchyPanel");
    this._panel.width  = "210px";
    this._panel.height = "420px";
    this._panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this._panel.verticalAlignment   = Control.VERTICAL_ALIGNMENT_TOP;
    this._panel.top  = "120px";  // below the toolbar (now 4 rows)
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

    // ── Search filter row ─────────────────────────────────────────────────
    const filterRow = new StackPanel("editorHierarchyFilterRow");
    filterRow.isVertical = false;
    filterRow.height     = "26px";
    filterRow.paddingLeft  = "6px";
    filterRow.paddingRight = "6px";
    this._panel.addControl(filterRow);

    const searchIcon = new TextBlock("editorHierarchySearchIcon", "🔍");
    searchIcon.color    = T.DIM;
    searchIcon.fontSize = 11;
    searchIcon.width    = "16px";
    searchIcon.height   = "22px";
    searchIcon.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    filterRow.addControl(searchIcon);

    this._filterInput = new InputText("editorHierarchyFilter", "");
    this._filterInput.width          = "148px";
    this._filterInput.height         = "20px";
    this._filterInput.color          = T.TEXT;
    this._filterInput.background     = T.BTN_BG;
    this._filterInput.focusedBackground = T.BTN_BG;
    this._filterInput.placeholderText = "Filter entities…";
    this._filterInput.fontSize       = 10;
    this._filterInput.thickness      = 1;
    this._filterInput.onKeyboardEventProcessedObservable?.add(() => {
      this._filterText = this._filterInput.text.toLowerCase();
      this._applyFilter();
    });
    filterRow.addControl(this._filterInput);

    const clearBtn = Button.CreateSimpleButton("editorHierarchyClearFilter", "✕");
    clearBtn.width        = "18px";
    clearBtn.height       = "18px";
    clearBtn.fontSize     = 10;
    clearBtn.color        = T.DIM;
    clearBtn.background   = T.BTN_BG;
    clearBtn.cornerRadius = 3;
    clearBtn.thickness    = 1;
    clearBtn.onPointerUpObservable.add(() => {
      this._filterInput.text = "";
      this._filterText = "";
      this._applyFilter();
    });
    filterRow.addControl(clearBtn);

    this._filterCountLabel = new TextBlock("editorHierarchyFilterCount", "");
    this._filterCountLabel.color    = T.DIM;
    this._filterCountLabel.fontSize = 9;
    this._filterCountLabel.width    = "18px";
    this._filterCountLabel.height   = "22px";
    this._filterCountLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    filterRow.addControl(this._filterCountLabel);

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
    scroll.height  = "360px";
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
    this._allEntities = entities;
    this._countLabel.text = `(${entities.length})`;
    this._applyFilter();
  }

  /**
   * Clear the search filter and show all entities.
   */
  clearFilter(): void {
    this._filterInput.text = "";
    this._filterText = "";
    this._applyFilter();
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

  /** Filter entities by the current filter text and rebuild the displayed list. */
  private _applyFilter(): void {
    this._listStack.clearControls();
    this._rowMap.clear();

    const filter = this._filterText.trim();
    const filtered = filter
      ? this._allEntities.filter(({ id, type, label }) => {
          return (
            id.toLowerCase().includes(filter) ||
            type.toLowerCase().includes(filter) ||
            (label?.toLowerCase().includes(filter) ?? false)
          );
        })
      : this._allEntities;

    for (const { id, type, label } of filtered) {
      const row = this._buildRow(id, type, label);
      this._listStack.addControl(row);
      this._rowMap.set(id, row);
    }

    // Show match count when filtering
    if (filter) {
      this._filterCountLabel.text  = `${filtered.length}`;
      this._filterCountLabel.color = filtered.length === 0 ? "#E05050" : T.DIM;
    } else {
      this._filterCountLabel.text = "";
    }

    // Re-apply selection highlight if still present
    if (this._selectedEntityId !== null) {
      this._applyRowHighlight(this._selectedEntityId);
    }
  }

  private _buildRow(id: string, type: EditorPlacementType, label?: string): Rectangle {
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

    // Display text: prefer label when set, fall back to truncated ID
    const displayText = label ? this._truncateId(label) : this._truncateId(id);
    const displayBlock = new TextBlock(`editorHLabel_${id}`, displayText);
    displayBlock.color    = label ? T.TEXT : T.DIM;
    displayBlock.fontSize = 11;
    displayBlock.width    = "170px";
    displayBlock.height   = "26px";
    displayBlock.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    inner.addControl(displayBlock);

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
