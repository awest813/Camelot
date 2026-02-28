import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScheduleSystem } from './schedule-system';
import { NPC } from '../entities/npc';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

/** Build a lightweight NPC stub that satisfies the fields ScheduleSystem reads. */
function makeNPCStub(overrides: Partial<Record<string, any>> = {}): NPC {
    return {
        isDead: false,
        isAggressive: false,
        waitTime: 0,
        patrolPoints: [],
        currentPatrolIndex: 0,
        targetPosition: null,
        moveSpeed: 2,
        mesh: {
            position: new Vector3(0, 0, 0),
            lookAt: vi.fn(),
        },
        physicsAggregate: {
            body: {
                getLinearVelocityToRef: vi.fn((ref: Vector3) => { ref.set(0, 0, 0); }),
                setLinearVelocity: vi.fn(),
            },
        },
        ...overrides,
    } as unknown as NPC;
}

describe('ScheduleSystem', () => {
    let mockScene: any;
    let scheduleSystem: ScheduleSystem;

    beforeEach(() => {
        mockScene = {} as any;
        scheduleSystem = new ScheduleSystem(mockScene);
    });

    // ── addNPC ────────────────────────────────────────────────────────────────

    it('should add an NPC to the schedule system', () => {
        const mockNPC = {} as NPC;
        scheduleSystem.addNPC(mockNPC);
        expect(scheduleSystem.npcs.length).toBe(1);
        expect(scheduleSystem.npcs[0]).toBe(mockNPC);
    });

    it('should add multiple NPCs to the schedule system', () => {
        const mockNPC1 = { id: 1 } as unknown as NPC;
        const mockNPC2 = { id: 2 } as unknown as NPC;
        const mockNPC3 = { id: 3 } as unknown as NPC;

        scheduleSystem.addNPC(mockNPC1);
        scheduleSystem.addNPC(mockNPC2);
        scheduleSystem.addNPC(mockNPC3);

        expect(scheduleSystem.npcs.length).toBe(3);
    });

    // ── patrol ────────────────────────────────────────────────────────────────

    it('update() skips dead NPCs', () => {
        const npc = makeNPCStub({ isDead: true });
        scheduleSystem.addNPC(npc);
        scheduleSystem.update(0.016);
        expect((npc.physicsAggregate.body as any).setLinearVelocity).not.toHaveBeenCalled();
    });

    it('update() skips aggressive NPCs (combat system owns them)', () => {
        const npc = makeNPCStub({ isAggressive: true });
        scheduleSystem.addNPC(npc);
        scheduleSystem.update(0.016);
        expect((npc.physicsAggregate.body as any).setLinearVelocity).not.toHaveBeenCalled();
    });

    it('patrol NPC waits when waitTime > 0', () => {
        const npc = makeNPCStub({
            waitTime: 1.0,
            patrolPoints: [new Vector3(0, 0, 0), new Vector3(10, 0, 0)],
        });
        scheduleSystem.addNPC(npc);
        scheduleSystem.update(0.5);
        expect(npc.waitTime).toBeCloseTo(0.5);
        expect((npc.physicsAggregate.body as any).setLinearVelocity).not.toHaveBeenCalled();
    });

    it('patrol NPC advances to next point when close enough to current target', () => {
        const npc = makeNPCStub({
            currentPatrolIndex: 0,
            patrolPoints: [new Vector3(0, 0, 0), new Vector3(20, 0, 0)],
            mesh: { position: new Vector3(0.3, 0, 0.3), lookAt: vi.fn() },
        });
        scheduleSystem.addNPC(npc);
        scheduleSystem.update(0.016);
        // XZ dist ≈ 0.42 < 1.0 → should advance to next point
        expect(npc.currentPatrolIndex).toBe(1);
        expect(npc.waitTime).toBe(2.0);
    });

    it('patrol NPC moves toward current target when far away', () => {
        const npc = makeNPCStub({
            currentPatrolIndex: 0,
            patrolPoints: [new Vector3(10, 0, 0), new Vector3(20, 0, 0)],
            mesh: { position: new Vector3(0, 0, 0), lookAt: vi.fn() },
        });
        scheduleSystem.addNPC(npc);
        scheduleSystem.update(0.016);
        expect((npc.physicsAggregate.body as any).setLinearVelocity).toHaveBeenCalled();
    });

    // ── wander ────────────────────────────────────────────────────────────────

    it('NPC without patrol points gets a wander targetPosition assigned on first update', () => {
        const npc = makeNPCStub({ patrolPoints: [] });
        expect(npc.targetPosition).toBeNull();
        scheduleSystem.addNPC(npc);
        scheduleSystem.update(0.016);
        expect(npc.targetPosition).not.toBeNull();
    });

    it('wandering NPC moves toward its wander target', () => {
        const npc = makeNPCStub({ patrolPoints: [] });
        scheduleSystem.addNPC(npc);
        scheduleSystem.update(0.016); // assigns target and starts moving
        expect((npc.physicsAggregate.body as any).setLinearVelocity).toHaveBeenCalled();
    });

    it('wandering NPC clears targetPosition and sets waitTime when it reaches the target', () => {
        const npc = makeNPCStub({
            patrolPoints: [],
            mesh: { position: new Vector3(0, 0, 0), lookAt: vi.fn() },
        });
        // Pre-set a wander target very close (XZ dist ≈ 0.42 < 1.0)
        npc.targetPosition = new Vector3(0.3, 0, 0.3);
        scheduleSystem.addNPC(npc);
        scheduleSystem.update(0.016);
        expect(npc.targetPosition).toBeNull();
        expect(npc.waitTime).toBeGreaterThan(0);
    });
});
