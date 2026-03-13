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
- ✅ **LootTableSystem** — Data-driven weighted loot generation with starter tables; overhauled with conditional entries (`minLevel`/`maxLevel`/`requiredFlags`), guaranteed drops (`guarantee`), sub-table chaining (`subTableId`), and sparse-roll `noneWeight`; new `boss_loot` and `treasure_chest` tables; `rollTable()` / `rollTables()` accept `LootContext` for level-scaled loot.
- ✅ **GameEventBus** — Typed pub/sub event bus for all major gameplay events.
- ✅ **AlchemySystem** — Oblivion-style alchemy: ingredient satchel, effect discovery (eat/mix), potion crafting from 2–4 ingredients with shared-effect intersection, skill scaling, and save-state persistence. L to open workbench.
- ✅ **NPC archetype resistances/weaknesses** — `damageResistances` and `damageWeaknesses` fields added to `NpcArchetypeDefinition`; data-driven per-archetype damage modifiers applied on spawn (bandit chief: physical resist, mage apprentice: elemental resist/physical weak, etc.).
- ✅ **EnchantingSystem** — Oblivion-style enchanting: five soul gem tiers (petty → grand) scale effect magnitude; 10 enchantment effects across weapon (fire/frost/shock damage, absorb health, drain magicka) and armor (fortify health/magicka/stamina/strength, resist damage) categories; enchanting skill (0–100) further scales magnitude; items are renamed on enchant and stats applied immediately; save-state persistence (SAVE_VERSION 8). B to open altar.
- ✅ **WeatherSystem** — Markov-chain atmospheric weather (Clear/Overcast/Foggy/Rain/Storm); smooth fog-density/fog-colour/ambient-light transitions; `forceWeather()` for scripted events; onWeatherChange callback wired to EventBus; weather label in debug overlay (F3); save-state persistence (SAVE_VERSION 9).
- ✅ **QuickSlotSystem** — Bind consumable items (health/magicka/stamina potions) to hotkeys 7/8/9/0; effects applied directly to player stats; removes one item per use; `onItemConsumed` callback wired to EventBus; save-state persistence (SAVE_VERSION 9).
- ✅ **WaitSystem** — Oblivion-style wait/rest (T key): choose 1–24 in-game hours, clock advances instantly, Health/Magicka/Stamina restore proportionally (full rest at 24 h); save-state persistence (SAVE_VERSION 10).
- ✅ **Compass HUD** — Top-center compass strip shows three cardinal labels (e.g. NW · N · NE) that scroll as the player turns; updates every frame from camera yaw with zero runtime cost.
- ✅ **SkillProgressionSystem** — Oblivion-style use-based skill leveling (Blade, Destruction, Restoration, Marksman, Sneak, Speechcraft, Alchemy); XP gained from performing actions; `onSkillLevelUp` callback fires skill-up notifications; `multiplier(skill)` returns [1.0–2.0] bonus for other systems; save-state persistence (SAVE_VERSION 11).
- ✅ **FastTravelSystem** — Discover named locations by visiting them; Y key shows discovered locations; `fastTravelTo()` teleports the player instantly (blocked in combat or while sneaking); auto-discovers cell transitions via `cellManager.onCellChanged`; save-state persistence (SAVE_VERSION 11).
- ✅ **LevelScalingSystem** — Oblivion-style enemy scaling: NPC health, and XP reward scale with the player's current level (factor = 0.8 + level × 0.1, capped at 3×); applied on NPC spawn; structure NPCs also scaled via `world.structures.onNPCSpawn`.
- ✅ **FameSystem** — Oblivion-style fame and infamy tracking (0–1000 each); fame gained from quest completions, infamy from crimes; `dispositionModifier` in [−20, +20] affects NPC reactions and future persuasion/barter; tier labels (Unknown → Legendary Hero / Clean → Most Wanted); H key shows current reputation; `onFameChange` callback wired to EventBus; save-state persistence (SAVE_VERSION 12).
- ✅ **ActiveEffectsSystem** — Tracks all time-limited effects from spells, potions, and enchantments; 12 effect types (health/magicka/stamina restore, fortify stats, resist damage, fire/frost/shock DoT, silence, burden); `update(dt, player)` applies per-second tick and expires finished effects; `onEffectExpired` fires worn-off notifications; infinite-duration enchantment auras supported; H key shows active effect names; save-state persistence (SAVE_VERSION 12).
- ✅ **JailSystem** — Completes the crime loop: when a guard challenges a player who cannot pay the bounty, `serveJailTime()` converts gold bounty into in-game hours (1 h per 10 g, cap 72 h), advances the clock via TimeSystem, penalises skill levels via SkillProgressionSystem (Blade/Marksman/Sneak/Alchemy/Speechcraft/Destruction/Restoration), and clears all bounties; jail records persisted (SAVE_VERSION 12).
- ✅ **SpellMakingSystem** — Oblivion-style Altar of Spellmaking: combine 1–2 effect components (damage/heal/restore/silence/burden) from any school to forge a named custom spell; gold cost scales with magnitude and duration (MIN 50 g → MAX 2000 g); forged spell is registered into SpellSystem and learned immediately; `onSpellForged` callback awards Destruction XP; X key triggers a demo forge; duplicate-name guard and insufficient-gold guard; save-state persistence (SAVE_VERSION 13).
- ✅ **RespawnSystem** — Oblivion-style encounter zone respawning: register zones with a configurable game-hour window (default 72 h = 3 in-game days); `markCleared(zoneId, gameTime)` starts the countdown; `update(gameTime)` fires `onZoneRespawn` when the window elapses and resets the pending flag; multiple zones tracked simultaneously; save-state persistence (SAVE_VERSION 13).
- ✅ **MerchantRestockSystem** — Timed merchant inventory and gold restocking: register merchant templates (inventory + gold snapshot); `update(gameTime, barterSystem)` resets the live BarterSystem merchant record when the interval elapses (default 72 h); advances the next-restock deadline across multiple elapsed cycles; `onRestock` callback fires a UI notification; save-state persistence (SAVE_VERSION 13).
- ✅ **BirthsignSystem** — Oblivion's 13 birthsigns (Warrior, Mage, Thief, Lady, Lord, Steed, Ritual, Apprentice, Atronach, Shadow, Lover, Serpent, etc.) chosen once at character creation; each sign permanently boosts attributes or max stats, and most grant a once-per-24h rechargeable special power (Mara's Gift, Moonshadow, Lover's Kiss, Serpent's Spell, Blood of the North, …); `stunted` flag suppresses magicka regeneration for the Atronach; `fireWeakness` for the Lord; flat max-stat bonuses (maxMagicka +50/+100/+150) for Mage/Apprentice/Atronach; power cooldown tracked in in-game hours; `onBirthsignChosen` + `onPowerActivated` callbacks; save-state persistence (SAVE_VERSION 14).
- ✅ **ClassSystem** — Oblivion-style character classes (Warrior, Knight, Barbarian, Mage, Sorcerer, Healer, Thief, Scout, Rogue, Battlemage); each class defines a specialization (combat/magic/stealth), two favored attributes (+10 each), five major skills (starting +25 levels, 1.5× XP), and five minor skills (starting +10 levels, 1.25× XP); specialization group grants +5 to all related skills; `xpMultiplierFor(skillId)` scales all in-game XP awards so major-skill users progress faster; `onClassChosen` callback syncs derived stats; save-state persistence (SAVE_VERSION 14).
- ✅ **RaceSystem** (fully activated powers) — Oblivion-depth racial powers for all 10 races (Nord, Imperial, Breton, Redguard, High Elf, Dark Elf, Wood Elf, Orc, Khajiit, Argonian); each race now grants a genuine once-per-24h rechargeable power that dispatches real `ActiveEffect` entries (health/magicka/stamina restore, fortify strength, resist damage, etc.); `activatePower(gameTime, activeEffectsSystem)` dispatches all power effects, `canActivatePower()` enforces the cooldown, `powerCooldownRemaining()` reports minutes left; `onPowerActivated` callback fires HUD notification; V key activates the power in-game; power cooldown persisted (SAVE_VERSION 16).
- ✅ **PlayerLevelSystem** — Oblivion-style skill-based character leveling: accumulate 10 major-skill level-ups (as defined by the chosen ClassSystem) to trigger a character level-up; each attribute's bonus (+1 to +5) follows the Oblivion multiplier table (1–4 level-ups → +2, 5–7 → +3, 8–9 → +4, 10+ → +5) based on how many governing skills were leveled that character level; `confirmLevelUp(primary, sec1, sec2)` applies bonuses for three distinct chosen attributes and advances `characterLevel`; `suggestedAttributes` convenience property returns the three highest-bonus attributes for auto-apply; `onLevelUpReady` fires with the available bonuses when the threshold is reached; `onLevelUpComplete(newLevel)` fires after bonuses are applied; skill → attribute mapping mirrors Oblivion (blade → Strength, block → Endurance, destruction/restoration → Willpower, marksman → Agility, sneak → Speed, speechcraft → Luck, alchemy → Intelligence); attribute bonuses immediately sync `maxHealth`/`maxMagicka`/`maxStamina`/`maxCarryWeight`; save-state persistence (SAVE_VERSION 17).

### World + Content

- ✅ Infinite chunk-based terrain.
- ✅ Biomes with procedural vegetation/props.
- ✅ Deterministic structures and loot opportunities.

### UX + Persistence

- ✅ HUD, quest log, inventory, skill tree, pause flow.
- ✅ Save/load (SAVE_VERSION 18) for all system states.
- ✅ Save file export to JSON file download + import from JSON/File (browser-safe).
- ✅ Notifications, hit feedback, and debug support.
- ✅ Compass HUD (top-center) showing cardinal direction from camera heading.
- ✅ Wait/Rest dialog (T) for time-skipping 1–24 in-game hours with stat restoration.
- ✅ Fame/Infamy HUD (H key) showing reputation tier, active effects, and jail history.
- ✅ Racial Power (V key) — activate the chosen race's once-per-day power; HUD notification shows name + description; cooldown status message when on recharge.

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
- ✅ Undo/redo history with grouped actions for transform + property edits (Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z).
- ✅ Context-aware hotkey/help overlay so editor workflows are discoverable in-app (F1 toggles gameplay/editor key cheat sheet).

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
- ✅ Add quest authoring utilities and graph validation diagnostics (dead-end node detection, cycle hints) with in-game validation hotkey (F8).
- ✅ Harden save migrations with versioned schema (SAVE_VERSION bumped on each structural change).
- 🧭 Add CLI/dev tooling for mod manifest generation and content schema validation.

### Oblivion-Lite Systems (v3)

- ✅ **GameEventBus** — Typed pub/sub event system wiring all major gameplay events.
- ✅ **SpellSystem** — Spell definitions, known-spell pool, equip/cast, cooldowns, damage/heal effects; Q to cast, Z to cycle.
- ✅ **LootTableSystem** — Data-driven weighted loot generation; overhauled with conditional entries, guaranteed drops, sub-table chaining, sparse-roll `noneWeight`, and `LootContext` for level-scaled loot; starter tables extended with `boss_loot` and `treasure_chest`.
- ✅ **PersuasionSystem** — Per-NPC disposition (0–100), persuasion checks with speechcraft skill, merchant price multipliers.
- ✅ **NpcArchetypeDefinition** — Data-driven NPC templates (guard, bandit, merchant, boss, innkeeper, villager) in content bundle.
- ✅ **Save file export/import** — Download save as JSON (`exportToFile`) and re-import via `importFromJson` / `importFromFile`.
- ✅ **SAVE_VERSION 6** — Spell and persuasion state persisted; backwards-incompatible saves are rejected cleanly.
- ✅ **SAVE_VERSION 7** — Alchemy state persisted.
- ✅ **SAVE_VERSION 8** — Enchanting system (soul gem inventory + enchanting skill) persisted; SAVE_VERSION_MIN = 5 constant fixes forward-compat boundary.
- ✅ **SAVE_VERSION 13** — SpellMakingSystem, RespawnSystem, and MerchantRestockSystem state persisted.
- ✅ **SAVE_VERSION 14** — BirthsignSystem and ClassSystem state persisted.
- ✅ **SAVE_VERSION 17** — PlayerLevelSystem (skill-based character level-up) state persisted.
- ✅ **SAVE_VERSION 18** — DailyScheduleSystem state persisted; `race` and `playerLevel` fields now correctly propagated through save validation.

### Character Progression Depth (Next)

- ✅ **Character Level-Up UI** — Dedicated level-up dialog (`LevelUpUI`) showing available attribute bonuses (+1 to +5) per attribute with governing-skill annotations, letting the player manually choose 3 attributes to increase; selection requires exactly 3 distinct attributes; confirm button enables only when 3 are chosen; triggered by `PlayerLevelSystem.onLevelUpReady`; modal (Escape blocked until confirmed); pointer lock and camera control restored on confirm; `onLevelUpComplete` notification fires after bonuses are applied.
- ✅ **DailyScheduleSystem** — NPC daily activity schedules (work, eat, sleep); `DailyScheduleSystem` wraps `ScheduleSystem` and connects it to `TimeSystem` via the `onHourChange` hook for fully automatic time-of-day NPC behaviour switching (no per-frame manual sync required); sleeping NPCs have their `mesh.metadata` cleared so they cannot be targeted for interaction or dialogue; metadata is restored on wake-up; `onNPCSleep` / `onNPCWake` callbacks fire HUD notifications; `isSleeping(name)` / `getActiveBehavior(npc)` query helpers; save-state persistence (SAVE_VERSION 18) re-derives sleep state from restored game time so the flag is never stale.
- 🧭 **HorseSystem / Mount System** — Rideable horse companions; separate speed/stamina pool; dismount on combat; stable NPCs for purchase; horse inventory slot for saddlebags.



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

- ✅ **LodSystem** — Multi-level LOD with `registerLevels()`: supports high/medium/low detail mesh swapping based on player distance; previous binary visible/hidden culling preserved via `register()`; `update()` culled-count includes level-group hidden meshes; disposed-mesh pruning handles level groups; `unregisterLevels()` / `clear()` restore all LOD mesh visibilities.
- ✅ **ObjectPool\<T\>** — Generic reusable object pool eliminating GC-pressure allocation spikes for frequently created/destroyed game objects (loot meshes, projectiles, hit particles); `acquire()` / `release()` / `prewarm()` / `clear()`; `size` / `totalAllocated` accessors for profiling; configurable `maxSize` overflow disposal.
- 🧭 Optimize chunk streaming and object pooling.
- 🧭 Profile heavy combat scenes and UI redraw paths.

### Rendering + Visual Quality

- ✅ **GraphicsSystem** — Centralised, validated rendering configuration (no BabylonJS engine dependency): typed interfaces for `ShadowConfig` (power-of-two map size, blur kernel), `BloomConfig` (threshold, weight, kernel, scale), `PostProcessConfig` (FXAA, sharpen, ACES tone mapping, exposure, contrast, vignette), `SkyConfig` (turbidity, luminance, Rayleigh/Mie scattering, inclination, azimuth), `FogConfig` (density, colour), and `LightingConfig` (ambient + sun base intensities). `DEFAULT_*` presets document the in-game settings; `validate()` / `isValid` surface invalid values (non-power-of-two shadow maps, out-of-range bloom params, etc.) before they silently corrupt rendering. `game.ts` reads all configurable rendering values from `GraphicsSystem` instead of hardcoded magic numbers; sky-dome mesh, sky material, and `DefaultRenderingPipeline` are stored as `Game.skyDome`, `Game.skyMaterial`, and `Game.renderingPipeline` for lifecycle management; `_setLight()` now correctly private.

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

- ✅ **QuestCreatorSystem** — Headless quest-authoring layer: `setMeta()`, `addNode()`, `updateNode()`, `removeNode()`, `validate()` (via `QuestGraphEngine`), `toQuestDefinition()`, `exportToJson()` / `exportToFile()` (browser download), `importFromJson()` / `importFromFile()`. Orphaned-prerequisite pruning on `removeNode()`.
- ✅ **Quest Creator UI** — HTML overlay panel (`QuestCreatorUI`): quest metadata form (id / name / description / XP reward), live node list with per-node trigger type selector, target-ID and count inputs, description and prerequisites fields, validate / export-JSON / import-JSON / reset actions; opens/closes with **F10** (also dismissable with **Esc**).
- ✅ **FactionCreatorSystem** — Headless faction-authoring layer: `setMeta()` (id, name, description, defaultReputation, hostileBelow, friendlyAt, alliedAt), `addRelation()` / `updateRelation()` / `removeRelation()` for directed inter-faction relationship records, `validate()` (ordering checks, duplicate-target detection, self-reference guard), `toDefinition()` → `FactionDefinition` for `FactionEngine`, `exportToJson()` / `exportToFile()`, `importFromJson()` / `importFromFile()`.
- ✅ **Faction Creator UI** — HTML overlay panel (`FactionCreatorUI`): two-column layout (identity + reputation thresholds with live disposition preview bar), full relations list with per-row targetId / disposition / note fields; validate / export-JSON / import-JSON / reset actions; opens/closes with **Shift+F9** (also dismissable with **Esc**).
- ✅ **LootTableCreatorSystem** — Headless loot-table-authoring layer: `setMeta()` (id, rolls, unique, noneWeight), `addEntry()` / `updateEntry()` / `removeEntry()` / `moveEntryUp()` / `moveEntryDown()` for loot entries (itemId, itemName, weight, min/maxQuantity, guarantee, subTableId, minLevel/maxLevel conditions), `validate()`, `toLootTable()` → `LootTable` for `LootTableSystem`, `exportToJson()` / `exportToFile()`, `importFromJson()` / `importFromFile()`.
- ✅ **Loot Table Creator UI** — HTML overlay panel (`LootTableCreatorUI`): table-settings column (id, rolls, unique flag, none-weight) + scrollable entry list with per-entry itemId / itemName / subTableId / weight / quantity range / level conditions / guarantee; reorder-up/down per entry; validate / export-JSON / import-JSON / reset actions; opens/closes with **Shift+F8** (also dismissable with **Esc**).
- ✅ **EditorHub expanded** — Faction Creator and Loot Table Creator added to the F11 Editor Hub launcher grid alongside Map, Quest, Dialogue, NPC, and Item editors.
- ✅ **Map Editor UX improvements** — `MapEditorPalettePanel` (placement-palette browser with per-type description and quick-place button, bottom-left dock); `MapEditorValidationPanel` (dedicated scrollable validation results pane, toggled by F7, with re-validate and entity-focus actions); **D** key shortcut to duplicate the selected entity; toolbar extended with live undo/redo stack counters.
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
4. ~~Quest/content authoring ergonomics.~~ ✅ Complete — `QuestCreatorSystem` + `QuestCreatorUI` (F10).
5. Save/load robustness and automated tests.

---

## Next Steps (Planned After DailyScheduleSystem)

### HorseSystem / Mount System
The natural next milestone in Character Progression Depth. Key design points:

- **Horse entity** — Dedicated `Horse` class (capsule mesh, dedicated physics body, separate `maxSpeed`/`stamina` pool).
- **Mounting / dismounting** — Interact with a horse to mount; dismount via `F` key or on entering combat.
- **Mounted movement** — While mounted, player movement is redirected to the horse; camera stays first-person.
- **Stable NPCs** — Innkeepers and stable merchants offer horse purchase (gold-gated, one horse at a time).
- **Saddlebag inventory** — Horse carries an additional carry-weight slot unlocked on purchase.
- **Save state** — SAVE_VERSION 19: horse position, health, and equipped saddlebag items persisted.

### Weapon Archetype Tuning Pass
- Sword (Blade) — faster swing cadence, lower stamina cost, medium stagger.
- Axe (Blade) — slower swing, higher damage, ignores 10% of armor rating.
- Mace (Blunt) — low speed, high stagger chance, bonus vs. heavy armor.
- Bow (Marksman) — already implemented; tune draw-speed multiplier per arrow type.
- Staff (Destruction) — replaces Q-cast with a slower, higher-damage charge attack.

### Content GUI — Release A (Dockable Editor Layout)
- Dockable editor layout (Scene / Hierarchy / Inspector / Validation panes).
- Unified selection model shared by map entities, quest nodes, and dialogue nodes.
