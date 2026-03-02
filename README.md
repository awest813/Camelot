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

## Framework Core (new)

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
- Melee and magic combat loops with resource costs.
- Damage feedback via floating combat text and hit indicators.

### NPCs + Interaction

- NPC patrol behavior and aggro response.
- Dialogue interactions with cinematic conversation camera.
- Interaction prompts and crosshair-based focus highlighting.

### World + Content

- Infinite chunked terrain generation.
- Biome variants and procedural props.
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

## Controls

| Key / Button | Action                    |
| ------------ | ------------------------- |
| WASD         | Move                      |
| Mouse        | Look                      |
| Left Click   | Melee attack (Stamina)    |
| Right Click  | Magic attack (Magicka)    |
| E            | Interact / pick up / talk |
| I            | Toggle inventory          |
| J            | Toggle quest log          |
| K            | Toggle skill tree         |
| 1 / 2 / 3    | Melee archetype select    |
| 4 / 5 / 6    | Magic archetype select    |
| M            | Toggle audio mute         |
| F5           | Quick save                |
| F9           | Quick load                |
| Esc          | Pause menu                |
| F2           | Toggle map editor mode    |
| G            | Cycle editor gizmo mode   |
| N            | Place editor marker       |

## Tech Stack

- **Rendering/Engine**: Babylon.js 8
- **Language**: TypeScript
- **Build Tool**: Vite 6
- **Physics**: Havok
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
- `src/systems/` – combat, interaction, dialogue, inventory, equipment, quest, save, and related systems.
- `src/world/` – terrain chunking, biome generation, structures.
- `src/ui/` – HUD, menus, overlays, notifications.

## Roadmap Highlights

The full roadmap lives in [`ROADMAP.md`](./ROADMAP.md). Key upcoming focus areas:

- AI improvements (pathfinding, behavior depth).
- Content tooling and data pipelines.
- **Map Editor initiative** (in-engine + standalone workflows):
  - Phase 1 started: in-engine edit mode toggle + grid-snapped gizmo editing.
  - Terrain paint/sculpt layers (planned).
  - Structure and spawn-point placement tools (planned).
  - Quest/NPC authoring helpers.
  - Export/import for reusable map packs.

---

Built on top of ideas from [babylon-vite-template](https://github.com/minibao/babylon-vite-template).
