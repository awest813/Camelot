# Camelot Framework

A modular, browser-based RPG **framework** built with **Babylon.js 8**, **TypeScript**, and **Vite**. Camelot now ships as:

1. a **headless RPG engine layer** (dialogue, quests, inventory, factions, saves, mods), and  
2. a **Babylon demo runtime** proving how the framework can drive a playable experience.

## Why Camelot Framework

Camelot is designed for developers who want to build open-world RPG workflows in the browser while keeping systems decoupled and maintainable.

- Framework foundation: dialogue engine, quest graph, inventory domain, faction reputation.
- Runtime persistence: versioned save-state JSON architecture with migration hooks.
- Mod-ready architecture: manifest-driven mod folder loading in browser-safe format.
- Demo game client: combat, world streaming, UI, and procedural content to validate the stack.

## Framework Core

The framework modules live under `src/framework/` and are intentionally engine-agnostic:

- `dialogue/` — branching dialogue sessions with typed conditions/effects.
- `quests/` — graph-based quest progression and event ingestion.
- `inventory/` — capacity/stack/equipment intent logic without UI coupling.
- `factions/` — reputation + disposition model (hostile/neutral/friendly/allied).
- `save/` — schema-versioned save files with migration support.
- `mods/` — manifest-driven mod loading and deterministic content merge.
- `runtime/` — convenience orchestration layer combining these modules.

## Gameplay Systems

### Player + Combat

- Physics-based first-person movement.
- Core RPG resources: **Health**, **Magicka**, **Stamina** with regeneration.
- Melee and magic combat loops with resource costs and cooldown discipline.
- Damage feedback via floating combat text and hit indicators.
- Three melee archetypes (Duelist / Soldier / Bruiser) and three magic archetypes (Spark / Bolt / Surge).
- **Swimming**: breath meter (30 s) drains while submerged; drowning damage when depleted. The Fen-folk (and the Breath of the Lake spell or potion) breathe water, so no drain.

### NPCs + AI

- NPC patrol behavior with randomised wait durations and idle look-around.
- Full AI state machine: **IDLE → PATROL → ALERT → INVESTIGATE → CHASE → ATTACK → RETURN**.
  - **INVESTIGATE**: when a player escapes the alert window, the NPC moves to the last known player position before standing down — rather than immediately returning to patrol.
- Multi-NPC threat handoff and attack-slot arbitration (one attacker engages at a time).
- Dialogue interactions with cinematic conversation camera.
- Interaction prompts and crosshair-based focus highlighting.

### World + Content

- Infinite chunked terrain generation.
- Biome variants (plains, forest, desert, tundra) with procedural props.
- Deterministic structure spawns (ruins, shrines, watchtowers).
- Loot placement and pickup flow.

### Progression

- Inventory with stacking and equip/unequip support.
- Equipment slots with stat modifiers.
- Quest log with objective tracking (Kill / Fetch / Talk).
- Skill trees (Combat / Magic / Survival) with persistent rank progression.
- **Guard Challenge Modal**: when guards confront you over bounty, choose to pay fine, serve jail time, resist arrest, or attempt persuasion.
- **Heritages and Omens**: choose one of eight heritages (the peoples of the realm) and one of 13 omens at character creation, for permanent attribute/stat bonuses and a once-per-day power (Grail's Grace, Under the Hill, Spellbound, …).
- **Callings**: choose a calling (Man-at-arms, Mage, Cutpurse, War-druid, Hedge-witch, …) that defines two favored attributes, five major skills (1.5× XP, start higher), and five minor skills (1.25× XP).
- **Horse / Stable System**: purchase and ride horses from stable NPCs; each horse has its own speed multiplier and saddlebag inventory; O to mount/dismount, Shift+O to browse stable or open saddlebag.
- **Ailments**: catch one of seven ailments (Marsh Ague, Fen Fever, Brain-fog, The Flux, Falling Sickness, Tick Fever, the Moon-curse) through combat hits; each weakens one or more attributes until cured by a Cure Disease potion or shrine; the Fen-folk are immune.
- **Locks**: a lock within your skill (half Sneak plus half Agility) opens; a harder one takes a lockpick, with an even chance just past your skill that falls as locks get harder, and a failed try snaps the pick. Picks are sold by traders and carried by bandits; every bandit camp keeps a locked strongbox of spoils, every haunted manor an old coffer, every graveyard a burial casket of grave goods, and every forest inn the innkeeper's strongbox (taking from it is theft, if anyone sees); a chest emptied (or a camp cleared) stays empty for three game days.
- **Survival System**: three survival needs — Hunger, Fatigue, and Cold — each tracked on a [0, 100] scale. Hunger drains over two in-game days; Fatigue over one day; Cold drains in freezing environments and recovers near fires or indoors. Threshold levels (satiated / normal / hungry / starving, etc.) apply stat penalties (stamina regen, max stamina, max magicka, frost damage) and XP bonuses when the player is well-fed and rested. Restored via eating food, resting, or warming up. Fully serialized.
- **Companion Stance & Synergy**: the active companion now has a tactical **stance** (aggressive / defensive / stealth) toggled via the follower panel. Each combat role has a signature **ability** (warrior → Shield Bash, archer → Arrow Volley, mage → Arcane Surge, rogue → Smoke Bomb) triggered on cooldown. **Synergy combos** fire automatically when the player's combat action matches the follower's role (e.g. player power-attack + warrior follower → Momentum Surge; mage + cast-spell → Arcane Resonance). All cooldowns persist across saves.
- **Dynamic World Events** *(Crimson Desert-inspired)*: `DynamicWorldEventSystem` schedules reactive roadside encounters via biome, faction-threat, weather, and time-of-day weighting. Faction hostility multiplies spawn chance; storm weather and night-time windows boost dangerous events. Each template declares XP/gold rewards and can chain a follow-on event (e.g. bandit ambush → hidden cache becomes discoverable). Save-persistent trigger history (SAVE_VERSION 29).

### UI + Quality of Life

- Real-time HUD bars and XP display.
- Pause menu with quick save/load actions.
- Notifications for items, combat, and quest events.
- FPS overlay; the Babylon inspector is in the editor app (Shift+Ctrl+Alt+I).
- **Compass HUD**: top-center strip showing scrolling cardinal direction (N / NE / E …) based on camera heading.
- **Wait / Rest** (T key): choose 1–24 in-game hours to skip time; clock advances and resources restore proportionally.
- **Fast Travel Menu** (Y): choose discovered destinations with estimated travel time; world clock advances on arrival.
- **Spellmaking Altar** (X): forge custom spells from configurable effect components with live gold-cost preview.

## Map Editor

The editors live in the **editor app**, a second page next to the game: `/editor.html`, or `npm run dev` and open `http://localhost:8088/editor.html`. It runs the same game with the editor suite plugged in, so leaving the map editor puts you straight into a play-test. There, the **Map Editor** (F2) lets you author world content in the running world, and the creators, bundle tools and asset browser are on their shortcuts or the Editor Hub (F11). Shift+Ctrl+Alt+I opens Babylon's inspector. The game page (`/`) ships none of this code.

### Phase 1 — Foundational Editing (complete)

- Edit mode toggle that safely suspends gameplay input.
- Transform gizmos (position / rotation / scale) with configurable grid snapping.
- Marker placement at the player's view position.
- Terrain sculpt/paint pass on loaded chunk meshes (press **H** to cycle terrain tool; click to apply).

### Phase 2 — Content Authoring (complete)

- **Five placement types** selectable with T: `marker`, `loot`, `npc-spawn`, `quest-marker`, `structure` — each with a distinct mesh shape and colour.
- **Patrol route authoring**: press P to start a new NPC patrol group; each NPC spawn point placed while the group is active is added to the route and connected by a visible overlay line.
- **Map export / import**: press F4 to serialize the full editor layout (entities + patrol routes) to a portable JSON object (copied to clipboard or printed to console). The JSON can be re-imported to recreate the layout in a fresh session.
- **Property panel**: select any placed entity to open the in-editor property panel; configure label, loot table ID, spawn template, objective ID, dialogue trigger, or structure ID. Press Apply to commit changes or Delete to remove the entity.
- **Layer-targeted editing**: the layer panel can now mark an active placement layer so new entities land directly in `terrain`, `objects`, `events`, `npcs`, or `triggers`, while still honoring each layer's visibility/lock state.

### Phase 3 — Validation + Data Safety (complete)

- **Built-in map validation** catches eight categories of authoring issues:
  - `missing-patrol-group` — NPC spawn references a patrol group that no longer exists.
  - `patrol-route-too-short` — Patrol group has fewer than two waypoints.
  - `entity-overlap` — Two entities occupy the same or nearly the same world position.
  - `orphaned-quest-marker` — Quest marker has no `objectiveId` set.
  - `duplicate-objective-id` — Multiple quest markers share the same `objectiveId`.
  - `unknown-objective-id` — Quest marker `objectiveId` not found in the quest system (requires validation context).
  - `missing-loot-table` — Loot entity references an unknown loot table ID (requires validation context).
  - `missing-spawn-template` — NPC spawn references an unknown spawn template ID (requires validation context).
- `MapEditorSystem.validateMapData()` is a **static helper** — run validation offline against any exported `MapExportData` without a live editor instance (useful for pack-level CI gates).
- Validation is scriptable in tests and can be used as a pre-export quality gate for map content.

## Controls

### Gameplay

| Key / Button   | Action                                                   |
| -------------- | -------------------------------------------------------- |
| WASD           | Move                                                     |
| Mouse          | Look                                                     |
| Left Click     | Melee attack (Stamina)                                   |
| Right Click    | Block / parry (hold)                                     |
| Q              | Cast equipped spell (Magicka) / charge staff             |
| Z              | Cycle equipped spell                                     |
| R              | Draw bow (hold); release to fire                         |
| C              | Toggle crouch / sneak                                    |
| E              | Interact / pick up / talk                                |
| I              | Toggle inventory                                         |
| J              | Toggle quest log                                         |
| K              | Toggle skill tree                                        |
| U              | Toggle attribute panel                                   |
| L              | Open alchemy workbench                                   |
| B              | Open enchanting altar                                    |
| Shift+B        | Open smithing forge (craft gear; materials from inventory) |
| V              | Use your heritage's power (once a day)                  |
| Shift+V        | Use your omen's power (once a day)                      |
| H              | Show fame / infamy status and active effects             |
| T              | Wait / Rest (choose 1–24 hours)                          |
| X              | Open Spellmaking Altar                                   |
| Shift+1 / 2 / 3 | Melee stance select                                     |
| Shift+4 / 5 / 6 | Magic stance select                                     |
| 1 – 0          | Use the quick-slot consumable (click a HUD slot to assign) |
| F8             | List what is on each quick slot                          |
| Tab            | Character sheet                                          |
| F              | Dodge roll                                               |
| CapsLock       | Auto-run on / off                                        |
| N              | Words of the Old Tongue (choose a word)                  |
| Shift+N        | Speak the chosen word                                    |
| Y              | Open fast travel menu (also Recall to your mark)         |
| Shift+M        | Mark this spot for Recall                                |
| M              | World map                                                |
| P              | Toggle pet companion panel                               |
| G              | Toggle follower panel                                    |
| O              | Mount / dismount horse                                   |
| Shift+O        | Browse stable (unmounted) / open saddlebag (mounted)     |
| F4             | Toggle first / third person                              |
| F7             | Toggle audio mute                                        |
| F1             | Toggle controls / help overlay                           |
| F3             | Toggle debug overlay                                     |
| F5             | Quick save                                               |
| F9             | Quick load                                               |
| Esc            | Pause menu / close open panel                            |

### Map Editor (editor app only; active while F2 mode is on — these keys override their gameplay bindings)

| Key / Button      | Action                                  |
| ----------------- | --------------------------------------- |
| **F2**            | Toggle map editor mode                  |
| **G**             | Cycle gizmo mode (position / rotation / scale) |
| **T**             | Cycle placement type (marker → loot → npc-spawn → quest-marker → structure) |
| **N**             | Place entity at view position           |
| **P**             | Start new NPC patrol group              |
| **H**             | Cycle terrain tool (none → sculpt → paint) |
| **[ / ]**         | Decrease / increase terrain sculpt step |
| **F4**            | Export map layout to JSON file          |
| **Ctrl+Z**        | Undo last editor action                 |
| **Ctrl+Y** / **Ctrl+Shift+Z** | Redo                      |
| **Ctrl+M**        | Toggle scene notes panel                |

## Tech Stack

- **Rendering/Engine**: Babylon.js 8
- **Language**: TypeScript
- **Build Tool**: Vite 6
- **Physics**: Havok
- **Navigation**: Recast/Detour
- **Testing**: Vitest

## Quick Start

### Prerequisites

- Node.js 20+ (22 or 24 recommended)
- npm

### Install

```bash
npm install
```

### Run in development

```bash
npm run dev
```

Open `http://localhost:8088`.

### Mod folder workflow

- Mod manifest path: `public/mods/mods-manifest.json`
- Example mod pack: `public/mods/example-guard-overhaul.json`
- Loader contract: manifest lists mod JSON files; each mod provides partial content bundles.

### Build and preview

```bash
npm run build
npm run preview
```

The production build uses relative asset paths (`./`), so `dist/` can be served
from any static host or subpath (e.g. GitHub Pages, itch.io).

### Desktop build (Steam)

Install the shell once with `npm install --prefix desktop`. `npm run desktop:pack` produces a Steam depot folder at `release/linux-unpacked/`
(add `--win dir` or `--mac dir` on those hosts). Saves go to a real file under
the Camelot user-data directory, achievements record locally and through
Steamworks when an app id is configured, and the pause menu can quit the
process. See [docs/steam-release.md](docs/steam-release.md) for the upload
checklist. Remote Babylon.js props stay off unless `VITE_ENABLE_REMOTE_PROPS=true`,
so the depot does not need a network connection.

### Run unit tests

```bash
npm test
```

### Run E2E tests (Playwright)

The E2E suite boots the real game in headless Chromium (software WebGL) and
drives character creation, saving, and loading end to end.

```bash
# one-time: install the Chromium browser binary
npx playwright install --with-deps chromium

npm run test:e2e
```

The Playwright config starts its own Vite dev server on `http://127.0.0.1:8099`
(see `playwright.config.ts` / `vite.e2e.config.ts`); no separate dev server is
needed. Reports are written to `playwright-report/`.

CI (`.github/workflows/ci.yml`) runs unit tests, typecheck + build, and the
E2E suite on every push to `main` and every pull request.

### Debugging + targeted test workflow

- Run a focused test file while iterating on a system:

```bash
npx vitest run src/systems/map-editor-system.test.ts
```

- Use watch mode during local debugging:

```bash
npm run test:watch
```

## Project Layout

- `src/game.ts` – game bootstrap and system orchestration.
- `src/framework/` – headless RPG framework modules.
- `src/entities/` – player, NPC, loot, and entity logic.
- `src/systems/` – combat, interaction, dialogue, inventory, equipment, quest, save, map editor, and related systems.
- `src/world/` – terrain chunking, biome generation, structures.
- `src/ui/` – HUD, menus, overlays, notifications.

## Roadmap Highlights

The full roadmap lives in [`ROADMAP.md`](./ROADMAP.md). Key upcoming focus areas:

- **Map Editor Phase 4** (active): standalone editor shell, serialized map packs, and broader creator workflows beyond the in-runtime layer/panel toolset.
- **Framework-first consolidation**: wiring framework state as source-of-truth for all demo systems.
- **Content tooling**: quest authoring utilities, mod validation CLI, collaboration workflows.

---

Built on top of ideas from [babylon-vite-template](https://github.com/minibao/babylon-vite-template).
