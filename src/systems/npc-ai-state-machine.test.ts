import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  npcAIMachine,
  createNpcAIActor,
  getNpcAIState,
  toAIStateString,
  isAggressiveState,
  type NpcAIActor,
  type NpcAIStateValue,
} from "./npc-ai-state-machine";

describe("NpcAIStateMachine", () => {
  let actor: NpcAIActor;

  beforeEach(() => {
    actor = createNpcAIActor();
  });

  afterEach(() => {
    actor.stop();
  });

  // ── Initial state ─────────────────────────────────────────────────────

  describe("initial state", () => {
    it("starts in idle", () => {
      expect(getNpcAIState(actor)).toBe("idle");
    });
  });

  // ── Idle transitions ──────────────────────────────────────────────────

  describe("idle", () => {
    it("transitions to alert on PLAYER_IN_RANGE", () => {
      actor.send({ type: "PLAYER_IN_RANGE" });
      expect(getNpcAIState(actor)).toBe("alert");
    });

    it("transitions to patrol on HAS_PATROL_POINTS", () => {
      actor.send({ type: "HAS_PATROL_POINTS" });
      expect(getNpcAIState(actor)).toBe("patrol");
    });

    it("transitions to dead on DIED", () => {
      actor.send({ type: "DIED" });
      expect(getNpcAIState(actor)).toBe("dead");
    });

    it("stays idle on irrelevant events", () => {
      actor.send({ type: "ALERT_EXPIRED" });
      expect(getNpcAIState(actor)).toBe("idle");
    });
  });

  // ── Patrol transitions ────────────────────────────────────────────────

  describe("patrol", () => {
    beforeEach(() => {
      actor.send({ type: "HAS_PATROL_POINTS" });
    });

    it("transitions to alert on PLAYER_IN_RANGE", () => {
      actor.send({ type: "PLAYER_IN_RANGE" });
      expect(getNpcAIState(actor)).toBe("alert");
    });

    it("transitions to dead on DIED", () => {
      actor.send({ type: "DIED" });
      expect(getNpcAIState(actor)).toBe("dead");
    });

    it("stays in patrol on irrelevant events", () => {
      actor.send({ type: "ALERT_EXPIRED" });
      expect(getNpcAIState(actor)).toBe("patrol");
    });
  });

  // ── Alert transitions ─────────────────────────────────────────────────

  describe("alert", () => {
    beforeEach(() => {
      actor.send({ type: "PLAYER_IN_RANGE" });
    });

    it("transitions to chase on ALERT_EXPIRED", () => {
      actor.send({ type: "ALERT_EXPIRED" });
      expect(getNpcAIState(actor)).toBe("chase");
    });

    it("transitions to investigate on PLAYER_ESCAPED", () => {
      actor.send({ type: "PLAYER_ESCAPED" });
      expect(getNpcAIState(actor)).toBe("investigate");
    });

    it("transitions to idle on PLAYER_OUT_OF_RANGE", () => {
      actor.send({ type: "PLAYER_OUT_OF_RANGE" });
      expect(getNpcAIState(actor)).toBe("idle");
    });

    it("transitions to dead on DIED", () => {
      actor.send({ type: "DIED" });
      expect(getNpcAIState(actor)).toBe("dead");
    });
  });

  // ── Chase transitions ─────────────────────────────────────────────────

  describe("chase", () => {
    beforeEach(() => {
      actor.send({ type: "PLAYER_IN_RANGE" });
      actor.send({ type: "ALERT_EXPIRED" });
    });

    it("transitions to attack on REACHED_ATTACK_RANGE", () => {
      actor.send({ type: "REACHED_ATTACK_RANGE" });
      expect(getNpcAIState(actor)).toBe("attack");
    });

    it("transitions to return on PLAYER_OUT_OF_RANGE", () => {
      actor.send({ type: "PLAYER_OUT_OF_RANGE" });
      expect(getNpcAIState(actor)).toBe("return");
    });

    it("transitions to flee on HEALTH_LOW", () => {
      actor.send({ type: "HEALTH_LOW" });
      expect(getNpcAIState(actor)).toBe("flee");
    });

    it("transitions to dead on DIED", () => {
      actor.send({ type: "DIED" });
      expect(getNpcAIState(actor)).toBe("dead");
    });
  });

  // ── Attack transitions ────────────────────────────────────────────────

  describe("attack", () => {
    beforeEach(() => {
      actor.send({ type: "PLAYER_IN_RANGE" });
      actor.send({ type: "ALERT_EXPIRED" });
      actor.send({ type: "REACHED_ATTACK_RANGE" });
    });

    it("transitions to chase on LEFT_ATTACK_RANGE", () => {
      actor.send({ type: "LEFT_ATTACK_RANGE" });
      expect(getNpcAIState(actor)).toBe("chase");
    });

    it("transitions to chase on LOST_RESERVATION", () => {
      actor.send({ type: "LOST_RESERVATION" });
      expect(getNpcAIState(actor)).toBe("chase");
    });

    it("transitions to return on PLAYER_OUT_OF_RANGE", () => {
      actor.send({ type: "PLAYER_OUT_OF_RANGE" });
      expect(getNpcAIState(actor)).toBe("return");
    });

    it("transitions to flee on HEALTH_LOW", () => {
      actor.send({ type: "HEALTH_LOW" });
      expect(getNpcAIState(actor)).toBe("flee");
    });

    it("transitions to dead on DIED", () => {
      actor.send({ type: "DIED" });
      expect(getNpcAIState(actor)).toBe("dead");
    });
  });

  // ── Return transitions ────────────────────────────────────────────────

  describe("return", () => {
    beforeEach(() => {
      actor.send({ type: "PLAYER_IN_RANGE" });
      actor.send({ type: "ALERT_EXPIRED" });
      actor.send({ type: "PLAYER_OUT_OF_RANGE" });
    });

    it("transitions to alert on PLAYER_IN_RANGE", () => {
      actor.send({ type: "PLAYER_IN_RANGE" });
      expect(getNpcAIState(actor)).toBe("alert");
    });

    it("transitions to patrol on REACHED_SPAWN", () => {
      actor.send({ type: "REACHED_SPAWN" });
      expect(getNpcAIState(actor)).toBe("patrol");
    });

    it("transitions to dead on DIED", () => {
      actor.send({ type: "DIED" });
      expect(getNpcAIState(actor)).toBe("dead");
    });
  });

  // ── Investigate transitions ───────────────────────────────────────────

  describe("investigate", () => {
    beforeEach(() => {
      actor.send({ type: "PLAYER_IN_RANGE" });
      actor.send({ type: "PLAYER_ESCAPED" });
    });

    it("transitions to alert on PLAYER_IN_RANGE", () => {
      actor.send({ type: "PLAYER_IN_RANGE" });
      expect(getNpcAIState(actor)).toBe("alert");
    });

    it("transitions to idle on REACHED_LAST_KNOWN_POS", () => {
      actor.send({ type: "REACHED_LAST_KNOWN_POS" });
      expect(getNpcAIState(actor)).toBe("idle");
    });

    it("transitions to idle on INVESTIGATE_EXPIRED", () => {
      actor.send({ type: "INVESTIGATE_EXPIRED" });
      expect(getNpcAIState(actor)).toBe("idle");
    });

    it("transitions to dead on DIED", () => {
      actor.send({ type: "DIED" });
      expect(getNpcAIState(actor)).toBe("dead");
    });
  });

  // ── Flee transitions ──────────────────────────────────────────────────

  describe("flee", () => {
    beforeEach(() => {
      actor.send({ type: "PLAYER_IN_RANGE" });
      actor.send({ type: "ALERT_EXPIRED" });
      actor.send({ type: "HEALTH_LOW" });
    });

    it("transitions to idle on FLED_TO_SAFETY", () => {
      actor.send({ type: "FLED_TO_SAFETY" });
      expect(getNpcAIState(actor)).toBe("idle");
    });

    it("transitions to dead on DIED", () => {
      actor.send({ type: "DIED" });
      expect(getNpcAIState(actor)).toBe("dead");
    });
  });

  // ── Dead transitions ──────────────────────────────────────────────────

  describe("dead", () => {
    beforeEach(() => {
      actor.send({ type: "DIED" });
    });

    it("transitions to idle on REVIVE", () => {
      actor.send({ type: "REVIVE" });
      expect(getNpcAIState(actor)).toBe("idle");
    });

    it("stays dead on combat events", () => {
      actor.send({ type: "PLAYER_IN_RANGE" });
      expect(getNpcAIState(actor)).toBe("dead");
    });
  });

  // ── Full combat cycle ─────────────────────────────────────────────────

  describe("full combat cycle", () => {
    it("idle → alert → chase → attack → return → patrol", () => {
      expect(getNpcAIState(actor)).toBe("idle");

      actor.send({ type: "PLAYER_IN_RANGE" });
      expect(getNpcAIState(actor)).toBe("alert");

      actor.send({ type: "ALERT_EXPIRED" });
      expect(getNpcAIState(actor)).toBe("chase");

      actor.send({ type: "REACHED_ATTACK_RANGE" });
      expect(getNpcAIState(actor)).toBe("attack");

      actor.send({ type: "PLAYER_OUT_OF_RANGE" });
      expect(getNpcAIState(actor)).toBe("return");

      actor.send({ type: "REACHED_SPAWN" });
      expect(getNpcAIState(actor)).toBe("patrol");
    });

    it("chase → flee → idle", () => {
      actor.send({ type: "PLAYER_IN_RANGE" });
      actor.send({ type: "ALERT_EXPIRED" });
      expect(getNpcAIState(actor)).toBe("chase");

      actor.send({ type: "HEALTH_LOW" });
      expect(getNpcAIState(actor)).toBe("flee");

      actor.send({ type: "FLED_TO_SAFETY" });
      expect(getNpcAIState(actor)).toBe("idle");
    });

    it("alert → investigate → idle", () => {
      actor.send({ type: "PLAYER_IN_RANGE" });
      expect(getNpcAIState(actor)).toBe("alert");

      actor.send({ type: "PLAYER_ESCAPED" });
      expect(getNpcAIState(actor)).toBe("investigate");

      actor.send({ type: "INVESTIGATE_EXPIRED" });
      expect(getNpcAIState(actor)).toBe("idle");
    });
  });

  // ── Re-aggro during return ────────────────────────────────────────────

  describe("re-aggro during return", () => {
    it("return → alert when player re-enters aggro", () => {
      actor.send({ type: "PLAYER_IN_RANGE" });
      actor.send({ type: "ALERT_EXPIRED" });
      actor.send({ type: "PLAYER_OUT_OF_RANGE" });
      expect(getNpcAIState(actor)).toBe("return");

      actor.send({ type: "PLAYER_IN_RANGE" });
      expect(getNpcAIState(actor)).toBe("alert");
    });
  });

  // ── Re-aggro during investigate ───────────────────────────────────────

  describe("re-aggro during investigate", () => {
    it("investigate → alert when player re-enters aggro", () => {
      actor.send({ type: "PLAYER_IN_RANGE" });
      actor.send({ type: "PLAYER_ESCAPED" });
      expect(getNpcAIState(actor)).toBe("investigate");

      actor.send({ type: "PLAYER_IN_RANGE" });
      expect(getNpcAIState(actor)).toBe("alert");
    });
  });
});

// ── Utility function tests ──────────────────────────────────────────────────

describe("utility functions", () => {
  describe("toAIStateString", () => {
    it("converts idle to IDLE", () => {
      expect(toAIStateString("idle")).toBe("IDLE");
    });

    it("converts chase to CHASE", () => {
      expect(toAIStateString("chase")).toBe("CHASE");
    });

    it("converts investigate to INVESTIGATE", () => {
      expect(toAIStateString("investigate")).toBe("INVESTIGATE");
    });
  });

  describe("isAggressiveState", () => {
    const aggressive: NpcAIStateValue[] = ["alert", "chase", "attack", "return", "investigate", "flee"];
    const passive: NpcAIStateValue[] = ["idle", "patrol", "dead"];

    for (const s of aggressive) {
      it(`${s} is aggressive`, () => {
        expect(isAggressiveState(s)).toBe(true);
      });
    }

    for (const s of passive) {
      it(`${s} is not aggressive`, () => {
        expect(isAggressiveState(s)).toBe(false);
      });
    }
  });
});

// ── Machine definition tests ────────────────────────────────────────────────

describe("npcAIMachine definition", () => {
  it("has the correct id", () => {
    expect(npcAIMachine.id).toBe("npcAI");
  });
});
