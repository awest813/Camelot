import { describe, it, expect } from "vitest";
import { Kernel } from "../../core/kernel";
import type { FantasyAssetKey } from "../../systems/fantasy-asset-loader";
import type { BiomeType } from "../../world/world-manager";
import { ActorsKey, SiteBuilderKey, VillagesKey, WorldInfoKey } from "../services";
import { WorldSitesFeature, WorldSitesKey, chunkRand } from "./world-sites-feature";

type Placed = { kind: string; key?: string; x: number; z: number };

function setup(opts: { pond?: boolean; village?: boolean; biome?: BiomeType } = {}) {
  const k = new Kernel();
  const placed: Placed[] = [];
  const spawned: string[] = [];
  const biome = opts.biome ?? "plains";
  k.services.provide(WorldInfoKey, { chunkSize: 50, biome: () => biome, pondAt: () => !!opts.pond });
  k.services.provide(VillagesKey, {
    populate: () => !!opts.village,
    planFor: () => null, clearingAt: () => null, loaded: () => new Map(), loadedVillage: () => null,
    currentVillage: () => null, innBoardOf: () => null,
  });
  k.services.provide(ActorsKey, {
    residents: () => [], despawn: () => undefined, isTalkingTo: () => false, byName: () => undefined, all: () => [], hostiles: () => [],
    spawnArchetype: (_c, a) => { spawned.push(a); return null; },
  });
  k.services.provide(SiteBuilderKey, {
    scene: null as never,
    isLive: () => true,
    placeBuilding: (_c, kind, o) => { placed.push({ kind: `building:${kind}`, x: o.x, z: o.z }); },
    placeProp: (_c, key, x, z) => { placed.push({ kind: "prop", key, x, z }); },
    placeAsset: (_c, key, at) => { placed.push({ kind: "asset", key, x: at.x, z: at.z }); },
    placeSmithy: (_c, x, z) => { placed.push({ kind: "smithy", x, z }); },
    spawnDragon: (_c, x, z) => { placed.push({ kind: "dragon", x, z }); },
    ownStructure: () => undefined, own: () => undefined,
    addKeepOut: () => () => undefined, nightFlame: () => null,
  });
  k.install(new WorldSitesFeature());
  return { k, placed, spawned, sites: k.services.get(WorldSitesKey) };
}

/** First chunk (scanning out from the origin) where `pred(cx, cz)` holds. */
function findChunk(pred: (cx: number, cz: number) => boolean): [number, number] {
  for (let r = 1; r < 80; r++) for (let cx = -r; cx <= r; cx++) for (const cz of [-r, r]) if (pred(cx, cz)) return [cx, cz];
  throw new Error("none");
}

describe("WorldSitesFeature (headless, through the kernel)", () => {
  it("keeps the per-chunk hash bit-for-bit (existing worlds depend on it)", () => {
    expect(chunkRand(3, 4, 40).toFixed(12)).toBe("0.999362029517");
    expect(chunkRand(-7, 2, 13).toFixed(12)).toBe("0.639542867667");
    expect(chunkRand(10, -5, 9).toFixed(12)).toBe("0.666084929599");
  });

  it("leaves ponds empty and lets a village take the whole chunk", () => {
    const pond = setup({ pond: true });
    pond.sites.populate("1,1", 1, 1, "plains");
    expect(pond.placed).toEqual([]);
    const village = setup({ village: true });
    village.sites.populate("1,1", 1, 1, "plains");
    expect(village.placed).toEqual([]);
  });

  it("garrisons a desert bandit camp behind a palisade with an open gate", () => {
    const [cx, cz] = findChunk((x, z) => chunkRand(x, z, 40) < 0.048);
    const t = setup({ biome: "desert" });
    t.sites.populate(`${cx},${cz}`, cx, cz, "desert");
    expect(t.placed.filter((p) => p.key === "vFence")).toHaveLength(21);   // 24 posts minus three at the gate
    expect(t.placed.some((p) => p.key === "qChest")).toBe(true);
    expect(t.spawned).toEqual(["archetype_bandit", "archetype_bandit", "archetype_bandit_archer", "archetype_bandit_chief"]);
  });

  it("settles a forest inn: proprietor, barkeep, a specialist", () => {
    const [cx, cz] = findChunk((x, z) => chunkRand(x, z, 13) < 0.067);
    const t = setup({ biome: "forest" });
    t.sites.populate(`${cx},${cz}`, cx, cz, "forest");
    expect(t.placed.some((p) => p.kind === "building:inn")).toBe(true);
    expect(t.spawned.slice(0, 2)).toEqual(["archetype_innkeeper", "archetype_barkeeper"]);
    expect(t.spawned.length).toBeGreaterThanOrEqual(3);
  });

  it("is deterministic and never places the dropped demo models", () => {
    const run = () => {
      const all: Placed[] = [];
      for (const biome of ["plains", "forest", "desert", "tundra"] as BiomeType[]) {
        const t = setup({ biome });
        for (let i = 0; i < 60; i++) t.sites.populate(`${i},${i * 3}`, i, i * 3, biome);
        all.push(...t.placed);
      }
      return all;
    };
    const a = run();
    expect(run()).toEqual(a);
    const dropped: string[] = ["d20Animated", "sheenChair", "alien", "underwaterScene", "octopusCustomRig", "babylonBuoy", "pumpkinCarved", "rabbit"];
    expect(a.filter((p) => dropped.includes(p.key as FantasyAssetKey))).toEqual([]);
    expect(a.some((p) => p.kind === "dragon"), "the tundra dragon still appears somewhere").toBe(true);
  });
});
