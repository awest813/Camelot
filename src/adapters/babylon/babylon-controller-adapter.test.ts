import { describe, it, expect, vi } from "vitest";
import { BabylonCharacterControllerAdapter } from "./babylon-controller-adapter";

describe("BabylonCharacterControllerAdapter", () => {
  // ── Construction ────────────────────────────────────────────────────────────

  it("starts at origin with zero velocity", () => {
    const ctrl = new BabylonCharacterControllerAdapter();
    expect(ctrl.position).toEqual({ x: 0, y: 0, z: 0 });
    expect(ctrl.velocity).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("starts grounded, not crouching/sprinting/swimming/mounted", () => {
    const ctrl = new BabylonCharacterControllerAdapter();
    expect(ctrl.isGrounded).toBe(true);
    expect(ctrl.isCrouching).toBe(false);
    expect(ctrl.isSprinting).toBe(false);
    expect(ctrl.isSwimming).toBe(false);
    expect(ctrl.isMounted).toBe(false);
  });

  // ── Movement ────────────────────────────────────────────────────────────────

  it("moves forward when inputZ = 1 and yaw = 0", () => {
    const ctrl = new BabylonCharacterControllerAdapter();
    ctrl.setMoveInput(0, 1); // forward
    ctrl.update(1); // 1 second
    expect(ctrl.position.z).toBeGreaterThan(0);
    expect(Math.abs(ctrl.position.x)).toBeLessThan(0.001);
  });

  it("moves backward when inputZ = -1", () => {
    const ctrl = new BabylonCharacterControllerAdapter();
    ctrl.setMoveInput(0, -1);
    ctrl.update(1);
    expect(ctrl.position.z).toBeLessThan(0);
  });

  it("strafes right when inputX = 1", () => {
    const ctrl = new BabylonCharacterControllerAdapter();
    ctrl.setMoveInput(1, 0);
    ctrl.update(1);
    expect(ctrl.position.x).toBeGreaterThan(0);
    expect(Math.abs(ctrl.position.z)).toBeLessThan(0.001);
  });

  it("strafes left when inputX = -1", () => {
    const ctrl = new BabylonCharacterControllerAdapter();
    ctrl.setMoveInput(-1, 0);
    ctrl.update(1);
    expect(ctrl.position.x).toBeLessThan(0);
  });

  it("diagonal movement is normalised (no speed boost)", () => {
    const ctrl = new BabylonCharacterControllerAdapter();
    const speed = ctrl.effectiveSpeed;

    ctrl.setMoveInput(1, 1);
    ctrl.update(1);

    const dist = Math.sqrt(ctrl.position.x ** 2 + ctrl.position.z ** 2);
    expect(dist).toBeCloseTo(speed, 1);
  });

  it("yaw rotates the movement direction", () => {
    const ctrl = new BabylonCharacterControllerAdapter();
    ctrl.yaw = Math.PI / 2; // 90 degrees
    ctrl.setMoveInput(0, 1); // forward
    ctrl.update(1);

    // At 90° yaw, "forward" should be mostly along +X
    expect(ctrl.position.x).toBeGreaterThan(ctrl.baseMoveSpeed * 0.9);
    expect(Math.abs(ctrl.position.z)).toBeLessThan(0.5);
  });

  it("clamps input axes to [-1, 1]", () => {
    const ctrl = new BabylonCharacterControllerAdapter();
    ctrl.setMoveInput(5, -3);
    ctrl.update(1);

    const dist = Math.sqrt(ctrl.position.x ** 2 + ctrl.position.z ** 2);
    expect(dist).toBeCloseTo(ctrl.effectiveSpeed, 1);
  });

  // ── Speed multipliers ──────────────────────────────────────────────────────

  it("crouching reduces effective speed", () => {
    const ctrl = new BabylonCharacterControllerAdapter();
    const normalSpeed = ctrl.effectiveSpeed;
    ctrl.toggleCrouch(true);
    expect(ctrl.effectiveSpeed).toBeLessThan(normalSpeed);
  });

  it("sprinting increases effective speed", () => {
    const ctrl = new BabylonCharacterControllerAdapter();
    const normalSpeed = ctrl.effectiveSpeed;
    ctrl.toggleSprint(true);
    expect(ctrl.effectiveSpeed).toBeGreaterThan(normalSpeed);
  });

  it("swimming reduces effective speed", () => {
    const ctrl = new BabylonCharacterControllerAdapter();
    const normalSpeed = ctrl.effectiveSpeed;
    ctrl.setSwimming(true);
    expect(ctrl.effectiveSpeed).toBeLessThan(normalSpeed);
  });

  it("moveSpeedMultiplier scales speed (e.g. horse mount)", () => {
    const ctrl = new BabylonCharacterControllerAdapter();
    const normalSpeed = ctrl.effectiveSpeed;
    ctrl.moveSpeedMultiplier = 2.0;
    expect(ctrl.effectiveSpeed).toBeCloseTo(normalSpeed * 2.0, 1);
  });

  it("moveSpeedMultiplier clamps to 0", () => {
    const ctrl = new BabylonCharacterControllerAdapter();
    ctrl.moveSpeedMultiplier = -5;
    expect(ctrl.moveSpeedMultiplier).toBe(0);
    expect(ctrl.effectiveSpeed).toBe(0);
  });

  // ── Crouch / Sprint interaction ────────────────────────────────────────────

  it("crouching cancels sprinting", () => {
    const ctrl = new BabylonCharacterControllerAdapter();
    ctrl.toggleSprint(true);
    ctrl.toggleCrouch(true);
    expect(ctrl.isCrouching).toBe(true);
    expect(ctrl.isSprinting).toBe(false);
  });

  it("sprinting cancels crouching", () => {
    const ctrl = new BabylonCharacterControllerAdapter();
    ctrl.toggleCrouch(true);
    ctrl.toggleSprint(true);
    expect(ctrl.isSprinting).toBe(true);
    expect(ctrl.isCrouching).toBe(false);
  });

  it("toggleCrouch fires callback", () => {
    const ctrl = new BabylonCharacterControllerAdapter();
    const states: boolean[] = [];
    ctrl.onCrouchToggle = (c) => { states.push(c); };
    ctrl.toggleCrouch();
    ctrl.toggleCrouch();
    expect(states).toEqual([true, false]);
  });

  // ── Jump ────────────────────────────────────────────────────────────────────

  it("jump sets upward velocity and clears grounded", () => {
    const ctrl = new BabylonCharacterControllerAdapter();
    expect(ctrl.jump()).toBe(true);
    expect(ctrl.velocity.y).toBeGreaterThan(0);
    expect(ctrl.isGrounded).toBe(false);
  });

  it("cannot jump while airborne", () => {
    const ctrl = new BabylonCharacterControllerAdapter();
    ctrl.jump();
    expect(ctrl.jump()).toBe(false);
  });

  it("cannot jump while swimming", () => {
    const ctrl = new BabylonCharacterControllerAdapter();
    ctrl.setSwimming(true);
    expect(ctrl.jump()).toBe(false);
  });

  it("jump fires onJump callback", () => {
    const ctrl = new BabylonCharacterControllerAdapter();
    let jumped = false;
    ctrl.onJump = () => { jumped = true; };
    ctrl.jump();
    expect(jumped).toBe(true);
  });

  // ── Gravity + ground clamp ──────────────────────────────────────────────────

  it("gravity pulls the character down", () => {
    const ctrl = new BabylonCharacterControllerAdapter();
    ctrl.teleport(0, 10, 0);
    ctrl.update(0.5);
    expect(ctrl.position.y).toBeLessThan(10);
  });

  it("character lands on ground (y=0) and becomes grounded", () => {
    const ctrl = new BabylonCharacterControllerAdapter();
    ctrl.teleport(0, 0.1, 0);
    // Apply enough updates for gravity to pull below y=0
    for (let i = 0; i < 60; i++) ctrl.update(1 / 60);
    expect(ctrl.position.y).toBe(0);
    expect(ctrl.isGrounded).toBe(true);
  });

  it("landing fires onLand callback", () => {
    const ctrl = new BabylonCharacterControllerAdapter();
    let landed = false;
    ctrl.onLand = () => { landed = true; };
    ctrl.teleport(0, 2, 0);
    for (let i = 0; i < 120; i++) ctrl.update(1 / 60);
    expect(landed).toBe(true);
  });

  // ── Teleport ────────────────────────────────────────────────────────────────

  it("teleport sets position and zeros velocity", () => {
    const ctrl = new BabylonCharacterControllerAdapter();
    ctrl.setMoveInput(1, 1);
    ctrl.update(1);
    ctrl.teleport(100, 50, -200);
    expect(ctrl.position).toEqual({ x: 100, y: 50, z: -200 });
    expect(ctrl.velocity).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("teleport to y=0 marks grounded", () => {
    const ctrl = new BabylonCharacterControllerAdapter();
    ctrl.teleport(0, 0, 0);
    expect(ctrl.isGrounded).toBe(true);
  });

  it("teleport to y>0 marks airborne", () => {
    const ctrl = new BabylonCharacterControllerAdapter();
    ctrl.teleport(0, 5, 0);
    expect(ctrl.isGrounded).toBe(false);
  });

  // ── Snapshot / Restore ────────────────────────────────────────────────────

  it("getSnapshot captures full state", () => {
    const ctrl = new BabylonCharacterControllerAdapter();
    ctrl.teleport(1, 2, 3);
    ctrl.toggleCrouch(true);
    ctrl.moveSpeedMultiplier = 1.5;
    const snap = ctrl.getSnapshot();
    expect(snap.position).toEqual({ x: 1, y: 2, z: 3 });
    expect(snap.isCrouching).toBe(true);
    expect(snap.moveSpeedMultiplier).toBe(1.5);
  });

  it("restoreSnapshot restores full state", () => {
    const ctrl = new BabylonCharacterControllerAdapter();
    ctrl.teleport(1, 2, 3);
    ctrl.toggleCrouch(true);
    ctrl.setSwimming(true);
    ctrl.moveSpeedMultiplier = 2.5;
    const snap = ctrl.getSnapshot();

    const ctrl2 = new BabylonCharacterControllerAdapter();
    ctrl2.restoreSnapshot(snap);
    expect(ctrl2.position).toEqual({ x: 1, y: 2, z: 3 });
    expect(ctrl2.isCrouching).toBe(true);
    expect(ctrl2.isSwimming).toBe(true);
    expect(ctrl2.moveSpeedMultiplier).toBe(2.5);
  });

  // ── Mounted state ─────────────────────────────────────────────────────────

  it("setMounted toggles mounted state", () => {
    const ctrl = new BabylonCharacterControllerAdapter();
    ctrl.setMounted(true);
    expect(ctrl.isMounted).toBe(true);
    ctrl.setMounted(false);
    expect(ctrl.isMounted).toBe(false);
  });

  // ── No movement when input is zero ─────────────────────────────────────────

  it("does not move when input is zero", () => {
    const ctrl = new BabylonCharacterControllerAdapter();
    ctrl.update(1);
    expect(ctrl.position).toEqual({ x: 0, y: 0, z: 0 });
  });
});
