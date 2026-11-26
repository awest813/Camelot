import { describe, expect, it, vi } from "vitest";
import { Kernel } from "../../core/kernel";
import { FastTravelKey, FeedbackKey, LandmarksKey, PlayerKey, SavesKey } from "../services";
import type { SaveCodec } from "../../systems/save-system";
import type { PlacedLandmark } from "../../world/site-specs";
import { LandmarksFeature } from "./landmarks-feature";

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
  const feature = new LandmarksFeature();
  k.install(feature);
  const step = (seconds: number) => { for (let t = 0; t < seconds; t += 0.1) k.phases.run("sim", 0.1); };
  return { k, pos, discovered, grants, found, cleared, feature, step, codec: () => codecs.find((c) => c.key === "landmarks")! };
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

  it("a camp is cleared when everyone it spawned falls, once per world (and the save keeps it)", () => {
    const t = setup();
    const chief = { name: "chief" }, archer = { name: "archer" }, stranger = { name: "wolf" };
    const camp: PlacedLandmark = {
      id: "site_bandit-camp_5_5", name: "Ravenwick Bandit Camp", kind: "Bandit Camp", xp: 25, radius: 22,
      x: 0, z: 500, arrive: { x: 0, z: 512 }, clear: { xp: 60, gold: 75, foes: [chief, archer] },
    };
    const kill = (npc: object) => t.k.events.emit("npc:killed", { npcName: "x", xp: 0, npc } as never);
    t.k.services.get(LandmarksKey).placed("0,10", [camp]);
    kill(stranger);
    kill(chief);
    expect(t.cleared, "the archer still stands").toEqual([]);
    kill(archer);
    expect(t.cleared).toEqual(["Ravenwick Bandit Camp"]);
    expect(t.grants.at(-1)).toEqual({ xp: 60, gold: 75, label: "Cleared: Ravenwick Bandit Camp" });
    expect(t.feature.isCleared(camp.id)).toBe(true);

    // The chunk reloads and the camp fills again: no second reward.
    t.k.events.emit("chunk:unloaded", { chunkKey: "0,10" });
    const chief2 = {}, archer2 = {};
    t.k.services.get(LandmarksKey).placed("0,10", [{ ...camp, clear: { xp: 60, gold: 75, foes: [chief2, archer2] } }]);
    kill(chief2); kill(archer2);
    expect(t.cleared).toHaveLength(1);

    // Saved, and back after a load into a fresh world.
    const saved = t.codec().save();
    expect(saved).toEqual({ cleared: [camp.id] });
    const u = setup();
    u.codec().load(saved);
    expect(u.feature.isCleared(camp.id)).toBe(true);
    u.codec().load(undefined);
    expect(u.feature.isCleared(camp.id), "an old save without the part").toBe(false);
  });
});
