import { describe, expect, it, vi } from "vitest";
import { Kernel } from "../../core/kernel";
import { ClockKey, FastTravelKey, FeedbackKey, LandmarksKey, PlayerKey, SavesKey, WorldInfoKey } from "../services";
import { buildWildChunk } from "../../world/site-specs";
import { WILD_SCATTER, WILD_SITES } from "../../content/sites";
import type { SaveCodec } from "../../systems/save-system";
import type { PlacedLandmark } from "../../world/site-specs";
import { LandmarksFeature, QUIET_HOURS } from "./landmarks-feature";

const GRAVES: PlacedLandmark = {
  id: "site_graveyard_3_4", name: "Crowmere Graveyard", kind: "Graveyard", xp: 15, radius: 18,
  x: 150, z: 200, arrive: { x: 150, z: 212 },
};

function setup() {
  const k = new Kernel();
  const pos = { x: 0, z: 0 };
  const discovered = new Map<string, { name: string; at: { x: number; z: number } }>();
  const grants: Array<{ xp?: number; gold?: number; label: string }> = [];
  const codecs: SaveCodec[] = [];
  k.services.provide(SavesKey, { register: (c) => { codecs.push(c); return () => {}; } });
  const found: string[] = [];
  const cleared: string[] = [];
  k.events.on("landmark:cleared", ({ name }) => cleared.push(name));
  k.services.provide(PlayerKey, { position: () => pos, level: () => 1 });
  k.services.provide(FeedbackKey, { notify: vi.fn(), grant: (r) => { grants.push(r); }, addFame: vi.fn(), markDirty: vi.fn() });
  k.services.provide(FastTravelKey, {
    isDiscovered: (id) => discovered.has(id),
    discover: (id, name, at) => { const isNew = !discovered.has(id); discovered.set(id, { name, at }); return isNew; },
  });
  k.events.on("location:discovered", ({ name }) => found.push(name));
  const clock = { hours: 0 };
  k.services.provide(ClockKey, { hour: () => clock.hours % 24, elapsedHours: () => clock.hours });
  const feature = new LandmarksFeature();
  k.install(feature);
  const step = (seconds: number) => { for (let t = 0; t < seconds; t += 0.1) k.phases.run("sim", 0.1); };
  return {
    k, pos, discovered, grants, found, cleared, feature, step, codec: () => codecs.find((c) => c.key === "landmarks")!,
    get hours() { return clock.hours; }, set hours(h: number) { clock.hours = h; },
  };
}

describe("LandmarksFeature (headless, through the kernel)", () => {
  it("walking near a landmark discovers it once, for its experience", () => {
    const t = setup();
    t.k.services.get(LandmarksKey).placed("3,4", [GRAVES]);
    t.step(1);
    expect(t.discovered.size, "too far away").toBe(0);
    t.pos.x = 150; t.pos.z = 185; // 15 m off
    t.step(1);
    expect(t.discovered.get(GRAVES.id)).toEqual({ name: "Crowmere Graveyard", at: { x: 150, y: 2, z: 212 } });
    expect(t.grants).toEqual([{ xp: 15, label: "Discovered: Crowmere Graveyard" }]);
    expect(t.found).toEqual(["Crowmere Graveyard"]);
    t.step(3);
    expect(t.grants, "once only").toHaveLength(1);
  });

  it("forgets a chunk's landmarks when it unloads", () => {
    const t = setup();
    t.k.services.get(LandmarksKey).placed("3,4", [GRAVES]);
    expect(t.feature.loaded()).toHaveLength(1);
    t.k.events.emit("chunk:unloaded", { chunkKey: "3,4" });
    expect(t.feature.loaded()).toHaveLength(0);
    t.pos.x = 150; t.pos.z = 200;
    t.step(1);
    expect(t.discovered.size).toBe(0);
  });

  it("a camp is cleared when everyone it spawned falls: paid the first time, empty for three days", () => {
    const t = setup();
    const chief = { name: "chief" }, archer = { name: "archer" }, stranger = { name: "wolf" };
    const camp: PlacedLandmark = {
      id: "site_bandit-camp_5_5", name: "Ravenwick Bandit Camp", kind: "Bandit Camp", xp: 25, radius: 22,
      x: 0, z: 500, arrive: { x: 0, z: 512 }, clear: { xp: 60, gold: 75, foes: [chief, archer] },
    };
    const kill = (npc: object) => t.k.events.emit("npc:killed", { npcName: "x", xp: 0, npc } as never);
    const lm = t.k.services.get(LandmarksKey);
    t.hours = 10;
    lm.placed("0,10", [camp]);
    kill(stranger);
    kill(chief);
    expect(t.cleared, "the archer still stands").toEqual([]);
    kill(archer);
    expect(t.cleared).toEqual(["Ravenwick Bandit Camp"]);
    expect(t.grants.at(-1)).toEqual({ xp: 60, gold: 75, label: "Cleared: Ravenwick Bandit Camp" });
    expect(lm.quiet!(camp.id), "it loads empty for a while").toBe(true);
    t.hours = 10 + QUIET_HOURS - 1;
    expect(lm.isCleared!(camp.id)).toBe(true);
    t.hours = 10 + QUIET_HOURS;
    expect(lm.quiet!(camp.id), "three days on, it fills again").toBe(false);

    // Filled again and cleared again: it counts (a job may want it), no second reward.
    t.k.events.emit("chunk:unloaded", { chunkKey: "0,10" });
    const chief2 = {}, archer2 = {};
    lm.placed("0,10", [{ ...camp, clear: { xp: 60, gold: 75, foes: [chief2, archer2] } }]);
    kill(chief2); kill(archer2);
    expect(t.cleared).toHaveLength(2);
    expect(t.grants).toHaveLength(1);
    expect(lm.quiet!(camp.id), "quiet again from the second clearing").toBe(true);

    // Saved with when it was cleared, and back after a load.
    const saved = t.codec().save();
    expect(saved).toEqual({ cleared: { [camp.id]: 10 + QUIET_HOURS }, looted: {} });
    const u = setup();
    u.hours = 10 + QUIET_HOURS + 5;
    u.codec().load(saved);
    expect(u.feature.isCleared(camp.id)).toBe(true);
    u.codec().load({ cleared: [camp.id] });
    expect(u.feature.isCleared(camp.id), "a list from the first saves: long quiet").toBe(false);
    u.codec().load(undefined);
    expect(u.feature.isCleared(camp.id)).toBe(false);
  });

  it("finds the nearest camp still standing, loaded or not, and can mark it on the map", () => {
    const t = setup();
    t.k.services.provide(WorldInfoKey, { chunkSize: 50, biome: () => "desert", pondAt: () => false, seed: () => null, setSeed: () => {}, loadedChunks: () => 0 });
    const lm = t.k.services.get(LandmarksKey);
    const camp = lm.nearest!("Bandit Camp", 0, 0, 6);
    expect(camp, "a desert has camps within six chunks").not.toBeNull();
    // It is what the chunk really builds.
    const [, cx, cz] = /_(-?\d+)_(-?\d+)$/.exec(camp!.id)!.map(Number);
    const nop = () => null;
    const built = buildWildChunk({ site: new Proxy({}, { get: () => nop }) as never, spawn: nop, chunkKey: "", cx, cz, biome: "desert", size: 50 }, { ...WILD_SCATTER, pool: {} }, WILD_SITES);
    expect(built.find((l) => l.id === camp!.id)?.name).toBe(camp!.name);

    expect(lm.mark!(camp!.id)).toBe(true);
    expect(t.discovered.get(camp!.id)?.name).toBe(camp!.name);
    expect(t.grants, "marking is not finding: no experience").toEqual([]);
    expect(lm.mark!("site_nothing_0_0")).toBe(false);
  });

  it("a site's chest taken from at all doesn't refill for three days (no partial-take refills)", () => {
    const t = setup();
    t.hours = 5;
    const lm = t.k.services.get(LandmarksKey);
    t.k.events.emit("container:plundered", { id: "chest_site_graveyard_1_1" });
    expect(lm.chestLooted!("site_graveyard_1_1")).toBe(true);
    t.hours = 7;
    t.k.events.emit("container:plundered", { id: "chest_site_graveyard_1_1" });
    expect((t.codec().save() as { looted: Record<string, number> }).looted, "from the first take").toEqual({ "site_graveyard_1_1": 5 });
  });

  it("a site's chest, once emptied, stays empty for three days (and the save keeps it)", () => {
    const t = setup();
    t.hours = 5;
    const lm = t.k.services.get(LandmarksKey);
    t.k.events.emit("container:emptied", { id: "chest_01" });
    expect(lm.chestLooted!("01"), "a chest that is no site's is not tracked").toBe(false);
    t.k.events.emit("container:emptied", { id: "chest_site_haunted-house_2_3" });
    expect(lm.chestLooted!("site_haunted-house_2_3")).toBe(true);
    const saved = t.codec().save() as { looted: Record<string, number> };
    expect(saved.looted).toEqual({ "site_haunted-house_2_3": 5 });
    t.hours = 5 + QUIET_HOURS;
    expect(lm.chestLooted!("site_haunted-house_2_3"), "filled again").toBe(false);
    const u = setup();
    u.hours = 6;
    u.codec().load(saved);
    expect(u.k.services.get(LandmarksKey).chestLooted!("site_haunted-house_2_3")).toBe(true);
  });
});
