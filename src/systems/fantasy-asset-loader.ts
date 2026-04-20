/**
 * FantasyAssetLoader — Async CDN model loading and instance management.
 *
 * Loads fantasy RPG assets from the BabylonJS Assets CDN and self-hosted
 * Quaternius asset packs, caching them for instancing. Models are loaded in
 * the background; callers register callbacks that fire once the model is
 * ready (or immediately if already cached).
 *
 * Asset sources:
 *   BabylonJS Assets CDN  — https://assets.babylonjs.com/meshes/
 *   Source repository      — https://github.com/BabylonJS/Assets (CC BY 4.0)
 *   Quaternius             — https://quaternius.com (CC0 Public Domain)
 *
 * Licensing:
 *   Assets from BabylonJS/Assets are licensed under Creative Commons
 *   Attribution 4.0 International (CC BY 4.0) unless otherwise noted in
 *   the asset folder.  See https://creativecommons.org/licenses/by/4.0/
 *
 *   Quaternius assets are released under CC0 (Public Domain) — no
 *   attribution required, free for commercial use.
 *   See https://creativecommons.org/publicdomain/zero/1.0/
 *
 * See docs/asset-catalogue.md for the full catalogue of available assets,
 * their CDN URLs, categories, and usage guidance.
 *
 * All loads are fire-and-forget. Failures are silent and the asset simply
 * remains unavailable; callers should always code a procedural fallback.
 */

import { Scene } from "@babylonjs/core/scene";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Quaternion } from "@babylonjs/core/Maths/math.vector";
import "@babylonjs/loaders/glTF";

// ── Asset catalogue ──────────────────────────────────────────────────────────

export type FantasyAssetKey =
  | "elfAnimated"     // Animated elf character — Oblivion-style humanoid NPC
  | "runeSword"       // Rune-inscribed longsword — high-tier loot
  | "frostAxe"        // Frost-enchanted axe — ice dungeon loot (Demos path)
  | "moltenDagger"    // Molten obsidian dagger — assassin loot
  | "mausoleum"       // Stone mausoleum — graveyard structure
  | "obelisk"         // Ancient obelisk — desert shrine / standing stone
  | "cottage"         // Thatched roof cottage — settlement structure
  | "inn"             // Roadside inn — settlement structure
  | "dragon"          // Dragon — rare world encounter
  | "hauntedHouse"    // Haunted house — ruins/fort structure variant
  | "village"         // Village scene — settlement cluster
  | "valleyVillage"   // Valley village with terrain — large settlement
  | "graveYardScene"  // Graveyard scene — cemetery near ruins
  // ── Additional assets from BabylonJS Assets CDN (CC BY 4.0) ───────────────
  | "pirateFort"      // Fort structure — bandit camp / ruins variant
  | "cannon"          // Cannon prop — fort / siege decoration
  | "explodingBarrel" // Exploding barrel — interactive prop / dungeon hazard
  | "skull"           // Skull — dungeon decoration / necromancer prop
  | "bothHousesScene" // Two-house scene — small settlement variant
  | "houseScene"      // Single house scene — hamlet / farmstead structure
  | "lamp"            // Oil lamp — interior lighting prop
  | "candle"          // Candle — interior / shrine decoration
  | "fish"            // Fish — market stall / fishing prop
  | "seagull"         // Seagull — ambient coastal creature
  | "hexTile"         // Hex tile — modular terrain / board piece
  | "elfRun"          // Elf run animation — NPC locomotion variant
  | "elfDie"          // Elf death animation — NPC death variant
  | "dude"            // Animated humanoid — generic NPC / villager
  // ── Quaternius: Fantasy Props Mega Kit (CC0) ──────────────────────────────
  | "qBarrel"         // Wooden barrel — tavern / warehouse prop
  | "qCrate"          // Wooden crate — warehouse / dungeon prop
  | "qChest"          // Treasure chest — loot container
  | "qTable"          // Wooden table — interior furniture
  | "qChair"          // Wooden chair — interior furniture
  | "qBench"          // Wooden bench — tavern / exterior seating
  | "qShelf"          // Wooden shelf — shop / house interior
  | "qBookshelf"      // Bookshelf — library / mage tower prop
  | "qBed"            // Bed — inn / house interior
  | "qAnvil"          // Anvil — blacksmith workshop prop
  | "qForge"          // Forge — blacksmith workshop prop
  | "qAltar"          // Stone altar — temple / dungeon shrine
  | "qWell"           // Stone well — village / courtyard prop
  | "qFountain"       // Stone fountain — plaza / garden centrepiece
  | "qMarketStall"    // Market stall — open-air vendor stand
  | "qSignPost"       // Signpost — road / settlement directional marker
  | "qLantern"        // Hanging lantern — exterior lighting prop
  | "qCauldron"       // Cauldron — alchemy / witch hut prop
  | "qFlag"           // Wall-mounted flag / banner — castle decoration
  | "qBannerStand"    // Freestanding banner — camp / garrison decoration
  // ── Quaternius: Stylized Nature Mega Kit (CC0) ────────────────────────────
  | "qOakTree"        // Deciduous oak tree — temperate forest vegetation
  | "qPineTree"       // Conifer pine tree — boreal / mountain vegetation
  | "qWillowTree"     // Willow tree — swamp / lakeside vegetation
  | "qDeadTree"       // Dead tree — wasteland / haunted area
  | "qBushLarge"      // Large shrub — undergrowth / hedge
  | "qBushSmall"      // Small bush — ground cover
  | "qFern"           // Fern — forest floor vegetation
  | "qFlowerRed"      // Red flower cluster — meadow decoration
  | "qFlowerBlue"     // Blue flower cluster — meadow decoration
  | "qGrassClump"     // Tall grass clump — field / prairie
  | "qRockLarge"      // Large boulder — terrain obstacle / cover
  | "qRockMedium"     // Medium rock — terrain scatter
  | "qRockSmall"      // Small rock — terrain detail
  | "qStump"          // Tree stump — logged forest / clearing
  | "qLog"            // Fallen log — forest floor obstacle
  | "qMushroom"       // Mushroom cluster — forest / cave decoration
  // ── Quaternius: Ultimate RPG Characters (CC0) ─────────────────────────────
  | "qKnight"         // Knight — armoured melee NPC (rigged + animated)
  | "qMage"           // Mage — robed caster NPC (rigged + animated)
  | "qRogue"          // Rogue — light-armour NPC (rigged + animated)
  | "qArcher"         // Archer — ranged NPC (rigged + animated)
  | "qBarbarian"      // Barbarian — heavy melee NPC (rigged + animated)
  | "qVillagerMale"   // Male villager — civilian NPC (rigged + animated)
  | "qVillagerFemale" // Female villager — civilian NPC (rigged + animated)
  | "qGuard"          // Town guard — law enforcement NPC (rigged + animated)
  | "qMerchant"       // Merchant — shopkeeper NPC (rigged + animated)
  | "qInnkeeper"      // Innkeeper — tavern NPC (rigged + animated)
  // ── Quaternius: Animated Monsters (CC0) ───────────────────────────────────
  | "qSkeleton"       // Animated skeleton — undead creature
  | "qSpider"         // Giant spider — cave / dungeon creature
  | "qSlime"          // Slime — low-level dungeon creature
  | "qGoblin"         // Goblin — humanoid enemy
  | "qOrc"            // Orc — humanoid enemy
  | "qTroll"          // Troll — large dungeon creature
  | "qDragonSmall"    // Small dragon — mid-tier flying creature
  | "qWolf"           // Wolf — wilderness creature
  | "qBat"            // Bat — cave / dungeon ambient creature
  | "qGhost"          // Ghost — undead / haunted area creature
  // ── Quaternius: Modular Character Outfits Fantasy (CC0) ───────────────────
  | "qHelmetLight"    // Light helmet — leather / scout headgear
  | "qHelmetHeavy"    // Heavy helmet — plate / knight headgear
  | "qHelmetMage"     // Mage hood — cloth spellcaster headgear
  | "qChestLight"     // Light chest armour — leather cuirass
  | "qChestHeavy"     // Heavy chest armour — plate cuirass
  | "qChestRobe"      // Mage robe — cloth chest piece
  | "qLegsLight"      // Light leg armour — leather greaves
  | "qLegsHeavy"      // Heavy leg armour — plate greaves
  | "qBootsLight"     // Light boots — leather footwear
  | "qBootsHeavy"     // Heavy boots — plate sabatons
  | "qCloakShort"     // Short cloak — shoulder cape
  | "qCloakLong"      // Long cloak — full-length back cape
  | "qShield"         // Round shield — melee off-hand
  | "qShieldTower"    // Tower shield — heavy off-hand
  // ── Quaternius: Universal Animation Library 1 & 2 (CC0) ──────────────────
  | "qAnimIdle"       // Idle animation clip — relaxed standing
  | "qAnimWalk"       // Walk animation clip — standard locomotion
  | "qAnimRun"        // Run animation clip — fast locomotion
  | "qAnimAttackMelee"  // Melee attack animation clip — sword swing
  | "qAnimAttackRanged" // Ranged attack animation clip — bow draw + release
  | "qAnimDeath"      // Death animation clip — fall-down
  | "qAnimHit"        // Hit react animation clip — flinch
  | "qAnimDodge"      // Dodge animation clip — side-step
  | "qAnimCast"       // Spellcast animation clip — magic gesture
  | "qAnimBlock"      // Block animation clip — shield raise
  | "qAnimPickup"     // Pickup animation clip — bend and grab
  | "qAnimSit";       // Sit animation clip — chair / bench idle

const CDN      = "https://assets.babylonjs.com/meshes/";
const CDN_DEMO = CDN + "Demos/weaponsDemo/meshes/";
const CDN_ELF  = CDN + "Elf/";

/**
 * Base path for self-hosted Quaternius assets.
 * Override via `setQuaterniusBasePath()` for custom CDN hosting.
 */
let QUATERNIUS_BASE = "model/quaternius/";

/** Override the default Quaternius asset base path (e.g. for CDN hosting). */
export function setQuaterniusBasePath(basePath: string): void {
  const normalised = basePath.endsWith("/") ? basePath : basePath + "/";
  QUATERNIUS_BASE = normalised;
}

/** Returns the current Quaternius base path. */
export function getQuaterniusBasePath(): string {
  return QUATERNIUS_BASE;
}

// Helpers for Quaternius sub-paths
const qProps    = () => QUATERNIUS_BASE + "props/";
const qNature   = () => QUATERNIUS_BASE + "nature/";
const qChars    = () => QUATERNIUS_BASE + "characters/";
const qMonsters = () => QUATERNIUS_BASE + "monsters/";
const qOutfits  = () => QUATERNIUS_BASE + "outfits/";
const qAnims    = () => QUATERNIUS_BASE + "animations/";

/** CDN URL for each asset key. */
const ASSET_URLS: Record<FantasyAssetKey, string> = {
  elfAnimated:    CDN_ELF  + "Elf_allAnimations.gltf",
  // Weapons: confirmed at both root and Demos sub-path; use Demos path as primary
  runeSword:      CDN_DEMO + "runeSword.glb",
  frostAxe:       CDN_DEMO + "frostAxe.glb",
  moltenDagger:   CDN_DEMO + "moltenDagger.glb",
  mausoleum:      CDN      + "mausoleumLarge.glb",
  obelisk:        CDN      + "obelisk1.glb",
  cottage:        CDN      + "cottage.glb",
  inn:            CDN      + "inn.glb",
  dragon:         CDN      + "Georgia-Tech-Dragon/dragon.glb",
  hauntedHouse:   CDN      + "haunted_house.glb",
  village:        CDN      + "village.glb",
  valleyVillage:  CDN      + "valleyvillage.glb",
  graveYardScene: CDN      + "graveyardScene.glb",
  // Additional assets from BabylonJS Assets CDN (CC BY 4.0)
  pirateFort:     CDN      + "pirateFort/pirateFort.glb",
  cannon:         CDN      + "pirateFort/cannon.glb",
  explodingBarrel: CDN     + "ExplodingBarrel.glb",
  skull:          CDN      + "skull.babylon",
  bothHousesScene: CDN     + "both_houses_scene.glb",
  houseScene:     CDN      + "house_scene.glb",
  lamp:           CDN      + "lamp.babylon",
  candle:         CDN      + "candle.babylon",
  fish:           CDN      + "fish.glb",
  seagull:        CDN      + "seagulf.glb",
  hexTile:        CDN      + "hexTile.glb",
  elfRun:         CDN_ELF  + "Elf_run.gltf",
  elfDie:         CDN_ELF  + "Elf_die.gltf",
  dude:           CDN      + "Dude/dude.babylon",
  // ── Quaternius: Fantasy Props Mega Kit (CC0) ──────────────────────────────
  // NOTE: ASSET_URLS for Quaternius assets use lazy getters (resolved at load
  // time) so setQuaterniusBasePath() can be called before preload.
  get qBarrel()      { return qProps()    + "Barrel.glb"; },
  get qCrate()       { return qProps()    + "Crate.glb"; },
  get qChest()       { return qProps()    + "Chest.glb"; },
  get qTable()       { return qProps()    + "Table.glb"; },
  get qChair()       { return qProps()    + "Chair.glb"; },
  get qBench()       { return qProps()    + "Bench.glb"; },
  get qShelf()       { return qProps()    + "Shelf.glb"; },
  get qBookshelf()   { return qProps()    + "Bookshelf.glb"; },
  get qBed()         { return qProps()    + "Bed.glb"; },
  get qAnvil()       { return qProps()    + "Anvil.glb"; },
  get qForge()       { return qProps()    + "Forge.glb"; },
  get qAltar()       { return qProps()    + "Altar.glb"; },
  get qWell()        { return qProps()    + "Well.glb"; },
  get qFountain()    { return qProps()    + "Fountain.glb"; },
  get qMarketStall() { return qProps()    + "MarketStall.glb"; },
  get qSignPost()    { return qProps()    + "SignPost.glb"; },
  get qLantern()     { return qProps()    + "Lantern.glb"; },
  get qCauldron()    { return qProps()    + "Cauldron.glb"; },
  get qFlag()        { return qProps()    + "Flag.glb"; },
  get qBannerStand() { return qProps()    + "BannerStand.glb"; },
  // ── Quaternius: Stylized Nature Mega Kit (CC0) ────────────────────────────
  get qOakTree()     { return qNature()   + "OakTree.glb"; },
  get qPineTree()    { return qNature()   + "PineTree.glb"; },
  get qWillowTree()  { return qNature()   + "WillowTree.glb"; },
  get qDeadTree()    { return qNature()   + "DeadTree.glb"; },
  get qBushLarge()   { return qNature()   + "BushLarge.glb"; },
  get qBushSmall()   { return qNature()   + "BushSmall.glb"; },
  get qFern()        { return qNature()   + "Fern.glb"; },
  get qFlowerRed()   { return qNature()   + "FlowerRed.glb"; },
  get qFlowerBlue()  { return qNature()   + "FlowerBlue.glb"; },
  get qGrassClump()  { return qNature()   + "GrassClump.glb"; },
  get qRockLarge()   { return qNature()   + "RockLarge.glb"; },
  get qRockMedium()  { return qNature()   + "RockMedium.glb"; },
  get qRockSmall()   { return qNature()   + "RockSmall.glb"; },
  get qStump()       { return qNature()   + "Stump.glb"; },
  get qLog()         { return qNature()   + "Log.glb"; },
  get qMushroom()    { return qNature()   + "Mushroom.glb"; },
  // ── Quaternius: Ultimate RPG Characters (CC0) ─────────────────────────────
  get qKnight()         { return qChars()    + "Knight.glb"; },
  get qMage()           { return qChars()    + "Mage.glb"; },
  get qRogue()          { return qChars()    + "Rogue.glb"; },
  get qArcher()         { return qChars()    + "Archer.glb"; },
  get qBarbarian()      { return qChars()    + "Barbarian.glb"; },
  get qVillagerMale()   { return qChars()    + "VillagerMale.glb"; },
  get qVillagerFemale() { return qChars()    + "VillagerFemale.glb"; },
  get qGuard()          { return qChars()    + "Guard.glb"; },
  get qMerchant()       { return qChars()    + "Merchant.glb"; },
  get qInnkeeper()      { return qChars()    + "Innkeeper.glb"; },
  // ── Quaternius: Animated Monsters (CC0) ───────────────────────────────────
  get qSkeleton()    { return qMonsters() + "Skeleton.glb"; },
  get qSpider()      { return qMonsters() + "Spider.glb"; },
  get qSlime()       { return qMonsters() + "Slime.glb"; },
  get qGoblin()      { return qMonsters() + "Goblin.glb"; },
  get qOrc()         { return qMonsters() + "Orc.glb"; },
  get qTroll()       { return qMonsters() + "Troll.glb"; },
  get qDragonSmall() { return qMonsters() + "DragonSmall.glb"; },
  get qWolf()        { return qMonsters() + "Wolf.glb"; },
  get qBat()         { return qMonsters() + "Bat.glb"; },
  get qGhost()       { return qMonsters() + "Ghost.glb"; },
  // ── Quaternius: Modular Character Outfits Fantasy (CC0) ───────────────────
  get qHelmetLight() { return qOutfits()  + "HelmetLight.glb"; },
  get qHelmetHeavy() { return qOutfits()  + "HelmetHeavy.glb"; },
  get qHelmetMage()  { return qOutfits()  + "HelmetMage.glb"; },
  get qChestLight()  { return qOutfits()  + "ChestLight.glb"; },
  get qChestHeavy()  { return qOutfits()  + "ChestHeavy.glb"; },
  get qChestRobe()   { return qOutfits()  + "ChestRobe.glb"; },
  get qLegsLight()   { return qOutfits()  + "LegsLight.glb"; },
  get qLegsHeavy()   { return qOutfits()  + "LegsHeavy.glb"; },
  get qBootsLight()  { return qOutfits()  + "BootsLight.glb"; },
  get qBootsHeavy()  { return qOutfits()  + "BootsHeavy.glb"; },
  get qCloakShort()  { return qOutfits()  + "CloakShort.glb"; },
  get qCloakLong()   { return qOutfits()  + "CloakLong.glb"; },
  get qShield()      { return qOutfits()  + "Shield.glb"; },
  get qShieldTower() { return qOutfits()  + "ShieldTower.glb"; },
  // ── Quaternius: Universal Animation Library 1 & 2 (CC0) ──────────────────
  get qAnimIdle()        { return qAnims()    + "Idle.glb"; },
  get qAnimWalk()        { return qAnims()    + "Walk.glb"; },
  get qAnimRun()         { return qAnims()    + "Run.glb"; },
  get qAnimAttackMelee() { return qAnims()    + "AttackMelee.glb"; },
  get qAnimAttackRanged(){ return qAnims()    + "AttackRanged.glb"; },
  get qAnimDeath()       { return qAnims()    + "Death.glb"; },
  get qAnimHit()         { return qAnims()    + "Hit.glb"; },
  get qAnimDodge()       { return qAnims()    + "Dodge.glb"; },
  get qAnimCast()        { return qAnims()    + "Cast.glb"; },
  get qAnimBlock()       { return qAnims()    + "Block.glb"; },
  get qAnimPickup()      { return qAnims()    + "Pickup.glb"; },
  get qAnimSit()         { return qAnims()    + "Sit.glb"; },
};

// ── Scale overrides (world-unit scale applied after load) ────────────────────

const ASSET_SCALE: Partial<Record<FantasyAssetKey, number>> = {
  elfAnimated:    1.0,
  mausoleum:      1.0,
  obelisk:        1.0,
  cottage:        1.0,
  inn:            1.0,
  dragon:         2.0,
  hauntedHouse:   1.0,
  village:        1.0,
  valleyVillage:  1.0,
  graveYardScene: 1.0,
  pirateFort:     1.0,
  cannon:         1.0,
  explodingBarrel: 1.0,
  skull:          0.5,
  bothHousesScene: 1.0,
  houseScene:     1.0,
  dude:           1.0,
  // Quaternius characters (scale to match Camelot world units)
  qKnight:        1.0,
  qMage:          1.0,
  qRogue:         1.0,
  qArcher:        1.0,
  qBarbarian:     1.0,
  qVillagerMale:  1.0,
  qVillagerFemale: 1.0,
  qGuard:         1.0,
  qMerchant:      1.0,
  qInnkeeper:     1.0,
  // Quaternius monsters (some need adjustment for game balance)
  qSkeleton:      1.0,
  qSpider:        0.8,
  qSlime:         0.6,
  qGoblin:        0.85,
  qOrc:           1.1,
  qTroll:         1.5,
  qDragonSmall:   1.8,
  qWolf:          0.7,
  qBat:           0.4,
  qGhost:         1.0,
};

// ── Internal state per asset ──────────────────────────────────────────────────

interface AssetEntry {
  rootMesh: AbstractMesh | null;
  allMeshes: AbstractMesh[];
  loaded: boolean;
  failed: boolean;
  pendingCallbacks: Array<(root: AbstractMesh | null, allMeshes: AbstractMesh[]) => void>;
}

// ── FantasyAssetLoader ────────────────────────────────────────────────────────

export class FantasyAssetLoader {
  private readonly _scene: Scene;
  private readonly _assets: Map<FantasyAssetKey, AssetEntry> = new Map();
  private _instanceCounter = 0;

  constructor(scene: Scene) {
    this._scene = scene;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Start loading the given asset keys in the background.
   * Safe to call multiple times — duplicate keys are ignored.
   */
  public preload(keys: FantasyAssetKey[]): void {
    for (const key of keys) {
      if (!this._assets.has(key)) {
        this._startLoad(key);
      }
    }
  }

  /**
   * Preload the full fantasy asset catalogue.
   * Call once at game startup so models are ready when the world generates.
   */
  public preloadAll(): void {
    this.preload(Object.keys(ASSET_URLS) as FantasyAssetKey[]);
  }

  /**
   * Register a callback to receive a cloned instance of the named asset.
   * If the asset is already loaded the callback fires synchronously.
   * If loading fails the callback receives `null`.
   *
   * @param key       Asset identifier
   * @param onReady   Called with the instance root mesh (or null on failure)
   */
  public getInstance(
    key: FantasyAssetKey,
    onReady: (root: AbstractMesh | null, allMeshes: AbstractMesh[]) => void,
  ): void {
    let entry = this._assets.get(key);
    if (!entry) {
      this._startLoad(key);
      entry = this._assets.get(key)!;
    }

    if (entry.loaded) {
      const instance = this._cloneAsset(key, entry);
      onReady(instance.root, instance.meshes);
    } else if (entry.failed) {
      onReady(null, []);
    } else {
      entry.pendingCallbacks.push(onReady);
    }
  }

  /**
   * Returns true if the asset has finished loading (successfully or not).
   */
  public isReady(key: FantasyAssetKey): boolean {
    const entry = this._assets.get(key);
    return !!entry && (entry.loaded || entry.failed);
  }

  /**
   * Returns true if the asset loaded successfully.
   */
  public isLoaded(key: FantasyAssetKey): boolean {
    const entry = this._assets.get(key);
    return !!entry && entry.loaded;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private _startLoad(key: FantasyAssetKey): void {
    const entry: AssetEntry = {
      rootMesh: null,
      allMeshes: [],
      loaded: false,
      failed: false,
      pendingCallbacks: [],
    };
    this._assets.set(key, entry);

    const url = ASSET_URLS[key];

    SceneLoader.ImportMeshAsync("", url, "", this._scene)
      .then((result) => {
        if (result.meshes.length === 0) {
          this._markFailed(key, entry);
          return;
        }

        const root = result.meshes[0];
        const scale = ASSET_SCALE[key] ?? 1.0;

        // Store as hidden template — instances will be cloned from this
        root.setEnabled(false);
        root.name = `__fantasy_template_${key}`;
        root.scaling = new Vector3(scale, scale, scale);

        entry.rootMesh = root;
        entry.allMeshes = result.meshes;
        entry.loaded = true;

        // Flush pending callbacks with a fresh clone each
        for (const cb of entry.pendingCallbacks) {
          const instance = this._cloneAsset(key, entry);
          cb(instance.root, instance.meshes);
        }
        entry.pendingCallbacks = [];
      })
      .catch(() => {
        this._markFailed(key, entry);
      });
  }

  private _markFailed(key: FantasyAssetKey, entry: AssetEntry): void {
    entry.failed = true;
    for (const cb of entry.pendingCallbacks) {
      cb(null, []);
    }
    entry.pendingCallbacks = [];
    console.warn(`[FantasyAssetLoader] Failed to load asset: ${key}`);
  }

  private _cloneAsset(
    key: FantasyAssetKey,
    entry: AssetEntry,
  ): { root: AbstractMesh | null; meshes: AbstractMesh[] } {
    if (!entry.rootMesh) return { root: null, meshes: [] };

    const id = ++this._instanceCounter;
    const cloned = entry.rootMesh.clone(`fantasy_${key}_${id}`, null);
    if (!cloned) return { root: null, meshes: [] };

    cloned.setEnabled(true);

    // Collect all cloned descendant meshes
    const descendants = cloned.getChildMeshes(false) as AbstractMesh[];
    return { root: cloned, meshes: [cloned, ...descendants] };
  }
}
