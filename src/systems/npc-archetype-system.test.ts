import { describe, it, expect, vi } from "vitest";
import { NpcArchetypeSystem } from "./npc-archetype-system";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { NpcArchetypeDefinition } from "../framework/content/content-types";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";

// Minimal mesh and physics mocks — NPC constructor needs these to not throw.
vi.mock("@babylonjs/core/Meshes/meshBuilder", () => ({
  MeshBuilder: {
    CreateCapsule: vi.fn(() => ({
      position: new Vector3(),
      material: null,
      isDisposed: vi.fn(() => false),
      lookAt: vi.fn(),
      metadata: null,
    })),
  },
}));
vi.mock("@babylonjs/core/Materials/standardMaterial", () => ({
  StandardMaterial: class {
    diffuseColor: any = null;
    constructor() {}
  },
}));
vi.mock("@babylonjs/core/Physics/v2/physicsAggregate", () => ({
  PhysicsAggregate: class {
    body: any = {
      setMotionType: vi.fn(),
      setMassProperties: vi.fn(),
      getLinearVelocityToRef: vi.fn(),
      setLinearVelocity: vi.fn(),
    };
    constructor() {}
  },
}));
vi.mock("@babylonjs/core/Physics", () => ({
  PhysicsShapeType: { CAPSULE: 2 },
  PhysicsMotionType: { DYNAMIC: 1, STATIC: 2, ANIMATED: 3 },
}));

const GUARD_ARCHETYPE: NpcArchetypeDefinition = {
  id: "archetype_guard",
  name: "Town Guard",
  role: "guard",
  factionId: "village_guard",
  isHostile: false,
  isMerchant: false,
  baseHealth: 120,
  level: 3,
};

const BANDIT_ARCHETYPE: NpcArchetypeDefinition = {
  id: "archetype_bandit",
  name: "Bandit",
  role: "enemy",
  factionId: "bandits",
  isHostile: true,
  isMerchant: false,
  lootTableId: "bandit_loot",
  baseHealth: 80,
  level: 2,
};

const BOSS_ARCHETYPE: NpcArchetypeDefinition = {
  id: "archetype_boss",
  name: "Boss",
  role: "boss",
  factionId: "bandits",
  isHostile: true,
  isMerchant: false,
  baseHealth: 200,
  level: 6,
};

describe("NpcArchetypeSystem", () => {
  it("registers and retrieves an archetype", () => {
    const sys = new NpcArchetypeSystem();
    sys.registerArchetype(GUARD_ARCHETYPE);
    expect(sys.getArchetype("archetype_guard")).toBe(GUARD_ARCHETYPE);
  });

  it("registerAll loads multiple archetypes", () => {
    const sys = new NpcArchetypeSystem();
    sys.registerAll([GUARD_ARCHETYPE, BANDIT_ARCHETYPE]);
    expect(sys.registeredIds).toHaveLength(2);
    expect(sys.registeredIds).toContain("archetype_guard");
    expect(sys.registeredIds).toContain("archetype_bandit");
  });

  it("returns null for unknown archetype id", () => {
    const sys = new NpcArchetypeSystem();
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const npc = sys.spawnNpc("nonexistent", scene, new Vector3(0, 0, 0));
    expect(npc).toBeNull();
  });

  it("spawns an NPC with correct health from archetype", () => {
    const sys = new NpcArchetypeSystem();
    sys.registerArchetype(GUARD_ARCHETYPE);
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const npc = sys.spawnNpc("archetype_guard", scene, new Vector3(5, 0, 5));
    expect(npc).not.toBeNull();
    // Health is scaled: baseHealth × (1 + (level - 1) × 0.15)
    const expectedHealth = Math.round(120 * (1 + (3 - 1) * 0.15));
    expect(npc!.maxHealth).toBe(expectedHealth);
  });

  it("assigns factionId and isGuard for guard role", () => {
    const sys = new NpcArchetypeSystem();
    sys.registerArchetype(GUARD_ARCHETYPE);
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const npc = sys.spawnNpc("archetype_guard", scene, new Vector3(0, 0, 0));
    expect(npc!.factionId).toBe("village_guard");
    expect(npc!.isGuard).toBe(true);
  });

  it("sets isAggressive for hostile archetypes", () => {
    const sys = new NpcArchetypeSystem();
    sys.registerArchetype(BANDIT_ARCHETYPE);
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const npc = sys.spawnNpc("archetype_bandit", scene, new Vector3(0, 0, 0));
    expect(npc!.isAggressive).toBe(true);
  });

  it("assigns lootTableId from archetype", () => {
    const sys = new NpcArchetypeSystem();
    sys.registerArchetype(BANDIT_ARCHETYPE);
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const npc = sys.spawnNpc("archetype_bandit", scene, new Vector3(0, 0, 0));
    expect(npc!.lootTableId).toBe("bandit_loot");
  });

  it("scales health by level override", () => {
    const sys = new NpcArchetypeSystem();
    sys.registerArchetype(BANDIT_ARCHETYPE);
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const npcL1 = sys.spawnNpc("archetype_bandit", scene, new Vector3(0, 0, 0), 1);
    const npcL5 = sys.spawnNpc("archetype_bandit", scene, new Vector3(0, 0, 0), 5);
    expect(npcL5!.maxHealth).toBeGreaterThan(npcL1!.maxHealth);
  });

  it("boss archetype gets enhanced combat stats", () => {
    const sys = new NpcArchetypeSystem();
    sys.registerArchetype(BOSS_ARCHETYPE);
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const npc = sys.spawnNpc("archetype_boss", scene, new Vector3(0, 0, 0));
    expect(npc!.aggroRange).toBeGreaterThan(12);
    expect(npc!.attackDamage).toBeGreaterThan(5);
  });
});
