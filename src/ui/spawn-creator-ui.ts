import type { SpawnCreatorSystem, SpawnEntryDraft } from "../systems/spawn-creator-system";
import { SPAWN_ARCHETYPE_ROLES } from "../systems/spawn-creator-system";
import { SchemaFieldBuilder } from "./schema-field-builder";

// ── Archetype options for the picker ────────────────────────────────────────

const ARCHETYPE_OPTIONS = SPAWN_ARCHETYPE_ROLES.map(r => ({ value: r, label: r }));
// Leading blank entry so users can see unset state
const ARCHETYPE_SELECT_OPTIONS = [{ value: "", label: "(choose archetype)" }, ...ARCHETYPE_OPTIONS];

/**
 * HTML-based Loot + Spawn Creator overlay (Content GUI Release B).
 *
 * Two-section layout:
 *   1. Spawn group metadata  — id, name, description
 *   2. Spawn entry list      — CRUD for spawn entries with:
 *      • Archetype picker (NPC role / archetype id)
 *      • Loot table id link
 *      • Count, level range, respawn interval
 *      • Inline validation hints per entry
 *
 * Actions: Validate, Export JSON ↓, Import JSON ↑, Reset, Close.
 *
 * Keyboard shortcut: Shift+F11 (wired in game.ts).
 *
 * Usage:
 *   const ui = new SpawnCreatorUI(spawnCreatorSystem);
 *   ui.open();   // shows the overlay
 *   ui.close();  // hides and calls onClose
 */
export class SpawnCreatorUI {
  /** Called when the user closes the panel. */
  public onClose: (() => void) | null = null;

  private readonly _sys: SpawnCreatorSystem;
  private readonly _fb = new SchemaFieldBuilder("spawn-creator");

  private _root: HTMLElement | null = null;
  private _statusEl: HTMLElement | null = null;
  private _entryListEl: HTMLElement | null = null;

  // Metadata inputs
  private _idInp!: HTMLInputElement;
  private _nameInp!: HTMLInputElement;
  private _descInp!: HTMLInputElement;

  constructor(system: SpawnCreatorSystem) {
    this._sys = system;
  }

  get isVisible(): boolean {
    return this._root !== null && !this._root.hidden;
  }

  /** Build and show the Spawn Creator panel. */
  open(): void {
    if (this._root) {
      this._root.hidden = false;
      this._syncFromDraft();
      return;
    }
    this._build();
  }

  /** Hide the panel without destroying it. */
  close(): void {
    if (this._root) this._root.hidden = true;
    this.onClose?.();
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  private _build(): void {
    const root = document.createElement("div");
    root.className = "spawn-creator";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Spawn Creator");
    this._root = root;

    const panel = document.createElement("section");
    panel.className = "spawn-creator__panel";
    root.appendChild(panel);

    // Header
    const header = document.createElement("div");
    header.className = "spawn-creator__header";

    const title = document.createElement("h2");
    title.className   = "spawn-creator__title";
    title.textContent = "Loot + Spawn Creator";
    header.appendChild(title);

    const closeBtn = document.createElement("button");
    closeBtn.className = "spawn-creator__close-btn";
    closeBtn.textContent = "✕";
    closeBtn.setAttribute("aria-label", "Close spawn creator");
    closeBtn.addEventListener("click", () => this.close());
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Body — two-column (metadata | entries)
    const body = document.createElement("div");
    body.className = "spawn-creator__body";
    body.appendChild(this._buildMetaSection());
    body.appendChild(this._buildEntriesSection());
    panel.appendChild(body);

    // Footer
    panel.appendChild(this._buildFooter());

    document.body.appendChild(root);
    this._syncFromDraft();
  }

  // ── Metadata section ───────────────────────────────────────────────────────

  private _buildMetaSection(): HTMLElement {
    const section = document.createElement("div");
    section.className = "spawn-creator__section spawn-creator__section--meta";

    const h3 = document.createElement("h3");
    h3.className   = "spawn-creator__section-title";
    h3.textContent = "Spawn Group";
    section.appendChild(h3);

    const form = document.createElement("div");
    form.className = "spawn-creator__form";
    section.appendChild(form);

    const { element: idEl, input: idInp }     = this._fb.text({ id: "id",   label: "Group ID",    placeholder: "e.g. sg_bandit_camp" });
    const { element: nameEl, input: nameInp } = this._fb.text({ id: "name", label: "Display Name", placeholder: "e.g. Bandit Camp" });
    const { element: descEl, input: descInp } = this._fb.text({ id: "desc", label: "Description",  placeholder: "Optional notes" });

    this._idInp   = idInp;
    this._nameInp = nameInp;
    this._descInp = descInp;

    const syncMeta = () => {
      this._sys.setMeta(
        this._idInp.value,
        this._nameInp.value,
        this._descInp.value,
      );
    };

    idInp.addEventListener("input",   syncMeta);
    nameInp.addEventListener("input", syncMeta);
    descInp.addEventListener("input", syncMeta);

    form.appendChild(idEl);
    form.appendChild(nameEl);
    form.appendChild(descEl);

    // Validation hint box (updates on Validate button)
    const hint = document.createElement("div");
    hint.className   = "spawn-creator__meta-hint";
    hint.textContent = "Fill in the group ID and name, then add spawn entries below.";
    form.appendChild(hint);

    return section;
  }

  // ── Entries section ────────────────────────────────────────────────────────

  private _buildEntriesSection(): HTMLElement {
    const section = document.createElement("div");
    section.className = "spawn-creator__section spawn-creator__section--entries";

    const listHeader = document.createElement("div");
    listHeader.className = "spawn-creator__list-header";

    const h3 = document.createElement("h3");
    h3.className   = "spawn-creator__section-title";
    h3.textContent = "Spawn Entries";
    listHeader.appendChild(h3);

    const addBtn = document.createElement("button");
    addBtn.className   = "spawn-creator__btn spawn-creator__btn--sm";
    addBtn.textContent = "+ Add Entry";
    addBtn.addEventListener("click", () => {
      this._sys.addEntry();
      this._renderEntryList();
    });
    listHeader.appendChild(addBtn);
    section.appendChild(listHeader);

    const list = document.createElement("div");
    list.className    = "spawn-creator__entry-list";
    this._entryListEl = list;
    section.appendChild(list);

    return section;
  }

  private _renderEntryList(): void {
    if (!this._entryListEl) return;
    this._entryListEl.innerHTML = "";

    const entries = this._sys.entries;
    if (entries.length === 0) {
      const empty = document.createElement("p");
      empty.className   = "spawn-creator__empty";
      empty.textContent = "No spawn entries yet. Click \"+ Add Entry\" to begin.";
      this._entryListEl.appendChild(empty);
      return;
    }

    // Build validation report for inline hints
    const report = this._sys.validate();
    const issueMap = new Map<string | undefined, string[]>();
    for (const issue of report.issues) {
      const key = issue.entryId ?? "__group__";
      if (!issueMap.has(key)) issueMap.set(key, []);
      issueMap.get(key)!.push(issue.detail);
    }

    for (const entry of entries) {
      this._entryListEl.appendChild(this._buildEntryCard(entry, issueMap.get(entry.id) ?? []));
    }
  }

  private _buildEntryCard(entry: SpawnEntryDraft, hints: string[]): HTMLElement {
    const card = document.createElement("div");
    card.className      = `spawn-creator__entry-card${hints.length > 0 ? " spawn-creator__entry-card--invalid" : ""}`;
    card.dataset.entryId = entry.id;

    // ── Row 1: id label + remove button ──────────────────────────────────────
    const row1 = document.createElement("div");
    row1.className = "spawn-creator__entry-row";

    const idLabel = document.createElement("span");
    idLabel.className   = "spawn-creator__entry-id";
    idLabel.textContent = entry.id;
    row1.appendChild(idLabel);

    const removeBtn = document.createElement("button");
    removeBtn.className   = "spawn-creator__btn spawn-creator__btn--sm spawn-creator__btn--danger";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => {
      this._sys.removeEntry(entry.id);
      this._renderEntryList();
    });
    row1.appendChild(removeBtn);
    card.appendChild(row1);

    // ── Row 2: archetype picker + loot table id ────────────────────────────
    const row2 = document.createElement("div");
    row2.className = "spawn-creator__entry-row spawn-creator__entry-row--fields";
    card.appendChild(row2);

    // Archetype picker
    const archetypeGroup = document.createElement("div");
    archetypeGroup.className = "spawn-creator__control-group";
    const archetypeLbl = document.createElement("label");
    archetypeLbl.className   = "spawn-creator__label spawn-creator__label--sm";
    archetypeLbl.textContent = "Archetype";
    archetypeLbl.htmlFor     = `sc_arch_${entry.id}`;
    archetypeGroup.appendChild(archetypeLbl);

    const archetypeSel = document.createElement("select");
    archetypeSel.id        = `sc_arch_${entry.id}`;
    archetypeSel.className = "spawn-creator__select";
    for (const opt of ARCHETYPE_SELECT_OPTIONS) {
      const o = document.createElement("option");
      o.value       = opt.value;
      o.textContent = opt.label;
      o.selected    = opt.value === entry.archetypeId;
      archetypeSel.appendChild(o);
    }
    // Also allow free-text custom archetype ids not in the list
    if (entry.archetypeId && !(SPAWN_ARCHETYPE_ROLES as readonly string[]).includes(entry.archetypeId)) {
      const customOpt = document.createElement("option");
      customOpt.value       = entry.archetypeId;
      customOpt.textContent = entry.archetypeId;
      customOpt.selected    = true;
      archetypeSel.insertBefore(customOpt, archetypeSel.children[1]);
    }
    archetypeSel.addEventListener("change", () => {
      this._sys.updateEntry(entry.id, { archetypeId: archetypeSel.value });
      this._renderEntryList();
    });
    archetypeGroup.appendChild(archetypeSel);
    row2.appendChild(archetypeGroup);

    // Custom archetype id text input (for non-list archetypes)
    const customArchGroup = document.createElement("div");
    customArchGroup.className = "spawn-creator__control-group";
    const customArchLbl = document.createElement("label");
    customArchLbl.className   = "spawn-creator__label spawn-creator__label--sm";
    customArchLbl.textContent = "Custom ID";
    customArchLbl.htmlFor     = `sc_customarch_${entry.id}`;
    customArchGroup.appendChild(customArchLbl);
    const customArchInp = document.createElement("input");
    customArchInp.id          = `sc_customarch_${entry.id}`;
    customArchInp.type        = "text";
    customArchInp.className   = "spawn-creator__input spawn-creator__input--sm";
    customArchInp.placeholder = "or type custom id";
    customArchInp.value       = entry.archetypeId;
    customArchInp.addEventListener("input", () => {
      this._sys.updateEntry(entry.id, { archetypeId: customArchInp.value });
    });
    customArchGroup.appendChild(customArchInp);
    row2.appendChild(customArchGroup);

    // Loot table id
    const lootGroup = document.createElement("div");
    lootGroup.className = "spawn-creator__control-group";
    const lootLbl = document.createElement("label");
    lootLbl.className   = "spawn-creator__label spawn-creator__label--sm";
    lootLbl.textContent = "Loot Table ID";
    lootLbl.htmlFor     = `sc_loot_${entry.id}`;
    lootGroup.appendChild(lootLbl);
    const lootInp = document.createElement("input");
    lootInp.id          = `sc_loot_${entry.id}`;
    lootInp.type        = "text";
    lootInp.className   = "spawn-creator__input spawn-creator__input--sm";
    lootInp.placeholder = "e.g. bandit_loot";
    lootInp.value       = entry.lootTableId;
    lootInp.addEventListener("input", () => {
      this._sys.updateEntry(entry.id, { lootTableId: lootInp.value });
    });
    lootGroup.appendChild(lootInp);
    row2.appendChild(lootGroup);

    // ── Row 3: count + level range + respawn ─────────────────────────────────
    const row3 = document.createElement("div");
    row3.className = "spawn-creator__entry-row spawn-creator__entry-row--fields";
    card.appendChild(row3);

    row3.appendChild(this._makeNumberControl(`sc_cnt_${entry.id}`,   "Count",        entry.count,                1, 99,   1, v => this._sys.updateEntry(entry.id, { count: v })));
    row3.appendChild(this._makeNumberControl(`sc_lvmin_${entry.id}`, "Level Min",    entry.levelMin,             1, 100,  1, v => this._sys.updateEntry(entry.id, { levelMin: v })));
    row3.appendChild(this._makeNumberControl(`sc_lvmax_${entry.id}`, "Level Max",    entry.levelMax,             0, 100,  1, v => this._sys.updateEntry(entry.id, { levelMax: v })));
    row3.appendChild(this._makeNumberControl(`sc_rsp_${entry.id}`,   "Respawn (h)",  entry.respawnIntervalHours, 0, 9999, 1, v => this._sys.updateEntry(entry.id, { respawnIntervalHours: v })));

    // ── Validation hints ───────────────────────────────────────────────────
    if (hints.length > 0) {
      const hintBox = document.createElement("div");
      hintBox.className = "spawn-creator__hint-box";
      for (const h of hints) {
        const p = document.createElement("p");
        p.className   = "spawn-creator__hint";
        p.textContent = `⚠ ${h}`;
        hintBox.appendChild(p);
      }
      card.appendChild(hintBox);
    }

    return card;
  }

  private _makeNumberControl(
    id: string,
    label: string,
    value: number,
    min: number,
    max: number,
    step: number,
    onChange: (v: number) => void,
  ): HTMLElement {
    const group = document.createElement("div");
    group.className = "spawn-creator__control-group";

    const lbl = document.createElement("label");
    lbl.className   = "spawn-creator__label spawn-creator__label--sm";
    lbl.textContent = label;
    lbl.htmlFor     = id;
    group.appendChild(lbl);

    const inp = document.createElement("input");
    inp.id        = id;
    inp.type      = "number";
    inp.className = "spawn-creator__input spawn-creator__input--sm";
    inp.value     = String(value);
    inp.min       = String(min);
    inp.max       = String(max);
    inp.step      = String(step);
    inp.addEventListener("input", () => {
      const n = parseFloat(inp.value);
      if (!isNaN(n)) onChange(n);
    });
    group.appendChild(inp);
    return group;
  }

  // ── Footer ─────────────────────────────────────────────────────────────────

  private _buildFooter(): HTMLElement {
    const footer = document.createElement("div");
    footer.className = "spawn-creator__footer";

    const status = document.createElement("p");
    status.className = "spawn-creator__status";
    this._statusEl   = status;
    footer.appendChild(status);

    const actions = document.createElement("div");
    actions.className = "spawn-creator__actions";
    footer.appendChild(actions);

    const makeBtn = (label: string, cls: string, cb: () => void): HTMLButtonElement => {
      const btn = document.createElement("button");
      btn.className   = `spawn-creator__btn ${cls}`;
      btn.textContent = label;
      btn.addEventListener("click", cb);
      return btn;
    };

    actions.appendChild(makeBtn("Validate",     "",                        () => this._handleValidate()));
    actions.appendChild(makeBtn("Export JSON ↓", "spawn-creator__btn--primary", () => this._handleExport()));
    actions.appendChild(makeBtn("Import JSON ↑", "",                        () => this._handleImport()));
    actions.appendChild(makeBtn("Reset",         "spawn-creator__btn--danger",  () => this._handleReset()));

    return footer;
  }

  // ── Action handlers ────────────────────────────────────────────────────────

  private _handleValidate(): void {
    const report = this._sys.validate();
    this._renderEntryList(); // Refresh hints
    if (report.valid) {
      this._setStatus("✔ Validation passed — spawn group is valid.", "ok");
    } else {
      const details = report.issues.map(i => `• [${i.type}] ${i.detail}`).join("\n");
      this._setStatus(`✖ Validation failed (${report.issues.length} issue(s)):\n${details}`, "error");
    }
  }

  private _handleExport(): void {
    this._sys.exportToFile();
    this._setStatus("Spawn group exported as JSON file.", "ok");
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
        this._setStatus(`Imported spawn group "${this._sys.draft.id}" successfully.`, "ok");
      } else {
        this._setStatus("Import failed — invalid spawn group JSON file.", "error");
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

  private _syncFromDraft(): void {
    const d = this._sys.draft;
    if (this._idInp)   this._idInp.value   = d.id;
    if (this._nameInp) this._nameInp.value = d.name;
    if (this._descInp) this._descInp.value = d.description;
    this._renderEntryList();
  }

  private _setStatus(message: string, type: "ok" | "error" | ""): void {
    if (!this._statusEl) return;
    this._statusEl.textContent = message;
    this._statusEl.className   =
      `spawn-creator__status${type ? ` spawn-creator__status--${type}` : ""}`;
  }
}
