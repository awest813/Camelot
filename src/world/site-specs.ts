/**
 * Sites as data: what a site is made of (buildings, props, NPCs, a forge,
 * a remote asset, a dragon) and where its parts go, read by one builder.
 * The world-sites feature hands it a chunk; the content lives in
 * `content/sites.ts`.  Villages have their own planner (`planVillage`),
 * whose plan is data of the same kind.
 *
 * Every roll is `chunkRand(cx, cz, slot)` with the slot the spec names, so a
 * chunk always gets the same content.  Slot numbers are part of the world:
 * changing one moves things in existing worlds.
 *
 * Engine overhaul, Phase 6 (data-driven site builder).
 */
import type { FantasyAssetKey } from "../systems/fantasy-asset-loader";
import type { BiomeType } from "./world-manager";
import { toWorld, type BuildingKind } from "./village-buildings";
import type { SiteBuilderService } from "../features/services";

/** Deterministic 0..1 per chunk and slot (kept bit-for-bit: worlds depend on it). */
export function chunkRand(cx: number, cz: number, slot: number): number {
  return Math.abs(Math.sin(cx * 311.7 + cz * 127.1 + slot * 59.3)) % 1;
}

/** Only place the part when: the site's variant is one of these, and/or a roll passes. */
export interface PartCondition {
  variant?: number[];
  roll?: { slot: number; chance: number };
}

/** Offsets are metres from the site's origin; `rot` adds to the site's rotation. */
export type SitePart = { when?: PartCondition } & (
  | { building: BuildingKind; dx: number; dz: number; rot?: number }
  | { prop: FantasyAssetKey; dx: number; dz: number; rot?: number }
  /** A ring of one prop around the origin, facing out, with a gap at +Z. */
  | { ring: FantasyAssetKey; radius: number; count: number; gap: number }
  /**
   * An NPC.  `archetype` is one id, or one per variant.  NPC offsets are
   * along the world axes (they don't turn with the site).
   */
  | { npc: string | string[]; dx: number; dz: number }
  | { smithy: true; dx: number; dz: number }
  /** A single asset at the origin, turned by a roll and optionally scaled by one. */
  | { asset: FantasyAssetKey; yaw: number; scale?: number | { base: number; slot: number; range: number }; tier?: "structure" | "scene" | "prop" }
  | { dragon: true; yaw: number }
);

export interface SiteSpec {
  id: string;
  biomes: readonly BiomeType[];
  /** The site appears when `chunkRand(slot) < chance`. */
  roll: { slot: number; chance: number };
  /** Where: the chunk centre ± spread/2 of the chunk size, per axis roll. */
  at: { x: number; z: number; spread: number };
  /** The site's rotation: none, or a roll × 2π. */
  rot?: { slot: number };
  /** How many variants; the chunk picks one by `(cx + cz) mod n`. */
  variants?: number;
  parts: readonly SitePart[];
  /**
   * A place worth finding: walking within `radius` metres discovers it (on
   * the map and for fast travel) for `xp`.  `kind` names it ("Graveyard");
   * fast travel arrives at `arrive` (offsets that turn with the site).
   */
  landmark?: {
    kind: string; xp: number; radius: number; arrive: { dx: number; dz: number };
    /** Killing everyone the site spawned clears it, once, for this. */
    clear?: { xp: number; gold: number };
  };
}

/** A landmark a chunk built, in world coordinates. */
export interface PlacedLandmark {
  id: string;
  name: string;
  kind: string;
  xp: number;
  radius: number;
  x: number;
  z: number;
  arrive: { x: number; z: number };
  /** For a site that can be cleared: the reward, and who must fall (as spawned). */
  clear?: { xp: number; gold: number; foes: readonly unknown[] };
}

const NAME_HEADS = [
  "Ash", "Crow", "Elder", "Gallow", "Hollow", "Mire", "Thorn", "Wolf", "Raven", "Stone", "Briar", "Cold", "Hart", "Wych", "Grey", "Marrow",
  "Bram", "Cinder", "Dun", "Fern", "Gorse", "Holm", "Kettle", "Lark", "Moss", "Nettle", "Oak", "Rook", "Sedge", "Tarn", "Wold", "Yew",
] as const;
const NAME_TAILS = [
  "ford", "mere", "barrow", "fell", "wick", "combe", "hithe", "stead",
  "ley", "wood", "dale", "holt", "moor", "brook", "thorpe", "worth",
] as const;

/** A landmark's name: a place name from the chunk and kind (fixed per world), then the kind. */
export function landmarkName(cx: number, cz: number, kind: string): string {
  // An integer hash: the two halves vary independently (chunkRand's slots don't).
  // The kind takes part, so two landmarks in one chunk get different names.
  let h = Math.imul(cx | 0, 0x9e3779b1) ^ Math.imul(cz | 0, 0x85ebca77);
  for (let i = 0; i < kind.length; i++) h = Math.imul(h ^ kind.charCodeAt(i), 0x01000193);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  h = (h ^ (h >>> 15)) >>> 0;
  return `${NAME_HEADS[h % NAME_HEADS.length]}${NAME_TAILS[(h >>> 12) % NAME_TAILS.length]} ${kind}`;
}

/** Scattered wild props per biome: [asset, chance]; the slots follow the list index. */
export interface WildScatter {
  pool: Partial<Record<BiomeType, ReadonlyArray<readonly [FantasyAssetKey, number]>>>;
  /** Assets culled at the structure distance (trees); the rest are props. */
  tall: ReadonlySet<FantasyAssetKey>;
  /** Slot bases for: the chance roll, x, z, yaw (index added). */
  slots: { chance: number; x: number; z: number; yaw: number };
  spread: number;
}

export interface SiteContext {
  site: SiteBuilderService;
  spawn(archetype: string, x: number, z: number): unknown;
  chunkKey: string;
  cx: number;
  cz: number;
  biome: BiomeType;
  /** Chunk size (m). */
  size: number;
}

const wrap = (v: number, n: number) => ((v % n) + n) % n;

/** Scatter wild props, then build each spec that rolls in, in order; the landmarks built. */
export function buildWildChunk(c: SiteContext, scatter: WildScatter, specs: readonly SiteSpec[]): PlacedLandmark[] {
  const landmarks: PlacedLandmark[] = [];
  const r = (slot: number) => chunkRand(c.cx, c.cz, slot);
  const wx = c.cx * c.size, wz = c.cz * c.size;
  const spot = (sx: number, sz: number, spread: number) => ({
    x: wx + (r(sx) - 0.5) * c.size * spread,
    z: wz + (r(sz) - 0.5) * c.size * spread,
  });

  scatter.pool[c.biome]?.forEach(([key, chance], i) => {
    if (r(scatter.slots.chance + i) >= chance) return;
    const p = spot(scatter.slots.x + i, scatter.slots.z + i, scatter.spread);
    c.site.placeAsset(c.chunkKey, key, { ...p, yaw: r(scatter.slots.yaw + i) * Math.PI * 2, tier: scatter.tall.has(key) ? "structure" : "prop" });
  });

  for (const spec of specs) {
    if (!spec.biomes.includes(c.biome) || r(spec.roll.slot) >= spec.roll.chance) continue;
    const p = spot(spec.at.x, spec.at.z, spec.at.spread);
    const origin = { ...p, rot: spec.rot ? r(spec.rot.slot) * Math.PI * 2 : 0 };
    const variant = spec.variants ? wrap(c.cx + c.cz, spec.variants) : 0;
    const spawned: unknown[] = [];
    for (const part of spec.parts) {
      if (part.when?.variant && !part.when.variant.includes(variant)) continue;
      if (part.when?.roll && r(part.when.roll.slot) >= part.when.roll.chance) continue;
      const actor = buildPart(c, part, origin, variant, r);
      if (actor) spawned.push(actor);
    }
    const lm = spec.landmark;
    if (lm) {
      const arrive = toWorld({ x: lm.arrive.dx, z: lm.arrive.dz }, origin);
      landmarks.push({
        id: `site_${spec.id}_${c.cx}_${c.cz}`, name: landmarkName(c.cx, c.cz, lm.kind), kind: lm.kind,
        xp: lm.xp, radius: lm.radius, x: origin.x, z: origin.z, arrive: { x: arrive.x, z: arrive.z },
        ...(lm.clear && spawned.length > 0 ? { clear: { ...lm.clear, foes: spawned } } : {}),
      });
    }
  }
  return landmarks;
}

function buildPart(
  c: SiteContext, part: SitePart, o: { x: number; z: number; rot: number }, variant: number, r: (slot: number) => number,
): unknown {
  const { site, chunkKey } = c;
  if ("building" in part) {
    const w = toWorld({ x: part.dx, z: part.dz }, o);
    site.placeBuilding(chunkKey, part.building, { x: w.x, z: w.z, rot: o.rot + (part.rot ?? 0) });
  } else if ("prop" in part) {
    const w = toWorld({ x: part.dx, z: part.dz }, o);
    site.placeProp(chunkKey, part.prop, w.x, w.z, o.rot + (part.rot ?? 0));
  } else if ("ring" in part) {
    for (let i = 0; i < part.count; i++) {
      const a = (i / part.count) * Math.PI * 2;
      if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < part.gap) continue;
      const w = toWorld({ x: Math.sin(a) * part.radius, z: Math.cos(a) * part.radius }, o);
      site.placeProp(chunkKey, part.ring, w.x, w.z, o.rot + a);
    }
  } else if ("npc" in part) {
    const archetype = typeof part.npc === "string" ? part.npc : part.npc[variant];
    return c.spawn(archetype, o.x + part.dx, o.z + part.dz);
  } else if ("smithy" in part) {
    const w = toWorld({ x: part.dx, z: part.dz }, o);
    site.placeSmithy(chunkKey, w.x, w.z, o.rot);
  } else if ("asset" in part) {
    const scale = typeof part.scale === "object" ? part.scale.base + r(part.scale.slot) * part.scale.range : part.scale;
    site.placeAsset(chunkKey, part.asset, {
      x: o.x, z: o.z, yaw: r(part.yaw) * Math.PI * 2,
      ...(scale !== undefined ? { scale } : {}),
      ...(part.tier ? { tier: part.tier } : {}),
    });
  } else {
    return site.spawnDragon(chunkKey, o.x, o.z, r(part.yaw) * Math.PI * 2);
  }
  return null;
}
