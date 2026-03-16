import type {
  ContentBundleSystem,
  ContentBundleReport,
  BundleSystemReport,
  BundleSystemId,
} from "../systems/content-bundle-system";

/**
 * HTML-based Content Bundle overlay — Release C pre-publish dashboard.
 *
 * Sections:
 *   1. Bundle metadata   — title, description, author
 *   2. Validation panel  — per-system status rows with issue counts and
 *                          expandable issue lists
 *   3. Action bar        — Validate All, Export Bundle ↓, close
 *
 * Each validated system row also shows a "▶ Play from here" quick-open
 * button that fires `onPlayFromHere(systemId)` so the game layer can
 * open the matching creator UI for rapid content iteration.
 *
 * Usage:
 *   const ui = new ContentBundleUI(contentBundleSystem);
 *   ui.onPlayFromHere = (id) => { ... open matching creator UI ... };
 *   ui.open();
 *   ui.close();
 *
 * Keybinding: Shift+F7 (wired in game.ts).
 */
export class ContentBundleUI {
  /** Called when the user closes the panel. */
  public onClose: (() => void) | null = null;

  /**
   * Called when the user clicks "▶ Play from here" on a system row.
   * The game layer should open the matching creator UI.
   */
  public onPlayFromHere: ((systemId: BundleSystemId) => void) | null = null;

  private readonly _sys: ContentBundleSystem;
  private _root: HTMLElement | null = null;
  private _statusEl: HTMLElement | null = null;
  private _dashboardEl: HTMLElement | null = null;
  private _validateBtn: HTMLButtonElement | null = null;

  // Metadata inputs
  private _titleInp!: HTMLInputElement;
  private _descInp!: HTMLInputElement;
  private _authorInp!: HTMLInputElement;

  constructor(system: ContentBundleSystem) {
    this._sys = system;
  }

  get isVisible(): boolean {
    return this._root !== null && !this._root.hidden;
  }

  open(): void {
    if (this._root) {
      this._root.hidden = false;
      this._syncMeta();
      return;
    }
    this._build();
  }

  close(): void {
    if (this._root) this._root.hidden = true;
    this.onClose?.();
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  private _build(): void {
    const root = document.createElement("div");
    root.className = "content-bundle";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Content Bundle Dashboard");
    this._root = root;

    const panel = document.createElement("section");
    panel.className = "content-bundle__panel";
    root.appendChild(panel);

    // ── Header ───────────────────────────────────────────────────────────────
    const header = document.createElement("div");
    header.className = "content-bundle__header";

    const titleWrap = document.createElement("div");
    const titleEl = document.createElement("h2");
    titleEl.className   = "content-bundle__title";
    titleEl.textContent = "📦 Content Bundle";
    const subtitleEl = document.createElement("p");
    subtitleEl.className   = "content-bundle__subtitle";
    subtitleEl.textContent = "Validate, review, and export your content package — Shift+F7";
    titleWrap.appendChild(titleEl);
    titleWrap.appendChild(subtitleEl);
    header.appendChild(titleWrap);

    const closeBtn = document.createElement("button");
    closeBtn.className   = "content-bundle__close-btn";
    closeBtn.textContent = "✕";
    closeBtn.setAttribute("aria-label", "Close content bundle dashboard");
    closeBtn.addEventListener("click", () => this.close());
    header.appendChild(closeBtn);

    panel.appendChild(header);

    // ── Metadata form ─────────────────────────────────────────────────────
    const metaSection = document.createElement("div");
    metaSection.className = "content-bundle__meta";

    const metaTitle = document.createElement("h3");
    metaTitle.className   = "content-bundle__section-title";
    metaTitle.textContent = "Bundle Metadata";
    metaSection.appendChild(metaTitle);

    const metaGrid = document.createElement("div");
    metaGrid.className = "content-bundle__meta-grid";

    this._titleInp  = this._makeTextInput("title-inp",  "Title",       this._sys.meta.title);
    this._descInp   = this._makeTextInput("desc-inp",   "Description", this._sys.meta.description);
    this._authorInp = this._makeTextInput("author-inp", "Author",      this._sys.meta.author);

    metaGrid.appendChild(this._labeledRow("Bundle title", this._titleInp));
    metaGrid.appendChild(this._labeledRow("Description",  this._descInp));
    metaGrid.appendChild(this._labeledRow("Author",       this._authorInp));
    metaSection.appendChild(metaGrid);

    const applyMetaBtn = document.createElement("button");
    applyMetaBtn.className   = "content-bundle__btn content-bundle__btn--secondary";
    applyMetaBtn.textContent = "Apply Metadata";
    applyMetaBtn.addEventListener("click", () => this._applyMeta());
    metaSection.appendChild(applyMetaBtn);

    panel.appendChild(metaSection);

    // ── Validation dashboard ──────────────────────────────────────────────
    const dashSection = document.createElement("div");
    dashSection.className = "content-bundle__dash-section";

    const dashTitle = document.createElement("h3");
    dashTitle.className   = "content-bundle__section-title";
    dashTitle.textContent = "System Diagnostics";
    dashSection.appendChild(dashTitle);

    const dashboard = document.createElement("div");
    dashboard.className = "content-bundle__dashboard";
    this._dashboardEl   = dashboard;

    const noSystems = document.createElement("p");
    noSystems.className   = "content-bundle__empty";
    noSystems.textContent = "No content systems attached. Click Validate All to run diagnostics.";
    dashboard.appendChild(noSystems);

    dashSection.appendChild(dashboard);
    panel.appendChild(dashSection);

    // ── Status bar ────────────────────────────────────────────────────────
    const statusEl = document.createElement("div");
    statusEl.className = "content-bundle__status";
    statusEl.setAttribute("aria-live", "polite");
    this._statusEl = statusEl;
    panel.appendChild(statusEl);

    // ── Action bar ────────────────────────────────────────────────────────
    const actions = document.createElement("div");
    actions.className = "content-bundle__actions";

    const validateBtn = document.createElement("button");
    validateBtn.className   = "content-bundle__btn content-bundle__btn--primary";
    validateBtn.textContent = "✔ Validate All";
    validateBtn.addEventListener("click", () => this._runValidation());
    this._validateBtn = validateBtn;

    const exportBtn = document.createElement("button");
    exportBtn.className   = "content-bundle__btn content-bundle__btn--export";
    exportBtn.textContent = "⬇ Export Bundle";
    exportBtn.addEventListener("click", () => this._exportBundle());

    const closeActionBtn = document.createElement("button");
    closeActionBtn.className   = "content-bundle__btn content-bundle__btn--close";
    closeActionBtn.textContent = "Close";
    closeActionBtn.addEventListener("click", () => this.close());

    actions.appendChild(validateBtn);
    actions.appendChild(exportBtn);
    actions.appendChild(closeActionBtn);
    panel.appendChild(actions);

    // ── Footer ────────────────────────────────────────────────────────────
    const footer = document.createElement("div");
    footer.className = "content-bundle__footer";
    footer.innerHTML =
      'Press <kbd>Esc</kbd> or click ✕ to close &nbsp;·&nbsp; ' +
      'Bundle JSON uses deterministic key ordering for diff-friendly source control';
    panel.appendChild(footer);

    document.body.appendChild(root);
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  private _applyMeta(): void {
    this._sys.setMeta({
      title:       this._titleInp.value,
      description: this._descInp.value,
      author:      this._authorInp.value,
    });
    this._setStatus("Metadata saved.", "ok");
  }

  private _runValidation(): void {
    this._applyMeta();
    const report = this._sys.validate();
    this._renderDashboard(report);

    const total  = report.systems.reduce((n, s) => n + s.issues.length, 0);
    const failed = report.systems.filter((s) => !s.valid).length;

    if (report.allValid) {
      this._setStatus(
        report.systems.length === 0
          ? "No systems attached — nothing to validate."
          : `All ${report.systems.length} system(s) passed validation. Ready to export.`,
        "ok",
      );
    } else {
      this._setStatus(
        `${failed} system(s) have issues (${total} total). Review the diagnostics above.`,
        "error",
      );
    }
  }

  private _exportBundle(): void {
    this._applyMeta();
    this._sys.exportToFile();
    this._setStatus("Bundle exported.", "ok");
  }

  // ── Dashboard rendering ────────────────────────────────────────────────────

  private _renderDashboard(report: ContentBundleReport): void {
    if (!this._dashboardEl) return;
    this._dashboardEl.innerHTML = "";

    if (report.systems.length === 0) {
      const empty = document.createElement("p");
      empty.className   = "content-bundle__empty";
      empty.textContent = "No content systems attached.";
      this._dashboardEl.appendChild(empty);
      return;
    }

    for (const sysReport of report.systems) {
      this._dashboardEl.appendChild(this._buildSystemRow(sysReport));
    }
  }

  private _buildSystemRow(sysReport: BundleSystemReport): HTMLElement {
    const row = document.createElement("div");
    row.className = `content-bundle__system-row ${sysReport.valid ? "content-bundle__system-row--ok" : "content-bundle__system-row--fail"}`;

    // Status icon
    const icon = document.createElement("span");
    icon.className   = "content-bundle__row-icon";
    icon.textContent = sysReport.valid ? "✔" : "✖";
    icon.setAttribute("aria-label", sysReport.valid ? "passed" : "failed");
    row.appendChild(icon);

    // Label + issue count
    const labelWrap = document.createElement("div");
    labelWrap.className = "content-bundle__row-label-wrap";

    const label = document.createElement("span");
    label.className   = "content-bundle__row-label";
    label.textContent = sysReport.label;
    labelWrap.appendChild(label);

    if (!sysReport.valid && sysReport.issues.length > 0) {
      const count = document.createElement("span");
      count.className   = "content-bundle__issue-count";
      count.textContent = `${sysReport.issues.length} issue${sysReport.issues.length > 1 ? "s" : ""}`;
      labelWrap.appendChild(count);
    }

    row.appendChild(labelWrap);

    // "Play from here" button
    const config = this._sys.getPlayFromHereConfig(sysReport.systemId);
    if (config) {
      const playBtn = document.createElement("button");
      playBtn.className   = "content-bundle__play-btn";
      playBtn.textContent = "▶ Open";
      playBtn.title       = `Open ${config.label}`;
      playBtn.setAttribute("aria-label", `Open ${config.label} for iteration`);
      playBtn.addEventListener("click", () => {
        this.close();
        this.onPlayFromHere?.(sysReport.systemId);
      });
      row.appendChild(playBtn);
    }

    // Expandable issues list
    if (sysReport.issues.length > 0) {
      const details = document.createElement("details");
      details.className = "content-bundle__issues-details";

      const summary = document.createElement("summary");
      summary.className   = "content-bundle__issues-summary";
      summary.textContent = "Show issues";
      details.appendChild(summary);

      const list = document.createElement("ul");
      list.className = "content-bundle__issues-list";
      for (const issue of sysReport.issues) {
        const li = document.createElement("li");
        li.className   = "content-bundle__issue";
        li.textContent = issue.message;
        list.appendChild(li);
      }
      details.appendChild(list);

      // Place details below the row header by wrapping everything
      const outer = document.createElement("div");
      outer.className = "content-bundle__system-block";
      outer.appendChild(row);
      outer.appendChild(details);
      return outer;
    }

    return row;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private _syncMeta(): void {
    if (this._titleInp)  this._titleInp.value  = this._sys.meta.title;
    if (this._descInp)   this._descInp.value   = this._sys.meta.description;
    if (this._authorInp) this._authorInp.value = this._sys.meta.author;
  }

  private _setStatus(msg: string, type: "ok" | "error" | "info"): void {
    if (!this._statusEl) return;
    this._statusEl.textContent = msg;
    this._statusEl.className =
      `content-bundle__status content-bundle__status--${type}`;
  }

  private _makeTextInput(id: string, placeholder: string, value: string): HTMLInputElement {
    const inp = document.createElement("input");
    inp.type        = "text";
    inp.id          = id;
    inp.placeholder = placeholder;
    inp.value       = value;
    inp.className   = "content-bundle__input";
    return inp;
  }

  private _labeledRow(label: string, input: HTMLInputElement): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "content-bundle__field-row";
    const lbl = document.createElement("label");
    lbl.textContent = label;
    lbl.setAttribute("for", input.id);
    lbl.className = "content-bundle__label";
    wrap.appendChild(lbl);
    wrap.appendChild(input);
    return wrap;
  }
}
