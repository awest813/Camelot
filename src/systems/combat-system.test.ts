import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CombatSystem } from './combat-system';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Ray } from '@babylonjs/core/Culling/ray';

// Mock BabylonJS core features to avoid complex initialization
vi.mock('@babylonjs/core/Meshes/meshBuilder', () => ({
    MeshBuilder: {
        CreateSphere: vi.fn(() => ({
            position: new Vector3(),
            material: null,
            dispose: vi.fn(),
            isDisposed: vi.fn(() => false)
        }))
    }
}));

vi.mock('@babylonjs/core/Materials/standardMaterial', () => {
    return {
        StandardMaterial: class {
            diffuseColor: any = null;
            emissiveColor: any = null;
            constructor() {}
        }
    };
});

vi.mock('@babylonjs/core/Physics/v2/physicsAggregate', () => {
    return {
        PhysicsAggregate: class {
            body: any = {
                setMotionType: vi.fn(),
                applyImpulse: vi.fn(),
                getLinearVelocityToRef: vi.fn(),
                setLinearVelocity: vi.fn(),
            };
            dispose: any = vi.fn();
            constructor() {}
        }
    };
});

vi.mock('@babylonjs/core/Physics', () => ({
    PhysicsShapeType: { SPHERE: 1, CAPSULE: 2 },
    PhysicsMotionType: { DYNAMIC: 1, STATIC: 2 }
}));


describe('CombatSystem', () => {
    let combatSystem: CombatSystem;
    let mockScene: any;
    let mockPlayer: any;
    let mockNpcs: any[];
    let mockUI: any;

    beforeEach(() => {
        let observableCallbacks: any[] = [];

        mockScene = {
            pickWithRay: vi.fn(),
            onBeforeRenderObservable: {
                add: vi.fn((cb) => {
                    observableCallbacks.push(cb);
                    return cb;
                }),
                remove: vi.fn((cb) => {
                    observableCallbacks = observableCallbacks.filter(c => c !== cb);
                })
            },
            getEngine: vi.fn(() => ({
                getDeltaTime: vi.fn(() => 16.6) // Mock 60fps delta time
            })),
            // Helper for tests to manually trigger observable
            _triggerBeforeRender: () => {
                observableCallbacks.forEach(cb => cb());
            }
        };

        mockPlayer = {
            stamina: 100,
            magicka: 100,
            health: 100,
            bonusDamage: 0,
            bonusArmor: 0,
            bonusMagicDamage: 0,
            camera: {
                position: new Vector3(0, 0, 0),
                getForwardRay: vi.fn(() => ({
                    direction: new Vector3(0, 0, 1)
                }))
            },
            raycastForward: vi.fn(() => mockScene.pickWithRay())
        };

        const mockNpc = {
            mesh: {
                name: 'npc1',
                position: new Vector3(0, 0, 2),
                lookAt: vi.fn()
            },
            isDead: false,
            health: 50,
            takeDamage: vi.fn(),
            physicsAggregate: {
                body: { applyImpulse: vi.fn(), getLinearVelocityToRef: vi.fn(), setLinearVelocity: vi.fn() }
            },
            // AI state machine fields
            aiState: "PATROL",
            isAggressive: false,
            spawnPosition: new Vector3(0, 0, 2),
            alertTimer: 0,
            currentPath: [],
            pathIndex: 0,
            pathRefreshTimer: 0,
            setStateColor: vi.fn(),
            // Combat fields
            aggroRange: 10,
            attackRange: 2,
            attackEngageRangeMultiplier: 0.9,
            attackDisengageRangeMultiplier: 1.15,
            attackWindup: 0.35,
            attackDamage: 5,
            attackTimer: 0,
            attackCooldown: 2,
            moveSpeed: 2
        };

        mockNpcs = [mockNpc];

        mockUI = {
            showNotification: vi.fn(),
            showDamageNumber: vi.fn(),
            showHitFlash: vi.fn(),
        };

        combatSystem = new CombatSystem(mockScene, mockPlayer, mockNpcs, mockUI);
    });

    it('meleeAttack should fail if stamina is too low', () => {
        mockPlayer.stamina = 10;
        combatSystem.meleeAttack();
        expect(mockUI.showNotification).toHaveBeenCalledWith('Not enough stamina!');
        expect(mockPlayer.stamina).toBe(10);
        expect(mockScene.pickWithRay).not.toHaveBeenCalled();
    });

    it('meleeAttack should succeed and deduct stamina', () => {
        mockScene.pickWithRay.mockReturnValue({
            pickedMesh: mockNpcs[0].mesh,
            pickedPoint: new Vector3(0, 0, 1)
        });

        combatSystem.meleeAttack();

        expect(mockPlayer.stamina).toBe(85);
        expect(mockScene.pickWithRay).toHaveBeenCalled();
        expect(mockNpcs[0].takeDamage).toHaveBeenCalledWith(10); // Base MELEE_DAMAGE
        expect(mockUI.showDamageNumber).toHaveBeenCalled();
        expect(mockUI.showHitFlash).toHaveBeenCalled();
        expect(mockNpcs[0].isAggressive).toBe(true);
    });

    it('magicAttack should fail if magicka is too low', () => {
        mockPlayer.magicka = 10;
        combatSystem.magicAttack();
        expect(mockUI.showNotification).toHaveBeenCalledWith('Not enough magicka!');
        expect(mockScene.onBeforeRenderObservable.add).not.toHaveBeenCalled();
    });

    it('magicAttack should succeed and deduct magicka', () => {
        combatSystem.magicAttack();

        expect(mockPlayer.magicka).toBe(80);
        expect(mockScene.onBeforeRenderObservable.add).toHaveBeenCalled();
    });

    it('magicAttack should safely clean up resources via observable after 5 seconds', () => {
        combatSystem.magicAttack();

        // Find the newly added observable callback
        const addedObserver = mockScene.onBeforeRenderObservable.add.mock.calls[0][0];

        // Mock getDeltaTime to simulate 5000ms passing in one frame
        mockScene.getEngine.mockReturnValue({
            getDeltaTime: () => 5000
        });

        // Trigger the observable twice (first call skipped by frame-skip optimization)
        addedObserver();
        addedObserver();

        // Since elapsed time is >= 5000, it should remove itself
        expect(mockScene.onBeforeRenderObservable.remove).toHaveBeenCalledWith(addedObserver);

        // Note: Projectile and Agg disposal are internal to the function and we've mocked the classes.
        // Testing that the observable is removed proves the condition was met and block executed.
    });

    it('magicAttack should clean up resources upon hitting an NPC', () => {
        combatSystem.magicAttack();

        const addedObserver = mockScene.onBeforeRenderObservable.add.mock.calls[0][0];

        // Simulate a small time delta
        mockScene.getEngine.mockReturnValue({
            getDeltaTime: () => 16.6
        });

        // Move the mock projectile close to the NPC to trigger hit logic
        // Projectile position is initialized at player position + forward ray.
        // NPC is at (0, 0, 2). Projectile starts at (0, 0, 1). Distance is 1.0 < 1.2

        // Call twice: first call skipped by frame-skip optimization, second executes logic
        addedObserver();
        addedObserver();

        expect(mockNpcs[0].takeDamage).toHaveBeenCalledWith(20); // MAGIC_DAMAGE
        expect(mockScene.onBeforeRenderObservable.remove).toHaveBeenCalledWith(addedObserver);
    });

    it('uses hysteresis band for attack state transitions', () => {
        mockNpcs[0].aiState = 'CHASE';
        mockNpcs[0].attackRange = 2;
        mockNpcs[0].attackEngageRangeMultiplier = 0.9;
        mockNpcs[0].attackDisengageRangeMultiplier = 1.2;

        // Enter ATTACK inside engage range (2 * 0.9 = 1.8)
        mockNpcs[0].mesh.position = new Vector3(0, 0, 1.75);
        combatSystem.updateNPCAI(0.016);
        expect(mockNpcs[0].aiState).toBe('ATTACK');

        // Stay in ATTACK inside disengage range (2 * 1.2 = 2.4)
        mockNpcs[0].mesh.position = new Vector3(0, 0, 2.2);
        combatSystem.updateNPCAI(0.016);
        expect(mockNpcs[0].aiState).toBe('ATTACK');

        // Drop back to CHASE only after exceeding disengage range
        mockNpcs[0].mesh.position = new Vector3(0, 0, 2.5);
        combatSystem.updateNPCAI(0.016);
        expect(mockNpcs[0].aiState).toBe('CHASE');
    });

    it('applies attack windup and keeps cooldown ticking while chasing', () => {
        mockNpcs[0].aiState = 'CHASE';
        mockNpcs[0].attackRange = 2;
        mockNpcs[0].attackEngageRangeMultiplier = 1;
        mockNpcs[0].attackDisengageRangeMultiplier = 1.2;
        mockNpcs[0].attackWindup = 0.5;
        mockNpcs[0].attackCooldown = 2;
        mockNpcs[0].attackTimer = 0;

        // Enter ATTACK and set windup timer.
        mockNpcs[0].mesh.position = new Vector3(0, 0, 1.5);
        combatSystem.updateNPCAI(0.1);
        expect(mockNpcs[0].aiState).toBe('ATTACK');
        expect(mockNpcs[0].attackTimer).toBe(0.5);

        // Move out of attack band into CHASE; cooldown should continue ticking.
        mockNpcs[0].mesh.position = new Vector3(0, 0, 2.8);
        combatSystem.updateNPCAI(0.2);
        expect(mockNpcs[0].aiState).toBe('CHASE');
        expect(mockNpcs[0].attackTimer).toBe(0.3);
    });

    it('hands off attack ownership between nearby NPCs', () => {
        const npcA = mockNpcs[0];
        const npcB = {
            ...mockNpcs[0],
            mesh: {
                name: 'npc2',
                position: new Vector3(0, 0, 1.7),
                lookAt: vi.fn()
            },
            setStateColor: vi.fn(),
            physicsAggregate: {
                body: { applyImpulse: vi.fn(), getLinearVelocityToRef: vi.fn(), setLinearVelocity: vi.fn() }
            }
        };

        npcA.aiState = 'CHASE';
        npcA.mesh.position = new Vector3(0, 0, 1.5);
        npcA.attackTimer = 1;

        npcB.aiState = 'CHASE';
        npcB.attackTimer = 1;

        combatSystem.npcs = [npcA, npcB];

        // Closest NPC receives attack slot first.
        combatSystem.updateNPCAI(0.016);
        expect(npcA.aiState).toBe('ATTACK');
        expect(npcB.aiState).toBe('CHASE');

        // Move current attacker out of range so the second NPC takes over.
        npcA.mesh.position = new Vector3(0, 0, 5);
        combatSystem.updateNPCAI(0.016);
        expect(npcA.aiState).toBe('CHASE');
        expect(npcB.aiState).toBe('CHASE');

        // Next update grants attack slot to the remaining close NPC.
        combatSystem.updateNPCAI(0.016);
        expect(npcB.aiState).toBe('ATTACK');
    });

});
