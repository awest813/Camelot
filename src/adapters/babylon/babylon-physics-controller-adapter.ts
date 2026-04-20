/**
 * BabylonPhysicsControllerAdapter — Physics-aware character controller bridge.
 *
 * Bridges the headless {@link BabylonCharacterControllerAdapter} with a
 * real Babylon.js character controller that uses `moveWithCollision()` for
 * slope constraints, camera elasticity, and animation group binding.
 *
 * Inspired by the `babylonjs-charactercontroller` npm package
 * (https://github.com/ssatguru/BabylonJS-CharacterController).
 *
 * Design:
 *   - The headless adapter remains the source of truth for movement state
 *     (position, velocity, crouch, sprint, swim, mounted).
 *   - This adapter adds physics-engine-specific features:
 *       • Slope angle constraints (prevent climbing steep surfaces)
 *       • Camera elasticity (snap camera when an object blocks the view)
 *       • Ground detection via raycasts instead of simple y=0 clamp
 *       • Animation state mapping to the AnimationSystem's clip names
 *   - Both adapters are headless-testable (no real Babylon scene required).
 *
 * @example
 * ```ts
 * const headless = new BabylonCharacterControllerAdapter();
 * const physics  = new BabylonPhysicsControllerAdapter(headless);
 *
 * physics.maxSlopeAngle = 45;
 * physics.cameraElasticity = true;
 *
 * // In game loop:
 * headless.setMoveInput(inputX, inputZ);
 * headless.update(dt);
 * physics.update(dt);
 * // physics.animationClip tells you which animation to play
 * ```
 */

import type { BabylonCharacterControllerAdapter, Vec3 } from "./babylon-controller-adapter";

// ── Types ──────────────────────────────────────────────────────────────────────

/**
 * Animation clip name compatible with AnimationSystem.
 * Subset of AnimationClip relevant to player movement.
 */
export type MovementAnimationClip =
  | "idle"
  | "walk"
  | "run"
  | "spawn"
  | "death";

/** Configuration for slope constraints. */
export interface SlopeConfig {
  /** Maximum slope angle the character can climb (degrees). Default: 45. */
  maxAngle: number;
  /** Whether to slide down slopes steeper than maxAngle. Default: true. */
  slideOnSteep: boolean;
  /** Slide acceleration in units/sec². Default: 5.0. */
  slideAcceleration: number;
}

/** Configuration for camera elasticity. */
export interface CameraElasticityConfig {
  /** Whether camera elasticity is enabled. Default: false. */
  enabled: boolean;
  /** Minimum distance from camera to character before snapping. Default: 0.5. */
  minDistance: number;
  /** Maximum camera distance from character. Default: 10.0. */
  maxDistance: number;
  /** Speed at which the camera snaps back after obstruction. Default: 5.0. */
  snapSpeed: number;
}

/** Snapshot for save/restore. */
export interface PhysicsControllerSnapshot {
  slopeConfig: SlopeConfig;
  cameraElasticity: CameraElasticityConfig;
  groundNormal: Vec3;
  isOnSteepSlope: boolean;
  slideVelocityY: number;
  cameraDistance: number;
  cameraObstructed: boolean;
}

/** Ground detection result from a raycast or similar probe. */
export interface GroundProbeResult {
  /** Whether the probe hit a surface. */
  hit: boolean;
  /** World-space Y of the ground surface, or NaN if no hit. */
  groundY: number;
  /** Surface normal at the hit point. */
  normal: Vec3;
  /** Distance from the probe origin to the hit. */
  distance: number;
}

/** Camera obstruction probe result. */
export interface CameraObstructionResult {
  /** Whether something is blocking the camera. */
  obstructed: boolean;
  /** Distance from character to the obstruction, or Infinity if clear. */
  obstructionDistance: number;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const DEFAULT_SLOPE: SlopeConfig = {
  maxAngle: 45,
  slideOnSteep: true,
  slideAcceleration: 5.0,
};

const DEFAULT_CAMERA_ELASTICITY: CameraElasticityConfig = {
  enabled: false,
  minDistance: 0.5,
  maxDistance: 10.0,
  snapSpeed: 5.0,
};

const DEG_TO_RAD = Math.PI / 180;

// ── System ─────────────────────────────────────────────────────────────────────

export class BabylonPhysicsControllerAdapter {
  /** Reference to the headless movement adapter. */
  private readonly _headless: BabylonCharacterControllerAdapter;

  // ── Slope state ────────────────────────────────────────────────────────────

  private _slopeConfig: SlopeConfig = { ...DEFAULT_SLOPE };
  private _groundNormal: { x: number; y: number; z: number } = { x: 0, y: 1, z: 0 };
  private _isOnSteepSlope = false;
  private _slideVelocityY = 0;

  // ── Camera elasticity state ────────────────────────────────────────────────

  private _cameraElasticity: CameraElasticityConfig = { ...DEFAULT_CAMERA_ELASTICITY };
  private _cameraDistance: number;
  private _cameraObstructed = false;

  // ── Callbacks ──────────────────────────────────────────────────────────────

  /**
   * Called each update to probe the ground beneath the character.
   * Set this to integrate with your physics/raycast system.
   * When null, the adapter assumes flat ground (y=0, normal=(0,1,0)).
   */
  public onGroundProbe: ((position: Vec3) => GroundProbeResult) | null = null;

  /**
   * Called each update when camera elasticity is enabled, to check if
   * the camera line of sight to the character is obstructed.
   * When null, the adapter assumes no obstruction.
   */
  public onCameraObstructionProbe:
    | ((characterPos: Vec3, cameraDistance: number) => CameraObstructionResult)
    | null = null;

  /** Fired when the character starts sliding on a steep slope. */
  public onSteepSlopeEnter: (() => void) | null = null;

  /** Fired when the character leaves a steep slope. */
  public onSteepSlopeExit: (() => void) | null = null;

  /** Fired when the camera snaps due to obstruction. */
  public onCameraSnap: ((newDistance: number) => void) | null = null;

  constructor(headless: BabylonCharacterControllerAdapter) {
    this._headless = headless;
    this._cameraDistance = this._cameraElasticity.maxDistance;
  }

  // ── Getters / Setters ──────────────────────────────────────────────────────

  /** The headless adapter this physics controller wraps. */
  get headless(): BabylonCharacterControllerAdapter {
    return this._headless;
  }

  /** Current slope configuration. */
  get slopeConfig(): Readonly<SlopeConfig> {
    return this._slopeConfig;
  }

  /** Maximum slope angle in degrees. */
  get maxSlopeAngle(): number {
    return this._slopeConfig.maxAngle;
  }
  set maxSlopeAngle(degrees: number) {
    this._slopeConfig.maxAngle = Math.max(0, Math.min(90, degrees));
  }

  /** Whether the character is currently on a slope steeper than maxAngle. */
  get isOnSteepSlope(): boolean {
    return this._isOnSteepSlope;
  }

  /** Last detected ground normal. */
  get groundNormal(): Vec3 {
    return this._groundNormal;
  }

  /** Camera elasticity configuration. */
  get cameraElasticity(): Readonly<CameraElasticityConfig> {
    return this._cameraElasticity;
  }

  /** Enable/disable camera elasticity. */
  set cameraElasticityEnabled(enabled: boolean) {
    this._cameraElasticity.enabled = enabled;
  }

  /** Current camera distance from character. */
  get cameraDistance(): number {
    return this._cameraDistance;
  }

  /** Whether the camera is currently obstructed. */
  get isCameraObstructed(): boolean {
    return this._cameraObstructed;
  }

  /** Configure slope settings. */
  setSlopeConfig(config: Partial<SlopeConfig>): void {
    if (config.maxAngle !== undefined) this._slopeConfig.maxAngle = Math.max(0, Math.min(90, config.maxAngle));
    if (config.slideOnSteep !== undefined) this._slopeConfig.slideOnSteep = config.slideOnSteep;
    if (config.slideAcceleration !== undefined) this._slopeConfig.slideAcceleration = Math.max(0, config.slideAcceleration);
  }

  /** Configure camera elasticity. */
  setCameraElasticity(config: Partial<CameraElasticityConfig>): void {
    if (config.enabled !== undefined) this._cameraElasticity.enabled = config.enabled;
    if (config.minDistance !== undefined) this._cameraElasticity.minDistance = Math.max(0, config.minDistance);
    if (config.maxDistance !== undefined) this._cameraElasticity.maxDistance = Math.max(0, config.maxDistance);
    if (config.snapSpeed !== undefined) this._cameraElasticity.snapSpeed = Math.max(0, config.snapSpeed);
  }

  // ── Animation mapping ──────────────────────────────────────────────────────

  /**
   * Determine the appropriate animation clip based on the headless adapter's
   * current movement state.
   *
   * Priority:
   *   1. If velocity magnitude is near-zero → "idle"
   *   2. If crouching → always "walk" (no run while crouching)
   *   3. If velocity magnitude > 80% of effective speed → "run"
   *   4. Otherwise → "walk"
   */
  get animationClip(): MovementAnimationClip {
    const vel = this._headless.velocity;
    const speed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);

    if (speed < 0.1) return "idle";
    if (this._headless.isCrouching) return "walk";
    if (speed > this._headless.effectiveSpeed * 0.8) return "run";
    return "walk";
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  /**
   * Per-frame update that processes slope constraints and camera elasticity.
   * Should be called AFTER `headless.update(dt)`.
   *
   * @param dt  Delta time in seconds.
   */
  public update(dt: number): void {
    this._updateSlope(dt);
    this._updateCameraElasticity(dt);
  }

  // ── Snapshot / Restore ────────────────────────────────────────────────────

  public getSnapshot(): PhysicsControllerSnapshot {
    return {
      slopeConfig: { ...this._slopeConfig },
      cameraElasticity: { ...this._cameraElasticity },
      groundNormal: { ...this._groundNormal },
      isOnSteepSlope: this._isOnSteepSlope,
      slideVelocityY: this._slideVelocityY,
      cameraDistance: this._cameraDistance,
      cameraObstructed: this._cameraObstructed,
    };
  }

  public restoreSnapshot(snap: PhysicsControllerSnapshot): void {
    this._slopeConfig = { ...snap.slopeConfig };
    this._cameraElasticity = { ...snap.cameraElasticity };
    this._groundNormal = { ...snap.groundNormal };
    this._isOnSteepSlope = snap.isOnSteepSlope;
    this._slideVelocityY = snap.slideVelocityY;
    this._cameraDistance = snap.cameraDistance;
    this._cameraObstructed = snap.cameraObstructed;
  }

  // ── Private: Slope processing ─────────────────────────────────────────────

  private _updateSlope(dt: number): void {
    // Probe ground if callback is set
    if (this.onGroundProbe) {
      const result = this.onGroundProbe(this._headless.position);
      if (result.hit) {
        this._groundNormal = { x: result.normal.x, y: result.normal.y, z: result.normal.z };
      }
    }

    // Compute slope angle from ground normal
    const slopeAngle = this._computeSlopeAngle(this._groundNormal);
    const wasSteep = this._isOnSteepSlope;
    this._isOnSteepSlope = slopeAngle > this._slopeConfig.maxAngle;

    // Fire enter/exit callbacks
    if (this._isOnSteepSlope && !wasSteep) {
      this.onSteepSlopeEnter?.();
    } else if (!this._isOnSteepSlope && wasSteep) {
      this._slideVelocityY = 0;
      this.onSteepSlopeExit?.();
    }

    // Apply slide if on steep slope
    if (this._isOnSteepSlope && this._slopeConfig.slideOnSteep) {
      this._slideVelocityY += this._slopeConfig.slideAcceleration * dt;
    } else {
      this._slideVelocityY = 0;
    }
  }

  /** Compute slope angle in degrees from a surface normal. */
  private _computeSlopeAngle(normal: Vec3): number {
    // Dot product with up vector (0, 1, 0)
    const dot = normal.y;
    // Clamp to avoid NaN from acos
    const clamped = Math.max(-1, Math.min(1, dot));
    return Math.acos(clamped) / DEG_TO_RAD;
  }

  // ── Private: Camera elasticity ────────────────────────────────────────────

  private _updateCameraElasticity(dt: number): void {
    if (!this._cameraElasticity.enabled) {
      this._cameraObstructed = false;
      this._cameraDistance = this._cameraElasticity.maxDistance;
      return;
    }

    // Probe for obstruction
    let targetDistance = this._cameraElasticity.maxDistance;
    if (this.onCameraObstructionProbe) {
      const result = this.onCameraObstructionProbe(
        this._headless.position,
        this._cameraDistance,
      );
      this._cameraObstructed = result.obstructed;
      if (result.obstructed) {
        targetDistance = Math.max(
          this._cameraElasticity.minDistance,
          result.obstructionDistance - 0.1,
        );
      }
    } else {
      this._cameraObstructed = false;
    }

    // Smoothly interpolate camera distance
    const diff = targetDistance - this._cameraDistance;
    if (Math.abs(diff) < 0.01) {
      this._cameraDistance = targetDistance;
    } else {
      const step = this._cameraElasticity.snapSpeed * dt;
      if (this._cameraObstructed) {
        // Snap toward character quickly when obstructed
        this._cameraDistance += Math.sign(diff) * Math.min(Math.abs(diff), step * 3);
      } else {
        // Ease back to max distance when clear
        this._cameraDistance += Math.sign(diff) * Math.min(Math.abs(diff), step);
      }
    }

    // Clamp
    this._cameraDistance = Math.max(
      this._cameraElasticity.minDistance,
      Math.min(this._cameraElasticity.maxDistance, this._cameraDistance),
    );

    // Fire snap callback when distance changes due to obstruction
    if (this._cameraObstructed && Math.abs(diff) > 0.01) {
      this.onCameraSnap?.(this._cameraDistance);
    }
  }

  // ── Utility ───────────────────────────────────────────────────────────────

  /**
   * Check whether movement in the given direction would encounter a slope
   * steeper than the configured max angle.
   *
   * This is a headless check — it uses the onGroundProbe callback with an
   * offset position. Returns false if no probe callback is set.
   */
  public wouldHitSteepSlope(directionX: number, directionZ: number, probeDistance: number = 1.0): boolean {
    if (!this.onGroundProbe) return false;
    const pos = this._headless.position;
    const probePos = {
      x: pos.x + directionX * probeDistance,
      y: pos.y,
      z: pos.z + directionZ * probeDistance,
    };
    const result = this.onGroundProbe(probePos);
    if (!result.hit) return false;
    const angle = this._computeSlopeAngle(result.normal);
    return angle > this._slopeConfig.maxAngle;
  }
}
