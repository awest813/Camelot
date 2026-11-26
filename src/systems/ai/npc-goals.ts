/**
 * NPC goals: the behaviour tree that decides what an NPC is doing.
 *
 * The NPC's goal is its `AIState` (patrol, alert, investigate, chase,
 * attack, return home, flee).  Each tick the combat system gathers what the
 * NPC perceives (`NpcPerception`), asks this tree for the next goal, and
 * hands the body to the steering layer (`npc-steering.ts`) to carry it out.
 * The tree is pure: no scene, no physics.
 *
 * Priorities, top first:
 *  1. Flee: a fighter that drops below its flee threshold runs.
 *  2. Per goal, the reasons to change it (the player came close, got away,
 *     is in reach; a timer ran out; the NPC got where it was going).
 *  null: keep the current goal.
 */
import { AIState } from "../../entities/npc";
import { branch, pick, selector, when, type BtNode } from "./behaviour-tree";

export interface NpcPerception {
  goal: AIState;
  /** The player is within aggro range and this NPC aggroes on sight (or was provoked). */
  playerNear: boolean;
  /** The player is beyond twice the aggro range. */
  playerEscaped: boolean;
  /** Within attack-engage range / beyond attack-disengage range. */
  inEngageRange: boolean;
  beyondDisengageRange: boolean;
  /** Holds one of the few attack slots around the player. */
  hasAttackSlot: boolean;
  /** Beyond the distance a fleeing NPC feels safe at. */
  safeFromPlayer: boolean;
  /** Has somewhere the player was last seen. */
  hasLastKnown: boolean;
  /** Reached the last-known spot (investigate) / its spawn point (return). */
  atLastKnown: boolean;
  atHome: boolean;
  hasPatrol: boolean;
  alertElapsed: boolean;
  investigateElapsed: boolean;
  /** Health is under the NPC's flee threshold (which is set). */
  shouldFlee: boolean;
}

type Node = BtNode<NpcPerception, AIState>;

/** Patrol if it has a route, else stand. */
const settle: Node = (p) => (p.hasPatrol ? AIState.PATROL : AIState.IDLE);
/** Walk home if it has a route, else stand where it is. */
const goHome: Node = (p) => (p.hasPatrol ? AIState.RETURN : AIState.IDLE);
const spotted = when<NpcPerception, AIState>((p) => p.playerNear, pick(AIState.ALERT));

/** Goals a fighter can flee from (not the calm ones, not fleeing already). */
const FLEES_FROM: ReadonlySet<AIState> = new Set([AIState.ALERT, AIState.INVESTIGATE, AIState.CHASE, AIState.ATTACK]);

export const npcGoalTree: Node = selector<NpcPerception, AIState>(
  when((p) => p.shouldFlee && FLEES_FROM.has(p.goal), pick(AIState.FLEE)),
  branch<NpcPerception, AIState, AIState>((p) => p.goal, {
    [AIState.IDLE]: selector(spotted, when((p) => p.hasPatrol, pick(AIState.PATROL))),
    [AIState.PATROL]: spotted,
    [AIState.ALERT]: selector(
      when((p) => p.playerEscaped, (p) => (p.hasLastKnown ? AIState.INVESTIGATE : settle(p))),
      when((p) => p.alertElapsed, pick(AIState.CHASE)),
    ),
    [AIState.INVESTIGATE]: selector(
      spotted,
      when((p) => p.atLastKnown || p.investigateElapsed, goHome),
    ),
    [AIState.CHASE]: selector(
      when((p) => p.playerEscaped, pick(AIState.RETURN)),
      when((p) => p.inEngageRange && p.hasAttackSlot, pick(AIState.ATTACK)),
    ),
    [AIState.ATTACK]: selector(
      when((p) => p.playerEscaped, pick(AIState.RETURN)),
      when((p) => !p.hasAttackSlot || p.beyondDisengageRange, pick(AIState.CHASE)),
    ),
    [AIState.RETURN]: selector(spotted, when((p) => p.atHome, settle)),
    [AIState.FLEE]: when((p) => p.safeFromPlayer, goHome),
  }),
);

/** The next goal, or null to keep the current one. */
export function nextGoal(p: NpcPerception): AIState | null {
  const g = npcGoalTree(p);
  return g === p.goal ? null : g;
}
