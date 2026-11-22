import { describe, it, expect } from "vitest";
import { buildingLayout, buildingFootprint, toWorld, WALL_HEIGHT } from "./village-buildings";

describe("village building layouts", () => {
  for (const kind of ["cottage", "house", "inn"] as const) {
    it(`${kind}: closed walls on every side with exactly one door`, () => {
      const layout = buildingLayout(kind);
      const { width, depth } = buildingFootprint(kind);
      const walls = layout.filter((p) => p.key.startsWith("vWall"));
      // Perimeter in 2 m segments.
      expect(walls).toHaveLength((width + depth) / 2 * 2);
      expect(layout.filter((p) => p.key.startsWith("vWall") && p.key.endsWith("Door"))).toHaveLength(1);
      expect(layout.filter((p) => p.key === "vDoor")).toHaveLength(1);
      // Every wall sits on the footprint edge, facing outward.
      for (const w of walls) {
        const outX = Math.round(Math.sin(w.rotY)), outZ = Math.round(Math.cos(w.rotY));
        if (outZ !== 0) expect(w.z).toBeCloseTo((outZ * depth) / 2);
        if (outX !== 0) expect(w.x).toBeCloseTo((outX * width) / 2);
      }
    });

    it(`${kind}: roof and both gables on top of the walls, floor fully tiled`, () => {
      const layout = buildingLayout(kind);
      const { width, depth } = buildingFootprint(kind);
      const roofParts = layout.filter((p) => p.key.startsWith("vRoof") || p.key.startsWith("vGable"));
      expect(roofParts).toHaveLength(3);
      for (const r of roofParts) expect(r.y).toBe(WALL_HEIGHT);
      expect(layout.filter((p) => p.key === "vFloorWood")).toHaveLength((width / 2) * (depth / 2));
    });
  }

  it("the door faces +Z (toward the site's people and props)", () => {
    const door = buildingLayout("inn").find((p) => p.key === "vDoor")!;
    expect(door.z).toBeGreaterThan(0);
    expect(door.rotY).toBe(0);
  });

  it("toWorld follows Babylon's rotation.y convention", () => {
    // A point 1 m in front (+Z) of a building turned 90° ends up at +X.
    const w = toWorld({ x: 0, z: 1 }, { x: 10, z: 20, rot: Math.PI / 2 });
    expect(w.x).toBeCloseTo(11);
    expect(w.z).toBeCloseTo(20);
  });
});

describe("buildingWallColliders", () => {
  it("walls every side but leaves the doorway open", async () => {
    const { buildingWallColliders, buildingFootprint, DOOR_HALF } = await import("./village-buildings");
    for (const kind of ["cottage", "house", "inn"] as const) {
      const { width, depth } = buildingFootprint(kind);
      const cols = buildingWallColliders(kind);
      const front = cols.filter((c) => Math.abs(c.z - depth / 2) < 1e-6);
      expect(front).toHaveLength(2);
      // The two front pieces cover the front except a door-sized gap.
      const covered = front.reduce((n, c) => n + c.width, 0);
      expect(width - covered).toBeGreaterThan(DOOR_HALF * 2);
      expect(width - covered).toBeLessThan(DOOR_HALF * 2 + 0.3);
      // Back and sides span the full footprint.
      expect(cols.some((c) => Math.abs(c.z + depth / 2) < 1e-6 && Math.abs(c.width - width) < 1e-6)).toBe(true);
      expect(cols.filter((c) => Math.abs(Math.abs(c.x) - width / 2) < 1e-6 && Math.abs(c.depth - depth) < 1e-6)).toHaveLength(2);
      // Nothing covers the middle of the floor.
      expect(cols.some((c) => Math.abs(c.x) < c.width / 2 && Math.abs(c.z) < c.depth / 2)).toBe(false);
    }
  });
});
