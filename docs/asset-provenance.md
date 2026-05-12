# Asset Provenance

Camelot currently uses two asset lanes:

1. Open-source/runtime assets referenced by `FantasyAssetLoader`.
2. Generated filler assets checked into `public/model/quaternius/` so the
   Quaternius catalogue has visible stand-ins during development.

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

The real Quaternius GLBs are not bundled here yet. The checked-in files under
`public/model/quaternius/` are generated placeholders with matching filenames.

## Generated filler assets

Generated fillers are static, low-poly GLB files created by:

```sh
node tools/generate-filler-assets.mjs
```

They are intentionally simple stand-ins for editor/browser work and world
population tests. Rigged or animated catalogue entries keep their expected
metadata in `QuaterniusAssetManifest`, but the filler GLBs do not contain
skeletons or animation clips.

Replace a filler by dropping the real asset at the same path. Keep filenames
stable so `FantasyAssetLoader` continues to resolve existing keys.
