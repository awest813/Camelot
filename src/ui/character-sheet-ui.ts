import type { AttributeName } from "../systems/attribute-system";
import type { ProgressionSkill } from "../systems/skill-progression-system";

// ── Types ──────────────────────────────────────────────────────────────────────

/**
 * All character data needed to populate the sheet.
 * Every field is optional so callers can supply only what is available.
 */
export interface CharacterSheetData {
  /** Character display name. */
  name?:              string;
  /** Current character level (from PlayerLevelSystem). */
  level?:             number;
  /** Display name of the chosen race. */
  raceName?:          string;
  /** Display name of the chosen class. */
  className?:         string;
  /** Display name of the chosen birthsign. */
  birthsignName?:     string;
  /** Class specialization label (e.g. "Combat", "Magic", "Stealth"). */
  specialization?:    string;
  /**
   * Current effective attribute values (base + modifiers).
   * Keyed by {@link AttributeName}.
   */
  attributes?:        Partial<Record<AttributeName, number>>;
  /** All progression skills from SkillProgressionSystem. */
  skills?:            ReadonlyArray<Readonly<ProgressionSkill>>;
  /** Derived maximum Health. */
  maxHealth?:         number;
  /** Derived maximum Magicka. */
  maxMagicka?:        number;
  /** Derived maximum Stamina. */
  maxStamina?:        number;
  /** Derived carry weight capacity. */
  carryWeight?:       number;
  /** Current fame score. */
  fame?:              number;
  /** Current infamy score. */
  infamy?:            number;
  /** Human-readable fame tier label (e.g. "Known Hero"). */
  fameLabel?:         string;
  /** Human-readable infamy tier label (e.g. "Notorious"). */
  infamyLabel?:       string;
}

/** Display order and labels for attribute rows. */
const ATTRIBUTE_ORDER: Array<{ key: AttributeName; label: string }> = [
  { key: "strength",     label: "Strength"     },
  { key: "endurance",    label: "Endurance"     },
  { key: "intelligence", label: "Intelligence"  },
  { key: "agility",      label: "Agility"       },
  { key: "willpower",    label: "Willpower"     },
  { key: "speed",        label: "Speed"         },
  { key: "luck",         label: "Luck"          },
];

// ── CharacterSheetUI ───────────────────────────────────────────────────────────

/**
 * CharacterSheetUI — player character summary overlay.
 *
 * Displays the character's identity (name, level, race, class, birthsign),
 * all seven primary attributes, progression skill levels, key derived stats,
 * and fame / infamy reputation.
 *
 * Call `update(data)` whenever any of the underlying values change to keep
 * the panel in sync without re-creating the DOM.
 *
 * Wire-up example:
 * ```ts
 * const ui = new CharacterSheetUI();
 *
 * function refreshSheet(): void {
 *   ui.update({
 *     name:          player.name,
 *     level:         playerLevelSystem.characterLevel,
 *     raceName:      raceSystem.chosenRace?.name,
 *     className:     classSystem.chosenClass?.name,
 *     birthsignName: birthsignSystem.chosenSign?.name,
 *     specialization: classSystem.chosenClass?.specialization,
 *     attributes:    attributeSystem.getAll(),
 *     skills:        skillProgressionSystem.getAllSkills(),
 *     maxHealth:     attributeSystem.maxHealth,
 *     maxMagicka:    attributeSystem.maxMagicka,
 *     maxStamina:    attributeSystem.maxStamina,
 *     carryWeight:   attributeSystem.carryWeight,
 *     fame:          fameSystem.fame,
 *     infamy:        fameSystem.infamy,
 *     fameLabel:     fameSystem.fameLabel,
 *     infamyLabel:   fameSystem.infamyLabel,
 *   });
 * }
 *
 * // Open / close via keybinding (Tab):
 * window.addEventListener("keydown", (e) => {
 *   if (e.key === "Tab") {
 *     e.preventDefault();
 *     ui.isVisible ? ui.hide() : ui.show();
 *     if (ui.isVisible) refreshSheet();
 *   }
 * });
 * ```
 */
export class CharacterSheetUI {
  public isVisible: boolean = false;

  private _root:          HTMLDivElement | null = null;
  private _identityEl:    HTMLDivElement | null = null;
  private _attributesEl:  HTMLDivElement | null = null;
  private _skillsEl:      HTMLDivElement | null = null;
  private _derivedEl:     HTMLDivElement | null = null;
  private _reputationEl:  HTMLDivElement | null = null;

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Make the panel visible. Creates the root DOM lazily on first call. */
  public show(): void {
    if (typeof document === "undefined") return;
    this._ensureDom();
    if (this._root) this._root.style.display = "flex";
    this.isVisible = true;
  }

  /** Hide the panel without destroying its DOM. */
  public hide(): void {
    if (this._root) this._root.style.display = "none";
    this.isVisible = false;
  }

  /**
   * Refresh the sheet with new character data.
   * Safe to call with a partial object — missing fields show placeholder dashes.
   *
   * @param data — Snapshot of all character data to display.
   */
  public update(data: CharacterSheetData): void {
    if (typeof document === "undefined") return;
    this._ensureDom();
    this._renderIdentity(data);
    this._renderAttributes(data.attributes);
    this._renderSkills(data.skills);
    this._renderDerived(data);
    this._renderReputation(data);
  }

  /** Remove the DOM element entirely and reset state. */
  public destroy(): void {
    this._root?.remove();
    this._root         = null;
    this._identityEl   = null;
    this._attributesEl = null;
    this._skillsEl     = null;
    this._derivedEl    = null;
    this._reputationEl = null;
    this.isVisible     = false;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private _ensureDom(): void {
    if (this._root || typeof document === "undefined") return;

    const root = document.createElement("div");
    root.className = "character-sheet-ui";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "Character Sheet");
    root.style.display = "none";

    // ── Header ────────────────────────────────────────────────────────────────
    const header = document.createElement("header");
    header.className = "character-sheet-ui__header";
    root.appendChild(header);

    const titleEl = document.createElement("h2");
    titleEl.className = "character-sheet-ui__title";
    titleEl.textContent = "Character Sheet";
    header.appendChild(titleEl);

    // ── Scrollable body ───────────────────────────────────────────────────────
    const body = document.createElement("div");
    body.className = "character-sheet-ui__body";
    root.appendChild(body);

    // Identity section
    const identityEl = document.createElement("section");
    identityEl.className = "character-sheet-ui__section character-sheet-ui__identity";
    identityEl.setAttribute("aria-label", "Character identity");
    body.appendChild(identityEl);
    this._identityEl = identityEl;

    // Columns wrapper
    const cols = document.createElement("div");
    cols.className = "character-sheet-ui__cols";
    body.appendChild(cols);

    // Attributes column
    const attrCol = document.createElement("section");
    attrCol.className = "character-sheet-ui__section character-sheet-ui__attributes";
    attrCol.setAttribute("aria-label", "Attributes");
    cols.appendChild(attrCol);
    this._attributesEl = attrCol;

    // Skills column
    const skillsCol = document.createElement("section");
    skillsCol.className = "character-sheet-ui__section character-sheet-ui__skills";
    skillsCol.setAttribute("aria-label", "Skills");
    cols.appendChild(skillsCol);
    this._skillsEl = skillsCol;

    // Derived stats section
    const derivedEl = document.createElement("section");
    derivedEl.className = "character-sheet-ui__section character-sheet-ui__derived";
    derivedEl.setAttribute("aria-label", "Derived stats");
    body.appendChild(derivedEl);
    this._derivedEl = derivedEl;

    // Reputation section
    const reputationEl = document.createElement("section");
    reputationEl.className = "character-sheet-ui__section character-sheet-ui__reputation";
    reputationEl.setAttribute("aria-label", "Reputation");
    body.appendChild(reputationEl);
    this._reputationEl = reputationEl;

    // ── Close button ──────────────────────────────────────────────────────────
    const closeBtn = document.createElement("button");
    closeBtn.className = "character-sheet-ui__close";
    closeBtn.type = "button";
    closeBtn.textContent = "✕";
    closeBtn.setAttribute("aria-label", "Close character sheet");
    closeBtn.addEventListener("click", () => this.hide());
    root.appendChild(closeBtn);

    document.body.appendChild(root);
    this._root = root;
  }

  private _renderIdentity(data: CharacterSheetData): void {
    if (!this._identityEl) return;
    this._identityEl.innerHTML = "";

    const rows: Array<{ label: string; value: string | number | undefined }> = [
      { label: "Name",           value: data.name         },
      { label: "Level",          value: data.level        },
      { label: "Race",           value: data.raceName     },
      { label: "Class",          value: data.className    },
      { label: "Birthsign",      value: data.birthsignName },
      { label: "Specialization", value: data.specialization },
    ];

    for (const row of rows) {
      this._identityEl.appendChild(
        this._buildRow("identity", row.label, row.value),
      );
    }
  }

  private _renderAttributes(
    attributes: Partial<Record<AttributeName, number>> | undefined,
  ): void {
    if (!this._attributesEl) return;
    this._attributesEl.innerHTML = "";

    const heading = document.createElement("h3");
    heading.className = "character-sheet-ui__section-title";
    heading.textContent = "Attributes";
    this._attributesEl.appendChild(heading);

    for (const { key, label } of ATTRIBUTE_ORDER) {
      const value = attributes?.[key];
      const row = this._buildRow("attr", label, value);
      row.setAttribute("data-attribute", key);
      this._attributesEl.appendChild(row);
    }
  }

  private _renderSkills(
    skills: ReadonlyArray<Readonly<ProgressionSkill>> | undefined,
  ): void {
    if (!this._skillsEl) return;
    this._skillsEl.innerHTML = "";

    const heading = document.createElement("h3");
    heading.className = "character-sheet-ui__section-title";
    heading.textContent = "Skills";
    this._skillsEl.appendChild(heading);

    if (!skills || skills.length === 0) {
      const empty = document.createElement("p");
      empty.className = "character-sheet-ui__empty";
      empty.textContent = "No skill data available.";
      this._skillsEl.appendChild(empty);
      return;
    }

    for (const skill of skills) {
      const row = this._buildRow("skill", skill.name, skill.level);
      row.setAttribute("data-skill-id", skill.id);
      // Add XP progress bar
      const progressEl = document.createElement("span");
      progressEl.className = "character-sheet-ui__skill-xp";
      const pct = skill.xpToNext > 0
        ? Math.floor((skill.xp / skill.xpToNext) * 100)
        : 0;
      progressEl.textContent = `(${pct}%)`;
      progressEl.setAttribute("aria-label", `${pct}% to next level`);
      row.appendChild(progressEl);
      this._skillsEl.appendChild(row);
    }
  }

  private _renderDerived(data: CharacterSheetData): void {
    if (!this._derivedEl) return;
    this._derivedEl.innerHTML = "";

    const heading = document.createElement("h3");
    heading.className = "character-sheet-ui__section-title";
    heading.textContent = "Derived Stats";
    this._derivedEl.appendChild(heading);

    const rows: Array<{ label: string; value: number | undefined }> = [
      { label: "Max Health",    value: data.maxHealth   },
      { label: "Max Magicka",   value: data.maxMagicka  },
      { label: "Max Stamina",   value: data.maxStamina  },
      { label: "Carry Weight",  value: data.carryWeight },
    ];

    for (const row of rows) {
      this._derivedEl.appendChild(
        this._buildRow("derived", row.label, row.value),
      );
    }
  }

  private _renderReputation(data: CharacterSheetData): void {
    if (!this._reputationEl) return;
    this._reputationEl.innerHTML = "";

    const heading = document.createElement("h3");
    heading.className = "character-sheet-ui__section-title";
    heading.textContent = "Reputation";
    this._reputationEl.appendChild(heading);

    // Fame row
    const fameRow = this._buildRow("rep", "Fame", data.fame);
    if (data.fameLabel) {
      const labelEl = document.createElement("span");
      labelEl.className = "character-sheet-ui__rep-label";
      labelEl.textContent = data.fameLabel;
      fameRow.appendChild(labelEl);
    }
    this._reputationEl.appendChild(fameRow);

    // Infamy row
    const infamyRow = this._buildRow("rep", "Infamy", data.infamy);
    if (data.infamyLabel) {
      const labelEl = document.createElement("span");
      labelEl.className = "character-sheet-ui__rep-label";
      labelEl.textContent = data.infamyLabel;
      infamyRow.appendChild(labelEl);
    }
    this._reputationEl.appendChild(infamyRow);
  }

  /**
   * Build a generic labeled-value row div.
   * Used across all sections for consistent markup.
   */
  private _buildRow(
    prefix: string,
    label: string,
    value: string | number | undefined,
  ): HTMLDivElement {
    const row = document.createElement("div");
    row.className = `character-sheet-ui__row character-sheet-ui__${prefix}-row`;

    const labelEl = document.createElement("span");
    labelEl.className = "character-sheet-ui__row-label";
    labelEl.textContent = label;
    row.appendChild(labelEl);

    const valueEl = document.createElement("span");
    valueEl.className = "character-sheet-ui__row-value";
    valueEl.textContent = value !== undefined ? String(value) : "—";
    row.appendChild(valueEl);

    return row;
  }
}
