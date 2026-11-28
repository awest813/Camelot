/**
 * Survival needs as a kernel feature: hunger, fatigue and cold, with their
 * warnings and what they cost (less stamina and magicka, slower learning,
 * frost damage when freezing).  Cold builds in the tundra and in rain or
 * storms, and fades elsewhere.
 *
 * Inputs:   services survival-host, feedback; a sim-phase system.
 * Outputs:  the survival system (eat / rest are called by food and sleep).
 *
 * Extracted from game.ts (engine overhaul, Phase 1).
 */
import { every } from "../../core/every";
import type { Feature, FeatureContext } from "../../core/kernel";
import { createServiceKey } from "../../core/kernel";
import { SurvivalChip } from "../../ui/survival-chip";
import { SurvivalSystem } from "../../systems/survival-system";
import { FeedbackKey, ownSave } from "../services";

/** The body the needs act on. */
export interface SurvivalBody {
  health: number;
  stamina: number;
  magicka: number;
  readonly maxStamina: number;
  readonly maxMagicka: number;
  notifyDamageTaken(): void;
}

export interface SurvivalHostService {
  body(): SurvivalBody;
  /** Whether it is cold where the player stands (tundra, rain, storm). */
  isCold(): boolean;
  /** Learning slows when the needs go unmet. */
  setXpMultiplier(multiplier: number): void;
  /** The names of the diseases the player carries (for the HUD). */
  ailments?(): string[];
}

export const SurvivalHostKey = createServiceKey<SurvivalHostService>("survival-host");

const WARNINGS: Record<string, [string, number]> = {
  hungry: ["You are getting hungry. Find some food.", 3000],
  starving: ["You are starving!", 3500],
  tired: ["You are getting tired. Rest soon (T).", 3000],
  exhausted: ["You are exhausted!", 3500],
  cold: ["You are cold. Seek shelter or fire.", 3000],
  freezing: ["You are freezing! Health is draining.", 3500],
};

export class SurvivalFeature implements Feature {
  public readonly id = "survival";
  public readonly needs = new SurvivalSystem();
  /** What the needs are doing to you, on the HUD. */
  public readonly chip = new SurvivalChip();

  public install(ctx: FeatureContext): void {
    ownSave(ctx, { key: "survival", save: () => this.needs.getSaveState(), load: (data) => { if (data) this.needs.restoreFromSave(data as never); } });
    const s = ctx.kernel.services;
    const warn = (level: string) => {
      const w = WARNINGS[level];
      if (w) s.get(FeedbackKey).notify(w[0], w[1]);
    };
    const n = this.needs;
    n.onHungerLevelChanged = warn;
    n.onFatigueLevelChanged = warn;
    n.onColdLevelChanged = warn;

    ctx.system({
      id: "survival.needs", phase: "sim", update: (dt) => {
        const host = s.get(SurvivalHostKey);
        n.update(dt, host.isCold());
        host.setXpMultiplier(n.xpMultiplier);
        const body = host.body();
        if (n.staminaRegenPenalty < 0) body.stamina = Math.max(0, body.stamina + n.staminaRegenPenalty * dt);
        body.stamina = Math.min(body.stamina, body.maxStamina + n.maxStaminaPenalty);
        body.magicka = Math.min(body.magicka, body.maxMagicka + n.maxMagickaPenalty);
        if (n.frostDamagePerSecond > 0) {
          body.health = Math.max(0, body.health - n.frostDamagePerSecond * dt);
          body.notifyDamageTaken();
        }
      },
    });

    ctx.system({ id: "survival.chip", phase: "ui", update: every(0.25, () => this.chip.update(n.hungerLevel, n.fatigueLevel, n.coldLevel, s.get(SurvivalHostKey).ailments?.() ?? [])) });

    ctx.scope.add(() => {
      n.onHungerLevelChanged = n.onFatigueLevelChanged = n.onColdLevelChanged = null;
    });
  }
}
