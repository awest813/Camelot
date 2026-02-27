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
- [ ] **Quest System**:
  - Quest log and tracking.
  - Objective types (Kill, Fetch, Talk).
- [ ] **Improved AI**:
  - Aggressive state (attack player).
  - Pathfinding (Recast/Detour integration).
- [ ] **Expanded World**:
  - Biomes and vegetation.
  - Structures and dungeons.

### Long Term
- [ ] **Skill System**:
  - Leveling and experience.
  - Skill trees (Magic, Combat, Stealth).
- [ ] **Audio System**:
  - Footsteps, combat sounds, ambient music.
- [ ] **Multiplayer**:
  - Basic replication and networking.
