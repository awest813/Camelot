import { describe, it, expect, vi } from "vitest";
import { NpcArchetypeSystem } from "./npc-archetype-system";
import { NpcScheduleSystem } from "./npc-schedule-system";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { NpcArchetypeDefinition } from "../framework/content/content-types";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";

// Minimal mesh and physics mocks — NPC constructor needs these to not throw.
// Includes the extra shapes added by fantasy-prop visual accessories.
vi.mock("@babylonjs/core/Meshes/meshBuilder", () => {
  const mesh = () => ({
    position: { set: vi.fn(), x: 0, y: 0, z: 0 },
    rotation: { y: 0, z: 0 },
    scaling: { setAll: vi.fn(), y: 1 },
    material: null,
    receiveShadows: false,
    isVisible: true,
    isDisposed: vi.fn(() => false),
    lookAt: vi.fn(),
    metadata: null,
    parent: null,
    getChildMeshes: vi.fn(() => []),
  });
  return {
    MeshBuilder: {
      CreateCapsule: vi.fn(mesh),
      CreateBox:     vi.fn(mesh),
      CreateSphere:  vi.fn(mesh),
      CreateCylinder: vi.fn(mesh),
      CreateTorus:   vi.fn(mesh),
    },
  };
});
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

const ROAD_BANDIT_ARCHETYPE: NpcArchetypeDefinition = {
  id: "archetype_road_bandit",
  name: "Road Bandit",
  role: "bandit",
  factionId: "outlaws",
  isHostile: true,
  isMerchant: false,
  baseHealth: 90,
  level: 2,
};

const HEALER_ARCHETYPE: NpcArchetypeDefinition = {
  id: "archetype_healer",
  name: "Village Healer",
  role: "healer",
  factionId: "",
  isHostile: false,
  isMerchant: false,
  baseHealth: 80,
  level: 2,
};

const TRAINER_ARCHETYPE: NpcArchetypeDefinition = {
  id: "archetype_trainer",
  name: "Skill Trainer",
  role: "trainer",
  factionId: "",
  isHostile: false,
  isMerchant: false,
  baseHealth: 100,
  level: 4,
};

const OVERRIDDEN_ARCHETYPE: NpcArchetypeDefinition = {
  id: "archetype_overridden",
  name: "Overridden NPC",
  role: "enemy",
  factionId: "",
  isHostile: true,
  isMerchant: false,
  baseHealth: 100,
  level: 3,
  aiProfile: {
    aggroRange: 25,
    attackDamage: 30,
    attackCooldown: 0.8,
    moveSpeed: 4,
    fleesBelowHealthPct: 0.2,
  },
  voiceType: "male_warrior",
  personalityTraits: ["brave", "aggressive"],
  startingEquipment: ["sword_iron", "shield_wood"],
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

  it("bandit role gets enhanced aggro and damage", () => {
    const sys = new NpcArchetypeSystem();
    sys.registerArchetype(ROAD_BANDIT_ARCHETYPE);
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const npc = sys.spawnNpc("archetype_road_bandit", scene, new Vector3(0, 0, 0));
    expect(npc!.aggroRange).toBe(13);
    expect(npc!.attackDamage).toBe(8);
  });

  it("healer role gets reduced aggro range", () => {
    const sys = new NpcArchetypeSystem();
    sys.registerArchetype(HEALER_ARCHETYPE);
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const npc = sys.spawnNpc("archetype_healer", scene, new Vector3(0, 0, 0));
    expect(npc!.aggroRange).toBe(8);
  });

  it("trainer role gets reduced aggro range", () => {
    const sys = new NpcArchetypeSystem();
    sys.registerArchetype(TRAINER_ARCHETYPE);
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const npc = sys.spawnNpc("archetype_trainer", scene, new Vector3(0, 0, 0));
    expect(npc!.aggroRange).toBe(8);
  });

  it("aiProfile overrides are applied after role defaults", () => {
    const sys = new NpcArchetypeSystem();
    sys.registerArchetype(OVERRIDDEN_ARCHETYPE);
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const npc = sys.spawnNpc("archetype_overridden", scene, new Vector3(0, 0, 0));
    expect(npc!.aggroRange).toBe(25);
    expect(npc!.attackDamage).toBe(30);
    expect(npc!.attackCooldown).toBe(0.8);
    expect(npc!.moveSpeed).toBe(4);
    expect(npc!.fleesBelowHealthPct).toBe(0.2);
  });

  it("startingEquipment is stored on spawned NPC", () => {
    const sys = new NpcArchetypeSystem();
    sys.registerArchetype(OVERRIDDEN_ARCHETYPE);
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const npc = sys.spawnNpc("archetype_overridden", scene, new Vector3(0, 0, 0));
    expect(npc!.startingEquipmentIds).toContain("sword_iron");
    expect(npc!.startingEquipmentIds).toContain("shield_wood");
  });

  it("voiceType is set on spawned NPC", () => {
    const sys = new NpcArchetypeSystem();
    sys.registerArchetype(OVERRIDDEN_ARCHETYPE);
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const npc = sys.spawnNpc("archetype_overridden", scene, new Vector3(0, 0, 0));
    expect(npc!.voiceType).toBe("male_warrior");
  });

  it("personalityTraits are set on spawned NPC", () => {
    const sys = new NpcArchetypeSystem();
    sys.registerArchetype(OVERRIDDEN_ARCHETYPE);
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const npc = sys.spawnNpc("archetype_overridden", scene, new Vector3(0, 0, 0));
    expect(npc!.personalityTraits).toContain("brave");
    expect(npc!.personalityTraits).toContain("aggressive");
  });

  it("NPC defaults to neutral voiceType when archetype has none", () => {
    const sys = new NpcArchetypeSystem();
    sys.registerArchetype(GUARD_ARCHETYPE);
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const npc = sys.spawnNpc("archetype_guard", scene, new Vector3(0, 0, 0));
    expect(npc!.voiceType).toBe("neutral");
  });

  it("NPC defaults to empty personalityTraits when archetype has none", () => {
    const sys = new NpcArchetypeSystem();
    sys.registerArchetype(GUARD_ARCHETYPE);
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const npc = sys.spawnNpc("archetype_guard", scene, new Vector3(0, 0, 0));
    expect(npc!.personalityTraits).toHaveLength(0);
  });

  it("NPC defaults to empty startingEquipmentIds when archetype has none", () => {
    const sys = new NpcArchetypeSystem();
    sys.registerArchetype(GUARD_ARCHETYPE);
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const npc = sys.spawnNpc("archetype_guard", scene, new Vector3(0, 0, 0));
    expect(npc!.startingEquipmentIds).toHaveLength(0);
  });
});

describe("NpcArchetypeSystem — scheduleSystem wiring", () => {
  it("scheduleSystem defaults to null", () => {
    const sys = new NpcArchetypeSystem();
    expect(sys.scheduleSystem).toBeNull();
  });

  it("applies scheduleBlocks when scheduleSystem is set and archetype has a scheduleId", () => {
    const archSys = new NpcArchetypeSystem();
    const schedSys = new NpcScheduleSystem(false);
    schedSys.registerSchedule({
      id: "sched_guard",
      blocks: [
        { startHour: 6, endHour: 22, behavior: "patrol" },
        { startHour: 22, endHour: 6, behavior: "sleep"  },
      ],
    });
    archSys.scheduleSystem = schedSys;

    const archetypeWithSchedule: NpcArchetypeDefinition = {
      id: "arch_guard_sched",
      name: "Scheduled Guard",
      role: "guard",
      factionId: "guards",
      isHostile: false,
      isMerchant: false,
      baseHealth: 100,
      level: 1,
      scheduleId: "sched_guard",
    };
    archSys.registerArchetype(archetypeWithSchedule);

    const engine = new NullEngine();
    const scene = new Scene(engine);
    const npc = archSys.spawnNpc("arch_guard_sched", scene, new Vector3(0, 0, 0));
    expect(npc).not.toBeNull();
    expect(npc!.scheduleBlocks).toHaveLength(2);
    expect(npc!.scheduleBlocks[0].behavior).toBe("patrol");
    expect(npc!.scheduleBlocks[1].behavior).toBe("sleep");
  });

  it("leaves scheduleBlocks empty when no scheduleSystem is attached", () => {
    const archSys = new NpcArchetypeSystem();
    // No scheduleSystem attached

    const archetypeWithScheduleId: NpcArchetypeDefinition = {
      id: "arch_no_sched_sys",
      name: "Guard",
      role: "guard",
      factionId: "",
      isHostile: false,
      isMerchant: false,
      baseHealth: 100,
      level: 1,
      scheduleId: "sched_guard",
    };
    archSys.registerArchetype(archetypeWithScheduleId);

    const engine = new NullEngine();
    const scene = new Scene(engine);
    const npc = archSys.spawnNpc("arch_no_sched_sys", scene, new Vector3(0, 0, 0));
    expect(npc).not.toBeNull();
    expect(npc!.scheduleBlocks).toHaveLength(0);
  });

  it("leaves scheduleBlocks empty when archetype has no scheduleId", () => {
    const archSys = new NpcArchetypeSystem();
    archSys.scheduleSystem = new NpcScheduleSystem(); // built-ins registered

    // Archetype without scheduleId
    archSys.registerArchetype(GUARD_ARCHETYPE);

    const engine = new NullEngine();
    const scene = new Scene(engine);
    const npc = archSys.spawnNpc("archetype_guard", scene, new Vector3(0, 0, 0));
    expect(npc).not.toBeNull();
    expect(npc!.scheduleBlocks).toHaveLength(0);
  });
});
