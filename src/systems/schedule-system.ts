import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { NPC, AIState } from "../entities/npc";

export class ScheduleSystem {
  public scene: Scene;
  public npcs: NPC[] = [];

  // Scratch vectors for performance optimization
  private _direction: Vector3 = new Vector3();
  private _velocity: Vector3 = new Vector3();
  private _currentVel: Vector3 = new Vector3();
  private _newVel: Vector3 = new Vector3();
  private _lookAtTarget: Vector3 = new Vector3();
  private _toTarget: Vector3 = new Vector3();
  private _patrolPauseHeading: WeakMap<NPC, Vector3> = new WeakMap();

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
