// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { NavigationSystem } from "./navigation-system";
import { markNavObstacle } from "./navmesh-build";
import { ScheduleSystem } from "./schedule-system";
import { buildingFootprint, buildingWallColliders, toWorld, WALL_HEIGHT } from "../world/village-buildings";
import type { NPC } from "../entities/npc";

/** A 60 m ground chunk with a house at the origin, its door facing +z. */
function world() {
  const scene = new Scene(new NullEngine());
  MeshBuilder.CreateGround("chunk_0,0", { width: 60, height: 60, subdivisions: 4 }, scene);
  const origin = { x: 0, z: 0, rot: 0 };
  buildingWallColliders("house").forEach((w, i) => {
    const p = toWorld(w, origin);
    const box = MeshBuilder.CreateBox(`bldg_wall_${i}`, { width: w.width, depth: w.depth, height: WALL_HEIGHT }, scene);
    box.position.set(p.x, WALL_HEIGHT / 2, p.z);
    box.isVisible = false;
    markNavObstacle(box);
  });
  const { width, depth } = buildingFootprint("house");
  return { scene, hw: width / 2, hd: depth / 2 };
}

/** Whether (x, z) is inside the house's outline (less a margin). */
function insideHouse(x: number, z: number, hw: number, hd: number, margin = 0.2): boolean {
  return Math.abs(x) < hw - margin && Math.abs(z) < hd - margin;
}

describe("navmesh (real Recast, in Node)", () => {
  const w = world();
  const nav = new NavigationSystem(w.scene, { enabled: true });
  beforeAll(async () => {
    await nav.load();
    expect(nav.buildNow(), "built from the ground and the walls").toBe(true);
  }, 60_000);

  it("is built from the ground chunk and the marked walls", () => {
    const names = nav.collectInputMeshes().map((m) => m.name);
    expect(names).toContain("chunk_0,0");
    expect(names.filter((n) => n.startsWith("bldg_wall_")).length).toBe(buildingWallColliders("house").length);
    expect(nav.isReady).toBe(true);
    expect(nav.builds).toBe(1);
  });

  it("paths go around a building, not through it", () => {
    const from = new Vector3(0, 0, -w.hd - 4), to = new Vector3(0, 0, w.hd + 4);
    const path = nav.findPath(from, to);
    expect(path.length, "a path with turns").toBeGreaterThan(2);
    // Walk the path in small steps: never inside the house.
    for (let i = 1; i < path.length; i++) {
      for (let t = 0; t <= 1; t += 0.05) {
        const x = path[i - 1].x + (path[i].x - path[i - 1].x) * t;
        const z = path[i - 1].z + (path[i].z - path[i - 1].z) * t;
        expect(insideHouse(x, z, w.hw, w.hd), `(${x.toFixed(1)}, ${z.toFixed(1)})`).toBe(false);
      }
    }
    const length = path.slice(1).reduce((n, p, i) => n + Vector3.Distance(p, path[i]), 0);
    expect(length).toBeGreaterThan(Vector3.Distance(from, to) + 1);
  });

  it("the way in is the doorway", () => {
    const path = nav.findPath(new Vector3(0, 0, -w.hd - 4), new Vector3(0, 0, 0));
    expect(path.length).toBeGreaterThan(2);
    const end = path[path.length - 1];
    expect(Math.hypot(end.x, end.z), "reaches the middle of the room").toBeLessThan(1);
    // It crosses the front wall line (z = +hd) near the door, never the back or the sides.
    const crossing = path.findIndex((p, i) => i > 0 && path[i - 1].z > w.hd - 0.1 && p.z <= w.hd);
    expect(crossing, "enters from the front").toBeGreaterThan(0);
    const a = path[crossing - 1], b = path[crossing];
    const x = a.x + (b.x - a.x) * ((w.hd - a.z) / (b.z - a.z || 1));
    expect(Math.abs(x), "through the door, not a wall").toBeLessThan(1.5);
  });

  /** Walk a villager from behind the house to work in front of it; true if it ever went through the house. */
  function walkToWork(withNav: boolean): { arrived: boolean; crossed: boolean } {
    const schedules = new ScheduleSystem();
    schedules.nav = withNav ? nav : null;
    schedules.currentHour = 12;
    const velocity = new Vector3();
    const npc = {
      isDead: false, isAggressive: false, isInDialogue: false, aiState: "IDLE",
      scheduleBlocks: [{ startHour: 0, endHour: 24, behavior: "work" }],
      workPosition: new Vector3(0, 0, w.hd + 4), spawnPosition: new Vector3(0, 0, -w.hd - 4), homePosition: null,
      patrolPoints: [], waitTime: 0, currentPatrolIndex: 0,
      mesh: { position: new Vector3(0, 0, -w.hd - 4), isEnabled: () => true, lookAt: () => {} },
      physicsAggregate: { body: {
        getLinearVelocityToRef: (out: Vector3) => out.copyFrom(velocity),
        setLinearVelocity: (v: Vector3) => { velocity.copyFrom(v); },
      } },
    } as unknown as NPC;
    schedules.addNPC(npc);
    const p = npc.mesh.position;
    let arrived = false, crossed = false;
    // No physics here: nothing stops a body at a wall, so a straight walk goes through.
    for (let step = 0; step < 900 && !arrived; step++) {
      schedules.update(0.1);
      p.x += velocity.x * 0.1;
      p.z += velocity.z * 0.1;
      crossed ||= insideHouse(p.x, p.z, w.hw, w.hd);
      arrived = Math.hypot(p.x - 0, p.z - (w.hd + 4)) < 1;
    }
    return { arrived, crossed };
  }

  it("a villager walking to work takes the route round the house", () => {
    expect(walkToWork(true)).toEqual({ arrived: true, crossed: false });
    // Control: without the navmesh the same walk goes straight through the walls.
    expect(walkToWork(false).crossed).toBe(true);
  });
});
