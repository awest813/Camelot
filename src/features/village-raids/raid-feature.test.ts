import { describe, it, expect, vi } from "vitest";
import { Kernel } from "../../core/kernel";
import { ActorsKey, ClockKey, FeedbackKey, PlayerKey, VillagesKey } from "../services";
import { VillageRaidFeature, RaidsKey, RAID_LEAVE_DISTANCE } from "./raid-feature";
import { IndoorsKey } from "../indoors/indoors-feature";
import { planVillage, hasVillage } from "../../world/village-settlement";
import type { NPC } from "../../entities/npc";

function firstPlan() {
  for (let r = 3; r < 40; r++) for (let cx = -r; cx <= r; cx++) for (const cz of [-r, r]) {
    if (hasVillage(cx, cz, "plains")) return { chunkKey: `${cx},${cz}`, plan: planVillage(cx, cz, 50) };
  }
  throw new Error("no village");
}

let serial = 0;
function fakeNpc(name: string): NPC {
  let disposed = false;
  return {
    mesh: { name: `${name}_${++serial}`, isDisposed: () => disposed, dispose: () => { disposed = true; } },
    isDead: false, isInDialogue: false, factionId: null,
    scheduleBlocks: [], patrolPoints: [], currentPatrolIndex: 0, waitTime: 0,
  } as unknown as NPC;
}

function setup(opts: { level?: number } = {}) {
  const { chunkKey, plan } = firstPlan();
  const k = new Kernel({ seed: "raid-test" });
  const pos = { x: plan.center.x, z: plan.center.z };
  const townsfolk = [fakeNpc("Villager"), fakeNpc("Innkeeper"), fakeNpc("Town Guard")];
  const indoors = new Set<NPC>();
  const despawned: NPC[] = [];
  const notes: string[] = [];
  const grants: Array<{ gold?: number; label: string }> = [];
  let talkingTo: NPC | null = null;
  k.services.provide(ClockKey, { hour: () => 12, elapsedHours: () => 200 });
  k.services.provide(PlayerKey, { position: () => pos, level: () => opts.level ?? 6 });
  k.services.provide(FeedbackKey, {
    notify: (t) => { notes.push(t); },
    grant: (r) => { grants.push(r); },
    addFame: vi.fn(),
    markDirty: vi.fn(),
  });
  k.services.provide(VillagesKey, {
    currentVillage: () => ({ chunkKey, plan }),
    loadedVillage: (id) => (id === plan.id ? plan : null),
    planFor: () => plan, clearingAt: () => null, populate: () => false, loaded: () => new Map([[chunkKey, plan]]),
    innBoardOf: () => null,
  });
  k.services.provide(ActorsKey, {
    residents: () => townsfolk,
    byName: (n) => townsfolk.find((t) => t.mesh.name === n),
    all: () => townsfolk,
    spawnArchetype: (_c, archetype) => fakeNpc(archetype === "archetype_bandit_chief" ? "Bandit Chief" : "Bandit"),
    despawn: (npc) => { despawned.push(npc); (npc.mesh as any).dispose(); },
    isTalkingTo: (npc) => npc === talkingTo,
  });
  const holds = new Map<NPC, Set<string>>();
  k.services.provide(IndoorsKey, {
    send: (npc) => { indoors.add(npc); },
    isIndoors: (npc) => indoors.has(npc),
    hold: (npc, holder) => { indoors.add(npc); (holds.get(npc) ?? holds.set(npc, new Set()).get(npc)!).add(holder); },
    releaseHolds: (holder) => { for (const h of holds.values()) h.delete(holder); },
  });
  const feature = new VillageRaidFeature();
  k.install(feature);
  return {
    k, feature, plan, chunkKey, pos, townsfolk, indoors, holds, despawned, notes, grants,
    raids: k.services.get(RaidsKey),
    talkTo: (npc: NPC | null) => { talkingTo = npc; },
  };
}

describe("VillageRaidFeature (headless, through the kernel)", () => {
  it("an hourly roll can start a raid in the village the player is in", () => {
    const t = setup();
    let started = false;
    for (let h = 0; h < 200 && !started; h++) {
      t.k.events.emit("time:hour", { hour: 12, elapsedHours: 200 + h });
      started = !!t.raids.rules.active;
    }
    expect(started, "a raid starts within a couple of hundred hours").toBe(true);
    expect(t.notes.some((n) => n.includes("raiding"))).toBe(true);
  });

  it("townsfolk shelter (not guards, not the person you're talking to); killing every raider pays", () => {
    const t = setup({ level: 6 });
    t.talkTo(t.townsfolk[1]);
    const raiders = t.raids.start(t.chunkKey, t.plan);
    expect(raiders.length).toBe(4);
    expect(t.raids.isSheltered(t.townsfolk[0])).toBe(true);    // villager
    expect(t.raids.isSheltered(t.townsfolk[1])).toBe(false);   // talking
    expect(t.raids.isSheltered(t.townsfolk[2])).toBe(false);   // guard
    for (const r of raiders) t.k.events.emit("player:kill", { npcId: r.mesh.name, npcName: r.mesh.name, xp: 10 });
    expect(t.raids.rules.active).toBeNull();
    expect(t.grants[0]?.gold).toBe(35 * 4);
    expect(t.raids.isSheltered(t.townsfolk[0]), "townsfolk come out").toBe(false);
    expect(t.holds.get(t.townsfolk[0])?.has("raid"), "the raid's hold is released").toBe(false);
  });

  it("leaving the village abandons the raid and sends the raiders away", () => {
    const t = setup();
    const raiders = t.raids.start(t.chunkKey, t.plan);
    t.k.phases.run("sim", 1);
    expect(t.raids.rules.active, "still there while the player stays").not.toBeNull();
    t.pos.x += RAID_LEAVE_DISTANCE + 5;
    t.k.phases.run("sim", 1);
    expect(t.raids.rules.active).toBeNull();
    expect(t.despawned).toEqual(raiders);
    expect(t.notes.some((n) => n.includes("You left"))).toBe(true);
  });

  it("a save loaded mid-raid clears it; uninstalling the feature cleans up too", () => {
    const t = setup();
    t.raids.start(t.chunkKey, t.plan);
    t.k.events.emit("save:loaded", {});
    expect(t.raids.rules.active).toBeNull();
    expect(t.despawned.length).toBeGreaterThan(0);

    const u = setup();
    u.raids.start(u.chunkKey, u.plan);
    u.k.uninstall("village-raids");
    expect(u.despawned.length).toBeGreaterThan(0);
    expect(u.k.services.tryGet(RaidsKey)).toBeUndefined();
    expect(u.k.phases.has("village-raids.watch")).toBe(false);
  });

  it("released NPCs are forgotten", () => {
    const t = setup();
    const [first] = t.raids.start(t.chunkKey, t.plan);
    t.k.events.emit("npc:released", { npcName: t.townsfolk[0].mesh.name });
    expect(t.raids.isSheltered(t.townsfolk[0])).toBe(false);
    t.k.events.emit("npc:released", { npcName: first.mesh.name });
    t.k.events.emit("save:loaded", {});
    expect(t.despawned).not.toContain(first);
  });
});
