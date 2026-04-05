import { WAIT_MIN_HOURS, WAIT_MAX_HOURS } from "../systems/wait-system";

// ── WaitUI ────────────────────────────────────────────────────────────────────

/**
 * WaitUI — Oblivion-style "Wait" dialog overlay.
 *
 * Surfaces the time-skip rest mechanic through an HTML overlay.  The player
 * uses ▲/▼ buttons (or direct numeric input) to choose how many hours to wait
 * (1–{@link WAIT_MAX_HOURS}) and confirms with "Wait".
 *
 * Wire-up example:
 * ```ts
 * const waitUI = new WaitUI();
 *
 * waitUI.onConfirm = (hours) => {
 *   const result = waitSystem.wait(hours, timeSystem, player);
 *   if (result.ok) uiManager.showNotification(result.message, 2500);
 *   waitUI.hide();
 * };
 *
 * waitUI.onClose = () => waitUI.hide();
 *
 * // Open via keyboard handler (T key):
 * waitUI.show(timeSystem.timeString);
 * ```
 */
export class WaitUI {
  public isVisible: boolean = false;

  /** Called when the player confirms the wait.  Argument is the chosen hour count. */
  public onConfirm: ((hours: number) => void) | null = null;
  /** Called when the player dismisses the panel without waiting. */
  public onClose: (() => void) | null = null;

  private _root:        HTMLDivElement | null = null;
  private _timeEl:      HTMLSpanElement | null = null;
  private _hoursInput:  HTMLInputElement | null = null;
  private _decBtn:      HTMLButtonElement | null = null;
  private _incBtn:      HTMLButtonElement | null = null;
  private _hoursValue:  number = 8;

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Make the dialog visible.  Creates the root DOM lazily on first call.
   *
   * @param currentTimeString — Optional display string shown as the current
   *   in-game time (e.g. `"Day 3, 14:30"`).
   */
  public show(currentTimeString?: string): void {
    if (typeof document === "undefined") return;
    this._ensureDom();
    if (this._root) this._root.style.display = "flex";
    this.isVisible = true;
    if (currentTimeString !== undefined && this._timeEl) {
      this._timeEl.textContent = currentTimeString;
    }
  }

  /** Hide the dialog without destroying its DOM. */
  public hide(): void {
    if (this._root) this._root.style.display = "none";
    this.isVisible = false;
  }

  /**
   * Update the current-time label without re-showing the dialog.
   * Useful when the game clock ticks while the dialog is open.
   */
  public setCurrentTime(timeString: string): void {
    if (this._timeEl) this._timeEl.textContent = timeString;
  }

  /** Return the currently selected hour count. */
  public get hours(): number {
    return this._hoursValue;
  }

  /** Remove the DOM element entirely and reset state. */
  public destroy(): void {
    this._root?.remove();
    this._root       = null;
    this._timeEl     = null;
    this._hoursInput = null;
    this._decBtn     = null;
    this._incBtn     = null;
    this.isVisible   = false;
  }

  // ── DOM helpers ─────────────────────────────────────────────────────────────

  private _ensureDom(): void {
    if (this._root) return;

    // Root overlay
    const root = document.createElement("div");
    root.className = "wait-ui";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "Wait");
    root.style.display = "none";

    // Header
    const header = document.createElement("div");
    header.className = "wait-ui__header";

    const title = document.createElement("h2");
    title.className = "wait-ui__title";
    title.textContent = "Wait";
    header.appendChild(title);

    const closeBtn = document.createElement("button");
    closeBtn.className = "wait-ui__close";
    closeBtn.type = "button";
    closeBtn.textContent = "✕";
    closeBtn.setAttribute("aria-label", "Cancel wait");
    closeBtn.addEventListener("click", () => {
      this.hide();
      this.onClose?.();
    });
    header.appendChild(closeBtn);
    root.appendChild(header);

    // Body
    const body = document.createElement("div");
    body.className = "wait-ui__body";

    const prompt = document.createElement("p");
    prompt.className = "wait-ui__prompt";
    prompt.textContent = "How many hours do you wish to wait?";
    body.appendChild(prompt);

    // Current time display
    const timeRow = document.createElement("p");
    timeRow.className = "wait-ui__time-row";

    const timeLabel = document.createElement("span");
    timeLabel.className = "wait-ui__time-label";
    timeLabel.textContent = "Current time: ";

    const timeEl = document.createElement("span");
    timeEl.className = "wait-ui__time-value";
    timeEl.setAttribute("aria-live", "polite");
    timeEl.textContent = "";
    timeRow.appendChild(timeLabel);
    timeRow.appendChild(timeEl);
    body.appendChild(timeRow);

    // Hour spinner
    const spinnerRow = document.createElement("div");
    spinnerRow.className = "wait-ui__spinner-row";

    const decBtn = document.createElement("button");
    decBtn.className = "wait-ui__dec-btn";
    decBtn.type = "button";
    decBtn.textContent = "▼";
    decBtn.setAttribute("aria-label", "Decrease hours");
    decBtn.addEventListener("click", () => {
      if (decBtn.getAttribute("aria-disabled") === "true") return;
      this._setHours(this._hoursValue - 1);
    });
    spinnerRow.appendChild(decBtn);

    const hoursInput = document.createElement("input");
    hoursInput.className = "wait-ui__hours-input";
    hoursInput.type = "number";
    hoursInput.min = String(WAIT_MIN_HOURS);
    hoursInput.max = String(WAIT_MAX_HOURS);
    hoursInput.value = String(this._hoursValue);
    hoursInput.setAttribute("aria-label", "Hours to wait");
    hoursInput.addEventListener("change", () => {
      const parsed = parseInt(hoursInput.value, 10);
      if (!isNaN(parsed)) this._setHours(parsed);
    });
    hoursInput.addEventListener("input", () => {
      const parsed = parseInt(hoursInput.value, 10);
      if (!isNaN(parsed)) this._setHours(parsed);
    });
    spinnerRow.appendChild(hoursInput);

    const incBtn = document.createElement("button");
    incBtn.className = "wait-ui__inc-btn";
    incBtn.type = "button";
    incBtn.textContent = "▲";
    incBtn.setAttribute("aria-label", "Increase hours");
    incBtn.addEventListener("click", () => {
      if (incBtn.getAttribute("aria-disabled") === "true") return;
      this._setHours(this._hoursValue + 1);
    });
    spinnerRow.appendChild(incBtn);

    const hoursUnitLabel = document.createElement("span");
    hoursUnitLabel.className = "wait-ui__hours-unit";
    hoursUnitLabel.textContent = "hours";
    spinnerRow.appendChild(hoursUnitLabel);

    body.appendChild(spinnerRow);
    root.appendChild(body);

    // Footer
    const footer = document.createElement("div");
    footer.className = "wait-ui__footer";

    const waitBtn = document.createElement("button");
    waitBtn.className = "wait-ui__confirm-btn";
    waitBtn.type = "button";
    waitBtn.textContent = "Wait";
    waitBtn.addEventListener("click", () => {
      this.onConfirm?.(this._hoursValue);
    });
    footer.appendChild(waitBtn);

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "wait-ui__cancel-btn";
    cancelBtn.type = "button";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => {
      this.hide();
      this.onClose?.();
    });
    footer.appendChild(cancelBtn);

    root.appendChild(footer);
    document.body.appendChild(root);

    this._root       = root;
    this._timeEl     = timeEl;
    this._hoursInput = hoursInput;
    this._decBtn     = decBtn;
    this._incBtn     = incBtn;

    // Initial setup of button states
    this._setHours(this._hoursValue);
  }

  private _setHours(value: number): void {
    this._hoursValue = Math.max(WAIT_MIN_HOURS, Math.min(WAIT_MAX_HOURS, Math.round(value)));
    if (this._hoursInput) this._hoursInput.value = String(this._hoursValue);

    if (this._decBtn) {
      const atMin = this._hoursValue <= WAIT_MIN_HOURS;
      this._decBtn.setAttribute("aria-disabled", String(atMin));
      if (atMin) {
        this._decBtn.setAttribute("title", "Minimum hours reached");
        this._decBtn.style.opacity = "0.5";
        this._decBtn.style.cursor = "not-allowed";
      } else {
        this._decBtn.removeAttribute("title");
        this._decBtn.style.opacity = "";
        this._decBtn.style.cursor = "";
      }
    }

    if (this._incBtn) {
      const atMax = this._hoursValue >= WAIT_MAX_HOURS;
      this._incBtn.setAttribute("aria-disabled", String(atMax));
      if (atMax) {
        this._incBtn.setAttribute("title", "Maximum hours reached");
        this._incBtn.style.opacity = "0.5";
        this._incBtn.style.cursor = "not-allowed";
      } else {
        this._incBtn.removeAttribute("title");
        this._incBtn.style.opacity = "";
        this._incBtn.style.cursor = "";
      }
    }
  }
}
