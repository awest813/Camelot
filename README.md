# Babylon.js RPG Template

A modern RPG framework built with Babylon.js 8, Vite 6, and TypeScript. Featuring Havok physics, infinite terrain chunks, player controller with RPG stats, and basic NPC interaction/combat systems.

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
  - Interaction system with cinematic dialogue camera.
- **UI**:
  - Real-time HUD (Health, Magicka, Stamina bars).
  - Dialogue interface with choices.
- **Debug Tools**:
  - Inspector (Ctrl+Alt+Shift+I).
  - FPS counter.

## Controls

- **WASD**: Move Player
- **Mouse**: Look around
- **Left Click**: Melee Attack (Costs Stamina)
- **Right Click**: Magic Attack (Costs Magicka)
- **E**: Interact with NPCs
- **I**: Toggle Inventory (Planned)

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
Open `http://localhost:5173` in your browser.

### Production Build
Build for production:
```bash
npm run build
```
Preview the production build:
```bash
npm run preview
```

## Project Structure

- `src/game.ts`: Main entry point and game loop.
- `src/entities/`: Player, NPC, and other entity classes.
- `src/systems/`: Game systems (Combat, Dialogue, Schedule, Physics).
- `src/world/`: World generation and management.
- `src/ui/`: UI components and manager.

## Roadmap
See [ROADMAP.md](./ROADMAP.md) for future plans.

---
Based on [babylon-vite-template](https://github.com/minibao/babylon-vite)
