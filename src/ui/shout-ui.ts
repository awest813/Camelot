/**
 * ShoutUI — Thu'um management panel and HUD chip for the DragonShoutSystem.
 *
 * Layout:
 *   HUD chip    — compact indicator in the bottom-right corner; visible while a
 *                 shout is equipped.  Shows the shout name, unlocked word count,
 *                 and READY / cooldown countdown state.
 *   Shout panel — full modal opened with [N].  Lists every registered shout with
 *                 its Words of Power, per-word learned/unlocked state, tier
 *                 effect preview, and Equip / Unlock (soul) actions.
 *
 * Style follows the dark-amber design language used throughout the project.
 * Implemented as plain DOM so it matches the PetUI / StableUI pattern.
 */

import type { ShoutDefinition } from "../systems/dragon-shout-system";
import { manageDialogFocus, type DialogFocusSession } from "./dialog-focus";

// ── Design tokens (mirrors UIManager) ─────────────────────────────────────
const C = {
  BG:       "rgba(6, 4, 2, 0.95)",
  BORDER:   "#6B4F12",
  TITLE:    "#D4A017",
  TEXT:     "#EEE0C0",
  DIM:      "#998877",
  READY:    "#5EC45E",
  COOLDOWN: "#CC9910",
  LOCKED:   "#7A6A55",
  BTN_BG:   "rgba(28, 20, 6, 0.95)",
  BTN_HVR:  "rgba(80, 56, 10, 0.98)",
  FONT:     "'Cinzel', 'Times New Roman', Georgia, serif",
  MONO:     "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
};

// ── View models ─────────────────────────────────────────────────────────────

/** Per-shout snapshot the game layer builds from DragonShoutSystem state. */
export interface ShoutView {
  def: ShoutDefinition;
  /** Which words have been discovered at a Word Wall (indexed 0–2). */
  learned: boolean[];
  /** Which words have been unlocked by spending a Dragon Soul (indexed 0–2). */
  unlocked: boolean[];
}

/** Snapshot for the persistent HUD chip (null hides the chip). */
export interface ShoutHudInfo {
  name: string;
  /** Number of unlocked words (0–3). */
  tier: number;
  /** Seconds of cooldown remaining; 0 means ready to shout. */
  cooldownSeconds: number;
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
  private _hudRoot:      HTMLDivElement | null = null;
  private _hudName:      HTMLSpanElement | null = null;
  private _hudPips:      HTMLSpanElement | null = null;
  private _hudState:     HTMLSpanElement | null = null;
  private _lastHudSerial: string = "";

  // ── Management panel ────────────────────────────────────────────────────────
  private _panelRoot:    HTMLDivElement | null = null;
  private _panelList:    HTMLDivElement | null = null;
  private _soulsLabel:   HTMLSpanElement | null = null;

  // ── State cache ─────────────────────────────────────────────────────────────
  private _views:           ShoutView[] = [];
  private _dragonSouls:     number = 0;
  private _equippedShoutId: string | null = null;

  // ══════════════════════════════════════════════════════════════════════════
  // ── HUD chip ──────────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Show / refresh the HUD chip.  Pass `null` to hide it (no shout equipped).
   * Cheap to call every frame — DOM writes are skipped when nothing changed.
   */
  public updateHUD(info: ShoutHudInfo | null): void {
    if (typeof document === "undefined") return;

    if (!info) {
      if (this._hudRoot) this._hudRoot.style.display = "none";
      this._lastHudSerial = "";
      return;
    }

    this._ensureHUD();

    const serial = `${info.name}|${info.tier}|${Math.ceil(info.cooldownSeconds)}`;
    if (serial === this._lastHudSerial) return;
    this._lastHudSerial = serial;

    this._hudName!.textContent = info.name;
    this._hudPips!.textContent = "◆".repeat(info.tier) + "◇".repeat(Math.max(0, 3 - info.tier));
    if (info.cooldownSeconds > 0) {
      this._hudState!.textContent = `${Math.ceil(info.cooldownSeconds)}s`;
      this._hudState!.style.color = C.COOLDOWN;
    } else {
      this._hudState!.textContent = "READY";
      this._hudState!.style.color = C.READY;
    }
    this._hudRoot!.style.display = "flex";
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── Management panel ───────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  /** Open the shouts panel, refreshing with current state. */
  public open(views: ShoutView[], dragonSouls: number, equippedShoutId: string | null): void {
    if (typeof document === "undefined") return;
    this._views           = views.map(v => this._copyView(v));
    this._dragonSouls     = dragonSouls;
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
  public refresh(views: ShoutView[], dragonSouls: number, equippedShoutId: string | null): void {
    this._views           = views.map(v => this._copyView(v));
    this._dragonSouls     = dragonSouls;
    this._equippedShoutId = equippedShoutId;
    if (this.isVisible) this._renderPanel();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── Private — HUD construction ────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  private _ensureHUD(): void {
    if (this._hudRoot) return;

    const root = document.createElement("div");
    root.setAttribute("role", "status");
    root.setAttribute("aria-live", "polite");
    root.setAttribute("aria-label", "Equipped shout");
    Object.assign(root.style, {
      position:      "fixed",
      bottom:        "150px",         // above the companion HUD chip
      right:         "14px",
      display:       "none",
      alignItems:    "center",
      gap:           "6px",
      background:    C.BG,
      border:        `1px solid ${C.BORDER}`,
      borderRadius:  "6px",
      padding:       "5px 8px",
      zIndex:        "900",
      pointerEvents: "none",
      fontFamily:    C.FONT,
      minWidth:      "150px",
    });

    const icon = document.createElement("span");
    icon.style.fontSize = "15px";
    icon.textContent = "🜂";

    const name = document.createElement("span");
    Object.assign(name.style, { color: C.TITLE, fontSize: "11px", fontWeight: "bold", flex: "1" });

    const pips = document.createElement("span");
    Object.assign(pips.style, { color: C.DIM, fontSize: "10px", fontFamily: C.MONO });

    const state = document.createElement("span");
    Object.assign(state.style, { fontSize: "10px", fontFamily: C.MONO, fontWeight: "bold" });

    root.append(icon, name, pips, state);
    document.body.appendChild(root);

    this._hudRoot  = root;
    this._hudName  = name;
    this._hudPips  = pips;
    this._hudState = state;
  }

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
      minWidth:       "360px",
      maxWidth:       "460px",
      maxHeight:      "80vh",
      overflowY:      "auto",
      fontFamily:     C.FONT,
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
      margin: "0", color: C.TITLE, fontSize: "15px", letterSpacing: "1px",
    });
    title.textContent = "SHOUTS";

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    _styleButton(closeBtn, "✕", { fontSize: "18px", padding: "0 6px" });
    closeBtn.setAttribute("aria-label", "Close shouts panel");
    closeBtn.addEventListener("click", () => {
      this.close();
      this.onClose?.();
    });

    header.append(title, closeBtn);

    // ── Soul counter ────────────────────────────────────────────────────────
    const souls = document.createElement("p");
    Object.assign(souls.style, { margin: "0", fontSize: "11px", color: C.TEXT });
    const soulsLabel = document.createElement("span");
    soulsLabel.setAttribute("aria-label", "Dragon souls");
    souls.append(soulsLabel);

    // ── Hint ────────────────────────────────────────────────────────────────
    const hint = document.createElement("p");
    Object.assign(hint.style, { margin: "0", fontSize: "10px", color: C.DIM });
    hint.textContent = "[N] or [Esc] to close  ·  Shift+N to shout  ·  Slay dragons to absorb souls";

    // ── Shout list ──────────────────────────────────────────────────────────
    const listEl = document.createElement("div");
    Object.assign(listEl.style, { display: "flex", flexDirection: "column", gap: "8px" });

    root.append(header, souls, hint, listEl);

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
    this._soulsLabel = soulsLabel;
  }

  private _renderPanel(): void {
    const list = this._panelList;
    if (!list || !this._soulsLabel) return;
    list.innerHTML = "";
    this._soulsLabel.textContent = `Dragon Souls: ${this._dragonSouls}`;

    if (this._views.length === 0) {
      const empty = document.createElement("p");
      Object.assign(empty.style, { color: C.DIM, fontSize: "12px", textAlign: "center" });
      empty.textContent = "No shouts are known to you yet.";
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
    Object.assign(nameEl.style, { flex: "1", color: C.TITLE, fontSize: "13px", fontWeight: "bold" });
    nameEl.textContent = def.name;

    topRow.append(icon, nameEl);

    if (isEquipped) {
      const badge = document.createElement("span");
      Object.assign(badge.style, {
        background: C.BORDER, color: "#FFF8DC", fontSize: "9px",
        padding: "2px 5px", borderRadius: "3px", fontFamily: C.MONO,
      });
      badge.textContent = "EQUIPPED";
      topRow.appendChild(badge);
    }

    // ── Description ─────────────────────────────────────────────────────────
    const descEl = document.createElement("div");
    Object.assign(descEl.style, { color: C.DIM, fontSize: "10px", fontStyle: "italic" });
    descEl.textContent = def.description;

    // ── Words row ───────────────────────────────────────────────────────────
    const wordsRow = document.createElement("div");
    Object.assign(wordsRow.style, { display: "flex", gap: "6px", flexWrap: "wrap" });

    def.words.forEach((word, i) => {
      const chip = document.createElement("span");
      Object.assign(chip.style, {
        fontSize: "10px", fontFamily: C.MONO,
        padding: "2px 6px", borderRadius: "3px",
        border: `1px solid ${unlocked[i] ? C.TITLE : learned[i] ? C.BORDER : "rgba(120, 100, 70, 0.4)"}`,
        color: unlocked[i] ? C.TITLE : learned[i] ? C.TEXT : C.LOCKED,
        background: unlocked[i] ? "rgba(107, 79, 18, 0.35)" : "transparent",
      });
      chip.textContent = learned[i] || unlocked[i]
        ? `${word!.dragonWord} · ${word!.translation}`
        : "??? · Unknown";
      chip.setAttribute(
        "aria-label",
        `Word ${i + 1}: ${unlocked[i] ? "unlocked" : learned[i] ? "learned, not unlocked" : "unknown"}`,
      );
      wordsRow.appendChild(chip);
    });

    // ── Tier effect preview ─────────────────────────────────────────────────
    const effectEl = document.createElement("div");
    Object.assign(effectEl.style, { color: C.TEXT, fontSize: "10px" });
    const tierDef = tier > 0 ? def.tiers[tier - 1] : undefined;
    if (tierDef) {
      effectEl.textContent = tierDef.description;
    } else {
      effectEl.textContent = "Unlock a Word of Power to use this shout.";
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
        Object.assign(learnHint.style, { color: C.LOCKED, fontSize: "9px", fontStyle: "italic" });
        learnHint.textContent = "Next word awaits at a Word Wall…";
        actionRow.appendChild(learnHint);
      } else if (!nextUnlocked) {
        const unlockBtn = document.createElement("button");
        unlockBtn.type = "button";
        _styleButton(unlockBtn, `Unlock ${nextWord!.dragonWord} (1 soul)`);
        unlockBtn.setAttribute("aria-label", `Unlock word ${nextWord!.dragonWord} for one dragon soul`);
        if (this._dragonSouls < 1) {
          unlockBtn.setAttribute("aria-disabled", "true");
          unlockBtn.style.opacity = "0.45";
          unlockBtn.style.cursor = "not-allowed";
          unlockBtn.title = "No dragon souls — slay a dragon to absorb one.";
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
      _styleButton(equipBtn, "Equipped");
      equipBtn.setAttribute("aria-disabled", "true");
      equipBtn.style.opacity = "0.45";
      equipBtn.style.cursor = "default";
    } else {
      _styleButton(equipBtn, "Equip");
      equipBtn.setAttribute("aria-label", `Equip ${def.name}`);
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
    fontSize:      "11px",
    fontFamily:    C.FONT,
    ...overrides,
  });
  btn.addEventListener("mouseenter", () => { btn.style.background = C.BTN_HVR; });
  btn.addEventListener("mouseleave", () => { btn.style.background = C.BTN_BG; });
}
