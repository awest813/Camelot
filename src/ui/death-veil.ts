/**
 * The veil over the screen while the player is down: the world darkens to
 * a wine-black vignette and "You have fallen" is written across it.  It
 * lifts when they wake (or are healed in time, or a save is loaded).
 *
 * Plain DOM, no-op without a document (headless tests).
 */
export class DeathVeil {
  private _el: HTMLElement | null = null;

  public get isShown(): boolean {
    return this._el !== null && !this._el.classList.contains("is-lifting");
  }

  public show(): void {
    if (typeof document === "undefined") return;
    this._el?.remove();
    const el = document.createElement("div");
    el.className = "death-veil";
    el.setAttribute("role", "alert");
    const title = document.createElement("div");
    title.className = "death-veil__title";
    title.textContent = "You have fallen";
    const rule = document.createElement("div");
    rule.className = "death-veil__rule";
    rule.setAttribute("aria-hidden", "true");
    const line = document.createElement("div");
    line.className = "death-veil__line";
    line.textContent = "Darkness takes you. You will wake at the nearest place you know.";
    el.append(title, rule, line);
    document.body.appendChild(el);
    this._el = el;
  }

  public hide(): void {
    const el = this._el;
    if (!el || el.classList.contains("is-lifting")) return;
    el.classList.add("is-lifting");
    const remove = () => {
      el.remove();
      if (this._el === el) this._el = null;
    };
    el.addEventListener("animationend", remove, { once: true });
    setTimeout(remove, 900); // (no animation under reduced motion)
  }
}
