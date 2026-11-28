import { describe, it, expect } from "vitest";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { freezeStatic } from "./freeze-static";

describe("freezeStatic", () => {
  it("freezes a placed prop and its parts where they stand", () => {
    const scene = new Scene(new NullEngine());
    const root = new Mesh("root", scene), part = new Mesh("part", scene);
    part.parent = root;
    root.position.set(10, 0, 5);
    part.position.set(0, 2, 0);
    freezeStatic(root);
    expect(root.isWorldMatrixFrozen && part.isWorldMatrixFrozen).toBe(true);
    expect(part.getAbsolutePosition().asArray()).toEqual([10, 2, 5]);
  });
});
