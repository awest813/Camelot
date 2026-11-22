import { describe, it, expect } from "vitest";
import { UniformCache } from "./uniform-cache";

describe("UniformCache", () => {
  it("keeps a separate, reused object per uniform name", () => {
    const u = new UniformCache();
    const a = u.color("zenith", 0.1, 0.2, 0.3);
    const b = u.color("horizon", 0.5, 0.5, 0.5);
    expect(a).not.toBe(b);
    expect(a.asArray()).toEqual([0.1, 0.2, 0.3]); // not overwritten by "horizon"
    expect(u.color("zenith", 0.4, 0.4, 0.4)).toBe(a);
    const v = u.vec3("sunDir", 0, 1, 0);
    expect(u.vec3("moonDir", 0, -1, 0)).not.toBe(v);
    expect(v.y).toBe(1);
  });
});
