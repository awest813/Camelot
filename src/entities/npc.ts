import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType, PhysicsMotionType } from "@babylonjs/core/Physics";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";

/**
 * AI state machine states for NPC behaviour.
 *
 * Transition graph:
 *   IDLE   → PATROL  (if patrolPoints assigned)
 *   IDLE   → ALERT   (player enters aggroRange)
 *   PATROL → ALERT   (player enters aggroRange)
 *   ALERT  → CHASE   (alertDuration elapsed, player still close)
 *   ALERT  → PATROL  (player escaped during alert window)
 *   CHASE  → ATTACK  (player within attackRange)
 *   CHASE  → RETURN  (player > 2×aggroRange away)
 *   ATTACK → CHASE   (player stepped out of attackRange)
 *   ATTACK → RETURN  (player > 2×aggroRange away)
 *   RETURN → ALERT   (player re-enters aggroRange during return)
 *   RETURN → PATROL  (reached spawnPosition)
 */
export enum AIState {
  IDLE   = "IDLE",
  PATROL = "PATROL",
  ALERT  = "ALERT",
  CHASE  = "CHASE",
  ATTACK = "ATTACK",
  RETURN = "RETURN",
}

export class NPC {
  public mesh: Mesh;
  public physicsAggregate: PhysicsAggregate;
  public scene: Scene;

  // Schedule/AI properties
  public targetPosition: Vector3 | null = null;
  public moveSpeed: number = 2;
  public patrolPoints: Vector3[] = [];
  public currentPatrolIndex: number = 0;
  public waitTime: number = 0;

  // Health
  public health: number = 100;
  public maxHealth: number = 100;
  public isDead: boolean = false;

  // ─── AI State Machine ───────────────────────────────────────────────────────

  /** Current AI state. Managed by CombatSystem. */
  public aiState: AIState = AIState.IDLE;

  /**
   * Legacy backward-compatible flag. Kept in sync with aiState so that
   * ScheduleSystem and DialogueSystem continue to work without modification.
   * true  → ALERT | CHASE | ATTACK | RETURN
   * false → IDLE  | PATROL
   */
  public isAggressive: boolean = false;

  /** World position where this NPC was initially spawned; used for RETURN state. */
  public spawnPosition: Vector3;

  // ─── Alert state ────────────────────────────────────────────────────────────

  /** Seconds spent in the ALERT state so far. */
  public alertTimer: number = 0;

  /** How long (seconds) the NPC pauses in ALERT before transitioning to CHASE. */
  public readonly alertDuration: number = 1.5;

  // ─── Pathfinding ────────────────────────────────────────────────────────────

  /** Waypoints of the current nav path (empty = no path). */
  public currentPath: Vector3[] = [];

  /** Index of the next waypoint to walk toward in currentPath. */
  public pathIndex: number = 0;

  /** Counts down from pathRefreshInterval; path is recomputed when ≤ 0. */
  public pathRefreshTimer: number = 0;

  /** Seconds between automatic path recomputes while chasing/returning. */
  public readonly pathRefreshInterval: number = 0.5;

  // ─── Combat AI ──────────────────────────────────────────────────────────────

  public aggroRange: number = 12;
  public attackRange: number = 2.5;
  public attackDamage: number = 5;
  public attackTimer: number = 0;
  public attackCooldown: number = 2; // seconds between attacks
  public xpReward: number = 25;

  // ─── Visuals ────────────────────────────────────────────────────────────────

  /** Current "resting" diffuse colour — restored after a hit-flash. */
  private _baseColor: Color3 = Color3.Yellow();

  // ───────────────────────────────────────────────────────────────────────────

  constructor(scene: Scene, position: Vector3, name: string) {
    this.scene = scene;
    this.spawnPosition = position.clone();
    this._createMesh(position, name);
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Change the NPC's base colour (shown at rest and after hit-flashes).
   * Call this whenever the AI state transitions to a new visual category.
   */
  public setStateColor(color: Color3): void {
    this._baseColor = color.clone();
    if (!this.mesh.isDisposed() && !this.isDead) {
      (this.mesh.material as StandardMaterial).diffuseColor = color.clone();
    }
  }

  public takeDamage(amount: number): void {
    if (this.isDead) return;
    this.health = Math.max(0, this.health - amount);
    this._flashHit();
    if (this.health <= 0) {
      this._die();
    }
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  /** Brief red flash on hit, then restore the current state colour. */
  private _flashHit(): void {
    if (this.mesh.isDisposed()) return;
    const mat = this.mesh.material as StandardMaterial;
    mat.diffuseColor = Color3.Red();
    setTimeout(() => {
      if (!this.isDead && !this.mesh.isDisposed()) {
        mat.diffuseColor = this._baseColor.clone();
      }
    }, 150);
  }

  private _die(): void {
    this.isDead = true;
    this.isAggressive = false;
    this.aiState = AIState.IDLE;
    this.currentPath = [];
    const mat = this.mesh.material as StandardMaterial;
    mat.diffuseColor = new Color3(0.3, 0.3, 0.3);
    this.physicsAggregate.body.setMotionType(PhysicsMotionType.STATIC);
    // Remove interaction metadata so dead NPCs can't be targeted
    this.mesh.metadata = null;
  }

  private _createMesh(position: Vector3, name: string): void {
    this.mesh = MeshBuilder.CreateCapsule(name, { radius: 0.5, height: 2 }, this.scene);
    this.mesh.position = position;

    const material = new StandardMaterial(`${name}_mat`, this.scene);
    material.diffuseColor = Color3.Yellow();
    this.mesh.material = material;

    this.physicsAggregate = new PhysicsAggregate(
      this.mesh, PhysicsShapeType.CAPSULE, { mass: 1, restitution: 0 }, this.scene
    );
    this.physicsAggregate.body.setMotionType(PhysicsMotionType.DYNAMIC);
    // Lock rotation axes so the capsule stays upright
    this.physicsAggregate.body.setMassProperties({ inertia: new Vector3(0, 0, 0) });

    this.mesh.metadata = { type: "npc", npc: this };
  }
}
