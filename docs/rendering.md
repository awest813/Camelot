# Rendering

Camelot's look: an original-Xbox-era open world (bump-mapped surfaces,
alpha-card foliage, rigged characters, lens flares) with modern effects
(HDR bloom, SSAO, cascaded soft shadows, god rays, colour grading, particles).
Everything lives in `src/rendering/`; `game.ts` wires it up.

| Module | What it does |
|---|---|
| `texture-synth.ts` | Tileable fBm/Worley texture synthesis: albedo + height → normal maps for every surface (ground, stone, bark, foliage, leaf/grass/palm cut-outs). No image assets. |
| `systems/procedural-texture-manager.ts` | Caches the synthesized textures. `applySurface(mat, kind, u, v)` attaches albedo + normal map and a near-white tint. Shared textures are retiled through `getView()` — never mutate `uScale`/`vScale` on a cached texture. |
| `atmosphere.ts` | Pure time-of-day model: sun/moon arcs, light colours, sky gradient, fog (= horizon colour), stars, exposure. Unit-tested. |
| `sky-dome.ts` | Sky shader (gradient, HDR sun disc, moon, stars, domain-warped clouds) + `AtmosphereController`, which drives sun/hemi lights and fog every frame on top of `WeatherSystem`. |
| `horizon.ts` | Two parallax mountain rings far outside the streamed world, sun-lit with snow caps and aerial perspective. |
| `terrain-material.ts` | StandardMaterial plugin for the shared ground material: per-vertex biome weights (soft biome transitions), world-space anti-tiled sampling, blended normal maps. |
| `foliage.ts` | Wind plugin (sway, gusts, leaf flutter, dithered distance fade); pine / broadleaf / palm builders using alpha-tested leaf cards with spherical normals; thin-instanced `GrassField`. |
| `character-models.ts` | Rigged NPCs from the CC0 KayKit Adventurers + Skeletons packs. The physics capsule stays (invisible, pickable); the rig follows, faces travel or the player, and plays skeletal clips routed through `AnimationSystem.registerSkeletal`. |
| `viewmodel.ts` | First-person weapon/shield (KayKit CC0) on render group 1: bob, sway, swing arcs, guard pose. |
| `particles-fx.ts` | Torch/campfire fire, embers, smoke, flicker, nearest-N point-light management; rain, tundra snow, lightning, dust motes, fireflies. |
| `render-pipeline.ts` | Cascaded PCF shadows; HDR `DefaultRenderingPipeline` (bloom, FXAA/MSAA, sharpen, PBR-neutral tone mapping, colour curves, vignette, grain, chromatic aberration); SSAO2; god rays; lens flare. |

## Quality tiers

`GraphicsSystem` (`systems/graphics-system.ts`) picks a tier from hardware
hints or the saved setting. `effects` gates the expensive parts:

| | low | medium | high | ultra |
|---|---|---|---|---|
| Post stack | off | on | on | on |
| Shadows | 512 single map | 2 cascades | 3 cascades | 4 cascades, 2048 |
| SSAO | – | – | ✓ | ✓ |
| God rays | – | – | – | ✓ |
| Grass density | 0 | 0.5 | 1.0 | 1.5 |
| Texture size / normal maps | 128 / off | 128 | 256 | 512 |

MSAA is ignored while SSAO is on (it forms a framebuffer feedback loop with
the prepass); FXAA covers anti-aliasing instead.

## Performance

Measured in the live game at the high tier (headless; draw calls and CPU
timings are meaningful, GPU time is not):

| | before | after |
|---|---|---|
| Draw calls / frame | 412 | ~232 |
| — of which shadow passes | 306 | ~144 |
| Forest chunk build | 16–37 ms | 6–10 ms |
| Texture synthesis on main thread at load | 0.6 s (high) / 2.3 s (ultra) | ~0 (Web Worker) |

What keeps it there:

- **Batching.** Trees append into one geometry builder per material per
  chunk (`FoliageBatch`); structure pieces merge per material per chunk
  (`StructureManager.mergeStatic`, physics pieces stay as invisible colliders);
  KayKit characters keep one item per hand slot and merge skinned parts
  (`optimizeCharacterContainer`).
- **Shadows.** Tiny props don't cast; grass never casts.
- **Streaming.** Grass patches are built nearest-first, two per frame;
  `getBiome` is memoized; the leaf builder is allocation-free.
- **Raycasts.** `Player.raycastForward` respects `isPickable`; decorative
  meshes (sky, horizon, grass, tree batches) opt out.
- **Adaptive resolution** (`adaptive-resolution.ts`) raises the hardware
  scaling level when FPS stays under the tier's target and recovers with
  headroom. `localStorage.camelot_adaptive_res = "0"` pins it.
- **Tier detection** also reads the WebGL renderer: software rasterizers and
  mobile GPUs start on low, integrated GPUs are capped at medium.

Profiling: `PERF_PROFILE=1 npx playwright test perf-profile` records a
main-thread CPU profile of real gameplay and prints the hottest functions.

## Gotchas learned the hard way

- GLSL `smoothstep(e0, e1, x)` with `e0 >= e1` is undefined — SwiftShader
  returns 1 everywhere. Write `1.0 - smoothstep(e1, e0, x)`.
- Cut-out StandardMaterials with an explicit `transparencyMode` alpha-test
  the *final* alpha: set `useAlphaFromDiffuseTexture = true`.
- Thin-instance buffers live on the geometry; cloned meshes need
  `makeGeometryUnique()` before getting their own instances.
- `updateVerticesData` silently does nothing on non-updatable buffers
  (e.g. `CreateGround`); use `setVerticesData` to replace them.
- StandardMaterial lights at most 4 lights per mesh; `FireFx` keeps only the
  nearest torches enabled so far ones don't steal slots from sun + sky.

## Looking at changes

```sh
# Screenshots of the real game into test-results/visual-shots/
VISUAL_SHOTS=1 npx playwright test visual-shots
# Options: VISUAL_TIER=low|medium|high|ultra, VISUAL_QUICK=1 (one frame),
# VISUAL_EVAL='<js run in the page>' — dev builds expose
# window.__camelotGame and window.__camelotScene, e.g. to set the clock:
#   window.__camelotGame.timeSystem.restoreFromSave({ gameTime: 20 * 60 })
# In containers without Playwright's pinned browser: PW_CHROMIUM_PATH=/path/to/chrome
```

Headless runs use SwiftShader (≈1 fps) — fine for looks, useless for
performance numbers.
