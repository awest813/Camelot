/**
 * Routines that go on while the player isn't watching.
 *
 * Two moments put NPCs where their schedule says they would be, instead of
 * where they were last seen (or where the village plan first stood them):
 *   - a resident arriving with its chunk (`place`): the smith is at the
 *     forge at noon, and the villagers are indoors at midnight;
 *   - time passing in a jump (waiting, fast travel, jail, a load): an hour
 *     or more between two ticks moves every calm NPC to its spot for the new
 *     hour, and those whose schedule says sleep go indoors.
 *
 * Fighting, talking and already-indoors NPCs are left alone.
 *
 * Inputs:   services clock, actors, indoors; a sim-phase system.
 * Outputs:  the `routines` service.
 *
 * Engine overhaul, Phase 6 (off-screen schedule simulation).
 */
import type { Feature, FeatureContext } from "../../core/kernel";
import { createServiceKey } from "../../core/kernel";
import type { NPC } from "../../entities/npc";
import { teleportNpc } from "../../entities/npc-teleport";
import { scheduledSpot } from "../../systems/schedule-system";
import { IndoorsKey, RoutinesKey } from "../services";
import { ActorsKey, ClockKey, declareStateless } from "../services";

/** A clock jump at least this long (game hours) is time passing off-screen. */
export const ROUTINE_SKIP_HOURS = 1;
/** NPCs stand this high when placed (as they spawn). */
const STAND_Y = 2;

export interface RoutinesService {
  /** Put an NPC where its schedule has it now. True when it was moved. */
  place(npc: NPC): boolean;
}

export { RoutinesKey };

export class RoutinesFeature implements Feature {
  public readonly id = "routines";

  public install(ctx: FeatureContext): void {
    declareStateless(ctx, "positions come from the schedules and the clock");
    const s = ctx.kernel.services;

    const place = (npc: NPC): boolean => {
      if (npc.isDead || npc.isAggressive || npc.isInDialogue) return false;
      const indoors = s.tryGet(IndoorsKey);
      if (indoors?.isIndoors(npc)) return false;
      const { behavior, at } = scheduledSpot(npc, s.get(ClockKey).hour());
      if (!at) return false;
      teleportNpc(npc, at.x, STAND_Y, at.z);
      if (behavior === "sleep") indoors?.send(npc);
      return true;
    };
    ctx.provide(RoutinesKey, { place });

    let last: number | undefined;
    ctx.system({
      id: "routines.catch-up",
      phase: "sim",
      update: () => {
        const now = s.get(ClockKey).elapsedHours();
        const jumped = last !== undefined && now - last >= ROUTINE_SKIP_HOURS;
        last = now;
        if (!jumped) return;
        for (const npc of s.get(ActorsKey).all()) place(npc);
      },
    });
  }
}
