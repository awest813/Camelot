import { describe, it, expect } from "vitest";
import { buildWildChunk, landmarkName, type PlacedLandmark, type SiteContext } from "./site-specs";
import { WILD_SCATTER, WILD_SITES } from "../content/sites";
import { legacyPopulateWild } from "./__fixtures__/legacy-wild-sites";
import type { SiteBuilderService } from "../features/services";
import type { BiomeType } from "./world-manager";

/** A site builder that writes down every call, in order. */
function recorder() {
  const calls: unknown[][] = [];
  const log = (name: string) => (...args: unknown[]) => { calls.push([name, ...args]); };
  const site = {
    placeBuilding: log("building"), placeProp: log("prop"), placeAsset: log("asset"),
    placeSmithy: log("smithy"), spawnDragon: log("dragon"),
  } as unknown as SiteBuilderService;
  return { site, calls, spawn: log("npc") };
}

const BIOMES: BiomeType[] = ["forest", "plains", "tundra", "desert"];

describe("data-driven wild sites", () => {
  it("place exactly what the hand-written code did, call for call, across thousands of chunks", () => {
    let sites = 0;
    for (const biome of BIOMES) {
      for (let cx = -40; cx < 40; cx++) for (let cz = -20; cz < 20; cz++) {
        const before = recorder(), after = recorder();
        legacyPopulateWild(before.site, before.spawn, 50, `${cx},${cz}`, cx, cz, biome);
        const c: SiteContext = { site: after.site, spawn: after.spawn, chunkKey: `${cx},${cz}`, cx, cz, biome, size: 50 };
        buildWildChunk(c, WILD_SCATTER, WILD_SITES);
        expect(after.calls, `${biome} ${cx},${cz}`).toEqual(before.calls);
        sites += before.calls.filter((call) => call[0] !== "asset").length;
      }
    }
    expect(sites, "the sample includes buildings, NPCs and forges").toBeGreaterThan(200);
  });

  it("every site type turns up somewhere in the sample", () => {
    const seen = new Set<string>();
    for (const biome of BIOMES) for (let cx = -60; cx < 60; cx++) for (let cz = -30; cz < 30; cz++) {
      const t = recorder();
      buildWildChunk({ site: t.site, spawn: t.spawn, chunkKey: "k", cx, cz, biome, size: 50 }, { ...WILD_SCATTER, pool: {} }, WILD_SITES);
      for (const call of t.calls) seen.add(call[0] === "asset" ? `asset:${String(call[2])}` : call[0] === "npc" ? `npc:${String(call[1])}` : String(call[0]));
    }
    for (const want of ["building", "smithy", "dragon", "asset:obelisk", "asset:hauntedHouse", "asset:graveYardScene", "asset:snowField", "asset:skull", "npc:archetype_bandit_chief", "npc:archetype_merchant"]) {
      expect(seen.has(want), want).toBe(true);
    }
  });

  it("report the landmarks they built, with fixed names, near the site", () => {
    const all: PlacedLandmark[] = [];
    for (const biome of BIOMES) {
      const ids = new Set<string>();
      for (let cx = -40; cx < 40; cx++) for (let cz = -20; cz < 20; cz++) {
        const t = recorder();
        for (const l of buildWildChunk({ site: t.site, spawn: t.spawn, chunkKey: "k", cx, cz, biome, size: 50 }, { ...WILD_SCATTER, pool: {} }, WILD_SITES)) {
          expect(ids.has(l.id), `${biome}: ${l.id} is unique`).toBe(false);
          ids.add(l.id);
          all.push(l);
        }
      }
    }
    const kinds = new Set(all.map((l) => l.kind));
    expect([...kinds].sort()).toEqual(["Bandit Camp", "Graveyard", "Homestead", "Inn", "Manor", "Obelisk", "Roost"]);
    for (const l of all) {
      expect(l.name.endsWith(` ${l.kind}`)).toBe(true);
      expect(Math.hypot(l.arrive.x - l.x, l.arrive.z - l.z), `${l.id} arrives near`).toBeLessThan(l.radius);
    }
    expect(landmarkName(3, 4, "Graveyard"), "the same chunk names the same").toBe(landmarkName(3, 4, "Graveyard"));
    expect(new Set(all.map((l) => l.name.split(" ")[0])).size, "names vary").toBeGreaterThan(40);
  });
});
