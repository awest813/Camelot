/**
 * Landmarks as a kernel feature: the wild places worth finding (obelisks,
 * graveyards, manors, inns, homesteads, bandit camps, dragon roosts).
 * Walking near one discovers it: it goes on the map and the fast-travel
 * list, and finding it is worth a little experience.  A bandit camp or a
 * dragon roost can also be cleared: when everyone the site spawned has
 * fallen, it is cleared, once per world, for a larger reward.
 *
 * What counts as a landmark, its name and its reward are site data
 * (`content/sites.ts`, `world/site-specs.ts`); world-sites reports the ones
 * each chunk built.  What has been found is kept by fast travel's save; the
 * ones cleared are this feature's save part ("landmarks").  A cleared camp
 * still fills again when its chunk next loads: the reward does not.
 *
 * Inputs:   services fast-travel, player, feedback; events chunk:unloaded,
 *           npc:killed.
 * Outputs:  the `landmarks` service; events location:discovered,
 *           landmark:cleared.
 */
import type { Feature, FeatureContext } from "../../core/kernel";
import type { PlacedLandmark } from "../../world/site-specs";
import { FastTravelKey, FeedbackKey, LandmarksKey, PlayerKey, ownSave } from "../services";

/** Seconds between looks for landmarks in reach. */
const LOOK_EVERY = 0.5;

export class LandmarksFeature implements Feature {
  public readonly id = "landmarks";
  /** Landmarks standing in loaded chunks, by chunk key. */
  private readonly _loaded = new Map<string, readonly PlacedLandmark[]>();
  /** Foes still standing, by landmark id (clearable landmarks in loaded chunks). */
  private readonly _standing = new Map<string, Set<unknown>>();
  /** Landmarks cleared in this world (saved). */
  private readonly _cleared = new Set<string>();

  public isCleared(id: string): boolean {
    return this._cleared.has(id);
  }

  /** The landmarks in loaded chunks (for tests and the map). */
  public loaded(): PlacedLandmark[] {
    return [...this._loaded.values()].flat();
  }

  public install(ctx: FeatureContext): void {
    const s = ctx.kernel.services;
    ownSave(ctx, {
      key: "landmarks",
      save: () => ({ cleared: [...this._cleared].sort() }),
      load: (data) => {
        this._cleared.clear();
        const cleared = (data as { cleared?: unknown } | undefined)?.cleared;
        if (Array.isArray(cleared)) for (const id of cleared) if (typeof id === "string") this._cleared.add(id);
      },
    });
    ctx.provide(LandmarksKey, {
      placed: (chunkKey, landmarks) => {
        this._loaded.set(chunkKey, landmarks);
        for (const lm of landmarks) if (lm.clear) this._standing.set(lm.id, new Set(lm.clear.foes));
      },
    });
    ctx.on("chunk:unloaded", ({ chunkKey }) => {
      for (const lm of this._loaded.get(chunkKey) ?? []) this._standing.delete(lm.id);
      this._loaded.delete(chunkKey);
    });
    ctx.on("npc:killed", ({ npc }) => {
      for (const [id, foes] of this._standing) {
        if (!foes.delete(npc) || foes.size > 0) continue;
        this._standing.delete(id);
        if (this._cleared.has(id)) return;
        const lm = this.loaded().find((l) => l.id === id);
        if (!lm?.clear) return;
        this._cleared.add(id);
        const fb = s.get(FeedbackKey);
        fb.grant({ xp: lm.clear.xp, gold: lm.clear.gold, label: `Cleared: ${lm.name}` });
        ctx.kernel.events.emit("landmark:cleared", { id, name: lm.name });
        fb.markDirty();
        return;
      }
    });

    let wait = 0;
    ctx.system({
      id: "landmarks.discover",
      phase: "sim",
      update: (dt) => {
        wait -= dt;
        if (wait > 0 || this._loaded.size === 0) return;
        wait = LOOK_EVERY;
        const p = s.get(PlayerKey).position();
        const travel = s.get(FastTravelKey);
        for (const list of this._loaded.values()) {
          for (const lm of list) {
            const dx = p.x - lm.x, dz = p.z - lm.z;
            if (dx * dx + dz * dz > lm.radius * lm.radius || travel.isDiscovered(lm.id)) continue;
            travel.discover(lm.id, lm.name, { x: lm.arrive.x, y: 2, z: lm.arrive.z });
            const fb = s.get(FeedbackKey);
            fb.grant({ xp: lm.xp, label: `Discovered: ${lm.name}` });
            ctx.kernel.events.emit("location:discovered", { id: lm.id, name: lm.name });
            fb.markDirty();
          }
        }
      },
    });
    ctx.scope.add(() => { this._loaded.clear(); this._standing.clear(); });
  }
}
