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

    it('should add multiple NPCs to the schedule system', () => {
        // Mock scene
        const mockScene = {} as any;
        const scheduleSystem = new ScheduleSystem(mockScene);

        // Mock NPCs
        const mockNPC1 = { id: 1 } as unknown as NPC;
        const mockNPC2 = { id: 2 } as unknown as NPC;
        const mockNPC3 = { id: 3 } as unknown as NPC;

        scheduleSystem.addNPC(mockNPC1);
        scheduleSystem.addNPC(mockNPC2);
        scheduleSystem.addNPC(mockNPC3);

        expect(scheduleSystem.npcs.length).toBe(3);
        expect(scheduleSystem.npcs[0]).toBe(mockNPC1);
        expect(scheduleSystem.npcs[1]).toBe(mockNPC2);
        expect(scheduleSystem.npcs[2]).toBe(mockNPC3);
    });
});
