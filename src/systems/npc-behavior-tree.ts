/**
 * NpcBehaviorTree — behaviour-tree wrapper for NPC AI using mistreevous.
 *
 * Provides an alternative, composable way to express NPC decision-making as a
 * behaviour tree rather than the flat switch/case state machine in CombatSystem.
 * Each NPC can be assigned a behaviour tree that is stepped every frame.  The
 * tree queries the NPC's perception context (distance to player, health, patrol
 * points, etc.) and selects the appropriate leaf action.
 *
 * The module exports two main pieces:
 *
 *  1. `NpcBehaviorTreeAgent` — the agent interface that bridges mistreevous
 *     actions/conditions to NPC game state.
 *
 *  2. `NpcBehaviorTreeSystem` — a lightweight manager that creates, stores, and
 *     steps a behaviour tree per NPC.
 *
 * Usage:
 * ```ts
 * const btSystem = new NpcBehaviorTreeSystem();
 * btSystem.register(npc, { distToPlayer: 0, aggroRange: 12 });
 * // Each frame:
 * btSystem.step(npc, { distToPlayer: 5.0, aggroRange: 12, ... });
 * const action = btSystem.getActiveAction(npc); // e.g. "chase"
 * ```
 */

import { BehaviourTree, State } from "mistreevous";

// ── Context ─────────────────────────────────────────────────────────────────

/** Perception snapshot fed into the behaviour tree each tick. */
export interface NpcPerceptionContext {
  /** Squared distance from NPC to the player. */
  distToPlayerSq: number;
  /** NPC aggro range. */
  aggroRange: number;
  /** NPC attack range. */
  attackRange: number;
  /** Current health fraction [0, 1]. */
  healthFraction: number;
  /** Flee threshold [0, 1].  0 = never flee. */
  fleeBelowHealthPct: number;
  /** Whether the NPC has patrol points assigned. */
  hasPatrolPoints: boolean;
  /** Whether the NPC has a last-known-player position. */
  hasLastKnownPos: boolean;
  /** Seconds the NPC has been in the ALERT state. */
  alertTimer: number;
  /** Duration of the alert phase (seconds). */
  alertDuration: number;
  /** Seconds the NPC has been in INVESTIGATE state. */
  investigateTimer: number;
  /** Duration cap for investigation (seconds). */
  investigateDuration: number;
  /** Whether the NPC has reached the last known player position. */
  reachedLastKnownPos: boolean;
  /** Whether the NPC has an attack reservation. */
  hasAttackReservation: boolean;
  /** Whether the NPC is dead. */
  isDead: boolean;
}

// ── Action identifiers ──────────────────────────────────────────────────────

/**
 * The leaf action that the behaviour tree has selected this tick.
 * Consumed by the host game loop to drive movement, animations, etc.
 */
export type NpcAction =
  | "idle"
  | "patrol"
  | "alert"
  | "investigate"
  | "chase"
  | "attack"
  | "return"
  | "flee"
  | "none";

// ── MDSL tree definition ────────────────────────────────────────────────────

/**
 * Default NPC combat behaviour tree expressed in mistreevous MDSL.
 *
 * Decision priority (selector picks first succeeding child):
 *   1. Dead?                        → idle (no-op)
 *   2. Health below flee threshold? → flee
 *   3. Player in aggro range?       → engage subtree
 *   4. Has last-known position?     → investigate subtree
 *   5. Has patrol points?           → patrol
 *   6. Fallback                     → idle
 *
 * The engage subtree itself is a selector:
 *   a. Already alerted long enough → chase/attack
 *   b. Otherwise                   → alert (wait)
 */
export const DEFAULT_NPC_BEHAVIOR_TREE_MDSL = `root {
  selector {
    sequence {
      condition [IsDead]
      action [DoIdle]
    }
    sequence {
      condition [ShouldFlee]
      action [DoFlee]
    }
    sequence {
      condition [PlayerInAggroRange]
      selector {
        sequence {
          condition [AlertExpired]
          selector {
            sequence {
              condition [PlayerInAttackRange]
              condition [HasAttackReservation]
              action [DoAttack]
            }
            action [DoChase]
          }
        }
        action [DoAlert]
      }
    }
    sequence {
      condition [PlayerOutOfRange]
      condition [HasLastKnownPos]
      selector {
        sequence {
          condition [InvestigateNotExpired]
          action [DoInvestigate]
        }
        sequence {
          condition [HasPatrolPoints]
          action [DoReturn]
        }
        action [DoIdle]
      }
    }
    sequence {
      condition [HasPatrolPoints]
      action [DoPatrol]
    }
    action [DoIdle]
  }
}`;

// ── Agent factory ───────────────────────────────────────────────────────────

/**
 * Creates a mistreevous Agent object bound to the given perception context.
 * The context reference is stable — the caller mutates its fields before each
 * `step()` call so conditions read fresh data.
 */
export function createNpcAgent(ctx: NpcPerceptionContext): NpcBehaviorTreeAgent {
  const aggroRangeSq = () => ctx.aggroRange * ctx.aggroRange;
  const deaggroRangeSq = () => 4 * aggroRangeSq();

  return {
    _ctx: ctx,
    _lastAction: "none" as NpcAction,

    // ── Conditions ────────────────────────────────────────────────────────
    IsDead() {
      return ctx.isDead;
    },
    ShouldFlee() {
      return (
        ctx.fleeBelowHealthPct > 0 &&
        !ctx.isDead &&
        ctx.healthFraction < ctx.fleeBelowHealthPct
      );
    },
    PlayerInAggroRange() {
      return ctx.distToPlayerSq <= aggroRangeSq();
    },
    PlayerOutOfRange() {
      return ctx.distToPlayerSq > aggroRangeSq();
    },
    AlertExpired() {
      return ctx.alertTimer >= ctx.alertDuration;
    },
    PlayerInAttackRange() {
      return ctx.distToPlayerSq <= ctx.attackRange * ctx.attackRange;
    },
    HasAttackReservation() {
      return ctx.hasAttackReservation;
    },
    HasLastKnownPos() {
      return ctx.hasLastKnownPos;
    },
    InvestigateNotExpired() {
      return (
        ctx.investigateTimer < ctx.investigateDuration && !ctx.reachedLastKnownPos
      );
    },
    HasPatrolPoints() {
      return ctx.hasPatrolPoints;
    },

    // ── Actions ───────────────────────────────────────────────────────────
    DoIdle() {
      (this as NpcBehaviorTreeAgent)._lastAction = "idle";
      return State.SUCCEEDED;
    },
    DoPatrol() {
      (this as NpcBehaviorTreeAgent)._lastAction = "patrol";
      return State.SUCCEEDED;
    },
    DoAlert() {
      (this as NpcBehaviorTreeAgent)._lastAction = "alert";
      return State.SUCCEEDED;
    },
    DoInvestigate() {
      (this as NpcBehaviorTreeAgent)._lastAction = "investigate";
      return State.SUCCEEDED;
    },
    DoChase() {
      (this as NpcBehaviorTreeAgent)._lastAction = "chase";
      return State.SUCCEEDED;
    },
    DoAttack() {
      (this as NpcBehaviorTreeAgent)._lastAction = "attack";
      return State.SUCCEEDED;
    },
    DoReturn() {
      (this as NpcBehaviorTreeAgent)._lastAction = "return";
      return State.SUCCEEDED;
    },
    DoFlee() {
      (this as NpcBehaviorTreeAgent)._lastAction = "flee";
      return State.SUCCEEDED;
    },
  };
}

/** The agent shape created by `createNpcAgent`. */
export interface NpcBehaviorTreeAgent {
  _ctx: NpcPerceptionContext;
  _lastAction: NpcAction;

  // Conditions
  IsDead: () => boolean;
  ShouldFlee: () => boolean;
  PlayerInAggroRange: () => boolean;
  PlayerOutOfRange: () => boolean;
  AlertExpired: () => boolean;
  PlayerInAttackRange: () => boolean;
  HasAttackReservation: () => boolean;
  HasLastKnownPos: () => boolean;
  InvestigateNotExpired: () => boolean;
  HasPatrolPoints: () => boolean;

  // Actions
  DoIdle: () => string;
  DoPatrol: () => string;
  DoAlert: () => string;
  DoInvestigate: () => string;
  DoChase: () => string;
  DoAttack: () => string;
  DoReturn: () => string;
  DoFlee: () => string;

  [key: string]: unknown;
}

// ── System ──────────────────────────────────────────────────────────────────

interface NpcBTEntry {
  tree: BehaviourTree;
  agent: NpcBehaviorTreeAgent;
  ctx: NpcPerceptionContext;
}

/**
 * Manages one behaviour tree per NPC.
 *
 * The host game loop should:
 *  1. Call `register(npcId)` when spawning an NPC.
 *  2. Call `step(npcId, perception)` each frame.
 *  3. Read `getActiveAction(npcId)` to know what the NPC should do.
 *  4. Call `unregister(npcId)` when the NPC is removed from the world.
 */
export class NpcBehaviorTreeSystem {
  private _entries: Map<string, NpcBTEntry> = new Map();
  private _treeDef: string;

  constructor(treeDef: string = DEFAULT_NPC_BEHAVIOR_TREE_MDSL) {
    this._treeDef = treeDef;
  }

  /** Register a new NPC with its own behaviour tree instance. */
  public register(npcId: string): void {
    if (this._entries.has(npcId)) return;

    const ctx: NpcPerceptionContext = {
      distToPlayerSq: Infinity,
      aggroRange: 12,
      attackRange: 2.5,
      healthFraction: 1,
      fleeBelowHealthPct: 0,
      hasPatrolPoints: false,
      hasLastKnownPos: false,
      alertTimer: 0,
      alertDuration: 1.5,
      investigateTimer: 0,
      investigateDuration: 5,
      reachedLastKnownPos: false,
      hasAttackReservation: false,
      isDead: false,
    };

    const agent = createNpcAgent(ctx);
    const tree = new BehaviourTree(this._treeDef, agent);

    this._entries.set(npcId, { tree, agent, ctx });
  }

  /** Remove an NPC's behaviour tree. */
  public unregister(npcId: string): void {
    this._entries.delete(npcId);
  }

  /** Whether an NPC is currently registered. */
  public has(npcId: string): boolean {
    return this._entries.has(npcId);
  }

  /** Number of registered NPCs. */
  public get count(): number {
    return this._entries.size;
  }

  /** All registered NPC IDs. */
  public get registeredIds(): string[] {
    return Array.from(this._entries.keys());
  }

  /**
   * Update perception and step the behaviour tree for a specific NPC.
   * The caller provides fresh perception data which is copied into the
   * NPC's context before the tree is stepped.
   */
  public step(npcId: string, perception: Partial<NpcPerceptionContext>): void {
    const entry = this._entries.get(npcId);
    if (!entry) return;

    // Update the perception context in place.
    Object.assign(entry.ctx, perception);

    // Reset last action so we know if the tree produces one this step.
    entry.agent._lastAction = "none";

    // Step the tree.
    entry.tree.step();
  }

  /**
   * Get the action selected by the behaviour tree during the last `step()`.
   * Returns `"none"` if no NPC is registered or the tree hasn't been stepped.
   */
  public getActiveAction(npcId: string): NpcAction {
    const entry = this._entries.get(npcId);
    if (!entry) return "none";
    return entry.agent._lastAction;
  }

  /**
   * Get the current mistreevous tree state for debugging purposes.
   */
  public getTreeState(npcId: string): string | null {
    const entry = this._entries.get(npcId);
    if (!entry) return null;
    return entry.tree.getState();
  }
}
