/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { FireFx, assignSlots } from "./particles-fx";

describe("assignSlots", () => {
  const a = { id: "a" }, b = { id: "b" }, c = { id: "c" }, d = { id: "d" };
  it("keeps lit fires in their slots and fills free ones", () => {
    expect(assignSlots([null, null], [a, b])).toEqual([a, b]);
    expect(assignSlots([a, b], [b, c])).toEqual([c, b]);
    expect(assignSlots([a, null, b], [d, b])).toEqual([d, null, b]);
    expect(assignSlots([a, b], [])).toEqual([null, null]);
  });
});

describe("FireFx light pool", () => {
  function setup() {
    const scene = new Scene(new NullEngine());
    const fx = new FireFx(scene, 0);
    const fire = (x: number, nightOnly = false) => {
      const flame = MeshBuilder.CreateBox(`f${x}`, {}, scene);
      const light = new PointLight(`l${x}`, new Vector3(x, 1, 0), scene);
      light.intensity = 2;
      light.range = 7;
      fx.attach({ flame, light, kind: "torch", nightOnly });
      return { flame, light };
    };
    const enabledPoints = () => scene.lights.filter((l) => l instanceof PointLight && l.isEnabled()).length;
    return { scene, fx, fire, enabledPoints };
  }

  it("lights the nearest fires with a fixed set of always-on lights", () => {
    const { fx, fire, enabledPoints } = setup();
    const fires = [30, 5, 60, 10, 2, 100].map((x) => fire(x));
    expect(fires.every((f) => !f.light.isEnabled()), "a fire's own light only describes it").toBe(true);
    fx.update(1, Vector3.Zero());
    expect(fx.lights).toHaveLength(4);
    expect(enabledPoints()).toBe(4);
    const lit = fx.lights.filter((l) => l.intensity > 0).map((l) => l.position.x).sort((p, q) => p - q);
    expect(lit).toEqual([2, 5, 10, 30]);
    expect(fx.lights.find((l) => l.position.x === 2)!.range).toBe(7);

    // Walk away: the far fires take over, the count of enabled lights stays.
    fx.update(1, new Vector3(100, 0, 0));
    const lit2 = fx.lights.filter((l) => l.intensity > 0).map((l) => l.position.x).sort((p, q) => p - q);
    expect(lit2).toEqual([60, 100]); // within 45 m: 100 and 60
    expect(enabledPoints()).toBe(4);
  });

  it("night-only fires are dark by day, and a removed fire frees its light", () => {
    const { fx, fire } = setup();
    const candle = fire(1, true);
    const torch = fire(3);
    fx.night = false;
    fx.update(1, Vector3.Zero());
    expect(fx.litFires).toBe(1);
    expect(candle.flame.isEnabled()).toBe(false);
    fx.night = true;
    fx.update(1, Vector3.Zero());
    expect(fx.litFires).toBe(2);
    torch.flame.dispose();
    expect(fx.litFires).toBe(1);
    expect(fx.lights.filter((l) => l.intensity > 0)).toHaveLength(1);
  });
});
