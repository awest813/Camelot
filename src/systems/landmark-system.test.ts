import { describe, it, expect, vi, beforeEach } from "vitest";
import { LandmarkSystem } from "./landmark-system";
import type { LandmarkDefinition } from "./landmark-system";

// ── Fixture helpers ───────────────────────────────────────────────────────────

const dungeonLandmark: LandmarkDefinition = {
  id: "old_fort",
  name: "Old Fort",
  description: "A ruined fortress overrun by bandits.",
  type: "dungeon",
  position: { x: 100, y: 0, z: 100 },
  discoveryReward: { xp: 50, fame: 5 },
  completionReward: {
    tableId: "bandit_boss_loot",
    xp: 200,
    fame: 20,
    items: [{ itemId: "gold_key", quantity: 1 }],
  },
};

const shrineLandmark: LandmarkDefinition = {
  id: "mara_shrine",
  name: "Shrine of Mara",
  type: "shrine",
  position: { x: 300, y: 0, z: 50 },
  discoveryReward: { xp: 30 },
  completionReward: { xp: 100, items: [{ itemId: "blessed_amulet", quantity: 1 }] },
};

const campLandmark: LandmarkDefinition = {
  id: "bandit_camp",
  name: "Bandit Camp",
  type: "camp",
  position: { x: 200, y: 5, z: 200 },
};

// ── Tests: CRUD ───────────────────────────────────────────────────────────────

describe("LandmarkSystem — CRUD", () => {
  it("registers a landmark and retrieves its definition", () => {
    const sys = new LandmarkSystem();
    sys.addLandmark(dungeonLandmark);
    expect(sys.getLandmark("old_fort")).toEqual(dungeonLandmark);
  });

  it("replaces an existing landmark with the same id, resetting progress", () => {
    const sys = new LandmarkSystem();
    sys.addLandmark(dungeonLandmark);
    sys.discoverLandmark("old_fort");
    const updated: LandmarkDefinition = { ...dungeonLandmark, name: "Collapsed Fort" };
    sys.addLandmark(updated);
    expect(sys.getLandmark("old_fort")?.name).toBe("Collapsed Fort");
    expect(sys.isDiscovered("old_fort")).toBe(false); // progress reset
  });

  it("removeLandmark deletes a registered landmark", () => {
    const sys = new LandmarkSystem();
    sys.addLandmark(dungeonLandmark);
    sys.removeLandmark("old_fort");
    expect(sys.getLandmark("old_fort")).toBeUndefined();
    expect(sys.landmarks).toHaveLength(0);
  });

  it("removeLandmark on unknown id does not throw", () => {
    const sys = new LandmarkSystem();
    expect(() => sys.removeLandmark("ghost")).not.toThrow();
  });

  it("landmarks getter returns all registered definitions", () => {
    const sys = new LandmarkSystem();
    sys.addLandmark(dungeonLandmark);
    sys.addLandmark(shrineLandmark);
    expect(sys.landmarks).toHaveLength(2);
    expect(sys.landmarks.map((l) => l.id)).toContain("old_fort");
    expect(sys.landmarks.map((l) => l.id)).toContain("mara_shrine");
  });

  it("clear() removes all landmarks", () => {
    const sys = new LandmarkSystem();
    sys.addLandmark(dungeonLandmark);
    sys.addLandmark(shrineLandmark);
    sys.clear();
    expect(sys.landmarks).toHaveLength(0);
  });

  it("getLandmark returns undefined for unknown id", () => {
    const sys = new LandmarkSystem();
    expect(sys.getLandmark("nowhere")).toBeUndefined();
  });
});

// ── Tests: Discovery ──────────────────────────────────────────────────────────

describe("LandmarkSystem — discovery", () => {
  let sys: LandmarkSystem;

  beforeEach(() => {
    sys = new LandmarkSystem();
    sys.addLandmark(dungeonLandmark);
    sys.addLandmark(campLandmark);
  });

  it("new landmarks start undiscovered and uncompleted", () => {
    expect(sys.isDiscovered("old_fort")).toBe(false);
    expect(sys.isCompleted("old_fort")).toBe(false);
  });

  it("discoverLandmark marks the landmark as discovered", () => {
    sys.discoverLandmark("old_fort");
    expect(sys.isDiscovered("old_fort")).toBe(true);
  });

  it("discoverLandmark returns a reward result on first call", () => {
    const result = sys.discoverLandmark("old_fort");
    expect(result).not.toBeNull();
    expect(result?.landmarkId).toBe("old_fort");
    expect(result?.rewardType).toBe("discovery");
    expect(result?.reward.xp).toBe(50);
  });

  it("discoverLandmark returns null on second call (idempotent)", () => {
    sys.discoverLandmark("old_fort");
    expect(sys.discoverLandmark("old_fort")).toBeNull();
  });

  it("discoverLandmark returns null for unknown id", () => {
    expect(sys.discoverLandmark("ghost")).toBeNull();
  });

  it("discoverLandmark fires onLandmarkDiscovered callback", () => {
    const cb = vi.fn();
    sys.onLandmarkDiscovered = cb;
    sys.discoverLandmark("old_fort");
    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ landmarkId: "old_fort" }));
  });

  it("does not fire onLandmarkDiscovered on second discover call", () => {
    sys.discoverLandmark("old_fort");
    const cb = vi.fn();
    sys.onLandmarkDiscovered = cb;
    sys.discoverLandmark("old_fort");
    expect(cb).not.toHaveBeenCalled();
  });

  it("reward is empty object when landmark has no discoveryReward", () => {
    const result = sys.discoverLandmark("bandit_camp");
    expect(result?.reward).toEqual({});
  });
});

// ── Tests: Completion ─────────────────────────────────────────────────────────

describe("LandmarkSystem — completion", () => {
  let sys: LandmarkSystem;

  beforeEach(() => {
    sys = new LandmarkSystem();
    sys.addLandmark(dungeonLandmark);
    sys.addLandmark(campLandmark);
  });

  it("completeLandmark marks the landmark as completed", () => {
    sys.completeLandmark("old_fort");
    expect(sys.isCompleted("old_fort")).toBe(true);
  });

  it("completeLandmark also auto-discovers an undiscovered landmark", () => {
    sys.completeLandmark("old_fort");
    expect(sys.isDiscovered("old_fort")).toBe(true);
  });

  it("completeLandmark returns a reward result on first call", () => {
    const result = sys.completeLandmark("old_fort");
    expect(result).not.toBeNull();
    expect(result?.rewardType).toBe("completion");
    expect(result?.reward.tableId).toBe("bandit_boss_loot");
    expect(result?.reward.xp).toBe(200);
  });

  it("completeLandmark returns null on second call (idempotent)", () => {
    sys.completeLandmark("old_fort");
    expect(sys.completeLandmark("old_fort")).toBeNull();
  });

  it("completeLandmark returns null for unknown id", () => {
    expect(sys.completeLandmark("ghost")).toBeNull();
  });

  it("completeLandmark fires onLandmarkCompleted callback", () => {
    const cb = vi.fn();
    sys.onLandmarkCompleted = cb;
    sys.completeLandmark("old_fort");
    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ landmarkId: "old_fort" }));
  });

  it("completeLandmark also fires onLandmarkDiscovered when auto-discovering", () => {
    const discoverCb = vi.fn();
    sys.onLandmarkDiscovered = discoverCb;
    sys.completeLandmark("old_fort");
    expect(discoverCb).toHaveBeenCalledWith(expect.objectContaining({ landmarkId: "old_fort" }));
  });

  it("completeLandmark does NOT fire onLandmarkDiscovered when already discovered", () => {
    sys.discoverLandmark("old_fort");
    const discoverCb = vi.fn();
    sys.onLandmarkDiscovered = discoverCb;
    sys.completeLandmark("old_fort");
    expect(discoverCb).not.toHaveBeenCalled();
  });

  it("reward is empty object when landmark has no completionReward", () => {
    const result = sys.completeLandmark("bandit_camp");
    expect(result?.reward).toEqual({});
  });
});

// ── Tests: Progress queries ───────────────────────────────────────────────────

describe("LandmarkSystem — progress queries", () => {
  let sys: LandmarkSystem;

  beforeEach(() => {
    sys = new LandmarkSystem();
    sys.addLandmark(dungeonLandmark);
    sys.addLandmark(shrineLandmark);
    sys.addLandmark(campLandmark);
  });

  it("isDiscovered returns false for unknown id", () => {
    expect(sys.isDiscovered("ghost")).toBe(false);
  });

  it("isCompleted returns false for unknown id", () => {
    expect(sys.isCompleted("ghost")).toBe(false);
  });

  it("getDiscoveredLandmarks returns ids of all discovered landmarks", () => {
    sys.discoverLandmark("old_fort");
    sys.discoverLandmark("mara_shrine");
    expect(sys.getDiscoveredLandmarks()).toContain("old_fort");
    expect(sys.getDiscoveredLandmarks()).toContain("mara_shrine");
    expect(sys.getDiscoveredLandmarks()).not.toContain("bandit_camp");
  });

  it("getDiscoveredLandmarks returns empty array when none discovered", () => {
    expect(sys.getDiscoveredLandmarks()).toHaveLength(0);
  });

  it("getCompletedLandmarks returns ids of all completed landmarks", () => {
    sys.completeLandmark("old_fort");
    expect(sys.getCompletedLandmarks()).toContain("old_fort");
    expect(sys.getCompletedLandmarks()).not.toContain("mara_shrine");
  });

  it("getLandmarksByType filters by type", () => {
    expect(sys.getLandmarksByType("dungeon")).toContain("old_fort");
    expect(sys.getLandmarksByType("shrine")).toContain("mara_shrine");
    expect(sys.getLandmarksByType("dungeon")).not.toContain("mara_shrine");
  });

  it("getLandmarksByType returns empty array when no matches", () => {
    expect(sys.getLandmarksByType("tower")).toHaveLength(0);
  });
});

// ── Tests: Spatial queries ────────────────────────────────────────────────────

describe("LandmarkSystem — spatial queries", () => {
  let sys: LandmarkSystem;

  beforeEach(() => {
    sys = new LandmarkSystem();
    sys.addLandmark(dungeonLandmark); // (100, 0, 100)
    sys.addLandmark(shrineLandmark);  // (300, 0, 50)
    sys.addLandmark(campLandmark);    // (200, 5, 200)
  });

  it("getLandmarksInRadius returns landmark at exact radius distance", () => {
    // distance from (0,0,0) to (100,0,100) = sqrt(20000) ≈ 141.4
    const hits = sys.getLandmarksInRadius(0, 0, 0, 142);
    expect(hits).toContain("old_fort");
  });

  it("getLandmarksInRadius excludes landmark just outside radius", () => {
    // distance from (0,0,0) to (100,0,100) ≈ 141.4
    const hits = sys.getLandmarksInRadius(0, 0, 0, 140);
    expect(hits).not.toContain("old_fort");
  });

  it("getLandmarksInRadius returns multiple nearby landmarks", () => {
    // from (150, 0, 150): old_fort ≈ 70.7, camp ≈ 70.7, shrine ≈ 162.5
    const hits = sys.getLandmarksInRadius(150, 0, 150, 100);
    expect(hits).toContain("old_fort");
    expect(hits).toContain("bandit_camp");
    expect(hits).not.toContain("mara_shrine");
  });

  it("getLandmarksInRadius returns empty when none in range", () => {
    expect(sys.getLandmarksInRadius(1000, 1000, 1000, 10)).toHaveLength(0);
  });

  it("getNearestLandmark returns null when no landmarks registered", () => {
    expect(new LandmarkSystem().getNearestLandmark(0, 0, 0)).toBeNull();
  });

  it("getNearestLandmark returns closest landmark id", () => {
    // from origin: old_fort ≈ 141.4, camp ≈ 283.7, shrine ≈ 304.1
    expect(sys.getNearestLandmark(0, 0, 0)).toBe("old_fort");
  });

  it("getNearestLandmark returns the single registered landmark", () => {
    const single = new LandmarkSystem();
    single.addLandmark(dungeonLandmark);
    expect(single.getNearestLandmark(999, 999, 999)).toBe("old_fort");
  });

  it("getUndiscoveredInRadius returns only undiscovered landmarks in range", () => {
    sys.discoverLandmark("old_fort");
    // from (150, 0, 150): old_fort and camp are within 100 units
    const undiscovered = sys.getUndiscoveredInRadius(150, 0, 150, 100);
    expect(undiscovered).not.toContain("old_fort"); // already discovered
    expect(undiscovered).toContain("bandit_camp");
  });

  it("getUndiscoveredInRadius returns empty when all nearby are discovered", () => {
    sys.discoverLandmark("old_fort");
    sys.discoverLandmark("bandit_camp");
    expect(sys.getUndiscoveredInRadius(150, 0, 150, 100)).toHaveLength(0);
  });
});

// ── Tests: Snapshot / restore ─────────────────────────────────────────────────

describe("LandmarkSystem — snapshot / restore", () => {
  it("getSnapshot captures discovered/completed flags", () => {
    const sys = new LandmarkSystem();
    sys.addLandmark(dungeonLandmark);
    sys.addLandmark(shrineLandmark);
    sys.discoverLandmark("old_fort");
    sys.completeLandmark("mara_shrine");

    const snap = sys.getSnapshot();
    const fort = snap.find((s) => s.id === "old_fort")!;
    const shrine = snap.find((s) => s.id === "mara_shrine")!;

    expect(fort.discovered).toBe(true);
    expect(fort.completed).toBe(false);
    expect(shrine.discovered).toBe(true); // auto-discovered on complete
    expect(shrine.completed).toBe(true);
  });

  it("restoreSnapshot re-applies flags without firing callbacks", () => {
    const sys = new LandmarkSystem();
    sys.addLandmark(dungeonLandmark);
    sys.addLandmark(shrineLandmark);

    const cb = vi.fn();
    sys.onLandmarkDiscovered = cb;
    sys.onLandmarkCompleted = cb;

    sys.restoreSnapshot([
      { id: "old_fort", discovered: true, completed: false },
      { id: "mara_shrine", discovered: true, completed: true },
    ]);

    expect(sys.isDiscovered("old_fort")).toBe(true);
    expect(sys.isCompleted("old_fort")).toBe(false);
    expect(sys.isDiscovered("mara_shrine")).toBe(true);
    expect(sys.isCompleted("mara_shrine")).toBe(true);
    // Callbacks must NOT fire during restore
    expect(cb).not.toHaveBeenCalled();
  });

  it("restoreSnapshot ignores unknown landmark ids", () => {
    const sys = new LandmarkSystem();
    sys.addLandmark(dungeonLandmark);
    expect(() =>
      sys.restoreSnapshot([{ id: "ghost_landmark", discovered: true, completed: false }])
    ).not.toThrow();
  });

  it("round-trip: snapshot then restore preserves state", () => {
    const sys = new LandmarkSystem();
    sys.addLandmark(dungeonLandmark);
    sys.addLandmark(shrineLandmark);
    sys.discoverLandmark("old_fort");
    sys.completeLandmark("mara_shrine");

    const snap = sys.getSnapshot();

    // Reset
    sys.clear();
    sys.addLandmark(dungeonLandmark);
    sys.addLandmark(shrineLandmark);

    sys.restoreSnapshot(snap);

    expect(sys.isDiscovered("old_fort")).toBe(true);
    expect(sys.isCompleted("old_fort")).toBe(false);
    expect(sys.isCompleted("mara_shrine")).toBe(true);
  });

  it("after restoreSnapshot, discoverLandmark is blocked for restored-discovered landmarks", () => {
    const sys = new LandmarkSystem();
    sys.addLandmark(dungeonLandmark);
    sys.restoreSnapshot([{ id: "old_fort", discovered: true, completed: false }]);

    const result = sys.discoverLandmark("old_fort");
    expect(result).toBeNull(); // already discovered
  });
});
