import type {
  LootTableCreatorSystem,
  LootEntryDraft,
} from "../systems/loot-table-creator-system";

/**
 * HTML-based Loot Table Creator overlay.
 *
 * Two-section layout:
 *   1. Table metadata  — id, rolls, unique flag, noneWeight
 *   2. Entry list      — CRUD for loot entries (itemId/itemName, weight, quantity,
 *                        guarantee, sub-table chain, level conditions)
 *
 * Actions: Validate, Export JSON ↓, Import JSON ↑, Reset, Close.
 *
 * Usage:
 *   const ui = new LootTableCreatorUI(lootTableCreatorSystem);
 *   ui.open();   // shows the overlay
 *   ui.close();  // hides and calls onClose
 */
export class LootTableCreatorUI {
  /** Called when the user closes the panel. */
  public onClose: (() => void) | null = null;

  private readonly _sys: LootTableCreatorSystem;
  private _root: HTMLElement | null = null;
  private _statusEl: HTMLElement | null = null;
  private _entryListEl: HTMLElement | null = null;

  // Metadata inputs
  private _idInp!: HTMLInputElement;
  private _rollsInp!: HTMLInputElement;
  private _uniqueChk!: HTMLInputElement;
  private _noneWeightInp!: HTMLInputElement;

  constructor(system: LootTableCreatorSystem) {
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
    root.className = "loot-table-creator";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Loot Table Creator");
    this._root = root;

    const panel = document.createElement("section");
    panel.className = "loot-table-creator__panel";
    root.appendChild(panel);

    // Header
    const header = document.createElement("div");
    header.className = "loot-table-creator__header";
    const title = document.createElement("h2");
    title.className   = "loot-table-creator__title";
    title.textContent = "Loot Table Creator";
    header.appendChild(title);
    const closeBtn = document.createElement("button");
    closeBtn.className   = "loot-table-creator__close-btn";
    closeBtn.textContent = "✕";
    closeBtn.setAttribute("aria-label", "Close loot table creator");
    closeBtn.addEventListener("click", () => this.close());
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Body — two-column
    const body = document.createElement("div");
    body.className = "loot-table-creator__body";
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
    const sec = document.createElement("div");
    sec.className = "loot-table-creator__section";

    const h3 = document.createElement("h3");
    h3.className   = "loot-table-creator__section-title";
    h3.textContent = "Table Settings";
    sec.appendChild(h3);

    this._idInp = this._addField(sec, "Table ID", "text", "e.g. bandit_loot");

    const rollsRow = document.createElement("div");
    rollsRow.className = "loot-table-creator__field";
    sec.appendChild(rollsRow);
    const rollsLbl = document.createElement("label");
    rollsLbl.className   = "loot-table-creator__label";
    rollsLbl.textContent = "Rolls per open";
    rollsRow.appendChild(rollsLbl);
    this._rollsInp = document.createElement("input");
    this._rollsInp.type        = "number";
    this._rollsInp.id          = "ltc_rolls";
    rollsLbl.htmlFor = "ltc_rolls";
    this._rollsInp.className   = "loot-table-creator__input";
    this._rollsInp.min         = "1";
    this._rollsInp.max         = "20";
    this._rollsInp.step        = "1";
    this._rollsInp.placeholder = "1";
    rollsRow.appendChild(this._rollsInp);

    const noneRow = document.createElement("div");
    noneRow.className = "loot-table-creator__field";
    sec.appendChild(noneRow);
    const noneLbl = document.createElement("label");
    noneLbl.className   = "loot-table-creator__label";
    noneLbl.textContent = "Empty-roll weight";
    noneLbl.title       = "Relative chance of producing nothing per roll.";
    noneRow.appendChild(noneLbl);
    this._noneWeightInp = document.createElement("input");
    this._noneWeightInp.type        = "number";
    this._noneWeightInp.id          = "ltc_none";
    noneLbl.htmlFor = "ltc_none";
    this._noneWeightInp.className   = "loot-table-creator__input";
    this._noneWeightInp.min         = "0";
    this._noneWeightInp.step        = "1";
    this._noneWeightInp.placeholder = "0";
    noneRow.appendChild(this._noneWeightInp);

    const uniqueRow = document.createElement("div");
    uniqueRow.className = "loot-table-creator__field loot-table-creator__field--check";
    sec.appendChild(uniqueRow);
    this._uniqueChk = document.createElement("input");
    this._uniqueChk.type = "checkbox";
    this._uniqueChk.id   = "ltc_unique";
    const uniqueLbl = document.createElement("label");
    uniqueLbl.htmlFor     = "ltc_unique";
    uniqueLbl.className   = "loot-table-creator__label";
    uniqueLbl.textContent = "Unique rolls (no duplicates)";
    uniqueRow.appendChild(this._uniqueChk);
    uniqueRow.appendChild(uniqueLbl);

    const syncMeta = () => {
      this._sys.setMeta({
        id:         this._idInp?.value       ?? "",
        rolls:      parseInt(this._rollsInp?.value       ?? "1", 10)  || 1,
        unique:     this._uniqueChk?.checked ?? false,
        noneWeight: parseInt(this._noneWeightInp?.value  ?? "0", 10)  || 0,
      });
    };
    for (const el of [this._idInp, this._rollsInp, this._noneWeightInp]) {
      el.addEventListener("input", syncMeta);
    }
    this._uniqueChk.addEventListener("change", syncMeta);

    return sec;
  }

  // ── Entries section ────────────────────────────────────────────────────────

  private _buildEntriesSection(): HTMLElement {
    const sec = document.createElement("div");
    sec.className = "loot-table-creator__section loot-table-creator__section--entries";

    const sectionHeader = document.createElement("div");
    sectionHeader.className = "loot-table-creator__section-header";

    const h3 = document.createElement("h3");
    h3.className   = "loot-table-creator__section-title";
    h3.textContent = "Loot Entries";
    sectionHeader.appendChild(h3);

    const addBtn = document.createElement("button");
    addBtn.className   = "loot-table-creator__btn loot-table-creator__btn--sm";
    addBtn.textContent = "+ Add Entry";
    addBtn.addEventListener("click", () => {
      this._sys.addEntry();
      this._renderEntryList();
    });
    sectionHeader.appendChild(addBtn);
    sec.appendChild(sectionHeader);

    const list = document.createElement("div");
    list.className     = "loot-table-creator__entry-list";
    this._entryListEl  = list;
    sec.appendChild(list);

    return sec;
  }

  private _renderEntryList(): void {
    if (!this._entryListEl) return;
    this._entryListEl.innerHTML = "";

    const entries = this._sys.entries;
    if (entries.length === 0) {
      const empty = document.createElement("p");
      empty.className   = "loot-table-creator__empty";
      empty.textContent = "No entries yet. Click \u201c+ Add Entry\u201d to begin.";
      this._entryListEl.appendChild(empty);
      return;
    }

    for (const entry of entries) {
      this._entryListEl.appendChild(this._buildEntryCard(entry));
    }
  }

  private _buildEntryCard(entry: LootEntryDraft): HTMLElement {
    const card = document.createElement("div");
    card.className      = "loot-table-creator__entry-card";
    card.dataset.entryKey = entry.entryKey;

    // ── Row 1: key label + reorder + remove ───────────────────────────────
    const row1 = document.createElement("div");
    row1.className = "loot-table-creator__entry-row";
    card.appendChild(row1);

    const keyLabel = document.createElement("span");
    keyLabel.className   = "loot-table-creator__entry-key";
    keyLabel.textContent = entry.entryKey;
    row1.appendChild(keyLabel);

    const upBtn = document.createElement("button");
    upBtn.className   = "loot-table-creator__btn loot-table-creator__btn--sm";
    upBtn.textContent = "↑";
    upBtn.title       = "Move up";
    upBtn.addEventListener("click", () => {
      this._sys.moveEntryUp(entry.entryKey);
      this._renderEntryList();
    });
    row1.appendChild(upBtn);

    const downBtn = document.createElement("button");
    downBtn.className   = "loot-table-creator__btn loot-table-creator__btn--sm";
    downBtn.textContent = "↓";
    downBtn.title       = "Move down";
    downBtn.addEventListener("click", () => {
      this._sys.moveEntryDown(entry.entryKey);
      this._renderEntryList();
    });
    row1.appendChild(downBtn);

    const removeBtn = document.createElement("button");
    removeBtn.className   = "loot-table-creator__btn loot-table-creator__btn--sm loot-table-creator__btn--danger";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => {
      this._sys.removeEntry(entry.entryKey);
      this._renderEntryList();
    });
    row1.appendChild(removeBtn);

    // ── Row 2: itemId, itemName, subTableId, weight ───────────────────────
    const row2 = document.createElement("div");
    row2.className = "loot-table-creator__entry-row loot-table-creator__entry-row--fields";
    card.appendChild(row2);

    const itemIdGrp = this._makeLabeledControl("Item ID", `ltce_iid_${entry.entryKey}`);
    const itemIdInp = document.createElement("input");
    itemIdInp.id          = `ltce_iid_${entry.entryKey}`;
    itemIdInp.type        = "text";
    itemIdInp.className   = "loot-table-creator__input loot-table-creator__input--sm";
    itemIdInp.placeholder = "e.g. iron_sword";
    itemIdInp.value       = entry.itemId;
    itemIdInp.addEventListener("input", () => {
      this._sys.updateEntry(entry.entryKey, { itemId: itemIdInp.value });
    });
    itemIdGrp.appendChild(itemIdInp);
    row2.appendChild(itemIdGrp);

    const itemNameGrp = this._makeLabeledControl("Item Name", `ltce_inm_${entry.entryKey}`);
    const itemNameInp = document.createElement("input");
    itemNameInp.id          = `ltce_inm_${entry.entryKey}`;
    itemNameInp.type        = "text";
    itemNameInp.className   = "loot-table-creator__input loot-table-creator__input--sm";
    itemNameInp.placeholder = "e.g. Iron Sword";
    itemNameInp.value       = entry.itemName;
    itemNameInp.addEventListener("input", () => {
      this._sys.updateEntry(entry.entryKey, { itemName: itemNameInp.value });
    });
    itemNameGrp.appendChild(itemNameInp);
    row2.appendChild(itemNameGrp);

    const subGrp = this._makeLabeledControl("Sub-table ID", `ltce_sub_${entry.entryKey}`);
    const subInp = document.createElement("input");
    subInp.id          = `ltce_sub_${entry.entryKey}`;
    subInp.type        = "text";
    subInp.className   = "loot-table-creator__input loot-table-creator__input--sm";
    subInp.placeholder = "e.g. treasure_chest";
    subInp.value       = entry.subTableId;
    subInp.title       = "Overrides item fields — rolls this table instead";
    subInp.addEventListener("input", () => {
      this._sys.updateEntry(entry.entryKey, { subTableId: subInp.value });
    });
    subGrp.appendChild(subInp);
    row2.appendChild(subGrp);

    const weightGrp = this._makeLabeledControl("Weight", `ltce_wt_${entry.entryKey}`);
    const weightInp = document.createElement("input");
    weightInp.id        = `ltce_wt_${entry.entryKey}`;
    weightInp.type      = "number";
    weightInp.className = "loot-table-creator__input loot-table-creator__input--sm";
    weightInp.min       = "0";
    weightInp.step      = "1";
    weightInp.value     = String(entry.weight);
    weightInp.title     = "Relative probability weight (0 = never rolled normally)";
    weightInp.addEventListener("input", () => {
      this._sys.updateEntry(entry.entryKey, { weight: parseInt(weightInp.value, 10) || 0 });
    });
    weightGrp.appendChild(weightInp);
    row2.appendChild(weightGrp);

    // ── Row 3: quantity range, guarantee, level conditions ────────────────
    const row3 = document.createElement("div");
    row3.className = "loot-table-creator__entry-row loot-table-creator__entry-row--fields";
    card.appendChild(row3);

    const minQtyGrp = this._makeLabeledControl("Min Qty", `ltce_mnq_${entry.entryKey}`);
    const minQtyInp = document.createElement("input");
    minQtyInp.id        = `ltce_mnq_${entry.entryKey}`;
    minQtyInp.type      = "number";
    minQtyInp.className = "loot-table-creator__input loot-table-creator__input--sm";
    minQtyInp.min       = "1";
    minQtyInp.step      = "1";
    minQtyInp.value     = String(entry.minQuantity);
    minQtyInp.addEventListener("input", () => {
      this._sys.updateEntry(entry.entryKey, { minQuantity: parseInt(minQtyInp.value, 10) || 1 });
      this._syncEntryQuantityDisplay(entry.entryKey, maxQtyInp);
    });
    minQtyGrp.appendChild(minQtyInp);
    row3.appendChild(minQtyGrp);

    const maxQtyGrp = this._makeLabeledControl("Max Qty", `ltce_mxq_${entry.entryKey}`);
    const maxQtyInp = document.createElement("input");
    maxQtyInp.id        = `ltce_mxq_${entry.entryKey}`;
    maxQtyInp.type      = "number";
    maxQtyInp.className = "loot-table-creator__input loot-table-creator__input--sm";
    maxQtyInp.min       = "1";
    maxQtyInp.step      = "1";
    maxQtyInp.value     = String(entry.maxQuantity);
    maxQtyInp.addEventListener("input", () => {
      this._sys.updateEntry(entry.entryKey, { maxQuantity: parseInt(maxQtyInp.value, 10) || 1 });
    });
    maxQtyGrp.appendChild(maxQtyInp);
    row3.appendChild(maxQtyGrp);

    const minLvlGrp = this._makeLabeledControl("Min Level", `ltce_mlv_${entry.entryKey}`);
    const minLvlInp = document.createElement("input");
    minLvlInp.id        = `ltce_mlv_${entry.entryKey}`;
    minLvlInp.type      = "number";
    minLvlInp.className = "loot-table-creator__input loot-table-creator__input--sm";
    minLvlInp.min       = "0";
    minLvlInp.step      = "1";
    minLvlInp.value     = String(entry.minLevel);
    minLvlInp.title     = "0 = no minimum level requirement";
    minLvlInp.addEventListener("input", () => {
      this._sys.updateEntry(entry.entryKey, { minLevel: parseInt(minLvlInp.value, 10) || 0 });
    });
    minLvlGrp.appendChild(minLvlInp);
    row3.appendChild(minLvlGrp);

    const maxLvlGrp = this._makeLabeledControl("Max Level", `ltce_xlv_${entry.entryKey}`);
    const maxLvlInp = document.createElement("input");
    maxLvlInp.id        = `ltce_xlv_${entry.entryKey}`;
    maxLvlInp.type      = "number";
    maxLvlInp.className = "loot-table-creator__input loot-table-creator__input--sm";
    maxLvlInp.min       = "0";
    maxLvlInp.step      = "1";
    maxLvlInp.value     = String(entry.maxLevel);
    maxLvlInp.title     = "0 = no maximum level restriction";
    maxLvlInp.addEventListener("input", () => {
      this._sys.updateEntry(entry.entryKey, { maxLevel: parseInt(maxLvlInp.value, 10) || 0 });
    });
    maxLvlGrp.appendChild(maxLvlInp);
    row3.appendChild(maxLvlGrp);

    const guarGrp = this._makeLabeledControl("Guaranteed drop", `ltce_gua_${entry.entryKey}`);
    const guarChk = document.createElement("input");
    guarChk.id      = `ltce_gua_${entry.entryKey}`;
    guarChk.type    = "checkbox";
    guarChk.checked = entry.guarantee;
    guarChk.addEventListener("change", () => {
      this._sys.updateEntry(entry.entryKey, { guarantee: guarChk.checked });
    });
    guarGrp.appendChild(guarChk);
    row3.appendChild(guarGrp);

    return card;
  }

  /** Sync maxQty input min-value after minQty changes. */
  private _syncEntryQuantityDisplay(entryKey: string, maxQtyInp: HTMLInputElement): void {
    const entry = this._sys.entries.find(e => e.entryKey === entryKey);
    if (!entry) return;
    maxQtyInp.min   = String(entry.minQuantity);
    if (parseInt(maxQtyInp.value, 10) < entry.minQuantity) {
      maxQtyInp.value = String(entry.minQuantity);
    }
  }

  // ── Footer ─────────────────────────────────────────────────────────────────

  private _buildFooter(): HTMLElement {
    const footer = document.createElement("div");
    footer.className = "loot-table-creator__footer";

    const status = document.createElement("p");
    status.className = "loot-table-creator__status";
    this._statusEl   = status;
    footer.appendChild(status);

    const actions = document.createElement("div");
    actions.className = "loot-table-creator__actions";
    footer.appendChild(actions);

    const validateBtn = this._makeBtn("Validate",      "loot-table-creator__btn",                              () => this._handleValidate());
    const exportBtn   = this._makeBtn("Export JSON ↓", "loot-table-creator__btn loot-table-creator__btn--primary", () => this._handleExport());
    const importBtn   = this._makeBtn("Import JSON ↑", "loot-table-creator__btn",                              () => this._handleImport());
    const resetBtn    = this._makeBtn("Reset",          "loot-table-creator__btn loot-table-creator__btn--danger",  () => this._handleReset());

    for (const btn of [validateBtn, exportBtn, importBtn, resetBtn]) {
      actions.appendChild(btn);
    }

    return footer;
  }

  // ── Action handlers ────────────────────────────────────────────────────────

  private _handleValidate(): void {
    const report = this._sys.validate();
    if (report.valid) {
      this._setStatus("✔ Validation passed — loot table definition is valid.", "ok");
    } else {
      const details = report.issues.map(i => `• ${i}`).join("\n");
      this._setStatus(`✖ Validation failed (${report.issues.length} issue(s)):\n${details}`, "error");
    }
  }

  private _handleExport(): void {
    this._sys.exportToFile();
    this._setStatus("Loot table definition exported as JSON file.", "ok");
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
        this._setStatus(`Imported loot table "${this._sys.draft.id}" successfully.`, "ok");
      } else {
        this._setStatus("Import failed — invalid loot table JSON file.", "error");
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
    if (this._idInp)         this._idInp.value          = d.id;
    if (this._rollsInp)      this._rollsInp.value        = String(d.rolls);
    if (this._uniqueChk)     this._uniqueChk.checked     = d.unique;
    if (this._noneWeightInp) this._noneWeightInp.value   = String(d.noneWeight);
    this._renderEntryList();
  }

  private _setStatus(message: string, type: "ok" | "error" | ""): void {
    if (!this._statusEl) return;
    this._statusEl.textContent = message;
    this._statusEl.className =
      `loot-table-creator__status${type ? ` loot-table-creator__status--${type}` : ""}`;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private _addField(
    container: HTMLElement,
    label: string,
    type: string,
    placeholder: string,
  ): HTMLInputElement {
    const row = document.createElement("div");
    row.className = "loot-table-creator__field";
    container.appendChild(row);

    const lbl = document.createElement("label");
    lbl.className   = "loot-table-creator__label";
    lbl.textContent = label;
    row.appendChild(lbl);

    const inp = document.createElement("input");
    inp.type        = type;
    inp.className   = "loot-table-creator__input";
    inp.placeholder = placeholder;
    row.appendChild(inp);

    lbl.htmlFor = inp.id = `ltc_${label.replace(/\s+/g, "_").toLowerCase()}`;
    return inp;
  }

  private _makeLabeledControl(labelText: string, inputId: string): HTMLElement {
    const group = document.createElement("div");
    group.className = "loot-table-creator__control-group";
    const lbl = document.createElement("label");
    lbl.htmlFor     = inputId;
    lbl.className   = "loot-table-creator__label loot-table-creator__label--sm";
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
