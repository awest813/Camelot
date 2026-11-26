/**
 * Landmarks as a kernel feature: the wild places worth finding (obelisks,
 * graveyards, manors, inns, homesteads, bandit camps, dragon roosts).
 * Walking near one discovers it: it goes on the map and the fast-travel
 * list, and finding it is worth a little experience.
 *
 * What counts as a landmark, its name and its reward are site data
 * (`content/sites.ts`, `world/site-specs.ts`); world-sites reports the ones
 * each chunk built.  What has been found is kept by fast travel's save.
 *
 * Inputs:   services fast-travel, player, feedback; event chunk:unloaded.
 * Outputs:  the `landmarks` service; event location:discovered.
 */
import type { Feature, FeatureContext } from "../../core/kernel";
import type { PlacedLandmark } from "../../world/site-specs";
import { FastTravelKey, FeedbackKey, LandmarksKey, PlayerKey, declareStateless } from "../services";

/** Seconds between looks for landmarks in reach. */
const LOOK_EVERY = 0.5;

export class LandmarksFeature implements Feature {
  public readonly id = "landmarks";
  /** Landmarks standing in loaded chunks, by chunk key. */
  private readonly _loaded = new Map<string, readonly PlacedLandmark[]>();

  /** The landmarks in loaded chunks (for tests and the map). */
  public loaded(): PlacedLandmark[] {
    return [...this._loaded.values()].flat();
  }

  public install(ctx: FeatureContext): void {
    declareStateless(ctx, "landmarks come from the world seed; fast travel keeps the ones found");
    const s = ctx.kernel.services;
    ctx.provide(LandmarksKey, {
      placed: (chunkKey, landmarks) => { this._loaded.set(chunkKey, landmarks); },
    });
    ctx.on("chunk:unloaded", ({ chunkKey }) => { this._loaded.delete(chunkKey); });

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
    ctx.scope.add(() => this._loaded.clear());
  }
}
