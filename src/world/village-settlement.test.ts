import { describe, it, expect } from "vitest";
import {
  hasVillage,
  planVillage,
  PLAZA_RADIUS,
  VILLAGE_CLEAR_RADIUS,
  VILLAGE_MIN_CHUNK_DISTANCE,
} from "./village-settlement";
import { buildingFootprint } from "./village-buildings";

const CHUNK = 50;

/** Find some village chunks to test against. */
function villageChunks(n: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let cx = -40; cx <= 40 && out.length < n; cx++) {
    for (let cz = -40; cz <= 40 && out.length < n; cz++) {
      if (hasVillage(cx, cz, "plains")) out.push([cx, cz]);
    }
  }
  return out;
}

describe("village settlements", () => {
  it("are rare, deterministic, and only in plains / forest away from the start", () => {
    const chunks = villageChunks(400);
    expect(chunks.length).toBeGreaterThan(50);
    const total = 81 * 81;
    expect(chunks.length / total).toBeLessThan(0.1);
    for (const [cx, cz] of chunks) {
      expect(Math.max(Math.abs(cx), Math.abs(cz))).toBeGreaterThanOrEqual(VILLAGE_MIN_CHUNK_DISTANCE);
      expect(hasVillage(cx, cz, "plains")).toBe(true);
      expect(hasVillage(cx, cz, "desert")).toBe(false);
      expect(hasVillage(cx, cz, "tundra")).toBe(false);
    }
    const [cx, cz] = chunks[0];
    expect(planVillage(cx, cz, CHUNK)).toEqual(planVillage(cx, cz, CHUNK));
  });

  it("have a name, an inn, a smithy with a forge, a shop and homes", () => {
    for (const [cx, cz] of villageChunks(20)) {
      const v = planVillage(cx, cz, CHUNK);
      expect(v.name.length).toBeGreaterThan(2);
      const roles = v.buildings.map((b) => b.role).sort();
      expect(roles).toEqual(["home", "home", "home", "inn", "shop", "smithy"]);
      expect(v.buildings.find((b) => b.role === "inn")!.kind).toBe("inn");
      const archetypes = v.residents.map((r) => r.archetype);
      for (const a of ["archetype_innkeeper", "archetype_barkeeper", "archetype_trainer_armorer",
        "archetype_shopkeeper_general", "archetype_merchant"]) {
        expect(archetypes).toContain(a);
      }
      expect(archetypes.filter((a) => a === "archetype_guard")).toHaveLength(2);
      expect(archetypes.filter((a) => a === "archetype_villager").length).toBeGreaterThanOrEqual(5);
      expect(v.props.some((p) => p.key === "qWell")).toBe(true);
    }
  });

  it("buildings face the square and don't overlap each other or the plaza", () => {
    for (const [cx, cz] of villageChunks(40)) {
      const v = planVillage(cx, cz, CHUNK);
      const disc = v.buildings.map((b) => {
        const { width, depth } = buildingFootprint(b.kind);
        return { b, r: Math.hypot(width, depth) / 2 };
      });
      for (const { b } of disc) {
        // Door (+Z local) points at the centre.
        const toCentre = Math.atan2(v.center.x - b.x, v.center.z - b.z);
        const d = Math.atan2(Math.sin(b.rot - toCentre), Math.cos(b.rot - toCentre));
        expect(Math.abs(d)).toBeLessThan(1e-6);
        // Front edge sits on the plaza edge, never inside the square.
        const { depth } = buildingFootprint(b.kind);
        expect(Math.hypot(b.x - v.center.x, b.z - v.center.z) - depth / 2).toBeCloseTo(PLAZA_RADIUS, 5);
      }
      for (let i = 0; i < disc.length; i++) {
        for (let j = i + 1; j < disc.length; j++) {
          // Inscribed-circle check (half the shorter side) — a conservative no-overlap test.
          const a = disc[i].b, c = disc[j].b;
          const ra = Math.min(...Object.values(buildingFootprint(a.kind))) / 2;
          const rc = Math.min(...Object.values(buildingFootprint(c.kind))) / 2;
          expect(Math.hypot(a.x - c.x, a.z - c.z)).toBeGreaterThan(ra + rc + 2);
        }
      }
    }
  });

  it("arrives travellers on the entrance road, clear of the well and buildings", () => {
    for (const [cx, cz] of villageChunks(40)) {
      const v = planVillage(cx, cz, CHUNK);
      const d = Math.hypot(v.arrival.x - v.center.x, v.arrival.z - v.center.z);
      expect(d).toBeGreaterThan(PLAZA_RADIUS);
      for (const b of v.buildings) {
        const { width, depth } = buildingFootprint(b.kind);
        expect(Math.hypot(v.arrival.x - b.x, v.arrival.z - b.z)).toBeGreaterThan(Math.min(width, depth) / 2 + 1);
      }
    }
  });

  it("gives residents daily routines: villagers work the square, guards walk a beat", () => {
    for (const [cx, cz] of villageChunks(20)) {
      const v = planVillage(cx, cz, CHUNK);
      const dist = (p: { x: number; z: number }) => Math.hypot(p.x - v.center.x, p.z - v.center.z);
      const villagers = v.residents.filter((r) => r.archetype === "archetype_villager");
      for (const r of villagers) {
        expect(r.work, "villagers have a work spot").toBeDefined();
        expect(r.home, "villagers have a home").toBeDefined();
        expect(dist(r.work!)).toBeLessThan(PLAZA_RADIUS);        // out on the square by day
        expect(dist(r.home!)).toBeGreaterThan(PLAZA_RADIUS - 2); // by a door at night (1.4 m in front of it)
      }
      const guards = v.residents.filter((r) => r.archetype === "archetype_guard");
      for (const g of guards) {
        expect(g.patrol!.length).toBeGreaterThanOrEqual(3);
        for (const p of g.patrol!) expect(dist(p)).toBeLessThan(VILLAGE_CLEAR_RADIUS);
      }
    }
  });

  it("puts a notice board inside the square, clear of the well and the buildings", () => {
    for (const [cx, cz] of villageChunks(40)) {
      const v = planVillage(cx, cz, CHUNK);
      const d = Math.hypot(v.noticeBoard.x - v.center.x, v.noticeBoard.z - v.center.z);
      expect(d).toBeGreaterThan(2.5);          // not on the well
      expect(d).toBeLessThan(PLAZA_RADIUS);    // inside the square
    }
  });

  it("village names rarely repeat", () => {
    const names = villageChunks(120).map(([cx, cz]) => planVillage(cx, cz, CHUNK).name);
    expect(new Set(names).size / names.length).toBeGreaterThan(0.85);
  });

  it("fits inside its clearing and its chunk", () => {
    for (const [cx, cz] of villageChunks(40)) {
      const v = planVillage(cx, cz, CHUNK);
      for (const b of v.buildings) {
        const { width, depth } = buildingFootprint(b.kind);
        const reach = Math.hypot(b.x - v.center.x, b.z - v.center.z) + Math.hypot(width, depth) / 2;
        expect(reach).toBeLessThanOrEqual(VILLAGE_CLEAR_RADIUS + 1);
        expect(Math.abs(b.x - cx * CHUNK)).toBeLessThan(CHUNK / 2);
        expect(Math.abs(b.z - cz * CHUNK)).toBeLessThan(CHUNK / 2);
      }
      for (const p of [...v.props, ...v.residents, v.forge]) {
        expect(Math.hypot(p.x - v.center.x, p.z - v.center.z)).toBeLessThan(VILLAGE_CLEAR_RADIUS);
      }
    }
  });
});
