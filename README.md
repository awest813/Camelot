# Babylon.js RPG Template

A modern RPG framework built with Babylon.js 8, Vite 6, and TypeScript. Featuring Havok physics, infinite terrain chunks, player controller with RPG stats, NPC interaction/combat systems, inventory, equipment, save/load, and a quest system.

## Features

- **Engine**: Babylon.js 8 + Vite 6 + TypeScript (Fast HMR & Builds)
- **Physics**: Havok Physics integration for rigid bodies and interactions.
- **Player Controller**:
  - FPS Camera with physics-based movement.
  - RPG Stats: Health, Magicka, Stamina (with regeneration).
  - Combat: Melee (Stamina cost) and Magic (Magicka cost) attacks.
- **World**:
  - Infinite procedural terrain generation (chunk-based).
  - Dynamic chunk loading/unloading logic.
- **NPCs & AI**:
  - Patrol points and movement logic.
  - Aggro system — NPCs attack the player when provoked or in range.
  - Obstacle-avoidance steering — NPCs fan-test multiple directions and flow around structure walls automatically.
  - Interaction system with cinematic dialogue camera.
- **Inventory & Equipment**:
  - Item pickup, stacking, and grid-based inventory UI (toggle with I).
  - Equipment slots (mainHand, offHand, head, chest, legs, feet).
  - Equipped weapons add bonus damage; armor reduces incoming damage.
  - Click items in inventory to equip/unequip; gold highlight for equipped items.
- **Quest System**:
  - Quest log overlay (toggle with J).
  - Three objective types: Kill, Fetch, and Talk.
  - Automatic progress tracking via NPC death, item pickup, and dialogue events.
  - Quest completion notification; quest state saved and loaded with the game.
- **Save / Load**:
  - Persist player position, stats, inventory, equipment, and quest progress to localStorage.
  - Save with F5 or from the pause menu; load with F9 or from the pause menu.
- **UI**:
  - Real-time HUD (Health, Magicka, Stamina bars).
  - Compass bar, crosshair with highlight on interactables.
  - Floating damage numbers and screen-flash hit indicators.
  - Dialogue interface with choices.
  - Notification system for pickups, attacks, quest events.
- **Skill Trees**:
  - Three trees: Combat, Magic, and Survival.
  - Earn 1 skill point per level; spend points to upgrade skills (toggle with K).
  - Combat skills: Iron Skin (+Armor), Warrior's Edge (+melee damage), Endurance (+Stamina).
  - Magic skills: Arcane Power (+magic damage), Mystic Reserve (+Magicka), Mana Flow (+Magicka regen).
  - Survival skills: Vitality (+Health), Swift Recovery (+HP regen), Second Wind (+Stamina regen).
  - Skill ranks and unspent points persist across saves.
- **Debug Tools**:
  - Inspector (Ctrl+Alt+Shift+I).
  - FPS counter.

## Controls

| Key / Button | Action |
|---|---|
| WASD | Move |
| Mouse | Look around |
| Left Click | Melee Attack (costs Stamina) |
| Right Click | Magic Attack (costs Magicka) |
| E | Interact / Pick up loot / Talk to NPC |
| I | Toggle Inventory |
| J | Toggle Quest Log |
| K | Toggle Skill Tree |
| Escape | Pause Menu |
| F5 | Quick Save |
| F9 | Quick Load |

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm

### Installation

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```

### Development
Run the development server with hot module replacement:
```bash
npm run dev
```
Open `http://localhost:8088` in your browser.

### Production Build
Build for production:
```bash
npm run build
```
Preview the production build:
```bash
npm run preview
```

### Tests
```bash
npx vitest run
```

## Project Structure

- `src/game.ts`: Main entry point, game loop, and system wiring.
- `src/entities/`: Player, NPC, and Loot entity classes.
- `src/systems/`: Game systems — Combat, Dialogue, Interaction, Inventory, Equipment, Save, Quest, Schedule.
- `src/world/`: World generation and chunk management.
- `src/ui/`: UIManager (HUD, inventory, quest log, pause menu, notifications).

## Roadmap
See [ROADMAP.md](./ROADMAP.md) for future plans.

---
Based on [babylon-vite-template](https://github.com/minibao/babylon-vite)
