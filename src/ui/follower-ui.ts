/**
 * FollowerUI — HUD widget and management panel for the Skyrim-style follower system.
 *
 * Layout:
 *   HUD widget    — compact bar showing active follower's name, health, and current command.
 *                   Positioned in the bottom-right, above the pet HUD (if any).
 *   Follower panel — full modal opened with [F].  Lists all registered followers,
 *                    their status (available / recruited / deceased), stats, and
 *                    Recruit / Dismiss buttons.
 *
 * Style follows the dark-amber design language used throughout the project.
 * Implemented as plain DOM so it matches the PetUI / StableUI / SaddlebagUI pattern.
 */

import type {
  FollowerTemplate,
  ActiveFollowerState,
  FollowerCombatRole,
  FollowerCommand,
} from "../systems/follower-system";

// ── Design tokens (mirrors UIManager) ─────────────────────────────────────
const C = {
  BG:       "rgba(6, 4, 2, 0.95)",
  BORDER:   "#6B4F12",
  TITLE:    "#D4A017",
  TEXT:     "#EEE0C0",
  DIM:      "#998877",
  HP_FILL:  "#CC1A1A",
  HP_BG:    "rgba(60, 4, 4, 0.7)",
  STATUS_OK:    "#5EC45E",
  STATUS_WARN:  "#CC9910",
  STATUS_ERROR: "#CC1A1A",
  BTN_BG:   "rgba(28, 20, 6, 0.95)",
  BTN_HVR:  "rgba(80, 56, 10, 0.98)",
  BTN_DIS:  "rgba(18, 12, 4, 0.6)",
  FONT:     "'Cinzel', 'Times New Roman', Georgia, serif",
  MONO:     "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
};

/** Unicode icons for each combat role. */
const ROLE_ICON: Record<FollowerCombatRole, string> = {
  warrior: "⚔️",
  archer:  "🏹",
  mage:    "✨",
  rogue:   "🗡️",
};

/** Command display labels. */
const COMMAND_LABEL: Record<FollowerCommand, string> = {
  follow: "Following",
  wait:   "Waiting",
  trade:  "Trading",
};

function pct(val: number, max: number): string {
  if (max <= 0) return "0%";
  return `${Math.min(100, Math.max(0, (val / max) * 100)).toFixed(1)}%`;
}

// ── FollowerUI ─────────────────────────────────────────────────────────────

export class FollowerUI {
  /** True while the management panel is open. */
  public isVisible: boolean = false;

  public onRecruit:   ((templateId: string) => void) | null = null;
  public onDismiss:   (() => void) | null = null;
  public onCommand:   ((command: FollowerCommand) => void) | null = null;
  public onClose:     (() => void) | null = null;

  // ── HUD widget ─────────────────────────────────────────────────────────────
  private _hudRoot:      HTMLDivElement  | null = null;
  private _hudIcon:      HTMLSpanElement | null = null;
  private _hudName:      HTMLSpanElement | null = null;
  private _hudHpFill:    HTMLDivElement  | null = null;
  private _hudHpText:    HTMLSpanElement | null = null;
  private _hudCommand:   HTMLSpanElement | null = null;

  // ── Management panel ────────────────────────────────────────────────────────
  private _panelRoot:    HTMLDivElement | null = null;
  private _panelList:    HTMLDivElement | null = null;
  private _activeBlock:  HTMLDivElement | null = null;

  // ── State cache ─────────────────────────────────────────────────────────────
  private _templates:      FollowerTemplate[]     = [];
  private _activeFollower: ActiveFollowerState | null = null;
  private _deceasedIds:    Set<string>            = new Set();
  private _playerGold:     number                 = 0;

  // ══════════════════════════════════════════════════════════════════════════
  // ── HUD widget ────────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  /** Show / refresh the HUD widget with the currently active follower. */
  public updateHUD(activeFollower: ActiveFollowerState | null): void {
    if (typeof document === "undefined") return;
    this._ensureHUD();

    if (!activeFollower) {
      this._hudRoot!.style.display = "none";
      return;
    }

    // Find the template to get combat role icon
    const tmpl = this._templates.find(t => t.id === activeFollower.templateId);
    this._hudIcon!.textContent  = tmpl ? ROLE_ICON[tmpl.combatRole] : "🛡️";
    this._hudName!.textContent  = activeFollower.name;
    this._hudHpFill!.style.width = pct(activeFollower.health, activeFollower.maxHealth);
    this._hudHpText!.textContent = `${Math.ceil(activeFollower.health)} / ${activeFollower.maxHealth}`;
    this._hudCommand!.textContent = COMMAND_LABEL[activeFollower.command];
    this._hudRoot!.style.display = "flex";
  }

  /** Hide the HUD widget entirely (e.g. in menus). */
  public hideHUD(): void {
    if (this._hudRoot) this._hudRoot.style.display = "none";
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── Management panel ──────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  /** Open the follower management panel, refreshing with current state. */
  public open(
    templates:      FollowerTemplate[],
    activeFollower: ActiveFollowerState | null,
    deceasedIds:    string[],
    playerGold:     number,
  ): void {
    if (typeof document === "undefined") return;
    this._templates      = templates.slice();
    this._activeFollower = activeFollower;
    this._deceasedIds    = new Set(deceasedIds);
    this._playerGold     = playerGold;

    this._ensurePanel();
    this._renderPanel();
    this._panelRoot!.style.display = "flex";
    this._panelRoot!.focus();
    this.isVisible = true;
  }

  /** Close the management panel. */
  public close(): void {
    if (this._panelRoot) this._panelRoot.style.display = "none";
    this.isVisible = false;
  }

  /** Refresh the panel and HUD with new state without reopening if already closed. */
  public refresh(
    templates:      FollowerTemplate[],
    activeFollower: ActiveFollowerState | null,
    deceasedIds:    string[],
    playerGold:     number,
  ): void {
    this._templates      = templates.slice();
    this._activeFollower = activeFollower;
    this._deceasedIds    = new Set(deceasedIds);
    this._playerGold     = playerGold;
    if (this.isVisible) this._renderPanel();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── Private — HUD construction ────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  private _ensureHUD(): void {
    if (this._hudRoot) return;

    const root = document.createElement("div");
    Object.assign(root.style, {
      position:    "fixed",
      bottom:      "140px",          // above the pet HUD (which is at 110px)
      right:       "14px",
      display:     "none",           // hidden until a follower is active
      alignItems:  "center",
      gap:         "6px",
      background:  C.BG,
      border:      `1px solid ${C.BORDER}`,
      borderRadius:"6px",
      padding:     "5px 8px",
      zIndex:      "900",
      pointerEvents:"none",
      fontFamily:  C.FONT,
      minWidth:    "180px",
    });

    const icon = document.createElement("span");
    icon.style.fontSize = "18px";

    const info = document.createElement("div");
    Object.assign(info.style, { display: "flex", flexDirection: "column", gap: "2px", flex: "1" });

    const nameRow = document.createElement("div");
    Object.assign(nameRow.style, {
      display: "flex", justifyContent: "space-between", alignItems: "baseline",
    });

    const nameEl = document.createElement("span");
    Object.assign(nameEl.style, { color: C.TITLE, fontSize: "11px", fontWeight: "bold" });

    const commandEl = document.createElement("span");
    Object.assign(commandEl.style, { color: C.DIM, fontSize: "10px", fontStyle: "italic" });

    nameRow.append(nameEl, commandEl);

    // HP bar
    const hpOuter = document.createElement("div");
    Object.assign(hpOuter.style, {
      background:   C.HP_BG,
      borderRadius: "2px",
      height:       "6px",
      width:        "140px",
      overflow:     "hidden",
    });
    const hpFill = document.createElement("div");
    Object.assign(hpFill.style, {
      background:    C.HP_FILL,
      height:        "100%",
      width:         "100%",
      borderRadius:  "2px",
      transition:    "width 0.2s ease",
    });
    hpOuter.appendChild(hpFill);

    const hpText = document.createElement("span");
    Object.assign(hpText.style, { color: C.DIM, fontSize: "9px" });

    info.append(nameRow, hpOuter, hpText);
    root.append(icon, info);
    document.body.appendChild(root);

    this._hudRoot    = root;
    this._hudIcon    = icon;
    this._hudName    = nameEl;
    this._hudHpFill  = hpFill;
    this._hudHpText  = hpText;
    this._hudCommand = commandEl;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── Private — Panel construction ──────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  private _ensurePanel(): void {
    if (this._panelRoot) return;

    const root = document.createElement("div");
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "follower-panel-title");
    root.tabIndex = -1;
    Object.assign(root.style, {
      position:       "fixed",
      top:            "50%",
      left:           "50%",
      transform:      "translate(-50%, -50%)",
      display:        "none",
      flexDirection:  "column",
      gap:            "12px",
      background:     C.BG,
      border:         `1px solid ${C.BORDER}`,
      borderRadius:   "8px",
      padding:        "16px",
      zIndex:         "1600",
      minWidth:       "420px",
      maxWidth:       "520px",
      maxHeight:      "85vh",
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
    title.id = "follower-panel-title";
    Object.assign(title.style, {
      margin: "0", color: C.TITLE, fontSize: "16px", letterSpacing: "1px",
    });
    title.textContent = "FOLLOWERS";

    const closeBtn = document.createElement("button");
    _styleButton(closeBtn, "×", { fontSize: "18px", padding: "0 6px" });
    closeBtn.setAttribute("aria-label", "Close followers panel");
    closeBtn.addEventListener("click", () => {
      this.close();
      this.onClose?.();
    });

    header.append(title, closeBtn);

    // ── Hint ─────────────────────────────────────────────────────────────────
    const hint = document.createElement("p");
    Object.assign(hint.style, { margin: "0", fontSize: "10px", color: C.DIM });
    hint.textContent = "[F] to close  ·  Only one follower may be active at a time";

    // ── Active follower section ──────────────────────────────────────────────
    const activeBlock = document.createElement("div");
    Object.assign(activeBlock.style, {
      display: "flex", flexDirection: "column", gap: "8px",
    });

    // ── Available followers list ─────────────────────────────────────────────
    const listTitle = document.createElement("h4");
    Object.assign(listTitle.style, {
      margin: "4px 0", color: C.TITLE, fontSize: "12px", letterSpacing: "0.5px",
    });
    listTitle.textContent = "AVAILABLE FOLLOWERS";

    const listEl = document.createElement("div");
    Object.assign(listEl.style, { display: "flex", flexDirection: "column", gap: "8px" });

    root.append(header, hint, activeBlock, listTitle, listEl);
    document.body.appendChild(root);

    this._panelRoot   = root;
    this._panelList   = listEl;
    this._activeBlock = activeBlock;
  }

  private _renderPanel(): void {
    const list   = this._panelList;
    const active = this._activeBlock;
    if (!list || !active) return;

    // ── Render active follower section ────────────────────────────────────────
    active.innerHTML = "";
    if (this._activeFollower) {
      const card = this._buildActiveFollowerCard(this._activeFollower);
      active.appendChild(card);
    } else {
      const empty = document.createElement("p");
      Object.assign(empty.style, {
        color: C.DIM, fontSize: "11px", margin: "0", fontStyle: "italic",
      });
      empty.textContent = "No follower currently active.";
      active.appendChild(empty);
    }

    // ── Render available followers ────────────────────────────────────────────
    list.innerHTML = "";
    if (this._templates.length === 0) {
      const empty = document.createElement("p");
      Object.assign(empty.style, { color: C.DIM, fontSize: "11px", textAlign: "center" });
      empty.textContent = "No followers registered.";
      list.appendChild(empty);
      return;
    }

    for (const tmpl of this._templates) {
      // Don't show the active follower in the available list
      if (this._activeFollower && tmpl.id === this._activeFollower.templateId) {
        continue;
      }
      list.appendChild(this._buildFollowerCard(tmpl));
    }
  }

  private _buildActiveFollowerCard(follower: ActiveFollowerState): HTMLDivElement {
    const tmpl = this._templates.find(t => t.id === follower.templateId);

    const card = document.createElement("div");
    Object.assign(card.style, {
      background:   "rgba(107, 79, 18, 0.3)",
      border:       `1px solid ${C.BORDER}`,
      borderRadius: "6px",
      padding:      "12px",
      display:      "flex",
      flexDirection:"column",
      gap:          "8px",
    });

    // ── Header row: icon + name + ACTIVE badge ────────────────────────────────
    const topRow = document.createElement("div");
    Object.assign(topRow.style, {
      display: "flex", alignItems: "center", gap: "8px",
    });

    const icon = document.createElement("span");
    icon.style.fontSize = "24px";
    icon.textContent = tmpl ? ROLE_ICON[tmpl.combatRole] : "🛡️";

    const nameBlock = document.createElement("div");
    Object.assign(nameBlock.style, { flex: "1" });

    const nameEl = document.createElement("div");
    Object.assign(nameEl.style, {
      color: follower.isAlive ? C.TITLE : C.DIM, fontSize: "14px", fontWeight: "bold",
    });
    nameEl.textContent = follower.name + (follower.isAlive ? "" : " (deceased)");

    const subEl = document.createElement("div");
    Object.assign(subEl.style, { color: C.DIM, fontSize: "10px" });
    subEl.textContent = tmpl
      ? `${_capitalise(tmpl.combatRole)}  ·  Level ${follower.level}`
      : `Level ${follower.level}`;

    nameBlock.append(nameEl, subEl);

    const badge = document.createElement("span");
    Object.assign(badge.style, {
      background: C.BORDER, color: "#FFF8DC", fontSize: "9px",
      padding: "2px 6px", borderRadius: "3px", fontFamily: C.MONO,
    });
    badge.textContent = "ACTIVE";

    topRow.append(icon, nameBlock, badge);

    // ── Stats grid ────────────────────────────────────────────────────────────
    const stats = document.createElement("div");
    Object.assign(stats.style, {
      display: "grid", gridTemplateColumns: "1fr 1fr",
      gap: "4px 12px", fontSize: "10px", color: C.DIM,
    });
    stats.innerHTML = `
      <span>HP</span><span style="color:${C.TEXT}">${Math.ceil(follower.health)} / ${follower.maxHealth}</span>
      <span>ATK</span><span style="color:${C.TEXT}">${follower.attackDamage}</span>
      <span>LEVEL</span><span style="color:${C.TEXT}">${follower.level}</span>
      <span>COMMAND</span><span style="color:${C.TEXT}">${COMMAND_LABEL[follower.command]}</span>
    `;

    // ── HP bar ────────────────────────────────────────────────────────────────
    const hpBar = _buildBar(follower.health, follower.maxHealth, C.HP_FILL, C.HP_BG);

    // ── Command buttons ────────────────────────────────────────────────────────
    const cmdRow = document.createElement("div");
    Object.assign(cmdRow.style, { display: "flex", gap: "6px", flexWrap: "wrap" });

    if (follower.isAlive) {
      const followBtn = document.createElement("button");
      _styleButton(followBtn, "Follow", { fontSize: "10px", padding: "3px 8px" });
      followBtn.disabled = follower.command === "follow";
      followBtn.setAttribute("aria-label", "Command follower to follow");
      followBtn.addEventListener("click", () => this.onCommand?.("follow"));

      const waitBtn = document.createElement("button");
      _styleButton(waitBtn, "Wait", { fontSize: "10px", padding: "3px 8px" });
      waitBtn.disabled = follower.command === "wait";
      waitBtn.setAttribute("aria-label", "Command follower to wait");
      waitBtn.addEventListener("click", () => this.onCommand?.("wait"));

      const tradeBtn = document.createElement("button");
      _styleButton(tradeBtn, "Trade", { fontSize: "10px", padding: "3px 8px" });
      tradeBtn.disabled = follower.command === "trade";
      tradeBtn.setAttribute("aria-label", "Open trade with follower");
      tradeBtn.addEventListener("click", () => this.onCommand?.("trade"));

      cmdRow.append(followBtn, waitBtn, tradeBtn);
    }

    // ── Dismiss button ────────────────────────────────────────────────────────
    const actionRow = document.createElement("div");
    actionRow.style.display = "flex";
    actionRow.style.justifyContent = "flex-end";

    if (follower.isAlive) {
      const dismissBtn = document.createElement("button");
      _styleButton(dismissBtn, "Dismiss Follower");
      dismissBtn.setAttribute("aria-label", `Dismiss ${follower.name}`);
      dismissBtn.addEventListener("click", () => {
        this.onDismiss?.();
      });
      actionRow.appendChild(dismissBtn);
    }

    card.append(topRow, stats, hpBar, cmdRow, actionRow);
    return card;
  }

  private _buildFollowerCard(tmpl: FollowerTemplate): HTMLDivElement {
    const isDeceased = this._deceasedIds.has(tmpl.id);
    const canAfford  = this._playerGold >= tmpl.hireCost;
    const hasActive  = this._activeFollower !== null;

    const card = document.createElement("div");
    Object.assign(card.style, {
      background:   "rgba(20, 14, 4, 0.7)",
      border:       "1px solid rgba(107, 79, 18, 0.4)",
      borderRadius: "5px",
      padding:      "10px",
      display:      "flex",
      flexDirection:"column",
      gap:          "6px",
      opacity:      isDeceased ? "0.6" : "1",
    });

    // ── Top row: icon + name + hire cost ──────────────────────────────────────
    const topRow = document.createElement("div");
    Object.assign(topRow.style, {
      display: "flex", alignItems: "flex-start", gap: "8px",
    });

    const icon = document.createElement("span");
    icon.style.fontSize = "20px";
    icon.textContent = ROLE_ICON[tmpl.combatRole];

    const infoBlock = document.createElement("div");
    Object.assign(infoBlock.style, { flex: "1" });

    const nameEl = document.createElement("div");
    Object.assign(nameEl.style, {
      color: isDeceased ? C.DIM : C.TITLE, fontSize: "12px", fontWeight: "bold",
    });
    nameEl.textContent = tmpl.name + (isDeceased ? " (deceased)" : "");

    const subEl = document.createElement("div");
    Object.assign(subEl.style, { color: C.DIM, fontSize: "9px" });
    subEl.textContent = `${_capitalise(tmpl.combatRole)}  ·  Level ${tmpl.level}`;

    const descEl = document.createElement("div");
    Object.assign(descEl.style, {
      color: C.DIM, fontSize: "9px", marginTop: "2px", fontStyle: "italic",
    });
    descEl.textContent = tmpl.description;

    infoBlock.append(nameEl, subEl, descEl);

    const costBlock = document.createElement("div");
    Object.assign(costBlock.style, { textAlign: "right" });

    if (tmpl.hireCost > 0) {
      const costLabel = document.createElement("div");
      Object.assign(costLabel.style, { color: C.DIM, fontSize: "8px" });
      costLabel.textContent = "Hire Cost";

      const costValue = document.createElement("div");
      Object.assign(costValue.style, {
        color: canAfford ? C.TEXT : C.STATUS_ERROR, fontSize: "11px", fontWeight: "bold",
      });
      costValue.textContent = `${tmpl.hireCost} 🪙`;

      costBlock.append(costLabel, costValue);
    } else {
      const freeLabel = document.createElement("div");
      Object.assign(freeLabel.style, {
        color: C.STATUS_OK, fontSize: "9px", fontWeight: "bold",
      });
      freeLabel.textContent = "Free";
      costBlock.appendChild(freeLabel);
    }

    topRow.append(icon, infoBlock, costBlock);

    // ── Stats row ─────────────────────────────────────────────────────────────
    const stats = document.createElement("div");
    Object.assign(stats.style, {
      display: "grid", gridTemplateColumns: "1fr 1fr",
      gap: "2px 10px", fontSize: "9px", color: C.DIM,
    });
    stats.innerHTML = `
      <span>Carry Weight</span><span style="color:${C.TEXT}">+${tmpl.carryWeightBonus}</span>
      <span>Home</span><span style="color:${C.TEXT};font-size:8px">${tmpl.homeLocationId}</span>
    `;

    // ── Action button ─────────────────────────────────────────────────────────
    const actionRow = document.createElement("div");
    actionRow.style.display = "flex";
    actionRow.style.justifyContent = "flex-end";

    if (!isDeceased) {
      const btn = document.createElement("button");
      _styleButton(btn, tmpl.hireCost > 0 ? `Recruit (${tmpl.hireCost} 🪙)` : "Recruit");
      btn.disabled = hasActive || !canAfford;
      btn.setAttribute("aria-label", `Recruit ${tmpl.name}`);
      if (hasActive) {
        btn.title = "You already have an active follower. Dismiss them first.";
      } else if (!canAfford) {
        btn.title = `You need ${tmpl.hireCost} gold to hire this follower.`;
      }
      btn.addEventListener("click", () => {
        this.onRecruit?.(tmpl.id);
      });
      actionRow.appendChild(btn);
    } else {
      const deceasedLabel = document.createElement("span");
      Object.assign(deceasedLabel.style, {
        color: C.STATUS_ERROR, fontSize: "10px", fontStyle: "italic",
      });
      deceasedLabel.textContent = "Cannot be rehired";
      actionRow.appendChild(deceasedLabel);
    }

    card.append(topRow, stats, actionRow);
    return card;
  }
}

// ── Private helpers ────────────────────────────────────────────────────────

function _capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
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
    Object.assign(lbl.style, { color: C.DIM, fontSize: "9px", minWidth: "14px" });
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
    fontSize:      "11px",
    fontFamily:    C.FONT,
    ...overrides,
  });
  btn.addEventListener("mouseenter", () => {
    if (!btn.disabled) btn.style.background = C.BTN_HVR;
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.background = C.BTN_BG;
  });
  // Style disabled state
  if (btn.disabled) {
    btn.style.background = C.BTN_DIS;
    btn.style.cursor = "not-allowed";
    btn.style.opacity = "0.6";
  }
}

// Re-export types so callers don't need a second import
export type { FollowerTemplate, ActiveFollowerState };
