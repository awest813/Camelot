# Asset Provenance

Camelot uses three asset lanes:

1. **Brand & Identity Assets**: High-resolution Camelot game crest icon (`public/camelot-icon.png`), scalable vector SVG favicon (`public/favicon.svg`), and banner splash art (`public/camelot-logo.png`).
2. **Open-source / Runtime 3D Assets**: Referenced by `FantasyAssetLoader` from the BabylonJS Assets CDN (CC BY 4.0).
3. **Quaternius CC0 models** in `public/model/quaternius/` (50 catalogue slots + NPC humans), with generated stand-ins for the slots no free pack covers.

## Brand & UI Identity Assets

- `public/camelot-icon.png`: High-resolution Arthurian crest featuring a glowing golden crown and sword on a royal navy and gold heraldic shield.
- `public/camelot-touch-icon.png`: the crest at 180 px (15 KB), the touch icon and PNG favicon fallback; the 1024 px original (462 KB) used to load with every page.
- `public/favicon.svg`: Vector SVG favicon providing crisp rendering at all tab sizes (16px, 32px, retina).
- `public/camelot-logo.png`: Full game title banner and crest.
- `public/logo_babylonpress.png`: Kept for backwards compatibility and updated with the Camelot crest.

## Open-source asset sources

### BabylonJS Assets CDN

- Source: https://github.com/BabylonJS/Assets
- Runtime base URL: https://assets.babylonjs.com/meshes/
- License: CC BY 4.0 unless an individual asset folder states otherwise.
- Integration: absolute CDN URLs in `src/systems/fantasy-asset-loader.ts`.

These assets require attribution in shipped builds.

### Horse (rigged, animated)

- File: `public/model/horse/Horse.glb`, the horses you buy from the ostler and ride.
- Source: `horsestylizedchestnut.blend`, supplied by the project owner (its licence is theirs to record here).
- Contents: a stylized chestnut horse (about 3,000 polygons, 71 bones) with idle, walk and run clips
  (the file's "lie" clip is left out: the game never lays a horse down).
- Conversion: exported to glTF with Blender 5.0 (its Diffuse shaders swapped for Principled so the
  textures carry; clips sampled every second frame), then `node tools/optimize-models.mjs` (meshopt
  geometry, WebP textures): 1.6 MB → 0.3 MB.
- The Black Stallion is the same model with its coat tinted dark in code (`HORSE_MODEL_TINT`).

### KayKit Adventurers (rigged NPC characters)

- Source: https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0 (Kay Lousberg, www.kaylousberg.com)
- License: CC0 1.0 Universal (`public/model/kaykit/LICENSE.txt`). Credit appreciated, not required.
- Integration: `public/model/kaykit/*.glb`. Undead NPCs (Skeleton_*) still use them via
  `src/rendering/character-models.ts`; living humans moved to Quaternius. All KayKit textures are
  dark-graded by `tools/grade-kaykit-textures.mjs` (idempotent; marks graded files).
- The GLBs are compacted to the 19 animation clips the game plays (idle, walk, run, combat
  stance, attacks, block, hit, death, cheer, spellcast, ranged shoot, interact, sit) with
  `tools/compact-glb.py`. Re-run it against the upstream files to add clips.

### Procedural surfaces

- Every terrain/structure/foliage texture and normal map is synthesized at load time by
  `src/rendering/texture-synth.ts` (no image assets).

### Quaternius (characters, props, nature)

- Source: https://quaternius.com — free Standard versions (CC0 1.0) of Fantasy Props MegaKit,
  Medieval Village MegaKit, Stylized Nature MegaKit, Modular Character Outfits – Fantasy,
  Universal Base Characters, Universal Animation Library, Characters – Fantasy Races and
  Bestiary – Dungeon Monsters Kit (downloaded from quaternius.itch.io).
- Integration: `public/model/quaternius/<pack>/<Slot>.glb`, imported by
  `tools/import-quaternius.mjs` from the unzipped packs using `tools/quaternius-slot-map.json`
  (which model fills which catalogue slot). The tool:
  - repacks each glTF as a GLB whose textures live in `<pack>/textures/<sourcePack>/`
    (shared trim sheets ship once; Babylon rejects `..` in glTF URIs);
  - downscales textures to 1024 px JPEG and applies the dark-fantasy grade to base-colour maps;
  - unpacks embedded GLB textures the same way (Fantasy Races characters were ~11 MB each);
  - splices heads (cut from Universal Base Characters with `minY`) and rigged hair onto the
    headless outfit characters, bound to the outfit's skin (same 65-bone rig).
- `quaternius-import-manifest.json` records slot → source model.
- NPC humans (`src/rendering/character-models.ts`) are these outfit characters, animated by
  `public/model/quaternius/animations/UAL_Clips.glb` — the Universal Animation Library compacted
  to 14 clips with `tools/compact-glb.py` and retargeted onto each rig by bone name.
- Re-import: download the packs, unzip each into `<dir>/<pack-folder>` (folder names as in the
  slot map), then `PW_CHROMIUM_PATH=<chromium> npm run assets:quaternius -- <dir>`.

## Generated filler assets

Slots with no imported Quaternius model (e.g. Well, Fountain, Stump, Log, Wolf, Spider, heavy armour pieces) keep stylized, low-poly GLB stand-ins created by (imported slots are skipped, colours use the same dark grade):

```sh
npm run assets:filler
```

The generator (`tools/generate-filler-assets.mjs`) builds custom, distinctive low-poly meshes and tuned PBR materials for all 82 slots:
- **Nature**: Stepped conical pine trees, weeping willows with drape cascades, multi-lobed oak trees, gnarled dead trees, faceted boulders with natural clefts, and rimmed mushrooms.
- **Monsters**: Quadruped wolves with snouts and tails, winged bats with flight membranes, ethereal floating hooded ghosts with wispy tails, tusked orcs with spiked pauldrons, small lateral-eared goblins, towering long-armed trolls, bone skeletons, and horned dragons.
- **Characters**: Knights with great helms and shields, mages with pointed wizard hats and arcane staffs, archers with back quivers and bows, brawny horned barbarians, town guards with kettle helms and halberds, merchants with trade satchels, innkeepers with serving aprons and ale tankards, and peasant villagers.
- **Props**: Market stalls with pitched striped awnings, tiered bookshelves filled with books, ornate beds with quilts and pillows, directional arrow signposts, and stone wells.
- **Outfits**: Great helms, wizard hats, round bucklers, and tall kite shields.

Replace a filler by dropping the real asset at the same path. Keep filenames
stable so `FantasyAssetLoader` continues to resolve existing keys.
