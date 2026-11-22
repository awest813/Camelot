/**
 * village-settlement — plan named villages: several Medieval Village
 * buildings around a square, with residents, a smithy, market and well.
 *
 * Pure and deterministic (no Babylon): the same chunk always yields the same
 * village, so it reappears identically when the chunk streams back in.  The
 * game turns a {@link VillagePlan} into buildings (village-buildings.ts),
 * props, NPCs and a fast-travel landmark.
 *
 * Layout (village-local, then placed at {@link VillagePlan.center}):
 *  • a square of radius {@link PLAZA_RADIUS} with a well at its centre,
 *    market stalls, benches and lanterns;
 *  • {@link RING_SLOTS} slots around it — one is the entrance road (gate
 *    guards and banners), the rest hold the inn, a smithy, a shop and homes;
 *  • every building sits with its front on the square's edge and its door
 *    facing the centre.
 */
import type { BiomeType } from "./world-manager";
import { ArthurianNameGenerator } from "./arthurian-names";
import { buildingFootprint, toWorld, type BuildingKind } from "./village-buildings";
import type { FantasyAssetKey } from "../systems/fantasy-asset-loader";

export const PLAZA_RADIUS = 9;
export const RING_SLOTS = 7;
/** Chance a qualifying chunk hosts a village. */
export const VILLAGE_CHANCE = 0.06;
/** Villages keep clear of the starting area (Chebyshev distance in chunks). */
export const VILLAGE_MIN_CHUNK_DISTANCE = 3;
/** Radius kept free of trees, rocks and ruins around the village centre. */
export const VILLAGE_CLEAR_RADIUS = 20;
/** Walking this close to the centre discovers the village. */
export const VILLAGE_DISCOVER_RADIUS = 18;

export type VillageRole = "inn" | "smithy" | "shop" | "home";

export interface VillageBuilding {
  kind: BuildingKind;
  role: VillageRole;
  /** World position of the building centre and its yaw (door along local +Z). */
  x: number;
  z: number;
  rot: number;
}

export interface VillagePlan {
  id: string;
  name: string;
  center: { x: number; z: number };
  clearRadius: number;
  buildings: VillageBuilding[];
  props: Array<{ key: FantasyAssetKey; x: number; z: number; rot: number }>;
  residents: Array<{ archetype: string; x: number; z: number }>;
  /** Outdoor forge beside the smithy (a crafting station). */
  forge: { x: number; z: number };
}

/** Deterministic 0..1 stream for a chunk (Mulberry32). */
function chunkRng(cx: number, cz: number, salt: number): () => number {
  let s = (Math.imul(cx | 0, 73856093) ^ Math.imul(cz | 0, 19349663) ^ Math.imul(salt, 83492791)) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Whether chunk (cx, cz) of the given biome hosts a village. */
export function hasVillage(cx: number, cz: number, biome: BiomeType): boolean {
  if (biome !== "plains" && biome !== "forest") return false;
  if (Math.max(Math.abs(cx), Math.abs(cz)) < VILLAGE_MIN_CHUNK_DISTANCE) return false;
  return chunkRng(cx, cz, 1)() < VILLAGE_CHANCE;
}

/** Lay out the village for chunk (cx, cz).  Call only when {@link hasVillage}. */
export function planVillage(cx: number, cz: number, chunkSize: number): VillagePlan {
  const rng = chunkRng(cx, cz, 2);
  const jitter = chunkSize * 0.06;
  const center = {
    x: cx * chunkSize + (rng() * 2 - 1) * jitter,
    z: cz * chunkSize + (rng() * 2 - 1) * jitter,
  };
  const name = ArthurianNameGenerator.generateSettlementName(`village:${cx},${cz}`, "town");

  // Ring roles: slot 0 is the entrance road; the inn is always across from it.
  const others: VillageRole[] = ["smithy", "shop", "home", "home", "home"];
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  const roles: Array<VillageRole | "entrance"> = ["entrance"];
  const innSlot = Math.floor(RING_SLOTS / 2);
  for (let s = 1, k = 0; s < RING_SLOTS; s++) roles.push(s === innSlot ? "inn" : others[k++]);

  const start = rng() * Math.PI * 2;
  const slotAngle = (s: number) => start + (s / RING_SLOTS) * Math.PI * 2;
  /** World point at angle a, distance r from the centre. */
  const polar = (a: number, r: number) => ({ x: center.x + Math.sin(a) * r, z: center.z + Math.cos(a) * r });

  const buildings: VillageBuilding[] = [];
  const props: VillagePlan["props"] = [];
  const residents: VillagePlan["residents"] = [];
  let forge = { x: center.x, z: center.z };

  roles.forEach((role, s) => {
    const a = slotAngle(s);
    if (role === "entrance") {
      // Gate: guards and banners where the road meets the square.
      const gate = PLAZA_RADIUS + 3;
      const side = { x: Math.cos(a), z: -Math.sin(a) }; // tangent
      const g = polar(a, gate);
      residents.push({ archetype: "archetype_guard", x: g.x + side.x * 2.5, z: g.z + side.z * 2.5 });
      residents.push({ archetype: "archetype_guard", x: g.x - side.x * 2.5, z: g.z - side.z * 2.5 });
      props.push({ key: "qBannerStand", x: g.x + side.x * 4, z: g.z + side.z * 4, rot: a + Math.PI });
      props.push({ key: "qBannerStand", x: g.x - side.x * 4, z: g.z - side.z * 4, rot: a + Math.PI });
      return;
    }
    const kind: BuildingKind = role === "inn" ? "inn" : role === "home" && rng() < 0.5 ? "house" : "cottage";
    const { width, depth } = buildingFootprint(kind);
    const r = PLAZA_RADIUS + depth / 2;
    const p = polar(a, r);
    const rot = a + Math.PI; // door (+Z) faces the centre
    buildings.push({ kind, role, x: p.x, z: p.z, rot });

    const origin = { x: p.x, z: p.z, rot };
    const front = (dx: number, dz = 1.6) => toWorld({ x: dx, z: depth / 2 + dz }, origin);
    switch (role) {
      case "inn": {
        const a1 = front(1.6), a2 = front(-1.6);
        residents.push({ archetype: "archetype_innkeeper", ...a1 });
        residents.push({ archetype: "archetype_barkeeper", ...a2 });
        const b = front(-2.8, 0.8);
        props.push({ key: "qBarrel", ...b, rot: 0 });
        break;
      }
      case "smithy": {
        forge = toWorld({ x: width / 2 + 1.6, z: depth / 2 - 1 }, origin);
        residents.push({ archetype: "archetype_trainer_armorer", ...front(1.2) });
        const c = toWorld({ x: width / 2 + 1.4, z: depth / 2 + 1.2 }, origin);
        props.push({ key: "qCrate", ...c, rot: rot });
        break;
      }
      case "shop": {
        residents.push({ archetype: "archetype_shopkeeper_general", ...front(0) });
        const stall = front(0, 3.2);
        props.push({ key: "qMarketStall", ...stall, rot });
        break;
      }
      case "home": {
        residents.push({ archetype: "archetype_villager", ...front(1.4) });
        const bar = front(-1.9, 0.6);
        props.push({ key: rng() < 0.5 ? "qBarrel" : "qCrate", ...bar, rot: rng() * Math.PI });
        break;
      }
    }
  });

  // The square: well, benches, lanterns and a second stall.
  props.push({ key: "qWell", x: center.x, z: center.z, rot: start });
  for (let k = 0; k < 3; k++) {
    const a = start + Math.PI / RING_SLOTS + (k * 2 * Math.PI) / 3;
    const b = polar(a, 4.2);
    props.push({ key: "qBench", ...b, rot: a + Math.PI / 2 });
    const l = polar(a + 0.5, 5.5);
    props.push({ key: "qLantern", ...l, rot: 0 });
  }
  const traveling = polar(start + Math.PI * 0.8, 5.8);
  props.push({ key: "qMarketStall", ...traveling, rot: start + Math.PI * 0.8 + Math.PI });
  residents.push({ archetype: "archetype_merchant", ...polar(start + Math.PI * 0.8, 4.4) });
  // A couple more villagers milling about the square.
  residents.push({ archetype: "archetype_villager", ...polar(start + 2.2, 3) });
  residents.push({ archetype: "archetype_villager", ...polar(start + 4.1, 3.5) });

  return {
    id: `village_${cx}_${cz}`,
    name,
    center,
    clearRadius: VILLAGE_CLEAR_RADIUS,
    buildings,
    props,
    residents,
    forge,
  };
}
