import {
  AdvancedDynamicTexture,
  Control,
  Rectangle,
  StackPanel,
  TextBlock,
  Button,
  InputText,
} from "@babylonjs/gui/2D";

// ── Design tokens ─────────────────────────────────────────────────────────────
const N = {
  PANEL_BG:      "rgba(6, 4, 2, 0.95)",
  PANEL_BORDER:  "#6B4F12",
  TITLE:         "#D4A017",
  TEXT:          "#EEE0C0",
  DIM:           "#998877",
  INPUT_BG:      "rgba(20, 14, 4, 0.9)",
  INPUT_FOCUS:   "#D4A017",
  SAVE_BG:       "rgba(8, 40, 8, 0.95)",
  SAVE_HOVER:    "rgba(16, 80, 16, 0.98)",
  CLOSE_BG:      "rgba(28, 20, 6, 0.95)",
  CLOSE_HOVER:   "rgba(80, 56, 10, 0.98)",
};

/** Maximum length (characters) enforced on saved notes. */
const NOTES_MAX_CHARS = 500;

/**
 * Scene notes panel — a simple text panel for authoring map-level notes,
 * descriptions, and developer remarks.  Inspired by RPG Maker's map notes.
 *
 * Notes are persisted in the map export JSON under `data.notes`.
 *
 * Usage:
 *   panel.show(currentNotes);
 *   panel.onSave = (text) => mapEditorSystem.notes = text;
 */
export class MapEditorNotesPanel {
  /** Fired when the user clicks "Save" with the current text. */
  public onSave: ((text: string) => void) | null = null;

  private readonly _ui: AdvancedDynamicTexture;
  private readonly _panel: Rectangle;
  private readonly _input: InputText;
  private readonly _charCount: TextBlock;

  constructor(ui: AdvancedDynamicTexture) {
    this._ui = ui;

    // ── Outer panel ──────────────────────────────────────────────────────────
    this._panel = new Rectangle("editorNotesPanel");
    this._panel.width  = "340px";
    this._panel.height = "auto";
    this._panel.adaptHeightToChildren = true;
    this._panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this._panel.verticalAlignment   = Control.VERTICAL_ALIGNMENT_CENTER;
    this._panel.background  = N.PANEL_BG;
    this._panel.color       = N.PANEL_BORDER;
    this._panel.thickness   = 2;
    this._panel.cornerRadius = 6;
    this._panel.paddingTop    = "6px";
    this._panel.paddingBottom = "8px";
    this._panel.isVisible = false;
    this._ui.addControl(this._panel);

    const inner = new StackPanel("editorNotesInner");
    inner.isVertical = true;
    inner.width = "320px";
    this._panel.addControl(inner);

    // ── Header row ────────────────────────────────────────────────────────────
    const headerRow = new StackPanel("editorNotesHeader");
    headerRow.isVertical = false;
    headerRow.height     = "28px";
    inner.addControl(headerRow);

    const titleIcon = new TextBlock("editorNotesIcon", "📝");
    titleIcon.color    = N.TITLE;
    titleIcon.fontSize = 14;
    titleIcon.width    = "22px";
    titleIcon.height   = "28px";
    titleIcon.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    headerRow.addControl(titleIcon);

    const titleText = new TextBlock("editorNotesTitle", "Scene Notes");
    titleText.color    = N.TITLE;
    titleText.fontSize = 13;
    titleText.fontStyle = "bold";
    titleText.width    = "210px";
    titleText.height   = "28px";
    titleText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    headerRow.addControl(titleText);

    const saveBtn = Button.CreateSimpleButton("editorNotesSave", "✓ Save");
    saveBtn.width        = "60px";
    saveBtn.height       = "22px";
    saveBtn.fontSize     = 11;
    saveBtn.color        = N.TEXT;
    saveBtn.background   = N.SAVE_BG;
    saveBtn.cornerRadius = 3;
    saveBtn.thickness    = 1;
    saveBtn.onPointerEnterObservable.add(() => { saveBtn.background = N.SAVE_HOVER; });
    saveBtn.onPointerOutObservable.add(() => { saveBtn.background = N.SAVE_BG; });
    saveBtn.onPointerUpObservable.add(() => this._handleSave());
    headerRow.addControl(saveBtn);

    const spacer = new Rectangle("editorNotesSpacer");
    spacer.width     = "4px";
    spacer.height    = "22px";
    spacer.thickness = 0;
    spacer.background = "transparent";
    headerRow.addControl(spacer);

    const closeBtn = Button.CreateSimpleButton("editorNotesClose", "✕");
    closeBtn.width        = "22px";
    closeBtn.height       = "22px";
    closeBtn.fontSize     = 12;
    closeBtn.color        = N.TEXT;
    closeBtn.background   = N.CLOSE_BG;
    closeBtn.cornerRadius = 3;
    closeBtn.thickness    = 1;
    closeBtn.onPointerEnterObservable.add(() => { closeBtn.background = N.CLOSE_HOVER; });
    closeBtn.onPointerOutObservable.add(() => { closeBtn.background = N.CLOSE_BG; });
    closeBtn.onPointerUpObservable.add(() => this.hide());
    headerRow.addControl(closeBtn);

    // ── Separator ────────────────────────────────────────────────────────────
    const sep = new Rectangle("editorNotesSep");
    sep.height     = "1px";
    sep.width      = "100%";
    sep.background = N.PANEL_BORDER;
    sep.thickness  = 0;
    inner.addControl(sep);

    // ── Hint ────────────────────────────────────────────────────────────────
    const hint = new TextBlock("editorNotesHint",
      "Add notes, descriptions or reminders for this map. Saved in the export JSON.");
    hint.color    = N.DIM;
    hint.fontSize = 10;
    hint.height   = "30px";
    hint.textWrapping = true;
    hint.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    hint.paddingLeft = "4px";
    inner.addControl(hint);

    // ── Text input ───────────────────────────────────────────────────────────
    this._input = new InputText("editorNotesInput", "");
    this._input.width          = "310px";
    this._input.height         = "80px";
    this._input.color          = N.TEXT;
    this._input.background     = N.INPUT_BG;
    this._input.focusedBackground = N.INPUT_BG;
    this._input.focusedColor   = N.INPUT_FOCUS;
    this._input.placeholderText = `Enter map notes here (max ${NOTES_MAX_CHARS} chars)...`;
    this._input.fontSize       = 11;
    this._input.thickness      = 1;
    inner.addControl(this._input);

    // ── Character count ───────────────────────────────────────────────────────
    this._charCount = new TextBlock("editorNotesCharCount", `0 / ${NOTES_MAX_CHARS}`);
    this._charCount.color    = N.DIM;
    this._charCount.fontSize = 10;
    this._charCount.height   = "18px";
    this._charCount.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    inner.addControl(this._charCount);

    // Update char count on input
    this._input.onKeyboardEventProcessedObservable?.add(() => {
      this._updateCharCount();
    });
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  get isVisible(): boolean {
    return this._panel.isVisible;
  }

  /**
   * Show the notes panel, pre-populating it with the given text.
   */
  show(currentNotes: string = ""): void {
    this._input.text = currentNotes;
    this._updateCharCount();
    this._panel.isVisible = true;
  }

  /** Hide the notes panel. */
  hide(): void {
    this._panel.isVisible = false;
  }

  /**
   * Update the displayed notes text without changing visibility.
   */
  setNotes(text: string): void {
    this._input.text = text;
    this._updateCharCount();
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _handleSave(): void {
    const text = this._input.text.slice(0, NOTES_MAX_CHARS);
    this._input.text = text;
    this._updateCharCount();
    this.onSave?.(text);
    this.hide();
  }

  private _updateCharCount(): void {
    const len = this._input.text.length;
    this._charCount.text = `${len} / ${NOTES_MAX_CHARS}`;
    this._charCount.color = len > NOTES_MAX_CHARS * 0.96 ? "#E05050" : N.DIM;
  }
}
