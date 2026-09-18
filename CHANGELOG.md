# Changelog

All notable changes to Camelot are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.0-rc.1] — Release candidate

First release-candidate cut: all advertised features are wired and playable,
with CI gating every change.

### Added
- Mark & Recall (Shift+M marks; Recall as an instant row in the Y fast-travel menu, guarded against combat/sneaking).
- Save export/import in the pause menu ("Export Save" / "Import Save…").
- Perk spending — new Perks section in the character sheet (Tab) with prerequisite/skill gating.
- Quick-slot assignment — click a HUD slot, then a consumable in the inventory, to bind it.
- Day/night visual cycle — the clock now darkens sun, ambient, and fog (readable ambient floor at night).
- GitHub Actions CI: unit tests, typecheck + build, Playwright E2E on every PR and push to main.
- Full offline play: Cinzel/Inter fonts are self-hosted (no Google Fonts CDN dependency) and all external CDN texture dependencies in CSS replaced with GPU radial/linear gradients.
- Low-poly asset overhaul: overhauled `tools/generate-filler-assets.mjs` and regenerated all 82 GLB models in `public/model/quaternius/` (~250 KB total) with PBR materials; purged legacy dead assets (`Xbot.glb`, `amiga.jpg`).
- Vegetation compound batching: merged chunk foliage scatter into unified meshes per material, cutting draw calls by >80% per chunk.
- Centralized icon utilities (`src/ui/icon-utils.ts`): thematic glyphs for items, equipment slots, attributes, derived stats, crafting categories, and pickpocket targets.
- Modal UX & responsive design: overhauled styling and responsive breakpoints for 8 DOM overlay modals (Character Sheet, Barter, Container, Journal, Skill Tree, Wait Dialog, Guard Challenge, Spellmaking Altar) and dynamic viewport-aware Babylon GUI sizing.
- Accessible focus trapping (`src/ui/dialog-focus.ts`): installed capture-phase Tab cycling and previous-focus restoration for all modal windows.
- 4-personality automated playtest suite (`src/systems/playtest-personalities.test.ts`): 20 comprehensive scenarios validating The Drunk, The Average, The Hardcore, and The Gamer.

### Fixed
- Input adapter modifier handling: Shift+F9 no longer loads a save over the player's
  progress (it opens the Faction Creator, as documented); Shift+E power attack,
  Shift+F5/F8 creator keys, Ctrl+M scene notes, and Ctrl+Z/Y editor undo/redo work again.
- Map editor hotkeys (T/G/P/H/L/F4/F8/F10–F12) are no longer swallowed by gameplay bindings.
- Save-corruption errors are now logged (console) alongside the user-facing notification.
- Escape from graphics settings now runs the settings close handler; pausing with the
  map editor open refreshes the F1 help overlay.

### Changed
- Save format version 29 (adds stealth crouch state and player combat status effects;
  older saves from v5+ still load).
- Package renamed from the `vite-babylon-800` template to `camelot`; single npm lockfile.

### Removed
- Dragon shouts, crafting/smithing, and item condition are deferred from v1
  (code and tests remain; see ROADMAP "Deferred for v1").
