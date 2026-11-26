/**
 * World sites as a kernel feature: what appears where as chunks stream in.
 *
 * Per chunk, in order: ponds stay empty; a village takes the whole chunk;
 * otherwise wild nature is scattered and the biome's sites roll
 * (homesteads, forest inns, bandit camps, the tundra dragon, and the
 * remote-only obelisks, haunted houses, graveyards, snow fields and skulls).
 * Every roll uses a fixed per-chunk hash, so a chunk always gets the same
 * content (and existing worlds keep theirs).
 *
 * The sites themselves are data (`content/sites.ts`), built by the site
 * builder (`world/site-specs.ts`) through the site-builder service.  The
 * landmarks a chunk built go to the landmarks feature.
 *
 * Extracted from game.ts (engine overhaul, Phase 1).
 */
import type { Feature, FeatureContext } from "../../core/kernel";
import { createServiceKey } from "../../core/kernel";
import type { BiomeType } from "../../world/world-manager";
import { buildWildChunk } from "../../world/site-specs";
import { WILD_SCATTER, WILD_SITES } from "../../content/sites";
import { ActorsKey, LandmarksKey, SiteBuilderKey, VillagesKey, WorldInfoKey, declareStateless } from "../services";

export interface WorldSitesService {
  /** Fill a freshly loaded chunk. */
  populate(chunkKey: string, cx: number, cz: number, biome: BiomeType): void;
}

export const WorldSitesKey = createServiceKey<WorldSitesService>("world-sites");

/** Deterministic 0..1 per chunk and slot (re-exported: it now lives with the site builder). */
export { chunkRand } from "../../world/site-specs";

export class WorldSitesFeature implements Feature {
  public readonly id = "world-sites";

  public install(ctx: FeatureContext): void {
    declareStateless(ctx, "what goes where comes from the world seed");
    const s = ctx.kernel.services;
    ctx.provide(WorldSitesKey, {
      populate: (chunkKey, cx, cz, biome) => {
        const world = s.get(WorldInfoKey);
        // Pond chunks are quiet clearings — no props dropped into the water.
        if (world.pondAt(cx, cz)) return;
        // A village takes the whole chunk: no other sites or wild scatter.
        if (s.get(VillagesKey).populate(chunkKey, cx, cz)) return;
        const site = s.get(SiteBuilderKey);
        const spawn = (archetype: string, x: number, z: number) => s.get(ActorsKey).spawnArchetype(chunkKey, archetype, x, z);
        const landmarks = buildWildChunk({ site, spawn, chunkKey, cx, cz, biome, size: world.chunkSize }, WILD_SCATTER, WILD_SITES);
        if (landmarks.length > 0) s.tryGet(LandmarksKey)?.placed(chunkKey, landmarks);
      },
    });
  }
}
