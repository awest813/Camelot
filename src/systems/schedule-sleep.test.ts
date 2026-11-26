/**
 * Schedules and the clock: the hour, sleep (the Asleep tag) and its save
 * part.  (Formerly the separate DailyScheduleSystem.)
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ScheduleSystem } from "./schedule-system";
import { TimeSystem } from "./time-system";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { NPC, ScheduleBlock } from "../entities/npc";
import { listen } from "../testing/listen";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeNPC(
  name: string,
  scheduleBlocks: ScheduleBlock[] = [],
  metadata: object | null = { type: "npc" },
): any {
  return {
    isDead: false,
    isAggressive: false,
    scheduleBlocks,
    patrolPoints: [],
    homePosition: null,
    workPosition: null,
    spawnPosition: new Vector3(0, 0, 0),
    aiState: "IDLE",
    waitTime: 0,
    currentPatrolIndex: 0,
    patrolWaitMin: 1,
    patrolWaitMax: 2,
    patrolLookAroundAngle: Math.PI / 5,
    moveSpeed: 2,
    physicsAggregate: null,
    key: name, displayName: name,
    mesh: {
      name,
      position: new Vector3(0, 0, 0),
      metadata,
      lookAt: () => {},
    },
  } as unknown as NPC;
}

function makeSystems(startHour = 8) {
  const schedule = new ScheduleSystem();
  // TimeSystem with a very long real-day so updates don't advance hours accidentally.
  const time = new TimeSystem(1_000_000, startHour);
  return { schedule, time };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ScheduleSystem follows the clock — construction", () => {
  it("syncs ScheduleSystem.currentHour to TimeSystem.hour on construction", () => {
    const { schedule, time } = makeSystems(14);
    schedule.followClock(time);
    expect(schedule.currentHour).toBe(14);
  });

  it("registers onHourChange on TimeSystem", () => {
    const { schedule, time } = makeSystems(8);
    expect(time.onHourChange).toBeNull();
    schedule.followClock(time);
    expect(time.onHourChange).not.toBeNull();
  });
});

describe("ScheduleSystem follows the clock — sleep interactivity", () => {
  let schedule: ScheduleSystem;
  let time: TimeSystem;
  let daily: ScheduleSystem;

  beforeEach(() => {
    ({ schedule, time } = makeSystems(8)); // start at 08:00 (awake)
    daily = schedule.followClock(time);
  });

  it("an NPC without schedule blocks never sleeps", () => {
    const npc = makeNPC("Guard", [], { type: "npc" });
    schedule.addNPC(npc);
    // Force a re-sync at an hour that would be sleep if blocks existed
    daily.setHour(22);
    expect(npc.isAsleep).toBeFalsy();
    expect(npc.mesh.metadata, "interaction metadata is never touched").toEqual({ type: "npc" });
  });

  it("marks the NPC asleep when it enters a sleep block", () => {
    const npc = makeNPC("Innkeeper", [
      { startHour: 22, endHour: 6, behavior: "sleep" as const },
    ]);
    schedule.addNPC(npc);
    // Initially at hour 8 — awake
    expect(npc.isAsleep).toBeFalsy();

    // Advance to sleep hour
    daily.setHour(22);
    expect(npc.isAsleep).toBe(true);
  });

  it("wakes the NPC when the sleep block ends", () => {
    const originalMeta = { type: "npc", npc: "ref" };
    const npc = makeNPC("Shopkeeper", [
      { startHour: 22, endHour: 6, behavior: "sleep" as const },
      { startHour: 6, endHour: 22, behavior: "work" as const },
    ], originalMeta);
    schedule.addNPC(npc);

    // Sleep
    daily.setHour(23);
    expect(npc.isAsleep).toBe(true);

    // Wake up
    daily.setHour(8);
    expect(npc.isAsleep).toBe(false);
    expect(npc.mesh.metadata).toEqual(originalMeta);
  });

  it("does not put dead NPCs to sleep", () => {
    const npc = makeNPC("Guard", [
      { startHour: 22, endHour: 6, behavior: "sleep" as const },
    ]);
    npc.isDead = true;
    schedule.addNPC(npc);
    daily.setHour(22);
    expect(npc.isAsleep).toBeFalsy();
  });
});

describe("ScheduleSystem follows the clock — callbacks", () => {
  it("reports npc:slept when NPC enters sleep block", () => {
    const { schedule, time } = makeSystems(8);
    const daily = schedule.followClock(time);

    const npc = makeNPC("Villager", [
      { startHour: 22, endHour: 6, behavior: "sleep" as const },
    ]);
    schedule.addNPC(npc);

    const sleepSpy = vi.fn();
    listen(daily, "npc:slept", (p) => sleepSpy(p.npc));
    daily.setHour(22);
    expect(sleepSpy).toHaveBeenCalledOnce();
    expect(sleepSpy).toHaveBeenCalledWith(npc);
  });

  it("reports npc:woke when NPC leaves sleep block", () => {
    const { schedule, time } = makeSystems(22); // start sleeping
    const npc = makeNPC("Villager", [
      { startHour: 22, endHour: 6, behavior: "sleep" as const },
    ]);
    schedule.addNPC(npc);

    const daily = schedule.followClock(time);
    // NPC should now be sleeping after construction sync
    expect(npc.isAsleep).toBe(true);

    const wakeSpy = vi.fn();
    listen(daily, "npc:woke", (p) => wakeSpy(p.npc));
    daily.setHour(8);
    expect(wakeSpy).toHaveBeenCalledOnce();
    expect(wakeSpy).toHaveBeenCalledWith(npc);
  });

  it("does not double-report npc:slept on repeated hour sync within same block", () => {
    const { schedule, time } = makeSystems(8);
    const daily = schedule.followClock(time);

    const npc = makeNPC("Merchant", [
      { startHour: 22, endHour: 6, behavior: "sleep" as const },
    ]);
    schedule.addNPC(npc);

    const sleepSpy = vi.fn();
    listen(daily, "npc:slept", (p) => sleepSpy(p.npc));
    daily.setHour(22);
    daily.setHour(23); // still in sleep block
    daily.setHour(0);  // midnight, still sleeping
    expect(sleepSpy).toHaveBeenCalledOnce();
  });
});

describe("ScheduleSystem follows the clock — onHourChange integration", () => {
  it("syncs ScheduleSystem.currentHour when TimeSystem fires onHourChange", () => {
    const { schedule, time } = makeSystems(8);
    schedule.followClock(time);

    expect(schedule.currentHour).toBe(8);

    // Manually invoke the registered callback (simulating a clock tick)
    time.onHourChange!(12);
    expect(schedule.currentHour).toBe(12);
  });

  it("transitions NPC into sleep via onHourChange callback", () => {
    const { schedule, time } = makeSystems(8);
    const daily = schedule.followClock(time);

    const npc = makeNPC("Elder", [
      { startHour: 22, endHour: 6, behavior: "sleep" as const },
    ]);
    schedule.addNPC(npc);

    expect(npc.isAsleep).toBeFalsy();

    // Simulate the clock hitting 22:00
    time.onHourChange!(22);
    expect(npc.isAsleep).toBe(true);
  });
});

describe("ScheduleSystem follows the clock — isSleeping / getActiveBehavior", () => {
  it("isSleeping returns true for a sleeping NPC", () => {
    const { schedule, time } = makeSystems(22);
    const npc = makeNPC("NightOwl", [
      { startHour: 22, endHour: 6, behavior: "sleep" as const },
    ]);
    schedule.addNPC(npc);
    const daily = schedule.followClock(time);

    expect(daily.isSleeping("NightOwl")).toBe(true);
  });

  it("isSleeping returns false for an awake NPC", () => {
    const { schedule, time } = makeSystems(10);
    const npc = makeNPC("Baker", [
      { startHour: 22, endHour: 6, behavior: "sleep" as const },
    ]);
    schedule.addNPC(npc);
    const daily = schedule.followClock(time);

    expect(daily.isSleeping("Baker")).toBe(false);
  });

  it("getActiveBehavior returns correct behavior for matching block", () => {
    const { schedule, time } = makeSystems(10);
    const npc = makeNPC("Smith", [
      { startHour: 8, endHour: 18, behavior: "work" as const },
      { startHour: 22, endHour: 6, behavior: "sleep" as const },
    ]);
    schedule.addNPC(npc);
    const daily = schedule.followClock(time);

    expect(daily.behaviorOf(npc)).toBe("work");
  });

  it("getActiveBehavior returns null when no block matches", () => {
    const { schedule, time } = makeSystems(20); // 20:00 — gap between work and sleep
    const npc = makeNPC("Farmer", [
      { startHour: 8, endHour: 18, behavior: "work" as const },
      { startHour: 22, endHour: 6, behavior: "sleep" as const },
    ]);
    schedule.addNPC(npc);
    const daily = schedule.followClock(time);

    expect(daily.behaviorOf(npc)).toBeNull();
  });
});

describe("ScheduleSystem follows the clock — midnight-wrap block", () => {
  it("detects sleep block correctly for midnight-wrapping blocks at hour 3", () => {
    const { schedule, time } = makeSystems(3);
    const npc = makeNPC("Innkeeper", [
      { startHour: 22, endHour: 6, behavior: "sleep" as const },
    ]);
    schedule.addNPC(npc);
    const daily = schedule.followClock(time);

    expect(daily.isSleeping("Innkeeper")).toBe(true);
    expect(npc.isAsleep).toBe(true);
  });

  it("does NOT mark as sleeping outside the midnight-wrap block", () => {
    const { schedule, time } = makeSystems(10);
    const npc = makeNPC("Innkeeper", [
      { startHour: 22, endHour: 6, behavior: "sleep" as const },
    ]);
    schedule.addNPC(npc);
    const daily = schedule.followClock(time);

    expect(daily.isSleeping("Innkeeper")).toBe(false);
  });
});

describe("ScheduleSystem follows the clock — save/restore", () => {
  it("getSaveState returns names of sleeping NPCs", () => {
    const { schedule, time } = makeSystems(22);
    const npc1 = makeNPC("Guard1", [
      { startHour: 22, endHour: 6, behavior: "sleep" as const },
    ]);
    const npc2 = makeNPC("Guard2", []); // no schedule
    schedule.addNPC(npc1);
    schedule.addNPC(npc2);
    const daily = schedule.followClock(time);

    const state = daily.sleep.getSaveState();
    expect(state.sleepingNpcNames).toContain("Guard1");
    expect(state.sleepingNpcNames).not.toContain("Guard2");
  });

  it("restoreFromSave re-derives sleep state from current time", () => {
    const { schedule, time } = makeSystems(22);
    const npc = makeNPC("Blacksmith", [
      { startHour: 22, endHour: 6, behavior: "sleep" as const },
    ]);
    schedule.addNPC(npc);
    const daily = schedule.followClock(time);

    // NPC is sleeping; now simulate a load that already restored TimeSystem to 10:00
    (time as any)._gameTime = 10 * 60;
    (time as any)._lastHour = 10;

    // Restore: should re-derive that NPC is now awake
    daily.sleep.restoreFromSave({ sleepingNpcNames: ["Blacksmith"] });

    expect(daily.isSleeping("Blacksmith")).toBe(false);
    expect(npc.isAsleep).toBe(false);
  });

  it("restoreFromSave at sleep hour leaves NPC non-interactive", () => {
    const { schedule, time } = makeSystems(8);
    const npc = makeNPC("Miller", [
      { startHour: 22, endHour: 6, behavior: "sleep" as const },
    ]);
    schedule.addNPC(npc);
    const daily = schedule.followClock(time);

    // Simulate restored time = 23:00
    (time as any)._gameTime = 23 * 60;
    (time as any)._lastHour = 23;

    daily.sleep.restoreFromSave({ sleepingNpcNames: ["Miller"] });

    expect(daily.isSleeping("Miller")).toBe(true);
    expect(npc.isAsleep).toBe(true);
  });
});
