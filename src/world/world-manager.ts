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

    // Unload chunks too far away (prevent memory leak)
    const unloadDistance = this.loadDistance + 1;
    const keysToUnload: string[] = [];
    for (const key of this.loadedChunks.keys()) {
      const [x, z] = key.split(',').map(Number);
      const dist = Math.max(Math.abs(x - chunkX), Math.abs(z - chunkZ));
      if (dist > unloadDistance) {
        keysToUnload.push(key);
      }
    }
    keysToUnload.forEach(key => this._unloadChunk(key));
  }

  private _loadChunk(x: number, z: number): void {
    const key = `${x},${z}`;
    if (this.loadedChunks.has(key)) {
      return;
    }

    // Create ground for this chunk
    const chunkMesh = MeshBuilder.CreateGround(`chunk_${key}`, { width: this.chunkSize, height: this.chunkSize }, this.scene);
    // Position is center of mesh, so offset by half size
    chunkMesh.position.x = x * this.chunkSize;
    chunkMesh.position.z = z * this.chunkSize;

    // Enable collisions for camera
    chunkMesh.checkCollisions = true;

    // Add physics
    new PhysicsAggregate(chunkMesh, PhysicsShapeType.BOX, { mass: 0 }, this.scene);

    // Make it varied green
    const material = new StandardMaterial(`mat_${key}`, this.scene);
    const r = (Math.sin(x) + 1) * 0.1;
    const g = 0.5 + (Math.cos(z) + 1) * 0.2;
    const b = (Math.sin(x + z) + 1) * 0.1;
    material.diffuseColor = new Color3(r, g, b);
    chunkMesh.material = material;

    this.loadedChunks.set(key, chunkMesh);
  }

  private _unloadChunk(key: string): void {
    const chunkMesh = this.loadedChunks.get(key);
    if (chunkMesh) {
      chunkMesh.dispose();
      this.loadedChunks.delete(key);
    }
  }
}
