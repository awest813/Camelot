import { describe, expect, it } from "vitest";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { NpcSteering } from "./npc-steering";
import type { NPC } from "../../entities/npc";
import type { NavigationSystem } from "../navigation-system";

function npcAt(x: number, z: number) {
  const vel = new Vector3();
  return {
    mesh: { position: new Vector3(x, 1, z), lookAt: () => {} },
    physicsAggregate: { body: { getLinearVelocityToRef: (out: Vector3) => out.copyFrom(vel), setLinearVelocity: (v: Vector3) => vel.copyFrom(v) } },
    currentPath: [] as Vector3[], pathIndex: 0, pathRefreshTimer: 0, pathRefreshInterval: 0.5,
    moveSpeed: 4, movementResponsiveness: 8, spawnPosition: new Vector3(0, 1, 0), vel,
  };
}

describe("NpcSteering", () => {
  it("chases along the navmesh path when there is one", () => {
    const waypoint = new Vector3(2, 1, 0);
    const nav = { isReady: true, findPath: () => [waypoint] } as unknown as NavigationSystem;
    const npc = npcAt(0, 0);
    new NpcSteering(() => nav, () => 0.5).chase(npc as unknown as NPC, new Vector3(10, 1, 0), 1 / 60);
    expect(npc.currentPath).toEqual([waypoint]);
  });

  it("heads straight for the target when the navmesh has no path (instead of freezing)", () => {
    const nav = { isReady: true, findPath: () => [] } as unknown as NavigationSystem;
    const npc = npcAt(0, 0);
    const steer = new NpcSteering(() => nav, () => 0.5);
    steer.chase(npc as unknown as NPC, new Vector3(10, 1, 0), 1 / 60);
    expect(npc.currentPath.map((p) => p.x)).toEqual([10]);
    expect(npc.vel.x, "it moves toward the player").toBeGreaterThan(0);
    npc.pathRefreshTimer = 0;
    npc.mesh.position.set(5, 1, 5);
    steer.returnHome(npc as unknown as NPC, 1 / 60);
    expect(npc.currentPath.map((p) => [p.x, p.z])).toEqual([[0, 0]]);
  });
});
