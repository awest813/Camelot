import type { QuickSlotSystem, QuickSlotKey } from "../systems/quickslot-system";
import { QUICK_SLOT_KEYS } from "../systems/quickslot-system";
import type { Item } from "../systems/inventory-system";

// ── QuickSlotHUD ──────────────────────────────────────────────────────────────

/** One slot's display state — used for internal diffing. */
interface SlotSnapshot {
  key: QuickSlotKey;
  itemId: string | null;
  itemName: string;
  quantity: number;
  stackable: boolean;
}

/**
 * QuickSlotHUD — persistent hot-bar overlay for the four quick-slot bindings.
 *
 * Shows keys **7**, **8**, **9**, **0** across a compact HUD strip, each cell
 * displaying the bound item name and a quantity badge for stackable items.
 * Empty slots show a "—" placeholder.
 *
 * Call `update(system)` after any inventory change or slot re-binding to keep
 * the strip in sync.  The HUD diffs each slot to avoid unnecessary DOM
 * mutations.
 *
 * `onAssign(key, itemId)` is fired when the player clicks a slot cell —
 * the game layer can use this to open an item-picker dialog.
 *
 * Wire-up example:
 * ```ts
 * const hud = new QuickSlotHUD();
 *
 * hud.onAssign = (key, _itemId) => {
 *   // Open item picker so the player can (re-)bind the slot.
 *   openItemPicker((chosen) => {
 *     quickSlotSystem.bindSlot(key, chosen?.id ?? null);
 *     hud.update(quickSlotSystem);
 *   });
 * };
 *
 * hud.show();
 * hud.update(quickSlotSystem);
 * ```
 */
export class QuickSlotHUD {
  public isVisible: boolean = false;

  /**
   * Fired when the player clicks a slot cell.
   * Arguments are the key ("7" | "8" | "9" | "0") and the currently-bound
   * item ID (or null if empty).  The game layer should open an item-picker.
   */
  public onAssign: ((key: QuickSlotKey, itemId: string | null) => void) | null = null;

  private _root:          HTMLDivElement | null = null;
  private _cellEls:       Map<QuickSlotKey, HTMLDivElement> = new Map();
  private _lastSnapshots: Map<QuickSlotKey, SlotSnapshot>   = new Map();

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Make the HUD visible.  Creates the root DOM lazily on first call. */
  public show(): void {
    if (typeof document === "undefined") return;
    this._ensureDom();
    if (this._root) this._root.style.display = "flex";
    this.isVisible = true;
  }

  /** Hide the HUD without destroying its DOM. */
  public hide(): void {
    if (this._root) this._root.style.display = "none";
    this.isVisible = false;
  }

  /**
   * Refresh the HUD from the current {@link QuickSlotSystem} state.
   * Only slot cells whose content has changed are re-rendered.
   *
   * @param system — The live {@link QuickSlotSystem} to read slot bindings from.
   */
  public update(system: QuickSlotSystem): void {
    if (typeof document === "undefined") return;
    this._ensureDom();

    for (const slot of system.getSlots()) {
      const snap = this._buildSnapshot(slot.key, slot.itemId, slot.item);
      const prev = this._lastSnapshots.get(slot.key);
      if (!this._snapshotsEqual(prev, snap)) {
        this._renderCell(slot.key, snap);
        this._lastSnapshots.set(slot.key, snap);
      }
    }
  }

  /** Remove the DOM element entirely and reset state. */
  public destroy(): void {
    this._root?.remove();
    this._root          = null;
    this._cellEls       = new Map();
    this._lastSnapshots = new Map();
    this.isVisible      = false;
  }

  // ── DOM helpers ─────────────────────────────────────────────────────────────

  private _ensureDom(): void {
    if (this._root) return;

    const root = document.createElement("div");
    root.className = "quickslot-hud";
    root.setAttribute("role", "toolbar");
    root.setAttribute("aria-label", "Quick slots");
    root.style.display = "none";

    for (const key of QUICK_SLOT_KEYS) {
      const cell = document.createElement("div");
      cell.className = "quickslot-hud__slot";
      cell.setAttribute("role", "button");
      cell.setAttribute("tabindex", "0");
      cell.setAttribute("data-key", key);
      cell.setAttribute("aria-label", `Quick slot ${key}`);
      cell.addEventListener("click", () => {
        const currentId = this._lastSnapshots.get(key)?.itemId ?? null;
        this.onAssign?.(key, currentId);
      });
      cell.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          const currentId = this._lastSnapshots.get(key)?.itemId ?? null;
          this.onAssign?.(key, currentId);
        }
      });

      // Key label
      const keyLabel = document.createElement("span");
      keyLabel.className = "quickslot-hud__key-label";
      keyLabel.textContent = key;
      cell.appendChild(keyLabel);

      // Item name placeholder
      const nameEl = document.createElement("span");
      nameEl.className = "quickslot-hud__item-name";
      nameEl.textContent = "—";
      cell.appendChild(nameEl);

      root.appendChild(cell);
      this._cellEls.set(key, cell);
    }

    document.body.appendChild(root);
    this._root = root;
  }

  private _renderCell(key: QuickSlotKey, snap: SlotSnapshot): void {
    const cell = this._cellEls.get(key);
    if (!cell) return;

    const nameEl = cell.querySelector<HTMLSpanElement>(".quickslot-hud__item-name");

    // Remove old quantity badge if present
    const oldQty = cell.querySelector(".quickslot-hud__qty-badge");
    if (oldQty) oldQty.remove();

    if (snap.itemId === null) {
      if (nameEl) nameEl.textContent = "—";
      cell.setAttribute("aria-label", `Quick slot ${key}: empty`);
      cell.setAttribute("data-item-id", "");
    } else {
      if (nameEl) nameEl.textContent = snap.itemName;
      cell.setAttribute("data-item-id", snap.itemId);

      if (snap.stackable && snap.quantity > 1) {
        const badge = document.createElement("span");
        badge.className = "quickslot-hud__qty-badge";
        badge.textContent = `×${snap.quantity}`;
        badge.setAttribute("aria-label", `quantity ${snap.quantity}`);
        cell.appendChild(badge);
      }

      cell.setAttribute(
        "aria-label",
        snap.stackable && snap.quantity > 1
          ? `Quick slot ${key}: ${snap.itemName} ×${snap.quantity}`
          : `Quick slot ${key}: ${snap.itemName}`,
      );
    }
  }

  // ── Snapshot helpers ─────────────────────────────────────────────────────────

  private _buildSnapshot(
    key: QuickSlotKey,
    itemId: string | null,
    item: Item | null,
  ): SlotSnapshot {
    return {
      key,
      itemId,
      itemName:  item?.name      ?? "",
      quantity:  item?.quantity  ?? 0,
      stackable: item?.stackable ?? false,
    };
  }

  private _snapshotsEqual(a: SlotSnapshot | undefined, b: SlotSnapshot): boolean {
    if (!a) return false;
    return (
      a.itemId   === b.itemId   &&
      a.itemName === b.itemName &&
      a.quantity === b.quantity &&
      a.stackable === b.stackable
    );
  }
}
