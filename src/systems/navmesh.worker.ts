/**
 * The navmesh build, off the main thread.  Receives the loaded area's
 * geometry, runs the Recast build (the expensive part: voxelising a few
 * hundred metres of ground and walls) and sends back the serialized navmesh,
 * which the main thread loads in a moment.  Recast (recast-detour, ~600 KB
 * of asm.js) is loaded once, on the first build.
 *
 * Engine overhaul, Phase 6.
 */
// Static: the worker itself is only started when the first navmesh is built.
import Recast from "recast-detour";
import { buildNavmeshData, loadRecast, type NavGeometry, type RecastModule } from "./navmesh-build";

export interface NavBuildRequest { id: number; geometry: NavGeometry }
export type NavBuildReply = { id: number; data: Uint8Array } | { id: number; error: string };

let recast: Promise<RecastModule> | null = null;

self.onmessage = async (e: MessageEvent<NavBuildRequest>) => {
  const { id, geometry } = e.data;
  try {
    recast ??= loadRecast(Recast) as Promise<RecastModule>;
    const data = buildNavmeshData(await recast, geometry);
    (self as unknown as Worker).postMessage({ id, data } satisfies NavBuildReply, [data.buffer]);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: String(err) } satisfies NavBuildReply);
  }
};
