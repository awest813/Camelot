import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Ray } from "@babylonjs/core/Culling/ray";

/** How far ahead to probe for obstacles (world units). */
export const STEER_CHECK_DIST = 2.5;

/**
 * Candidate steering angles in degrees, ordered by preference.
 * 0° = straight ahead; the algorithm returns the first clear direction found.
 */
const _STEER_ANGLES = [0, 40, -40, 80, -80, 120, -120];

/** Module-level scratch vector — safe because NPCs are updated sequentially. */
const _rayDir = new Vector3();

/**
 * Obstacle-avoidance steering for NPC movement.
 *
 * Given a desired XZ direction, casts a short ray ahead. If blocked, tries
 * progressively wider angles until a clear path is found. The result is
 * written into `out` (normalized, y=0). Falls back to the original direction
 * if every candidate is blocked (physics will handle the collision).
 *
 * Mesh filter: ignores the NPC's own capsule, terrain chunks, other NPCs,
 * and loot items — only structure geometry acts as an obstacle.
 *
 * @param scene      Babylon.js scene (used for raycasting)
 * @param origin     NPC mesh position (ray start)
 * @param desiredXZ  Desired move direction — must be normalised, y=0
 * @param selfName   NPC mesh name (excluded from ray hits)
 * @param out        Output vector written with the chosen direction
 */
export function steerAroundObstacles(
  scene: Scene,
  origin: Vector3,
  desiredXZ: Vector3,
  selfName: string,
  out: Vector3,
): void {
  for (const deg of _STEER_ANGLES) {
    _rotateXZ(desiredXZ, deg, _rayDir);
    const ray = new Ray(origin, _rayDir, STEER_CHECK_DIST);
    const hit = scene.pickWithRay(ray, (m) =>
      m.isVisible &&
      m.name !== selfName &&
      m.name !== "playerBody" &&
      !m.name.startsWith("chunk_") &&
      m.metadata?.type !== "npc" &&
      m.metadata?.type !== "loot",
    );
    if (!hit?.pickedMesh) {
      out.copyFrom(_rayDir);
      return;
    }
  }
  // Every candidate is blocked — proceed straight and let physics resolve it.
  out.copyFrom(desiredXZ);
}

/** Rotate a XZ-plane vector by `angleDeg` around the Y-axis, writing into `out`. */
function _rotateXZ(v: Vector3, angleDeg: number, out: Vector3): void {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  out.set(v.x * cos - v.z * sin, 0, v.x * sin + v.z * cos);
}
