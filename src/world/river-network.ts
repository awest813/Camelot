import { createMulberry32 } from "./simplex-terrain";
import { WorldSeed } from "./world-seed";
import { ArthurianNameGenerator } from "./arthurian-names";

/** A single waypoint along a river's downhill path. */
export interface RiverWaypoint {
  cx: number;
  cz: number;
  flow: number;
  elevation: number;
}

/** Complete river polyline formed by downhill water flow. */
export interface River {
  id: string;
  name: string;
  waypoints: RiverWaypoint[];
  totalLength: number;
  maxFlow: number;
}

/** An inland depression or lake basin where water accumulates. */
export interface LakeBasin {
  id: string;
  name: string;
  cx: number;
  cz: number;
  elevation: number;
  waterFlow: number;
  surfaceArea: number;
}

export interface RiverNetworkConfig {
  /** PRNG seed string or integer. */
  seed: string | number;
  /** Minimum accumulated flow required to form a named river. Default: 3. */
  minFlowThreshold?: number;
  /** Minimum elevation for river origins/springs. Default: 0.15. */
  sourceElevationMin?: number;
  /** Water level threshold below which is sea/ocean. Default: -0.15. */
  seaLevel?: number;
}

/**
 * RiverNetworkGenerator — Hydraulic flow accumulation and river routing engine.
 *
 * Implements standard D8 steepest-descent flow direction routing (Amit Patel / Red Blob Games model):
 *   1. Samples elevation across a grid.
 *   2. For each cell, finds steepest downhill descent among 8 neighbors.
 *   3. Accumulates drainage flow from highest to lowest elevation.
 *   4. Extracts continuous river polylines and inland lake basins.
 *   5. Names rivers and lakes using Arthurian/Celtic linguistic patterns.
 */
export class RiverNetworkGenerator {
  public readonly seed: number;
  public readonly minFlowThreshold: number;
  public readonly sourceElevationMin: number;
  public readonly seaLevel: number;

  public rivers: River[] = [];
  public lakes: LakeBasin[] = [];
  /** Map of "cx,cz" -> accumulated flow volume. */
  public flowMap: Map<string, number> = new Map();

  private readonly _rng: () => number;

  constructor(config: RiverNetworkConfig) {
    this.seed = typeof config.seed === "number" ? config.seed : WorldSeed.hashString(config.seed);
    this.minFlowThreshold = config.minFlowThreshold ?? 3;
    this.sourceElevationMin = config.sourceElevationMin ?? 0.15;
    this.seaLevel = config.seaLevel ?? -0.15;
    this._rng = createMulberry32(this.seed);
  }

  /**
   * Generates rivers and lakes across a chunk coordinate bounding box.
   *
   * @param minCX Minimum chunk X
   * @param maxCX Maximum chunk X
   * @param minCZ Minimum chunk Z
   * @param maxCZ Maximum chunk Z
   * @param getElevation Elevation sampler returning values roughly in [-1, 1]
   */
  public generate(
    minCX: number,
    maxCX: number,
    minCZ: number,
    maxCZ: number,
    getElevation: (cx: number, cz: number) => number,
  ): { rivers: River[]; lakes: LakeBasin[] } {
    this.rivers = [];
    this.lakes = [];
    this.flowMap.clear();

    const width = maxCX - minCX + 1;
    const height = maxCZ - minCZ + 1;
    if (width <= 1 || height <= 1) {
      return { rivers: this.rivers, lakes: this.lakes };
    }

    // 1. Grid sample buffers
    const elevations = new Float32Array(width * height);
    const downstreamIdx = new Int32Array(width * height).fill(-1);
    const flow = new Float32Array(width * height).fill(1.0);

    const getIndex = (cx: number, cz: number) => (cz - minCZ) * width + (cx - minCX);
    const getCoord = (idx: number): [number, number] => {
      const cz = Math.floor(idx / width) + minCZ;
      const cx = (idx % width) + minCX;
      return [cx, cz];
    };

    // Populate elevations
    for (let cz = minCZ; cz <= maxCZ; cz++) {
      for (let cx = minCX; cx <= maxCX; cx++) {
        const idx = getIndex(cx, cz);
        elevations[idx] = getElevation(cx, cz);
      }
    }

    // 2. D8 Flow direction: find steepest downhill neighbor
    // 8-direction offsets: dx, dz, distance
    const D8: Array<[number, number, number]> = [
      [0, -1, 1],
      [0, 1, 1],
      [-1, 0, 1],
      [1, 0, 1],
      [-1, -1, Math.SQRT2],
      [1, -1, Math.SQRT2],
      [-1, 1, Math.SQRT2],
      [1, 1, Math.SQRT2],
    ];

    for (let cz = minCZ; cz <= maxCZ; cz++) {
      for (let cx = minCX; cx <= maxCX; cx++) {
        const idx = getIndex(cx, cz);
        const elev = elevations[idx];

        // Sea cells do not flow
        if (elev <= this.seaLevel) continue;

        let bestSlope = 0;
        let bestTarget = -1;

        for (const [dx, dz, dist] of D8) {
          const nx = cx + dx;
          const nz = cz + dz;
          if (nx < minCX || nx > maxCX || nz < minCZ || nz > maxCZ) continue;

          const nIdx = getIndex(nx, nz);
          const nElev = elevations[nIdx];
          const slope = (elev - nElev) / dist;

          if (slope > bestSlope) {
            bestSlope = slope;
            bestTarget = nIdx;
          }
        }

        if (bestTarget !== -1) {
          downstreamIdx[idx] = bestTarget;
        }
      }
    }

    // 3. Flow accumulation: process in descending elevation order
    const cellIndices = Array.from({ length: width * height }, (_, i) => i);
    cellIndices.sort((a, b) => elevations[b] - elevations[a]);

    for (const idx of cellIndices) {
      if (elevations[idx] <= this.seaLevel) continue;

      const target = downstreamIdx[idx];
      if (target !== -1) {
        flow[target] += flow[idx];
      }
    }

    // Store in flowMap
    for (let i = 0; i < flow.length; i++) {
      if (flow[i] >= 2) {
        const [cx, cz] = getCoord(i);
        this.flowMap.set(`${cx},${cz}`, flow[i]);
      }
    }

    // 4. Lake Basins: non-sea cells with no downstream neighbor and flow >= 2
    for (let i = 0; i < flow.length; i++) {
      if (elevations[i] > this.seaLevel && downstreamIdx[i] === -1 && flow[i] >= 2) {
        const [cx, cz] = getCoord(i);
        const lakeName = ArthurianNameGenerator.generateLakeName(this.seed + i);
        this.lakes.push({
          id: `lake_${cx}_${cz}`,
          name: lakeName,
          cx,
          cz,
          elevation: elevations[i],
          waterFlow: flow[i],
          surfaceArea: Math.min(6, Math.max(1, Math.round(flow[i] / 4))),
        });
      }
    }

    // 5. River Extraction: trace channels from high-elevation origins
    const visitedInRiver = new Set<number>();
    let riverCount = 0;

    for (const idx of cellIndices) {
      if (elevations[idx] <= this.seaLevel) continue;
      if (elevations[idx] < this.sourceElevationMin) continue;
      if (flow[idx] < this.minFlowThreshold) continue;
      if (visitedInRiver.has(idx)) continue;

      // Check if this cell is an origin (no upstream neighbor with significant flow)
      // If it flows downstream, trace it
      const waypoints: RiverWaypoint[] = [];
      let current: number | -1 = idx;

      while (current !== -1 && !visitedInRiver.has(current)) {
        visitedInRiver.add(current);
        const [cx, cz] = getCoord(current);
        waypoints.push({
          cx,
          cz,
          flow: flow[current],
          elevation: elevations[current],
        });

        // Terminate at sea
        if (elevations[current] <= this.seaLevel) break;

        current = downstreamIdx[current];
      }

      if (waypoints.length >= 3) {
        riverCount++;
        const riverName = ArthurianNameGenerator.generateRiverName(this.seed + riverCount * 37);
        let len = 0;
        let maxF = 0;

        for (let w = 0; w < waypoints.length; w++) {
          if (waypoints[w].flow > maxF) maxF = waypoints[w].flow;
          if (w > 0) {
            const dx = waypoints[w].cx - waypoints[w - 1].cx;
            const dz = waypoints[w].cz - waypoints[w - 1].cz;
            len += Math.hypot(dx, dz);
          }
        }

        this.rivers.push({
          id: `river_${riverCount}`,
          name: riverName,
          waypoints,
          totalLength: Math.round(len * 10) / 10,
          maxFlow: maxF,
        });
      }
    }

    return { rivers: this.rivers, lakes: this.lakes };
  }

  /**
   * Checks whether a given chunk cell is part of a river or lake.
   */
  public getWaterInfoAt(cx: number, cz: number): { isWater: boolean; flow: number; name?: string } {
    const flow = this.flowMap.get(`${cx},${cz}`) ?? 0;

    // Check if on a river
    for (const r of this.rivers) {
      const match = r.waypoints.find((w) => w.cx === cx && w.cz === cz);
      if (match) {
        return { isWater: true, flow: match.flow, name: r.name };
      }
    }

    // Check if on a lake
    const lake = this.lakes.find((l) => l.cx === cx && l.cz === cz);
    if (lake) {
      return { isWater: true, flow: lake.waterFlow, name: lake.name };
    }

    return { isWater: flow >= this.minFlowThreshold, flow };
  }
}
