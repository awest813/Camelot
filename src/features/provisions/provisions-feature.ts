/**
 * Provisions: the items that belong somewhere other than the pack.
 *
 * Picking up, buying or being given one of these puts it where it is used
 * instead of leaving it as dead weight in the inventory:
 *   - `arrow_bundle`      → 20 arrows per bundle into the quiver;
 *   - an alchemy ingredient id (`vervain`, `henbane` …) → the satchel;
 *   - `vessel_<type>`     → the enchanter's spirit vessels;
 *   - `tome_<spellId>`    → that spell is learned (a known one is kept to sell);
 *   - `spell_tome`        → a seeded pick among the spells not yet known.
 *
 * Drinking anything with a `cure` stat (the Cure Disease draught) clears
 * every disease.
 *
 * Inputs:   the inventory's absorb hook, `item:consumed`; services feedback.
 * Outputs:  the quiver's arrow count is saved here ("provisions").
 */
import type { Feature, FeatureContext } from "../../core/kernel";
import type { Item } from "../../systems/inventory-system";
import type { VesselType } from "../../systems/enchanting-system";
import { FeedbackKey, ownSave } from "../services";

export const ARROWS_PER_BUNDLE = 20;
const VESSELS: readonly VesselType[] = ["clay", "pewter", "silver", "gold", "grail"];

export interface ProvisionsDeps {
  inventory: { addAbsorber(fn: (item: Item) => string | null): void };
  quiver: { arrowCount: number; addArrows(count: number): void };
  spells: {
    getDefinitions(): ReadonlyArray<{ id: string; name: string }>;
    learnSpell(id: string): boolean;
    knowsSpell(id: string): boolean;
  };
  alchemy: { getIngredientDef(id: string): { name: string } | undefined; addIngredient(id: string, n: number): boolean };
  enchanting: { addVessel(type: VesselType, n: number): void };
  diseases: { hasDiseases: boolean; cureAllDiseases(): void };
}

export class ProvisionsFeature implements Feature {
  public readonly id = "provisions";
  private _pick: () => number = () => 0;

  constructor(private readonly _d: ProvisionsDeps) {}

  public install(ctx: FeatureContext): void {
    const rng = ctx.kernel.rng.stream("tome");
    this._pick = () => rng.next();
    ownSave(ctx, {
      key: "provisions",
      save: () => ({ arrows: this._d.quiver.arrowCount }),
      load: (data) => {
        const a = (data as { arrows?: unknown } | undefined)?.arrows;
        if (typeof a === "number" && Number.isFinite(a)) this._d.quiver.arrowCount = Math.max(-1, Math.floor(a));
      },
    });
    this._d.inventory.addAbsorber((item) => this.absorb(item));
    ctx.on("item:consumed", ({ item }) => {
      if (!((item.stats?.cure ?? 0) > 0)) return;
      const had = this._d.diseases.hasDiseases;
      this._d.diseases.cureAllDiseases();
      ctx.kernel.services.get(FeedbackKey).notify(had ? "The sickness leaves you." : "You feel clean of all sickness.", 2200);
    });
  }

  /** Where an incoming item goes instead of the pack; the notice to show, or null to keep it. */
  public absorb(item: Item): string | null {
    const n = Math.max(1, item.quantity);
    const d = this._d;
    if (item.id === "arrow_bundle") {
      d.quiver.addArrows(ARROWS_PER_BUNDLE * n);
      return `+${ARROWS_PER_BUNDLE * n} arrows (quiver: ${d.quiver.arrowCount < 0 ? "∞" : d.quiver.arrowCount})`;
    }
    const herb = d.alchemy.getIngredientDef(item.id);
    if (herb && d.alchemy.addIngredient(item.id, n)) return `${n}× ${herb.name} into your satchel`;
    if (item.id.startsWith("vessel_")) {
      const type = item.id.slice(7) as VesselType;
      if (!VESSELS.includes(type)) return null;
      d.enchanting.addVessel(type, n);
      return `${n}× ${type} spirit vessel${n > 1 ? "s" : ""} for the altar`;
    }
    if (item.id.startsWith("tome_")) {
      const spell = d.spells.getDefinitions().find((s) => s.id === item.id.slice(5));
      if (!spell || d.spells.knowsSpell(spell.id)) return null;
      d.spells.learnSpell(spell.id);
      return `You read the tome and learn ${spell.name}.`;
    }
    if (item.id === "spell_tome") {
      const unknown = d.spells.getDefinitions().filter((s) => !d.spells.knowsSpell(s.id));
      if (!unknown.length) return null;
      const spell = unknown[Math.min(unknown.length - 1, Math.floor(this._pick() * unknown.length))];
      d.spells.learnSpell(spell.id);
      return `You read the tome and learn ${spell.name}.`;
    }
    return null;
  }
}
