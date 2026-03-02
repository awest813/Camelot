# Framework Architecture

Camelot now separates RPG domain logic from rendering/runtime concerns.

## Layers

1. **Framework Core (`src/framework/*`)**
   - Pure TypeScript domain engines.
   - No Babylon.js dependencies.
   - Suitable for tests, tooling, and alternate runtimes.

2. **Runtime Adapter (`src/framework/runtime/framework-runtime.ts`)**
   - Wires content registry + dialogue + quests + inventory + factions + save modules.
   - Provides shared dialogue context and event translation.

3. **Demo Game Client (`src/game.ts`, `src/systems/*`)**
   - Babylon-specific rendering, physics, controls, and UI.
   - Can consume framework state while retaining game-specific behavior.

## Core Modules

## Dialogue Engine
- Node/choice graph traversal.
- Condition evaluation:
  - flags
  - faction minimum reputation
  - quest status
  - inventory quantity
- Effect execution:
  - set flag
  - faction delta
  - emitted events

## Quest Graph Engine
- Quest node dependency model (`prerequisites` / `nextNodeIds`).
- Trigger ingestion (`kill`, `pickup`, `talk`, `custom`).
- Emits activation/completion updates and XP reward payloads.

## Inventory Engine
- Item registry-based validation.
- Stack and capacity policies.
- Equip/unequip intent resolution independent of UI.

## Faction Engine
- Per-faction reputation tracking.
- Disposition mapping: hostile / neutral / friendly / allied.

## Save Engine
- Envelope with explicit `schemaVersion`.
- Migrations map-based transformer pipeline.
- Storage adapter abstraction.

## Mod Loader
- Manifest-based discovery for browser compatibility.
- Content merge with deterministic override order.
- Collision reporting for mod conflicts.

## Data Flow (high level)

1. Content bundle(s) loaded into registry.
2. Runtime builds engines from registry state.
3. Dialogue effects emit quest events + faction deltas.
4. Quest and inventory/faction state produce save snapshot.
5. Save engine serializes snapshot with current schema version.

## Immediate Extension Points

- Add richer dialogue conditions/effects (skill checks, random branches).
- Add quest graph validation diagnostics and authoring tools.
- Add mod schema validator + manifest generation script.
