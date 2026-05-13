import { describe, it, expect, beforeEach, vi } from "vitest";
import { BabylonCharacterControllerAdapter } from "./babylon-controller-adapter";
import {
  BabylonPhysicsControllerAdapter,
  GroundProbeResult,
  CameraObstructionResult,
} from "./babylon-physics-controller-adapter";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeHeadless(): BabylonCharacterControllerAdapter {
  return new BabylonCharacterControllerAdapter();
}

function makeAdapter(headless?: BabylonCharacterControllerAdapter): {
  headless: BabylonCharacterControllerAdapter;
  physics: BabylonPhysicsControllerAdapter;
} {
  const h = headless ?? makeHeadless();
  return { headless: h, physics: new BabylonPhysicsControllerAdapter(h) };
}

function flatGround(): GroundProbeResult {
  return { hit: true, groundY: 0, normal: { x: 0, y: 1, z: 0 }, distance: 0 };
}

function steepSlope(angle: number = 60): GroundProbeResult {
  // Compute normal for given slope angle in degrees
  const rad = (angle * Math.PI) / 180;
  return {
    hit: true,
    groundY: 0,
    normal: { x: Math.sin(rad), y: Math.cos(rad), z: 0 },
    distance: 0,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("BabylonPhysicsControllerAdapter", () => {
  let headless: BabylonCharacterControllerAdapter;
  let physics: BabylonPhysicsControllerAdapter;

  beforeEach(() => {
    const a = makeAdapter();
    headless = a.headless;
    physics = a.physics;
  });

  // ── Construction ──────────────────────────────────────────────────────────

  describe("construction", () => {
    it("wraps the headless adapter", () => {
      expect(physics.headless).toBe(headless);
    });

    it("starts with default slope config", () => {
      expect(physics.maxSlopeAngle).toBe(45);
      expect(physics.slopeConfig.slideOnSteep).toBe(true);
      expect(physics.slopeConfig.slideAcceleration).toBe(5.0);
    });

    it("starts with camera elasticity disabled", () => {
      expect(physics.cameraElasticity.enabled).toBe(false);
    });

    it("starts not on steep slope", () => {
      expect(physics.isOnSteepSlope).toBe(false);
    });

    it("starts with camera not obstructed", () => {
      expect(physics.isCameraObstructed).toBe(false);
    });
  });

  // ── Slope configuration ───────────────────────────────────────────────────

  describe("slope configuration", () => {
    it("maxSlopeAngle setter clamps to [0, 90]", () => {
      physics.maxSlopeAngle = 120;
      expect(physics.maxSlopeAngle).toBe(90);

      physics.maxSlopeAngle = -10;
      expect(physics.maxSlopeAngle).toBe(0);
    });

    it("setSlopeConfig updates individual fields", () => {
      physics.setSlopeConfig({ slideOnSteep: false });
      expect(physics.slopeConfig.slideOnSteep).toBe(false);
      expect(physics.slopeConfig.maxAngle).toBe(45); // unchanged
    });

    it("setSlopeConfig clamps acceleration to >= 0", () => {
      physics.setSlopeConfig({ slideAcceleration: -5 });
      expect(physics.slopeConfig.slideAcceleration).toBe(0);
    });
  });

  // ── Camera elasticity configuration ───────────────────────────────────────

  describe("camera elasticity configuration", () => {
    it("setCameraElasticity updates individual fields", () => {
      physics.setCameraElasticity({ enabled: true, maxDistance: 15 });
      expect(physics.cameraElasticity.enabled).toBe(true);
      expect(physics.cameraElasticity.maxDistance).toBe(15);
      expect(physics.cameraElasticity.minDistance).toBe(0.5); // unchanged
    });

    it("cameraElasticityEnabled setter works", () => {
      physics.cameraElasticityEnabled = true;
      expect(physics.cameraElasticity.enabled).toBe(true);
    });
  });

  // ── Animation clip mapping ────────────────────────────────────────────────

  describe("animationClip", () => {
    it("returns idle when stationary", () => {
      expect(physics.animationClip).toBe("idle");
    });

    it("returns walk when moving slowly", () => {
      headless.setMoveInput(0, 0.3);
      headless.update(1 / 60);
      expect(physics.animationClip).toBe("walk");
    });

    it("returns run when moving fast (sprinting)", () => {
      headless.toggleSprint(true);
      headless.setMoveInput(0, 1);
      // Accelerate over time to reach sprint speed
      for (let i = 0; i < 20; i++) {
        headless.update(1 / 60);
      }
      expect(physics.animationClip).toBe("run");
    });

    it("returns walk when crouching and moving", () => {
      headless.toggleCrouch(true);
      headless.setMoveInput(0, 1);
      headless.update(1 / 60);
      expect(physics.animationClip).toBe("walk");
    });
  });

  // ── Slope detection ───────────────────────────────────────────────────────

  describe("slope detection", () => {
    it("detects flat ground as not steep", () => {
      physics.onGroundProbe = () => flatGround();
      physics.update(1 / 60);
      expect(physics.isOnSteepSlope).toBe(false);
    });

    it("detects steep slope above max angle", () => {
      physics.onGroundProbe = () => steepSlope(60);
      physics.maxSlopeAngle = 45;
      physics.update(1 / 60);
      expect(physics.isOnSteepSlope).toBe(true);
    });

    it("detects moderate slope below max angle", () => {
      physics.onGroundProbe = () => steepSlope(30);
      physics.maxSlopeAngle = 45;
      physics.update(1 / 60);
      expect(physics.isOnSteepSlope).toBe(false);
    });

    it("fires onSteepSlopeEnter when entering steep slope", () => {
      const cb = vi.fn();
      physics.onSteepSlopeEnter = cb;
      physics.onGroundProbe = () => steepSlope(60);
      physics.maxSlopeAngle = 45;
      physics.update(1 / 60);
      expect(cb).toHaveBeenCalledOnce();
    });

    it("fires onSteepSlopeExit when leaving steep slope", () => {
      const cb = vi.fn();
      physics.onSteepSlopeExit = cb;
      physics.onGroundProbe = () => steepSlope(60);
      physics.maxSlopeAngle = 45;
      physics.update(1 / 60); // enter steep

      physics.onGroundProbe = () => flatGround();
      physics.update(1 / 60); // leave steep
      expect(cb).toHaveBeenCalledOnce();
    });

    it("does not fire onSteepSlopeEnter twice on consecutive steep frames", () => {
      const cb = vi.fn();
      physics.onSteepSlopeEnter = cb;
      physics.onGroundProbe = () => steepSlope(60);
      physics.maxSlopeAngle = 45;
      physics.update(1 / 60);
      physics.update(1 / 60);
      expect(cb).toHaveBeenCalledOnce();
    });

    it("works without onGroundProbe (assumes flat)", () => {
      physics.update(1 / 60);
      expect(physics.isOnSteepSlope).toBe(false);
    });
  });

  // ── Camera elasticity ─────────────────────────────────────────────────────

  describe("camera elasticity", () => {
    it("camera distance equals maxDistance when disabled", () => {
      physics.cameraElasticityEnabled = false;
      physics.update(1 / 60);
      expect(physics.cameraDistance).toBe(physics.cameraElasticity.maxDistance);
    });

    it("camera is not obstructed when disabled", () => {
      physics.cameraElasticityEnabled = false;
      physics.update(1 / 60);
      expect(physics.isCameraObstructed).toBe(false);
    });

    it("camera snaps closer when obstructed", () => {
      physics.cameraElasticityEnabled = true;
      physics.setCameraElasticity({ maxDistance: 10, snapSpeed: 100 });
      physics.onCameraObstructionProbe = (): CameraObstructionResult => ({
        obstructed: true,
        obstructionDistance: 3,
      });
      // Update several times to let the camera snap
      for (let i = 0; i < 60; i++) physics.update(1 / 60);
      expect(physics.cameraDistance).toBeLessThan(5);
      expect(physics.isCameraObstructed).toBe(true);
    });

    it("camera returns to maxDistance when obstruction clears", () => {
      physics.cameraElasticityEnabled = true;
      physics.setCameraElasticity({ maxDistance: 10, snapSpeed: 100 });

      // Obstruct
      physics.onCameraObstructionProbe = (): CameraObstructionResult => ({
        obstructed: true,
        obstructionDistance: 3,
      });
      for (let i = 0; i < 30; i++) physics.update(1 / 60);

      // Clear
      physics.onCameraObstructionProbe = (): CameraObstructionResult => ({
        obstructed: false,
        obstructionDistance: Infinity,
      });
      for (let i = 0; i < 120; i++) physics.update(1 / 60);
      expect(physics.cameraDistance).toBeCloseTo(10, 0);
      expect(physics.isCameraObstructed).toBe(false);
    });

    it("fires onCameraSnap when distance changes due to obstruction", () => {
      const cb = vi.fn();
      physics.onCameraSnap = cb;
      physics.cameraElasticityEnabled = true;
      physics.setCameraElasticity({ maxDistance: 10, snapSpeed: 50 });
      physics.onCameraObstructionProbe = (): CameraObstructionResult => ({
        obstructed: true,
        obstructionDistance: 3,
      });
      physics.update(1 / 60);
      expect(cb).toHaveBeenCalled();
    });

    it("works without onCameraObstructionProbe", () => {
      physics.cameraElasticityEnabled = true;
      physics.update(1 / 60);
      expect(physics.isCameraObstructed).toBe(false);
    });
  });

  // ── Slope probing utility ─────────────────────────────────────────────────

  describe("wouldHitSteepSlope()", () => {
    it("returns false without probe callback", () => {
      expect(physics.wouldHitSteepSlope(1, 0)).toBe(false);
    });

    it("returns true when probe finds steep slope", () => {
      physics.onGroundProbe = () => steepSlope(60);
      physics.maxSlopeAngle = 45;
      expect(physics.wouldHitSteepSlope(1, 0)).toBe(true);
    });

    it("returns false when probe finds flat ground", () => {
      physics.onGroundProbe = () => flatGround();
      physics.maxSlopeAngle = 45;
      expect(physics.wouldHitSteepSlope(1, 0)).toBe(false);
    });

    it("returns false when probe misses", () => {
      physics.onGroundProbe = () => ({
        hit: false,
        groundY: NaN,
        normal: { x: 0, y: 1, z: 0 },
        distance: 0,
      });
      expect(physics.wouldHitSteepSlope(1, 0)).toBe(false);
    });
  });

  // ── Snapshot / Restore ────────────────────────────────────────────────────

  describe("snapshot / restore", () => {
    it("getSnapshot captures current state", () => {
      physics.maxSlopeAngle = 30;
      physics.cameraElasticityEnabled = true;
      const snap = physics.getSnapshot();
      expect(snap.slopeConfig.maxAngle).toBe(30);
      expect(snap.cameraElasticity.enabled).toBe(true);
    });

    it("restoreSnapshot restores state", () => {
      physics.maxSlopeAngle = 30;
      physics.cameraElasticityEnabled = true;
      const snap = physics.getSnapshot();

      physics.maxSlopeAngle = 60;
      physics.cameraElasticityEnabled = false;
      physics.restoreSnapshot(snap);

      expect(physics.maxSlopeAngle).toBe(30);
      expect(physics.cameraElasticity.enabled).toBe(true);
    });

    it("snapshot is independent copy (mutation-safe)", () => {
      const snap = physics.getSnapshot();
      snap.slopeConfig.maxAngle = 999;
      expect(physics.maxSlopeAngle).toBe(45); // unchanged
    });
  });
});
