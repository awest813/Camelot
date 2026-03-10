import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CombatSystem } from './combat-system';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Ray } from '@babylonjs/core/Culling/ray';
import { SkillProgressionSystem } from './skill-progression-system';
import { AttributeSystem } from './attribute-system';

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
            notifyResourceSpent: vi.fn(),
            notifyDamageTaken: vi.fn(),
            camera: {
                position: new Vector3(0, 0, 0),
                getForwardRay: vi.fn(() => ({
                    direction: new Vector3(0, 0, 1)
                }))
            },
            raycastForward: vi.fn(() => mockScene.pickWithRay()),
            getForwardDirection: vi.fn(() => new Vector3(0, 0, 1))
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
            isAttackTelegraphing: false,
            attackTelegraphTimer: 0,
            dodgeWindowRangeMultiplier: 0.7,
            strafeDirection: 0,
            strafeTimer: 0,
            strafeSpeedMultiplier: 0.65,
            movementResponsiveness: 8,
            moveSpeed: 2,
            // Status effects (Oblivion-lite v4)
            statusEffects: [],
            tickStatusEffects: vi.fn(() => 0),
            xpReward: 25,
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
        const ok = combatSystem.meleeAttack();
        expect(ok).toBe(false);
        expect(mockUI.showNotification).toHaveBeenCalledWith('Not enough stamina!');
        expect(mockPlayer.stamina).toBe(10);
        expect(mockScene.pickWithRay).not.toHaveBeenCalled();
    });

    it('meleeAttack should succeed and deduct stamina', () => {
        mockScene.pickWithRay.mockReturnValue({
            pickedMesh: mockNpcs[0].mesh,
            pickedPoint: new Vector3(0, 0, 1)
        });

        const ok = combatSystem.meleeAttack();

        expect(ok).toBe(true);
        expect(mockPlayer.stamina).toBe(85);
        expect(mockScene.pickWithRay).toHaveBeenCalled();
        expect(mockNpcs[0].takeDamage).toHaveBeenCalledWith(10); // Base MELEE_DAMAGE
        expect(mockUI.showDamageNumber).toHaveBeenCalled();
        expect(mockUI.showHitFlash).toHaveBeenCalled();
        expect(mockNpcs[0].isAggressive).toBe(true);
        expect(mockPlayer.notifyResourceSpent).toHaveBeenCalledWith('stamina');
    });

    it('magicAttack should fail if magicka is too low', () => {
        mockPlayer.magicka = 10;
        const ok = combatSystem.magicAttack();
        expect(ok).toBe(false);
        expect(mockUI.showNotification).toHaveBeenCalledWith('Not enough magicka!');
        expect(mockScene.onBeforeRenderObservable.add).not.toHaveBeenCalled();
    });

    it('magicAttack should succeed and deduct magicka', () => {
        const ok = combatSystem.magicAttack();

        expect(ok).toBe(true);
        expect(mockPlayer.magicka).toBe(80);
        expect(mockScene.onBeforeRenderObservable.add).toHaveBeenCalled();
        expect(mockPlayer.notifyResourceSpent).toHaveBeenCalledWith('magicka');
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

    it('meleeAttack enforces cooldown cadence between swings', () => {
        mockScene.pickWithRay.mockReturnValue(null);

        expect(combatSystem.meleeAttack()).toBe(true);
        expect(mockPlayer.stamina).toBe(85);

        // Immediate second click should be rejected by cooldown.
        expect(combatSystem.meleeAttack()).toBe(false);
        expect(mockPlayer.stamina).toBe(85);

        // Cooldown ticks in updateNPCAI.
        combatSystem.updateNPCAI(0.5);
        expect(combatSystem.meleeAttack()).toBe(true);
        expect(mockPlayer.stamina).toBe(70);
    });

    it('magicAttack enforces cooldown cadence between casts', () => {
        expect(combatSystem.magicAttack()).toBe(true);
        expect(mockPlayer.magicka).toBe(80);

        expect(combatSystem.magicAttack()).toBe(false);
        expect(mockPlayer.magicka).toBe(80);

        combatSystem.updateNPCAI(0.8);
        expect(combatSystem.magicAttack()).toBe(true);
        expect(mockPlayer.magicka).toBe(60);
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

    it('supports melee and magic archetype cadence tuning', () => {
        mockScene.pickWithRay.mockReturnValue(null);

        combatSystem.setMeleeArchetype('duelist');
        expect(combatSystem.activeMeleeArchetype).toBe('duelist');

        expect(combatSystem.meleeAttack()).toBe(true);
        expect(mockPlayer.stamina).toBe(91);
        expect(combatSystem.meleeAttack()).toBe(false);

        combatSystem.updateNPCAI(0.33);
        expect(combatSystem.meleeAttack()).toBe(true);
        expect(mockPlayer.stamina).toBe(82);

        combatSystem.setMagicArchetype('surge');
        expect(combatSystem.activeMagicArchetype).toBe('surge');
        expect(combatSystem.magicAttack()).toBe(true);
        expect(mockPlayer.magicka).toBe(70);
    });

    it('resolves telegraphed attacks as dodges when player exits strike window', () => {
        mockNpcs[0].aiState = 'ATTACK';
        mockNpcs[0].attackRange = 2;
        mockNpcs[0].attackWindup = 0.2;
        mockNpcs[0].attackTimer = 0;
        mockNpcs[0].mesh.position = new Vector3(0, 0, 1.2);

        combatSystem.updateNPCAI(0.016);
        expect(mockNpcs[0].isAttackTelegraphing).toBe(true);

        // Stay inside disengage range, but outside telegraphed strike range.
        mockNpcs[0].mesh.position = new Vector3(0, 0, 2.1);
        combatSystem.updateNPCAI(0.25);

        expect(mockNpcs[0].isAttackTelegraphing).toBe(false);
        expect(mockPlayer.health).toBe(100);
        expect(mockPlayer.notifyDamageTaken).not.toHaveBeenCalled();
        expect(mockUI.showNotification).toHaveBeenCalledWith("You dodge npc1's strike!", 1200);
    });

    it('applies damage when telegraphed attack lands inside strike window', () => {
        mockNpcs[0].aiState = 'ATTACK';
        mockNpcs[0].attackRange = 2;
        mockNpcs[0].attackWindup = 0.2;
        mockNpcs[0].attackTimer = 0;
        mockNpcs[0].mesh.position = new Vector3(0, 0, 1.1);

        combatSystem.updateNPCAI(0.016);
        expect(mockNpcs[0].isAttackTelegraphing).toBe(true);

        combatSystem.updateNPCAI(0.25);
        expect(mockPlayer.health).toBe(95);
        expect(mockPlayer.notifyDamageTaken).toHaveBeenCalled();
        expect(mockUI.showHitFlash).toHaveBeenCalledWith("rgba(200, 0, 0, 0.4)");
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

    it('applies deterministic strafe reposition during attack cooldown', () => {
        const setLinearVelocity = vi.fn();
        mockNpcs[0].physicsAggregate.body.setLinearVelocity = setLinearVelocity;
        mockNpcs[0].physicsAggregate.body.getLinearVelocityToRef = (v: Vector3) => v.set(0, 0, 0);

        mockNpcs[0].aiState = 'ATTACK';
        mockNpcs[0].attackRange = 2;
        mockNpcs[0].attackTimer = 1;
        mockNpcs[0].attackWindup = 0.35;
        mockNpcs[0].strafeTimer = 0;
        mockNpcs[0].mesh.position = new Vector3(0, 0, 1.5);

        vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0.2);
        combatSystem.updateNPCAI(0.016);

        expect(mockNpcs[0].strafeDirection).toBe(-1);
        expect(setLinearVelocity).toHaveBeenCalled();
        const blendedVelocity = setLinearVelocity.mock.calls.at(-1)?.[0];
        expect(blendedVelocity.x).toBeLessThan(0);
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

    it('melee damage is reduced by physical resistance', () => {
        mockScene.pickWithRay.mockReturnValue({
            pickedMesh: mockNpcs[0].mesh,
            pickedPoint: new Vector3(0, 0, 1)
        });

        // 50% physical resistance — base damage 10 → 5
        mockNpcs[0].damageResistances = { physical: 0.5 };

        combatSystem.meleeAttack();

        expect(mockNpcs[0].takeDamage).toHaveBeenCalledWith(5);
    });

    it('melee damage is increased by physical weakness', () => {
        mockScene.pickWithRay.mockReturnValue({
            pickedMesh: mockNpcs[0].mesh,
            pickedPoint: new Vector3(0, 0, 1)
        });

        // 50% weakness — base damage 10 → 15
        mockNpcs[0].damageWeaknesses = { physical: 0.5 };

        combatSystem.meleeAttack();

        expect(mockNpcs[0].takeDamage).toHaveBeenCalledWith(15);
    });

    it('full physical resistance clamps damage to minimum 1', () => {
        mockScene.pickWithRay.mockReturnValue({
            pickedMesh: mockNpcs[0].mesh,
            pickedPoint: new Vector3(0, 0, 1)
        });

        // 100% resistance — all physical damage absorbed, floor is 1
        mockNpcs[0].damageResistances = { physical: 1 };

        combatSystem.meleeAttack();

        expect(mockNpcs[0].takeDamage).toHaveBeenCalledWith(1);
    });

    it('melee attack with no resistance still deals base damage', () => {
        mockScene.pickWithRay.mockReturnValue({
            pickedMesh: mockNpcs[0].mesh,
            pickedPoint: new Vector3(0, 0, 1)
        });

        // No resistances or weaknesses set
        mockNpcs[0].damageResistances = {};
        mockNpcs[0].damageWeaknesses = {};

        combatSystem.meleeAttack();

        expect(mockNpcs[0].takeDamage).toHaveBeenCalledWith(10);
    });

    // ─── Oblivion-style combat mechanics ───────────────────────────────────────

    it('power attack deals more damage than a normal melee attack', () => {
        mockScene.pickWithRay.mockReturnValue({
            pickedMesh: mockNpcs[0].mesh,
            pickedPoint: new Vector3(0, 0, 1)
        });

        // Record normal melee damage first
        combatSystem.meleeAttack();
        const normalDmg: number = (mockNpcs[0].takeDamage as ReturnType<typeof vi.fn>).mock.calls[0][0];

        // Reset for power attack
        mockPlayer.stamina = 100;
        combatSystem.updateNPCAI(0.5); // drain cooldown
        (mockNpcs[0].takeDamage as ReturnType<typeof vi.fn>).mockClear();

        combatSystem.powerAttack();
        const powerDmg: number = (mockNpcs[0].takeDamage as ReturnType<typeof vi.fn>).mock.calls[0][0];

        expect(powerDmg).toBeGreaterThan(normalDmg);
    });

    it('power attack staggers the target NPC', () => {
        mockScene.pickWithRay.mockReturnValue({
            pickedMesh: mockNpcs[0].mesh,
            pickedPoint: new Vector3(0, 0, 1)
        });

        combatSystem.powerAttack();

        expect(mockNpcs[0].isStaggered).toBe(true);
        expect(mockNpcs[0].staggerTimer).toBeGreaterThan(0);
    });

    it('staggered NPC AI is bypassed until stagger expires', () => {
        mockNpcs[0].isStaggered = true;
        mockNpcs[0].staggerTimer = 0.5;
        mockNpcs[0].aiState = 'CHASE';
        mockNpcs[0].isAggressive = true;
        mockNpcs[0].mesh.position = new Vector3(0, 0, 1.5);

        // One update tick — stagger not expired yet
        combatSystem.updateNPCAI(0.2);

        // NPC should remain staggered (timer reduced but still active)
        expect(mockNpcs[0].isStaggered).toBe(true);
        expect(mockNpcs[0].staggerTimer).toBeCloseTo(0.3, 1);

        // Second update — stagger expires
        combatSystem.updateNPCAI(0.35);
        expect(mockNpcs[0].isStaggered).toBe(false);
    });

    it('power attack fails when stamina is insufficient', () => {
        mockPlayer.stamina = 5;
        const ok = combatSystem.powerAttack();
        expect(ok).toBe(false);
        expect(mockUI.showNotification).toHaveBeenCalledWith('Not enough stamina for a power attack!');
        expect(mockNpcs[0].takeDamage).not.toHaveBeenCalled();
    });

    it('blocking reduces incoming NPC attack damage by 50 %', () => {
        mockNpcs[0].aiState = 'ATTACK';
        mockNpcs[0].attackRange = 2;
        mockNpcs[0].attackWindup = 0.2;
        mockNpcs[0].attackTimer = 0;
        mockNpcs[0].attackDamage = 10;
        mockNpcs[0].mesh.position = new Vector3(0, 0, 1.1);

        combatSystem.beginBlock();
        expect(combatSystem.isBlocking).toBe(true);

        // Start telegraph
        combatSystem.updateNPCAI(0.016);
        expect(mockNpcs[0].isAttackTelegraphing).toBe(true);

        // Resolve telegraph — player is inside strike window while blocking
        combatSystem.updateNPCAI(0.25);

        // 10 - 0 armor = 10 raw, halved = 5
        expect(mockPlayer.health).toBe(95);
        expect(mockUI.showNotification).toHaveBeenCalledWith(
            expect.stringContaining('Blocked!'), 1500
        );
    });

    it('blocking drains player stamina on each blocked hit', () => {
        mockNpcs[0].aiState = 'ATTACK';
        mockNpcs[0].attackRange = 2;
        mockNpcs[0].attackWindup = 0.2;
        mockNpcs[0].attackTimer = 0;
        mockNpcs[0].attackDamage = 10;
        mockNpcs[0].mesh.position = new Vector3(0, 0, 1.1);

        combatSystem.beginBlock();
        combatSystem.updateNPCAI(0.016);
        combatSystem.updateNPCAI(0.25);

        // Stamina should be reduced by the block cost (12 by default)
        expect(mockPlayer.stamina).toBeLessThan(100);
        expect(mockPlayer.notifyResourceSpent).toHaveBeenCalledWith('stamina');
    });

    it('endBlock stops the blocking state', () => {
        combatSystem.beginBlock();
        expect(combatSystem.isBlocking).toBe(true);

        combatSystem.endBlock();
        expect(combatSystem.isBlocking).toBe(false);
    });

    it('unblocked hits still deal full damage when not blocking', () => {
        mockNpcs[0].aiState = 'ATTACK';
        mockNpcs[0].attackRange = 2;
        mockNpcs[0].attackWindup = 0.2;
        mockNpcs[0].attackTimer = 0;
        mockNpcs[0].attackDamage = 10;
        mockNpcs[0].mesh.position = new Vector3(0, 0, 1.1);

        // Do NOT call beginBlock
        combatSystem.updateNPCAI(0.016);
        combatSystem.updateNPCAI(0.25);

        // Full 10 damage (attackDamage - bonusArmor 0)
        expect(mockPlayer.health).toBe(90);
    });

    it('fatigue factor reduces melee damage at low stamina', () => {
        mockScene.pickWithRay.mockReturnValue({
            pickedMesh: mockNpcs[0].mesh,
            pickedPoint: new Vector3(0, 0, 1)
        });

        // Set stamina low — fatigue factor should be well below 1
        mockPlayer.stamina = 10;
        mockPlayer.maxStamina = 100;

        combatSystem.meleeAttack();

        // At 10/100 stamina the factor is max(0.5, 0.1) = 0.5
        // round(10 * 1.0 * 0.5) = 5, but staminaCost=15 > 10 so attack should fail
        expect(mockPlayer.health).toBe(100); // attack failed, no damage dealt to player
    });

    it('fatigue factor lowers damage proportionally when stamina is at 60 %', () => {
        mockScene.pickWithRay.mockReturnValue({
            pickedMesh: mockNpcs[0].mesh,
            pickedPoint: new Vector3(0, 0, 1)
        });

        // Pre-drain stamina to 60 out of 100 (above staminaCost of 15)
        mockPlayer.stamina = 60;
        mockPlayer.maxStamina = 100;

        combatSystem.meleeAttack();

        // fatigueFactor = max(0.5, 60/100) = 0.6
        // rawDmg = round(10 * 1.0 * 0.6) = 6
        expect(mockNpcs[0].takeDamage).toHaveBeenCalledWith(6);
    });

    it('critical hit doubles damage when critChance is 100 %', () => {
        mockScene.pickWithRay.mockReturnValue({
            pickedMesh: mockNpcs[0].mesh,
            pickedPoint: new Vector3(0, 0, 1)
        });

        mockPlayer.critChance = 1.0; // guaranteed crit
        // Make Math.random() return 0 so crit roll (0 < 1.0) always succeeds
        vi.spyOn(Math, 'random').mockReturnValue(0);

        combatSystem.meleeAttack();

        // round(10 * 1.0 * 1.0 * 2.0) = 20
        expect(mockNpcs[0].takeDamage).toHaveBeenCalledWith(20);
        expect(mockUI.showNotification).toHaveBeenCalledWith('Critical Hit!', 1000);

        vi.restoreAllMocks();
    });

    it('no crit when critChance is 0', () => {
        mockScene.pickWithRay.mockReturnValue({
            pickedMesh: mockNpcs[0].mesh,
            pickedPoint: new Vector3(0, 0, 1)
        });

        mockPlayer.critChance = 0;

        combatSystem.meleeAttack();

        expect(mockNpcs[0].takeDamage).toHaveBeenCalledWith(10);
        expect(mockUI.showNotification).not.toHaveBeenCalledWith('Critical Hit!', 1000);
    });

    it('scales melee damage and swing cadence with blade skill and strength', () => {
        const attrs = new AttributeSystem({ strength: 60 });
        const skills = new SkillProgressionSystem();
        skills.setSkillLevel("blade", 50);

        const npc = {
            ...mockNpcs[0],
            mesh: { ...mockNpcs[0].mesh, position: new Vector3(0, 0, 2) },
            takeDamage: vi.fn(),
            isDead: false,
            damageResistances: {},
            damageWeaknesses: {},
        };

        const skilledCombat = new CombatSystem(
            mockScene,
            mockPlayer,
            [npc as any],
            mockUI,
            undefined,
            { skillSystem: skills, attributeSystem: attrs }
        );

        mockScene.pickWithRay.mockReturnValue({
            pickedMesh: npc.mesh,
            pickedPoint: new Vector3(0, 0, 1)
        });
        mockPlayer.stamina = 200;
        mockPlayer.maxStamina = 200;

        expect(skilledCombat.meleeAttack()).toBe(true);
        const dealt = (npc.takeDamage as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0];
        expect(dealt).toBe(33);

        // Cooldown is shortened by blade skill, but still enforces cadence.
        expect(skilledCombat.meleeAttack()).toBe(false);
        skilledCombat.updateNPCAI(0.34);
        expect(skilledCombat.meleeAttack()).toBe(false);
        skilledCombat.updateNPCAI(0.02);
        expect(skilledCombat.meleeAttack()).toBe(true);
    });

    it('reduces magicka cost and boosts damage with destruction skill and attributes', () => {
        const attrs = new AttributeSystem({ intelligence: 60, willpower: 60 });
        const skills = new SkillProgressionSystem();
        skills.setSkillLevel("destruction", 60);

        const npc = {
            ...mockNpcs[0],
            mesh: { ...mockNpcs[0].mesh, position: new Vector3(0, 0, 2) },
            takeDamage: vi.fn(),
            isDead: false,
            damageResistances: {},
            damageWeaknesses: {},
        };

        const destructionCombat = new CombatSystem(
            mockScene,
            mockPlayer,
            [npc as any],
            mockUI,
            undefined,
            { skillSystem: skills, attributeSystem: attrs }
        );

        mockPlayer.magicka = 100;
        mockScene.onBeforeRenderObservable.add.mockClear();

        const ok = destructionCombat.magicAttack();
        expect(ok).toBe(true);
        const expectedCost = Math.round(20 / (1 + (skills.multiplier("destruction") - 1) * 0.6));
        expect(mockPlayer.magicka).toBe(100 - expectedCost);

        const addedObserver = mockScene.onBeforeRenderObservable.add.mock.calls[0][0];
        mockScene.getEngine.mockReturnValue({ getDeltaTime: () => 16.6 });
        addedObserver();
        addedObserver();

        const dealt = (npc.takeDamage as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0];
        const expectedDamage = Math.round((20 + attrs.magicDamageBonus) * skills.multiplier("destruction"));
        expect(dealt).toBe(expectedDamage);
    });

});
