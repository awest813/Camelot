# Asset Catalogue

This document catalogues fantasy RPG assets available for use in Camelot.
Assets come from two sources:

1. **BabylonJS Assets CDN** — [assets.babylonjs.com/meshes/](https://assets.babylonjs.com/meshes/)
   Licensed **CC BY 4.0** (attribution required).
2. **Quaternius Asset Packs** — [quaternius.com](https://quaternius.com)
   Licensed **CC0 (Public Domain)** — no attribution required, free for
   commercial use.

---

## How to Use

Assets are loaded via `FantasyAssetLoader` (`src/systems/fantasy-asset-loader.ts`).

```ts
// Preload specific assets at startup
assetLoader.preload(["cottage", "pirateFort", "qKnight", "qOakTree"]);

// Request an instance (fires callback when ready, or immediately if cached)
assetLoader.getInstance("qKnight", (root, meshes) => {
  if (root) {
    root.position = new Vector3(x, y, z);
  }
});

// Preload the entire catalogue
assetLoader.preloadAll();
```

### Quaternius Base Path

Quaternius assets are self-hosted (not available from a public CDN).
By default they are loaded from `model/quaternius/` relative to the app root.
Override this for custom CDN hosting:

```ts
import { setQuaterniusBasePath } from "./systems/fantasy-asset-loader";
setQuaterniusBasePath("https://cdn.example.com/models/quaternius/");
```

### Quaternius Asset Manifest

Metadata about all Quaternius assets (pack, category, tags, animation groups)
is available via `QuaterniusAssetManifest` (`src/systems/quaternius-asset-manifest.ts`):

```ts
import { getKeysByPack, getQuaterniusEntry } from "./systems/quaternius-asset-manifest";

// Get all prop keys
const props = getKeysByPack("fantasy-props");

// Get metadata for a specific asset
const knight = getQuaterniusEntry("qKnight");
// → { key: "qKnight", name: "Knight", pack: "ultimate-rpg",
//    category: "character", rigged: true, animated: true,
//    animationGroups: ["Idle", "Walk", "Run", "Attack", "Death", "Hit"] }
```

All loads are fire-and-forget.  If an asset fails to load, the callback
receives `null` — callers should always provide a procedural mesh fallback.

---

## Quaternius Asset Packs (CC0 Public Domain)

All Quaternius assets are **CC0 (Public Domain)** — no attribution required,
free for commercial use.  They are self-hosted under `model/quaternius/`
(configurable via `setQuaterniusBasePath()`).

### Fantasy Props Mega Kit

| Key | Description | Path | Format |
|-----|-------------|------|--------|
| `qBarrel` | Wooden barrel — tavern / warehouse prop | `props/Barrel.glb` | GLB |
| `qCrate` | Wooden crate — warehouse / dungeon prop | `props/Crate.glb` | GLB |
| `qChest` | Treasure chest — loot container | `props/Chest.glb` | GLB |
| `qTable` | Wooden table — interior furniture | `props/Table.glb` | GLB |
| `qChair` | Wooden chair — interior furniture | `props/Chair.glb` | GLB |
| `qBench` | Wooden bench — tavern / exterior seating | `props/Bench.glb` | GLB |
| `qShelf` | Wooden shelf — shop / house interior | `props/Shelf.glb` | GLB |
| `qBookshelf` | Bookshelf — library / mage tower prop | `props/Bookshelf.glb` | GLB |
| `qBed` | Bed — inn / house interior | `props/Bed.glb` | GLB |
| `qAnvil` | Anvil — blacksmith workshop prop | `props/Anvil.glb` | GLB |
| `qForge` | Forge — blacksmith workshop prop | `props/Forge.glb` | GLB |
| `qAltar` | Stone altar — temple / dungeon shrine | `props/Altar.glb` | GLB |
| `qWell` | Stone well — village / courtyard prop | `props/Well.glb` | GLB |
| `qFountain` | Stone fountain — plaza / garden centrepiece | `props/Fountain.glb` | GLB |
| `qMarketStall` | Market stall — open-air vendor stand | `props/MarketStall.glb` | GLB |
| `qSignPost` | Signpost — road / settlement directional marker | `props/SignPost.glb` | GLB |
| `qLantern` | Hanging lantern — exterior lighting prop | `props/Lantern.glb` | GLB |
| `qCauldron` | Cauldron — alchemy / witch hut prop | `props/Cauldron.glb` | GLB |
| `qFlag` | Wall-mounted flag / banner — castle decoration | `props/Flag.glb` | GLB |
| `qBannerStand` | Freestanding banner — camp / garrison decoration | `props/BannerStand.glb` | GLB |

### Stylized Nature Mega Kit

| Key | Description | Path | Format |
|-----|-------------|------|--------|
| `qOakTree` | Deciduous oak tree — temperate forest | `nature/OakTree.glb` | GLB |
| `qPineTree` | Conifer pine tree — boreal / mountain | `nature/PineTree.glb` | GLB |
| `qWillowTree` | Willow tree — swamp / lakeside | `nature/WillowTree.glb` | GLB |
| `qDeadTree` | Dead tree — wasteland / haunted area | `nature/DeadTree.glb` | GLB |
| `qBushLarge` | Large shrub — undergrowth / hedge | `nature/BushLarge.glb` | GLB |
| `qBushSmall` | Small bush — ground cover | `nature/BushSmall.glb` | GLB |
| `qFern` | Fern — forest floor vegetation | `nature/Fern.glb` | GLB |
| `qFlowerRed` | Red flower cluster — meadow decoration | `nature/FlowerRed.glb` | GLB |
| `qFlowerBlue` | Blue flower cluster — meadow decoration | `nature/FlowerBlue.glb` | GLB |
| `qGrassClump` | Tall grass clump — field / prairie | `nature/GrassClump.glb` | GLB |
| `qRockLarge` | Large boulder — terrain obstacle / cover | `nature/RockLarge.glb` | GLB |
| `qRockMedium` | Medium rock — terrain scatter | `nature/RockMedium.glb` | GLB |
| `qRockSmall` | Small rock — terrain detail | `nature/RockSmall.glb` | GLB |
| `qStump` | Tree stump — logged forest / clearing | `nature/Stump.glb` | GLB |
| `qLog` | Fallen log — forest floor obstacle | `nature/Log.glb` | GLB |
| `qMushroom` | Mushroom cluster — forest / cave decoration | `nature/Mushroom.glb` | GLB |

### Ultimate RPG Characters (Rigged + Animated)

All character models contain embedded AnimationGroup clips (Idle, Walk, Run,
Attack, Death, Hit — some also include Cast).

| Key | Description | Path | Format | Animation Groups |
|-----|-------------|------|--------|-----------------|
| `qKnight` | Knight — armoured melee NPC | `characters/Knight.glb` | GLB | Idle, Walk, Run, Attack, Death, Hit |
| `qMage` | Mage — robed caster NPC | `characters/Mage.glb` | GLB | Idle, Walk, Run, Attack, Death, Hit, Cast |
| `qRogue` | Rogue — light-armour NPC | `characters/Rogue.glb` | GLB | Idle, Walk, Run, Attack, Death, Hit |
| `qArcher` | Archer — ranged NPC | `characters/Archer.glb` | GLB | Idle, Walk, Run, Attack, Death, Hit |
| `qBarbarian` | Barbarian — heavy melee NPC | `characters/Barbarian.glb` | GLB | Idle, Walk, Run, Attack, Death, Hit |
| `qVillagerMale` | Male villager — civilian NPC | `characters/VillagerMale.glb` | GLB | Idle, Walk, Run, Death |
| `qVillagerFemale` | Female villager — civilian NPC | `characters/VillagerFemale.glb` | GLB | Idle, Walk, Run, Death |
| `qGuard` | Town guard — law enforcement NPC | `characters/Guard.glb` | GLB | Idle, Walk, Run, Attack, Death, Hit |
| `qMerchant` | Merchant — shopkeeper NPC | `characters/Merchant.glb` | GLB | Idle, Walk, Run, Death |
| `qInnkeeper` | Innkeeper — tavern NPC | `characters/Innkeeper.glb` | GLB | Idle, Walk, Run, Death |

### Animated Monsters (Rigged + Animated)

All creatures contain embedded AnimationGroup clips.

| Key | Description | Path | Format | Scale | Animation Groups |
|-----|-------------|------|--------|-------|-----------------|
| `qSkeleton` | Skeleton — undead creature | `monsters/Skeleton.glb` | GLB | 1.0× | Idle, Walk, Run, Attack, Death, Hit |
| `qSpider` | Giant spider — cave / dungeon | `monsters/Spider.glb` | GLB | 0.8× | Idle, Walk, Run, Attack, Death, Hit |
| `qSlime` | Slime — low-level dungeon | `monsters/Slime.glb` | GLB | 0.6× | Idle, Walk, Attack, Death, Hit |
| `qGoblin` | Goblin — humanoid enemy | `monsters/Goblin.glb` | GLB | 0.85× | Idle, Walk, Run, Attack, Death, Hit |
| `qOrc` | Orc — humanoid enemy | `monsters/Orc.glb` | GLB | 1.1× | Idle, Walk, Run, Attack, Death, Hit |
| `qTroll` | Troll — large dungeon creature | `monsters/Troll.glb` | GLB | 1.5× | Idle, Walk, Run, Attack, Death, Hit |
| `qDragonSmall` | Small dragon — mid-tier flying | `monsters/DragonSmall.glb` | GLB | 1.8× | Idle, Walk, Run, Attack, Death, Hit |
| `qWolf` | Wolf — wilderness creature | `monsters/Wolf.glb` | GLB | 0.7× | Idle, Walk, Run, Attack, Death, Hit |
| `qBat` | Bat — cave / dungeon ambient | `monsters/Bat.glb` | GLB | 0.4× | Idle, Walk, Attack, Death |
| `qGhost` | Ghost — undead / haunted area | `monsters/Ghost.glb` | GLB | 1.0× | Idle, Walk, Attack, Death, Hit |

### Modular Character Outfits

Modular armour/clothing pieces that attach to a base humanoid character mesh.
Managed by `EquipmentVisualSystem` (`src/systems/equipment-visual-system.ts`).

| Key | Description | Slot | Path | Format |
|-----|-------------|------|------|--------|
| `qHelmetLight` | Light helmet — leather | head | `outfits/HelmetLight.glb` | GLB |
| `qHelmetHeavy` | Heavy helmet — plate | head | `outfits/HelmetHeavy.glb` | GLB |
| `qHelmetMage` | Mage hood — cloth | head | `outfits/HelmetMage.glb` | GLB |
| `qChestLight` | Light chest — leather cuirass | chest | `outfits/ChestLight.glb` | GLB |
| `qChestHeavy` | Heavy chest — plate cuirass | chest | `outfits/ChestHeavy.glb` | GLB |
| `qChestRobe` | Mage robe — cloth | chest | `outfits/ChestRobe.glb` | GLB |
| `qLegsLight` | Light greaves — leather | legs | `outfits/LegsLight.glb` | GLB |
| `qLegsHeavy` | Heavy greaves — plate | legs | `outfits/LegsHeavy.glb` | GLB |
| `qBootsLight` | Light boots — leather | feet | `outfits/BootsLight.glb` | GLB |
| `qBootsHeavy` | Heavy boots — plate sabatons | feet | `outfits/BootsHeavy.glb` | GLB |
| `qCloakShort` | Short cloak — shoulder cape | back | `outfits/CloakShort.glb` | GLB |
| `qCloakLong` | Long cloak — full-length cape | back | `outfits/CloakLong.glb` | GLB |
| `qShield` | Round shield — melee off-hand | offhand | `outfits/Shield.glb` | GLB |
| `qShieldTower` | Tower shield — heavy off-hand | offhand | `outfits/ShieldTower.glb` | GLB |

### Universal Animation Library 1 & 2

Standalone animation clips designed for Mixamo-compatible rigs.  Can be
retargeted onto any humanoid character skeleton.

| Key | Description | Path | Format | Animation Group |
|-----|-------------|------|--------|----------------|
| `qAnimIdle` | Idle — relaxed standing | `animations/Idle.glb` | GLB | Idle |
| `qAnimWalk` | Walk — standard locomotion | `animations/Walk.glb` | GLB | Walk |
| `qAnimRun` | Run — fast locomotion | `animations/Run.glb` | GLB | Run |
| `qAnimAttackMelee` | Melee attack — sword swing | `animations/AttackMelee.glb` | GLB | AttackMelee |
| `qAnimAttackRanged` | Ranged attack — bow draw | `animations/AttackRanged.glb` | GLB | AttackRanged |
| `qAnimDeath` | Death — fall-down | `animations/Death.glb` | GLB | Death |
| `qAnimHit` | Hit react — flinch | `animations/Hit.glb` | GLB | Hit |
| `qAnimDodge` | Dodge — side-step | `animations/Dodge.glb` | GLB | Dodge |
| `qAnimCast` | Spellcast — magic gesture | `animations/Cast.glb` | GLB | Cast |
| `qAnimBlock` | Block — shield raise | `animations/Block.glb` | GLB | Block |
| `qAnimPickup` | Pickup — bend and grab | `animations/Pickup.glb` | GLB | Pickup |
| `qAnimSit` | Sit — chair / bench idle | `animations/Sit.glb` | GLB | Sit |

---

## New Systems for Quaternius Assets

### SkeletalAnimationSystem

`src/systems/skeletal-animation-system.ts` — Drives BabylonJS AnimationGroup
clips on rigged GLB models.  Complements the procedural `AnimationSystem`
(which works on capsule meshes via scaling/rotation keyframes).

```ts
const skelAnim = new SkeletalAnimationSystem();
skelAnim.registerCharacter("npc_01", {
  Idle: scene.getAnimationGroupByName("Idle")!,
  Walk: scene.getAnimationGroupByName("Walk")!,
  Run:  scene.getAnimationGroupByName("Run")!,
  Attack: scene.getAnimationGroupByName("Attack")!,
  Death: scene.getAnimationGroupByName("Death")!,
  Hit: scene.getAnimationGroupByName("Hit")!,
});
skelAnim.play("npc_01", "Idle", true);
skelAnim.updateFromAIState("npc_01", "CHASE", false, false, false);
```

### EquipmentVisualSystem

`src/systems/equipment-visual-system.ts` — Manages visual outfit piece
attachment/detachment on character meshes.  Tracks which asset is equipped
in each slot (head, chest, legs, feet, back, offhand).

```ts
const equipVis = new EquipmentVisualSystem();
equipVis.onOutfitAttach = (characterId, slot, assetKey) => {
  // Load and parent the outfit mesh to the character skeleton
};
equipVis.onOutfitDetach = (characterId, slot) => {
  // Remove the outfit mesh from the character
};
equipVis.registerCharacter("player");
equipVis.equip("player", "head", "qHelmetHeavy");
equipVis.equip("player", "chest", "qChestHeavy");
```

---

## Integrated Assets (BabylonJS CDN)

These assets are registered in `FantasyAssetLoader` and ready to use via their
`FantasyAssetKey`.

### Characters & Creatures

| Key | Description | CDN Path | Format |
|-----|-------------|----------|--------|
| `elfAnimated` | Animated elf — humanoid NPC with full animation set | `Elf/Elf_allAnimations.gltf` | glTF |
| `elfRun` | Elf run cycle — locomotion animation variant | `Elf/Elf_run.gltf` | glTF |
| `elfDie` | Elf death animation — NPC death variant | `Elf/Elf_die.gltf` | glTF |
| `dude` | Animated humanoid — generic NPC / villager | `Dude/dude.babylon` | Babylon |
| `dragon` | Georgia Tech dragon — rare world encounter (scale 2×) | `Georgia-Tech-Dragon/dragon.glb` | GLB |
| `seagull` | Seagull — ambient coastal creature | `seagulf.glb` | GLB |
| `fish` | Fish — market stall / fishing prop | `fish.glb` | GLB |

### Weapons

| Key | Description | CDN Path | Format |
|-----|-------------|----------|--------|
| `runeSword` | Rune-inscribed longsword — high-tier loot | `Demos/weaponsDemo/meshes/runeSword.glb` | GLB |
| `frostAxe` | Frost-enchanted axe — ice dungeon loot | `Demos/weaponsDemo/meshes/frostAxe.glb` | GLB |
| `moltenDagger` | Molten obsidian dagger — assassin loot | `Demos/weaponsDemo/meshes/moltenDagger.glb` | GLB |

### Structures

| Key | Description | CDN Path | Format |
|-----|-------------|----------|--------|
| `cottage` | Thatched roof cottage — settlement building | `cottage.glb` | GLB |
| `inn` | Roadside inn — settlement building | `inn.glb` | GLB |
| `hauntedHouse` | Haunted house — ruins/fort variant | `haunted_house.glb` | GLB |
| `mausoleum` | Stone mausoleum — graveyard structure | `mausoleumLarge.glb` | GLB |
| `pirateFort` | Fort structure — bandit camp / ruins | `pirateFort/pirateFort.glb` | GLB |
| `houseScene` | Single house scene — hamlet / farmstead | `house_scene.glb` | GLB |
| `bothHousesScene` | Two-house scene — small settlement | `both_houses_scene.glb` | GLB |

### Scenes & Settlements

| Key | Description | CDN Path | Format |
|-----|-------------|----------|--------|
| `village` | Village cluster — settlement scene | `village.glb` | GLB |
| `valleyVillage` | Valley village with terrain — large settlement | `valleyvillage.glb` | GLB |
| `graveYardScene` | Graveyard scene — cemetery near ruins | `graveyardScene.glb` | GLB |

### Props & Decorations

| Key | Description | CDN Path | Format |
|-----|-------------|----------|--------|
| `obelisk` | Ancient obelisk — shrine / standing stone | `obelisk1.glb` | GLB |
| `cannon` | Cannon — fort / siege decoration | `pirateFort/cannon.glb` | GLB |
| `explodingBarrel` | Barrel — interactive prop / dungeon hazard | `ExplodingBarrel.glb` | GLB |
| `skull` | Skull — dungeon / necromancer decoration (scale 0.5×) | `skull.babylon` | Babylon |
| `lamp` | Oil lamp — interior lighting prop | `lamp.babylon` | Babylon |
| `candle` | Candle — interior / shrine decoration | `candle.babylon` | Babylon |
| `hexTile` | Hex tile — modular terrain piece | `hexTile.glb` | GLB |

---

## Additional CDN Assets (Not Yet Integrated)

The BabylonJS Assets CDN contains many more models that could be added to the
catalogue.  Below are candidates that may be useful for Camelot but have not
yet been integrated into `FantasyAssetLoader`.

### Characters

| Asset | CDN Path | Notes |
|-------|----------|-------|
| `HVGirl.glb` | `HVGirl.glb` | Animated female character |
| `alien.glb` | `alien.glb` | Could serve as a Daedra/demon variant |
| `Rabbit.babylon` | `Rabbit.babylon` | Wildlife / pet candidate |
| `shark.glb` | `shark.glb` | Underwater encounter creature |

### Environments

| Asset | CDN Path | Notes |
|-------|----------|-------|
| `snowField.glb` | `Demos/Snow_Man_Scene/snowField.glb` | Snowy terrain patch |
| `underwaterScene.glb` | `Demos/UnderWaterScene/underwaterScene.glb` | Underwater dungeon environment |
| `underwaterSceneNavMesh.glb` | `Demos/UnderWaterScene/navMesh/underwaterSceneNavMesh.glb` | Pre-built navmesh for underwater area |

### Props

| Asset | CDN Path | Notes |
|-------|----------|-------|
| `D20_Animation.glb` | `D20_Animation.glb` | Animated die — gambling / tavern prop |
| `pumpkinBucketCarved.glb` | `pumpkinBucketCarved.glb` | Seasonal decoration |
| `SheenChair.glb` | `SheenChair.glb` | Furniture — interior prop |

---

## Adding New Assets

### BabylonJS CDN Assets

To add a new asset from the CDN:

1. Find the asset in the
   [BabylonJS/Assets catalogue](https://github.com/BabylonJS/Assets/blob/master/Assets.md).
2. Add a new entry to the `FantasyAssetKey` union type in
   `src/systems/fantasy-asset-loader.ts`.
3. Add its CDN URL to `ASSET_URLS`.
4. Optionally add a scale override in `ASSET_SCALE` (defaults to 1.0).
5. Update this document with the new entry.

### Quaternius Assets

To add a new asset from a Quaternius pack:

1. Download the pack from [quaternius.com](https://quaternius.com).
2. Convert FBX → GLB if needed (using Blender or `fbx2gltf`).
3. Place the GLB in the appropriate `public/model/quaternius/` subdirectory:
   - `props/` — static props and furniture
   - `nature/` — vegetation and terrain objects
   - `characters/` — rigged humanoid characters
   - `monsters/` — rigged creature models
   - `outfits/` — modular armour/clothing pieces
   - `animations/` — standalone animation clips
4. Add a new entry to `FantasyAssetKey` in `fantasy-asset-loader.ts`.
5. Add an entry to `QuaterniusAssetManifest` in `quaternius-asset-manifest.ts`.
6. For animated assets, list the embedded `AnimationGroup` names.
7. Update this document.

---

## Licensing

### BabylonJS Assets (CC BY 4.0)

All assets from [BabylonJS/Assets](https://github.com/BabylonJS/Assets) are
licensed under
[Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/)
unless otherwise specified in the asset's folder.  This means:

- **Free to use** — in commercial and non-commercial projects.
- **Attribution required** — credit "Babylon.js" or the original author.
- **Modifications allowed** — you may adapt the assets.

Individual asset folders in the source repository may contain their own
`LICENSE` file with different terms.  Always check the source folder when
adding a new asset.

### Quaternius Assets (CC0 Public Domain)

All Quaternius assets are released under
[CC0 1.0 Universal (Public Domain)](https://creativecommons.org/publicdomain/zero/1.0/).
This means:

- **No attribution required** — though credit to Quaternius is appreciated.
- **Free for any use** — commercial, personal, modification, redistribution.
- **No restrictions** — no copyleft, no share-alike requirements.

Source: [quaternius.com](https://quaternius.com)
