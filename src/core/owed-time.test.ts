import { describe, it, expect } from "vitest";
import { OwedTime } from "./owed-time";

describe("OwedTime", () => {
  it("a system run every 3rd step is given the three steps' time", () => {
    const o = new OwedTime();
    let given = 0;
    for (let step = 1; step <= 6; step++) {
      o.pass(1 / 60, "swim");
      if (step % 3 === 0) given += o.take("swim");
    }
    expect(given).toBeCloseTo(6 / 60);
  });
});
