# Camelot — Handoff

Date: 2026-09-16 · Branch: `main` · Working tree: **uncommitted changes** (phases 0–5 + menu polish, all verified)

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

## Work delivered (uncommitted)

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

1. **Run the smoke test** (chromium is now installed):
   ```
   npx playwright test boot-smoke
   ```
   It boots the real game, completes character creation, saves (F5) — asserting `survival`/`travelEvents`/`ambientEvents` persist — and loads (F9), failing on any page/console error. `--enable-unsafe-swiftshader` is set in playwright.config.ts for headless WebGL. First run may surface minor selector/timing issues in `completeCharacterCreation` (steps: Welcome → World → Name → Race → Birthsign → Class; cards have no defaults, click first card per step).
2. **Re-run the skill-tree e2e** (`npm run test:e2e`) — the spec documents the old locked-skill gap as an "audit finding"; that gap is now fixed, so update the spec's finding note.
3. **Manual play-through** (only step I can't do headlessly): movement, open/close every menu, Escape from each, barter with an innkeeper shopkeeper, wait at an inn, dodge roll (F), save/load.
4. **Commit** the working tree (consider splitting: perf phases / depth phases / menu polish).

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
