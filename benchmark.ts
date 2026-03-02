import { ScheduleSystem } from './src/systems/schedule-system';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { NPC, AIState } from './src/entities/npc';

// Create a mock Scene
const mockScene = {} as any;
const system = new ScheduleSystem(mockScene);

// Create 5000 NPCs to increase load
for (let i = 0; i < 5000; i++) {
  const npc = {
    isDead: false,
    isAggressive: false,
    aiState: AIState.PATROL,
    patrolPoints: [new Vector3(0, 0, 0), new Vector3(100, 0, 100)],
    currentPatrolIndex: 0,
    waitTime: 0,
    patrolWaitMin: 1,
    patrolWaitMax: 3,
    patrolLookAroundAngle: Math.PI / 3,
    mesh: { position: new Vector3(Math.random() * 10, 0, Math.random() * 10), lookAt: () => {} },
    moveSpeed: 2,
    physicsAggregate: {
      body: {
        getLinearVelocityToRef: (v: Vector3) => v.set(0, -1, 0),
        setLinearVelocity: () => {},
      },
    },
  } as unknown as NPC;

  system.addNPC(npc);
}

const numIterations = 5000;

// Warmup
for (let i = 0; i < 1000; i++) {
  system.update(0.016);
}

const start = performance.now();

for (let i = 0; i < numIterations; i++) {
  system.update(0.016);
}

const end = performance.now();
console.log(`Time taken: ${(end - start).toFixed(2)} ms`);
