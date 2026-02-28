import { describe, it, expect } from 'vitest';
import { StructureManager } from './structure-manager';

// StructureManager only needs the scene for mesh creation; hasStructureAt and
// disposeChunk (on unknown chunks) don't touch the scene at all.
const mockScene = {} as any;

describe('StructureManager.hasStructureAt', () => {
  it('is deterministic — same chunk always returns the same value', () => {
    const sm = new StructureManager(mockScene);
    for (let x = -5; x <= 5; x++) {
      for (let z = -5; z <= 5; z++) {
        expect(sm.hasStructureAt(x, z)).toBe(sm.hasStructureAt(x, z));
      }
    }
  });

  it('returns a boolean', () => {
    const sm = new StructureManager(mockScene);
    expect(typeof sm.hasStructureAt(0, 0)).toBe('boolean');
    expect(typeof sm.hasStructureAt(3, -7)).toBe('boolean');
  });

  it('approximately 25% of chunks have structures', () => {
    const sm = new StructureManager(mockScene);
    let count = 0;
    const total = 400; // 20 x 20 grid
    for (let x = -10; x < 10; x++) {
      for (let z = -10; z < 10; z++) {
        if (sm.hasStructureAt(x, z)) count++;
      }
    }
    // Expect between 15% and 35% to have structures
    const ratio = count / total;
    expect(ratio).toBeGreaterThan(0.15);
    expect(ratio).toBeLessThan(0.35);
  });

  it('different chunks can have different results', () => {
    const sm = new StructureManager(mockScene);
    const results = new Set<boolean>();
    for (let x = 0; x < 20; x++) {
      results.add(sm.hasStructureAt(x, 0));
    }
    // At least one chunk should have a structure, and at least one should not
    expect(results.has(true)).toBe(true);
    expect(results.has(false)).toBe(true);
  });
});

describe('StructureManager.disposeChunk', () => {
  it('does not throw for a chunk that was never loaded', () => {
    const sm = new StructureManager(mockScene);
    expect(() => sm.disposeChunk(0, 0)).not.toThrow();
    expect(() => sm.disposeChunk(100, -200)).not.toThrow();
  });

  it('can be called multiple times on the same chunk without throwing', () => {
    const sm = new StructureManager(mockScene);
    expect(() => {
      sm.disposeChunk(5, 5);
      sm.disposeChunk(5, 5);
    }).not.toThrow();
  });
});
