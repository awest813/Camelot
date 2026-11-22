import { describe, it, expect, vi } from "vitest";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";

// jsdom has no 2D canvas: notices get plain materials here.
vi.mock("../../rendering/notice-texture", () => ({
  createNoticeMaterials: (scene: import("@babylonjs/core/scene").Scene) => [new StandardMaterial("notice", scene)],
}));
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Kernel } from "../../core/kernel";
import {
  ActorsKey, FastTravelKey, FeedbackKey, PlayerKey, SiteBuilderKey, WorldInfoKey, type KeepOut,
} from "../services";
import { VillagesFeature, VillagesKey } from "./villages-feature";
import { JobsKey } from "../village-jobs/jobs-feature";
import { hasVillage } from "../../world/village-settlement";
import type { NPC } from "../../entities/npc";

function villageChunk(): [number, number] {
  for (let r = 3; r < 40; r++) for (let cx = -r; cx <= r; cx++) for (const cz of [-r, r]) {
    if (hasVillage(cx, cz, "plains")) return [cx, cz];
  }
  throw new Error("no village");
}

function setup() {
  const scene = new Scene(new NullEngine());
  const k = new Kernel();
  const pos = { x: 0, z: 0 };
  const placed = { buildings: 0, props: [] as string[], smithies: 0 };
  const owned: AbstractMesh[] = [];
  const keepOuts = new Set<KeepOut>();
  const spawned: NPC[] = [];
  const discovered = new Map<string, string>();
  const live = new Set<string>();
  const opened: unknown[] = [];

  k.services.provide(WorldInfoKey, { chunkSize: 50, biome: () => "plains", pondAt: () => false });
  k.services.provide(PlayerKey, { position: () => pos, level: () => 3 });
  k.services.provide(FeedbackKey, { notify: vi.fn(), grant: vi.fn(), addFame: vi.fn(), markDirty: vi.fn() });
  k.services.provide(FastTravelKey, {
    isDiscovered: (id) => discovered.has(id),
    discover: (id, name) => { const isNew = !discovered.has(id); discovered.set(id, name); return isNew; },
  });
  k.services.provide(ActorsKey, {
    residents: () => spawned,
    spawnArchetype: (_c, archetype, x, z) => {
      const npc = { mesh: { name: `${archetype}_${spawned.length}` }, spawnPosition: new Vector3(x, 2, z),
        workPosition: null, homePosition: null, patrolPoints: [], scheduleBlocks: [] } as unknown as NPC;
      spawned.push(npc);
      return npc;
    },
    despawn: vi.fn(), isTalkingTo: () => false,
    byName: (n) => spawned.find((s) => s.mesh.name === n),
    all: () => spawned,
  });
  k.services.provide(SiteBuilderKey, {
    scene,
    isLive: (c) => live.has(c),
    placeBuilding: () => { placed.buildings++; },
    placeProp: (_c, key) => { placed.props.push(key); },
    placeSmithy: () => { placed.smithies++; },
    ownStructure: (_c, m) => { owned.push(m); },
    own: (_c, m) => { owned.push(m); },
    addKeepOut: (fp) => { keepOuts.add(fp); return () => keepOuts.delete(fp); },
    nightFlame: () => null,
    placeAsset: () => undefined,
    spawnDragon: () => undefined,
  });
  k.services.provide(JobsKey, { open: (b) => { opened.push(b); } } as never);
  k.install(new VillagesFeature());
  return { k, scene, pos, placed, owned, keepOuts, spawned, discovered, live, opened, villages: k.services.get(VillagesKey) };
}

describe("VillagesFeature (headless, through the kernel)", () => {
  it("builds a planned village into its chunk: buildings, square, smithy, board, residents", () => {
    const t = setup();
    const [cx, cz] = villageChunk();
    const key = `${cx},${cz}`;
    t.live.add(key);
    expect(t.villages.populate("0,1", 0, 1), "no village near the start").toBe(false);
    expect(t.villages.populate(key, cx, cz)).toBe(true);
    const plan = t.villages.planFor(cx, cz)!;

    expect(t.placed.buildings).toBe(plan.buildings.length);
    expect(t.placed.smithies).toBe(1);
    expect(t.placed.props).toContain("qNoticeBoard");
    expect(t.placed.props).not.toContain("qWell");            // the well is built, not a prop
    expect(t.owned.some((m) => m.name.startsWith("village_well_"))).toBe(true);
    expect(t.keepOuts.size, "the well keeps NPCs out").toBe(1);
    expect(t.spawned.length).toBe(plan.residents.length);
    const watchman = t.spawned[plan.residents.findIndex((r) => r.nightWatch)];
    expect(watchman.scheduleBlocks[0]).toMatchObject({ behavior: "patrol", startHour: 18 });
    expect(t.villages.loaded().get(key)).toBe(plan);
    expect(t.villages.clearingAt(cx, cz)).toEqual({ x: plan.center.x, z: plan.center.z, radius: plan.clearRadius });

    // The notice board opens the village's job board.
    const hit = t.owned.find((m) => m.name === `notice_board_${key}`)!;
    (hit.metadata as { onActivate(): void }).onActivate();
    expect(t.opened).toEqual([{ boardId: `inn_${cx}_${cz}`, placeName: plan.name }]);
    // And the innkeeper's board is the same one.
    const inn = t.spawned.find((n) => n.mesh.name.startsWith("archetype_innkeeper"))!;
    expect(t.villages.innBoardOf(inn.mesh.name)).toEqual({ boardId: `inn_${cx}_${cz}`, placeName: plan.name });
  });

  it("walking into the square discovers it; a chunk unload forgets the village", () => {
    const t = setup();
    const [cx, cz] = villageChunk();
    const key = `${cx},${cz}`;
    t.live.add(key);
    t.villages.populate(key, cx, cz);
    const plan = t.villages.planFor(cx, cz)!;
    t.k.phases.run("sim", 1);
    expect(t.discovered.size).toBe(0);
    expect(t.villages.currentVillage(), "not discovered yet").toBeNull();
    t.pos.x = plan.center.x; t.pos.z = plan.center.z;
    t.k.phases.run("sim", 1);
    expect(t.discovered.get(plan.id)).toBe(plan.name);
    expect(t.villages.currentVillage()?.plan).toBe(plan);

    t.k.events.emit("chunk:unloaded", { chunkKey: key });
    expect(t.villages.loaded().size).toBe(0);
    expect(t.villages.currentVillage()).toBeNull();
  });

  it("does nothing for a chunk that unloaded before building finished", () => {
    const t = setup();
    const [cx, cz] = villageChunk();
    t.villages.populate(`${cx},${cz}`, cx, cz);   // not live
    expect(t.owned).toHaveLength(0);
    expect(t.keepOuts.size).toBe(0);
  });
});
