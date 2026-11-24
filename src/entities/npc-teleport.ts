/**
 * Move an NPC instantly (respawn spot, a fall recovery, its routine after
 * time passed).  The capsule's body follows: its velocity stops and one
 * physics step reads the new transform.
 */
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { NPC } from "./npc";

export function teleportNpc(npc: NPC, x: number, y: number, z: number): void {
  npc.mesh.position.set(x, y, z);
  const body = npc.physicsAggregate?.body;
  if (!body) return;
  body.setLinearVelocity(Vector3.Zero());
  const scene = npc.mesh.getScene?.();
  if (!scene) return;
  // Let the physics step read the teleported transform once.
  body.disablePreStep = false;
  scene.onAfterPhysicsObservable.addOnce(() => { body.disablePreStep = true; });
}
