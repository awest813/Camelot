import { describe, expect, it } from "vitest";
import { AIState } from "../../entities/npc";
import { nextGoal, type NpcPerception } from "./npc-goals";
import { branch, pick, selector, when } from "./behaviour-tree";

/** A calm NPC far from the player, with a patrol route. */
function sees(goal: AIState, facts: Partial<NpcPerception> = {}): AIState | null {
  return nextGoal({
    goal, playerNear: false, playerEscaped: false, inEngageRange: false, beyondDisengageRange: false,
    hasAttackSlot: false, safeFromPlayer: true, hasLastKnown: false, atLastKnown: false, atHome: false,
    hasPatrol: true, alertElapsed: false, investigateElapsed: false, shouldFlee: false, ...facts,
  });
}

describe("behaviour tree primitives", () => {
  it("selector takes the first child that picks; when guards; branch switches", () => {
    const t = selector<number, string>(when((n) => n > 10, pick("big")), branch((n) => (n % 2 ? "odd" : "even"), { odd: pick("odd") }));
    expect([t(11), t(3), t(4)]).toEqual(["big", "odd", null]);
    expect(pick<number, number>((n) => n * 2)(4)).toBe(8);
  });
});

describe("NPC goal tree", () => {
  it("calm NPCs notice the player; idle ones with a route go on patrol", () => {
    expect(sees(AIState.PATROL)).toBeNull();
    expect(sees(AIState.PATROL, { playerNear: true })).toBe(AIState.ALERT);
    expect(sees(AIState.IDLE)).toBe(AIState.PATROL);
    expect(sees(AIState.IDLE, { hasPatrol: false })).toBeNull();
    expect(sees(AIState.IDLE, { playerNear: true }), "noticing beats patrolling").toBe(AIState.ALERT);
  });

  it("alert: chase once the hesitation is over; if the player got away, search or settle", () => {
    expect(sees(AIState.ALERT)).toBeNull();
    expect(sees(AIState.ALERT, { alertElapsed: true })).toBe(AIState.CHASE);
    expect(sees(AIState.ALERT, { playerEscaped: true, hasLastKnown: true, alertElapsed: true })).toBe(AIState.INVESTIGATE);
    expect(sees(AIState.ALERT, { playerEscaped: true })).toBe(AIState.PATROL);
    expect(sees(AIState.ALERT, { playerEscaped: true, hasPatrol: false })).toBe(AIState.IDLE);
  });

  it("investigate: re-spot the player, or give up at the spot or when time runs out", () => {
    expect(sees(AIState.INVESTIGATE, { hasLastKnown: true })).toBeNull();
    expect(sees(AIState.INVESTIGATE, { playerNear: true, atLastKnown: true })).toBe(AIState.ALERT);
    expect(sees(AIState.INVESTIGATE, { atLastKnown: true })).toBe(AIState.RETURN);
    expect(sees(AIState.INVESTIGATE, { investigateElapsed: true, hasPatrol: false })).toBe(AIState.IDLE);
  });

  it("chase and attack, with an attack slot and a hysteresis band", () => {
    expect(sees(AIState.CHASE, { inEngageRange: true })).toBeNull();
    expect(sees(AIState.CHASE, { inEngageRange: true, hasAttackSlot: true })).toBe(AIState.ATTACK);
    expect(sees(AIState.CHASE, { playerEscaped: true, inEngageRange: true, hasAttackSlot: true })).toBe(AIState.RETURN);
    expect(sees(AIState.ATTACK, { hasAttackSlot: true })).toBeNull();
    expect(sees(AIState.ATTACK, { hasAttackSlot: false })).toBe(AIState.CHASE);
    expect(sees(AIState.ATTACK, { hasAttackSlot: true, beyondDisengageRange: true })).toBe(AIState.CHASE);
    expect(sees(AIState.ATTACK, { playerEscaped: true })).toBe(AIState.RETURN);
  });

  it("walking home: re-spot the player, or settle on arrival", () => {
    expect(sees(AIState.RETURN)).toBeNull();
    expect(sees(AIState.RETURN, { atHome: true })).toBe(AIState.PATROL);
    expect(sees(AIState.RETURN, { atHome: true, playerNear: true })).toBe(AIState.ALERT);
  });

  it("fleeing comes first for fighters, and ends once safe", () => {
    for (const g of [AIState.ALERT, AIState.INVESTIGATE, AIState.CHASE, AIState.ATTACK]) {
      expect(sees(g, { shouldFlee: true, hasAttackSlot: true }), g).toBe(AIState.FLEE);
    }
    for (const g of [AIState.IDLE, AIState.PATROL, AIState.RETURN]) {
      expect(sees(g, { shouldFlee: true }), `${g} is calm: no flight`).not.toBe(AIState.FLEE);
    }
    expect(sees(AIState.FLEE, { shouldFlee: true, safeFromPlayer: false })).toBeNull();
    expect(sees(AIState.FLEE, { shouldFlee: true })).toBe(AIState.RETURN);
  });
});
