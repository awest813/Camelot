/**
 * The game's actor store: every NPC gets an id here when it is built and
 * leaves when its body is disposed.  Its state flags (dead, aggressive,
 * talking, staggered, …) live here as components.
 *
 * Engine overhaul, Phase 3.
 */
import { ActorStore } from "../core/ecs/actors";
import type { NPC } from "./npc";

export const actors = new ActorStore<NPC>();
