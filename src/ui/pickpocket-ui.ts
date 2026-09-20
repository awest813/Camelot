/**
 * PickpocketUI — Oblivion-style lift overlay.
 *
 * Lists an NPC's registered pickpocketable items with per-item success
 * chances.  Clicking "Steal" fires {@link onStealItem}; the game layer
 * resolves the attempt through PickpocketSystem and refreshes (or closes)
 * the panel.  Styling is inline (pet-ui pattern) so no CSS changes are needed.
 *
 * Wire-up example:
 * ```ts
 * const ui = new PickpocketUI();
 * ui.onStealItem = (itemId) => {
 *   pickpocketSystem.attempt(npcId, itemId, sneak, awareness, true, false);
 *   ui.update(itemsWithChances());
 *   if (empty) ui.hide();
 * };
 * ui.onClose = () => restoreGameInput();
 * ```
 */

import { manageDialogFocus, type DialogFocusSession } from "./dialog-focus";
import { getItemIcon } from "./icon-utils";

export interface PickpocketItemView {
  id: string;
  name: string;
  /** Estimated success chance [0–100] shown on the steal button. */
  chance: number;
}

const C = {
  BG:     "rgba(6, 4, 2, 0.96)",
  BORDER: "#6B4F12",
  TITLE:  "#D4A017",
  TEXT:   "#EEE0C0",
  DIM:    "#998877",
  BTN_BG: "rgba(28, 20, 6, 0.95)",
};

function styleButton(btn: HTMLButtonElement, label: string): void {
  btn.type = "button";
  Object.assign(btn.style, {
    background: C.BTN_BG, color: C.TEXT, border: `1px solid ${C.BORDER}`,
    borderRadius: "6px", fontSize: "12px", fontWeight: "600", padding: "5px 12px", cursor: "pointer",
    transition: "background 0.15s, border-color 0.15s, color 0.15s",
  });
  btn.textContent = label;
  btn.onmouseenter = () => {
    btn.style.background = "rgba(60, 42, 14, 0.95)";
    btn.style.borderColor = "#D4A017";
    btn.style.color = "#fff4d6";
  };
  btn.onmouseleave = () => {
    btn.style.background = C.BTN_BG;
    btn.style.borderColor = C.BORDER;
    btn.style.color = C.TEXT;
  };
}

export class PickpocketUI {
  public isVisible: boolean = false;
  /** Active focus trap/restore session while the panel is open (null when closed). */
  private _focusSession: DialogFocusSession | null = null;

  /** Called with the item id when the player clicks "Steal" on a row. */
  public onStealItem: ((itemId: string) => void) | null = null;
  /** Fired when the ✕ button closes the panel (Escape is owned by the game cascade). */
  public onClose: (() => void) | null = null;

  private _root:     HTMLDivElement | null = null;
  private _titleEl:  HTMLHeadingElement | null = null;
  private _listEl:   HTMLUListElement | null = null;
  private _hintEl:   HTMLParagraphElement | null = null;

  /** Make the panel visible for the given mark. Creates DOM lazily. */
  public show(npcName: string): void {
    if (typeof document === "undefined") return;
    this._ensureDom();
    if (this._titleEl) this._titleEl.textContent = `Pickpocket ${npcName}`;
    if (this._root) this._root.style.display = "flex";
    this.isVisible = true;
    this._root?.focus();
    if (!this._focusSession && this._root) this._focusSession = manageDialogFocus(this._root);
  }

  /** Re-render the item rows (call after every attempt). */
  public update(items: ReadonlyArray<PickpocketItemView>): void {
    if (typeof document === "undefined") return;
    this._ensureDom();
    if (!this._listEl) return;
    this._listEl.innerHTML = "";

    if (items.length === 0) {
      const empty = document.createElement("li");
      Object.assign(empty.style, { color: C.DIM, fontSize: "13px", listStyle: "none" });
      empty.textContent = "Nothing worth taking.";
      this._listEl.appendChild(empty);
      return;
    }

    for (const item of items) {
      const li = document.createElement("li");
      Object.assign(li.style, {
        display: "flex", justifyContent: "space-between", alignItems: "center",
        gap: "8px", padding: "6px 10px", listStyle: "none",
        borderRadius: "6px", background: "rgba(18, 13, 6, 0.7)", border: "1px solid rgba(212, 160, 23, 0.15)",
        marginBottom: "4px", transition: "background 0.15s, border-color 0.15s",
      });
      li.onmouseenter = () => {
        li.style.background = "rgba(212, 160, 23, 0.14)";
        li.style.borderColor = "rgba(212, 160, 23, 0.4)";
      };
      li.onmouseleave = () => {
        li.style.background = "rgba(18, 13, 6, 0.7)";
        li.style.borderColor = "rgba(212, 160, 23, 0.15)";
      };
      li.setAttribute("data-item-id", item.id);

      const nameEl = document.createElement("span");
      Object.assign(nameEl.style, { color: C.TEXT, fontSize: "13px", fontWeight: "500" });
      const icon = getItemIcon({ id: item.id, name: item.name });
      nameEl.textContent = `${icon} ${item.name}`;
      li.appendChild(nameEl);

      const stealBtn = document.createElement("button");
      styleButton(stealBtn, `Steal (${Math.round(item.chance)}%)`);
      stealBtn.setAttribute("aria-label", `Steal ${item.name}, ${Math.round(item.chance)} percent chance`);
      stealBtn.addEventListener("click", () => this.onStealItem?.(item.id));
      li.appendChild(stealBtn);

      this._listEl.appendChild(li);
    }
  }

  /** Hide the panel without destroying its DOM. */
  public hide(): void {
    if (this._root) this._root.style.display = "none";
    this.isVisible = false;
    this._focusSession?.release();
    this._focusSession = null;
  }

  /** Remove the DOM element entirely and reset state. */
  public destroy(): void {
    this._root?.remove();
    this._root    = null;
    this._titleEl = null;
    this._listEl  = null;
    this._hintEl  = null;
    this.isVisible = false;
    this._focusSession?.release();
    this._focusSession = null;
  }

  private _ensureDom(): void {
    if (this._root || typeof document === "undefined") return;

    const root = document.createElement("div");
    root.className = "pickpocket-ui";
    Object.assign(root.style, {
      position: "fixed", zIndex: "1200", left: "50%", top: "50%",
      transform: "translate(-50%, -50%)", minWidth: "340px", maxWidth: "440px",
      background: C.BG, border: `1px solid ${C.BORDER}`, borderRadius: "10px",
      boxShadow: "0 20px 60px rgba(0, 0, 0, 0.85), 0 0 0 100vmax rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 230, 180, 0.1)",
      backdropFilter: "blur(4px)",
      padding: "16px 18px", display: "none", flexDirection: "column", gap: "10px",
      fontFamily: "Inter, 'Segoe UI', Roboto, sans-serif",
    });
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "Pickpocket");
    root.tabIndex = -1;

    const header = document.createElement("div");
    Object.assign(header.style, {
      display: "flex", justifyContent: "space-between", alignItems: "center",
      borderBottom: "1px solid rgba(212, 160, 23, 0.25)", paddingBottom: "8px",
    });

    const title = document.createElement("h2");
    Object.assign(title.style, { margin: "0", color: C.TITLE, fontSize: "16px", fontFamily: "'Cinzel', serif", letterSpacing: "0.5px" });
    header.appendChild(title);

    const closeBtn = document.createElement("button");
    styleButton(closeBtn, "✕");
    closeBtn.setAttribute("aria-label", "Close pickpocket panel");
    closeBtn.addEventListener("click", () => {
      this.hide();
      this.onClose?.();
    });
    header.appendChild(closeBtn);
    root.appendChild(header);

    const list = document.createElement("ul");
    Object.assign(list.style, { margin: "0", padding: "0" });
    list.setAttribute("aria-label", "Mark's belongings");
    root.appendChild(list);

    const hint = document.createElement("p");
    Object.assign(hint.style, { margin: "0", fontSize: "10px", color: C.DIM });
    hint.textContent = "[Esc] to close  ·  Getting caught is a crime";
    root.appendChild(hint);

    root.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        this.hide();
        this.onClose?.();
      }
    });

    document.body.appendChild(root);
    this._root    = root;
    this._titleEl = title;
    this._listEl  = list;
    this._hintEl  = hint;
  }
}
