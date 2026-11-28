import { describe, it, expect, vi } from "vitest";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Kernel } from "../../core/kernel";
import { AIState, type NPC } from "../../entities/npc";
import { ActorsKey, AnimationKey, FeedbackKey, FlagsKey, GameplayKey, ModalKey, PlayerKey } from "../services";
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
  const flags = new Map<string, boolean>([["bought_kitten", true]]);
  k.services.provide(FlagsKey, { get: (f) => flags.get(f) ?? false, set: (f, v) => { flags.set(f, v); } });
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
  return { k, scene, notes, npcs, modal, anim, events, flags, pets: k.services.get(PetsKey), block: () => { canAct = false; } };
}

describe("PetsFeature (headless, through the kernel)", () => {
  it("P with no companion says so; with one it opens and closes the panel", async () => {
    const t = setup();
    t.pets.togglePanel();
    expect(t.notes.at(-1)).toMatch(/no companions/);
    expect(t.pets.panel.isVisible).toBe(false);

    t.pets.pets.grantPet("pet_wolf");
    expect(t.notes.at(-1)).toMatch(/gained a companion: Wolf/);
    t.pets.togglePanel();
    await t.pets.panel.get();
    await new Promise((r) => setTimeout(r, 0));
    expect(t.pets.panel.isVisible).toBe(true);
    expect(t.modal.suspendGameplay).toHaveBeenCalledOnce();
    t.pets.togglePanel();
    expect(t.pets.panel.isVisible).toBe(false);
    expect(t.modal.restoreGameplay).toHaveBeenCalled();
    t.k.uninstall("pets");
  });

  it("summoned, the companion bites a hostile in range and gains XP", async () => {
    const t = setup();
    t.pets.pets.grantPet("pet_wolf");
    (await t.pets.panel.get()).onSummon!("pet_wolf");
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

    (await t.pets.panel.get()).onDismiss!();
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

  it("a kitten bought in conversation joins the roster; a foe beside a companion wounds it", () => {
    const t = setup();
    t.k.events.emit("dialogue:action", { eventId: "pets:grant", npcName: "Barkeeper", payload: { petId: "pet_cat" } });
    expect(t.pets.pets.pets.map((p) => p.id)).toContain("pet_cat");
    t.pets.pets.summonPet("pet_cat");
    const hp = t.pets.pets.activePet!.health;
    const mesh = t.scene.getMeshByName("pet_pet_cat")!;
    const foe = actor(mesh.position.x + 1, AIState.ATTACK);
    (foe as unknown as { attackDamage: number }).attackDamage = 7;
    t.npcs.push(foe);
    for (let i = 0; i < 3; i++) t.k.phases.run("sim", 1);
    expect(t.pets.pets.activePet!.health).toBeLessThan(hp);
    t.k.uninstall("pets");
  });

  it("a bought kitten that falls can be bought again: its seller's offer comes back", () => {
    const t = setup();
    t.k.events.emit("dialogue:action", { eventId: "pets:grant", npcName: "Barkeeper", payload: { petId: "pet_cat", purchaseFlag: "bought_kitten" } });
    t.pets.pets.summonPet("pet_cat");
    t.pets.pets.petTakeDamage(10_000);
    expect(t.pets.pets.pets[0].isDead).toBe(true);
    expect(t.flags.get("bought_kitten"), "the barkeeper offers another").toBe(false);
    expect(t.notes.some((n) => /seller may have another/.test(n))).toBe(true);
    t.k.events.emit("dialogue:action", { eventId: "pets:grant", npcName: "Barkeeper", payload: { petId: "pet_cat", purchaseFlag: "bought_kitten" } });
    expect(t.pets.pets.pets[0].isDead, "a new kitten").toBe(false);
    t.k.uninstall("pets");
  });

  it("Call the Familiar: a spirit wolf bites the nearest foe, then fades", () => {
    const t = setup();
    t.k.events.emit("spell:cast", { spellId: "call_familiar", spellName: "Call the Familiar", magickaCost: 50, effect: "familiar", magnitude: 0, duration: 5 });
    const wolf = t.scene.getMeshByName("familiar_wolf")!;
    expect(wolf).toBeTruthy();
    const foe = actor(wolf.position.x + 1, AIState.ATTACK);
    t.npcs.push(foe);
    t.k.phases.run("sim", 0.1);
    expect(foe.health).toBeLessThan(100);
    for (let i = 0; i < 6; i++) t.k.phases.run("sim", 1);
    expect(t.scene.getMeshByName("familiar_wolf")).toBeNull();
    t.k.uninstall("pets");
  });
});
