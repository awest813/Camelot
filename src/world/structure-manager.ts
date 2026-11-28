import type { SurfaceKind } from "../rendering/texture-synth";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "../rendering/mesh-builder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { NPC } from "../entities/npc";
import { Loot } from "../entities/loot";
import { BiomeType } from "./world-manager";
import type { WorldSeed } from "./world-seed";
import type { ProceduralTextureManager } from "../systems/procedural-texture-manager";
import type { LodSystem } from "../systems/lod-system";
import { STRUCTURES, type Rolled, type StructureMaterial, type StructureSpec } from "../content/structures";
import type { GameEventBus } from "../systems/event-bus";

interface StructureSpawn {
  meshes: Mesh[];
  /** Invisible physics-only sources left behind by {@link StructureManager.mergeStatic}. */
  colliders?: Mesh[];
  loot: Loot[];
  bodies: PhysicsAggregate[];
  npcs: NPC[];
  lights: PointLight[];
}

/**
 * Manages procedural structure generation (ruins, shrines, watchtowers) tied to
 * the chunk lifecycle. Structures are deterministically placed — the same chunk
 * always produces the same structure.
 */
export class StructureManager {
  /** Where this reports what happened (the game's event bus). */
  public events: GameEventBus | null = null;

  private _scene: Scene;
  /** Maps chunk key ("cx,cz") to the structure spawned there. */
  private _chunkStructures: Map<string, StructureSpawn> = new Map();

  /** Optional LOD system for distance culling structure meshes. */
  public lodSystem: LodSystem | null = null;

  /**
   * Shared material pool — one material per structural type rather than one
   * per chunk instance.  Reduces GPU material count from O(chunks) to O(1).
   */
  private readonly _sharedMaterials: Map<string, StandardMaterial> = new Map();

  /** Fired with a loot item ID; return true if the item was already collected. */
  /** Query: has the player already taken this one-off loot (so it is not placed again)? */
  public isLootCollected: ((itemId: string) => boolean) | null = null;

  /**
   * Optional world seed — used for seeded placement and randomisation.
   *
   * Two-phase initialization: set to the constructor argument (typically `null`
   * for new games) during `WorldManager.init()`, then overwritten by
   * `setSeed()` once the player completes character creation (and before the
   * first chunk is streamed in).  This keeps construction side-effect-free
   * while still allowing the player's chosen seed to drive the whole world.
   */
  private _seed: WorldSeed | null;

  /** Optional shadow generator — structure meshes are registered as casters. */
  private readonly _shadows: ShadowGenerator | null;
  /** Optional procedural texture manager for structural surface textures. */
  private readonly _textureManager?: ProceduralTextureManager;

  constructor(
    scene: Scene,
    shadowGenerator: ShadowGenerator | null = null,
    seed: WorldSeed | null = null,
    textureManager?: ProceduralTextureManager,
  ) {
    this._scene = scene;
    this._shadows = shadowGenerator;
    this._seed = seed;
    this._textureManager = textureManager;
  }

  /**
   * Replace the active world seed.  Should be called before any chunks are
   * spawned so that structure placement is fully consistent.
   */
  public setSeed(seed: WorldSeed | null): void {
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
      this._chunkStructures.set(key, { meshes: [], loot: [], bodies: [], npcs: [], lights: [] });
      return;
    }

    const worldX = chunkX * chunkSize;
    const worldZ = chunkZ * chunkSize;

    // Offset slightly from chunk center for visual variety
    const ox = (this._rand(chunkX, chunkZ, 1) - 0.5) * chunkSize * 0.4;
    const oz = (this._rand(chunkX, chunkZ, 2) - 0.5) * chunkSize * 0.4;
    const origin = new Vector3(worldX + ox, 0, worldZ + oz);

    const spec = STRUCTURES.find((st) => st.biomes.includes(biome));
    if (!spec) {
      this._chunkStructures.set(key, { meshes: [], loot: [], bodies: [], npcs: [], lights: [] });
      return;
    }
    const spawn = this._buildFromSpec(spec, chunkX, chunkZ, origin);

    this._chunkStructures.set(key, spawn);
    if (this.mergeStatic) this._mergeStaticMeshes(spawn, key);

    // Static masonry — freeze world matrices so Babylon skips per-frame updates
    for (const m of spawn.meshes) {
      m.freezeWorldMatrix();
      if (this.lodSystem) {
        this.lodSystem.register(m, this.lodSystem.getConfig().distanceThresholds.ultraFar);
      }
    }
    if (this.lodSystem) {
      for (const l of spawn.loot) {
        if (l.mesh) {
          this.lodSystem.register(l.mesh, this.lodSystem.getConfig().distanceThresholds.near);
        }
      }
      for (const npc of spawn.npcs) {
        if (npc.mesh) {
          this.lodSystem.register(npc.mesh, this.lodSystem.getConfig().distanceThresholds.medium);
        }
      }
    }
  }

  /**
   * Dispose all spawned structures across every tracked chunk.
   * Call this when tearing down the scene entirely.
   */
  public dispose(): void {
    for (const [, spawn] of this._chunkStructures) {
      for (const body of spawn.bodies) body.dispose();
      for (const m of spawn.colliders ?? []) m.dispose(false, false);
      for (const m of spawn.meshes) {
        this.lodSystem?.unregister(m);
        this._shadows?.removeShadowCaster(m, false);
        m.dispose(false, false);
      }
      for (const l of spawn.loot) {
        if (l.mesh) this.lodSystem?.unregister(l.mesh);
        l.dispose();
      }
      for (const l of spawn.lights) l.dispose();
      for (const npc of spawn.npcs) {
        if (npc.mesh) this.lodSystem?.unregister(npc.mesh);
        this.events?.emit("npc:removed", { npc });
        npc.mesh.dispose();
      }
    }
    this._chunkStructures.clear();
  }

  /**
   * Toggle visibility of all structure-related meshes (walls, props, loot, NPCs).
   * Used by WorldManager when switching between overworld and interior cells.
   */
  public setVisible(visible: boolean): void {
    for (const spawn of this._chunkStructures.values()) {
      for (const m of spawn.meshes) m.isVisible = visible;
      for (const l of spawn.loot) if (l.mesh) l.mesh.isVisible = visible;
      for (const npc of spawn.npcs) if (npc.mesh) npc.mesh.isVisible = visible;
    }
  }

  /**
   * Dispose all meshes, physics, and loot for an unloading chunk.
   * NPCs are disposed UNLESS they are currently in combat or dialogue.
   */
  public disposeChunk(chunkX: number, chunkZ: number): void {
    const key = `${chunkX},${chunkZ}`;
    const spawn = this._chunkStructures.get(key);
    if (!spawn) return;

    // Dispose physics bodies BEFORE their meshes to avoid dangling references
    for (const body of spawn.bodies) body.dispose();
    for (const m of spawn.colliders ?? []) m.dispose(false, false);
    // Materials are shared across all structure instances — preserve them
    for (const m of spawn.meshes) {
      this.lodSystem?.unregister(m);
      this._shadows?.removeShadowCaster(m, false);
      m.dispose(false, false);
    }
    for (const l of spawn.loot) {
      if (l.mesh) this.lodSystem?.unregister(l.mesh);
      l.dispose();
    }
    // Torches/campfires own a PointLight each — dispose or scene.lights grows forever
    for (const l of spawn.lights) l.dispose();
    spawn.lights.length = 0;

    // Clean up NPCs that aren't "busy" tracking the player or in dialogue.
    // If they ARE busy, we let them persist (they'll likely never be unloaded
    // because the player is right there, but safety first).
    const remainingNPCs: NPC[] = [];
    for (const npc of spawn.npcs) {
        if (npc.isDead) {
            // Corpses are disposed with their chunk — we rely on RespawnSystem
            // (or future persistence) to know they shouldn't return yet.
            this.events?.emit("npc:removed", { npc });
            npc.mesh.dispose();
            continue;
        }

        // HEURISTIC: If NPC is aggressive (chasing/attacking), in dialogue, or dead?
        // Actually, if dead they get cleaned up (rely on RespawnSystem).
        // If "busy" (dialogue/combat), skip dispose to avoid breaking gameplay flow.
        if (npc.isAggressive || npc.isInDialogue) {
            remainingNPCs.push(npc);
            continue;
        }

        this.events?.emit("npc:removed", { npc });
        npc.mesh.dispose();
    }

    if (remainingNPCs.length > 0) {
        spawn.npcs = remainingNPCs;
        // Don't fully delete from map yet if NPCs remain?
        // Actually, better to keep the entry so they aren't double-spawned later.
    } else {
        this._chunkStructures.delete(key);
    }
  }

  // ─── Structure builders ────────────────────────────────────────────────────

  /** Build a structure from its spec (`content/structures.ts`), part by part, in order. */
  private _buildFromSpec(spec: StructureSpec, cx: number, cz: number, origin: Vector3): StructureSpawn {
    const meshes: Mesh[] = [];
    const loot: Loot[] = [];
    const bodies: PhysicsAggregate[] = [];
    const lights: PointLight[] = [];
    const npcs: NPC[] = [];
    const c = `${cx}_${cz}`;
    const named = (name: string) => name.replace("{c}", c);
    const num = (v: Rolled): number => {
      if (typeof v === "number") return v;
      if ("jitter" in v) return (this._rand(cx, cz, v.jitter) - 0.5) * v.spread;
      return v.base + this._rand(cx, cz, v.slot) * v.range;
    };
    const rgb = (v: readonly [number, number, number]) => new Color3(v[0], v[1], v[2]);
    const material = (key: string, m: StructureMaterial) => this._mat(
      key, rgb(m.diffuse), rgb(m.specular), m.power,
      m.emissive || m.disableLighting ? { emissive: m.emissive ? rgb(m.emissive) : undefined, disableLighting: m.disableLighting } : undefined,
    );
    const shared = (key: string): StructureMaterial => {
      const m = spec.materials[key];
      if (!m) throw new Error(`structure '${spec.id}' uses material '${key}' it doesn't define`);
      return m;
    };
    for (const [key, m] of Object.entries(spec.materials)) material(key, m);
    const at = (dx: number, y: number, dz: number) => new Vector3(origin.x + dx, y, origin.z + dz);

    for (const part of spec.parts) {
      if ("box" in part) {
        const w = num(part.w), h = num(part.h), d = num(part.d);
        const box = MeshBuilder.CreateBox(named(part.box), { width: w, height: h, depth: d }, this._scene);
        box.position.set(origin.x + num(part.dx), part.y ?? h / 2, origin.z + num(part.dz));
        if (part.rotY !== undefined) box.rotation.y = num(part.rotY);
        box.material = typeof part.mat === "string" ? material(part.mat, shared(part.mat)) : material(part.mat.name, part.mat);
        if (part.collider) bodies.push(new PhysicsAggregate(box, PhysicsShapeType.BOX, { mass: 0 }, this._scene));
        meshes.push(part.shadow ? this._shadow(box) : box);
      } else if ("chest" in part) {
        const { mesh, body } = this._addChest(named(part.chest), at(part.dx, 0, part.dz), loot, cx, cz, part.slot);
        meshes.push(mesh);
        bodies.push(body);
      } else if ("torch" in part) {
        this._addTorch(named(part.torch), at(part.dx, part.y, part.dz), meshes, lights);
      } else if ("campfire" in part) {
        this._addCampfire(named(part.campfire), at(part.dx, 0, part.dz), meshes, lights);
      } else if ("barrel" in part) {
        this._addBarrel(named(part.barrel), at(part.dx, 0, part.dz), meshes, bodies);
      } else if ("banner" in part) {
        this._addBanner(named(part.banner), at(part.dx, 0, part.dz), rgb(part.color), part.mat, meshes);
      } else if ("stone" in part) {
        this._addStandingStone(named(part.stone), at(part.dx, 0, part.dz), num(part.height), meshes, bodies);
      } else if ("relic" in part) {
        const id = named(part.relic);
        if (!this.isLootCollected?.(id)) {
          loot.push(new Loot(this._scene, at(part.dx, part.y, part.dz), { id, stackable: false, quantity: 1, ...part.item, stats: { ...part.item.stats } }));
        }
      } else {
        const npc = new NPC(this._scene, at(part.dx, 2, part.dz), `${part.npc}_${c}`);
        npc.aggroRange = part.aggroRange;
        npc.attackDamage = part.attackDamage;
        npc.xpReward = part.xpReward;
        npc.patrolPoints = part.patrol.map(([dx, dz]) => at(dx, 2, dz));
        this.events?.emit("npc:spawned", { npc });
        npcs.push(npc);
      }
    }
    return { meshes, loot, bodies, npcs, lights };
  }

  // ─── Fantasy props ─────────────────────────────────────────────────────────

  /**
   * Place a wall-mounted torch sconce: iron bracket cylinder + flame cone with
   * emissive warm-orange glow and a dynamic PointLight. ambient.
   */
  private _addTorch(name: string, position: Vector3, meshes: Mesh[], lights: PointLight[]): void {
    // Iron sconce bracket
    const bracket = MeshBuilder.CreateCylinder(
      `${name}_bracket`,
      { height: 0.12, diameterTop: 0.08, diameterBottom: 0.10, tessellation: 8 },
      this._scene,
    );
    bracket.position.set(position.x, position.y, position.z);
    bracket.material = this._mat("torch_iron", new Color3(0.18, 0.14, 0.09), new Color3(0.28, 0.22, 0.10), 64);
    meshes.push(bracket);

    // Torch handle
    const handle = MeshBuilder.CreateCylinder(
      `${name}_handle`,
      { height: 0.45, diameterTop: 0.06, diameterBottom: 0.08, tessellation: 8 },
      this._scene,
    );
    handle.position.set(position.x, position.y + 0.28, position.z);
    handle.material = this._mat("torch_wood", new Color3(0.30, 0.18, 0.06), new Color3(0.08, 0.05, 0.02), 12);
    meshes.push(handle);

    // Flame head — emissive warm orange, no shadowing
    const flame = MeshBuilder.CreateCylinder(
      `${name}_flame`,
      { height: 0.30, diameterTop: 0.0, diameterBottom: 0.13, tessellation: 6 },
      this._scene,
    );
    flame.position.set(position.x, position.y + 0.65, position.z);
    flame.material = this._mat(
      "torch_flame",
      new Color3(1.0, 0.45, 0.05),
      new Color3(0.0, 0.0, 0.0),
      1,
      { emissive: new Color3(1.0, 0.35, 0.02), disableLighting: true },
    );
    meshes.push(flame);

    // Warm point light simulating the fire glow
    const light = new PointLight(`${name}_light`, new Vector3(position.x, position.y + 0.7, position.z), this._scene);
    light.diffuse   = new Color3(1.0, 0.58, 0.15);
    light.specular  = new Color3(0.9, 0.45, 0.05);
    light.intensity = 0.85;
    light.range     = 6.0;
    lights.push(light);
    this.onFire?.({ flame, light, kind: "torch" });
  }

  /**
   * Place a campfire: ring of log stumps + flame cone with PointLight.
   * Guards' resting spot — warm dungeon atmosphere.
   */
  private _addCampfire(name: string, position: Vector3, meshes: Mesh[], lights: PointLight[]): void {
    const logMat = this._mat("campfire_log", new Color3(0.28, 0.14, 0.05), new Color3(0.05, 0.03, 0.01), 10);
    const stoneMat = this._mat("campfire_stone", new Color3(0.40, 0.36, 0.30), new Color3(0.08, 0.07, 0.06), 18);

    // Ring of small stones
    const stoneCount = 6;
    const stoneR    = 0.55;
    for (let i = 0; i < stoneCount; i++) {
      const angle = (i / stoneCount) * Math.PI * 2;
      const stone = MeshBuilder.CreateBox(
        `${name}_stone_${i}`,
        { width: 0.18, height: 0.12, depth: 0.18 },
        this._scene,
      );
      stone.position.set(
        position.x + Math.cos(angle) * stoneR,
        position.y + 0.06,
        position.z + Math.sin(angle) * stoneR,
      );
      stone.rotation.y = angle;
      stone.material   = stoneMat;
      meshes.push(stone);
    }

    // Two crossed logs
    for (let i = 0; i < 2; i++) {
      const log = MeshBuilder.CreateCylinder(
        `${name}_log_${i}`,
        { height: 0.85, diameterTop: 0.09, diameterBottom: 0.11, tessellation: 8 },
        this._scene,
      );
      log.rotation.z = Math.PI / 2;
      log.rotation.y = (i * Math.PI) / 2;
      log.position.set(position.x, position.y + 0.08, position.z);
      log.material = logMat;
      meshes.push(log);
    }

    // Flame
    const flame = MeshBuilder.CreateCylinder(
      `${name}_flame`,
      { height: 0.50, diameterTop: 0.0, diameterBottom: 0.22, tessellation: 6 },
      this._scene,
    );
    flame.position.set(position.x, position.y + 0.38, position.z);
    flame.material = this._mat(
      "campfire_flame",
      new Color3(1.0, 0.40, 0.04),
      new Color3(0.0, 0.0, 0.0),
      1,
      { emissive: new Color3(1.0, 0.30, 0.02), disableLighting: true },
    );
    meshes.push(flame);

    // Firelight
    const light = new PointLight(`${name}_light`, new Vector3(position.x, position.y + 0.6, position.z), this._scene);
    light.diffuse   = new Color3(1.0, 0.55, 0.12);
    light.specular  = new Color3(0.9, 0.42, 0.04);
    light.intensity = 1.2;
    light.range     = 8.0;
    lights.push(light);
    this.onFire?.({ flame, light, kind: "campfire" });
  }

  /**
   * Place a wooden barrel with iron bands. Stacked beside structures for
   * a lived-in feel.
   */
  private _addBarrel(name: string, position: Vector3, meshes: Mesh[], bodies: PhysicsAggregate[]): void {
    const woodMat = this._mat("barrel_wood", new Color3(0.42, 0.26, 0.08), new Color3(0.10, 0.06, 0.02), 14);
    const ironMat = this._mat("barrel_iron", new Color3(0.20, 0.18, 0.15), new Color3(0.30, 0.28, 0.22), 56);

    // Main barrel body
    const barrel = MeshBuilder.CreateCylinder(
      `${name}_body`,
      { height: 0.75, diameterTop: 0.40, diameterBottom: 0.38, tessellation: 12 },
      this._scene,
    );
    barrel.position.set(position.x, position.y + 0.38, position.z);
    barrel.material = woodMat;
    bodies.push(new PhysicsAggregate(barrel, PhysicsShapeType.CYLINDER, { mass: 0 }, this._scene));
    meshes.push(this._shadow(barrel));

    // Iron band rings (top, middle, bottom)
    const bandOffsets = [0.28, 0.0, -0.28];
    for (let i = 0; i < bandOffsets.length; i++) {
      const band = MeshBuilder.CreateTorus(
        `${name}_band_${i}`,
        { diameter: 0.44, thickness: 0.04, tessellation: 12 },
        this._scene,
      );
      band.position.set(position.x, position.y + 0.38 + bandOffsets[i], position.z);
      band.material = ironMat;
      meshes.push(band);
    }
  }

  /**
   * Place a faction banner: a tall pole with a coloured pennant.
   * Marks guard camps and ruins for an occupied fort feel.
   * @param materialKey  Stable key for the pennant colour — used to share the material across chunks.
   */
  private _addBanner(name: string, position: Vector3, bannerColor: Color3, materialKey: string, meshes: Mesh[]): void {
    const poleMat = this._mat("banner_pole", new Color3(0.22, 0.15, 0.06), new Color3(0.06, 0.04, 0.01), 12);

    // Wooden pole
    const pole = MeshBuilder.CreateCylinder(
      `${name}_pole`,
      { height: 3.2, diameterTop: 0.06, diameterBottom: 0.08, tessellation: 8 },
      this._scene,
    );
    pole.position.set(position.x, position.y + 1.6, position.z);
    pole.material = poleMat;
    meshes.push(this._shadow(pole));

    // Fabric pennant — emissive so it reads even in shadow
    const pennant = MeshBuilder.CreatePlane(
      `${name}_pennant`,
      { width: 0.8, height: 1.1 },
      this._scene,
    );
    pennant.position.set(position.x + 0.4, position.y + 2.9, position.z);
    pennant.rotation.y = Math.PI / 2;
    pennant.material = this._mat(
      `banner_pennant_${materialKey}`,
      bannerColor,
      new Color3(0, 0, 0),
      1,
      {
        emissive: new Color3(bannerColor.r * 0.25, bannerColor.g * 0.25, bannerColor.b * 0.25),
        backFaceCulling: false,
      },
    );
    meshes.push(pennant);
  }

  /**
   * Place a carved standing stone / monolith.  Scattered throughout the world
   * as waymarkers and ancient Ayleid remnants.
   */
  private _addStandingStone(name: string, position: Vector3, height: number, meshes: Mesh[], bodies: PhysicsAggregate[]): void {
    const stoneMat = this._mat(
      "standing_stone",
      new Color3(0.35, 0.32, 0.28),
      new Color3(0.12, 0.11, 0.09),
      36,
    );

    // Main upright stone — slightly irregular by rotating slightly
    const stone = MeshBuilder.CreateBox(
      `${name}_stone`,
      { width: 0.55 + height * 0.06, height, depth: 0.25 + height * 0.04 },
      this._scene,
    );
    stone.position.set(position.x, position.y + height / 2, position.z);
    // Slight lean, fixed by where the stone stands (it used to be re-rolled
    // unseeded on every load).
    stone.rotation.y = (Math.abs(Math.sin(position.x * 12.9898 + position.z * 78.233)) % 1) * 0.3 - 0.15;
    stone.material   = stoneMat;
    bodies.push(new PhysicsAggregate(stone, PhysicsShapeType.BOX, { mass: 0 }, this._scene));
    meshes.push(this._shadow(stone));

    // Moss / lichen cap slab
    const cap = MeshBuilder.CreateBox(
      `${name}_cap`,
      { width: 0.70, height: 0.12, depth: 0.38 },
      this._scene,
    );
    cap.position.set(position.x, position.y + height + 0.05, position.z);
    cap.material = this._mat("standing_stone_cap", new Color3(0.30, 0.38, 0.25), new Color3(0.06, 0.08, 0.04), 20);
    meshes.push(cap);
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

    const lootId = `chest_gold_${cx}_${cz}_${slot}`;
    if (!this.isLootCollected?.(lootId)) {
      const coins = new Loot(this._scene, new Vector3(position.x + 0.6, 1.0, position.z), {
        id: lootId,
        name: "Gold Coins",
        description: "A handful of gold coins.",
        stackable: true,
        quantity: 1 + Math.floor(this._rand(cx, cz, slot + 50) * 5),
        stats: {},
      });
      lootArr.push(coins);
    }
    return { mesh: chest, body };
  }

  /**
   * Called for every torch / campfire flame so the renderer can add fire
   * particles and flicker (see rendering/fire-fx.ts).  Null in tests.
   */
  public onFire: ((info: { flame: Mesh; light: PointLight; kind: "torch" | "campfire" }) => void) | null = null;

  /**
   * Merge each spawn's static pieces per material (one draw call per material
   * per structure instead of one per stone/plank/barrel).  Enabled by the
   * game; off in unit tests that mock mesh merging.
   */
  public mergeStatic = false;

  /** Merged groups smaller than this (bounding diagonal, m) don't cast shadows. */
  public minShadowCasterSize = 1.2;

  private _mergeStaticMeshes(spawn: StructureSpawn, key: string): void {
    const bodyMeshes = new Set(spawn.bodies.map((b) => b.transformNode));
    const casters = new Set(this._shadows?.getShadowMap()?.renderList ?? []);
    const groups = new Map<StandardMaterial, Mesh[]>();
    for (const m of spawn.meshes) {
      const mat = m.material;
      if (!(mat instanceof StandardMaterial)) continue;
      // Flames (FireFx), interactive pieces and parented parts stay separate.
      if (m.metadata || m.parent || /flame/i.test(m.name) || mat.disableLighting) continue;
      const g = groups.get(mat) ?? [];
      g.push(m);
      groups.set(mat, g);
    }
    const consumed = new Set<Mesh>();
    let i = 0;
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const merged = Mesh.MergeMeshes(group, false, true);
      if (!merged) continue;
      merged.name = `struct_merged_${key}_${i++}`;
      merged.receiveShadows = true;
      const castsShadow = group.some((m) => casters.has(m));
      const size = merged.getBoundingInfo().boundingBox.extendSizeWorld.length() * 2;
      if (castsShadow && size >= this.minShadowCasterSize) this._shadows?.addShadowCaster(merged, false);
      for (const m of group) {
        consumed.add(m);
        this._shadows?.removeShadowCaster(m, false);
        if (bodyMeshes.has(m)) {
          // Physics keeps its mesh; it just stops drawing.
          m.isVisible = false;
          (spawn.colliders ??= []).push(m);
        } else {
          m.dispose(false, false);
        }
      }
      spawn.meshes.push(merged);
    }
    if (consumed.size > 0) spawn.meshes = spawn.meshes.filter((m) => !consumed.has(m));
    // Lone tiny props don't need to cast shadows either.
    for (const m of spawn.meshes) {
      if (!casters.has(m)) continue;
      const size = m.getBoundingInfo().boundingBox.extendSizeWorld.length() * 2;
      if (size < this.minShadowCasterSize * 0.5) this._shadows?.removeShadowCaster(m, false);
    }
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
  private _mat(
    name: string,
    diffuse: Color3,
    specular    = new Color3(0.10, 0.10, 0.10),
    specularPower = 24,
    opts?: { emissive?: Color3; disableLighting?: boolean; backFaceCulling?: boolean }
  ): StandardMaterial {
    let mat = this._sharedMaterials.get(name);
    if (!mat) {
      mat = new StandardMaterial(name, this._scene);
      mat.diffuseColor  = diffuse;
      mat.specularColor = specular;
      mat.specularPower = specularPower;
      if (opts?.emissive)        mat.emissiveColor    = opts.emissive;
      if (opts?.disableLighting) mat.disableLighting  = true;
      if (opts?.backFaceCulling === false) mat.backFaceCulling = false;

      // Attach procedural masonry / timber / metal surfaces (albedo + normal
      // map) when the texture manager is active.  Self-lit materials (flames,
      // glows) stay flat.
      if (this._textureManager && !opts?.disableLighting && !opts?.emissive) {
        const surface = StructureManager.surfaceForMaterial(name);
        if (surface) this._textureManager.applySurface(mat, surface, 2, 2);
      }

      if (typeof (mat as any).freeze === "function") {
        mat.freeze();
      }
      this._sharedMaterials.set(name, mat);
    }
    return mat;
  }

  /** Synthesized surface used for a shared structure material, by name. */
  public static surfaceForMaterial(name: string): SurfaceKind | null {
    if (name.includes("iron") || name.includes("metal")) return "iron_metal";
    if (name.includes("ruins")) return "stone_ruins";
    if (name.includes("shrine") || name.includes("sandstone")) return "desert_sandstone";
    if (name.includes("tower") || name.includes("wood") || name.includes("timber")
      || name.includes("log") || name.includes("pole")) return "watchtower_timber";
    if (name.includes("stone") || name.includes("altar") || name.includes("rune")) return "mossy_stone";
    return null;
  }

  /** Deterministic pseudo-random in [0, 1) seeded by chunk coords and slot.
   *  Delegates to the active `WorldSeed` when one is provided. */
  private _rand(cx: number, cz: number, slot: number): number {
    if (this._seed) return this._seed.rand(cx, cz, slot);
    return Math.abs(Math.sin(cx * 217.3 + cz * 431.9 + slot * 83.1)) % 1;
  }
}
