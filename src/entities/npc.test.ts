import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NPC } from './npc';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { PhysicsMotionType } from '@babylonjs/core/Physics';

// Mock BabylonJS core features to avoid complex initialization
vi.mock('@babylonjs/core/Meshes/meshBuilder', () => ({
    MeshBuilder: {
        CreateCapsule: vi.fn((name, _options, _scene) => ({
            name,
            position: new Vector3(),
            material: null,
            metadata: null,
            dispose: vi.fn(),
            isDisposed: vi.fn().mockReturnValue(false)
        }))
    }
}));

vi.mock('@babylonjs/core/Materials/standardMaterial', () => {
    class MockStandardMaterial {
        diffuseColor: any = null;
        clone() {
            const mat = new MockStandardMaterial();
            mat.diffuseColor = this.diffuseColor ? { ...this.diffuseColor } : null;
            return mat;
        }
    }
    return { StandardMaterial: MockStandardMaterial };
});

vi.mock('@babylonjs/core/Physics/v2/physicsAggregate', () => {
    return {
        PhysicsAggregate: class {
            body: any = {
                setMotionType: vi.fn(),
                setMassProperties: vi.fn(),
            };
            dispose: any = vi.fn();
            constructor() {}
        }
    };
});

vi.mock('@babylonjs/core/Physics', () => ({
    PhysicsShapeType: { SPHERE: 1, CAPSULE: 2, BOX: 3 },
    PhysicsMotionType: { DYNAMIC: 1, STATIC: 2 }
}));

vi.mock('@babylonjs/core/Maths/math.color', () => {
    class MockColor3 {
        r: number;
        g: number;
        b: number;
        constructor(r: number, g: number, b: number) {
            this.r = r;
            this.g = g;
            this.b = b;
        }
        clone() {
            return new MockColor3(this.r, this.g, this.b);
        }
        static Red() { return new MockColor3(1, 0, 0); }
        static Yellow() { return new MockColor3(1, 1, 0); }
    }
    return { Color3: MockColor3 };
});

describe('NPC', () => {
    let mockScene: any;

    beforeEach(() => {
        mockScene = {};
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    describe('Initialization', () => {
        it('should initialize with default properties', () => {
            const npc = new NPC(mockScene, new Vector3(1, 2, 3), 'test_npc');

            expect(npc.scene).toBe(mockScene);
            expect(npc.targetPosition).toBeNull();
            expect(npc.moveSpeed).toBe(2);
            expect(npc.patrolPoints).toEqual([]);
            expect(npc.currentPatrolIndex).toBe(0);
            expect(npc.waitTime).toBe(0);

            expect(npc.health).toBe(100);
            expect(npc.maxHealth).toBe(100);
            expect(npc.isDead).toBe(false);

            expect(npc.isAggressive).toBe(false);
            expect(npc.aggroRange).toBe(12);
            expect(npc.attackRange).toBe(2.5);
            expect(npc.attackDamage).toBe(5);
            expect(npc.attackTimer).toBe(0);
            expect(npc.attackCooldown).toBe(2);
            expect(npc.xpReward).toBe(25);
            expect(npc.lootTable).toEqual([]);
        });

        it('should create mesh and physics aggregate correctly', () => {
            const npc = new NPC(mockScene, new Vector3(1, 2, 3), 'test_npc');

            expect(npc.mesh).toBeDefined();
            expect(npc.physicsAggregate).toBeDefined();

            // Verify mesh properties
            expect(npc.mesh.position).toEqual(new Vector3(1, 2, 3));
            expect(npc.mesh.material).toBeDefined();
            const mat = npc.mesh.material as any;
            expect(mat.diffuseColor.r).toBe(1);
            expect(mat.diffuseColor.g).toBe(1);
            expect(mat.diffuseColor.b).toBe(0);

            // Verify physics properties
            expect(npc.physicsAggregate.body.setMotionType).toHaveBeenCalledWith(PhysicsMotionType.DYNAMIC);
            expect(npc.physicsAggregate.body.setMassProperties).toHaveBeenCalledWith({ inertia: new Vector3(0, 0, 0) });
        });

        it('should set interaction metadata correctly', () => {
            const npc = new NPC(mockScene, new Vector3(1, 2, 3), 'test_npc');

            expect(npc.mesh.metadata).toEqual({ type: 'npc', npc: npc });
        });
    });

    describe('Logic', () => {
        let npc: NPC;

        beforeEach(() => {
            npc = new NPC(mockScene, new Vector3(0, 0, 0), 'test_npc');
        });

        it('should take damage and not die if health is > 0', () => {
            npc.takeDamage(10);

            expect(npc.health).toBe(90);
            expect(npc.isDead).toBe(false);
        });

        it('should flash red when taking damage', () => {
            npc.takeDamage(10);

            const mat = npc.mesh.material as any;
            expect(mat.diffuseColor.r).toBe(1);
            expect(mat.diffuseColor.g).toBe(0);
            expect(mat.diffuseColor.b).toBe(0);

            // Fast forward time to pass the 150ms timeout
            vi.advanceTimersByTime(150);

            // Should be back to base color (yellow)
            expect(mat.diffuseColor.r).toBe(1);
            expect(mat.diffuseColor.g).toBe(1);
            expect(mat.diffuseColor.b).toBe(0);
        });

        it('should die when health reaches 0', () => {
            npc.isAggressive = true;
            npc.takeDamage(100);

            expect(npc.health).toBe(0);
            expect(npc.isDead).toBe(true);
            expect(npc.isAggressive).toBe(false);

            // _die behavior checks
            const mat = npc.mesh.material as any;
            expect(mat.diffuseColor.r).toBe(0.3);
            expect(mat.diffuseColor.g).toBe(0.3);
            expect(mat.diffuseColor.b).toBe(0.3);

            expect(npc.physicsAggregate.body.setMotionType).toHaveBeenCalledWith(PhysicsMotionType.STATIC);
            expect(npc.mesh.metadata).toBeNull();
        });

        it('should not take damage if already dead', () => {
            npc.takeDamage(100); // kill the NPC
            expect(npc.health).toBe(0);
            expect(npc.isDead).toBe(true);

            npc.takeDamage(10); // hit again
            expect(npc.health).toBe(0);
        });

        it('health should not go below zero', () => {
            npc.takeDamage(150);
            expect(npc.health).toBe(0);
        });
    });
});
