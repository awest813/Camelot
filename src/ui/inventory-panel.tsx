/**
 * The inventory (I): a 4×5 grid of the first twenty items (equipped ones
 * marked), the hovered or focused item's details, the character's stats
 * and what is equipped.  A Preact panel on the DOM layer (engine overhaul,
 * Phase 8; it was Babylon GUI in the UI manager, which still opens, updates
 * and closes it).
 */
import { useState } from "preact/hooks";
import type { Item } from "../systems/inventory-system";
import { getItemIcon } from "./icon-utils";
import { ModalDialog } from "./preact/modal-dialog";
import { PanelHost } from "./preact/panel-host";

/** Slots shown (the grid is four across). */
export const INVENTORY_SLOTS = 20;

export interface InventoryState {
  items: readonly Item[];
  equippedIds: ReadonlySet<string>;
  /** The stats block ("Stats:\nHP: …"). */
  stats: string;
  /** "Main Hand: Iron Sword" … */
  equipment: readonly string[];
  /** True when clicking the item uses it (potions, food). */
  isConsumable(item: Item): boolean;
  /** Extra detail for an item (e.g. its condition). */
  detail(item: Item): string;
}

/** What clicking an item does, shown under its description ("" if nothing). */
export function itemHint(s: InventoryState, item: Item): string {
  if (s.isConsumable(item)) return "[Click to Use]";
  if (item.slot) return s.equippedIds.has(item.id) ? "[Click to Unequip]" : "[Click to Equip]";
  return "";
}

export function InventoryPanel(p: { state: InventoryState; onItem(item: Item): void; onClose(): void }) {
  const s = p.state;
  const [shown, setShown] = useState<Item | null>(null);
  const items = s.items.slice(0, INVENTORY_SLOTS);
  const current = shown && items.includes(shown) ? shown : null;
  return (
    <ModalDialog id="inventory-title" title="Inventory" className="craft-panel inventory" panelClassName="craft-panel__panel inventory__panel" onClose={p.onClose}>
      <div class="inventory__layout">
        <ul class="inventory__grid" aria-label="Items">
          {items.map((item) => {
            const usable = s.isConsumable(item) || !!item.slot;
            const label = `${getItemIcon(item)} ${item.name}${item.quantity > 1 ? ` (${item.quantity})` : ""}`;
            return (
              <li key={item.instanceId ?? item.id}>
                <button type="button" class={`inventory__slot${s.equippedIds.has(item.id) ? " is-equipped" : ""}`}
                  aria-disabled={!usable} aria-label={`${item.name}${item.quantity > 1 ? `, ${item.quantity}` : ""}${s.equippedIds.has(item.id) ? ", equipped" : ""}`}
                  onMouseEnter={() => setShown(item)} onFocus={() => setShown(item)}
                  onMouseLeave={() => setShown((cur) => (cur === item ? null : cur))}
                  onClick={() => { if (usable) p.onItem(item); }}>
                  {label}
                </button>
              </li>
            );
          })}
          {Array.from({ length: Math.max(0, INVENTORY_SLOTS - items.length) }, (_, i) => (
            <li key={`empty-${i}`}><span class="inventory__slot is-empty" aria-hidden="true" /></li>
          ))}
        </ul>
        <aside class="inventory__side">
          <div class="inventory__detail" aria-live="polite">
            {current && (
              <>
                <h3 class="inventory__detail-name">{current.name}</h3>
                <p>{current.description}</p>
                <p>Qty: {current.quantity}{s.detail(current)}</p>
                {itemHint(s, current) && <p class="inventory__hint">{itemHint(s, current)}</p>}
              </>
            )}
          </div>
          <pre class="inventory__stats">{s.stats}</pre>
          <div class="inventory__equipment">
            <h3 class="craft-panel__section-title">Equipment</h3>
            <ul>{s.equipment.map((line) => <li key={line}>{line}</li>)}</ul>
          </div>
        </aside>
      </div>
    </ModalDialog>
  );
}

/** Opened, updated and closed by the UI manager. */
export class InventoryPanelView {
  private readonly _host = new PanelHost();
  private _handlers: { onItem(item: Item): void; onClose(): void } | null = null;

  constructor(private readonly _state: () => InventoryState) {}

  public get isOpen(): boolean {
    return this._handlers !== null;
  }

  public open(handlers: { onItem(item: Item): void; onClose(): void }): void {
    this._handlers = handlers;
    this.render();
  }

  /** Redraw from the current state (no-op while closed). */
  public render(): void {
    const h = this._handlers;
    if (h) this._host.show(<InventoryPanel state={this._state()} onItem={h.onItem} onClose={h.onClose} />);
  }

  public close(): void {
    this._handlers = null;
    this._host.hide();
  }
}
