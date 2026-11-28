import { describe, it, expect } from "vitest";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "./mesh-builder";
import { ChunkCuller } from "./chunk-culler";
import { freezeStatic } from "./freeze-static";

function setup() {
  const scene = new Scene(new NullEngine());
  const cam = new FreeCamera("cam", new Vector3(0, 2, 0), scene);
  cam.setTarget(new Vector3(0, 2, 10)); // looking +z
  scene.activeCamera = cam;
  const culler = new ChunkCuller(scene);
  const prop = (name: string, z: number) => {
    const m = MeshBuilder.CreateBox(name, { size: 1 }, scene);
    m.position.set(0, 1, z);
    freezeStatic(m);
    return m;
  };
  return { scene, culler, prop };
}

describe("ChunkCuller", () => {
  it("a chunk behind the view is left out of the selection; one ahead, and loose meshes, stay", () => {
    const t = setup();
    const ahead = [t.prop("a1", 20), t.prop("a2", 25)];
    const behind = [t.prop("b1", -20), t.prop("b2", -25)];
    const loose = t.prop("npc", -22); // not a chunk prop: Babylon decides, as ever
    t.culler.add("0,1", ahead);
    t.culler.add("0,-1", behind);
    t.scene.render();
    const candidates = (t.scene as unknown as { getActiveMeshCandidates(): { data: unknown[]; length: number } }).getActiveMeshCandidates();
    const names = candidates.data.slice(0, candidates.length).map((m) => (m as { name: string }).name);
    expect(names).toEqual(expect.arrayContaining(["a1", "a2", "npc"]));
    expect(names).not.toContain("b1");
    expect(t.culler.culledGroups).toBe(1);
    expect(t.scene.getActiveMeshes().data.slice(0, t.scene.getActiveMeshes().length).map((m) => m.name).sort()).toEqual(["a1", "a2"]);
    expect(loose.isVisible).toBe(true);
  });

  it("a forgotten group goes; turning round brings the other back", () => {
    const t = setup();
    const behind = [t.prop("b1", -20)];
    t.culler.add("0,-1", behind);
    t.scene.render();
    expect(t.culler.culledGroups).toBe(1);
    t.scene.activeCamera!.position.set(0, 2, 0);
    (t.scene.activeCamera as FreeCamera).setTarget(new Vector3(0, 2, -10));
    t.scene.render();
    expect(t.culler.culledGroups).toBe(0);
    expect(t.scene.getActiveMeshes().length).toBe(1);
    t.culler.forget("0,-1", behind);
    expect(t.culler.culledGroups).toBe(0);
  });
});
