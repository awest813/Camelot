import type { BarterSystem, MerchantDef } from "../systems/barter-system";
import type { Item } from "../systems/inventory-system";

// ── BarterUI ───────────────────────────────────────────────────────────────────

/**
 * BarterUI — merchant trade / barter overlay.
 *
 * Surfaces a {@link BarterSystem} through a two-column HTML overlay: the
 * merchant's inventory on the left (with buy prices) and the player's
 * inventory on the right (with sell prices).  A footer shows both gold
 * totals.  Individual items are clicked to trigger a buy or sell.
 *
 * Call `update(system, playerItems)` after any transaction to keep both
 * columns in sync without re-creating the DOM.
 *
 * Wire-up example:
 * ```ts
 * const ui = new BarterUI();
 *
 * ui.onBuy = (itemId) => {
 *   barterSystem.buyItem(barterSystem.activeMerchantId!, itemId);
 *   ui.update(barterSystem, inventorySystem.items);
 * };
 *
 * ui.onSell = (itemId) => {
 *   barterSystem.sellItem(barterSystem.activeMerchantId!, itemId);
 *   ui.update(barterSystem, inventorySystem.items);
 * };
 *
 * // Open via merchant interaction:
 * barterSystem.openBarter(merchantId, currentHour);
 * ui.show();
 * ui.update(barterSystem, inventorySystem.items);
 * ```
 */
export class BarterUI {
  public isVisible: boolean = false;

  /** Called when the player clicks "Buy" on a merchant item row. */
  public onBuy: ((itemId: string) => void) | null = null;
  /** Called when the player clicks "Sell" on a player item row. */
  public onSell: ((itemId: string) => void) | null = null;
  /** Called when the panel's close button is pressed. */
  public onClose: (() => void) | null = null;

  private _root:         HTMLDivElement | null = null;
  private _titleEl:      HTMLHeadingElement | null = null;
  private _merchantList: HTMLUListElement | null = null;
  private _playerList:   HTMLUListElement | null = null;
  private _merchantGold: HTMLSpanElement | null = null;
  private _playerGold:   HTMLSpanElement | null = null;

  /** Last `BarterSystem` passed to `update()` — kept for re-renders. */
  private _lastSystem: BarterSystem | null = null;
  /** Last player items passed to `update()`. */
  private _lastPlayerItems: ReadonlyArray<Item> = [];

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Make the panel visible. Creates the root DOM lazily on first call. */
  public show(): void {
    if (typeof document === "undefined") return;
    this._ensureDom();
    if (this._root) this._root.style.display = "flex";
    this.isVisible = true;
  }

  /** Hide the panel without destroying its DOM. */
  public hide(): void {
    if (this._root) this._root.style.display = "none";
    this.isVisible = false;
  }

  /**
   * Refresh the display from the current system and player inventory.
   * Call after any buy/sell transaction.
   *
   * @param system      — The {@link BarterSystem} providing merchant data.
   * @param playerItems — The player's current inventory items (read-only).
   */
  public update(system: BarterSystem, playerItems: ReadonlyArray<Item>): void {
    if (typeof document === "undefined") return;
    this._ensureDom();

    this._lastSystem      = system;
    this._lastPlayerItems = playerItems;

    const merchantId = system.activeMerchantId;
    const merchant   = merchantId ? system.getMerchant(merchantId) : undefined;

    this._renderTitle(merchant);
    this._renderMerchantList(system, merchant);
    this._renderPlayerList(system, playerItems, merchantId ?? undefined);
    this._renderGold(system, merchant);
  }

  /** Remove the DOM element entirely and reset state. */
  public destroy(): void {
    this._root?.remove();
    this._root         = null;
    this._titleEl      = null;
    this._merchantList = null;
    this._playerList   = null;
    this._merchantGold = null;
    this._playerGold   = null;
    this._lastSystem      = null;
    this._lastPlayerItems = [];
    this.isVisible = false;
  }

  // ── DOM helpers ─────────────────────────────────────────────────────────────

  private _ensureDom(): void {
    if (this._root) return;

    // Root overlay
    const root = document.createElement("div");
    root.className = "barter-ui";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "Merchant Barter");
    root.style.display = "none";

    // Header
    const header = document.createElement("div");
    header.className = "barter-ui__header";

    const title = document.createElement("h2");
    title.className = "barter-ui__title";
    title.textContent = "Merchant";
    header.appendChild(title);

    const closeBtn = document.createElement("button");
    closeBtn.className = "barter-ui__close";
    closeBtn.type = "button";
    closeBtn.textContent = "✕";
    closeBtn.setAttribute("aria-label", "Close barter");
    closeBtn.addEventListener("click", () => {
      this.hide();
      this.onClose?.();
    });
    header.appendChild(closeBtn);
    root.appendChild(header);

    // Two-column body
    const body = document.createElement("div");
    body.className = "barter-ui__body";

    // Merchant column
    const merchantCol = document.createElement("div");
    merchantCol.className = "barter-ui__col";

    const merchantHeader = document.createElement("h3");
    merchantHeader.className = "barter-ui__col-title";
    merchantHeader.textContent = "Merchant's Goods";
    merchantCol.appendChild(merchantHeader);

    const merchantList = document.createElement("ul");
    merchantList.className = "barter-ui__item-list";
    merchantList.setAttribute("role", "list");
    merchantList.setAttribute("aria-label", "Merchant inventory");
    merchantCol.appendChild(merchantList);

    body.appendChild(merchantCol);

    // Player column
    const playerCol = document.createElement("div");
    playerCol.className = "barter-ui__col";

    const playerHeader = document.createElement("h3");
    playerHeader.className = "barter-ui__col-title";
    playerHeader.textContent = "Your Inventory";
    playerCol.appendChild(playerHeader);

    const playerList = document.createElement("ul");
    playerList.className = "barter-ui__item-list";
    playerList.setAttribute("role", "list");
    playerList.setAttribute("aria-label", "Player inventory");
    playerCol.appendChild(playerList);

    body.appendChild(playerCol);
    root.appendChild(body);

    // Footer — gold totals
    const footer = document.createElement("div");
    footer.className = "barter-ui__footer";

    const merchantGoldEl = document.createElement("span");
    merchantGoldEl.className = "barter-ui__gold barter-ui__gold--merchant";
    merchantGoldEl.setAttribute("aria-label", "Merchant gold");
    footer.appendChild(merchantGoldEl);

    const playerGoldEl = document.createElement("span");
    playerGoldEl.className = "barter-ui__gold barter-ui__gold--player";
    playerGoldEl.setAttribute("aria-label", "Player gold");
    footer.appendChild(playerGoldEl);

    root.appendChild(footer);
    document.body.appendChild(root);

    this._root         = root;
    this._titleEl      = title;
    this._merchantList = merchantList;
    this._playerList   = playerList;
    this._merchantGold = merchantGoldEl;
    this._playerGold   = playerGoldEl;
  }

  private _renderTitle(merchant: MerchantDef | undefined): void {
    if (!this._titleEl) return;
    this._titleEl.textContent = merchant ? merchant.name : "Merchant";
  }

  private _renderMerchantList(
    system: BarterSystem,
    merchant: MerchantDef | undefined,
  ): void {
    if (!this._merchantList) return;
    this._merchantList.innerHTML = "";

    if (!merchant || !system.activeMerchantId) {
      const empty = document.createElement("li");
      empty.className = "barter-ui__empty";
      empty.textContent = "No merchant active.";
      this._merchantList.appendChild(empty);
      return;
    }

    if (merchant.inventory.length === 0) {
      const empty = document.createElement("li");
      empty.className = "barter-ui__empty";
      empty.textContent = "Nothing for sale.";
      this._merchantList.appendChild(empty);
      return;
    }

    for (const item of merchant.inventory) {
      const price  = system.getBuyPrice(item, system.activeMerchantId);
      const canAfford = system.playerGold >= price;
      this._merchantList.appendChild(
        this._buildItemRow(item, price, "buy", canAfford),
      );
    }
  }

  private _renderPlayerList(
    system: BarterSystem,
    playerItems: ReadonlyArray<Item>,
    merchantId: string | undefined,
  ): void {
    if (!this._playerList) return;
    this._playerList.innerHTML = "";

    if (playerItems.length === 0) {
      const empty = document.createElement("li");
      empty.className = "barter-ui__empty";
      empty.textContent = "Inventory empty.";
      this._playerList.appendChild(empty);
      return;
    }

    for (const item of playerItems) {
      const price = system.getSellPrice(item, merchantId);
      const merchant = merchantId ? system.getMerchant(merchantId) : undefined;
      const canSell = !merchant || merchant.gold >= price;
      this._playerList.appendChild(
        this._buildItemRow(item, price, "sell", canSell),
      );
    }
  }

  private _renderGold(
    system: BarterSystem,
    merchant: MerchantDef | undefined,
  ): void {
    if (this._merchantGold) {
      const mg = merchant?.gold ?? 0;
      this._merchantGold.textContent = `Merchant: ${mg}g`;
    }
    if (this._playerGold) {
      this._playerGold.textContent = `You: ${system.playerGold}g`;
    }
  }

  private _buildItemRow(
    item: Item,
    price: number,
    action: "buy" | "sell",
    actionEnabled: boolean,
  ): HTMLLIElement {
    const li = document.createElement("li");
    li.className = "barter-ui__item-row";
    li.setAttribute("role", "listitem");
    li.setAttribute("data-item-id", item.id);

    const nameEl = document.createElement("span");
    nameEl.className = "barter-ui__item-name";
    nameEl.textContent = item.name;
    li.appendChild(nameEl);

    if (item.quantity > 1) {
      const qtyEl = document.createElement("span");
      qtyEl.className = "barter-ui__item-qty";
      qtyEl.textContent = `×${item.quantity}`;
      li.appendChild(qtyEl);
    }

    const priceEl = document.createElement("span");
    priceEl.className = "barter-ui__item-price";
    priceEl.textContent = `${price}g`;
    priceEl.setAttribute("aria-label", `${price} gold`);
    li.appendChild(priceEl);

    const btn = document.createElement("button");
    btn.className = `barter-ui__action-btn barter-ui__action-btn--${action}`;
    btn.type = "button";
    btn.textContent = action === "buy" ? "Buy" : "Sell";
    btn.disabled = !actionEnabled;
    btn.setAttribute("aria-disabled", actionEnabled ? "false" : "true");
    btn.addEventListener("click", () => {
      if (!btn.disabled) {
        if (action === "buy") {
          this.onBuy?.(item.id);
        } else {
          this.onSell?.(item.id);
        }
      }
    });
    li.appendChild(btn);

    return li;
  }
}
