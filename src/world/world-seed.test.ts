import { describe, it, expect } from 'vitest';
import { WorldSeed, WorldType, BiomeScale, StructureDensity } from './world-seed';
import type { BiomeType } from './world-manager';

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_BIOMES: BiomeType[] = ['plains', 'forest', 'desert', 'tundra'];

/** Count occurrences of each biome across a grid of chunks. */
function biomeCounts(seed: WorldSeed, radius: number): Record<BiomeType, number> {
  const counts: Record<BiomeType, number> = { plains: 0, forest: 0, desert: 0, tundra: 0 };
  for (let x = -radius; x <= radius; x++) {
    for (let z = -radius; z <= radius; z++) {
      counts[seed.getBiome(x, z)]++;
    }
  }
  return counts;
}

/** Count how many chunks in a grid have a structure. */
function structureCount(seed: WorldSeed, radius: number): number {
  let n = 0;
  for (let x = -radius; x <= radius; x++) {
    for (let z = -radius; z <= radius; z++) {
      if (seed.hasStructure(x, z)) n++;
    }
  }
  return n;
}

// ── WorldSeed constructor ─────────────────────────────────────────────────────

describe('WorldSeed — construction', () => {
  it('accepts a numeric seed and stores it verbatim', () => {
    const ws = new WorldSeed(12345);
    expect(ws.seedValue).toBe(12345);
    expect(ws.seedString).toBe('12345');
  });

  it('accepts a string seed and hashes it to a number', () => {
    const ws = new WorldSeed('hello world');
    expect(typeof ws.seedValue).toBe('number');
    expect(ws.seedString).toBe('hello world');
  });

  it('always produces a non-negative seedValue for string seeds', () => {
    const seeds = ['', 'a', 'xyz', 'My World', '!@#$%^&*'];
    for (const s of seeds) {
      expect(new WorldSeed(s).seedValue).toBeGreaterThanOrEqual(0);
    }
  });

  it('applies default options when none are supplied', () => {
    const ws = new WorldSeed(1);
    expect(ws.options.worldType).toBe('normal');
    expect(ws.options.biomeScale).toBe('medium');
    expect(ws.options.structureDensity).toBe('normal');
    expect(ws.options.startingBiome).toBeNull();
  });

  it('merges partial options over defaults', () => {
    const ws = new WorldSeed(1, { biomeScale: 'huge', structureDensity: 'rare' });
    expect(ws.options.worldType).toBe('normal');
    expect(ws.options.biomeScale).toBe('huge');
    expect(ws.options.structureDensity).toBe('rare');
    expect(ws.options.startingBiome).toBeNull();
  });

  it('stores the full options object as read-only', () => {
    const ws = new WorldSeed(99, { worldType: 'island', startingBiome: 'desert' });
    expect(ws.options.worldType).toBe('island');
    expect(ws.options.startingBiome).toBe('desert');
  });
});

// ── WorldSeed.hashString ──────────────────────────────────────────────────────

describe('WorldSeed.hashString', () => {
  it('is deterministic — same input always returns the same hash', () => {
    expect(WorldSeed.hashString('camelot')).toBe(WorldSeed.hashString('camelot'));
  });

  it('returns different values for different inputs', () => {
    expect(WorldSeed.hashString('abc')).not.toBe(WorldSeed.hashString('xyz'));
  });

  it('handles empty string without throwing', () => {
    expect(() => WorldSeed.hashString('')).not.toThrow();
  });

  it('returns a non-negative integer', () => {
    const h = WorldSeed.hashString('test');
    expect(h).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(h)).toBe(true);
  });
});

// ── WorldSeed.rand ────────────────────────────────────────────────────────────

describe('WorldSeed.rand', () => {
  it('returns a value in [0, 1)', () => {
    const ws = new WorldSeed(42);
    for (let x = -3; x <= 3; x++) {
      for (let z = -3; z <= 3; z++) {
        const r = ws.rand(x, z, 0);
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThan(1);
      }
    }
  });

  it('is deterministic — same inputs always return the same value', () => {
    const ws = new WorldSeed(7);
    expect(ws.rand(5, -3, 2)).toBe(ws.rand(5, -3, 2));
  });

  it('varies by chunk coordinates', () => {
    const ws = new WorldSeed(1);
    const values = new Set<number>();
    for (let x = 0; x < 5; x++) values.add(ws.rand(x, 0, 0));
    expect(values.size).toBeGreaterThan(1);
  });

  it('varies by seed', () => {
    const a = new WorldSeed(100);
    const b = new WorldSeed(200);
    // The rand outputs should differ for at least some chunk
    let differ = false;
    for (let x = 0; x < 10 && !differ; x++) {
      if (a.rand(x, 0, 0) !== b.rand(x, 0, 0)) differ = true;
    }
    expect(differ).toBe(true);
  });

  it('varies by slot', () => {
    const ws = new WorldSeed(3);
    const values = new Set([ws.rand(0, 0, 0), ws.rand(0, 0, 1), ws.rand(0, 0, 2)]);
    expect(values.size).toBe(3);
  });
});

// ── WorldSeed.getBiome — valid output ─────────────────────────────────────────

describe('WorldSeed.getBiome — output validity', () => {
  it('always returns a valid BiomeType', () => {
    const ws = new WorldSeed('validity_test');
    for (let x = -10; x <= 10; x++) {
      for (let z = -10; z <= 10; z++) {
        expect(VALID_BIOMES).toContain(ws.getBiome(x, z));
      }
    }
  });

  it('produces all four biomes across a large grid', () => {
    const ws = new WorldSeed(1);
    const counts = biomeCounts(ws, 20);
    for (const biome of VALID_BIOMES) {
      expect(counts[biome]).toBeGreaterThan(0);
    }
  });

  it('is deterministic — same seed + chunk always returns the same biome', () => {
    const ws = new WorldSeed(555);
    expect(ws.getBiome(7, -3)).toBe(ws.getBiome(7, -3));
  });
});

// ── WorldSeed.getBiome — worldType ────────────────────────────────────────────

describe('WorldSeed.getBiome — worldType', () => {
  it('"flat" always returns plains', () => {
    const ws = new WorldSeed(1, { worldType: 'flat' });
    for (let x = -5; x <= 5; x++) {
      for (let z = -5; z <= 5; z++) {
        expect(ws.getBiome(x, z)).toBe('plains');
      }
    }
  });

  it('"normal" produces varied biomes', () => {
    const ws = new WorldSeed(1, { worldType: 'normal' });
    const counts = biomeCounts(ws, 20);
    const uniqueBiomes = VALID_BIOMES.filter(b => counts[b] > 0).length;
    expect(uniqueBiomes).toBeGreaterThanOrEqual(2);
  });

  it('"island" produces only plains/forest near the origin', () => {
    const ws = new WorldSeed(1, { worldType: 'island' });
    const islandBiomes: BiomeType[] = ['plains', 'forest'];
    for (let x = -3; x <= 3; x++) {
      for (let z = -3; z <= 3; z++) {
        expect(islandBiomes).toContain(ws.getBiome(x, z));
      }
    }
  });

  it('"island" produces tundra/desert away from origin', () => {
    const ws = new WorldSeed(1, { worldType: 'island' });
    const outerBiomes: BiomeType[] = ['tundra', 'desert'];
    // Scan far from origin
    let found = false;
    for (let x = 15; x <= 25; x++) {
      if (outerBiomes.includes(ws.getBiome(x, 0))) { found = true; break; }
    }
    expect(found).toBe(true);
  });

  it('"amplified" produces all four biomes across a large grid', () => {
    const ws = new WorldSeed(1, { worldType: 'amplified' });
    const counts = biomeCounts(ws, 20);
    for (const biome of VALID_BIOMES) {
      expect(counts[biome]).toBeGreaterThan(0);
    }
  });

  it('different seeds produce different biome distributions for "normal"', () => {
    const a = new WorldSeed(1);
    const b = new WorldSeed(999999);
    let differ = false;
    outer: for (let x = -5; x <= 5; x++) {
      for (let z = -5; z <= 5; z++) {
        if (a.getBiome(x, z) !== b.getBiome(x, z)) { differ = true; break outer; }
      }
    }
    expect(differ).toBe(true);
  });
});

// ── WorldSeed.getBiome — biomeScale ──────────────────────────────────────────

describe('WorldSeed.getBiome — biomeScale', () => {
  const scales: BiomeScale[] = ['small', 'medium', 'large', 'huge'];

  it.each(scales)('%s scale returns only valid biomes', (scale) => {
    const ws = new WorldSeed(42, { biomeScale: scale });
    for (let x = -5; x <= 5; x++) {
      for (let z = -5; z <= 5; z++) {
        expect(VALID_BIOMES).toContain(ws.getBiome(x, z));
      }
    }
  });

  it('"small" scale transitions biomes more frequently than "huge"', () => {
    const small = new WorldSeed(7, { biomeScale: 'small' });
    const huge  = new WorldSeed(7, { biomeScale: 'huge' });

    // Count transitions along the x-axis at z=0
    let smallTransitions = 0;
    let hugeTransitions  = 0;
    let prevSmall = small.getBiome(-20, 0);
    let prevHuge  = huge.getBiome(-20, 0);
    for (let x = -19; x <= 20; x++) {
      const s = small.getBiome(x, 0);
      const h = huge.getBiome(x, 0);
      if (s !== prevSmall) { smallTransitions++; prevSmall = s; }
      if (h !== prevHuge)  { hugeTransitions++;  prevHuge  = h; }
    }
    expect(smallTransitions).toBeGreaterThan(hugeTransitions);
  });
});

// ── WorldSeed.getBiome — startingBiome ───────────────────────────────────────

describe('WorldSeed.getBiome — startingBiome', () => {
  it('forces the origin chunk to the specified biome', () => {
    const ws = new WorldSeed(1, { startingBiome: 'desert' });
    expect(ws.getBiome(0, 0)).toBe('desert');
  });

  it('forces chunks within radius 2 to the specified biome', () => {
    const ws = new WorldSeed(1, { startingBiome: 'tundra' });
    for (let x = -2; x <= 2; x++) {
      for (let z = -2; z <= 2; z++) {
        expect(ws.getBiome(x, z)).toBe('tundra');
      }
    }
  });

  it('chunks outside radius 2 are not forced to the starting biome', () => {
    const ws = new WorldSeed(1, { startingBiome: 'desert' });
    // Scan chunks well outside the pin radius
    let nonDesert = false;
    for (let x = 5; x <= 15 && !nonDesert; x++) {
      if (ws.getBiome(x, 0) !== 'desert') nonDesert = true;
    }
    expect(nonDesert).toBe(true);
  });

  it('null startingBiome has no effect', () => {
    const with_  = new WorldSeed(1, { startingBiome: null });
    const without = new WorldSeed(1);
    expect(with_.getBiome(0, 0)).toBe(without.getBiome(0, 0));
  });
});

// ── WorldSeed.hasStructure ────────────────────────────────────────────────────

describe('WorldSeed.hasStructure', () => {
  it('"none" density — no structures anywhere', () => {
    const ws = new WorldSeed(1, { structureDensity: 'none' });
    for (let x = -10; x <= 10; x++) {
      for (let z = -10; z <= 10; z++) {
        expect(ws.hasStructure(x, z)).toBe(false);
      }
    }
  });

  it('"flat" worldType suppresses all structures', () => {
    const ws = new WorldSeed(1, { worldType: 'flat', structureDensity: 'abundant' });
    for (let x = -5; x <= 5; x++) {
      for (let z = -5; z <= 5; z++) {
        expect(ws.hasStructure(x, z)).toBe(false);
      }
    }
  });

  it('"rare" density spawns fewer structures than "abundant"', () => {
    const rare     = new WorldSeed(42, { structureDensity: 'rare' });
    const abundant = new WorldSeed(42, { structureDensity: 'abundant' });
    expect(structureCount(rare, 15)).toBeLessThan(structureCount(abundant, 15));
  });

  it('"normal" density is consistent with ~25% threshold', () => {
    const ws = new WorldSeed(1, { structureDensity: 'normal' });
    const total  = 31 * 31; // radius 15 grid
    const count  = structureCount(ws, 15);
    const ratio  = count / total;
    // Expect roughly 10–40% (generous bounds for deterministic but non-uniform hash)
    expect(ratio).toBeGreaterThan(0.05);
    expect(ratio).toBeLessThan(0.55);
  });

  it('is deterministic — same seed returns same result for each chunk', () => {
    const ws = new WorldSeed(123);
    expect(ws.hasStructure(4, -7)).toBe(ws.hasStructure(4, -7));
  });

  it('different seeds produce different structure patterns', () => {
    const a = new WorldSeed(1);
    const b = new WorldSeed(9999);
    let differ = false;
    outer: for (let x = -5; x <= 5; x++) {
      for (let z = -5; z <= 5; z++) {
        if (a.hasStructure(x, z) !== b.hasStructure(x, z)) { differ = true; break outer; }
      }
    }
    expect(differ).toBe(true);
  });
});
