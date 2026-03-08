import { AdvancedDynamicTexture, Control, Rectangle, StackPanel, TextBlock, Button, InputText } from "@babylonjs/gui/2D";
import type { EditorPlacementType, EditorEntityProperties } from "../systems/map-editor-system";

// ── Design tokens (aligned with UIManager) ──────────────────────────────────
const P = {
  PANEL_BG:     "rgba(6, 4, 2, 0.95)",
  PANEL_BORDER: "#6B4F12",
  TITLE:        "#D4A017",
  TEXT:         "#EEE0C0",
  DIM:          "#998877",
  INPUT_BG:     "rgba(20, 14, 4, 0.9)",
  INPUT_FOCUS:  "#D4A017",
  BTN_HOVER:    "rgba(80, 56, 10, 0.98)",
  BTN_DELETE_BG:    "rgba(60, 8, 8, 0.95)",
  BTN_DELETE_HOVER: "rgba(120, 16, 16, 0.98)",
  BTN_APPLY_BG:     "rgba(8, 40, 8, 0.95)",
  BTN_APPLY_HOVER:  "rgba(16, 80, 16, 0.98)",
};

/** Property field descriptors keyed by placement type */
const FIELDS_BY_TYPE: Record<EditorPlacementType, Array<{ key: keyof EditorEntityProperties; label: string }>> = {
  marker:         [{ key: "label",             label: "Label" }],
  loot:           [{ key: "label",             label: "Label" },
                   { key: "lootTableId",       label: "Loot Table ID" }],
  "npc-spawn":    [{ key: "label",             label: "Label" },
                   { key: "spawnTemplateId",   label: "Spawn Template ID" }],
  "quest-marker": [{ key: "label",             label: "Label" },
                   { key: "objectiveId",       label: "Objective ID" },
                   { key: "dialogueTriggerId", label: "Dialogue Trigger ID" }],
  structure:      [{ key: "label",             label: "Label" },
                   { key: "structureId",       label: "Structure ID" }],
};

/**
 * In-editor property panel for configuring placed entity metadata.
 *
 * Call `show()` when an entity is selected, `hide()` when the selection is
 * cleared or the editor mode is toggled off.
 */
export class MapEditorPropertyPanel {
  /** Fired when the user clicks Apply with the entity ID and merged properties. */
  public onApply: ((entityId: string, properties: EditorEntityProperties) => void) | null = null;

  /** Fired when the user clicks Delete with the entity ID to remove. */
  public onDelete: ((entityId: string) => void) | null = null;

  private readonly _ui: AdvancedDynamicTexture;
  private readonly _panel: Rectangle;
  private readonly _titleText: TextBlock;
  private readonly _idText: TextBlock;
  private readonly _fieldsStack: StackPanel;
  private readonly _applyBtn: Button;
  private readonly _deleteBtn: Button;

  private _currentEntityId: string | null = null;
  private _currentType: EditorPlacementType | null = null;
  private _inputMap: Map<keyof EditorEntityProperties, InputText> = new Map();

  constructor(ui: AdvancedDynamicTexture) {
    this._ui = ui;

    // ── Outer panel ───────────────────────────────────────────────────────────
    this._panel = new Rectangle("editorPropPanel");
    this._panel.width  = "280px";
    this._panel.height = "auto";
    this._panel.adaptHeightToChildren = true;
    this._panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this._panel.verticalAlignment   = Control.VERTICAL_ALIGNMENT_TOP;
    this._panel.top  = "60px";
    this._panel.left = "-10px";
    this._panel.background  = P.PANEL_BG;
    this._panel.color       = P.PANEL_BORDER;
    this._panel.thickness   = 2;
    this._panel.cornerRadius = 4;
    this._panel.paddingTop    = "8px";
    this._panel.paddingBottom = "8px";
    this._panel.paddingLeft   = "0px";
    this._panel.paddingRight  = "0px";
    this._panel.isVisible = false;
    this._ui.addControl(this._panel);

    const inner = new StackPanel("editorPropInner");
    inner.isVertical = true;
    inner.width = "260px";
    this._panel.addControl(inner);

    // ── Title ─────────────────────────────────────────────────────────────────
    this._titleText = new TextBlock("editorPropTitle", "Entity Properties");
    this._titleText.color  = P.TITLE;
    this._titleText.height = "22px";
    this._titleText.fontSize = 13;
    this._titleText.fontStyle = "bold";
    this._titleText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this._titleText.paddingLeft = "8px";
    inner.addControl(this._titleText);

    // ── Entity ID line ────────────────────────────────────────────────────────
    this._idText = new TextBlock("editorPropId", "");
    this._idText.color  = P.DIM;
    this._idText.height = "18px";
    this._idText.fontSize = 11;
    this._idText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this._idText.paddingLeft = "8px";
    inner.addControl(this._idText);

    // ── Divider ───────────────────────────────────────────────────────────────
    const divider = new Rectangle("editorPropDiv");
    divider.height    = "1px";
    divider.width     = "100%";
    divider.background = P.PANEL_BORDER;
    divider.thickness = 0;
    divider.paddingTop    = "4px";
    divider.paddingBottom = "4px";
    inner.addControl(divider);

    // ── Fields area ──────────────────────────────────────────────────────────
    this._fieldsStack = new StackPanel("editorPropFields");
    this._fieldsStack.isVertical = true;
    this._fieldsStack.width = "100%";
    inner.addControl(this._fieldsStack);

    // ── Button row ────────────────────────────────────────────────────────────
    const btnRow = new StackPanel("editorPropBtnRow");
    btnRow.isVertical = false;
    btnRow.height     = "30px";
    btnRow.paddingTop = "6px";
    btnRow.paddingLeft  = "8px";
    btnRow.paddingRight = "8px";
    inner.addControl(btnRow);

    this._applyBtn = Button.CreateSimpleButton("editorPropApply", "Apply");
    this._applyBtn.width       = "110px";
    this._applyBtn.height      = "24px";
    this._applyBtn.color       = P.TEXT;
    this._applyBtn.background  = P.BTN_APPLY_BG;
    this._applyBtn.cornerRadius = 3;
    this._applyBtn.fontSize    = 12;
    this._applyBtn.onPointerEnterObservable.add(() => {
      this._applyBtn.background = P.BTN_APPLY_HOVER;
    });
    this._applyBtn.onPointerOutObservable.add(() => {
      this._applyBtn.background = P.BTN_APPLY_BG;
    });
    this._applyBtn.onPointerUpObservable.add(() => this._handleApply());
    btnRow.addControl(this._applyBtn);

    const spacer = new Rectangle("editorPropSpacer");
    spacer.width     = "20px";
    spacer.height    = "24px";
    spacer.thickness = 0;
    spacer.background = "transparent";
    btnRow.addControl(spacer);

    this._deleteBtn = Button.CreateSimpleButton("editorPropDelete", "Delete");
    this._deleteBtn.width       = "110px";
    this._deleteBtn.height      = "24px";
    this._deleteBtn.color       = P.TEXT;
    this._deleteBtn.background  = P.BTN_DELETE_BG;
    this._deleteBtn.cornerRadius = 3;
    this._deleteBtn.fontSize    = 12;
    this._deleteBtn.onPointerEnterObservable.add(() => {
      this._deleteBtn.background = P.BTN_DELETE_HOVER;
    });
    this._deleteBtn.onPointerOutObservable.add(() => {
      this._deleteBtn.background = P.BTN_DELETE_BG;
    });
    this._deleteBtn.onPointerUpObservable.add(() => this._handleDelete());
    btnRow.addControl(this._deleteBtn);
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  get isVisible(): boolean {
    return this._panel.isVisible;
  }

  /**
   * Show the panel populated with data for the given entity.
   */
  show(
    entityId: string,
    entityType: EditorPlacementType,
    properties: Readonly<EditorEntityProperties>,
  ): void {
    this._currentEntityId = entityId;
    this._currentType     = entityType;

    this._titleText.text = `[${entityType}]`;
    this._idText.text    = `id: ${entityId}`;

    this._rebuildFields(entityType, properties);
    this._panel.isVisible = true;
  }

  /** Hide the panel and clear internal state. */
  hide(): void {
    this._panel.isVisible = false;
    this._currentEntityId = null;
    this._currentType     = null;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _rebuildFields(
    type: EditorPlacementType,
    properties: Readonly<EditorEntityProperties>,
  ): void {
    // Remove old field controls
    this._fieldsStack.clearControls();
    this._inputMap.clear();

    const fieldDefs = FIELDS_BY_TYPE[type] ?? [];

    for (const { key, label } of fieldDefs) {
      const row = new StackPanel(`prop_row_${key}`);
      row.isVertical = false;
      row.height     = "28px";
      row.paddingLeft  = "8px";
      row.paddingRight = "8px";
      this._fieldsStack.addControl(row);

      const lbl = new TextBlock(`prop_lbl_${key}`, `${label}:`);
      lbl.width    = "120px";
      lbl.height   = "24px";
      lbl.color    = P.DIM;
      lbl.fontSize = 11;
      lbl.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      row.addControl(lbl);

      const input = new InputText(`prop_input_${key}`, (properties[key] as string | undefined) ?? "");
      input.width          = "120px";
      input.height         = "22px";
      input.color          = P.TEXT;
      input.background     = P.INPUT_BG;
      input.focusedBackground = P.INPUT_BG;
      input.focusedColor   = P.INPUT_FOCUS;
      input.placeholderText = "";
      input.fontSize       = 11;
      input.thickness      = 1;
      row.addControl(input);

      this._inputMap.set(key, input);
    }
  }

  private _handleApply(): void {
    if (!this._currentEntityId || !this._currentType) return;

    const props: EditorEntityProperties = {};
    for (const [key, input] of this._inputMap) {
      const val = input.text.trim();
      if (val !== "") {
        (props as Record<string, string>)[key] = val;
      }
    }

    this.onApply?.(this._currentEntityId, props);
  }

  private _handleDelete(): void {
    if (!this._currentEntityId) return;
    const id = this._currentEntityId;
    this.hide();
    this.onDelete?.(id);
  }
}
