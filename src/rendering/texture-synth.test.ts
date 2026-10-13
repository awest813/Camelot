import { describe, it, expect } from "vitest";
import { synthesizeSurface, heightToNormalMap, SURFACE_KINDS, TileableNoise } from "./texture-synth";

describe("texture-synth", () => {
  it("produces correctly sized buffers for every surface", () => {
    for (const kind of SURFACE_KINDS) {
      const s = synthesizeSurface(kind, 32);
      expect(s.albedo.length).toBe(32 * 32 * 4);
      expect(s.height.length).toBe(32 * 32);
    }
  });

  it("is deterministic for a seed", () => {
    const a = synthesizeSurface("rock", 32, 3);
    const b = synthesizeSurface("rock", 32, 3);
    expect(Array.from(a.albedo)).toEqual(Array.from(b.albedo));
  });

  it("generates periodic noise that wraps", () => {
    const n = new TileableNoise(5);
    for (let i = 0; i < 20; i++) {
      const v = i / 20;
      expect(n.fbm(0, v, 4, 4)).toBeCloseTo(n.fbm(1, v, 4, 4), 6);
      expect(n.fbm(v, 0, 4, 4)).toBeCloseTo(n.fbm(v, 1, 4, 4), 6);
    }
  });

  it("tiles seamlessly: the wrap-around step looks like any other step", () => {
    const size = 128;
    for (const kind of ["snow", "bark_timber", "iron_metal", "stone_ruins"] as const) {
      const s = synthesizeSurface(kind, size);
      const rowDiff = (r0: number, r1: number) => {
        let d = 0;
        for (let x = 0; x < size; x++) d += Math.abs(s.height[r0 * size + x] - s.height[r1 * size + x]);
        return d / size;
      };
      const colDiff = (c0: number, c1: number) => {
        let d = 0;
        for (let y = 0; y < size; y++) d += Math.abs(s.height[y * size + c0] - s.height[y * size + c1]);
        return d / size;
      };
      let typicalRow = 0, typicalCol = 0;
      for (let i = 0; i < size - 1; i++) { typicalRow += rowDiff(i, i + 1); typicalCol += colDiff(i, i + 1); }
      typicalRow /= size - 1;
      typicalCol /= size - 1;
      expect(rowDiff(size - 1, 0)).toBeLessThan(typicalRow * 3 + 0.01);
      expect(colDiff(size - 1, 0)).toBeLessThan(typicalCol * 3 + 0.01);
    }
  });

  it("uses alpha only on cut-out surfaces", () => {
    const leaf = synthesizeSurface("leaf_card", 32);
    const rock = synthesizeSurface("rock", 32);
    expect(leaf.hasAlpha).toBe(true);
    expect(rock.hasAlpha).toBe(false);
    const alphas = new Set<number>();
    for (let i = 3; i < leaf.albedo.length; i += 4) alphas.add(leaf.albedo[i]);
    expect(alphas.has(0)).toBe(true);
    expect(alphas.has(255)).toBe(true);
  });

  it("encodes a flat height field as an up-facing normal map", () => {
    const flat = new Float32Array(16 * 16).fill(0.5);
    const nm = heightToNormalMap(flat, 16, 2);
    expect(nm[0]).toBe(128);
    expect(nm[1]).toBe(128);
    expect(nm[2]).toBe(255);
  });
});
