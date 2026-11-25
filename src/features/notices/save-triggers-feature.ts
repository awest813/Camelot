/**
 * Save triggers: events that leave something worth saving mark the save
 * dirty (so the autosave picks it up).  One list instead of a markDirty()
 * in each handler.
 *
 * Inputs:   the events in SAVE_WORTHY; service feedback.
 * Outputs:  a dirty save.
 *
 * Engine overhaul (systems wired by events, not callback properties).
 */
import type { Feature, FeatureContext } from "../../core/kernel";
import type { GameEventType } from "../../systems/event-bus";
import { FeedbackKey, declareStateless } from "../services";

/** Events after which the game state differs from the last save. */
export const SAVE_WORTHY: readonly GameEventType[] = [
  "skill:levelUp", "perk:unlocked", "merchant:restocked", "npc:slept", "npc:woke",
];

export class SaveTriggersFeature implements Feature {
  public readonly id = "save-triggers";

  public install(ctx: FeatureContext): void {
    declareStateless(ctx, "only marks the save dirty");
    for (const event of SAVE_WORTHY) ctx.on(event, () => ctx.kernel.services.get(FeedbackKey).markDirty());
  }
}
