import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType } from "@babylonjs/core/Physics";
import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { NPC } from "../entities/npc";
import { Loot } from "../entities/loot";
import { BiomeType } from "./world-manager";
import type { WorldSeed } from "./world-seed";

interface StructureSpawn {
  meshes: Mesh[];
  loot: Loot[];
  /** Physics aggregates created for this structure; disposed before their meshes on unload. */
  bodies: PhysicsAggregate[];
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

  /**
   * Shared material pool — one material per structural type rather than one
   * per chunk instance.  Reduces GPU material count from O(chunks) to O(1).
   */
  private readonly _sharedMaterials: Map<string, StandardMaterial> = new Map();

  /** Called for each NPC spawned as part of a structure so the caller can
   *  register it with ScheduleSystem / CombatSystem. */
  public onNPCSpawn: ((npc: NPC) => void) | null = null;

  /** Optional world seed — used for seeded placement and randomisation. */
  private readonly _seed: WorldSeed | null;

  /** Optional shadow generator — structure meshes are registered as casters. */
  private readonly _shadows: ShadowGenerator | null;

  constructor(scene: Scene, shadowGenerator: ShadowGenerator | null = null, seed: WorldSeed | null = null) {
    this._scene = scene;
    this._shadows = shadowGenerator;
    this._seed = seed;
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Returns true if a structure is seeded at the given chunk coordinates.
   * Delegates to the active `WorldSeed` when one is provided; otherwise uses
   * the default 25 % deterministic threshold so existing worlds are unchanged.
   * Deterministic and does not require a scene — safe to use in tests.
   */
  public hasStructureAt(chunkX: number, chunkZ: number): boolean {
    if (this._seed) return this._seed.hasStructure(chunkX, chunkZ);
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
      this._chunkStructures.set(key, { meshes: [], loot: [], bodies: [] });
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
   * Dispose all spawned structures across every tracked chunk.
   * Call this when tearing down the scene entirely.
   */
  public dispose(): void {
    for (const [, spawn] of this._chunkStructures) {
      for (const body of spawn.bodies) body.dispose();
      for (const m of spawn.meshes) m.dispose(false, false);
      for (const l of spawn.loot) l.dispose();
    }
    this._chunkStructures.clear();
  }

  /**
   * Dispose all meshes, physics, and loot for an unloading chunk.
   * NPCs are intentionally kept alive — they remain active once spawned.
   */
  public disposeChunk(chunkX: number, chunkZ: number): void {
    const key = `${chunkX},${chunkZ}`;
    const spawn = this._chunkStructures.get(key);
    if (!spawn) return;

    // Dispose physics bodies BEFORE their meshes to avoid dangling references
    for (const body of spawn.bodies) body.dispose();
    // Materials are shared across all structure instances — preserve them
    for (const m of spawn.meshes) m.dispose(false, false);
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
    const bodies: PhysicsAggregate[] = [];
    // Aged limestone — warm earthy grey with subtle specular for weathered stone
    const mat = this._mat(
      "ruins_stone",
      new Color3(0.50, 0.44, 0.36),
      new Color3(0.14, 0.12, 0.09),
      28,
    );

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
      bodies.push(new PhysicsAggregate(wall, PhysicsShapeType.BOX, { mass: 0 }, this._scene));
      meshes.push(this._shadow(wall));
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
      meshes.push(this._shadow(rubble));
    }

    // Loot chest at the center
    const { mesh: chestMesh, body: chestBody } = this._addChest(`ruins_chest_${cx}_${cz}`, new Vector3(origin.x, 0, origin.z), loot, cx, cz, 0);
    meshes.push(chestMesh);
    bodies.push(chestBody);

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

    return { meshes, loot, bodies };
  }

  /**
   * Desert shrine: raised stone platform with four pillars, a central altar,
   * and an ancient relic loot item.
   */
  private _buildDesertShrine(cx: number, cz: number, origin: Vector3): StructureSpawn {
    const meshes: Mesh[] = [];
    const loot: Loot[] = [];
    const bodies: PhysicsAggregate[] = [];
    // Sun-bleached sandstone platform
    const stoneMat = this._mat(
      "shrine_stone",
      new Color3(0.80, 0.64, 0.34),
      new Color3(0.24, 0.18, 0.07),
      36,
    );
    // Golden altar stone with a warm glow
    const altarMat = this._mat(
      "shrine_altar",
      new Color3(0.90, 0.74, 0.26),
      new Color3(0.38, 0.28, 0.08),
      52,
    );

    // Raised platform
    const platform = MeshBuilder.CreateBox(`shrine_platform_${cx}_${cz}`, { width: 5, height: 0.4, depth: 5 }, this._scene);
    platform.position.set(origin.x, 0.2, origin.z);
    platform.material = stoneMat;
    bodies.push(new PhysicsAggregate(platform, PhysicsShapeType.BOX, { mass: 0 }, this._scene));
    meshes.push(this._shadow(platform));

    // Altar block
    const altar = MeshBuilder.CreateBox(`shrine_altarBlock_${cx}_${cz}`, { width: 1.5, height: 0.8, depth: 0.9 }, this._scene);
    altar.position.set(origin.x, 0.8, origin.z);
    altar.material = altarMat;
    meshes.push(this._shadow(altar));

    // Four corner pillars at varying heights
    const corners: [number, number][] = [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5]];
    for (let i = 0; i < 4; i++) {
      const [px, pz] = corners[i];
      const ph = 3 + this._rand(cx, cz, i + 5) * 2;
      const pillar = MeshBuilder.CreateBox(`shrine_pillar_${cx}_${cz}_${i}`, { width: 0.6, height: ph, depth: 0.6 }, this._scene);
      pillar.position.set(origin.x + px, ph / 2, origin.z + pz);
      pillar.material = stoneMat;
      bodies.push(new PhysicsAggregate(pillar, PhysicsShapeType.BOX, { mass: 0 }, this._scene));
      meshes.push(this._shadow(pillar));
    }

    // Ancient relic on the altar — equippable off-hand talisman
    const relic = new Loot(this._scene, new Vector3(origin.x, 1.6, origin.z), {
      id: `shrine_relic_${cx}_${cz}`,
      name: "Ancient Relic",
      description: "A weathered relic found on a desert altar. +3 Damage.",
      stackable: false,
      quantity: 1,
      slot: "offHand",
      stats: { damage: 3 },
    });
    loot.push(relic);

    return { meshes, loot, bodies };
  }

  /**
   * Tundra watchtower: tall square stone tower with a doorway on the south side,
   * a wooden roof, a loot chest inside, and a hostile guard NPC out front.
   */
  private _buildWatchtower(cx: number, cz: number, origin: Vector3): StructureSpawn {
    const meshes: Mesh[] = [];
    const loot: Loot[] = [];
    const bodies: PhysicsAggregate[] = [];
    // Cold granite stone — blue-grey tint with reflective highlights
    const stoneMat = this._mat(
      "tower_stone",
      new Color3(0.50, 0.48, 0.50),
      new Color3(0.18, 0.18, 0.22),
      42,
    );
    // Weathered dark timber
    const woodMat = this._mat(
      "tower_wood",
      new Color3(0.36, 0.24, 0.12),
      new Color3(0.08, 0.05, 0.02),
      14,
    );

    const tW = 4;   // exterior width
    const tH = 8;   // wall height
    const wT = 0.6; // wall thickness

    // North wall (full)
    const nWall = MeshBuilder.CreateBox(`tower_N_${cx}_${cz}`, { width: tW, height: tH, depth: wT }, this._scene);
    nWall.position.set(origin.x, tH / 2, origin.z + tW / 2);
    nWall.material = stoneMat;
    bodies.push(new PhysicsAggregate(nWall, PhysicsShapeType.BOX, { mass: 0 }, this._scene));
    meshes.push(this._shadow(nWall));

    // South wall — two pillar segments flanking a 1.6 m doorway
    for (const side of [-1, 1]) {
      const pillar = MeshBuilder.CreateBox(`tower_Spillar${side}_${cx}_${cz}`, { width: 1.0, height: tH, depth: wT }, this._scene);
      pillar.position.set(origin.x + side * 1.5, tH / 2, origin.z - tW / 2);
      pillar.material = stoneMat;
      bodies.push(new PhysicsAggregate(pillar, PhysicsShapeType.BOX, { mass: 0 }, this._scene));
      meshes.push(this._shadow(pillar));
    }

    // Lintel above doorway
    const lintelH = tH - 2.5;
    const lintel = MeshBuilder.CreateBox(`tower_lintel_${cx}_${cz}`, { width: 1.8, height: lintelH, depth: wT }, this._scene);
    lintel.position.set(origin.x, tH - lintelH / 2, origin.z - tW / 2);
    lintel.material = stoneMat;
    bodies.push(new PhysicsAggregate(lintel, PhysicsShapeType.BOX, { mass: 0 }, this._scene));
    meshes.push(this._shadow(lintel));

    // East wall
    const eWall = MeshBuilder.CreateBox(`tower_E_${cx}_${cz}`, { width: wT, height: tH, depth: tW }, this._scene);
    eWall.position.set(origin.x + tW / 2, tH / 2, origin.z);
    eWall.material = stoneMat;
    bodies.push(new PhysicsAggregate(eWall, PhysicsShapeType.BOX, { mass: 0 }, this._scene));
    meshes.push(this._shadow(eWall));

    // West wall
    const wWall = MeshBuilder.CreateBox(`tower_W_${cx}_${cz}`, { width: wT, height: tH, depth: tW }, this._scene);
    wWall.position.set(origin.x - tW / 2, tH / 2, origin.z);
    wWall.material = stoneMat;
    bodies.push(new PhysicsAggregate(wWall, PhysicsShapeType.BOX, { mass: 0 }, this._scene));
    meshes.push(this._shadow(wWall));

    // Wooden roof platform
    const roof = MeshBuilder.CreateBox(`tower_roof_${cx}_${cz}`, { width: tW - wT, height: 0.2, depth: tW - wT }, this._scene);
    roof.position.set(origin.x, tH + 0.1, origin.z);
    roof.material = woodMat;
    bodies.push(new PhysicsAggregate(roof, PhysicsShapeType.BOX, { mass: 0 }, this._scene));
    meshes.push(this._shadow(roof));

    // Chest inside tower base
    const { mesh: chestMesh, body: chestBody } = this._addChest(`tower_chest_${cx}_${cz}`, new Vector3(origin.x + 1, 0, origin.z + 1), loot, cx, cz, 60);
    meshes.push(chestMesh);
    bodies.push(chestBody);

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

    return { meshes, loot, bodies };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /** Spawn a wooden chest mesh and a gold-coin loot item beside it. */
  private _addChest(name: string, position: Vector3, lootArr: Loot[], cx: number, cz: number, slot: number): { mesh: Mesh; body: PhysicsAggregate } {
    const mat = this._mat(
      "chest_wood",
      new Color3(0.44, 0.28, 0.09),
      new Color3(0.12, 0.08, 0.02),
      16,
    );
    const chest = MeshBuilder.CreateBox(name, { width: 0.8, height: 0.5, depth: 0.5 }, this._scene);
    chest.position.set(position.x, 0.25, position.z);
    chest.material = mat;
    const body = new PhysicsAggregate(chest, PhysicsShapeType.BOX, { mass: 0 }, this._scene);
    this._shadow(chest);

    const coins = new Loot(this._scene, new Vector3(position.x + 0.6, 1.0, position.z), {
      id: `chest_gold_${cx}_${cz}_${slot}`,
      name: "Gold Coins",
      description: "A handful of gold coins.",
      stackable: true,
      quantity: 1 + Math.floor(this._rand(cx, cz, slot + 50) * 5),
      stats: {},
    });
    lootArr.push(coins);
    return { mesh: chest, body };
  }

  /** Register a mesh as a shadow caster and enable it to receive shadows. */
  private _shadow(mesh: Mesh): Mesh {
    this._shadows?.addShadowCaster(mesh, false);
    mesh.receiveShadows = true;
    return mesh;
  }

  /**
   * Return a cached shared material for a given structural type.
   * Materials are keyed by `name` so each unique type is created only once,
   * reducing GPU material count from O(loaded structures) to O(structure types).
   */
  private _mat(name: string, diffuse: Color3, specular = new Color3(0.10, 0.10, 0.10), specularPower = 24): StandardMaterial {
    let mat = this._sharedMaterials.get(name);
    if (!mat) {
      mat = new StandardMaterial(name, this._scene);
      mat.diffuseColor  = diffuse;
      mat.specularColor = specular;
      mat.specularPower = specularPower;
      mat.freeze();
      this._sharedMaterials.set(name, mat);
    }
    return mat;
  }

  /** Deterministic pseudo-random in [0, 1) seeded by chunk coords and slot.
   *  Delegates to the active `WorldSeed` when one is provided. */
  private _rand(cx: number, cz: number, slot: number): number {
    if (this._seed) return this._seed.rand(cx, cz, slot);
    return Math.abs(Math.sin(cx * 217.3 + cz * 431.9 + slot * 83.1)) % 1;
  }
}
