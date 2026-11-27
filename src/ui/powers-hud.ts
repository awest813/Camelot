/**
 * The daily powers' HUD chip: the heritage's (V) and the omen's (Shift+V),
 * each READY or how long until it is.  It sits in the HUD chips' stack and
 * writes to the page only when what it shows changes.
 */
import { addHudChip } from "./hud-chips";

export interface PowerLine {
  /** The key that uses it ("V", "Shift+V"). */
  key: string;
  name: string;
  /** Game minutes until it is ready (0: ready). */
  minutesLeft: number;
}

/** "READY", or the wait in game hours and minutes ("5h 20m", "40m"). */
export function readiness(minutesLeft: number): string {
  if (minutesLeft <= 0) return "READY";
  const m = Math.ceil(minutesLeft);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${String(m % 60).padStart(2, "0")}m` : `${m}m`;
}

export class PowersHud {
  private _root: HTMLElement | null = null;
  private _shown = "";

  /** Show these powers (none: the chip hides). */
  public update(lines: readonly PowerLine[]): void {
    if (typeof document === "undefined") return;
    const key = lines.map((l) => `${l.key}|${l.name}|${readiness(l.minutesLeft)}`).join(";");
    if (key === this._shown) return;
    this._shown = key;
    const root = this._ensure();
    root.style.display = lines.length ? "grid" : "none";
    root.replaceChildren(...lines.map((l) => {
      const row = document.createElement("div");
      row.className = "powers-hud__row";
      const k = document.createElement("span");
      k.className = "powers-hud__key";
      k.textContent = l.key;
      const n = document.createElement("span");
      n.className = "powers-hud__name";
      n.textContent = l.name;
      const st = document.createElement("span");
      const ready = l.minutesLeft <= 0;
      st.className = `powers-hud__state${ready ? " is-ready" : ""}`;
      st.textContent = readiness(l.minutesLeft);
      row.append(k, n, st);
      return row;
    }));
  }

  public destroy(): void {
    this._root?.remove();
    this._root = null;
    this._shown = "";
  }

  private _ensure(): HTMLElement {
    if (this._root) return this._root;
    const root = document.createElement("div");
    root.className = "powers-hud";
    root.setAttribute("role", "status");
    root.setAttribute("aria-label", "Daily powers");
    addHudChip(root, 4);
    this._root = root;
    return root;
  }
}
