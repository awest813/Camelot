import { describe, it, expect } from "vitest";
import {
  BabylonSceneHost,
  DEFAULT_CLEAR_COLOR,
  DEFAULT_LIGHTING,
  DEFAULT_FOG,
  DEFAULT_SHADOW,
  DEFAULT_SKY,
  DEFAULT_POST_PROCESSING,
} from "./babylon-scene-host";

describe("BabylonSceneHost", () => {
  // ── Construction ────────────────────────────────────────────────────────────

  it("uses all defaults when no config provided", () => {
    const host = new BabylonSceneHost();
    expect(host.clearColor).toEqual(DEFAULT_CLEAR_COLOR);
    expect(host.lighting.ambientIntensity).toBe(DEFAULT_LIGHTING.ambientIntensity);
    expect(host.fog.density).toBe(DEFAULT_FOG.density);
    expect(host.shadow.mapSize).toBe(DEFAULT_SHADOW.mapSize);
    expect(host.sky.turbidity).toBe(DEFAULT_SKY.turbidity);
    expect(host.postProcessing.bloomEnabled).toBe(DEFAULT_POST_PROCESSING.bloomEnabled);
  });

  it("accepts partial config overrides", () => {
    const host = new BabylonSceneHost({
      fog: { mode: "linear", density: 0.01, color: { r: 1, g: 0, b: 0 } },
    });
    expect(host.fog.mode).toBe("linear");
    expect(host.fog.density).toBe(0.01);
    // Other sections should still be defaults
    expect(host.sky.turbidity).toBe(DEFAULT_SKY.turbidity);
  });

  // ── Mutation helpers ────────────────────────────────────────────────────────

  it("setFogDensity updates density", () => {
    const host = new BabylonSceneHost();
    host.setFogDensity(0.05);
    expect(host.fog.density).toBe(0.05);
  });

  it("setFogDensity clamps to 0", () => {
    const host = new BabylonSceneHost();
    host.setFogDensity(-1);
    expect(host.fog.density).toBe(0);
  });

  it("setFogColor updates fog color", () => {
    const host = new BabylonSceneHost();
    host.setFogColor(0.1, 0.2, 0.3);
    expect(host.fog.color).toEqual({ r: 0.1, g: 0.2, b: 0.3 });
  });

  it("setSunInclination updates sky inclination", () => {
    const host = new BabylonSceneHost();
    host.setSunInclination(0.3);
    expect(host.sky.inclination).toBe(0.3);
  });

  it("setLightIntensity updates ambient and sun intensity", () => {
    const host = new BabylonSceneHost();
    host.setLightIntensity(0.5, 2.0);
    expect(host.lighting.ambientIntensity).toBe(0.5);
    expect(host.lighting.sunIntensity).toBe(2.0);
  });

  it("setLightIntensity clamps to 0", () => {
    const host = new BabylonSceneHost();
    host.setLightIntensity(-1, -2);
    expect(host.lighting.ambientIntensity).toBe(0);
    expect(host.lighting.sunIntensity).toBe(0);
  });

  // ── Validation ──────────────────────────────────────────────────────────────

  it("validates default config as valid", () => {
    const host = new BabylonSceneHost();
    expect(host.isValid).toBe(true);
    expect(host.validate()).toEqual([]);
  });

  it("catches non-power-of-two shadow map size", () => {
    const host = new BabylonSceneHost({
      shadow: { mapSize: 1000, blurKernel: 32, bias: 0.0005 },
    });
    expect(host.isValid).toBe(false);
    expect(host.validate()).toContainEqual(
      expect.stringContaining("shadow.mapSize"),
    );
  });

  it("catches zero shadow map size", () => {
    const host = new BabylonSceneHost({
      shadow: { mapSize: 0, blurKernel: 32, bias: 0.0005 },
    });
    expect(host.isValid).toBe(false);
  });

  it("catches non-positive exposure", () => {
    const host = new BabylonSceneHost();
    host.postProcessing.exposure = 0;
    expect(host.isValid).toBe(false);
    expect(host.validate()).toContainEqual(
      expect.stringContaining("exposure"),
    );
  });

  it("catches non-positive contrast", () => {
    const host = new BabylonSceneHost();
    host.postProcessing.contrast = -1;
    expect(host.isValid).toBe(false);
  });

  it("catches negative fog density", () => {
    const host = new BabylonSceneHost();
    host.fog.density = -0.01;
    expect(host.isValid).toBe(false);
  });

  // ── Snapshot / Restore ────────────────────────────────────────────────────

  it("getSnapshot returns a deep copy", () => {
    const host = new BabylonSceneHost();
    host.setFogDensity(0.123);
    const snap = host.getSnapshot();
    expect(snap.fog.density).toBe(0.123);

    host.setFogDensity(0.999);
    expect(snap.fog.density).toBe(0.123); // unchanged
  });

  it("restoreSnapshot applies saved state", () => {
    const host = new BabylonSceneHost();
    host.setFogDensity(0.05);
    host.setFogColor(1, 0, 0);
    host.setSunInclination(0.1);
    const snap = host.getSnapshot();

    const host2 = new BabylonSceneHost();
    host2.restoreSnapshot(snap);
    expect(host2.fog.density).toBe(0.05);
    expect(host2.fog.color).toEqual({ r: 1, g: 0, b: 0 });
    expect(host2.sky.inclination).toBe(0.1);
  });

  it("restoreSnapshot does not share references with the snapshot", () => {
    const host = new BabylonSceneHost();
    const snap = host.getSnapshot();
    host.restoreSnapshot(snap);

    snap.fog.density = 999;
    expect(host.fog.density).not.toBe(999);
  });

  // ── Power-of-two edge cases ─────────────────────────────────────────────────

  it("512 is a valid shadow map size", () => {
    const host = new BabylonSceneHost({
      shadow: { mapSize: 512, blurKernel: 32, bias: 0.0005 },
    });
    expect(host.isValid).toBe(true);
  });

  it("4096 is a valid shadow map size", () => {
    const host = new BabylonSceneHost({
      shadow: { mapSize: 4096, blurKernel: 32, bias: 0.0005 },
    });
    expect(host.isValid).toBe(true);
  });

  it("negative shadow map size is invalid", () => {
    const host = new BabylonSceneHost({
      shadow: { mapSize: -1024, blurKernel: 32, bias: 0.0005 },
    });
    expect(host.isValid).toBe(false);
  });
});
