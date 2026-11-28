# Start-up overhaul

What the game page loads before its first frame, and how it was cut.

## Measure first

`npm run build` writes `dist/.vite/chunk-modules.json`: every chunk's modules,
their rendered sizes and imports (vite.config.ts `chunkModulesReport`). The
start-up set is the game entry and everything it imports statically.
`node tools/check-bundle.mjs` budgets it:

| budget | what |
|---|---|
| `entry-js` | the game's own code loaded up front (the plan's 900 KB ceiling) |
| `upfront-js` | everything up front: the game's code **and Babylon's** |
| `total-js` | all JS the game page can ever load |
| `largest-js` | the biggest chunk |

`entry-js` alone hid the real cost: Babylon's vendor chunk was 2.6 MB of the 3.5 MB.

## Results

| | before | after |
|---|---|---|
| up-front JS (raw) | 3487 KB | 2258 KB |
| gzip | 895 KB | 599 KB |
| brotli | 700 KB | 475 KB |
| Babylon vendor chunk | 2596 KB | 1409 KB |
| title screen, 20 Mbps | 2.28 s | 1.72 s |
| title screen, 5 Mbps | 6.83 s | 5.17 s |

(Times: Chromium, cache off, a server that sends the physics WebAssembly
uncompressed; a host serving the `.br` copy saves 1.5 MB more.)

## What changed

1. **No Babylon barrels.** `@babylonjs/core/Physics` brought the v1
   Ammo/Cannon/Oimo plugins; Babylon's `MeshBuilder` brings every builder;
   `@babylonjs/loaders/glTF` registers glTF 1.0 and every 2.0 extension (and
   with them FlowGraph, the v1 audio engine, OpenPBR). Import the module that
   defines the thing; models go through `rendering/gltf-loading.ts` (the 2.0
   loader and its extensions as lazy factories, Babylon's own dynamic
   registration) and shapes through `rendering/mesh-builder.ts`. The
   `babylon-barrel-import` guardrail fails the check on a barrel import.
2. **Load what the first frame doesn't need after it.** PBR materials (with
   the first model), the post-processing stack (`rendering/post-fx.ts`), fire
   and weather particles (`particles-fx.ts`, fires queue in
   `fire-fx-port.ts`), the WebGPU engine (only once an adapter exists).
3. **Chunking.** `onlyExplicitManualChunks`, and the editor's Babylon chunk
   takes only modules the game can't reach at all, so a lazy chunk never
   drags in editor code.
4. **Build and page.** ES2022 target; the physics WebAssembly is preloaded
   from the HTML and fetched in parallel with the engine; brotli and gzip
   copies (wasm included); a 15 KB icon instead of a 462 KB one.

## Looked at and left

- **Terser** (as Phaser's custom builds use): 2 KB more than esbuild here.
- **Phaser-style custom engine builds / hand-editing Babylon**: the Babylon
  forum reports ~1 MB that way but calls it fragile; deep imports and lazy
  loading got most of it without forking the engine.
- **Analysers** (rollup-plugin-visualizer, vite-bundle-analyzer, both MIT):
  the chunk report above gives the same per-module sizes without a dependency.

Sources: the Babylon.js forum on tree shaking and dynamic glTF extension
registration; the Phaser 4 Vite template and custom-build guides.
