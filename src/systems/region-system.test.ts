import { describe, it, expect, beforeEach, vi } from "vitest";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { RegionSystem } from "./region-system";
import type { RegionDefinition, RectRegionShape, SphereRegionShape } from "./region-system";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRect(
  id: string,
  min: { x: number; y: number; z: number },
  max: { x: number; y: number; z: number },
  opts: Partial<Pick<RegionDefinition, "name" | "owner" | "isVisible" | "isActive">> = {},
): RegionDefinition {
  return {
    id,
    name: opts.name ?? id,
    owner: opts.owner,
    shape: { type: "rect", min, max } satisfies RectRegionShape,
    isVisible: opts.isVisible ?? true,
    isActive: opts.isActive ?? true,
  };
}

function makeSphere(
  id: string,
  center: { x: number; y: number; z: number },
  radius: number,
  opts: Partial<Pick<RegionDefinition, "name" | "owner" | "isVisible" | "isActive">> = {},
): RegionDefinition {
  return {
    id,
    name: opts.name ?? id,
    owner: opts.owner,
    shape: { type: "sphere", center, radius } satisfies SphereRegionShape,
    isVisible: opts.isVisible ?? true,
    isActive: opts.isActive ?? true,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("RegionSystem — construction", () => {
  it("starts with zero regions", () => {
    const rs = new RegionSystem();
    expect(rs.count).toBe(0);
    expect(rs.getRegions()).toHaveLength(0);
  });
});

describe("RegionSystem — addRegion", () => {
  let rs: RegionSystem;

  beforeEach(() => {
    rs = new RegionSystem();
  });

  it("registers a rect region", () => {
    const def = makeRect("zone_a", { x: 0, y: 0, z: 0 }, { x: 100, y: 50, z: 100 });
    rs.addRegion(def);
    expect(rs.count).toBe(1);
    expect(rs.getRegion("zone_a")).toMatchObject({ id: "zone_a", isVisible: true, isActive: true });
  });

  it("registers a sphere region", () => {
    const def = makeSphere("zone_b", { x: 50, y: 0, z: 50 }, 40);
    rs.addRegion(def);
    expect(rs.count).toBe(1);
    const region = rs.getRegion("zone_b");
    expect(region?.shape.type).toBe("sphere");
  });

  it("defaults isVisible and isActive to true when omitted", () => {
    rs.addRegion({ id: "z", name: "Z", shape: { type: "rect", min: { x: 0, y: 0, z: 0 }, max: { x: 10, y: 10, z: 10 } } });
    const region = rs.getRegion("z");
    expect(region?.isVisible).toBe(true);
    expect(region?.isActive).toBe(true);
  });

  it("throws when registering duplicate id", () => {
    const def = makeRect("dup", { x: 0, y: 0, z: 0 }, { x: 10, y: 10, z: 10 });
    rs.addRegion(def);
    expect(() => rs.addRegion(def)).toThrow("already registered");
  });

  it("throws on invalid rect shape (min > max)", () => {
    expect(() => rs.addRegion(makeRect("bad", { x: 10, y: 0, z: 0 }, { x: 0, y: 10, z: 10 }))).toThrow();
  });

  it("throws on invalid sphere radius (zero)", () => {
    expect(() => rs.addRegion(makeSphere("bad", { x: 0, y: 0, z: 0 }, 0))).toThrow();
  });

  it("throws on invalid sphere radius (negative)", () => {
    expect(() => rs.addRegion(makeSphere("bad", { x: 0, y: 0, z: 0 }, -5))).toThrow();
  });
});

describe("RegionSystem — removeRegion", () => {
  let rs: RegionSystem;

  beforeEach(() => {
    rs = new RegionSystem();
    rs.addRegion(makeRect("zone_a", { x: 0, y: 0, z: 0 }, { x: 100, y: 50, z: 100 }));
  });

  it("removes a registered region", () => {
    rs.removeRegion("zone_a");
    expect(rs.count).toBe(0);
  });

  it("is a no-op for an unregistered id", () => {
    expect(() => rs.removeRegion("nonexistent")).not.toThrow();
    expect(rs.count).toBe(1); // zone_a still present
  });
});

describe("RegionSystem — updateRegion", () => {
  let rs: RegionSystem;

  beforeEach(() => {
    rs = new RegionSystem();
    rs.addRegion(makeRect("zone_a", { x: 0, y: 0, z: 0 }, { x: 100, y: 50, z: 100 }, { owner: "alice" }));
  });

  it("updates the region name", () => {
    rs.updateRegion("zone_a", { name: "Northern Pass" });
    expect(rs.getRegion("zone_a")?.name).toBe("Northern Pass");
  });

  it("updates the owner", () => {
    rs.updateRegion("zone_a", { owner: "bob" });
    expect(rs.getRegion("zone_a")?.owner).toBe("bob");
  });

  it("updates the shape", () => {
    const newShape: SphereRegionShape = { type: "sphere", center: { x: 50, y: 0, z: 50 }, radius: 30 };
    rs.updateRegion("zone_a", { shape: newShape });
    expect(rs.getRegion("zone_a")?.shape.type).toBe("sphere");
  });

  it("throws on invalid new shape", () => {
    expect(() => rs.updateRegion("zone_a", { shape: { type: "sphere", center: { x: 0, y: 0, z: 0 }, radius: -1 } })).toThrow();
  });

  it("throws when region does not exist", () => {
    expect(() => rs.updateRegion("unknown", { name: "X" })).toThrow("not registered");
  });
});

describe("RegionSystem — setVisible", () => {
  let rs: RegionSystem;

  beforeEach(() => {
    rs = new RegionSystem();
    rs.addRegion(makeRect("zone_a", { x: 0, y: 0, z: 0 }, { x: 100, y: 50, z: 100 }));
  });

  it("toggles visibility to false", () => {
    rs.setVisible("zone_a", false);
    expect(rs.getRegion("zone_a")?.isVisible).toBe(false);
  });

  it("fires onVisibilityChange callback", () => {
    const cb = vi.fn();
    rs.onVisibilityChange = cb;
    rs.setVisible("zone_a", false);
    expect(cb).toHaveBeenCalledWith("zone_a", false);
  });

  it("does not fire callback when visibility is unchanged", () => {
    const cb = vi.fn();
    rs.onVisibilityChange = cb;
    rs.setVisible("zone_a", true); // already true
    expect(cb).not.toHaveBeenCalled();
  });

  it("throws when region does not exist", () => {
    expect(() => rs.setVisible("unknown", false)).toThrow("not registered");
  });
});

describe("RegionSystem — setActive", () => {
  let rs: RegionSystem;

  beforeEach(() => {
    rs = new RegionSystem();
    rs.addRegion(makeRect("zone_a", { x: 0, y: 0, z: 0 }, { x: 100, y: 50, z: 100 }));
  });

  it("deactivates a region", () => {
    rs.setActive("zone_a", false);
    expect(rs.getRegion("zone_a")?.isActive).toBe(false);
  });

  it("fires onActiveChange callback", () => {
    const cb = vi.fn();
    rs.onActiveChange = cb;
    rs.setActive("zone_a", false);
    expect(cb).toHaveBeenCalledWith("zone_a", false);
  });

  it("does not fire callback when active state is unchanged", () => {
    const cb = vi.fn();
    rs.onActiveChange = cb;
    rs.setActive("zone_a", true); // already active
    expect(cb).not.toHaveBeenCalled();
  });

  it("notifies LOD system by tagging _regionActive map", () => {
    const fakeLod = {} as import("./lod-system").LodSystem;
    rs.setLodSystem(fakeLod);
    rs.setActive("zone_a", false);
    // After deactivation the LOD system should have the region marked inactive
    const lodAny = fakeLod as unknown as Record<string, unknown>;
    expect((lodAny._regionActive as Record<string, boolean>)["zone_a"]).toBe(false);
  });

  it("marks region active again in LOD after re-activation", () => {
    const fakeLod = {} as import("./lod-system").LodSystem;
    rs.setLodSystem(fakeLod);
    rs.setActive("zone_a", false);
    rs.setActive("zone_a", true);
    const lodAny = fakeLod as unknown as Record<string, unknown>;
    expect((lodAny._regionActive as Record<string, boolean>)["zone_a"]).toBe(true);
  });

  it("works without a LOD system attached", () => {
    expect(() => rs.setActive("zone_a", false)).not.toThrow();
  });

  it("throws when region does not exist", () => {
    expect(() => rs.setActive("unknown", false)).toThrow("not registered");
  });
});

describe("RegionSystem — getRegionAt (rect)", () => {
  let rs: RegionSystem;

  beforeEach(() => {
    rs = new RegionSystem();
    rs.addRegion(makeRect("zone_a", { x: 0, y: 0, z: 0 }, { x: 100, y: 50, z: 100 }));
  });

  it("returns the region when the point is inside", () => {
    expect(rs.getRegionAt(new Vector3(50, 25, 50))?.id).toBe("zone_a");
  });

  it("returns the region when the point is on the boundary (min corner)", () => {
    expect(rs.getRegionAt(new Vector3(0, 0, 0))?.id).toBe("zone_a");
  });

  it("returns the region when the point is on the boundary (max corner)", () => {
    expect(rs.getRegionAt(new Vector3(100, 50, 100))?.id).toBe("zone_a");
  });

  it("returns null when the point is outside", () => {
    expect(rs.getRegionAt(new Vector3(150, 0, 0))).toBeNull();
  });

  it("returns null when no regions are registered", () => {
    const empty = new RegionSystem();
    expect(empty.getRegionAt(new Vector3(0, 0, 0))).toBeNull();
  });
});

describe("RegionSystem — getRegionAt (sphere)", () => {
  let rs: RegionSystem;

  beforeEach(() => {
    rs = new RegionSystem();
    rs.addRegion(makeSphere("zone_b", { x: 0, y: 0, z: 0 }, 50));
  });

  it("returns the region when the point is inside the sphere", () => {
    expect(rs.getRegionAt(new Vector3(10, 10, 10))?.id).toBe("zone_b");
  });

  it("returns the region when the point is exactly on the surface", () => {
    expect(rs.getRegionAt(new Vector3(50, 0, 0))?.id).toBe("zone_b");
  });

  it("returns null when the point is outside the sphere", () => {
    expect(rs.getRegionAt(new Vector3(60, 0, 0))).toBeNull();
  });
});

describe("RegionSystem — getRegionsAt (overlapping regions)", () => {
  it("returns all overlapping regions sorted in insertion order", () => {
    const rs = new RegionSystem();
    rs.addRegion(makeRect("big", { x: 0, y: 0, z: 0 }, { x: 200, y: 200, z: 200 }));
    rs.addRegion(makeRect("small", { x: 50, y: 50, z: 50 }, { x: 100, y: 100, z: 100 }));
    const found = rs.getRegionsAt(new Vector3(75, 75, 75));
    expect(found.map(r => r.id)).toEqual(["big", "small"]);
  });

  it("returns empty array when point is outside all regions", () => {
    const rs = new RegionSystem();
    rs.addRegion(makeRect("zone_a", { x: 0, y: 0, z: 0 }, { x: 50, y: 50, z: 50 }));
    expect(rs.getRegionsAt(new Vector3(200, 200, 200))).toHaveLength(0);
  });
});

describe("RegionSystem — isPointInActiveRegion", () => {
  let rs: RegionSystem;

  beforeEach(() => {
    rs = new RegionSystem();
    rs.addRegion(makeRect("zone_a", { x: 0, y: 0, z: 0 }, { x: 100, y: 50, z: 100 }));
  });

  it("returns true when point is inside an active region", () => {
    expect(rs.isPointInActiveRegion(new Vector3(50, 25, 50))).toBe(true);
  });

  it("returns false when the containing region is inactive", () => {
    rs.setActive("zone_a", false);
    expect(rs.isPointInActiveRegion(new Vector3(50, 25, 50))).toBe(false);
  });

  it("returns false when point is outside all regions", () => {
    expect(rs.isPointInActiveRegion(new Vector3(500, 0, 500))).toBe(false);
  });
});

describe("RegionSystem — snapshot / restore", () => {
  it("round-trips a snapshot containing multiple regions", () => {
    const rs = new RegionSystem();
    rs.addRegion(makeRect("r1", { x: 0, y: 0, z: 0 }, { x: 50, y: 20, z: 50 }, { owner: "alice" }));
    rs.addRegion(makeSphere("r2", { x: 100, y: 0, z: 100 }, 30));
    rs.setVisible("r2", false);
    rs.setActive("r2", false);

    const snap = rs.getSnapshot();
    const rs2 = new RegionSystem();
    rs2.restoreSnapshot(snap);

    expect(rs2.count).toBe(2);
    const r1 = rs2.getRegion("r1")!;
    expect(r1.owner).toBe("alice");
    expect(r1.shape.type).toBe("rect");
    const r2 = rs2.getRegion("r2")!;
    expect(r2.isVisible).toBe(false);
    expect(r2.isActive).toBe(false);
    expect(r2.shape.type).toBe("sphere");
  });

  it("restoreSnapshot clears existing regions before restoring", () => {
    const rs = new RegionSystem();
    rs.addRegion(makeRect("old", { x: 0, y: 0, z: 0 }, { x: 10, y: 10, z: 10 }));

    const emptySnap = { regions: [] };
    rs.restoreSnapshot(emptySnap);
    expect(rs.count).toBe(0);
  });

  it("restoreSnapshot silently skips invalid entries", () => {
    const rs = new RegionSystem();
    const snap = {
      regions: [
        { id: "good", name: "Good", shape: { type: "rect" as const, min: { x: 0, y: 0, z: 0 }, max: { x: 10, y: 10, z: 10 } }, isVisible: true, isActive: true },
        // bad: sphere with radius = 0
        { id: "bad", name: "Bad", shape: { type: "sphere" as const, center: { x: 0, y: 0, z: 0 }, radius: 0 }, isVisible: true, isActive: true },
      ],
    };
    expect(() => rs.restoreSnapshot(snap)).not.toThrow();
    expect(rs.count).toBe(1);
    expect(rs.getRegion("good")).toBeDefined();
    expect(rs.getRegion("bad")).toBeUndefined();
  });
});

describe("RegionSystem — getRegions", () => {
  it("returns all regions in insertion order", () => {
    const rs = new RegionSystem();
    rs.addRegion(makeRect("a", { x: 0, y: 0, z: 0 }, { x: 10, y: 10, z: 10 }));
    rs.addRegion(makeRect("b", { x: 20, y: 0, z: 0 }, { x: 30, y: 10, z: 10 }));
    rs.addRegion(makeRect("c", { x: 40, y: 0, z: 0 }, { x: 50, y: 10, z: 10 }));
    const ids = rs.getRegions().map(r => r.id);
    expect(ids).toEqual(["a", "b", "c"]);
  });
});

describe("RegionSystem — setLodSystem", () => {
  it("accepts null to detach a LOD system", () => {
    const rs = new RegionSystem();
    rs.addRegion(makeRect("zone_a", { x: 0, y: 0, z: 0 }, { x: 10, y: 10, z: 10 }));
    const fakeLod = {} as import("./lod-system").LodSystem;
    rs.setLodSystem(fakeLod);
    rs.setLodSystem(null);
    // After detaching, setActive should not throw
    expect(() => rs.setActive("zone_a", false)).not.toThrow();
  });
});
