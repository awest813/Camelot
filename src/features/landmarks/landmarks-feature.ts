/**
 * Landmarks as a kernel feature: the wild places worth finding (obelisks,
 * graveyards, manors, inns, homesteads, bandit camps, dragon roosts).
 * Walking near one discovers it: it goes on the map and the fast-travel
 * list, and finding it is worth a little experience.  A bandit camp or a
 * dragon roost can also be cleared: when everyone the site spawned has
 * fallen, it is cleared, for a larger reward the first time.  A cleared
 * site stays empty for three game days (its chunk loads without them),
 * then fills again and can be cleared again.
 *
 * What counts as a landmark, its name and its reward are site data
 * (`content/sites.ts`, `world/site-specs.ts`); world-sites reports the ones
 * each chunk built.  What has been found is kept by fast travel's save; when
 * each site was last cleared is this feature's save part ("landmarks").
 *
 * The feature can also find landmarks in chunks not loaded (the nearest
 * camp still standing, for a job) by building a chunk's sites dry.
 *
 * Inputs:   services fast-travel, player, feedback, world-info, villages, clock;
 *           events chunk:unloaded, npc:killed.
 * Outputs:  the `landmarks` service; events location:discovered,
 *           landmark:cleared.
 */
import type { Feature, FeatureContext } from "../../core/kernel";
import { buildWildChunk, type PlacedLandmark } from "../../world/site-specs";
import { WILD_SCATTER, WILD_SITES } from "../../content/sites";
import type { SiteBuilderService } from "../services";
import { ClockKey, FastTravelKey, FeedbackKey, LandmarksKey, PlayerKey, VillagesKey, WorldInfoKey, ownSave } from "../services";

/** A site builder that builds nothing: what a chunk's landmarks would be, without loading it. */
const DRY_RUN = new Proxy({}, { get: () => () => null }) as SiteBuilderService;

/** Game hours a cleared site stays empty before it fills again. */
export const QUIET_HOURS = 72;

/** Seconds between looks for landmarks in reach. */
const LOOK_EVERY = 0.5;

export class LandmarksFeature implements Feature {
  public readonly id = "landmarks";
  /** Landmarks standing in loaded chunks, by chunk key. */
  private readonly _loaded = new Map<string, readonly PlacedLandmark[]>();
  /** Foes still standing, by landmark id (clearable landmarks in loaded chunks). */
  private readonly _standing = new Map<string, Set<unknown>>();
  /** When each landmark was last cleared, in elapsed game hours (saved). */
  private readonly _cleared = new Map<string, number>();
  private _now: () => number = () => 0;

  /** Cleared and still empty (it fills again QUIET_HOURS after its clearing). */
  public isCleared(id: string): boolean {
    const at = this._cleared.get(id);
    return at !== undefined && this._now() - at < QUIET_HOURS;
  }

  /** The landmarks in loaded chunks (for tests and the map). */
  public loaded(): PlacedLandmark[] {
    return [...this._loaded.values()].flat();
  }

  public install(ctx: FeatureContext): void {
    const s = ctx.kernel.services;
    this._now = () => s.tryGet(ClockKey)?.elapsedHours() ?? 0;
    ownSave(ctx, {
      key: "landmarks",
      save: () => ({ cleared: Object.fromEntries([...this._cleared].sort(([a], [b]) => (a < b ? -1 : 1))) }),
      load: (data) => {
        this._cleared.clear();
        const cleared = (data as { cleared?: unknown } | undefined)?.cleared;
        // (A list of ids: the first saves, before sites filled again; long quiet by now.)
        if (Array.isArray(cleared)) for (const id of cleared) { if (typeof id === "string") this._cleared.set(id, -QUIET_HOURS); }
        else if (cleared && typeof cleared === "object") {
          for (const [id, at] of Object.entries(cleared)) if (typeof at === "number") this._cleared.set(id, at);
        }
      },
    });
    /** The landmarks chunk (cx, cz) has, loaded or not (as world-sites would build them). */
    const landmarksOf = (cx: number, cz: number): PlacedLandmark[] => {
      const world = s.get(WorldInfoKey);
      if (world.pondAt(cx, cz) || s.tryGet(VillagesKey)?.planFor(cx, cz)) return [];
      return buildWildChunk(
        { site: DRY_RUN, spawn: () => null, chunkKey: "", cx, cz, biome: world.biome(cx, cz), size: world.chunkSize },
        { ...WILD_SCATTER, pool: {} }, WILD_SITES,
      );
    };
    const discover = (lm: PlacedLandmark): boolean => s.get(FastTravelKey).discover(lm.id, lm.name, { x: lm.arrive.x, y: 2, z: lm.arrive.z });
    ctx.provide(LandmarksKey, {
      placed: (chunkKey, landmarks) => {
        this._loaded.set(chunkKey, landmarks);
        for (const lm of landmarks) if (lm.clear) this._standing.set(lm.id, new Set(lm.clear.foes));
      },
      nearest: (kind, x, z, chunks) => {
        const size = s.get(WorldInfoKey).chunkSize;
        const ox = Math.round(x / size), oz = Math.round(z / size);
        let best: PlacedLandmark | null = null, bestD = Infinity;
        for (let cx = ox - chunks; cx <= ox + chunks; cx++) {
          for (let cz = oz - chunks; cz <= oz + chunks; cz++) {
            for (const lm of landmarksOf(cx, cz)) {
              if (lm.kind !== kind || this.isCleared(lm.id)) continue;
              const d = (lm.x - x) ** 2 + (lm.z - z) ** 2;
              if (d < bestD) { bestD = d; best = lm; }
            }
          }
        }
        return best && { id: best.id, name: best.name, x: best.x, z: best.z };
      },
      isCleared: (id) => this.isCleared(id),
      quiet: (id) => this.isCleared(id),
      mark: (id) => {
        const m = /_(-?\d+)_(-?\d+)$/.exec(id);
        const lm = m ? landmarksOf(Number(m[1]), Number(m[2])).find((l) => l.id === id) : undefined;
        return lm ? discover(lm) : false;
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
        const lm = this.loaded().find((l) => l.id === id);
        if (!lm?.clear) return;
        const first = !this._cleared.has(id);
        this._cleared.set(id, this._now());
        const fb = s.get(FeedbackKey);
        if (first) fb.grant({ xp: lm.clear.xp, gold: lm.clear.gold, label: `Cleared: ${lm.name}` });
        else fb.notify(`Cleared: ${lm.name}`, 2600);
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
            discover(lm);
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
