import type { Container, ContainerSystem } from "../systems/container-system";
import type { Item } from "../systems/inventory-system";

// ── ContainerUI ────────────────────────────────────────────────────────────────

/**
 * ContainerUI — container loot overlay.
 *
 * Surfaces a {@link ContainerSystem} through a single-column HTML overlay
 * listing all items inside the currently open container with per-item
 * "Take" buttons and a "Take All" shortcut.
 *
 * Call `update(system)` after any item transfer to keep the panel in sync
 * without re-creating the DOM.
 *
 * Wire-up example:
 * ```ts
 * const ui = new ContainerUI();
 *
 * ui.onTakeItem = (itemId) => {
 *   containerSystem.takeItem(containerSystem.activeContainer!.id, itemId);
 *   ui.update(containerSystem);
 *   if (containerSystem.activeContainer?.contents.length === 0) ui.hide();
 * };
 *
 * ui.onTakeAll = () => {
 *   containerSystem.takeAll(containerSystem.activeContainer!.id);
 *   ui.update(containerSystem);
 *   ui.hide();
 * };
 *
 * // Open via interaction:
 * containerSystem.onContainerOpen = (container) => {
 *   ui.show();
 *   ui.update(containerSystem);
 * };
 * ```
 */
export class ContainerUI {
  public isVisible: boolean = false;

  /** Called when the player clicks "Take" on an item row.  Argument is item id. */
  public onTakeItem: ((itemId: string) => void) | null = null;
  /** Called when the player clicks "Take All". */
  public onTakeAll: (() => void) | null = null;
  /** Called when the panel's close button is pressed. */
  public onClose: (() => void) | null = null;

  private _root:       HTMLDivElement | null = null;
  private _titleEl:    HTMLHeadingElement | null = null;
  private _itemList:   HTMLUListElement | null = null;
  private _takeAllBtn: HTMLButtonElement | null = null;

  /** Last `ContainerSystem` passed to `update()`. */
  private _lastSystem: ContainerSystem | null = null;

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
   * Refresh the display from the current container system state.
   * Call after any item transfer.
   *
   * @param system — The {@link ContainerSystem} providing container data.
   */
  public update(system: ContainerSystem): void {
    if (typeof document === "undefined") return;
    this._ensureDom();

    this._lastSystem = system;

    const container = system.activeContainer;
    this._renderTitle(container);
    this._renderItemList(container);
    this._updateTakeAllState(container);
  }

  /** Remove the DOM element entirely and reset state. */
  public destroy(): void {
    this._root?.remove();
    this._root       = null;
    this._titleEl    = null;
    this._itemList   = null;
    this._takeAllBtn = null;
    this._lastSystem = null;
    this.isVisible   = false;
  }

  // ── DOM helpers ─────────────────────────────────────────────────────────────

  private _ensureDom(): void {
    if (this._root) return;

    // Root overlay
    const root = document.createElement("div");
    root.className = "container-ui";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "Container");
    root.style.display = "none";

    // Header
    const header = document.createElement("div");
    header.className = "container-ui__header";

    const title = document.createElement("h2");
    title.className = "container-ui__title";
    title.textContent = "Container";
    header.appendChild(title);

    const closeBtn = document.createElement("button");
    closeBtn.className = "container-ui__close";
    closeBtn.type = "button";
    closeBtn.textContent = "✕";
    closeBtn.setAttribute("aria-label", "Close container");
    closeBtn.addEventListener("click", () => {
      this.hide();
      this.onClose?.();
    });
    header.appendChild(closeBtn);
    root.appendChild(header);

    // Item list
    const itemList = document.createElement("ul");
    itemList.className = "container-ui__item-list";
    itemList.setAttribute("role", "list");
    itemList.setAttribute("aria-label", "Container contents");
    itemList.setAttribute("aria-live", "polite");
    root.appendChild(itemList);

    // Footer with Take All
    const footer = document.createElement("div");
    footer.className = "container-ui__footer";

    const takeAllBtn = document.createElement("button");
    takeAllBtn.className = "container-ui__take-all-btn";
    takeAllBtn.type = "button";
    takeAllBtn.textContent = "Take All";
    takeAllBtn.disabled = true;
    takeAllBtn.addEventListener("click", () => {
      if (!takeAllBtn.disabled) {
        this.onTakeAll?.();
      }
    });
    footer.appendChild(takeAllBtn);
    root.appendChild(footer);

    document.body.appendChild(root);

    this._root       = root;
    this._titleEl    = title;
    this._itemList   = itemList;
    this._takeAllBtn = takeAllBtn;
  }

  private _renderTitle(container: Container | null): void {
    if (!this._titleEl) return;
    this._titleEl.textContent = container ? container.name : "Container";
  }

  private _renderItemList(container: Container | null): void {
    if (!this._itemList) return;
    this._itemList.innerHTML = "";

    const items: ReadonlyArray<Item> = container?.contents ?? [];

    if (items.length === 0) {
      const empty = document.createElement("li");
      empty.className = "container-ui__empty";
      empty.textContent = "Empty.";
      this._itemList.appendChild(empty);
      return;
    }

    for (const item of items) {
      this._itemList.appendChild(this._buildItemRow(item));
    }
  }

  private _updateTakeAllState(container: Container | null): void {
    if (!this._takeAllBtn) return;
    const hasItems = (container?.contents.length ?? 0) > 0;
    this._takeAllBtn.disabled = !hasItems;
    this._takeAllBtn.setAttribute("aria-disabled", hasItems ? "false" : "true");
  }

  private _buildItemRow(item: Item): HTMLLIElement {
    const li = document.createElement("li");
    li.className = "container-ui__item-row";
    li.setAttribute("role", "listitem");
    li.setAttribute("data-item-id", item.id);

    const nameEl = document.createElement("span");
    nameEl.className = "container-ui__item-name";
    nameEl.textContent = item.name;
    li.appendChild(nameEl);

    if (item.quantity > 1) {
      const qtyEl = document.createElement("span");
      qtyEl.className = "container-ui__item-qty";
      qtyEl.textContent = `×${item.quantity}`;
      qtyEl.setAttribute("aria-label", `quantity ${item.quantity}`);
      li.appendChild(qtyEl);
    }

    const takeBtn = document.createElement("button");
    takeBtn.className = "container-ui__take-btn";
    takeBtn.type = "button";
    takeBtn.textContent = "Take";
    takeBtn.addEventListener("click", () => {
      this.onTakeItem?.(item.id);
    });
    li.appendChild(takeBtn);

    return li;
  }
}
