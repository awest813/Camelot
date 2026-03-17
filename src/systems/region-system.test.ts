import { describe, it, expect, vi, beforeEach } from "vitest";
import { RegionSystem } from "./region-system";
import type { RegionDefinition } from "./region-system";

// ── Fixture helpers ───────────────────────────────────────────────────────────

const rectRegion: RegionDefinition = {
  id: "forest",
  name: "Forest",
  description: "Dense woodland to the north.",
  shape: {
    type: "rect",
    min: { x: 0, y: 0, z: 0 },
    max: { x: 100, y: 50, z: 100 },
  },
};

const sphereRegion: RegionDefinition = {
  id: "dungeon",
  name: "Dungeon",
  shape: {
    type: "sphere",
    center: { x: 200, y: 0, z: 200 },
    radius: 50,
  },
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("RegionSystem — CRUD", () => {
  it("registers a region and retrieves its definition", () => {
    const sys = new RegionSystem();
    sys.addRegion(rectRegion);
    expect(sys.getRegion("forest")).toEqual(rectRegion);
  });

  it("replaces an existing region with the same id", () => {
    const sys = new RegionSystem();
    sys.addRegion(rectRegion);
    const updated: RegionDefinition = {
      ...rectRegion,
      name: "Dense Forest",
    };
    sys.addRegion(updated);
    expect(sys.getRegion("forest")?.name).toBe("Dense Forest");
    expect(sys.regions).toHaveLength(1);
  });

  it("removes a region by id", () => {
    const sys = new RegionSystem();
    sys.addRegion(rectRegion);
    sys.removeRegion("forest");
    expect(sys.getRegion("forest")).toBeUndefined();
    expect(sys.regions).toHaveLength(0);
  });

  it("safe to remove an unknown region", () => {
    const sys = new RegionSystem();
    expect(() => sys.removeRegion("nonexistent")).not.toThrow();
  });

  it("lists all registered regions", () => {
    const sys = new RegionSystem();
    sys.addRegion(rectRegion);
    sys.addRegion(sphereRegion);
    expect(sys.regions).toHaveLength(2);
    expect(sys.regions.map((r) => r.id)).toContain("forest");
    expect(sys.regions.map((r) => r.id)).toContain("dungeon");
  });

  it("clear() removes all regions", () => {
    const sys = new RegionSystem();
    sys.addRegion(rectRegion);
    sys.addRegion(sphereRegion);
    sys.clear();
    expect(sys.regions).toHaveLength(0);
  });
});

describe("RegionSystem — visibility and active toggles", () => {
  let sys: RegionSystem;

  beforeEach(() => {
    sys = new RegionSystem();
    sys.addRegion(rectRegion);
  });

  it("new regions start visible and active", () => {
    expect(sys.isVisible("forest")).toBe(true);
    expect(sys.isActive("forest")).toBe(true);
  });

  it("setVisible hides a region", () => {
    sys.setVisible("forest", false);
    expect(sys.isVisible("forest")).toBe(false);
  });

  it("setActive deactivates a region", () => {
    sys.setActive("forest", false);
    expect(sys.isActive("forest")).toBe(false);
  });

  it("unknown region is treated as visible/active", () => {
    expect(sys.isVisible("nowhere")).toBe(true);
    expect(sys.isActive("nowhere")).toBe(true);
  });

  it("setVisible on unknown region does not throw", () => {
    expect(() => sys.setVisible("nowhere", false)).not.toThrow();
  });

  it("setActive on unknown region does not throw", () => {
    expect(() => sys.setActive("nowhere", false)).not.toThrow();
  });

  it("fires onVisibilityChange callback", () => {
    const cb = vi.fn();
    sys.onVisibilityChange = cb;
    sys.setVisible("forest", false);
    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith("forest", false);
  });

  it("fires onActiveChange callback", () => {
    const cb = vi.fn();
    sys.onActiveChange = cb;
    sys.setActive("forest", false);
    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith("forest", false);
  });

  it("does not fire onVisibilityChange when value is unchanged", () => {
    const cb = vi.fn();
    sys.onVisibilityChange = cb;
    sys.setVisible("forest", true); // already true
    expect(cb).not.toHaveBeenCalled();
  });

  it("does not fire onActiveChange when value is unchanged", () => {
    const cb = vi.fn();
    sys.onActiveChange = cb;
    sys.setActive("forest", true); // already true
    expect(cb).not.toHaveBeenCalled();
  });
});

describe("RegionSystem — spatial queries (rect)", () => {
  let sys: RegionSystem;

  beforeEach(() => {
    sys = new RegionSystem();
    sys.addRegion(rectRegion); // [0,100]³ y-clamped [0,50]
  });

  it("point at origin is inside the rect region", () => {
    expect(sys.getRegionsAtPoint(0, 0, 0)).toContain("forest");
  });

  it("point at max corner is inside (boundary inclusive)", () => {
    expect(sys.getRegionsAtPoint(100, 50, 100)).toContain("forest");
  });

  it("point at center is inside", () => {
    expect(sys.getRegionsAtPoint(50, 25, 50)).toContain("forest");
  });

  it("point outside on x-axis is not inside", () => {
    expect(sys.getRegionsAtPoint(101, 25, 50)).not.toContain("forest");
  });

  it("point outside on y-axis is not inside", () => {
    expect(sys.getRegionsAtPoint(50, 51, 50)).not.toContain("forest");
  });

  it("point outside on z-axis is not inside", () => {
    expect(sys.getRegionsAtPoint(50, 25, 101)).not.toContain("forest");
  });

  it("point with negative coords is not inside", () => {
    expect(sys.getRegionsAtPoint(-1, 25, 50)).not.toContain("forest");
  });

  it("returns empty array when no region contains the point", () => {
    expect(sys.getRegionsAtPoint(500, 500, 500)).toEqual([]);
  });
});

describe("RegionSystem — spatial queries (sphere)", () => {
  let sys: RegionSystem;

  beforeEach(() => {
    sys = new RegionSystem();
    sys.addRegion(sphereRegion); // center (200, 0, 200) radius 50
  });

  it("point at center is inside", () => {
    expect(sys.getRegionsAtPoint(200, 0, 200)).toContain("dungeon");
  });

  it("point on surface is inside (boundary inclusive)", () => {
    expect(sys.getRegionsAtPoint(250, 0, 200)).toContain("dungeon");
  });

  it("point just outside radius is not inside", () => {
    expect(sys.getRegionsAtPoint(251, 0, 200)).not.toContain("dungeon");
  });

  it("diagonal point within radius is inside", () => {
    // distance from center: sqrt(30²+30²+30²) ≈ 51.96 > 50 — outside
    expect(sys.getRegionsAtPoint(230, 30, 230)).not.toContain("dungeon");
  });

  it("diagonal point within radius is inside (closer)", () => {
    // distance: sqrt(20²+20²+20²) ≈ 34.6 < 50 — inside
    expect(sys.getRegionsAtPoint(220, 20, 220)).toContain("dungeon");
  });
});

describe("RegionSystem — multi-region overlap", () => {
  it("returns multiple region ids when point is in several regions", () => {
    const sys = new RegionSystem();
    sys.addRegion(rectRegion); // [0,100]³
    const inner: RegionDefinition = {
      id: "clearing",
      name: "Clearing",
      shape: {
        type: "rect",
        min: { x: 40, y: 0, z: 40 },
        max: { x: 60, y: 50, z: 60 },
      },
    };
    sys.addRegion(inner);
    const hits = sys.getRegionsAtPoint(50, 25, 50);
    expect(hits).toContain("forest");
    expect(hits).toContain("clearing");
    expect(hits).toHaveLength(2);
  });
});

describe("RegionSystem — active/inactive region lists", () => {
  it("getActiveRegionIds returns all region ids when all active", () => {
    const sys = new RegionSystem();
    sys.addRegion(rectRegion);
    sys.addRegion(sphereRegion);
    expect(sys.getActiveRegionIds()).toHaveLength(2);
  });

  it("getInactiveRegionIds is empty when all active", () => {
    const sys = new RegionSystem();
    sys.addRegion(rectRegion);
    expect(sys.getInactiveRegionIds()).toHaveLength(0);
  });

  it("getInactiveRegionIds includes deactivated regions", () => {
    const sys = new RegionSystem();
    sys.addRegion(rectRegion);
    sys.addRegion(sphereRegion);
    sys.setActive("forest", false);
    const inactive = sys.getInactiveRegionIds();
    expect(inactive).toContain("forest");
    expect(inactive).not.toContain("dungeon");
  });

  it("getActiveRegionIds excludes deactivated regions", () => {
    const sys = new RegionSystem();
    sys.addRegion(rectRegion);
    sys.addRegion(sphereRegion);
    sys.setActive("forest", false);
    const active = sys.getActiveRegionIds();
    expect(active).not.toContain("forest");
    expect(active).toContain("dungeon");
  });
});

describe("RegionSystem — snapshot / restore", () => {
  it("getSnapshot captures current flags", () => {
    const sys = new RegionSystem();
    sys.addRegion(rectRegion);
    sys.addRegion(sphereRegion);
    sys.setVisible("forest", false);
    sys.setActive("dungeon", false);

    const snap = sys.getSnapshot();
    const forestSnap = snap.find((s) => s.id === "forest")!;
    const dungeonSnap = snap.find((s) => s.id === "dungeon")!;

    expect(forestSnap.visible).toBe(false);
    expect(forestSnap.active).toBe(true);
    expect(dungeonSnap.visible).toBe(true);
    expect(dungeonSnap.active).toBe(false);
  });

  it("restoreSnapshot re-applies flags", () => {
    const sys = new RegionSystem();
    sys.addRegion(rectRegion);
    sys.addRegion(sphereRegion);

    sys.restoreSnapshot([
      { id: "forest",  visible: false, active: true  },
      { id: "dungeon", visible: true,  active: false },
    ]);

    expect(sys.isVisible("forest")).toBe(false);
    expect(sys.isActive("dungeon")).toBe(false);
  });

  it("restoreSnapshot fires callbacks for changed values", () => {
    const sys = new RegionSystem();
    sys.addRegion(rectRegion);
    const visCb = vi.fn();
    const actCb = vi.fn();
    sys.onVisibilityChange = visCb;
    sys.onActiveChange = actCb;

    sys.restoreSnapshot([{ id: "forest", visible: false, active: false }]);
    expect(visCb).toHaveBeenCalledWith("forest", false);
    expect(actCb).toHaveBeenCalledWith("forest", false);
  });

  it("restoreSnapshot ignores unknown region ids", () => {
    const sys = new RegionSystem();
    sys.addRegion(rectRegion);
    expect(() =>
      sys.restoreSnapshot([{ id: "ghost_region", visible: false, active: false }])
    ).not.toThrow();
  });

  it("round-trip: snapshot then restore preserves state", () => {
    const sys = new RegionSystem();
    sys.addRegion(rectRegion);
    sys.addRegion(sphereRegion);
    sys.setVisible("forest", false);
    sys.setActive("dungeon", false);

    const snap = sys.getSnapshot();

    // Reset to defaults
    sys.setVisible("forest", true);
    sys.setActive("dungeon", true);

    // Restore
    sys.restoreSnapshot(snap);
    expect(sys.isVisible("forest")).toBe(false);
    expect(sys.isActive("dungeon")).toBe(false);
  });
});
