/**
 * Bringing an NPC into the world and taking it out again, the same way
 * every time: the systems that track NPCs, level scaling, distance culling,
 * what it carries for pickpockets, and the `npc:released` event features
 * use to drop their references.
 *
 * (The structure spawner's removal path used to skip the event, and the
 * chunk path skipped the pickpocket inventory.)
 *
 * Moved out of game.ts (engine overhaul, Phase 1).
 */
import type { NPC } from "../entities/npc";
import type { GameEventBus } from "../systems/event-bus";

/** A system that keeps its own list of NPCs. */
export interface TracksNpcs { removeNPC(npc: NPC): void }

export interface NpcRosterDeps {
  /** Where NPCs are added (the shared list the other systems read). */
  schedule(): { addNPC(npc: NPC): void } & TracksNpcs;
  /** Every other system with its own NPC list. */
  trackers(): readonly TracksNpcs[];
  lod(): { register(mesh: NPC["mesh"], distance: number): void; unregister(mesh: NPC["mesh"]): void };
  /** Scale to the player's level (and the region's danger, when `regional`). */
  scale(npc: NPC, regional: boolean): void;
  pockets(): { registerNpc(npc: NPC): void; forget(npcName: string): void };
  events(): GameEventBus;
}

/** How far away an NPC's capsule stops drawing. */
const NPC_DRAW_DISTANCE = 120;

export class NpcRoster {
  constructor(private readonly _d: NpcRosterDeps) {}

  /**
   * Bring an NPC into the world.  `cull: false` keeps it drawn at any
   * distance (a dragon's capsule is hidden, and its body culls itself).
   */
  public add(npc: NPC, opts: { regional?: boolean; cull?: boolean; pockets?: boolean } = {}): void {
    this._d.schedule().addNPC(npc);
    this._d.scale(npc, opts.regional ?? false);
    if (opts.cull ?? true) this._d.lod().register(npc.mesh, NPC_DRAW_DISTANCE);
    if (opts.pockets ?? true) this._d.pockets().registerNpc(npc);
  }

  /** Take an NPC out of every system (and dispose its body unless told not to). */
  public remove(npc: NPC, opts: { dispose?: boolean } = {}): void {
    this._d.schedule().removeNPC(npc);
    for (const t of this._d.trackers()) t.removeNPC(npc);
    this._d.lod().unregister(npc.mesh);
    this._d.pockets().forget(npc.key);
    this._d.events().emit("npc:released", { npcName: npc.key });
    if (opts.dispose ?? true) npc.mesh.dispose();
  }
}
