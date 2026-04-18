import { describe, it, expect, beforeEach } from "vitest";
import {
  NpcBehaviorTreeSystem,
  createNpcAgent,
  type NpcPerceptionContext,
  DEFAULT_NPC_BEHAVIOR_TREE_MDSL,
} from "./npc-behavior-tree";

// ── Helper: default context ────────────────────────────────────────────────

function defaultCtx(overrides: Partial<NpcPerceptionContext> = {}): NpcPerceptionContext {
  return {
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
    ...overrides,
  };
}

// ── createNpcAgent tests ───────────────────────────────────────────────────

describe("createNpcAgent", () => {
  it("creates an agent with _lastAction = 'none'", () => {
    const agent = createNpcAgent(defaultCtx());
    expect(agent._lastAction).toBe("none");
  });

  it("IsDead returns false by default", () => {
    const agent = createNpcAgent(defaultCtx());
    expect(agent.IsDead()).toBe(false);
  });

  it("IsDead returns true when isDead is set", () => {
    const agent = createNpcAgent(defaultCtx({ isDead: true }));
    expect(agent.IsDead()).toBe(true);
  });

  it("ShouldFlee returns false when fleeBelowHealthPct is 0", () => {
    const agent = createNpcAgent(defaultCtx({ healthFraction: 0.1, fleeBelowHealthPct: 0 }));
    expect(agent.ShouldFlee()).toBe(false);
  });

  it("ShouldFlee returns true when health is below threshold", () => {
    const agent = createNpcAgent(defaultCtx({ healthFraction: 0.1, fleeBelowHealthPct: 0.25 }));
    expect(agent.ShouldFlee()).toBe(true);
  });

  it("ShouldFlee returns false when health is above threshold", () => {
    const agent = createNpcAgent(defaultCtx({ healthFraction: 0.5, fleeBelowHealthPct: 0.25 }));
    expect(agent.ShouldFlee()).toBe(false);
  });

  it("PlayerInAggroRange returns true when within range", () => {
    const agent = createNpcAgent(defaultCtx({ distToPlayerSq: 100, aggroRange: 12 }));
    expect(agent.PlayerInAggroRange()).toBe(true);
  });

  it("PlayerInAggroRange returns false when out of range", () => {
    const agent = createNpcAgent(defaultCtx({ distToPlayerSq: 200, aggroRange: 12 }));
    expect(agent.PlayerInAggroRange()).toBe(false);
  });

  it("AlertExpired returns true when timer exceeds duration", () => {
    const agent = createNpcAgent(defaultCtx({ alertTimer: 2.0, alertDuration: 1.5 }));
    expect(agent.AlertExpired()).toBe(true);
  });

  it("AlertExpired returns false when timer is below duration", () => {
    const agent = createNpcAgent(defaultCtx({ alertTimer: 0.5, alertDuration: 1.5 }));
    expect(agent.AlertExpired()).toBe(false);
  });

  it("HasLastKnownPos reflects context", () => {
    const a = createNpcAgent(defaultCtx({ hasLastKnownPos: false }));
    expect(a.HasLastKnownPos()).toBe(false);
    const b = createNpcAgent(defaultCtx({ hasLastKnownPos: true }));
    expect(b.HasLastKnownPos()).toBe(true);
  });

  it("HasPatrolPoints reflects context", () => {
    const a = createNpcAgent(defaultCtx({ hasPatrolPoints: true }));
    expect(a.HasPatrolPoints()).toBe(true);
  });

  it("InvestigateNotExpired returns true when timer is below duration and not reached", () => {
    const agent = createNpcAgent(defaultCtx({
      investigateTimer: 2,
      investigateDuration: 5,
      reachedLastKnownPos: false,
    }));
    expect(agent.InvestigateNotExpired()).toBe(true);
  });

  it("InvestigateNotExpired returns false when timer exceeds duration", () => {
    const agent = createNpcAgent(defaultCtx({
      investigateTimer: 6,
      investigateDuration: 5,
      reachedLastKnownPos: false,
    }));
    expect(agent.InvestigateNotExpired()).toBe(false);
  });

  it("InvestigateNotExpired returns false when last known pos reached", () => {
    const agent = createNpcAgent(defaultCtx({
      investigateTimer: 2,
      investigateDuration: 5,
      reachedLastKnownPos: true,
    }));
    expect(agent.InvestigateNotExpired()).toBe(false);
  });
});

// ── NpcBehaviorTreeSystem tests ────────────────────────────────────────────

describe("NpcBehaviorTreeSystem", () => {
  let system: NpcBehaviorTreeSystem;

  beforeEach(() => {
    system = new NpcBehaviorTreeSystem();
  });

  // ── Registration ───────────────────────────────────────────────────────

  describe("registration", () => {
    it("starts with count 0", () => {
      expect(system.count).toBe(0);
    });

    it("registers an NPC", () => {
      system.register("npc_1");
      expect(system.has("npc_1")).toBe(true);
      expect(system.count).toBe(1);
    });

    it("re-registering same ID is a no-op", () => {
      system.register("npc_1");
      system.register("npc_1");
      expect(system.count).toBe(1);
    });

    it("supports multiple NPCs", () => {
      system.register("a");
      system.register("b");
      system.register("c");
      expect(system.count).toBe(3);
      expect(system.registeredIds).toEqual(expect.arrayContaining(["a", "b", "c"]));
    });

    it("unregisters an NPC", () => {
      system.register("npc_1");
      system.unregister("npc_1");
      expect(system.has("npc_1")).toBe(false);
      expect(system.count).toBe(0);
    });

    it("unregistering unknown ID is a no-op", () => {
      expect(() => system.unregister("unknown")).not.toThrow();
    });
  });

  // ── Default behavior ──────────────────────────────────────────────────

  describe("default behavior (idle)", () => {
    it("selects idle when player is far away and no patrol points", () => {
      system.register("npc");
      system.step("npc", { distToPlayerSq: Infinity });
      expect(system.getActiveAction("npc")).toBe("idle");
    });

    it("getActiveAction returns 'none' for unregistered NPC", () => {
      expect(system.getActiveAction("unknown")).toBe("none");
    });

    it("step is a no-op for unregistered NPC", () => {
      expect(() => system.step("unknown", {})).not.toThrow();
    });
  });

  // ── Patrol behavior ───────────────────────────────────────────────────

  describe("patrol", () => {
    it("selects patrol when NPC has patrol points and player is far", () => {
      system.register("npc");
      system.step("npc", { hasPatrolPoints: true, distToPlayerSq: 10000 });
      expect(system.getActiveAction("npc")).toBe("patrol");
    });
  });

  // ── Alert behavior ────────────────────────────────────────────────────

  describe("alert", () => {
    it("selects alert when player enters aggro range and alert not expired", () => {
      system.register("npc");
      system.step("npc", {
        distToPlayerSq: 50,     // within 12² = 144
        aggroRange: 12,
        alertTimer: 0,
        alertDuration: 1.5,
      });
      expect(system.getActiveAction("npc")).toBe("alert");
    });
  });

  // ── Chase behavior ────────────────────────────────────────────────────

  describe("chase", () => {
    it("selects chase when alert has expired and player in aggro range", () => {
      system.register("npc");
      system.step("npc", {
        distToPlayerSq: 50,
        aggroRange: 12,
        alertTimer: 2.0,
        alertDuration: 1.5,
        attackRange: 2.5,
      });
      expect(system.getActiveAction("npc")).toBe("chase");
    });
  });

  // ── Attack behavior ───────────────────────────────────────────────────

  describe("attack", () => {
    it("selects attack when in attack range with reservation", () => {
      system.register("npc");
      system.step("npc", {
        distToPlayerSq: 4,      // within 2.5² = 6.25
        aggroRange: 12,
        attackRange: 2.5,
        alertTimer: 2.0,
        alertDuration: 1.5,
        hasAttackReservation: true,
      });
      expect(system.getActiveAction("npc")).toBe("attack");
    });

    it("selects chase instead of attack without reservation", () => {
      system.register("npc");
      system.step("npc", {
        distToPlayerSq: 4,
        aggroRange: 12,
        attackRange: 2.5,
        alertTimer: 2.0,
        alertDuration: 1.5,
        hasAttackReservation: false,
      });
      expect(system.getActiveAction("npc")).toBe("chase");
    });
  });

  // ── Flee behavior ─────────────────────────────────────────────────────

  describe("flee", () => {
    it("selects flee when health drops below flee threshold", () => {
      system.register("npc");
      system.step("npc", {
        healthFraction: 0.1,
        fleeBelowHealthPct: 0.25,
        distToPlayerSq: 50,
        aggroRange: 12,
      });
      expect(system.getActiveAction("npc")).toBe("flee");
    });

    it("does not flee when fleeBelowHealthPct is 0", () => {
      system.register("npc");
      system.step("npc", {
        healthFraction: 0.1,
        fleeBelowHealthPct: 0,
        distToPlayerSq: 10000,
      });
      expect(system.getActiveAction("npc")).not.toBe("flee");
    });
  });

  // ── Investigate behavior ──────────────────────────────────────────────

  describe("investigate", () => {
    it("selects investigate when player left aggro range but has last known pos", () => {
      system.register("npc");
      system.step("npc", {
        distToPlayerSq: 10000,
        aggroRange: 12,
        hasLastKnownPos: true,
        investigateTimer: 1,
        investigateDuration: 5,
        reachedLastKnownPos: false,
      });
      expect(system.getActiveAction("npc")).toBe("investigate");
    });

    it("selects idle when investigation expired", () => {
      system.register("npc");
      system.step("npc", {
        distToPlayerSq: 10000,
        aggroRange: 12,
        hasLastKnownPos: true,
        investigateTimer: 6,
        investigateDuration: 5,
        reachedLastKnownPos: false,
        hasPatrolPoints: false,
      });
      expect(system.getActiveAction("npc")).toBe("idle");
    });

    it("selects return when investigation expired and has patrol points", () => {
      system.register("npc");
      system.step("npc", {
        distToPlayerSq: 10000,
        aggroRange: 12,
        hasLastKnownPos: true,
        investigateTimer: 6,
        investigateDuration: 5,
        reachedLastKnownPos: false,
        hasPatrolPoints: true,
      });
      expect(system.getActiveAction("npc")).toBe("return");
    });
  });

  // ── Dead behavior ─────────────────────────────────────────────────────

  describe("dead NPC", () => {
    it("selects idle for a dead NPC", () => {
      system.register("npc");
      system.step("npc", { isDead: true });
      expect(system.getActiveAction("npc")).toBe("idle");
    });
  });

  // ── Tree state debugging ──────────────────────────────────────────────

  describe("getTreeState", () => {
    it("returns null for unregistered NPC", () => {
      expect(system.getTreeState("unknown")).toBeNull();
    });

    it("returns a valid state string after stepping", () => {
      system.register("npc");
      system.step("npc", {});
      const state = system.getTreeState("npc");
      expect(state).toBeTruthy();
    });
  });

  // ── Custom tree definition ────────────────────────────────────────────

  describe("custom tree definition", () => {
    it("accepts a custom MDSL definition", () => {
      const simple = `root { action [DoIdle] }`;
      const sys = new NpcBehaviorTreeSystem(simple);
      sys.register("npc");
      sys.step("npc", {});
      expect(sys.getActiveAction("npc")).toBe("idle");
    });
  });

  // ── MDSL definition export ────────────────────────────────────────────

  describe("DEFAULT_NPC_BEHAVIOR_TREE_MDSL", () => {
    it("is a non-empty string", () => {
      expect(typeof DEFAULT_NPC_BEHAVIOR_TREE_MDSL).toBe("string");
      expect(DEFAULT_NPC_BEHAVIOR_TREE_MDSL.length).toBeGreaterThan(0);
    });

    it("contains root node", () => {
      expect(DEFAULT_NPC_BEHAVIOR_TREE_MDSL).toContain("root");
    });
  });
});
