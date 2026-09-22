import { describe, it, expect } from "vitest";
import {
  generatePoissonPoints,
  createMulberry32,
  type PoissonBounds,
} from "./poisson-disk";

describe("Poisson Disk Sampling (Bridson)", () => {
  it("enforces minimum distance constraint between all generated points", () => {
    const bounds: PoissonBounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    const minDistance = 10;
    const prng = createMulberry32(12345);

    const points = generatePoissonPoints(bounds, minDistance, { prng });

    expect(points.length).toBeGreaterThan(10);

    const minDistSq = minDistance * minDistance;
    // Tolerance for floating point inaccuracy (0.999 * minDistSq)
    const thresholdSq = minDistSq * 0.999;

    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const dx = points[i].x - points[j].x;
        const dy = points[i].y - points[j].y;
        const distSq = dx * dx + dy * dy;
        expect(distSq).toBeGreaterThanOrEqual(thresholdSq);
      }
    }
  });

  it("contains all generated points strictly within bounding box", () => {
    const bounds: PoissonBounds = { minX: -50, minY: 20, maxX: 50, maxY: 80 };
    const minDistance = 5;
    const prng = createMulberry32(42);

    const points = generatePoissonPoints(bounds, minDistance, { prng });

    expect(points.length).toBeGreaterThan(0);
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(bounds.minX);
      expect(p.x).toBeLessThan(bounds.maxX);
      expect(p.y).toBeGreaterThanOrEqual(bounds.minY);
      expect(p.y).toBeLessThan(bounds.maxY);
    }
  });

  it("is fully deterministic with identical PRNG seed", () => {
    const bounds: PoissonBounds = { minX: -20, minY: -20, maxX: 20, maxY: 20 };
    const minDistance = 4;

    const runA = generatePoissonPoints(bounds, minDistance, { prng: createMulberry32(999) });
    const runB = generatePoissonPoints(bounds, minDistance, { prng: createMulberry32(999) });

    expect(runA.length).toBe(runB.length);
    for (let i = 0; i < runA.length; i++) {
      expect(runA[i].x).toBeCloseTo(runB[i].x, 6);
      expect(runA[i].y).toBeCloseTo(runB[i].y, 6);
    }
  });

  it("handles empty or degenerate bounds gracefully", () => {
    const zeroBounds: PoissonBounds = { minX: 10, minY: 10, maxX: 10, maxY: 10 };
    expect(generatePoissonPoints(zeroBounds, 5)).toEqual([]);

    const invertedBounds: PoissonBounds = { minX: 20, minY: 20, maxX: 10, maxY: 10 };
    expect(generatePoissonPoints(invertedBounds, 5)).toEqual([]);
  });

  it("throws error if minDistance is <= 0", () => {
    const bounds: PoissonBounds = { minX: 0, minY: 0, maxX: 50, maxY: 50 };
    expect(() => generatePoissonPoints(bounds, 0)).toThrow();
    expect(() => generatePoissonPoints(bounds, -5)).toThrow();
  });

  it("supports density rejection filter", () => {
    const bounds: PoissonBounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    const minDistance = 6;
    const prng = createMulberry32(777);

    // Only allow points in the left half (x < 50)
    const densityFilter = (x: number): number => (x < 50 ? 1.0 : 0.0);

    const points = generatePoissonPoints(bounds, minDistance, { prng, densityFilter });

    expect(points.length).toBeGreaterThan(0);
    // Almost all points should be on the left (except possibly the very first initial seed point)
    const leftPoints = points.filter((p) => p.x < 50);
    expect(leftPoints.length / points.length).toBeGreaterThan(0.9);
  });
});
