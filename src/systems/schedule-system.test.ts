import { describe, it, expect } from 'vitest';
import { ScheduleSystem } from './schedule-system';
import { NPC } from '../entities/npc';

describe('ScheduleSystem', () => {
    it('should add an NPC to the schedule system', () => {
        // Mock scene
        const mockScene = {} as any;
        const scheduleSystem = new ScheduleSystem(mockScene);

        // Mock NPC
        const mockNPC = {} as NPC;

        scheduleSystem.addNPC(mockNPC);

        expect(scheduleSystem.npcs.length).toBe(1);
        expect(scheduleSystem.npcs[0]).toBe(mockNPC);
    });
});
