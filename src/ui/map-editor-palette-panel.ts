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

// ── Design tokens ─────────────────────────────────────────────────────────────
const P = {
  PANEL_BG:     "rgba(6, 4, 2, 0.92)",
  PANEL_BORDER: "#6B4F12",
  TITLE:        "#D4A017",
  TEXT:         "#EEE0C0",
  DIM:          "#998877",
  ITEM_BG:      "rgba(20, 14, 4, 0.80)",
  ITEM_HOVER:   "rgba(50, 36, 8, 0.90)",
  ITEM_ACTIVE:  "rgba(80, 56, 10, 0.98)",
  ACTION_BG:    "rgba(28, 20, 6, 0.95)",
  ACTION_HOVER: "rgba(50, 36, 8, 0.90)",
  DUP_BG:       "rgba(8, 28, 50, 0.95)",
  DUP_HOVER:    "rgba(12, 50, 90, 0.98)",
  DEL_BG:       "rgba(50, 8, 8, 0.95)",
  DEL_HOVER:    "rgba(100, 14, 14, 0.98)",
};

/** Per-type display metadata for the palette entries. */
interface PaletteEntry {
  type: EditorPlacementType;
  icon:  string;
  label: string;
  color: string;
  description: string;
}

const PALETTE_ENTRIES: PaletteEntry[] = [
  {
    type:  "marker",
    icon:  "◆",
    label: "Marker",
    color: "#40B2FF",
    description: "Generic world-space anchor. Use for waypoints, spawn origins, or any custom reference point.",
  },
  {
    type:  "loot",
    icon:  "✦",
    label: "Loot Container",
    color: "#FFD91A",
    description: "Chest or container tied to a loot table ID. Set the Loot Table ID in the property panel.",
  },
  {
    type:  "npc-spawn",
    icon:  "⬡",
    label: "NPC Spawn",
    color: "#FF8010",
    description: "NPC spawn point. Assign a Spawn Template ID and optionally link to a patrol group (P key).",
  },
  {
    type:  "quest-marker",
    icon:  "◎",
    label: "Quest Marker",
    color: "#26E64D",
    description: "Quest objective location. Set an Objective ID and optional Dialogue Trigger ID.",
  },
  {
    type:  "structure",
    icon:  "▣",
    label: "Structure",
    color: "#BE44FF",
    description: "Pre-built structure asset placed in the world. Set the Structure ID to select the asset.",
  },
];

/**
 * Palette panel for the map editor.
 *
 * Displays all placement types with descriptions and a quick-place button,
 * plus action buttons for the currently selected entity (Duplicate / Delete).
 *
 * This panel provides the "prefab/palette" browsing experience described in
 * Phase 4 of the Map Editor roadmap.
 */
export class MapEditorPalettePanel {
  /** Fired when the user clicks a type entry or its quick-place button. */
  public onPlacementTypeChange: ((type: EditorPlacementType) => void) | null = null;

  /** Fired when the user clicks the Place button (quick-place at camera position). */
  public onPlace: ((type: EditorPlacementType) => void) | null = null;

  /** Fired when the user clicks Duplicate for the selected entity. */
  public onDuplicate: (() => void) | null = null;

  /** Fired when the user clicks Delete for the selected entity. */
  public onDelete: (() => void) | null = null;

  private readonly _ui: AdvancedDynamicTexture;
  private readonly _panel: Rectangle;
  private readonly _typeRows: Map<EditorPlacementType, Rectangle> = new Map();
  private readonly _dupBtn: Button;
  private readonly _delBtn: Button;
  private _activePlacementType: EditorPlacementType = "marker";

  constructor(ui: AdvancedDynamicTexture) {
    this._ui = ui;

    // ── Outer panel ──────────────────────────────────────────────────────────
    this._panel = new Rectangle("editorPalettePanel");
    this._panel.width  = "220px";
    this._panel.height = "auto";
    this._panel.adaptHeightToChildren = true;
    this._panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this._panel.verticalAlignment   = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this._panel.top    = "-8px";
    this._panel.left   = "4px";
    this._panel.background  = P.PANEL_BG;
    this._panel.color       = P.PANEL_BORDER;
    this._panel.thickness   = 2;
    this._panel.cornerRadius = 4;
    this._panel.paddingTop    = "4px";
    this._panel.paddingBottom = "4px";
    this._panel.isVisible = false;
    this._ui.addControl(this._panel);

    // ── Header ────────────────────────────────────────────────────────────────
    const header = new StackPanel("editorPaletteHeader");
    header.isVertical = false;
    header.height     = "24px";
    header.paddingLeft  = "8px";
    header.paddingRight = "8px";
    this._panel.addControl(header);

    const headerTitle = new TextBlock("editorPaletteTitle", "✦ Placement Palette");
    headerTitle.color    = P.TITLE;
    headerTitle.fontSize = 12;
    headerTitle.fontStyle = "bold";
    headerTitle.width    = "200px";
    headerTitle.height   = "24px";
    headerTitle.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    header.addControl(headerTitle);

    // ── Separator ────────────────────────────────────────────────────────────
    const sep1 = new Rectangle("editorPaletteSep1");
    sep1.height     = "1px";
    sep1.width      = "100%";
    sep1.background = P.PANEL_BORDER;
    sep1.thickness  = 0;
    this._panel.addControl(sep1);

    // ── Scroll viewer for entries ─────────────────────────────────────────────
    const scroll = new ScrollViewer("editorPaletteScroll");
    scroll.width   = "100%";
    scroll.height  = "260px";
    scroll.barSize = 5;
    scroll.thickness = 0;
    this._panel.addControl(scroll);

    const listStack = new StackPanel("editorPaletteList");
    listStack.isVertical = true;
    listStack.width = "210px";
    scroll.addControl(listStack);

    for (const entry of PALETTE_ENTRIES) {
      const row = this._buildEntryRow(entry);
      listStack.addControl(row);
      this._typeRows.set(entry.type, row);
    }

    // ── Separator ────────────────────────────────────────────────────────────
    const sep2 = new Rectangle("editorPaletteSep2");
    sep2.height     = "1px";
    sep2.width      = "100%";
    sep2.background = P.PANEL_BORDER;
    sep2.thickness  = 0;
    this._panel.addControl(sep2);

    // ── Actions section label ─────────────────────────────────────────────────
    const actionsLabel = new TextBlock("editorPaletteActionsLbl", "Selected Entity");
    actionsLabel.color    = P.DIM;
    actionsLabel.fontSize = 10;
    actionsLabel.fontStyle = "italic";
    actionsLabel.height   = "18px";
    actionsLabel.paddingLeft = "8px";
    actionsLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this._panel.addControl(actionsLabel);

    // ── Action buttons row ────────────────────────────────────────────────────
    const actionsRow = new StackPanel("editorPaletteActions");
    actionsRow.isVertical = false;
    actionsRow.height     = "30px";
    actionsRow.paddingLeft  = "8px";
    actionsRow.paddingRight = "8px";
    this._panel.addControl(actionsRow);

    this._dupBtn = Button.CreateSimpleButton("editorPaletteDup", "⎘ Duplicate (D)");
    this._dupBtn.width        = "125px";
    this._dupBtn.height       = "24px";
    this._dupBtn.fontSize     = 10;
    this._dupBtn.color        = P.TEXT;
    this._dupBtn.background   = P.DUP_BG;
    this._dupBtn.cornerRadius = 3;
    this._dupBtn.thickness    = 1;
    this._dupBtn.onPointerEnterObservable.add(() => {
      this._dupBtn.background = P.DUP_HOVER;
    });
    this._dupBtn.onPointerOutObservable.add(() => {
      this._dupBtn.background = P.DUP_BG;
    });
    this._dupBtn.onPointerUpObservable.add(() => this.onDuplicate?.());
    actionsRow.addControl(this._dupBtn);

    const gap = new Rectangle("editorPaletteActionsGap");
    gap.width     = "8px";
    gap.height    = "24px";
    gap.thickness = 0;
    gap.background = "transparent";
    actionsRow.addControl(gap);

    this._delBtn = Button.CreateSimpleButton("editorPaletteDel", "✕ Delete");
    this._delBtn.width        = "70px";
    this._delBtn.height       = "24px";
    this._delBtn.fontSize     = 10;
    this._delBtn.color        = P.TEXT;
    this._delBtn.background   = P.DEL_BG;
    this._delBtn.cornerRadius = 3;
    this._delBtn.thickness    = 1;
    this._delBtn.onPointerEnterObservable.add(() => {
      this._delBtn.background = P.DEL_HOVER;
    });
    this._delBtn.onPointerOutObservable.add(() => {
      this._delBtn.background = P.DEL_BG;
    });
    this._delBtn.onPointerUpObservable.add(() => this.onDelete?.());
    actionsRow.addControl(this._delBtn);

    // Apply initial highlight
    this._highlightActiveType("marker");
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  get isVisible(): boolean {
    return this._panel.isVisible;
  }

  /** Show the palette panel. */
  show(): void {
    this._panel.isVisible = true;
  }

  /** Hide the palette panel. */
  hide(): void {
    this._panel.isVisible = false;
  }

  /**
   * Update the active placement type highlight.
   * Call whenever `mapEditorSystem.currentPlacementType` changes.
   */
  setActivePlacementType(type: EditorPlacementType): void {
    this._activePlacementType = type;
    this._highlightActiveType(type);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _buildEntryRow(entry: PaletteEntry): Rectangle {
    const row = new Rectangle(`editorPaletteRow_${entry.type}`);
    row.width           = "210px";
    row.height          = "auto";
    row.adaptHeightToChildren = true;
    row.background      = P.ITEM_BG;
    row.thickness       = 0;
    row.paddingBottom   = "1px";
    row.isPointerBlocker = true;

    const inner = new StackPanel(`editorPaletteRowInner_${entry.type}`);
    inner.isVertical = true;
    inner.width      = "210px";
    inner.paddingTop    = "4px";
    inner.paddingBottom = "4px";
    inner.paddingLeft   = "8px";
    inner.paddingRight  = "8px";
    row.addControl(inner);

    // Name row: icon + label + "Place" button
    const nameRow = new StackPanel(`editorPaletteNameRow_${entry.type}`);
    nameRow.isVertical = false;
    nameRow.height     = "22px";
    inner.addControl(nameRow);

    const icon = new TextBlock(`editorPaletteIcon_${entry.type}`, entry.icon);
    icon.color    = entry.color;
    icon.fontSize = 13;
    icon.width    = "18px";
    icon.height   = "22px";
    icon.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    nameRow.addControl(icon);

    const label = new TextBlock(`editorPaletteLabel_${entry.type}`, entry.label);
    label.color    = P.TEXT;
    label.fontSize = 12;
    label.width    = "110px";
    label.height   = "22px";
    label.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    nameRow.addControl(label);

    const placeBtn = Button.CreateSimpleButton(`editorPalettePlace_${entry.type}`, "▶ Place");
    placeBtn.width        = "54px";
    placeBtn.height       = "18px";
    placeBtn.fontSize     = 9;
    placeBtn.color        = entry.color;
    placeBtn.background   = P.ACTION_BG;
    placeBtn.cornerRadius = 3;
    placeBtn.thickness    = 1;
    placeBtn.onPointerEnterObservable.add(() => {
      placeBtn.background = P.ACTION_HOVER;
    });
    placeBtn.onPointerOutObservable.add(() => {
      placeBtn.background = P.ACTION_BG;
    });
    placeBtn.onPointerUpObservable.add(() => {
      this._selectType(entry.type);
      this.onPlace?.(entry.type);
    });
    nameRow.addControl(placeBtn);

    // Description text
    const desc = new TextBlock(`editorPaletteDesc_${entry.type}`, entry.description);
    desc.color    = P.DIM;
    desc.fontSize = 9;
    desc.height   = "24px";
    desc.textWrapping = true;
    desc.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    inner.addControl(desc);

    // Hover / click to select type
    row.onPointerEnterObservable.add(() => {
      if (entry.type !== this._activePlacementType) row.background = P.ITEM_HOVER;
    });
    row.onPointerOutObservable.add(() => {
      if (entry.type !== this._activePlacementType) row.background = P.ITEM_BG;
    });
    row.onPointerUpObservable.add(() => this._selectType(entry.type));

    return row;
  }

  private _selectType(type: EditorPlacementType): void {
    this._activePlacementType = type;
    this._highlightActiveType(type);
    this.onPlacementTypeChange?.(type);
  }

  private _highlightActiveType(active: EditorPlacementType): void {
    for (const [type, row] of this._typeRows) {
      row.background = type === active ? P.ITEM_ACTIVE : P.ITEM_BG;
    }
  }
}
