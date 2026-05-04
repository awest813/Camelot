import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType } from "@babylonjs/core/Physics";
import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import type { Chunk, ChunkAdapter, Vec2Like } from "../systems/chunks/ChunkTypes";
import type { BiomeType, WorldManager } from "./world-manager";

export interface WorldChunkData {
  biome: BiomeType;
  // In the future, this could contain pre-generated noise maps, 
  // structure layout metadata, etc.
}

/**
 * BabylonWorldAdapter — Connects the generic ChunkManager to the Babylon.js engine.
 * 
 * Handles the creation and disposal of 3D meshes, physics bodies, and 
 * environmental props within the scene during chunk lifecycle events.
 */
export class BabylonWorldAdapter implements ChunkAdapter<WorldChunkData> {
  private readonly _mountedMeshes = new Map<string, {
    ground: Mesh;
    body: PhysicsAggregate;
    vegetation: Mesh[];
  }>();

  constructor(
    private readonly _scene: Scene,
    private readonly _worldManager: WorldManager, // Access to shared materials/generators
    private readonly _shadows: ShadowGenerator | null
  ) {}

  public async mount(chunk: Chunk<WorldChunkData>): Promise<void> {
    if (!chunk.data) return;
    const { x, y: z } = chunk.coords;
    const { biome } = chunk.data;
    const chunkSize = this._worldManager.chunkSize;

    // 1. Create Ground
    const ground = MeshBuilder.CreateGround(
      `chunk_gen_${chunk.key}`,
      { width: chunkSize, height: chunkSize, subdivisions: 4 },
      this._scene
    );
    ground.position.set(x * chunkSize, 0, z * chunkSize);
    ground.checkCollisions = true;
    ground.receiveShadows = true;
    
    // Accessing private methods via any-casting for refactoring (or make them public in WorldManager)
    const wm = this._worldManager as any;
    ground.material = wm._getBiomeMaterial(biome);

    // 2. Physics
    const body = new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0 }, this._scene);

    // 3. Vegetation
    const vegetation = wm._spawnVegetation(x, z, biome);

    // 4. Structures (handled by StructureManager via WorldManager)
    this._worldManager.structures.trySpawnForChunk(x, z, biome, chunkSize);

    this._mountedMeshes.set(chunk.key, { ground, body, vegetation });
    
    // Notify WorldManager or game systems if needed
    this._worldManager.onChunkLoaded?.(x, z, biome);
  }

  public async unmount(chunk: Chunk<WorldChunkData>): Promise<void> {
    const mounted = this._mountedMeshes.get(chunk.key);
    if (!mounted) return;

    mounted.body.dispose();
    mounted.ground.dispose(false, false);
    
    for (const v of mounted.vegetation) {
      v.dispose(false, false);
    }

    const { x, y: z } = chunk.coords;
    this._worldManager.structures.disposeChunk(x, z);
    this._worldManager.onChunkUnloaded?.(x, z);
    
    this._mountedMeshes.delete(chunk.key);
  }
}
