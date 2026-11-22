/**
 * Services the game provides to feature modules.
 *
 * Features depend on these narrow interfaces, never on `Game`, so each one
 * can be tested with fakes and moved without touching the rest.  As the
 * overhaul proceeds (entity store, scopes per chunk) the implementations
 * move out of game.ts too; the interfaces are the contract.
 */
import type { NPC } from "../entities/npc";
import type { Quest } from "../systems/quest-system";
import type { Scene } from "@babylonjs/core/scene";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { BiomeType } from "../world/world-manager";
import type { BuildingKind } from "../world/village-buildings";
import type { VillagePlan } from "../world/village-settlement";
import type { FantasyAssetKey } from "../systems/fantasy-asset-loader";
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

/** Villages: plans, loaded ones, and where the player is (villages feature). */
export interface VillagesService {
  /** The village plan for chunk (cx, cz), or null (deterministic, cached). */
  planFor(cx: number, cz: number): VillagePlan | null;
  /** Clearing the world keeps free of trees and ruins for chunk (cx, cz). */
  clearingAt(cx: number, cz: number): { x: number; z: number; radius: number } | null;
  /** Build the chunk's village if it has one; true when a village took the chunk. */
  populate(chunkKey: string, cx: number, cz: number): boolean;
  /** Loaded villages by chunk key. */
  loaded(): ReadonlyMap<string, VillagePlan>;
  loadedVillage(villageId: string): VillagePlan | null;
  /** The loaded, discovered village the player is standing in, if any. */
  currentVillage(): { chunkKey: string; plan: VillagePlan } | null;
  /** The inn job board an NPC (by mesh name) belongs to. */
  innBoardOf(npcName: string): { boardId: string; placeName: string } | null;
}


/** NPCs in the streamed world (chunk-owned). */
export interface ActorsService {
  /** NPCs living in a loaded chunk. */
  residents(chunkKey: string): readonly NPC[];
  /** Spawn an archetype NPC into a loaded chunk (owned by that chunk). */
  spawnArchetype(chunkKey: string, archetype: string, x: number, z: number): NPC | null;
  /** Remove an NPC from the world and every system. */
  despawn(npc: NPC): void;
  /** Whether the player is talking or trading with this NPC. */
  isTalkingTo(npc: NPC): boolean;
  /** Look an NPC up by mesh name (until entity ids, Phase 3). */
  byName(name: string): NPC | undefined;
}

/** Static facts about the streamed world. */
export interface WorldInfoService {
  readonly chunkSize: number;
  biome(cx: number, cz: number): BiomeType;
  pondAt(cx: number, cz: number): boolean;
}

/** Fast-travel destinations. */
export interface FastTravelService {
  isDiscovered(id: string): boolean;
  /** Returns true when newly discovered. */
  discover(id: string, name: string, at: { x: number; y: number; z: number }): boolean;
}

/** A keep-out footprint (oriented box, half sizes incl. margin) NPCs path around. */
export interface KeepOut { x: number; z: number; cos: number; sin: number; hw: number; hd: number }

/**
 * Places content into a loaded chunk; everything placed is owned by (and
 * disposed with) that chunk.  Calls for a chunk that has since unloaded are
 * ignored.  Becomes the data-driven site builder in Phase 6.
 */
export interface SiteBuilderService {
  readonly scene: Scene;
  /** Whether the chunk is still loaded (async callbacks check before placing). */
  isLive(chunkKey: string): boolean;
  placeBuilding(chunkKey: string, kind: BuildingKind, origin: { x: number; z: number; rot: number }): void;
  placeProp(chunkKey: string, key: FantasyAssetKey, x: number, z: number, rot: number): void;
  placeSmithy(chunkKey: string, x: number, z: number, rot: number): void;
  /** Own a mesh in the chunk: shadows and distance culling ("structure" tier). */
  ownStructure(chunkKey: string, mesh: AbstractMesh): void;
  /** Own a mesh in the chunk with no extras (colliders, hit boxes, decals). */
  own(chunkKey: string, mesh: AbstractMesh): void;
  /** Register a keep-out footprint; returns a function that removes it. */
  addKeepOut(fp: KeepOut): () => void;
  /** A night-only flame + light (FireFx-managed); null when fire FX are off. */
  nightFlame(name: string, x: number, y: number, z: number): AbstractMesh | null;
}

/** NPC schedules (read-only queries). */
export interface ScheduleQueryService {
  /** The NPC's scheduled behaviour right now ("sleep", "work", …) or null. */
  behaviorOf(npc: NPC): string | null;
}

/** Loaded buildings as world geometry. */
export interface BuildingsService {
  /** Whether (x, z) is within `margin` m of a loaded building. */
  nearBuilding(x: number, z: number, margin: number): boolean;
}

export interface InventoryService {
  count(itemId: string): number;
  /** Remove across stacks, all or nothing. */
  remove(itemId: string, amount: number): boolean;
}

/** The quest log (legacy QuestSystem list until Phase 4 unifies quests). */
export interface QuestLogService {
  /** The live, mutable list of quests. */
  quests(): Quest[];
  add(quest: Quest): void;
}

/** Full-screen windows: pause gameplay input while one is open. */
export interface ModalService {
  suspendGameplay(): void;
  restoreGameplay(): void;
}

export const ClockKey = createServiceKey<GameClockService>("clock");
export const PlayerKey = createServiceKey<PlayerService>("player");
export const FeedbackKey = createServiceKey<FeedbackService>("feedback");
export const VillagesKey = createServiceKey<VillagesService>("villages");
export const ActorsKey = createServiceKey<ActorsService>("actors");
export const WorldInfoKey = createServiceKey<WorldInfoService>("world-info");
export const FastTravelKey = createServiceKey<FastTravelService>("fast-travel");
export const SiteBuilderKey = createServiceKey<SiteBuilderService>("site-builder");
export const InventoryKey = createServiceKey<InventoryService>("inventory");
export const QuestLogKey = createServiceKey<QuestLogService>("quest-log");
export const ModalKey = createServiceKey<ModalService>("modal");
export const ScheduleKey = createServiceKey<ScheduleQueryService>("schedules");
export const BuildingsKey = createServiceKey<BuildingsService>("buildings");
