/**
 * The Attributes panel (U): each attribute's value, what it does for you
 * right now, and +1 while level-up points are waiting.  A Preact panel on
 * the DOM layer (engine overhaul, Phase 8; it was Babylon GUI in the UI
 * manager, which still opens, refreshes and closes it).
 */
import type { AttributeName, AttributeSystem } from "../systems/attribute-system";
import { ATTRIBUTE_NAMES } from "../systems/attribute-system";
import { ModalDialog } from "./preact/modal-dialog";
import { PanelHost } from "./preact/panel-host";

const DISPLAY: Record<AttributeName, string> = {
  strength: "Strength", endurance: "Endurance", intelligence: "Intelligence", agility: "Agility",
  willpower: "Willpower", speed: "Speed", luck: "Luck",
};

/** What an attribute does for the player at its current value. */
export function attributeHint(name: AttributeName, a: AttributeSystem): string {
  switch (name) {
    case "strength": return `Dmg +${a.meleeDamageBonus.toFixed(1)}`;
    case "endurance": return `HP max ${a.maxHealth}`;
    case "intelligence":
    case "willpower": return `MP max ${a.maxMagicka.toFixed(0)}`;
    case "agility":
    case "speed": return `Speed ×${a.speedMultiplier.toFixed(2)}`;
    case "luck": return `Crit ${(a.critChance * 100).toFixed(1)}%`;
    default: return "";
  }
}

export function AttributePanel(p: { attributes: AttributeSystem | null; onSpend(name: AttributeName): void; onClose(): void }) {
  const a = p.attributes;
  const points = a?.pendingPoints ?? 0;
  return (
    <ModalDialog id="attributes-title" title="Attributes" className="craft-panel attribute-panel" panelClassName="attribute-panel__panel" onClose={p.onClose}>
      <p class="craft-panel__subtitle" aria-live="polite">Points available: {points}</p>
      {a && (
        <table class="attribute-panel__table">
          <tbody>
            {ATTRIBUTE_NAMES.map((name) => (
              <tr key={name}>
                <th scope="row">{DISPLAY[name]}</th>
                <td class="attribute-panel__value">{a.get(name)}</td>
                <td class="attribute-panel__hint">{attributeHint(name, a)}</td>
                <td>
                  <button type="button" class="craft-panel__btn craft-panel__btn--small" disabled={points <= 0}
                    aria-label={points > 0 ? `Increase ${DISPLAY[name]}` : `Need points to increase ${DISPLAY[name]}`}
                    onClick={() => p.onSpend(name)}>+1</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </ModalDialog>
  );
}

/** Opened, refreshed and closed by the UI manager. */
export class AttributePanelView {
  private readonly _host = new PanelHost();
  private _open = false;
  private _attributes: AttributeSystem | null = null;
  private _handlers: { onSpend(name: AttributeName): void; onClose(): void } | null = null;

  public open(handlers: { onSpend(name: AttributeName): void; onClose(): void }): void {
    this._open = true;
    this._handlers = handlers;
    this._render();
  }

  /** Show `attributes` (now, if open; else the next time it opens). */
  public refresh(attributes: AttributeSystem): void {
    this._attributes = attributes;
    if (this._open) this._render();
  }

  public close(): void {
    this._open = false;
    this._host.hide();
  }

  private _render(): void {
    const h = this._handlers;
    if (!h) return;
    this._host.show(<AttributePanel attributes={this._attributes} onSpend={h.onSpend} onClose={h.onClose} />);
  }
}
