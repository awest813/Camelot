/**
 * The procedural structures a chunk can hold, as data for
 * `StructureManager`: ruins (plains and forest), a desert shrine and a
 * tundra watchtower.  Each is built from boxes and the shared fantasy props
 * (torches, campfires, barrels, banners, standing stones, chests), with a
 * guard NPC or a relic.  Parts are built in order, and the order is part of
 * the look (materials and merging follow it).
 *
 * Offsets are metres from the structure's origin.  Numbers can be rolled:
 * `{ base, slot, range }` is base + roll × range, `{ jitter, spread }` is
 * (roll − ½) × spread, with the roll fixed per chunk and slot.  `{c}` in a
 * name is the chunk ("cx_cz").
 *
 * Engine overhaul, Phase 6 (data-driven site builder).
 */
import type { BiomeType } from "../world/world-manager";

export type Rolled = number | { base: number; slot: number; range: number } | { jitter: number; spread: number };
type Rgb = readonly [number, number, number];

export interface StructureMaterial {
  diffuse: Rgb;
  specular: Rgb;
  power: number;
  emissive?: Rgb;
  disableLighting?: boolean;
}

export type StructurePart =
  /** A box; `y` defaults to half its height (standing on the ground). */
  | { box: string; mat: string | { name: string } & StructureMaterial; w: Rolled; h: Rolled; d: Rolled;
      dx: Rolled; dz: Rolled; y?: number; rotY?: Rolled; collider?: boolean; shadow?: boolean }
  | { chest: string; dx: number; dz: number; slot: number }
  | { torch: string; dx: number; y: number; dz: number }
  | { campfire: string; dx: number; dz: number }
  | { barrel: string; dx: number; dz: number }
  | { banner: string; dx: number; dz: number; color: Rgb; mat: string }
  | { stone: string; dx: number; dz: number; height: Rolled }
  /** A one-off item on display (taken once, then gone for good). */
  | { relic: string; dx: number; y: number; dz: number;
      item: { name: string; description: string; slot: "offHand"; stats: Record<string, number> } }
  | { npc: string; dx: number; dz: number; aggroRange: number; attackDamage: number; xpReward: number;
      patrol: ReadonlyArray<readonly [number, number]> };

export interface StructureSpec {
  id: string;
  biomes: readonly BiomeType[];
  /** Shared materials made up front, in this order. */
  materials: Readonly<Record<string, StructureMaterial>>;
  parts: readonly StructurePart[];
}

const wall = (i: number, dx: number, dz: number, w: number, h: number, d: number): StructurePart =>
  ({ box: `ruins_wall_{c}_${i}`, mat: "ruins_stone", w, h, d, dx, dz, collider: true, shadow: true });
const rubble = (i: number): StructurePart => ({
  box: `ruins_rubble_{c}_${i}`, mat: "ruins_stone",
  w: { base: 0.5, slot: i + 10, range: 0.7 }, h: { base: 0.3, slot: i + 11, range: 0.4 }, d: { base: 0.5, slot: i + 12, range: 0.7 },
  dx: { jitter: i + 20, spread: 5 }, dz: { jitter: i + 21, spread: 5 }, rotY: { base: 0, slot: i + 22, range: Math.PI },
});

const RUINS: StructureSpec = {
  id: "ruins",
  biomes: ["plains", "forest"],
  // Aged limestone: warm earthy grey with subtle specular for weathered stone.
  materials: { ruins_stone: { diffuse: [0.50, 0.44, 0.36], specular: [0.14, 0.12, 0.09], power: 28 } },
  parts: [
    // Four partial walls at varying heights for a crumbled look.
    wall(0, 0, 4, 7.0, 3.0, 0.8), // north: tallest
    wall(1, 0, -4, 4.0, 2.0, 0.8), // south: shorter, crumbled
    wall(2, -4, 0, 0.8, 3.0, 6.0), // west
    wall(3, 4, 0, 0.8, 2.2, 4.0), // east: partial
    // Scattered rubble inside.
    rubble(0), rubble(1), rubble(2), rubble(3),
    { chest: "ruins_chest_{c}", dx: 0, dz: 0, slot: 0 },
    // Torches on the north wall flanking the entrance; a campfire; supplies.
    { torch: "ruins_torch_L_{c}", dx: -2.5, y: 2.4, dz: 3.5 },
    { torch: "ruins_torch_R_{c}", dx: 2.5, y: 2.4, dz: 3.5 },
    { campfire: "ruins_campfire_{c}", dx: 0, dz: -1 },
    { barrel: "ruins_barrel_A_{c}", dx: -3.0, dz: 1.5 },
    { barrel: "ruins_barrel_B_{c}", dx: -3.3, dz: 2.2 },
    // Dark red: a bandit camp.
    { banner: "ruins_banner_{c}", dx: 3.5, dz: 0, color: [0.55, 0.06, 0.04], mat: "bandits" },
    // Standing stones flanking the ruined entrance.
    { stone: "ruins_monolith_L_{c}", dx: -5.5, dz: -2, height: 2.2 },
    { stone: "ruins_monolith_R_{c}", dx: 5.5, dz: -2, height: 1.8 },
    { npc: "RuinGuard", dx: 2, dz: 2, aggroRange: 12, attackDamage: 7, xpReward: 30, patrol: [[2, 2], [-2, -2]] },
  ],
};

/** The shrine's four outer menhirs, on a ring of 5.5 m starting at 45°. */
const menhirs = [0, 1, 2, 3].map((i): StructurePart => {
  const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
  return { stone: `shrine_menhir_{c}_${i}`, dx: Math.cos(angle) * 5.5, dz: Math.sin(angle) * 5.5, height: { base: 1.8, slot: i + 40, range: 1.2 } };
});
const shrinePillar = (i: number, dx: number, dz: number): StructurePart => ({
  box: `shrine_pillar_{c}_${i}`, mat: "shrine_stone", w: 0.6, h: { base: 3, slot: i + 5, range: 2 }, d: 0.6, dx, dz, collider: true, shadow: true,
});

const DESERT_SHRINE: StructureSpec = {
  id: "desert-shrine",
  biomes: ["desert"],
  materials: {
    // Sun-bleached sandstone; golden altar stone with a warm glow.
    shrine_stone: { diffuse: [0.80, 0.64, 0.34], specular: [0.24, 0.18, 0.07], power: 36 },
    shrine_altar: { diffuse: [0.90, 0.74, 0.26], specular: [0.38, 0.28, 0.08], power: 52 },
  },
  parts: [
    { box: "shrine_platform_{c}", mat: "shrine_stone", w: 5, h: 0.4, d: 5, dx: 0, dz: 0, y: 0.2, collider: true, shadow: true },
    { box: "shrine_altarBlock_{c}", mat: "shrine_altar", w: 1.5, h: 0.8, d: 0.9, dx: 0, dz: 0, y: 0.8, shadow: true },
    shrinePillar(0, -2.5, -2.5), shrinePillar(1, 2.5, -2.5), shrinePillar(2, -2.5, 2.5), shrinePillar(3, 2.5, 2.5),
    { relic: "shrine_relic_{c}", dx: 0, y: 1.6, dz: 0, item: {
      name: "Ancient Relic", description: "A weathered relic found on a desert altar. +3 Damage.", slot: "offHand", stats: { damage: 3 },
    } },
    { torch: "shrine_torch_A_{c}", dx: -1.0, y: 0.4, dz: -1.2 },
    { torch: "shrine_torch_B_{c}", dx: 1.0, y: 0.4, dz: -1.2 },
    ...menhirs,
    // A glowing rune slab in the platform: the altar's mystical light.
    { box: "shrine_rune_{c}", w: 1.2, h: 0.04, d: 0.7, dx: 0, dz: 0, y: 0.42, mat: {
      name: "shrine_rune", diffuse: [0.1, 0.5, 0.9], specular: [0, 0, 0], power: 1, emissive: [0.0, 0.28, 0.70], disableLighting: true,
    } },
  ],
};

const TW = 4, TH = 8, WT = 0.6; // tower width, wall height, wall thickness
const LINTEL_H = TH - 2.5;
const towerWall = (name: string, w: number, h: number, d: number, dx: number, dz: number, y = h / 2): StructurePart =>
  ({ box: name, mat: "tower_stone", w, h, d, dx, dz, y, collider: true, shadow: true });

const WATCHTOWER: StructureSpec = {
  id: "watchtower",
  biomes: ["tundra"],
  materials: {
    // Cold granite (blue-grey); weathered dark timber.
    tower_stone: { diffuse: [0.50, 0.48, 0.50], specular: [0.18, 0.18, 0.22], power: 42 },
    tower_wood: { diffuse: [0.36, 0.24, 0.12], specular: [0.08, 0.05, 0.02], power: 14 },
  },
  parts: [
    towerWall("tower_N_{c}", TW, TH, WT, 0, TW / 2),
    // South wall: two pillars flanking a 1.6 m doorway, and the lintel above it.
    towerWall("tower_Spillar-1_{c}", 1.0, TH, WT, -1.5, -TW / 2),
    towerWall("tower_Spillar1_{c}", 1.0, TH, WT, 1.5, -TW / 2),
    towerWall("tower_lintel_{c}", 1.8, LINTEL_H, WT, 0, -TW / 2, TH - LINTEL_H / 2),
    towerWall("tower_E_{c}", WT, TH, TW, TW / 2, 0),
    towerWall("tower_W_{c}", WT, TH, TW, -TW / 2, 0),
    { box: "tower_roof_{c}", mat: "tower_wood", w: TW - WT, h: 0.2, d: TW - WT, dx: 0, dz: 0, y: TH + 0.1, collider: true, shadow: true },
    { chest: "tower_chest_{c}", dx: 1, dz: 1, slot: 60 },
    { torch: "tower_torch_L_{c}", dx: -1.2, y: 2.8, dz: -TW / 2 - 0.1 },
    { torch: "tower_torch_R_{c}", dx: 1.2, y: 2.8, dz: -TW / 2 - 0.1 },
    { barrel: "tower_barrel_A_{c}", dx: TW / 2 - 0.5, dz: -0.5 },
    { barrel: "tower_barrel_B_{c}", dx: TW / 2 - 0.5, dz: 0.4 },
    // Imperial blue: a guard post.
    { banner: "tower_banner_{c}", dx: -TW / 2 - 0.2, dz: 0, color: [0.10, 0.20, 0.65], mat: "imperial" },
    { campfire: "tower_campfire_{c}", dx: 3.5, dz: -TW / 2 - 3 },
    { npc: "TowerGuard", dx: 0, dz: -TW / 2 - 2, aggroRange: 15, attackDamage: 8, xpReward: 40, patrol: [[0, -TW / 2 - 2], [3, -TW / 2 - 2]] },
  ],
};

export const STRUCTURES: readonly StructureSpec[] = [RUINS, DESERT_SHRINE, WATCHTOWER];
