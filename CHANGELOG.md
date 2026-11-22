# Changelog

All notable changes to Camelot are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Smithing forge (Shift+B): 11 recipes that use Iron Ingots, Steel Ingots and
  Leather Strips from the inventory. Better Armorer skill gives Fine to
  Masterwork gear with higher stats.
- Armorer skill. It goes up by smithing and repairing.
- Gear wear: weapons wear when they hit, shields when they block, and armor
  when the player is hit. Worn gear deals less damage and blocks less. The
  character sheet shows each equipped piece's condition.
- Repair Hammers: click one in the inventory to repair the most worn equipped
  piece. Higher Armorer skill repairs more.
- Village Smith: some plains cottages now have a smith with a forge and anvil.
  The smith trains Armorer (up to 50), opens the forge, and sells ingots and
  hammers.
- Each piece of gear wears on its own: two Iron Swords keep separate
  condition. Hovering gear in the inventory shows its condition. Equipping
  now takes the exact copy you clicked.
- Worn gear is worth less: a broken piece sells and buys for a quarter of its
  value. Barter rows show each piece's condition, and Sell and Buy act on the
  exact copy you click. Gear you sell keeps its wear while it sits in the shop,
  so buying it back doesn't repair it.
- Four Armorer perks: Field Repairs (hammers repair 50% more), Tempered Steel
  (gear wears 30% slower), Master Craftsman (forged items come out at a higher
  quality) and Unbreakable (wear halved again, +10 armor).
- Smithing materials and hammers are sold by the arms and armor merchants and
  drop from bandits and dungeons. New characters start with a small kit.

- Forges: steel work (smelting, steel gear) and the iron cuirass need you
  standing at a forge; other iron gear and hammers can be made anywhere.
  There are forges near the starting area, at Village Smith cottages, and
  behind inns whose shopkeeper sells arms or armor.

### Fixed
- Inns, cottages, pirate forts and their people (innkeepers, shopkeepers,
  trainers, bandits, dragons) were missing from default builds. The setting
  that keeps the remote Babylon.js models off was also stopping every one of
  these sites from being set up. Sites now always appear; with remote models
  off, the CDN buildings are left out but the people and local props still
  appear.
- With remote models off, the three starting-area weapon pickups still
  downloaded their models from the Babylon.js CDN. Remote models are now
  never fetched in that case, and those pickups show their plain loot marker
  instead.
- Crafting messages use names ("Steel Sword requires a Forge.",
  "2× Iron Ingot") instead of internal ids.

### Changed
- Plain B still opens Enchanting. B with Shift held now opens Smithing.
- Saves gain an optional `crafting` field. Save version stays at 29, and older
  saves still load.

## [1.0.0] — Steam release

Desktop shell for Steam, with on-disk saves, a quit path, credits, and the
launch achievement set. In the browser, Quit still reloads the page and
achievements stay in localStorage.

### Added
- Electron shell (`desktop/`) that loads the production build over an `app://`
  protocol, toggles fullscreen (Alt+Enter or Settings), and quits from the
  pause menu. Steam Deck (`SteamDeck=1`) starts fullscreen.
- Save slot mirrored to `userData/saves/slot.json` for Steam Auto-Cloud. On
  boot the newer of the disk slot and the browser slot is kept.
- Ten launch achievements (`steam/achievements.json`). Unlocks persist locally
  and are forwarded to Steamworks when `steamworks.js` is installed and an app
  id is set (`STEAM_APP_ID`, a dev-only `steam_appid.txt`, or
  `desktop/steam-app-id.json`).
- Credits dialog on the pause menu (engine, KayKit, Quaternius, fonts).
- `npm run desktop:pack` writes a depot folder with electron-builder.

### Changed
- Version 1.0.0. Save format stays at version 29.

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
