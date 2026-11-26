/**
 * Alchemy workbench: the ingredient satchel (pick 2–4), the potions crafted
 * so far (drink one), and Craft / Clear.  A Preact panel on the DOM layer
 * (engine overhaul, Phase 8; it was a Babylon GUI panel).  The class API is
 * unchanged: toggle / refresh / isVisible, and onCraft / onDrink / onClosed.
 */
import { render } from "preact";
import type { AlchemySystem } from "../systems/alchemy-system";
import { ALCHEMY_EFFECTS } from "../systems/alchemy-system";
import { ModalDialog } from "./preact/modal-dialog";

/** Most ingredients one brew can take. */
const MAX_INGREDIENTS = 4;

interface AlchemyPanelProps {
  system: AlchemySystem;
  selected: readonly string[];
  onToggle(id: string): void;
  onCraft(): void;
  onClear(): void;
  onDrink(potionId: string): void;
  onClose(): void;
}

export function AlchemyPanel(p: AlchemyPanelProps) {
  const satchel = p.system.getSatchelContents();
  const potions = p.system.craftedPotions;
  const names = p.selected.map((id) => p.system.getIngredientDef(id)?.name ?? id).join(" + ");
  const status = p.selected.length === 0
    ? { text: "Select 2–4 ingredients to craft", tone: "" }
    : p.selected.length < 2
      ? { text: `Selected: ${names}  (need at least 2)`, tone: "craft-panel__status--warn" }
      : { text: `Selected: ${names}`, tone: "craft-panel__status--ok" };
  return (
    <ModalDialog id="alchemy-title" title="Alchemy — Mortar & Pestle" className="craft-panel alchemy-panel" panelClassName="craft-panel__panel" onClose={p.onClose}>
      <p class="craft-panel__subtitle">Alchemy Skill: {p.system.alchemySkill}</p>
      <div class="craft-panel__columns">
        <section class="craft-panel__section" aria-label="Ingredients">
          <h3 class="craft-panel__section-title">Ingredients</h3>
          {satchel.length === 0 && <p class="craft-panel__empty">No ingredients</p>}
          {satchel.map(({ def, quantity }) => {
            const effects = def.effects
              .map((eid, i) => (p.system.hasDiscoveredEffect(def.id, i) ? ALCHEMY_EFFECTS[eid].name : "???"))
              .join(", ");
            return (
              <button key={def.id} type="button" class="craft-panel__row" aria-pressed={p.selected.includes(def.id)}
                aria-label={`Ingredient: ${def.name}, Effects: ${effects}`} onClick={() => p.onToggle(def.id)}>
                <span>
                  <span class="craft-panel__row-name">{def.name}  ×{quantity}</span>
                  <span class="craft-panel__row-detail">{effects}</span>
                </span>
              </button>
            );
          })}
        </section>
        <section class="craft-panel__section" aria-label="Crafted potions">
          <h3 class="craft-panel__section-title">Crafted Potions</h3>
          {potions.length === 0 && <p class="craft-panel__empty">No potions crafted</p>}
          {potions.map((potion) => (
            <div key={potion.id} class="craft-panel__row">
              <span>
                <span class="craft-panel__row-name">{potion.name}</span>
                <span class="craft-panel__row-detail">
                  {potion.effects.map((e) => {
                    const eff = ALCHEMY_EFFECTS[e.effectId];
                    return eff.baseDuration > 0 ? `${eff.name} ${e.magnitude} (${e.duration}s)` : `${eff.name} ${e.magnitude}`;
                  }).join(" | ")}
                </span>
              </span>
              <button type="button" class="craft-panel__btn craft-panel__btn--small" onClick={() => p.onDrink(potion.id)}>Drink</button>
            </div>
          ))}
        </section>
      </div>
      <div class="craft-panel__footer">
        <p class={`craft-panel__status ${status.tone}`.trim()} aria-live="polite">{status.text}</p>
        <button type="button" class="craft-panel__btn craft-panel__btn--primary" disabled={p.selected.length < 2} onClick={p.onCraft}>Craft Potion</button>
        <button type="button" class="craft-panel__btn" onClick={p.onClear}>Clear</button>
      </div>
    </ModalDialog>
  );
}

/** The workbench panel: open / close / refresh it; the game reacts to its events. */
export class AlchemyUI {
  /** Fired when the player presses Craft, with the selected ingredient ids. */
  public onCraft: ((ingredientIds: string[]) => void) | null = null;
  /** Fired when the player drinks a crafted potion. */
  public onDrink: ((potionId: string) => void) | null = null;
  /** Fired when the player closes the panel (✕, Escape or the backdrop). */
  public onClosed: (() => void) | null = null;
  public isVisible = false;

  private _selected: string[] = [];
  private _host: HTMLDivElement | null = null;

  constructor(private readonly _system: AlchemySystem) {}

  /** Open (with a fresh selection) or close the panel. */
  /** Close it (as toggle(false); panels close this way). */
  public close(): void {
    this.toggle(false);
  }

  public toggle(visible: boolean): void {
    this.isVisible = visible;
    if (visible) this._selected = [];
    this._render();
  }

  /** Redraw after crafting or inventory changes (no-op while closed). */
  public refresh(): void {
    if (this.isVisible) this._render();
  }

  public destroy(): void {
    this.isVisible = false;
    this._render();
    this._host?.remove();
    this._host = null;
  }

  private _render(): void {
    if (typeof document === "undefined") return;
    if (!this.isVisible) {
      if (this._host) render(null, this._host);
      return;
    }
    if (!this._host) {
      this._host = document.createElement("div");
      document.body.appendChild(this._host);
    }
    render(
      <AlchemyPanel
        system={this._system}
        selected={this._selected}
        onToggle={(id) => {
          const i = this._selected.indexOf(id);
          if (i >= 0) this._selected.splice(i, 1);
          else if (this._selected.length < MAX_INGREDIENTS) this._selected.push(id);
          this._render();
        }}
        onCraft={() => {
          if (this._selected.length < 2) return;
          this.onCraft?.(this._selected.slice());
          this._selected = [];
          this._render();
        }}
        onClear={() => { this._selected = []; this._render(); }}
        onDrink={(id) => { this.onDrink?.(id); this._render(); }}
        onClose={() => { this.toggle(false); this.onClosed?.(); }}
      />,
      this._host,
    );
  }
}
