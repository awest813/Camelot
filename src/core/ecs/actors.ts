/**
 * The actor store: an entity id for every NPC (and later the player), with
 * their state flags as bitECS tag components, so systems can ask "every
 * dead actor" or "every aggressive one" as queries instead of walking
 * objects and reading booleans.
 *
 * Systems never touch bitECS directly: they use this store (spawn,
 * despawn, has / set, query) and the component tags below.  Babylon
 * objects stay in a side table (`body`).
 *
 * Engine overhaul, Phase 3.  bitECS 0.4 (MPL-2.0, used unmodified).
 */
import { addComponent, addEntity, createWorld, hasComponent, query, removeComponent, removeEntity } from "bitecs";

/**
 * An actor's id in the store.  Ids are never reused, so a stale id names
 * nothing.  (bitECS 0.4.0's own id versioning is broken: recycled ids
 * stop "existing" once its index arrays shuffle.  So the store issues its
 * own ids and maps them to bitECS's recycled slots.)
 */
export type ActorId = number;

/* Tag components: an actor has the tag or it doesn't. */
export const Dead = {};
export const InDialogue = {};
export const Aggressive = {};
/** Will attack on sight (most hostiles); peaceful NPCs need provoking. */
export const HostileOnSight = {};
export const Provoked = {};
/** Winding up a strike the player can read and dodge. */
export const Telegraphing = {};
export const Staggered = {};
/** The next strike can't be blocked. */
export const Unblockable = {};
/** Took damage this frame (the hit-react animation plays). */
export const HitReact = {};
export const Guard = {};

/*
 * LOD tiers, by distance from the player.  An actor has at most one; an
 * actor with none (not yet tiered, e.g. in a test) counts as near.
 *   near: everything runs every tick.
 *   mid:  animated, but its schedule (walking about town) runs at a lower rate.
 *   far:  its animation is paused and its schedule runs at a lower rate.
 */
export const LodMid = {};
export const LodFar = {};
export type LodTier = "near" | "mid" | "far";

export type ActorTag = typeof Dead;

export class ActorStore<Body = unknown> {
  private readonly _world = createWorld();
  private readonly _bodies = new Map<ActorId, Body>();
  private readonly _eids = new Map<ActorId, number>();
  /** bitECS slot → actor id, for queries. */
  private readonly _ids = new Map<number, ActorId>();
  private _next = 1;

  /** A new actor for `body`. */
  public spawn(body: Body): ActorId {
    const id = this._next++;
    const eid = addEntity(this._world);
    this._bodies.set(id, body);
    this._eids.set(id, eid);
    this._ids.set(eid, id);
    return id;
  }

  /** Remove an actor (its components go with it). */
  public despawn(id: ActorId): void {
    const eid = this._eids.get(id);
    if (eid === undefined) return;
    removeEntity(this._world, eid);
    this._eids.delete(id);
    this._ids.delete(eid);
    this._bodies.delete(id);
  }

  public exists(id: ActorId): boolean {
    return this._eids.has(id);
  }

  /** The object behind an actor (an NPC). */
  public body(id: ActorId): Body | undefined {
    return this._bodies.get(id);
  }

  public has(id: ActorId, tag: ActorTag): boolean {
    const eid = this._eids.get(id);
    return eid !== undefined && hasComponent(this._world, eid, tag);
  }

  public set(id: ActorId, tag: ActorTag, on: boolean): void {
    const eid = this._eids.get(id);
    if (eid === undefined) return;
    if (on) addComponent(this._world, eid, tag);
    else removeComponent(this._world, eid, tag);
  }

  /** Put an actor in a LOD tier (it leaves its old one). */
  public setTier(id: ActorId, tier: LodTier): void {
    this.set(id, LodMid, tier === "mid");
    this.set(id, LodFar, tier === "far");
  }

  public tier(id: ActorId): LodTier {
    return this.has(id, LodFar) ? "far" : this.has(id, LodMid) ? "mid" : "near";
  }

  /** Every actor with all of `tags`. */
  public query(...tags: ActorTag[]): ActorId[] {
    const out: ActorId[] = [];
    for (const eid of query(this._world, tags)) {
      const id = this._ids.get(eid);
      if (id !== undefined) out.push(id);
    }
    return out;
  }

  /** How many actors there are. */
  public get size(): number {
    return this._bodies.size;
  }
}
