import { describe, it, expect } from "vitest";
import { AdaptiveResolution } from "./adaptive-resolution";

const run = (ar: AdaptiveResolution, fps: number, seconds: number) => {
  for (let t = 0; t < seconds; t += 0.1) ar.update(0.1, fps);
};

describe("AdaptiveResolution", () => {
  it("holds the base level when on target", () => {
    const ar = new AdaptiveResolution({ baseLevel: 1, targetFps: 60 });
    run(ar, 60, 20);
    expect(ar.level).toBe(1);
  });

  it("lowers resolution when slow, bounded by maxLevel", () => {
    const ar = new AdaptiveResolution({ baseLevel: 1, targetFps: 60, maxLevel: 1.5 });
    run(ar, 25, 60);
    expect(ar.level).toBeCloseTo(1.5, 5);
  });

  it("recovers toward the base when there is headroom", () => {
    const ar = new AdaptiveResolution({ baseLevel: 1, targetFps: 60, maxLevel: 1.5 });
    run(ar, 30, 30);
    const low = ar.level;
    run(ar, 90, 60);
    expect(low).toBeGreaterThan(1);
    expect(ar.level).toBe(1);
  });

  it("waits out the warm-up (shader compiles, chunk streaming)", () => {
    const ar = new AdaptiveResolution({ baseLevel: 1, targetFps: 60 });
    run(ar, 10, 3);
    expect(ar.level).toBe(1);
  });

  it("ignores garbage input and can be disabled", () => {
    const ar = new AdaptiveResolution({ baseLevel: 1, targetFps: 60 });
    expect(ar.update(0.1, NaN)).toBeNull();
    ar.enabled = false;
    run(ar, 5, 30);
    expect(ar.level).toBe(1);
  });
});
