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
