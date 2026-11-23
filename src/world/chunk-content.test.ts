import { describe, it, expect, vi } from "vitest";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { NPC } from "../entities/npc";
import { ChunkContent, type ChunkContentDeps } from "./chunk-content";
import { actors } from "../entities/actors";
import { ChunkOwned } from "../core/ecs/actors";

function fakeNpc(name: string): NPC {
  const npc = { mesh: { name } } as unknown as NPC & { actorId: number };
  npc.actorId = actors.spawn(npc);
  return npc;
}

function setup() {
  const scene = new Scene(new NullEngine());
  const released: NPC[] = [];
  const lod = { registerHierarchy: vi.fn(), unregister: vi.fn() };
  const forges = { add: vi.fn() };
  const c = new ChunkContent({
    scene,
    assets: { getInstance: vi.fn() },
    lod,
    shadows: () => null,
    fireFx: () => null,
    forges: () => forges,
    releaseNpc: (n) => { released.push(n); },
  } as unknown as ChunkContentDeps);
  return { scene, c, released, lod, forges };
}

describe("ChunkContent", () => {
  it("what a chunk holds goes when it unloads; late arrivals are dropped", () => {
    const t = setup();
    const rec = t.c.open("1,2");
    const prop = MeshBuilder.CreateBox("prop", {}, t.scene);
    t.c.track("1,2", rec, prop, "structure");
    expect(t.lod.registerHierarchy).toHaveBeenCalledWith(prop, 145);
    const npc = fakeNpc("villager");
    rec.addNpc(npc);
    expect(actors.has(npc.actorId, ChunkOwned)).toBe(true);

    t.c.close("1,2");
    expect(prop.isDisposed()).toBe(true);
    expect(t.released).toEqual([npc]);
    expect(actors.has(npc.actorId, ChunkOwned), "no longer chunk-owned").toBe(false);
    expect(t.c.record("1,2")).toBeUndefined();

    // An asset that finishes loading after its chunk went.
    const late = MeshBuilder.CreateBox("late", {}, t.scene);
    t.c.track("1,2", rec, late, "prop");
    expect(late.isDisposed()).toBe(true);
  });

  it("unloading is a scope dispose: anything a feature adds to the chunk's scope goes too", () => {
    const t = setup();
    const rec = t.c.open("3,3");
    const gone: string[] = [];
    t.c.scopeOf("3,3")!.add(() => gone.push("feature thing"));
    rec.own(MeshBuilder.CreateBox("collider", {}, t.scene), () => gone.push("collider"));
    t.c.close("3,3");
    expect(gone).toEqual(["collider", "feature thing"]);
    expect(t.c.scopeOf("3,3")).toBeUndefined();
    expect(rec.closed).toBe(true);
    // An NPC spawned for a chunk that already went is released at once.
    const late = fakeNpc("late");
    rec.addNpc(late);
    expect(t.released).toEqual([late]);
  });

  it("buildings keep NPCs out; the keep-out lifts on undo", () => {
    const t = setup();
    const undo = t.c.addKeepOut({ x: 10, z: 10, cos: 1, sin: 0, hw: 3, hd: 2 });
    expect(t.c.isWalkable(10, 10)).toBe(false);
    expect(t.c.isWalkable(14, 10)).toBe(true);
    expect(t.c.nearBuilding(14, 10, 1.5)).toBe(true);
    undo();
    expect(t.c.isWalkable(10, 10)).toBe(true);
  });

  it("forget takes an NPC off its chunk without releasing it", () => {
    const t = setup();
    const rec = t.c.open("0,0");
    const npc = fakeNpc("guard");
    rec.addNpc(npc);
    t.c.forget(npc);
    expect(actors.has(npc.actorId, ChunkOwned)).toBe(false);
    t.c.close("0,0");
    expect(t.released).toEqual([]);
  });

  it("a smithy is a forge station even outside a chunk", () => {
    const t = setup();
    t.c.placeSmithy(null, null, -4, -5);
    expect(t.forges.add).toHaveBeenCalledWith("forge_-4.0_-5.0", -4, -5, null);
  });
});
