/**
 * QuaterniusAssetManifest — Metadata registry for Quaternius CC0 asset packs.
 *
 * Provides a structured catalogue of all Quaternius assets used by Camelot,
 * organised by pack and category.  Each entry maps a `FantasyAssetKey` to its
 * metadata (display name, pack source, category, tags, whether it has skeletal
 * animations, and the expected embedded animation group names for rigged models).
 *
 * Quaternius packs (all CC0 — Public Domain):
 *   1. Fantasy Props Mega Kit       — static props (barrels, furniture, altars…)
 *   2. Stylized Nature Mega Kit     — trees, rocks, vegetation
 *   3. Ultimate RPG                 — rigged + animated humanoid characters
 *   4. Animated Monster             — rigged + animated creatures
 *   5. Modular Character Outfits    — armour/clothing pieces for equipment visuals
 *   6. Universal Animation Library  — standalone animation clips (retargetable)
 *   7. Universal Animation Library 2 — additional animation clips
 *
 * Usage:
 *   import { getQuaterniusEntry, getKeysByPack } from "./quaternius-asset-manifest";
 *
 *   const entry = getQuaterniusEntry("qKnight");
 *   // → { key: "qKnight", name: "Knight", pack: "ultimate-rpg", … }
 *
 *   const propKeys = getKeysByPack("fantasy-props");
 *   // → ["qBarrel", "qCrate", "qChest", …]
 */

import type { FantasyAssetKey } from "./fantasy-asset-loader";

// ── Types ──────────────────────────────────────────────────────────────────────

/** Identifier for each Quaternius asset pack. */
export type QuaterniusPack =
  | "fantasy-props"
  | "stylized-nature"
  | "ultimate-rpg"
  | "animated-monster"
  | "modular-outfits"
  | "animation-library";

/** Category within a pack. */
export type AssetCategory =
  | "prop"
  | "furniture"
  | "structure"
  | "vegetation"
  | "terrain"
  | "character"
  | "creature"
  | "outfit-head"
  | "outfit-chest"
  | "outfit-legs"
  | "outfit-feet"
  | "outfit-back"
  | "outfit-offhand"
  | "animation";

/** Metadata for a single Quaternius asset. */
export interface QuaterniusAssetEntry {
  /** The FantasyAssetKey used by FantasyAssetLoader. */
  key: FantasyAssetKey;
  /** Human-readable display name. */
  name: string;
  /** Which Quaternius pack this asset comes from. */
  pack: QuaterniusPack;
  /** Functional category. */
  category: AssetCategory;
  /** Free-form tags for filtering. */
  tags: string[];
  /** True if the GLB contains a rigged skeleton. */
  rigged: boolean;
  /** True if the GLB contains embedded AnimationGroup clips. */
  animated: boolean;
  /**
   * Expected animation group names in the GLB, if animated.
   * These map to the clip names that SkeletalAnimationSystem can play.
   */
  animationGroups: string[];
}

// ── Manifest data ─────────────────────────────────────────────────────────────

const MANIFEST: QuaterniusAssetEntry[] = [
  // ── Fantasy Props Mega Kit ────────────────────────────────────────────────
  { key: "qBarrel",      name: "Barrel",       pack: "fantasy-props", category: "prop",      tags: ["container", "tavern", "warehouse"], rigged: false, animated: false, animationGroups: [] },
  { key: "qCrate",       name: "Crate",        pack: "fantasy-props", category: "prop",      tags: ["container", "warehouse", "dungeon"], rigged: false, animated: false, animationGroups: [] },
  { key: "qChest",       name: "Chest",        pack: "fantasy-props", category: "prop",      tags: ["container", "loot", "dungeon"],     rigged: false, animated: false, animationGroups: [] },
  { key: "qTable",       name: "Table",        pack: "fantasy-props", category: "furniture", tags: ["tavern", "house", "interior"],       rigged: false, animated: false, animationGroups: [] },
  { key: "qChair",       name: "Chair",        pack: "fantasy-props", category: "furniture", tags: ["tavern", "house", "interior"],       rigged: false, animated: false, animationGroups: [] },
  { key: "qBench",       name: "Bench",        pack: "fantasy-props", category: "furniture", tags: ["tavern", "exterior", "seating"],     rigged: false, animated: false, animationGroups: [] },
  { key: "qShelf",       name: "Shelf",        pack: "fantasy-props", category: "furniture", tags: ["shop", "house", "interior"],         rigged: false, animated: false, animationGroups: [] },
  { key: "qBookshelf",   name: "Bookshelf",    pack: "fantasy-props", category: "furniture", tags: ["library", "mage", "interior"],       rigged: false, animated: false, animationGroups: [] },
  { key: "qBed",         name: "Bed",          pack: "fantasy-props", category: "furniture", tags: ["inn", "house", "rest"],              rigged: false, animated: false, animationGroups: [] },
  { key: "qAnvil",       name: "Anvil",        pack: "fantasy-props", category: "prop",      tags: ["blacksmith", "crafting"],            rigged: false, animated: false, animationGroups: [] },
  { key: "qForge",       name: "Forge",        pack: "fantasy-props", category: "prop",      tags: ["blacksmith", "crafting", "fire"],    rigged: false, animated: false, animationGroups: [] },
  { key: "qAltar",       name: "Altar",        pack: "fantasy-props", category: "structure", tags: ["temple", "shrine", "dungeon"],       rigged: false, animated: false, animationGroups: [] },
  { key: "qWell",        name: "Well",         pack: "fantasy-props", category: "structure", tags: ["village", "courtyard", "water"],     rigged: false, animated: false, animationGroups: [] },
  { key: "qFountain",    name: "Fountain",     pack: "fantasy-props", category: "structure", tags: ["plaza", "garden", "water"],          rigged: false, animated: false, animationGroups: [] },
  { key: "qMarketStall", name: "Market Stall", pack: "fantasy-props", category: "structure", tags: ["market", "vendor", "settlement"],    rigged: false, animated: false, animationGroups: [] },
  { key: "qSignPost",    name: "Signpost",     pack: "fantasy-props", category: "prop",      tags: ["road", "settlement", "directional"], rigged: false, animated: false, animationGroups: [] },
  { key: "qLantern",     name: "Lantern",      pack: "fantasy-props", category: "prop",      tags: ["light", "exterior", "hanging"],      rigged: false, animated: false, animationGroups: [] },
  { key: "qCauldron",    name: "Cauldron",     pack: "fantasy-props", category: "prop",      tags: ["alchemy", "witch", "crafting"],      rigged: false, animated: false, animationGroups: [] },
  { key: "qFlag",        name: "Flag",         pack: "fantasy-props", category: "prop",      tags: ["castle", "banner", "decoration"],    rigged: false, animated: false, animationGroups: [] },
  { key: "qBannerStand", name: "Banner Stand", pack: "fantasy-props", category: "prop",      tags: ["camp", "garrison", "decoration"],    rigged: false, animated: false, animationGroups: [] },

  // ── Stylized Nature Mega Kit ──────────────────────────────────────────────
  { key: "qOakTree",     name: "Oak Tree",     pack: "stylized-nature", category: "vegetation", tags: ["tree", "forest", "temperate"],     rigged: false, animated: false, animationGroups: [] },
  { key: "qPineTree",    name: "Pine Tree",    pack: "stylized-nature", category: "vegetation", tags: ["tree", "boreal", "mountain"],      rigged: false, animated: false, animationGroups: [] },
  { key: "qWillowTree",  name: "Willow Tree",  pack: "stylized-nature", category: "vegetation", tags: ["tree", "swamp", "lakeside"],       rigged: false, animated: false, animationGroups: [] },
  { key: "qDeadTree",    name: "Dead Tree",    pack: "stylized-nature", category: "vegetation", tags: ["tree", "wasteland", "haunted"],    rigged: false, animated: false, animationGroups: [] },
  { key: "qBushLarge",   name: "Large Bush",   pack: "stylized-nature", category: "vegetation", tags: ["shrub", "hedge", "undergrowth"],   rigged: false, animated: false, animationGroups: [] },
  { key: "qBushSmall",   name: "Small Bush",   pack: "stylized-nature", category: "vegetation", tags: ["shrub", "ground-cover"],           rigged: false, animated: false, animationGroups: [] },
  { key: "qFern",        name: "Fern",         pack: "stylized-nature", category: "vegetation", tags: ["forest", "floor", "undergrowth"],  rigged: false, animated: false, animationGroups: [] },
  { key: "qFlowerRed",   name: "Red Flowers",  pack: "stylized-nature", category: "vegetation", tags: ["flower", "meadow", "red"],         rigged: false, animated: false, animationGroups: [] },
  { key: "qFlowerBlue",  name: "Blue Flowers", pack: "stylized-nature", category: "vegetation", tags: ["flower", "meadow", "blue"],        rigged: false, animated: false, animationGroups: [] },
  { key: "qGrassClump",  name: "Grass Clump",  pack: "stylized-nature", category: "vegetation", tags: ["grass", "field", "prairie"],       rigged: false, animated: false, animationGroups: [] },
  { key: "qRockLarge",   name: "Large Rock",   pack: "stylized-nature", category: "terrain",    tags: ["boulder", "obstacle", "cover"],    rigged: false, animated: false, animationGroups: [] },
  { key: "qRockMedium",  name: "Medium Rock",  pack: "stylized-nature", category: "terrain",    tags: ["rock", "scatter"],                 rigged: false, animated: false, animationGroups: [] },
  { key: "qRockSmall",   name: "Small Rock",   pack: "stylized-nature", category: "terrain",    tags: ["rock", "detail"],                  rigged: false, animated: false, animationGroups: [] },
  { key: "qStump",       name: "Tree Stump",   pack: "stylized-nature", category: "vegetation", tags: ["stump", "logged", "clearing"],     rigged: false, animated: false, animationGroups: [] },
  { key: "qLog",         name: "Fallen Log",   pack: "stylized-nature", category: "vegetation", tags: ["log", "obstacle", "forest"],       rigged: false, animated: false, animationGroups: [] },
  { key: "qMushroom",    name: "Mushroom",     pack: "stylized-nature", category: "vegetation", tags: ["fungus", "forest", "cave"],        rigged: false, animated: false, animationGroups: [] },

  // ── Ultimate RPG Characters ───────────────────────────────────────────────
  { key: "qKnight",         name: "Knight",          pack: "ultimate-rpg", category: "character", tags: ["melee", "armoured", "guard"],    rigged: true, animated: true, animationGroups: ["Idle", "Walk", "Run", "Attack", "Death", "Hit"] },
  { key: "qMage",           name: "Mage",            pack: "ultimate-rpg", category: "character", tags: ["caster", "robed", "magic"],      rigged: true, animated: true, animationGroups: ["Idle", "Walk", "Run", "Attack", "Death", "Hit", "Cast"] },
  { key: "qRogue",          name: "Rogue",           pack: "ultimate-rpg", category: "character", tags: ["melee", "stealth", "light"],     rigged: true, animated: true, animationGroups: ["Idle", "Walk", "Run", "Attack", "Death", "Hit"] },
  { key: "qArcher",         name: "Archer",          pack: "ultimate-rpg", category: "character", tags: ["ranged", "bow", "light"],        rigged: true, animated: true, animationGroups: ["Idle", "Walk", "Run", "Attack", "Death", "Hit"] },
  { key: "qBarbarian",      name: "Barbarian",       pack: "ultimate-rpg", category: "character", tags: ["melee", "heavy", "berserker"],   rigged: true, animated: true, animationGroups: ["Idle", "Walk", "Run", "Attack", "Death", "Hit"] },
  { key: "qVillagerMale",   name: "Villager (Male)", pack: "ultimate-rpg", category: "character", tags: ["civilian", "npc", "male"],       rigged: true, animated: true, animationGroups: ["Idle", "Walk", "Run", "Death"] },
  { key: "qVillagerFemale", name: "Villager (Female)", pack: "ultimate-rpg", category: "character", tags: ["civilian", "npc", "female"],   rigged: true, animated: true, animationGroups: ["Idle", "Walk", "Run", "Death"] },
  { key: "qGuard",          name: "Guard",           pack: "ultimate-rpg", category: "character", tags: ["melee", "patrol", "law"],        rigged: true, animated: true, animationGroups: ["Idle", "Walk", "Run", "Attack", "Death", "Hit"] },
  { key: "qMerchant",       name: "Merchant",        pack: "ultimate-rpg", category: "character", tags: ["civilian", "shopkeeper", "npc"], rigged: true, animated: true, animationGroups: ["Idle", "Walk", "Run", "Death"] },
  { key: "qInnkeeper",      name: "Innkeeper",       pack: "ultimate-rpg", category: "character", tags: ["civilian", "tavern", "npc"],     rigged: true, animated: true, animationGroups: ["Idle", "Walk", "Run", "Death"] },

  // ── Animated Monsters ─────────────────────────────────────────────────────
  { key: "qSkeleton",    name: "Skeleton",      pack: "animated-monster", category: "creature", tags: ["undead", "melee", "dungeon"],   rigged: true, animated: true, animationGroups: ["Idle", "Walk", "Run", "Attack", "Death", "Hit"] },
  { key: "qSpider",      name: "Giant Spider",  pack: "animated-monster", category: "creature", tags: ["beast", "cave", "dungeon"],     rigged: true, animated: true, animationGroups: ["Idle", "Walk", "Run", "Attack", "Death", "Hit"] },
  { key: "qSlime",       name: "Slime",         pack: "animated-monster", category: "creature", tags: ["ooze", "low-level", "dungeon"], rigged: true, animated: true, animationGroups: ["Idle", "Walk", "Attack", "Death", "Hit"] },
  { key: "qGoblin",      name: "Goblin",        pack: "animated-monster", category: "creature", tags: ["humanoid", "melee", "enemy"],   rigged: true, animated: true, animationGroups: ["Idle", "Walk", "Run", "Attack", "Death", "Hit"] },
  { key: "qOrc",         name: "Orc",           pack: "animated-monster", category: "creature", tags: ["humanoid", "melee", "enemy"],   rigged: true, animated: true, animationGroups: ["Idle", "Walk", "Run", "Attack", "Death", "Hit"] },
  { key: "qTroll",       name: "Troll",         pack: "animated-monster", category: "creature", tags: ["large", "melee", "dungeon"],    rigged: true, animated: true, animationGroups: ["Idle", "Walk", "Run", "Attack", "Death", "Hit"] },
  { key: "qDragonSmall", name: "Small Dragon",  pack: "animated-monster", category: "creature", tags: ["dragon", "flying", "mid-tier"], rigged: true, animated: true, animationGroups: ["Idle", "Walk", "Run", "Attack", "Death", "Hit"] },
  { key: "qWolf",        name: "Wolf",          pack: "animated-monster", category: "creature", tags: ["beast", "wilderness", "pack"],  rigged: true, animated: true, animationGroups: ["Idle", "Walk", "Run", "Attack", "Death", "Hit"] },
  { key: "qBat",         name: "Bat",           pack: "animated-monster", category: "creature", tags: ["beast", "cave", "ambient"],     rigged: true, animated: true, animationGroups: ["Idle", "Walk", "Attack", "Death"] },
  { key: "qGhost",       name: "Ghost",         pack: "animated-monster", category: "creature", tags: ["undead", "haunted", "magic"],   rigged: true, animated: true, animationGroups: ["Idle", "Walk", "Attack", "Death", "Hit"] },

  // ── Modular Character Outfits ─────────────────────────────────────────────
  { key: "qHelmetLight", name: "Light Helmet",    pack: "modular-outfits", category: "outfit-head",    tags: ["leather", "scout"],    rigged: false, animated: false, animationGroups: [] },
  { key: "qHelmetHeavy", name: "Heavy Helmet",    pack: "modular-outfits", category: "outfit-head",    tags: ["plate", "knight"],     rigged: false, animated: false, animationGroups: [] },
  { key: "qHelmetMage",  name: "Mage Hood",       pack: "modular-outfits", category: "outfit-head",    tags: ["cloth", "spellcaster"], rigged: false, animated: false, animationGroups: [] },
  { key: "qChestLight",  name: "Light Chest",     pack: "modular-outfits", category: "outfit-chest",   tags: ["leather", "cuirass"],  rigged: false, animated: false, animationGroups: [] },
  { key: "qChestHeavy",  name: "Heavy Chest",     pack: "modular-outfits", category: "outfit-chest",   tags: ["plate", "cuirass"],    rigged: false, animated: false, animationGroups: [] },
  { key: "qChestRobe",   name: "Mage Robe",       pack: "modular-outfits", category: "outfit-chest",   tags: ["cloth", "robe"],       rigged: false, animated: false, animationGroups: [] },
  { key: "qLegsLight",   name: "Light Greaves",   pack: "modular-outfits", category: "outfit-legs",    tags: ["leather", "greaves"],  rigged: false, animated: false, animationGroups: [] },
  { key: "qLegsHeavy",   name: "Heavy Greaves",   pack: "modular-outfits", category: "outfit-legs",    tags: ["plate", "greaves"],    rigged: false, animated: false, animationGroups: [] },
  { key: "qBootsLight",  name: "Light Boots",     pack: "modular-outfits", category: "outfit-feet",    tags: ["leather", "footwear"], rigged: false, animated: false, animationGroups: [] },
  { key: "qBootsHeavy",  name: "Heavy Boots",     pack: "modular-outfits", category: "outfit-feet",    tags: ["plate", "sabatons"],   rigged: false, animated: false, animationGroups: [] },
  { key: "qCloakShort",  name: "Short Cloak",     pack: "modular-outfits", category: "outfit-back",    tags: ["shoulder", "cape"],    rigged: false, animated: false, animationGroups: [] },
  { key: "qCloakLong",   name: "Long Cloak",      pack: "modular-outfits", category: "outfit-back",    tags: ["full-length", "cape"], rigged: false, animated: false, animationGroups: [] },
  { key: "qShield",      name: "Round Shield",    pack: "modular-outfits", category: "outfit-offhand", tags: ["shield", "melee"],     rigged: false, animated: false, animationGroups: [] },
  { key: "qShieldTower", name: "Tower Shield",    pack: "modular-outfits", category: "outfit-offhand", tags: ["shield", "heavy"],     rigged: false, animated: false, animationGroups: [] },

  // ── Universal Animation Library 1 & 2 ────────────────────────────────────
  { key: "qAnimIdle",        name: "Idle",          pack: "animation-library", category: "animation", tags: ["locomotion", "idle"],      rigged: true, animated: true, animationGroups: ["Idle"] },
  { key: "qAnimWalk",        name: "Walk",          pack: "animation-library", category: "animation", tags: ["locomotion", "walk"],      rigged: true, animated: true, animationGroups: ["Walk"] },
  { key: "qAnimRun",         name: "Run",           pack: "animation-library", category: "animation", tags: ["locomotion", "run"],       rigged: true, animated: true, animationGroups: ["Run"] },
  { key: "qAnimAttackMelee", name: "Attack Melee",  pack: "animation-library", category: "animation", tags: ["combat", "melee"],        rigged: true, animated: true, animationGroups: ["AttackMelee"] },
  { key: "qAnimAttackRanged",name: "Attack Ranged", pack: "animation-library", category: "animation", tags: ["combat", "ranged"],       rigged: true, animated: true, animationGroups: ["AttackRanged"] },
  { key: "qAnimDeath",       name: "Death",         pack: "animation-library", category: "animation", tags: ["combat", "death"],        rigged: true, animated: true, animationGroups: ["Death"] },
  { key: "qAnimHit",         name: "Hit React",     pack: "animation-library", category: "animation", tags: ["combat", "flinch"],       rigged: true, animated: true, animationGroups: ["Hit"] },
  { key: "qAnimDodge",       name: "Dodge",         pack: "animation-library", category: "animation", tags: ["combat", "evasion"],      rigged: true, animated: true, animationGroups: ["Dodge"] },
  { key: "qAnimCast",        name: "Spellcast",     pack: "animation-library", category: "animation", tags: ["magic", "cast"],          rigged: true, animated: true, animationGroups: ["Cast"] },
  { key: "qAnimBlock",       name: "Block",         pack: "animation-library", category: "animation", tags: ["combat", "defend"],       rigged: true, animated: true, animationGroups: ["Block"] },
  { key: "qAnimPickup",      name: "Pickup",        pack: "animation-library", category: "animation", tags: ["interact", "grab"],       rigged: true, animated: true, animationGroups: ["Pickup"] },
  { key: "qAnimSit",         name: "Sit",           pack: "animation-library", category: "animation", tags: ["interact", "idle"],       rigged: true, animated: true, animationGroups: ["Sit"] },
];

// ── Indexes (built once on module load) ─────────────────────────────────────

const _byKey  = new Map<FantasyAssetKey, QuaterniusAssetEntry>();
const _byPack = new Map<QuaterniusPack, FantasyAssetKey[]>();
const _byCat  = new Map<AssetCategory, FantasyAssetKey[]>();

for (const entry of MANIFEST) {
  _byKey.set(entry.key, entry);

  const packList = _byPack.get(entry.pack) ?? [];
  packList.push(entry.key);
  _byPack.set(entry.pack, packList);

  const catList = _byCat.get(entry.category) ?? [];
  catList.push(entry.key);
  _byCat.set(entry.category, catList);
}

// ── Public API ──────────────────────────────────────────────────────────────

/** Returns metadata for a single Quaternius asset, or `undefined` if not found. */
export function getQuaterniusEntry(key: FantasyAssetKey): QuaterniusAssetEntry | undefined {
  return _byKey.get(key);
}

/** Returns all asset keys belonging to a given pack. */
export function getKeysByPack(pack: QuaterniusPack): FantasyAssetKey[] {
  return _byPack.get(pack) ?? [];
}

/** Returns all asset keys belonging to a given category. */
export function getKeysByCategory(category: AssetCategory): FantasyAssetKey[] {
  return _byCat.get(category) ?? [];
}

/** Returns all asset keys that have skeletal animations (rigged + animated). */
export function getAnimatedKeys(): FantasyAssetKey[] {
  return MANIFEST.filter((e) => e.animated).map((e) => e.key);
}

/** Returns all Quaternius asset keys. */
export function getAllQuaterniusKeys(): FantasyAssetKey[] {
  return MANIFEST.map((e) => e.key);
}

/** Returns the full manifest array (read-only snapshot). */
export function getManifest(): readonly QuaterniusAssetEntry[] {
  return MANIFEST;
}

/** Returns all distinct tags across all Quaternius assets, sorted. */
export function getAllTags(): string[] {
  const tags = new Set<string>();
  for (const entry of MANIFEST) {
    for (const tag of entry.tags) tags.add(tag);
  }
  return Array.from(tags).sort();
}

/** Returns asset keys that match ALL of the given tags. */
export function getKeysByTags(tags: string[]): FantasyAssetKey[] {
  return MANIFEST
    .filter((e) => tags.every((t) => e.tags.includes(t)))
    .map((e) => e.key);
}

/** Returns all distinct pack identifiers. */
export function getAllPacks(): QuaterniusPack[] {
  return Array.from(_byPack.keys());
}

/** Returns the total number of Quaternius assets in the manifest. */
export function getManifestSize(): number {
  return MANIFEST.length;
}
