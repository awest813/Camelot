/**
 * The world seed and the random streams in the save.
 *
 * A save used to keep neither, so loading it rebuilt the world from
 * whatever seed the session had (a new character's, or none) and the
 * random streams carried on from the session.  Now the save keeps both.
 * Loaded before any chunk exists (Continue on the title screen), the
 * saved world comes back exactly.  Loaded mid-game into a world of a
 * different seed, the chunks already built can't change: the seed applies
 * to what streams in next, and the player is told to Continue from the
 * title for a clean load.
 *
 * Inputs:   services world-info, feedback.
 * Outputs:  the "world" part of the save.
 */
import type { Feature, FeatureContext } from "../../core/kernel";
import { WorldSeed, type WorldGenOptions } from "../../world/world-seed";
import { FeedbackKey, WorldInfoKey, ownSave } from "../services";

export interface WorldSaveState {
  seed: { seed: string; numeric: boolean; options: WorldGenOptions } | null;
  rng?: { seed: string; streams: Record<string, number> };
}

export function seedToSave(seed: WorldSeed | null): WorldSaveState["seed"] {
  return seed ? { seed: seed.seedString, numeric: String(seed.seedValue) === seed.seedString, options: { ...seed.options } } : null;
}

export function seedFromSave(s: WorldSaveState["seed"]): WorldSeed | null {
  if (!s) return null;
  return new WorldSeed(s.numeric ? Number(s.seed) : s.seed, s.options);
}

const sameSeed = (a: WorldSeed | null, b: WorldSeed | null): boolean =>
  JSON.stringify(seedToSave(a)) === JSON.stringify(seedToSave(b));

export class WorldSeedFeature implements Feature {
  public readonly id = "world-seed";

  public install(ctx: FeatureContext): void {
    const s = ctx.kernel.services;
    const rng = ctx.kernel.rng;
    ownSave(ctx, {
      key: "world",
      save: (): WorldSaveState => ({ seed: seedToSave(s.get(WorldInfoKey).seed()), rng: rng.getSaveState() }),
      load: (data) => {
        const saved = data as WorldSaveState | undefined;
        if (!saved) return; // an older save: nothing to restore
        const world = s.get(WorldInfoKey);
        const seed = seedFromSave(saved.seed);
        if (!sameSeed(seed, world.seed())) {
          const clean = world.loadedChunks() === 0;
          world.setSeed(seed);
          if (!clean) s.get(FeedbackKey).notify("This save is from another world. Quit to the menu and Continue to load it cleanly.", 6000);
        }
        if (saved.rng) rng.restoreFromSave(saved.rng);
      },
    });
  }
}
