import { describe, it, expect, vi } from "vitest";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { StructureManager } from "./structure-manager";
import { LegacyStructureManager } from "./__fixtures__/legacy-structure-manager";
import type { NPC } from "../entities/npc";
import type { BiomeType } from "./world-manager";
import { listen } from "../testing/listen";

// No physics engine in tests: colliders are stand-ins that remember their mesh.
vi.mock("@babylonjs/core/Physics/v2/physicsAggregate", () => ({
  PhysicsAggregate: function PhysicsAggregate(this: Record<string, unknown>, mesh: unknown) {
    const anything: object = new Proxy({}, { get: () => () => anything });
    this.transformNode = mesh;
    this.body = anything;
    this.shape = anything;
    this.dispose = () => {};
  },
}));

const round = (n: number) => Math.round(n * 1e9) / 1e9;

/** Everything a structure put in its scene, in creation order. */
function dump(scene: Scene, npcs: NPC[], fires: string[]) {
  return {
    meshes: scene.meshes.map((m) => ({
      name: m.name,
      at: [m.position.x, m.position.y, m.position.z].map(round),
      rot: [m.rotation.x, m.rotation.y, m.rotation.z].map(round),
      size: (() => { const b = m.getBoundingInfo().boundingBox.extendSize; return [b.x, b.y, b.z].map(round); })(),
      material: m.material?.name ?? null,
      enabled: m.isEnabled(false),
      parent: m.parent?.name ?? null,
    })),
    materials: scene.materials.map((m) => m.name),
    lights: scene.lights.map((l) => ({ name: l.name, at: [(l as unknown as { position: { x: number; y: number; z: number } }).position].map((p) => [p.x, p.y, p.z].map(round))[0], intensity: l.intensity })),
    npcs: npcs.map((n) => ({ key: n.key, aggro: n.aggroRange, dmg: n.attackDamage, xp: n.xpReward, patrol: n.patrolPoints.map((p) => [p.x, p.y, p.z].map(round)) })),
    fires,
  };
}

function build(Manager: typeof StructureManager | typeof LegacyStructureManager, cx: number, cz: number, biome: BiomeType, collected: Set<string>) {
  const scene = new Scene(new NullEngine());
  const sm = new Manager(scene);
  const npcs: NPC[] = [];
  const fires: string[] = [];
  if (sm instanceof StructureManager) {
    listen(sm, "npc:spawned", ({ npc }) => { npcs.push(npc); });
    sm.isLootCollected = (id) => collected.has(id);
  } else {
    // The legacy fixture keeps its original callbacks.
    sm.onNPCSpawn = (npc) => { npcs.push(npc); };
    sm.onCheckLootCollected = (id) => collected.has(id);
  }
  sm.onFire = ({ flame, kind }) => { fires.push(`${kind}:${flame.name}`); };
  sm.trySpawnForChunk(cx, cz, biome, 50);
  const out = dump(scene, npcs, fires);
  scene.getEngine().dispose();
  return out;
}

const BIOMES: BiomeType[] = ["plains", "forest", "desert", "tundra"];

describe("structures as data", () => {
  it("build exactly what the hand-written builders did (meshes, materials, lights, NPCs, loot)", () => {
    const probe = new StructureManager(new Scene(new NullEngine()));
    let built = 0;
    for (const biome of BIOMES) {
      let found = 0;
      for (let cx = -30; cx < 30 && found < 3; cx++) for (let cz = -30; cz < 30 && found < 3; cz++) {
        if (!probe.hasStructureAt(cx, cz)) continue;
        found++;
        // Once with everything to find, once with the loot already taken.
        for (const collected of [new Set<string>(), new Set([`chest_gold_${cx}_${cz}_0`, `chest_gold_${cx}_${cz}_60`, `shrine_relic_${cx}_${cz}`])]) {
          const before = build(LegacyStructureManager, cx, cz, biome, collected);
          const after = build(StructureManager, cx, cz, biome, collected);
          expect(after, `${biome} ${cx},${cz}`).toEqual(before);
          expect(before.meshes.length).toBeGreaterThan(10);
          built++;
        }
      }
    }
    expect(built).toBe(24);
  });
});
