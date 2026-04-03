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
- ✅ **HorseSystem** — Mount and stable system: register named horses with individual speed multipliers (1.8×–2.5×) and saddlebag capacities; purchase horses from stable NPCs at configurable gold prices; O to mount/dismount; Shift+O to browse the stable (unmounted) or open the saddlebag inventory (mounted); `onMount`, `onDismount`, `onHorsePurchased` callbacks wired to HUD notifications; saddlebag item management (add, remove, transfer to player); save-state persistence (SAVE_VERSION 19).
- ✅ **SwimmingSystem** — Breath and drowning system: 30-second breath meter drains while submerged; drowning damage (3 HP/s) applied when breath reaches zero; `onBreathLow` warning fires at 20 % breath; `hasWaterBreathing` flag suppresses all drain (Argonian racial trait or Water Breathing spell/potion); `swimSpeedMultiplier` (0.65×) returned to game layer; `setMaxBreath()` for effect-based upgrades; save-state persistence (SAVE_VERSION 20).
- ✅ **DiseaseSystem** — Oblivion-style disease contraction and cure: seven built-in diseases (Rust Chancre, Swamp Rot, Witbane, Collywobbles, Brain Rot, Yellow Tick, Porphyric Hemophilia) each weakening one or more attributes; 5 % per-hit chance to contract a random disease in combat; `diseaseResistanceChance` flag for full Argonian immunity; `cureAllDiseases()` for Cure Disease potions and shrine blessings; `getAttributePenalties()` returns the merged attribute debuff map for stat integration; `registerDisease()` for mod-defined diseases; `onDiseaseContracted`/`onDiseaseCured` callbacks; save-state persistence (SAVE_VERSION 21).

### World + Content

- ✅ Infinite chunk-based terrain.
- ✅ Biomes with procedural vegetation/props.
- ✅ Deterministic structures and loot opportunities.

### UX + Persistence

- ✅ HUD, quest log, inventory, skill tree, pause flow.
- ✅ Save/load (SAVE_VERSION 22) for all system states.
- ✅ Save file export to JSON file download + import from JSON/File (browser-safe).
- ✅ Notifications, hit feedback, and debug support.
- ✅ Compass HUD (top-center) showing cardinal direction from camera heading.
- ✅ Wait/Rest dialog (T) for time-skipping 1–24 in-game hours with stat restoration.
- ✅ Fame/Infamy HUD (H key) showing reputation tier, active effects, and jail history.
- ✅ Racial Power (V key) — activate the chosen race's once-per-day power; HUD notification shows name + description; cooldown status message when on recharge.
- ✅ Horse / Stable UI (O / Shift+O) — mount your horse, browse stables, manage saddlebag.

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

### Content GUI — Release J (Biome + Landmark Systems) ✅

Both planned Release J items delivered:

1. ✅ **BiomeSystem** (`src/systems/biome-system.ts`, 41 tests) — biome-specific encounter tables: `addBiome()` / `removeBiome()` / `getBiome()` CRUD; rect and sphere bounding volumes for spatial containment; `getBiomesAtPoint(x, y, z)` spatial query; `updatePlayerPosition(x, y, z)` recalculates membership each frame and fires `onBiomeEntered` / `onBiomeExited` callbacks on transitions; `getCurrentBiomeIds()` returns the set of biomes the player is currently inside; `getEncounterGroups(biomeId)` returns the weighted encounter-table references; `sampleEncounterTable(biomeId, rng?)` performs a weighted random draw and returns a table id (or `null` when the biome has no groups); `encounterRate` field (encounters per in-game hour) for caller-side scheduling; `ambientId` field for ambient sound/event integration; `getSnapshot()` / `restoreSnapshot()` for persistence; `clear()`.

2. ✅ **LandmarkSystem** (`src/systems/landmark-system.ts`, 45 tests) — landmark-driven exploration rewards: `addLandmark()` / `removeLandmark()` / `getLandmark()` CRUD; eight `LandmarkType` values (`dungeon`, `ruin`, `shrine`, `cave`, `tower`, `camp`, `settlement`, `monument`); `discoverLandmark(id)` grants `discoveryReward` (XP, fame, fixed items, loot-table reference) on first call and fires `onLandmarkDiscovered`; `completeLandmark(id)` grants `completionReward` on first call (auto-discovers if not yet done) and fires `onLandmarkCompleted`; both actions are idempotent after first call; `isDiscovered()` / `isCompleted()` flags; `getDiscoveredLandmarks()` / `getCompletedLandmarks()` / `getLandmarksByType(type)` query helpers; `getLandmarksInRadius(x, y, z, radius)` spatial query; `getNearestLandmark(x, y, z)` returns closest landmark id; `getUndiscoveredInRadius()` for proximity-triggered auto-discovery; `getSnapshot()` / `restoreSnapshot()` (silent — no callbacks on load to prevent duplicate reward grants); `clear()`.

---

### Content GUI — Release K (Ambient Events + Dynamic Encounters) ✅

Both planned Release K items delivered:

1. ✅ **AmbientEventSystem** (`src/systems/ambient-event-system.ts`, 45 tests) — environmental storytelling engine: `addEvent()` / `removeEvent()` / `getEvent()` CRUD; each `AmbientEventDefinition` carries a `conditions` record (optional `timeRange` for day/night windows including midnight wrap-around, `weather` allowlist, `biomeIds` requiring at least one active biome, `minPlayerLevel`, `requiredFlags` that must all be set, `forbiddenFlags` that must all be absent) and an `effect` record (`notification` text, `setFlag`, `emitEvent`); `update(context)` scans all events each game-clock tick and fires eligible ones via `onEventTriggered(eventId, effect)`; per-event `cooldownHours` rate-limits repeat fires with correct 24-hour wrap; `oneShot` flag allows exactly one lifetime fire; `getEligibleEventIds(context)` returns matching event ids without side-effects (debug/preview); `getLastFiredAt()` / `hasFired()` query helpers; `getSnapshot()` / `restoreSnapshot()` for save persistence (callbacks suppressed on load).

2. ✅ **EncounterSystem** (`src/systems/encounter-system.ts`, 43 tests) — dynamic random encounter scheduling: `addTemplate()` / `removeTemplate()` / `getTemplate()` CRUD; each `EncounterTemplate` links to a `tableId` (encounter/loot table), declares `biomeIds` for auto-scheduling, `minCount`/`maxCount` for spawn quantity variance, optional `minLevel`/`maxLevel` gates, `cooldownHours`, and `spawnChance` [0,1] for probabilistic firing; `triggerEncounter(templateId, context, rng?)` fires the encounter manually (returns `EncounterResult` with resolved `count` and `playerLevel`, or `null` when gated); `update(context, activeBiomeIds, rng?)` auto-fires all eligible templates whose biome set intersects the active set — respects cooldown, level gate, and spawn chance; `getTemplatesForBiome(biomeId)` for `BiomeSystem.onBiomeEntered` wiring; `getEligibleTemplates(context)` dry-run; `getTriggerCount()` / `getLastTriggeredAt()` query helpers; `getSnapshot()` / `restoreSnapshot()` for save persistence.

---

### Content GUI — Release L (Crafting + Travel Event Systems) ✅

Both planned Release L items delivered:

1. ✅ **CraftingSystem** (`src/systems/crafting-system.ts`, 50 tests) — material-based item crafting (smithing/forging): `addRecipe()` / `removeRecipe()` / `getRecipe()` CRUD; each `CraftingRecipe` declares a `category` (`weapon` / `armor` / `jewelry` / `misc`), a `requiredMaterials` list (materialId + quantity pairs), `outputItemId` / `outputItemName` / `outputQuantity`, an optional `requiredSkill` gate, and `craftingXp` awarded on success; `canCraft(recipeId, materials, skill)` checks material availability and skill level without side-effects; `craft(recipeId, materials, skill)` validates requirements and returns a discriminated `CraftOutcome` (`success: true` with `CraftingResult` or `success: false` with a `CraftingFailReason` — `unknown_recipe` / `missing_materials` / `skill_too_low`); `getAvailableRecipes(materials, skill)` returns all currently craftable recipes; `getRecipesByCategory(category)` for forge-UI filtering; `getTotalCrafted(recipeId)` tracks per-recipe craft counts; `onItemCrafted` callback delivers the result to the game layer for inventory and XP updates; `getSnapshot()` / `restoreSnapshot()` for save persistence.

2. ✅ **TravelEventSystem** (`src/systems/travel-event-system.ts`, 45 tests) — random events during fast travel: `addEvent()` / `removeEvent()` / `getEvent()` CRUD; each `TravelEventDefinition` carries a `conditions` record (`biomeIds` requiring at least one active biome, `weather` allowlist, `minPlayerLevel`, `requiredFlags`, `forbiddenFlags`) and an `outcome` record (`notification` text, `setFlag`, `emitEvent`, `landmarkId` for auto-discovery via `LandmarkSystem`); `rollEvent(context, rng?)` performs a weighted random draw among eligible events, applies the outcome, and fires `onTravelEventFired(eventId, outcome)` — returns `null` when no eligible event exists; per-event `weight` field biases the weighted draw; `cooldownHours` rate-limits repeat fires with correct 24-hour midnight wrap-around; `oneShot` flag allows exactly one lifetime fire; `getEligibleEvents(context)` dry-run for debug overlays; `getLastFiredAt()` / `hasFired()` / `getTotalEventsFired()` query helpers; `getSnapshot()` / `restoreSnapshot()` for save persistence (callbacks suppressed on load).

---

### Content GUI — Release M (Weather Schedule + Journal Systems) ✅

Both planned Release M items delivered:

1. ✅ **WeatherScheduleSystem** (`src/systems/weather-schedule-system.ts`, 45 tests) — authored named weather sequences with timed transitions: `addSchedule()` / `removeSchedule()` / `getSchedule()` CRUD; each `WeatherScheduleDefinition` carries an ordered `steps[]` list of `WeatherScheduleStep` entries (each with a target `weather: WeatherState` and `durationSeconds`); `play(id)` starts playback from step 0 and fires `onStep(scheduleId, stepIndex, step)` so the game layer can call `weatherSystem.forceWeather(step.weather)`; `update(deltaTime)` advances the countdown and transitions to the next step when time expires, carrying over any excess delta so rapid small ticks never skip steps; `loop: true` wraps back to step 0 after the last step — `onComplete(scheduleId)` fires only for non-looping sequences; `pause()` / `resume()` temporarily halt progression; `jumpToStep(index)` for scripted mid-sequence jumps; `getSnapshot()` / `restoreSnapshot()` for save persistence (callbacks suppressed on load).

2. ✅ **JournalSystem** (`src/systems/journal-system.ts`, 56 tests) — player journal with categories, tags, notes, favorites, and text search: `addEntry()` / `updateEntry()` / `removeEntry()` / `getEntry()` CRUD; each `JournalEntry` carries `title`, `body`, `category` (`quest` / `lore` / `note` / `rumor` / `observation` / `misc`), `tags[]` (normalised to lower-case on write), optional `summary`, `createdAt` / `updatedAt` timestamps, and a `favorite` flag; `toggleFavorite(id)` flips and returns the new state; `getFavorites()` returns starred entries sorted by `updatedAt` descending; `getByCategory(category)` and `getByTags(tags[])` (AND logic, case-insensitive) for filtered browsing; `search(query)` performs a case-insensitive substring match across `title`, `body`, and `summary` with title-match entries ranked above body-match entries; `getAllEntries()` returns all entries sorted by `updatedAt` descending; `getAllTags()` returns the distinct tag vocabulary sorted alphabetically; `getSnapshot()` / `restoreSnapshot()` for save persistence.

---

### Content GUI — Release N (UI/UX Depth & Polish) ✅

Two focused UI components that add polish and contextual depth to all existing game panels.

1. ✅ **TooltipUI** (`src/ui/tooltip-ui.ts`, 21 tests) — reusable hover-tooltip overlay that can attach to any DOM element: `attach(element, content)` registers the element and wires `mouseenter` / `mouseleave` / `focus` / `blur` listeners; a configurable `showDelay` (default 220 ms) prevents tooltip flicker during rapid cursor movement while a `hideDelay` (default 80 ms) gives the cursor time to move from the target onto the tooltip; `detach(element)` removes all listeners and the `aria-describedby` annotation; `detachAll()` tears down every attachment and destroys the singleton tooltip DOM node; `updateContent(element, content)` hot-patches live text when the tooltip is already visible; `isVisible` / `attachedCount` query accessors; fully accessible — tooltip element carries `role="tooltip"` and `aria-live="polite"` and all targets receive `aria-describedby`; positioned via `position: fixed` with viewport-edge clamping so it never overflows the screen. Designed for use by `LevelUpUI` (attribute description hints), the inventory panel (item stat summaries), skill-tree nodes, and any future editor controls.

2. ✅ **ActiveEffectHUD** (`src/ui/active-effect-hud.ts`, 35 tests) — visual HUD strip that renders every currently active spell / potion / enchantment effect as a compact pill: `show()` creates the DOM lazily and sets `display: flex`; `hide()` collapses the strip without destroying state; `update(effects)` synchronises pills with the `ActiveEffectsSystem.activeEffects` snapshot — new effects get a pill added, effects no longer present have their pill removed, and existing effects have their countdown and progress bar updated in-place; each pill carries an effect-type icon (`❤` heal, `🔥` fire, `🔰` resist, etc.), the effect's display name, a compact `formatDuration` countdown (`30s` / `2m 15s` / `∞`), and a thin shrinking progress bar (`role="progressbar"` with `aria-valuenow`); effects are colour-coded by category (`heal` / `magicka` / `stamina` / `fortify` / `harm`); `destroy()` removes all pills and the root DOM node; root carries `role="status"` and `aria-live="polite"` for screen-reader announcements. Plugs directly into the existing `ActiveEffect.totalDuration` field that was specifically added for UI progress display.

---

### Content GUI — Release O (Skill Tree UI + Journal UI) ✅

Two player-facing overlay panels that surface existing headless systems through interactive, accessible HTML UIs.

1. ✅ **SkillTreeUI** (`src/ui/skill-tree-ui.ts`, 36 tests) — interactive skill tree overlay: `show()` / `hide()` / `isVisible` lifecycle; `update(trees, skillPoints, prereqFn)` synchronises the panel with the current `SkillTreeSystem` state without re-creating the DOM; tab bar renders one tab per `SkillTree` (Combat / Magic / Survival), switching tabs replaces the active pane; each skill is rendered as a card with name, description, rank pips (`renderRankPips` helper — filled `●` and empty `○` circles), and either an "Upgrade" button or a "Max" badge; locked skills (unmet prerequisites) receive an `is-locked` class and a `🔒` description prefix; the upgrade button is disabled when no skill points remain or the skill is locked; `onPurchase(treeIndex, skillIndex)` callback fired on button click; `destroy()` removes the DOM node; fully accessible — root carries `role="dialog"` / `aria-modal`, tabs have `role="tab"` / `aria-selected`, the active pane carries `role="tabpanel"`, and pip spans carry an `aria-label` with rank info; close button (`✕`) calls `hide()`.

2. ✅ **JournalUI** (`src/ui/journal-ui.ts`, 36 tests) — player-facing journal browser overlay: `show()` / `hide()` / `isVisible` lifecycle; `update(system)` snapshots entries from a `JournalSystem` instance filtered by the active category tab and search query; two-panel layout — scrollable entry list on the left (title, category badge, ⭐/☆ favorite toggle button) and detail pane on the right (title, category · date meta row, tag chips, full body); category tab bar (`All` / `Quest` / `Lore` / `Note` / `Rumor` / `Observation` / `Misc` / `⭐ Favorites`) with `role="tab"` / `aria-selected`; search input (`role="search"`) narrows the list in real time via `JournalSystem.search()`; clicking a Favorites tab delegates to `system.getFavorites()`; switching tabs resets `selectedId` and clears the detail pane; `onFavoriteToggle(id)` callback allows the caller to invoke `system.toggleFavorite()` and re-render; `activeFilter` / `selectedId` read-only accessors for testing; `destroy()` removes the DOM node; fully accessible — root carries `role="dialog"` / `aria-modal`, entry list has `role="list"`, tab bar has `aria-label`, favorite buttons have `aria-pressed`, detail pane has `aria-live="polite"`; close button (`✕`) calls `hide()`.

---

### Content GUI — Release P (Crafting Workbench UI + Character Sheet UI) ✅

Two player-facing overlay panels that surface existing headless systems through interactive, accessible HTML UIs.

1. ✅ **CraftingUI** (`src/ui/crafting-ui.ts`, 50 tests) — player-facing crafting workbench overlay: `show()` / `hide()` / `isVisible` lifecycle; `update(system, materials, skill)` synchronises the panel with the current `CraftingSystem` state without re-creating the DOM; category tab bar (`All` / `Weapon` / `Armor` / `Jewelry` / `Misc`) with `role="tab"` / `aria-selected`, switching tabs filters the recipe list and clears the selected recipe; two-panel layout — scrollable recipe list on the left (recipe name, category badge, per-recipe craft count, ✓/✗ availability indicator) and detail pane on the right (title, description, output item, skill requirement with met/unmet styling, per-material rows coloured `mat-ok` / `mat-missing` with available/required quantities, "Craft" button, craft count); "Craft" button is disabled when any material is missing or skill requirement is not met; `onCraft(recipeId)` callback fired on button click; `activeFilter` / `selectedId` read-only accessors for testing; `destroy()` removes the DOM node; fully accessible — root carries `role="dialog"` / `aria-modal`, tablist carries `aria-label`, tabs have `role="tab"` / `aria-selected`, recipe list has `role="list"`, each row has `role="listitem"`, detail pane carries `aria-live="polite"`, material qty spans carry `aria-label` with available/required context; close button (`✕`) calls `hide()`.

2. ✅ **CharacterSheetUI** (`src/ui/character-sheet-ui.ts`, 50 tests) — player character summary overlay: `show()` / `hide()` / `isVisible` lifecycle; `update(data)` renders a `CharacterSheetData` snapshot without re-creating the DOM; identity section displays name, level, race, class, birthsign, and specialization with dash placeholders for absent fields; attributes section renders all seven primary attributes (`strength` / `endurance` / `intelligence` / `agility` / `willpower` / `speed` / `luck`) each tagged with `data-attribute` for targeting; skills section renders all `ProgressionSkill` entries from `SkillProgressionSystem.getAllSkills()` with current level and XP-progress percentage (each XP element carries an `aria-label`); derived stats section shows max Health, Magicka, Stamina, and Carry Weight; reputation section shows fame and infamy scores with optional tier label spans; `destroy()` removes the DOM node; fully accessible — root carries `role="dialog"` / `aria-modal`, every section carries an `aria-label`, close button (`✕`) calls `hide()`.

---

### Content GUI — Release Q (Barter UI + Container UI) ✅

Two player-facing overlay panels that surface the existing headless `BarterSystem` and `ContainerSystem` through interactive, accessible HTML UIs.

1. ✅ **BarterUI** (`src/ui/barter-ui.ts`, 55 tests) — merchant trade / barter overlay: `show()` / `hide()` / `isVisible` lifecycle; `update(system, playerItems)` synchronises both columns with the current `BarterSystem` state without re-creating the DOM; two-column layout — merchant's goods on the left (item name, optional quantity badge for stackable items, buy price in gold, "Buy" button) and player's inventory on the right (item name, optional quantity badge, sell price in gold, "Sell" button); "Buy" button is disabled when the player cannot afford the item; "Sell" button is disabled when the merchant does not have enough gold; gold footer shows merchant gold and player gold; `onBuy(itemId)` / `onSell(itemId)` callbacks fired on button click; `onClose()` callback fired on close-button click; `destroy()` removes the DOM node; fully accessible — root carries `role="dialog"` / `aria-modal`, both inventory lists carry `role="list"` / `aria-label`, each item row carries `role="listitem"` / `data-item-id`, price spans carry `aria-label`, gold totals carry `aria-label`, close button (`✕`) calls `hide()`.

2. ✅ **ContainerUI** (`src/ui/container-ui.ts`, 46 tests) — container loot overlay: `show()` / `hide()` / `isVisible` lifecycle; `update(system)` renders the active container's contents from `ContainerSystem.activeContainer` without re-creating the DOM; scrollable item list with per-item name, optional quantity badge (with `aria-label`) for stacked items, and a "Take" button per row; "Take All" footer button — enabled only when the container has at least one item, disabled (and `aria-disabled="true"`) when empty or no container is active; `onTakeItem(itemId)` callback fired on individual Take; `onTakeAll()` callback fired on Take All; `onClose()` callback fired on close-button click; shows "Empty." placeholder when container has no items; `destroy()` removes the DOM node; fully accessible — root carries `role="dialog"` / `aria-modal`, item list carries `role="list"` / `aria-label` / `aria-live="polite"`, each item row carries `role="listitem"` / `data-item-id`, close button (`✕`) calls `hide()`.

---

### Content GUI — Release R (Wait Dialog UI + Quick-Slot HUD) ✅

Two player-facing HTML overlay components that surface the existing headless `WaitSystem` and `QuickSlotSystem` through interactive, accessible UIs.

1. ✅ **WaitUI** (`src/ui/wait-ui.ts`, 49 tests) — Oblivion-style time-skip rest dialog: `show(currentTimeString?)` / `hide()` / `isVisible` lifecycle; `setCurrentTime(timeString)` updates the current-time label while the dialog is open; hour spinner with ▼/▲ decrement/increment buttons and a direct number input clamped to `[WAIT_MIN_HOURS, WAIT_MAX_HOURS]` (1–24); `hours` getter exposes the currently selected count; "Wait" button fires `onConfirm(hours)` callback; "Cancel" and close (`✕`) buttons both hide the panel and fire `onClose()`; `destroy()` removes the DOM node; fully accessible — root carries `role="dialog"` / `aria-modal` / `aria-label`, current-time span carries `aria-live="polite"`, hour input carries `aria-label`, ▼/▲ buttons carry individual `aria-label` attributes.

2. ✅ **QuickSlotHUD** (`src/ui/quickslot-hud.ts`, 49 tests) — persistent hot-bar HUD strip for the four quick-slot bindings (keys **7**, **8**, **9**, **0**): `show()` / `hide()` / `isVisible` lifecycle; `update(system)` diffs each slot against the previous snapshot and only re-renders cells whose content has changed; each slot cell shows its key label, bound item name (or `"—"` placeholder when empty), and an optional `×N` quantity badge (with `aria-label`) for stackable items with quantity > 1; `onAssign(key, itemId)` callback fires on cell click or Enter/Space keydown so the game layer can open an item-picker; `destroy()` removes the DOM node; fully accessible — root carries `role="toolbar"` / `aria-label`, each slot cell carries `role="button"` / `tabindex="0"` / `data-key` / `aria-label` (updated to include item name and quantity when bound).

### Content GUI — Release S (UI/UX Debug, Audit & Polish) ✅

A targeted audit-and-harden pass over three runtime game-facing HTML overlays, each of which lacked ARIA attributes and automated test coverage.

1. ✅ **FastTravelUI** (`src/ui/fast-travel-ui.ts`, 45 tests) — Destination picker overlay: `open(options[])` lazy-creates the DOM, renders a scrollable list of `FastTravelOptionView` rows (name + `~Nh` ETA), pre-selects the first entry, and updates the status line; clicking a row re-selects it and refreshes `aria-pressed`; the Travel button fires `onTravel(locationId)` with the selected id (disabled when no options are present); "Cancel" and `✕` both call `close()` which fires `onClose()`; **bug fixed**: root now carries `role="dialog"` / `aria-modal="true"` / `aria-labelledby` linked to the `<h2>` title (was missing entirely).

2. ✅ **GuardEncounterUI** (`src/ui/guard-encounter-ui.ts`, 42 tests) — Arrest-challenge modal: `open(view)` populates guard name, faction, bounty, and player gold; Pay Fine button is disabled when `playerGold < bounty`; Persuade button is disabled when `canPersuade` is false; `showStatus(message, isError?)` toggles `--error` / `--ok` modifier classes; each of the four action buttons (Pay Fine / Go to Jail / Persuade / Resist Arrest) fires `onResolve(action)` with the matching `GuardEncounterAction` literal; `close()` hides the panel; already had correct ARIA attributes (`role="dialog"` / `aria-modal` / `aria-labelledby`).

3. ✅ **SpellMakingUI** (`src/ui/spell-making-ui.ts`, 52 tests) — Spellmaking altar overlay: `open()` lazy-creates the DOM, resets the name input and both component cards to defaults, computes and displays the initial cost preview; secondary-effect card is opt-in via a checkbox; the Forge button fires `onForge({ name, components })` — validation rejects an empty spell name with an error status; `showStatus(message, isError?)` toggles the same modifier-class pattern; `close()` / Cancel / `✕` all hide the panel and fire `onClose()`; **bug fixed**: root now carries `role="dialog"` / `aria-modal="true"` / `aria-labelledby` linked to the `<h2>` title (was missing entirely).

### Content GUI — Release T (Standalone Editor Shell) ✅

A full-screen HTML workspace designed for non-programmer content creators, wrapping the entire Camelot creator toolset in a professional, IDE-like shell.

1. ✅ **StandaloneEditorShell** (`src/ui/standalone-editor-shell.ts`, 52 tests) — Full-page application shell: `open()` / `close()` / `toggle()` / `isVisible` lifecycle with lazy DOM construction; **title bar** showing the Camelot Editor brand logo plus four file-action toolbar buttons (New, Open, Save, Export) each backed by an optional callback (`onNew` / `onOpen` / `onSave` / `onExport`) and disabled when no callback is provided; **left sidebar `<nav>`** with three grouped sections — ✏ Content (Quest, Dialogue, NPC, Item), 🌍 World (Map, Faction, Loot Table, Spawn), 🔧 Tools (Content Bundle, Asset Browser, Bundle Merge, Mod Manifest) — each tool item shows its icon, label, and keyboard shortcut, clicking fires `onToolSelect(toolId)` and highlights the item; **`setActiveSection(toolId)`** programmatically highlights the given sidebar nav item with the `--active` modifier class and `aria-current="page"`, removing both from any previously active item; **main content area** hosting a **welcome dashboard** (`role="region"`) with a heading, subtitle, quick-access cards for the four most-used tools (Map, Quest, Dialogue, Content Bundle) each carrying `data-tool-id` and `--card-accent` CSS custom property, plus a tip paragraph; **bottom status bar** (`role="status"` / `aria-live="polite"`) with a coloured dot (green `#5EC45E` for ok, amber `#E08830` for error) and `setStatus(message, isError?)` method for live updates; Escape key closes the shell and removes the listener; fully accessible — root `role="application"`, sidebar `role="navigation"`, toolbar `role="toolbar"`, close button `aria-label`, all interactive elements carry descriptive `aria-label` attributes.

---

### Content GUI — Release U (Camera Scripting + New-User Tutorial) ✅

Two closely related systems that improve the first-time player experience and give designers scripted cinematic control over the camera.

1. ✅ **Camera scripting steps added to EventScriptSystem** (`src/systems/event-script-system.ts`, now 46 tests) — five new step types extend the data-driven scripting engine with full camera control: `camera_look_at` (point the camera at a world-space `{x, y, z}` position), `camera_pan_to` (smoothly move the camera to a position over a configurable `durationMs`, default 1000 ms), `camera_fade_out` (fade the viewport to black, default 500 ms), `camera_fade_in` (fade the viewport back in from black, default 500 ms), and `camera_shake` (apply a camera shake impulse with configurable `intensity`, default 0.5, and `durationMs`, default 500 ms); all five callbacks are **optional** on `EventScriptContext` so hosts without a camera layer do not break — missing callbacks are silently skipped; camera steps participate in the existing `onStepExecuted` callback and save-state round-trip with no additional changes required.

2. ✅ **TutorialSystem** (`src/systems/tutorial-system.ts`, 54 tests) — guided new-player tutorial engine: `addStep()` appends a `TutorialStep` (required `id` + `message`; optional `highlightTarget` for UI element focus and `advanceHint` for action prompts) to the end of the sequence; `removeStep(id)` / `clearSteps()` / `getStep(id)` / `getAllSteps()` for full step CRUD; `start()` begins the tutorial from step 0 and fires `onStepBegin(0, step)` — returns `false` when no steps are registered, already active, already completed, or already skipped; `advance()` completes the current step (fires `onStepComplete`), then either fires `onStepBegin` for the next step or sets `isCompleted` and fires `onTutorialComplete` when the last step is reached — returns `false` when the tutorial is not active; `skip()` ends the tutorial early (fires `onTutorialSkipped`) without marking it complete — no-op when inactive; `reset()` returns the system to its initial not-started state without removing registered steps or firing callbacks, allowing tutorials to be replayed; `isStarted` / `isCompleted` / `isSkipped` / `isActive` / `currentStep` / `currentStepIndex` / `totalSteps` query accessors; `getSnapshot()` / `restoreSnapshot(state)` for save persistence (callbacks suppressed on load to prevent duplicate effects).

### Content GUI — Release V (CameraScriptingSystem + Dialogue-Camera Integration) ✅

A dedicated cinematic camera sequence engine and first-class dialogue-camera integration.

1. ✅ **CameraScriptingSystem** (`src/systems/camera-scripting-system.ts`, 64 tests) — dedicated engine for managing named, reusable camera sequences with per-step timing and easing. **Step types**: `look_at` (instant camera point; fires `cameraLookAt` and advances immediately), `pan_to` (smooth camera move over `durationMs`, default 1000 ms; configurable `easing`: `linear` | `ease_in` | `ease_out` | `ease_in_out`, default `linear`; fires `cameraPanTo`), `fade_out` (viewport fade to black, default 500 ms; fires `cameraFadeOut`), `fade_in` (fade back in, default 500 ms; fires `cameraFadeIn`), `shake` (camera shake impulse with configurable `intensity`, default 0.5, and `durationMs`, default 500 ms; fires `cameraShake`), `wait` (timing pause with no callback). All context callbacks are **optional** — missing ones are silently skipped. **Sequence lifecycle**: `registerSequence(def)` / `unregisterSequence(id)` / `getSequence(id)` / `getAllSequences()` CRUD; `play(id, context)` begins a sequence and executes the first step immediately (returns `false` if not registered or already playing); `stop(id)` fires `onSequenceStopped` and ends playback; `pause(id)` / `resume(id)` temporarily halt and resume time-based step progression (fire `onSequencePaused` / `onSequenceResumed`); `jumpToStep(id, index, context)` seeks to any step mid-sequence; `update(deltaMs, context)` called each frame to drain timers for timed steps; `loop: true` on a sequence definition makes it restart from step 0 after the last step — `onSequenceComplete` is NOT fired for looping sequences. **Callbacks**: `onStepBegin` / `onStepComplete` / `onSequenceComplete` / `onSequenceStopped` / `onSequencePaused` / `onSequenceResumed`. **Queries**: `isPlaying(id)` (true while playing or paused), `isPaused(id)`, `getPlayheadStep(id)` (current step index or null), `playingSequences` (all active states). **Save persistence**: `getSnapshot()` / `restoreSnapshot(state)` serialise all active playback states; sequences no longer registered at restore time are silently skipped; callbacks are suppressed on restore.

2. ✅ **Dialogue-Camera Integration** (`src/systems/dialogue-creator-system.ts` + `src/framework/dialogue/dialogue-types.ts`, 9 new tests) — per-node camera sequence linking threading through the full authoring-to-runtime pipeline: `DialogueNode` and `DialogueNodeView` gain an optional `cameraSequenceId` field; `DialogueSession._toNodeView()` forwards the field so game code can read `node.cameraSequenceId` from `getCurrentNode()` and trigger the matching sequence via `CameraScriptingSystem`; `DialogueNodeDraft` carries `cameraSequenceId`; `DialogueCreatorSystem.addNode()` accepts it in its partial parameter; `updateNode()` handles it alongside existing fields; new `updateNodeCamera(nodeId, sequenceId | null)` convenience method sets or clears the linked sequence (empty string and `null` both clear it, returning `false` for unknown nodes); `toDefinition()` includes the field when set; `exportToJson()` / `importFromJson()` round-trip it correctly.

---

## Mid-Term (3–5 Releases)

### World Building Depth

- ✅ Add additional biome-specific encounter tables — `BiomeSystem` (see Release J above).
- ✅ Introduce landmark-driven exploration rewards — `LandmarkSystem` (see Release J above).
- ✅ Add environmental storytelling props and ambient events — `AmbientEventSystem` (see Release K above).
- ✅ Dynamic random encounter scheduling — `EncounterSystem` (see Release K above).
- ✅ Material-based item crafting (smithing/forging) — `CraftingSystem` (see Release L above).
- ✅ Random events during fast travel with biome/weather/flag conditions — `TravelEventSystem` (see Release L above).
- ✅ Authored named weather sequences with timed transitions and loop support — `WeatherScheduleSystem` (see Release M above).
- ✅ Player journal with categories, tags, full-text search, and favorites — `JournalSystem` (see Release M above).

### Systems Expansion

- ✅ Alchemy/potion crafting prototype (AlchemySystem + AlchemyUI).
- ✅ Enchanting system (apply magical effects to weapons and armor) — soul gems, 10 enchantment types, skill scaling.
- ✅ Faction/reputation prototype tied to quests (FactionEngine + PersuasionSystem).
- ✅ More advanced quest scripting hooks — `EventScriptSystem` (see Release H below).

### Performance + Scalability

- ✅ **LodSystem** — Multi-level LOD with `registerLevels()`: supports high/medium/low detail mesh swapping based on player distance; previous binary visible/hidden culling preserved via `register()`; `update()` culled-count includes level-group hidden meshes; disposed-mesh pruning handles level groups; `unregisterLevels()` / `clear()` restore all LOD mesh visibilities.
- ✅ **ObjectPool\<T\>** — Generic reusable object pool eliminating GC-pressure allocation spikes for frequently created/destroyed game objects (loot meshes, projectiles, hit particles); `acquire()` / `release()` / `prewarm()` / `clear()`; `size` / `totalAllocated` accessors for profiling; configurable `maxSize` overflow disposal.
- ✅ **Chunk streaming + queue-entry pooling** — `WorldManager` now prunes stale queued chunks immediately when the player crosses chunk boundaries, keeps remaining work distance-sorted, and reuses pooled `LoadQueueEntry` objects via `ObjectPool` to avoid repeated queue-allocation churn during rapid travel and teleports; debug accessors surface queue-pool size and total queue-entry allocations for profiling.
- ✅ **WorldManager chunk callbacks + public `chunkSize`** — `WorldManager.chunkSize` is now a `public readonly` property (11 new tests); `onChunkLoaded(cx, cz, biome)` fires after every chunk finishes building so external systems react to terrain changes without polling; `onChunkUnloaded(cx, cz)` fires on distance-based removal (not during `dispose()`); `game.ts` nav-chunk tracking updated to use `world.chunkSize` instead of the hardcoded magic number 50.
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
- ✅ Layer-based editing (terrain, encounters, narrative, lighting) — completed with entity layer reassignment in the property inspector, persistent custom layer assignments through map export/import, and active layer targeting from the layer panel so new placements can be routed directly into the chosen layer while inheriting its visibility/lock state.
- ✅ Optional standalone editor shell for non-programmer content creators.

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

---

## Next Steps

### Gameplay Depth — Release U (Disease System) ✅

Disease system delivered:

1. ✅ **DiseaseSystem** (`src/systems/disease-system.ts`, 48 tests) — Oblivion-style disease contraction and cure: seven built-in diseases — Rust Chancre (Endurance −5), Swamp Rot (Willpower −5), Witbane (Intelligence −5), Collywobbles (Strength −5), Brain Rot (Intelligence −10), Yellow Tick (Agility −5), Porphyric Hemophilia (Willpower −2, Endurance −2); `contractDisease(id, rng?)` rolls against `diseaseResistanceChance` [0, 1] before infecting the player (Argonian racial immunity sets resistance to 1.0); `cureDisease(id)` / `cureAllDiseases()` for Cure Disease potions and shrine blessings; `hasDisease(id)` / `getActiveDiseases()` query helpers; `getAttributePenalties()` returns a merged per-attribute debuff map aggregated across all active diseases for direct integration with `AttributeSystem`; `registerDisease(def)` allows mod-defined diseases; `onDiseaseContracted` / `onDiseaseCured` HUD notification callbacks; 5 % per-hit disease exposure chance wired to `CombatSystem.onPlayerHit`; race-switch callback syncs Argonian immunity dynamically; save-state persistence (SAVE_VERSION 21).

### NPC Overhaul ✅

Comprehensive expansion of the NPC authoring and spawn pipeline:

- ✅ **New types** — `NpcVoiceType` (9 values: neutral, male_warrior, female_warrior, old_man, old_woman, merchant, child, beast, undead), `NpcPersonalityTrait` (8 values: brave, cowardly, aggressive, friendly, shy, greedy, noble, cunning), `NpcAIProfile` (aggroRange, attackRange, attackDamage, attackCooldown, moveSpeed, fleesBelowHealthPct) added to `content-types.ts`.
- ✅ **New NPC roles** — `NpcRole` expanded with `bandit`, `healer`, `trainer`, `beggar`; `NpcArchetypeSystem` applies role-specific combat tuning for each.
- ✅ **`NpcArchetypeDefinition` expanded** — new optional fields: `voiceType`, `personalityTraits`, `aiProfile` (per-archetype combat AI overrides that supersede role defaults), `scheduleId` (link to `DailyScheduleSystem`), `startingEquipment` (item ID list for inventory integration).
- ✅ **`NpcCreatorSystem` expanded** — `addPersonalityTrait()` / `removePersonalityTrait()` / `clearPersonalityTraits()`; `setAIProfileField()` / `removeAIProfileField()` / `clearAIProfile()`; `addStartingEquipment()` / `removeStartingEquipment()` / `clearStartingEquipment()`; `setMeta` handles `voiceType` and `scheduleId`; `validate()` checks AI profile value ranges; `toDefinition()` / `importFromJson()` / `reset()` all handle new fields; exported constants `NPC_VOICE_TYPES` and `NPC_PERSONALITY_TRAITS`.
- ✅ **`NpcArchetypeSystem.spawnNpc()` expanded** — applies `aiProfile` overrides after role-based defaults; copies `voiceType`, `personalityTraits`, and `startingEquipmentIds` onto the spawned NPC entity.
- ✅ **`NPC` entity expanded** — `voiceType`, `personalityTraits`, `fleesBelowHealthPct`, `startingEquipmentIds` fields added.
- ✅ **`NpcCreatorUI` expanded** — voice type select, personality trait checkboxes, `scheduleId` field, per-field AI profile overrides (with Set/Clear), starting equipment add/remove list.
- ✅ **Test coverage** — `npc-creator-system.test.ts` expanded to 50 tests; `npc-archetype-system.test.ts` expanded to 19 tests.

---

### Gameplay Depth — Release V (Event Manager System) ✅

Event Manager (Dungeon Master) system delivered:

1. ✅ **EventManagerSystem** (`src/systems/event-manager-system.ts`, 64 tests) — Headless Dungeon Master that owns, schedules, and fires managed world events. **Personal options** (`DMPersonality`): `difficulty` ("easy" | "normal" | "hard" | "legendary"), `eventFrequency` [0, 1] (stochastic fire rate), `aggressiveness` [0, 1], `narrativeTone` ("heroic" | "grim" | "balanced"), `enableAmbushes`, `enableRandomEncounters`, `enableWeatherEvents`, `enableNPCInteractions`; all options merged via `configure(Partial<DMPersonality>)` with numeric clamping. **Event registration**: `registerEvent(def)` / `unregisterEvent(id)` / `getDefinition(id)` / `getAllDefinitions()`; definitions carry `category`, `weight`, optional `cooldownMs`, `oneShot`, and `minDifficulty` gates. **Scheduling**: `scheduleEvent(id, delayMs, context?)` / `queueEvent(id, context?)` (zero-delay alias) / `cancelScheduled(id)` / `getScheduledEvents()`; injected clock (`_now`) enables deterministic testing. **Dispatch**: `tick(rng?)` dequeues all due entries and fires eligible events subject to category toggles, difficulty rank, one-shot guards, cooldown windows, and the stochastic frequency gate; `triggerEvent(id, context?, rng?)` for immediate manual dispatch; `resolveEvent(id)` to explicitly close active events. **Weighted roll**: `rollEvent(rng?, context?)` performs weighted-random selection across eligible definitions then applies the frequency gate. **Queries**: `wasEventFired(id)`, `getLastFiredAt(id)`, `getEventLog()`, `totalFired`, `clearLog()`. **Callbacks**: `onEventTriggered` / `onEventResolved`. **Save-state persistence** (SAVE_VERSION 22): `getSaveState()` / `restoreFromSave()` round-trip personality, event log (used to rebuild cooldown state and one-shot guards on load), and the pending scheduled-event queue.

---

### Gameplay Depth — Release W (Pet / Companion System) ✅

Pet companion system delivered:

1. ✅ **PetSystem** (`src/systems/pet-system.ts`, 62 tests) — Oblivion-inspired pet companion management: three built-in species — Wolf (high health, strong attacker), Cat (agile, quick), Raven (fragile flier, long attack range); `registerTemplate(def)` for mod-defined species; `grantPet(templateId, overrideName?)` awards ownership (returns `null` if already owned or unknown); `summonPet(id)` / `dismissPet()` manage the single active companion (auto-dismisses current when switching); `petTakeDamage(amount)` / `petHeal(amount)` route health changes with `onPetHealthChanged` callback; `petGainXP(xp)` drives level-ups — threshold `XP_PER_LEVEL × currentLevel`, health and damage scale per-level, full heal on level-up, `onPetLevelUp` callback fires; `getEffectiveAttackDamage()` applies mood factor (0.8–1.2×); `updateMood(dt)` decays mood while summoned (0.5/s) and recovers while dismissed (1.0/s); `onPetAcquired` / `onPetSummoned` / `onPetDismissed` / `onPetDied` HUD notification callbacks; save-state persistence (SAVE_VERSION 23) — `getSaveState()` / `restoreFromSave()` serialise all owned pets with level-replayed stat scaling on restore.

2. ✅ **PetUI** (`src/ui/pet-ui.ts`, 41 tests) — HUD widget and companion management panel: compact HUD strip (bottom-right, `pointerEvents: none`) showing species icon, name, health bar with HP text, and level — hidden when no pet is active; full management panel (`[P]` key) lists all owned pets with species icon, name, level, species · level sub-label, HP/XP progress bars, stat grid (HP, ATK, SPD, MOOD), and per-pet Summon / Dismiss action button; active pet receives an `ACTIVE` badge; deceased pets display `(deceased)` and suppress the action button; Summon fires `onSummon(petId)`, Dismiss fires `onDismiss()`; close button fires `onClose()`; fully accessible — root carries `role="dialog"` / `aria-modal="true"` / `aria-labelledby="pet-panel-title"`, all action buttons carry descriptive `aria-label` attributes; mood is colour-coded and labelled (Happy / Content / Neutral / Uneasy / Unhappy).
