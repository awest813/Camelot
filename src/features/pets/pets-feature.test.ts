import { describe, it, expect, vi } from "vitest";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Kernel } from "../../core/kernel";
import { AIState, type NPC } from "../../entities/npc";
import { ActorsKey, AnimationKey, FeedbackKey, GameplayKey, ModalKey, PlayerKey } from "../services";
import { PetsFeature, PetsKey } from "./pets-feature";

/** Just what the companion looks at and hits. */
function actor(x: number, aiState: AIState): NPC {
  const npc = {
    isDead: false, isAggressive: false, aiState, health: 100, maxHealth: 100,
    mesh: { position: new Vector3(x, 0, 0) },
    takeDamage(n: number) { npc.health -= n; },
  };
  return npc as unknown as NPC;
}

function setup() {
  const scene = new Scene(new NullEngine());
  const k = new Kernel();
  const notes: string[] = [];
  const npcs: NPC[] = [];
  let canAct = true;
  const modal = { suspendGameplay: vi.fn(), restoreGameplay: vi.fn() };
  const anim = { idle: vi.fn(), walk: vi.fn(), run: vi.fn(), death: vi.fn(), release: vi.fn() };
  k.services.provide(FeedbackKey, { notify: (t) => { notes.push(t); }, grant: vi.fn(), addFame: vi.fn(), markDirty: vi.fn() });
  k.services.provide(ModalKey, modal);
  k.services.provide(AnimationKey, anim);
  k.services.provide(GameplayKey, { canAct: () => canAct });
  k.services.provide(PlayerKey, { position: () => ({ x: 0, y: 2, z: 0 }), level: () => 1 });
  k.services.provide(ActorsKey, {
    residents: () => [], spawnArchetype: () => null, despawn: vi.fn(), isTalkingTo: () => false,
    byName: () => undefined, all: () => npcs,
    hostiles: () => npcs.filter((n) => !n.isDead && (n.isAggressive || n.aiState === AIState.CHASE || n.aiState === AIState.ATTACK)),
  });
  const feature = new PetsFeature(scene);
  k.install(feature);
  const events: string[] = [];
  for (const e of ["pet:acquired", "pet:summoned", "pet:dismissed"] as const) k.events.on(e, () => events.push(e));
  return { k, scene, notes, npcs, modal, anim, events, pets: k.services.get(PetsKey), block: () => { canAct = false; } };
}

describe("PetsFeature (headless, through the kernel)", () => {
  it("P with no companion says so; with one it opens and closes the panel", () => {
    const t = setup();
    t.pets.togglePanel();
    expect(t.notes.at(-1)).toMatch(/no companions/);
    expect(t.pets.panel.isVisible).toBe(false);

    t.pets.pets.grantPet("pet_wolf");
    expect(t.notes.at(-1)).toMatch(/gained a companion: Wolf/);
    t.pets.togglePanel();
    expect(t.pets.panel.isVisible).toBe(true);
    expect(t.modal.suspendGameplay).toHaveBeenCalledOnce();
    t.pets.togglePanel();
    expect(t.pets.panel.isVisible).toBe(false);
    expect(t.modal.restoreGameplay).toHaveBeenCalled();
    t.k.uninstall("pets");
  });

  it("summoned, the companion bites a hostile in range and gains XP", () => {
    const t = setup();
    t.pets.pets.grantPet("pet_wolf");
    t.pets.panel.onSummon!("pet_wolf");
    expect(t.events).toEqual(["pet:acquired", "pet:summoned"]);
    const body = t.scene.getMeshByName("pet_pet_wolf");
    expect(body, "a body beside the player").toBeTruthy();
    expect(body!.position.x).toBe(2);

    const bandit = actor(3, AIState.CHASE);
    const bystander = actor(2.5, AIState.IDLE);
    t.npcs.push(bystander, bandit);
    const before = bandit.health;
    const xp = t.pets.pets.activePet!.experience;
    t.k.phases.run("sim", 0.1);
    expect(bandit.health).toBeLessThan(before);
    expect(bystander.health).toBe(bystander.maxHealth);
    expect(t.pets.pets.activePet!.experience).toBe(xp + 5);

    // Cooldown: no second bite straight away.
    const after = bandit.health;
    t.k.phases.run("sim", 0.1);
    expect(bandit.health).toBe(after);

    t.pets.panel.onDismiss!();
    expect(t.scene.getMeshByName("pet_pet_wolf")).toBeNull();
    t.k.uninstall("pets");
  });

  it("does not open the panel while gameplay is blocked", () => {
    const t = setup();
    t.pets.pets.grantPet("pet_wolf");
    t.block();
    t.pets.togglePanel();
    expect(t.pets.panel.isVisible).toBe(false);
    t.k.uninstall("pets");
  });
});
