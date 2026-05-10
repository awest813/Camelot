import { describe, it, expect, vi } from 'vitest';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { ScheduleSystem } from './schedule-system';
import { NPC, AIState, type ScheduleBlock } from '../entities/npc';

describe('ScheduleSystem', () => {
  it('should add an NPC to the schedule system', () => {
    const scheduleSystem = new ScheduleSystem();
    const mockNPC = {} as NPC;

    scheduleSystem.addNPC(mockNPC);

    expect(scheduleSystem.npcs.length).toBe(1);
    expect(scheduleSystem.npcs[0]).toBe(mockNPC);
  });

  it('should add multiple NPCs to the schedule system', () => {
    const scheduleSystem = new ScheduleSystem();

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

  it('should randomize patrol wait time within configured range', () => {
    const scheduleSystem = new ScheduleSystem();
    const setLinearVelocity = vi.fn();

    const npc = {
      isDead: false,
      isAggressive: false,
      aiState: AIState.PATROL,
      patrolPoints: [new Vector3(0, 0, 0), new Vector3(10, 0, 0)],
      currentPatrolIndex: 0,
      waitTime: 0,
      patrolWaitMin: 1,
      patrolWaitMax: 3,
      patrolLookAroundAngle: Math.PI / 3,
      mesh: { position: new Vector3(0, 0, 0), lookAt: vi.fn() },
      moveSpeed: 2,
      physicsAggregate: {
        body: {
          getLinearVelocityToRef: (v: Vector3) => v.set(0, -1, 0),
          setLinearVelocity,
        },
      },
    } as unknown as NPC;

    scheduleSystem.addNPC(npc);

    vi.spyOn(Math, 'random').mockReturnValueOnce(0.75).mockReturnValueOnce(0.5);
    scheduleSystem.update(0.016);

    expect(npc.waitTime).toBeCloseTo(2.5, 5);
    expect(npc.currentPatrolIndex).toBe(1);
    expect(setLinearVelocity).not.toHaveBeenCalled();
  });

  it('should preserve vertical velocity while stopping during patrol wait', () => {
    const scheduleSystem = new ScheduleSystem();
    const setLinearVelocity = vi.fn();

    const npc = {
      isDead: false,
      isAggressive: false,
      aiState: AIState.PATROL,
      patrolPoints: [new Vector3(0, 0, 0), new Vector3(8, 0, 0)],
      currentPatrolIndex: 0,
      waitTime: 1,
      patrolWaitMin: 1,
      patrolWaitMax: 3,
      patrolLookAroundAngle: Math.PI / 3,
      mesh: { position: new Vector3(0, 0, 0), lookAt: vi.fn() },
      moveSpeed: 2,
      physicsAggregate: {
        body: {
          getLinearVelocityToRef: (v: Vector3) => v.set(5, -2, 4),
          setLinearVelocity,
        },
      },
    } as unknown as NPC;

    scheduleSystem.addNPC(npc);
    scheduleSystem.update(0.5);

    expect(npc.waitTime).toBeCloseTo(0.5, 5);
    expect(setLinearVelocity).toHaveBeenCalledWith(expect.objectContaining({ x: 0, y: -2, z: 0 }));
  });

  it('uses normal patrol movement when the active schedule block is "patrol"', () => {
    const scheduleSystem = new ScheduleSystem();
    scheduleSystem.currentHour = 12;
    const setLinearVelocity = vi.fn();

    const patrolBlocks: ScheduleBlock[] = [
      { startHour: 6, endHour: 22, behavior: 'patrol' },
      { startHour: 22, endHour: 6, behavior: 'sleep' },
    ];

    const npc = {
      isDead: false,
      isAggressive: false,
      aiState: AIState.PATROL,
      scheduleBlocks: patrolBlocks,
      patrolPoints: [new Vector3(10, 0, 0), new Vector3(0, 0, 0)],
      currentPatrolIndex: 0,
      waitTime: 0,
      patrolWaitMin: 1,
      patrolWaitMax: 3,
      patrolLookAroundAngle: Math.PI / 3,
      mesh: { position: new Vector3(5, 0, 0), lookAt: vi.fn() },
      moveSpeed: 2,
      physicsAggregate: {
        body: {
          getLinearVelocityToRef: (v: Vector3) => v.set(0, -1, 0),
          setLinearVelocity,
        },
      },
    } as unknown as NPC;

    scheduleSystem.addNPC(npc);
    scheduleSystem.update(0.016);

    expect(setLinearVelocity).toHaveBeenCalled();
  });

  it('does not move along patrol during a scheduled "sleep" block', () => {
    const scheduleSystem = new ScheduleSystem();
    scheduleSystem.currentHour = 23;
    const setLinearVelocity = vi.fn();

    const npc = {
      isDead: false,
      isAggressive: false,
      aiState: AIState.IDLE,
      scheduleBlocks: [
        { startHour: 6, endHour: 22, behavior: 'patrol' },
        { startHour: 22, endHour: 6, behavior: 'sleep' },
      ] as ScheduleBlock[],
      homePosition: null,
      spawnPosition: new Vector3(0, 0, 0),
      patrolPoints: [new Vector3(0, 0, 0), new Vector3(10, 0, 0)],
      currentPatrolIndex: 0,
      waitTime: 0,
      patrolWaitMin: 1,
      patrolWaitMax: 3,
      patrolLookAroundAngle: Math.PI / 3,
      mesh: { position: new Vector3(0, 0, 0), lookAt: vi.fn() },
      moveSpeed: 2,
      physicsAggregate: {
        body: {
          getLinearVelocityToRef: (v: Vector3) => v.set(0, -1, 0),
          setLinearVelocity,
        },
      },
    } as unknown as NPC;

    scheduleSystem.addNPC(npc);
    scheduleSystem.update(0.016);

    // At spawn: sleep uses _moveTowardTarget which stops horizontal when "arrived"
    expect(setLinearVelocity).toHaveBeenCalledWith(expect.objectContaining({ x: 0, y: -1, z: 0 }));
  });
});
