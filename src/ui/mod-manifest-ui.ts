import type { ModManifestSystem, ModManifestEntryDraft } from "../systems/mod-manifest-system";

/**
 * HTML-based Mod Manifest Editor overlay (Content GUI Release I).
 *
 * Single-section layout:
 *   • Entry list — ordered mod entries with id, url, enabled toggle, up/down reorder, remove
 *   • Validation feedback
 *
 * Actions: Validate, Export JSON ↓, Import JSON ↑, Reset, Close.
 *
 * Keyboard shortcut: Ctrl+Shift+M (wired in game.ts).
 *
 * Usage:
 *   const ui = new ModManifestUI(modManifestSystem);
 *   ui.open();   // shows the overlay
 *   ui.close();  // hides and calls onClose
 */
export class ModManifestUI {
  /** Called when the user closes the panel. */
  public onClose: (() => void) | null = null;

  private readonly _sys: ModManifestSystem;
  private _root: HTMLElement | null = null;
  private _statusEl: HTMLElement | null = null;
  private _entryListEl: HTMLElement | null = null;

  constructor(system: ModManifestSystem) {
    this._sys = system;
  }

  get isVisible(): boolean {
    return this._root !== null && !this._root.hidden;
  }

  /** Build and show the Mod Manifest panel. */
  open(): void {
    if (this._root) {
      this._root.hidden = false;
      this._renderEntryList();
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
    root.className = "mod-manifest";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Mod Manifest Editor");
    this._root = root;

    const panel = document.createElement("section");
    panel.className = "mod-manifest__panel";
    root.appendChild(panel);

    // Header
    const header = document.createElement("div");
    header.className = "mod-manifest__header";

    const title = document.createElement("h2");
    title.className   = "mod-manifest__title";
    title.textContent = "Mod Manifest Editor";
    header.appendChild(title);

    const closeBtn = document.createElement("button");
    closeBtn.className   = "mod-manifest__close-btn";
    closeBtn.textContent = "✕";
    closeBtn.setAttribute("aria-label", "Close mod manifest editor");
    closeBtn.addEventListener("click", () => this.close());
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Body
    const body = document.createElement("div");
    body.className = "mod-manifest__body";
    body.appendChild(this._buildEntrySection());
    panel.appendChild(body);

    // Status bar
    const status = document.createElement("div");
    status.className = "mod-manifest__status";
    status.setAttribute("aria-live", "polite");
    this._statusEl = status;
    panel.appendChild(status);

    // Footer actions
    panel.appendChild(this._buildFooter());

    document.body.appendChild(root);
    this._renderEntryList();
  }

  // ── Entry section ──────────────────────────────────────────────────────────

  private _buildEntrySection(): HTMLElement {
    const section = document.createElement("div");
    section.className = "mod-manifest__section";

    const listHeader = document.createElement("div");
    listHeader.className = "mod-manifest__list-header";

    const h3 = document.createElement("h3");
    h3.className   = "mod-manifest__section-title";
    h3.textContent = "Mod Load Order";
    listHeader.appendChild(h3);

    const addBtn = document.createElement("button");
    addBtn.className   = "mod-manifest__btn mod-manifest__btn--sm";
    addBtn.textContent = "+ Add Mod";
    addBtn.addEventListener("click", () => {
      this._sys.addEntry();
      this._renderEntryList();
    });
    listHeader.appendChild(addBtn);
    section.appendChild(listHeader);

    const hint = document.createElement("p");
    hint.className   = "mod-manifest__hint";
    hint.textContent = "Mods load in order from top to bottom. Only enabled mods are loaded.";
    section.appendChild(hint);

    const list = document.createElement("div");
    list.className    = "mod-manifest__entry-list";
    list.setAttribute("aria-label", "Mod entries");
    this._entryListEl = list;
    section.appendChild(list);

    return section;
  }

  // ── Entry list rendering ───────────────────────────────────────────────────

  private _renderEntryList(): void {
    if (!this._entryListEl) return;
    this._entryListEl.innerHTML = "";

    const entries = this._sys.entries;
    if (entries.length === 0) {
      const empty = document.createElement("p");
      empty.className   = "mod-manifest__empty";
      empty.textContent = 'No mods added yet. Click "+ Add Mod" to begin.';
      this._entryListEl.appendChild(empty);
      return;
    }

    for (let i = 0; i < entries.length; i++) {
      this._entryListEl.appendChild(this._buildEntryRow(entries[i], i, entries.length));
    }
  }

  private _buildEntryRow(entry: ModManifestEntryDraft, index: number, total: number): HTMLElement {
    const row = document.createElement("div");
    row.className = "mod-manifest__entry";
    row.setAttribute("data-entry-id", entry.id);

    // Index badge
    const badge = document.createElement("span");
    badge.className   = "mod-manifest__entry-badge";
    badge.textContent = String(index + 1);
    row.appendChild(badge);

    // Fields
    const fields = document.createElement("div");
    fields.className = "mod-manifest__entry-fields";

    // ID field (read-only — id is auto-generated on addEntry or set via importFromJson)
    const idWrap = document.createElement("div");
    idWrap.className = "mod-manifest__field";
    const idLabel = document.createElement("label");
    idLabel.textContent = "Mod ID";
    const idInp = document.createElement("input");
    idInp.type        = "text";
    idInp.value       = entry.id;
    idInp.readOnly    = true;
    idInp.setAttribute("aria-label", `Mod ID for entry ${index + 1} (read-only)`);
    idInp.title       = "ID is set when the entry is created or imported. Use Import JSON to load entries with specific IDs.";
    idLabel.appendChild(idInp);
    idWrap.appendChild(idLabel);
    fields.appendChild(idWrap);

    // URL field
    const urlWrap = document.createElement("div");
    urlWrap.className = "mod-manifest__field mod-manifest__field--url";
    const urlLabel = document.createElement("label");
    urlLabel.textContent = "URL / Path";
    const urlInp = document.createElement("input");
    urlInp.type        = "text";
    urlInp.value       = entry.url;
    urlInp.placeholder = "e.g. ./mods/my-mod.mod.json";
    urlInp.setAttribute("data-field", "url");
    urlInp.setAttribute("aria-label", `URL for entry ${index + 1}`);
    urlInp.addEventListener("input", () => {
      this._sys.updateEntry(entry.id, { url: urlInp.value });
    });
    urlLabel.appendChild(urlInp);
    urlWrap.appendChild(urlLabel);
    fields.appendChild(urlWrap);

    row.appendChild(fields);

    // Controls
    const controls = document.createElement("div");
    controls.className = "mod-manifest__entry-controls";

    // Enabled toggle
    const enabledWrap = document.createElement("label");
    enabledWrap.className = "mod-manifest__entry-enabled";
    const enabledChk = document.createElement("input");
    enabledChk.type    = "checkbox";
    enabledChk.checked = entry.enabled;
    enabledChk.setAttribute("aria-label", `Enable mod ${index + 1}`);
    enabledChk.addEventListener("change", () => {
      if (enabledChk.checked) {
        this._sys.enableEntry(entry.id);
      } else {
        this._sys.disableEntry(entry.id);
      }
    });
    enabledWrap.appendChild(enabledChk);
    const enabledText = document.createElement("span");
    enabledText.textContent = "Enabled";
    enabledWrap.appendChild(enabledText);
    controls.appendChild(enabledWrap);

    // Up button
    const upBtn = document.createElement("button");
    upBtn.className   = "mod-manifest__btn mod-manifest__btn--icon";
    upBtn.textContent = "▲";
    upBtn.disabled    = index === 0;
    upBtn.setAttribute("aria-label", `Move mod ${index + 1} up`);
    upBtn.addEventListener("click", () => {
      this._sys.moveEntryUp(entry.id);
      this._renderEntryList();
    });
    controls.appendChild(upBtn);

    // Down button
    const downBtn = document.createElement("button");
    downBtn.className   = "mod-manifest__btn mod-manifest__btn--icon";
    downBtn.textContent = "▼";
    downBtn.disabled    = index === total - 1;
    downBtn.setAttribute("aria-label", `Move mod ${index + 1} down`);
    downBtn.addEventListener("click", () => {
      this._sys.moveEntryDown(entry.id);
      this._renderEntryList();
    });
    controls.appendChild(downBtn);

    // Remove button
    const removeBtn = document.createElement("button");
    removeBtn.className   = "mod-manifest__btn mod-manifest__btn--danger";
    removeBtn.textContent = "✕";
    removeBtn.setAttribute("aria-label", `Remove mod ${index + 1}`);
    removeBtn.addEventListener("click", () => {
      this._sys.removeEntry(entry.id);
      this._renderEntryList();
    });
    controls.appendChild(removeBtn);

    row.appendChild(controls);
    return row;
  }

  // ── Footer actions ─────────────────────────────────────────────────────────

  private _buildFooter(): HTMLElement {
    const footer = document.createElement("div");
    footer.className = "mod-manifest__footer";

    const validateBtn = document.createElement("button");
    validateBtn.className   = "mod-manifest__btn mod-manifest__btn--primary";
    validateBtn.textContent = "✓ Validate";
    validateBtn.addEventListener("click", () => this._doValidate());
    footer.appendChild(validateBtn);

    const exportBtn = document.createElement("button");
    exportBtn.className   = "mod-manifest__btn";
    exportBtn.textContent = "⬇ Export JSON";
    exportBtn.addEventListener("click", () => {
      const report = this._sys.validate();
      if (!report.valid) {
        this._setStatus(`⚠ ${report.issues.length} issue(s) found — fix before exporting.`, "warn");
        return;
      }
      this._sys.exportToFile();
      this._setStatus("✓ manifest.json downloaded.", "ok");
    });
    footer.appendChild(exportBtn);

    const importBtn = document.createElement("button");
    importBtn.className   = "mod-manifest__btn";
    importBtn.textContent = "⬆ Import JSON";
    importBtn.addEventListener("click", () => {
      const inp = document.createElement("input");
      inp.type   = "file";
      inp.accept = ".json";
      inp.addEventListener("change", async () => {
        const file = inp.files?.[0];
        if (!file) return;
        const ok = await this._sys.importFromFile(file);
        if (ok) {
          this._renderEntryList();
          this._setStatus("✓ Manifest imported.", "ok");
        } else {
          this._setStatus("✗ Failed to import — invalid JSON.", "error");
        }
      });
      inp.click();
    });
    footer.appendChild(importBtn);

    const resetBtn = document.createElement("button");
    resetBtn.className   = "mod-manifest__btn mod-manifest__btn--danger";
    resetBtn.textContent = "↺ Reset";
    resetBtn.addEventListener("click", () => {
      this._sys.reset();
      this._renderEntryList();
      this._setStatus("Manifest reset.", "ok");
    });
    footer.appendChild(resetBtn);

    return footer;
  }

  // ── Validation feedback ────────────────────────────────────────────────────

  private _doValidate(): void {
    const report = this._sys.validate();
    if (report.valid) {
      this._setStatus(`✓ Valid — ${this._sys.entryCount} mod(s) in manifest.`, "ok");
    } else {
      const msgs = report.issues.map(i => `• ${i.detail}`).join("\n");
      this._setStatus(`✗ ${report.issues.length} issue(s):\n${msgs}`, "error");
    }
  }

  private _setStatus(msg: string, level: "ok" | "warn" | "error"): void {
    if (!this._statusEl) return;
    this._statusEl.textContent = msg;
    this._statusEl.className = `mod-manifest__status mod-manifest__status--${level}`;
  }
}
