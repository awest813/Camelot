/**
 * NPC LOD tiers: sorts every NPC into near / mid / far by its distance
 * from the player, as actor components (`LodMid`, `LodFar`).  Systems ask
 * the tier instead of each measuring its own distance:
 *   - NPC visuals pause far NPCs' animation and rigs;
 *   - the schedule system walks mid and far NPCs at a lower rate.
 *
 * The bands overlap a little (hysteresis), so an NPC standing on a
 * boundary doesn't flip tiers every tick.
 *
 * Engine overhaul, Phase 3.
 */
import type { NPC } from "../entities/npc";
import type { ActorStore, LodTier } from "../core/ecs/actors";

/** Within this many metres an NPC is near. */
export const NPC_TIER_NEAR = 40;
/** Beyond this many metres an NPC is far (a capsule is a few pixels). */
export const NPC_TIER_FAR = 100;
/** How far past a boundary an NPC must go before it changes tier. */
export const NPC_TIER_HYSTERESIS = 4;

interface Point { x: number; y: number; z: number }

/** The tier for an NPC `distSq` away whose tier was `current`. */
export function tierFor(distSq: number, current: LodTier): LodTier {
  const h = NPC_TIER_HYSTERESIS;
  // Moving outward needs to clear the boundary by h; moving inward, by h too.
  const nearEdge = current === "near" ? NPC_TIER_NEAR + h : NPC_TIER_NEAR - h;
  const farEdge = current === "far" ? NPC_TIER_FAR - h : NPC_TIER_FAR + h;
  if (distSq <= nearEdge * nearEdge) return "near";
  if (distSq <= farEdge * farEdge) return "mid";
  return "far";
}

export class NpcTierSystem {
  constructor(private readonly _actors: ActorStore<NPC>) {}

  /** Re-tier `npcs` around `player`. */
  public update(player: Point, npcs: readonly NPC[]): void {
    for (const npc of npcs) {
      const p = npc.mesh.position;
      const dx = p.x - player.x, dy = p.y - player.y, dz = p.z - player.z;
      const current = this._actors.tier(npc.actorId);
      const next = tierFor(dx * dx + dy * dy + dz * dz, current);
      if (next !== current) this._actors.setTier(npc.actorId, next);
    }
  }
}
