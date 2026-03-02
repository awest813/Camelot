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

### UI + Quality of Life

- Real-time HUD bars and XP display.
- Pause menu with quick save/load actions.
- Notifications for items, combat, and quest events.
- Debug inspector and FPS overlay support.

## Map Editor

The in-engine **Map Editor** (activated with F2) lets you author world content without leaving the game runtime.

### Phase 1 — Foundational Editing (complete)

- Edit mode toggle that safely suspends gameplay input.
- Transform gizmos (position / rotation / scale) with configurable grid snapping.
- Marker placement at the player's view position.
- Terrain sculpt/paint pass on loaded chunk meshes (press **H** to cycle terrain tool; click to apply).

### Phase 2 — Content Authoring (active)

- **Five placement types** selectable with T: `marker`, `loot`, `npc-spawn`, `quest-marker`, `structure` — each with a distinct mesh shape and colour.
- **Patrol route authoring**: press P to start a new NPC patrol group; each NPC spawn point placed while the group is active is added to the route and connected by a visible overlay line.
- **Map export / import**: press F4 to serialize the full editor layout (entities + patrol routes) to a portable JSON object (copied to clipboard or printed to console). The JSON can be re-imported to recreate the layout in a fresh session.

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
| 1 / 2 / 3    | Melee archetype select              |
| 4 / 5 / 6    | Magic archetype select              |
| M            | Toggle audio mute                   |
| F5           | Quick save                          |
| F9           | Quick load                          |
| Esc          | Pause menu                          |
| **F2**       | **Toggle map editor mode**          |
| **G**        | **Cycle editor gizmo mode**         |
| **T**        | **Cycle editor placement type**     |
| **N**        | **Place entity (current type)**     |
| **P**        | **Start new NPC patrol group**      |
| **H**        | **Cycle terrain tool (none/sculpt/paint)** |
| **[ / ]**    | **Decrease / increase terrain sculpt step** |
| **F4**       | **Export map to JSON (clipboard)**  |

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

## Project Layout

- `src/game.ts` – game bootstrap and system orchestration.
- `src/framework/` – headless RPG framework modules.
- `src/entities/` – player, NPC, loot, and entity logic.
- `src/systems/` – combat, interaction, dialogue, inventory, equipment, quest, save, map editor, and related systems.
- `src/world/` – terrain chunking, biome generation, structures.
- `src/ui/` – HUD, menus, overlays, notifications.

## Roadmap Highlights

The full roadmap lives in [`ROADMAP.md`](./ROADMAP.md). Key upcoming focus areas:

- **Map Editor Phase 2** (active): content placement property panels, terrain sculpt/paint layers.
- **Framework-first consolidation**: wiring framework state as source-of-truth for all demo systems.
- **Content tooling**: quest authoring utilities, mod validation CLI.
- **Map Editor Phase 3+**: serialized map packs, validation tooling, standalone editor shell.

---

Built on top of ideas from [babylon-vite-template](https://github.com/minibao/babylon-vite-template).
