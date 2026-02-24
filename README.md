# Bethesda-lite Framework

A game framework built with Babylon.js 8, Vite 6, TypeScript, and Havok Physics, designed to replicate core mechanics of Bethesda-style RPGs (Skyrim, Fallout 3).

## Features

- **Core Engine**: Babylon.js 8 + Vite 6 + TypeScript.
- **Physics**: Integrated Havok Physics V2.
- **Player Controller**: First-person camera with WASD movement, jumping, and collision.
- **World System**: Dynamic terrain chunk loading based on player position.
- **NPC System**: Physics-based NPCs with patrol schedules and AI.
- **Combat System**:
  - Melee Attacks (Left Click): Raycast-based hit detection with physics impulse.
  - Magic Attacks (Right Click): Projectile spawning with physics.
- **Dialogue System**: Fallout 3 style cinematic camera zoom and choice-based UI on interaction.
- **UI System**: Skyrim-style HUD including Compass, Health, Magicka, and Stamina bars.
- **Interaction System**: Generic interaction system ('E' key) for NPCs and Items.
- **Inventory System**:
  - Weight-based item management.
  - World item looting.
  - Inventory UI toggled with 'I'.

## Controls

- **W, A, S, D**: Move
- **Mouse**: Look
- **Left Click**: Melee Attack
- **Right Click**: Magic Attack
- **E**: Interact (Talk to NPCs, Pick up Items)
- **I**: Toggle Inventory
- **Shift + Ctrl + Alt + I**: Toggle Inspector (Dev mode)

## Project Structure

- `src/game.ts`: Central game manager initializing scene and systems.
- `src/entities/`: Game objects like `Player`, `NPC`, `Item`, `WorldItem`.
- `src/systems/`: Logic handlers for `Combat`, `Dialogue`, `Interaction`, `Inventory`, `Schedule`.
- `src/ui/`: UI managers using Babylon GUI (`UIManager`, `InventoryUI`).
- `src/world/`: Terrain generation and chunk management (`WorldManager`).

## Development

### Setup

`npm install`

### Run Dev Server

`npm run dev`

### Build for Production

`npm run build`

### Preview Production Build

`npm run preview`

**Made with Babylon.js and Vite**
