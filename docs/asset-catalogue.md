# BabylonJS Asset Catalogue

This document catalogues fantasy RPG assets available from the
[BabylonJS Assets CDN](https://assets.babylonjs.com/meshes/) for use in
Camelot.  All assets listed here come from the
[BabylonJS/Assets](https://github.com/BabylonJS/Assets) repository and are
licensed **CC BY 4.0** unless otherwise noted in the asset folder.

---

## How to Use

Assets are loaded via `FantasyAssetLoader` (`src/systems/fantasy-asset-loader.ts`).

```ts
// Preload specific assets at startup
assetLoader.preload(["cottage", "pirateFort", "elfAnimated"]);

// Request an instance (fires callback when ready, or immediately if cached)
assetLoader.getInstance("cottage", (root, meshes) => {
  if (root) {
    root.position = new Vector3(x, y, z);
  }
});

// Preload the entire catalogue
assetLoader.preloadAll();
```

All loads are fire-and-forget.  If an asset fails to load, the callback
receives `null` — callers should always provide a procedural mesh fallback.

---

## Integrated Assets

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
| `HVGirl.glb` | `meshes/HVGirl.glb` | Animated female character |
| `alien.glb` | `meshes/alien.glb` | Could serve as a Daedra/demon variant |
| `Rabbit.babylon` | `meshes/Rabbit.babylon` | Wildlife / pet candidate |
| `shark.glb` | `meshes/shark.glb` | Underwater encounter creature |

### Environments

| Asset | CDN Path | Notes |
|-------|----------|-------|
| `snowField.glb` | `meshes/Demos/Snow_Man_Scene/snowField.glb` | Snowy terrain patch |
| `underwaterScene.glb` | `meshes/Demos/UnderWaterScene/underwaterScene.glb` | Underwater dungeon environment |
| `underwaterSceneNavMesh.glb` | `meshes/Demos/UnderWaterScene/navMesh/underwaterSceneNavMesh.glb` | Pre-built navmesh for underwater area |

### Props

| Asset | CDN Path | Notes |
|-------|----------|-------|
| `D20_Animation.glb` | `meshes/D20_Animation.glb` | Animated die — gambling / tavern prop |
| `pumpkinBucketCarved.glb` | `meshes/pumpkinBucketCarved.glb` | Seasonal decoration |
| `SheenChair.glb` | `meshes/SheenChair.glb` | Furniture — interior prop |

---

## Adding New Assets

To add a new asset from the CDN:

1. Find the asset in the
   [BabylonJS/Assets catalogue](https://github.com/BabylonJS/Assets/blob/master/Assets.md).
2. Add a new entry to the `FantasyAssetKey` union type in
   `src/systems/fantasy-asset-loader.ts`.
3. Add its CDN URL to `ASSET_URLS`.
4. Optionally add a scale override in `ASSET_SCALE` (defaults to 1.0).
5. Update this document with the new entry.

---

## Licensing

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
