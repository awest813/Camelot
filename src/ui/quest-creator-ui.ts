import type { QuestCreatorSystem, QuestCreatorNodeDraft } from "../systems/quest-creator-system";
import type { QuestTriggerType } from "../framework/quests/quest-types";

const TRIGGER_TYPES: QuestTriggerType[] = ["kill", "pickup", "talk", "custom"];

/**
 * HTML-based Quest Creator overlay.
 *
 * Provides a two-section panel:
 *  1. Quest metadata  (id, name, description, XP reward)
 *  2. Node list       (add / edit / remove nodes with prerequisites)
 *
 * Actions: Validate, Export JSON (download), Import JSON (file-pick), Reset, Close.
 *
 * Usage:
 *   const ui = new QuestCreatorUI(questCreatorSystem);
 *   ui.open();   // shows the overlay
 *   ui.close();  // hides and calls onClose
 */
export class QuestCreatorUI {
  /** Called when the user closes the panel. */
  public onClose: (() => void) | null = null;

  private readonly _system: QuestCreatorSystem;
  private _root: HTMLElement | null = null;
  private _statusEl: HTMLElement | null = null;
  private _nodeListEl: HTMLElement | null = null;

  // Meta inputs
  private _metaId: HTMLInputElement | null = null;
  private _metaName: HTMLInputElement | null = null;
  private _metaDesc: HTMLInputElement | null = null;
  private _metaXp: HTMLInputElement | null = null;

  constructor(system: QuestCreatorSystem) {
    this._system = system;
  }

  get isVisible(): boolean {
    return this._root !== null && !this._root.hidden;
  }

  /** Build and show the Quest Creator panel. */
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
    root.className = "quest-creator";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Quest Creator");
    this._root = root;

    const panel = document.createElement("section");
    panel.className = "quest-creator__panel";
    root.appendChild(panel);

    // ── Header ────────────────────────────────────────────────────────────────
    const header = document.createElement("div");
    header.className = "quest-creator__header";
    panel.appendChild(header);

    const title = document.createElement("h2");
    title.className = "quest-creator__title";
    title.textContent = "Quest Creator";
    header.appendChild(title);

    const closeBtn = document.createElement("button");
    closeBtn.className = "quest-creator__close-btn";
    closeBtn.textContent = "✕";
    closeBtn.setAttribute("aria-label", "Close quest creator");
    closeBtn.addEventListener("click", () => this.close());
    header.appendChild(closeBtn);

    // ── Two-column body ───────────────────────────────────────────────────────
    const body = document.createElement("div");
    body.className = "quest-creator__body";
    panel.appendChild(body);

    // Left: metadata
    body.appendChild(this._buildMetaSection());

    // Right: nodes
    body.appendChild(this._buildNodesSection());

    // ── Footer ────────────────────────────────────────────────────────────────
    panel.appendChild(this._buildFooter());

    document.body.appendChild(root);
    this._syncFromDraft();
  }

  private _buildMetaSection(): HTMLElement {
    const section = document.createElement("div");
    section.className = "quest-creator__section";

    const h3 = document.createElement("h3");
    h3.className = "quest-creator__section-title";
    h3.textContent = "Quest Metadata";
    section.appendChild(h3);

    const form = document.createElement("div");
    form.className = "quest-creator__form";
    section.appendChild(form);

    this._metaId   = this._addField(form, "Quest ID",          "text",   "e.g. quest_rescue_villager");
    this._metaName = this._addField(form, "Display Name",      "text",   "e.g. Rescue the Villager");
    this._metaDesc = this._addField(form, "Description",       "text",   "Short quest summary");
    this._metaXp   = this._addField(form, "XP Reward",         "number", "100");

    // Flush meta to system on every change
    const syncMeta = () => {
      this._system.setMeta(
        this._metaId?.value  ?? "",
        this._metaName?.value ?? "",
        this._metaDesc?.value ?? "",
        parseFloat(this._metaXp?.value ?? "0") || 0,
      );
    };
    for (const inp of [this._metaId, this._metaName, this._metaDesc, this._metaXp]) {
      inp?.addEventListener("input", syncMeta);
    }

    return section;
  }

  private _addField(
    container: HTMLElement,
    label: string,
    type: string,
    placeholder: string,
  ): HTMLInputElement {
    const row = document.createElement("div");
    row.className = "quest-creator__field";
    container.appendChild(row);

    const lbl = document.createElement("label");
    lbl.className = "quest-creator__label";
    lbl.textContent = label;
    row.appendChild(lbl);

    const inp = document.createElement("input");
    inp.type        = type;
    inp.className   = "quest-creator__input";
    inp.placeholder = placeholder;
    if (type === "number") { inp.min = "0"; inp.step = "1"; }
    row.appendChild(inp);

    lbl.htmlFor = inp.id = `qc_${label.replace(/\s+/g, "_").toLowerCase()}`;
    return inp;
  }

  private _buildNodesSection(): HTMLElement {
    const section = document.createElement("div");
    section.className = "quest-creator__section quest-creator__section--nodes";

    const h3 = document.createElement("h3");
    h3.className = "quest-creator__section-title";
    h3.textContent = "Quest Nodes";
    section.appendChild(h3);

    const addBtn = document.createElement("button");
    addBtn.className = "quest-creator__btn quest-creator__btn--sm";
    addBtn.textContent = "+ Add Node";
    addBtn.addEventListener("click", () => {
      this._system.addNode();
      this._renderNodeList();
    });
    section.appendChild(addBtn);

    const list = document.createElement("div");
    list.className = "quest-creator__node-list";
    this._nodeListEl = list;
    section.appendChild(list);

    return section;
  }

  private _buildFooter(): HTMLElement {
    const footer = document.createElement("div");
    footer.className = "quest-creator__footer";

    // Status message
    const status = document.createElement("p");
    status.className = "quest-creator__status";
    this._statusEl = status;
    footer.appendChild(status);

    const actions = document.createElement("div");
    actions.className = "quest-creator__actions";
    footer.appendChild(actions);

    const validateBtn = this._makeBtn("Validate", "quest-creator__btn", () => this._handleValidate());
    const exportBtn   = this._makeBtn("Export JSON ↓", "quest-creator__btn quest-creator__btn--primary", () => this._handleExport());
    const importBtn   = this._makeBtn("Import JSON ↑", "quest-creator__btn", () => this._handleImport());
    const resetBtn    = this._makeBtn("Reset", "quest-creator__btn quest-creator__btn--danger", () => this._handleReset());

    for (const btn of [validateBtn, exportBtn, importBtn, resetBtn]) {
      actions.appendChild(btn);
    }

    return footer;
  }

  private _makeBtn(label: string, cls: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.className = cls;
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    return btn;
  }

  // ── Node list rendering ────────────────────────────────────────────────────

  private _renderNodeList(): void {
    if (!this._nodeListEl) return;
    this._nodeListEl.innerHTML = "";

    const nodes = this._system.nodes;
    if (nodes.length === 0) {
      const empty = document.createElement("p");
      empty.className = "quest-creator__empty";
      empty.textContent = "No nodes yet. Click \"+ Add Node\" to begin.";
      this._nodeListEl.appendChild(empty);
      return;
    }

    for (const node of nodes) {
      this._nodeListEl.appendChild(this._buildNodeCard(node));
    }
  }

  private _buildNodeCard(node: QuestCreatorNodeDraft): HTMLElement {
    const card = document.createElement("div");
    card.className = "quest-creator__node-card";
    card.dataset.nodeId = node.id;

    // ── Row 1: id + remove button ─────────────────────────────────────────
    const row1 = document.createElement("div");
    row1.className = "quest-creator__node-row";
    card.appendChild(row1);

    const idLabel = document.createElement("span");
    idLabel.className = "quest-creator__node-id";
    idLabel.textContent = node.id;
    row1.appendChild(idLabel);

    const removeBtn = document.createElement("button");
    removeBtn.className = "quest-creator__btn quest-creator__btn--sm quest-creator__btn--danger";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => {
      this._system.removeNode(node.id);
      this._renderNodeList();
    });
    row1.appendChild(removeBtn);

    // ── Row 2: trigger type + target ──────────────────────────────────────
    const row2 = document.createElement("div");
    row2.className = "quest-creator__node-row quest-creator__node-row--fields";
    card.appendChild(row2);

    // Trigger type select
    const typeGroup = this._makeLabeledControl("Trigger", `qcn_type_${node.id}`);
    const typeSelect = document.createElement("select");
    typeSelect.id        = `qcn_type_${node.id}`;
    typeSelect.className = "quest-creator__select";
    for (const t of TRIGGER_TYPES) {
      const opt = document.createElement("option");
      opt.value       = t;
      opt.textContent = t;
      opt.selected    = t === node.triggerType;
      typeSelect.appendChild(opt);
    }
    typeSelect.addEventListener("change", () => {
      this._system.updateNode(node.id, { triggerType: typeSelect.value as QuestTriggerType });
    });
    typeGroup.appendChild(typeSelect);
    row2.appendChild(typeGroup);

    // Target ID input
    const targetGroup = this._makeLabeledControl("Target ID", `qcn_tgt_${node.id}`);
    const targetInput = document.createElement("input");
    targetInput.id          = `qcn_tgt_${node.id}`;
    targetInput.type        = "text";
    targetInput.className   = "quest-creator__input quest-creator__input--sm";
    targetInput.placeholder = "e.g. bandit";
    targetInput.value       = node.targetId;
    targetInput.addEventListener("input", () => {
      this._system.updateNode(node.id, { targetId: targetInput.value });
    });
    targetGroup.appendChild(targetInput);
    row2.appendChild(targetGroup);

    // Required count input
    const countGroup = this._makeLabeledControl("Count", `qcn_cnt_${node.id}`);
    const countInput = document.createElement("input");
    countInput.id        = `qcn_cnt_${node.id}`;
    countInput.type      = "number";
    countInput.className = "quest-creator__input quest-creator__input--sm";
    countInput.min       = "1";
    countInput.step      = "1";
    countInput.value     = String(node.requiredCount);
    countInput.addEventListener("input", () => {
      this._system.updateNode(node.id, { requiredCount: parseInt(countInput.value, 10) || 1 });
    });
    countGroup.appendChild(countInput);
    row2.appendChild(countGroup);

    // ── Row 3: description ────────────────────────────────────────────────
    const row3 = document.createElement("div");
    row3.className = "quest-creator__node-row";
    card.appendChild(row3);

    const descGroup = this._makeLabeledControl("Description", `qcn_desc_${node.id}`);
    descGroup.style.flex = "1";
    const descInput = document.createElement("input");
    descInput.id          = `qcn_desc_${node.id}`;
    descInput.type        = "text";
    descInput.className   = "quest-creator__input";
    descInput.placeholder = "Objective text shown to the player";
    descInput.value       = node.description;
    descInput.addEventListener("input", () => {
      this._system.updateNode(node.id, { description: descInput.value });
    });
    descGroup.appendChild(descInput);
    row3.appendChild(descGroup);

    // ── Row 4: prerequisites ──────────────────────────────────────────────
    const row4 = document.createElement("div");
    row4.className = "quest-creator__node-row";
    card.appendChild(row4);

    const prereqGroup = this._makeLabeledControl("Prerequisites (comma-separated IDs)", `qcn_pre_${node.id}`);
    prereqGroup.style.flex = "1";
    const prereqInput = document.createElement("input");
    prereqInput.id          = `qcn_pre_${node.id}`;
    prereqInput.type        = "text";
    prereqInput.className   = "quest-creator__input";
    prereqInput.placeholder = "e.g. node_1, node_2";
    prereqInput.value       = node.prerequisites.join(", ");
    prereqInput.addEventListener("input", () => {
      const prereqs = prereqInput.value
        .split(",")
        .map(s => s.trim())
        .filter(s => s.length > 0);
      this._system.updateNode(node.id, { prerequisites: prereqs });
    });
    prereqGroup.appendChild(prereqInput);
    row4.appendChild(prereqGroup);

    return card;
  }

  private _makeLabeledControl(labelText: string, inputId: string): HTMLElement {
    const group = document.createElement("div");
    group.className = "quest-creator__control-group";

    const lbl = document.createElement("label");
    lbl.htmlFor     = inputId;
    lbl.className   = "quest-creator__label quest-creator__label--sm";
    lbl.textContent = labelText;
    group.appendChild(lbl);

    return group;
  }

  // ── Action handlers ────────────────────────────────────────────────────────

  private _handleValidate(): void {
    const report = this._system.validate();
    if (report.valid) {
      this._setStatus("✔ Validation passed — quest definition is valid.", "ok");
    } else {
      const details = report.issues
        .map(i => `• [${i.type}] ${i.detail || i.nodeId}`)
        .join("\n");
      this._setStatus(`✖ Validation failed (${report.issues.length} issue(s)):\n${details}`, "error");
    }
  }

  private _handleExport(): void {
    this._system.exportToFile();
    this._setStatus("Quest definition exported as JSON file.", "ok");
  }

  private _handleImport(): void {
    const input = document.createElement("input");
    input.type   = "file";
    input.accept = ".json,application/json";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      const ok = await this._system.importFromFile(file);
      if (ok) {
        this._syncFromDraft();
        this._setStatus(`Imported quest "${this._system.draft.name}" successfully.`, "ok");
      } else {
        this._setStatus("Import failed — invalid quest JSON file.", "error");
      }
    });
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  }

  private _handleReset(): void {
    this._system.reset();
    this._syncFromDraft();
    this._setStatus("Draft reset to blank.", "ok");
  }

  // ── Sync helpers ───────────────────────────────────────────────────────────

  private _syncFromDraft(): void {
    const d = this._system.draft;
    if (this._metaId)   this._metaId.value   = d.id;
    if (this._metaName) this._metaName.value  = d.name;
    if (this._metaDesc) this._metaDesc.value  = d.description;
    if (this._metaXp)   this._metaXp.value    = String(d.xpReward);
    this._renderNodeList();
  }

  private _setStatus(message: string, type: "ok" | "error" | ""): void {
    if (!this._statusEl) return;
    this._statusEl.textContent = message;
    this._statusEl.className =
      `quest-creator__status${type ? ` quest-creator__status--${type}` : ""}`;
  }
}
