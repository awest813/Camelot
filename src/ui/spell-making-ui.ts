import type { DamageType, SpellSchool } from "../systems/spell-system";
import type { SpellComponent, SpellComponentEffect } from "../systems/spell-making-system";
import {
  SPELL_COMPONENT_DAMAGE_TYPES,
  SPELL_COMPONENT_EFFECTS,
  SPELL_COMPONENT_SCHOOLS,
} from "../systems/spell-making-system";

export interface SpellMakingForgeRequest {
  name: string;
  components: SpellComponent[];
}

interface ComponentDraft {
  effectType: SpellComponentEffect;
  school: SpellSchool;
  magnitude: number;
  duration: number;
  damageType: DamageType;
}

const makeDefaultDraft = (): ComponentDraft => ({
  effectType: "damage",
  school: "destruction",
  magnitude: 15,
  duration: 3,
  damageType: "shock",
});

/**
 * HTML spellmaking overlay used by the runtime X-key workflow.
 */
export class SpellMakingUI {
  public isVisible: boolean = false;
  public onForge: ((request: SpellMakingForgeRequest) => void) | null = null;
  public onClose: (() => void) | null = null;

  private readonly _computeCost: (components: SpellComponent[]) => number;
  private _root: HTMLDivElement | null = null;
  private _nameInput: HTMLInputElement | null = null;
  private _statusEl: HTMLParagraphElement | null = null;
  private _costEl: HTMLParagraphElement | null = null;
  private _includeSecondInput: HTMLInputElement | null = null;
  private _forgeButton: HTMLButtonElement | null = null;
  private _componentRows: Array<{
    wrap: HTMLDivElement;
    effect: HTMLSelectElement;
    school: HTMLSelectElement;
    magnitude: HTMLInputElement;
    duration: HTMLInputElement;
    damageType: HTMLSelectElement;
  }> = [];

  constructor(computeCost: (components: SpellComponent[]) => number) {
    this._computeCost = computeCost;
  }

  public open(): void {
    if (typeof document === "undefined") return;
    this._ensureDom();
    if (!this._root) return;
    this._resetDefaults();
    this._root.style.display = "grid";
    this.isVisible = true;
  }

  public close(): void {
    if (!this._root) return;
    this._root.style.display = "none";
    this.isVisible = false;
    this.onClose?.();
  }

  public showStatus(message: string, isError: boolean = false): void {
    if (!this._statusEl) return;
    this._statusEl.textContent = message;
    this._statusEl.classList.toggle("spell-making__status--error", isError);
    this._statusEl.classList.toggle("spell-making__status--ok", !isError);
  }

  private _ensureDom(): void {
    if (this._root || typeof document === "undefined") return;

    const root = document.createElement("div");
    root.className = "spell-making";
    root.style.display = "none";

    const panel = document.createElement("section");
    panel.className = "spell-making__panel";
    root.appendChild(panel);

    const header = document.createElement("header");
    header.className = "spell-making__header";
    panel.appendChild(header);

    const titleWrap = document.createElement("div");
    titleWrap.className = "spell-making__title-wrap";
    header.appendChild(titleWrap);

    const title = document.createElement("h2");
    title.className = "spell-making__title";
    title.textContent = "Spellmaking Altar";
    titleWrap.appendChild(title);

    const subtitle = document.createElement("p");
    subtitle.className = "spell-making__subtitle";
    subtitle.textContent = "Combine up to two effects and forge a custom spell.";
    titleWrap.appendChild(subtitle);

    const closeBtn = document.createElement("button");
    closeBtn.className = "spell-making__close-btn";
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("click", () => this.close());
    header.appendChild(closeBtn);

    const nameField = document.createElement("label");
    nameField.className = "spell-making__field";
    const nameLabel = document.createElement("span");
    nameLabel.className = "spell-making__label";
    nameLabel.textContent = "Spell Name";
    nameField.appendChild(nameLabel);
    const nameInput = document.createElement("input");
    nameInput.className = "spell-making__input";
    nameInput.placeholder = "e.g. Storm Lash";
    nameInput.maxLength = 36;
    nameInput.addEventListener("input", () => this._refreshCostPreview());
    nameField.appendChild(nameInput);
    panel.appendChild(nameField);
    this._nameInput = nameInput;

    const body = document.createElement("div");
    body.className = "spell-making__body";
    panel.appendChild(body);

    const compOne = this._buildComponentCard("Primary Effect");
    body.appendChild(compOne.card);
    this._componentRows.push(compOne.row);

    const compTwo = this._buildComponentCard("Secondary Effect");
    body.appendChild(compTwo.card);
    this._componentRows.push(compTwo.row);

    const includeSecondField = document.createElement("label");
    includeSecondField.className = "spell-making__check";
    const includeSecond = document.createElement("input");
    includeSecond.type = "checkbox";
    includeSecond.checked = false;
    includeSecond.addEventListener("change", () => this._refreshCostPreview());
    includeSecondField.appendChild(includeSecond);
    const includeSecondText = document.createElement("span");
    includeSecondText.textContent = "Enable secondary effect";
    includeSecondField.appendChild(includeSecondText);
    panel.appendChild(includeSecondField);
    this._includeSecondInput = includeSecond;

    const cost = document.createElement("p");
    cost.className = "spell-making__cost";
    panel.appendChild(cost);
    this._costEl = cost;

    const status = document.createElement("p");
    status.className = "spell-making__status";
    status.textContent = "Forge a spell to add it to your known spells.";
    panel.appendChild(status);
    this._statusEl = status;

    const actions = document.createElement("div");
    actions.className = "spell-making__actions";
    panel.appendChild(actions);

    const forgeBtn = document.createElement("button");
    forgeBtn.className = "spell-making__btn spell-making__btn--primary";
    forgeBtn.textContent = "Forge Spell";
    forgeBtn.addEventListener("click", () => this._emitForgeRequest());
    actions.appendChild(forgeBtn);
    this._forgeButton = forgeBtn;

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "spell-making__btn";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => this.close());
    actions.appendChild(cancelBtn);

    document.body.appendChild(root);
    this._root = root;
  }

  private _buildComponentCard(title: string): {
    card: HTMLDivElement;
    row: {
      wrap: HTMLDivElement;
      effect: HTMLSelectElement;
      school: HTMLSelectElement;
      magnitude: HTMLInputElement;
      duration: HTMLInputElement;
      damageType: HTMLSelectElement;
    };
  } {
    const card = document.createElement("div");
    card.className = "spell-making__component";

    const heading = document.createElement("h3");
    heading.className = "spell-making__component-title";
    heading.textContent = title;
    card.appendChild(heading);

    const fields = document.createElement("div");
    fields.className = "spell-making__component-fields";
    card.appendChild(fields);

    const effect = this._createSelect(
      "Effect",
      SPELL_COMPONENT_EFFECTS.map((value) => ({ label: value.replace("_", " "), value })),
      fields,
    );
    const school = this._createSelect(
      "School",
      SPELL_COMPONENT_SCHOOLS.map((value) => ({ label: value, value })),
      fields,
    );
    const magnitude = this._createNumberInput("Magnitude", 1, 200, 1, fields);
    magnitude.value = "15";
    const duration = this._createNumberInput("Duration (s)", 0, 120, 1, fields);
    duration.value = "3";
    const damageType = this._createSelect(
      "Damage Type",
      SPELL_COMPONENT_DAMAGE_TYPES.map((value) => ({ label: value, value })),
      fields,
    );

    const onAnyChange = () => {
      this._toggleDamageTypeVisibility();
      this._refreshCostPreview();
    };

    effect.addEventListener("change", onAnyChange);
    school.addEventListener("change", onAnyChange);
    magnitude.addEventListener("input", onAnyChange);
    duration.addEventListener("input", onAnyChange);
    damageType.addEventListener("change", onAnyChange);

    return {
      card,
      row: {
        wrap: card,
        effect,
        school,
        magnitude,
        duration,
        damageType,
      },
    };
  }

  private _createSelect(
    label: string,
    options: Array<{ label: string; value: string }>,
    parent: HTMLElement,
  ): HTMLSelectElement {
    const field = document.createElement("label");
    field.className = "spell-making__field";
    const text = document.createElement("span");
    text.className = "spell-making__label";
    text.textContent = label;
    field.appendChild(text);

    const select = document.createElement("select");
    select.className = "spell-making__select";
    for (const option of options) {
      const opt = document.createElement("option");
      opt.value = option.value;
      opt.textContent = option.label;
      select.appendChild(opt);
    }
    field.appendChild(select);
    parent.appendChild(field);
    return select;
  }

  private _createNumberInput(
    label: string,
    min: number,
    max: number,
    step: number,
    parent: HTMLElement,
  ): HTMLInputElement {
    const field = document.createElement("label");
    field.className = "spell-making__field";
    const text = document.createElement("span");
    text.className = "spell-making__label";
    text.textContent = label;
    field.appendChild(text);

    const input = document.createElement("input");
    input.className = "spell-making__input";
    input.type = "number";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    field.appendChild(input);
    parent.appendChild(field);
    return input;
  }

  private _resetDefaults(): void {
    if (!this._nameInput || !this._includeSecondInput || this._componentRows.length < 2) return;

    this._nameInput.value = "";
    this._includeSecondInput.checked = false;
    for (const row of this._componentRows) {
      const draft = makeDefaultDraft();
      row.effect.value = draft.effectType;
      row.school.value = draft.school;
      row.magnitude.value = String(draft.magnitude);
      row.duration.value = String(draft.duration);
      row.damageType.value = draft.damageType;
    }
    this.showStatus("Forge a spell to add it to your known spells.", false);
    this._toggleDamageTypeVisibility();
    this._refreshCostPreview();
  }

  private _toggleDamageTypeVisibility(): void {
    for (const row of this._componentRows) {
      const showDamageType = row.effect.value === "damage";
      row.damageType.parentElement?.classList.toggle("is-hidden", !showDamageType);
    }
  }

  private _collectComponents(): SpellComponent[] {
    const includeSecond = this._includeSecondInput?.checked ?? false;
    const count = includeSecond ? 2 : 1;
    const components: SpellComponent[] = [];
    for (let idx = 0; idx < count; idx++) {
      const row = this._componentRows[idx];
      const effectType = row.effect.value as SpellComponentEffect;
      const component: SpellComponent = {
        effectType,
        school: row.school.value as SpellSchool,
        magnitude: Math.max(1, Math.round(Number(row.magnitude.value) || 1)),
        duration: Math.max(0, Math.round(Number(row.duration.value) || 0)),
      };
      if (effectType === "damage") {
        component.damageType = row.damageType.value as DamageType;
      }
      components.push(component);
    }
    return components;
  }

  private _refreshCostPreview(): void {
    if (!this._costEl || !this._forgeButton) return;
    const components = this._collectComponents();
    const cost = this._computeCost(components);
    this._costEl.textContent = `Estimated cost: ${cost} gold`;
    this._forgeButton.disabled = components.length === 0;
  }

  private _emitForgeRequest(): void {
    const name = this._nameInput?.value.trim() ?? "";
    if (!name) {
      this.showStatus("Enter a spell name.", true);
      return;
    }
    const components = this._collectComponents();
    if (components.length === 0) {
      this.showStatus("Add at least one spell component.", true);
      return;
    }
    this.onForge?.({ name, components });
  }
}

