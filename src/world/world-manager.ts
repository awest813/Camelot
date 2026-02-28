import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType } from "@babylonjs/core/Physics";
import { StructureManager } from "./structure-manager";

export type BiomeType = "plains" | "forest" | "desert" | "tundra";

export class WorldManager {
  private scene: Scene;
  private chunkSize: number = 50;
  private loadedChunks: Map<string, Mesh> = new Map();
  private chunkVegetation: Map<string, Mesh[]> = new Map();
  private loadDistance: number = 2; // Radius of chunks to load
  private unloadDistance: number = 4; // Chunks beyond this radius are disposed

  /** Manages procedural structures (ruins, shrines, towers) per chunk. */
  public structures: StructureManager;

  // Throttle: only run chunk logic every N frames
  private _frameCounter: number = 0;
  private _updateInterval: number = 10;

  constructor(scene: Scene) {
    this.scene = scene;
    this.structures = new StructureManager(scene);
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
    // Run chunk management every _updateInterval frames instead of every frame
    if (++this._frameCounter % this._updateInterval !== 0) return;

    const chunkX = Math.floor(playerPosition.x / this.chunkSize);
    const chunkZ = Math.floor(playerPosition.z / this.chunkSize);

    // Load chunks around the player
    for (let x = chunkX - this.loadDistance; x <= chunkX + this.loadDistance; x++) {
      for (let z = chunkZ - this.loadDistance; z <= chunkZ + this.loadDistance; z++) {
        this._loadChunk(x, z);
      }
    }

    // Unload chunks that are too far from the player
    for (const [key, mesh] of this.loadedChunks) {
      const [cx, cz] = key.split(",").map(Number);
      if (Math.abs(cx - chunkX) > this.unloadDistance || Math.abs(cz - chunkZ) > this.unloadDistance) {
        mesh.dispose(false, true); // true = also dispose material & textures
        this.loadedChunks.delete(key);

        // Dispose vegetation meshes for this chunk
        const veg = this.chunkVegetation.get(key);
        if (veg) {
          for (const m of veg) m.dispose(false, true);
          this.chunkVegetation.delete(key);
        }

        // Dispose structure meshes and loot for this chunk (cx/cz from outer destructure)
        this.structures.disposeChunk(cx, cz);
      }
    }
  }

  private _loadChunk(x: number, z: number): void {
    const key = `${x},${z}`;
    if (this.loadedChunks.has(key)) {
      return;
    }

    const biome = this.getBiome(x, z);

    // Create ground for this chunk
    const chunkMesh = MeshBuilder.CreateGround(`chunk_${key}`, { width: this.chunkSize, height: this.chunkSize }, this.scene);
    // Position is center of mesh, so offset by half size
    chunkMesh.position.x = x * this.chunkSize;
    chunkMesh.position.z = z * this.chunkSize;

    // Enable collisions for camera
    chunkMesh.checkCollisions = true;

    // Add physics
    new PhysicsAggregate(chunkMesh, PhysicsShapeType.BOX, { mass: 0 }, this.scene);

    // Biome-specific terrain color
    const material = new StandardMaterial(`mat_${key}`, this.scene);
    material.diffuseColor = this._getBiomeColor(biome);
    chunkMesh.material = material;

    this.loadedChunks.set(key, chunkMesh);

    // Spawn vegetation for this chunk
    const vegMeshes = this._spawnVegetation(x, z, biome);
    if (vegMeshes.length > 0) {
      this.chunkVegetation.set(key, vegMeshes);
    }

    // Spawn a structure for this chunk (ruins, shrine, or tower based on biome)
    this.structures.trySpawnForChunk(x, z, biome, this.chunkSize);
  }

  private _getBiomeColor(biome: BiomeType): Color3 {
    switch (biome) {
      case "plains": return new Color3(0.35, 0.65, 0.25);
      case "forest": return new Color3(0.15, 0.45, 0.15);
      case "desert": return new Color3(0.80, 0.72, 0.45);
      case "tundra": return new Color3(0.82, 0.88, 0.92);
    }
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

  /** Spawn a simple tree: cylindrical trunk + spherical crown. */
  private _spawnTree(x: number, z: number, name: string, scale: number): Mesh[] {
    const trunkHeight = 2 + scale * 2; // 2–4 m

    const trunk = MeshBuilder.CreateCylinder(
      `${name}_trunk`,
      { height: trunkHeight, diameterTop: 0.3, diameterBottom: 0.5 },
      this.scene
    );
    trunk.position.set(x, trunkHeight / 2, z);
    const trunkMat = new StandardMaterial(`${name}_trunkMat`, this.scene);
    trunkMat.diffuseColor = new Color3(0.4, 0.25, 0.1);
    trunk.material = trunkMat;

    const crownR = 1.2 + scale * 0.8; // 1.2–2 m radius
    const crown = MeshBuilder.CreateSphere(
      `${name}_crown`,
      { diameter: crownR * 2 },
      this.scene
    );
    crown.position.set(x, trunkHeight + crownR * 0.7, z);
    const crownMat = new StandardMaterial(`${name}_crownMat`, this.scene);
    crownMat.diffuseColor = new Color3(0.1, 0.45 + scale * 0.25, 0.1);
    crown.material = crownMat;

    return [trunk, crown];
  }

  /** Spawn a stylised cactus: body + two arms. */
  private _spawnCactus(x: number, z: number, name: string): Mesh[] {
    const mat = new StandardMaterial(`${name}_mat`, this.scene);
    mat.diffuseColor = new Color3(0.2, 0.55, 0.2);

    const body = MeshBuilder.CreateCylinder(
      `${name}_body`,
      { height: 2.5, diameterTop: 0.35, diameterBottom: 0.4 },
      this.scene
    );
    body.position.set(x, 1.25, z);
    body.material = mat;

    const armL = MeshBuilder.CreateCylinder(
      `${name}_armL`,
      { height: 1.0, diameterTop: 0.2, diameterBottom: 0.25 },
      this.scene
    );
    armL.rotation.z = Math.PI / 2.5;
    armL.position.set(x - 0.6, 1.8, z);
    armL.material = mat;

    const armR = MeshBuilder.CreateCylinder(
      `${name}_armR`,
      { height: 1.0, diameterTop: 0.2, diameterBottom: 0.25 },
      this.scene
    );
    armR.rotation.z = -Math.PI / 2.5;
    armR.position.set(x + 0.6, 1.8, z);
    armR.material = mat;

    return [body, armL, armR];
  }

  /** Spawn a translucent hexagonal ice crystal. */
  private _spawnIceCrystal(x: number, z: number, name: string, scale: number): Mesh[] {
    const height = 0.8 + scale * 1.4; // 0.8–2.2 m

    const crystal = MeshBuilder.CreateCylinder(
      `${name}_crystal`,
      { height, diameterTop: 0, diameterBottom: 0.4 + scale * 0.3, tessellation: 6 },
      this.scene
    );
    crystal.position.set(x, height / 2, z);
    const mat = new StandardMaterial(`${name}_mat`, this.scene);
    mat.diffuseColor = new Color3(0.7, 0.85, 1.0);
    mat.alpha = 0.85;
    crystal.material = mat;

    return [crystal];
  }
}
