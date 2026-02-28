import { describe, it, expect, vi } from 'vitest';

/**
 * Unit tests for Player.addExperience leveling logic.
 * We test the logic directly without instantiating a full Babylon.js Player,
 * by defining a minimal object that mirrors the relevant state and methods.
 */

function makePlayerStub() {
    const p = {
        level: 1,
        experience: 0,
        experienceToNextLevel: 100,
        maxHealth: 100,
        maxMagicka: 100,
        maxStamina: 100,
        onLevelUp: null as ((newLevel: number) => void) | null,

        addExperience(amount: number): void {
            this.experience += amount;
            while (this.experience >= this.experienceToNextLevel) {
                this.experience -= this.experienceToNextLevel;
                this.level++;
                this.experienceToNextLevel = this.level * 100;
                this.maxHealth += 10;
                this.maxMagicka += 10;
                this.maxStamina += 10;
                this.onLevelUp?.(this.level);
            }
        },
    };
    return p;
}

describe('Player leveling', () => {
    it('accumulates XP without leveling up when under threshold', () => {
        const p = makePlayerStub();
        p.addExperience(50);
        expect(p.experience).toBe(50);
        expect(p.level).toBe(1);
    });

    it('levels up exactly when XP meets the threshold', () => {
        const p = makePlayerStub();
        p.addExperience(100);
        expect(p.level).toBe(2);
        expect(p.experience).toBe(0);
        expect(p.experienceToNextLevel).toBe(200);
    });

    it('carries over excess XP after leveling up', () => {
        const p = makePlayerStub();
        p.addExperience(150);
        expect(p.level).toBe(2);
        expect(p.experience).toBe(50);
    });

    it('handles multiple level-ups from a single XP grant', () => {
        const p = makePlayerStub();
        // Lv1→2: 100 XP, Lv2→3: 200 XP — total 300 XP needed for two levels
        p.addExperience(300);
        expect(p.level).toBe(3);
        // 300 - 100 (lv1→2) - 200 (lv2→3) = 0 leftover
        expect(p.experience).toBe(0);
        expect(p.experienceToNextLevel).toBe(300); // level 3 * 100
    });

    it('increases max stats on each level-up', () => {
        const p = makePlayerStub();
        p.addExperience(100); // level 1 → 2
        expect(p.maxHealth).toBe(110);
        expect(p.maxMagicka).toBe(110);
        expect(p.maxStamina).toBe(110);
        p.addExperience(200); // level 2 → 3
        expect(p.maxHealth).toBe(120);
    });

    it('fires onLevelUp callback with the new level', () => {
        const p = makePlayerStub();
        const cb = vi.fn();
        p.onLevelUp = cb;
        p.addExperience(100);
        expect(cb).toHaveBeenCalledOnce();
        expect(cb).toHaveBeenCalledWith(2);
    });

    it('fires onLevelUp once per level when gaining multiple levels', () => {
        const p = makePlayerStub();
        const cb = vi.fn();
        p.onLevelUp = cb;
        p.addExperience(300); // gains 2 levels
        expect(cb).toHaveBeenCalledTimes(2);
        expect(cb).toHaveBeenNthCalledWith(1, 2);
        expect(cb).toHaveBeenNthCalledWith(2, 3);
    });

    it('does not fire onLevelUp when XP is below threshold', () => {
        const p = makePlayerStub();
        const cb = vi.fn();
        p.onLevelUp = cb;
        p.addExperience(99);
        expect(cb).not.toHaveBeenCalled();
    });
});
