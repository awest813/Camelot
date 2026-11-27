import { describe, it, expect, vi } from "vitest";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Kernel } from "../../core/kernel";
import type { NPC } from "../../entities/npc";
import { ActorsKey, AnimationKey, FeedbackKey, GameplayKey, ModalKey, PlayerKey, PurseKey } from "../services";
import { FollowersFeature, FollowersKey } from "./followers-feature";

function hostile(x: number, z: number, attackDamage = 6) {
  const npc = { mesh: { position: new Vector3(x, 1, z) }, health: 50, isDead: false, attackDamage, takeDamage(n: number) { npc.health -= n; } };
  return npc as unknown as NPC & { health: number };
}

function setup(gold = 600, scene: Scene | null = null) {
  const k = new Kernel();
  const notes: string[] = [];
  let purse = gold;
  let canAct = true;
  const hostiles: NPC[] = [];
  const player = { x: 0, y: 2, z: 0 };
  const modal = { suspendGameplay: vi.fn(), restoreGameplay: vi.fn() };
  k.services.provide(FeedbackKey, { notify: (t) => { notes.push(t); }, grant: vi.fn(), addFame: vi.fn(), markDirty: vi.fn() });
  k.services.provide(ModalKey, modal);
  k.services.provide(GameplayKey, { canAct: () => canAct });
  k.services.provide(PurseKey, {
    gold: () => purse,
    spend: (n) => { if (purse < n) return false; purse -= n; return true; },
  });
  k.services.provide(PlayerKey, { position: () => player, level: () => 1 });
  k.services.provide(AnimationKey, { idle: vi.fn(), walk: vi.fn(), run: vi.fn(), death: vi.fn(), release: vi.fn() });
  k.services.provide(ActorsKey, {
    residents: () => [], spawnArchetype: () => null, despawn: vi.fn(), isTalkingTo: () => false,
    byName: () => undefined, all: () => hostiles, hostiles: () => hostiles,
  });
  const feature = new FollowersFeature(scene);
  k.install(feature);
  /** Ask the innkeeper: the panel opens with Recruit live once the talk ends. */
  const askInnkeeper = () => {
    k.events.emit("dialogue:action", { eventId: "followers:hire", npcName: "Innkeeper" });
    k.events.emit("dialogue:closed", {} as never);
  };
  return { k, feature, notes, modal, hostiles, player, askInnkeeper, f: k.services.get(FollowersKey), gold: () => purse, block: () => { canAct = false; } };
}

describe("FollowersFeature (headless, through the kernel)", () => {
  it("asking an innkeeper opens the hiring panel; hiring costs gold; orders and dismissal notify", () => {
    const t = setup(600);
    t.askInnkeeper();
    expect(t.f.panel.isVisible).toBe(true);
    expect(t.modal.suspendGameplay).toHaveBeenCalledOnce();

    t.f.panel.onRecruit!("dagonet");
    expect(t.gold()).toBe(100);
    expect(t.f.followers.getActiveFollower()?.name).toBe("Sir Dagonet");
    expect(t.notes.at(-1)).toBe("Sir Dagonet has joined you.");

    t.f.panel.onCommand!("wait");
    expect(t.notes.at(-1)).toBe("Follower command: wait");
    t.f.panel.onDismiss!();
    expect(t.f.followers.getActiveFollower()).toBeNull();
    expect(t.notes.at(-1)).toMatch(/^Sir Dagonet has returned to /);

    t.f.togglePanel();
    expect(t.f.panel.isVisible).toBe(false);
    expect(t.modal.restoreGameplay).toHaveBeenCalled();
    t.k.uninstall("followers");
  });

  it("G away from an inn manages the follower but hires no one", () => {
    const t = setup(600);
    t.f.togglePanel();
    expect(t.f.panel.isVisible).toBe(true);
    t.f.panel.onRecruit!("dagonet");
    expect(t.f.followers.getActiveFollower()).toBeNull();
    expect(t.gold()).toBe(600);
    t.k.uninstall("followers");
  });

  it("a hire the purse can't cover takes nothing", () => {
    const t = setup(100);
    t.askInnkeeper();
    t.f.panel.onRecruit!("dagonet");
    expect(t.gold()).toBe(100);
    expect(t.f.followers.getActiveFollower()).toBeNull();
    t.k.uninstall("followers");
  });

  it("does not open while gameplay is blocked", () => {
    const t = setup();
    t.block();
    t.f.togglePanel();
    expect(t.f.panel.isVisible).toBe(false);
    t.k.uninstall("followers");
  });

  it("a hired follower has a body that strikes nearby hostiles and can be struck down", () => {
    const scene = new Scene(new NullEngine());
    const t = setup(5000, scene);
    t.askInnkeeper();
    t.f.panel.onRecruit!("kay");
    const body = t.feature.body!;
    expect(body, "spawned beside the player").not.toBeNull();
    expect(scene.getMeshByName("follower_kay")).toBe(body.mesh);

    const foe = hostile(body.position.x + 1, body.position.z, 9999);
    t.hostiles.push(foe);
    t.k.phases.run("sim", 0.1);
    expect(foe.health).toBeLessThan(50);
    // Keep fighting until the follower falls.
    for (let i = 0; i < 40 && t.f.followers.getActiveFollower()?.isAlive; i++) t.k.phases.run("sim", 1);
    expect(t.notes.some((n) => /fallen in battle/.test(n))).toBe(true);
    expect(t.feature.body).toBeNull();
    t.k.uninstall("followers");
    scene.dispose();
  });

  it("a follower left far behind catches up; dismissing removes the body", () => {
    const scene = new Scene(new NullEngine());
    const t = setup(5000, scene);
    t.askInnkeeper();
    t.f.panel.onRecruit!("kay");
    t.player.x = 500;
    t.k.phases.run("sim", 0.1);
    expect(t.feature.body!.position.x).toBeGreaterThan(400);
    t.f.panel.onDismiss!();
    expect(t.feature.body).toBeNull();
    expect(scene.getMeshByName("follower_kay")).toBeNull();
    t.k.uninstall("followers");
    scene.dispose();
  });
});
