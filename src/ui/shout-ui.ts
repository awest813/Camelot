/**
 * ShoutUI — the Words of the Old Tongue: the panel and the HUD chip.
 *
 * Layout:
 *   HUD chip    — compact indicator in the bottom-right corner; visible while a
 *                 shout is equipped.  Shows the shout name, unlocked word count,
 *                 and READY / cooldown countdown state.
 *   Shout panel — full modal opened with [N].  Lists every registered shout with
 *                 its three ranks, per-word learned/unlocked state, tier
 *                 effect preview, and Choose / Master (awen) actions.
 *
 * Style follows the dark-amber design language used throughout the project.
 * Implemented as plain DOM so it matches the PetUI / StableUI pattern.
 */

import { ShoutChip, type ShoutHudInfo } from "./shout-chip";

export type { ShoutHudInfo };
import type { ShoutDefinition } from "../systems/old-tongue-system";
import { manageDialogFocus, type DialogFocusSession } from "./dialog-focus";

// ── Design tokens (mirrors UIManager) ─────────────────────────────────────
/** The tome palette (src/css/tome.css), for a panel styled inline. */
const C = {
  BG:       "rgba(30, 19, 11, 0.97)",
  BORDER:   "#8A6A2C",
  TITLE:    "#F1D08A",
  TEXT:     "#EADBB8",
  DIM:      "#B49F78",
  READY:    "#5EC45E",
  COOLDOWN: "#CC9910",
  LOCKED:   "#7A6A55",
  BTN_BG:   "rgba(42, 26, 16, 0.96)",
  BTN_HVR:  "rgba(74, 47, 27, 0.98)",
  FONT:     "'Cinzel', 'Times New Roman', Georgia, serif",
  /** Body/button face — Cinzel is all-caps display type, unreadable for prose. */
  BODY:     "'EB Garamond', Georgia, serif",
  MONO:     "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
};

// ── View models ─────────────────────────────────────────────────────────────

/** Per-shout snapshot the game layer builds from OldTongueSystem state. */
export interface ShoutView {
  def: ShoutDefinition;
  /** Which ranks have been learned (indexed 0–2). */
  learned: boolean[];
  /** Which ranks have been mastered with awen (indexed 0–2). */
  unlocked: boolean[];
}

// ── ShoutUI ──────────────────────────────────────────────────────────────────

export class ShoutUI {
  /** True while the management panel is open. */
  public isVisible: boolean = false;
  /** Active focus trap/restore session while the panel is open (null when closed). */
  private _focusSession: DialogFocusSession | null = null;

  public onEquip:      ((shoutId: string) => void) | null = null;
  public onUnlockWord: ((shoutId: string, wordIndex: 0 | 1 | 2) => void) | null = null;
  public onClose:      (() => void) | null = null;

  // ── HUD chip ───────────────────────────────────────────────────────────────
  private readonly _chip = new ShoutChip();

  // ── Management panel ────────────────────────────────────────────────────────
  private _panelRoot:    HTMLDivElement | null = null;
  private _panelList:    HTMLDivElement | null = null;
  private _awenLabel:   HTMLSpanElement | null = null;

  // ── State cache ─────────────────────────────────────────────────────────────
  private _views:           ShoutView[] = [];
  private _awen:     number = 0;
  private _equippedShoutId: string | null = null;

  // ══════════════════════════════════════════════════════════════════════════
  // ── HUD chip ──────────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  /** Show / refresh the HUD chip (the feature drives its own chip; this is for a panel used alone). */
  public updateHUD(info: ShoutHudInfo | null): void {
    this._chip.update(info);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── Management panel ───────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  /** Open the shouts panel, refreshing with current state. */
  public open(views: ShoutView[], awen: number, equippedShoutId: string | null): void {
    if (typeof document === "undefined") return;
    this._views           = views.map(v => this._copyView(v));
    this._awen     = awen;
    this._equippedShoutId = equippedShoutId;

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

  /** Refresh the panel with new state (no-op while closed). */
  public refresh(views: ShoutView[], awen: number, equippedShoutId: string | null): void {
    this._views           = views.map(v => this._copyView(v));
    this._awen     = awen;
    this._equippedShoutId = equippedShoutId;
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
    root.setAttribute("aria-labelledby", "shout-panel-title");
    root.tabIndex = -1;
    root.className = "shout-ui";
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
      minWidth:       "min(360px, calc(100vw - 56px))",
      maxWidth:       "520px",
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
    title.id = "shout-panel-title";
    Object.assign(title.style, {
      margin: "0", fontFamily: C.FONT, color: C.TITLE, fontSize: "17px", letterSpacing: "1px",
    });
    title.textContent = "WORDS OF THE OLD TONGUE";

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    _styleButton(closeBtn, "✕", { fontSize: "18px", padding: "0 6px" });
    closeBtn.setAttribute("aria-label", "Close the words");
    closeBtn.addEventListener("click", () => {
      this.close();
      this.onClose?.();
    });

    header.append(title, closeBtn);

    // ── Awen held ────────────────────────────────────────────────────────
    const awenRow = document.createElement("p");
    Object.assign(awenRow.style, { margin: "0", fontSize: "14px", color: C.TEXT });
    const awenLabel = document.createElement("span");
    awenLabel.setAttribute("aria-label", "Awen");
    awenRow.append(awenLabel);

    // ── Hint ────────────────────────────────────────────────────────────────
    const hint = document.createElement("p");
    Object.assign(hint.style, { margin: "0", fontSize: "13px", color: C.DIM });
    hint.textContent = "N or Esc to close  ·  Shift+N to speak the word  ·  Great deeds bring awen";

    // ── Shout list ──────────────────────────────────────────────────────────
    const listEl = document.createElement("div");
    Object.assign(listEl.style, { display: "flex", flexDirection: "column", gap: "8px" });

    root.append(header, awenRow, hint, listEl);

    root.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        this.close();
        this.onClose?.();
      }
    });

    document.body.appendChild(root);

    this._panelRoot  = root;
    this._panelList  = listEl;
    this._awenLabel = awenLabel;
  }

  private _renderPanel(): void {
    const list = this._panelList;
    if (!list || !this._awenLabel) return;
    list.innerHTML = "";
    this._awenLabel.textContent = `Awen: ${this._awen}`;

    if (this._views.length === 0) {
      const empty = document.createElement("p");
      Object.assign(empty.style, { color: C.DIM, fontSize: "15px", textAlign: "center" });
      empty.textContent = "No words of the Old Tongue are known to you yet.";
      list.appendChild(empty);
      return;
    }

    for (const view of this._views) {
      list.appendChild(this._buildShoutCard(view));
    }
  }

  private _buildShoutCard(view: ShoutView): HTMLDivElement {
    const { def, learned, unlocked } = view;
    const isEquipped = def.id === this._equippedShoutId;
    const tier = unlocked.filter(Boolean).length;

    const card = document.createElement("div");
    Object.assign(card.style, {
      background:    isEquipped ? "rgba(107, 79, 18, 0.25)" : "rgba(20, 14, 4, 0.7)",
      border:        `1px solid ${isEquipped ? C.BORDER : "rgba(107, 79, 18, 0.4)"}`,
      borderRadius:  "5px",
      padding:       "10px",
      display:       "flex",
      flexDirection: "column",
      gap:           "6px",
    });

    // ── Top row: name + equipped badge ──────────────────────────────────────
    const topRow = document.createElement("div");
    Object.assign(topRow.style, {
      display: "flex", alignItems: "center", gap: "8px",
    });

    const icon = document.createElement("span");
    icon.style.fontSize = "18px";
    icon.textContent = "🜂";

    const nameEl = document.createElement("div");
    Object.assign(nameEl.style, { flex: "1", color: C.TITLE, fontSize: "16px", fontWeight: "bold" });
    nameEl.textContent = def.name;

    topRow.append(icon, nameEl);

    if (isEquipped) {
      const badge = document.createElement("span");
      Object.assign(badge.style, {
        background: C.BORDER, color: "#FFF8DC", fontSize: "12px",
        padding: "2px 7px", borderRadius: "2px", fontFamily: C.FONT, letterSpacing: "1.5px",
      });
      badge.textContent = "CHOSEN";
      topRow.appendChild(badge);
    }

    // ── Description ─────────────────────────────────────────────────────────
    const descEl = document.createElement("div");
    Object.assign(descEl.style, { color: C.DIM, fontSize: "13px", fontStyle: "italic" });
    descEl.textContent = def.description;

    // ── Words row ───────────────────────────────────────────────────────────
    const wordsRow = document.createElement("div");
    Object.assign(wordsRow.style, { display: "flex", gap: "6px", flexWrap: "wrap" });

    def.words.forEach((word, i) => {
      // A rank: its word in the Old Tongue over what it means, or a blank for an unknown one.
      const chip = document.createElement("span");
      Object.assign(chip.style, {
        display: "inline-flex", flexDirection: "column", alignItems: "center", minWidth: "84px",
        padding: "4px 10px 3px", borderRadius: "2px", lineHeight: "1.15",
        border: `1px solid ${unlocked[i] ? C.TITLE : learned[i] ? C.BORDER : "rgba(120, 100, 70, 0.4)"}`,
        borderStyle: learned[i] || unlocked[i] ? "solid" : "dashed",
        color: unlocked[i] ? C.TITLE : learned[i] ? C.TEXT : C.LOCKED,
        background: unlocked[i] ? "rgba(107, 79, 18, 0.35)" : "transparent",
      });
      const known = learned[i] || unlocked[i];
      const top = document.createElement("span");
      Object.assign(top.style, { fontFamily: C.FONT, fontSize: "14px", fontWeight: "600", letterSpacing: "1.5px" });
      top.textContent = known ? word!.word : `Rank ${i + 1}`;
      const under = document.createElement("span");
      Object.assign(under.style, { fontFamily: C.BODY, fontStyle: "italic", fontSize: "13px", opacity: "0.85" });
      under.textContent = known ? word!.translation : "unknown";
      chip.append(top, under);
      chip.setAttribute(
        "aria-label",
        `Word ${i + 1}: ${unlocked[i] ? "unlocked" : learned[i] ? "learned, not unlocked" : "unknown"}`,
      );
      wordsRow.appendChild(chip);
    });

    // ── Tier effect preview ─────────────────────────────────────────────────
    const effectEl = document.createElement("div");
    Object.assign(effectEl.style, { color: C.TEXT, fontSize: "13px" });
    const tierDef = tier > 0 ? def.tiers[tier - 1] : undefined;
    if (tierDef) {
      effectEl.textContent = tierDef.description;
    } else {
      effectEl.textContent = "Master a rank of this word to speak it.";
      effectEl.style.color = C.LOCKED;
    }

    // ── Action row ──────────────────────────────────────────────────────────
    const actionRow = document.createElement("div");
    actionRow.style.display = "flex";
    actionRow.style.justifyContent = "flex-end";
    actionRow.style.gap = "6px";
    actionRow.style.alignItems = "center";

    // Next word state drives the unlock/learn affordance.
    const nextIndex = tier as 0 | 1 | 2;
    const hasNextWord = nextIndex < def.words.length;
    if (hasNextWord) {
      const nextLearned = learned[nextIndex];
      const nextUnlocked = unlocked[nextIndex];
      const nextWord = def.words[nextIndex];
      if (!nextLearned) {
        const learnHint = document.createElement("span");
        Object.assign(learnHint.style, { color: C.LOCKED, fontSize: "14px", fontStyle: "italic" });
        learnHint.textContent = "Find an obelisk, or do a great deed, to learn the next rank…";
        actionRow.appendChild(learnHint);
      } else if (!nextUnlocked) {
        const unlockBtn = document.createElement("button");
        unlockBtn.type = "button";
        _styleButton(unlockBtn, `Master ${nextWord!.word} (1 awen)`);
        unlockBtn.setAttribute("aria-label", `Master ${nextWord!.word} for one awen`);
        if (this._awen < 1) {
          unlockBtn.setAttribute("aria-disabled", "true");
          unlockBtn.style.opacity = "0.45";
          unlockBtn.style.cursor = "not-allowed";
          unlockBtn.title = "No awen. Great deeds bring it: a dragon slain, a bandit camp cleared.";
        } else {
          unlockBtn.addEventListener("click", () => {
            this.onUnlockWord?.(def.id, nextIndex);
          });
        }
        actionRow.appendChild(unlockBtn);
      }
    }

    const equipBtn = document.createElement("button");
    equipBtn.type = "button";
    if (isEquipped) {
      _styleButton(equipBtn, "Chosen");
      equipBtn.setAttribute("aria-disabled", "true");
      equipBtn.style.opacity = "0.45";
      equipBtn.style.cursor = "default";
    } else {
      _styleButton(equipBtn, "Choose");
      equipBtn.setAttribute("aria-label", `Choose ${def.name} to speak`);
      equipBtn.addEventListener("click", () => {
        this.onEquip?.(def.id);
      });
    }
    actionRow.appendChild(equipBtn);

    card.append(topRow, descEl, wordsRow, effectEl, actionRow);
    return card;
  }

  private _copyView(v: ShoutView): ShoutView {
    return {
      def: v.def,
      learned: [...v.learned],
      unlocked: [...v.unlocked],
    };
  }
}

// ── Private helpers ────────────────────────────────────────────────────────

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
