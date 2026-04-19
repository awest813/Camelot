# Camelot Framework

A modular, browser-based RPG **framework** built with **Babylon.js 8**, **TypeScript**, and **Vite**. Camelot now ships as:

1. a **headless RPG engine layer** (dialogue, quests, inventory, factions, saves, mods), and  
2. a **Babylon demo runtime** proving how the framework can drive a playable experience.

## Why Camelot Framework

Camelot is designed for developers who want to build Bethesda-lite RPG workflows in the browser while keeping systems decoupled and maintainable.

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
- **Swimming**: breath meter (30 s) drains while submerged; drowning damage when depleted; Argonian racial immunity suppresses drain. (Argonian racial trait and Water Breathing spell/potion respected.)

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
- **Birthsign System**: choose one of 13 birthsigns at character creation for permanent attribute/stat bonuses and a once-per-day special power (Mara's Gift, Moonshadow, Lover's Kiss, …).
- **Class System**: choose a character class (Warrior, Mage, Thief, Battlemage, etc.) that defines two favored attributes, five major skills (1.5× XP, start higher), and five minor skills (1.25× XP).
- **Horse / Stable System**: purchase and ride horses from stable NPCs; each horse has its own speed multiplier and saddlebag inventory; O to mount/dismount, Shift+O to browse stable or open saddlebag.
- **Disease System**: contract one of seven Oblivion-style diseases (Rust Chancre, Swamp Rot, Witbane, Collywobbles, Brain Rot, Yellow Tick, Porphyric Hemophilia) through combat hits; each disease weakens one or more attributes until cured by a Cure Disease potion or shrine; Argonians are immune.

### UI + Quality of Life

- Real-time HUD bars and XP display.
- Pause menu with quick save/load actions.
- Notifications for items, combat, and quest events.
- Debug inspector and FPS overlay support.
- **Compass HUD**: top-center strip showing scrolling cardinal direction (N / NE / E …) based on camera heading.
- **Wait / Rest** (T key): choose 1–24 in-game hours to skip time; clock advances and resources restore proportionally.
- **Fast Travel Menu** (Y): choose discovered destinations with estimated travel time; world clock advances on arrival.
- **Spellmaking Altar** (X): forge custom spells from configurable effect components with live gold-cost preview.

## Map Editor

The in-engine **Map Editor** (activated with F2) lets you author world content without leaving the game runtime.

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

### Phase 3 — Validation + Data Safety (active)

- **Built-in map validation reports** now catch key authoring issues: orphaned NPC patrol references, under-defined patrol routes, and overlapping placements.
- Validation is scriptable in tests and can be used as a pre-export quality gate for map content.

## Controls

| Key / Button | Action                              |
| ------------ | ----------------------------------- |
| WASD         | Move                                |
| Mouse        | Look                                |
| Left Click   | Melee attack (Stamina)              |
| Right Click  | Magic attack (Magicka)              |
| E            | Interact / pick up / talk           |
| I            | Toggle inventory                    |
| J            | Toggle quest log                    |
| K            | Toggle skill tree                   |
| **T**        | **Wait / Rest (choose 1–24 hours)** |
| **X**        | **Open Spellmaking Altar**          |
| 1 / 2 / 3    | Melee archetype select              |
| 4 / 5 / 6    | Magic archetype select              |
| 7 / 8 / 9 / 0 | Quick-slot consumable use         |
| Y            | Open fast travel menu               |
| **P**        | **Toggle pet companion panel**      |
| **F**        | **Toggle follower panel**           |
| **O**        | **Mount / dismount horse**          |
| **Shift+O**  | **Browse stable (unmounted) / open saddlebag (mounted)** |
| M            | Toggle audio mute                   |
| F5           | Quick save                          |
| F9           | Quick load                          |
| Esc          | Pause menu                          |
| **F2**       | **Toggle map editor mode**          |
| **G**        | **Cycle editor gizmo mode (editor)** |
| **T**        | **Cycle editor placement type (editor)** |
| **N**        | **Place entity (editor)**           |
| **P**        | **Start new NPC patrol group (editor)** |
| **H**        | **Cycle terrain tool (editor)**     |
| **[ / ]**    | **Terrain sculpt step (editor)**    |
| **F4**       | **Export map to JSON (editor)**     |

## Tech Stack

- **Rendering/Engine**: Babylon.js 8
- **Language**: TypeScript
- **Build Tool**: Vite 6
- **Physics**: Havok
- **Navigation**: Recast/Detour
- **Testing**: Vitest

## Quick Start

### Prerequisites

- Node.js 18+
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

### Run tests

```bash
npm test
```

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

- **Map Editor Phase 4** (active): standalone editor shell exploration and broader creator workflows beyond the in-runtime layer/panel toolset.
- **Framework-first consolidation**: wiring framework state as source-of-truth for all demo systems.
- **Content tooling**: quest authoring utilities, mod validation CLI.
- **Map Editor Phase 3+**: serialized map packs, collaboration workflows, standalone editor shell.

---

Built on top of ideas from [babylon-vite-template](https://github.com/minibao/babylon-vite-template).
