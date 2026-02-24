import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { NPC } from "../entities/npc";

export class ScheduleSystem {
  public scene: Scene;
  public npcs: NPC[] = [];

  constructor(scene: Scene) {
    this.scene = scene;
  }

  public addNPC(npc: NPC): void {
    this.npcs.push(npc);
  }

  public update(deltaTime: number): void {
    // Convert deltaTime to seconds if needed (Babylon often provides ms)
    // Assuming deltaTime is in seconds
    for (const npc of this.npcs) {
      this._updateNPC(npc, deltaTime);
    }
  }

  private _updateNPC(npc: NPC, deltaTime: number): void {
    if (npc.patrolPoints.length === 0) return;

    if (npc.waitTime > 0) {
      npc.waitTime -= deltaTime;
      return;
    }

    const target = npc.patrolPoints[npc.currentPatrolIndex];
    const currentPos = npc.mesh.position;
    const direction = target.subtract(currentPos);

    // Ignore Y component for distance check on ground
    const distXZ = Math.sqrt(direction.x * direction.x + direction.z * direction.z);

    if (distXZ < 1.0) {
      // Reached target
      npc.currentPatrolIndex = (npc.currentPatrolIndex + 1) % npc.patrolPoints.length;
      npc.waitTime = 2.0; // Wait 2 seconds
    } else {
      // Move towards target
      direction.y = 0;
      direction.normalize();
      const velocity = direction.scale(npc.moveSpeed);

      if (npc.physicsAggregate && npc.physicsAggregate.body) {
         const currentVel = new Vector3();
         npc.physicsAggregate.body.getLinearVelocityToRef(currentVel);

         // Set X and Z velocity, keep Y (gravity)
         npc.physicsAggregate.body.setLinearVelocity(new Vector3(velocity.x, currentVel.y, velocity.z));

         // Rotate to face movement (ignore Y difference)
         npc.mesh.lookAt(new Vector3(target.x, npc.mesh.position.y, target.z));
      }
    }
  }
}
