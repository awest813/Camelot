/**
 * Services the game provides to feature modules.
 *
 * Features depend on these narrow interfaces, never on `Game`, so each one
 * can be tested with fakes and moved without touching the rest.  As the
 * overhaul proceeds (entity store, scopes per chunk) the implementations
 * move out of game.ts too; the interfaces are the contract.
 */
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { NPC } from "../entities/npc";
import type { ProgressionSkillId } from "../systems/skill-progression-system";
import type { Scene } from "@babylonjs/core/scene";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { BiomeType } from "../world/world-manager";
import type { BuildingKind } from "../world/village-buildings";
import type { VillagePlan } from "../world/village-settlement";
import type { FantasyAssetKey } from "../systems/fantasy-asset-loader";
import { createServiceKey, type FeatureContext } from "../core/kernel";
import type { SaveCodec } from "../systems/save-system";
import type { QuestGraphEngine } from "../framework/quests/quest-graph-engine";
import type { IndoorsService } from "./indoors/indoors-feature";
import type { JobsService } from "./village-jobs/jobs-feature";
import type { RoutinesService } from "./routines/routines-feature";
import type { TravelService } from "./fast-travel/fast-travel-feature";
import type { WorldSeed } from "../world/world-seed";

export interface GameClockService {
  /** Hour of day, 0–23 (fractional). */
  hour(): number;
  /** In-game hours since the start of the game. */
  elapsedHours(): number;
}

export interface PlayerService {
  /** Where the player stands (`y` is eye height, when known). */
  position(): { x: number; y?: number; z: number };
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
  /** Look an NPC up by its key (its spawn name). */
  byName(name: string): NPC | undefined;
  /** Every live NPC the simulation tracks. */
  all(): readonly NPC[];
  /** Living NPCs that are hostile right now (the `Aggressive` actor tag). */
  hostiles(): readonly NPC[];
}

/** Static facts about the streamed world. */
export interface WorldInfoService {
  readonly chunkSize: number;
  biome(cx: number, cz: number): BiomeType;
  pondAt(cx: number, cz: number): boolean;
  /** The world seed (null: the legacy unseeded world) and how many chunks are loaded. */
  seed(): WorldSeed | null;
  /** Change the seed (only safe while no chunks are loaded). */
  setSeed(seed: WorldSeed | null): void;
  loadedChunks(): number;
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
 * ignored.  Sites are described as data (world/site-specs.ts) and built through it.
 */
export interface SiteBuilderService {
  readonly scene: Scene;
  /** Whether the chunk is still loaded (async callbacks check before placing). */
  isLive(chunkKey: string): boolean;
  placeBuilding(chunkKey: string, kind: BuildingKind, origin: { x: number; z: number; rot: number }): void;
  placeProp(chunkKey: string, key: FantasyAssetKey, x: number, z: number, rot: number): void;
  /** Place an asset with height, scale and culling tier (default "prop"). */
  placeAsset(chunkKey: string, key: FantasyAssetKey, at: {
    x: number; y?: number; z: number; yaw: number; scale?: number; tier?: "structure" | "scene" | "prop";
  }): void;
  /** The tundra dragon boss (NPC + body), owned by the chunk. */
  spawnDragon(chunkKey: string, x: number, z: number, yaw: number): void;
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

/** Full-screen windows: pause gameplay input while one is open. */
export interface ModalService {
  suspendGameplay(): void;
  restoreGameplay(): void;
}

/** Live world conditions features read (weather, the player's standing). */
export interface WorldStateService {
  weather(): string;
  /** Whether the player has a bounty anywhere (raises bandit activity). */
  hasBounty(): boolean;
  biomeAt(x: number, z: number): BiomeType;
}

/** Procedural animation on simple meshes (pets, props). */
export interface AnimationService {
  idle(mesh: Mesh): void;
  walk(mesh: Mesh): void;
  run(mesh: Mesh): void;
  death(mesh: Mesh): void;
  /** Stop animating a mesh (before disposing it). */
  release(mesh: Mesh): void;
}

/** The player's skills. */
export interface SkillsService {
  level(skill: ProgressionSkillId): number;
  /** Award XP, scaled by the player's class. */
  gainXP(skill: ProgressionSkillId, base: number): void;
}

/** The player's gold. */
export interface PurseService {
  gold(): number;
  /** Take `amount` gold; false (and nothing taken) when there isn't enough. */
  spend(amount: number): boolean;
}

/** Whether gameplay input may act now (not paused, talking, or in a menu). */
export interface GameplayService {
  canAct(): boolean;
}

/** Loot in the world. */
export interface LootService {
  /** Roll a loot table and drop up to `count` items around the player. */
  dropNear(tableId: string, count: number): void;
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

/** The quest engine (the framework's) and the way quest events reach it. */
export interface QuestsService {
  /** Radiant templates, starting and removing radiant quests, quest state. */
  readonly engine: QuestGraphEngine;
  /** Feed a quest event; the quests it completes are paid out. */
  apply(type: "kill" | "pickup" | "talk" | "custom", targetId: string, amount?: number): void;
}
export const QuestsKey = createServiceKey<QuestsService>("quests");
export const WorldStateKey = createServiceKey<WorldStateService>("world-state");
export const AnimationKey = createServiceKey<AnimationService>("animation");
export const SkillsKey = createServiceKey<SkillsService>("skills");
export const PurseKey = createServiceKey<PurseService>("purse");
export const GameplayKey = createServiceKey<GameplayService>("gameplay");
export const LootKey = createServiceKey<LootService>("loot");
export const ModalKey = createServiceKey<ModalService>("modal");
export const ScheduleKey = createServiceKey<ScheduleQueryService>("schedules");
export const BuildingsKey = createServiceKey<BuildingsService>("buildings");

/** The save file: features own their part of it. */
export interface SavesService {
  /** Own a part of the save; returns the unregister function. */
  register(codec: SaveCodec): () => void;
}
export const SavesKey = createServiceKey<SavesService>("saves");

/*
 * Persistence declarations.  Every feature says what happens to its state
 * across a save and a load: it owns a part of the save (`ownSave`), it
 * keeps state on purpose that a load resets (`ownTransient`), or it has
 * nothing of its own to keep (`declareStateless`).  `undeclaredFeatures`
 * lists any that said nothing; the boot smoke test requires none.
 */

/** One feature's answer to "what happens to your state on load?". */
export type PersistenceDeclaration =
  | { kind: "saved"; key: string }
  | { kind: "transient"; what: string }
  | { kind: "stateless"; why: string };

const ledgers = new WeakMap<object, Map<string, PersistenceDeclaration[]>>();

function declare(ctx: FeatureContext, d: PersistenceDeclaration): void {
  let ledger = ledgers.get(ctx.kernel);
  if (!ledger) ledgers.set(ctx.kernel, (ledger = new Map()));
  const list = ledger.get(ctx.id) ?? [];
  list.push(d);
  ledger.set(ctx.id, list);
  ctx.scope.add(() => {
    const now = ledger!.get(ctx.id);
    const i = now?.indexOf(d) ?? -1;
    if (now && i >= 0) now.splice(i, 1);
    if (now?.length === 0) ledger!.delete(ctx.id);
  });
}

/** What each installed feature declared about its state. */
export function persistenceOf(kernel: object): ReadonlyMap<string, readonly PersistenceDeclaration[]> {
  return ledgers.get(kernel) ?? new Map();
}

/** Installed features that declared nothing about their state. */
export function undeclaredFeatures(kernel: { installed(): string[] }): string[] {
  const ledger = persistenceOf(kernel);
  return kernel.installed().filter((id) => !ledger.has(id));
}

/**
 * Own a part of the save for as long as the feature is installed.  Without
 * a save service (headless tests) it only records the declaration.
 */
export function ownSave(ctx: FeatureContext, codec: SaveCodec): void {
  declare(ctx, { kind: "saved", key: codec.key });
  const saves = ctx.kernel.services.tryGet(SavesKey);
  if (saves) ctx.scope.add(saves.register(codec));
}

/**
 * State the feature keeps on purpose but doesn't save (`what`, e.g. "a raid
 * in progress").  `reset` runs after every load, once all saved state is
 * back; leave it out when the feature's own systems re-derive the state.
 */
export function ownTransient(ctx: FeatureContext, what: string, reset?: () => void): void {
  declare(ctx, { kind: "transient", what });
  if (reset) ctx.on("save:loaded", reset);
}

/** The feature keeps nothing across a load (`why`, e.g. "its state is the time system's"). */
export function declareStateless(ctx: FeatureContext, why: string): void {
  declare(ctx, { kind: "stateless", why });
}

/** Services one feature provides and another uses (keys here, so features never import each other). */
export const IndoorsKey = createServiceKey<IndoorsService>("indoors");
export const JobsKey = createServiceKey<JobsService>("jobs");
export const RoutinesKey = createServiceKey<RoutinesService>("routines");
export const TravelKey = createServiceKey<TravelService>("travel");

/** What the title screen needs from the game. */
export interface TitleHostService {
  /** The save "Continue" would load, in brief; null when there is none. */
  savedGame(): { name: string; level: number; savedAt: number } | null;
  /** Pause play and take input while the title is up (false gives them back). */
  hold(on: boolean): void;
  /** Load the save and play; false when it could not be loaded. */
  continueGame(): boolean;
  /** Start a new game (the character creator). */
  newGame(): void;
  settings(): void;
  credits(): void;
  /** Leave the game (desktop builds); null in the browser. */
  quit: (() => void) | null;
  /** Skip the title (replays start straight at the character creator). */
  skip(): boolean;
}
export const TitleHostKey = createServiceKey<TitleHostService>("title-host");
