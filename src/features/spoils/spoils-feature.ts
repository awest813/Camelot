/**
 * Spoils as a kernel feature: what a slain NPC leaves.  Its loot table rolls
 * into pickups scattered where it fell, and elites (dragons, bandit chiefs)
 * also drop gear from the leveled lists, scaled to the player's level.
 *
 * Inputs:   event `player:kill`; services spoils-host, feedback.
 * Outputs:  pickups in the world.
 *
 * Extracted from game.ts (engine overhaul, Phase 1).
 */
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Feature, FeatureContext } from "../../core/kernel";
import { createServiceKey } from "../../core/kernel";
import type { Item } from "../../systems/inventory-system";
import { LEVEL_ITEM_TEMPLATES } from "../../content/leveled-gear";
import { FeedbackKey } from "../services";

/** Elites whose death also drops leveled gear. */
const ELITE = /^(DragonBoss|Bandit Chief)/;

export interface SpoilsHostService {
  /** The player's level (scales the rolls). */
  level(): number;
  /** Roll a loot table. */
  roll(tableId: string, level: number): Item[];
  /** Resolve a leveled list to an item id. */
  resolveLeveled(listId: string, level: number): string | null;
  /** Put a pickup in the world. */
  drop(at: Vector3, item: Item): void;
}

export const SpoilsHostKey = createServiceKey<SpoilsHostService>("spoils-host");

export class SpoilsFeature implements Feature {
  public readonly id = "spoils";

  public install(ctx: FeatureContext): void {
    const s = ctx.kernel.services;
    ctx.on("player:kill", ({ npcId, at, lootTableId }) => {
      if (!at) return;
      const host = s.get(SpoilsHostKey);
      const level = host.level();
      const scatter = ctx.kernel.rng.stream("death-drops");

      if (lootTableId) {
        for (const item of host.roll(lootTableId, level)) {
          host.drop(new Vector3(at.x + (scatter.next() - 0.5) * 1.2, at.y + 0.5, at.z + (scatter.next() - 0.5) * 1.2), item);
        }
      }

      if (!ELITE.test(npcId)) return;
      const listId = ctx.kernel.rng.stream("elite-drops").chance(0.6) ? "ll_weapon_melee" : "ll_armor_heavy";
      const id = host.resolveLeveled(listId, level);
      const t = id ? LEVEL_ITEM_TEMPLATES[id] : undefined;
      if (!id || !t) return;
      host.drop(new Vector3(at.x, at.y + 0.6, at.z), {
        id, name: t.name, description: t.description, stackable: false, quantity: 1,
        weight: t.weight, slot: t.slot as Item["slot"], stats: { ...t.stats },
      });
      s.get(FeedbackKey).notify(`The elite drops ${t.name}!`, 2600);
    });
  }
}
