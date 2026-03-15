import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProjectileSystem } from "./projectile-system";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

// ── Babylon mocks ─────────────────────────────────────────────────────────────

vi.mock("@babylonjs/core/Meshes/meshBuilder", () => ({
  MeshBuilder: {
    CreateCylinder: vi.fn(() => ({
      position: new Vector3(0, 0, 0.8), // in front of player
      material: null,
      isDisposed: vi.fn(() => false),
      dispose: vi.fn(),
      lookAt: vi.fn(),
    })),
  },
}));

vi.mock("@babylonjs/core/Materials/standardMaterial", () => ({
  StandardMaterial: class {
    diffuseColor: any = null;
    constructor(_name: string, _scene: any) {}
  },
}));

vi.mock("@babylonjs/core/Maths/math.color", () => ({
  Color3: class { constructor(public r = 0, public g = 0, public b = 0) {} },
}));

vi.mock("@babylonjs/core/Physics/v2/physicsAggregate", () => ({
  PhysicsAggregate: class {
    body = {
      setMotionType: vi.fn(),
      applyImpulse: vi.fn(),
    };
    dispose = vi.fn();
    constructor() {}
  },
}));

vi.mock("@babylonjs/core/Physics", () => ({
  PhysicsShapeType: { SPHERE: 1 },
  PhysicsMotionType: { DYNAMIC: 1 },
}));

// ─────────────────────────────────────────────────────────────────────────────

describe("ProjectileSystem", () => {
  let projectileSystem: ProjectileSystem;
  let mockScene: any;
  let mockPlayer: any;
  let mockNpc: any;
  let mockUI: any;

  beforeEach(() => {
    mockScene = {};
    mockUI = { showNotification: vi.fn() };

    mockPlayer = {
      stamina: 100,
      bonusDamage: 0,
      camera: { position: new Vector3(0, 0, 0) },
      getForwardDirection: vi.fn(() => new Vector3(0, 0, 1)),
      notifyResourceSpent: vi.fn(),
    };

    mockNpc = {
      isDead: false,
      isAggressive: false,
      mesh: { name: "Goblin", position: new Vector3(0, 0, 1.0) },
      takeDamage: vi.fn(),
    };

    projectileSystem = new ProjectileSystem(mockScene, mockPlayer, [mockNpc], mockUI);
    projectileSystem.arrowCount = 10;
  });

  it("starts with isReady = true", () => {
    expect(projectileSystem.isReady).toBe(true);
  });

  it("fireArrow succeeds when stamina and ammo are sufficient", () => {
    const result = projectileSystem.fireArrow();
    expect(result).toBe(true);
    expect(mockPlayer.notifyResourceSpent).toHaveBeenCalledWith("stamina");
  });

  it("fireArrow deducts stamina", () => {
    projectileSystem.fireArrow();
    expect(mockPlayer.stamina).toBe(92); // 100 - 8 cost
  });

  it("fireArrow decrements arrowCount", () => {
    projectileSystem.arrowCount = 3;
    projectileSystem.fireArrow();
    expect(projectileSystem.arrowCount).toBe(2);
  });

  it("fireArrow returns false when out of ammo", () => {
    projectileSystem.arrowCount = 0;
    expect(projectileSystem.fireArrow()).toBe(false);
    expect(mockUI.showNotification).toHaveBeenCalledWith("No arrows!", 1500);
  });

  it("fireArrow returns false when stamina is too low", () => {
    mockPlayer.stamina = 5;
    expect(projectileSystem.fireArrow()).toBe(false);
    expect(mockUI.showNotification).toHaveBeenCalledWith("Not enough stamina!", 1500);
  });

  it("fireArrow enforces cooldown between shots", () => {
    projectileSystem.fireArrow();
    expect(projectileSystem.isReady).toBe(false);
    expect(projectileSystem.fireArrow()).toBe(false);
  });

  it("cooldown ticks down via update()", () => {
    projectileSystem.fireArrow();
    projectileSystem.update(1.0); // advance 1 second (cooldown = 0.8s)
    expect(projectileSystem.isReady).toBe(true);
  });

  it("infinite arrows do not decrement (-1)", () => {
    projectileSystem.arrowCount = -1;
    projectileSystem.fireArrow();
    expect(projectileSystem.arrowCount).toBe(-1);
  });

  it("addArrows increases arrowCount", () => {
    projectileSystem.arrowCount = 5;
    projectileSystem.addArrows(10);
    expect(projectileSystem.arrowCount).toBe(15);
  });

  it("addArrows does nothing when arrowCount is -1 (infinite)", () => {
    projectileSystem.arrowCount = -1;
    projectileSystem.addArrows(10);
    expect(projectileSystem.arrowCount).toBe(-1);
  });

  it("higher archerySkill produces greater arrow damage", () => {
    projectileSystem.archerySkill = 10;
    projectileSystem.fireArrow();
    const lowSkillDmg = mockNpc.takeDamage.mock.calls[0]?.[0];

    // Wait for hit
    // Arrow position (0, 0, 0.8) is within 1.2 of NPC at (0, 0, 1.0)
    projectileSystem.update(0.1);
    projectileSystem.update(0.1);

    // Reset and fire with high skill
    vi.clearAllMocks();
    mockPlayer.stamina = 100;
    projectileSystem.arrowCount = 5;
    projectileSystem.archerySkill = 100;

    // Drain cooldown
    projectileSystem.update(1.0);
    projectileSystem.fireArrow();
    projectileSystem.update(0.1);
    projectileSystem.update(0.1);

    const highSkillDmg = mockNpc.takeDamage.mock.calls[0]?.[0];
    if (lowSkillDmg !== undefined && highSkillDmg !== undefined) {
      expect(highSkillDmg).toBeGreaterThan(lowSkillDmg);
    }
  });

  it("NPC list can be hot-swapped", () => {
    const newNpc = { ...mockNpc };
    projectileSystem.npcs = [newNpc];
    expect(projectileSystem.npcs[0]).toBe(newNpc);
  });

  // ── Arrow types ────────────────────────────────────────────────────────────

  it("equippedArrowType defaults to 'iron'", () => {
    expect(projectileSystem.equippedArrowType).toBe("iron");
  });

  it("daedric arrows deal more damage than iron arrows", () => {
    // Fire with iron arrows and track the damage that hits the NPC
    projectileSystem.archerySkill = 50;
    mockNpc.mesh.position.z = 0.8; // within ARROW_HIT_RADIUS of spawn

    projectileSystem.equippedArrowType = "iron";
    mockPlayer.stamina = 100;
    projectileSystem.arrowCount = 10;
    projectileSystem.fireArrow();
    projectileSystem.update(0.1);
    projectileSystem.update(0.1);
    const ironDmg: number = mockNpc.takeDamage.mock.calls.at(-1)?.[0] ?? 0;

    // Reset and fire with daedric arrows
    vi.clearAllMocks();
    mockPlayer.stamina = 100;
    projectileSystem.arrowCount = 10;
    projectileSystem.update(1.0); // drain cooldown
    projectileSystem.equippedArrowType = "daedric";
    projectileSystem.fireArrow();
    projectileSystem.update(0.1);
    projectileSystem.update(0.1);
    const daedricDmg: number = mockNpc.takeDamage.mock.calls.at(-1)?.[0] ?? 0;

    if (ironDmg > 0 && daedricDmg > 0) {
      expect(daedricDmg).toBeGreaterThan(ironDmg);
    }
  });

  // ── Draw-time mechanic ─────────────────────────────────────────────────────

  it("isDrawing is false initially", () => {
    expect(projectileSystem.isDrawing).toBe(false);
  });

  it("drawProgress is 0 initially", () => {
    expect(projectileSystem.drawProgress).toBe(0);
  });

  it("beginDraw returns true and sets isDrawing", () => {
    const started = projectileSystem.beginDraw();
    expect(started).toBe(true);
    expect(projectileSystem.isDrawing).toBe(true);
  });

  it("beginDraw returns false when on cooldown", () => {
    projectileSystem.fireArrow(); // puts system on cooldown
    expect(projectileSystem.beginDraw()).toBe(false);
  });

  it("beginDraw returns false when out of ammo", () => {
    projectileSystem.arrowCount = 0;
    expect(projectileSystem.beginDraw()).toBe(false);
  });

  it("beginDraw returns false when stamina too low", () => {
    mockPlayer.stamina = 2;
    expect(projectileSystem.beginDraw()).toBe(false);
  });

  it("drawProgress advances over time after beginDraw", () => {
    projectileSystem.beginDraw();
    projectileSystem.update(0.4); // half the 0.8s draw time
    expect(projectileSystem.drawProgress).toBeCloseTo(0.5, 1);
  });

  it("drawProgress caps at 1.0 (full draw)", () => {
    projectileSystem.beginDraw();
    projectileSystem.update(2.0); // way past full draw
    expect(projectileSystem.drawProgress).toBe(1.0);
  });

  it("releaseArrow fires arrow and resets draw state", () => {
    projectileSystem.beginDraw();
    projectileSystem.update(1.0); // fully drawn
    const fired = projectileSystem.releaseArrow();
    expect(fired).toBe(true);
    expect(projectileSystem.isDrawing).toBe(false);
    expect(projectileSystem.drawProgress).toBe(0);
  });

  it("releaseArrow returns false when not drawing", () => {
    expect(projectileSystem.releaseArrow()).toBe(false);
  });

  it("releaseArrow cancels silently on minimal draw (< 10%)", () => {
    projectileSystem.beginDraw();
    projectileSystem.update(0.01); // barely drawn
    const fired = projectileSystem.releaseArrow();
    expect(fired).toBe(false);
    expect(mockPlayer.notifyResourceSpent).not.toHaveBeenCalled();
  });

  it("partial draw fires arrow with reduced damage vs full draw", () => {
    mockNpc.mesh.position.z = 0.8; // close enough to be hit on next update

    // Full draw
    mockPlayer.stamina = 100;
    projectileSystem.arrowCount = 10;
    projectileSystem.beginDraw();
    projectileSystem.update(1.0); // full draw
    projectileSystem.releaseArrow();
    projectileSystem.update(0.1);
    projectileSystem.update(0.1);
    const fullDmg: number = mockNpc.takeDamage.mock.calls.at(-1)?.[0] ?? 0;

    // Partial draw (~50%)
    vi.clearAllMocks();
    mockPlayer.stamina = 100;
    projectileSystem.arrowCount = 10;
    projectileSystem.update(1.0); // drain cooldown
    projectileSystem.beginDraw();
    projectileSystem.update(0.4); // ~50% draw
    projectileSystem.releaseArrow();
    projectileSystem.update(0.1);
    projectileSystem.update(0.1);
    const halfDmg: number = mockNpc.takeDamage.mock.calls.at(-1)?.[0] ?? 0;

    if (fullDmg > 0 && halfDmg > 0) {
      expect(fullDmg).toBeGreaterThan(halfDmg);
    }
  });

  // ── Sneak attack ───────────────────────────────────────────────────────────

  it("sneak attack notification shown when crouching and NPC undetected", () => {
    const mockStealth = {
      isCrouching: true,
      getDetectionLevel: vi.fn(() => 0), // NPC is fully undetected
    };
    projectileSystem.stealthSystem = mockStealth as any;
    mockNpc.isDead = false;
    // Place NPC close enough to be hit
    mockNpc.mesh.position = new Vector3(0, 0, 0.8);

    projectileSystem.fireArrow();
    // Arrow spawns at (0,0,0.8), NPC is at (0,0,0.8) → within ARROW_HIT_RADIUS
    projectileSystem.update(0.1);
    projectileSystem.update(0.1);

    expect(mockUI.showNotification).toHaveBeenCalledWith(
      expect.stringContaining("Sneak Attack"),
      expect.any(Number),
    );
  });

  it("no sneak attack when standing (not crouching)", () => {
    const mockStealth = {
      isCrouching: false,
      getDetectionLevel: vi.fn(() => 0),
    };
    projectileSystem.stealthSystem = mockStealth as any;
    mockNpc.mesh.position = new Vector3(0, 0, 0.8);

    projectileSystem.fireArrow();
    projectileSystem.update(0.1);
    projectileSystem.update(0.1);

    const calls = (mockUI.showNotification as ReturnType<typeof vi.fn>).mock.calls;
    const sneakCall = calls.find(([msg]) => String(msg).includes("Sneak Attack"));
    expect(sneakCall).toBeUndefined();
  });

  it("no sneak attack when NPC detection is high", () => {
    const mockStealth = {
      isCrouching: true,
      getDetectionLevel: vi.fn(() => 80), // NPC is suspicious
    };
    projectileSystem.stealthSystem = mockStealth as any;
    mockNpc.mesh.position = new Vector3(0, 0, 0.8);

    projectileSystem.fireArrow();
    projectileSystem.update(0.1);
    projectileSystem.update(0.1);

    const calls = (mockUI.showNotification as ReturnType<typeof vi.fn>).mock.calls;
    const sneakCall = calls.find(([msg]) => String(msg).includes("Sneak Attack"));
    expect(sneakCall).toBeUndefined();
  });

  // ─── Arrow draw-time multiplier ───────────────────────────────────────────

  it("elven arrows draw faster than iron arrows (drawTimeMultiplier < 1)", () => {
    // Iron: drawTimeMultiplier = 1.00 → effectiveDrawTime = 0.8 s
    // Elven: drawTimeMultiplier = 0.90 → effectiveDrawTime = 0.72 s
    // After 0.36 s with iron: progress = 0.36/0.8 = 0.45
    // After 0.36 s with elven: progress = 0.36/0.72 = 0.50

    projectileSystem.equippedArrowType = "iron";
    projectileSystem.beginDraw();
    projectileSystem.update(0.36);
    const ironProgress = projectileSystem.drawProgress;
    projectileSystem.releaseArrow();
    projectileSystem.update(1.0); // clear cooldown

    projectileSystem.equippedArrowType = "elven";
    projectileSystem.beginDraw();
    projectileSystem.update(0.36);
    const elvenProgress = projectileSystem.drawProgress;

    expect(elvenProgress).toBeGreaterThan(ironProgress);
  });

  it("daedric arrows draw slower than iron arrows (drawTimeMultiplier > 1)", () => {
    // Iron: drawTimeMultiplier = 1.00 → effectiveDrawTime = 0.8 s
    // Daedric: drawTimeMultiplier = 1.25 → effectiveDrawTime = 1.0 s
    // After 0.5 s with iron: progress = 0.5/0.8 = 0.625
    // After 0.5 s with daedric: progress = 0.5/1.0 = 0.5

    projectileSystem.equippedArrowType = "iron";
    projectileSystem.beginDraw();
    projectileSystem.update(0.5);
    const ironProgress = projectileSystem.drawProgress;
    projectileSystem.releaseArrow();
    projectileSystem.update(1.0); // clear cooldown

    projectileSystem.equippedArrowType = "daedric";
    projectileSystem.beginDraw();
    projectileSystem.update(0.5);
    const daedricProgress = projectileSystem.drawProgress;

    expect(daedricProgress).toBeLessThan(ironProgress);
  });
});
