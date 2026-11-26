import { describe, expect, it } from "vitest";
import { asyncWork } from "./async-work";
import { simClock } from "./sim-clock";

describe("asyncWork (deterministic mode)", () => {
  it("releases results in the order the work began, whatever order it finished in", async () => {
    asyncWork.deterministic = true;
    try {
      const seen: string[] = [];
      let finishA!: (v: string) => void, finishB!: (v: string) => void;
      const a = asyncWork.ordered(new Promise<string>((r) => { finishA = r; })).then((v) => { seen.push(v); });
      const b = asyncWork.ordered(new Promise<string>((r) => { finishB = r; })).then((v) => { seen.push(v); });
      finishB("b");
      await new Promise((r) => setTimeout(r, 5));
      expect(seen, "held back until settled").toEqual([]);
      setTimeout(() => finishA("a"), 5);
      await asyncWork.settle();
      await Promise.all([a, b]);
      expect(seen).toEqual(["a", "b"]);
      expect(asyncWork.pending).toBe(0);
    } finally {
      asyncWork.deterministic = false;
    }
  });

  it("is a pass-through normally", async () => {
    const p = Promise.resolve(1);
    expect(asyncWork.ordered(p)).toBe(p);
  });
});

describe("simClock", () => {
  it("in frame time, timers fire on the frame that reaches them, in order", () => {
    let frame = 0;
    simClock.useFrameTime(() => frame * 16);
    const fired: string[] = [];
    simClock.after(40, () => fired.push("late"));
    simClock.after(20, () => fired.push("early"));
    frame = 2; simClock.runDue();
    expect(fired).toEqual(["early"]);
    frame = 3; simClock.runDue();
    expect(fired).toEqual(["early", "late"]);
    expect(simClock.now()).toBe(48);
  });
});
