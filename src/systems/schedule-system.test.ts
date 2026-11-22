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

  describe('getting round obstacles', () => {
    /** An NPC whose body doesn't move unless `free` says it may (a wall). */
    function walker(behavior: 'work' | 'wander', target: Vector3) {
      const position = new Vector3(0, 0, 0);
      const vel = new Vector3();
      const npc = {
        isDead: false, isAggressive: false, aiState: AIState.IDLE,
        patrolPoints: [], currentPatrolIndex: 0, waitTime: 0,
        patrolWaitMin: 0, patrolWaitMax: 0, patrolLookAroundAngle: 0,
        scheduleBlocks: [{ startHour: 0, endHour: 24, behavior }] as ScheduleBlock[],
        workPosition: target, homePosition: new Vector3(0, 0, 0), spawnPosition: new Vector3(0, 0, 0),
        mesh: { position, lookAt: vi.fn() },
        moveSpeed: 2,
        physicsAggregate: {
          body: {
            getLinearVelocityToRef: (v: Vector3) => v.set(0, 0, 0),
            setLinearVelocity: (v: Vector3) => vel.copyFrom(v),
          },
        },
      } as unknown as NPC;
      return { npc, position, vel };
    }

    it('sidesteps when pressed against a wall, then gives up rather than push forever', () => {
      const sys = new ScheduleSystem();
      sys.currentHour = 12;
      const { npc, vel } = walker('work', new Vector3(0, 0, 10));
      sys.addNPC(npc);
      // The NPC never moves (a wall in front): straight ahead first …
      sys.update(0.1);
      expect(vel.z).toBeGreaterThan(0.9);
      // … then, once stuck, a sidestep (mostly sideways).
      for (let i = 0; i < 16; i++) sys.update(0.1);
      expect(Math.abs(vel.x)).toBeGreaterThan(Math.abs(vel.z));
      // After repeated useless sidesteps it stands still.
      for (let i = 0; i < 200; i++) sys.update(0.1);
      expect(vel.x).toBe(0);
      expect(vel.z).toBe(0);
    });

    it('only sidesteps onto open ground, trying the other side first', () => {
      const sys = new ScheduleSystem();
      sys.currentHour = 12;
      const { npc, vel } = walker('work', new Vector3(0, 0, 10));
      sys.addNPC(npc);
      // Open ground only to the left (x < 0): a sidestep must go that way.
      sys.walkable = (x) => x < 0.01;
      for (let i = 0; i < 17; i++) sys.update(0.1);
      expect(vel.x).toBeLessThan(0);
      // Nothing open on either side: hold still instead of stepping into a building.
      const sys2 = new ScheduleSystem();
      sys2.currentHour = 12;
      const w2 = walker('work', new Vector3(0, 0, 10));
      sys2.addNPC(w2.npc);
      sys2.walkable = (x) => Math.abs(x) < 0.01;
      let sideways = 0;
      for (let i = 0; i < 200; i++) {
        sys2.update(0.1);
        if (Math.abs(w2.vel.x) > 1e-6) sideways++;
      }
      expect(sideways, "never steps sideways into blocked ground").toBe(0);
      // …and, as before, eventually gives up rather than pushing forever.
      expect(w2.vel.z).toBe(0);
    });

    it('does not count steady progress as stuck', () => {
      const sys = new ScheduleSystem();
      sys.currentHour = 12;
      const { npc, position, vel } = walker('work', new Vector3(0, 0, 30));
      sys.addNPC(npc);
      for (let i = 0; i < 100; i++) {
        sys.update(0.1);
        position.addInPlace(vel.scale(0.1));
        expect(Math.abs(vel.x)).toBeLessThan(1e-6);
      }
      expect(position.z).toBeGreaterThan(8);
    });

    it('only wanders to points it can walk to in a straight line', () => {
      const sys = new ScheduleSystem();
      sys.currentHour = 12;
      // A "building" covering x > 1.
      sys.walkable = (x) => x <= 1;
      const pick = (sys as unknown as { _pickRandomWanderPoint: (o: Vector3, f?: Vector3) => Vector3 })
        ._pickRandomWanderPoint.bind(sys);
      for (let n = 0; n < 200; n++) {
        const p = pick(new Vector3(0, 0, 0), new Vector3(-2, 0, 0));
        expect(p.x).toBeLessThanOrEqual(1);
      }
      // Without a predicate, anywhere in range goes.
      sys.walkable = null;
      const xs = Array.from({ length: 200 }, () => pick(new Vector3(0, 0, 0)).x);
      expect(Math.max(...xs)).toBeGreaterThan(1);
    });
  });
});
