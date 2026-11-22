import { describe, it, expect } from "vitest";
import { ASSET_GRADE, WORLD_GRADE, gradeRgb01, gradeRgb255InPlace } from "./dark-grade";

const sat = ([r, g, b]: number[]) => Math.max(r, g, b) - Math.min(r, g, b);
const lum = ([r, g, b]: number[]) => 0.299 * r + 0.587 * g + 0.114 * b;

describe("dark-fantasy grade", () => {
  it("desaturates and darkens a vivid colour", () => {
    const vivid = [0.2, 0.8, 0.2];
    const out = gradeRgb01(vivid);
    expect(sat(out)).toBeLessThan(sat(vivid) * 0.6);
    expect(lum(out)).toBeLessThan(lum(vivid));
  });

  it("tints shadows cold and highlights warm", () => {
    const shadow = gradeRgb01([0.1, 0.1, 0.1]);
    expect(shadow[2]).toBeGreaterThan(shadow[0]);
    const highlight = gradeRgb01([0.95, 0.95, 0.95]);
    expect(highlight[0]).toBeGreaterThan(highlight[2]);
  });

  it("keeps channels in [0, 1]", () => {
    for (const c of [[0, 0, 0], [1, 1, 1], [1, 0, 0], [0, 0, 1]]) {
      for (const v of gradeRgb01(c)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it("the world grade is gentler than the asset grade", () => {
    const c = [0.3, 0.6, 0.2];
    expect(sat(gradeRgb01(c, WORLD_GRADE))).toBeGreaterThan(sat(gradeRgb01(c, ASSET_GRADE)));
  });

  it("matches the asset tools' curve (tools/grade-kaykit-textures.mjs)", async () => {
    const tool = await import("../../tools/grade-kaykit-textures.mjs");
    for (const c of [[0.2, 0.5, 0.8], [0.9, 0.3, 0.1], [0.05, 0.05, 0.06]]) {
      const a = tool.gradeColor(c) as number[];
      const b = gradeRgb01(c, ASSET_GRADE);
      for (let k = 0; k < 3; k++) expect(b[k]).toBeCloseTo(a[k], 6);
    }
  });

  it("grades 0-255 triples in place", () => {
    const rgb = [96, 128, 48];
    gradeRgb255InPlace(rgb);
    expect(sat(rgb)).toBeLessThan(80);
    expect(rgb.every((v) => v >= 0 && v <= 255)).toBe(true);
  });
});
