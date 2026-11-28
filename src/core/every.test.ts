import { describe, expect, it } from "vitest";
import { every } from "./every";

describe("every", () => {
  it("runs at once, then at most once per period", () => {
    let n = 0;
    const tick = every(0.25, () => { n++; });
    tick(0.016);
    expect(n).toBe(1);
    for (let i = 0; i < 10; i++) tick(0.016);
    expect(n).toBe(1);
    tick(0.2);
    expect(n).toBe(2);
  });
});
