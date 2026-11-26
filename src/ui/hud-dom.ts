/**
 * The in-game HUD on the DOM layer: crosshair, interaction prompt, the
 * health / magicka / stamina bars, the XP bar, notifications, compass,
 * clock, stealth eye, combat-state line, debug overlay, hit flash, damage
 * numbers and the screen fade.  Plain elements updated in place (the bars
 * change every frame, so no re-render); the UI manager drives it.
 *
 * Engine overhaul, Phase 8 (it was a fullscreen Babylon GUI texture).
 */

export type StealthState = "Hidden" | "Caution" | "Detected";

/** Most notifications on screen at once; a new one pushes out the oldest. */
export const MAX_NOTIFICATIONS = 6;
/** Most damage numbers on screen at once. */
export const MAX_DAMAGE_NUMBERS = 12;
const DAMAGE_LIFETIME_MS = 1000;
const FLASH_MS = 420;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent?: HTMLElement): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  e.className = cls;
  parent?.appendChild(e);
  return e;
};

/** `current / max` as a CSS width, clamped to 0–100 %. */
export function barWidth(current: number, max: number): string {
  if (max <= 0) return "0%";
  return `${Math.min(100, Math.max(0, (current / max) * 100))}%`;
}

export class HudDom {
  public readonly root: HTMLDivElement;
  public readonly crosshair: HTMLDivElement;
  public readonly interaction: HTMLDivElement;
  public readonly health: HTMLDivElement;
  public readonly magicka: HTMLDivElement;
  public readonly stamina: HTMLDivElement;
  public readonly xp: HTMLDivElement;
  public readonly level: HTMLDivElement;
  public readonly notifications: HTMLDivElement;
  public readonly compass: HTMLDivElement;
  public readonly clock: HTMLDivElement;
  public readonly stealth: HTMLDivElement;
  public readonly combatState: HTMLDivElement;
  public readonly debug: HTMLPreElement;
  public readonly flash: HTMLDivElement;
  public readonly fade: HTMLDivElement;
  private readonly _damage: HTMLDivElement;

  constructor() {
    this.root = el("div", "hud");
    this.root.setAttribute("aria-label", "Heads-up display");

    this.crosshair = el("div", "hud-crosshair", this.root);
    this.crosshair.setAttribute("aria-hidden", "true");
    for (const arm of ["top", "bottom", "left", "right", "dot"]) el("span", `hud-crosshair__${arm}`, this.crosshair);

    this.interaction = el("div", "hud-interaction", this.root);
    this.interaction.setAttribute("role", "status");

    const xpRow = el("div", "hud-xp", this.root);
    this.level = el("div", "hud-xp__level", xpRow);
    const xpTrack = el("div", "hud-xp__track", xpRow);
    xpTrack.setAttribute("role", "progressbar");
    xpTrack.setAttribute("aria-label", "Experience");
    this.xp = el("div", "hud-xp__fill", xpTrack);

    const bars = el("div", "hud-bars", this.root);
    const bar = (label: string, name: string, kind: string) => {
      const track = el("div", `hud-bar hud-bar--${kind}`, bars);
      track.setAttribute("role", "progressbar");
      track.setAttribute("aria-label", name);
      const fill = el("div", "hud-bar__fill", track);
      el("span", "hud-bar__label", track).textContent = label;
      return fill;
    };
    this.magicka = bar("Magicka", "Magicka", "mp");
    this.health = bar("Health", "Health", "hp");
    this.stamina = bar("Stamina", "Stamina", "sp");

    this.notifications = el("div", "hud-notifications", this.root);
    this.notifications.setAttribute("role", "log");
    this.notifications.setAttribute("aria-live", "polite");

    this.compass = el("div", "hud-compass", this.root);
    this.compass.setAttribute("aria-label", "Compass");
    this.clock = el("div", "hud-clock", this.root);
    this.stealth = el("div", "hud-stealth", this.root);
    this.stealth.setAttribute("role", "status");
    this.stealth.hidden = true;
    this.combatState = el("div", "hud-combat-state", this.root);
    this.combatState.hidden = true;
    this.debug = el("pre", "hud-debug", this.root);
    this.debug.hidden = true;
    this._damage = el("div", "hud-damage", this.root);
    this._damage.setAttribute("aria-hidden", "true");
    this.flash = el("div", "hud-flash", this.root);
    this.flash.setAttribute("aria-hidden", "true");
    this.fade = el("div", "hud-fade", this.root);
    this.fade.hidden = true;

    if (typeof document !== "undefined") document.body.appendChild(this.root);
  }

  public setCrosshair(visible: boolean): void {
    this.crosshair.hidden = !visible;
  }

  public setCrosshairActive(active: boolean): void {
    this.crosshair.classList.toggle("hud-crosshair--active", active);
  }

  /** Set a bar's fill; the health bar pulses below a quarter. */
  public setBar(fill: HTMLDivElement, current: number, max: number): void {
    const w = barWidth(current, max);
    if (fill.style.width !== w) fill.style.width = w;
    fill.parentElement!.setAttribute("aria-valuenow", String(Math.round(max > 0 ? Math.max(0, Math.min(1, current / max)) * 100 : 0)));
    if (fill === this.health) {
      const low = max > 0 && current > 0 && current / max < 0.25;
      fill.parentElement!.classList.toggle("hud-bar--low", low);
    }
  }

  public setText(target: HTMLElement, text: string): void {
    if (target.textContent !== text) target.textContent = text;
  }

  /** Add a notification for `durationMs`. */
  public notify(text: string, durationMs: number): void {
    const row = el("div", "hud-notification", this.notifications);
    row.textContent = text;
    while (this.notifications.childElementCount > MAX_NOTIFICATIONS) this.notifications.firstElementChild!.remove();
    setTimeout(() => row.remove(), durationMs);
  }

  public setStealth(state: StealthState | null): void {
    this.stealth.hidden = state === null;
    if (!state) return;
    this.stealth.textContent = state;
    this.stealth.dataset.state = state.toLowerCase();
  }

  public setCombatState(text: string | null): void {
    this.combatState.hidden = text === null;
    this.combatState.textContent = text ?? "";
  }

  /** A translucent full-screen flash that fades out. */
  public showFlash(color: string): void {
    this.flash.style.background = color;
    if (typeof this.flash.animate === "function") {
      this.flash.getAnimations?.().forEach((a) => a.cancel());
      this.flash.animate([{ opacity: 0.45 }, { opacity: 0 }], { duration: FLASH_MS, easing: "linear" });
    }
  }

  /** A number that rises and fades from a screen position (CSS px). */
  public showDamageNumber(x: number, y: number, text: string, color: string): void {
    const label = el("span", "hud-damage__number", this._damage);
    label.textContent = text;
    label.style.color = color;
    label.style.left = `${x}px`;
    label.style.top = `${y}px`;
    while (this._damage.childElementCount > MAX_DAMAGE_NUMBERS) this._damage.firstElementChild!.remove();
    if (typeof label.animate === "function") {
      const anim = label.animate(
        [{ transform: "translate(-50%, -50%)", opacity: 1 }, { transform: "translate(-50%, calc(-50% - 30px))", opacity: 0 }],
        { duration: DAMAGE_LIFETIME_MS, easing: "linear", fill: "forwards" },
      );
      anim.onfinish = () => label.remove();
    } else {
      setTimeout(() => label.remove(), DAMAGE_LIFETIME_MS);
    }
  }

  /** The fade overlay's opacity; 0 hides it. */
  public setFade(alpha: number): void {
    this.fade.hidden = alpha <= 0;
    this.fade.style.opacity = String(alpha);
  }

  public destroy(): void {
    this.root.remove();
  }
}
