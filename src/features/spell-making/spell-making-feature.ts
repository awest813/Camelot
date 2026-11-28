/**
 * Spell making as a kernel feature: the altar (X) where up to two effects
 * are combined into a named spell, paid for in gold.
 *
 * Inputs:   services purse, skills, feedback, modal, gameplay.
 * Outputs:  the `spell-making` service; forged spells join the spell list.
 *
 * The altar's window loads the first time it opens (out of the start-up
 * bundle); `panel` is its LazyPanel.
 *
 * Extracted from game.ts (engine overhaul, Phase 1).
 */
import type { Feature, FeatureContext } from "../../core/kernel";
import { createServiceKey } from "../../core/kernel";
import { SpellMakingSystem } from "../../systems/spell-making-system";
import type { SpellMakingUI } from "../../ui/spell-making-ui";
import type { UIAnimator } from "../../ui/ui-animator";
import { LazyPanel } from "../../ui/lazy-panel";
import type { SpellSystem } from "../../systems/spell-system";
import type { BarterSystem } from "../../systems/barter-system";
import { FeedbackKey, GameplayKey, ModalKey, PurseKey, SkillsKey, ownSave } from "../services";

export interface SpellMakingService {
  readonly altar: SpellMakingSystem;
  readonly panel: LazyPanel<SpellMakingUI>;
  /** X: open or close the altar. */
  toggle(): void;
}

export const SpellMakingKey = createServiceKey<SpellMakingService>("spell-making");

const REASONS: Record<string, string> = {
  insufficient_gold: "Not enough gold to forge this spell.",
  duplicate_name: "A custom spell with that name already exists.",
  no_components: "Add at least one spell component.",
  too_many_components: "You can only combine up to two components.",
  invalid_name: "Enter a valid spell name.",
};

export class SpellMakingFeature implements Feature {
  public readonly id = "spell-making";
  public readonly altar: SpellMakingSystem;
  public readonly panel = new LazyPanel<SpellMakingUI>(async () => {
    const { SpellMakingUI } = await import("../../ui/spell-making-ui");
    const panel = new SpellMakingUI((components) => this.altar.computeCost(components));
    if (this._animator) panel.setAnimator(this._animator);
    this._wire?.(panel);
    return panel;
  });
  private _animator: UIAnimator | null = null;
  private _wire: ((panel: SpellMakingUI) => void) | null = null;

  constructor(spells: SpellSystem) {
    this.altar = new SpellMakingSystem(spells);
  }

  /** The window's open and close animations (applied when it loads). */
  public setAnimator(animator: UIAnimator): void {
    this._animator = animator;
    this.panel.current?.setAnimator(animator);
  }

  public install(ctx: FeatureContext): void {
    ownSave(ctx, { key: "spellMaking", save: () => this.altar.getSaveState(), load: (data) => { if (data) this.altar.restoreFromSave(data as never); } });
    const s = ctx.kernel.services;
    const modal = () => s.get(ModalKey);

    this.altar.onSpellForged = (spell, goldCost) => {
      s.get(FeedbackKey).notify(`Spell forged: "${spell.name}" (${goldCost}g)`, 3000);
      s.get(SkillsKey).gainXP("destruction", 20);
      s.get(FeedbackKey).markDirty();
    };
    this._wire = (panel) => {
      panel.onForge = ({ name, components }) => {
        const purse = s.get(PurseKey);
        // The altar checks (and draws down) a wallet; the real coins go after.
        const wallet = { playerGold: purse.gold() } as BarterSystem;
        const result = this.altar.forgeSpell(name, components, wallet);
        if (!result.ok) {
          panel.showStatus(REASONS[result.reason ?? ""] ?? `Cannot forge spell (${result.reason ?? "unknown"}).`, true);
          return;
        }
        if (result.goldCost && result.goldCost > 0) purse.spend(result.goldCost);
        panel.showStatus(`Forged "${result.spell!.name}" for ${result.goldCost} gold. Press Z to cycle spells.`);
      };
      panel.onClose = () => modal().restoreGameplay();
    };
    if (this.panel.current) this._wire(this.panel.current);

    ctx.provide(SpellMakingKey, {
      altar: this.altar,
      panel: this.panel,
      toggle: () => {
        if (this.panel.isVisible) { this.panel.close(); return; }
        if (!s.get(GameplayKey).canAct()) return;
        modal().suspendGameplay();
        this.panel.openWith((panel) => panel.open(), () => modal().restoreGameplay());
      },
    });

    ctx.scope.add(() => {
      this.altar.onSpellForged = null;
      const panel = this.panel.current;
      if (panel) { panel.onForge = null; panel.onClose = null; }
      this.panel.close();
      this._wire = null;
    });
  }
}
