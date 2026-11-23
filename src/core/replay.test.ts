import { describe, it, expect } from "vitest";
import { Kernel } from "./kernel";
import { ReplayRecorder, replay, verifyReplay, type ReplayLog } from "./replay";
import { ActorsKey, ClockKey, FeedbackKey, PlayerKey, VillagesKey } from "../features/services";
import { VillageRaidFeature, RaidsKey } from "../features/village-raids/raid-feature";
import { IndoorsKey } from "../features/indoors/indoors-feature";
import { planVillage, hasVillage } from "../world/village-settlement";
import type { NPC } from "../entities/npc";

function firstPlan() {
  for (let r = 3; r < 40; r++) for (let cx = -r; cx <= r; cx++) for (const cz of [-r, r]) {
    if (hasVillage(cx, cz, "plains")) return { chunkKey: `${cx},${cz}`, plan: planVillage(cx, cz, 50) };
  }
  throw new Error("no village");
}

/** A kernel with the raid feature and stand-in services; everything it records is observable. */
function build(seed: string) {
  const { chunkKey, plan } = firstPlan();
  const k = new Kernel({ seed });
  let serial = 0;
  const npc = (name: string): NPC => {
    const id = `${name}_${++serial}`;
    let disposed = false;
    return {
      key: id, displayName: id, mesh: { name: id, isDisposed: () => disposed, dispose: () => { disposed = true; } },
      isDead: false, isInDialogue: false, factionId: null, scheduleBlocks: [], patrolPoints: [], currentPatrolIndex: 0, waitTime: 0,
    } as unknown as NPC;
  };
  const townsfolk = [npc("Villager"), npc("Town Guard")];
  const log = { notes: [] as string[], grants: [] as number[], despawned: [] as string[], spawned: [] as string[] };
  k.services.provide(ClockKey, { hour: () => 12, elapsedHours: () => 0 });
  k.services.provide(PlayerKey, { position: () => ({ x: plan.center.x, z: plan.center.z }), level: () => 6 });
  k.services.provide(FeedbackKey, {
    notify: (t) => { log.notes.push(t); }, grant: (r) => { log.grants.push(r.gold ?? 0); }, addFame: () => {}, markDirty: () => {},
  });
  k.services.provide(VillagesKey, {
    currentVillage: () => ({ chunkKey, plan }), loadedVillage: (id) => (id === plan.id ? plan : null),
    planFor: () => plan, clearingAt: () => null, populate: () => false, loaded: () => new Map([[chunkKey, plan]]), innBoardOf: () => null,
  });
  k.services.provide(ActorsKey, {
    residents: () => townsfolk, byName: (n) => townsfolk.find((t) => t.key === n), all: () => townsfolk, hostiles: () => [],
    spawnArchetype: (_c, a) => {
      const raider = npc(a === "archetype_bandit_chief" ? "Bandit Chief" : "Bandit");
      log.spawned.push(raider.key);
      return raider;
    },
    despawn: (n) => { log.despawned.push(n.key); (n.mesh as unknown as { dispose(): void }).dispose(); },
    isTalkingTo: () => false,
  });
  k.services.provide(IndoorsKey, { send: () => {}, isIndoors: () => false, hold: () => {}, releaseHolds: () => {} });
  k.install(new VillageRaidFeature());
  return Object.assign(k, { log });
}
type Built = ReturnType<typeof build>;
const observe = (k: Built) => ({ ...k.log, raids: k.services.get(RaidsKey).rules.getSaveState() });

/** Play a session: hourly rolls; whenever raiders show up, the player cuts them all down. */
function record(seed: string): { log: ReplayLog; end: unknown; raids: number } {
  const k = build(seed);
  const rec = new ReplayRecorder(k, seed);
  let raids = 0, killed = 0;
  for (let h = 0; h < 400; h++) {
    rec.emit("time:hour", { hour: h % 24, elapsedHours: 200 + h });
    rec.run("sim", 1);
    if (!k.services.get(RaidsKey).rules.active) continue;
    raids++;
    // Cut down every raider that has turned up since the last fight.
    for (const name of k.log.spawned.slice(killed)) rec.emit("player:kill", { npcId: name, npcName: name, xp: 10 });
    killed = k.log.spawned.length;
    rec.run("sim", 1);
  }
  return { log: rec.log(), end: observe(k), raids };
}

describe("replays", () => {
  it("a recorded raid session replays to the same state on a fresh kernel (and survives JSON)", () => {
    const { log, end, raids } = record("replay-ci");
    expect(raids, "the session saw at least one raid").toBeGreaterThan(0);
    const wire = JSON.parse(JSON.stringify(log)) as ReplayLog;
    expect(verifyReplay(wire, build, observe, end)).toBeNull();
  });

  it("a different seed is a different session (the check can fail)", () => {
    const a = record("seed-a");
    const other = build("seed-b");
    replay(a.log, other);
    const sameSeed = verifyReplay(a.log, build, observe, a.end);
    expect(sameSeed).toBeNull();
    // Replaying the same inputs under another seed rolls differently.
    expect(a.raids).toBeGreaterThan(0);
    expect(JSON.stringify(observe(other)), "same inputs, other seed").not.toBe(JSON.stringify(a.end));
  });

  it("rejects logs it doesn't understand", () => {
    expect(() => replay({ version: 2, seed: "x", ops: [] } as unknown as ReplayLog, new Kernel())).toThrow(/version/);
  });
});
