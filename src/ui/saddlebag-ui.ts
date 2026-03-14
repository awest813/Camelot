export interface SaddlebagItemView {
  id: string;
  name: string;
  quantity: number;
  stackable: boolean;
}

/**
 * HTML-driven saddlebag inventory dialog.
 *
 * Shows the contents of the currently mounted horse's saddlebag.
 * Allows the player to remove items back to their main inventory.
 *
 * Wire-up:
 * ```ts
 * saddlebagUI.onRemoveItem = (itemId) => { ... };
 * saddlebagUI.onClose = () => { ... };
 * saddlebagUI.open(horseName, items, capacityUsed, capacityMax);
 * ```
 */
export class SaddlebagUI {
  public isVisible: boolean = false;
  public onRemoveItem: ((itemId: string) => void) | null = null;
  public onClose: (() => void) | null = null;

  private _root: HTMLDivElement | null = null;
  private _titleEl: HTMLHeadingElement | null = null;
  private _capacityEl: HTMLParagraphElement | null = null;
  private _listEl: HTMLDivElement | null = null;
  private _statusEl: HTMLParagraphElement | null = null;

  /**
   * Open the saddlebag dialog for the given horse.
   */
  public open(
    horseName: string,
    items: SaddlebagItemView[],
    capacityUsed: number,
    capacityMax: number,
  ): void {
    if (typeof document === "undefined") return;
    this._ensureDom();
    if (!this._root || !this._titleEl || !this._capacityEl) return;

    this._titleEl.textContent = `${horseName}'s Saddlebag`;
    this._capacityEl.textContent = `Slots used: ${capacityUsed} / ${capacityMax}`;

    this._renderItems(items);

    this._root.style.display = "grid";
    this.isVisible = true;
  }

  public close(): void {
    if (!this._root) return;
    this._root.style.display = "none";
    this.isVisible = false;
    this.onClose?.();
  }

  /** Refresh the list with updated item data. */
  public refresh(items: SaddlebagItemView[], capacityUsed: number, capacityMax: number): void {
    if (!this._root || !this._capacityEl) return;
    this._capacityEl.textContent = `Slots used: ${capacityUsed} / ${capacityMax}`;
    this._renderItems(items);
  }

  /** Show a status message in the dialog. */
  public showStatus(message: string): void {
    if (!this._statusEl) return;
    this._statusEl.textContent = message;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private _ensureDom(): void {
    if (this._root || typeof document === "undefined") return;

    const root = document.createElement("div");
    root.className = "saddlebag";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "Saddlebag");
    root.style.display = "none";

    const panel = document.createElement("section");
    panel.className = "saddlebag__panel";
    root.appendChild(panel);

    const header = document.createElement("header");
    header.className = "saddlebag__header";
    panel.appendChild(header);

    const titleWrap = document.createElement("div");
    titleWrap.className = "saddlebag__title-wrap";
    header.appendChild(titleWrap);

    const title = document.createElement("h2");
    title.className = "saddlebag__title";
    titleWrap.appendChild(title);
    this._titleEl = title;

    const capacity = document.createElement("p");
    capacity.className = "saddlebag__capacity";
    titleWrap.appendChild(capacity);
    this._capacityEl = capacity;

    const closeBtn = document.createElement("button");
    closeBtn.className = "saddlebag__close-btn";
    closeBtn.textContent = "✕";
    closeBtn.setAttribute("aria-label", "Close saddlebag");
    closeBtn.addEventListener("click", () => this.close());
    header.appendChild(closeBtn);

    const list = document.createElement("div");
    list.className = "saddlebag__list";
    panel.appendChild(list);
    this._listEl = list;

    const status = document.createElement("p");
    status.className = "saddlebag__status";
    panel.appendChild(status);
    this._statusEl = status;

    const actions = document.createElement("div");
    actions.className = "saddlebag__actions";
    panel.appendChild(actions);

    const doneBtn = document.createElement("button");
    doneBtn.className = "saddlebag__btn saddlebag__btn--primary";
    doneBtn.textContent = "Done";
    doneBtn.addEventListener("click", () => this.close());
    actions.appendChild(doneBtn);

    document.body.appendChild(root);
    this._root = root;
  }

  private _renderItems(items: SaddlebagItemView[]): void {
    if (!this._listEl) return;
    this._listEl.innerHTML = "";

    if (items.length === 0) {
      const empty = document.createElement("p");
      empty.className = "saddlebag__empty";
      empty.textContent = "The saddlebag is empty.";
      this._listEl.appendChild(empty);
      return;
    }

    for (const item of items) {
      const row = document.createElement("div");
      row.className = "saddlebag__row";

      const nameEl = document.createElement("span");
      nameEl.className = "saddlebag__row-name";
      nameEl.textContent = item.stackable ? `${item.name} ×${item.quantity}` : item.name;
      row.appendChild(nameEl);

      const removeBtn = document.createElement("button");
      removeBtn.className = "saddlebag__row-remove";
      removeBtn.textContent = "Take";
      removeBtn.setAttribute("aria-label", `Take ${item.name} from saddlebag`);
      removeBtn.addEventListener("click", () => this.onRemoveItem?.(item.id));
      row.appendChild(removeBtn);

      this._listEl.appendChild(row);
    }
  }
}
