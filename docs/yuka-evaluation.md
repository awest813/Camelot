# Yuka Evaluation — NPC Steering & Game AI

This document evaluates [Yuka](https://github.com/Mugen87/yuka), a JavaScript
game AI library, for potential integration into Camelot's NPC movement and
decision-making stack.

---

## What Is Yuka?

Yuka is a headless, engine-agnostic JavaScript library for game AI.  It
provides:

- **Steering behaviors** — Seek, flee, arrive, wander, pursuit, evade,
  follow path, obstacle avoidance, separation, alignment, cohesion, and
  interpose.
- **Navigation mesh pathfinding** — Built-in NavMesh support with spatial
  indexing and path smoothing (corridor funnel algorithm).
- **State machines** — Finite state machines for NPC decision-making.
- **Goal-driven agent architecture** — Goal evaluators and composite goals
  for hierarchical NPC planning.
- **Fuzzy logic** — Fuzzy sets, rules, and inference for soft
  decision-making (e.g. threat assessment).
- **Triggers & regions** — Spatial triggers and rectangular/spherical
  regions for event firing.
- **Graph & search** — Graph data structures with Dijkstra and A* search
  (used internally by NavMesh, but available for custom use).

Yuka's entire API is pure math — no DOM, no WebGL, no engine dependency.
It operates on its own `Vector3` / `Quaternion` / `Matrix4` types, but
these are trivially mapped to Babylon.js equivalents.

---

## Current Camelot AI Stack

| Layer | Tool | Role |
|-------|------|------|
| Pathfinding | `recast-detour` + BabylonJS `RecastJSPlugin` | NavMesh build + path queries (`NavigationSystem`) |
| Behavior trees | `mistreevous` | NPC decision-making trees (`NpcBehaviorTreeSystem`) |
| State machines | `xstate` | Formalised NPC AI states (`NpcAIStateMachine`) |
| Combat AI | Custom | Distance bands, cooldowns, threat handoff (`CombatSystem`) |
| Schedules | Custom | Daily schedule blocks (`NpcScheduleSystem`, `DailyScheduleSystem`) |
| Offscreen | Custom | NPC state while unloaded (`OffscreenSimulationSystem`) |

### What Is Missing?

1. **Steering behaviors** — NPCs currently move in straight lines toward
   navmesh waypoints.  There is no obstacle avoidance, separation,
   flocking, or smooth arrival.  Combat NPCs strafe, but it is bespoke
   logic in `CombatSystem`.
2. **Group coordination** — Patrol groups and follower NPCs lack formation
   movement, alignment, or cohesion.
3. **Smooth path following** — `NavigationSystem.findPath()` returns raw
   waypoints; NPCs snap between them with no interpolation or corridor
   smoothing.

---

## Yuka Relevance Assessment

### High Value — Steering Behaviors

Yuka's steering layer directly fills the gap between navmesh waypoints and
frame-by-frame NPC movement.  Specific behaviors and their Camelot use cases:

| Behavior | Use Case |
|----------|----------|
| `FollowPathBehavior` | Smooth NPC movement along navmesh waypoint lists |
| `ArriveBehavior` | NPCs decelerate gracefully at patrol/interaction targets |
| `SeekBehavior` | Hostile NPC chase toward the player |
| `FleeBehavior` | Cowardly NPCs / low-health flee logic |
| `WanderBehavior` | Idle NPC ambient movement (villagers, animals) |
| `PursuitBehavior` | Predictive chase for ranged/archer NPCs |
| `EvadeBehavior` | Dodge/evasion for thief/rogue NPCs |
| `ObstacleAvoidanceBehavior` | Avoid props/walls not captured by the navmesh |
| `SeparationBehavior` | Prevent NPCs from stacking on the same point |
| `AlignmentBehavior` + `CohesionBehavior` | Patrol group flocking |

### Medium Value — NavMesh

Yuka includes its own NavMesh implementation with:
- Convex region decomposition
- Spatial indexing for fast point-in-region queries
- Corridor funnel algorithm for path smoothing

However, Camelot already uses `recast-detour` via BabylonJS's
`RecastJSPlugin`, which is a more battle-tested and performant
implementation.  **Recommendation:** keep Recast/Detour for navmesh
building and path computation; use Yuka only for the steering layer that
consumes those paths.

### Low Value — State Machines & Goals

Yuka's FSM and goal system overlap with `xstate` (more powerful FSMs) and
`mistreevous` (behavior trees, which subsume both FSMs and goals in
expressiveness).  **Recommendation:** do not adopt Yuka's FSM/goal modules.

### Low Value — Fuzzy Logic

Interesting for future threat assessment or NPC personality modeling, but
not immediately needed.  Can be revisited when NPC personality traits
(`NpcPersonalityTrait`) need richer decision-making.

---

## Integration Architecture

If adopted, Yuka should be integrated as a **steering adapter** that sits
between the navmesh path output and the physics/movement input:

```
NavigationSystem.findPath(from, to)
        │  Vector3[] waypoints
        ▼
┌─────────────────────────┐
│  YukaSteeringAdapter    │   ← NEW
│  - FollowPathBehavior   │
│  - SeparationBehavior   │
│  - ObstacleAvoidance    │
└─────────────────────────┘
        │  desired velocity (Vector3)
        ▼
BabylonCharacterControllerAdapter
        │  position update
        ▼
    Physics / Scene
```

### Adapter Sketch

```ts
// src/adapters/yuka-steering-adapter.ts  (conceptual — not yet implemented)

import { Vehicle, FollowPathBehavior, SeparationBehavior } from "yuka";

export class YukaSteeringAdapter {
  private _vehicles: Map<string, Vehicle> = new Map();

  registerNpc(npcId: string, position: { x: number; y: number; z: number }): void;
  setPath(npcId: string, waypoints: Array<{ x: number; y: number; z: number }>): void;
  update(deltaTime: number): Map<string, { x: number; y: number; z: number }>;
  unregisterNpc(npcId: string): void;
}
```

### Vector Conversion

Yuka uses its own `Vector3`.  A thin converter is needed:

```ts
function toBabylon(v: YukaVector3): BabylonVector3 {
  return new BabylonVector3(v.x, v.y, v.z);
}
function toYuka(v: BabylonVector3): YukaVector3 {
  return new YukaVector3(v.x, v.y, v.z);
}
```

---

## Dependency Analysis

| Metric | Value |
|--------|-------|
| npm package | `yuka` |
| Latest version | 0.7.8 (stable) |
| License | MIT |
| Bundle size | ~65 KB minified |
| Dependencies | 0 (pure JS, no dependencies) |
| TypeScript | Ships with `.d.ts` type declarations |
| Tree-shakeable | Yes (ESM exports) |

Yuka is lightweight, has zero dependencies, and is tree-shakeable — it
would add minimal bundle weight if only the steering module is imported.

---

## Risks & Considerations

1. **Coordinate mapping** — Yuka uses its own math types.  Conversion
   overhead is negligible per-frame for dozens of NPCs, but should be
   profiled if NPC counts reach hundreds.
2. **Maintenance** — Yuka's last release (0.7.8) is from 2022.  The API is
   stable and feature-complete, but active development has slowed.
3. **Overlap** — Yuka's FSM and NavMesh modules overlap with existing
   tools.  Discipline is needed to use **only** the steering layer.
4. **Testing** — Steering behaviors are inherently visual and hard to
   unit-test precisely.  Integration tests should verify that NPCs reach
   destinations within reasonable time and distance tolerances.

---

## Recommendation

**Adopt Yuka selectively** for its steering behavior module only:

1. Add `yuka` as an **optional** dependency (like `recast-detour`).
2. Create `YukaSteeringAdapter` in `src/adapters/` as a thin bridge.
3. Wire `FollowPathBehavior` + `SeparationBehavior` into NPC movement.
4. Keep `recast-detour` for navmesh, `mistreevous` for behavior trees,
   and `xstate` for state machines.

This fills the steering gap without duplicating existing capabilities.

---

## References

- Yuka repository: https://github.com/Mugen87/yuka
- Yuka documentation: https://mugen87.github.io/yuka/
- Dive (Yuka shooter demo): https://github.com/Mugen87/dive
- Existing `NavigationSystem`: `src/systems/navigation-system.ts`
- Existing `NpcBehaviorTreeSystem`: `src/systems/npc-behavior-tree.ts`
- Existing `NpcAIStateMachine`: `src/systems/npc-ai-state-machine.ts`
