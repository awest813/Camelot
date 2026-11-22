# Changelog

All notable changes to Camelot are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- **Village settlements.** Named Arthurian villages (Camcross, ...) now appear
  in plains and forests, roughly one area in seventeen, at least three areas
  from the start. Each one has:
  - six buildings around a square: an inn, a smithy with a working forge, a
    general store, and cottages and longhouses;
  - a well, benches, lanterns and market stalls in the square;
  - gate guards and banners at the entrance road;
  - residents: an innkeeper, a barkeep, the village smith (Armorer trainer), a
    shopkeeper, a traveling merchant, and villagers.

  Villagers keep a daily routine: out on the square by day, a stroll in the
  evening, and back to their own door at night. Gate guards walk a beat from
  the gate round the square.
  Walking into the square shows "Discovered: <name>" and adds the village to
  the fast-travel menu. Villages are always the same in the same place, and
  their ground is kept clear of trees, rocks and ruins.
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

- Real Quaternius models (CC0) replace the generated stand-ins: props from the
  Fantasy Props MegaKit, trees, rocks and plants from the Stylized Nature
  MegaKit, characters and outfits from the Modular Character Outfits and
  Universal Base Characters kits, plus an orc and two dungeon monsters. Slots
  no free pack covers keep darker generated stand-ins.
- People look like adults instead of chibi figures. Villagers, innkeepers,
  merchants, guards, bandits and trainers are now realistic peasants and
  rangers (with heads and hair from Universal Base Characters), animated with
  the Universal Animation Library. Bandit chiefs are orcs. The undead stay
  KayKit skeletons.
- Towns and the countryside are furnished with those props: inns get tables,
  benches, barrels, banners and candle stands, cottages get barrels, crates and
  a cauldron at the alchemist's, and dead and twisted trees, rocks and shelf
  fungus are scattered by biome. The smith's forge is a stone-and-brick hearth
  from the Medieval Village kit.
- KayKit textures are colour-graded darker and less saturated to match.
- Bandit camps in the desert are now a rough wooden palisade with red
  banners at the entrance, a wagon, crates, barrels, a weapon rack and the
  chief's chest. They replace the online-only cartoon pirate fort and cannon.
- **Village jobs.** Ask any innkeeper "Any work going?" to take a job. There
  are bounties on bandits, the restless dead in the ruins, or (from level 5) a
  dragon, and supply runs for iron, leather or healing potions. Jobs show in
  the quest log under the village's name and track your kills. Supply runs pay
  when you hand the goods over; bounties pay when you come back. Each inn
  offers a new job once you finish one, and jobs are saved with your game.
  Every village square also has a notice board (press E) that offers the
  same job as the village inn. Both open a job window that shows the job,
  the reward and your progress. From it you can accept, turn the job down
  ("Not now" rolls a different one), hand it in once it's done, or abandon
  it. Each job you take gets its own quest-log entry, so a second job at the
  same inn no longer reuses the finished one's entry.
  The notices pinned to the board now show headings, handwriting, wax seals
  and a "wanted" sketch instead of blank paper.
- Villagers no longer walk into walls. When strolling in the evening they only
  pick spots they can reach in a straight line without passing through a
  building. If something blocks them anyway, they step aside to get round it,
  and if that keeps failing they stop rather than push against the wall
  forever.
- Real buildings: cottages are half-timbered plaster with tiled roofs, and inns
  are stone with timber gables. Both are built from Quaternius Medieval
  Village pieces, with arched windows, shutters and plank doors. They replace
  the online-only cottage and inn models, so towns have buildings in offline
  and Steam builds too. Walls block the player, and NPCs can't see through
  them when deciding whether you've been spotted or witnessed committing a
  crime.
- The whole world now shares one dark-fantasy colour grade (with
  `src/rendering/dark-grade.ts` as the single source):
  - Every texture the game generates (ground, bark, foliage, stone, plaster)
    is graded as it is made.
  - Trees, grass and plant colours are olive and moss instead of bright green.
  - Skies are overcast grey-blue with a grey haze on the horizon, dusks are
    blood-red, and nights are cold moonlight.
  - The screen grade is more muted, with more contrast, cold shadows, warm
    highlights and a heavier vignette. It now applies on every quality
    setting: on the lowest setting, and in the WebGPU renderer, the effects
    pipeline is off, so the grade is applied by the materials instead.

### Fixed
- NPCs no longer walk through buildings: each cottage, house and inn now
  physically blocks them, and physics projectiles too. You can still walk
  through the doorway.
- A townsperson you'd fought could stay hostile for good if it calmed down
  without first walking all the way home (for example after losing track of
  you, or after fleeing). Townsfolk now settle whenever they go back to their
  routine.
- Smithing could take fewer materials than a recipe costs when the same
  material sat in more than one bag slot.
- Fast travel to a village used to land you inside the well; you now arrive on
  the entrance road. Village names repeat far less often, and the smithy's
  anvil no longer clips into its wall.
- Forging an item no longer shows two notifications.
- Dragons were invisible in offline and Steam builds. Their body was a
  downloaded model that never loaded offline, so players fought an unseen
  500-HP boss. They now have a local dark dragon body (horned head, spined
  back, membrane wings, bladed tail) that moves with the boss, turns to face
  you in combat, breathes, and slumps when slain. The old downloaded model
  stood still and never followed the boss.
- Imported models were drawn mirrored, and turning them had no effect: the
  loader discarded part of the model's orientation data and ignored its
  stored rotation. Placed props, scattered trees and rocks, and buildings now
  face the way they are meant to.
- Townsfolk no longer attack the player on sight. Innkeepers, shopkeepers,
  villagers and trainers used to draw weapons as soon as you walked within
  about 12 paces, and the stealth system turned them hostile as soon as it
  registered that they had fully seen you. That made talking and trading
  with them impossible.
  - Only monsters, bandits and the undead are hostile on sight now.
  - A townsperson you hit fights back, then calms down after walking home.
  - One brawl no longer sets the whole guild on you; the guards and the crime
    system answer it instead.
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
