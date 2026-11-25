/**
 * NPCs entering and leaving the world: despawning, release, recovering ones that fell through it, and who counts as a settler.
 *
 * Part of the composition root (moved out of game.ts).
 */
import type { Game } from "../game";
import { teleportNpc } from "../entities/npc-teleport";
import { NPC, AIState } from "../entities/npc";

/** Remove one NPC from the world and every system (and its chunk's list). */
export function despawnNpc(g: Game, npc: NPC): void {
  g._chunks.forget(npc);
  releaseNpc(g, npc);
}

/** Unregister an NPC from every system and dispose it. */
export function releaseNpc(g: Game, npc: NPC): void {
  g._roster.remove(npc);
}

/**
 * Put an NPC that fell through the world back at its spawn point.  Bodies
 * spawned before their ground chunk existed (e.g. the boot-time test guard)
 * otherwise fall forever.
 */
export function recoverFallenNpc(_g: Game, npc: NPC): void {
  teleportNpc(npc, npc.spawnPosition.x, Math.max(npc.spawnPosition.y, 2), npc.spawnPosition.z);
}

/**
 * True when the victim is a non-hostile settlement NPC (villager, merchant,
 * guard…) whose death counts as murder. Structure guards (Ruin/Tower),
 * dragon bosses, and anything already aggressive are excluded.
 */
export function isSettlementNpc(_g: Game, npc: NPC): boolean {
  // Natural hostiles are never "settlement" victims, whatever their state.
  if (npc.factionId === "bandits") return false;
  if (/^(RuinGuard|TowerGuard|DragonBoss)/.test(npc.key)) return false;
  // Actively fighting NPCs are combat kills; suspicion (ALERT after
  // spotting a sneaking player) does NOT make a civilian kill lawful.
  if (
      npc.aiState === AIState.CHASE ||
      npc.aiState === AIState.ATTACK ||
      npc.aiState === AIState.FLEE
  ) return false;
  return true;
}
