import type {
  FactionCreatorSystem,
  FactionCreatorDraft,
  FactionRelationDraft,
} from "../systems/faction-creator-system";
import { FACTION_DISPOSITIONS } from "../systems/faction-creator-system";

/**
 * HTML-based Faction Creator overlay.
 *
 * Two-column layout:
 *   1. Identity    — id, name, description, default reputation
 *   2. Thresholds  — hostileBelow, friendlyAt, alliedAt  (with live disposition preview)
 *   + Relations    — list of directed faction relationships (targetId, disposition, note)
 *
 * Actions: Validate, Export JSON ↓, Import JSON ↑, Reset, Close.
 *
 * Usage:
 *   const ui = new FactionCreatorUI(factionCreatorSystem);
 *   ui.open();   // shows the overlay
 *   ui.close();  // hides and calls onClose
 */
export class FactionCreatorUI {
  /** Called when the user closes the panel. */
  public onClose: (() => void) | null = null;

  private readonly _sys: FactionCreatorSystem;
  private _root: HTMLElement | null = null;
  private _statusEl: HTMLElement | null = null;
  private _relListEl: HTMLElement | null = null;

  // Identity inputs
  private _idInp!: HTMLInputElement;
  private _nameInp!: HTMLInputElement;
  private _descInp!: HTMLInputElement;
  private _defaultRepInp!: HTMLInputElement;

  // Threshold inputs
  private _hostileBelowInp!: HTMLInputElement;
  private _friendlyAtInp!: HTMLInputElement;
  private _alliedAtInp!: HTMLInputElement;
  private _threshPreviewEl!: HTMLElement;

  constructor(system: FactionCreatorSystem) {
    this._sys = system;
  }

  get isVisible(): boolean {
    return this._root !== null && !this._root.hidden;
  }

  open(): void {
    if (this._root) {
      this._root.hidden = false;
      this._syncFromDraft();
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
    root.className = "faction-creator";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Faction Creator");
    this._root = root;

    const panel = document.createElement("section");
    panel.className = "faction-creator__panel";
    root.appendChild(panel);

    // Header
    const header = document.createElement("div");
    header.className = "faction-creator__header";
    const title = document.createElement("h2");
    title.className   = "faction-creator__title";
    title.textContent = "Faction Creator";
    header.appendChild(title);
    const closeBtn = document.createElement("button");
    closeBtn.className   = "faction-creator__close-btn";
    closeBtn.textContent = "✕";
    closeBtn.setAttribute("aria-label", "Close faction creator");
    closeBtn.addEventListener("click", () => this.close());
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Body — two columns + relations
    const body = document.createElement("div");
    body.className = "faction-creator__body";
    body.appendChild(this._buildIdentitySection());
    body.appendChild(this._buildThresholdsSection());
    panel.appendChild(body);

    // Relations section (full-width below columns)
    panel.appendChild(this._buildRelationsSection());

    // Footer
    panel.appendChild(this._buildFooter());

    document.body.appendChild(root);
    this._syncFromDraft();
  }

  // ── Identity section ───────────────────────────────────────────────────────

  private _buildIdentitySection(): HTMLElement {
    const sec = this._makeSection("Faction Identity");

    this._idInp   = this._addField(sec, "Faction ID",          "text",   "e.g. faction_city_guards");
    this._nameInp = this._addField(sec, "Display Name",        "text",   "e.g. City Guards");
    this._descInp = this._addField(sec, "Description",         "text",   "Short faction summary");
    this._defaultRepInp = this._addField(sec, "Default Reputation", "number", "0");
    (this._defaultRepInp as HTMLInputElement).min  = "-100";
    (this._defaultRepInp as HTMLInputElement).max  = "100";
    (this._defaultRepInp as HTMLInputElement).step = "1";

    const sync = () => this._syncMetaToSystem();
    for (const inp of [this._idInp, this._nameInp, this._descInp, this._defaultRepInp]) {
      inp.addEventListener("input", sync);
    }

    return sec;
  }

  // ── Thresholds section ─────────────────────────────────────────────────────

  private _buildThresholdsSection(): HTMLElement {
    const sec = this._makeSection("Reputation Thresholds");

    // Explanation blurb
    const blurb = document.createElement("p");
    blurb.className   = "faction-creator__blurb";
    blurb.textContent =
      "Reputation rises with favourable deeds and falls with crimes. " +
      "These thresholds determine how NPCs react.";
    sec.appendChild(blurb);

    this._hostileBelowInp = this._addField(sec, "Hostile below",  "number", "-25");
    this._friendlyAtInp   = this._addField(sec, "Friendly at",    "number", "25");
    this._alliedAtInp     = this._addField(sec, "Allied at",      "number", "60");

    for (const inp of [this._hostileBelowInp, this._friendlyAtInp, this._alliedAtInp]) {
      inp.min  = "-100";
      inp.max  = "100";
      inp.step = "1";
      inp.addEventListener("input", () => {
        this._syncMetaToSystem();
        this._updateThresholdPreview();
      });
    }

    // Live preview bar
    const previewWrap = document.createElement("div");
    previewWrap.className = "faction-creator__preview-wrap";
    const previewLabel = document.createElement("span");
    previewLabel.className   = "faction-creator__label faction-creator__label--sm";
    previewLabel.textContent = "Disposition preview";
    previewWrap.appendChild(previewLabel);
    const preview = document.createElement("div");
    preview.className = "faction-creator__thresh-preview";
    this._threshPreviewEl = preview;
    previewWrap.appendChild(preview);
    sec.appendChild(previewWrap);

    return sec;
  }

  private _updateThresholdPreview(): void {
    if (!this._threshPreviewEl) return;
    const hostile  = parseInt(this._hostileBelowInp.value, 10) || 0;
    const friendly = parseInt(this._friendlyAtInp.value, 10)   || 0;
    const allied   = parseInt(this._alliedAtInp.value, 10)     || 0;
    this._threshPreviewEl.textContent =
      `< ${hostile}: 🔴 Hostile  ·  ${hostile}–${friendly - 1}: ⬛ Neutral  ·  ` +
      `${friendly}–${allied - 1}: 🟡 Friendly  ·  ≥ ${allied}: 🟢 Allied`;
  }

  // ── Relations section ──────────────────────────────────────────────────────

  private _buildRelationsSection(): HTMLElement {
    const sec = document.createElement("div");
    sec.className = "faction-creator__relations-section";

    const header = document.createElement("div");
    header.className = "faction-creator__section-header";

    const h3 = document.createElement("h3");
    h3.className   = "faction-creator__section-title";
    h3.textContent = "Faction Relations";
    header.appendChild(h3);

    const addBtn = document.createElement("button");
    addBtn.className   = "faction-creator__btn faction-creator__btn--sm";
    addBtn.textContent = "+ Add Relation";
    addBtn.addEventListener("click", () => {
      this._sys.addRelation();
      this._renderRelationList();
    });
    header.appendChild(addBtn);
    sec.appendChild(header);

    const list = document.createElement("div");
    list.className     = "faction-creator__rel-list";
    this._relListEl    = list;
    sec.appendChild(list);

    return sec;
  }

  private _renderRelationList(): void {
    if (!this._relListEl) return;
    this._relListEl.innerHTML = "";

    const rels = this._sys.relations;
    if (rels.length === 0) {
      const empty = document.createElement("p");
      empty.className   = "faction-creator__empty";
      empty.textContent = "No relations yet. Click \u201c+ Add Relation\u201d to document inter-faction standing.";
      this._relListEl.appendChild(empty);
      return;
    }

    for (const rel of rels) {
      this._relListEl.appendChild(this._buildRelationRow(rel));
    }
  }

  private _buildRelationRow(rel: FactionRelationDraft): HTMLElement {
    const row = document.createElement("div");
    row.className = "faction-creator__rel-row";

    // Target ID
    const targetGrp = this._makeLabeledControl("Target Faction ID", `fcr_tid_${rel.targetId}`);
    const targetInp = document.createElement("input");
    targetInp.id          = `fcr_tid_${rel.targetId}`;
    targetInp.type        = "text";
    targetInp.className   = "faction-creator__input faction-creator__input--sm";
    targetInp.placeholder = "e.g. faction_bandits";
    targetInp.value       = rel.targetId;
    targetInp.addEventListener("input", () => {
      this._sys.updateRelation(rel.targetId, {});
      // targetId is immutable; re-render to keep in sync
    });
    targetGrp.appendChild(targetInp);
    row.appendChild(targetGrp);

    // Disposition select
    const dispGrp = this._makeLabeledControl("Disposition", `fcr_disp_${rel.targetId}`);
    const dispSel = document.createElement("select");
    dispSel.id        = `fcr_disp_${rel.targetId}`;
    dispSel.className = "faction-creator__select";
    for (const d of FACTION_DISPOSITIONS) {
      const opt = document.createElement("option");
      opt.value       = d;
      opt.textContent = d;
      opt.selected    = d === rel.disposition;
      dispSel.appendChild(opt);
    }
    dispSel.addEventListener("change", () => {
      this._sys.updateRelation(rel.targetId, {
        disposition: dispSel.value as typeof rel.disposition,
      });
    });
    dispGrp.appendChild(dispSel);
    row.appendChild(dispGrp);

    // Note
    const noteGrp = this._makeLabeledControl("Note (optional)", `fcr_note_${rel.targetId}`);
    noteGrp.style.flex = "1";
    const noteInp = document.createElement("input");
    noteInp.id          = `fcr_note_${rel.targetId}`;
    noteInp.type        = "text";
    noteInp.className   = "faction-creator__input";
    noteInp.placeholder = "e.g. At war since the Third Age";
    noteInp.value       = rel.note;
    noteInp.addEventListener("input", () => {
      this._sys.updateRelation(rel.targetId, { note: noteInp.value });
    });
    noteGrp.appendChild(noteInp);
    row.appendChild(noteGrp);

    // Remove button
    const removeBtn = document.createElement("button");
    removeBtn.className   = "faction-creator__btn faction-creator__btn--sm faction-creator__btn--danger";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => {
      this._sys.removeRelation(rel.targetId);
      this._renderRelationList();
    });
    row.appendChild(removeBtn);

    return row;
  }

  // ── Footer ─────────────────────────────────────────────────────────────────

  private _buildFooter(): HTMLElement {
    const footer = document.createElement("div");
    footer.className = "faction-creator__footer";

    const status = document.createElement("p");
    status.className = "faction-creator__status";
    this._statusEl   = status;
    footer.appendChild(status);

    const actions = document.createElement("div");
    actions.className = "faction-creator__actions";
    footer.appendChild(actions);

    const validateBtn = this._makeBtn("Validate",        "faction-creator__btn",                          () => this._handleValidate());
    const exportBtn   = this._makeBtn("Export JSON ↓",   "faction-creator__btn faction-creator__btn--primary", () => this._handleExport());
    const importBtn   = this._makeBtn("Import JSON ↑",   "faction-creator__btn",                          () => this._handleImport());
    const resetBtn    = this._makeBtn("Reset",            "faction-creator__btn faction-creator__btn--danger",  () => this._handleReset());

    for (const btn of [validateBtn, exportBtn, importBtn, resetBtn]) {
      actions.appendChild(btn);
    }

    return footer;
  }

  // ── Action handlers ────────────────────────────────────────────────────────

  private _handleValidate(): void {
    const report = this._sys.validate();
    if (report.valid) {
      this._setStatus("✔ Validation passed — faction definition is valid.", "ok");
    } else {
      const details = report.issues.map(i => `• ${i}`).join("\n");
      this._setStatus(`✖ Validation failed (${report.issues.length} issue(s)):\n${details}`, "error");
    }
  }

  private _handleExport(): void {
    this._sys.exportToFile();
    this._setStatus("Faction definition exported as JSON file.", "ok");
  }

  private _handleImport(): void {
    const input = document.createElement("input");
    input.type   = "file";
    input.accept = ".json,application/json";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      const ok = await this._sys.importFromFile(file);
      if (ok) {
        this._syncFromDraft();
        this._setStatus(`Imported faction "${this._sys.draft.name}" successfully.`, "ok");
      } else {
        this._setStatus("Import failed — invalid faction JSON file.", "error");
      }
    });
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  }

  private _handleReset(): void {
    this._sys.reset();
    this._syncFromDraft();
    this._setStatus("Draft reset to blank.", "ok");
  }

  // ── Sync helpers ───────────────────────────────────────────────────────────

  private _syncMetaToSystem(): void {
    this._sys.setMeta({
      id:                this._idInp?.value          ?? "",
      name:              this._nameInp?.value        ?? "",
      description:       this._descInp?.value        ?? "",
      defaultReputation: parseInt(this._defaultRepInp?.value ?? "0", 10) || 0,
      hostileBelow:      parseInt(this._hostileBelowInp?.value ?? "-25", 10),
      friendlyAt:        parseInt(this._friendlyAtInp?.value  ?? "25",  10),
      alliedAt:          parseInt(this._alliedAtInp?.value    ?? "60",  10),
    });
  }

  private _syncFromDraft(): void {
    const d = this._sys.draft;
    if (this._idInp)            this._idInp.value            = d.id;
    if (this._nameInp)          this._nameInp.value          = d.name;
    if (this._descInp)          this._descInp.value          = d.description;
    if (this._defaultRepInp)    this._defaultRepInp.value    = String(d.defaultReputation);
    if (this._hostileBelowInp)  this._hostileBelowInp.value  = String(d.hostileBelow);
    if (this._friendlyAtInp)    this._friendlyAtInp.value    = String(d.friendlyAt);
    if (this._alliedAtInp)      this._alliedAtInp.value      = String(d.alliedAt);
    this._updateThresholdPreview();
    this._renderRelationList();
  }

  private _setStatus(message: string, type: "ok" | "error" | ""): void {
    if (!this._statusEl) return;
    this._statusEl.textContent = message;
    this._statusEl.className =
      `faction-creator__status${type ? ` faction-creator__status--${type}` : ""}`;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private _makeSection(title: string): HTMLElement {
    const sec = document.createElement("div");
    sec.className = "faction-creator__section";
    const h3 = document.createElement("h3");
    h3.className   = "faction-creator__section-title";
    h3.textContent = title;
    sec.appendChild(h3);
    return sec;
  }

  private _addField(
    container: HTMLElement,
    label: string,
    type: string,
    placeholder: string,
  ): HTMLInputElement {
    const row = document.createElement("div");
    row.className = "faction-creator__field";
    container.appendChild(row);

    const lbl = document.createElement("label");
    lbl.className   = "faction-creator__label";
    lbl.textContent = label;
    row.appendChild(lbl);

    const inp = document.createElement("input");
    inp.type        = type;
    inp.className   = "faction-creator__input";
    inp.placeholder = placeholder;
    row.appendChild(inp);

    lbl.htmlFor = inp.id = `fc_${label.replace(/\s+/g, "_").toLowerCase()}`;
    return inp;
  }

  private _makeLabeledControl(labelText: string, inputId: string): HTMLElement {
    const group = document.createElement("div");
    group.className = "faction-creator__control-group";
    const lbl = document.createElement("label");
    lbl.htmlFor     = inputId;
    lbl.className   = "faction-creator__label faction-creator__label--sm";
    lbl.textContent = labelText;
    group.appendChild(lbl);
    return group;
  }

  private _makeBtn(label: string, cls: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.className   = cls;
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    return btn;
  }
}
