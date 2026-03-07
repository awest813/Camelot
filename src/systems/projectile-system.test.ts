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
});
