import { describe, it, expect, vi, beforeEach } from "vitest";
import { LandmarkSystem } from "./landmark-system";
import type { LandmarkDefinition } from "./landmark-system";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const shrine: LandmarkDefinition = {
  id: "shrine_dawn",
  name: "Shrine of Dawn",
  description: "An ancient shrine bathed in golden light.",
  position: { x: 120, y: 0, z: 85 },
  rewardXp: 250,
  rewardItems: [{ itemId: "amulet_dawn", quantity: 1 }],
  isOneTime: true,
};

const cache: LandmarkDefinition = {
  id: "bandit_cache",
  name: "Bandit Cache",
  description: "A hidden stash tucked behind the waterfall.",
  position: { x: 300, y: 5, z: 50 },
  rewardXp: 100,
  rewardItems: [
    { itemId: "gold_coin", quantity: 50 },
    { itemId: "lockpick", quantity: 3 },
  ],
  isOneTime: true,
};

const wayshrine: LandmarkDefinition = {
  id: "wayshrine_repeat",
  name: "Wayshrine of the Traveller",
  position: { x: 0, y: 0, z: 0 },
  rewardXp: 25,
  rewardItems: [],
  isOneTime: false, // repeatable
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("LandmarkSystem — CRUD", () => {
  let sys: LandmarkSystem;
  beforeEach(() => { sys = new LandmarkSystem(); });

  it("registers a landmark and retrieves it", () => {
    sys.registerLandmark(shrine);
    expect(sys.getLandmark("shrine_dawn")).toEqual(shrine);
  });

  it("returns undefined for unknown landmark", () => {
    expect(sys.getLandmark("nope")).toBeUndefined();
  });

  it("replaces an existing landmark with the same id", () => {
    sys.registerLandmark(shrine);
    sys.registerLandmark({ ...shrine, name: "Dawn Shrine II" });
    expect(sys.getLandmark("shrine_dawn")?.name).toBe("Dawn Shrine II");
    expect(sys.landmarks).toHaveLength(1);
  });

  it("stored definition is a copy (mutation-safe)", () => {
    const def = { ...shrine };
    sys.registerLandmark(def);
    def.name = "mutated";
    expect(sys.getLandmark("shrine_dawn")?.name).toBe("Shrine of Dawn");
  });

  it("lists all registered landmarks", () => {
    sys.registerLandmark(shrine);
    sys.registerLandmark(cache);
    expect(sys.landmarks).toHaveLength(2);
  });

  it("unregisters a landmark and clears its discovery state", () => {
    sys.registerLandmark(shrine);
    sys.discover("shrine_dawn");
    sys.unregisterLandmark("shrine_dawn");
    expect(sys.getLandmark("shrine_dawn")).toBeUndefined();
    expect(sys.isDiscovered("shrine_dawn")).toBe(false);
  });

  it("safe to unregister an unknown landmark", () => {
    expect(() => sys.unregisterLandmark("nope")).not.toThrow();
  });

  it("clear removes all landmarks and discovery state", () => {
    sys.registerLandmark(shrine);
    sys.registerLandmark(cache);
    sys.discover("shrine_dawn");
    sys.clear();
    expect(sys.landmarks).toHaveLength(0);
    expect(sys.isDiscovered("shrine_dawn")).toBe(false);
  });
});

describe("LandmarkSystem — Discovery (one-time)", () => {
  let sys: LandmarkSystem;
  beforeEach(() => {
    sys = new LandmarkSystem();
    sys.registerLandmark(shrine);
    sys.registerLandmark(cache);
  });

  it("discover returns result for known landmark", () => {
    const result = sys.discover("shrine_dawn");
    expect(result).not.toBeNull();
    expect(result!.landmark.id).toBe("shrine_dawn");
  });

  it("discover returns null for unknown landmark", () => {
    expect(sys.discover("nope")).toBeNull();
  });

  it("first discovery: alreadyDiscovered is false", () => {
    const result = sys.discover("shrine_dawn");
    expect(result!.alreadyDiscovered).toBe(false);
  });

  it("first discovery: xpAwarded matches rewardXp", () => {
    const result = sys.discover("shrine_dawn");
    expect(result!.xpAwarded).toBe(250);
  });

  it("first discovery: itemsAwarded matches rewardItems", () => {
    const result = sys.discover("shrine_dawn");
    expect(result!.itemsAwarded).toEqual([{ itemId: "amulet_dawn", quantity: 1 }]);
  });

  it("first discovery: itemsAwarded is a copy (mutation-safe)", () => {
    const result = sys.discover("shrine_dawn")!;
    result.itemsAwarded[0].quantity = 99;
    // Stored definition should be unaffected
    expect(sys.getLandmark("shrine_dawn")!.rewardItems[0].quantity).toBe(1);
  });

  it("isDiscovered returns true after discovery", () => {
    sys.discover("shrine_dawn");
    expect(sys.isDiscovered("shrine_dawn")).toBe(true);
  });

  it("isDiscovered returns false before discovery", () => {
    expect(sys.isDiscovered("shrine_dawn")).toBe(false);
  });

  it("second discovery of one-time landmark: alreadyDiscovered is true", () => {
    sys.discover("shrine_dawn");
    const result = sys.discover("shrine_dawn");
    expect(result!.alreadyDiscovered).toBe(true);
  });

  it("second discovery of one-time landmark: xpAwarded is 0", () => {
    sys.discover("shrine_dawn");
    const result = sys.discover("shrine_dawn");
    expect(result!.xpAwarded).toBe(0);
  });

  it("second discovery of one-time landmark: itemsAwarded is empty", () => {
    sys.discover("shrine_dawn");
    const result = sys.discover("shrine_dawn");
    expect(result!.itemsAwarded).toHaveLength(0);
  });

  it("fires onDiscovered callback on every discovery", () => {
    const cb = vi.fn();
    sys.onDiscovered = cb;
    sys.discover("shrine_dawn");
    sys.discover("shrine_dawn"); // second time (one-time, no reward)
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it("onDiscovered receives correct result", () => {
    const cb = vi.fn();
    sys.onDiscovered = cb;
    sys.discover("shrine_dawn");
    const result = cb.mock.calls[0][0];
    expect(result.xpAwarded).toBe(250);
    expect(result.landmark.name).toBe("Shrine of Dawn");
  });

  it("multi-item reward: all items awarded on first discovery", () => {
    const result = sys.discover("bandit_cache")!;
    expect(result.itemsAwarded).toHaveLength(2);
    expect(result.itemsAwarded[0]).toEqual({ itemId: "gold_coin", quantity: 50 });
    expect(result.itemsAwarded[1]).toEqual({ itemId: "lockpick", quantity: 3 });
  });
});

describe("LandmarkSystem — Discovery (repeatable)", () => {
  let sys: LandmarkSystem;
  beforeEach(() => {
    sys = new LandmarkSystem();
    sys.registerLandmark(wayshrine);
  });

  it("repeatable landmark grants reward on every discovery", () => {
    sys.discover("wayshrine_repeat");
    const second = sys.discover("wayshrine_repeat")!;
    expect(second.alreadyDiscovered).toBe(true);
    expect(second.xpAwarded).toBe(25); // still rewarded
  });

  it("isDiscovered returns true after first visit", () => {
    sys.discover("wayshrine_repeat");
    expect(sys.isDiscovered("wayshrine_repeat")).toBe(true);
  });
});

describe("LandmarkSystem — Query helpers", () => {
  let sys: LandmarkSystem;
  beforeEach(() => {
    sys = new LandmarkSystem();
    sys.registerLandmark(shrine);   // x:120, z:85
    sys.registerLandmark(cache);    // x:300, z:50
    sys.registerLandmark(wayshrine); // x:0, z:0
  });

  it("getDiscoveredIds returns empty before any discovery", () => {
    expect(sys.getDiscoveredIds()).toHaveLength(0);
  });

  it("getDiscoveredIds returns discovered ids after discoveries", () => {
    sys.discover("shrine_dawn");
    sys.discover("bandit_cache");
    const ids = sys.getDiscoveredIds();
    expect(ids).toContain("shrine_dawn");
    expect(ids).toContain("bandit_cache");
    expect(ids).not.toContain("wayshrine_repeat");
  });

  it("getUndiscoveredIds returns all ids before any discovery", () => {
    const ids = sys.getUndiscoveredIds();
    expect(ids).toHaveLength(3);
  });

  it("getUndiscoveredIds excludes already-discovered ids", () => {
    sys.discover("shrine_dawn");
    const ids = sys.getUndiscoveredIds();
    expect(ids).not.toContain("shrine_dawn");
    expect(ids).toContain("bandit_cache");
  });

  it("getLandmarksNearPoint returns landmarks within radius", () => {
    // origin (0,0,0), radius 150 → shrine (120,0,85) is ~147 away, cache is ~304 away
    const near = sys.getLandmarksNearPoint(0, 0, 0, 150);
    expect(near.map((l) => l.id)).toContain("wayshrine_repeat");
    expect(near.map((l) => l.id)).toContain("shrine_dawn");
    expect(near.map((l) => l.id)).not.toContain("bandit_cache");
  });

  it("getLandmarksNearPoint returns empty array when none in radius", () => {
    const near = sys.getLandmarksNearPoint(1000, 0, 1000, 10);
    expect(near).toHaveLength(0);
  });

  it("getLandmarksNearPoint includes landmark exactly on boundary", () => {
    // wayshrine is at (0,0,0); query center (0,0,0) radius 0
    const near = sys.getLandmarksNearPoint(0, 0, 0, 0);
    expect(near.map((l) => l.id)).toContain("wayshrine_repeat");
  });
});

describe("LandmarkSystem — resetDiscoveries", () => {
  let sys: LandmarkSystem;
  beforeEach(() => {
    sys = new LandmarkSystem();
    sys.registerLandmark(shrine);
    sys.registerLandmark(cache);
  });

  it("resetDiscoveries clears all discovered flags", () => {
    sys.discover("shrine_dawn");
    sys.discover("bandit_cache");
    sys.resetDiscoveries();
    expect(sys.isDiscovered("shrine_dawn")).toBe(false);
    expect(sys.isDiscovered("bandit_cache")).toBe(false);
    expect(sys.getDiscoveredIds()).toHaveLength(0);
  });

  it("resetDiscoveries does not remove landmark definitions", () => {
    sys.resetDiscoveries();
    expect(sys.landmarks).toHaveLength(2);
  });
});

describe("LandmarkSystem — Save / restore", () => {
  let sys: LandmarkSystem;
  beforeEach(() => {
    sys = new LandmarkSystem();
    sys.registerLandmark(shrine);
    sys.registerLandmark(cache);
    sys.registerLandmark(wayshrine);
  });

  it("getSaveState captures discovered ids", () => {
    sys.discover("shrine_dawn");
    sys.discover("bandit_cache");
    const state = sys.getSaveState();
    expect(state.discoveredIds).toContain("shrine_dawn");
    expect(state.discoveredIds).toContain("bandit_cache");
    expect(state.discoveredIds).not.toContain("wayshrine_repeat");
  });

  it("getSaveState returns empty array before any discovery", () => {
    expect(sys.getSaveState().discoveredIds).toHaveLength(0);
  });

  it("restoreFromSave restores discovered flags for known ids", () => {
    sys.discover("shrine_dawn");
    const state = sys.getSaveState();

    const fresh = new LandmarkSystem();
    fresh.registerLandmark(shrine);
    fresh.registerLandmark(cache);
    fresh.restoreFromSave(state);

    expect(fresh.isDiscovered("shrine_dawn")).toBe(true);
    expect(fresh.isDiscovered("bandit_cache")).toBe(false);
  });

  it("restoreFromSave silently ignores stale ids", () => {
    const state = { discoveredIds: ["deleted_landmark"] };
    expect(() => sys.restoreFromSave(state)).not.toThrow();
    expect(sys.isDiscovered("deleted_landmark")).toBe(false);
  });

  it("restoreFromSave clears previous state before loading", () => {
    sys.discover("shrine_dawn");
    sys.restoreFromSave({ discoveredIds: ["bandit_cache"] });
    expect(sys.isDiscovered("shrine_dawn")).toBe(false);
    expect(sys.isDiscovered("bandit_cache")).toBe(true);
  });

  it("round-trip getSaveState → restoreFromSave preserves all discovered ids", () => {
    sys.discover("shrine_dawn");
    sys.discover("bandit_cache");
    const state = sys.getSaveState();

    const fresh = new LandmarkSystem();
    fresh.registerLandmark(shrine);
    fresh.registerLandmark(cache);
    fresh.registerLandmark(wayshrine);
    fresh.restoreFromSave(state);

    expect(fresh.isDiscovered("shrine_dawn")).toBe(true);
    expect(fresh.isDiscovered("bandit_cache")).toBe(true);
    expect(fresh.isDiscovered("wayshrine_repeat")).toBe(false);
  });
});
