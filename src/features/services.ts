/**
 * Services the game provides to feature modules.
 *
 * Features depend on these narrow interfaces, never on `Game`, so each one
 * can be tested with fakes and moved without touching the rest.  As the
 * overhaul proceeds (entity store, scopes per chunk) the implementations
 * move out of game.ts too; the interfaces are the contract.
 */
import type { NPC } from "../entities/npc";
import type { VillagePlan } from "../world/village-settlement";
import { createServiceKey } from "../core/kernel";

export interface GameClockService {
  /** Hour of day, 0–23 (fractional). */
  hour(): number;
  /** In-game hours since the start of the game. */
  elapsedHours(): number;
}

export interface PlayerService {
  position(): { x: number; z: number };
  level(): number;
}

export interface FeedbackService {
  notify(text: string, ms?: number): void;
  grant(reward: { gold?: number; xp?: number; label: string }): void;
  addFame(amount: number): void;
  /** Something worth saving changed. */
  markDirty(): void;
}

/** Villages and the people in them (streamed chunks). */
export interface VillageWorldService {
  /** The loaded, discovered village the player is standing in, if any. */
  currentVillage(): { chunkKey: string; plan: VillagePlan } | null;
  loadedVillage(villageId: string): VillagePlan | null;
  /** NPCs living in a loaded chunk. */
  residents(chunkKey: string): readonly NPC[];
  /** Spawn an archetype NPC into a loaded chunk (owned by that chunk). */
  spawnArchetype(chunkKey: string, archetype: string, x: number, z: number): NPC | null;
  /** Remove an NPC from the world and every system. */
  despawn(npc: NPC): void;
  /** Hide an NPC indoors (no mesh, no collisions) until released. */
  sendIndoors(npc: NPC): void;
  isIndoors(npc: NPC): boolean;
  /** Whether the player is talking or trading with this NPC. */
  isTalkingTo(npc: NPC): boolean;
}

export const ClockKey = createServiceKey<GameClockService>("clock");
export const PlayerKey = createServiceKey<PlayerService>("player");
export const FeedbackKey = createServiceKey<FeedbackService>("feedback");
export const VillageWorldKey = createServiceKey<VillageWorldService>("village-world");
