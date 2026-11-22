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
 * Placement goes through the site-builder service; the dressing layouts for
 * homesteads, inns and bandit camps live here as data.  Becomes the data-
 * driven site builder in Phase 6.
 *
 * Extracted from game.ts (engine overhaul, Phase 1).
 */
import type { Feature, FeatureContext } from "../../core/kernel";
import { createServiceKey } from "../../core/kernel";
import type { FantasyAssetKey } from "../../systems/fantasy-asset-loader";
import type { BiomeType } from "../../world/world-manager";
import { toWorld } from "../../world/village-buildings";
import { ActorsKey, SiteBuilderKey, VillagesKey, WorldInfoKey, type SiteBuilderService } from "../services";

export interface WorldSitesService {
  /** Fill a freshly loaded chunk. */
  populate(chunkKey: string, cx: number, cz: number, biome: BiomeType): void;
}

export const WorldSitesKey = createServiceKey<WorldSitesService>("world-sites");

/** Deterministic 0..1 per chunk and slot (kept bit-for-bit: worlds depend on it). */
export function chunkRand(cx: number, cz: number, slot: number): number {
  return Math.abs(Math.sin(cx * 311.7 + cz * 127.1 + slot * 59.3)) % 1;
}

type Origin = { x: number; z: number; rot: number };

/** Wild nature per biome: [asset, chance] (slots 40+, 50+, 60+, 70+ by index). */
const NATURE: Partial<Record<BiomeType, Array<[FantasyAssetKey, number]>>> = {
  forest: [["qWillowTree", 0.35], ["qDeadTree", 0.25], ["qMushroom", 0.5], ["qRockMedium", 0.3], ["qFern", 0.6]],
  plains: [["qDeadTree", 0.3], ["qRockLarge", 0.25], ["qBushLarge", 0.35], ["qGrassClump", 0.6]],
  tundra: [["qDeadTree", 0.55], ["qRockLarge", 0.45], ["qPineTree", 0.4]],
  desert: [["qDeadTree", 0.35], ["qRockLarge", 0.5], ["qRockSmall", 0.5]],
};
const TREES = new Set<FantasyAssetKey>(["qDeadTree", "qWillowTree", "qPineTree"]);

const COTTAGE_TRAINERS = [
  "archetype_trainer_blade",
  "archetype_trainer_alchemy",
  "archetype_trainer_destruction",
  "archetype_trainer_armorer",
];
const INN_SPECIALISTS = [
  "archetype_shopkeeper_general",
  "archetype_shopkeeper_weapons",
  "archetype_shopkeeper_armor",
  "archetype_shopkeeper_alchemist",
  "archetype_merchant",
];

export class WorldSitesFeature implements Feature {
  public readonly id = "world-sites";

  public install(ctx: FeatureContext): void {
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
        populateWild(site, spawn, world.chunkSize, chunkKey, cx, cz, biome);
      },
    });
  }
}

/** Everything a non-village chunk gets. */
function populateWild(
  site: SiteBuilderService,
  spawn: (archetype: string, x: number, z: number) => unknown,
  size: number,
  chunkKey: string,
  cx: number,
  cz: number,
  biome: BiomeType,
): void {
  const r = (slot: number) => chunkRand(cx, cz, slot);
  const wx = cx * size, wz = cz * size;
  /** A point in the chunk: centre ± spread/2 of the chunk size. */
  const spot = (sx: number, sz: number, spread: number) => ({
    x: wx + (r(sx) - 0.5) * size * spread,
    z: wz + (r(sz) - 0.5) * size * spread,
  });
  const forest = biome === "forest", plains = biome === "plains";
  const tundra = biome === "tundra", desert = biome === "desert";

  // Wild nature.
  const pool = NATURE[biome];
  pool?.forEach(([key, chance], i) => {
    if (r(40 + i) >= chance) return;
    const p = spot(50 + i, 60 + i, 0.8);
    site.placeAsset(chunkKey, key, { ...p, yaw: r(70 + i) * Math.PI * 2, tier: TREES.has(key) ? "structure" : "prop" });
  });

  // Obelisks in desert / plains (remote asset).
  if ((desert || plains) && r(0) < 0.125) {
    site.placeAsset(chunkKey, "obelisk", { ...spot(1, 2, 0.7), yaw: r(4) * Math.PI * 2, scale: 0.8 + r(3) * 0.6, tier: "structure" });
  }

  // Homestead in plains: a cottage, a villager and a visiting trainer.
  if (plains && r(5) < 0.083) {
    const c = spot(6, 7, 0.5);
    site.placeBuilding(chunkKey, "cottage", { x: c.x, z: c.z - 5, rot: 0 });
    spawn("archetype_villager", c.x + 2, c.z + 2);
    const trainer = COTTAGE_TRAINERS[((cx + cz) % 4 + 4) % 4];
    spawn(trainer, c.x - 2, c.z + 1);
    dressHomestead(site, chunkKey, { ...c, rot: 0 }, trainer === "archetype_trainer_alchemy");
    // The smith works out of a forge and anvil beside the homestead.
    if (trainer === "archetype_trainer_armorer") site.placeSmithy(chunkKey, c.x - 4.5, c.z + 2.5, 0);
    if (r(91) < 0.3) spawn("archetype_guard", c.x + 3, c.z - 2);
  }

  // The tundra dragon (very rare).
  if (tundra && r(9) < 0.05) {
    const d = spot(10, 11, 0.6);
    site.spawnDragon(chunkKey, d.x, d.z, r(12) * Math.PI * 2);
  }

  // Inn in the forest: proprietor, barkeep, a rotating specialist, sometimes a guard.
  if (forest && r(13) < 0.067) {
    const c = spot(14, 15, 0.5);
    // Set back so its door faces the yard where the staff and dressing stand.
    site.placeBuilding(chunkKey, "inn", { x: c.x, z: c.z - 8, rot: 0 });
    dressInn(site, chunkKey, { ...c, rot: 0 }, ((cx + cz) % 5 + 5) % 5 === 4);
    spawn("archetype_innkeeper", c.x + 2.5, c.z + 2.5);
    spawn("archetype_barkeeper", c.x - 2.5, c.z + 2);
    const special = INN_SPECIALISTS[((cx + cz) % 5 + 5) % 5];
    spawn(special, c.x + 4, c.z - 3);
    // Arms and armor sellers keep a working forge out back.
    if (special === "archetype_shopkeeper_weapons" || special === "archetype_shopkeeper_armor") {
      site.placeSmithy(chunkKey, c.x + 6.5, c.z - 5, 0);
    }
    if (r(90) < 0.4) spawn("archetype_guard", c.x - 4, c.z - 3);
  }

  // Haunted house in tundra (remote asset).
  if (tundra && r(17) < 0.1) {
    site.placeAsset(chunkKey, "hauntedHouse", { ...spot(18, 19, 0.55), yaw: r(20) * Math.PI * 2, scale: 1.2, tier: "structure" });
  }

  // Graveyard in plains / forest (remote asset).
  if ((plains || forest) && r(21) < 0.1) {
    site.placeAsset(chunkKey, "graveYardScene", { ...spot(22, 23, 0.6), yaw: r(24) * Math.PI * 2, scale: 1.0, tier: "scene" });
  }

  // Bandit camp in the desert: palisade, banners, stolen goods, and its garrison.
  if (desert && r(40) < 0.048) {
    const f = spot(41, 42, 0.62);
    dressBanditCamp(site, chunkKey, { ...f, rot: r(43) * Math.PI * 2 });
    spawn("archetype_bandit", f.x + 3, f.z + 2);
    spawn("archetype_bandit", f.x - 3, f.z - 2);
    spawn("archetype_bandit_archer", f.x, f.z + 5);
    spawn("archetype_bandit_chief", f.x, f.z);
  }

  // Tundra snow-field patch (remote asset).
  if (tundra && r(45) < 0.085) {
    site.placeAsset(chunkKey, "snowField", { ...spot(46, 47, 0.75), yaw: r(48) * Math.PI * 2, scale: 0.85 + r(49) * 0.35, tier: "structure" });
  }

  // Skulls in desert / tundra (remote asset).
  if ((desert || tundra) && r(71) < 0.065) {
    site.placeAsset(chunkKey, "skull", { ...spot(72, 73, 0.9), yaw: r(74) * Math.PI * 2, scale: 0.55 + r(75) * 0.5 });
  }
}

/** Place a prop relative to a site origin (local x/z, yaw added to the origin's). */
function propAt(site: SiteBuilderService, chunkKey: string, origin: Origin, key: FantasyAssetKey, dx: number, dz: number, rot = 0): void {
  const w = toWorld({ x: dx, z: dz }, origin);
  site.placeProp(chunkKey, key, w.x, w.z, origin.rot + rot);
}

function dressHomestead(site: SiteBuilderService, chunkKey: string, o: Origin, alchemist: boolean): void {
  const P = (key: FantasyAssetKey, dx: number, dz: number, rot = 0) => propAt(site, chunkKey, o, key, dx, dz, rot);
  P("qBarrel", 3.4, 0.8);
  P("qCrate", 3.6, -0.6, 0.4);
  P("qBench", -0.5, 3.6, 0.1);
  P("qFlag", -3.5, -2.5, 0.5);
  if (alchemist) P("qCauldron", -2.6, 2.4);
}

function dressInn(site: SiteBuilderService, chunkKey: string, o: Origin, merchant: boolean): void {
  const P = (key: FantasyAssetKey, dx: number, dz: number, rot = 0) => propAt(site, chunkKey, o, key, dx, dz, rot);
  P("qBarrel", 5.5, 1.2);
  P("qBarrel", 6.2, 2.1, 0.7);
  P("qCrate", 5.8, -0.4, 0.3);
  P("qBench", 0, 5.5);
  P("qTable", 0, 6.8);
  P("qBannerStand", -3.2, 4.8, Math.PI);
  P("qLantern", 2.4, 4.6);
  P("qLantern", -2.4, 4.6);
  if (merchant) P("qMarketStall", 5.2, -4.5, -Math.PI / 2);
}

function dressBanditCamp(site: SiteBuilderService, chunkKey: string, o: Origin): void {
  const P = (key: FantasyAssetKey, dx: number, dz: number, rot = 0) => propAt(site, chunkKey, o, key, dx, dz, rot);
  // Palisade ring (radius 8.5) with a gap for the entrance at +Z.
  const radius = 8.5;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.4) continue; // entrance
    P("vFence", Math.sin(a) * radius, Math.cos(a) * radius, a);
  }
  P("qBannerStand", 2.6, radius - 0.6);
  P("qBannerStand", -2.6, radius - 0.6);
  P("vWagon", -5.2, -1.5, 0.35);
  P("qCrate", 4.2, -3.2, 0.3);
  P("qCrate", 5.0, -2.2, 1.1);
  P("qBarrel", -3.6, -4.6);
  P("qBarrel", -2.8, -5.3, 0.8);
  P("qChest", 0, -2.6, Math.PI);
  P("qSignPost", 3.6, 1.4, -Math.PI / 2); // weapon rack
  P("qLantern", -1.6, 2.2);
}
