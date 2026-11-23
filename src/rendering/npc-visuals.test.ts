import { describe, it, expect, vi } from "vitest";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { AIState, type NPC } from "../entities/npc";
import type { AnimationSystem } from "../systems/animation-system";
import { NpcVisuals } from "./npc-visuals";

function npc(scene: Scene, name: string, x: number, extra: Partial<NPC> = {}): NPC {
  const mesh = MeshBuilder.CreateBox(name, {}, scene);
  mesh.position.set(x, 0, 0);
  return { mesh, aiState: AIState.IDLE, isDead: false, isAggressive: false, isAttackTelegraphing: false,
    isStaggered: false, isInDialogue: false, justTakenDamageVisual: false, ...extra } as unknown as NPC;
}

describe("NpcVisuals", () => {
  it("animates nearby NPCs, the dead and the just-hit; skips the far", () => {
    const scene = new Scene(new NullEngine());
    const anim = { updateNPCAnimation: vi.fn() };
    const v = new NpcVisuals({ scene, shadows: null, modelBase: "/", animation: () => anim as unknown as AnimationSystem });
    const near = npc(scene, "near", 10);
    const far = npc(scene, "far", 500);
    const farDead = npc(scene, "farDead", 500, { isDead: true });
    const farHit = npc(scene, "farHit", 500, { justTakenDamageVisual: true });
    v.update(0.016, Vector3.Zero(), [near, far, farDead, farHit]);
    const routed = anim.updateNPCAnimation.mock.calls.map((c) => (c[0] as { name: string }).name);
    expect(routed).toEqual(["near", "farDead", "farHit"]);
    expect(farHit.justTakenDamageVisual, "the hit flag is consumed").toBe(false);
  });

  it("a dragon's body turns toward the player when it fights, and goes with the dragon", () => {
    const scene = new Scene(new NullEngine());
    const v = new NpcVisuals({ scene, shadows: null, modelBase: "/", animation: () => undefined });
    const dragon = npc(scene, "DragonBoss_1_1", 0, { isAggressive: true });
    const body = MeshBuilder.CreateBox("body", {}, scene);
    v.addDragon(dragon, body, 0);
    for (let i = 0; i < 120; i++) v.update(1 / 60, new Vector3(10, 0, 0), [dragon]);
    // Facing +x is a yaw of π/2.
    const yaw = body.rotationQuaternion ? body.rotationQuaternion.toEulerAngles().y : body.rotation.y;
    expect(yaw).toBeCloseTo(Math.PI / 2, 1);
    dragon.mesh.dispose();
    expect(() => v.update(1 / 60, Vector3.Zero(), [])).not.toThrow();
  });
});
