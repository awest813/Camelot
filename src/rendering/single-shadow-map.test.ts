import { describe, expect, it } from "vitest";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import { MeshBuilder } from "./mesh-builder";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { SINGLE_MAP_AREA, fixSingleMapArea, lightAxes, snapSunToTexels } from "./render-pipeline";

describe("the single shadow map", () => {
  const dir = new Vector3(-1.0, -2.5, -0.6).normalize();

  it("uses the light view's own axes", () => {
    const axes = { x: new Vector3(), y: new Vector3() };
    expect(lightAxes(dir, axes)).toBe(true);
    const view = Matrix.LookAtLH(Vector3.Zero(), dir, Vector3.Up());
    // Babylon's view matrix maps world x-axis direction to light-space x (its first column).
    const m = view.m;
    expect(axes.x.x).toBeCloseTo(m[0]); expect(axes.x.y).toBeCloseTo(m[4]); expect(axes.x.z).toBeCloseTo(m[8]);
    expect(axes.y.x).toBeCloseTo(m[1]); expect(axes.y.y).toBeCloseTo(m[5]); expect(axes.y.z).toBeCloseTo(m[9]);
    expect(lightAxes(new Vector3(0, -1, 0), axes), "straight down: no axes").toBe(false);
  });

  it("keeps the sun on the texel grid, and moves it less than a texel", () => {
    const scene = new Scene(new NullEngine());
    const sun = new DirectionalLight("sun", dir.clone(), scene);
    const axes = { x: new Vector3(), y: new Vector3() };
    lightAxes(dir, axes);
    const texel = SINGLE_MAP_AREA / 512;
    for (const at of [new Vector3(12.34, 50, -7.7), new Vector3(1000.01, 80, 333.3)]) {
      sun.position.copyFrom(at);
      snapSunToTexels(sun, 512);
      for (const a of [axes.x, axes.y]) {
        const u = Vector3.Dot(sun.position, a) / texel;
        expect(Math.abs(u - Math.round(u))).toBeLessThan(1e-6);
      }
      expect(Vector3.Distance(sun.position, at)).toBeLessThan(texel);
      // Along the light, nothing changes.
      expect(Vector3.Dot(sun.position, dir)).toBeCloseTo(Vector3.Dot(at, dir), 6);
    }
  });

  it("covers a fixed square and draws only the casters over it", () => {
    const scene = new Scene(new NullEngine());
    const sun = new DirectionalLight("sun", dir.clone(), scene);
    sun.position = dir.scale(-150);
    const shadows = new ShadowGenerator(512, sun);
    fixSingleMapArea(sun, shadows);
    expect(sun.autoUpdateExtends).toBe(false);
    expect(sun.shadowFrustumSize).toBe(SINGLE_MAP_AREA);
    const near = MeshBuilder.CreateBox("near", { size: 2 }, scene);
    const far = MeshBuilder.CreateBox("far", { size: 2 }, scene);
    far.position.set(400, 0, 0);
    for (const m of [near, far]) { m.computeWorldMatrix(true); shadows.addShadowCaster(m); }
    const list = shadows.getShadowMap()!.renderList!;
    const drawn = shadows.getShadowMap()!.getCustomRenderList!(0, list, list.length);
    expect(drawn?.map((m) => m.name)).toEqual(["near"]);
  });
});
