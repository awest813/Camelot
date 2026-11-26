import { describe, expect, it, vi } from "vitest";
import { Kernel } from "../../core/kernel";
import { FeedbackKey, SavesKey, WorldInfoKey } from "../services";
import type { SaveCodec } from "../../systems/save-system";
import { WorldSeed } from "../../world/world-seed";
import { WorldSeedFeature, seedFromSave, seedToSave, type WorldSaveState } from "./world-seed-feature";

function setup(seed: WorldSeed | null, chunks = 0) {
  const k = new Kernel({ seed: "session" });
  const world = { seed, chunks };
  const notes: string[] = [];
  const codecs = new Map<string, SaveCodec>();
  k.services.provide(SavesKey, { register: (c) => { codecs.set(c.key, c); return () => codecs.delete(c.key); } });
  k.services.provide(FeedbackKey, { notify: (t) => { notes.push(t); }, grant: vi.fn(), addFame: vi.fn(), markDirty: vi.fn() });
  k.services.provide(WorldInfoKey, {
    chunkSize: 50, biome: () => "plains", pondAt: () => false,
    seed: () => world.seed, setSeed: (s) => { world.seed = s; }, loadedChunks: () => world.chunks,
  });
  k.install(new WorldSeedFeature());
  return { k, world, notes, codec: codecs.get("world")! };
}

describe("WorldSeedFeature", () => {
  it("seeds round-trip, numeric and string, with their options", () => {
    for (const s of [new WorldSeed(12345, { biomeScale: "large" }), new WorldSeed("my world", { worldType: "island" })]) {
      const back = seedFromSave(JSON.parse(JSON.stringify(seedToSave(s))))!;
      expect([back.seedString, back.seedValue, back.options]).toEqual([s.seedString, s.seedValue, s.options]);
    }
    expect(seedFromSave(seedToSave(null))).toBeNull();
  });

  it("a save made in one world loads that world before any chunk exists, with its random streams", () => {
    const a = setup(new WorldSeed("old kingdom"));
    a.k.rng.stream("combat").next();
    const saved = JSON.parse(JSON.stringify(a.codec.save())) as WorldSaveState;
    const expectedNext = a.k.rng.stream("combat").next();

    const b = setup(null, 0); // a fresh session at the title screen
    b.codec.load(saved);
    expect(b.world.seed?.seedString).toBe("old kingdom");
    expect(b.k.rng.stream("combat").next(), "the streams carry on where the save left them").toBe(expectedNext);
    expect(b.notes).toEqual([]);
  });

  it("loaded mid-game into another world, it says so; an older save without the part changes nothing", () => {
    const a = setup(new WorldSeed("old kingdom"));
    const saved = a.codec.save();
    const b = setup(new WorldSeed("new kingdom"), 9);
    b.codec.load(saved);
    expect(b.notes[0]).toMatch(/another world/);
    const c = setup(new WorldSeed("kept"), 9);
    c.codec.load(undefined);
    expect(c.world.seed?.seedString).toBe("kept");
  });
});
