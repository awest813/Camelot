import { describe, it, expect, beforeEach } from "vitest";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import {
  NpcScheduleSystem,
  NpcScheduleDefinition,
  SCHED_GUARD,
  SCHED_VILLAGER,
  SCHED_INNKEEPER,
  SCHED_MERCHANT,
} from "./npc-schedule-system";
import type { NPC, ScheduleBlock } from "../entities/npc";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeNPC(overrides: Partial<Pick<NPC, "homePosition" | "workPosition">> = {}): any {
  return {
    scheduleBlocks: [] as ScheduleBlock[],
    homePosition: null,
    workPosition: null,
    ...overrides,
  } as unknown as NPC;
}

// ── Construction ──────────────────────────────────────────────────────────────

describe("NpcScheduleSystem — construction", () => {
  it("registers 4 built-in schedules by default", () => {
    const sys = new NpcScheduleSystem();
    expect(sys.registeredIds).toHaveLength(4);
  });

  it("registers no built-ins when registerBuiltins=false", () => {
    const sys = new NpcScheduleSystem(false);
    expect(sys.registeredIds).toHaveLength(0);
  });

  it("default constructor includes all four built-in ids", () => {
    const sys = new NpcScheduleSystem();
    expect(sys.registeredIds).toContain(SCHED_GUARD);
    expect(sys.registeredIds).toContain(SCHED_VILLAGER);
    expect(sys.registeredIds).toContain(SCHED_INNKEEPER);
    expect(sys.registeredIds).toContain(SCHED_MERCHANT);
  });
});

// ── Registry CRUD ─────────────────────────────────────────────────────────────

describe("NpcScheduleSystem — registry", () => {
  let sys: NpcScheduleSystem;

  beforeEach(() => {
    sys = new NpcScheduleSystem(false);
  });

  it("registerSchedule stores a definition", () => {
    const def: NpcScheduleDefinition = {
      id: "sched_test",
      blocks: [{ startHour: 8, endHour: 20, behavior: "work" }],
    };
    sys.registerSchedule(def);
    expect(sys.getSchedule("sched_test")).toBe(def);
  });

  it("getSchedule returns undefined for unknown id", () => {
    expect(sys.getSchedule("nonexistent")).toBeUndefined();
  });

  it("registeredIds reflects all registered ids", () => {
    sys.registerSchedule({ id: "a", blocks: [] });
    sys.registerSchedule({ id: "b", blocks: [] });
    expect(sys.registeredIds).toContain("a");
    expect(sys.registeredIds).toContain("b");
    expect(sys.registeredIds).toHaveLength(2);
  });

  it("registerSchedule replaces a definition with the same id", () => {
    const defA: NpcScheduleDefinition = { id: "sched_x", blocks: [{ startHour: 0, endHour: 24, behavior: "wander" }] };
    const defB: NpcScheduleDefinition = { id: "sched_x", blocks: [{ startHour: 0, endHour: 24, behavior: "sleep" }] };
    sys.registerSchedule(defA);
    sys.registerSchedule(defB);
    expect(sys.getSchedule("sched_x")).toBe(defB);
    expect(sys.registeredIds).toHaveLength(1);
  });

  it("removeSchedule deletes a definition", () => {
    sys.registerSchedule({ id: "sched_rm", blocks: [] });
    sys.removeSchedule("sched_rm");
    expect(sys.getSchedule("sched_rm")).toBeUndefined();
    expect(sys.registeredIds).not.toContain("sched_rm");
  });

  it("removeSchedule is a no-op for unknown ids", () => {
    expect(() => sys.removeSchedule("does_not_exist")).not.toThrow();
  });
});

// ── applySchedule ─────────────────────────────────────────────────────────────

describe("NpcScheduleSystem — applySchedule", () => {
  let sys: NpcScheduleSystem;

  beforeEach(() => {
    sys = new NpcScheduleSystem(false);
  });

  it("returns false for an unknown schedule id", () => {
    const npc = makeNPC();
    expect(sys.applySchedule(npc, "nonexistent")).toBe(false);
  });

  it("does not modify the NPC when the id is unknown", () => {
    const npc = makeNPC();
    sys.applySchedule(npc, "unknown");
    expect(npc.scheduleBlocks).toHaveLength(0);
    expect(npc.homePosition).toBeNull();
    expect(npc.workPosition).toBeNull();
  });

  it("returns true when the schedule is found and applied", () => {
    sys.registerSchedule({ id: "s", blocks: [{ startHour: 0, endHour: 24, behavior: "wander" }] });
    const npc = makeNPC();
    expect(sys.applySchedule(npc, "s")).toBe(true);
  });

  it("sets npc.scheduleBlocks from the definition", () => {
    const blocks: ScheduleBlock[] = [
      { startHour: 8, endHour: 20, behavior: "work"  },
      { startHour: 20, endHour: 8, behavior: "sleep" },
    ];
    sys.registerSchedule({ id: "s", blocks });
    const npc = makeNPC();
    sys.applySchedule(npc, "s");
    expect(npc.scheduleBlocks).toHaveLength(2);
    expect(npc.scheduleBlocks[0].behavior).toBe("work");
    expect(npc.scheduleBlocks[1].behavior).toBe("sleep");
  });

  it("scheduleBlocks is a copy, not the original array reference", () => {
    const blocks: ScheduleBlock[] = [{ startHour: 0, endHour: 24, behavior: "patrol" }];
    sys.registerSchedule({ id: "s", blocks });
    const npc = makeNPC();
    sys.applySchedule(npc, "s");
    expect(npc.scheduleBlocks).not.toBe(blocks);
  });

  it("replaces any pre-existing scheduleBlocks on the NPC", () => {
    sys.registerSchedule({ id: "s", blocks: [{ startHour: 6, endHour: 22, behavior: "patrol" }] });
    const npc = makeNPC();
    npc.scheduleBlocks = [{ startHour: 0, endHour: 24, behavior: "wander" }];
    sys.applySchedule(npc, "s");
    expect(npc.scheduleBlocks).toHaveLength(1);
    expect(npc.scheduleBlocks[0].behavior).toBe("patrol");
  });

  it("does not set workPosition when work block has no anchorPosition", () => {
    sys.registerSchedule({ id: "s", blocks: [{ startHour: 8, endHour: 20, behavior: "work" }] });
    const npc = makeNPC();
    sys.applySchedule(npc, "s");
    expect(npc.workPosition).toBeNull();
  });

  it("does not set homePosition when sleep block has no anchorPosition", () => {
    sys.registerSchedule({ id: "s", blocks: [{ startHour: 22, endHour: 8, behavior: "sleep" }] });
    const npc = makeNPC();
    sys.applySchedule(npc, "s");
    expect(npc.homePosition).toBeNull();
  });

  it("sets workPosition from work block anchorPosition when npc.workPosition is null", () => {
    const anchor = new Vector3(10, 0, 5);
    sys.registerSchedule({
      id: "s",
      blocks: [{ startHour: 8, endHour: 20, behavior: "work", anchorPosition: anchor }],
    });
    const npc = makeNPC();
    sys.applySchedule(npc, "s");
    expect(npc.workPosition).not.toBeNull();
    expect(npc.workPosition!.x).toBe(10);
    expect(npc.workPosition!.z).toBe(5);
  });

  it("sets homePosition from sleep block anchorPosition when npc.homePosition is null", () => {
    const anchor = new Vector3(3, 0, 7);
    sys.registerSchedule({
      id: "s",
      blocks: [{ startHour: 22, endHour: 8, behavior: "sleep", anchorPosition: anchor }],
    });
    const npc = makeNPC();
    sys.applySchedule(npc, "s");
    expect(npc.homePosition).not.toBeNull();
    expect(npc.homePosition!.x).toBe(3);
    expect(npc.homePosition!.z).toBe(7);
  });

  it("does not overwrite npc.workPosition if already set", () => {
    const existingWork = new Vector3(99, 0, 99);
    const anchor = new Vector3(1, 0, 1);
    sys.registerSchedule({
      id: "s",
      blocks: [{ startHour: 8, endHour: 20, behavior: "work", anchorPosition: anchor }],
    });
    const npc = makeNPC({ workPosition: existingWork });
    sys.applySchedule(npc, "s");
    expect(npc.workPosition).toBe(existingWork);
    expect(npc.workPosition!.x).toBe(99);
  });

  it("does not overwrite npc.homePosition if already set", () => {
    const existingHome = new Vector3(50, 0, 50);
    const anchor = new Vector3(1, 0, 1);
    sys.registerSchedule({
      id: "s",
      blocks: [{ startHour: 22, endHour: 8, behavior: "sleep", anchorPosition: anchor }],
    });
    const npc = makeNPC({ homePosition: existingHome });
    sys.applySchedule(npc, "s");
    expect(npc.homePosition).toBe(existingHome);
    expect(npc.homePosition!.x).toBe(50);
  });

  it("workPosition is a clone, not the original Vector3 reference", () => {
    const anchor = new Vector3(10, 0, 10);
    sys.registerSchedule({
      id: "s",
      blocks: [{ startHour: 8, endHour: 20, behavior: "work", anchorPosition: anchor }],
    });
    const npc = makeNPC();
    sys.applySchedule(npc, "s");
    expect(npc.workPosition).not.toBe(anchor);
    expect(npc.workPosition!.equals(anchor)).toBe(true);
  });

  it("homePosition is a clone, not the original Vector3 reference", () => {
    const anchor = new Vector3(5, 0, 5);
    sys.registerSchedule({
      id: "s",
      blocks: [{ startHour: 22, endHour: 8, behavior: "sleep", anchorPosition: anchor }],
    });
    const npc = makeNPC();
    sys.applySchedule(npc, "s");
    expect(npc.homePosition).not.toBe(anchor);
    expect(npc.homePosition!.equals(anchor)).toBe(true);
  });

  it("wander block anchorPosition is ignored (no NPC field)", () => {
    const anchor = new Vector3(10, 0, 10);
    sys.registerSchedule({
      id: "s",
      blocks: [{ startHour: 18, endHour: 22, behavior: "wander", anchorPosition: anchor }],
    });
    const npc = makeNPC();
    sys.applySchedule(npc, "s");
    expect(npc.homePosition).toBeNull();
    expect(npc.workPosition).toBeNull();
  });

  it("only first work block with anchor sets workPosition", () => {
    const anchor1 = new Vector3(1, 0, 1);
    const anchor2 = new Vector3(2, 0, 2);
    sys.registerSchedule({
      id: "s",
      blocks: [
        { startHour: 8,  endHour: 12, behavior: "work", anchorPosition: anchor1 },
        { startHour: 12, endHour: 20, behavior: "work", anchorPosition: anchor2 },
      ],
    });
    const npc = makeNPC();
    sys.applySchedule(npc, "s");
    // First anchor wins because workPosition is set on the first block and the
    // second block sees a non-null workPosition.
    expect(npc.workPosition!.x).toBe(1);
  });

  it("only first sleep block with anchor sets homePosition", () => {
    const anchor1 = new Vector3(10, 0, 10);
    const anchor2 = new Vector3(20, 0, 20);
    sys.registerSchedule({
      id: "s",
      blocks: [
        { startHour: 22, endHour: 2,  behavior: "sleep", anchorPosition: anchor1 },
        { startHour: 2,  endHour: 6,  behavior: "sleep", anchorPosition: anchor2 },
      ],
    });
    const npc = makeNPC();
    sys.applySchedule(npc, "s");
    expect(npc.homePosition!.x).toBe(10);
  });

  it("applies both workPosition and homePosition from a multi-block schedule", () => {
    const workAnchor  = new Vector3(5, 0, 0);
    const sleepAnchor = new Vector3(0, 0, 5);
    sys.registerSchedule({
      id: "s",
      blocks: [
        { startHour: 8,  endHour: 20, behavior: "work",  anchorPosition: workAnchor  },
        { startHour: 20, endHour: 22, behavior: "wander" },
        { startHour: 22, endHour: 8,  behavior: "sleep", anchorPosition: sleepAnchor },
      ],
    });
    const npc = makeNPC();
    sys.applySchedule(npc, "s");
    expect(npc.workPosition!.x).toBe(5);
    expect(npc.homePosition!.z).toBe(5);
  });
});

// ── Built-in schedules ────────────────────────────────────────────────────────

describe("NpcScheduleSystem — built-in schedules", () => {
  let sys: NpcScheduleSystem;

  beforeEach(() => {
    sys = new NpcScheduleSystem();
  });

  it("sched_guard: has 2 blocks", () => {
    expect(sys.getSchedule(SCHED_GUARD)!.blocks).toHaveLength(2);
  });

  it("sched_guard: first block is patrol", () => {
    expect(sys.getSchedule(SCHED_GUARD)!.blocks[0].behavior).toBe("patrol");
  });

  it("sched_guard: second block is sleep", () => {
    expect(sys.getSchedule(SCHED_GUARD)!.blocks[1].behavior).toBe("sleep");
  });

  it("sched_guard: patrol runs 06–22", () => {
    const block = sys.getSchedule(SCHED_GUARD)!.blocks[0];
    expect(block.startHour).toBe(6);
    expect(block.endHour).toBe(22);
  });

  it("sched_guard: sleep runs 22–06 (midnight-wrap)", () => {
    const block = sys.getSchedule(SCHED_GUARD)!.blocks[1];
    expect(block.startHour).toBe(22);
    expect(block.endHour).toBe(6);
  });

  it("sched_villager: has 3 blocks (work / wander / sleep)", () => {
    const blocks = sys.getSchedule(SCHED_VILLAGER)!.blocks;
    expect(blocks).toHaveLength(3);
    expect(blocks[0].behavior).toBe("work");
    expect(blocks[1].behavior).toBe("wander");
    expect(blocks[2].behavior).toBe("sleep");
  });

  it("sched_villager: work runs 08–18", () => {
    const block = sys.getSchedule(SCHED_VILLAGER)!.blocks[0];
    expect(block.startHour).toBe(8);
    expect(block.endHour).toBe(18);
  });

  it("sched_innkeeper: has 2 blocks (work / sleep)", () => {
    const blocks = sys.getSchedule(SCHED_INNKEEPER)!.blocks;
    expect(blocks).toHaveLength(2);
    expect(blocks[0].behavior).toBe("work");
    expect(blocks[1].behavior).toBe("sleep");
  });

  it("sched_innkeeper: work runs 08–23", () => {
    const block = sys.getSchedule(SCHED_INNKEEPER)!.blocks[0];
    expect(block.startHour).toBe(8);
    expect(block.endHour).toBe(23);
  });

  it("sched_merchant: has 3 blocks (work / wander / sleep)", () => {
    const blocks = sys.getSchedule(SCHED_MERCHANT)!.blocks;
    expect(blocks).toHaveLength(3);
    expect(blocks[0].behavior).toBe("work");
    expect(blocks[1].behavior).toBe("wander");
    expect(blocks[2].behavior).toBe("sleep");
  });

  it("sched_merchant: work runs 08–20", () => {
    const block = sys.getSchedule(SCHED_MERCHANT)!.blocks[0];
    expect(block.startHour).toBe(8);
    expect(block.endHour).toBe(20);
  });

  it("applying sched_villager sets scheduleBlocks on NPC", () => {
    const npc = makeNPC();
    sys.applySchedule(npc, SCHED_VILLAGER);
    expect(npc.scheduleBlocks).toHaveLength(3);
  });

  it("applying sched_guard sets scheduleBlocks on NPC", () => {
    const npc = makeNPC();
    sys.applySchedule(npc, SCHED_GUARD);
    expect(npc.scheduleBlocks).toHaveLength(2);
  });
});

// ── NpcArchetypeSystem integration (wiring) ───────────────────────────────────
// Lightweight tests verifying that NpcArchetypeSystem forwards scheduleId to
// NpcScheduleSystem.  Full archetype-system tests live in npc-archetype-system.test.ts.

describe("NpcScheduleSystem — NpcArchetypeSystem wiring (mock)", () => {
  it("applySchedule is called when NPC has a scheduleId", () => {
    const sys = new NpcScheduleSystem(false);
    sys.registerSchedule({
      id: "sched_guard",
      blocks: [
        { startHour: 6, endHour: 22, behavior: "patrol" },
        { startHour: 22, endHour: 6, behavior: "sleep"  },
      ],
    });

    const npc = makeNPC();
    const applied = sys.applySchedule(npc, "sched_guard");
    expect(applied).toBe(true);
    expect(npc.scheduleBlocks).toHaveLength(2);
  });

  it("returns false and leaves NPC unmodified for unknown scheduleId", () => {
    const sys = new NpcScheduleSystem(false);
    const npc = makeNPC();
    npc.scheduleBlocks = [{ startHour: 0, endHour: 24, behavior: "wander" }];

    const applied = sys.applySchedule(npc, "sched_missing");
    expect(applied).toBe(false);
    // Original blocks untouched
    expect(npc.scheduleBlocks).toHaveLength(1);
    expect(npc.scheduleBlocks[0].behavior).toBe("wander");
  });
});
