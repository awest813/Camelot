export interface FastTravelOptionView {
  id: string;
  name: string;
  estimatedHours: number;
}

/**
 * HTML-driven fast-travel destination picker.
 *
 * This intentionally mirrors the creator-overlay style used elsewhere in the
 * project: easy to maintain, keyboard-friendly, and independent from Babylon
 * GUI layout constraints.
 */
export class FastTravelUI {
  public isVisible: boolean = false;
  public onTravel: ((locationId: string) => void) | null = null;
  public onClose: (() => void) | null = null;

  private _root: HTMLDivElement | null = null;
  private _listEl: HTMLDivElement | null = null;
  private _statusEl: HTMLParagraphElement | null = null;
  private _travelBtn: HTMLButtonElement | null = null;
  private _options: FastTravelOptionView[] = [];
  private _selectedId: string | null = null;

  public open(options: FastTravelOptionView[]): void {
    if (typeof document === "undefined") return;
    this._ensureDom();
    if (!this._root || !this._listEl || !this._statusEl || !this._travelBtn) return;

    this._options = options.slice();
    this._selectedId = options.length > 0 ? options[0].id : null;
    this._renderOptions();

    this._root.style.display = "grid";
    this.isVisible = true;
  }

  public close(): void {
    if (!this._root) return;
    this._root.style.display = "none";
    this.isVisible = false;
    this.onClose?.();
  }

  private _ensureDom(): void {
    if (this._root) return;
    if (typeof document === "undefined") return;

    const root = document.createElement("div");
    root.className = "fast-travel";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "fast-travel-title");
    root.style.display = "none";

    const panel = document.createElement("section");
    panel.className = "fast-travel__panel";
    root.appendChild(panel);

    const header = document.createElement("header");
    header.className = "fast-travel__header";
    panel.appendChild(header);

    const titleWrap = document.createElement("div");
    titleWrap.className = "fast-travel__title-wrap";
    header.appendChild(titleWrap);

    const title = document.createElement("h2");
    title.id = "fast-travel-title";
    title.className = "fast-travel__title";
    title.textContent = "Fast Travel";
    titleWrap.appendChild(title);

    const subtitle = document.createElement("p");
    subtitle.className = "fast-travel__subtitle";
    subtitle.textContent = "Select a discovered location. Travel time advances the in-game clock.";
    titleWrap.appendChild(subtitle);

    const closeBtn = document.createElement("button");
    closeBtn.className = "fast-travel__close-btn";
    closeBtn.textContent = "✕";
    closeBtn.setAttribute("aria-label", "Close fast travel map");
    closeBtn.addEventListener("click", () => this.close());
    header.appendChild(closeBtn);

    const list = document.createElement("div");
    list.className = "fast-travel__list";
    panel.appendChild(list);
    this._listEl = list;

    const status = document.createElement("p");
    status.className = "fast-travel__status";
    status.setAttribute("aria-live", "polite");
    panel.appendChild(status);
    this._statusEl = status;

    const actions = document.createElement("div");
    actions.className = "fast-travel__actions";
    panel.appendChild(actions);

    const travelBtn = document.createElement("button");
    travelBtn.className = "fast-travel__btn fast-travel__btn--primary";
    travelBtn.textContent = "Travel";
    travelBtn.addEventListener("click", () => {
      if (!this._selectedId) return;
      this.onTravel?.(this._selectedId);
    });
    actions.appendChild(travelBtn);
    this._travelBtn = travelBtn;

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "fast-travel__btn";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => this.close());
    actions.appendChild(cancelBtn);

    document.body.appendChild(root);
    this._root = root;
  }

  private _renderOptions(): void {
    if (!this._listEl || !this._statusEl || !this._travelBtn) return;
    this._listEl.innerHTML = "";

    if (this._options.length === 0) {
      const empty = document.createElement("p");
      empty.className = "fast-travel__empty";
      empty.textContent = "No locations discovered yet.";
      this._listEl.appendChild(empty);
      this._statusEl.textContent = "Explore the world to discover destinations.";
      this._travelBtn.disabled = true;
      this._travelBtn.setAttribute("aria-disabled", "true");
      this._travelBtn.title = "No destinations available.";
      return;
    }

    for (const option of this._options) {
      const row = document.createElement("button");
      row.className = "fast-travel__row";
      const selected = option.id === this._selectedId;
      if (selected) row.classList.add("is-selected");
      row.setAttribute("aria-pressed", selected ? "true" : "false");

      const name = document.createElement("span");
      name.className = "fast-travel__row-name";
      name.textContent = option.name;
      row.appendChild(name);

      const eta = document.createElement("span");
      eta.className = "fast-travel__row-eta";
      eta.textContent = `~${option.estimatedHours.toFixed(1)}h`;
      row.appendChild(eta);

      row.addEventListener("click", () => {
        this._selectedId = option.id;
        this._renderOptions();
      });

      this._listEl.appendChild(row);
    }

    const selected = this._options.find((o) => o.id === this._selectedId) ?? null;
    if (selected) {
      this._statusEl.textContent = `Travel to ${selected.name} (estimated ${selected.estimatedHours.toFixed(1)} hours).`;
    } else {
      this._statusEl.textContent = "Choose a destination.";
    }

    const isDisabled = !selected;
    this._travelBtn.disabled = isDisabled;
    this._travelBtn.setAttribute("aria-disabled", isDisabled ? "true" : "false");
    this._travelBtn.title = isDisabled
      ? "Select a destination to travel."
      : `Travel to ${selected?.name}.`;
  }
}

