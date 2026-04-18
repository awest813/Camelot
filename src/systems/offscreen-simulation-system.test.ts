import { describe, it, expect, vi } from "vitest";
import {
  OffscreenSimulationSystem,
  type OffscreenScheduleBlock,
  type OffscreenNpcEntry,
} from "./offscreen-simulation-system";

// ── Helpers ──────────────────────────────────────────────────────────────────

const guardSchedule: OffscreenScheduleBlock[] = [
  { startHour: 6,  behavior: "patrol" },
  { startHour: 22, behavior: "sleep" },
];

const merchantSchedule: OffscreenScheduleBlock[] = [
  { startHour: 8,  behavior: "work", anchorPosition: { x: 10, y: 0, z: 10 } },
  { startHour: 20, behavior: "wander" },
  { startHour: 22, behavior: "sleep", anchorPosition: { x: 5, y: 0, z: 5 } },
];

function makeGuard(_id = "guard_01"): Omit<OffscreenNpcEntry, "id"> {
  return {
    scheduleBlocks: guardSchedule,
    lastKnownPosition: { x: 0, y: 0, z: 0 },
    homePosition: { x: -10, y: 0, z: -10 },
    health: 100,
    maxHealth: 100,
    isDead: false,
  };
}

function makeMerchant(_id = "merchant_01"): Omit<OffscreenNpcEntry, "id"> {
  return {
    scheduleBlocks: merchantSchedule,
    lastKnownPosition: { x: 10, y: 0, z: 10 },
    homePosition: { x: 5, y: 0, z: 5 },
    workPosition: { x: 10, y: 0, z: 10 },
    health: 80,
    maxHealth: 100,
    isDead: false,
    merchantId: "merchant_01",
    merchantGold: 200,
    merchantMaxGold: 500,
  };
}

describe("OffscreenSimulationSystem", () => {
  // ── Registration ──────────────────────────────────────────────────────────

  it("register adds an NPC to offscreen simulation", () => {
    const sys = new OffscreenSimulationSystem();
    sys.register("guard_01", makeGuard());
    expect(sys.has("guard_01")).toBe(true);
    expect(sys.count).toBe(1);
  });

  it("unregister removes an NPC and returns its state", () => {
    const sys = new OffscreenSimulationSystem();
    sys.register("guard_01", makeGuard());

    const state = sys.unregister("guard_01");
    expect(state).not.toBeNull();
    expect(state!.id).toBe("guard_01");
    expect(sys.has("guard_01")).toBe(false);
    expect(sys.count).toBe(0);
  });

  it("unregister returns null for unknown NPC", () => {
    const sys = new OffscreenSimulationSystem();
    expect(sys.unregister("unknown")).toBeNull();
  });

  it("registeredIds lists all offscreen NPCs", () => {
    const sys = new OffscreenSimulationSystem();
    sys.register("guard_01", makeGuard());
    sys.register("merchant_01", makeMerchant());
    const ids = sys.registeredIds;
    expect(ids).toContain("guard_01");
    expect(ids).toContain("merchant_01");
    expect(ids.length).toBe(2);
  });

  // ── Schedule resolution ───────────────────────────────────────────────────

  it("resolves patrol behavior during guard's patrol hours", () => {
    const sys = new OffscreenSimulationSystem();
    sys.register("guard_01", makeGuard());
    sys.setGameHour(12); // noon — patrol block (6–22)

    const state = sys.getState("guard_01");
    expect(state).not.toBeNull();
    expect(state!.currentBehavior).toBe("patrol");
  });

  it("resolves sleep behavior during guard's sleep hours", () => {
    const sys = new OffscreenSimulationSystem();
    sys.register("guard_01", makeGuard());
    sys.setGameHour(23); // late night — sleep block (22–6)

    const state = sys.getState("guard_01");
    expect(state!.currentBehavior).toBe("sleep");
    expect(state!.isSleeping).toBe(true);
  });

  it("resolves sleep at hour 2 (midnight wrap-around)", () => {
    const sys = new OffscreenSimulationSystem();
    sys.register("guard_01", makeGuard());
    sys.setGameHour(2);

    const state = sys.getState("guard_01");
    expect(state!.currentBehavior).toBe("sleep");
  });

  it("resolves work behavior for merchant during work hours", () => {
    const sys = new OffscreenSimulationSystem();
    sys.register("merchant_01", makeMerchant());
    sys.setGameHour(14); // 2 PM — work block (8–20)

    const state = sys.getState("merchant_01");
    expect(state!.currentBehavior).toBe("work");
  });

  it("resolves wander behavior for merchant during evening", () => {
    const sys = new OffscreenSimulationSystem();
    sys.register("merchant_01", makeMerchant());
    sys.setGameHour(21); // 9 PM — wander block (20–22)

    const state = sys.getState("merchant_01");
    expect(state!.currentBehavior).toBe("wander");
  });

  // ── Position resolution ───────────────────────────────────────────────────

  it("returns home position during sleep", () => {
    const sys = new OffscreenSimulationSystem();
    sys.register("guard_01", makeGuard());
    sys.setGameHour(23);

    const state = sys.getState("guard_01");
    expect(state!.expectedPosition).toEqual({ x: -10, y: 0, z: -10 });
  });

  it("returns work position during work", () => {
    const sys = new OffscreenSimulationSystem();
    sys.register("merchant_01", makeMerchant());
    sys.setGameHour(14);

    const state = sys.getState("merchant_01");
    expect(state!.expectedPosition).toEqual({ x: 10, y: 0, z: 10 });
  });

  it("returns lastKnownPosition during patrol", () => {
    const sys = new OffscreenSimulationSystem();
    sys.register("guard_01", makeGuard());
    sys.setGameHour(12);

    const state = sys.getState("guard_01");
    expect(state!.expectedPosition).toEqual({ x: 0, y: 0, z: 0 });
  });

  // ── Time advancement ──────────────────────────────────────────────────────

  it("advanceTime regenerates health", () => {
    const sys = new OffscreenSimulationSystem();
    const entry = makeMerchant();
    entry.health = 50;
    sys.register("merchant_01", entry);

    sys.advanceTime(10); // 10 hours → 50 HP regen
    const state = sys.getState("merchant_01");
    expect(state!.health).toBe(100); // capped at max
  });

  it("advanceTime does not exceed maxHealth", () => {
    const sys = new OffscreenSimulationSystem();
    const entry = makeGuard();
    entry.health = 99;
    sys.register("guard_01", entry);

    sys.advanceTime(100);
    expect(sys.getState("guard_01")!.health).toBe(100);
  });

  it("advanceTime does not heal dead NPCs", () => {
    const sys = new OffscreenSimulationSystem();
    const entry = makeGuard();
    entry.health = 0;
    entry.isDead = true;
    sys.register("guard_01", entry);

    sys.advanceTime(100);
    expect(sys.getState("guard_01")!.health).toBe(0);
  });

  it("advanceTime regenerates merchant gold", () => {
    const sys = new OffscreenSimulationSystem();
    sys.register("merchant_01", makeMerchant());

    sys.advanceTime(50); // 50 hours → 100 gold regen (200 + 100 = 300)
    const state = sys.getState("merchant_01");
    expect(state!.merchantGold).toBe(300);
  });

  it("advanceTime caps merchant gold at max", () => {
    const sys = new OffscreenSimulationSystem();
    sys.register("merchant_01", makeMerchant());

    sys.advanceTime(500); // way more than enough to cap
    expect(sys.getState("merchant_01")!.merchantGold).toBe(500);
  });

  it("advanceTime fires onMerchantRestock when gold reaches max", () => {
    const sys = new OffscreenSimulationSystem();
    sys.register("merchant_01", makeMerchant());

    let restockedId: string | null = null;
    sys.onMerchantRestock = (id) => { restockedId = id; };

    sys.advanceTime(500);
    expect(restockedId).toBe("merchant_01");
  });

  it("advanceTime does not fire onMerchantRestock if already at max", () => {
    const sys = new OffscreenSimulationSystem();
    const entry = makeMerchant();
    entry.merchantGold = 500; // already at max
    sys.register("merchant_01", entry);

    let fired = false;
    sys.onMerchantRestock = () => { fired = true; };
    sys.advanceTime(10);
    expect(fired).toBe(false);
  });

  it("advanceTime accumulates offscreen hours", () => {
    const sys = new OffscreenSimulationSystem();
    sys.register("guard_01", makeGuard());

    sys.advanceTime(5);
    sys.advanceTime(3);

    const state = sys.getState("guard_01");
    expect(state!.offscreenHours).toBe(8);
  });

  it("advanceTime updates lastGameHour (wraps at 24)", () => {
    const sys = new OffscreenSimulationSystem();
    sys.setGameHour(20);
    sys.register("guard_01", makeGuard());
    sys.advanceTime(6); // 20 + 6 = 26 → 2

    // The guard should now be in sleep (hour 2 is in the 22–6 block)
    expect(sys.getState("guard_01")!.currentBehavior).toBe("sleep");
  });

  it("advanceTime with 0 or negative hours does nothing", () => {
    const sys = new OffscreenSimulationSystem();
    const entry = makeGuard();
    entry.health = 50;
    sys.register("guard_01", entry);

    sys.advanceTime(0);
    expect(sys.getState("guard_01")!.health).toBe(50);

    sys.advanceTime(-10);
    expect(sys.getState("guard_01")!.health).toBe(50);
  });

  // ── Edge cases ────────────────────────────────────────────────────────────

  it("NPC with no scheduleBlocks resolves to idle", () => {
    const sys = new OffscreenSimulationSystem();
    sys.register("npc_empty", {
      scheduleBlocks: [],
      lastKnownPosition: { x: 0, y: 0, z: 0 },
      health: 100,
      maxHealth: 100,
      isDead: false,
    });
    sys.setGameHour(12);
    expect(sys.getState("npc_empty")!.currentBehavior).toBe("idle");
  });

  it("dead NPC resolves to idle regardless of schedule", () => {
    const sys = new OffscreenSimulationSystem();
    const entry = makeGuard();
    entry.isDead = true;
    sys.register("guard_dead", entry);
    sys.setGameHour(12);
    expect(sys.getState("guard_dead")!.currentBehavior).toBe("idle");
  });

  it("getState returns null for unregistered NPC", () => {
    const sys = new OffscreenSimulationSystem();
    expect(sys.getState("nope")).toBeNull();
  });

  // ── Snapshot / Restore ────────────────────────────────────────────────────

  it("getSnapshot captures all entries and accumulated hours", () => {
    const sys = new OffscreenSimulationSystem();
    sys.setGameHour(10);
    sys.register("guard_01", makeGuard());
    sys.advanceTime(5);

    const snap = sys.getSnapshot();
    expect(snap.lastGameHour).toBe(15);
    expect(snap.entries.length).toBe(1);
    expect(snap.entries[0].id).toBe("guard_01");
    expect(snap.accumulatedHours["guard_01"]).toBe(5);
  });

  it("restoreSnapshot restores full state", () => {
    const sys = new OffscreenSimulationSystem();
    sys.setGameHour(10);
    sys.register("guard_01", makeGuard());
    sys.register("merchant_01", makeMerchant());
    sys.advanceTime(3);
    const snap = sys.getSnapshot();

    const sys2 = new OffscreenSimulationSystem();
    sys2.restoreSnapshot(snap);
    expect(sys2.count).toBe(2);
    expect(sys2.has("guard_01")).toBe(true);
    expect(sys2.has("merchant_01")).toBe(true);
    expect(sys2.getState("guard_01")!.offscreenHours).toBe(3);
  });

  it("restoreSnapshot clears previous state", () => {
    const sys = new OffscreenSimulationSystem();
    sys.register("old_npc", makeGuard());

    const snap: any = {
      entries: [],
      lastGameHour: 0,
      accumulatedHours: {},
    };
    sys.restoreSnapshot(snap);
    expect(sys.count).toBe(0);
    expect(sys.has("old_npc")).toBe(false);
  });

  // ── getEntry ──────────────────────────────────────────────────────────────

  it("getEntry returns raw entry data", () => {
    const sys = new OffscreenSimulationSystem();
    sys.register("guard_01", makeGuard());
    const entry = sys.getEntry("guard_01");
    expect(entry).not.toBeNull();
    expect(entry!.health).toBe(100);
  });

  it("getEntry returns null for unknown NPC", () => {
    const sys = new OffscreenSimulationSystem();
    expect(sys.getEntry("nope")).toBeNull();
  });

  // ── setGameHour ───────────────────────────────────────────────────────────

  it("setGameHour handles negative values (wraps)", () => {
    const sys = new OffscreenSimulationSystem();
    sys.setGameHour(-3);
    sys.register("guard_01", makeGuard());
    const state = sys.getState("guard_01");
    // -3 wraps to 21, which is in the patrol block (6–22)
    expect(state!.currentBehavior).toBe("patrol");
  });

  it("setGameHour handles values > 24 (wraps)", () => {
    const sys = new OffscreenSimulationSystem();
    sys.setGameHour(26);
    sys.register("guard_01", makeGuard());
    // 26 % 24 = 2 → sleep
    expect(sys.getState("guard_01")!.currentBehavior).toBe("sleep");
  });
});
