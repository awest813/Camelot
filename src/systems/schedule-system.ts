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
      return;
    }

    const target = npc.patrolPoints[npc.currentPatrolIndex];
    const currentPos = npc.mesh.position;
    target.subtractToRef(currentPos, this._direction);

    // Ignore Y component for distance check on ground
    const distXZ = Math.sqrt(this._direction.x * this._direction.x + this._direction.z * this._direction.z);

    if (distXZ < 1.0) {
      // Reached target
      npc.currentPatrolIndex = (npc.currentPatrolIndex + 1) % npc.patrolPoints.length;
      npc.waitTime = 2.0; // Wait 2 seconds
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
    }
  }
}
