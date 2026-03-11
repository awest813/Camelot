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
 * and active patrol group whenever the map editor is enabled.
 *
 * Placement-type chips are clickable to change the active type.
 * Gizmo-mode chips are clickable to cycle modes.
 */
export class MapEditorToolbar {
  /** Fired when the user clicks a placement-type chip. */
  public onPlacementTypeChange: ((type: EditorPlacementType) => void) | null = null;

  /** Fired when the user clicks a gizmo-mode chip. */
  public onGizmoModeChange: ((mode: EditorGizmoMode) => void) | null = null;

  private readonly _ui: AdvancedDynamicTexture;
  private readonly _panel: Rectangle;

  // Placement-type chip references for highlighting the active one
  private readonly _typeChips: Map<EditorPlacementType, Button> = new Map();

  // Gizmo-mode chip references
  private readonly _gizmoChips: Map<EditorGizmoMode, Button> = new Map();

  // Dynamic labels
  private readonly _entityCountLabel: TextBlock;
  private readonly _patrolLabel: TextBlock;
  private readonly _terrainLabel: TextBlock;

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

    // ── Row 1: Title + entity count + patrol group ────────────────────────
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

    const terrainPre = new TextBlock("editorToolbarTerrainPre", "Terrain:");
    terrainPre.color    = T.DIM;
    terrainPre.fontSize = 12;
    terrainPre.width    = "56px";
    terrainPre.height   = "22px";
    terrainPre.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    row1.addControl(terrainPre);

    this._terrainLabel = new TextBlock("editorToolbarTerrain", "None");
    this._terrainLabel.color    = T.TEXT;
    this._terrainLabel.fontSize = 12;
    this._terrainLabel.width    = "80px";
    this._terrainLabel.height   = "22px";
    this._terrainLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    row1.addControl(this._terrainLabel);

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

    // Initialize active state to defaults
    this._highlightTypeChip("marker");
    this._highlightGizmoChip("position");
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
   * tool, entity count, or patrol group changes.
   */
  update(state: {
    placementType: EditorPlacementType;
    gizmoMode:     EditorGizmoMode;
    terrainTool:   EditorTerrainTool;
    entityCount:   number;
    activePatrolGroupId: string | null;
  }): void {
    this._highlightTypeChip(state.placementType);
    this._highlightGizmoChip(state.gizmoMode);

    this._terrainLabel.text =
      state.terrainTool === "none" ? "None" : TERRAIN_LABELS[state.terrainTool];
    this._terrainLabel.color =
      state.terrainTool === "none" ? T.DIM : T.WARN;

    this._entityCountLabel.text = String(state.entityCount);

    this._patrolLabel.text =
      state.activePatrolGroupId !== null ? state.activePatrolGroupId : "—";
    this._patrolLabel.color =
      state.activePatrolGroupId !== null ? T.ACCENT : T.DIM;
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
}
