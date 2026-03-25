import type { AttributeName } from "../systems/attribute-system";
import type { AttributeBonuses } from "../systems/player-level-system";

/** Per-attribute display metadata. */
interface AttributeMeta {
  label: string;
  governingSkills: string;
}

const ATTRIBUTE_META: Record<AttributeName, AttributeMeta> = {
  strength:     { label: "Strength",     governingSkills: "Blade" },
  endurance:    { label: "Endurance",    governingSkills: "Block" },
  intelligence: { label: "Intelligence", governingSkills: "Alchemy" },
  agility:      { label: "Agility",      governingSkills: "Marksman" },
  willpower:    { label: "Willpower",    governingSkills: "Destruction, Restoration" },
  speed:        { label: "Speed",        governingSkills: "Sneak" },
  luck:         { label: "Luck",         governingSkills: "Speechcraft" },
};

const ATTRIBUTE_ORDER: AttributeName[] = [
  "strength", "endurance", "intelligence", "agility", "willpower", "speed", "luck",
];

/**
 * Level-Up dialog that presents all seven attribute bonuses and lets the
 * player manually choose three attributes to increase.
 *
 * The dialog is modal — it cannot be closed until the player confirms their
 * selection, matching Oblivion's level-up flow.
 *
 * Wire-up:
 * ```ts
 * levelUpUI.onConfirm = (primary, sec1, sec2) => {
 *   playerLevelSystem.confirmLevelUp(primary, sec1, sec2);
 * };
 * // In playerLevelSystem.onLevelUpReady:
 * levelUpUI.open(newLevel, bonuses);
 * ```
 */
export class LevelUpUI {
  public isVisible: boolean = false;

  /** Called with the three chosen attributes when the player confirms. */
  public onConfirm: ((primary: AttributeName, sec1: AttributeName, sec2: AttributeName) => void) | null = null;

  private _root: HTMLDivElement | null = null;
  private _headingEl: HTMLHeadingElement | null = null;
  private _subtitleEl: HTMLParagraphElement | null = null;
  private _rowEls: Map<AttributeName, HTMLButtonElement> = new Map();
  private _selectionEl: HTMLParagraphElement | null = null;
  private _confirmBtn: HTMLButtonElement | null = null;

  private _bonuses: AttributeBonuses | null = null;
  private _selected: AttributeName[] = [];
  private _newLevel: number = 1;

  /** Open the dialog for the given new character level and available bonuses. */
  public open(newLevel: number, bonuses: AttributeBonuses): void {
    if (typeof document === "undefined") return;
    this._newLevel = newLevel;
    this._bonuses = bonuses;
    this._selected = [];
    this._ensureDom();
    this._refresh();
    if (this._root) this._root.style.display = "grid";
    this.isVisible = true;
    // Move keyboard focus to the first attribute button for accessibility.
    const firstAttrBtn = this._rowEls.get("strength");
    firstAttrBtn?.focus();
  }

  public close(): void {
    if (!this._root) return;
    this._root.style.display = "none";
    this.isVisible = false;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private _ensureDom(): void {
    if (this._root || typeof document === "undefined") return;

    const root = document.createElement("div");
    root.className = "level-up";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "level-up-title");
    root.style.display = "none";

    const panel = document.createElement("section");
    panel.className = "level-up__panel";
    root.appendChild(panel);

    // Header
    const header = document.createElement("header");
    header.className = "level-up__header";
    panel.appendChild(header);

    const titleWrap = document.createElement("div");
    titleWrap.className = "level-up__title-wrap";
    header.appendChild(titleWrap);

    const heading = document.createElement("h2");
    heading.id = "level-up-title";
    heading.className = "level-up__title";
    heading.textContent = "Character Level Up!";
    titleWrap.appendChild(heading);
    this._headingEl = heading;

    const subtitle = document.createElement("p");
    subtitle.className = "level-up__subtitle";
    titleWrap.appendChild(subtitle);
    this._subtitleEl = subtitle;

    // Attribute list
    const list = document.createElement("ul");
    list.className = "level-up__list";
    list.setAttribute("aria-label", "Attribute choices");
    panel.appendChild(list);

    for (const attr of ATTRIBUTE_ORDER) {
      const meta = ATTRIBUTE_META[attr];

      const li = document.createElement("li");
      li.className = "level-up__item";
      list.appendChild(li);

      const btn = document.createElement("button");
      btn.className = "level-up__attr-btn";
      btn.setAttribute("aria-pressed", "false");
      btn.type = "button";

      const nameEl = document.createElement("span");
      nameEl.className = "level-up__attr-name";
      nameEl.textContent = meta.label;

      const skillEl = document.createElement("span");
      skillEl.className = "level-up__attr-skills";
      skillEl.textContent = meta.governingSkills;

      const bonusEl = document.createElement("span");
      bonusEl.className = "level-up__attr-bonus";

      btn.appendChild(nameEl);
      btn.appendChild(skillEl);
      btn.appendChild(bonusEl);
      li.appendChild(btn);

      btn.addEventListener("click", () => this._toggleAttribute(attr));
      this._rowEls.set(attr, btn);
    }

    // Selection summary + confirm
    const footer = document.createElement("footer");
    footer.className = "level-up__footer";
    panel.appendChild(footer);

    const selectionEl = document.createElement("p");
    selectionEl.className = "level-up__selection";
    footer.appendChild(selectionEl);
    this._selectionEl = selectionEl;

    const confirmBtn = document.createElement("button");
    confirmBtn.className = "level-up__confirm-btn";
    confirmBtn.type = "button";
    confirmBtn.textContent = "Confirm Level-Up";
    confirmBtn.disabled = true;
    confirmBtn.setAttribute("aria-disabled", "true");
    confirmBtn.addEventListener("click", () => this._handleConfirm());
    footer.appendChild(confirmBtn);
    this._confirmBtn = confirmBtn;

    document.body.appendChild(root);
    this._root = root;
  }

  private _toggleAttribute(attr: AttributeName): void {
    const idx = this._selected.indexOf(attr);
    if (idx !== -1) {
      // Deselect
      this._selected.splice(idx, 1);
    } else {
      if (this._selected.length >= 3) return; // Already 3 chosen
      this._selected.push(attr);
    }
    this._refresh();
  }

  private _refresh(): void {
    if (!this._bonuses) return;

    if (this._headingEl) {
      this._headingEl.textContent = `Character Level ${this._newLevel}!`;
    }
    if (this._subtitleEl) {
      this._subtitleEl.textContent = "Choose 3 attributes to increase. Each bonus reflects how many governing skills were leveled.";
    }

    const atFull = this._selected.length >= 3;

    for (const attr of ATTRIBUTE_ORDER) {
      const btn = this._rowEls.get(attr);
      if (!btn) continue;

      const isSelected = this._selected.includes(attr);
      const isDisabled = atFull && !isSelected;

      btn.classList.toggle("is-selected", isSelected);
      btn.classList.toggle("is-disabled", isDisabled);
      btn.setAttribute("aria-pressed", isSelected ? "true" : "false");
      btn.setAttribute("aria-disabled", isDisabled ? "true" : "false");
      btn.disabled = isDisabled;

      const bonusEl = btn.querySelector(".level-up__attr-bonus") as HTMLElement | null;
      if (bonusEl) {
        const bonus = this._bonuses[attr];
        bonusEl.textContent = `+${bonus}`;
        bonusEl.className = `level-up__attr-bonus level-up__attr-bonus--${bonus}`;
      }
    }

    if (this._selectionEl) {
      if (this._selected.length === 0) {
        this._selectionEl.textContent = "Select 3 attributes to continue.";
      } else {
        const names = this._selected.map((a) => ATTRIBUTE_META[a].label).join(", ");
        const remaining = 3 - this._selected.length;
        this._selectionEl.textContent = remaining > 0
          ? `Selected: ${names}. Choose ${remaining} more.`
          : `Selected: ${names}.`;
      }
    }

    if (this._confirmBtn) {
      this._confirmBtn.disabled = this._selected.length !== 3;
      this._confirmBtn.setAttribute("aria-disabled", (this._selected.length !== 3).toString());
    }
  }

  private _handleConfirm(): void {
    if (this._selected.length !== 3) return;
    const [primary, sec1, sec2] = this._selected as [AttributeName, AttributeName, AttributeName];
    this.close();
    this.onConfirm?.(primary, sec1, sec2);
  }
}
