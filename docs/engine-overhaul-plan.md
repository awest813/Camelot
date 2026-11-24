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
- One quest engine: the framework's graph engine. The target-id clash
  noted earlier didn't matter in practice: the only legacy quests driven
  by game events were the three starter quests, and their targets
  (`Guard`, `potion_hp_01`) already equal the bridge ids.
  - The starter quests are framework definitions
    (`content/starting-area.ts`), added to the content the game's runtime
    is built from and activated at start.
  - The quest log (`QuestSystem`) is a view. It shows the framework
    quests that have started, with their reached nodes as objectives,
    then the entries features own (village jobs). Framework quests used to
    be invisible in the log. Game events go only to the engine, through
    the bridge.
  - `QuestSystem` no longer has `onKill`, `onPickup` or `onTalk`,
    objective matching, completion checks or `onQuestComplete`, and
    `game.ts` no longer calls them.
  - The bridge pays every completed quest the same way: "Quest Complete:
    Name!", XP, +10 fame (which only legacy quests used to give), gold and
    items. It redraws the log when a quest moves. Its "fail the quests
    that needed this NPC alive" no longer has a legacy branch.
  - Old saves migrate. A legacy save entry for a quest the engine now
    owns carries its status and progress into the engine; the framework
    snapshot, restored after it, wins when it has the quest. The v29
    fixture loads with its original expectations.
- One inventory: the game's `InventorySystem`. The domain table had
  this the other way round, keeping the framework inventory as the
  source. That doesn't work: the framework engine stores only id and
  quantity, and game items carry stats, enchantments and instance ids.
  - Framework dialogue already reads and writes the player's real pack
    through the runtime's host hooks (`PlayerPack`: count, consume,
    give).
  - The rest was a mirror that nothing read: gold copied into the
    framework inventory after every change, and some pickups added to it.
    The mirror and its id table are removed.
  - The framework keeps its own inventory engine as the default for hosts
    that don't supply hooks.

**Status against the exit table:**

| Concern | Status |
|---|---|
| Quests | Done: one engine; the log is a view. |
| Inventory | Done, with "keep" and "retire" swapped (see above). |
| Schedules | `ScheduleSystem` plus the shared block matcher. The daily layer only keeps the hour in sync and sets the `Asleep` tag. |
| NPC AI | One model, the combat state machine. The behaviour-tree goal layer is not built. |
| Streaming | Done: `ChunkManager` plus `WorldManager` as its adapter. |
| Jobs, raids | Open. They are features with their own rules and quest-log entries; nothing for them is left in `game.ts`. Making them framework "radiant" templates is still to do. |
- The quest log has an API; features no longer change quest objects
  directly. The quest-log service has `setProgress`, `finish` and
  `remove`, and `quests()` is read-only. A `managed` quest belongs to a
  feature: kill, pickup and talk events don't move it, and only `finish`
  completes it (quietly, because the owner pays).
  - Village jobs use this. They used to write objective counts directly,
    mark the quest complete, and splice quests out of the log's array.
  - Jobs had a "never mark the objective complete" workaround, so a
    stray kill event couldn't close the job before it was paid. A
    managed quest can't be closed that way, so the workaround is gone.
  - This was the prerequisite for making the log a view over one engine.

### Phase 5 — Persistence (1–2 weeks)

- A save registry and per-feature codecs, with migrations from the current
  format.
- Transient state declared per feature.
- Replay recorder.

**Exit:** a round-trip test over all codecs passes, old fixtures migrate, and
one replay runs in CI.

**Progress:**

- The save registry is in place (started in Phase 3, see there). The save
  system's own 36 parts are codecs now: time, crime, containers, … combat
  effects. Each setter registers its codec. A part's `order` keeps the
  load sequence it always had (10–360), and feature codecs default to
  1000, after all of them.
  - The 36 save lines and 36 load lines are gone; `save-system.ts` lost
    about 170 lines.
  - Special handling stays inline: the player, inventory, equipment,
    quests, skills, the framework snapshot, and attributes (which re-sync
    the player's maxima).
  - A part that throws on load is logged and skipped; it used to abort
    the whole load.
- Round-trip test: every setter gets a stub, the game is saved and
  loaded, and each stub must get back exactly its own data, with time
  restored before the daily schedule. The save-fixture e2e still loads
  the checked-in fixtures.
- Transient state is declared per feature. Every feature says what
  happens to its state on load, with one of three helpers in
  `features/services.ts`:
  - `ownSave(ctx, codec)`: it owns a part of the save. Ten features do.
  - `ownTransient(ctx, what, reset?)`: it keeps state on purpose that a
    load resets, with an optional reset that runs once everything saved
    is back. Four features do: raids (a raid in progress), jobs (their
    quest-log entries), death (a fall in progress, where a load now gets
    the player straight up), and indoors (who is inside; its wake check
    re-derives it).
  - `declareStateless(ctx, why)`: nothing of its own to keep, with the
    reason (saved by the save system's own parts, derived from the world
    seed, or a player preference outside the save). The other twelve
    do. (Raids and jobs both save and declare transient state.)

  Raids and jobs used to listen for `save:loaded` directly. After
  installing features, the game reports any that declared nothing as a
  console error, which fails the boot smoke test. The kernel exposes
  `installed()`, and a feature's context carries its `id`.
- Replays at kernel scope (`src/core/replay.ts`). `ReplayRecorder` logs
  what is fed into a kernel: its seed, the events emitted into it, and
  the phases run with their time steps. The log is plain JSON.
  `replay(log, kernel)` feeds it to a fresh kernel, and
  `verifyReplay(...)` compares the observed end state.
  - A CI test records a 400-hour village-raid session: hourly rolls on
    the kernel's seeded stream, raids starting, the player cutting every
    raider down. It sends the log through JSON, replays it, and requires
    the same state: rewards, notifications, despawns and raid history.
    The same inputs under another seed must diverge.
  - Not covered yet: the whole game. Gameplay randomness is now seeded
    (next item). What remains is the frame loop and input adapter
    driving the kernel, so the recorder can sit on the input adapter.
- Gameplay randomness is seeded. Nine systems take a
  `random: () => number` (default `unseededRandom`, for tests and
  standalone use): combat, projectiles, schedules, weather, leveled lists,
  pickpocketing, persuasion, loot tables and alchemy.
  `seedGameRandomness(game)` gives each one its own kernel stream, which
  resets in place on a reseed or a load. Framework dialogue's
  `random_chance` takes a host `random` too, and the game passes its
  "dialogue" stream. The `unseeded-random` ratchet went from 51 to 19.
  None of the 19 is gameplay: seed creation itself, editor tools,
  character-name suggestions, and cosmetic jitter (stone tilt, flame
  phase, portal shimmer, audio noise).

**Exit check:**
- Round-trip over all codecs: met (see above).
- Old fixtures migrate: met. The v29 fixture loads, including starter
  quests moving into the quest engine.
- One replay runs in CI: met at kernel scope. A whole-game replay waits
  on the remaining unseeded randomness.

### Phase 6 — World and navigation (3 weeks)

- Data-driven site builder for all site types.
- Recast navmesh tiles per chunk (built in a worker), plus steering.
- Off-screen schedule simulation.

**Exit:** no placement code in `game.ts`. NPCs path around buildings using
the navmesh.

**Progress:**

- No placement code in `game.ts`. The village guard (who patrols by day
  and sleeps at night) and the starting forge moved into the
  starting-area content, `STARTER_GUARD` and `STARTER_FORGE`. The guard
  comes into the world through the NPC roster like every other NPC. Three
  special cases that looked up `scheduleSystem.npcs[0]` (culling, level
  scaling, the schedule) are gone.
- Wild sites are data. `content/sites.ts` describes the scattered nature
  and every wild site: obelisk, homestead, dragon, forest inn, haunted
  house, graveyard, bandit camp, snow field and skull.
  - A site has the biomes it appears in, a roll, a position, an optional
    rotation and variants, and a list of parts: buildings, props, rings
    of props, NPCs, forges, single assets and the dragon. A part can
    depend on the variant or on a roll.
  - One builder, `world/site-specs.ts`, reads them. The world-sites
    feature lost about 150 lines of hand-written placement.
  - Placement is identical. A test runs the old code (kept verbatim as a
    test fixture) and the specs over 12,800 chunks across the four
    biomes, and requires the same calls in the same order.
- Procedural structures are data too. `content/structures.ts` describes
  the ruins (plains and forest), the desert shrine and the tundra
  watchtower.
  - A structure has shared materials, made up front, and an ordered list
    of parts: boxes (sizes, offsets and rotation can be rolled, with an
    optional collider and shadow), chests, torches, campfires, barrels,
    banners, standing stones, a relic, and a guard NPC with stats and a
    patrol.
  - `StructureManager._buildFromSpec` replaced the three hand-written
    builders; the file went from 939 to 712 lines.
  - The build is the same. A test keeps the old manager verbatim as a
    fixture and builds 24 structures with both into real NullEngine
    scenes: every mesh (name, position, rotation, size, material, parent),
    material, light, fire hook and NPC (stats and patrol) must match, with
    and without the loot already taken.
  - One deliberate change: a standing stone's lean was `Math.random()`,
    re-rolled every time its chunk loaded. It is now fixed by where the
    stone stands. The fixture carries that one-line change, with a note.
    The unseeded-random ratchet goes to 18.
- The navmesh is on by default, built in a worker, and covers buildings.
  - Input: the loaded ground chunks plus every mesh marked as a nav
    obstacle (`markNavObstacle`): building wall colliders and the village
    well. Walls rise above an agent's head, so Recast leaves them out, and
    doorways are gaps between wall boxes, so they stay walkable.
  - Building: chunk loads and unloads request a rebuild, debounced by 2 s.
    `navmesh.worker.ts` runs the Recast build in 64-cell tiles (about
    0.2 s for a 250 m area with 60 walls in Node) and sends back the
    serialized navmesh. The main thread lazily loads Recast only to
    deserialize it and answer path queries. A newer build supersedes an
    older reply, and without workers (Node) it builds in place.
  - Use: combat already pathed when a navmesh existed. Schedules now do
    too: villagers walking to work, home or a wander spot follow the
    route around buildings and re-plan every 4 s. Until the navmesh is
    in, they walk straight and sidestep as before.
  - recast-detour's factory writes to `this`, which an ES module call
    leaves undefined. `loadRecast` passes it an object, which is why the
    old opt-in path (`VITE_ENABLE_NAVMESH=true`) could never have loaded
    in a browser. `VITE_ENABLE_NAVMESH=false` turns the navmesh off.
  - Tests: real Recast in Node builds from a ground chunk and a house.
    Paths go around the house, the way in is the doorway, and a villager
    driven by the real `ScheduleSystem` walks round to work. The control,
    with no navmesh, walks straight through. The village e2e checks that
    the navmesh loads from the worker, includes the walls, and routes
    across the village.
  - Not per-chunk incremental: each rebuild covers the loaded area (in
    tiles, off the main thread). Swapping single tiles as chunks stream
    needs Detour's tile API, which the recast-detour binding doesn't
    expose. Steering beyond path-following (separation, avoidance) is not
    done either.
- Off-screen routines (`features/routines/`). `scheduledSpot(npc, hour)`
  says where an NPC's schedule puts it: work, home (to sleep or wander),
  or a patrol point that turns with the hour. The routines feature uses it
  in two places:
  - A resident arriving with its chunk appears there, not where the village
    plan first stood it: the smith is at the forge at noon, and sleepers
    go straight indoors.
  - When time passes in a jump of an hour or more between two ticks
    (waiting, fast travel, jail, a load), every calm NPC moves to its spot
    for the new hour. Fighting, talking and already-indoors NPCs are left
    alone.

  `teleportNpc` is the one way to move an NPC instantly (its body
  follows); the fall recovery in `game.ts` uses it too. The older
  `offscreen-simulation-system` (string ids, merchant gold) stays unwired.
  Only two playtests use it.

**Exit check:**
- No placement code in `game.ts`: met.
- NPCs path around buildings using the navmesh: met. Combat chases and
  daily schedules follow navmesh routes built from the walls, shown by
  the real-Recast unit test and the village e2e.
- Data-driven site builder for all site types: met for wild sites and
  procedural structures. Villages were already data (`planVillage`).
- Left open: per-chunk incremental navmesh tiles (each rebuild covers the
  loaded area), and steering beyond path-following.

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

**Progress:**

- WGSL for all five custom shader pieces. Each keeps its GLSL version, and
  the material picks the language from the engine
  (`rendering/shader-language.ts`). Babylon converts GLSL for WebGPU by
  fetching glslang and twgsl from its CDN, but only when a shader has no
  WGSL, so these never need it.
  - The terrain and wind material plugins declare both languages
    (`isCompatible`) and carry WGSL injection code. Before this, WebGPU
    refused the terrain plugin outright and the game failed to start.
  - The sky dome, horizon and water `ShaderMaterial`s are registered in
    both shader stores.
- The WebGPU engine path now starts at all. The engine's texture and
  render-target extensions are separate modules and weren't imported, so
  `createDynamicTexture` was missing.
- Renderer choice (`rendering/renderer-choice.ts`). `?renderer=` wins,
  then a WebGL2 fallback remembered on this machine, then
  `VITE_RENDERER`, then `DEFAULT_RENDERER`.
  - WebGPU starts only when the browser offers an adapter.
  - If the device is lost in the first 20 s, the game remembers WebGL2 on
    this machine and reloads.
- WebGPU is the default where the browser has an adapter, with WebGL2 as
  the fallback.
  - The WGSL is validated. `tests/e2e/wgsl-shaders.spec.ts` builds the five
    pieces on a WebGPU engine (building effects, not drawing) and checks
    the exact WGSL Babylon generates for each, vertex and fragment, with
    naga (`naga-wasm`, wgpu's shader compiler, a dev dependency, via
    `src/testing/wgsl-validate.ts`). It also checks that nothing is
    fetched from another host. A syntax error in the horizon or a type
    error in the sky fails it and names the shader. The same page on
    WebGL2 renders the GLSL versions.
  - Babylon's god-rays pass (`VolumetricLightScatteringPostProcess`) has
    no WGSL, so it is off on WebGPU. Running its GLSL there would mean
    fetching the converters. Depth of field (also GLSL-only) was already
    off.
  - CI's headless Chromium software WebGPU loses its device within a few
    frames of drawing, so CI can't play the whole game on WebGPU. That
    spec is opt-in (`WEBGPU_E2E=1`), and the e2e suite runs the game on
    WebGL2 through the fallback (no adapter there).
- Models are 41% of their old size: `public/model` went from 46 MB to
  19 MB (exit target: at most 50%). `tools/optimize-models.mjs`
  (glTF-Transform, meshoptimizer and sharp, all dev dependencies) does it.
  - Geometry and animation: meshopt compression with quantization,
    resampled animations, unused data pruned. 31.4 MB of GLBs became
    12.6 MB.
  - Textures: WebP (`EXT_texture_webp`), at most 1024 px. The packs share
    textures between models (113 files referenced 393 times). Embedding
    them would have duplicated them, so each is converted once beside the
    original (12.0 MB became 4.8 MB) and the models point at the WebP
    copy. The originals and 23 textures no model used are gone.
  - Skeletons: quantization uses one volume per model, and identical skins
    are folded back together. Per-mesh volumes had split each character's
    one skin into one per mesh, giving each a skeleton and a bone texture.
    That doubled texture counts and broke the render budget until fixed.
  - Babylon's meshopt decoder would have come from its CDN, so it ships as
    `public/vendor/meshopt_decoder.js`. `tools/vendor-meshopt-decoder.mjs`
    generates it from the installed meshoptimizer, and a unit test keeps
    the two in step.
  - Checks: every model is compressed, every texture it points at exists,
    no model has duplicate skins, and the village well's textures exist
    (`tools/model-assets.test.ts`). The village e2e fails on any model
    that fails to load. Boot-smoke fails on any request to another host.
    The render budget passes. A close-up screenshot of the village guard
    shows the skinning and textures intact.
- Nothing is fetched from a CDN at runtime (boot-smoke checks this). The
  remote props stay opt-in (`VITE_ENABLE_REMOTE_PROPS`).

**Exit check:**
- Budgets met on the census scenes: yes; `perf-budget.spec.ts` passes.
- Model size at most 50% of before: yes, 41% (19 of 46 MB).
- WebGPU is the default where supported: yes, with WebGL2 as fallback.
- Nothing fetched from a CDN at runtime: yes; boot-smoke and the shader
  harness check it.
- Not done yet from the bullet list: thin-instanced vegetation (vegetation
  is merged per material per chunk), a light budget across sites, model
  LODs and an asset manifest, and god rays on WebGPU (waiting on WGSL for
  Babylon's scattering pass).

### Phase 8 — UI consolidation (3 weeks; can run in parallel from Phase 2)

- Move the Babylon GUI panels (dialogue, inventory, pause, quest log, skill
  tree) to the DOM component layer.
- Design tokens and an accessibility pass covering focus, contrast and
  scaling.

**Exit:** Babylon GUI is used only for world-space UI.

**Progress:**

- Design tokens for game panels (`--panel-*` in `css/main.css`) and a
  shared set of panel pieces (`.craft-panel__*`: sections, selectable rows
  with `aria-pressed`, a status line, buttons with visible focus), all
  built on the Phase 2 `ModalDialog`.
- The alchemy and enchanting panels are Preact (`alchemy-ui.tsx`,
  `enchanting-ui.tsx`). Their class APIs are the same (`toggle`,
  `refresh`, `isVisible`, the `on…` events); only their constructors lost
  the GUI texture.
  - Behaviour is unchanged: alchemy takes 2–4 ingredients, Craft is
    disabled under two, and choosing an item limits enchanting to the
    effects its kind can take.
  - New: real buttons with keyboard focus, labelled sections, a live
    status line, focus kept in the dialog, and Escape closes the panel
    without pausing.
  - Tests: jsdom tests drive both panels by clicks, and boot-smoke opens
    each by key and closes it with Escape.
- The wait dialog, attribute panel and quest log moved out of
  `ui-manager.ts` into Preact panels (`wait-dialog.tsx`,
  `attribute-panel.tsx`, `quest-log-panel.tsx`), mounted with a shared
  `PanelHost`. `UIManager` keeps the same methods (`toggleWaitDialog`,
  `toggleAttributePanel` / `refreshAttributePanel`, `toggleQuestLog` /
  `updateQuestLog`) and delegates to them.
  - The wait dialog gains a slider and arrow keys, and keeps 1–24 h and
    the remembered choice.
  - The attributes are a table with hints, and +1 is disabled until
    points are waiting.
  - The quest log keeps its order (active, failed, completed), and screen
    readers hear the state.
- One close path: a panel the player closes from inside calls
  `UIManager.onPanelClosed(id)`, and the game closes it through its modal
  registry, which also gives control back. That replaces
  `onWaitDialogClosed` and `onAttributePanelClosed` (callback-properties
  61 → 60). The quest log's new ✕ and Escape use the same path. (The old
  quest log could only be closed with J.)
- The pause menu is Preact (`pause-menu.tsx`). The game hands it its
  actions with one `ui.setPauseActions({...})`, which replaces eight
  public Babylon `Button` fields wired one by one. Escape inside the menu
  resumes, like the Escape that opened it, and so do Resume and a click
  outside. Boot-smoke covers pausing and resuming both ways.
- The skill trees are Preact (`skill-tree-panel.tsx`): one column per
  tree, with each skill's stars, description and one button (Upgrade,
  🔒 Locked, Need Points or ✦ Mastered, disabled unless it can be bought).
  The ✕ and Escape close it through `onPanelClosed("skill-tree")`.
- The inventory is Preact (`inventory-panel.tsx`): the 4×5 grid with
  equipped items marked, the hovered or focused item's details and
  click hint, the stats, and the equipment. Only usable or equippable
  items react to clicks. Items, equipped ids, stats and equipment are
  plain state in `UIManager`, and the view redraws from it. Five public
  GUI fields are gone (`inventoryPanel`, `inventoryGrid`,
  `inventoryDescription`, `statsText`, `equipmentText`). `ui-manager.ts`
  is down to about 1,400 lines from 2,400.
- The conversation box is Preact (`dialogue-box.tsx`): the speaker, the
  line (announced politely to screen readers), and numbered choices as
  buttons, with locked ones disabled and their reason shown. The
  dialogue system still owns the conversation, the keys (capture phase,
  so digits never reach the quick slots) and the one highlight that the
  mouse and keyboard share. The text no longer needs a hand-estimated
  line count, because the box grows to fit.
- The HUD is on the DOM (`hud-dom.ts`): crosshair, interaction prompt,
  the three bars and the XP bar, notifications, compass, clock, stealth
  eye, combat line, debug overlay, hit flash, damage numbers and the
  screen fade. It uses plain elements updated in place, because the bars
  change every frame and don't need a re-render. CSS does the low-health
  pulse and the flash, and the damage numbers animate with the Web
  Animations API, which replaced four per-frame observers and their
  control pools. The bars are labelled progress bars, and notifications
  are a polite live region. Damage numbers are projected to CSS pixels
  of the canvas, which the old GUI only got right at a hardware scaling
  of 1. `UIManager` has no Babylon GUI left. Its public `healthBar`,
  `crosshair`, `notificationPanel` and similar fields are gone:
  `ui.hud` holds the elements, and `isCrosshairVisible` replaces
  `crosshair.isVisible`.
- The game no longer makes a fullscreen GUI texture. The in-game map
  editor makes its own on first use (`createFullscreenGui` in
  `gui-resolution.ts`).
- Babylon GUI files: 12 → 8 (the `babylon-gui-files` ratchet). Left: the
  seven map-editor panels, which move with the editor in Phase 9, and
  `gui-resolution.ts`. **Exit met for the game:** none of its UI is
  Babylon GUI. The colour tokens the GUI code shared
  (`SHARED_UI_PANEL`) are gone; the CSS `--panel-*` tokens replace them.
  The remaining Phase 8 item is the accessibility pass.

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
