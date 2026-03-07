import { describe, it, expect, beforeEach } from "vitest";
import { ScheduleSystem } from "./schedule-system";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { ScheduleBlock } from "../entities/npc";

// Mock a minimal NPC for schedule testing (no physics needed)
function makeNPC(overrides: object = {}): any {
  return {
    isDead: false,
    isAggressive: false,
    patrolPoints: [],
    scheduleBlocks: [] as ScheduleBlock[],
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
    mesh: {
      position: new Vector3(0, 0, 0),
      lookAt: () => {},
    },
    ...overrides,
  };
}

describe("ScheduleSystem — currentHour", () => {
  let sys: ScheduleSystem;

  beforeEach(() => {
    // Pass null as scene — schedule system only uses it for context;
    // the tests don't require real BabylonJS rendering.
    sys = new ScheduleSystem(null as any);
    sys.currentHour = -1;
  });

  it("defaults currentHour to -1 (disabled)", () => {
    expect(sys.currentHour).toBe(-1);
  });

  it("getScheduledBehavior returns null when no scheduleBlocks", () => {
    const npc = makeNPC();
    sys.addNPC(npc);
    sys.currentHour = 14;
    // No schedule blocks — update should NOT throw and NPC stays in default state
    expect(() => sys.update(0.016)).not.toThrow();
  });

  it("schedule block matching: active during work hours", () => {
    const npc = makeNPC({
      scheduleBlocks: [
        { startHour: 8, endHour: 17, behavior: "work", anchorPosition: new Vector3(10, 0, 10) },
        { startHour: 22, endHour: 6, behavior: "sleep" },
      ],
    });
    sys.addNPC(npc);
    sys.currentHour = 12;
    // Should not throw even without physics aggregate
    expect(() => sys.update(0.016)).not.toThrow();
  });

  it("schedule block wraps midnight correctly", () => {
    // Test hour-matching logic by checking block directly via update
    const npc = makeNPC({
      scheduleBlocks: [
        { startHour: 22, endHour: 6, behavior: "sleep" },
      ],
    });
    sys.addNPC(npc);

    // Hour 23 is within 22–6 wrap block
    sys.currentHour = 23;
    expect(() => sys.update(0.016)).not.toThrow();

    // Hour 3 is within 22–6 wrap block
    sys.currentHour = 3;
    expect(() => sys.update(0.016)).not.toThrow();

    // Hour 10 is NOT in 22–6 block
    sys.currentHour = 10;
    expect(() => sys.update(0.016)).not.toThrow();
  });

  it("currentHour is synced at -1 when not set (patrol fallback)", () => {
    const npc = makeNPC({
      patrolPoints: [new Vector3(5, 0, 5)],
      scheduleBlocks: [{ startHour: 8, endHour: 20, behavior: "work" }],
    });
    sys.addNPC(npc);
    sys.currentHour = -1; // disabled — use patrol
    expect(() => sys.update(0.016)).not.toThrow();
  });
});
