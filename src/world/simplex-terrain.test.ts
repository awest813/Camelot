import { describe, it, expect } from "vitest";
import {
  SimplexTerrainGenerator,
  createMulberry32,
  DEFAULT_TERRAIN_CONFIG,
} from "./simplex-terrain";

describe("createMulberry32 PRNG", () => {
  it("produces deterministic pseudo-random sequence from an integer seed", () => {
    const rng1 = createMulberry32(12345);
    const rng2 = createMulberry32(12345);

    const seq1 = [rng1(), rng1(), rng1()];
    const seq2 = [rng2(), rng2(), rng2()];

    expect(seq1).toEqual(seq2);
    for (const val of seq1) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it("produces differing sequences from different seeds", () => {
    const rng1 = createMulberry32(1);
    const rng2 = createMulberry32(9999);

    expect(rng1()).not.toBe(rng2());
  });
});

describe("SimplexTerrainGenerator — Construction & Defaults", () => {
  it("initializes with DEFAULT_TERRAIN_CONFIG", () => {
    const gen = new SimplexTerrainGenerator("Avalon");
    expect(gen.seedString).toBe("Avalon");
    expect(typeof gen.seedNumber).toBe("number");
    expect(gen.config.octaves).toBe(DEFAULT_TERRAIN_CONFIG.octaves);
    expect(gen.config.heightScale).toBe(DEFAULT_TERRAIN_CONFIG.heightScale);
  });

  it("accepts custom configuration overrides", () => {
    const gen = new SimplexTerrainGenerator(42, {
      octaves: 6,
      heightScale: 25.0,
      baseFrequency: 0.01,
    });
    expect(gen.seedNumber).toBe(42);
    expect(gen.config.octaves).toBe(6);
    expect(gen.config.heightScale).toBe(25.0);
    expect(gen.config.baseFrequency).toBe(0.01);
  });
});

describe("SimplexTerrainGenerator — Determinism", () => {
  it("generates identical heights for identical seeds across arbitrary coordinates", () => {
    const genA = new SimplexTerrainGenerator("CamelotSeed");
    const genB = new SimplexTerrainGenerator("CamelotSeed");

    for (let x = -100; x <= 100; x += 40) {
      for (let z = -100; z <= 100; z += 40) {
        expect(genA.getHeightAt(x, z)).toBeCloseTo(genB.getHeightAt(x, z), 5);
      }
    }
  });

  it("generates different terrain heights for different seeds", () => {
    const genA = new SimplexTerrainGenerator("SeedAlpha");
    const genB = new SimplexTerrainGenerator("SeedBeta");

    let differences = 0;
    for (let i = 0; i < 10; i++) {
      if (Math.abs(genA.getHeightAt(i * 50, i * 50) - genB.getHeightAt(i * 50, i * 50)) > 0.01) {
        differences++;
      }
    }
    expect(differences).toBeGreaterThan(5);
  });
});

describe("SimplexTerrainGenerator — Height & Slope Sampling", () => {
  it("scales height linearly with elevationMultiplier", () => {
    const gen = new SimplexTerrainGenerator("Highlands");
    const baseH = gen.getHeightAt(50, 50, 1.0);
    const doubledH = gen.getHeightAt(50, 50, 2.0);

    expect(doubledH).toBeCloseTo(baseH * 2.0, 4);
  });

  it("computes slope in [0, 1] range", () => {
    const gen = new SimplexTerrainGenerator("HillyRealm");
    for (let x = 0; x < 200; x += 50) {
      for (let z = 0; z < 200; z += 50) {
        const slope = gen.getSlopeAt(x, z);
        expect(slope).toBeGreaterThanOrEqual(0);
        expect(slope).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("SimplexTerrainGenerator — Climate & Whittaker Biome", () => {
  it("produces valid climate samples containing temperature, moisture, and biome", () => {
    const gen = new SimplexTerrainGenerator("RealmClimate");
    const climate = gen.getClimateAt(100, 200);

    expect(climate.temperature).toBeGreaterThanOrEqual(-1.0);
    expect(climate.temperature).toBeLessThanOrEqual(1.0);
    expect(climate.moisture).toBeGreaterThanOrEqual(0.0);
    expect(climate.moisture).toBeLessThanOrEqual(1.0);
    expect(["tundra", "desert", "forest", "plains"]).toContain(climate.biome);
  });

  it("classifies Whittaker biomes accurately based on ecological matrix", () => {
    const gen = new SimplexTerrainGenerator("Test");

    // Freezing alpine zone
    expect(gen.classifyWhittakerBiome(-0.6, 0.4)).toBe("tundra");

    // Hot and arid zone
    expect(gen.classifyWhittakerBiome(0.7, 0.15)).toBe("desert");

    // High moisture temperate zone
    expect(gen.classifyWhittakerBiome(0.1, 0.8)).toBe("forest");

    // Moderate temperate meadows
    expect(gen.classifyWhittakerBiome(0.0, 0.4)).toBe("plains");
  });

  it("respects global temperature shift in climate sampling", () => {
    const gen = new SimplexTerrainGenerator("ShiftingClimes");
    const warm = gen.getClimateAt(0, 0, 0.8);
    const cold = gen.getClimateAt(0, 0, -0.8);

    expect(warm.temperature).toBeGreaterThan(cold.temperature);
  });
});
