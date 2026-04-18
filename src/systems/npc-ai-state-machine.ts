/**
 * NpcAIStateMachine — xstate-based formalization of the NPC AI state graph.
 *
 * Converts the hand-written `AIState` enum + transition logic (documented in
 * `npc.ts` and implemented in `combat-system.ts`) into an explicit xstate
 * machine.  This enables:
 *
 *  - Visualization of the state graph (xstate visualizer).
 *  - Type-safe events and guards.
 *  - Snapshot/restore for save-state integration.
 *  - Cleaner addition of new states without growing the switch/case.
 *
 * The machine does **not** execute side-effects (movement, damage, colour
 * changes).  It is a pure state container.  The host game loop should:
 *
 *  1. Send events based on perception (PLAYER_IN_RANGE, ALERT_EXPIRED, etc.).
 *  2. Read the current state value.
 *  3. Map the state value to the appropriate game behavior.
 *
 * Usage:
 * ```ts
 * const machine = createNpcAIMachine();
 * const actor = createActor(machine).start();
 * actor.send({ type: "PLAYER_IN_RANGE" });
 * actor.getSnapshot().value; // "alert"
 * actor.send({ type: "ALERT_EXPIRED" });
 * actor.getSnapshot().value; // "chase"
 * ```
 */

import { setup, createActor, type ActorRefFrom } from "xstate";

// ── Event types ─────────────────────────────────────────────────────────────

/** Events that the NPC AI state machine accepts. */
export type NpcAIEvent =
  | { type: "PLAYER_IN_RANGE" }
  | { type: "PLAYER_OUT_OF_RANGE" }
  | { type: "PLAYER_ESCAPED" }
  | { type: "ALERT_EXPIRED" }
  | { type: "REACHED_ATTACK_RANGE" }
  | { type: "LEFT_ATTACK_RANGE" }
  | { type: "LOST_RESERVATION" }
  | { type: "REACHED_SPAWN" }
  | { type: "REACHED_LAST_KNOWN_POS" }
  | { type: "INVESTIGATE_EXPIRED" }
  | { type: "HEALTH_LOW" }
  | { type: "FLED_TO_SAFETY" }
  | { type: "HAS_PATROL_POINTS" }
  | { type: "DIED" }
  | { type: "REVIVE" };

// ── State values ────────────────────────────────────────────────────────────

/**
 * All possible state values of the NPC AI machine.
 * These mirror `AIState` in `npc.ts` but are lowercase for xstate convention.
 */
export type NpcAIStateValue =
  | "idle"
  | "patrol"
  | "alert"
  | "chase"
  | "attack"
  | "return"
  | "investigate"
  | "flee"
  | "dead";

// ── Machine definition ──────────────────────────────────────────────────────

/**
 * Creates the NPC AI xstate machine.
 *
 * Transition graph (matching the JSDoc in `npc.ts`):
 *
 *   idle        → patrol      (HAS_PATROL_POINTS)
 *   idle        → alert       (PLAYER_IN_RANGE)
 *   patrol      → alert       (PLAYER_IN_RANGE)
 *   alert       → chase       (ALERT_EXPIRED)
 *   alert       → investigate (PLAYER_ESCAPED, with lastKnownPos)
 *   alert       → idle/patrol (PLAYER_OUT_OF_RANGE, no lastKnownPos)
 *   investigate → alert       (PLAYER_IN_RANGE)
 *   investigate → return/idle  (REACHED_LAST_KNOWN_POS | INVESTIGATE_EXPIRED)
 *   chase       → attack      (REACHED_ATTACK_RANGE)
 *   chase       → return      (PLAYER_OUT_OF_RANGE)
 *   attack      → chase       (LEFT_ATTACK_RANGE | LOST_RESERVATION)
 *   attack      → return      (PLAYER_OUT_OF_RANGE)
 *   return      → alert       (PLAYER_IN_RANGE)
 *   return      → patrol      (REACHED_SPAWN)
 *   chase/attack → flee       (HEALTH_LOW)
 *   flee        → return/idle  (FLED_TO_SAFETY)
 *   any         → dead        (DIED)
 *   dead        → idle        (REVIVE)
 */
export const npcAIMachine = setup({
  types: {
    events: {} as NpcAIEvent,
    context: {} as Record<string, never>,
  },
}).createMachine({
  id: "npcAI",
  context: {},
  initial: "idle",
  states: {
    idle: {
      on: {
        PLAYER_IN_RANGE: { target: "alert" },
        HAS_PATROL_POINTS: { target: "patrol" },
        DIED: { target: "dead" },
      },
    },
    patrol: {
      on: {
        PLAYER_IN_RANGE: { target: "alert" },
        DIED: { target: "dead" },
      },
    },
    alert: {
      on: {
        ALERT_EXPIRED: { target: "chase" },
        PLAYER_ESCAPED: { target: "investigate" },
        PLAYER_OUT_OF_RANGE: { target: "idle" },
        DIED: { target: "dead" },
      },
    },
    investigate: {
      on: {
        PLAYER_IN_RANGE: { target: "alert" },
        REACHED_LAST_KNOWN_POS: { target: "idle" },
        INVESTIGATE_EXPIRED: { target: "idle" },
        DIED: { target: "dead" },
      },
    },
    chase: {
      on: {
        REACHED_ATTACK_RANGE: { target: "attack" },
        PLAYER_OUT_OF_RANGE: { target: "return" },
        HEALTH_LOW: { target: "flee" },
        DIED: { target: "dead" },
      },
    },
    attack: {
      on: {
        LEFT_ATTACK_RANGE: { target: "chase" },
        LOST_RESERVATION: { target: "chase" },
        PLAYER_OUT_OF_RANGE: { target: "return" },
        HEALTH_LOW: { target: "flee" },
        DIED: { target: "dead" },
      },
    },
    return: {
      on: {
        PLAYER_IN_RANGE: { target: "alert" },
        REACHED_SPAWN: { target: "patrol" },
        DIED: { target: "dead" },
      },
    },
    flee: {
      on: {
        FLED_TO_SAFETY: { target: "idle" },
        DIED: { target: "dead" },
      },
    },
    dead: {
      on: {
        REVIVE: { target: "idle" },
      },
    },
  },
});

// ── Convenience helpers ─────────────────────────────────────────────────────

/** Shorthand type for an actor running the NPC AI machine. */
export type NpcAIActor = ActorRefFrom<typeof npcAIMachine>;

/**
 * Create and start a new NPC AI actor.
 * Returns a running actor whose state can be read via `actor.getSnapshot().value`.
 */
export function createNpcAIActor(): NpcAIActor {
  const actor = createActor(npcAIMachine);
  actor.start();
  return actor;
}

/**
 * Read the current state value from an NPC AI actor.
 */
export function getNpcAIState(actor: NpcAIActor): NpcAIStateValue {
  return actor.getSnapshot().value as NpcAIStateValue;
}

/**
 * Map an NPC AI state value back to the legacy `AIState` string for
 * interop with existing systems (ScheduleSystem, CombatSystem, etc.).
 */
export function toAIStateString(value: NpcAIStateValue): string {
  return value.toUpperCase();
}

/**
 * Determine whether a state value represents an aggressive/combat state.
 * Matches the `isAggressive` logic from NPC entity.
 */
export function isAggressiveState(value: NpcAIStateValue): boolean {
  return (
    value === "alert" ||
    value === "chase" ||
    value === "attack" ||
    value === "return" ||
    value === "investigate" ||
    value === "flee"
  );
}
