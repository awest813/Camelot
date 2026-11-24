/**
 * Enchanting altar: pick an item, an effect its kind can take, and a soul
 * gem, then Enchant.  A Preact panel on the DOM layer (engine overhaul,
 * Phase 8; it was a Babylon GUI panel).  The class API is unchanged:
 * toggle / refresh / isVisible, and onEnchant / onClosed.
 */
import { render } from "preact";
import type { EnchantingSystem, EnchantmentCategory, SoulGemType } from "../systems/enchanting-system";
import { SOUL_GEMS, getItemEnchantmentCategory } from "../systems/enchanting-system";
import type { Item } from "../systems/inventory-system";
import { ModalDialog } from "./preact/modal-dialog";

interface Selection {
  itemId: string | null;
  effectId: string | null;
  gem: SoulGemType | null;
  /** The selected item's kind (limits the effects on offer). */
  category: EnchantmentCategory | null;
}

const NONE: Selection = { itemId: null, effectId: null, gem: null, category: null };

/** The status line: what is still missing, or what the enchantment will be. */
export function enchantStatus(system: EnchantingSystem, s: Selection): { text: string; ready: boolean } {
  if (!s.itemId || !s.effectId || !s.gem) {
    const missing = [!s.itemId && "item", !s.effectId && "effect", !s.gem && "soul gem"].filter(Boolean);
    return { text: `Select a${missing.length === 3 ? "n" : ""}: ${missing.join(", ")}`, ready: false };
  }
  const item = system.getEnchantableItems().find((i) => i.id === s.itemId);
  const eff = system.getEffectDefinitions().find((e) => e.id === s.effectId);
  const gem = SOUL_GEMS[s.gem];
  if (!item || !eff || !gem) return { text: "", ready: false };
  const skillMult = 0.5 + (system.enchantingSkill / 100) * 1.5;
  const magnitude = Math.max(1, Math.round(eff.baseMagnitude * gem.magnitudeMultiplier * skillMult));
  return { text: `${eff.namePrefix} ${item.name} — ${eff.name} +${magnitude}`, ready: true };
}

interface EnchantingPanelProps {
  system: EnchantingSystem;
  selection: Selection;
  onItem(item: Item): void;
  onEffect(id: string): void;
  onGem(type: SoulGemType): void;
  onEnchant(): void;
  onClose(): void;
}

export function EnchantingPanel(p: EnchantingPanelProps) {
  const s = p.selection;
  const items = p.system.getEnchantableItems();
  const effects = s.category ? p.system.getEffectsForCategory(s.category) : p.system.getEffectDefinitions();
  const gems = p.system.getAvailableSoulGems();
  const status = enchantStatus(p.system, s);
  return (
    <ModalDialog id="enchanting-title" title="Enchanting — Arcane Altar" className="craft-panel enchanting-panel" panelClassName="craft-panel__panel" onClose={p.onClose}>
      <p class="craft-panel__subtitle">Enchanting Skill: {p.system.enchantingSkill}</p>
      <div class="craft-panel__columns craft-panel__columns--three">
        <section class="craft-panel__section" aria-label="Items">
          <h3 class="craft-panel__section-title">Items</h3>
          {items.length === 0 && <p class="craft-panel__empty">No enchantable items</p>}
          {items.map((item) => {
            const cat = getItemEnchantmentCategory(item.slot) ?? "item";
            return (
              <button key={item.id} type="button" class="craft-panel__row" aria-pressed={item.id === s.itemId}
                aria-label={`Item: ${item.name}`} onClick={() => p.onItem(item)}>
                <span>
                  <span class="craft-panel__row-name">{item.name}</span>
                  <span class="craft-panel__row-detail">{cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
                </span>
              </button>
            );
          })}
        </section>
        <section class="craft-panel__section" aria-label="Effects">
          <h3 class="craft-panel__section-title">Effects</h3>
          {effects.length === 0 && <p class="craft-panel__empty">No effects available</p>}
          {effects.map((eff) => (
            <button key={eff.id} type="button" class="craft-panel__row" aria-pressed={eff.id === s.effectId}
              aria-label={`Effect: ${eff.name}`} onClick={() => p.onEffect(eff.id)}>
              <span>
                <span class="craft-panel__row-name">{eff.name}</span>
                <span class="craft-panel__row-detail">{eff.description}</span>
              </span>
            </button>
          ))}
        </section>
        <section class="craft-panel__section" aria-label="Soul gems">
          <h3 class="craft-panel__section-title">Soul Gems</h3>
          {gems.length === 0 && <p class="craft-panel__empty">No soul gems</p>}
          {gems.map(({ def, count }) => (
            <button key={def.type} type="button" class="craft-panel__row" aria-pressed={def.type === s.gem}
              aria-label={`Soul Gem: ${def.name}`} onClick={() => p.onGem(def.type)}>
              <span>
                <span class="craft-panel__row-name">{def.name}  ×{count}</span>
                <span class="craft-panel__row-detail">{def.magnitudeMultiplier}× magnitude</span>
              </span>
            </button>
          ))}
        </section>
      </div>
      <div class="craft-panel__footer">
        <p class={`craft-panel__status ${status.ready ? "craft-panel__status--ok" : ""}`.trim()} aria-live="polite">{status.text}</p>
        <button type="button" class="craft-panel__btn craft-panel__btn--primary" disabled={!status.ready} onClick={p.onEnchant}>Enchant</button>
      </div>
    </ModalDialog>
  );
}

/** The altar panel: open / close / refresh it; the game reacts to its events. */
export class EnchantingUI {
  /** Fired when the player enchants: the item, the effect and the soul gem used. */
  public onEnchant: ((itemId: string, effectId: string, gemType: SoulGemType) => void) | null = null;
  /** Fired when the player closes the panel (✕, Escape or the backdrop). */
  public onClosed: (() => void) | null = null;
  public isVisible = false;

  private _sel: Selection = { ...NONE };
  private _host: HTMLDivElement | null = null;

  constructor(private readonly _system: EnchantingSystem) {}

  /** Open (with nothing selected) or close the panel. */
  public toggle(visible: boolean): void {
    this.isVisible = visible;
    if (visible) this._sel = { ...NONE };
    this._render();
  }

  /** Redraw after an enchantment or inventory change (no-op while closed). */
  public refresh(): void {
    if (this.isVisible) this._render();
  }

  public destroy(): void {
    this.isVisible = false;
    this._render();
    this._host?.remove();
    this._host = null;
  }

  private _selectItem(item: Item): void {
    if (this._sel.itemId === item.id) {
      this._sel = { ...this._sel, itemId: null, category: null, effectId: null };
      return;
    }
    const category = getItemEnchantmentCategory(item.slot);
    const prev = this._sel.effectId ? this._system.getEffectDefinitions().find((e) => e.id === this._sel.effectId) : null;
    // An effect the new item's kind can't take is dropped.
    this._sel = { ...this._sel, itemId: item.id, category, effectId: prev && prev.category !== category ? null : this._sel.effectId };
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
      <EnchantingPanel
        system={this._system}
        selection={this._sel}
        onItem={(item) => { this._selectItem(item); this._render(); }}
        onEffect={(id) => { this._sel = { ...this._sel, effectId: this._sel.effectId === id ? null : id }; this._render(); }}
        onGem={(type) => { this._sel = { ...this._sel, gem: this._sel.gem === type ? null : type }; this._render(); }}
        onEnchant={() => {
          const { itemId, effectId, gem } = this._sel;
          if (!itemId || !effectId || !gem) return;
          this.onEnchant?.(itemId, effectId, gem);
          this._sel = { ...NONE };
          this._render();
        }}
        onClose={() => { this.toggle(false); this.onClosed?.(); }}
      />,
      this._host,
    );
  }
}
