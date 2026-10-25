import type { Vec } from "./types";

export function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

export function dist(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const abx = bx - ax;
  const abz = bz - az;
  const ab2 = abx * abx + abz * abz;
  const t = ab2 < 1e-8 ? 0 : clamp(((px - ax) * abx + (pz - az) * abz) / ab2, 0, 1);
  return Math.hypot(px - (ax + abx * t), pz - (az + abz * t));
}

export function distToPath(x: number, z: number, path: readonly Vec[]): number {
  let best = Infinity;
  for (let i = 1; i < path.length; i++) {
    const d = distToSegment(x, z, path[i - 1].x, path[i - 1].z, path[i].x, path[i].z);
    if (d < best) best = d;
  }
  return best;
}
