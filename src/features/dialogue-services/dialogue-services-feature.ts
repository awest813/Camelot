/**
 * Services NPCs sell in conversation: a trainer's lesson ("trainer:train")
 * and a night at the inn ("rest:inn").
 *
 * Inputs:   event `dialogue:action`; services dialogue-host, skills, purse,
 *           feedback.
 *
 * Extracted from game.ts (engine overhaul, Phase 1).
 */
import type { Feature, FeatureContext } from "../../core/kernel";
import { createServiceKey } from "../../core/kernel";
import type { TrainerSystem } from "../../systems/trainer-system";
import { FeedbackKey, PurseKey, SkillsKey, declareStateless } from "../services";

export interface DialogueHostService {
  readonly trainers: TrainerSystem;
  /** A skill's display name. */
  skillName(skillId: string): string;
  /** Sleep `hours` at an inn; the wake-up message, or null if you can't rest. */
  restAtInn(hours: number): string | null;
}

export const DialogueHostKey = createServiceKey<DialogueHostService>("dialogue-host");

export class DialogueServicesFeature implements Feature {
  public readonly id = "dialogue-services";

  public install(ctx: FeatureContext): void {
    declareStateless(ctx, "lessons and nights at the inn take effect at once");
    const s = ctx.kernel.services;
    const notify = (text: string, ms: number) => s.get(FeedbackKey).notify(text, ms);

    ctx.on("dialogue:action", ({ eventId, payload }) => {
      if (eventId === "trainer:train") {
        const trainerId = typeof payload?.trainerId === "string" ? payload.trainerId : "";
        if (!trainerId) return;
        const host = s.get(DialogueHostKey);
        const def = host.trainers.getTrainer(trainerId);
        if (!def) { notify("That trainer is not available.", 2000); return; }
        const level = s.get(SkillsKey).level(def.skillId);
        const result = host.trainers.train(trainerId, level, s.get(PurseKey).gold());
        if (result.success) return; // the trainer system reports the lesson
        const reasons: Record<string, string> = {
          unknown_trainer: "That trainer is not available.",
          skill_at_cap: `Your ${host.skillName(def.skillId)} is as high as I can train you.`,
          session_limit_reached: "You've trained enough for now. Gain a character level, then return.",
          insufficient_gold: `You need ${host.trainers.getCost(trainerId, level) ?? 0} gold for the next lesson.`,
        };
        notify(reasons[result.reason] ?? `Cannot train (${result.reason}).`, 3200);
        return;
      }
      if (eventId === "rest:inn") {
        const raw = payload?.hours;
        const hours = typeof raw === "number" && Number.isFinite(raw) ? Math.round(raw) : 8;
        const woke = s.get(DialogueHostKey).restAtInn(hours);
        if (woke === null) return;
        notify(`You slept soundly. ${woke}`, 3200);
        s.get(SkillsKey).gainXP("speechcraft", 6);
        s.get(FeedbackKey).markDirty();
      }
    });
  }
}
