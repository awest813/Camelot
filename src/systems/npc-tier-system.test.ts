import { describe, it, expect } from "vitest";
import { ActorStore } from "../core/ecs/actors";
import type { NPC } from "../entities/npc";
import { NpcTierSystem, NPC_TIER_FAR, NPC_TIER_HYSTERESIS, NPC_TIER_NEAR, tierFor } from "./npc-tier-system";
import { ScheduleSystem, SCHEDULE_TICK_EVERY } from "./schedule-system";

const sq = (d: number) => d * d;

describe("NPC LOD tiers", () => {
  it("bands by distance, with hysteresis at each edge", () => {
    expect(tierFor(sq(10), "near")).toBe("near");
    expect(tierFor(sq(60), "near")).toBe("mid");
    expect(tierFor(sq(500), "near")).toBe("far");
    // Just past the near edge: a near NPC stays near, a mid one stays mid.
    const justOut = NPC_TIER_NEAR + NPC_TIER_HYSTERESIS / 2;
    expect(tierFor(sq(justOut), "near")).toBe("near");
    expect(tierFor(sq(justOut), "mid")).toBe("mid");
    const justIn = NPC_TIER_FAR - NPC_TIER_HYSTERESIS / 2;
    expect(tierFor(sq(justIn), "far")).toBe("far");
    expect(tierFor(sq(justIn), "mid")).toBe("mid");
  });

  it("the system writes tiers as components, one per actor", () => {
    const store = new ActorStore<NPC>();
    const at = (x: number) => {
      const npc = { mesh: { position: { x, y: 0, z: 0 } } } as unknown as NPC & { actorId: number };
      npc.actorId = store.spawn(npc);
      return npc;
    };
    const a = at(5), b = at(70), c = at(300);
    const tiers = new NpcTierSystem(store);
    tiers.update({ x: 0, y: 0, z: 0 }, [a, b, c]);
    expect([a, b, c].map((n) => store.tier(n.actorId))).toEqual(["near", "mid", "far"]);
    c.mesh.position.x = 1;
    tiers.update({ x: 0, y: 0, z: 0 }, [a, b, c]);
    expect(store.tier(c.actorId)).toBe("near");
  });
});

describe("ScheduleSystem tick rate by tier", () => {
  it("a far NPC's schedule runs every few ticks with the time it missed", () => {
    const sys = new ScheduleSystem();
    const seen: number[] = [];
    // Watch the time handed to the NPC's update.
    (sys as unknown as { _updateNPC: (n: NPC, dt: number) => void })._updateNPC = (_n, dt) => { seen.push(dt); };
    const npc = { actorId: -1 } as unknown as NPC;
    sys.addNPC(npc);
    sys.update(0.1);
    expect(seen).toEqual([0.1]); // untiered counts as near
  });

  it("rates are 1 / 2 / 4 for near / mid / far", () => {
    expect(SCHEDULE_TICK_EVERY).toEqual({ near: 1, mid: 2, far: 4 });
  });
});

describe("ScheduleSystem with the game's actor store", () => {
  it("banks a far NPC's skipped time and hands it over", async () => {
    const { actors } = await import("../entities/actors");
    const sys = new ScheduleSystem();
    const seen: number[] = [];
    (sys as unknown as { _updateNPC: (n: NPC, dt: number) => void })._updateNPC = (_n, dt) => { seen.push(dt); };
    const npc = {} as NPC & { actorId: number };
    npc.actorId = actors.spawn(npc);
    actors.setTier(npc.actorId, "far");
    sys.addNPC(npc);
    for (let i = 0; i < 8; i++) sys.update(0.25);
    expect(seen.length).toBe(2);
    // Each run carries the ticks since the last one (at most four).
    expect(Math.max(...seen)).toBeLessThanOrEqual(1);
    expect(seen[1]).toBeCloseTo(1, 5);
    actors.despawn(npc.actorId);
  });
});
