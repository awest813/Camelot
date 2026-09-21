import Delaunator from "delaunator";
import { createMulberry32 } from "./simplex-terrain";

export interface WorldSettlement {
  id: string;
  name: string;
  type: "capital" | "castle" | "town" | "shrine" | "outpost";
  cx: number; // chunk coordinate X
  cz: number; // chunk coordinate Z
  faction: string;
}

export interface WorldRoadEdge {
  fromId: string;
  toId: string;
  distance: number;
}

export interface WorldProvince {
  settlementId: string;
  name: string;
  center: [number, number]; // [cx, cz]
  polygon: [number, number][]; // [cx, cz] vertices
  color: string;
}

export const PROVINCE_HERALDIC_PALETTE: readonly string[] = [
  "#3b82f6", // Royal Azure
  "#ef4444", // Crimson Rose
  "#10b981", // Emerald Vale
  "#f59e0b", // Amber Sun
  "#8b5cf6", // Imperial Violet
  "#06b6d4", // Celtic Turquoise
  "#ec4899", // Morgana Magenta
  "#84cc16", // Brocéliande Lime
];

/**
 * VoronoiWorldGraph — Macro territory partitioning and trade route network
 * powered by Mapbox's MIT-licensed `delaunator` engine.
 */
export class VoronoiWorldGraph {
  public settlements: WorldSettlement[] = [];
  public roads: WorldRoadEdge[] = [];
  public provinces: WorldProvince[] = [];

  constructor(settlements: WorldSettlement[] = []) {
    this.settlements = [...settlements];
    if (this.settlements.length >= 3) {
      this.rebuildGraph();
    }
  }

  /**
   * Generates a balanced set of Arthurian settlements distributed across a
   * chunk radius based on a numeric or string seed.
   */
  public static generateSeededSettlements(
    seed: number,
    radius: number = 7,
    count: number = 7,
  ): WorldSettlement[] {
    const rng = createMulberry32(seed ^ 0xa5a5a5a5);
    const settlements: WorldSettlement[] = [];

    // Capital at origin
    settlements.push({
      id: "settlement_capital",
      name: "Camelot",
      type: "capital",
      cx: 0,
      cz: 0,
      faction: "crown",
    });

    const presetNames = [
      { name: "Caerleon", type: "town" as const, faction: "crown" },
      { name: "Tintagel Keep", type: "castle" as const, faction: "knights" },
      { name: "Avalon Vale", type: "shrine" as const, faction: "druids" },
      { name: "Brocéliande Outpost", type: "outpost" as const, faction: "rangers" },
      { name: "Dunster Watch", type: "castle" as const, faction: "crown" },
      { name: "Camlann Ford", type: "town" as const, faction: "knights" },
      { name: "Badon Hill", type: "outpost" as const, faction: "rebels" },
      { name: "Glastonbury Tor", type: "shrine" as const, faction: "druids" },
    ];

    const targetCount = Math.min(presetNames.length + 1, Math.max(3, count));

    for (let i = 1; i < targetCount; i++) {
      const preset = presetNames[i - 1];
      // Random chunk position within radius, keeping at least 2 chunks away from others
      let cx = 0;
      let cz = 0;
      let attempts = 0;
      let valid = false;

      while (attempts < 50 && !valid) {
        attempts++;
        const angle = rng() * Math.PI * 2;
        const dist = 2 + rng() * (radius - 2.5);
        cx = Math.round(Math.cos(angle) * dist);
        cz = Math.round(Math.sin(angle) * dist);

        valid = settlements.every((s) => {
          const dx = s.cx - cx;
          const dz = s.cz - cz;
          return Math.sqrt(dx * dx + dz * dz) >= 2.2;
        });
      }

      settlements.push({
        id: `settlement_${i}`,
        name: preset.name,
        type: preset.type,
        cx,
        cz,
        faction: preset.faction,
      });
    }

    return settlements;
  }

  /**
   * Rebuilds Delaunay triangulation edges (roads) and Voronoi territory polygons (provinces).
   */
  public rebuildGraph(): void {
    if (this.settlements.length < 3) {
      this.roads = [];
      this.provinces = [];
      return;
    }

    const coords: Array<[number, number]> = this.settlements.map((s) => [s.cx, s.cz]);
    const d = Delaunator.from(coords);

    // 1. Build unique road edges from Delaunay triangles
    const roadMap = new Map<string, WorldRoadEdge>();
    for (let e = 0; e < d.triangles.length; e += 3) {
      const p0 = d.triangles[e];
      const p1 = d.triangles[e + 1];
      const p2 = d.triangles[e + 2];

      this._addRoadEdge(roadMap, p0, p1);
      this._addRoadEdge(roadMap, p1, p2);
      this._addRoadEdge(roadMap, p2, p0);
    }
    this.roads = Array.from(roadMap.values());

    // 2. Build Voronoi polygons for each settlement
    this.provinces = this._buildVoronoiProvinces(coords, d);
  }

  private _addRoadEdge(map: Map<string, WorldRoadEdge>, idxA: number, idxB: number): void {
    const sA = this.settlements[idxA];
    const sB = this.settlements[idxB];
    if (!sA || !sB) return;

    const minId = sA.id < sB.id ? sA.id : sB.id;
    const maxId = sA.id < sB.id ? sB.id : sA.id;
    const key = `${minId}__${maxId}`;

    if (!map.has(key)) {
      const dx = sA.cx - sB.cx;
      const dz = sA.cz - sB.cz;
      const distance = Math.sqrt(dx * dx + dz * dz);
      map.set(key, { fromId: sA.id, toId: sB.id, distance });
    }
  }

  private _buildVoronoiProvinces(
    coords: Array<[number, number]>,
    d: Delaunator<Float64Array>,
  ): WorldProvince[] {
    const numTriangles = d.triangles.length / 3;
    const circumcenters: Array<[number, number]> = [];

    for (let t = 0; t < numTriangles; t++) {
      const a = coords[d.triangles[t * 3]];
      const b = coords[d.triangles[t * 3 + 1]];
      const c = coords[d.triangles[t * 3 + 2]];
      circumcenters.push(this._calculateCircumcenter(a, b, c));
    }

    const provinces: WorldProvince[] = [];

    for (let i = 0; i < this.settlements.length; i++) {
      const s = this.settlements[i];
      const poly: Array<[number, number]> = [];

      // Find all triangles sharing vertex i
      for (let t = 0; t < numTriangles; t++) {
        if (
          d.triangles[t * 3] === i ||
          d.triangles[t * 3 + 1] === i ||
          d.triangles[t * 3 + 2] === i
        ) {
          poly.push(circumcenters[t]);
        }
      }

      // Sort polygon vertices angularly around the settlement center
      if (poly.length >= 3) {
        poly.sort((vA, vB) => {
          const angA = Math.atan2(vA[1] - s.cz, vA[0] - s.cx);
          const angB = Math.atan2(vB[1] - s.cz, vB[0] - s.cx);
          return angA - angB;
        });
      }

      const color = PROVINCE_HERALDIC_PALETTE[i % PROVINCE_HERALDIC_PALETTE.length];
      provinces.push({
        settlementId: s.id,
        name: `Province of ${s.name}`,
        center: [s.cx, s.cz],
        polygon: poly,
        color,
      });
    }

    return provinces;
  }

  private _calculateCircumcenter(
    a: [number, number],
    b: [number, number],
    c: [number, number],
  ): [number, number] {
    const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
    if (Math.abs(d) < 1e-6) {
      return [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3];
    }

    const a2 = a[0] * a[0] + a[1] * a[1];
    const b2 = b[0] * b[0] + b[1] * b[1];
    const c2 = c[0] * c[0] + c[1] * c[1];

    const ux = (a2 * (b[1] - c[1]) + b2 * (c[1] - a[1]) + c2 * (a[1] - b[1])) / d;
    const uz = (a2 * (c[0] - b[0]) + b2 * (a[0] - c[0]) + c2 * (b[0] - a[0])) / d;

    return [ux, uz];
  }

  /**
   * Finds the shortest road path connecting two settlements across the Delaunay network.
   */
  public findShortestRoute(startId: string, endId: string): string[] {
    if (startId === endId) return [startId];

    // Build adjacency graph
    const adj = new Map<string, Array<{ to: string; dist: number }>>();
    for (const r of this.roads) {
      if (!adj.has(r.fromId)) adj.set(r.fromId, []);
      if (!adj.has(r.toId)) adj.set(r.toId, []);
      adj.get(r.fromId)!.push({ to: r.toId, dist: r.distance });
      adj.get(r.toId)!.push({ to: r.fromId, dist: r.distance });
    }

    const distances = new Map<string, number>();
    const previous = new Map<string, string>();
    const unvisited = new Set<string>();

    for (const s of this.settlements) {
      distances.set(s.id, Infinity);
      unvisited.add(s.id);
    }
    distances.set(startId, 0);

    while (unvisited.size > 0) {
      // Pick unvisited node with smallest distance
      let current: string | null = null;
      let smallestDist = Infinity;
      for (const id of unvisited) {
        const d = distances.get(id) ?? Infinity;
        if (d < smallestDist) {
          smallestDist = d;
          current = id;
        }
      }

      if (current === null || smallestDist === Infinity) break;
      if (current === endId) break;

      unvisited.delete(current);

      const neighbors = adj.get(current) ?? [];
      for (const edge of neighbors) {
        if (!unvisited.has(edge.to)) continue;
        const alt = smallestDist + edge.dist;
        if (alt < (distances.get(edge.to) ?? Infinity)) {
          distances.set(edge.to, alt);
          previous.set(edge.to, current);
        }
      }
    }

    // Reconstruct path
    const path: string[] = [];
    let curr: string | undefined = endId;
    while (curr) {
      path.unshift(curr);
      curr = previous.get(curr);
      if (curr === startId) {
        path.unshift(startId);
        break;
      }
    }

    return path.length > 1 && path[0] === startId ? path : [];
  }
}
