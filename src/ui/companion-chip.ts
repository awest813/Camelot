/**
 * A companion's HUD chip (a follower, a pet): an icon, the name, a tag (an
 * order, a level) and a health bar, in the HUD chips' stack. Kept apart from
 * the follower and pet panels so those can load on first open (out of the
 * start-up bundle).
 */
import { addHudChip } from "./hud-chips";
import type { FollowerCombatRole, FollowerCommand } from "../systems/follower-system";

const C = {
  BG: "rgba(30, 19, 11, 0.97)",
  BORDER: "#8A6A2C",
  TITLE: "#F1D08A",
  DIM: "#B49F78",
  HP_FILL: "#CC1A1A",
  HP_BG: "rgba(60, 4, 4, 0.7)",
  FONT: "'Cinzel', 'Times New Roman', Georgia, serif",
};

export const ROLE_ICON: Record<FollowerCombatRole, string> = { warrior: "⚔️", archer: "🏹", mage: "✨", rogue: "🗡️" };
export const COMMAND_LABEL: Record<FollowerCommand, string> = { follow: "Following", wait: "Waiting", trade: "Trading" };
export const SPECIES_ICON: Record<string, string> = { wolf: "🐺", cat: "🐱", raven: "🐦" };

export interface CompanionChipView {
  icon: string;
  name: string;
  /** Beside the name: an order ("Following") or a level ("Lv 2"). */
  tag: string;
  health: number;
  maxHealth: number;
}

/** A follower as the chip shows them (their role picks the icon, their order is the tag). */
export function followerChip(f: { name: string; command: FollowerCommand; health: number; maxHealth: number }, role?: FollowerCombatRole): CompanionChipView {
  return { icon: role ? ROLE_ICON[role] : "🛡️", name: f.name, tag: COMMAND_LABEL[f.command], health: f.health, maxHealth: f.maxHealth };
}

/** A pet as the chip shows it (its level is the tag). */
export function petChip(p: { species: string; name: string; level: number; health: number; maxHealth: number }): CompanionChipView {
  return { icon: SPECIES_ICON[p.species] ?? "★", name: p.name, tag: `Lv ${p.level}`, health: p.health, maxHealth: p.maxHealth };
}

const pct = (val: number, max: number) => (max <= 0 ? "0%" : `${Math.min(100, Math.max(0, (val / max) * 100)).toFixed(1)}%`);

export class CompanionChip {
  private _root: HTMLDivElement | null = null;
  private _icon: HTMLSpanElement | null = null;
  private _name: HTMLSpanElement | null = null;
  private _hpFill: HTMLDivElement | null = null;
  private _hpText: HTMLSpanElement | null = null;
  private _tag: HTMLSpanElement | null = null;

  /**
   * @param _order    place in the HUD chips' stack (pet 1, follower 2)
   * @param _barWidth the health bar's width (px)
   * @param _italicTag whether the tag reads as an order (italic) or a stat
   */
  constructor(private readonly _order: number, private readonly _barWidth = 140, private readonly _italicTag = true) {}

  /** Show a companion, or hide the chip (null). */
  public show(v: CompanionChipView | null): void {
    if (typeof document === "undefined") return;
    this._ensure();
    if (!v) { this._root!.style.display = "none"; return; }
    this._icon!.textContent = v.icon;
    this._name!.textContent = v.name;
    this._tag!.textContent = v.tag;
    this._hpFill!.style.width = pct(v.health, v.maxHealth);
    this._hpText!.textContent = `${Math.ceil(v.health)} / ${v.maxHealth}`;
    this._root!.style.display = "flex";
  }

  public hide(): void {
    if (this._root) this._root.style.display = "none";
  }

  private _ensure(): void {
    if (this._root) return;
    const el = <K extends keyof HTMLElementTagNameMap>(tag: K, style: Partial<CSSStyleDeclaration>) => {
      const e = document.createElement(tag);
      Object.assign(e.style, style);
      return e;
    };
    const root = el("div", {
      display: "none", alignItems: "center", gap: "6px", background: C.BG, border: `1px solid ${C.BORDER}`,
      borderRadius: "6px", padding: "5px 8px", pointerEvents: "none", fontFamily: C.FONT, minWidth: `${this._barWidth + 40}px`,
    });
    const icon = el("span", { fontSize: "18px" });
    const info = el("div", { display: "flex", flexDirection: "column", gap: "2px", flex: "1" });
    const nameRow = el("div", { display: "flex", justifyContent: "space-between", alignItems: "baseline" });
    const name = el("span", { color: C.TITLE, fontSize: "14px", fontWeight: "bold" });
    const tag = el("span", { color: C.DIM, fontSize: "13px", fontStyle: this._italicTag ? "italic" : "normal" });
    nameRow.append(name, tag);
    const hpOuter = el("div", { background: C.HP_BG, borderRadius: "2px", height: "6px", width: `${this._barWidth}px`, overflow: "hidden" });
    const hpFill = el("div", { background: C.HP_FILL, height: "100%", width: "100%", borderRadius: "2px", transition: "width 0.2s ease" });
    hpOuter.appendChild(hpFill);
    const hpText = el("span", { color: C.DIM, fontSize: "12px" });
    info.append(nameRow, hpOuter, hpText);
    root.append(icon, info);
    addHudChip(root, this._order); // the HUD chips' stack (ui/hud-chips.ts)
    this._root = root;
    this._icon = icon;
    this._name = name;
    this._hpFill = hpFill;
    this._hpText = hpText;
    this._tag = tag;
  }
}
