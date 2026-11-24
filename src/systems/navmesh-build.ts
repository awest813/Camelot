/**
 * Building a navmesh: the parameters, the input geometry (plain arrays, so
 * it can cross into a worker) and the Recast build itself.  The game runs
 * the build in `navmesh.worker.ts`; tests run it directly in Node.
 *
 * Input geometry is the loaded ground plus every mesh marked as a
 * navigation obstacle (`metadata.navObstacle`): building walls and the
 * village well.  Walls rise above an agent's head, so Recast leaves the
 * ground under them out of the mesh; doorways are gaps between wall boxes,
 * so they stay walkable.
 *
 * Engine overhaul, Phase 6.
 */
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

/**
 * Recast parameters for a humanoid-scale world.  `tileSize` (in cells)
 * makes Recast build the mesh tile by tile, which is several times faster
 * over a whole loaded area than one big tile.
 */
export const NAV_PARAMS = {
  cs: 0.3,
  ch: 0.2,
  borderSize: 0,
  tileSize: 64,
  walkableSlopeAngle: 35,
  walkableHeight: 2,       // voxels of clear headroom required
  walkableClimb: 0.5,      // max step height an agent can climb
  walkableRadius: 0.5,     // NPC capsule radius in world units
  maxEdgeLen: 12,
  maxSimplificationError: 1.3,
  minRegionArea: 8,
  mergeRegionArea: 20,
  maxVertsPerPoly: 6,
  detailSampleDist: 6,
  detailSampleMaxError: 1,
};
export type NavParams = typeof NAV_PARAMS;

/** World-space triangles. */
export interface NavGeometry {
  positions: Float32Array;
  indices: Int32Array;
}

/** Whether a mesh is part of the navmesh input as an obstacle. */
export function isNavObstacle(mesh: AbstractMesh): boolean {
  return !!(mesh.metadata as { navObstacle?: boolean } | null)?.navObstacle;
}

/** Mark a mesh (a wall collider, a well) as an obstacle the navmesh goes around. */
export function markNavObstacle(mesh: AbstractMesh): void {
  mesh.metadata = { ...(mesh.metadata ?? {}), navObstacle: true };
}

/** The meshes' triangles in world space, merged. */
export function geometryFromMeshes(meshes: readonly AbstractMesh[]): NavGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const p = new Vector3();
  for (const mesh of meshes) {
    const local = mesh.getVerticesData(VertexBuffer.PositionKind);
    const tris = mesh.getIndices();
    if (!local || !tris) continue;
    mesh.computeWorldMatrix(true);
    const world = mesh.getWorldMatrix();
    const base = positions.length / 3;
    for (let i = 0; i < local.length; i += 3) {
      Vector3.TransformCoordinatesFromFloatsToRef(local[i], local[i + 1], local[i + 2], world, p);
      positions.push(p.x, p.y, p.z);
    }
    for (let i = 0; i < tris.length; i++) indices.push(tris[i] + base);
  }
  return { positions: new Float32Array(positions), indices: new Int32Array(indices) };
}

/** The bits of the recast-detour module the build uses. */
export interface RecastModule {
  rcConfig: new () => Record<string, number>;
  NavMesh: new () => {
    build(positions: number[], count: number, indices: number[], indexCount: number, config: Record<string, number>): void;
    getNavmeshData(): { dataPointer: number; size: number };
    freeNavmeshData(data: { dataPointer: number; size: number }): void;
    destroy?(): void;
  };
  HEAPU8: Uint8Array;
}

/**
 * Start recast-detour.  Its factory assigns to `this` while it sets up, and
 * an ES module call leaves `this` undefined (the error reads "Cannot set
 * properties of undefined (setting 'Recast')"), so it gets an object to
 * write to.
 */
export function loadRecast(factory: (...args: never[]) => unknown): Promise<unknown> {
  return Promise.resolve((factory as unknown as (this: object) => unknown).call({}));
}

/** Build a navmesh from `geometry` and return it serialized (Detour's own format). */
export function buildNavmeshData(recast: RecastModule, geometry: NavGeometry, params: NavParams = NAV_PARAMS): Uint8Array {
  const config = new recast.rcConfig();
  Object.assign(config, params);
  const navMesh = new recast.NavMesh();
  navMesh.build(Array.from(geometry.positions), geometry.positions.length / 3, Array.from(geometry.indices), geometry.indices.length, config);
  const raw = navMesh.getNavmeshData();
  const data = new Uint8Array(raw.size);
  data.set(new Uint8Array(recast.HEAPU8.buffer, raw.dataPointer, raw.size));
  navMesh.freeNavmeshData(raw);
  navMesh.destroy?.();
  return data;
}
