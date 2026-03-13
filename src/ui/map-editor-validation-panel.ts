import {
  AdvancedDynamicTexture,
  Control,
  Rectangle,
  StackPanel,
  TextBlock,
  Button,
  ScrollViewer,
} from "@babylonjs/gui/2D";
import type { MapValidationReport, MapValidationIssue } from "../systems/map-editor-system";

// ── Design tokens ─────────────────────────────────────────────────────────────
const V = {
  PANEL_BG:      "rgba(6, 4, 2, 0.96)",
  PANEL_BORDER:  "#6B4F12",
  TITLE:         "#D4A017",
  TEXT:          "#EEE0C0",
  DIM:           "#998877",
  ACCENT:        "#5EC45E",
  PASS_COLOR:    "#5EC45E",
  FAIL_COLOR:    "#E05050",
  WARN_COLOR:    "#E08830",
  CODE_COLOR:    "#7EC8E3",
  CLOSE_BG:      "rgba(28, 20, 6, 0.95)",
  CLOSE_HOVER:   "rgba(80, 56, 10, 0.98)",
  REVALIDATE_BG: "rgba(8, 40, 8, 0.95)",
  REVALIDATE_HOVER: "rgba(16, 80, 16, 0.98)",
  ISSUE_BG:      "rgba(20, 14, 4, 0.80)",
  ISSUE_HOVER:   "rgba(50, 36, 8, 0.90)",
};

/** Human-friendly labels for each validation issue code. */
const ISSUE_CODE_LABELS: Record<MapValidationIssue["code"], string> = {
  "missing-patrol-group":   "Missing Patrol Group",
  "patrol-route-too-short": "Route Too Short",
  "entity-overlap":         "Entity Overlap",
  "orphaned-quest-marker":  "Orphaned Quest Marker",
  "duplicate-objective-id": "Duplicate Objective ID",
  "unknown-objective-id":   "Unknown Objective ID",
  "missing-loot-table":     "Missing Loot Table",
  "missing-spawn-template": "Missing Spawn Template",
};

/**
 * Dedicated validation results panel for the map editor.
 *
 * Shows/hides via `show(report)` / `hide()`.  Fires `onRevalidate` when the
 * user clicks the re-validate button and `onEntityFocus(entityId)` when the
 * user clicks an issue row that carries entity IDs.
 */
export class MapEditorValidationPanel {
  /** Fired when the user clicks the re-validate button. */
  public onRevalidate: (() => void) | null = null;

  /**
   * Fired when the user clicks an issue row that references a specific entity.
   * Callers should select that entity in the editor.
   */
  public onEntityFocus: ((entityId: string) => void) | null = null;

  private readonly _ui: AdvancedDynamicTexture;
  private readonly _panel: Rectangle;
  private readonly _summaryText: TextBlock;
  private readonly _issueStack: StackPanel;
  private readonly _countLabel: TextBlock;
  private readonly _revalidateBtn: Button;
  private _rowCounter: number = 0;

  constructor(ui: AdvancedDynamicTexture) {
    this._ui = ui;

    // ── Outer panel ──────────────────────────────────────────────────────────
    this._panel = new Rectangle("editorValidationPanel");
    this._panel.width  = "380px";
    this._panel.height = "440px";
    this._panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this._panel.verticalAlignment   = Control.VERTICAL_ALIGNMENT_CENTER;
    this._panel.background  = V.PANEL_BG;
    this._panel.color       = V.PANEL_BORDER;
    this._panel.thickness   = 2;
    this._panel.cornerRadius = 6;
    this._panel.paddingTop    = "0px";
    this._panel.paddingBottom = "0px";
    this._panel.isVisible = false;
    this._ui.addControl(this._panel);

    // ── Header row ────────────────────────────────────────────────────────────
    const header = new StackPanel("editorValidationHeader");
    header.isVertical = false;
    header.height     = "34px";
    header.paddingLeft  = "10px";
    header.paddingRight = "4px";
    this._panel.addControl(header);

    const titleIcon = new TextBlock("editorValidationIcon", "🔍");
    titleIcon.color    = V.TITLE;
    titleIcon.fontSize = 14;
    titleIcon.width    = "22px";
    titleIcon.height   = "34px";
    titleIcon.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    header.addControl(titleIcon);

    const titleText = new TextBlock("editorValidationTitle", "Map Validation");
    titleText.color    = V.TITLE;
    titleText.fontSize = 13;
    titleText.fontStyle = "bold";
    titleText.width    = "170px";
    titleText.height   = "34px";
    titleText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    header.addControl(titleText);

    this._countLabel = new TextBlock("editorValidationCount", "");
    this._countLabel.color    = V.DIM;
    this._countLabel.fontSize = 11;
    this._countLabel.width    = "80px";
    this._countLabel.height   = "34px";
    this._countLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    header.addControl(this._countLabel);

    this._revalidateBtn = Button.CreateSimpleButton("editorValidationRevalidate", "↻ Re-check");
    this._revalidateBtn.width        = "72px";
    this._revalidateBtn.height       = "22px";
    this._revalidateBtn.fontSize     = 11;
    this._revalidateBtn.color        = V.TEXT;
    this._revalidateBtn.background   = V.REVALIDATE_BG;
    this._revalidateBtn.cornerRadius = 3;
    this._revalidateBtn.thickness    = 1;
    this._revalidateBtn.onPointerEnterObservable.add(() => {
      this._revalidateBtn.background = V.REVALIDATE_HOVER;
    });
    this._revalidateBtn.onPointerOutObservable.add(() => {
      this._revalidateBtn.background = V.REVALIDATE_BG;
    });
    this._revalidateBtn.onPointerUpObservable.add(() => this.onRevalidate?.());
    header.addControl(this._revalidateBtn);

    const closeBtn = Button.CreateSimpleButton("editorValidationClose", "✕");
    closeBtn.width        = "22px";
    closeBtn.height       = "22px";
    closeBtn.fontSize     = 12;
    closeBtn.color        = V.TEXT;
    closeBtn.background   = V.CLOSE_BG;
    closeBtn.cornerRadius = 3;
    closeBtn.thickness    = 1;
    closeBtn.onPointerEnterObservable.add(() => {
      closeBtn.background = V.CLOSE_HOVER;
    });
    closeBtn.onPointerOutObservable.add(() => {
      closeBtn.background = V.CLOSE_BG;
    });
    closeBtn.onPointerUpObservable.add(() => this.hide());
    header.addControl(closeBtn);

    // ── Thin separator ────────────────────────────────────────────────────────
    const sep1 = new Rectangle("editorValidationSep1");
    sep1.height     = "1px";
    sep1.width      = "100%";
    sep1.background = V.PANEL_BORDER;
    sep1.thickness  = 0;
    this._panel.addControl(sep1);

    // ── Summary row ───────────────────────────────────────────────────────────
    this._summaryText = new TextBlock("editorValidationSummary", "");
    this._summaryText.height  = "28px";
    this._summaryText.color   = V.ACCENT;
    this._summaryText.fontSize = 12;
    this._summaryText.fontStyle = "bold";
    this._summaryText.paddingLeft = "10px";
    this._summaryText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this._panel.addControl(this._summaryText);

    const sep2 = new Rectangle("editorValidationSep2");
    sep2.height     = "1px";
    sep2.width      = "100%";
    sep2.background = V.PANEL_BORDER;
    sep2.thickness  = 0;
    this._panel.addControl(sep2);

    // ── Scroll viewer ─────────────────────────────────────────────────────────
    const scroll = new ScrollViewer("editorValidationScroll");
    scroll.width   = "100%";
    scroll.height  = "368px";
    scroll.barSize = 6;
    scroll.thickness = 0;
    this._panel.addControl(scroll);

    // ── Issue list ────────────────────────────────────────────────────────────
    this._issueStack = new StackPanel("editorValidationIssues");
    this._issueStack.isVertical = true;
    this._issueStack.width = "370px";
    scroll.addControl(this._issueStack);
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  get isVisible(): boolean {
    return this._panel.isVisible;
  }

  /**
   * Show the panel with the given validation report.
   * Rebuilds the issue list from scratch.
   */
  show(report: MapValidationReport): void {
    this._rebuild(report);
    this._panel.isVisible = true;
  }

  /** Update the displayed report without changing visibility. */
  update(report: MapValidationReport): void {
    this._rebuild(report);
  }

  /** Hide the panel. */
  hide(): void {
    this._panel.isVisible = false;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _rebuild(report: MapValidationReport): void {
    this._issueStack.clearControls();

    if (report.isValid) {
      this._summaryText.text  = "✓ All checks passed — no issues found.";
      this._summaryText.color = V.PASS_COLOR;
      this._countLabel.text   = "0 issues";

      const emptyMsg = new TextBlock("editorValidationEmpty", "Map is valid. Nothing to report.");
      emptyMsg.color    = V.DIM;
      emptyMsg.fontSize = 12;
      emptyMsg.height   = "40px";
      emptyMsg.paddingLeft = "10px";
      emptyMsg.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      this._issueStack.addControl(emptyMsg);
      return;
    }

    const count = report.issues.length;
    this._summaryText.text  = `✗ ${count} issue${count === 1 ? "" : "s"} found.`;
    this._summaryText.color = V.FAIL_COLOR;
    this._countLabel.text   = `${count} issue${count === 1 ? "" : "s"}`;

    for (const issue of report.issues) {
      this._issueStack.addControl(this._buildIssueRow(issue));
    }
  }

  private _buildIssueRow(issue: MapValidationIssue): Rectangle {
    const rowId = this._rowCounter++;
    const row = new Rectangle(`editorValRow_${rowId}`);
    row.width           = "370px";
    row.height          = "auto";
    row.adaptHeightToChildren = true;
    row.background      = V.ISSUE_BG;
    row.thickness       = 0;
    row.paddingBottom   = "1px";
    row.isPointerBlocker = true;

    const hasEntities = (issue.entityIds?.length ?? 0) > 0;
    if (hasEntities) {
      row.onPointerEnterObservable.add(() => { row.background = V.ISSUE_HOVER; });
      row.onPointerOutObservable.add(() => { row.background = V.ISSUE_BG; });
      row.onPointerUpObservable.add(() => {
        if (issue.entityIds && issue.entityIds.length > 0) {
          this.onEntityFocus?.(issue.entityIds[0]);
        }
      });
    }

    const inner = new StackPanel(`editorValRowInner_${rowId}`);
    inner.isVertical = true;
    inner.width      = "370px";
    inner.paddingTop    = "4px";
    inner.paddingBottom = "4px";
    inner.paddingLeft   = "10px";
    inner.paddingRight  = "10px";
    row.addControl(inner);

    // Code label
    const codeLabel = new TextBlock(
      `editorValCode_${rowId}`,
      `⚠ ${ISSUE_CODE_LABELS[issue.code] ?? issue.code}`,
    );
    codeLabel.color    = V.CODE_COLOR;
    codeLabel.fontSize = 11;
    codeLabel.fontStyle = "bold";
    codeLabel.height   = "18px";
    codeLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    inner.addControl(codeLabel);

    // Message text
    const msgLabel = new TextBlock(
      `editorValMsg_${rowId}`,
      issue.message,
    );
    msgLabel.color    = V.TEXT;
    msgLabel.fontSize = 10;
    msgLabel.height   = "16px";
    msgLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    inner.addControl(msgLabel);

    // Entity IDs (if any)
    if (hasEntities) {
      const idsText = `→ ${(issue.entityIds ?? []).join(", ")}`;
      const idsLabel = new TextBlock(
        `editorValIds_${rowId}`,
        idsText,
      );
      idsLabel.color    = V.WARN_COLOR;
      idsLabel.fontSize = 10;
      idsLabel.height   = "16px";
      idsLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      inner.addControl(idsLabel);
    }

    return row;
  }
}
