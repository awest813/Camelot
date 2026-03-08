import { describe, expect, it, vi } from "vitest";
import { FixedStepLoop } from "./fixed-step-loop";

describe("FixedStepLoop", () => {
  it("emits fixed steps for a variable frame delta", () => {
    const loop = new FixedStepLoop({ fixedDeltaSeconds: 1 / 60 });
    const onStep = vi.fn();

    const steps = loop.tick(0.05, onStep);

    expect(steps).toBe(3);
    expect(onStep).toHaveBeenCalledTimes(3);
    expect(onStep).toHaveBeenCalledWith(1 / 60);
    expect(loop.alpha).toBeGreaterThan(0);
  });

  it("limits sub-steps per frame to avoid spiral of death", () => {
    const loop = new FixedStepLoop({ fixedDeltaSeconds: 1 / 60, maxSubSteps: 2 });
    const onStep = vi.fn();

    const steps = loop.tick(0.2, onStep);

    expect(steps).toBe(2);
    expect(onStep).toHaveBeenCalledTimes(2);
    expect(loop.alpha).toBeLessThanOrEqual(1);
  });

  it("ignores invalid frame delta values", () => {
    const loop = new FixedStepLoop();
    const onStep = vi.fn();

    expect(loop.tick(-1, onStep)).toBe(0);
    expect(loop.tick(Number.NaN, onStep)).toBe(0);
    expect(onStep).not.toHaveBeenCalled();
  });
});
