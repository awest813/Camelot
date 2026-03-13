import {
  AdvancedDynamicTexture,
  Control,
  Rectangle,
  StackPanel,
  TextBlock,
  Button,
} from "@babylonjs/gui/2D";
import type { EditorGizmoMode, EditorPlacementType, EditorTerrainTool } from "../systems/map-editor-system";

// ── Design tokens (aligned with MapEditorPropertyPanel) ──────────────────────
const T = {
  PANEL_BG:      "rgba(6, 4, 2, 0.92)",
  PANEL_BORDER:  "#6B4F12",
  TITLE:         "#D4A017",
  TEXT:          "#EEE0C0",
  DIM:           "#998877",
  ACCENT:        "#5EC45E",
  WARN:          "#E08830",
  CHIP_BG:       "rgba(28, 20, 6, 0.95)",
  CHIP_ACTIVE:   "rgba(80, 56, 10, 0.98)",
  CHIP_HOVER:    "rgba(50, 36, 8, 0.90)",
};

/** Display labels and colors for each placement type */
const PLACEMENT_LABELS: Record<EditorPlacementType, { label: string; color: string }> = {
  marker:         { label: "Marker",      color: "#40B2FF" },
  loot:           { label: "Loot",        color: "#FFD91A" },
  "npc-spawn":    { label: "NPC Spawn",   color: "#FF8010" },
  "quest-marker": { label: "Quest",       color: "#26E64D" },
  structure:      { label: "Structure",   color: "#BE44FF" },
};

/** Display labels for gizmo modes */
const GIZMO_LABELS: Record<EditorGizmoMode, string> = {
  position: "Move",
  rotation: "Rotate",
  scale:    "Scale",
};

/** Display labels for terrain tools */
const TERRAIN_LABELS: Record<EditorTerrainTool, string> = {
  none:   "None",
  sculpt: "Sculpt",
  paint:  "Paint",
};

/**
 * Persistent status bar for the map editor.
 *
 * Shows the current placement type, gizmo mode, terrain tool, entity count,
 * snap grid size, and active patrol group whenever the map editor is enabled.
 *
 * Placement-type chips, gizmo-mode chips, and terrain-tool chips are all
 * clickable to change the active selection.  Snap-size ± buttons allow
 * adjusting the grid increment directly from the toolbar.
 */
export class MapEditorToolbar {
  /** Fired when the user clicks a placement-type chip. */
  public onPlacementTypeChange: ((type: EditorPlacementType) => void) | null = null;

  /** Fired when the user clicks a gizmo-mode chip. */
  public onGizmoModeChange: ((mode: EditorGizmoMode) => void) | null = null;

  /** Fired when the user clicks a terrain-tool chip. */
  public onTerrainToolChange: ((tool: EditorTerrainTool) => void) | null = null;

  /**
   * Fired when the user clicks the snap-size decrement (−1) or increment (+1)
   * button.  The argument is the requested delta (−1 or +1).
   */
  public onSnapSizeChange: ((delta: number) => void) | null = null;

  private readonly _ui: AdvancedDynamicTexture;
  private readonly _panel: Rectangle;

  // Placement-type chip references for highlighting the active one
  private readonly _typeChips: Map<EditorPlacementType, Button> = new Map();

  // Gizmo-mode chip references
  private readonly _gizmoChips: Map<EditorGizmoMode, Button> = new Map();

  // Terrain-tool chip references
  private readonly _terrainChips: Map<EditorTerrainTool, Button> = new Map();

  // Dynamic labels
  private readonly _entityCountLabel: TextBlock;
  private readonly _patrolLabel: TextBlock;
  private readonly _snapLabel: TextBlock;
  private readonly _undoLabel: TextBlock;
  private readonly _redoLabel: TextBlock;

  constructor(ui: AdvancedDynamicTexture) {
    this._ui = ui;

    // ── Outer panel ──────────────────────────────────────────────────────────
    this._panel = new Rectangle("editorToolbarPanel");
    this._panel.width  = "680px";
    this._panel.height = "auto";
    this._panel.adaptHeightToChildren = true;
    this._panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this._panel.verticalAlignment   = Control.VERTICAL_ALIGNMENT_TOP;
    this._panel.top  = "4px";
    this._panel.left = "4px";
    this._panel.background  = T.PANEL_BG;
    this._panel.color       = T.PANEL_BORDER;
    this._panel.thickness   = 2;
    this._panel.cornerRadius = 4;
    this._panel.paddingTop    = "4px";
    this._panel.paddingBottom = "4px";
    this._panel.paddingLeft   = "6px";
    this._panel.paddingRight  = "6px";
    this._panel.isVisible = false;
    this._ui.addControl(this._panel);

    const inner = new StackPanel("editorToolbarInner");
    inner.isVertical = true;
    inner.width = "668px";
    this._panel.addControl(inner);

    // ── Row 1: Title + entity count + patrol group + snap size ───────────────
    const row1 = new StackPanel("editorToolbarRow1");
    row1.isVertical = false;
    row1.height     = "22px";
    inner.addControl(row1);

    const title = new TextBlock("editorToolbarTitle", "✦ MAP EDITOR ✦");
    title.color    = T.TITLE;
    title.fontSize = 13;
    title.fontStyle = "bold";
    title.width    = "160px";
    title.height   = "22px";
    title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    row1.addControl(title);

    const countPre = new TextBlock("editorToolbarCountPre", "Entities:");
    countPre.color    = T.DIM;
    countPre.fontSize = 12;
    countPre.width    = "58px";
    countPre.height   = "22px";
    countPre.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    row1.addControl(countPre);

    this._entityCountLabel = new TextBlock("editorToolbarCount", "0");
    this._entityCountLabel.color    = T.ACCENT;
    this._entityCountLabel.fontSize = 12;
    this._entityCountLabel.fontStyle = "bold";
    this._entityCountLabel.width    = "32px";
    this._entityCountLabel.height   = "22px";
    this._entityCountLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    row1.addControl(this._entityCountLabel);

    const patrolPre = new TextBlock("editorToolbarPatrolPre", "Patrol:");
    patrolPre.color    = T.DIM;
    patrolPre.fontSize = 12;
    patrolPre.width    = "46px";
    patrolPre.height   = "22px";
    patrolPre.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    row1.addControl(patrolPre);

    this._patrolLabel = new TextBlock("editorToolbarPatrol", "—");
    this._patrolLabel.color    = T.WARN;
    this._patrolLabel.fontSize = 12;
    this._patrolLabel.width    = "160px";
    this._patrolLabel.height   = "22px";
    this._patrolLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    row1.addControl(this._patrolLabel);

    // ── Snap size controls ────────────────────────────────────────────────────
    const snapPre = new TextBlock("editorToolbarSnapPre", "Snap:");
    snapPre.color    = T.DIM;
    snapPre.fontSize = 12;
    snapPre.width    = "42px";
    snapPre.height   = "22px";
    snapPre.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    row1.addControl(snapPre);

    const snapDec = Button.CreateSimpleButton("editorToolbarSnapDec", "−");
    snapDec.width        = "20px";
    snapDec.height       = "18px";
    snapDec.fontSize     = 13;
    snapDec.color        = T.TEXT;
    snapDec.background   = T.CHIP_BG;
    snapDec.cornerRadius = 3;
    snapDec.thickness    = 1;
    snapDec.onPointerEnterObservable.add(() => { snapDec.background = T.CHIP_HOVER; });
    snapDec.onPointerOutObservable.add(() => { snapDec.background = T.CHIP_BG; });
    snapDec.onPointerUpObservable.add(() => this.onSnapSizeChange?.(-1));
    row1.addControl(snapDec);

    this._snapLabel = new TextBlock("editorToolbarSnapVal", "1");
    this._snapLabel.color    = T.ACCENT;
    this._snapLabel.fontSize = 12;
    this._snapLabel.fontStyle = "bold";
    this._snapLabel.width    = "26px";
    this._snapLabel.height   = "22px";
    this._snapLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    row1.addControl(this._snapLabel);

    const snapInc = Button.CreateSimpleButton("editorToolbarSnapInc", "+");
    snapInc.width        = "20px";
    snapInc.height       = "18px";
    snapInc.fontSize     = 13;
    snapInc.color        = T.TEXT;
    snapInc.background   = T.CHIP_BG;
    snapInc.cornerRadius = 3;
    snapInc.thickness    = 1;
    snapInc.onPointerEnterObservable.add(() => { snapInc.background = T.CHIP_HOVER; });
    snapInc.onPointerOutObservable.add(() => { snapInc.background = T.CHIP_BG; });
    snapInc.onPointerUpObservable.add(() => this.onSnapSizeChange?.(+1));
    row1.addControl(snapInc);

    // ── Thin separator ────────────────────────────────────────────────────
    const sep = new Rectangle("editorToolbarSep");
    sep.height     = "1px";
    sep.width      = "100%";
    sep.background = T.PANEL_BORDER;
    sep.thickness  = 0;
    inner.addControl(sep);

    // ── Row 2: Placement-type chips ───────────────────────────────────────
    const row2 = new StackPanel("editorToolbarRow2");
    row2.isVertical = false;
    row2.height     = "28px";
    row2.paddingTop = "2px";
    inner.addControl(row2);

    const placeLbl = new TextBlock("editorToolbarPlaceLbl", "Place:");
    placeLbl.color    = T.DIM;
    placeLbl.fontSize = 11;
    placeLbl.width    = "40px";
    placeLbl.height   = "24px";
    placeLbl.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    row2.addControl(placeLbl);

    const placementTypes: EditorPlacementType[] = [
      "marker", "loot", "npc-spawn", "quest-marker", "structure",
    ];
    for (const ptype of placementTypes) {
      const { label, color } = PLACEMENT_LABELS[ptype];
      const chip = Button.CreateSimpleButton(`editorTypeChip_${ptype}`, label);
      chip.width        = "88px";
      chip.height       = "22px";
      chip.fontSize     = 11;
      chip.color        = color;
      chip.background   = T.CHIP_BG;
      chip.cornerRadius = 3;
      chip.thickness    = 1;
      chip.paddingLeft  = "2px";
      chip.paddingRight = "2px";
      chip.onPointerEnterObservable.add(() => {
        if (chip.background !== T.CHIP_ACTIVE) chip.background = T.CHIP_HOVER;
      });
      chip.onPointerOutObservable.add(() => {
        if (chip.background !== T.CHIP_ACTIVE) chip.background = T.CHIP_BG;
      });
      chip.onPointerUpObservable.add(() => this.onPlacementTypeChange?.(ptype));
      row2.addControl(chip);
      this._typeChips.set(ptype, chip);

      // Small gap between chips
      const gap = new Rectangle(`editorTypeGap_${ptype}`);
      gap.width     = "4px";
      gap.height    = "22px";
      gap.thickness = 0;
      gap.background = "transparent";
      row2.addControl(gap);
    }

    // ── Row 3: Gizmo-mode chips ───────────────────────────────────────────
    const row3 = new StackPanel("editorToolbarRow3");
    row3.isVertical = false;
    row3.height     = "28px";
    row3.paddingTop = "2px";
    inner.addControl(row3);

    const gizmoLbl = new TextBlock("editorToolbarGizmoLbl", "Gizmo:");
    gizmoLbl.color    = T.DIM;
    gizmoLbl.fontSize = 11;
    gizmoLbl.width    = "46px";
    gizmoLbl.height   = "24px";
    gizmoLbl.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    row3.addControl(gizmoLbl);

    const gizmoModes: EditorGizmoMode[] = ["position", "rotation", "scale"];
    for (const gmode of gizmoModes) {
      const chip = Button.CreateSimpleButton(`editorGizmoChip_${gmode}`, GIZMO_LABELS[gmode]);
      chip.width        = "70px";
      chip.height       = "22px";
      chip.fontSize     = 11;
      chip.color        = T.TEXT;
      chip.background   = T.CHIP_BG;
      chip.cornerRadius = 3;
      chip.thickness    = 1;
      chip.paddingLeft  = "2px";
      chip.paddingRight = "2px";
      chip.onPointerEnterObservable.add(() => {
        if (chip.background !== T.CHIP_ACTIVE) chip.background = T.CHIP_HOVER;
      });
      chip.onPointerOutObservable.add(() => {
        if (chip.background !== T.CHIP_ACTIVE) chip.background = T.CHIP_BG;
      });
      chip.onPointerUpObservable.add(() => this.onGizmoModeChange?.(gmode));
      row3.addControl(chip);
      this._gizmoChips.set(gmode, chip);

      const gap = new Rectangle(`editorGizmoGap_${gmode}`);
      gap.width     = "6px";
      gap.height    = "22px";
      gap.thickness = 0;
      gap.background = "transparent";
      row3.addControl(gap);
    }

    // ── Row 4: Terrain-tool chips ─────────────────────────────────────────
    const row4 = new StackPanel("editorToolbarRow4");
    row4.isVertical = false;
    row4.height     = "28px";
    row4.paddingTop = "2px";
    inner.addControl(row4);

    const terrainLbl = new TextBlock("editorToolbarTerrainLbl", "Terrain:");
    terrainLbl.color    = T.DIM;
    terrainLbl.fontSize = 11;
    terrainLbl.width    = "54px";
    terrainLbl.height   = "24px";
    terrainLbl.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    row4.addControl(terrainLbl);

    const terrainTools: EditorTerrainTool[] = ["none", "sculpt", "paint"];
    for (const ttool of terrainTools) {
      const chip = Button.CreateSimpleButton(`editorTerrainChip_${ttool}`, TERRAIN_LABELS[ttool]);
      chip.width        = "58px";
      chip.height       = "22px";
      chip.fontSize     = 11;
      chip.color        = T.TEXT;
      chip.background   = T.CHIP_BG;
      chip.cornerRadius = 3;
      chip.thickness    = 1;
      chip.paddingLeft  = "2px";
      chip.paddingRight = "2px";
      chip.onPointerEnterObservable.add(() => {
        if (chip.background !== T.CHIP_ACTIVE) chip.background = T.CHIP_HOVER;
      });
      chip.onPointerOutObservable.add(() => {
        if (chip.background !== T.CHIP_ACTIVE) chip.background = T.CHIP_BG;
      });
      chip.onPointerUpObservable.add(() => this.onTerrainToolChange?.(ttool));
      row4.addControl(chip);
      this._terrainChips.set(ttool, chip);

      const gap = new Rectangle(`editorTerrainGap_${ttool}`);
      gap.width     = "4px";
      gap.height    = "22px";
      gap.thickness = 0;
      gap.background = "transparent";
      row4.addControl(gap);
    }

    // ── Row 5: Undo/redo history indicators ────────────────────────────────
    const row5 = new StackPanel("editorToolbarRow5");
    row5.isVertical = false;
    row5.height     = "22px";
    row5.paddingTop = "2px";
    inner.addControl(row5);

    const historyPre = new TextBlock("editorToolbarHistoryPre", "History:");
    historyPre.color    = T.DIM;
    historyPre.fontSize = 11;
    historyPre.width    = "54px";
    historyPre.height   = "22px";
    historyPre.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    row5.addControl(historyPre);

    const undoPre = new TextBlock("editorToolbarUndoPre", "Undo:");
    undoPre.color    = T.DIM;
    undoPre.fontSize = 11;
    undoPre.width    = "38px";
    undoPre.height   = "22px";
    undoPre.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    row5.addControl(undoPre);

    this._undoLabel = new TextBlock("editorToolbarUndoVal", "0");
    this._undoLabel.color    = T.ACCENT;
    this._undoLabel.fontSize = 11;
    this._undoLabel.fontStyle = "bold";
    this._undoLabel.width    = "26px";
    this._undoLabel.height   = "22px";
    this._undoLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    row5.addControl(this._undoLabel);

    const redoPre = new TextBlock("editorToolbarRedoPre", "Redo:");
    redoPre.color    = T.DIM;
    redoPre.fontSize = 11;
    redoPre.width    = "38px";
    redoPre.height   = "22px";
    redoPre.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    row5.addControl(redoPre);

    this._redoLabel = new TextBlock("editorToolbarRedoVal", "0");
    this._redoLabel.color    = T.DIM;
    this._redoLabel.fontSize = 11;
    this._redoLabel.fontStyle = "bold";
    this._redoLabel.width    = "26px";
    this._redoLabel.height   = "22px";
    this._redoLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    row5.addControl(this._redoLabel);

    // Initialize active state to defaults
    this._highlightTypeChip("marker");
    this._highlightGizmoChip("position");
    this._highlightTerrainChip("none");
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  get isVisible(): boolean {
    return this._panel.isVisible;
  }

  /** Show the toolbar. */
  show(): void {
    this._panel.isVisible = true;
  }

  /** Hide the toolbar. */
  hide(): void {
    this._panel.isVisible = false;
  }

  /**
   * Refresh all dynamic labels from current editor state.
   * Call this whenever the editor mode, placement type, gizmo mode, terrain
   * tool, entity count, patrol group, snap size, or history stack changes.
   */
  update(state: {
    placementType: EditorPlacementType;
    gizmoMode:     EditorGizmoMode;
    terrainTool:   EditorTerrainTool;
    entityCount:   number;
    activePatrolGroupId: string | null;
    snapSize?: number;
    undoCount?: number;
    redoCount?: number;
  }): void {
    this._highlightTypeChip(state.placementType);
    this._highlightGizmoChip(state.gizmoMode);
    this._highlightTerrainChip(state.terrainTool);

    this._entityCountLabel.text = String(state.entityCount);

    this._patrolLabel.text =
      state.activePatrolGroupId !== null ? state.activePatrolGroupId : "—";
    this._patrolLabel.color =
      state.activePatrolGroupId !== null ? T.ACCENT : T.DIM;

    if (state.snapSize !== undefined) {
      this._snapLabel.text = String(state.snapSize);
    }

    if (state.undoCount !== undefined) {
      this._undoLabel.text  = String(state.undoCount);
      this._undoLabel.color = state.undoCount > 0 ? T.ACCENT : T.DIM;
    }

    if (state.redoCount !== undefined) {
      this._redoLabel.text  = String(state.redoCount);
      this._redoLabel.color = state.redoCount > 0 ? T.WARN : T.DIM;
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _highlightTypeChip(active: EditorPlacementType): void {
    for (const [ptype, chip] of this._typeChips) {
      chip.background = ptype === active ? T.CHIP_ACTIVE : T.CHIP_BG;
      chip.thickness  = ptype === active ? 2 : 1;
    }
  }

  private _highlightGizmoChip(active: EditorGizmoMode): void {
    for (const [gmode, chip] of this._gizmoChips) {
      chip.background = gmode === active ? T.CHIP_ACTIVE : T.CHIP_BG;
      chip.thickness  = gmode === active ? 2 : 1;
    }
  }

  private _highlightTerrainChip(active: EditorTerrainTool): void {
    for (const [ttool, chip] of this._terrainChips) {
      chip.background = ttool === active ? T.CHIP_ACTIVE : T.CHIP_BG;
      chip.thickness  = ttool === active ? 2 : 1;
    }
  }
}
