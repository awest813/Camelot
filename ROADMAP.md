# Roadmap

## Phase 1: Core Systems (Complete)
- [x] Basic Scene & Physics Setup (Babylon + Havok)
- [x] First-Person Controller (UniversalCamera + Physics)
- [x] NPC System (Patrol AI & Physics Bodies)
- [x] Combat System (Melee & Magic Attacks)
- [x] Dialogue System (Cinematic Camera & Choice UI)
- [x] UI System (HUD: Health, Magicka, Stamina Bars)
- [x] World System (Dynamic Chunk Loading)

## Phase 2: Interaction & Progression (Complete)
- [x] Interaction System (Generic 'E' key handler)
- [x] Attributes & Stats (Health/Magicka/Stamina Regeneration)
- [x] Inventory System (Item Data & Weight Management)
- [x] Inventory UI (List View & Toggle)
- [x] World Items (Lootable Objects)

## Phase 3: Polish & Expansion (Planned)
- [ ] **Quest System**:
  - Implement `QuestManager` to track quest stages and objectives.
  - Add quest markers to the compass UI.
- [ ] **Save/Load System**:
  - Serialize `Player` stats, `Inventory`, and `World` state to JSON/LocalStorage.
- [ ] **Advanced AI**:
  - Add detection cones and hostility states (Idle, Alert, Combat).
  - Implement pathfinding (Recast/Detour) instead of direct movement.
- [ ] **Equipment System**:
  - Allow equipping items (weapons/armor) to affect stats.
  - Visual equipment on player/NPC meshes.
- [ ] **Leveled Lists**:
  - Randomized loot generation based on player level.
- [ ] **Sound System**:
  - Add footstep sounds, combat SFX, and ambient music.
