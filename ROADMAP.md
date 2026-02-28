# Camelot Roadmap

This roadmap tracks where Camelot is today and where it is heading next. It is organized by delivery horizon so contributors can align implementation work, content creation, and tooling.

## Status Key

- ✅ Completed
- 🚧 In Progress
- 🧭 Planned

---

## Current Platform Snapshot

### Core Runtime

- ✅ Babylon.js + TypeScript + Vite architecture.
- ✅ Havok-powered physics integration.
- ✅ First-person controller with resource-driven combat.

### RPG Systems

- ✅ Stats + regeneration (Health, Magicka, Stamina).
- ✅ Inventory with item stacking and equipment slots.
- ✅ Equipment stat modifiers and active-slot management.
- ✅ Quest tracking with kill/fetch/talk objective types.
- ✅ Skill trees with points, ranks, and persistent progression.

### World + Content

- ✅ Infinite chunk-based terrain.
- ✅ Biomes with procedural vegetation/props.
- ✅ Deterministic structures and loot opportunities.

### UX + Persistence

- ✅ HUD, quest log, inventory, skill tree, pause flow.
- ✅ Save/load for player state, inventory/equipment, and quests.
- ✅ Notifications, hit feedback, and debug support.

---

## Alpha Stage Focus

The current alpha stage is centered on combat readability and encounter stability while preserving rapid iteration velocity.

### Alpha Milestones

- ✅ Multi-NPC threat handoff and attack-slot arbitration.
- 🚧 NPC combat decision loops (distance bands, cooldown discipline).
- 🧭 Expanded patrol variation and reactive state transitions.

---

## Near-Term (Next 1–2 Releases)

### AI and Encounter Quality

- 🚧 Improve NPC combat decision loops (distance bands, cooldown discipline).
- ✅ Add better threat handoff (multi-NPC aggro arbitration).
- 🧭 Expand patrol behaviors with idle variation and reactive states.

### Combat Feel and Balance

- 🧭 Add weapon archetype tuning passes (speed, stagger, resource cost).
- 🧭 Add lightweight enemy resistances/weaknesses for build diversity.
- 🧭 Improve telegraph readability for enemy attacks.

### Stability and Tooling

- 🧭 Improve save migration/versioning workflow.
- 🧭 Add additional automated regression coverage for quests and inventory.

---

## Mid-Term (3–5 Releases)

### World Building Depth

- 🧭 Add additional biome-specific encounter tables.
- 🧭 Introduce landmark-driven exploration rewards.
- 🧭 Add environmental storytelling props and ambient events.

### Systems Expansion

- 🧭 Crafting/resource loop prototype.
- 🧭 Faction/reputation prototype tied to quests.
- 🧭 More advanced quest scripting hooks.

### Performance + Scalability

- 🧭 Optimize chunk streaming and object pooling.
- 🧭 Profile heavy combat scenes and UI redraw paths.

---

## Long-Term Vision

### Map Editor Initiative (Major Future Track)

Camelot will evolve toward a creator-friendly worldbuilding pipeline through a dedicated **Map Editor** effort.

#### Phase 1: Foundational Editing

- 🧭 In-engine edit mode toggle (runtime-safe authoring sandbox).
- 🧭 Terrain sculpt and paint tools (height, smoothing, biome masks).
- 🧭 Grid/snap controls and transform gizmos for placement.

#### Phase 2: Content Authoring Workflows

- 🧭 Place and configure structures, props, loot nodes, and spawn volumes.
- 🧭 Author NPC spawn groups with patrol route visualization.
- 🧭 Quest marker and dialogue trigger placement helpers.

#### Phase 3: Data + Collaboration

- 🧭 Serialize maps to portable JSON/asset bundles.
- 🧭 Import/export map packs for sharing and testing.
- 🧭 Validation tooling (missing refs, unreachable objectives, overlap checks).

#### Phase 4: Production-Ready Pipeline

- 🧭 Prefab/palette libraries for rapid kitbashing.
- 🧭 Layer-based editing (terrain, encounters, narrative, lighting).
- 🧭 Optional standalone editor shell for non-programmer content creators.

### Networking Exploration

- 🧭 Investigate co-op/multiplayer architecture feasibility.
- 🧭 Define authority model and synchronization boundaries.

---

## Contribution Focus

If you want to contribute now, high-impact areas are:

1. AI behavior quality and pathfinding groundwork.
2. Quest/content authoring ergonomics.
3. Save/load robustness and automated tests.
4. Early groundwork for map-editor-compatible data formats.
