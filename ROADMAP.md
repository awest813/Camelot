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

### Framework Core (New Direction)

- ✅ Initial `src/framework` package scaffolded.
- ✅ Dialogue graph engine (conditions, effects, traversal sessions).
- ✅ Quest graph engine (node dependencies, trigger ingestion, branching progression).
- ✅ Headless inventory engine (capacity, stack, equip intent).
- ✅ Faction system (reputation + disposition bands).
- ✅ Save-state JSON architecture with schema migration pipeline.
- ✅ Mod folder infrastructure (`public/mods` manifest + loader + content merge reports).
- ✅ NpcArchetypeDefinition added to content bundle (guard, bandit, merchant, boss, innkeeper, villager).

### RPG Systems

- ✅ Stats + regeneration (Health, Magicka, Stamina).
- ✅ Inventory with item stacking and equipment slots.
- ✅ Equipment stat modifiers and active-slot management.
- ✅ Quest tracking with kill/fetch/talk objective types.
- ✅ Skill trees with points, ranks, and persistent progression.
- ✅ Attribute system (Strength, Endurance, Intelligence, Agility, Willpower, Speed, Luck) with derived stats.
- ✅ Stealth system (vision cone, hearing radius, detection meter, crouch).
- ✅ Crime system (per-faction bounties, witness logic, guard challenges).
- ✅ Container/loot system (chests, corpses, lockpicking difficulty).
- ✅ Barter system (buy/sell pricing tied to skill, merchant open/close hours).
- ✅ Projectile system (bow and arrow with archery skill, quiver management).
- ✅ Cell/interior transition system (portals, interior cells, visited-cell tracking).
- ✅ Time system (game clock, day/night cycle, ambient intensity).
- ✅ **SpellSystem** — Known-spell pool, equip/cast, cooldowns, destruction/restoration schools (Q to cast, Z to cycle).
- ✅ **PersuasionSystem** — Per-NPC disposition, persuasion checks, merchant price multipliers.
- ✅ **LootTableSystem** — Data-driven weighted loot generation with starter tables.
- ✅ **GameEventBus** — Typed pub/sub event bus for all major gameplay events.
- ✅ **AlchemySystem** — Oblivion-style alchemy: ingredient satchel, effect discovery (eat/mix), potion crafting from 2–4 ingredients with shared-effect intersection, skill scaling, and save-state persistence. L to open workbench.
- ✅ **NPC archetype resistances/weaknesses** — `damageResistances` and `damageWeaknesses` fields added to `NpcArchetypeDefinition`; data-driven per-archetype damage modifiers applied on spawn (bandit chief: physical resist, mage apprentice: elemental resist/physical weak, etc.).
- ✅ **EnchantingSystem** — Oblivion-style enchanting: five soul gem tiers (petty → grand) scale effect magnitude; 10 enchantment effects across weapon (fire/frost/shock damage, absorb health, drain magicka) and armor (fortify health/magicka/stamina/strength, resist damage) categories; enchanting skill (0–100) further scales magnitude; items are renamed on enchant and stats applied immediately; save-state persistence (SAVE_VERSION 8). B to open altar.
- ✅ **WeatherSystem** — Markov-chain atmospheric weather (Clear/Overcast/Foggy/Rain/Storm); smooth fog-density/fog-colour/ambient-light transitions; `forceWeather()` for scripted events; onWeatherChange callback wired to EventBus; weather label in debug overlay (F3); save-state persistence (SAVE_VERSION 9).
- ✅ **QuickSlotSystem** — Bind consumable items (health/magicka/stamina potions) to hotkeys 7/8/9/0; effects applied directly to player stats; removes one item per use; `onItemConsumed` callback wired to EventBus; save-state persistence (SAVE_VERSION 9).

### World + Content

- ✅ Infinite chunk-based terrain.
- ✅ Biomes with procedural vegetation/props.
- ✅ Deterministic structures and loot opportunities.

### UX + Persistence

- ✅ HUD, quest log, inventory, skill tree, pause flow.
- ✅ Save/load (SAVE_VERSION 9) for all system states.
- ✅ Save file export to JSON file download + import from JSON/File (browser-safe).
- ✅ Notifications, hit feedback, and debug support.

---

## Alpha Stage Focus

The current alpha stage is centered on combat readability and encounter stability while preserving rapid iteration velocity.

### Alpha Milestones

- ✅ Multi-NPC threat handoff and attack-slot arbitration.
- ✅ NPC combat decision loops (distance bands, cooldown discipline).
- ✅ Expanded patrol variation and reactive state transitions.

---

## Near-Term (Next 1–2 Releases)

### Content Creation GUI Roadmap

To make content creation accessible to non-programmer designers, Camelot will
add a dedicated GUI layer on top of the existing framework + map editor data
model.

#### Release A — Authoring UX Foundations

- 🧭 Dockable editor layout (Scene/Hierarchy/Inspector/Validation panes).
- 🧭 Unified selection model shared by map entities, quest nodes, and dialogue nodes.
- 🧭 Undo/redo history with grouped actions for transform + property edits.
- 🧭 Context-aware hotkey/help overlay so editor workflows are discoverable in-app.

#### Release B — Content-Specific Editors

- 🧭 **Quest Graph GUI**: node canvas for objectives, dependencies, fail states, and rewards.
- 🧭 **Dialogue Tree GUI**: branching conversation editor with condition/effect forms.
- 🧭 **Loot + Spawn GUI**: weighted table editor, archetype picker, and spawn validation hints.
- 🧭 Shared property inspectors generated from schema metadata to reduce bespoke UI code.

#### Release C — Validation + Packaging Workflow

- 🧭 Pre-publish validation dashboard aggregating map, quest, dialogue, and mod schema diagnostics.
- 🧭 One-click content bundle export (map pack + quest/dialogue data + manifest).
- 🧭 Diff-friendly JSON normalization and deterministic key ordering for source control reviews.
- 🧭 "Play from here" test harness launchers for rapid iteration on selected content slices.

#### Release D — Collaboration + Scale

- 🧭 Asset/prefab browser with tags, favorites, and dependency previews.
- 🧭 Layer/stream controls for large worlds (region visibility, lock/hide, author ownership).
- 🧭 Merge assistant for conflicting content IDs and cross-file references.
- 🧭 Optional cloud-backed publishing target compatible with local offline workflow.

### Framework-First Consolidation

- 🧭 Expand framework runtime adapters so demo gameplay systems consume framework state as source-of-truth.
- ✅ Add richer dialogue effect hooks (quest activation, inventory consume/give, conditional branches by faction tiers).
- 🧭 Add quest authoring utilities and graph validation diagnostics (dead-end node detection, cycle hints).
- ✅ Harden save migrations with versioned schema (SAVE_VERSION bumped on each structural change).
- 🧭 Add CLI/dev tooling for mod manifest generation and content schema validation.

### Oblivion-Lite Systems (v3)

- ✅ **GameEventBus** — Typed pub/sub event system wiring all major gameplay events.
- ✅ **SpellSystem** — Spell definitions, known-spell pool, equip/cast, cooldowns, damage/heal effects; Q to cast, Z to cycle.
- ✅ **LootTableSystem** — Data-driven weighted loot generation; starter tables (common, bandit, dungeon, merchant_restock).
- ✅ **PersuasionSystem** — Per-NPC disposition (0–100), persuasion checks with speechcraft skill, merchant price multipliers.
- ✅ **NpcArchetypeDefinition** — Data-driven NPC templates (guard, bandit, merchant, boss, innkeeper, villager) in content bundle.
- ✅ **Save file export/import** — Download save as JSON (`exportToFile`) and re-import via `importFromJson` / `importFromFile`.
- ✅ **SAVE_VERSION 6** — Spell and persuasion state persisted; backwards-incompatible saves are rejected cleanly.
- ✅ **SAVE_VERSION 7** — Alchemy state persisted.
- ✅ **SAVE_VERSION 8** — Enchanting system (soul gem inventory + enchanting skill) persisted; SAVE_VERSION_MIN = 5 constant fixes forward-compat boundary.

### Natural-Feel Systems Overhaul (Decision)

To make combat and interaction loops feel less mechanical, Camelot will follow a
three-step overhaul track:

1. ✅ **Input + interaction sanity pass**  
   - Block combat clicks while dialogue/UI overlays own focus.  
   - Prevent dialogue start against hostile NPCs.
2. ✅ **Combat cadence and recovery pacing**  
   - Add player attack cadence windows (melee/magic cooldown discipline).  
   - Add combat-aware regeneration delays after damage and resource spend.
3. ✅ **Follow-up readability + motion pass**  
   - Added clearer enemy telegraphs and dodge windows.  
   - Added NPC strafe/reposition variety and movement smoothing.  
   - Tuned stamina/magicka economy per weapon/spell archetype.

### AI and Encounter Quality

- ✅ Improve NPC combat decision loops (distance bands, cooldown discipline).
- ✅ Add better threat handoff (multi-NPC aggro arbitration).
- ✅ Expand patrol behaviors with idle variation and reactive states.
  - Randomised wait durations and look-around during patrol pauses.
  - New **INVESTIGATE** state: when a player escapes the ALERT window the NPC moves to the last known player position before resuming patrol, rather than immediately standing down.

### Combat Feel and Balance

- 🧭 Add weapon archetype tuning passes (speed, stagger, resource cost).
- ✅ Add lightweight enemy resistances/weaknesses for build diversity — per-archetype damage modifiers in NpcArchetypeDefinition.
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

- ✅ Alchemy/potion crafting prototype (AlchemySystem + AlchemyUI).
- ✅ Enchanting system (apply magical effects to weapons and armor) — soul gems, 10 enchantment types, skill scaling.
- ✅ Faction/reputation prototype tied to quests (FactionEngine + PersuasionSystem).
- 🧭 More advanced quest scripting hooks.

### Performance + Scalability

- 🧭 Optimize chunk streaming and object pooling.
- 🧭 Profile heavy combat scenes and UI redraw paths.

---

## Long-Term Vision

### Map Editor Initiative (Major Future Track)

Camelot will evolve toward a creator-friendly worldbuilding pipeline through a dedicated **Map Editor** effort.

#### Phase 1: Foundational Editing ✅

- ✅ In-engine edit mode toggle (runtime-safe authoring sandbox) — F2 key.
- ✅ Grid/snap controls and transform gizmos for placement — G key cycles position/rotation/scale.
- ✅ Placement of editor marker objects with grid-snapping — N key.
- ✅ Terrain sculpt and paint tools (chunk-level sculpt raise + paint tint pass in editor mode).

#### Phase 2: Content Authoring Workflows 🚧

- ✅ Multi-type entity placement: **marker**, **loot**, **NPC spawn**, **quest marker**, **structure** — T key cycles type.
- ✅ Visual differentiation by type: each placement type has a distinct mesh shape and colour.
- ✅ Patrol route authoring — P key starts a new NPC patrol group; NPC spawn points placed in the same group are connected by a visible route line.
- ✅ Map export to portable JSON — F4 key serializes all placed entities and patrol routes.
- ✅ Map import from JSON — re-creates editor entities from a previously exported layout.
- ✅ Place and configure structures, props, and spawn volumes with property panels — select any placed entity to open the in-editor property panel (label, loot table, spawn template, objective ID, dialogue trigger, structure ID).
- ✅ Quest marker and dialogue trigger placement helpers with linked objective IDs.

#### Phase 3: Data + Collaboration ✅

- ✅ Validation tooling baseline shipped (missing patrol refs, short patrol routes, overlap checks).
- ✅ Expand validation coverage (orphaned quest-marker hints, duplicate objectiveId detection, invalid cross-system references via optional context: loot tables, spawn templates, known objective IDs).
- ✅ Serialize maps to portable JSON/asset bundles — `exportToFile()` triggers a browser file download (F4 in editor mode).
- ✅ Import/export map packs for sharing and testing — `importFromFile(File)` and `importFromJson(string)` re-create a layout from disk; F6 in editor mode opens a file picker.

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

1. ~~Map editor Phase 2 completions: property panels for placed entities, terrain sculpting.~~ ✅ Complete
2. ~~Map editor Phase 3 expansion: richer validation rules and map-pack workflows.~~ ✅ Complete
3. Framework-first consolidation: wiring framework state as source-of-truth for demo systems.
4. Quest/content authoring ergonomics.
5. Save/load robustness and automated tests.
