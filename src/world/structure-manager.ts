import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType } from "@babylonjs/core/Physics";
import { NPC } from "../entities/npc";
import { Loot } from "../entities/loot";
import { BiomeType } from "./world-manager";

interface StructureSpawn {
  meshes: Mesh[];
  loot: Loot[];
}

/**
 * Manages procedural structure generation (ruins, shrines, watchtowers) tied to
 * the chunk lifecycle. Structures are deterministically placed — the same chunk
 * always produces the same structure.
 */
export class StructureManager {
  private _scene: Scene;
  /** Maps chunk key ("cx,cz") to the structure spawned there. */
  private _chunkStructures: Map<string, StructureSpawn> = new Map();

  /** Called for each NPC spawned as part of a structure so the caller can
   *  register it with ScheduleSystem / CombatSystem. */
  public onNPCSpawn: ((npc: NPC) => void) | null = null;

  constructor(scene: Scene) {
    this._scene = scene;
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Returns true if a structure is seeded at the given chunk coordinates.
   * Deterministic and does not require a scene — safe to use in tests.
   */
  public hasStructureAt(chunkX: number, chunkZ: number): boolean {
    return this._rand(chunkX, chunkZ, 0) <= 0.25;
  }

  /**
   * Attempt to spawn a structure for a freshly-loaded chunk.
   * No-op if this chunk has already been processed.
   */
  public trySpawnForChunk(chunkX: number, chunkZ: number, biome: BiomeType, chunkSize: number): void {
    const key = `${chunkX},${chunkZ}`;
    if (this._chunkStructures.has(key)) return;

    if (!this.hasStructureAt(chunkX, chunkZ)) {
      this._chunkStructures.set(key, { meshes: [], loot: [] });
      return;
    }

    const worldX = chunkX * chunkSize;
    const worldZ = chunkZ * chunkSize;

    // Offset slightly from chunk center for visual variety
    const ox = (this._rand(chunkX, chunkZ, 1) - 0.5) * chunkSize * 0.4;
    const oz = (this._rand(chunkX, chunkZ, 2) - 0.5) * chunkSize * 0.4;
    const origin = new Vector3(worldX + ox, 0, worldZ + oz);

    let spawn: StructureSpawn;
    switch (biome) {
      case "plains":
      case "forest":
        spawn = this._buildRuins(chunkX, chunkZ, origin);
        break;
      case "desert":
        spawn = this._buildDesertShrine(chunkX, chunkZ, origin);
        break;
      case "tundra":
        spawn = this._buildWatchtower(chunkX, chunkZ, origin);
        break;
    }

    this._chunkStructures.set(key, spawn);
  }

  /**
   * Dispose all meshes and loot for an unloading chunk.
   * NPCs are intentionally kept alive — they remain active once spawned.
   */
  public disposeChunk(chunkX: number, chunkZ: number): void {
    const key = `${chunkX},${chunkZ}`;
    const spawn = this._chunkStructures.get(key);
    if (!spawn) return;

    for (const m of spawn.meshes) m.dispose(false, true);
    for (const l of spawn.loot) l.dispose();
    this._chunkStructures.delete(key);
  }

  // ─── Structure builders ────────────────────────────────────────────────────

  /**
   * Stone ruins: partial walls forming an open courtyard with rubble and a
   * loot chest. One hostile guard NPC patrols inside.
   */
  private _buildRuins(cx: number, cz: number, origin: Vector3): StructureSpawn {
    const meshes: Mesh[] = [];
    const loot: Loot[] = [];
    const mat = this._mat(`ruins_stone_${cx}_${cz}`, new Color3(0.5, 0.45, 0.4));

    // Four partial walls at varying heights for a crumbled look
    const walls: Array<{ dx: number; dz: number; w: number; h: number; d: number }> = [
      { dx: 0,  dz:  4, w: 7.0, h: 3.0, d: 0.8 }, // north — tallest
      { dx: 0,  dz: -4, w: 4.0, h: 2.0, d: 0.8 }, // south — shorter, crumbled
      { dx: -4, dz:  0, w: 0.8, h: 3.0, d: 6.0 }, // west
      { dx:  4, dz:  0, w: 0.8, h: 2.2, d: 4.0 }, // east — partial
    ];
    for (let i = 0; i < walls.length; i++) {
      const { dx, dz, w, h, d } = walls[i];
      const wall = MeshBuilder.CreateBox(`ruins_wall_${cx}_${cz}_${i}`, { width: w, height: h, depth: d }, this._scene);
      wall.position.set(origin.x + dx, h / 2, origin.z + dz);
      wall.material = mat;
      new PhysicsAggregate(wall, PhysicsShapeType.BOX, { mass: 0 }, this._scene);
      meshes.push(wall);
    }

    // Scattered rubble blocks inside
    for (let i = 0; i < 4; i++) {
      const bw = 0.5 + this._rand(cx, cz, i + 10) * 0.7;
      const bh = 0.3 + this._rand(cx, cz, i + 11) * 0.4;
      const bd = 0.5 + this._rand(cx, cz, i + 12) * 0.7;
      const rubble = MeshBuilder.CreateBox(`ruins_rubble_${cx}_${cz}_${i}`, { width: bw, height: bh, depth: bd }, this._scene);
      rubble.position.set(
        origin.x + (this._rand(cx, cz, i + 20) - 0.5) * 5,
        bh / 2,
        origin.z + (this._rand(cx, cz, i + 21) - 0.5) * 5,
      );
      rubble.rotation.y = this._rand(cx, cz, i + 22) * Math.PI;
      rubble.material = mat;
      meshes.push(rubble);
    }

    // Loot chest at the center
    meshes.push(this._addChest(`ruins_chest_${cx}_${cz}`, new Vector3(origin.x, 0, origin.z), loot, cx, cz, 0));

    // Hostile guard NPC
    const guard = new NPC(this._scene, new Vector3(origin.x + 2, 2, origin.z + 2), `RuinGuard_${cx}_${cz}`);
    guard.aggroRange = 12;
    guard.attackDamage = 7;
    guard.xpReward = 30;
    guard.patrolPoints = [
      new Vector3(origin.x + 2, 2, origin.z + 2),
      new Vector3(origin.x - 2, 2, origin.z - 2),
    ];
    if (this.onNPCSpawn) this.onNPCSpawn(guard);

    return { meshes, loot };
  }

  /**
   * Desert shrine: raised stone platform with four pillars, a central altar,
   * and an ancient relic loot item.
   */
  private _buildDesertShrine(cx: number, cz: number, origin: Vector3): StructureSpawn {
    const meshes: Mesh[] = [];
    const loot: Loot[] = [];
    const stoneMat = this._mat(`shrine_stone_${cx}_${cz}`, new Color3(0.72, 0.60, 0.38));
    const altarMat = this._mat(`shrine_altar_${cx}_${cz}`, new Color3(0.82, 0.70, 0.30));

    // Raised platform
    const platform = MeshBuilder.CreateBox(`shrine_platform_${cx}_${cz}`, { width: 5, height: 0.4, depth: 5 }, this._scene);
    platform.position.set(origin.x, 0.2, origin.z);
    platform.material = stoneMat;
    new PhysicsAggregate(platform, PhysicsShapeType.BOX, { mass: 0 }, this._scene);
    meshes.push(platform);

    // Altar block
    const altar = MeshBuilder.CreateBox(`shrine_altarBlock_${cx}_${cz}`, { width: 1.5, height: 0.8, depth: 0.9 }, this._scene);
    altar.position.set(origin.x, 0.8, origin.z);
    altar.material = altarMat;
    meshes.push(altar);

    // Four corner pillars at varying heights
    const corners: [number, number][] = [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5]];
    for (let i = 0; i < 4; i++) {
      const [px, pz] = corners[i];
      const ph = 3 + this._rand(cx, cz, i + 5) * 2;
      const pillar = MeshBuilder.CreateBox(`shrine_pillar_${cx}_${cz}_${i}`, { width: 0.6, height: ph, depth: 0.6 }, this._scene);
      pillar.position.set(origin.x + px, ph / 2, origin.z + pz);
      pillar.material = stoneMat;
      new PhysicsAggregate(pillar, PhysicsShapeType.BOX, { mass: 0 }, this._scene);
      meshes.push(pillar);
    }

    // Ancient relic on the altar
    const relic = new Loot(this._scene, new Vector3(origin.x, 1.6, origin.z), {
      id: `shrine_relic_${cx}_${cz}`,
      name: "Ancient Relic",
      description: "A weathered relic found on a desert altar.",
      stackable: false,
      quantity: 1,
      stats: { damage: 3 },
    });
    loot.push(relic);

    return { meshes, loot };
  }

  /**
   * Tundra watchtower: tall square stone tower with a doorway on the south side,
   * a wooden roof, a loot chest inside, and a hostile guard NPC out front.
   */
  private _buildWatchtower(cx: number, cz: number, origin: Vector3): StructureSpawn {
    const meshes: Mesh[] = [];
    const loot: Loot[] = [];
    const stoneMat = this._mat(`tower_stone_${cx}_${cz}`, new Color3(0.55, 0.52, 0.50));
    const woodMat  = this._mat(`tower_wood_${cx}_${cz}`,  new Color3(0.42, 0.30, 0.18));

    const tW = 4;   // exterior width
    const tH = 8;   // wall height
    const wT = 0.6; // wall thickness

    // North wall (full)
    const nWall = MeshBuilder.CreateBox(`tower_N_${cx}_${cz}`, { width: tW, height: tH, depth: wT }, this._scene);
    nWall.position.set(origin.x, tH / 2, origin.z + tW / 2);
    nWall.material = stoneMat;
    new PhysicsAggregate(nWall, PhysicsShapeType.BOX, { mass: 0 }, this._scene);
    meshes.push(nWall);

    // South wall — two pillar segments flanking a 1.6 m doorway
    for (const side of [-1, 1]) {
      const pillar = MeshBuilder.CreateBox(`tower_Spillar${side}_${cx}_${cz}`, { width: 1.0, height: tH, depth: wT }, this._scene);
      pillar.position.set(origin.x + side * 1.5, tH / 2, origin.z - tW / 2);
      pillar.material = stoneMat;
      new PhysicsAggregate(pillar, PhysicsShapeType.BOX, { mass: 0 }, this._scene);
      meshes.push(pillar);
    }

    // Lintel above doorway
    const lintelH = tH - 2.5;
    const lintel = MeshBuilder.CreateBox(`tower_lintel_${cx}_${cz}`, { width: 1.8, height: lintelH, depth: wT }, this._scene);
    lintel.position.set(origin.x, tH - lintelH / 2, origin.z - tW / 2);
    lintel.material = stoneMat;
    new PhysicsAggregate(lintel, PhysicsShapeType.BOX, { mass: 0 }, this._scene);
    meshes.push(lintel);

    // East wall
    const eWall = MeshBuilder.CreateBox(`tower_E_${cx}_${cz}`, { width: wT, height: tH, depth: tW }, this._scene);
    eWall.position.set(origin.x + tW / 2, tH / 2, origin.z);
    eWall.material = stoneMat;
    new PhysicsAggregate(eWall, PhysicsShapeType.BOX, { mass: 0 }, this._scene);
    meshes.push(eWall);

    // West wall
    const wWall = MeshBuilder.CreateBox(`tower_W_${cx}_${cz}`, { width: wT, height: tH, depth: tW }, this._scene);
    wWall.position.set(origin.x - tW / 2, tH / 2, origin.z);
    wWall.material = stoneMat;
    new PhysicsAggregate(wWall, PhysicsShapeType.BOX, { mass: 0 }, this._scene);
    meshes.push(wWall);

    // Wooden roof platform
    const roof = MeshBuilder.CreateBox(`tower_roof_${cx}_${cz}`, { width: tW - wT, height: 0.2, depth: tW - wT }, this._scene);
    roof.position.set(origin.x, tH + 0.1, origin.z);
    roof.material = woodMat;
    new PhysicsAggregate(roof, PhysicsShapeType.BOX, { mass: 0 }, this._scene);
    meshes.push(roof);

    // Chest inside tower base
    meshes.push(this._addChest(`tower_chest_${cx}_${cz}`, new Vector3(origin.x + 1, 0, origin.z + 1), loot, cx, cz, 60));

    // Guard NPC positioned in front of the doorway
    const guard = new NPC(this._scene, new Vector3(origin.x, 2, origin.z - tW / 2 - 2), `TowerGuard_${cx}_${cz}`);
    guard.aggroRange = 15;
    guard.attackDamage = 8;
    guard.xpReward = 40;
    guard.patrolPoints = [
      new Vector3(origin.x,     2, origin.z - tW / 2 - 2),
      new Vector3(origin.x + 3, 2, origin.z - tW / 2 - 2),
    ];
    if (this.onNPCSpawn) this.onNPCSpawn(guard);

    return { meshes, loot };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /** Spawn a wooden chest mesh and a gold-coin loot item beside it. */
  private _addChest(name: string, position: Vector3, lootArr: Loot[], cx: number, cz: number, slot: number): Mesh {
    const mat = this._mat(`${name}_mat`, new Color3(0.50, 0.32, 0.10));
    const chest = MeshBuilder.CreateBox(name, { width: 0.8, height: 0.5, depth: 0.5 }, this._scene);
    chest.position.set(position.x, 0.25, position.z);
    chest.material = mat;
    new PhysicsAggregate(chest, PhysicsShapeType.BOX, { mass: 0 }, this._scene);

    const coins = new Loot(this._scene, new Vector3(position.x + 0.6, 1.0, position.z), {
      id: `chest_gold_${cx}_${cz}_${slot}`,
      name: "Gold Coins",
      description: "A handful of gold coins.",
      stackable: true,
      quantity: 1 + Math.floor(this._rand(cx, cz, slot + 50) * 5),
      stats: {},
    });
    lootArr.push(coins);
    return chest;
  }

  private _mat(name: string, color: Color3): StandardMaterial {
    const mat = new StandardMaterial(name, this._scene);
    mat.diffuseColor = color;
    return mat;
  }

  /** Deterministic pseudo-random in [0, 1) seeded by chunk coords and slot. */
  private _rand(cx: number, cz: number, slot: number): number {
    return Math.abs(Math.sin(cx * 217.3 + cz * 431.9 + slot * 83.1)) % 1;
  }
}
