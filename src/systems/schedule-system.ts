import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { NPC } from "../entities/npc";

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
    // When dead or aggressive the combat system owns movement
    if (npc.isDead || npc.isAggressive) return;

    if (npc.waitTime > 0) {
      npc.waitTime -= deltaTime;
      return;
    }

    // NPCs without patrol points wander randomly
    if (npc.patrolPoints.length === 0) {
      this._wander(npc);
      return;
    }

    const target = npc.patrolPoints[npc.currentPatrolIndex];
    const currentPos = npc.mesh.position;
    target.subtractToRef(currentPos, this._direction);

    // Ignore Y component for distance check on ground
    const distXZ = Math.sqrt(this._direction.x * this._direction.x + this._direction.z * this._direction.z);

    if (distXZ < 1.0) {
      // Reached target — advance to next patrol point and pause briefly
      npc.currentPatrolIndex = (npc.currentPatrolIndex + 1) % npc.patrolPoints.length;
      npc.waitTime = 2.0;
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

  /**
   * Move an NPC in a random direction for a short distance, then pause.
   * Uses the NPC's `targetPosition` field as the current wander destination.
   */
  private _wander(npc: NPC): void {
    if (!npc.targetPosition) {
      // Pick a random point 4–8 m from current position using a deterministic seed
      const angle = this._seededRand(npc.mesh.position.x + npc.mesh.position.z) * Math.PI * 2;
      const dist  = 4 + this._seededRand(npc.mesh.position.x - npc.mesh.position.z) * 4;
      npc.targetPosition = new Vector3(
        npc.mesh.position.x + Math.cos(angle) * dist,
        npc.mesh.position.y,
        npc.mesh.position.z + Math.sin(angle) * dist,
      );
    }

    const currentPos = npc.mesh.position;
    npc.targetPosition.subtractToRef(currentPos, this._direction);
    const distXZ = Math.sqrt(this._direction.x * this._direction.x + this._direction.z * this._direction.z);

    if (distXZ < 1.0) {
      // Reached wander target — pause and clear so a new one is chosen next time
      npc.targetPosition = null;
      npc.waitTime = 1.5 + this._seededRand(currentPos.x) * 2; // 1.5–3.5 s
    } else {
      this._direction.y = 0;
      this._direction.normalize();
      this._direction.scaleToRef(npc.moveSpeed * 0.6, this._velocity); // wander slower

      if (npc.physicsAggregate && npc.physicsAggregate.body) {
        npc.physicsAggregate.body.getLinearVelocityToRef(this._currentVel);
        this._newVel.set(this._velocity.x, this._currentVel.y, this._velocity.z);
        npc.physicsAggregate.body.setLinearVelocity(this._newVel);

        this._lookAtTarget.set(npc.targetPosition.x, currentPos.y, npc.targetPosition.z);
        npc.mesh.lookAt(this._lookAtTarget);
      }
    }
  }

  /** Deterministic pseudo-random in [0, 1) based on a seed value. */
  private _seededRand(seed: number): number {
    return Math.abs(Math.sin(seed * 127.1 + 311.7)) % 1;
  }
}
