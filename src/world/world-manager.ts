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

  /** Optional shadow generator — meshes added as shadow casters when provided. */
  private readonly _shadows: ShadowGenerator | null;

  constructor(scene: Scene, shadowGenerator: ShadowGenerator | null = null) {
    this.scene = scene;
    this._shadows = shadowGenerator;
    this.structures = new StructureManager(scene, shadowGenerator);
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
   * Uses a deterministic hash so each chunk always gets the same biome.
   */
  public getBiome(chunkX: number, chunkZ: number): BiomeType {
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

    let count = 0;
    switch (biome) {
      case "forest": count = 8; break;
      case "plains": count = 2; break;
      case "desert": count = 3; break;
      case "tundra": count = 1; break;
    }

    for (let i = 0; i < count; i++) {
      const px = centerX + (rand(i * 2)       * 2 - 1) * halfSize;
      const pz = centerZ + (rand(i * 2 + 1)   * 2 - 1) * halfSize;
      const scale = rand(i * 3); // 0..1, used for size variation

      switch (biome) {
        case "forest":
        case "plains":
          meshes.push(...this._spawnTree(px, pz, `tree_${chunkX}_${chunkZ}_${i}`, scale));
          break;
        case "desert":
          meshes.push(...this._spawnCactus(px, pz, `cactus_${chunkX}_${chunkZ}_${i}`));
          break;
        case "tundra":
          meshes.push(...this._spawnIceCrystal(px, pz, `ice_${chunkX}_${chunkZ}_${i}`, scale));
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
}

