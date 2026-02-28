# Camelot

A modular, browser-based RPG sandbox built with **Babylon.js 8**, **TypeScript**, and **Vite**. Camelot combines action combat, progression systems, procedural world generation, and UI-heavy RPG workflows into a single project template that is easy to expand.

## Why Camelot

Camelot is designed for developers who want to prototype or ship first-person RPG mechanics quickly while keeping systems decoupled and maintainable.

- Strong gameplay foundation: combat, stats, quests, skills, inventory, equipment.
- Runtime persistence: save/load of major player and quest state.
- Procedural world scaffolding: chunked terrain, biome content, structures.
- Tool-ready architecture: systems are organized for future editor and content pipeline work.

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
| M            | Toggle audio mute         |
| F5           | Quick save                |
| F9           | Quick load                |
| Esc          | Pause menu                |

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

### Build and preview

```bash
npm run build
npm run preview
```

### Run tests

```bash
npx vitest run
```

## Project Layout

- `src/game.ts` – game bootstrap and system orchestration.
- `src/entities/` – player, NPC, loot, and entity logic.
- `src/systems/` – combat, interaction, dialogue, inventory, equipment, quest, save, and related systems.
- `src/world/` – terrain chunking, biome generation, structures.
- `src/ui/` – HUD, menus, overlays, notifications.

## Roadmap Highlights

The full roadmap lives in [`ROADMAP.md`](./ROADMAP.md). Key upcoming focus areas:

- AI improvements (pathfinding, behavior depth).
- Content tooling and data pipelines.
- **Map Editor initiative** (in-engine + standalone workflows):
  - Terrain paint/sculpt layers.
  - Structure and spawn-point placement tools.
  - Quest/NPC authoring helpers.
  - Export/import for reusable map packs.

---

Built on top of ideas from [babylon-vite-template](https://github.com/minibao/babylon-vite-template).
