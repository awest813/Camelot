import { describe, it, expect, vi, beforeEach } from "vitest";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

// Mocks so NPC constructor doesn't explode
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

import { NPC } from "../entities/npc";
import type { StatusEffect } from "../entities/npc";

describe("NPC status effects", () => {
  let engine: NullEngine;
  let scene: Scene;
  let npc: NPC;

  beforeEach(() => {
    engine = new NullEngine();
    scene = new Scene(engine);
    npc = new NPC(scene, new Vector3(0, 0, 0), "TestNPC");
    // Set health so we can detect damage
    npc.health = 100;
    npc.maxHealth = 100;
  });

  it("applyStatusEffect adds a new effect", () => {
    npc.applyStatusEffect({
      type: "burn",
      damagePerTick: 5,
      tickInterval: 1.0,
      tickTimer: 1.0,
      remainingDuration: 3.0,
    });
    expect(npc.statusEffects).toHaveLength(1);
    expect(npc.statusEffects[0].type).toBe("burn");
  });

  it("applyStatusEffect refreshes existing effect of same type", () => {
    const effect: StatusEffect = {
      type: "burn",
      damagePerTick: 5,
      tickInterval: 1.0,
      tickTimer: 1.0,
      remainingDuration: 3.0,
    };
    npc.applyStatusEffect(effect);
    npc.applyStatusEffect({ ...effect, remainingDuration: 6.0 });
    expect(npc.statusEffects).toHaveLength(1);
    expect(npc.statusEffects[0].remainingDuration).toBe(6.0);
  });

  it("applyStatusEffect stacks different effect types", () => {
    npc.applyStatusEffect({ type: "burn", damagePerTick: 5, tickInterval: 1, tickTimer: 1, remainingDuration: 3 });
    npc.applyStatusEffect({ type: "freeze", damagePerTick: 3, tickInterval: 1, tickTimer: 1, remainingDuration: 2 });
    expect(npc.statusEffects).toHaveLength(2);
  });

  it("tickStatusEffects deals damage when tick fires", () => {
    npc.applyStatusEffect({
      type: "burn",
      damagePerTick: 10,
      tickInterval: 1.0,
      tickTimer: 0.5, // fires in 0.5s
      remainingDuration: 5.0,
    });
    const dmg = npc.tickStatusEffects(0.6);
    expect(dmg).toBe(10);
    expect(npc.health).toBe(90);
  });

  it("tickStatusEffects removes expired effects", () => {
    npc.applyStatusEffect({
      type: "burn",
      damagePerTick: 5,
      tickInterval: 1.0,
      tickTimer: 10.0, // won't tick in this call
      remainingDuration: 0.3, // expires very quickly
    });
    npc.tickStatusEffects(0.5); // advance past expiry
    expect(npc.statusEffects).toHaveLength(0);
  });

  it("tickStatusEffects returns 0 on dead NPC", () => {
    npc.applyStatusEffect({ type: "burn", damagePerTick: 10, tickInterval: 1, tickTimer: 0, remainingDuration: 5 });
    npc.isDead = true;
    const dmg = npc.tickStatusEffects(1.0);
    expect(dmg).toBe(0);
  });

  it("NPC faction fields default to null", () => {
    expect(npc.factionId).toBeNull();
    expect(npc.lootTableId).toBeNull();
    expect(npc.isGuard).toBe(false);
  });

  it("NPC schedule fields default correctly", () => {
    expect(npc.scheduleBlocks).toHaveLength(0);
    expect(npc.homePosition).toBeNull();
    expect(npc.workPosition).toBeNull();
  });
});
