/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { measure } from "./check-guardrails.mjs";

describe("architecture guardrails", () => {
  it("the framework layer stays free of Babylon imports", () => {
    const report = measure();
    expect(report.violations).toEqual([]);
  });

  it("counts the ratcheted metrics", () => {
    const { counts } = measure();
    for (const key of ["game-ts-lines", "composition-root-lines", "unseeded-random", "callback-properties", "babylon-gui-files"]) {
      expect(typeof counts[key]).toBe("number");
    }
    expect(counts["game-ts-lines"]).toBeGreaterThan(10);
    expect(counts["composition-root-lines"]).toBeGreaterThan(counts["game-ts-lines"]);
  });
});

describe("borrowed-names", () => {
  it("counts whole words in any case, apostrophes included, and nothing inside other words", async () => {
    const { countBorrowed } = await import("./check-guardrails.mjs");
    expect(countBorrowed("A Nord, a nord and a NORD")).toBe(3);
    expect(countBorrowed("J'zargo uses the Thu'um")).toBe(2);
    expect(countBorrowed("Petty Soul Gem, two soul gems")).toBe(2);
    expect(countBorrowed("Nordic north, Bretony, normal")).toBe(0);
  });
});
