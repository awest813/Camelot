export interface StableHorseView {
  id: string;
  name: string;
  speed: number;
  saddlebagCapacity: number;
  price: number;
  isOwned: boolean;
}

/**
 * HTML-driven stable NPC purchase dialog.
 *
 * Mirrors the creator-overlay style used elsewhere in the project:
 * easy to maintain, keyboard-friendly, and independent from Babylon GUI.
 *
 * Wire-up:
 * ```ts
 * stableUI.onPurchase = (horseId) => { ... };
 * stableUI.onClose = () => { ... };
 * stableUI.open(npcName, horses, playerGold);
 * ```
 */
export class StableUI {
  public isVisible: boolean = false;
  public onPurchase: ((horseId: string) => void) | null = null;
  public onClose: (() => void) | null = null;

  private _root: HTMLDivElement | null = null;
  private _titleEl: HTMLHeadingElement | null = null;
  private _goldEl: HTMLParagraphElement | null = null;
  private _listEl: HTMLDivElement | null = null;
  private _statusEl: HTMLParagraphElement | null = null;
  private _buyBtn: HTMLButtonElement | null = null;

  private _horses: StableHorseView[] = [];
  private _selectedId: string | null = null;
  private _playerGold: number = 0;

  /**
   * Open the stable dialog with the given horses and player gold.
   */
  public open(npcName: string, horses: StableHorseView[], playerGold: number): void {
    if (typeof document === "undefined") return;
    this._ensureDom();
    if (!this._root || !this._titleEl || !this._goldEl) return;

    this._horses = horses.slice();
    this._playerGold = playerGold;
    const first = horses.find(h => !h.isOwned) ?? null;
    this._selectedId = first?.id ?? null;

    this._titleEl.textContent = `${npcName}: "Welcome to the stables."`;
    this._goldEl.textContent = `Your gold: ${playerGold}g`;

    this._renderList();

    this._root.style.display = "grid";
    this.isVisible = true;
  }

  public close(): void {
    if (!this._root) return;
    this._root.style.display = "none";
    this.isVisible = false;
    this.onClose?.();
  }

  /** Update the displayed player gold (e.g. after a purchase). */
  public setPlayerGold(gold: number): void {
    this._playerGold = gold;
    if (this._goldEl) this._goldEl.textContent = `Your gold: ${gold}g`;
    this._refreshBuyButton();
  }

  /** Mark a horse as owned (e.g. after a successful purchase). */
  public markOwned(horseId: string): void {
    const horse = this._horses.find(h => h.id === horseId);
    if (!horse) return;
    horse.isOwned = true;
    this._renderList();
  }

  /** Show a status message in the dialog. */
  public showStatus(message: string, isError: boolean = false): void {
    if (!this._statusEl) return;
    this._statusEl.textContent = message;
    this._statusEl.classList.toggle("stable__status--error", isError);
    this._statusEl.classList.toggle("stable__status--ok", !isError);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private _ensureDom(): void {
    if (this._root || typeof document === "undefined") return;

    const root = document.createElement("div");
    root.className = "stable";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "Stable");
    root.style.display = "none";

    const panel = document.createElement("section");
    panel.className = "stable__panel";
    root.appendChild(panel);

    const header = document.createElement("header");
    header.className = "stable__header";
    panel.appendChild(header);

    const titleWrap = document.createElement("div");
    titleWrap.className = "stable__title-wrap";
    header.appendChild(titleWrap);

    const title = document.createElement("h2");
    title.className = "stable__npc-line";
    titleWrap.appendChild(title);
    this._titleEl = title;

    const subtitle = document.createElement("p");
    subtitle.className = "stable__subtitle";
    subtitle.textContent = "Purchase a horse to unlock mounted travel.";
    titleWrap.appendChild(subtitle);

    const closeBtn = document.createElement("button");
    closeBtn.className = "stable__close-btn";
    closeBtn.textContent = "✕";
    closeBtn.setAttribute("aria-label", "Close stable");
    closeBtn.addEventListener("click", () => this.close());
    header.appendChild(closeBtn);

    const gold = document.createElement("p");
    gold.className = "stable__gold";
    panel.appendChild(gold);
    this._goldEl = gold;

    const list = document.createElement("div");
    list.className = "stable__list";
    panel.appendChild(list);
    this._listEl = list;

    const status = document.createElement("p");
    status.className = "stable__status";
    panel.appendChild(status);
    this._statusEl = status;

    const actions = document.createElement("div");
    actions.className = "stable__actions";
    panel.appendChild(actions);

    const buyBtn = document.createElement("button");
    buyBtn.className = "stable__btn stable__btn--primary";
    buyBtn.textContent = "Purchase";
    buyBtn.addEventListener("click", () => this._handlePurchase());
    actions.appendChild(buyBtn);
    this._buyBtn = buyBtn;

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "stable__btn";
    cancelBtn.textContent = "Leave";
    cancelBtn.addEventListener("click", () => this.close());
    actions.appendChild(cancelBtn);

    document.body.appendChild(root);
    this._root = root;
  }

  private _renderList(): void {
    if (!this._listEl) return;
    this._listEl.innerHTML = "";

    if (this._horses.length === 0) {
      const empty = document.createElement("p");
      empty.className = "stable__empty";
      empty.textContent = "No horses available at this stable.";
      this._listEl.appendChild(empty);
      if (this._buyBtn) this._buyBtn.disabled = true;
      return;
    }

    for (const horse of this._horses) {
      const row = document.createElement("button");
      row.className = "stable__row";
      const selected = horse.id === this._selectedId;
      if (selected) row.classList.add("is-selected");
      if (horse.isOwned) row.classList.add("is-owned");
      row.setAttribute("aria-pressed", selected ? "true" : "false");
      row.disabled = horse.isOwned;

      const nameEl = document.createElement("span");
      nameEl.className = "stable__row-name";
      nameEl.textContent = horse.name;
      row.appendChild(nameEl);

      const statsEl = document.createElement("span");
      statsEl.className = "stable__row-stats";
      statsEl.textContent = horse.isOwned
        ? "Owned"
        : `Speed ×${horse.speed.toFixed(1)} · Bag ${horse.saddlebagCapacity} · ${horse.price}g`;
      row.appendChild(statsEl);

      row.addEventListener("click", () => {
        if (horse.isOwned) return;
        this._selectedId = horse.id;
        this._renderList();
      });

      this._listEl.appendChild(row);
    }

    this._refreshBuyButton();
  }

  private _refreshBuyButton(): void {
    if (!this._buyBtn) return;
    const selected = this._horses.find(h => h.id === this._selectedId);
    const canAfford = selected != null && !selected.isOwned && this._playerGold >= selected.price;
    this._buyBtn.disabled = !canAfford;
  }

  private _handlePurchase(): void {
    if (!this._selectedId) return;
    const horse = this._horses.find(h => h.id === this._selectedId);
    if (!horse || horse.isOwned || this._playerGold < horse.price) return;
    this.onPurchase?.(this._selectedId);
  }
}
