import type { ItemCreatorSystem, ItemCreatorDraft } from "../systems/item-creator-system";
import { EQUIP_SLOTS, ITEM_TAGS } from "../systems/item-creator-system";

/**
 * HTML-based Item Creator overlay.
 *
 * Two-column layout:
 *   1. Core      — id, name, description, slot, stackable, maxStack
 *   2. Tags      — quick-add tag chips + custom tag input
 *
 * Actions: Validate, Export JSON ↓, Import JSON ↑, Reset, Close.
 */
export class ItemCreatorUI {
  public onClose: (() => void) | null = null;

  private readonly _sys: ItemCreatorSystem;
  private _root: HTMLElement | null = null;
  private _statusEl: HTMLElement | null = null;
  private _tagListEl: HTMLElement | null = null;

  // Core inputs
  private _idInp!: HTMLInputElement;
  private _nameInp!: HTMLInputElement;
  private _descInp!: HTMLInputElement;
  private _slotSel!: HTMLSelectElement;
  private _stackChk!: HTMLInputElement;
  private _maxStackInp!: HTMLInputElement;

  constructor(system: ItemCreatorSystem) {
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
    root.className = "item-creator";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Item Creator");
    this._root = root;

    const panel = document.createElement("section");
    panel.className = "item-creator__panel";
    root.appendChild(panel);

    // Header
    const header = document.createElement("div");
    header.className = "item-creator__header";
    const title = document.createElement("h2");
    title.className   = "item-creator__title";
    title.textContent = "Item Creator";
    header.appendChild(title);
    const closeBtn = document.createElement("button");
    closeBtn.className = "item-creator__close-btn";
    closeBtn.textContent = "✕";
    closeBtn.setAttribute("aria-label", "Close item creator");
    closeBtn.addEventListener("click", () => this.close());
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Body
    const body = document.createElement("div");
    body.className = "item-creator__body";
    body.appendChild(this._buildCoreSection());
    body.appendChild(this._buildTagSection());
    panel.appendChild(body);

    // Preview
    panel.appendChild(this._buildPreviewSection());

    // Footer
    panel.appendChild(this._buildFooter());

    document.body.appendChild(root);
    this._syncFromDraft();
  }

  // ── Core section ───────────────────────────────────────────────────────────

  private _buildCoreSection(): HTMLElement {
    const sec = this._makeSection("Item Definition");

    this._idInp   = this._addField(sec, "Item ID",      "text",   "e.g. item_iron_sword");
    this._nameInp = this._addField(sec, "Display Name", "text",   "e.g. Iron Sword");
    this._descInp = this._addField(sec, "Description",  "text",   "A sturdy iron sword.");

    // Equip slot
    const slotWrap = document.createElement("div");
    slotWrap.className = "item-creator__field";
    const slotLbl = document.createElement("label");
    slotLbl.className   = "item-creator__label";
    slotLbl.textContent = "Equip Slot";
    this._slotSel = document.createElement("select");
    this._slotSel.className = "item-creator__select";
    for (const s of EQUIP_SLOTS) {
      const opt = document.createElement("option");
      opt.value       = s;
      opt.textContent = s === "" ? "— (not equippable) —" : s;
      this._slotSel.appendChild(opt);
    }
    slotLbl.htmlFor = this._slotSel.id = "itmc_slot";
    this._slotSel.addEventListener("change", () => {
      this._sys.setMeta({ slot: this._slotSel.value as ItemCreatorDraft["slot"] });
    });
    slotWrap.appendChild(slotLbl);
    slotWrap.appendChild(this._slotSel);
    sec.appendChild(slotWrap);

    // Stackable
    const stackRow = document.createElement("div");
    stackRow.className = "item-creator__field item-creator__field--inline";
    this._stackChk = document.createElement("input");
    this._stackChk.type      = "checkbox";
    this._stackChk.id        = "itmc_stackable";
    this._stackChk.className = "item-creator__checkbox";
    const stackLbl = document.createElement("label");
    stackLbl.htmlFor     = "itmc_stackable";
    stackLbl.className   = "item-creator__label";
    stackLbl.textContent = "Stackable";
    stackRow.appendChild(this._stackChk);
    stackRow.appendChild(stackLbl);
    sec.appendChild(stackRow);

    this._maxStackInp = this._addField(sec, "Max Stack", "number", "99");
    this._maxStackInp.min  = "2";
    this._maxStackInp.step = "1";

    // Sync
    const syncCore = () => this._sys.setMeta({
      id:          this._idInp.value,
      name:        this._nameInp.value,
      description: this._descInp.value,
      stackable:   this._stackChk.checked,
      maxStack:    parseInt(this._maxStackInp.value, 10) || 1,
    });
    for (const el of [this._idInp, this._nameInp, this._descInp, this._maxStackInp]) {
      el.addEventListener("input", syncCore);
    }
    this._stackChk.addEventListener("change", syncCore);

    return sec;
  }

  // ── Tag section ────────────────────────────────────────────────────────────

  private _buildTagSection(): HTMLElement {
    const sec = this._makeSection("Tags");

    // Quick-add preset chips
    const chipWrap = document.createElement("div");
    chipWrap.className = "item-creator__chip-grid";

    for (const tag of ITEM_TAGS) {
      const chip = document.createElement("button");
      chip.className   = "item-creator__chip";
      chip.textContent = tag;
      chip.dataset.tag = tag;
      chip.addEventListener("click", () => {
        this._sys.addTag(tag);
        this._renderTags();
      });
      chipWrap.appendChild(chip);
    }
    sec.appendChild(chipWrap);

    // Custom tag input
    const customRow = document.createElement("div");
    customRow.className = "item-creator__add-kv-row";
    const customInp = document.createElement("input");
    customInp.type        = "text";
    customInp.className   = "item-creator__input item-creator__input--sm";
    customInp.placeholder = "Custom tag…";
    const addBtn = document.createElement("button");
    addBtn.className   = "item-creator__btn item-creator__btn--sm";
    addBtn.textContent = "Add Tag";
    addBtn.addEventListener("click", () => {
      this._sys.addTag(customInp.value);
      customInp.value = "";
      this._renderTags();
    });
    customInp.addEventListener("keydown", (e) => { if (e.key === "Enter") addBtn.click(); });
    customRow.appendChild(customInp);
    customRow.appendChild(addBtn);
    sec.appendChild(customRow);

    // Tag list
    const tagList = document.createElement("div");
    tagList.className = "item-creator__tag-list";
    this._tagListEl = tagList;
    sec.appendChild(tagList);

    return sec;
  }

  private _renderTags(): void {
    if (!this._tagListEl) return;
    this._tagListEl.innerHTML = "";
    const tags = this._sys.draft.tags;
    if (tags.length === 0) {
      const empty = document.createElement("p");
      empty.className   = "item-creator__empty";
      empty.textContent = "No tags assigned.";
      this._tagListEl.appendChild(empty);
      return;
    }
    for (const tag of tags) {
      const pill = document.createElement("span");
      pill.className = "item-creator__tag-pill";
      pill.textContent = tag;
      const rm = document.createElement("button");
      rm.className   = "item-creator__tag-rm";
      rm.textContent = "✕";
      rm.addEventListener("click", () => {
        this._sys.removeTag(tag);
        this._renderTags();
      });
      pill.appendChild(rm);
      this._tagListEl.appendChild(pill);
    }
  }

  // ── Preview section ────────────────────────────────────────────────────────

  private _buildPreviewSection(): HTMLElement {
    const preview = document.createElement("div");
    preview.className = "item-creator__preview";
    const lbl = document.createElement("p");
    lbl.className   = "item-creator__section-title";
    lbl.textContent = "JSON Preview";
    preview.appendChild(lbl);
    const pre = document.createElement("pre");
    pre.className = "item-creator__json-preview";
    preview.appendChild(pre);

    // Update preview whenever inputs change
    const update = () => {
      pre.textContent = this._sys.exportToJson();
    };
    // Poll via MutationObserver is heavy — use a simple interval while open
    const interval = setInterval(update, 800);
    preview.addEventListener("remove", () => clearInterval(interval));
    update();
    return preview;
  }

  // ── Footer ─────────────────────────────────────────────────────────────────

  private _buildFooter(): HTMLElement {
    const footer = document.createElement("div");
    footer.className = "item-creator__footer";

    const status = document.createElement("p");
    status.className = "item-creator__status";
    this._statusEl = status;
    footer.appendChild(status);

    const actions = document.createElement("div");
    actions.className = "item-creator__actions";

    actions.appendChild(this._makeBtn("Validate",      "item-creator__btn",                           () => this._handleValidate()));
    actions.appendChild(this._makeBtn("Export JSON ↓", "item-creator__btn item-creator__btn--primary", () => this._handleExport()));
    actions.appendChild(this._makeBtn("Import JSON ↑", "item-creator__btn",                           () => this._handleImport()));
    actions.appendChild(this._makeBtn("Reset",         "item-creator__btn item-creator__btn--danger",  () => this._handleReset()));

    footer.appendChild(actions);
    return footer;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private _makeSection(title: string): HTMLElement {
    const sec = document.createElement("div");
    sec.className = "item-creator__section";
    const h3 = document.createElement("h3");
    h3.className   = "item-creator__section-title";
    h3.textContent = title;
    sec.appendChild(h3);
    return sec;
  }

  private _addField(container: HTMLElement, label: string, type: string, placeholder: string): HTMLInputElement {
    const wrap = document.createElement("div");
    wrap.className = "item-creator__field";
    const lbl = document.createElement("label");
    lbl.className   = "item-creator__label";
    lbl.textContent = label;
    const inp = document.createElement("input");
    inp.type        = type;
    inp.className   = "item-creator__input";
    inp.placeholder = placeholder;
    if (type === "number") { inp.min = "0"; inp.step = "1"; }
    lbl.htmlFor = inp.id = `itmc_${label.replace(/\s+/g, "_").toLowerCase()}`;
    wrap.appendChild(lbl);
    wrap.appendChild(inp);
    container.appendChild(wrap);
    return inp;
  }

  private _makeBtn(label: string, cls: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.className   = cls;
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    return btn;
  }

  // ── Action handlers ────────────────────────────────────────────────────────

  private _handleValidate(): void {
    const report = this._sys.validate();
    if (report.valid) {
      this._setStatus("✔ Validation passed — item definition is valid.", "ok");
    } else {
      this._setStatus(`✖ ${report.issues.join(" | ")}`, "error");
    }
  }

  private _handleExport(): void {
    this._sys.exportToFile();
    this._setStatus("Item exported as JSON file.", "ok");
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
        this._setStatus(`Imported item "${this._sys.draft.name}" successfully.`, "ok");
      } else {
        this._setStatus("Import failed — invalid item JSON file.", "error");
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

  // ── Sync ───────────────────────────────────────────────────────────────────

  private _syncFromDraft(): void {
    const d = this._sys.draft;
    this._idInp.value        = d.id;
    this._nameInp.value      = d.name;
    this._descInp.value      = d.description;
    this._slotSel.value      = d.slot;
    this._stackChk.checked   = d.stackable;
    this._maxStackInp.value  = String(d.maxStack);
    this._renderTags();
  }

  private _setStatus(message: string, type: "ok" | "error" | ""): void {
    if (!this._statusEl) return;
    this._statusEl.textContent = message;
    this._statusEl.className = `item-creator__status${type ? ` item-creator__status--${type}` : ""}`;
  }
}
