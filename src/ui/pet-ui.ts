/**
 * PetUI — HUD widget and management panel for the Camelot pet/companion system.
 *
 * Layout:
 *   HUD widget  — compact bar in the bottom-right corner; always visible when a
 *                 pet is active.  Shows species icon, name, health bar, and level.
 *   Pet panel   — full modal opened with [P].  Lists all owned pets, stats, mood,
 *                 and Summon / Dismiss buttons.
 *
 * Style follows the dark-amber design language used throughout the project.
 * Implemented as plain DOM so it matches the StableUI / SaddlebagUI pattern.
 */

import { CompanionChip, SPECIES_ICON, petChip } from "./companion-chip";
import type { Pet, PetTemplate } from "../systems/pet-system";
import { manageDialogFocus, type DialogFocusSession } from "./dialog-focus";

// ── Design tokens (mirrors UIManager) ─────────────────────────────────────
/** The tome palette (src/css/tome.css), for a panel styled inline. */
const C = {
  BG:       "rgba(30, 19, 11, 0.97)",
  BORDER:   "#8A6A2C",
  TITLE:    "#F1D08A",
  TEXT:     "#EADBB8",
  DIM:      "#B49F78",
  HP_FILL:  "#CC1A1A",
  HP_BG:    "rgba(60, 4, 4, 0.7)",
  XP_FILL:  "#D4A017",
  XP_BG:    "rgba(30, 18, 0, 0.7)",
  MOOD_OK:  "#5EC45E",
  MOOD_LOW: "#CC9910",
  MOOD_BAD: "#CC1A1A",
  BTN_BG:   "rgba(42, 26, 16, 0.96)",
  BTN_HVR:  "rgba(74, 47, 27, 0.98)",
  FONT:     "'Cinzel', 'Times New Roman', Georgia, serif",
  /** Body/button face — Cinzel is all-caps display type, unreadable for prose. */
  BODY:     "'EB Garamond', Georgia, serif",
  MONO:     "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
};

function pct(val: number, max: number): string {
  if (max <= 0) return "0%";
  return `${Math.min(100, Math.max(0, (val / max) * 100)).toFixed(1)}%`;
}

// ── PetUI ──────────────────────────────────────────────────────────────────

export class PetUI {
  /** True while the management panel is open. */
  public isVisible: boolean = false;
  /** Active focus trap/restore session while the panel is open (null when closed). */
  private _focusSession: DialogFocusSession | null = null;

  public onSummon:  ((petId: string) => void) | null = null;
  public onDismiss: (() => void) | null = null;
  public onClose:   (() => void) | null = null;

  // ── HUD chip ───────────────────────────────────────────────────────────────
  private readonly _hud = new CompanionChip(1, 120, false);

  // ── Management panel ────────────────────────────────────────────────────────
  private _panelRoot:   HTMLDivElement | null = null;
  private _panelList:   HTMLDivElement | null = null;

  // ── State cache ─────────────────────────────────────────────────────────────
  private _pets:        Pet[]           = [];
  private _activePetId: string | null   = null;

  // ══════════════════════════════════════════════════════════════════════════
  // ── HUD widget ────────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  /** Show / refresh the HUD chip (the feature drives its own chip; this is for a panel used alone). */
  public updateHUD(activePet: Pet | null): void {
    this._hud.show(activePet && petChip(activePet));
  }

  /** Hide the HUD chip. */
  public hideHUD(): void {
    this._hud.hide();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── Management panel ──────────────────────────────────────────════════════
  // ══════════════════════════════════════════════════════════════════════════

  /** Open the pet management panel, refreshing with current state. */
  public open(pets: Pet[], activePetId: string | null): void {
    if (typeof document === "undefined") return;
    this._pets        = pets.slice();
    this._activePetId = activePetId;

    this._ensurePanel();
    this._renderPanel();
    this._panelRoot!.style.display = "flex";
    this._panelRoot!.focus();
    this.isVisible = true;
    if (!this._focusSession && this._panelRoot) this._focusSession = manageDialogFocus(this._panelRoot);
  }

  /** Close the management panel. */
  public close(): void {
    if (this._panelRoot) this._panelRoot.style.display = "none";
    this.isVisible = false;
    this._focusSession?.release();
    this._focusSession = null;
  }

  /** Refresh the panel and HUD with new state without reopening if already closed. */
  public refresh(pets: Pet[], activePetId: string | null): void {
    this._pets        = pets.slice();
    this._activePetId = activePetId;
    if (this.isVisible) this._renderPanel();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── Private — HUD construction ────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  // ══════════════════════════════════════════════════════════════════════════
  // ── Private — Panel construction ──────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  private _ensurePanel(): void {
    if (this._panelRoot) return;

    const root = document.createElement("div");
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "pet-panel-title");
    root.tabIndex = -1;
    root.className = "pet-ui";
    Object.assign(root.style, {
      position:       "fixed",
      top:            "50%",
      left:           "50%",
      transform:      "translate(-50%, -50%)",
      display:        "none",
      flexDirection:  "column",
      gap:            "10px",
      background:     C.BG,
      border:         `1px solid ${C.BORDER}`,
      borderRadius:   "10px",
      boxShadow:      "0 20px 60px rgba(0, 0, 0, 0.85), 0 0 0 100vmax rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 230, 180, 0.1)",
      backdropFilter: "blur(4px)",
      padding:        "18px",
      zIndex:         "1600",
      minWidth:       "min(340px, calc(100vw - 56px))",
      maxWidth:       "480px",
      maxHeight:      "80vh",
      overflowY:      "auto",
      fontFamily:     C.BODY,
      color:          C.TEXT,
    });

    // ── Header ──────────────────────────────────────────────────────────────
    const header = document.createElement("div");
    Object.assign(header.style, {
      display: "flex", justifyContent: "space-between", alignItems: "center",
    });

    const title = document.createElement("h3");
    title.id = "pet-panel-title";
    Object.assign(title.style, {
      margin: "0", fontFamily: C.FONT, color: C.TITLE, fontSize: "17px", letterSpacing: "1px",
    });
    title.textContent = "COMPANIONS";

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    _styleButton(closeBtn, "✕", { fontSize: "18px", padding: "0 6px" });
    closeBtn.setAttribute("aria-label", "Close companions panel");
    closeBtn.addEventListener("click", () => {
      this.close();
      this.onClose?.();
    });

    header.append(title, closeBtn);

    // ── Hint ─────────────────────────────────────────────────────────────────
    const hint = document.createElement("p");
    Object.assign(hint.style, { margin: "0", fontSize: "13px", color: C.DIM });
    hint.textContent = "P or Esc to close  ·  Only one companion may be active at a time";

    // ── Pet list ─────────────────────────────────────────────────────────────
    const listEl = document.createElement("div");
    Object.assign(listEl.style, { display: "flex", flexDirection: "column", gap: "8px" });

    root.append(header, hint, listEl);

    root.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        this.close();
        this.onClose?.();
      }
    });

    document.body.appendChild(root);

    this._panelRoot = root;
    this._panelList = listEl;
  }

  private _renderPanel(): void {
    const list = this._panelList;
    if (!list) return;
    list.innerHTML = "";

    if (this._pets.length === 0) {
      const empty = document.createElement("p");
      Object.assign(empty.style, { color: C.DIM, fontSize: "15px", textAlign: "center" });
      empty.textContent = "You have no companions yet.";
      list.appendChild(empty);
      return;
    }

    for (const pet of this._pets) {
      list.appendChild(this._buildPetCard(pet));
    }
  }

  private _buildPetCard(pet: Pet): HTMLDivElement {
    const isActive = pet.id === this._activePetId;

    const card = document.createElement("div");
    Object.assign(card.style, {
      background:   isActive ? "rgba(107, 79, 18, 0.25)" : "rgba(20, 14, 4, 0.7)",
      border:       `1px solid ${isActive ? C.BORDER : "rgba(107, 79, 18, 0.4)"}`,
      borderRadius: "5px",
      padding:      "10px",
      display:      "flex",
      flexDirection:"column",
      gap:          "6px",
    });

    // ── Top row: icon + name + level + active badge ──────────────────────────
    const topRow = document.createElement("div");
    Object.assign(topRow.style, {
      display: "flex", alignItems: "center", gap: "8px",
    });

    const icon = document.createElement("span");
    icon.style.fontSize = "22px";
    icon.textContent = SPECIES_ICON[pet.species] ?? "★";

    const nameBlock = document.createElement("div");
    Object.assign(nameBlock.style, { flex: "1" });

    const nameEl = document.createElement("div");
    Object.assign(nameEl.style, {
      color: pet.isDead ? C.DIM : C.TITLE, fontSize: "16px", fontWeight: "bold",
    });
    nameEl.textContent = `${pet.name}${pet.isDead ? " (deceased)" : ""}`;

    const subEl = document.createElement("div");
    Object.assign(subEl.style, { color: C.DIM, fontSize: "13px" });
    subEl.textContent = `${_capitalise(pet.species)}  ·  Level ${pet.level}`;

    nameBlock.append(nameEl, subEl);

    if (isActive) {
      const badge = document.createElement("span");
      Object.assign(badge.style, {
        background: C.BORDER, color: "#FFF8DC", fontSize: "12px",
        padding: "2px 5px", borderRadius: "3px", fontFamily: C.MONO,
      });
      badge.textContent = "ACTIVE";
      topRow.append(icon, nameBlock, badge);
    } else {
      topRow.append(icon, nameBlock);
    }

    // ── Stats grid ────────────────────────────────────────────────────────────
    const stats = document.createElement("div");
    Object.assign(stats.style, {
      display: "grid", gridTemplateColumns: "1fr 1fr",
      gap: "4px 12px", fontSize: "13px", color: C.DIM,
    });
    stats.innerHTML = `
      <span>HP</span><span style="color:${C.TEXT}">${Math.ceil(pet.health)} / ${pet.maxHealth}</span>
      <span>ATK</span><span style="color:${C.TEXT}">${pet.attackDamage}</span>
      <span>SPD</span><span style="color:${C.TEXT}">${pet.moveSpeed.toFixed(1)}</span>
      <span>MOOD</span><span style="color:${_moodColor(pet.mood)}">${_moodLabel(pet.mood)} (${Math.round(pet.mood)})</span>
    `;

    // ── HP bar ────────────────────────────────────────────────────────────────
    const hpBar = _buildBar(pet.health, pet.maxHealth, C.HP_FILL, C.HP_BG);

    // ── XP bar ────────────────────────────────────────────────────────────────
    const xpThreshold = 100 * pet.level;
    const xpBar = _buildBar(pet.experience, xpThreshold, C.XP_FILL, C.XP_BG, "XP");

    // ── Action button ─────────────────────────────────────────────────────────
    const actionRow = document.createElement("div");
    actionRow.style.display = "flex";
    actionRow.style.justifyContent = "flex-end";

    if (!pet.isDead) {
      const btn = document.createElement("button");
      btn.type = "button";
      if (isActive) {
        _styleButton(btn, "Dismiss");
        btn.setAttribute("aria-label", `Dismiss ${pet.name}`);
        btn.addEventListener("click", () => {
          this.onDismiss?.();
        });
      } else {
        _styleButton(btn, "Summon");
        btn.setAttribute("aria-label", `Summon ${pet.name}`);
        btn.addEventListener("click", () => {
          this.onSummon?.(pet.id);
        });
      }
      actionRow.appendChild(btn);
    }

    card.append(topRow, stats, hpBar, xpBar, actionRow);
    return card;
  }
}

// ── Private helpers ────────────────────────────────────────────────────────

function _capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function _moodColor(mood: number): string {
  if (mood >= 60) return C.MOOD_OK;
  if (mood >= 30) return C.MOOD_LOW;
  return C.MOOD_BAD;
}

function _moodLabel(mood: number): string {
  if (mood >= 80) return "Happy";
  if (mood >= 60) return "Content";
  if (mood >= 40) return "Neutral";
  if (mood >= 20) return "Uneasy";
  return "Unhappy";
}

function _buildBar(
  value: number,
  max: number,
  fillColor: string,
  bgColor: string,
  label?: string,
): HTMLDivElement {
  const wrapper = document.createElement("div");
  Object.assign(wrapper.style, { display: "flex", alignItems: "center", gap: "4px" });

  if (label) {
    const lbl = document.createElement("span");
    Object.assign(lbl.style, { color: C.DIM, fontSize: "14px", minWidth: "14px" });
    lbl.textContent = label;
    wrapper.appendChild(lbl);
  }

  const outer = document.createElement("div");
  Object.assign(outer.style, {
    flex: "1", background: bgColor, borderRadius: "2px",
    height: "5px", overflow: "hidden",
  });

  const fill = document.createElement("div");
  Object.assign(fill.style, {
    background: fillColor, height: "100%",
    width: pct(value, max), transition: "width 0.2s ease",
  });

  outer.appendChild(fill);
  wrapper.appendChild(outer);
  return wrapper;
}

function _styleButton(
  btn: HTMLButtonElement,
  text: string,
  overrides: Partial<CSSStyleDeclaration> = {},
): void {
  btn.textContent = text;
  Object.assign(btn.style, {
    background:    C.BTN_BG,
    border:        `1px solid ${C.BORDER}`,
    color:         C.TEXT,
    borderRadius:  "4px",
    padding:       "4px 10px",
    cursor:        "pointer",
    fontSize:      "14px",
    fontFamily:    C.BODY,
    ...overrides,
  });
  btn.addEventListener("mouseenter", () => { btn.style.background = C.BTN_HVR; });
  btn.addEventListener("mouseleave", () => { btn.style.background = C.BTN_BG; });
}

// Re-export template type so callers don't need a second import
export type { PetTemplate };
