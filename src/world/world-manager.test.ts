import { describe, it, expect } from 'vitest';
import { WorldManager, BiomeType } from './world-manager';

// WorldManager only needs the scene for mesh creation, which getBiome doesn't use.
const mockScene = {} as any;

describe('WorldManager.getBiome', () => {
    it('returns a valid BiomeType for every chunk', () => {
        const valid: BiomeType[] = ['plains', 'forest', 'desert', 'tundra'];
        const wm = new WorldManager(mockScene);
        for (let x = -5; x <= 5; x++) {
            for (let z = -5; z <= 5; z++) {
                expect(valid).toContain(wm.getBiome(x, z));
            }
        }
    });

    it('is deterministic — same chunk always returns the same biome', () => {
        const wm = new WorldManager(mockScene);
        for (let x = -3; x <= 3; x++) {
            for (let z = -3; z <= 3; z++) {
                expect(wm.getBiome(x, z)).toBe(wm.getBiome(x, z));
            }
        }
    });

    it('returns all four biome types across a representative area', () => {
        const wm = new WorldManager(mockScene);
        const found = new Set<BiomeType>();
        for (let x = -20; x <= 20; x++) {
            for (let z = -20; z <= 20; z++) {
                found.add(wm.getBiome(x, z));
            }
        }
        expect(found.size).toBe(4);
    });

    it('origin chunk (0,0) returns a consistent biome', () => {
        const wm = new WorldManager(mockScene);
        const b = wm.getBiome(0, 0);
        expect(['plains', 'forest', 'desert', 'tundra']).toContain(b);
        // Call again to confirm determinism
        expect(wm.getBiome(0, 0)).toBe(b);
    });
});
