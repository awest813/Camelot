/**
 * The wild sites a non-village chunk can hold, as data for the site builder
 * (`world/site-specs.ts`): homesteads, forest inns, bandit camps, the tundra
 * dragon, and the remote-only obelisks, haunted houses, graveyards, snow
 * fields and skulls, plus the scattered wild nature.
 *
 * Slot numbers are part of the world (every roll is a fixed per-chunk
 * hash of its slot): changing one moves things in existing worlds.  The
 * site builder's test checks these specs place exactly what the
 * hand-written code they replace did.
 *
 * Engine overhaul, Phase 6.
 */
import type { SiteSpec, WildScatter } from "../world/site-specs";

export const WILD_SCATTER: WildScatter = {
  pool: {
    forest: [["qWillowTree", 0.35], ["qDeadTree", 0.25], ["qMushroom", 0.5], ["qRockMedium", 0.3], ["qFern", 0.6]],
    plains: [["qDeadTree", 0.3], ["qRockLarge", 0.25], ["qBushLarge", 0.35], ["qGrassClump", 0.6]],
    tundra: [["qDeadTree", 0.55], ["qRockLarge", 0.45], ["qPineTree", 0.4]],
    desert: [["qDeadTree", 0.35], ["qRockLarge", 0.5], ["qRockSmall", 0.5]],
  },
  tall: new Set(["qDeadTree", "qWillowTree", "qPineTree"]),
  slots: { chance: 40, x: 50, z: 60, yaw: 70 },
  spread: 0.8,
};

/** Who visits a homestead, by variant. */
const COTTAGE_TRAINERS = [
  "archetype_trainer_blade",
  "archetype_trainer_alchemy",
  "archetype_trainer_destruction",
  "archetype_trainer_armorer",
];
/** The inn's rotating specialist, by variant. */
const INN_SPECIALISTS = [
  "archetype_shopkeeper_general",
  "archetype_shopkeeper_weapons",
  "archetype_shopkeeper_armor",
  "archetype_shopkeeper_alchemist",
  "archetype_merchant",
];
const CAMP_RADIUS = 8.5;

/** In the order they roll (the order is part of the world too). */
export const WILD_SITES: readonly SiteSpec[] = [
  {
    id: "obelisk", biomes: ["desert", "plains"], roll: { slot: 0, chance: 0.125 }, at: { x: 1, z: 2, spread: 0.7 },
    landmark: { kind: "Obelisk", xp: 10, radius: 14, arrive: { dx: 0, dz: 5 } },
    parts: [{ asset: "obelisk", yaw: 4, scale: { base: 0.8, slot: 3, range: 0.6 }, tier: "structure" }],
  },
  {
    // A cottage, a villager and a visiting trainer (the armorer keeps a forge).
    id: "homestead", biomes: ["plains"], roll: { slot: 5, chance: 0.083 }, at: { x: 6, z: 7, spread: 0.5 },
    landmark: { kind: "Homestead", xp: 10, radius: 18, arrive: { dx: 0, dz: 6 } },
    variants: COTTAGE_TRAINERS.length,
    parts: [
      { building: "cottage", dx: 0, dz: -5 },
      { npc: "archetype_villager", dx: 2, dz: 2 },
      { npc: COTTAGE_TRAINERS, dx: -2, dz: 1 },
      { prop: "qBarrel", dx: 3.4, dz: 0.8 },
      { prop: "qCrate", dx: 3.6, dz: -0.6, rot: 0.4 },
      { prop: "qBench", dx: -0.5, dz: 3.6, rot: 0.1 },
      { prop: "qFlag", dx: -3.5, dz: -2.5, rot: 0.5 },
      { prop: "qCauldron", dx: -2.6, dz: 2.4, when: { variant: [1] } },
      { smithy: true, dx: -4.5, dz: 2.5, when: { variant: [3] } },
      { npc: "archetype_guard", dx: 3, dz: -2, when: { roll: { slot: 91, chance: 0.3 } } },
    ],
  },
  {
    id: "dragon", biomes: ["tundra"], roll: { slot: 9, chance: 0.05 }, at: { x: 10, z: 11, spread: 0.6 },
    landmark: { kind: "Roost", xp: 40, radius: 40, arrive: { dx: 0, dz: 30 }, clear: { xp: 150, gold: 200 } },
    parts: [{ dragon: true, yaw: 12 }],
  },
  {
    // Proprietor, barkeep, a rotating specialist (arms and armor sellers keep
    // a forge out back), sometimes a guard.  Set back so its door faces the yard.
    id: "forest-inn", biomes: ["forest"], roll: { slot: 13, chance: 0.067 }, at: { x: 14, z: 15, spread: 0.5 },
    landmark: { kind: "Inn", xp: 10, radius: 20, arrive: { dx: 0, dz: 9 } },
    variants: INN_SPECIALISTS.length,
    parts: [
      { building: "inn", dx: 0, dz: -8 },
      { prop: "qBarrel", dx: 5.5, dz: 1.2 },
      { prop: "qBarrel", dx: 6.2, dz: 2.1, rot: 0.7 },
      { prop: "qCrate", dx: 5.8, dz: -0.4, rot: 0.3 },
      { prop: "qBench", dx: 0, dz: 5.5 },
      { prop: "qTable", dx: 0, dz: 6.8 },
      { prop: "qBannerStand", dx: -3.2, dz: 4.8, rot: Math.PI },
      { prop: "qLantern", dx: 2.4, dz: 4.6 },
      { prop: "qLantern", dx: -2.4, dz: 4.6 },
      { prop: "qMarketStall", dx: 5.2, dz: -4.5, rot: -Math.PI / 2, when: { variant: [4] } },
      { npc: "archetype_innkeeper", dx: 2.5, dz: 2.5 },
      { npc: "archetype_barkeeper", dx: -2.5, dz: 2 },
      { npc: INN_SPECIALISTS, dx: 4, dz: -3 },
      { smithy: true, dx: 6.5, dz: -5, when: { variant: [1, 2] } },
      { npc: "archetype_guard", dx: -4, dz: -3, when: { roll: { slot: 90, chance: 0.4 } } },
    ],
  },
  {
    id: "haunted-house", biomes: ["tundra"], roll: { slot: 17, chance: 0.1 }, at: { x: 18, z: 19, spread: 0.55 },
    landmark: { kind: "Manor", xp: 20, radius: 18, arrive: { dx: 0, dz: 10 } },
    parts: [
      { asset: "hauntedHouse", yaw: 20, scale: 1.2, tier: "structure" },
      // Left on the step by whoever fled: an old coffer, stiffly locked.
      { chest: { name: "Old Coffer", lock: 55, loot: "dungeon_loot" }, dx: 2, dz: 6, rot: 0.3 },
    ],
  },
  {
    id: "graveyard", biomes: ["plains", "forest"], roll: { slot: 21, chance: 0.1 }, at: { x: 22, z: 23, spread: 0.6 },
    landmark: { kind: "Graveyard", xp: 15, radius: 18, arrive: { dx: 0, dz: 12 } },
    parts: [{ asset: "graveYardScene", yaw: 24, scale: 1.0, tier: "scene" }],
  },
  {
    // Palisade, banners, stolen goods, and its garrison.
    id: "bandit-camp", biomes: ["desert"], roll: { slot: 40, chance: 0.048 }, at: { x: 41, z: 42, spread: 0.62 },
    landmark: { kind: "Bandit Camp", xp: 25, radius: 22, arrive: { dx: 0, dz: 12 }, clear: { xp: 60, gold: 75 } },
    rot: { slot: 43 },
    parts: [
      { ring: "vFence", radius: CAMP_RADIUS, count: 24, gap: 0.4 },
      { prop: "qBannerStand", dx: 2.6, dz: CAMP_RADIUS - 0.6 },
      { prop: "qBannerStand", dx: -2.6, dz: CAMP_RADIUS - 0.6 },
      { prop: "vWagon", dx: -5.2, dz: -1.5, rot: 0.35 },
      { prop: "qCrate", dx: 4.2, dz: -3.2, rot: 0.3 },
      { prop: "qCrate", dx: 5.0, dz: -2.2, rot: 1.1 },
      { prop: "qBarrel", dx: -3.6, dz: -4.6 },
      { prop: "qBarrel", dx: -2.8, dz: -5.3, rot: 0.8 },
      { chest: { name: "Bandits' Strongbox", lock: 35, loot: "treasure_chest" }, dx: 0, dz: -2.6, rot: Math.PI },
      { prop: "qSignPost", dx: 3.6, dz: 1.4, rot: -Math.PI / 2 }, // weapon rack
      { prop: "qLantern", dx: -1.6, dz: 2.2 },
      { npc: "archetype_bandit", dx: 3, dz: 2 },
      { npc: "archetype_bandit", dx: -3, dz: -2 },
      { npc: "archetype_bandit_archer", dx: 0, dz: 5 },
      { npc: "archetype_bandit_chief", dx: 0, dz: 0 },
    ],
  },
  {
    id: "snow-field", biomes: ["tundra"], roll: { slot: 45, chance: 0.085 }, at: { x: 46, z: 47, spread: 0.75 },
    parts: [{ asset: "snowField", yaw: 48, scale: { base: 0.85, slot: 49, range: 0.35 }, tier: "structure" }],
  },
  {
    id: "skull", biomes: ["desert", "tundra"], roll: { slot: 71, chance: 0.065 }, at: { x: 72, z: 73, spread: 0.9 },
    parts: [{ asset: "skull", yaw: 74, scale: { base: 0.55, slot: 75, range: 0.5 } }],
  },
];
