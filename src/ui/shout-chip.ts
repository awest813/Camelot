/**
 * The ready word's HUD chip: its name, word pips, and READY or the cooldown,
 * in the HUD chips' stack. Kept apart from the words panel so the panel can
 * load on first open (out of the start-up bundle).
 */
import { addHudChip } from "./hud-chips";

const C = {
  BG: "rgba(30, 19, 11, 0.97)",
  BORDER: "#8A6A2C",
  TITLE: "#F1D08A",
  DIM: "#B49F78",
  READY: "#5EC45E",
  COOLDOWN: "#CC9910",
  FONT: "'Cinzel', 'Times New Roman', Georgia, serif",
  MONO: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
};

/** Snapshot for the persistent HUD chip (null hides the chip). */
export interface ShoutHudInfo {
  name: string;
  /** Number of unlocked words (0–3). */
  tier: number;
  /** Seconds of cooldown remaining; 0 means ready to shout. */
  cooldownSeconds: number;
}

export class ShoutChip {
  private _hudRoot:      HTMLDivElement | null = null;
  private _hudName:      HTMLSpanElement | null = null;
  private _hudPips:      HTMLSpanElement | null = null;
  private _hudState:     HTMLSpanElement | null = null;
  private _lastHudSerial: string = "";

  /**
   * Show / refresh the HUD chip.  Pass `null` to hide it (no shout equipped).
   * Cheap to call every frame — DOM writes are skipped when nothing changed.
   */
  public update(info: ShoutHudInfo | null): void {
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

  private _ensureHUD(): void {
    if (this._hudRoot) return;

    const root = document.createElement("div");
    root.setAttribute("role", "status");
    root.setAttribute("aria-live", "polite");
    root.setAttribute("aria-label", "Word ready to speak");
    Object.assign(root.style, {
      display:       "none",
      alignItems:    "center",
      gap:           "6px",
      background:    C.BG,
      border:        `1px solid ${C.BORDER}`,
      borderRadius:  "6px",
      padding:       "5px 8px",
      pointerEvents: "none",
      fontFamily:    C.FONT,
      minWidth:      "150px",
    });

    const icon = document.createElement("span");
    icon.style.fontSize = "15px";
    icon.textContent = "🜂";

    const name = document.createElement("span");
    Object.assign(name.style, { color: C.TITLE, fontSize: "14px", fontWeight: "bold", flex: "1" });

    const pips = document.createElement("span");
    Object.assign(pips.style, { color: C.DIM, fontSize: "13px", fontFamily: C.MONO });

    const state = document.createElement("span");
    Object.assign(state.style, { fontSize: "12px", fontFamily: C.FONT, fontWeight: "bold", letterSpacing: "1px" });

    root.append(icon, name, pips, state);
    addHudChip(root, 3); // the HUD chips' stack (ui/hud-chips.ts)

    this._hudRoot  = root;
    this._hudName  = name;
    this._hudPips  = pips;
    this._hudState = state;
  }

}
