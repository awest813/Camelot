/**
 * First feature scenario through the headless harness: a day in a village.
 * Real village plan, real schedules, real wall colliders; no rendering.
 */
import { describe, it, expect } from "vitest";
import { HeadlessVillage } from "./village-sim";

describe("headless: a day in the village", () => {
  it("villagers go to work by mid-morning, nobody ends up inside a wall, guards walk their beat", () => {
    const v = new HeadlessVillage({ startHour: 8 });
    const villagers = v.npcs.filter((n) => n.archetype === "archetype_villager");
    expect(villagers.length).toBeGreaterThanOrEqual(5);

    let wallBreaches = 0;
    const guardVisits = new Map<string, Set<number>>();
    // 08:00 → 11:00 at one game minute per real second (180 s simulated).
    for (let s = 0; s < 180; s++) {
      v.run(1, 0.1);
      for (const n of v.npcs) {
        const p = n.npc.mesh.position;
        // Centre deep inside a building's walls = walked through a wall.
        if (v.insideBuilding(p.x, p.z, 0.6)) wallBreaches++;
        if (n.archetype === "archetype_guard" && !n.resident.nightWatch) {
          const pts = n.npc.patrolPoints;
          pts.forEach((q, i) => {
            if (Math.hypot(p.x - q.x, p.z - q.z) < 1.2) {
              const set = guardVisits.get(n.npc.mesh.name) ?? new Set<number>();
              set.add(i);
              guardVisits.set(n.npc.mesh.name, set);
            }
          });
        }
      }
    }

    expect(wallBreaches, "no NPC centre ever inside a building").toBe(0);

    const atWork = villagers.filter((n) => {
      const w = n.npc.workPosition!;
      const p = n.npc.mesh.position;
      return Math.hypot(p.x - w.x, p.z - w.z) < 1.5;
    });
    expect(atWork.length / villagers.length, "most villagers reached their work spot").toBeGreaterThanOrEqual(0.8);

    const dayGuards = [...guardVisits.values()];
    expect(dayGuards.length, "the day guard patrols").toBeGreaterThan(0);
    for (const visited of dayGuards) expect(visited.size, "patrol reaches several points").toBeGreaterThanOrEqual(2);
  });

  it("the simulation is deterministic for a fixed start", () => {
    const run = () => {
      const v = new HeadlessVillage({ startHour: 9 });
      // Patrol waits use Math.random: fix it for this check.
      const rnd = Math.random;
      let s = 1;
      Math.random = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      try { v.run(30, 0.1); } finally { Math.random = rnd; }
      return v.npcs.map((n) => [n.npc.mesh.position.x.toFixed(4), n.npc.mesh.position.z.toFixed(4)].join(","));
    };
    expect(run()).toEqual(run());
  });

  it("evening strolls stay out of buildings (and the check can tell)", () => {
    const breachesFor = (v: HeadlessVillage) => {
      let breaches = 0;
      for (let s = 0; s < 180; s++) {          // 18:00 → 21:00, the wander block
        v.run(1, 0.1);
        for (const n of v.npcs) {
          const p = n.npc.mesh.position;
          if (v.insideBuilding(p.x, p.z, 0.6)) breaches++;
        }
      }
      return breaches;
    };
    const seeded = <T>(fn: () => T): T => {
      const rnd = Math.random;
      let s = 7;
      Math.random = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      try { return fn(); } finally { Math.random = rnd; }
    };

    expect(seeded(() => breachesFor(new HeadlessVillage({ startHour: 18 }))), "walls and keep-out hold").toBe(0);

    // Control: without walls or the walkable keep-out, strolls do cut through
    // buildings — so a zero above means something.
    const open = seeded(() => {
      const v = new HeadlessVillage({ startHour: 18 });
      v.walls.length = 0;
      v.schedules.walkable = null;
      return breachesFor(v);
    });
    expect(open).toBeGreaterThan(0);
  });
});
