/**
 * The survival chip: what hunger, fatigue and cold are doing to you, shown
 * only when it matters (well fed / rested for their XP bonus, hungry or
 * worse, tired or worse, chilly or worse). The bottom of the HUD chips' stack.
 */
import { addHudChip } from "./hud-chips";
import type { ColdLevel, FatigueLevel, HungerLevel } from "../systems/survival-system";

const GOOD = "#7FCF6F", WARN = "#D9A63A", BAD = "#E0533F";

type Tag = { icon: string; text: string; color: string };

const HUNGER: Partial<Record<HungerLevel, Tag>> = {
  satiated: { icon: "🍖", text: "Well fed", color: GOOD },
  hungry: { icon: "🍖", text: "Hungry", color: WARN },
  starving: { icon: "🍖", text: "Starving", color: BAD },
};
const FATIGUE: Partial<Record<FatigueLevel, Tag>> = {
  rested: { icon: "☾", text: "Rested", color: GOOD },
  tired: { icon: "☾", text: "Tired", color: WARN },
  exhausted: { icon: "☾", text: "Exhausted", color: BAD },
};
const COLD: Partial<Record<ColdLevel, Tag>> = {
  chilly: { icon: "❄", text: "Chilly", color: WARN },
  cold: { icon: "❄", text: "Cold", color: WARN },
  freezing: { icon: "❄", text: "Freezing", color: BAD },
};

/** The tags to show for these levels (none when all are ordinary). */
export function survivalTags(hunger: HungerLevel, fatigue: FatigueLevel, cold: ColdLevel): Tag[] {
  return [HUNGER[hunger], FATIGUE[fatigue], COLD[cold]].filter((t): t is Tag => !!t);
}

export class SurvivalChip {
  private _root: HTMLDivElement | null = null;
  private _last = "";

  public update(hunger: HungerLevel, fatigue: FatigueLevel, cold: ColdLevel): void {
    if (typeof document === "undefined") return;
    const key = `${hunger}|${fatigue}|${cold}`;
    if (key === this._last) return;
    this._last = key;
    const tags = survivalTags(hunger, fatigue, cold);
    const root = this._ensure();
    root.replaceChildren(...tags.map((t) => {
      const el = document.createElement("span");
      el.textContent = `${t.icon} ${t.text}`;
      Object.assign(el.style, { color: t.color, whiteSpace: "nowrap" });
      return el;
    }));
    root.style.display = tags.length ? "flex" : "none";
  }

  private _ensure(): HTMLDivElement {
    if (this._root) return this._root;
    const root = document.createElement("div");
    root.className = "survival-chip";
    root.setAttribute("role", "status");
    root.setAttribute("aria-label", "Hunger, fatigue and cold");
    Object.assign(root.style, {
      display: "none", gap: "10px", alignItems: "center",
      background: "rgba(30, 19, 11, 0.97)", border: "1px solid #8A6A2C", borderRadius: "6px",
      padding: "4px 9px", pointerEvents: "none", fontFamily: "'EB Garamond', Georgia, serif", fontSize: "13px",
    });
    addHudChip(root, 0);
    this._root = root;
    return root;
  }
}
