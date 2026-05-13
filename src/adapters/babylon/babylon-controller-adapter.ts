/**
 * BabylonCharacterControllerAdapter — Headless first-person movement state.
 *
 * This adapter keeps movement state (position, velocity, crouching, sprinting,
 * swim speed, mount speed) in a pure-TypeScript struct that does not depend on
 * Babylon.  The game's Babylon-specific code reads the state each frame and
 * feeds it into the camera / physics layer.
 *
 * **Why:**
 *   - Movement rules can be unit-tested without a Babylon scene.
 *   - Movement logic lives in the headless core; Babylon is just the renderer.
 *   - Future alternative adapters (replay, server-side, AI bots) can drive
 *     the same movement state without touching the engine.
 *
 * **Incremental adoption in game.ts:**
 *   game.ts already handles player movement via `Player.update(dt)`.  This
 *   adapter can replace that logic at any pace, method by method.
 *
 * ```ts
 * const controller = new BabylonCharacterControllerAdapter();
 * controller.setMoveInput(0, 0, 1); // forward
 * controller.update(1 / 60);
 * // controller.velocity can be applied to the Babylon camera / physics body
 * ```
 */

// ── Types ──────────────────────────────────────────────────────────────────────

/** Read-only 3D vector for position / velocity. */
export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Mutable 3D vector used internally. */
interface MutableVec3 {
  x: number;
  y: number;
  z: number;
}

/** Snapshot used for save/restore and testing assertions. */
export interface CharacterControllerSnapshot {
  position: Vec3;
  velocity: Vec3;
  isCrouching: boolean;
  isSprinting: boolean;
  isSwimming: boolean;
  isMounted: boolean;
  moveSpeedMultiplier: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_MOVE_SPEED = 6.0;
const CROUCH_SPEED_MULTIPLIER = 0.45;
const SPRINT_SPEED_MULTIPLIER = 1.65;
const SWIM_SPEED_MULTIPLIER = 0.65;
const GRAVITY = -9.81;
const JUMP_IMPULSE = 6.0;
const GROUND_Y = 0;

const ACCELERATION = 25.0;
const DECELERATION = 30.0;
const AIR_CONTROL = 0.1;

const DUCK_HALF_HEIGHT = 0.6;

// ── System ─────────────────────────────────────────────────────────────────────

export class BabylonCharacterControllerAdapter {
  // ── State ──────────────────────────────────────────────────────────────────

  private _position: MutableVec3 = { x: 0, y: 0, z: 0 };
  private _velocity: MutableVec3 = { x: 0, y: 0, z: 0 };

  /** Raw input axes: x = strafe (−1 left, +1 right), z = forward/back (−1 back, +1 fwd). */
  private _inputX = 0;
  private _inputZ = 0;

  /** Yaw angle in radians — determines which world direction "forward" is. */
  private _yaw = 0;

  private _isCrouching = false;
  private _isSprinting = false;
  private _isSwimming = false;
  private _isMounted = false;
  private _isGrounded = true;

  /** External multiplier (e.g. horse speed). */
  private _moveSpeedMultiplier = 1.0;

  /** Base movement speed (units/second). */
  public baseMoveSpeed = DEFAULT_MOVE_SPEED;

  private _isAutoRunning: boolean = false;

  /** Acceleration/deceleration rates. Public so they can be tuned. */
  public acceleration = ACCELERATION;
  public deceleration = DECELERATION;

  /** Stores the desired horizontal velocity direction for smooth interpolation. */
  private _desiredVelocityX: number = 0;
  private _desiredVelocityZ: number = 0;

  /** Current duck height fraction [0-1]. 0 = standing, 1 = fully crouched. */
  private _crouchFraction: number = 0;

  // ── Callbacks ─────────────────────────────────────────────────────────────

  public onCrouchToggle: ((crouching: boolean) => void) | null = null;
  public onJump: (() => void) | null = null;
  public onLand: (() => void) | null = null;

  // ── Getters ───────────────────────────────────────────────────────────────

  get position(): Vec3 { return this._position; }
  get velocity(): Vec3 { return this._velocity; }
  get isCrouching(): boolean { return this._isCrouching; }
  get isSprinting(): boolean { return this._isSprinting; }
  get isSwimming(): boolean { return this._isSwimming; }
  get isMounted(): boolean { return this._isMounted; }
  get isGrounded(): boolean { return this._isGrounded; }
  get isAutoRunning(): boolean { return this._isAutoRunning; }
  get crouchFraction(): number { return this._crouchFraction; }

  /** Effective speed after all multipliers. */
  get effectiveSpeed(): number {
    let speed = this.baseMoveSpeed * this._moveSpeedMultiplier;
    if (this._isCrouching) speed *= CROUCH_SPEED_MULTIPLIER;
    if (this._isSprinting && !this._isCrouching) speed *= SPRINT_SPEED_MULTIPLIER;
    if (this._isSwimming) speed *= SWIM_SPEED_MULTIPLIER;
    return speed;
  }

  get moveSpeedMultiplier(): number { return this._moveSpeedMultiplier; }
  set moveSpeedMultiplier(v: number) { this._moveSpeedMultiplier = Math.max(0, v); }

  get yaw(): number { return this._yaw; }
  set yaw(radians: number) { this._yaw = radians; }

  // ── Input ─────────────────────────────────────────────────────────────────

  /** Set the raw movement input axes. */
  setMoveInput(x: number, z: number): void {
    this._inputX = Math.max(-1, Math.min(1, x));
    this._inputZ = Math.max(-1, Math.min(1, z));
    if (Math.abs(x) > 0.1 || Math.abs(z) > 0.1) {
      this._isAutoRunning = false;
    }
  }

  /** Toggle or set crouch state. */
  toggleCrouch(forceState?: boolean): boolean {
    this._isCrouching = forceState ?? !this._isCrouching;
    if (this._isCrouching) this._isSprinting = false;
    this.onCrouchToggle?.(this._isCrouching);
    return this._isCrouching;
  }

  /** Toggle or set sprint state. */
  toggleSprint(forceState?: boolean): boolean {
    this._isSprinting = forceState ?? !this._isSprinting;
    if (this._isSprinting) this._isCrouching = false;
    return this._isSprinting;
  }

  /** Toggle auto-run (always move forward). */
  toggleAutoRun(): boolean {
    this._isAutoRunning = !this._isAutoRunning;
    if (this._isAutoRunning) {
      this._inputZ = 1;
    }
    return this._isAutoRunning;
  }

  /** Set swimming state (driven by external water-detection). */
  setSwimming(isSwimming: boolean): void {
    this._isSwimming = isSwimming;
  }

  /** Set mounted state (driven by horse system). */
  setMounted(isMounted: boolean): void {
    this._isMounted = isMounted;
  }

  /** Attempt a jump (only works while grounded and not swimming). */
  jump(): boolean {
    if (!this._isGrounded || this._isSwimming) return false;
    this._velocity.y = JUMP_IMPULSE;
    this._isGrounded = false;
    this.onJump?.();
    return true;
  }

  /** Get the effective half-height multiplier for camera position. */
  getEyeHeight(): number {
    return 1 - this._crouchFraction * (1 - DUCK_HALF_HEIGHT);
  }

  // ── Update ────────────────────────────────────────────────────────────────

  /**
   * Advance movement state by `dt` seconds.
   *
   * Uses acceleration-based movement for smooth analog stick feel:
   * accelerates toward desired speed, decelerates to zero when no input.
   * Gravity and ground clamping are applied after movement.
   */
  update(dt: number): void {
    const speed = this.effectiveSpeed;

    // Compute desired world-space velocity from input + yaw
    const sinY = Math.sin(this._yaw);
    const cosY = Math.cos(this._yaw);
    const rawWorldX = this._inputX * cosY + this._inputZ * sinY;
    const rawWorldZ = -this._inputX * sinY + this._inputZ * cosY;

    const mag = Math.sqrt(rawWorldX * rawWorldX + rawWorldZ * rawWorldZ);
    if (mag > 0.01) {
      const desiredX = (rawWorldX / mag) * speed;
      const desiredZ = (rawWorldZ / mag) * speed;
      this._desiredVelocityX = desiredX;
      this._desiredVelocityZ = desiredZ;
    } else {
      this._desiredVelocityX = 0;
      this._desiredVelocityZ = 0;
    }

    const accel = this._isGrounded ? this.acceleration : this.acceleration * AIR_CONTROL;

    // Smoothly interpolate horizontal velocity towards desired
    if (this._desiredVelocityX !== 0 || this._desiredVelocityZ !== 0) {
      const dx = this._desiredVelocityX - this._velocity.x;
      const dz = this._desiredVelocityZ - this._velocity.z;
      const dMag = Math.sqrt(dx * dx + dz * dz);
      if (dMag > 0.01) {
        const maxDelta = accel * dt;
        const delta = Math.min(maxDelta, dMag);
        this._velocity.x += (dx / dMag) * delta;
        this._velocity.z += (dz / dMag) * delta;
      }
    } else {
      // Decelerate to stop
      const currentSpeed = Math.sqrt(this._velocity.x * this._velocity.x + this._velocity.z * this._velocity.z);
      if (currentSpeed > 0.01) {
        const decel = this.deceleration * dt;
        const reduction = Math.min(decel, currentSpeed);
        const normX = this._velocity.x / currentSpeed;
        const normZ = this._velocity.z / currentSpeed;
        this._velocity.x -= normX * reduction;
        this._velocity.z -= normZ * reduction;
      } else {
        this._velocity.x = 0;
        this._velocity.z = 0;
      }
    }

    // Gravity
    if (!this._isGrounded) {
      this._velocity.y += GRAVITY * dt;
    }

    // Apply position delta
    this._position.x += this._velocity.x * dt;
    this._position.y += this._velocity.y * dt;
    this._position.z += this._velocity.z * dt;

    // Animate crouch smoothly
    const targetCrouch = this._isCrouching ? 1 : 0;
    if (Math.abs(this._crouchFraction - targetCrouch) > 0.01) {
      const crouchSpeed = 5.0 * dt;
      this._crouchFraction += Math.sign(targetCrouch - this._crouchFraction) * Math.min(crouchSpeed, Math.abs(this._crouchFraction - targetCrouch));
    } else {
      this._crouchFraction = targetCrouch;
    }

    // Simple ground clamp
    if (this._position.y <= GROUND_Y) {
      this._position.y = GROUND_Y;
      if (this._velocity.y < 0) {
        const wasAirborne = !this._isGrounded;
        this._velocity.y = 0;
        this._isGrounded = true;
        if (wasAirborne) this.onLand?.();
      }
    }
  }

  // ── Teleport ──────────────────────────────────────────────────────────────

  /** Instantly move to a position and zero velocity. */
  teleport(x: number, y: number, z: number): void {
    this._position.x = x;
    this._position.y = y;
    this._position.z = z;
    this._velocity.x = 0;
    this._velocity.y = 0;
    this._velocity.z = 0;
    this._isGrounded = y <= GROUND_Y;
  }

  // ── Snapshot / Restore ────────────────────────────────────────────────────

  getSnapshot(): CharacterControllerSnapshot {
    return {
      position: { ...this._position },
      velocity: { ...this._velocity },
      isCrouching: this._isCrouching,
      isSprinting: this._isSprinting,
      isSwimming: this._isSwimming,
      isMounted: this._isMounted,
      moveSpeedMultiplier: this._moveSpeedMultiplier,
    };
  }

  restoreSnapshot(snap: CharacterControllerSnapshot): void {
    this._position.x = snap.position.x;
    this._position.y = snap.position.y;
    this._position.z = snap.position.z;
    this._velocity.x = snap.velocity.x;
    this._velocity.y = snap.velocity.y;
    this._velocity.z = snap.velocity.z;
    this._isCrouching = snap.isCrouching;
    this._isSprinting = snap.isSprinting;
    this._isSwimming = snap.isSwimming;
    this._isMounted = snap.isMounted;
    this._moveSpeedMultiplier = snap.moveSpeedMultiplier;
    this._isGrounded = this._position.y <= GROUND_Y;
  }
}
