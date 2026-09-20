import type { AttributeName } from "../systems/attribute-system";
import { manageDialogFocus, type DialogFocusSession } from "./dialog-focus";
import type { ProgressionSkill } from "../systems/skill-progression-system";
import type { PerkEntry } from "../systems/perk-system";
import { getAttributeIcon, getStatIcon } from "./icon-utils";

// ── Types ──────────────────────────────────────────────────────────────────────

/**
 * All character data needed to populate the sheet.
 * Every field is optional so callers can supply only what is available.
 */
export interface CharacterSheetData {
  /** Character display name. */
  name?:              string;
  /** Oblivion-style character level (major-skill cycles via PlayerLevelSystem). */
  level?:             number;
  /** Combat XP tier from the demo Player entity (`player.level`). */
  xpLevel?:           number;
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
  /** Available perk points to spend. */
  perkPoints?:        number;
  /** All perk entries (with unlock/eligibility state) from PerkSystem. */
  perks?:             ReadonlyArray<PerkEntry>;
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
 *     xpLevel:       player.level,
 *     raceName:      raceSystem.chosenRace?.name,
 *     className:     classSystem.chosenClass?.name,
 *     birthsignName: birthsignSystem.chosenBirthsign?.name,
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
  /** Active focus trap/restore session while the panel is open (null when closed). */
  private _focusSession: DialogFocusSession | null = null;
  /** Fired when the ✕ button closes the sheet (Escape is owned by the game cascade). */
  public onClose: (() => void) | null = null;
  /** Fired when the player clicks a perk's Unlock button. */
  public onPerkUnlock: ((perkId: string) => void) | null = null;

  private _root:          HTMLDivElement | null = null;
  private _identityEl:    HTMLElement | null = null;
  private _attributesEl:  HTMLElement | null = null;
  private _skillsEl:      HTMLElement | null = null;
  private _perksEl:       HTMLElement | null = null;
  private _derivedEl:     HTMLElement | null = null;
  private _reputationEl:  HTMLElement | null = null;

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Make the panel visible. Creates the root DOM lazily on first call. */
  public show(): void {
    if (typeof document === "undefined") return;
    this._ensureDom();
    if (this._root) this._root.style.display = "flex";
    this.isVisible = true;
    this._root?.focus();
    if (!this._focusSession && this._root) this._focusSession = manageDialogFocus(this._root);
  }

  /** Hide the panel without destroying its DOM. */
  public hide(): void {
    if (this._root) this._root.style.display = "none";
    this.isVisible = false;
    this._focusSession?.release();
    this._focusSession = null;
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
    this._renderPerks(data);
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
    this._perksEl      = null;
    this._derivedEl    = null;
    this._reputationEl = null;
    this.isVisible     = false;
    this._focusSession?.release();
    this._focusSession = null;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private _ensureDom(): void {
    if (this._root || typeof document === "undefined") return;

    const root = document.createElement("div");
    root.className = "character-sheet-ui";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "Character Sheet");
    root.tabIndex = -1;
    root.style.display = "none";

    // ── Header ────────────────────────────────────────────────────────────────
    const header = document.createElement("header");
    header.className = "character-sheet-ui__header";
    root.appendChild(header);

    const titleEl = document.createElement("h2");
    titleEl.className = "character-sheet-ui__title";
    titleEl.textContent = "Character Sheet";
    header.appendChild(titleEl);

    const hintEl = document.createElement("p");
    hintEl.className = "character-sheet-ui__hint";
    hintEl.textContent = "Press Tab or Esc to close.";
    hintEl.style.cssText = "margin:0;font-size:11px;color:#998877;";
    header.appendChild(hintEl);

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

    // Perks section
    const perksEl = document.createElement("section");
    perksEl.className = "character-sheet-ui__section character-sheet-ui__perks";
    perksEl.setAttribute("aria-label", "Perks");
    body.appendChild(perksEl);
    this._perksEl = perksEl;

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
    closeBtn.addEventListener("click", () => {
      this.hide();
      this.onClose?.();
    });
    root.appendChild(closeBtn);

    root.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        this.hide();
        this.onClose?.();
      }
    });

    document.body.appendChild(root);
    this._root = root;
  }

  private _renderIdentity(data: CharacterSheetData): void {
    if (!this._identityEl) return;
    this._identityEl.innerHTML = "";

    const rows: Array<{ label: string; value: string | number | undefined }> = [
      { label: "Name",           value: data.name         },
      { label: "Character level", value: data.level       },
      { label: "Combat XP level", value: data.xpLevel     },
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
      const row = this._buildRow("attr", label, value, getAttributeIcon(key));
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

  private _renderPerks(data: CharacterSheetData): void {
    if (!this._perksEl) return;
    this._perksEl.innerHTML = "";

    const points = data.perkPoints ?? 0;
    const heading = document.createElement("h3");
    heading.className = "character-sheet-ui__section-title";
    heading.textContent = `Perks — ${points} point${points === 1 ? "" : "s"} available`;
    this._perksEl.appendChild(heading);

    const perks = data.perks;
    if (!perks || perks.length === 0) {
      const empty = document.createElement("p");
      empty.className = "character-sheet-ui__empty";
      empty.textContent = "No perk data available.";
      this._perksEl.appendChild(empty);
      return;
    }

    // Group by skill tree, preserving definition order.
    const bySkill = new Map<string, PerkEntry[]>();
    for (const perk of perks) {
      const list = bySkill.get(perk.skillId) ?? [];
      list.push(perk);
      bySkill.set(perk.skillId, list);
    }

    for (const [skillId, skillPerks] of bySkill) {
      const sub = document.createElement("h4");
      sub.className = "character-sheet-ui__perk-skill";
      sub.textContent = skillId.charAt(0).toUpperCase() + skillId.slice(1);
      sub.style.cssText =
        "margin:10px 0 2px;font-size:12px;color:#c9a25e;text-transform:uppercase;letter-spacing:1px;";
      this._perksEl.appendChild(sub);

      for (const perk of skillPerks) {
        const row = document.createElement("div");
        row.className = "character-sheet-ui__row character-sheet-ui__perk-row";
        row.setAttribute("data-perk-id", perk.id);
        row.style.cssText = "display:flex;justify-content:space-between;align-items:center;gap:8px;";

        const textWrap = document.createElement("div");
        const nameEl = document.createElement("span");
        nameEl.textContent = perk.isUnlocked ? `✓ ${perk.name}` : perk.name;
        if (perk.isUnlocked) nameEl.style.color = "#7fc97f";
        const descEl = document.createElement("p");
        descEl.style.cssText = "margin:0;font-size:11px;color:#998877;";
        descEl.textContent = `${perk.description} (requires ${perk.skillId} ${perk.requiredLevel})`;
        textWrap.appendChild(nameEl);
        textWrap.appendChild(descEl);
        row.appendChild(textWrap);

        if (!perk.isUnlocked) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "character-sheet-ui__perk-buy";
          btn.textContent = "Unlock";
          btn.disabled = !perk.canUnlock;
          btn.setAttribute("aria-disabled", perk.canUnlock ? "false" : "true");
          btn.setAttribute("aria-label", `Unlock perk: ${perk.name}`);
          btn.addEventListener("click", () => this.onPerkUnlock?.(perk.id));
          row.appendChild(btn);
        }

        this._perksEl.appendChild(row);
      }
    }
  }

  private _renderDerived(data: CharacterSheetData): void {
    if (!this._derivedEl) return;
    this._derivedEl.innerHTML = "";

    const heading = document.createElement("h3");
    heading.className = "character-sheet-ui__section-title";
    heading.textContent = "Derived Stats";
    this._derivedEl.appendChild(heading);

    const rows: Array<{ label: string; value: number | undefined; icon: string }> = [
      { label: "Max Health",    value: data.maxHealth,   icon: getStatIcon("health")      },
      { label: "Max Magicka",   value: data.maxMagicka,  icon: getStatIcon("magicka")     },
      { label: "Max Stamina",   value: data.maxStamina,  icon: getStatIcon("stamina")     },
      { label: "Carry Weight",  value: data.carryWeight, icon: getStatIcon("carryWeight") },
    ];

    for (const row of rows) {
      this._derivedEl.appendChild(
        this._buildRow("derived", row.label, row.value, row.icon),
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
    const fameRow = this._buildRow("rep", "Fame", data.fame, getStatIcon("fame"));
    if (data.fameLabel) {
      const labelEl = document.createElement("span");
      labelEl.className = "character-sheet-ui__rep-label";
      labelEl.textContent = data.fameLabel;
      fameRow.appendChild(labelEl);
    }
    this._reputationEl.appendChild(fameRow);

    // Infamy row
    const infamyRow = this._buildRow("rep", "Infamy", data.infamy, getStatIcon("infamy"));
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
    icon?: string,
  ): HTMLDivElement {
    const row = document.createElement("div");
    row.className = `character-sheet-ui__row character-sheet-ui__${prefix}-row`;

    const labelEl = document.createElement("span");
    labelEl.className = "character-sheet-ui__row-label";

    if (icon) {
      const iconEl = document.createElement("span");
      iconEl.className = "character-sheet-ui__row-icon";
      iconEl.setAttribute("aria-hidden", "true");
      iconEl.textContent = icon;
      labelEl.appendChild(iconEl);
    }

    const textNode = document.createTextNode(label);
    labelEl.appendChild(textNode);
    row.appendChild(labelEl);

    const valueEl = document.createElement("span");
    valueEl.className = "character-sheet-ui__row-value";
    valueEl.textContent = value !== undefined ? String(value) : "—";
    row.appendChild(valueEl);

    return row;
  }
}
