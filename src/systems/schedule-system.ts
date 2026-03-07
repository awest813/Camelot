import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { NPC, AIState, ScheduleBehaviorType } from "../entities/npc";

/** How far a "wander" destination is picked from the NPC's home position. */
const WANDER_RADIUS = 8;

export class ScheduleSystem {
  public scene: Scene;
  public npcs: NPC[] = [];

  /**
   * Optional: current in-game hour (0–23).  When set, the schedule system
   * uses NPC.scheduleBlocks to choose the active behavior.  If not set,
   * NPCs fall back to their normal patrol logic.
   */
  public currentHour: number = -1;

  // Scratch vectors for performance optimization
  private _direction: Vector3 = new Vector3();
  private _velocity: Vector3 = new Vector3();
  private _currentVel: Vector3 = new Vector3();
  private _newVel: Vector3 = new Vector3();
  private _lookAtTarget: Vector3 = new Vector3();
  private _toTarget: Vector3 = new Vector3();
  private _patrolPauseHeading: WeakMap<NPC, Vector3> = new WeakMap();

  /** Per-NPC wander destination (refreshed when reached or expired). */
  private _wanderTargets: WeakMap<NPC, Vector3> = new WeakMap();

  constructor(scene: Scene) {
    this.scene = scene;
  }

  public addNPC(npc: NPC): void {
    this.npcs.push(npc);
  }

  public update(deltaTime: number): void {
    for (const npc of this.npcs) {
      this._updateNPC(npc, deltaTime);
    }
  }

  private _updateNPC(npc: NPC, deltaTime: number): void {
    // CombatSystem owns movement for any state other than IDLE/PATROL
    if (npc.isDead || npc.isAggressive) return;

    // Determine active schedule behavior (if any)
    const scheduledBehavior = this._getScheduledBehavior(npc);

    if (scheduledBehavior) {
      this._applyScheduledBehavior(npc, scheduledBehavior, deltaTime);
      return;
    }

    // Default: patrol logic
    if (npc.patrolPoints.length === 0) return;

    // Ensure aiState reflects that we are patrolling
    if (npc.aiState === AIState.IDLE) {
      npc.aiState = AIState.PATROL;
    }

    if (npc.waitTime > 0) {
      npc.waitTime -= deltaTime;
      this._applyPatrolIdleLook(npc);
      this._applyStopHorizontal(npc);
      return;
    }

    const target = npc.patrolPoints[npc.currentPatrolIndex];
    target.subtractToRef(npc.mesh.position, this._direction);

    // Ignore Y component for distance check on ground
    const distSqXZ = this._direction.x * this._direction.x + this._direction.z * this._direction.z;

    if (distSqXZ < 1.0) { // 1.0 squared is 1.0
      // Reached target
      npc.currentPatrolIndex = (npc.currentPatrolIndex + 1) % npc.patrolPoints.length;
      npc.waitTime = this._getPatrolWaitSeconds(npc);
      this._setPatrolIdleHeading(npc);
    } else {
      // Move towards target
      this._direction.y = 0;
      this._direction.normalize();
      this._direction.scaleToRef(npc.moveSpeed, this._velocity);

      if (npc.physicsAggregate && npc.physicsAggregate.body) {
         npc.physicsAggregate.body.getLinearVelocityToRef(this._currentVel);

         // Set X and Z velocity, keep Y (gravity)
         this._newVel.set(this._velocity.x, this._currentVel.y, this._velocity.z);
         npc.physicsAggregate.body.setLinearVelocity(this._newVel);

         // Rotate to face movement (ignore Y difference)
         this._lookAtTarget.set(target.x, npc.mesh.position.y, target.z);
         npc.mesh.lookAt(this._lookAtTarget);
      }

      this._patrolPauseHeading.delete(npc);
    }
  }

  // ── Schedule behavior helpers ──────────────────────────────────────────────

  /**
   * Returns the current scheduled behavior for the NPC based on
   * `this.currentHour` and the NPC's schedule blocks.
   * Returns null when no blocks are defined or `currentHour` is -1.
   */
  private _getScheduledBehavior(npc: NPC): ScheduleBehaviorType | null {
    if (this.currentHour < 0 || npc.scheduleBlocks.length === 0) return null;

    const hour = this.currentHour;
    for (const block of npc.scheduleBlocks) {
      // Handle blocks that wrap midnight (e.g. 22 → 6)
      const wraps = block.startHour > block.endHour;
      const inBlock = wraps
        ? (hour >= block.startHour || hour < block.endHour)
        : (hour >= block.startHour && hour < block.endHour);
      if (inBlock) return block.behavior;
    }
    return null;
  }

  private _applyScheduledBehavior(
    npc: NPC,
    behavior: ScheduleBehaviorType,
    deltaTime: number,
  ): void {
    switch (behavior) {
      case "sleep":
        this._applySleepBehavior(npc, deltaTime);
        break;
      case "work":
        this._applyWorkBehavior(npc, deltaTime);
        break;
      case "wander":
        this._applyWanderBehavior(npc, deltaTime);
        break;
      case "patrol":
        // Fall through to regular patrol logic handled above
        break;
    }
  }

  /**
   * Sleep: NPC moves to homePosition (if far) then stops and idles.
   */
  private _applySleepBehavior(npc: NPC, deltaTime: number): void {
    const target = npc.homePosition ?? npc.spawnPosition;
    this._moveTowardTarget(npc, target, deltaTime, 0.5);
    npc.aiState = AIState.IDLE;
  }

  /**
   * Work: NPC moves to workPosition and stands there.
   */
  private _applyWorkBehavior(npc: NPC, deltaTime: number): void {
    const target = npc.workPosition ?? npc.spawnPosition;
    this._moveTowardTarget(npc, target, deltaTime, 1.0);
    if (npc.aiState === AIState.IDLE) return;
    npc.aiState = AIState.IDLE;
  }

  /**
   * Wander: NPC picks random destinations near its spawn position.
   */
  private _applyWanderBehavior(npc: NPC, deltaTime: number): void {
    let wanderTarget = this._wanderTargets.get(npc);
    const origin = npc.homePosition ?? npc.spawnPosition;

    if (!wanderTarget) {
      wanderTarget = this._pickRandomWanderPoint(origin);
      this._wanderTargets.set(npc, wanderTarget);
    }

    const reached = this._moveTowardTarget(npc, wanderTarget, deltaTime, npc.moveSpeed);
    if (reached) {
      this._wanderTargets.delete(npc);
      npc.waitTime = this._getPatrolWaitSeconds(npc);
    }
  }

  /**
   * Move the NPC toward `target` at `speed`.
   * Returns true when the NPC is within arrival distance.
   */
  private _moveTowardTarget(
    npc: NPC,
    target: Vector3,
    _deltaTime: number,
    speed: number,
  ): boolean {
    target.subtractToRef(npc.mesh.position, this._direction);
    this._direction.y = 0;
    const distSq = this._direction.x ** 2 + this._direction.z ** 2;

    if (distSq < 1.0) {
      this._applyStopHorizontal(npc);
      return true;
    }

    this._direction.normalize();
    this._direction.scaleToRef(speed, this._velocity);

    if (npc.physicsAggregate?.body) {
      npc.physicsAggregate.body.getLinearVelocityToRef(this._currentVel);
      this._newVel.set(this._velocity.x, this._currentVel.y, this._velocity.z);
      npc.physicsAggregate.body.setLinearVelocity(this._newVel);

      this._lookAtTarget.set(target.x, npc.mesh.position.y, target.z);
      npc.mesh.lookAt(this._lookAtTarget);
    }

    return false;
  }

  /** Generate a random point within WANDER_RADIUS of origin. */
  private _pickRandomWanderPoint(origin: Vector3): Vector3 {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * WANDER_RADIUS;
    return new Vector3(
      origin.x + Math.cos(angle) * radius,
      origin.y,
      origin.z + Math.sin(angle) * radius,
    );
  }

  // ── Patrol helpers (unchanged) ────────────────────────────────────────────

  private _getPatrolWaitSeconds(npc: NPC): number {
    const min = Math.max(0, Math.min(npc.patrolWaitMin, npc.patrolWaitMax));
    const max = Math.max(min, Math.max(npc.patrolWaitMin, npc.patrolWaitMax));
    return min + (max - min) * Math.random();
  }

  private _setPatrolIdleHeading(npc: NPC): void {
    npc.patrolPoints[npc.currentPatrolIndex].subtractToRef(npc.mesh.position, this._toTarget);
    const baseAngle = Math.atan2(this._toTarget.x, this._toTarget.z);
    const randomOffset = (Math.random() * 2 - 1) * npc.patrolLookAroundAngle;
    const heading = baseAngle + randomOffset;

    let headingVec = this._patrolPauseHeading.get(npc);
    if (!headingVec) {
      headingVec = new Vector3();
      this._patrolPauseHeading.set(npc, headingVec);
    }
    headingVec.set(Math.sin(heading), 0, Math.cos(heading));
  }

  private _applyPatrolIdleLook(npc: NPC): void {
    const lookDir = this._patrolPauseHeading.get(npc);
    if (!lookDir) return;
    this._lookAtTarget.set(
      npc.mesh.position.x + lookDir.x,
      npc.mesh.position.y,
      npc.mesh.position.z + lookDir.z,
    );
    npc.mesh.lookAt(this._lookAtTarget);
  }

  private _applyStopHorizontal(npc: NPC): void {
    if (!npc.physicsAggregate?.body) return;
    npc.physicsAggregate.body.getLinearVelocityToRef(this._currentVel);
    this._newVel.set(0, this._currentVel.y, 0);
    npc.physicsAggregate.body.setLinearVelocity(this._newVel);
  }
}

