import { describe, it, expect } from "vitest";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Kernel } from "../../core/kernel";
import { BuildingsKey, ScheduleKey } from "../services";
import { IndoorsFeature, IndoorsKey } from "./indoors-feature";
import type { NPC } from "../../entities/npc";

function fakeNpc(name: string, x = 0) {
  let enabled = true;
  let gravity = 1;
  const shape = { filterMembershipMask: 5, filterCollideMask: 7 };
  const npc = {
    mesh: {
      name, position: new Vector3(x, 1, 0),
      setEnabled: (v: boolean) => { enabled = v; }, isEnabled: () => enabled, isDisposed: () => false,
    },
    physicsAggregate: {
      shape,
      body: { setLinearVelocity: () => undefined, setGravityFactor: (g: number) => { gravity = g; } },
    },
  } as unknown as NPC;
  return { npc, enabled: () => enabled, gravity: () => gravity, shape };
}

function setup() {
  const k = new Kernel();
  const behaviour = new Map<NPC, string>();
  k.services.provide(ScheduleKey, { behaviorOf: (npc) => behaviour.get(npc) ?? null });
  // One building whose doorway is near x = 0.
  k.services.provide(BuildingsKey, { nearBuilding: (x) => Math.abs(x) < 3 });
  k.install(new IndoorsFeature());
  return { k, behaviour, indoors: k.services.get(IndoorsKey) };
}

describe("IndoorsFeature (headless, through the kernel)", () => {
  it("sleepers at a door go inside (hidden, no collisions) and come out when the schedule says so", () => {
    const t = setup();
    const a = fakeNpc("Villager_1", 1);
    const far = fakeNpc("Villager_2", 40);
    t.behaviour.set(a.npc, "sleep");
    t.k.events.emit("npc:atBed", { npc: a.npc });
    t.k.events.emit("npc:atBed", { npc: far.npc });
    expect(t.indoors.isIndoors(a.npc)).toBe(true);
    expect(t.indoors.isIndoors(far.npc), "no building nearby: sleeps outside").toBe(false);
    expect(a.enabled()).toBe(false);
    expect(a.gravity()).toBe(0);
    expect(a.shape.filterCollideMask).toBe(0);

    t.k.phases.run("sim", 0.1);
    expect(t.indoors.isIndoors(a.npc), "still asleep").toBe(true);
    t.behaviour.set(a.npc, "work");
    t.k.phases.run("sim", 0.1);
    expect(t.indoors.isIndoors(a.npc)).toBe(false);
    expect(a.enabled()).toBe(true);
    expect(a.gravity()).toBe(1);
    expect(a.shape).toEqual({ filterMembershipMask: 5, filterCollideMask: 7 });
  });

  it("a hold keeps someone inside regardless of schedule, until released", () => {
    const t = setup();
    const a = fakeNpc("Innkeeper_1");
    t.behaviour.set(a.npc, "work");
    t.indoors.hold(a.npc, "raid");
    t.k.phases.run("sim", 0.1);
    expect(t.indoors.isIndoors(a.npc)).toBe(true);
    t.indoors.releaseHolds("raid");
    t.k.phases.run("sim", 0.1);
    expect(t.indoors.isIndoors(a.npc)).toBe(false);
  });

  it("forgets released NPCs, and uninstalling lets everyone out", () => {
    const t = setup();
    const a = fakeNpc("Villager_3"), b = fakeNpc("Villager_4");
    t.indoors.hold(a.npc, "x");
    t.indoors.hold(b.npc, "x");
    t.k.events.emit("npc:released", { npcName: "Villager_3" });
    expect(t.indoors.isIndoors(a.npc)).toBe(false);
    t.k.uninstall("indoors");
    expect(b.enabled()).toBe(true);
  });
});
