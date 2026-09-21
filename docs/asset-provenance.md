# Asset Provenance

Camelot uses three asset lanes:

1. **Brand & Identity Assets**: High-resolution Camelot game crest icon (`public/camelot-icon.png`), scalable vector SVG favicon (`public/favicon.svg`), and banner splash art (`public/camelot-logo.png`).
2. **Open-source / Runtime 3D Assets**: Referenced by `FantasyAssetLoader` from the BabylonJS Assets CDN (CC BY 4.0).
3. **Generated Stylized Filler Assets**: Checked into `public/model/quaternius/` for all 82 Quaternius CC0 catalogue slots.

## Brand & UI Identity Assets

- `public/camelot-icon.png`: High-resolution Arthurian crest featuring a glowing golden crown and sword on a royal navy and gold heraldic shield.
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

### Quaternius

- Source: https://quaternius.com
- License: CC0 1.0 Universal / public domain.
- Integration target: `public/model/quaternius/`.

The real Quaternius GLBs can be dropped into `public/model/quaternius/` at any time.

## Generated filler assets

Generated fillers are stylized, low-poly GLB files created by:

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
