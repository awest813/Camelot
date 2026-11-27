import { describe, it, expect, vi } from "vitest";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Kernel } from "../../core/kernel";
import type { NPC } from "../../entities/npc";
import { FeedbackKey, GameplayKey, ModalKey } from "../services";
import { ShoutsFeature, ShoutsKey, ShoutHostKey } from "./shouts-feature";

/** Just what a shout looks at and changes. */
function actor(x: number, z: number) {
  const npc = {
    isDead: false, health: 100, isStaggered: false, isAttackTelegraphing: true, attackTelegraphTimer: 1,
    staggerTimer: 0, statuses: [] as string[],
    mesh: { position: new Vector3(x, 0, z), name: `npc_${x}_${z}` },
    applyStatusEffect(e: { type: string }) { npc.statuses.push(e.type); },
  };
  return npc;
}

function setup() {
  const k = new Kernel();
  const notes: string[] = [];
  const hits: Array<[string, number, string]> = [];
  const npcs = [actor(0, 5), actor(0, -5), actor(0, 30)]; // ahead, behind, out of reach
  let speed = 1;
  let minutes = 0;
  const modal = { suspendGameplay: vi.fn(), restoreGameplay: vi.fn() };
  k.services.provide(FeedbackKey, { notify: (t) => { notes.push(t); }, grant: vi.fn(), addFame: vi.fn(), markDirty: vi.fn() });
  k.services.provide(ModalKey, modal);
  k.services.provide(GameplayKey, { canAct: () => true });
  k.services.provide(ShoutHostKey, {
    gameTime: () => minutes,
    stance: () => ({ origin: new Vector3(0, 1.7, 0), forward: new Vector3(0, 0, 1) }),
    targets: () => npcs as unknown as NPC[],
    dash: vi.fn(),
    addEffect: vi.fn(),
    damage: (npc, raw, type) => { hits.push([npc.mesh.name, raw, type]); },
    setAttackSpeedMultiplier: (m) => { speed = m; },
    clearWeather: vi.fn(),
  });
  k.install(new ShoutsFeature());
  const svc = k.services.get(ShoutsKey);
  return { k, notes, hits, npcs, modal, svc, speed: () => speed, later: (m: number) => { minutes += m; } };
}

/** Learn and unlock the first word of a shout, then equip it. */
function ready(t: ReturnType<typeof setup>, shoutId: string) {
  t.svc.shouts.learnWord(shoutId, 0);
  t.svc.shouts.gainAwen();
  expect(t.svc.shouts.unlockWord(shoutId, 0)).toBe(true);
  t.svc.panel.onEquip!(shoutId);
}

describe("ShoutsFeature (headless, through the kernel)", () => {
  it("without a shout, Shift+N says what to do; a slain dragon teaches a word", () => {
    const t = setup();
    t.svc.use();
    expect(t.notes.at(-1)).toMatch(/No word is ready/);
    t.svc.greatDeed();
    expect(t.svc.shouts.awen).toBe(1);
    expect(t.notes.some((n) => n.startsWith("A word of the Old Tongue: GWYNT"))).toBe(true);
    t.k.uninstall("shouts");
  });

  it("finding an obelisk (an old place) teaches the next rank, without awen", () => {
    const t = setup();
    t.k.events.emit("location:discovered", { id: "village_3_4", name: "Millbrook" });
    expect(t.svc.shouts.isWordLearned("gust", 0)).toBe(false);
    t.k.events.emit("location:discovered", { id: "site_obelisk_1_2", name: "Ashford Obelisk" });
    expect(t.svc.shouts.isWordLearned("gust", 0)).toBe(true);
    expect(t.svc.shouts.awen).toBe(0);
    t.k.uninstall("shouts");
  });

  it("clearing a bandit camp is a great deed (awen); a roost pays through its dragon", () => {
    const t = setup();
    t.k.events.emit("landmark:cleared", { id: "site_dragon_1_1", name: "Roost" });
    expect(t.svc.shouts.awen).toBe(0);
    t.k.events.emit("landmark:cleared", { id: "site_bandit-camp_1_1", name: "Camp" });
    expect(t.svc.shouts.awen).toBe(1);
    t.k.uninstall("shouts");
  });

  it("each shout reaches only what the player faces", () => {
    const ids = setup().svc.shouts.getAllShouts().map((d) => d.id);
    expect(ids.length).toBeGreaterThan(0);
    let reachedAhead = 0;
    for (const id of ids) {
      const t = setup();
      ready(t, id);
      t.svc.use();
      expect(t.notes.some((n) => n.startsWith("\"")), `${id} was shouted`).toBe(true);
      const touched = new Set([...t.hits.map((h) => h[0]), ...t.npcs.filter((n) => n.isStaggered || n.statuses.length).map((n) => n.mesh.name)]);
      expect(touched.has("npc_0_-5"), `${id} must not reach behind`).toBe(false);
      expect(touched.has("npc_0_30"), `${id} must not reach 30 m`).toBe(false);
      if (touched.has("npc_0_5")) reachedAhead++;
      t.k.uninstall("shouts");
    }
    expect(reachedAhead, "shouts hit what is in front").toBeGreaterThan(0);
  });

  it("Held Moment and Battle-wind wear off on the sim clock", () => {
    const t = setup();
    const all = t.svc.shouts.getAllShouts();
    const slow = all.find((d) => d.tiers.some((x) => x?.effects.time_scale));
    const fury = all.find((d) => d.tiers.some((x) => x?.effects.attack_speed_mult));
    if (slow) {
      ready(t, slow.id);
      t.svc.use();
      expect(t.svc.hostileTimeScale()).toBeLessThan(1);
      for (let i = 0; i < 600; i++) t.k.phases.run("sim", 0.1);
      expect(t.svc.hostileTimeScale()).toBe(1);
      expect(t.notes).toContain("Time resumes its flow.");
    }
    if (fury) {
      const f = setup();
      ready(f, fury.id);
      f.svc.use();
      expect(f.speed()).toBeGreaterThan(1);
      for (let i = 0; i < 600; i++) f.k.phases.run("sim", 0.1);
      expect(f.speed()).toBe(1);
      f.k.uninstall("shouts");
    }
    expect(slow ?? fury, "a timed shout exists").toBeTruthy();
    t.k.uninstall("shouts");
  });

  it("N opens and closes the panel", () => {
    const t = setup();
    t.svc.togglePanel();
    expect(t.svc.panel.isVisible).toBe(true);
    t.svc.togglePanel();
    expect(t.svc.panel.isVisible).toBe(false);
    expect(t.modal.restoreGameplay).toHaveBeenCalled();
    t.k.uninstall("shouts");
  });
});
