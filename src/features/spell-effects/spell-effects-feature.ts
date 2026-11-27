/**
 * What the caster's own spells do beyond harm and healing (the `effect` of
 * a spell definition): Bark-skin's ward, Fade's unseen cloak, Breath of the
 * Lake, Spirit Blade's force. (Hush is the spell system's own; Call the
 * Familiar is the companions'.)
 *
 * Crafted potions' lasting effects (fortify, resist, unseen, weight) go
 * through the same systems: this sets the alchemy system's `effects`.
 *
 * Inputs:   `spell:cast` (with effect, magnitude, duration).
 * Outputs:  timed active effects, the stealth cloak, water breathing.
 */
import type { Feature, FeatureContext } from "../../core/kernel";
import type { ActiveEffect } from "../../systems/active-effects-system";
import { declareStateless } from "../services";

export interface SpellEffectsDeps {
  effects: { addEffect(effect: Omit<ActiveEffect, "totalDuration">): void };
  stealth: { unseenSeconds: number };
  swim: { waterBreathingSeconds: number };
  /** Crafted potions' lasting effects go through here too. */
  alchemy: { effects: { timed(kind: ActiveEffect["effectType"], magnitude: number, seconds: number, name: string): void; unseen(seconds: number): void } | null };
}

export class SpellEffectsFeature implements Feature {
  public readonly id = "spell-effects";

  constructor(private readonly _d: SpellEffectsDeps) {}

  public install(ctx: FeatureContext): void {
    declareStateless(ctx, "the effects it starts are the active-effects, stealth and swimming systems' own");
    let n = 0;
    const d0 = this._d;
    d0.alchemy.effects = {
      timed: (effectType, magnitude, duration, name) => d0.effects.addEffect({ id: `potion_${effectType}_${++n}`, name, effectType, magnitude, duration }),
      unseen: (seconds) => { d0.stealth.unseenSeconds = Math.max(d0.stealth.unseenSeconds, seconds); },
    };
    ctx.scope.add(() => { d0.alchemy.effects = null; });
    ctx.on("spell:cast", ({ spellId, spellName, effect, magnitude = 0, duration = 0 }) => {
      if (!effect || duration <= 0) return;
      const d = this._d;
      const timed = (effectType: ActiveEffect["effectType"]) =>
        d.effects.addEffect({ id: `spell_${spellId}_${++n}`, name: spellName, effectType, magnitude, duration });
      switch (effect) {
        case "ward": timed("resist_damage"); break;
        case "spirit_weapon": timed("fortify_strength"); break;
        case "unseen": d.stealth.unseenSeconds = Math.max(d.stealth.unseenSeconds, duration); break;
        case "water_breathing": d.swim.waterBreathingSeconds = Math.max(d.swim.waterBreathingSeconds, duration); break;
        default: break;
      }
    });
  }
}
