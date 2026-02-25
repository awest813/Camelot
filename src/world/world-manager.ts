import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType } from "@babylonjs/core/Physics";

export class WorldManager {
  private scene: Scene;
  private chunkSize: number = 50;
  private loadedChunks: Map<string, Mesh> = new Map();
  private loadDistance: number = 2; // Radius of chunks to load

  constructor(scene: Scene) {
    this.scene = scene;
  }

  public update(playerPosition: Vector3): void {
    const chunkX = Math.floor(playerPosition.x / this.chunkSize);
    const chunkZ = Math.floor(playerPosition.z / this.chunkSize);

    // Load chunks around the player
    for (let x = chunkX - this.loadDistance; x <= chunkX + this.loadDistance; x++) {
      for (let z = chunkZ - this.loadDistance; z <= chunkZ + this.loadDistance; z++) {
        this._loadChunk(x, z);
      }
    }

    // Unload chunks too far away
    for (const [key, mesh] of this.loadedChunks.entries()) {
      const [x, z] = key.split(',').map(Number);
      if (Math.abs(x - chunkX) > this.loadDistance + 1 || Math.abs(z - chunkZ) > this.loadDistance + 1) {
        mesh.dispose(); // This also disposes children/physics usually if attached?
        // Note: PhysicsAggregate creates a body that might need manual disposal if not parented correctly or tracked.
        // In our case, the aggregate is not stored on the mesh metadata, so we rely on Babylon's dispose handling.
        // Actually, for Havok, we might need to be careful. But let's assume basic dispose for now.
        // To be safe, we should probably track aggregates if we want to dispose them cleanly.

        // Let's assume the physics aggregate is disposed when the mesh is disposed.
        // Actually, looking at docs, PhysicsAggregate needs explicit dispose often.
        if (mesh.metadata && mesh.metadata.physicsAggregate) {
            mesh.metadata.physicsAggregate.dispose();
        }

        this.loadedChunks.delete(key);
      }
    }
  }

  private _loadChunk(x: number, z: number): void {
    const key = `${x},${z}`;
    if (this.loadedChunks.has(key)) {
      return;
    }

    // Create ground for this chunk
    // Use subdivisions for potential heightmap later
    const chunkMesh = MeshBuilder.CreateGround(`chunk_${key}`, { width: this.chunkSize, height: this.chunkSize, subdivisions: 4 }, this.scene);
    chunkMesh.position.x = x * this.chunkSize;
    chunkMesh.position.z = z * this.chunkSize;

    // Enable collisions for camera
    chunkMesh.checkCollisions = true;

    // Add physics
    const aggregate = new PhysicsAggregate(chunkMesh, PhysicsShapeType.BOX, { mass: 0, restitution: 0.1 }, this.scene);

    // Store aggregate for disposal
    chunkMesh.metadata = { physicsAggregate: aggregate };

    // Make it varied green (simple biome placeholder)
    const material = new StandardMaterial(`mat_${key}`, this.scene);
    // Simple noise-like color variation
    const r = (Math.sin(x * 0.5) + 1) * 0.1;
    const g = 0.4 + (Math.cos(z * 0.5) + 1) * 0.2 + (Math.random() * 0.1);
    const b = (Math.sin(x + z) + 1) * 0.1;
    material.diffuseColor = new Color3(r, g, b);

    // Freeze material for performance
    material.freeze();
    chunkMesh.material = material;

    // Freeze world matrix as these are static
    chunkMesh.freezeWorldMatrix();

    this.loadedChunks.set(key, chunkMesh);
  }
}
