import { describe, expect, it, vi } from "vitest";
import { Kernel } from "../../core/kernel";
import { FastTravelKey, FeedbackKey, LandmarksKey, PlayerKey } from "../services";
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
  const grants: Array<{ xp?: number; label: string }> = [];
  const found: string[] = [];
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
  return { k, pos, discovered, grants, found, feature, step };
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
});
