# Engine overhaul plan

Status: approved direction; decisions recorded below · Scope: the whole client runtime (`src/`), asset pipeline and
test harness · Companion docs: [framework-architecture.md](framework-architecture.md),
[rendering.md](rendering.md)

## Why

Camelot has grown into a large, feature-rich game on an architecture that was
built for a demo. Features still land quickly, but each one now costs more,
and a growing share of the bugs come from the architecture rather than from
the feature itself. Recent audits are typical:

| Bug (recent) | Root cause in the architecture |
|---|---|
| Sky rendered as one flat colour; water and mountains lost their light colours | No rendering abstraction for shader inputs; reference-holding `setColor3` misused in 3 places |
| Distance culling for buildings/props hid nothing | LOD system toggles `isVisible` on whatever it's given; no notion of an "object" vs. its meshes |
| Village job "completed" before payment; stale job entries after loading | Two quest systems (legacy `QuestSystem` + framework quest engine) mirrored by hand |
| Raid townsfolk hidden forever after a load; raiders left behind | Transient state lives in ad-hoc `Set`s in `game.ts`; save/load has no lifecycle for it |
| Raid ending early, animation clashes | NPC identity is the mesh name (random suffix); no entity ids |
| Number keys fired quick slots mid-dialogue; pointer lock juggled per modal | No input contexts or modal stack: every feature handles keys and pointer lock itself |
| Hidden NPCs walking through walls | NPC state is a bag of booleans (`isAggressive`, `isInDialogue`, hidden-ness) read by several systems with different assumptions |

### Where things stand

- **`src/game.ts`: 8,450 lines**, one `Game` class with ~330 members and ~78
  systems as fields. It holds the wiring, the per-frame ordering (the
  gameplay step alone is ~150 lines of hand-ordered calls), the content
  placement for villages, camps and dungeons, and most of the cross-system
  rules.
- **`src/systems/`: 116 files, 43k lines.** The individual systems are mostly
  well tested (5,900 unit tests). Their *composition* is only tested end to
  end.
- **Duplicated subsystems:**
  - quests: `QuestSystem` + framework `QuestEngine`
  - inventory: `InventorySystem` + framework inventory, with gold synced by hand
  - schedules, three layers: `ScheduleSystem`, `DailyScheduleSystem`, `NpcScheduleSystem`
  - NPC AI, three models: combat-system state machine, `npc-ai-state-machine`, `npc-behavior-tree`, plus `xstate` and `mistreevous` as dependencies
  - chunk streaming: `WorldManager` + `ChunkManager`
- **Communication:** systems talk through `onSomething = …` callback
  properties assigned in `game.ts`. The `EventBus` exists, but it has 27
  `emit` calls and **zero subscribers**.
- **Randomness:** 79 unseeded `Math.random` calls. World generation is partly
  seeded per chunk, but gameplay isn't reproducible, which makes bugs hard to
  replay.
- **UI:** two toolkits. There are 38 DOM-based UI modules and a Babylon GUI
  HUD/dialogue layer, each with its own styling, focus and input handling.
- **Bundle:** main chunk 1.45 MB, Babylon vendor 2.9 MB. Recast (556 KB) is
  loaded eagerly. Both the GLSL and the WGSL shader sets ship. Models take
  46 MB uncompressed.

## Goals

1. **Composable runtime.** Features are self-contained modules that register
   with a kernel. `game.ts` becomes a bootstrap of a few hundred lines.
2. **One source of truth per concern:** one quest engine, one inventory, one
   schedule pipeline, one AI model, one streaming system.
3. **Explicit lifecycles.** Every spawned thing has an owner (chunk, scene
   scope, feature) and is released with it. Every piece of state is either
   saved or declared transient, with defined load behaviour.
4. **Determinism.** Seeded RNG streams per world, chunk and system, so a
   seed plus an input log can replay a session.
5. **Rendering as features**, each with quality tiers, budgets and a safe
   shader-uniform API. Instancing by default, and a real asset pipeline.
6. **One UI and input stack**, with input contexts and a modal stack that owns
   pointer lock.
7. **Measurable performance:** budgets for draw calls, frame time, boot time,
   memory and bundle size, enforced in CI.

### Non-goals

- Changing engines (Babylon.js stays) or language (TypeScript stays).
- Rewriting the framework core (`src/framework/*`). It is already pure and
  tested; it becomes the single domain layer.
- A big-bang rewrite. Every phase ships, and the game stays playable and
  green throughout.

## Target architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│ App shell: boot, settings, menus, save slots (DOM UI)                │
├──────────────────────────────────────────────────────────────────────┤
│ Feature modules (plugins): villages · raids · jobs · smithing ·      │
│   combat · stealth · crime · dialogue · travel · weather · editors … │
│   each: components + systems + content + save codec + UI panels      │
├──────────────────────────────────────────────────────────────────────┤
│ Kernel                                                               │
│   phases: input → sim (fixed) → ai → physics → anim → present → ui   │
│   entity store (ids + components) · typed event bus · services       │
│   scopes/ownership · RNG streams · save registry · input contexts    │
├───────────────────────────────┬──────────────────────────────────────┤
│ Domain (src/framework)        │ Platform adapters                    │
│ quests, dialogue, inventory,  │ Babylon render/physics/audio,        │
│ factions, content, mods, save │ storage (web/desktop), Steam         │
└───────────────────────────────┴──────────────────────────────────────┘
```

### Kernel

- **Phase scheduler.** Systems declare a phase and an order
  (`{ phase: "sim", after: ["physics-sync"] }`) instead of the hand-written
  sequence in `_updateGameplayStep`. The fixed-step loop
  (`fixed-step-loop.ts`) drives `sim`; `present` runs per rendered frame.
  Each phase is timed, so the profiler gets per-system cost for free.
- **Entity store: [bitECS](https://github.com/NateTheGreatt/bitECS) 0.4**
  (decided). It uses stable numeric ids, not mesh names. Numeric component
  data lives in bitECS's typed-array stores; Babylon objects (meshes,
  physics bodies, rigs) and strings live in side tables keyed by entity id
  behind small typed accessors, so systems never touch bitECS internals
  directly. Components
  (`Transform`, `Body`, `Rig`, `Actor`, `Schedule`, `CombatState`,
  `Conversation`, `Indoors`, `Inventory`, `Faction`, `ChunkOwned`…) and
  systems query by component set. NPC state stops being a bag of booleans on
  a class. "Hidden indoors" becomes an `Indoors` component that the
  schedule, physics-sync and render systems all respect by construction.
- **Typed event bus.** One `Events` map (`npc.killed`, `item.picked`,
  `dialogue.started`, `hour.changed`, `chunk.unloaded`, …) replaces the
  `onX` callback properties. It has synchronous dispatch, a deferred queue
  for the end of a phase, and subscription handles that are released with
  their scope.
- **Scopes and ownership.** A `Scope` owns entities, meshes, observers,
  timers and subscriptions. Chunk unload, cell exit, raid end and feature
  shutdown each dispose a scope. This removes the "spawned thing outlives its
  reason" class of bugs: raiders, candle lights, colliders, footprints.
- **RNG streams.** `rng("world", seed)`, `rng("chunk", cx, cz)`,
  `rng("loot")`, … Each stream is a seeded generator with a saved state where
  it matters. Combined with an input recorder, this gives deterministic
  replays for bug reports and tests.
- **Services.** Use a small service registry (time, weather, player,
  camera, audio, assets) rather than passing `Game` around. Systems ask for
  what they use, which makes their dependencies visible and testable.

### Domain consolidation

| Concern | Keep | Retire |
|---|---|---|
| Quests | framework `QuestEngine` (graph, triggers, save) | legacy `QuestSystem` (becomes a view model for the quest log) |
| Inventory | framework inventory + item registry | `InventorySystem` state (becomes a view model) |
| Schedules | one `ScheduleSystem` driven by data (`npc-schedule-system` definitions) | `DailyScheduleSystem` interactivity hack and the duplicate hour logic |
| NPC AI | one behaviour model: a behaviour tree selects goals and a steering layer moves the body | the overlapping state machines; fold the one `xstate` user and the one `mistreevous` user into it |
| Streaming | `ChunkManager` (data) + a render adapter | `WorldManager`'s parallel lifecycle |
| Jobs / raids / bounties | framework "radiant quest" templates | the bespoke mirroring in `game.ts` |

### World and simulation

- **Content placement becomes data.** Villages, camps, ruins and inns are
  described by layout specs (as `planVillage` already does) and built by one
  "site builder" that creates entities inside the chunk's scope. Nothing is
  placed by hand-written code in `game.ts`.
- **Navigation: Recast navmesh tiles** (decided). Each streamed chunk gets a
  navmesh tile, built in a worker from the chunk's terrain and colliders,
  with building walls carved out and doorways left open so NPCs can path
  indoors. `recast-detour` is already a dependency; it becomes lazy-loaded. NPC movement becomes path plus steering (seek, arrive, separation,
  obstacle avoidance), as the Yuka evaluation recommended. This replaces the
  walkable-footprint and sidestep heuristics.
- **NPC LOD tiers.** Near NPCs get full AI, animation and physics; mid-range
  NPCs get reduced-rate AI with no physics; far NPCs get a schedule
  simulation only ("off-screen villagers keep their routines").

### Persistence

- **Save registry.** Each feature registers a codec
  (`{ key, version, save(), load(data), migrate(from) }`) and declares its
  transient state with an `onLoad` reset. This replaces the per-system
  setters (`setVillageJobs`, `setVillageRaids`, …) and the optional fields
  on one large save object.
- **Save tests by construction.** A generic round-trip test runs every codec
  against fixtures, and old save fixtures are kept to exercise the migrations.

### Rendering

- **Render features.** Sky, water, terrain, foliage, shadows, post,
  characters and FX become modules with
  `init(tier) / update(frame) / setTier(tier) / dispose()`. Each owns its
  materials and passes its shader inputs through a typed uniform block helper
  (the `UniformCache` pattern, generalised), so values can't be shared by
  reference.
- **Instancing by default.** Static props are already instanced. Next comes
  vegetation and scatter as thin instances in per-chunk buffers, merged static
  geometry per site, and GPU-friendly batching budgets per feature.
- **Shadows.** Keep cascaded maps with per-cascade caster lists, add a caster
  budget per cascade, and use static cached cascades when the sun barely
  moves.
- **Lighting.** Use a clustered light budget instead of the four-nearest
  heuristic in `FireFx`, with proper night lighting for every site type,
  not only villages.
- **WebGPU by default, WebGL2 fallback** (decided). Babylon's built-in
  shaders already ship in WGSL. The game's own shader code doesn't: the sky,
  water and horizon `ShaderMaterial`s, and the terrain and wind material
  plugins. Each gets a WGSL version alongside its GLSL, so no runtime
  GLSL→WGSL transpiler is needed. Babylon would otherwise fetch one from a
  CDN, which breaks offline and desktop builds. Startup feature-detects
  WebGPU (`WebGPUEngine.IsSupportedAsync`), falls back to WebGL2, and keeps
  a setting or URL flag to force either. Only the shader language in use is
  loaded.
- **Asset pipeline.** An offline step will cover:
  - glTF optimisation: meshopt compression, KTX2/Basis textures
  - LOD generation and an asset manifest with per-asset budgets (triangles,
    texture size, materials)
  - provenance tracking (extending `import-quaternius.mjs`)

  Target: cut the 46 MB of models by at least half, and stream assets per
  region.

### UI and input

- **One UI toolkit for menus and panels: Preact + `@preact/signals`**
  (decided). Panels are Preact components that read game state through
  signals fed by kernel events.
  Babylon GUI is kept only for world-space UI such as nameplates and markers.
  Styling comes from one design-token sheet; it's already mostly
  `main.css`.
- **Input contexts.** Gameplay, dialogue, menu, map and editor each map
  physical keys to actions. Only the top context receives input, so number
  keys can't leak to quick slots during dialogue. Rebinding works everywhere.
- **Modal stack.** One manager pushes and pops panels. It owns pointer lock,
  pause, the crosshair and HUD visibility, and the focus trap, replacing the
  hand-maintained lists in `game.ts` (pause cascade, close-all,
  `_isCombatInputBlocked`, `setHtmlOverlayActive`).
- **Camera director.** Gameplay, dialogue framing, cinematics and death cam
  are camera modes on one camera stack. `DialogueCamera` is the first such
  mode.

### Tooling and quality

- **Headless simulation harness.** Run the kernel with stub render and
  physics adapters in Vitest. Feature behaviour (raids, jobs, schedules) can
  then be tested without Playwright.
- **Deterministic replays:** record the seed plus inputs, replay in CI, and
  use the result as a regression test.
- **Performance budgets in CI.** Extend `perf-census.spec.ts` to fail when a
  scene exceeds its budgets. Proposed starting budgets:

  | Scene | Draw calls | Active meshes |
  |---|---|---|
  | Village | ≤ 350 | ≤ 500 |
  | Start area | ≤ 250 | — |

  Also track boot-to-playable time and heap size.
- **Architecture lint.** Dependency rules such as "framework imports no
  Babylon", "features don't import each other, only kernel events and
  services" and "no `Math.random` outside the RNG module", enforced with
  dependency-cruiser and ESLint.
- **Bundle budgets:** main chunk ≤ 900 KB, with Recast, the editors and the
  inspector lazy-loaded.

## Migration plan

Each phase ends shippable, with all tests green and the game playable. Effort
is in focused engineer-weeks, assuming the current test suite is kept as the
safety net.

### Phase 0 — Guardrails (1 week)

- Turn on the perf census as a CI check, with today's numbers as the
  baseline and budgets that ratchet down.
- Add architecture lint rules, starting with warnings.
- Add a headless harness skeleton and one feature test through it.
- Build a save fixture corpus from current saves.

**Exit:** CI reports perf, bundle size and lint, and save fixtures load.

**Status: done (2026-11-22).** What landed:

| Guardrail | Where | Baseline |
|---|---|---|
| Architecture rules and ratchets | `tools/check-guardrails.mjs` (+ `guardrails-baseline.json`), CI build job | framework has no Babylon imports; `game.ts` 8,456 lines (+40 slack); 60 unseeded `Math.random`; 199 callback wirings; 12 Babylon GUI files |
| Bundle budgets | `tools/check-bundle.mjs` (+ `bundle-budgets.json`), CI build job | entry 1,412 KB, all JS 6,075 KB, largest chunk 2,809 KB, models 32 MB (budgets +3%) |
| Render budgets | `tests/e2e/perf-budget.spec.ts` (+ `perf-budgets.json`), CI e2e | seed `camelot-perf-1`: start 173 draw calls, village 467 (budgets +15%) |
| Headless harness | `src/testing/headless/` | a village day on real plans, schedules and wall colliders, with a control that proves the wall check can fail |
| Save fixtures | `tests/fixtures/saves/`, `tests/e2e/save-fixtures.spec.ts` | `v29-midgame.json`: gold, goods, a discovered village and an active job round-trip exactly |

Bugs these found on day one: villagers could sidestep through a doorway
into a building (sidesteps now only go to open ground), and every load
added a junk "Exterior" fast-travel destination.

### Phase 1 — Kernel and features (3–4 weeks)

- Kernel: phase scheduler, typed event bus, scopes, services, RNG streams.
- Move the `_updateGameplayStep` ordering into phase registrations, with
  behaviour unchanged.
- Extract features out of `game.ts` one at a time, starting with the newest
  and most self-contained: raids, jobs, notice boards, smithing stations,
  villages, bandit camps, dragons, weather and atmosphere, then dialogue
  hooks.
- Replace `onX` callbacks with events as each feature moves.

**Exit:** `game.ts` is under 2,500 lines, and the extracted features own their
state, scope and save codec.

**Progress:**

- Kernel landed in `src/core/`:
  - `Kernel` with a feature install/uninstall lifecycle
  - `Scope` for ownership
  - `PhaseScheduler` with ordering and per-system timings
  - `ServiceRegistry` with typed keys
  - `RngStreams`, seeded from the world seed
  - the typed bus (`GameEventBus.on` returns an unsubscribe handle)
- `game.ts` runs the `sim` phase each gameplay step and emits `time:hour`,
  `save:loaded` and `npc:released`.
- The service contracts for features are in `src/features/services.ts`
  (clock, player, feedback, village world).
- Extracted features:
  1. **Village raids** (`src/features/village-raids/`). Events in, services
     out, no reference to `Game`. Its rules roll on a seeded stream, and
     5 headless tests run it through the kernel with fake services.
  2. **Village jobs** (`src/features/village-jobs/`): the job board rules,
     the job window (owned by the feature and removed on uninstall), and the
     quest-log mirroring. Triggers are the `dialogue:action` and
     `dialogue:closed` events and `questlog:opened`. This added inventory,
     quest-log and modal services. 3 headless tests click through the real
     window.
  3. **Indoors** (`src/features/indoors/`): sleepers going inside, and named
     holds (the raid's `"raid"` hold replaces the raid ↔ game coupling).
     Bedtime arrival is now an `npc:atBed` event; this added schedule and
     building services.
  4. **Villages** (`src/features/villages/`): planning, building as chunks
     load, the well, notice board and candles, discovery, and the village
     queries (current village, inn boards). Building goes through a new
     **site-builder** service (place buildings, props and smithies into a
     chunk; ownership; keep-outs; night flames), which the remaining site
     types (camps, inns, dragons) will use next. The old village-world
     service split into `actors` and `villages`.

  5. **World sites** (`src/features/world-sites/`): what appears where as
     chunks load. That covers ponds, villages, wild nature, homesteads,
     forest inns, bandit camps, the tundra dragon, and the remote-only
     obelisks, haunted houses, graveyards, snow fields and skulls. The
     dressing layouts are data in the feature, and the per-chunk hash is
     pinned by a test. The chunk loader in `game.ts` is now one call. 8
     Babylon demo models (d20, chair, alien, underwater scene, octopus, buoy,
     novelty pumpkin, rabbit) were dropped, along with 18 never-used remote
     asset keys.

  6. **Editor tools** (`src/features/editor/editor-suite.ts`): the map
     editor and its panels, the seven content creators, the world builder,
     content bundles, asset browser, bundle merge, mod manifest, workspace
     drafts and the editor hub (35 fields, ~470 wiring lines, 6 helpers).
     They moved as one unit behind an `EditorHost`; `game.ts` forwards the
     old fields through getters until Phase 9 makes this the editor app.
     A new `editor-smoke.spec.ts` opens every tool in the running game.

  7. **World events** (`src/features/world-events/`): hourly dynamic events
     (caches, lost supplies, chained follow-ups), ambient flavour and travel
     events, as data plus a `time:hour` listener. New `world-state` and
     `loot` services. Loot drops roll on a seeded stream.

  8. **Mounts** (`src/features/mounts/`): the horse roster, the stable
     master, mounting, and the stable and saddlebag windows. A single pair of
     actions replaces two full copies of the O / Shift+O logic (input
     adapter and legacy keyboard path). The windows use the modal service.

  9. **Pets** (`src/features/pets/`): the companion roster, the companion
     panel, the summoned companion's body, and its follow-and-fight AI (now a
     sim-phase system). One `togglePanel` replaces the two copies of the P
     logic. New `animation` and `gameplay` services; `actors.all()` lists
     every NPC.

  10. **Followers** (`src/features/followers/`): the hireling roster and the
      follower panel (G). The map editor keeps G for its gizmo. New `purse`
      service (gold and spend), which the mounts feature now uses too.

  11. **Shouts** (`src/features/shouts/`): dragon souls, Words of Power, the
      shouts panel (N), using a shout (Shift+N), every shout's world effect
      (cone targeting, knockback, dash, burn, freeze), and the Slow Time and
      Elemental Fury timers, now a sim-phase system. The game keeps only a
      small `shout-host` service: facing, targets, dash, damage with the
      usual kill handling, attack speed and weather.

  12. **Crafting** (`src/features/crafting/`): alchemy (L), enchanting (B),
      smithing (Shift+B), the world's forges and the starter kit. The smith's
      "use the forge" now arrives through `dialogue:action` and
      `dialogue:closed`; forges leave with `chunk:unloaded`. New `skills`
      service (level, XP scaled by class). The game still builds the feature
      early, because gear-wear hooks in combat, barter and the inventory read
      `smithing` during construction. Those hooks move once combat is a
      feature.

  13. **Arrest** (`src/features/arrest/`): a guard's challenge, with paying
      the fine, jail, persuasion and resisting (also Escape). New `law`
      service (crime, persuasion, jail time, infamy).

  14. **Fast travel** (`src/features/fast-travel/`): known places, the travel
      menu (Y) and Recall, travelling with fades and time passing, and the
      arrival event (now on a seeded stream). The feature provides the
      `fast-travel` service the villages use. Travelling out of an interior
      no longer adds the open world as a destination.

  15. **Death** (`src/features/death/`): falling at 0 health and waking at
      the nearest known place. The wait now runs on the game clock, so it
      doesn't expire under the pause menu.

  16. **Pickpocket** (`src/features/pickpocket/`): what NPCs carry, the
      picker, the roll (now on a seeded stream) and getting caught. New
      `thief-host` service (crouching, noticed, report the theft, receive
      the item); opening it emits `pickpocket:opened`.

  17. **Trade** (`src/features/trade/`): barter (opened by `barter:open`
      once the talk ends, priced by reputation) and containers.
      `dialogue:action` now carries the action's payload, so the merchant
      id travels with it.

  19. **Spoils** (`src/features/spoils/`): a kill's loot-table drops and the
      elites' leveled gear (table in `src/content/leveled-gear.ts`).
      `player:kill` now carries where the NPC fell and its loot table. The
      shouts feature takes a dragon's soul from the same event.

  20. **Dialogue services** (`src/features/dialogue-services/`): a
      trainer's lesson and a night at the inn, from `dialogue:action`. The
      game's dialogue host now just emits the action.

  21. **Survival** (`src/features/survival/`): hunger, fatigue and cold,
      their warnings and costs, as a sim-phase system.

  22. **Spell making** (`src/features/spell-making/`): the altar (X) and
      forging spells for gold.

  23. **Character** (`src/features/character/`): race, birthsign and class
      with their bonuses and racial traits, and the creation wizard (with
      a Nord warrior fallback if the wizard fails).

  24. **Settings** (`src/features/settings/`): the settings dialog
      (graphics tier, difficulty, audio, look sensitivity, fullscreen), the
      gear button, and the credits.

  25. **Progression** (`src/features/progression/`): character levels from
      major-skill raises, the level-up dialog, a perk point per level, and
      the character sheet (Tab). The game built the level-up dialog twice,
      and the second copy, the one shown, had no confirm handler. Confirming
      a level-up did nothing, and Escape is blocked there, so the player
      was stuck.
- `src/game/combat-controls.ts`: what each combat input does (swing or draw
  a bow, power attack, dodge, block, cast or charge a staff, cycle spells,
  loose an arrow, racial power), bound to the input adapter in one place.
- Crimes against peaceful settlers (murder via `player:kill`, assault via a
  new `player:assault` event) are booked by the arrest feature.
- Composition root (`src/game/game-services.ts`): the services the game
  provides to features, and installing them, moved out of `game.ts`. The
  game hands over the few private parts it needs as an explicit, typed
  `GameInternals`.

**Exit status:** `game.ts` is 2,367 lines, under the 2,500 target. Not done
yet: most features still register their save state through `saveSystem`
setters instead of owning a save codec. That moves to the entity store
(Phase 3), where saves are per-feature anyway.
- `src/world/dragon-lair.ts` (the tundra dragon boss and its body) and
  `src/game/weapon-archetype.ts` (which archetype a weapon fights as).
- `src/game/player-pack.ts`: gold (one coin stack, mirrored into the
  framework inventory) and items, with the framework-to-game id mapping.
  It replaces four hand-built gold stacks and the dialogue count, consume
  and give helpers.
- `src/game/quest-bridge.ts`: quest events into the framework, its
  rewards out, and failing quests whose NPC was killed.
- `src/game/npc-roster.ts`: one way to bring an NPC into the world (every
  tracking system, scaling, culling, pickpocket stock) and take it out. The
  structure spawner's removal skipped `npc:released`, so features kept
  references to removed NPCs. The chunk path skipped the pickpocket stock,
  which leaked.

  18. **Onboarding** (`src/features/onboarding/`): the five first-run tips
      as data. Each advances when the player does what it teaches (the game
      calls `did(step)`, or `questlog:opened` / `pickpocket:opened` arrive),
      or on Space when the screen is free.
- `game.update()` runs the `ui` phase each frame. The pet, follower and
  shout HUD chips are `ui` systems of their features.
- World environment (`src/rendering/world-environment.ts`): the lights and
  sun shadows, sky dome, horizon, post-processing, water, grass, fire and
  weather particles, window glow, and the per-frame blend from clock and
  weather. Render counts are unchanged.
- NPC visuals (`src/rendering/npc-visuals.ts`): rigged character models,
  dragon bodies, and routing AI state to animation with a distance LOD.
- HUD presenter (`src/ui/hud-presenter.ts`): the bars, clock, compass,
  sneak and combat readouts, crosshair-under-menus, effect and quick-slot
  bars, and the debug overlay, written only on change. It reads a
  `HudSources` view, which the Phase 3 UI can read too.
- Editor keys moved into `EditorSuite.handleKey`. The game sends it the
  chords the input adapter does not take: F2, the map-editor keys, Ctrl+Z/Y,
  Ctrl+M, and the Shift+F-key creator tools. One `toggleMapEditor` /
  `exitMapEditor` replaces three copies (adapter F2, legacy F2, Escape).
  The legacy keyboard path is now Tab, plain F5/F9 and the editor hand-off.
- Modal registry (`src/ui/modal-registry.ts`, ahead of Phase 2): every
  panel that takes over the screen, in Escape order. Escape closes the top
  one, pausing closes them all, and "any open?" blocks play. It replaces
  three hand-kept lists. Escape had missed the shouts panel and the World
  Builder, so it paused the game under them.
- `RngStreams.reseed` and `restoreFromSave` reset streams in place. A stream
  a feature kept from install time used to go stale at the first new game or
  load: it was no longer seeded from the world and was not saved. This
  affected raids and loot drops.
- Chunk content (`src/world/chunk-content.ts`): what each loaded chunk holds
  (props, village buildings with wall colliders and keep-out footprints,
  smithies, night flames, its NPCs), and disposing it on unload. It
  implements most of the `site-builder` service. The village still builds
  exactly 2,066 meshes.

- Legacy keyboard path pruned (ahead of Phase 2). Legacy branches only run
  for chords the input adapter does not bind, or in the map editor. The ones
  that copied adapter actions (Escape, F1, F3, PrintScreen, the panels, the
  combat keys, the quick slots) are gone, about 370 lines. What remains are
  the editor chords, Tab, and the F-key tools. This fixed three shortcuts
  that never fired, because an earlier branch for the same key caught them:
  Ctrl+M (Scene Notes), Ctrl+Shift+M (Mod Manifest), and T in the editor
  (placement type). Gameplay keys no longer act inside the editor.
- Starting content moved out of `init()` into `src/content/`:
  - `starter-merchants.ts`: one table for the merchants, their shops and
    their restock stock. The restock copy had drifted, so the general store
    lost its food after the first restock.
  - `starting-area.ts`: the chest, the Old Cave, the ground weapons and the
    first quests.

  Render counts after the extraction match the pre-extraction baseline
  (2,066 village meshes), so villages are built identically. The render
  budget check now also has floors, so a scene that failed to render can't
  pass.

### Phase 2 — Input, modals and camera (2 weeks)

- Input contexts plus a key-to-action map.
- A modal stack (the first Preact code) that owns pointer lock and HUD
  visibility. New panels from here on are Preact components.
- A camera stack (gameplay, dialogue, cinematic and death modes).
- Remove the hand-kept modal lists.

**Exit:** no feature touches `requestPointerLock`, `exitPointerLock` or raw
`keydown` directly.

**Progress:**

- `src/input/play-focus.ts`: who has the player's input. Play has it unless
  a named holder does: a menu, the pause menu, the map editor, character
  creation, or a conversation. It is the one place that locks and unlocks
  the pointer, attaches the camera and blocks world interaction. Holders
  stack: closing a tool inside the map editor keeps the editor's hold.
  Before, each menu, the editor suite (8 call sites), the dialogue and
  inventory systems and character creation all locked and unlocked the
  pointer themselves.
- The editor's three copies of "turn the map editor on" are one.
- Guardrail `pointer-lock-owner`: pointer lock only in the focus wiring
  (plus the dialogue / inventory fallbacks for running without a game).
- Input contexts on the key-to-action map: each binding lists the contexts
  it is live in (play, or the map editor). Escape, F1–F3, F5/F9, mute,
  PrintScreen and the bow / staff releases are live in both. Every key the
  bindings don't take goes to the editors' chords. This retires
  `_EDITOR_ADAPTER_KEYS` and the legacy keyboard branches (Tab is now the
  `toggleCharacterSheet` binding, ignoring auto-repeat). The game's
  keyboard observable is a dozen lines.
- The last hand-kept modal lists (the HUD's crosshair check and the
  onboarding "is the screen free?") ask the modal registry.
- Camera stack (`src/rendering/camera-director.ts`): the player's own view
  unless a shot runs. The dialogue framing is one shot. The new death fall
  is another (the view sags and rolls while down, and eases back on
  waking; it outranks dialogue). Falling also takes a `fallen` focus hold,
  so mouse-look can't fight it. Cinematics slot in as further shots.

**Phase 2 exit check:** pointer lock is only in the focus wiring (enforced
by guardrail). No feature listens to raw `keydown`. The remaining
`keydown` listeners are panels' own keyboard handling inside their dialogs,
and app-level shortcuts in `app.ts`. They are ported with the panels to
Preact in Phase 8.
- Preact is in (`preact` 10, automatic JSX runtime in the TypeScript, Vite,
  Vitest and e2e configs). `src/ui/preact/modal-dialog.tsx` is the shared
  modal: backdrop, header with ✕, focus trap, and ✕ / backdrop / Escape all
  close. The credits panel is the first panel ported, with its old API
  kept. Together with the modal registry and PlayFocus, this is the modal
  stack: the registry knows what is open, PlayFocus owns the pointer, and
  new panels are Preact components on ModalDialog.

### Phase 3 — Entity model for actors (3–4 weeks)

- Add bitECS. Entity ids for NPCs and the player, with components
  replacing NPC booleans.
- Schedule, combat, stealth, crime and animation become component queries.
- Ownership via `ChunkOwned` and scopes. Chunk unload is a scope dispose.
- NPC LOD tiers.

**Exit:** no system reads `mesh.name` for identity, and NPC flags are
components.

**Progress:**

- bitECS 0.4 added, behind `src/core/ecs/actors.ts` (`ActorStore`: spawn,
  despawn, has / set, query, and the NPC body in a side table). Ids come
  from the store and are never reused. bitECS 0.4.0's own id versioning is
  broken: recycled ids stop "existing" once its index arrays shuffle, which
  showed up in the village e2e. So the store maps its ids to bitECS's
  slots, and a churn test pins this.
- Every NPC gets an actor id when it's built and leaves the store with its
  body. Its ten flags (dead, in dialogue, aggressive, hostile on sight,
  provoked, telegraphing, staggered, hit-react, guard, unblockable) are tag
  components behind the same `npc.isDead` / … accessors, so no caller
  changed.
- NPC identity no longer comes from the mesh. NPCs have `key` (who they
  are, stable across saves: their spawn name), `actorId` (runtime) and
  `displayName` (what the player sees). About 60 `mesh.name` reads across
  combat, spells, projectiles, schedules, dialogue, crime, interaction,
  the roster and features now use `key` or `displayName`. The animation
  system keys its state by the mesh's unique id, not its name. Two NPCs
  with the same name (the boot-time "Guard" and others) used to share and
  overwrite each other's animation state. Guardrail `npc-identity` keeps
  `.mesh.name` out of identity.
- NPC LOD tiers (`src/systems/npc-tier-system.ts`). Each tick, before the
  schedules, every NPC is put in a tier by its distance from the player:
  near (within 40 m), mid, or far (beyond 100 m). Tiers are actor components
  (`LodMid`, `LodFar`) with 4 m of hysteresis at each edge. NPC visuals pause
  far NPCs' animation and rigs; they used to measure distance themselves,
  twice. The schedule system runs mid NPCs every 2nd tick and far ones every
  4th. The skipped time is banked and passed on, and NPCs are spread across
  ticks by actor id. Combat AI still runs every tick for every NPC.
- Chunk ownership via scopes. Each loaded chunk's `ChunkRecord` owns a
  `Scope`, a child of one "chunks" scope. Unloading a chunk disposes that
  scope: placed meshes are disposed with their culling and shadow
  registrations, then the chunk's NPCs are released. Chunk NPCs carry the
  `ChunkOwned` actor tag while they belong to it. Two leaks are closed:
  - an NPC spawned for a chunk that has already unloaded is released at
    once;
  - re-opening a chunk key disposes the old record first.
  `scopeOf(chunkKey)` lets other code tie its own clean-up to a chunk.
- Feature-owned save codecs (carried over from Phase 1). The save system
  takes `registerCodec({ key, save, load })`, and features reach it through
  the `saves` service, with `ownSave(ctx, codec)` tying it to the feature's
  scope. Codecs are written under their key and read back from the raw
  save, after the built-in state. A save without the key passes
  `undefined`, so the codec can reset. A codec that throws is logged and
  the load continues. Ten features now own their part: pets, shouts,
  followers, mounts, raids, jobs, crafting, survival, spell making and
  pickpocket. Their setters and save/load lines are gone from the save
  system. Save keys are unchanged, so existing saves load.
- AI state is queryable. Setting `npc.aiState` tags the actor `Engaged` in
  the fighting states (alert, investigate, chase, attack).
  `ActorStore.bodies(with, without)` returns bodies with bitECS `Not`
  terms. "Is the player in combat" (fast travel, waiting, the HUD) is one
  query, living `Engaged`, instead of a scan of every NPC. The `actors`
  service has `hostiles()` (living `Aggressive`), and the companion picks
  its target from it.
- Still scans: combat, spells, projectiles and the crime system's guard
  search walk their own NPC lists. Those loops are proximity searches,
  where a tag query alone does not help, and their unit tests build the
  lists directly. They move to a spatial index over actors in Phase 6,
  with the navmesh tiles.

**Exit check (met):**
- No system reads `mesh.name` for identity; the `npc-identity`
  guardrail enforces this.
- NPC flags are actor components: dead, in dialogue, aggressive, hostile
  on sight, provoked, telegraphing, staggered, unblockable, hit-react,
  guard, engaged, LOD tier and chunk-owned.
- The codec registry (part of Phase 5) is in place, with ten features on
  it. Phase 5 moves the remaining built-in state onto codecs and adds
  migrations.

### Phase 4 — Consolidation (3 weeks)

- One quest engine, one inventory and one schedule pipeline.
- Radiant job and raid templates in the framework.
- Remove the duplicate modules and the unused `3d-tiles-renderer`
  dependency. Once the single AI model replaces their only users, remove
  `xstate` and `mistreevous` too.

**Exit:** the domain table above is fully on its "Keep" column.

**Progress:**

- Removed three dependencies and the modules that were their only users.
  None of these modules was imported by the game, only by its own test:
  - `3d-tiles-renderer` (`tiles-renderer-system.ts`);
  - `xstate` (`npc-ai-state-machine.ts`);
  - `mistreevous` (`npc-behavior-tree.ts`).

  The combat system's state machine is the one NPC AI model. The
  behaviour-tree goal layer from the domain table gets built on that, not
  on these.
- Removed four modules that duplicated a system the game already uses:
  - `skeletal-animation-system` (the animation system drives rigs);
  - `skill-tree-ui` (the UI manager owns the skill tree panel; its e2e
    harness and its 49 specs tested only the orphan);
  - `wait-ui` (the UI manager's wait dialog is the one in use);
  - `tooltip-ui`, which was also the only user of `@floating-ui/dom`, so
    that dependency is gone too.
- Still unreachable from `src/app.ts`, but features rather than duplicates.
  Each is kept, with its tests, until its phase wires it in or drops it:
  - Phase 6, world: `offscreen-simulation-system` (the off-screen
    schedules), `region-system`, `biome-system`, `encounter-system`,
    `landmark-system`, `inn-system`, `standing-stone-system`,
    `dungeon-generator-system`, `weather-schedule-system`;
  - Phase 9, editor: `map-annotation-system`, `map-pack-system`,
    `recent-projects-system`, `standalone-editor-shell`;
  - other: `journal-system` and `journal-ui`, `camera-scripting-system`,
    `event-script-system`, `equipment-visual-system`,
    `quaternius-asset-manifest`.
- Schedules:
  - Block matching lives in one place, `scheduledBehaviorAt(blocks, hour)`
    in `schedule-system.ts`. The daily schedule system had its own copy.
  - Sleep is the `Asleep` actor tag (`npc.isAsleep`). It used to be a
    hack: blanking the NPC's mesh metadata so interaction couldn't see
    it. The interaction prompt now says "X is asleep" and won't start a
    conversation. The daily schedule system also forgets sleepers that
    have left the world; before, it kept them forever.
- Streaming is one lifecycle. `ChunkManager` decides what loads,
  unloads, and when (preload, concurrency, mount budget). `WorldManager`
  is its source and render adapter, and the `onChunkLoaded` /
  `onChunkUnloaded` hooks feed the chunk scopes. Removed the second,
  unused adapter pair (`world/babylon-world-chunk-adapter.ts` and
  `-source.ts`).

### Phase 5 — Persistence (1–2 weeks)

- A save registry and per-feature codecs, with migrations from the current
  format.
- Transient state declared per feature.
- Replay recorder.

**Exit:** a round-trip test over all codecs passes, old fixtures migrate, and
one replay runs in CI.

### Phase 6 — World and navigation (3 weeks)

- Data-driven site builder for all site types.
- Recast navmesh tiles per chunk (built in a worker), plus steering.
- Off-screen schedule simulation.

**Exit:** no placement code in `game.ts`. NPCs path around buildings using
the navmesh.

### Phase 7 — Rendering and assets (4 weeks; can run in parallel from Phase 2)

- Render feature modules and the uniform block helper.
- Thin-instanced vegetation, and a light budget across all sites.
- Asset pipeline: meshopt, KTX2, LODs and a manifest. Lazy shader language.
- WGSL versions of the five custom shader pieces, then make WebGPU the
  default with feature detection and a WebGL2 fallback. This can start
  early; it doesn't depend on the other phases.

**Exit:** budgets are met on the census scenes, and model size is at most
50% of today's. WebGPU is the default where supported, and nothing is fetched
from a CDN at runtime.

### Phase 8 — UI consolidation (3 weeks; can run in parallel from Phase 2)

- Move the Babylon GUI panels (dialogue, inventory, pause, quest log, skill
  tree) to the DOM component layer.
- Design tokens and an accessibility pass covering focus, contrast and
  scaling.

**Exit:** Babylon GUI is used only for world-space UI.

### Phase 9 — Editor app (3 weeks; after Phases 1 and 8)

- Move the in-game editors into a separate app as a second Vite entry
  (`editor.html`) that shares the kernel, framework and render features:
  map editor, quest, dialogue, NPC, item, loot and spawn creators, asset
  browser, bundle tools.
- Remove editor code and the inspector from the game bundle.

**Exit:** the game bundle has no editor code. The editor app opens a world,
edits content bundles and can play-test through the shared kernel.

**Total:** roughly 27–33 engineer-weeks sequentially, or about 18–20 weeks
with the rendering and UI tracks in parallel.

## Success metrics

| Metric | Today | Target |
|---|---|---|
| `game.ts` | 8,450 lines | ≤ 500 lines (bootstrap only) |
| Duplicate subsystems | 5 concerns | 0 |
| Systems wired by callback properties | most | 0 (events + services) |
| Unseeded `Math.random` | 79 | 0 outside the RNG module |
| Village draw calls / frame | ~290 | ≤ 250 |
| Main JS chunk | 1.45 MB | ≤ 900 KB |
| Model payload | 46 MB | ≤ 23 MB |
| Feature logic testable headless | none | all features |
| Save codecs with round-trip tests | 0 | all |

## Risks

- **Regression risk during extraction.** Mitigation: the existing 5,900 unit
  tests, the Playwright scenarios, replays (from Phase 5), and moving one
  feature per pull request.
- **Save compatibility.** Mitigation: the fixture corpus, plus migrations
  that are themselves tested and versioned.
- **Scope creep** (a "while we're here" rewrite of features). Mitigation:
  each phase has a behaviour-neutral exit, and gameplay changes go in
  separate pull requests.
- **Performance work without real-GPU numbers.** CI runs on software GL.
  Mitigation: CI budgets track draw calls and CPU-side counts, and a
  periodic manual pass on reference hardware records real frame times in
  `docs/rendering.md`.

## Decisions

Recorded 2026-11-22.

| Question | Decision | Notes |
|---|---|---|
| Entity model | **Library: bitECS 0.4** | MPL-2.0 (file-level copyleft; used unmodified, so only a notice in THIRD-PARTY-NOTICES). Non-numeric data goes in side tables. |
| UI layer | **Preact** (+ `@preact/signals`) | Menus and panels only; Babylon GUI stays for world-space UI. |
| Renderer default | **WebGPU**, WebGL2 fallback | Needs WGSL versions of 5 custom shader pieces first (Phase 7). |
| In-game editors | **Separate editor app** | Phase 9: a second Vite entry sharing the kernel. |
| Navigation | **Recast navmesh tiles** | Already a dependency; handles buildings, doorways and interiors, which grid-plus-steering can't; tile builds run in a worker. |
