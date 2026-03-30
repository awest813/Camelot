import type {
  DialogueCreatorSystem,
  DialogueNodeDraft,
  DialogueChoiceDraft,
} from "../systems/dialogue-creator-system";
import type {
  DialogueChoiceCondition,
  DialogueChoiceEffect,
} from "../framework/dialogue/dialogue-types";

// ── Condition / Effect type lists ─────────────────────────────────────────────

const CONDITION_TYPES = ["flag", "faction_min", "quest_status", "has_item", "skill_min"] as const;
const EFFECT_TYPES    = ["set_flag", "faction_delta", "emit_event", "activate_quest", "consume_item", "give_item"] as const;

/**
 * Visual Dialogue Creator UI.
 *
 * Layout: full-screen overlay split into:
 *   • Left panel  — node list (click to select) with visual connection indicators
 *   • Right panel — selected node editor (speaker, text, terminal, choices, conditions, effects)
 *
 * Key bindings: none (uses mouse only; Esc closes).
 *
 * Usage:
 *   const ui = new DialogueCreatorUI(system);
 *   ui.open();
 *   ui.close();
 */
export class DialogueCreatorUI {
  public onClose: (() => void) | null = null;

  private readonly _sys: DialogueCreatorSystem;
  private _root: HTMLElement | null = null;
  private _nodeListEl: HTMLElement | null = null;
  private _detailEl: HTMLElement | null = null;
  private _statusEl: HTMLElement | null = null;
  private _selectedNodeId: string | null = null;
  private _domIdSeq = 0;

  // Header inputs
  private _idInput: HTMLInputElement | null = null;
  private _startInput: HTMLInputElement | null = null;

  constructor(system: DialogueCreatorSystem) {
    this._sys = system;
  }

  get isVisible(): boolean {
    return this._root !== null && !this._root.hidden;
  }

  open(): void {
    if (this._root) {
      this._root.hidden = false;
      this._sync();
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
    root.className = "dlg-creator";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Dialogue Creator");
    this._root = root;

    // Header
    root.appendChild(this._buildHeader());

    // Body (two-column)
    const body = document.createElement("div");
    body.className = "dlg-creator__body";
    root.appendChild(body);

    // Left: node list
    body.appendChild(this._buildNodeList());

    // Right: detail panel
    const detail = document.createElement("div");
    detail.className = "dlg-creator__detail";
    this._detailEl = detail;
    body.appendChild(detail);

    // Footer
    root.appendChild(this._buildFooter());

    document.body.appendChild(root);
    this._sync();
  }

  // ── Header ─────────────────────────────────────────────────────────────────

  private _buildHeader(): HTMLElement {
    const header = document.createElement("div");
    header.className = "dlg-creator__header";

    const title = document.createElement("h2");
    title.className = "dlg-creator__title";
    title.textContent = "Dialogue Creator";
    header.appendChild(title);

    // Meta fields inline
    const meta = document.createElement("div");
    meta.className = "dlg-creator__header-meta";
    header.appendChild(meta);

    this._idInput = this._makeHeaderInput(meta, "Dialogue ID", "e.g. dlg_innkeeper_greeting");
    this._idInput.addEventListener("input", () => this._flushMeta());

    this._startInput = this._makeHeaderInput(meta, "Start Node", "e.g. node_1");
    this._startInput.addEventListener("input", () => this._flushMeta());

    const closeBtn = document.createElement("button");
    closeBtn.className = "dlg-creator__close-btn";
    closeBtn.textContent = "✕";
    closeBtn.setAttribute("aria-label", "Close dialogue creator");
    closeBtn.addEventListener("click", () => this.close());
    header.appendChild(closeBtn);

    return header;
  }

  private _makeHeaderInput(container: HTMLElement, label: string, placeholder: string): HTMLInputElement {
    const wrap = document.createElement("div");
    wrap.className = "dlg-creator__header-field";

    const lbl = document.createElement("label");
    lbl.className = "dlg-creator__label";
    lbl.textContent = label;
    wrap.appendChild(lbl);

    const inp = document.createElement("input");
    inp.type        = "text";
    inp.className   = "dlg-creator__input";
    inp.placeholder = placeholder;
    lbl.htmlFor = inp.id = `dlgc_${label.replace(/\s+/g, "_").toLowerCase()}`;
    wrap.appendChild(inp);

    container.appendChild(wrap);
    return inp;
  }

  // ── Node list ──────────────────────────────────────────────────────────────

  private _buildNodeList(): HTMLElement {
    const panel = document.createElement("div");
    panel.className = "dlg-creator__node-panel";

    const listHeader = document.createElement("div");
    listHeader.className = "dlg-creator__list-header";

    const sectionTitle = document.createElement("span");
    sectionTitle.className = "dlg-creator__section-title";
    sectionTitle.textContent = "Nodes";
    listHeader.appendChild(sectionTitle);

    const addBtn = document.createElement("button");
    addBtn.className = "dlg-creator__btn dlg-creator__btn--sm";
    addBtn.textContent = "+ Add Node";
    addBtn.addEventListener("click", () => {
      const id = this._sys.addNode();
      this._selectedNodeId = id;
      this._sync();
    });
    listHeader.appendChild(addBtn);

    panel.appendChild(listHeader);

    const list = document.createElement("div");
    list.className = "dlg-creator__node-list";
    this._nodeListEl = list;
    panel.appendChild(list);

    return panel;
  }

  private _renderNodeList(): void {
    if (!this._nodeListEl) return;
    this._nodeListEl.innerHTML = "";
    const nodes = this._sys.nodes;
    if (nodes.length === 0) {
      const empty = document.createElement("p");
      empty.className = "dlg-creator__empty";
      empty.textContent = "No nodes yet. Click \u201c+ Add Node\u201d to begin.";
      this._nodeListEl.appendChild(empty);
      return;
    }

    const startId = this._sys.draft.startNodeId;
    for (const node of nodes) {
      const card = document.createElement("div");
      card.className = "dlg-creator__node-card" + (node.id === this._selectedNodeId ? " is-selected" : "");
      card.dataset.nodeId = node.id;

      const idRow = document.createElement("div");
      idRow.className = "dlg-creator__node-card-row";

      const badge = document.createElement("span");
      badge.className = "dlg-creator__node-id";
      badge.textContent = (node.id === startId ? "★ " : "") + node.id;
      if (node.terminal) badge.textContent += " ■";
      idRow.appendChild(badge);

      // Outgoing links count
      const linked = node.choices.filter(c => c.nextNodeId).length;
      if (linked > 0) {
        const linkBadge = document.createElement("span");
        linkBadge.className = "dlg-creator__link-badge";
        linkBadge.textContent = `→ ${linked}`;
        idRow.appendChild(linkBadge);
      }

      card.appendChild(idRow);

      const preview = document.createElement("p");
      preview.className = "dlg-creator__node-preview";
      preview.textContent = node.text
        ? (node.text.length > 60 ? node.text.slice(0, 57) + "…" : node.text)
        : "(no text)";
      card.appendChild(preview);

      card.addEventListener("click", () => {
        this._selectedNodeId = node.id;
        this._sync();
      });

      this._nodeListEl.appendChild(card);
    }
  }

  // ── Detail panel ───────────────────────────────────────────────────────────

  private _renderDetail(): void {
    if (!this._detailEl) return;
    this._detailEl.innerHTML = "";

    if (!this._selectedNodeId) {
      const placeholder = document.createElement("p");
      placeholder.className = "dlg-creator__empty";
      placeholder.textContent = "Select a node from the list to edit it.";
      this._detailEl.appendChild(placeholder);
      return;
    }

    const node = this._sys.nodes.find(n => n.id === this._selectedNodeId);
    if (!node) {
      this._selectedNodeId = null;
      const placeholder = document.createElement("p");
      placeholder.className = "dlg-creator__empty";
      placeholder.textContent = "Node not found. It may have been removed.";
      this._detailEl.appendChild(placeholder);
      return;
    }

    this._detailEl.appendChild(this._buildNodeEditor(node));
  }

  private _buildNodeEditor(node: DialogueNodeDraft): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "dlg-creator__node-editor";

    // Section title + delete
    const topRow = document.createElement("div");
    topRow.className = "dlg-creator__node-editor-header";

    const titleEl = document.createElement("h3");
    titleEl.className = "dlg-creator__node-editor-title";
    titleEl.textContent = `Edit Node: ${node.id}`;
    topRow.appendChild(titleEl);

    const delBtn = document.createElement("button");
    delBtn.className = "dlg-creator__btn dlg-creator__btn--sm dlg-creator__btn--danger";
    delBtn.textContent = "Delete Node";
    delBtn.addEventListener("click", () => {
      this._sys.removeNode(node.id);
      this._selectedNodeId = null;
      this._sync();
    });
    topRow.appendChild(delBtn);

    wrap.appendChild(topRow);

    // Speaker
    wrap.appendChild(this._makeField("Speaker", node.speaker, "text", "e.g. Innkeeper", (v) => {
      this._sys.updateNode(node.id, { speaker: v });
    }));

    // Text (textarea)
    wrap.appendChild(this._makeTextarea("Dialogue Text", node.text, "What the NPC says…", (v) => {
      this._sys.updateNode(node.id, { text: v });
    }));

    // Terminal toggle
    const termRow = document.createElement("div");
    termRow.className = "dlg-creator__field dlg-creator__field--inline";
    const termCheck = document.createElement("input");
    termCheck.type    = "checkbox";
    termCheck.id      = `dlgc_terminal_${node.id}`;
    termCheck.checked = node.terminal;
    termCheck.addEventListener("change", () => {
      this._sys.updateNode(node.id, { terminal: termCheck.checked });
    });
    const termLabel = document.createElement("label");
    termLabel.htmlFor     = termCheck.id;
    termLabel.className   = "dlg-creator__label";
    termLabel.textContent = "Terminal node (ends conversation)";
    termRow.appendChild(termCheck);
    termRow.appendChild(termLabel);
    wrap.appendChild(termRow);

    wrap.appendChild(
      this._makeField(
        "Camera sequence id",
        node.cameraSequenceId ?? "",
        "text",
        "Optional CameraScriptingSystem sequence id",
        (v) => {
          this._sys.updateNode(node.id, { cameraSequenceId: v.trim() || undefined });
        },
      ),
    );

    // Choices
    const choicesSect = document.createElement("div");
    choicesSect.className = "dlg-creator__choices-section";

    const choicesHeader = document.createElement("div");
    choicesHeader.className = "dlg-creator__list-header";

    const choiceTitle = document.createElement("span");
    choiceTitle.className = "dlg-creator__section-title";
    choiceTitle.textContent = "Player Choices";
    choicesHeader.appendChild(choiceTitle);

    const addChoiceBtn = document.createElement("button");
    addChoiceBtn.className = "dlg-creator__btn dlg-creator__btn--sm";
    addChoiceBtn.textContent = "+ Add Choice";
    addChoiceBtn.addEventListener("click", () => {
      this._sys.addChoice(node.id);
      this._renderDetail();
      this._renderNodeList();
    });
    choicesHeader.appendChild(addChoiceBtn);

    choicesSect.appendChild(choicesHeader);

    if (node.choices.length === 0) {
      const noChoices = document.createElement("p");
      noChoices.className = "dlg-creator__empty";
      noChoices.textContent = "No choices. Add choices, or mark this node as Terminal.";
      choicesSect.appendChild(noChoices);
    } else {
      for (const choice of node.choices) {
        choicesSect.appendChild(this._buildChoiceEditor(node, choice));
      }
    }

    wrap.appendChild(choicesSect);
    return wrap;
  }

  private _buildChoiceEditor(node: DialogueNodeDraft, choice: DialogueChoiceDraft): HTMLElement {
    const card = document.createElement("div");
    card.className = "dlg-creator__choice-card";

    // Choice header row
    const headerRow = document.createElement("div");
    headerRow.className = "dlg-creator__node-editor-header";

    const choiceId = document.createElement("span");
    choiceId.className = "dlg-creator__node-id dlg-creator__node-id--choice";
    choiceId.textContent = choice.id;
    headerRow.appendChild(choiceId);

    const removeBtn = document.createElement("button");
    removeBtn.className = "dlg-creator__btn dlg-creator__btn--sm dlg-creator__btn--danger";
    removeBtn.textContent = "✕";
    removeBtn.setAttribute("aria-label", "Remove choice");
    removeBtn.addEventListener("click", () => {
      this._sys.removeChoice(node.id, choice.id);
      this._renderDetail();
      this._renderNodeList();
    });
    headerRow.appendChild(removeBtn);

    card.appendChild(headerRow);

    // Choice text
    card.appendChild(this._makeField("Choice Text", choice.text, "text", "What the player says…", (v) => {
      this._sys.updateChoice(node.id, choice.id, { text: v });
    }));

    // Next node ID dropdown
    const nextWrap = document.createElement("div");
    nextWrap.className = "dlg-creator__field";
    const nextLabel = document.createElement("label");
    nextLabel.className = "dlg-creator__label";
    nextLabel.textContent = "Next Node";
    const nextSel = this._makeNodeSelect(choice.nextNodeId, node.id);
    nextSel.addEventListener("change", () => {
      this._sys.updateChoice(node.id, choice.id, { nextNodeId: nextSel.value });
    });
    nextLabel.htmlFor = nextSel.id = `dlgc_next_${choice.id}`;
    nextWrap.appendChild(nextLabel);
    nextWrap.appendChild(nextSel);
    card.appendChild(nextWrap);

    // Ends dialogue checkbox
    const endRow = document.createElement("div");
    endRow.className = "dlg-creator__field dlg-creator__field--inline";
    const endCheck = document.createElement("input");
    endCheck.type    = "checkbox";
    endCheck.id      = `dlgc_end_${choice.id}`;
    endCheck.checked = choice.endsDialogue;
    endCheck.addEventListener("change", () => {
      this._sys.updateChoice(node.id, choice.id, { endsDialogue: endCheck.checked });
    });
    const endLabel = document.createElement("label");
    endLabel.htmlFor     = endCheck.id;
    endLabel.className   = "dlg-creator__label";
    endLabel.textContent = "Ends dialogue";
    endRow.appendChild(endCheck);
    endRow.appendChild(endLabel);
    card.appendChild(endRow);

    // Conditions
    card.appendChild(this._buildConditionsEditor(node.id, choice));

    // Effects
    card.appendChild(this._buildEffectsEditor(node.id, choice));

    return card;
  }

  private _makeNodeSelect(currentNextId: string, excludeNodeId: string): HTMLSelectElement {
    const sel = document.createElement("select");
    sel.className = "dlg-creator__select";

    const none = document.createElement("option");
    none.value       = "";
    none.textContent = "— (none) —";
    sel.appendChild(none);

    for (const n of this._sys.nodes) {
      if (n.id === excludeNodeId) continue;
      const opt = document.createElement("option");
      opt.value       = n.id;
      opt.textContent = `${n.id} — ${n.text.slice(0, 30) || "(no text)"}`;
      opt.selected    = n.id === currentNextId;
      sel.appendChild(opt);
    }
    sel.value = currentNextId;
    return sel;
  }

  // ── Conditions editor ──────────────────────────────────────────────────────

  private _buildConditionsEditor(nodeId: string, choice: DialogueChoiceDraft): HTMLElement {
    const wrap = document.createElement("details");
    wrap.className = "dlg-creator__expandable";

    const summary = document.createElement("summary");
    summary.className = "dlg-creator__section-title dlg-creator__section-title--expandable";
    summary.textContent = `Conditions (${choice.conditions.length})`;
    wrap.appendChild(summary);

    for (let i = 0; i < choice.conditions.length; i++) {
      const idx = i;
      const cond = choice.conditions[i];
      const row = document.createElement("div");
      row.className = "dlg-creator__condition-row";

      const tag = document.createElement("code");
      tag.className   = "dlg-creator__condition-tag";
      tag.textContent = this._describeCondition(cond);
      row.appendChild(tag);

      const rmBtn = document.createElement("button");
      rmBtn.className   = "dlg-creator__btn dlg-creator__btn--sm dlg-creator__btn--danger";
      rmBtn.textContent = "✕";
      rmBtn.setAttribute("aria-label", "Remove condition");
      rmBtn.addEventListener("click", () => {
        this._sys.removeCondition(nodeId, choice.id, idx);
        this._renderDetail();
      });
      row.appendChild(rmBtn);
      wrap.appendChild(row);
    }

    // Add condition mini-form
    wrap.appendChild(this._buildAddConditionForm(nodeId, choice.id));

    return wrap;
  }

  private _describeCondition(c: DialogueChoiceCondition): string {
    switch (c.type) {
      case "flag":         return `flag "${c.flag}" == ${c.equals}`;
      case "faction_min":  return `faction "${c.factionId}" ≥ ${c.min}`;
      case "quest_status": return `quest "${c.questId}" == ${c.status}`;
      case "has_item":     return `has item "${c.itemId}" × ${c.minQuantity}`;
      case "skill_min":    return `skill "${c.skillId}" ≥ ${c.min}`;
    }
  }

  private _buildAddConditionForm(nodeId: string, choiceId: string): HTMLElement {
    const form = document.createElement("div");
    form.className = "dlg-creator__add-cond-form";

    const typeSel = document.createElement("select");
    typeSel.className = "dlg-creator__select dlg-creator__select--sm";
    for (const t of CONDITION_TYPES) {
      const opt = document.createElement("option");
      opt.value = opt.textContent = t;
      typeSel.appendChild(opt);
    }

    const arg1 = document.createElement("input");
    arg1.className   = "dlg-creator__input dlg-creator__input--sm";
    arg1.placeholder = "id / flag name";
    arg1.type        = "text";

    const arg2 = document.createElement("input");
    arg2.className   = "dlg-creator__input dlg-creator__input--sm";
    arg2.placeholder = "value";
    arg2.type        = "text";

    const addBtn = document.createElement("button");
    addBtn.className   = "dlg-creator__btn dlg-creator__btn--sm";
    addBtn.textContent = "+ Condition";
    addBtn.addEventListener("click", () => {
      const cond = this._buildCondition(typeSel.value as typeof CONDITION_TYPES[number], arg1.value.trim(), arg2.value.trim());
      if (!cond) return;
      this._sys.addCondition(nodeId, choiceId, cond);
      arg1.value = ""; arg2.value = "";
      this._renderDetail();
    });

    form.appendChild(typeSel);
    form.appendChild(arg1);
    form.appendChild(arg2);
    form.appendChild(addBtn);
    return form;
  }

  private _buildCondition(
    type: typeof CONDITION_TYPES[number],
    a: string,
    b: string,
  ): DialogueChoiceCondition | null {
    if (!a) return null;
    switch (type) {
      case "flag":         return { type, flag: a, equals: b !== "false" };
      case "faction_min":  return { type, factionId: a, min: parseFloat(b) || 0 };
      case "quest_status": return { type, questId: a, status: (b as "inactive" | "active" | "completed") || "active" };
      case "has_item":     return { type, itemId: a, minQuantity: parseInt(b, 10) || 1 };
      case "skill_min":    return { type, skillId: a, min: parseFloat(b) || 0 };
    }
  }

  // ── Effects editor ─────────────────────────────────────────────────────────

  private _buildEffectsEditor(nodeId: string, choice: DialogueChoiceDraft): HTMLElement {
    const wrap = document.createElement("details");
    wrap.className = "dlg-creator__expandable";

    const summary = document.createElement("summary");
    summary.className = "dlg-creator__section-title dlg-creator__section-title--expandable";
    summary.textContent = `Effects (${choice.effects.length})`;
    wrap.appendChild(summary);

    for (let i = 0; i < choice.effects.length; i++) {
      const idx = i;
      const eff = choice.effects[i];
      const row = document.createElement("div");
      row.className = "dlg-creator__condition-row";

      const tag = document.createElement("code");
      tag.className   = "dlg-creator__condition-tag dlg-creator__condition-tag--effect";
      tag.textContent = this._describeEffect(eff);
      row.appendChild(tag);

      const rmBtn = document.createElement("button");
      rmBtn.className   = "dlg-creator__btn dlg-creator__btn--sm dlg-creator__btn--danger";
      rmBtn.textContent = "✕";
      rmBtn.setAttribute("aria-label", "Remove effect");
      rmBtn.addEventListener("click", () => {
        this._sys.removeEffect(nodeId, choice.id, idx);
        this._renderDetail();
      });
      row.appendChild(rmBtn);
      wrap.appendChild(row);
    }

    wrap.appendChild(this._buildAddEffectForm(nodeId, choice.id));

    return wrap;
  }

  private _describeEffect(e: DialogueChoiceEffect): string {
    switch (e.type) {
      case "set_flag":      return `set flag "${e.flag}" = ${e.value}`;
      case "faction_delta": return `faction "${e.factionId}" += ${e.amount}`;
      case "emit_event":    return `emit event "${e.eventId}"`;
      case "activate_quest": return `activate quest "${e.questId}"`;
      case "consume_item":  return `consume "${e.itemId}" × ${e.quantity}`;
      case "give_item":     return `give "${e.itemId}" × ${e.quantity}`;
    }
  }

  private _buildAddEffectForm(nodeId: string, choiceId: string): HTMLElement {
    const form = document.createElement("div");
    form.className = "dlg-creator__add-cond-form";

    const typeSel = document.createElement("select");
    typeSel.className = "dlg-creator__select dlg-creator__select--sm";
    for (const t of EFFECT_TYPES) {
      const opt = document.createElement("option");
      opt.value = opt.textContent = t;
      typeSel.appendChild(opt);
    }

    const arg1 = document.createElement("input");
    arg1.className   = "dlg-creator__input dlg-creator__input--sm";
    arg1.placeholder = "id / flag / eventId";
    arg1.type        = "text";

    const arg2 = document.createElement("input");
    arg2.className   = "dlg-creator__input dlg-creator__input--sm";
    arg2.placeholder = "value / amount / qty";
    arg2.type        = "text";

    const addBtn = document.createElement("button");
    addBtn.className   = "dlg-creator__btn dlg-creator__btn--sm";
    addBtn.textContent = "+ Effect";
    addBtn.addEventListener("click", () => {
      const eff = this._buildEffect(typeSel.value as typeof EFFECT_TYPES[number], arg1.value.trim(), arg2.value.trim());
      if (!eff) return;
      this._sys.addEffect(nodeId, choiceId, eff);
      arg1.value = ""; arg2.value = "";
      this._renderDetail();
    });

    form.appendChild(typeSel);
    form.appendChild(arg1);
    form.appendChild(arg2);
    form.appendChild(addBtn);
    return form;
  }

  private _buildEffect(
    type: typeof EFFECT_TYPES[number],
    a: string,
    b: string,
  ): DialogueChoiceEffect | null {
    if (!a) return null;
    switch (type) {
      case "set_flag":      return { type, flag: a, value: b !== "false" };
      case "faction_delta": return { type, factionId: a, amount: parseFloat(b) || 0 };
      case "emit_event":    return { type, eventId: a };
      case "activate_quest": return { type, questId: a };
      case "consume_item":  return { type, itemId: a, quantity: parseInt(b, 10) || 1 };
      case "give_item":     return { type, itemId: a, quantity: parseInt(b, 10) || 1 };
    }
  }

  // ── Footer ─────────────────────────────────────────────────────────────────

  private _buildFooter(): HTMLElement {
    const footer = document.createElement("div");
    footer.className = "dlg-creator__footer";

    const status = document.createElement("p");
    status.className = "dlg-creator__status";
    this._statusEl = status;
    footer.appendChild(status);

    const actions = document.createElement("div");
    actions.className = "dlg-creator__actions";
    footer.appendChild(actions);

    actions.appendChild(this._makeBtn("Validate", "dlg-creator__btn", () => this._handleValidate()));
    actions.appendChild(this._makeBtn("Export JSON ↓", "dlg-creator__btn dlg-creator__btn--primary", () => this._handleExport()));
    actions.appendChild(this._makeBtn("Import JSON ↑", "dlg-creator__btn", () => this._handleImport()));
    actions.appendChild(this._makeBtn("Reset", "dlg-creator__btn dlg-creator__btn--danger", () => this._handleReset()));

    return footer;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private _makeField(
    label: string,
    value: string,
    type: string,
    placeholder: string,
    onChange: (v: string) => void,
  ): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "dlg-creator__field";
    const lbl = document.createElement("label");
    lbl.className   = "dlg-creator__label";
    lbl.textContent = label;
    const inp = document.createElement("input");
    inp.type        = type;
    inp.className   = "dlg-creator__input";
    inp.placeholder = placeholder;
    inp.value       = value;
    lbl.htmlFor = inp.id = `dlgc_field_${label.replace(/\s+/g, "_").toLowerCase()}_${++this._domIdSeq}`;
    inp.addEventListener("input", () => onChange(inp.value));
    wrap.appendChild(lbl);
    wrap.appendChild(inp);
    return wrap;
  }

  private _makeTextarea(label: string, value: string, placeholder: string, onChange: (v: string) => void): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "dlg-creator__field";
    const lbl = document.createElement("label");
    lbl.className   = "dlg-creator__label";
    lbl.textContent = label;
    const ta = document.createElement("textarea");
    ta.className   = "dlg-creator__textarea";
    ta.placeholder = placeholder;
    ta.value       = value;
    ta.rows        = 4;
    lbl.htmlFor = ta.id = `dlgc_ta_${++this._domIdSeq}`;
    ta.addEventListener("input", () => onChange(ta.value));
    wrap.appendChild(lbl);
    wrap.appendChild(ta);
    return wrap;
  }

  private _makeBtn(label: string, cls: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.className   = cls;
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    return btn;
  }

  private _flushMeta(): void {
    this._sys.setMeta(
      this._idInput?.value    ?? "",
      this._startInput?.value ?? "",
    );
  }

  private _sync(): void {
    const d = this._sys.draft;
    if (this._idInput)    this._idInput.value    = d.id;
    if (this._startInput) this._startInput.value = d.startNodeId;
    this._renderNodeList();
    this._renderDetail();
  }

  private _setStatus(message: string, type: "ok" | "error" | ""): void {
    if (!this._statusEl) return;
    this._statusEl.textContent = message;
    this._statusEl.className = `dlg-creator__status${type ? ` dlg-creator__status--${type}` : ""}`;
  }

  // ── Action handlers ────────────────────────────────────────────────────────

  private _handleValidate(): void {
    const report = this._sys.validate();
    if (report.valid) {
      this._setStatus("✔ Validation passed — dialogue definition is valid.", "ok");
    } else {
      const details = report.issues.map(i => `• [${i.type}] ${i.detail}`).join("\n");
      this._setStatus(`✖ Validation failed (${report.issues.length} issue(s)):\n${details}`, "error");
    }
  }

  private _handleExport(): void {
    this._sys.exportToFile();
    this._setStatus("Dialogue exported as JSON file.", "ok");
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
        this._selectedNodeId = null;
        this._sync();
        this._setStatus(`Imported dialogue "${this._sys.draft.id}" successfully.`, "ok");
      } else {
        this._setStatus("Import failed — invalid dialogue JSON file.", "error");
      }
    });
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  }

  private _handleReset(): void {
    this._sys.reset();
    this._selectedNodeId = null;
    this._sync();
    this._setStatus("Draft reset to blank.", "ok");
  }
}
