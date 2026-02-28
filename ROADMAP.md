# Project Roadmap

## Current Features
- **Core Engine**: Babylon.js 8 + Vite 6 + TypeScript.
- **Physics**: Havok Physics integration.
- **Player Controller**: First-person controller with WASD movement, physics-based collision, and camera handling.
- **World Management**: Infinite terrain generation (chunk-based) around the player.
- **NPC System**: Basic NPC spawning, patrolling AI, and physics interactions.
- **Combat System**:
  - Melee attack (Left Click) with stamina cost.
  - Magic attack (Right Click) with magicka cost and projectile physics.
  - NPC knockback on hit.
- **Dialogue System**: Cinematic camera interaction with NPCs, dialogue UI, and choices.
- **UI System**: Heads-up display with Health, Magicka, and Stamina bars that update in real-time.
- **RPG Elements**: Player stats (Health, Magicka, Stamina) with regeneration.

## Future Plans

### Short Term
- [x] **Inventory System**:
  - Item data structure.
  - Inventory UI grid.
  - Pickup/Drop functionality.
- [x] **Equipment**:
  - Equippable weapons and armor (mainHand, offHand, head, chest, legs, feet slots).
  - Stat bonuses applied on equip (damage, armor, health/magicka/stamina bonuses).
  - Inventory UI highlights equipped items in gold; click to equip/unequip.
  - Equipment panel in inventory showing all active slots.
- [x] **Save/Load System**:
  - Persist player stats, position, inventory, and equipped items to localStorage.
  - Save via pause menu or F5; load via pause menu or F9.
  - Version-checked save data with corrupt/missing-file handling.

### Medium Term
- [x] **Quest System**:
  - Quest log and tracking (toggle with J).
  - Objective types: Kill, Fetch, Talk with automatic progress tracking.
  - Notifications on quest accept and completion.
  - Quest state persisted in save file.
- [ ] **Improved AI**:
  - Aggressive state (attack player).
  - Pathfinding (Recast/Detour integration).
- [x] **Expanded World**:
  - [x] Biomes and vegetation (plains, forest, desert, tundra with matching terrain colors and procedural props).
  - [x] Structures (deterministic per-chunk spawning: stone ruins with guard NPCs in plains/forest, desert shrines with relic loot, tundra watchtowers with guard NPCs; physics-enabled walls, loot chests).

### Long Term
- [x] **Skill System**:
  - [x] Leveling and experience (XP from kills and quest completion, level-up stat bonuses, HUD XP bar, save/load support).
  - [x] Skill trees (Combat, Magic, Survival) — 1 skill point per level, 3 skills × 3 trees, ranks persist in save file, toggle with K.
- [x] **Audio System**:
  - [x] Footsteps (procedural, fire when player moves).
  - [x] Combat sounds (melee swing, magic whoosh, player hit, NPC death).
  - [x] Ambient wind drone (looping filtered noise).
  - [x] Mute toggle (M key).
- [ ] **Improved AI**:
  - Pathfinding (Recast/Detour integration).
- [ ] **Multiplayer**:
  - Basic replication and networking.
