import { describe, it, expect } from "vitest";
import { biomeWeightsAt } from "./terrain-material";
import type { BiomeType } from "../world/world-manager";

const checker = (cx: number, cz: number): BiomeType => ((cx + cz) % 2 === 0 ? "plains" : "desert");

describe("biomeWeightsAt", () => {
  it("is pure at a chunk centre", () => {
    const w = biomeWeightsAt(0, 0, 50, checker);
    expect(w).toEqual([1, 0, 0, 0]);
    const d = biomeWeightsAt(50, 0, 50, checker);
    expect(d[2]).toBeCloseTo(1, 6);
  });

  it("always sums to one", () => {
    for (let x = -80; x <= 80; x += 7) {
      for (let z = -80; z <= 80; z += 11) {
        const w = biomeWeightsAt(x, z, 50, checker);
        expect(w[0] + w[1] + w[2] + w[3]).toBeCloseTo(1, 6);
      }
    }
  });

  it("cross-fades 50/50 on the shared chunk edge", () => {
    const w = biomeWeightsAt(25, 0, 50, checker);
    expect(w[0]).toBeCloseTo(0.5, 2);
    expect(w[2]).toBeCloseTo(0.5, 2);
  });
});
