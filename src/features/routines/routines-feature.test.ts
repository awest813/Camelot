import { describe, it, expect } from "vitest";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Kernel } from "../../core/kernel";
import { ActorsKey, ClockKey } from "../services";
import { IndoorsKey } from "../indoors/indoors-feature";
import { RoutinesFeature, RoutinesKey } from "./routines-feature";
import { scheduledSpot } from "../../systems/schedule-system";
import type { NPC, ScheduleBlock } from "../../entities/npc";

const DAY_JOB: ScheduleBlock[] = [
  { startHour: 8, endHour: 18, behavior: "work" },
  { startHour: 18, endHour: 8, behavior: "sleep" },
];

function npc(name: string, extra: Partial<NPC> = {}): NPC {
  return {
    key: name, isDead: false, isAggressive: false, isInDialogue: false,
    scheduleBlocks: DAY_JOB, workPosition: new Vector3(10, 2, 0), homePosition: new Vector3(-10, 2, 0),
    spawnPosition: new Vector3(0, 2, 0), patrolPoints: [],
    mesh: { position: new Vector3(0, 2, 0) },
    ...extra,
  } as unknown as NPC;
}

function setup() {
  const k = new Kernel();
  const clock = { hour: 12, elapsed: 100 };
  const inside = new Set<NPC>();
  const folk = [
    npc("Smith"),
    npc("Watch", { scheduleBlocks: [{ startHour: 0, endHour: 24, behavior: "patrol" }], patrolPoints: [new Vector3(5, 2, 5), new Vector3(-5, 2, -5)] }),
    npc("Brawler", { isAggressive: true }),
    npc("Talker", { isInDialogue: true }),
    npc("Idler", { scheduleBlocks: [] }),
  ];
  k.services.provide(ClockKey, { hour: () => clock.hour, elapsedHours: () => clock.elapsed });
  k.services.provide(ActorsKey, {
    residents: () => folk, byName: () => undefined, all: () => folk, hostiles: () => [],
    spawnArchetype: () => null, despawn: () => {}, isTalkingTo: () => false,
  });
  k.services.provide(IndoorsKey, {
    send: (n) => { inside.add(n); }, isIndoors: (n) => inside.has(n), hold: () => {}, releaseHolds: () => {},
  });
  k.install(new RoutinesFeature());
  const at = (name: string) => { const p = folk.find((f) => f.key === name)!.mesh.position; return [p.x, p.z]; };
  return { k, clock, inside, folk, at, routines: k.services.get(RoutinesKey) };
}

describe("scheduledSpot", () => {
  it("work, home for sleep and wander, a patrol point by the hour, nothing when unscheduled", () => {
    const n = npc("A");
    expect(scheduledSpot(n, 12)).toEqual({ behavior: "work", at: n.workPosition });
    expect(scheduledSpot(n, 23)).toEqual({ behavior: "sleep", at: n.homePosition });
    const p = npc("P", { scheduleBlocks: [{ startHour: 0, endHour: 24, behavior: "patrol" }], patrolPoints: [new Vector3(1, 0, 1), new Vector3(2, 0, 2)] });
    expect(scheduledSpot(p, 3).at).toBe(p.patrolPoints[1]);
    expect(scheduledSpot(npc("I", { scheduleBlocks: [] }), 12)).toEqual({ behavior: null, at: null });
  });
});

describe("RoutinesFeature", () => {
  it("after time passes in a jump, calm NPCs are where their routine has them", () => {
    const t = setup();
    t.k.phases.run("sim", 0.1);           // first tick: just notes the clock
    t.clock.hour = 23; t.clock.elapsed += 11; // waited until night
    t.k.phases.run("sim", 0.1);
    expect(t.at("Smith"), "home for the night").toEqual([-10, 0]);
    expect(t.inside.has(t.folk[0]), "and indoors").toBe(true);
    expect(t.at("Watch"), "on its round").toEqual([-5, -5]);
    expect(t.at("Brawler"), "fighting: left alone").toEqual([0, 0]);
    expect(t.at("Talker"), "talking: left alone").toEqual([0, 0]);
    expect(t.at("Idler"), "no schedule: left alone").toEqual([0, 0]);
  });

  it("ordinary ticks move nobody; someone already indoors stays put", () => {
    const t = setup();
    t.k.phases.run("sim", 0.1);
    t.clock.elapsed += 0.05;
    t.k.phases.run("sim", 0.1);
    expect(t.at("Smith")).toEqual([0, 0]);
    t.inside.add(t.folk[0]);
    expect(t.routines.place(t.folk[0])).toBe(false);
  });

  it("place() puts a newly arrived resident at its spot for the hour", () => {
    const t = setup();
    expect(t.routines.place(t.folk[0])).toBe(true);
    expect(t.at("Smith"), "at the forge at noon").toEqual([10, 0]);
    expect(t.inside.size).toBe(0);
  });
});
