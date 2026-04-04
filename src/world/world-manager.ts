import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType } from "@babylonjs/core/Physics";
import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { StructureManager } from "./structure-manager";
import { ObjectPool } from "../systems/object-pool";
import type { WorldSeed } from "./world-seed";

export type BiomeType = "plains" | "forest" | "desert" | "tundra";

type LoadQueueEntry = {
  cx: number;
  cz: number;
  key: string;
  dist: number;
};

export class WorldManager {
  private scene: Scene;
  /** World-unit side-length of each terrain chunk. */
  public readonly chunkSize: number = 50;
  private loadedChunks: Map<string, { mesh: Mesh; body: PhysicsAggregate; cx: number; cz: number }> = new Map();
  private chunkVegetation: Map<string, Mesh[]> = new Map();
  private loadDistance: number = 2; // Chebyshev radius of chunks to load
  private unloadDistance: number = 4; // Chunks beyond this Chebyshev distance are disposed

  /** Manages procedural structures (ruins, shrines, towers) per chunk. */
  public structures: StructureManager;

  // Throttle: only run the chunk management sweep every N frames
  private _frameCounter: number = 0;
  private _updateInterval: number = 10;

  /**
   * Load queue: chunks waiting to be created, sorted closest-first.
   * Drained at most `_loadBudgetPerFrame` entries per `update()` call so that
   * entering a new area does not spike all chunk geometry into a single frame.
   */
  private _loadQueue: LoadQueueEntry[] = [];
  /** Keys already present in `_loadQueue` — prevents duplicate enqueue. */
  private _enqueuedKeys: Set<string> = new Set();
  /** Maximum chunks created per `update()` call to cap per-frame build cost. */
  private readonly _loadBudgetPerFrame: number = 2;
  /** Last player chunk position; used by `_processLoadQueue` to skip stale entries. */
  private _lastPlayerChunkX: number = 0;
  private _lastPlayerChunkZ: number = 0;

  /** Reuses ephemeral queue-entry objects to avoid chunk-streaming allocations. */
  private readonly _loadQueueEntryPool = new ObjectPool<LoadQueueEntry>(
    () => ({ cx: 0, cz: 0, key: "", dist: 0 }),
    (entry) => {
      entry.cx = 0;
      entry.cz = 0;
      entry.key = "";
      entry.dist = 0;
    },
    32,
    256,
  );

  /**
   * Fires immediately after a chunk finishes being built and registered.
   * Receives the chunk grid coordinates and its biome type.
   */
  public onChunkLoaded: ((cx: number, cz: number, biome: BiomeType) => void) | null = null;

  /**
   * Fires immediately after a chunk is removed from the scene (distance-based unload).
   * Does **not** fire during `dispose()` — use that for full teardown scenarios.
   */
  public onChunkUnloaded: ((cx: number, cz: number) => void) | null = null;

  private readonly biomeMaterials: Map<BiomeType, StandardMaterial> = new Map();
  private treeTrunkMaterial?: StandardMaterial;
  private readonly treeCrownMaterials: Map<number, StandardMaterial> = new Map();
  private cactusMaterial?: StandardMaterial;
  private iceMaterial?: StandardMaterial;

  /** Shared material cache for fantasy environment props — avoids getMaterialByName calls. */
  private readonly _envMaterials: Map<string, StandardMaterial> = new Map();

  /** Optional shadow generator — meshes added as shadow casters when provided. */
  private readonly _shadows: ShadowGenerator | null;

  /**
   * Optional world seed — drives biome layout and structure placement when set.
   *
   * Two-phase initialization: `null` on construction (before character
   * creation), then replaced by `setSeed()` once the player finishes the
   * character creation wizard and before the first chunk is streamed in.
   */
  private _seed: WorldSeed | null;

  constructor(scene: Scene, shadowGenerator: ShadowGenerator | null = null, seed: WorldSeed | null = null) {
    this.scene = scene;
    this._shadows = shadowGenerator;
    this._seed = seed;
    this.structures = new StructureManager(scene, shadowGenerator, seed);
  }

  /**
   * Replace the active world seed.  Must be called before any chunks are
   * loaded (e.g. immediately after character creation and before the first
   * `update()` tick) to avoid biome inconsistencies between already-loaded
   * and future chunks.
   */
  public setSeed(seed: WorldSeed | null): void {
    this._seed = seed;
    this.structures.setSeed(seed);
  }

  // ── Debug / test accessors ─────────────────────────────────────────────────

  /** Number of chunks currently loaded and visible. */
  public get loadedChunkCount(): number {
    return this.loadedChunks.size;
  }

  /** Number of chunks waiting in the deferred load queue. */
  public get loadQueueLength(): number {
    return this._loadQueue.length;
  }

  /** Number of idle queue-entry objects available for immediate reuse. */
  public get loadQueuePoolSize(): number {
    return this._loadQueueEntryPool.size;
  }

  /** Total queue-entry objects ever allocated for chunk streaming. */
  public get loadQueueEntriesAllocated(): number {
    return this._loadQueueEntryPool.totalAllocated;
  }

  /**
   * Determine the biome for a given chunk coordinate.
   * Uses the active `WorldSeed` when one is set; otherwise falls back to the
   * default deterministic trig hash so existing behaviour is preserved.
   */
  public getBiome(chunkX: number, chunkZ: number): BiomeType {
    if (this._seed) return this._seed.getBiome(chunkX, chunkZ);
    const v = Math.sin(chunkX * 0.5 + chunkZ * 0.3) * Math.cos(chunkX * 0.2 - chunkZ * 0.7);
    const n = (v + 1) / 2; // normalise to [0, 1]
    if (n < 0.25) return "tundra";
    if (n < 0.5)  return "plains";
    if (n < 0.75) return "forest";
    return "desert";
  }

  public update(playerPosition: Vector3): void {
    // Always track the player's current chunk so the stale-entry filter in
    // _processLoadQueue uses the most up-to-date position every frame.
    const chunkX = Math.floor(playerPosition.x / this.chunkSize);
    const chunkZ = Math.floor(playerPosition.z / this.chunkSize);
    const chunkChanged = chunkX !== this._lastPlayerChunkX || chunkZ !== this._lastPlayerChunkZ;
    this._lastPlayerChunkX = chunkX;
    this._lastPlayerChunkZ = chunkZ;

    if (chunkChanged && this._loadQueue.length > 0) {
      this._pruneStaleQueueEntries(chunkX, chunkZ);
    }

    // Always drain the load queue (bounded work every frame regardless of interval)
    this._processLoadQueue();

    // Run the chunk management sweep every _updateInterval frames
    if (++this._frameCounter % this._updateInterval !== 0) return;

    this._enqueueMissingChunks(chunkX, chunkZ);

    // Unload chunks that are too far from the player
    for (const [key, { mesh, body, cx, cz }] of this.loadedChunks) {
      if (Math.abs(cx - chunkX) > this.unloadDistance || Math.abs(cz - chunkZ) > this.unloadDistance) {
        // Dispose physics body BEFORE the mesh to avoid dangling references
        body.dispose();
        // Dispose geometry only — biome materials are shared and must not be destroyed here
        mesh.dispose(false, false);
        this.loadedChunks.delete(key);

        // Dispose vegetation meshes for this chunk
        const veg = this.chunkVegetation.get(key);
        if (veg) {
          // Trunk/crown/cactus/ice materials are shared pools — preserve them.
          for (const m of veg) m.dispose(false, false);
          this.chunkVegetation.delete(key);
        }

        // Dispose structure meshes, physics, and loot for this chunk
        this.structures.disposeChunk(cx, cz);
        this.onChunkUnloaded?.(cx, cz);
      }
    }
  }

  /**
   * Dispose all loaded chunks, vegetation, queued entries, and structures.
   * Call this when tearing down the scene to release GPU and physics resources.
   */
  public dispose(): void {
    // Drain the load queue without spawning anything
    this._releaseLoadQueueEntries();
    this._enqueuedKeys.clear();

    // Dispose all loaded chunks (physics then mesh)
    for (const [key, { mesh, body, cx, cz }] of this.loadedChunks) {
      body.dispose();
      mesh.dispose(false, false);

      const veg = this.chunkVegetation.get(key);
      if (veg) {
        for (const m of veg) m.dispose(false, false);
        this.chunkVegetation.delete(key);
      }

      this.structures.disposeChunk(cx, cz);
    }
    this.loadedChunks.clear();
    this.chunkVegetation.clear();
    this._loadQueueEntryPool.clear();
  }

  /**
   * Drain up to `_loadBudgetPerFrame` entries from the load queue.
   * Called every frame so chunk creation is spread across many frames
   * rather than concentrated in a single update sweep.
   */
  private _processLoadQueue(): void {
    const budget = Math.min(this._loadBudgetPerFrame, this._loadQueue.length);
    for (let i = 0; i < budget; i++) {
      const entry = this._loadQueue.shift()!;
      this._enqueuedKeys.delete(entry.key);
      // Skip if the player has moved far enough that this chunk is no longer needed.
      // Use Chebyshev distance (max of abs-differences) to match the sort metric.
      const chebyshev = Math.max(
        Math.abs(entry.cx - this._lastPlayerChunkX),
        Math.abs(entry.cz - this._lastPlayerChunkZ),
      );
      if (chebyshev <= this.loadDistance && !this.loadedChunks.has(entry.key)) {
        this._loadChunk(entry.cx, entry.cz);
      }
      this._loadQueueEntryPool.release(entry);
    }
  }

  /** Drop queued chunks that no longer belong near the current player chunk. */
  private _pruneStaleQueueEntries(chunkX: number, chunkZ: number): void {
    if (this._loadQueue.length === 0) return;

    const retained: LoadQueueEntry[] = [];
    for (const entry of this._loadQueue) {
      entry.dist = Math.max(Math.abs(entry.cx - chunkX), Math.abs(entry.cz - chunkZ));
      if (entry.dist <= this.loadDistance) {
        retained.push(entry);
      } else {
        this._enqueuedKeys.delete(entry.key);
        this._loadQueueEntryPool.release(entry);
      }
    }

    retained.sort((a, b) => a.dist - b.dist);
    this._loadQueue = retained;
  }

  /** Add all missing chunks in load range, reusing queue-entry objects from the pool. */
  private _enqueueMissingChunks(chunkX: number, chunkZ: number): void {
    const toEnqueue: LoadQueueEntry[] = [];
    for (let x = chunkX - this.loadDistance; x <= chunkX + this.loadDistance; x++) {
      for (let z = chunkZ - this.loadDistance; z <= chunkZ + this.loadDistance; z++) {
        const key = `${x},${z}`;
        if (!this.loadedChunks.has(key) && !this._enqueuedKeys.has(key)) {
          const entry = this._loadQueueEntryPool.acquire();
          entry.cx = x;
          entry.cz = z;
          entry.key = key;
          entry.dist = Math.max(Math.abs(x - chunkX), Math.abs(z - chunkZ));
          toEnqueue.push(entry);
        }
      }
    }

    toEnqueue.sort((a, b) => a.dist - b.dist);
    for (const entry of toEnqueue) {
      this._enqueuedKeys.add(entry.key);
      this._loadQueue.push(entry);
    }
  }

  /** Return every queued entry object to the pool. */
  private _releaseLoadQueueEntries(): void {
    for (const entry of this._loadQueue) {
      this._loadQueueEntryPool.release(entry);
    }
    this._loadQueue = [];
  }

  private _loadChunk(x: number, z: number): void {
    const key = `${x},${z}`;
    if (this.loadedChunks.has(key)) {
      return;
    }

    const biome = this.getBiome(x, z);

    // Create ground for this chunk
    const chunkMesh = MeshBuilder.CreateGround(`chunk_${key}`, { width: this.chunkSize, height: this.chunkSize, subdivisions: 4 }, this.scene);
    // Position is center of mesh, so offset by half size
    chunkMesh.position.x = x * this.chunkSize;
    chunkMesh.position.z = z * this.chunkSize;

    // Enable collisions for camera
    chunkMesh.checkCollisions = true;

    // Store the aggregate so it can be explicitly disposed when the chunk unloads
    const body = new PhysicsAggregate(chunkMesh, PhysicsShapeType.BOX, { mass: 0 }, this.scene);

    // Biome-specific terrain material with specular
    chunkMesh.material = this._getBiomeMaterial(biome);
    // Ground receives but does not cast shadows
    chunkMesh.receiveShadows = true;

    this.loadedChunks.set(key, { mesh: chunkMesh, body, cx: x, cz: z });

    // Spawn vegetation for this chunk
    const vegMeshes = this._spawnVegetation(x, z, biome);
    if (vegMeshes.length > 0) {
      this.chunkVegetation.set(key, vegMeshes);
    }

    // Spawn a structure for this chunk (ruins, shrine, or tower based on biome)
    this.structures.trySpawnForChunk(x, z, biome, this.chunkSize);

    this.onChunkLoaded?.(x, z, biome);
  }

  /** Returns per-biome diffuse and specular colours for richer, more saturated terrain. */
  private _getBiomeColors(biome: BiomeType): { diffuse: Color3; specular: Color3; specularPower: number } {
    switch (biome) {
      case "plains": return {
        diffuse:       new Color3(0.30, 0.58, 0.18),
        specular:      new Color3(0.08, 0.14, 0.05),
        specularPower: 24,
      };
      case "forest": return {
        diffuse:       new Color3(0.10, 0.34, 0.08),
        specular:      new Color3(0.05, 0.10, 0.04),
        specularPower: 18,
      };
      case "desert": return {
        diffuse:       new Color3(0.88, 0.74, 0.40),
        specular:      new Color3(0.22, 0.16, 0.06),
        specularPower: 48,
      };
      case "tundra": return {
        diffuse:       new Color3(0.90, 0.94, 0.98),
        specular:      new Color3(0.45, 0.52, 0.60),
        specularPower: 96,
      };
    }
  }

  private _getBiomeMaterial(biome: BiomeType): StandardMaterial {
    let material = this.biomeMaterials.get(biome);
    if (!material) {
      const cols = this._getBiomeColors(biome);
      material = new StandardMaterial(`mat_${biome}`, this.scene);
      material.diffuseColor  = cols.diffuse;
      material.specularColor = cols.specular;
      material.specularPower = cols.specularPower;
      material.freeze();
      this.biomeMaterials.set(biome, material);
    }

    return material;
  }

  private _getTreeTrunkMaterial(): StandardMaterial {
    if (!this.treeTrunkMaterial) {
      this.treeTrunkMaterial = new StandardMaterial("tree_trunk_mat", this.scene);
      this.treeTrunkMaterial.diffuseColor  = new Color3(0.34, 0.19, 0.06);
      this.treeTrunkMaterial.specularColor = new Color3(0.06, 0.04, 0.01);
      this.treeTrunkMaterial.specularPower = 12;
      this.treeTrunkMaterial.freeze();
    }

    return this.treeTrunkMaterial;
  }

  private _getTreeCrownMaterial(scale: number): StandardMaterial {
    // Quantize variation to reduce material count while keeping visual diversity.
    const bucket = Math.round(scale * 4);
    let material = this.treeCrownMaterials.get(bucket);
    if (!material) {
      const greenShift = bucket / 4;
      material = new StandardMaterial(`tree_crown_mat_${bucket}`, this.scene);
      material.diffuseColor  = new Color3(0.05 + greenShift * 0.06, 0.36 + greenShift * 0.24, 0.04 + greenShift * 0.04);
      material.specularColor = new Color3(0.05, 0.10, 0.04);
      material.specularPower = 18;
      material.freeze();
      this.treeCrownMaterials.set(bucket, material);
    }

    return material;
  }

  private _getCactusMaterial(): StandardMaterial {
    if (!this.cactusMaterial) {
      this.cactusMaterial = new StandardMaterial("cactus_mat", this.scene);
      this.cactusMaterial.diffuseColor  = new Color3(0.14, 0.48, 0.14);
      this.cactusMaterial.specularColor = new Color3(0.10, 0.22, 0.08);
      this.cactusMaterial.specularPower = 28;
      this.cactusMaterial.freeze();
    }

    return this.cactusMaterial;
  }

  private _getIceMaterial(): StandardMaterial {
    if (!this.iceMaterial) {
      this.iceMaterial = new StandardMaterial("ice_mat", this.scene);
      this.iceMaterial.diffuseColor  = new Color3(0.62, 0.82, 1.0);
      this.iceMaterial.specularColor = new Color3(0.80, 0.90, 1.0);
      this.iceMaterial.specularPower = 192;
      this.iceMaterial.emissiveColor = new Color3(0.06, 0.12, 0.22);
      this.iceMaterial.alpha = 0.78;
      this.iceMaterial.freeze();
    }

    return this.iceMaterial;
  }

  /** Register a mesh as a shadow caster if a shadow generator is available. */
  private _addShadowCaster(mesh: Mesh): void {
    this._shadows?.addShadowCaster(mesh, false);
    mesh.receiveShadows = true;
  }

  private _spawnVegetation(chunkX: number, chunkZ: number, biome: BiomeType): Mesh[] {
    const meshes: Mesh[] = [];
    const centerX = chunkX * this.chunkSize;
    const centerZ = chunkZ * this.chunkSize;
    const halfSize = this.chunkSize / 2 - 4; // keep 4 m margin from chunk edges

    // Deterministic pseudo-random seeded by chunk coords
    const rand = (i: number) =>
      Math.abs(Math.sin(chunkX * 127.1 + chunkZ * 311.7 + i * 74.3)) % 1;

    // ── Per-biome prop distribution ──────────────────────────────────────────

    switch (biome) {
      case "forest": {
        // 6 pine trees
        for (let i = 0; i < 6; i++) {
          const px = centerX + (rand(i * 2) * 2 - 1) * halfSize;
          const pz = centerZ + (rand(i * 2 + 1) * 2 - 1) * halfSize;
          meshes.push(...this._spawnTree(px, pz, `tree_${chunkX}_${chunkZ}_${i}`, rand(i * 3)));
        }
        // 2 giant mushrooms — Oblivion Blackwood/Morrowind feel
        for (let i = 0; i < 2; i++) {
          const px = centerX + (rand(100 + i * 2) * 2 - 1) * halfSize;
          const pz = centerZ + (rand(100 + i * 2 + 1) * 2 - 1) * halfSize;
          meshes.push(...this._spawnMushroom(px, pz, `mushroom_${chunkX}_${chunkZ}_${i}`, rand(100 + i * 3)));
        }
        // 1 mossy boulder
        {
          const px = centerX + (rand(120) * 2 - 1) * halfSize;
          const pz = centerZ + (rand(121) * 2 - 1) * halfSize;
          meshes.push(...this._spawnBoulder(px, pz, `boulder_${chunkX}_${chunkZ}`, rand(122)));
        }
        break;
      }

      case "plains": {
        // 2 trees
        for (let i = 0; i < 2; i++) {
          const px = centerX + (rand(i * 2) * 2 - 1) * halfSize;
          const pz = centerZ + (rand(i * 2 + 1) * 2 - 1) * halfSize;
          meshes.push(...this._spawnTree(px, pz, `tree_${chunkX}_${chunkZ}_${i}`, rand(i * 3)));
        }
        // 1–2 ancient standing stones — Oblivion Ayleid waymarkers
        const stoneCount = rand(200) < 0.5 ? 1 : 2;
        for (let i = 0; i < stoneCount; i++) {
          const px = centerX + (rand(200 + i * 2) * 2 - 1) * halfSize;
          const pz = centerZ + (rand(200 + i * 2 + 1) * 2 - 1) * halfSize;
          meshes.push(...this._spawnMonolith(px, pz, `monolith_${chunkX}_${chunkZ}_${i}`, rand(200 + i * 3)));
        }
        // Wildflower cluster — small coloured dots scattered in grass
        if (rand(210) < 0.6) {
          const px = centerX + (rand(211) * 2 - 1) * halfSize;
          const pz = centerZ + (rand(212) * 2 - 1) * halfSize;
          meshes.push(...this._spawnWildflowers(px, pz, `flowers_${chunkX}_${chunkZ}`, rand(213)));
        }
        break;
      }

      case "desert": {
        // 2 cacti
        for (let i = 0; i < 2; i++) {
          const px = centerX + (rand(i * 2) * 2 - 1) * halfSize;
          const pz = centerZ + (rand(i * 2 + 1) * 2 - 1) * halfSize;
          meshes.push(...this._spawnCactus(px, pz, `cactus_${chunkX}_${chunkZ}_${i}`));
        }
        // 1 desert palm (oasis feel)
        {
          const px = centerX + (rand(300) * 2 - 1) * halfSize;
          const pz = centerZ + (rand(301) * 2 - 1) * halfSize;
          meshes.push(...this._spawnDesertPalm(px, pz, `palm_${chunkX}_${chunkZ}`));
        }
        // Scattered sandstone boulders
        if (rand(310) < 0.7) {
          const px = centerX + (rand(311) * 2 - 1) * halfSize;
          const pz = centerZ + (rand(312) * 2 - 1) * halfSize;
          meshes.push(...this._spawnBoulder(px, pz, `sboulder_${chunkX}_${chunkZ}`, rand(313)));
        }
        break;
      }

      case "tundra": {
        // 1–2 ice crystal clusters
        for (let i = 0; i < 2; i++) {
          const px = centerX + (rand(i * 2) * 2 - 1) * halfSize;
          const pz = centerZ + (rand(i * 2 + 1) * 2 - 1) * halfSize;
          meshes.push(...this._spawnIceCrystal(px, pz, `ice_${chunkX}_${chunkZ}_${i}`, rand(i * 3)));
        }
        // Dead twisted trees — Skyrim Winterhold atmosphere
        if (rand(400) < 0.65) {
          const px = centerX + (rand(401) * 2 - 1) * halfSize;
          const pz = centerZ + (rand(402) * 2 - 1) * halfSize;
          meshes.push(...this._spawnDeadTree(px, pz, `deadtree_${chunkX}_${chunkZ}`, rand(403)));
        }
        // Snow boulders
        if (rand(410) < 0.55) {
          const px = centerX + (rand(411) * 2 - 1) * halfSize;
          const pz = centerZ + (rand(412) * 2 - 1) * halfSize;
          meshes.push(...this._spawnSnowBoulder(px, pz, `snowboulder_${chunkX}_${chunkZ}`, rand(413)));
        }
        break;
      }
    }

    return meshes;
  }

  /** Spawn a tree: cylindrical trunk + conical foliage crown for a stylised pine look. */
  private _spawnTree(x: number, z: number, name: string, scale: number): Mesh[] {
    const trunkHeight = 2.5 + scale * 2.5; // 2.5–5 m

    const trunk = MeshBuilder.CreateCylinder(
      `${name}_trunk`,
      { height: trunkHeight, diameterTop: 0.25, diameterBottom: 0.55, tessellation: 8 },
      this.scene
    );
    trunk.position.set(x, trunkHeight / 2, z);
    trunk.material = this._getTreeTrunkMaterial();
    this._addShadowCaster(trunk);

    // Two-tier cone foliage for a pine/fir silhouette
    const crownBase = 1.6 + scale * 1.0; // 1.6–2.6 m radius at bottom tier
    const lowerCrown = MeshBuilder.CreateCylinder(
      `${name}_lower`,
      { height: crownBase * 1.6, diameterTop: 0, diameterBottom: crownBase * 2, tessellation: 8 },
      this.scene
    );
    lowerCrown.position.set(x, trunkHeight + crownBase * 0.5, z);
    lowerCrown.material = this._getTreeCrownMaterial(scale * 0.5);
    this._addShadowCaster(lowerCrown);

    const upperCrown = MeshBuilder.CreateCylinder(
      `${name}_upper`,
      { height: crownBase * 1.2, diameterTop: 0, diameterBottom: crownBase * 1.4, tessellation: 8 },
      this.scene
    );
    upperCrown.position.set(x, trunkHeight + crownBase * 1.4, z);
    upperCrown.material = this._getTreeCrownMaterial(Math.min(1, scale + 0.3));
    this._addShadowCaster(upperCrown);

    return [trunk, lowerCrown, upperCrown];
  }

  /** Spawn a stylised cactus: ribbed body + two arms. */
  private _spawnCactus(x: number, z: number, name: string): Mesh[] {
    const mat = this._getCactusMaterial();

    const body = MeshBuilder.CreateCylinder(
      `${name}_body`,
      { height: 2.8, diameterTop: 0.38, diameterBottom: 0.44, tessellation: 10 },
      this.scene
    );
    body.position.set(x, 1.4, z);
    body.material = mat;
    this._addShadowCaster(body);

    const armL = MeshBuilder.CreateCylinder(
      `${name}_armL`,
      { height: 1.1, diameterTop: 0.22, diameterBottom: 0.28, tessellation: 8 },
      this.scene
    );
    armL.rotation.z = Math.PI / 2.3;
    armL.position.set(x - 0.65, 1.9, z);
    armL.material = mat;
    this._addShadowCaster(armL);

    const armR = MeshBuilder.CreateCylinder(
      `${name}_armR`,
      { height: 1.1, diameterTop: 0.22, diameterBottom: 0.28, tessellation: 8 },
      this.scene
    );
    armR.rotation.z = -Math.PI / 2.3;
    armR.position.set(x + 0.65, 1.9, z);
    armR.material = mat;
    this._addShadowCaster(armR);

    return [body, armL, armR];
  }

  /** Spawn a translucent hexagonal ice crystal cluster. */
  private _spawnIceCrystal(x: number, z: number, name: string, scale: number): Mesh[] {
    const height = 1.0 + scale * 1.6; // 1.0–2.6 m
    const meshes: Mesh[] = [];

    // Main crystal
    const crystal = MeshBuilder.CreateCylinder(
      `${name}_crystal`,
      { height, diameterTop: 0.05, diameterBottom: 0.45 + scale * 0.30, tessellation: 6 },
      this.scene
    );
    crystal.position.set(x, height / 2, z);
    crystal.material = this._getIceMaterial();
    this._addShadowCaster(crystal);
    meshes.push(crystal);

    // Small satellite shard for visual interest
    const shardH = height * 0.55;
    const shard = MeshBuilder.CreateCylinder(
      `${name}_shard`,
      { height: shardH, diameterTop: 0.02, diameterBottom: 0.22, tessellation: 6 },
      this.scene
    );
    shard.rotation.z = 0.35;
    shard.position.set(x + 0.30, shardH / 2 + 0.1, z + 0.15);
    shard.material = this._getIceMaterial();
    this._addShadowCaster(shard);
    meshes.push(shard);

    return meshes;
  }

  // ── Fantasy environment props ──────────────────────────────────────────────

  /**
   * Get or create a cached StandardMaterial for fantasy environment props.
   * Prevents duplicate material allocations without depending on scene.getMaterialByName.
   */
  private _envMat(key: string, create: () => StandardMaterial): StandardMaterial {
    let mat = this._envMaterials.get(key);
    if (!mat) {
      mat = create();
      this._envMaterials.set(key, mat);
    }
    return mat;
  }

  /**
   * Giant mushroom — Oblivion Blackwood/Morrowind overgrown-forest atmosphere.
   * Thick pale stalk with a broad spotted cap in earthy burgundy/red.
   */
  private _spawnMushroom(x: number, z: number, name: string, scale: number): Mesh[] {
    const stalkH  = 1.2 + scale * 1.6; // 1.2–2.8 m

    const stalkMat = this._envMat("mushroom_stalk", () => {
      const m = new StandardMaterial("mushroom_stalk", this.scene);
      m.diffuseColor  = new Color3(0.88, 0.84, 0.76);
      m.specularColor = new Color3(0.10, 0.09, 0.07);
      m.specularPower = 20;
      m.freeze();
      return m;
    });

    // Earthy wine-red cap — Morrowind Telvanni / Oblivion deepwoods feel
    const capMat = this._envMat("mushroom_cap", () => {
      const m = new StandardMaterial("mushroom_cap", this.scene);
      m.diffuseColor  = new Color3(0.62, 0.10, 0.08);
      m.specularColor = new Color3(0.24, 0.06, 0.04);
      m.specularPower = 30;
      m.freeze();
      return m;
    });

    const stalk = MeshBuilder.CreateCylinder(
      `${name}_stalk`,
      { height: stalkH, diameterTop: 0.20 + scale * 0.15, diameterBottom: 0.28 + scale * 0.18, tessellation: 10 },
      this.scene,
    );
    stalk.position.set(x, stalkH / 2, z);
    stalk.material = stalkMat;
    this._addShadowCaster(stalk);

    const capR = 0.9 + scale * 0.7; // 0.9–1.6 m radius
    const cap = MeshBuilder.CreateCylinder(
      `${name}_cap`,
      { height: capR * 0.55, diameterTop: capR * 0.5, diameterBottom: capR * 2.0, tessellation: 12 },
      this.scene,
    );
    cap.position.set(x, stalkH + capR * 0.2, z);
    cap.material = capMat;
    this._addShadowCaster(cap);

    return [stalk, cap];
  }

  /**
   * Mossy boulder — rounded stone with green moss overlay.
   * Common in forests; also appears in tundra as a grey variant.
   */
  private _spawnBoulder(x: number, z: number, name: string, scale: number): Mesh[] {
    const r    = 0.5 + scale * 1.0; // 0.5–1.5 m radius
    const bucket = Math.round(scale * 3);
    const mat = this._envMat(`boulder_moss_${bucket}`, () => {
      const m = new StandardMaterial(`boulder_moss_${bucket}`, this.scene);
      m.diffuseColor  = new Color3(0.38 - scale * 0.08, 0.36 - scale * 0.05, 0.30);
      m.specularColor = new Color3(0.10, 0.10, 0.08);
      m.specularPower = 16;
      m.freeze();
      return m;
    });

    const boulder = MeshBuilder.CreateSphere(
      `${name}_rock`,
      { diameter: r * 2, segments: 5 },
      this.scene,
    );
    boulder.scaling.y = 0.65 + scale * 0.2; // flatten slightly
    boulder.position.set(x, r * 0.6, z);
    boulder.rotation.y = scale * Math.PI;
    boulder.material   = mat;
    this._addShadowCaster(boulder);

    return [boulder];
  }

  /**
   * Ancient monolith / standing stone — Oblivion Ayleid waymarker.
   * Tall weathered limestone block with a rough cap slab.
   */
  private _spawnMonolith(x: number, z: number, name: string, scale: number): Mesh[] {
    const h = 1.6 + scale * 2.4; // 1.6–4.0 m

    const mat = this._envMat("monolith_stone", () => {
      const m = new StandardMaterial("monolith_stone", this.scene);
      m.diffuseColor  = new Color3(0.48, 0.43, 0.36);
      m.specularColor = new Color3(0.14, 0.13, 0.10);
      m.specularPower = 28;
      m.freeze();
      return m;
    });

    const stone = MeshBuilder.CreateBox(
      `${name}_stone`,
      { width: 0.50 + scale * 0.25, height: h, depth: 0.22 + scale * 0.12 },
      this.scene,
    );
    stone.position.set(x, h / 2, z);
    stone.rotation.y = scale * 1.8; // slight turn for variety
    stone.material   = mat;
    this._addShadowCaster(stone);

    // Cap slab (wider than the stone, slightly angled)
    const cap = MeshBuilder.CreateBox(
      `${name}_cap`,
      { width: 0.72 + scale * 0.28, height: 0.14, depth: 0.34 + scale * 0.14 },
      this.scene,
    );
    cap.position.set(x, h + 0.07, z);
    cap.rotation.y = stone.rotation.y + 0.08;
    cap.material = this._envMat("monolith_cap", () => {
      const m = new StandardMaterial("monolith_cap", this.scene);
      m.diffuseColor  = new Color3(0.36, 0.42, 0.28);
      m.specularColor = new Color3(0.06, 0.08, 0.04);
      m.specularPower = 16;
      m.freeze();
      return m;
    });
    this._addShadowCaster(cap);

    return [stone, cap];
  }

  /**
   * Wildflower cluster — tiny coloured sphere "blooms" scattered in a radius.
   * Plains ambient detail for a living Cyrodiil/Skyrim landscape.
   */
  private _spawnWildflowers(x: number, z: number, name: string, seed: number): Mesh[] {
    const meshes: Mesh[] = [];
    const colors = [
      new Color3(0.90, 0.22, 0.30), // red
      new Color3(0.95, 0.78, 0.10), // yellow
      new Color3(0.50, 0.25, 0.85), // purple
      new Color3(0.98, 0.98, 0.98), // white
    ];
    const count = 8;
    for (let i = 0; i < count; i++) {
      const a  = (i / count) * Math.PI * 2 + seed;
      const r  = 0.6 + Math.abs(Math.sin(seed * 17.3 + i)) * 1.6;
      const fx = x + Math.cos(a) * r;
      const fz = z + Math.sin(a) * r;
      const bloom = MeshBuilder.CreateSphere(
        `${name}_bloom_${i}`,
        { diameter: 0.14, segments: 3 },
        this.scene,
      );
      bloom.position.set(fx, 0.10, fz);
      const col = colors[i % colors.length];
      const bMat = new StandardMaterial(`${name}_bmat_${i}`, this.scene);
      bMat.diffuseColor  = col;
      bMat.emissiveColor = new Color3(col.r * 0.15, col.g * 0.15, col.b * 0.15);
      bMat.freeze();
      bloom.material = bMat;
      meshes.push(bloom);

      // Thin stem
      const stem = MeshBuilder.CreateCylinder(
        `${name}_stem_${i}`,
        { height: 0.12, diameterTop: 0.02, diameterBottom: 0.03, tessellation: 4 },
        this.scene,
      );
      stem.position.set(fx, 0.05, fz);
      stem.material = this._envMat("flower_stem", () => {
        const sm = new StandardMaterial("flower_stem", this.scene);
        sm.diffuseColor = new Color3(0.18, 0.44, 0.12);
        sm.freeze();
        return sm;
      });
      meshes.push(stem);
    }
    return meshes;
  }

  /**
   * Desert palm — tall segmented trunk with a fan of wide fronds.
   * Gives the desert biome an oasis / Hammerfell silhouette.
   */
  private _spawnDesertPalm(x: number, z: number, name: string): Mesh[] {
    const trunkMat = this._envMat("palm_trunk", () => {
      const m = new StandardMaterial("palm_trunk", this.scene);
      m.diffuseColor  = new Color3(0.52, 0.38, 0.18);
      m.specularColor = new Color3(0.10, 0.07, 0.03);
      m.specularPower = 14;
      m.freeze();
      return m;
    });
    const frondMat = this._envMat("palm_frond", () => {
      const m = new StandardMaterial("palm_frond", this.scene);
      m.diffuseColor  = new Color3(0.18, 0.54, 0.12);
      m.specularColor = new Color3(0.06, 0.14, 0.04);
      m.specularPower = 20;
      m.freeze();
      return m;
    });
    const trunkH   = 5.5;

    const trunk = MeshBuilder.CreateCylinder(
      `${name}_trunk`,
      { height: trunkH, diameterTop: 0.22, diameterBottom: 0.38, tessellation: 8 },
      this.scene,
    );
    trunk.position.set(x, trunkH / 2, z);
    trunk.material = trunkMat;
    this._addShadowCaster(trunk);

    // Fan of 6 fronds arching outward
    const frondCount = 6;
    const meshes: Mesh[] = [trunk];
    for (let i = 0; i < frondCount; i++) {
      const angle = (i / frondCount) * Math.PI * 2;
      const frond = MeshBuilder.CreateCylinder(
        `${name}_frond_${i}`,
        { height: 2.2, diameterTop: 0.0, diameterBottom: 0.6, tessellation: 6 },
        this.scene,
      );
      frond.rotation.z = -Math.PI / 3.5; // arch outward
      frond.rotation.y = angle;
      frond.position.set(
        x + Math.cos(angle) * 0.7,
        trunkH + 0.5,
        z + Math.sin(angle) * 0.7,
      );
      frond.material = frondMat;
      this._addShadowCaster(frond);
      meshes.push(frond);
    }

    return meshes;
  }

  /**
   * Dead twisted tree — Skyrim Winterhold / Morthal atmosphere.
   * Bare black branches reaching skyward like clawed hands.
   */
  private _spawnDeadTree(x: number, z: number, name: string, scale: number): Mesh[] {
    const trunkH = 2.5 + scale * 2.0;
    const mat = this._envMat("dead_tree", () => {
      const m = new StandardMaterial("dead_tree", this.scene);
      m.diffuseColor  = new Color3(0.14, 0.11, 0.10);
      m.specularColor = new Color3(0.06, 0.05, 0.04);
      m.specularPower = 10;
      m.freeze();
      return m;
    });

    const trunk = MeshBuilder.CreateCylinder(
      `${name}_trunk`,
      { height: trunkH, diameterTop: 0.12, diameterBottom: 0.32, tessellation: 6 },
      this.scene,
    );
    trunk.rotation.z = (scale - 0.5) * 0.3; // slight lean
    trunk.position.set(x, trunkH / 2, z);
    trunk.material = mat;
    this._addShadowCaster(trunk);

    // 3 bare branch segments radiating up from near the top
    const meshes: Mesh[] = [trunk];
    for (let i = 0; i < 3; i++) {
      const bAngle = (i / 3) * Math.PI * 2 + scale;
      const bH     = 1.0 + scale * 0.5;
      const branch = MeshBuilder.CreateCylinder(
        `${name}_branch_${i}`,
        { height: bH, diameterTop: 0.02, diameterBottom: 0.10, tessellation: 5 },
        this.scene,
      );
      branch.rotation.z = Math.PI / 4 + (i * 0.2);
      branch.rotation.y = bAngle;
      branch.position.set(
        x + Math.cos(bAngle) * 0.4,
        trunkH - 0.5 + bH * 0.3,
        z + Math.sin(bAngle) * 0.4,
      );
      branch.material = mat;
      meshes.push(branch);
    }

    return meshes;
  }

  /**
   * Snow-capped boulder — tundra ambient stone half-buried in drifts.
   */
  private _spawnSnowBoulder(x: number, z: number, name: string, scale: number): Mesh[] {
    const r = 0.5 + scale * 1.2;

    const boulder = MeshBuilder.CreateSphere(
      `${name}_rock`,
      { diameter: r * 2, segments: 5 },
      this.scene,
    );
    boulder.scaling.y = 0.7;
    boulder.position.set(x, r * 0.55, z);
    boulder.material = this._envMat("snow_boulder", () => {
      const m = new StandardMaterial("snow_boulder", this.scene);
      m.diffuseColor  = new Color3(0.56, 0.54, 0.58);
      m.specularColor = new Color3(0.16, 0.16, 0.20);
      m.specularPower = 24;
      m.freeze();
      return m;
    });
    this._addShadowCaster(boulder);

    // Snow drift cap (flattened sphere on top)
    const cap = MeshBuilder.CreateSphere(
      `${name}_snow`,
      { diameter: r * 1.4, segments: 4 },
      this.scene,
    );
    cap.scaling.y = 0.35;
    cap.position.set(x, r * 0.55 + r * 0.55, z);
    cap.material = this._envMat("snow_cap", () => {
      const m = new StandardMaterial("snow_cap", this.scene);
      m.diffuseColor  = new Color3(0.90, 0.92, 0.96);
      m.specularColor = new Color3(0.50, 0.52, 0.58);
      m.specularPower = 64;
      m.freeze();
      return m;
    });
    cap.receiveShadows = true;

    return [boulder, cap];
  }
}

