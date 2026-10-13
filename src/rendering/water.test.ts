import { describe, it, expect } from "vitest";
import { insidePond, pondDepthAt, type Pond } from "./water";

const pond: Pond = { x: 10, z: -5, radius: 8, depth: 1 };

describe("pond helpers", () => {
  it("is deepest in the middle and flat beyond the bank", () => {
    expect(pondDepthAt(pond, 0)).toBeCloseTo(1, 5);
    expect(pondDepthAt(pond, pond.radius * 1.2)).toBe(0);
    expect(pondDepthAt(pond, pond.radius * 0.8)).toBeLessThan(1);
    expect(pondDepthAt(pond, pond.radius * 0.8)).toBeGreaterThan(0);
  });

  it("deepens monotonically toward the centre", () => {
    let prev = -1;
    for (let d = pond.radius * 1.2; d >= 0; d -= 0.25) {
      const depth = pondDepthAt(pond, d);
      expect(depth).toBeGreaterThanOrEqual(prev);
      prev = depth;
    }
  });

  it("tests the footprint with a margin", () => {
    expect(insidePond(pond, 10, -5)).toBe(true);
    expect(insidePond(pond, 10 + 8.5, -5)).toBe(false);
    expect(insidePond(pond, 10 + 8.5, -5, 1)).toBe(true);
    expect(insidePond(null, 0, 0)).toBe(false);
  });
});
