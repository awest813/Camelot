/**
 * The inventory (I): a 4×5 grid of the first twenty items, the hovered or
 * focused item's details, the character's stats and what is worn (click a
 * worn item to take it off; click gear in the bag to put it on).  A Preact panel on the DOM layer (engine overhaul,
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

/** One line of the character's stats: "Health 240 / 240", with a bar when it is a pool. */
export interface InventoryStat {
  label: string;
  value: string;
  /** 0..1 for health, magicka, stamina and experience. */
  fill?: number;
  /** Which pool the bar is (its colour). */
  kind?: "health" | "magicka" | "stamina" | "xp";
}

export interface InventoryState {
  items: readonly Item[];
  equippedIds: ReadonlySet<string>;
  stats: readonly InventoryStat[];
  /** "Main Hand: Iron Sword" … */
  equipment: readonly string[];
  /** What each equipment line wears (same order), clicked to take it off. */
  worn?: readonly (Item | null)[];
  /** True when clicking the item uses it (potions, food). */
  isConsumable(item: Item): boolean;
  /** Extra detail for an item (e.g. its condition). */
  detail(item: Item): string;
}

/** What clicking an item does, shown under its description ("" if nothing). */
export function itemHint(s: InventoryState, item: Item): string {
  if (s.isConsumable(item)) return "[Click to Use]";
  if (item.slot) return "[Click to Equip]"; // bag gear; worn gear is in the Equipped list
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
            return (
              <li key={item.instanceId ?? item.id}>
                <button type="button" class="inventory__slot"
                  aria-disabled={!usable} aria-label={`${item.name}${item.quantity > 1 ? `, ${item.quantity}` : ""}`}
                  onMouseEnter={() => setShown(item)} onFocus={() => setShown(item)}
                  onMouseLeave={() => setShown((cur) => (cur === item ? null : cur))}
                  onClick={() => { if (usable) p.onItem(item); }}>
                  <span class="inventory__glyph" aria-hidden="true">{getItemIcon(item)}</span>
                  <span class="inventory__name">{item.name}</span>
                  {item.quantity > 1 && <span class="inventory__qty">{item.quantity}</span>}
                </button>
              </li>
            );
          })}
          {Array.from({ length: Math.max(0, INVENTORY_SLOTS - items.length) }, (_, i) => (
            <li key={`empty-${i}`}><span class="inventory__slot is-empty" aria-hidden="true" /></li>
          ))}
        </ul>
        <aside class="inventory__side">
          <div class={`inventory__detail${current ? "" : " is-empty"}`} aria-live="polite">
            {current ? (
              <>
                <h3 class="inventory__detail-name">{current.name}</h3>
                <p class="inventory__detail-text">{current.description}</p>
                <p class="inventory__detail-meta">Quantity {current.quantity}{s.detail(current)}</p>
                {itemHint(s, current) && <p class="inventory__hint">{itemHint(s, current)}</p>}
              </>
            ) : (
              <p class="inventory__detail-text">Point at an item to read of it.</p>
            )}
          </div>
          <h3 class="craft-panel__section-title">Character</h3>
          <dl class="inventory__stats">
            {s.stats.map((st) => (
              <div key={st.label} class={`inventory__stat${st.kind ? ` inventory__stat--${st.kind}` : ""}`}>
                <dt>{st.label}</dt>
                <dd>{st.value}</dd>
                {st.fill !== undefined && (
                  <span class="inventory__stat-bar" aria-hidden="true"><span style={{ width: `${Math.round(Math.max(0, Math.min(1, st.fill)) * 100)}%` }} /></span>
                )}
              </div>
            ))}
          </dl>
          <div class="inventory__equipment">
            <h3 class="craft-panel__section-title">Equipped</h3>
            <dl>
              {s.equipment.map((line, i) => {
                const at = line.indexOf(": ");
                const slot = at < 0 ? line : line.slice(0, at), what = at < 0 ? "" : line.slice(at + 2);
                const empty = !what || what === "--";
                return (
                  <div key={slot} class={`inventory__equip${empty ? " is-empty" : ""}`}>
                    <dt>{slot}</dt>
                    <dd>{empty || !s.worn?.[i] ? (empty ? "—" : what) : (
                      <button type="button" class="inventory__unequip" title="Click to unequip"
                        aria-label={`Unequip ${what}`} onClick={() => p.onItem(s.worn![i]!)}>{what}</button>
                    )}</dd>
                  </div>
                );
              })}
            </dl>
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
