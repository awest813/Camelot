/**
 * SchemaFieldBuilder — shared property-inspector utility.
 *
 * Generates labeled HTML form controls from a lightweight field descriptor
 * so creator UIs (Quest, Dialogue, NPC, Item, Spawn, etc.) avoid duplicating
 * the same label+input boilerplate.
 *
 * Usage:
 *   const builder = new SchemaFieldBuilder("my-ui");
 *   // Text input
 *   const { element, input } = builder.text({ label: "Quest ID", id: "id", placeholder: "e.g. q_rescue" });
 *   // Number input
 *   const { element, input } = builder.number({ label: "XP Reward", id: "xp", min: 0, step: 1 });
 *   // Checkbox
 *   const { element, input } = builder.checkbox({ label: "Stackable", id: "stackable" });
 *   // Select
 *   const { element, select } = builder.select({ label: "Role", id: "role", options: [{ value: "guard", label: "Guard" }] });
 *   // Textarea
 *   const { element, textarea } = builder.textarea({ label: "Description", id: "desc", rows: 3 });
 */

// ── Shared field descriptor interfaces ───────────────────────────────────────

export interface BaseFieldOpts {
  /** Unique id suffix (will be prefixed with the builder's namespace). */
  id: string;
  /** Human-readable label text. */
  label: string;
  /** Optional CSS class modifier applied to the wrapper element. */
  modifier?: string;
}

export interface TextFieldOpts extends BaseFieldOpts {
  placeholder?: string;
  value?: string;
  maxLength?: number;
}

export interface NumberFieldOpts extends BaseFieldOpts {
  placeholder?: string;
  value?: number;
  min?: number;
  max?: number;
  step?: number;
}

export interface CheckboxFieldOpts extends BaseFieldOpts {
  checked?: boolean;
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectFieldOpts extends BaseFieldOpts {
  options: SelectOption[];
  value?: string;
}

export interface TextareaFieldOpts extends BaseFieldOpts {
  placeholder?: string;
  value?: string;
  rows?: number;
}

// ── SchemaFieldBuilder ────────────────────────────────────────────────────────

/**
 * Stateless factory that builds consistently-styled form controls.
 *
 * @param ns - CSS namespace prefix (e.g. "quest-creator"). The generated
 *             elements use CSS classes like `<ns>__field`, `<ns>__label`,
 *             `<ns>__input`, `<ns>__select`, `<ns>__textarea`.
 */
export class SchemaFieldBuilder {
  private readonly _ns: string;

  constructor(ns: string) {
    this._ns = ns;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private _fieldId(id: string): string {
    return `${this._ns}_${id}`;
  }

  private _wrapField(opts: BaseFieldOpts, labelEl: HTMLLabelElement, control: HTMLElement): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = `${this._ns}__field${opts.modifier ? ` ${this._ns}__field--${opts.modifier}` : ""}`;
    wrap.appendChild(labelEl);
    wrap.appendChild(control);
    return wrap;
  }

  private _makeLabel(opts: BaseFieldOpts): HTMLLabelElement {
    const lbl = document.createElement("label");
    lbl.className = `${this._ns}__label`;
    lbl.textContent = opts.label;
    lbl.htmlFor = this._fieldId(opts.id);
    return lbl;
  }

  // ── Public builders ───────────────────────────────────────────────────────

  /** Single-line text input. */
  text(opts: TextFieldOpts): { element: HTMLElement; input: HTMLInputElement } {
    const lbl = this._makeLabel(opts);
    const input = document.createElement("input");
    input.type        = "text";
    input.id          = this._fieldId(opts.id);
    input.className   = `${this._ns}__input`;
    input.placeholder = opts.placeholder ?? "";
    input.value       = opts.value       ?? "";
    if (opts.maxLength !== undefined) input.maxLength = opts.maxLength;
    return { element: this._wrapField(opts, lbl, input), input };
  }

  /** Numeric input. */
  number(opts: NumberFieldOpts): { element: HTMLElement; input: HTMLInputElement } {
    const lbl = this._makeLabel(opts);
    const input = document.createElement("input");
    input.type        = "number";
    input.id          = this._fieldId(opts.id);
    input.className   = `${this._ns}__input`;
    input.placeholder = opts.placeholder ?? "";
    if (opts.value   !== undefined) input.value = String(opts.value);
    if (opts.min     !== undefined) input.min   = String(opts.min);
    if (opts.max     !== undefined) input.max   = String(opts.max);
    if (opts.step    !== undefined) input.step  = String(opts.step);
    return { element: this._wrapField(opts, lbl, input), input };
  }

  /** Checkbox. */
  checkbox(opts: CheckboxFieldOpts): { element: HTMLElement; input: HTMLInputElement } {
    const lbl = this._makeLabel(opts);
    const input = document.createElement("input");
    input.type    = "checkbox";
    input.id      = this._fieldId(opts.id);
    input.className = `${this._ns}__checkbox`;
    input.checked = opts.checked ?? false;
    // For checkboxes the label typically follows the control
    const wrap = document.createElement("div");
    wrap.className = `${this._ns}__field${opts.modifier ? ` ${this._ns}__field--${opts.modifier}` : ""}`;
    const checkRow = document.createElement("div");
    checkRow.className = `${this._ns}__check-row`;
    checkRow.appendChild(input);
    checkRow.appendChild(lbl);
    wrap.appendChild(checkRow);
    return { element: wrap, input };
  }

  /** Select / dropdown. */
  select(opts: SelectFieldOpts): { element: HTMLElement; select: HTMLSelectElement } {
    const lbl = this._makeLabel(opts);
    const sel = document.createElement("select");
    sel.id        = this._fieldId(opts.id);
    sel.className = `${this._ns}__select`;
    for (const o of opts.options) {
      const opt = document.createElement("option");
      opt.value       = o.value;
      opt.textContent = o.label;
      opt.selected    = o.value === opts.value;
      sel.appendChild(opt);
    }
    return { element: this._wrapField(opts, lbl, sel), select: sel };
  }

  /** Multi-line textarea. */
  textarea(opts: TextareaFieldOpts): { element: HTMLElement; textarea: HTMLTextAreaElement } {
    const lbl = this._makeLabel(opts);
    const ta = document.createElement("textarea");
    ta.id          = this._fieldId(opts.id);
    ta.className   = `${this._ns}__textarea`;
    ta.placeholder = opts.placeholder ?? "";
    ta.value       = opts.value       ?? "";
    ta.rows        = opts.rows        ?? 3;
    return { element: this._wrapField(opts, lbl, ta), textarea: ta };
  }
}
