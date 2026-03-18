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
- ✅ Save/load (SAVE_VERSION 19) for all system states.
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

- ✅ Dockable editor layout (Scene/Hierarchy/Inspector/Validation panes).
- ✅ Unified selection model shared by map entities, quest nodes, and dialogue nodes.
- ✅ Undo/redo history with grouped actions for transform + property edits (Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z).
- ✅ Context-aware hotkey/help overlay so editor workflows are discoverable in-app (F1 toggles gameplay/editor key cheat sheet).

#### Release B — Content-Specific Editors

- ✅ **Quest Graph GUI**: node canvas for objectives, dependencies, fail states, and rewards — `QuestCreatorNodeDraft` now carries `x`/`y` canvas positions (auto-assigned in a 4-column grid); `QuestCreatorUI` renders an SVG graph panel below the node list showing prerequisite arrows between nodes.
- ✅ **Dialogue Tree GUI**: branching conversation editor with condition/effect forms — `DialogueCreatorUI` exposes per-choice condition (`flag`, `faction_min`, `quest_status`, `has_item`, `skill_min`) and effect (`set_flag`, `faction_delta`, `emit_event`, `activate_quest`, `consume_item`, `give_item`) editors in an expandable details panel alongside node text/speaker fields.
- ✅ **Loot + Spawn GUI**: weighted table editor, archetype picker, and spawn validation hints — `SpawnCreatorSystem` (headless CRUD + validate + export/import) and `SpawnCreatorUI` HTML overlay; archetype picker dropdown (guard/merchant/enemy/boss/…) + free-text custom ID; loot table ID link; count, level range, respawn interval; inline per-entry validation hints; wired as `Shift+F11` and added to the F11 Editor Hub grid.
- ✅ **Shared property inspectors** generated from schema metadata — `SchemaFieldBuilder` utility class (`src/ui/schema-field-builder.ts`) generates consistently styled `text`, `number`, `checkbox`, `select`, and `textarea` controls from a lightweight descriptor; used by `SpawnCreatorUI` to eliminate per-field boilerplate.

#### Release C — Validation + Packaging Workflow

- ✅ **Pre-publish validation dashboard** — `ContentBundleUI` (HTML overlay, Shift+F7 / Editor Hub "bundle") aggregates per-system diagnostics from all attached creator systems (map, quest, dialogue, faction, loot table, NPC, item, spawn) in a single scrollable dashboard with per-system pass/fail rows and expandable issue lists.
- ✅ **One-click content bundle export** — `ContentBundleSystem.exportToFile()` writes a single `.bundle.json` file containing the manifest and all attached system payloads; `buildBundle()` returns the structured object for programmatic use.
- ✅ **Diff-friendly JSON normalization** — `sortKeysDeep()` / `toNormalizedJson()` utilities recursively sort all object keys alphabetically so exported bundle JSON is stable and produces clean diffs regardless of authoring order.
- ✅ **"Play from here" test harness launchers** — each system row in `ContentBundleUI` has an "▶ Open" button that closes the dashboard and fires `onPlayFromHere(systemId)` so the game layer immediately opens the matching creator UI (quest, dialogue, faction, loot table, NPC, item, spawn, or map editor) for rapid content iteration.

#### Release D — Collaboration + Scale

- ✅ **Asset Browser** (`AssetBrowserSystem` + `AssetBrowserUI`, Shift+F6 / Editor Hub "🗂 Asset Browser") — searchable asset registry with type + tag filters and favorites; `importFromBundle()` bulk-registers all assets from a `.bundle.json`; per-asset detail panel shows description, tags, dependency graph (forward + reverse BFS), and an "Insert" callback for active-editor integration.
- ✅ **Bundle Merge Assistant** (`BundleMergeSystem` + `BundleMergeUI`, Shift+F5 / Editor Hub "🔀 Bundle Merge") — load two `.bundle.json` files, auto-detect conflicting content IDs across all systems and map entities, choose per-conflict resolution strategy (`keep-base` / `keep-incoming` / `rename-incoming`), bulk-apply a strategy with one click, then export the merged bundle as a diff-friendly JSON download.
- 🧭 Layer/stream controls for large worlds (region visibility, lock/hide, author ownership).
- 🧭 Optional cloud-backed publishing target compatible with local offline workflow.

---

## Next Steps

### Content GUI — Release D Remainder ✅

All planned Release D remainder items delivered:

1. ✅ **Layer author-ownership controls** — `owner?: string` added to `EditorLayer`; `MapEditorSystem.currentAuthor` + `setLayerOwner()` method; foreign-author layers auto-locked on `importMap()` when both `currentAuthor` and `layer.owner` are set and differ; `MapEditorLayerPanel` shows owner sub-row per layer (amber text + 🔐 icon for foreign layers, muted for own).

2. ✅ **Asset Browser enhancements** — Inline tag editor in detail panel (removable chips + add-tag input + "Add" button; changes committed live to registry); "⬇ Export Selected" button writes the selected asset + all transitive dependencies as `{id}_export.assets.json`; `EditorHubUI.setBadge(toolId, count)` updates a numeric badge on any tool card — wired on bundle import to show live asset count on the "🗂 Asset Browser" card.

3. ✅ **LocalStorage workspace draft** (`WorkspaceDraftSystem`, 20 tests) — `markDirty()` debounces a 2 s auto-save across all 8 creator systems; `restore()` reloads all stored system states on next session with a "Draft restored" HUD notification; `hasDraft()` / `clearDraft()` / `peekDraft()` / `getDraftSavedAt()` for programmatic control; `onSaved` callback shows a "Workspace draft auto-saved" notification after each auto-save; `markDirty()` wired to every creator UI `onClose`.

---

---

## Next Steps

### Content GUI — Release E (World-Scale Editing) ✅

All three Release E items delivered:

1. ✅ **Region-based streaming controls** — `RegionSystem` (`src/systems/region-system.ts`, 39 tests) partitions the map into named rectangular or spherical regions; per-region `setVisible()` / `setActive()` toggles with callbacks; `getRegionsAtPoint()` spatial query; `getActiveRegionIds()` / `getInactiveRegionIds()` helpers for LOD and AI integration; `getSnapshot()` / `restoreSnapshot()` for persistence; `attachLodSystem()` hook for future mesh-level LOD bypass.

2. ✅ **CLI / dev tooling** — `tools/validate-bundle.mjs` accepts a `.bundle.json` path, validates manifest schema, cross-checks declared vs. present systems, and performs per-system structural validation (quest node ids, dialogue nextNodeId refs, faction threshold ordering, loot entry integrity, etc.); exits non-zero on errors; suitable for CI pipelines and pre-commit hooks.

3. ✅ **Automated regression coverage** — Quest-and-inventory integration test suite (`src/framework/quest-inventory.integration.test.ts`, 45 tests) covering: item-consume effects via dialogue, give-item effects, fetch-quest pick-up flows with progress capping, multi-objective chain ordering with prerequisites, parallel start-node objectives, faction-disposition gating on dialogue choices, quest lifecycle guards (no re-activation after completion), save/restore round-trip preserving quest progress and inventory state, flag-gated dialogue choices, quest-status-gated dialogue choices, has_item-gated dialogue choices, concurrent multi-quest tracking, and save/restore preserving flags + faction reputation.

---

### Content GUI — Release G (Stability and Tooling) ✅

Both planned Stability and Tooling items delivered:

1. ✅ **Save migration/versioning workflow** — `SaveMigrationRegistry` (`src/framework/save/save-migration-registry.ts`, 21 tests) provides a structured, composable API for managing versioned save migrations: `register(fromVersion, migration)` for fluent step registration; `validate(minVersion, targetVersion)` to verify chain completeness with no gaps; `buildChain(minVersion, targetVersion)` to retrieve the ordered migration list (throws on missing steps); `apply(input, targetVersion?)` to drive `applySaveMigrations` from the registry's own entries; and `SaveMigrationRegistry.withDefaults()` factory pre-seeded with the built-in v0→v1 migration for easy extension. Exported from the framework public API (`src/framework/index.ts`).

2. ✅ **Expanded quest + inventory regression coverage** — Quest-and-inventory integration test suite extended from 27 to 45 tests adding: flag-gated dialogue choices (`set_flag` / `type: "flag"` conditions), quest-status-gated dialogue choices (`type: "quest_status"` for inactive/active/completed branching), `has_item`-gated dialogue choices with item-swap effects, concurrent multi-quest tracking (events attributed correctly, independent completion), and save/restore round-trips verifying flags, faction reputation, completed quest status, inventory contents, and full `exportSave`/`importSave` checksum cycle.

---

### Content GUI — Release H (Scripted Event Sequences + Framework Adapters) ✅

Both planned Release H items delivered:

1. ✅ **EventScriptSystem** (`src/systems/event-script-system.ts`, 35 tests) — data-driven scripted encounter / cutscene engine: define named scripts composed of ordered steps (`show_notification`, `trigger_quest`, `award_item`, `remove_item`, `set_flag`, `faction_delta`, `wait_hours`, `emit_event`); conditional branching via `branch_on_flag` (flag → ifTrue / ifFalse sub-steps) and `branch_on_quest` (quest status → then / else sub-steps); branches are resolved eagerly at `run()` time into a flat resolved-step list; `wait_hours` suspends execution until `update(gameTimeMinutes)` is called with a matching game clock; `repeatable` flag controls whether a script can be run again after completing; `onStepExecuted`, `onScriptComplete`, `onScriptCancelled` callbacks; save-state persistence (`getSaveState()` / `restoreFromSave()`).

2. ✅ **FrameworkRuntimeAdapter** (`src/framework/runtime/framework-runtime-adapter.ts`, 20 tests) — host-game integration bridge for `FrameworkRuntime`: accepts pluggable `SkillAdapter` (wires `SkillProgressionSystem.getSkillRank` → dialogue `skill_min` conditions) and `TimeAdapter` (exposes `TimeSystem.gameTime` to framework components); `addListener(NotificationListener)` returns an unsubscribe function and fires `onQuestActivated`, `onQuestCompleted`, `onItemConsumed`, `onItemGiven`, `onFactionRepChanged`, `onFlagChanged` callbacks; `applyQuestEvent()` wraps the runtime and triggers completion listeners; `createInstrumentedDialogueSession()` builds a fully-wired `DialogueContext` so every dialogue side-effect fires all registered notification listeners; `setFlag()` / `getFlag()` expose runtime flags publicly (backed by new `FrameworkRuntime.getFlag()` / `setFlag()` public methods); all engine accessors (`questEngine`, `inventoryEngine`, `factionEngine`, `dialogueEngine`, `contentRegistry`) pass through; `createSave()` / `restoreFromSave()` / `getSaveSnapshot()` delegate to runtime; exported from `src/framework/index.ts`.

---

### Content GUI — Release I (Mod Manifest Authoring + CLI Tooling) ✅

All planned Release I items delivered:

1. ✅ **ModManifestSystem** (`src/systems/mod-manifest-system.ts`, 44 tests) — headless mod-manifest authoring layer: `addEntry()` appends a new entry (auto-generated id when not provided); `removeEntry()` / `updateEntry()` for CRUD; `enableEntry()` / `disableEntry()` toggle the `enabled` flag; `moveEntryUp()` / `moveEntryDown()` for drag-free load-order reordering; `validate()` → `ModManifestValidationReport` (empty-id, duplicate-id, empty-url checks); `toManifest()` → `ModManifest` compatible with the framework `ModLoader` (omits `enabled` field when `true` for clean output); `exportToJson()` / `exportToFile()` (browser download of `manifest.json`) / `importFromJson()` / `importFromFile()`; `reset()` clears all entries.

2. ✅ **ModManifestUI** (`src/ui/mod-manifest-ui.ts`) — HTML overlay (Ctrl+Shift+M / Editor Hub "📋 Mod Manifest"): scrollable ordered mod-entry list with per-row id display, URL text field, enabled checkbox, ▲ / ▼ reorder buttons, and ✕ remove button; load-order position badge; validate / export-JSON / import-JSON / reset action buttons with inline status feedback; Esc dismisses the overlay.

3. ✅ **Generate Mod Manifest CLI** (`tools/generate-mod-manifest.mjs`) — node CLI accepting one or more `.mod.json` file paths; validates each file for a non-empty `id` string and `content` object, detects duplicate mod ids across files; prints per-file pass/fail summary; writes the resulting `manifest.json` to `--output <path>` or stdout; `--disabled` flag marks all entries `enabled: false`; exits non-zero on any validation error; suitable for CI pipelines and pre-commit hooks.

4. ✅ **Editor Hub expanded** — "📋 Mod Manifest" tool card (Ctrl+Shift+M, indigo-blue accent) added to the F11 Editor Hub launcher alongside the existing creator tools.

---

### Framework-First Consolidation

- ✅ Expand framework runtime adapters so demo gameplay systems consume framework state as source-of-truth — `FrameworkRuntimeAdapter` (see Release H above).
- ✅ Add richer dialogue effect hooks (quest activation, inventory consume/give, conditional branches by faction tiers).
- ✅ Add quest authoring utilities and graph validation diagnostics (dead-end node detection, cycle hints) with in-game validation hotkey (F8).
- ✅ Harden save migrations with versioned schema (SAVE_VERSION bumped on each structural change).
- ✅ Add CLI/dev tooling for mod manifest generation and content schema validation — `ModManifestSystem` + `ModManifestUI` + `tools/generate-mod-manifest.mjs` (see Release I below).

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
- ✅ **HorseSystem / Mount System** — Rideable horse companions; separate speed/stamina pool; dismount on combat; stable NPCs for purchase; horse inventory slot for saddlebags.
- ✅ **SwimmingSystem** — Oblivion-style underwater depth mechanics: breath meter (30 s default) drains while submerged; `onBreathLow` warning fires at 20 %; drowning damage (3 HP/s) applied when breath reaches 0; Argonian racial `waterBreathing` flag suppresses all breath drain; `hasWaterBreathing` toggle for Water Breathing spells/potions; swim-speed multiplier (0.65×) applied while submerged; `enterWater()` / `exitWater()` state transitions fire HUD notifications; save-state persistence (SAVE_VERSION 20).



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

- ✅ Add weapon archetype tuning passes (speed, stagger, resource cost).
- ✅ Add lightweight enemy resistances/weaknesses for build diversity — per-archetype damage modifiers in NpcArchetypeDefinition.
- ✅ Improve telegraph readability for enemy attacks.

### Stability and Tooling

- ✅ Improve save migration/versioning workflow.
- ✅ Add additional automated regression coverage for quests and inventory.

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
- ✅ More advanced quest scripting hooks — `EventScriptSystem` (see Release H below).

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

## Next Steps

### SwimmingSystem ✅
Completed in SAVE_VERSION 20. Key deliverables:

- **Breath meter** — 30-second breath capacity drains while submerged; restored instantly on surfacing.
- **Drowning** — When breath reaches 0, the player takes 3 HP/s drowning damage until surfacing.
- **Low-breath warning** — `onBreathLow` callback fires once per submersion when breath drops below 20 %.
- **Water breathing** — `hasWaterBreathing` flag (toggled by Argonian race or Water Breathing effect) suppresses breath drain entirely.
- **Swim speed** — `swimSpeedMultiplier` returns 0.65 while submerged for game-layer movement integration.
- **Argonian integration** — `RaceDefinition.waterBreathing` field set to `true` for Argonian; synced on `onRaceChosen`.
- **Save state** — SAVE_VERSION 20: `currentBreath`, `maxBreath`, and `isSubmerged` persisted.

### HorseSystem / Mount System ✅
Completed in SAVE_VERSION 19. Key deliverables:

- **Horse entity** — Dedicated `Horse` class (capsule mesh, dedicated physics body, separate `maxSpeed`/`stamina` pool).
- **Mounting / dismounting** — Interact with a horse to mount; dismount via `F` key or on entering combat.
- **Mounted movement** — While mounted, player movement is redirected to the horse; camera stays first-person.
- **Stable NPCs** — Innkeepers and stable merchants offer horse purchase (gold-gated, one horse at a time).
- **Saddlebag inventory** — Horse carries an additional carry-weight slot unlocked on purchase.
- **Save state** — SAVE_VERSION 19: horse position, health, and equipped saddlebag items persisted.

### Weapon Archetype Tuning Pass ✅
- ✅ Sword (Blade) — faster swing cadence (0.85× cooldown), lower stamina cost (0.80×), medium stagger (15% chance, 0.2 s).
- ✅ Axe (Blade) — slightly slower swing (1.15× cooldown, 1.10× cost), higher damage (1.20×), better armor pen (25%), low stagger (10%).
- ✅ Mace (Blunt) — slow swing (1.40× cooldown/cost), highest damage (1.45×), excellent armor pen (50%), high stagger (40% chance, 0.45 s).
- ✅ Bow (Marksman) — per-arrow `drawTimeMultiplier`: iron 1.0, steel 1.05, elven 0.90 (lighter/faster), daedric 1.25 (heavier/slower).
- ✅ Staff (Destruction) — Q KEYDOWN begins a charge (up to 1.5 s); Q KEYUP fires a scaled destruction blast (fire damage, always staggers, awards destruction XP).

### Content GUI — Release A (Dockable Editor Layout) ✅
- ✅ Dockable editor layout (`EditorLayout` headless class: `dock()`/`undock()`/`setVisible()`/`hideAll()`, `getPanelsBySide()`, `getLayoutSnapshot()`/`restoreLayoutSnapshot()` for persistence) — wired into `game.ts` for all 6 map editor panels (hierarchy, palette, layers, notes, properties, validation) with initial dock positions.
- ✅ Unified selection model (`EditorLayout.setSelection()`/`clearSelection()`/`isSelected()`/`onSelectionChanged`) shared by map entities, quest nodes, and dialogue nodes — `mapEditorSystem.onEntitySelectionChanged` now routes through `editorLayout.setSelection()` so all panels share a single source of truth.

### Content GUI — Release B (Content-Specific Editors) ✅
- ✅ **Quest Graph GUI** — `QuestCreatorNodeDraft` gains `x`/`y` canvas positions; `QuestCreatorUI` renders an SVG graph panel with prerequisite arrows between quest nodes.
- ✅ **Dialogue Tree GUI** — `DialogueCreatorUI` condition/effect editors (flag, faction, quest, item, skill checks; set_flag, faction_delta, emit_event, activate_quest, consume/give item effects) in expandable per-choice panels.
- ✅ **Loot + Spawn GUI** — `SpawnCreatorSystem` + `SpawnCreatorUI` (Shift+F11 / Editor Hub): archetype picker, loot table link, count/level range/respawn interval, inline validation hints, JSON export/import.
- ✅ **Shared SchemaFieldBuilder** (`src/ui/schema-field-builder.ts`) — generic labeled control factory (`text`/`number`/`checkbox`/`select`/`textarea`) consuming field descriptors; used by `SpawnCreatorUI`.

### Content GUI — Release C (Validation + Packaging Workflow) ✅
- ✅ **ContentBundleSystem** (`src/systems/content-bundle-system.ts`) — headless aggregation layer: `attach*()` methods register each creator system; `validate()` runs every attached system's validator and returns a unified `ContentBundleReport` (per-system `BundleSystemReport` with `valid`, `label`, and normalised `issues[]`); `buildBundle()` / `exportToJson()` / `exportToFile()` produce the full content bundle; `sortKeysDeep()` / `toNormalizedJson()` helpers ensure all exported JSON uses deterministic alphabetical key ordering; `getPlayFromHereConfig(id)` returns metadata for the quick-open "play from here" button.
- ✅ **ContentBundleUI** (`src/ui/content-bundle-ui.ts`) — HTML overlay (Shift+F7 / Editor Hub "📦 Content Bundle"): bundle metadata form (title, description, author); per-system diagnostic rows with pass/fail icons, issue counts, expandable issue lists, and "▶ Open" quick-open buttons; "Validate All" and "⬇ Export Bundle" action buttons; `onPlayFromHere` callback opens matching creator UI without re-navigating manually.
- ✅ **Editor Hub expanded** — "Content Bundle" tool card added to the F11 Editor Hub launcher grid (shortcut Shift+F7, indigo accent).
- ✅ **Keybinding** — Shift+F7 toggles `ContentBundleUI`; also listed in the F1 help overlay and the Editor Hub.
