# Camelot — Handoff

Date: 2026-09-20 (evening) · Branch: `main` · Prior HEAD `4a42028` committed 18:22
(Sep-16 handoff's phases 0–5 + menu polish are now committed; what follows is new.)

## Verification status (all green as of this handoff)

| Check | Command | Result |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | clean (fixed 3 errors in new world-gen tests) |
| Unit suite | `npm test` | **171 files / 5,644 tests, all passing** |
| Production build | `npx.cmd vite build` | ✓ (18.5 s) |
| E2E boot smoke | `playwright test boot-smoke` | **PASSING — first green run 2026-09-20** (via system Chrome, see note) |
| E2E skill-tree | `playwright test skill-tree` | **53/53 passing** (spec's audit note updated: UIManager lock gap is fixed) |

Note: `recent-projects-system.test.ts` used to fail 34 tests on earlier runs (suspected environment/timing); it passes in the latest full run. If it recurs, it is pre-existing on `main`, not from this work.

## Playwright / Chromium environment note (important)

- The Sep-16 session's `playwright install chromium-headless-shell` **never completed** — three
  installer processes (PIDs 7588/24040/32544, started Sep-16) were found hung holding
  `ms-playwright/__dirlock` with only 303 bytes downloaded. They were killed and the stale
  lock removed on Sep-20. `ms-playwright/chromium_headless_shell-1217/` remains partial.
- E2E runs here used the **system Google Chrome** via a temporary `channel: "chrome"` config
  (created, used, then deleted — not committed). Before `npx playwright install` works again,
  re-run it to finish the headless-shell download (network to the Playwright CDN stalled it
  for 4 days; verify before relying on the stock `playwright.config.ts` in CI-fresh environments).
- The stock `webServer` spawn (`npx vite --config vite.e2e.config.ts`) works; one run flaked
  because a manually started server on :8099 was mid-dependency-reoptimization. Prefer letting
  Playwright manage the server, or start it manually and wait for "ready".

## What this project is

Babylon.js + TypeScript + Vite browser RPG (Oblivion/Morrowind-inspired), ~128k lines.
Entry: `index.html` → `src/app.ts` → `src/playground/main-scene.ts` → `src/game.ts` (the wiring hub).
Systems live in `src/systems/`, framework (headless quest/dialogue/faction/inventory engines) in `src/framework/`,
DOM overlays in `src/ui/`, chunk world in `src/world/`.

## Verification status (all green as of this handoff)

| Check | Command | Result |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | clean |
| Unit suite | `npm test` | **159 files / 5,442 tests, all passing** |
| Production build | `npm run build` | ✓ |
| E2E boot smoke | `npx playwright test boot-smoke` | **written, NOT yet run** (chromium now installed — first run is the next action) |
| E2E skill-tree | `npm run test:e2e` | existing suite, still passing before menu work; re-run advised |

Note: `recent-projects-system.test.ts` used to fail 34 tests on earlier runs (suspected environment/timing); it passes in the latest full run. If it recurs, it is pre-existing on `main`, not from this work.

## Work delivered (committed as 4a42028 on 2026-09-20 + 3 new commits this session — tree clean)

### Post-4a42028 work committed this session (2026-09-20 evening)

- **World-builder feature** — procedural generation stack: `VoronoiWorldGraph` (provinces,
  settlements, roads), `SimplexTerrainGenerator`, `RiverNetworkGenerator` (D8 flow + lakes),
  `DungeonGenerator` (seeded Arthurian barrow → `CellDefinition`), `ArthurianNameGenerator`;
  `WorldBuilderSystem` + `WorldBuilderUI` (Shift+F4 / Ctrl+Shift+W, Escape handling, seed apply →
  fast-travel landmarks + dungeon cell registration); editor-hub 13th tool card; new deps
  (`delaunator`, `simplex-noise`, `@types/delaunator`); 80 new unit tests.
- **Asset/brand pass** — regenerated all 82 Quaternius filler GLBs (stylized meshes + PBR),
  overhauled `tools/generate-filler-assets.mjs` (`npm run assets:filler`), brand identity
  (`camelot-icon.png`, `camelot-logo.png`, `favicon.svg`, crest logo), favicon links in
  `index.html`, provenance docs, `procedural-texture-manager` rework.
- **Smoke-test bugfix** — animation extension import (see session fix log) + e2e spec note.

### Prior work (phases 0–5 + menu polish, committed)

### Phases 0–2 — performance
- **Leak fixes**: chunk-scoped disposal of CDN props / dragon NPCs / structure PointLights / wildflower materials on chunk unload (`world.onChunkUnloaded` wired in game.ts; `_trackChunkProp` guards late-arriving GLTF clones).
- **Autosave**: per-tick `markDirty()` removed (event-driven dirty only), autosave is silent, writes only when state changed.
- **Frame time**: dirty-checked GUI text (clock gated on in-game minute, compass segment cache, stats/stealth HUD caches), FPS div throttled to 2 Hz; ChunkManager steady-state gate + **budgeted chunk mounts** (`mountBudgetPerUpdate`, default 2); stealth occlusion raycasts per-NPC staggered + reused `Ray`; shadow map `refreshRate = 2` with sun frustum following the player; pooled notifications / damage numbers / hit flashes / sparks (one shared observer per pool); stealth detection pauses while any modal is open.
- **Scale**: static vegetation merged per material (`_mergeVegetationByMaterial`) + `freezeWorldMatrix` on ground/vegetation/structures; LodSystem priority-cull repaired, NPC capsules LOD-culled at 120u; NPC animation LOD (skip >100u); `FixedStepLoop` `maxSubSteps` 5 → 2.

### Phases 3–5 — gameplay depth
- **Archetype NPCs spawn in the world** (inns: innkeeper/barkeeper/rotating shopkeeper/guard; cottages: villager + rotating trainer; pirate forts: 2 bandits + chief) — chunk-scoped, scheduled, loot-tabled. This made barter, shops, trainers, persuasion, inn rooms, 10 dialogue trees reachable.
- **Crime loop live**: assault (3 s debounce) and murder (settlement NPCs) → `CrimeSystem.commitCrime`; `isGuard` archetype guards run the challenge/pay/persuade/jail chain.
- **Dynamic world events materialize loot caches**; NPCs drop their loot tables; dragons carry `boss_loot`.
- **Weapon archetypes wired** to equipment (`EquipmentSystem.onEquipmentChanged` → `setWeaponArchetype`).
- **Combat expression**: dodge roll (F, i-frames), directional power attacks (W=fwd knockdown, A/D=disarm, S=back-cut), elite unblockables, riposte/finisher/execute gated on Block 25/Blade 50/Blade 75, combat-state HUD, death → revive at nearest discovered location + 10 % gold loss, difficulty setting (settings dialog), pack aggro broadcast, partial detection → INVESTIGATE.
- **World sim**: SurvivalSystem wired (hunger/fatigue/cold, penalties, frost damage, food with `nutrition` edible, wait/inn rest restores, well-fed/rested → `globalXpMultiplier`); quests pay `rewardGold`/`rewardItems`; fame + persuasion disposition factor into barter prices (`BarterSystem.sessionBuyPriceFactor`); travel events on fast travel, ambient events hourly; leveled-list elite drops.

### Menu polish pass (this session) — audit found 16 defects, top ones fixed
- **P0**: Wait dialog Wait/Cancel no longer trap input (`ui.onWaitDialogClosed` → `_restoreGameplayInput`); Escape now closes Graphics Settings; crosshair hides for ALL HTML modals (`ui.setHtmlOverlayActive`, driven per-frame from game.ts); menu toggles use own-close-first + `_isCombatInputBlocked` bail (no more stacked modals); Escape/E-closing inventory no longer leaks `isBlocked`.
- **P1**: Follower panel reachable again (**G** — F is dodge roll); editor-hub self-Escape removed (double-fire fixed; tests updated to the new contract); alchemy/enchanting/attribute ✕ and character-sheet ✕ restore input via new `onClosed`/`onClose` callbacks; Escape during character creation is ignored (`_inCharacterCreation`); gear ⚙ button guarded; level-up auto-attribute-panel guarded.
- **Documented skill-tree gap fixed**: `UIManager.refreshSkillTree(trees, points, prereqMet?)` now renders locked skills as "🔒 Locked" (non-clickable, a11y tag) — `SkillTreeSystem` passes `arePrerequisitesMet`.
- **Refactor**: `_suspendGameplayInput()` / `_restoreGameplayInput()` centralize the exit/detach + relock/attach choreography; pause cascade rewritten to use them.
- New helpers/fields: game.ts `_inCharacterCreation`, `_currentDialogueNpcName` (cleared on dialogue close); ui-manager `onWaitDialogClosed`, `onAttributePanelClosed`, `setHtmlOverlayActive`.

## Next actions (in order)

1. ~~**Run the smoke test**~~ — DONE 2026-09-20, passing. It caught one real bug (below); keep
   the suite in CI and investigate any future page-error failure the same way.
2. ~~**Re-run the skill-tree e2e**~~ — DONE 2026-09-20, 53/53 passing with the finding note
   updated to "fixed" status.
3. **Manual play-through** (only step I can't do headlessly): movement, open/close every menu, Escape from each, barter with an innkeeper shopkeeper, wait at an inn, dodge roll (F), save/load. **Plus**: watch an NPC idle/walk loop up close to confirm the animation fix visually (capsule breathing/bob).
4. ~~**Commit** the working tree~~ — DONE 2026-09-20, split into 3 commits (world-builder feature /
   asset-brand pass / smoke-test bugfix + e2e note). See `git log --oneline -5`.

## Session fix log (2026-09-20 evening — the smoke test earned its keep)

- **Real bug found by first-ever boot-smoke run**: `TypeError: this._scene.beginAnimation is not
  a function`. Root cause: Babylon.js v8 moved `Scene.beginAnimation`/`beginDirectAnimation` into
  the optional side-effect module `@babylonjs/core/Animations/animatable`
  (`AddAnimationExtensions(Scene, Bone)` patches the prototype; the `declare module` block keeps
  tsc silent, so typecheck passed while the live game crashed on the first NPC animation).
  Fix: side-effect `import "@babylonjs/core/Animations/animatable"` in
  `src/systems/animation-system.ts`. One-line change, full suite + smoke green after.
- **Type fixes in new world-gen tests** (were failing `tsc`): unused `options` params in
  `dungeon-generator.test.ts` mocks → `_options`; `SimplexTerrainGenerator({seed})` → `(seed)` in
  `river-network.test.ts` (constructor takes `string | number`, not an options object).
- **Spec update**: `tests/e2e/skill-tree.spec.ts` header + "UIManager gap" describe rewritten to
  "fixed" status (verified `refreshSkillTree(..., prereqMet?)` renders "🔒 Locked" and
  `SkillTreeSystem` passes `arePrerequisitesMet`).

## Known deferred work (from the audits)

- **Menus**: editor creator dialogs (F10–F12) lack `aria-modal` and pause/dialogue guards (deliberately left — dev tools); dead legacy keyboard cascade (game.ts ~3010–3300) could be deleted after a soak period; `JournalUI`/`TooltipUI`/HTML `SkillTreeUI` remain unwired libraries.
- **Gameplay**: pickpocket system still has no UI entry point; ranged/magic enemy AI (`npcAttackArchetype` field exists, telegraph AI branches don't); quest branching/failure states (rewards shipped).
- **Performance** (skipped deliberately in Phase 2): navmesh tiling (feature is opt-in/disabled); full mesh instancing/thin-instances beyond the per-chunk merge.
- Map editor `G` (gizmo) now flows through the adapter (`toggleFollowerPanel` handler delegates when editor is enabled) — the legacy `g` branch was removed; if editor gizmo ever stops responding, look there first.

## Key file map

| Concern | File |
|---|---|
| Wiring hub (6000+ lines) | `src/game.ts` |
| Pause cascade / menu toggles / `_suspendGameplayInput` / `_restoreGameplayInput` | `src/game.ts` (search `adapter.onAction("pause"` and `_restoreGameplayInput`) |
| Babylon HUD + pooled feedback + skill tree panel | `src/ui/ui-manager.ts` |
| Chunk lifecycle (budget, gate) | `src/systems/chunks/ChunkManager.ts` |
| Chunk props/NPC disposal tracking | `src/game.ts` `_chunkFantasyContent` / `_trackChunkProp` / `onChunkUnloaded` |
| Input bindings | `src/adapters/babylon/babylon-input-adapter.ts` (`DEFAULT_BINDINGS`) |
| Smoke test | `tests/e2e/boot-smoke.spec.ts` |
| Roadmap log of all passes | `ROADMAP.md` |
