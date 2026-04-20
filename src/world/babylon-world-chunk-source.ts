import type { ChunkSource, Vec2Like } from "../systems/chunks/ChunkTypes";
import type { WorldChunkData } from "./babylon-world-chunk-adapter";
import type { WorldManager } from "./world-manager";

/**
 * BabylonWorldSource — Provides procedural world data (biomes, content)
 * for the ChunkManager without engine dependencies.
 */
export class BabylonWorldSource implements ChunkSource<WorldChunkData> {
  constructor(private readonly _worldManager: WorldManager) {}

  public async loadChunk(coords: Vec2Like, signal?: AbortSignal): Promise<WorldChunkData> {
    // Simulate slight generation delay if needed
    // await new Promise(resolve => setTimeout(resolve, 5));
    
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const biome = this._worldManager.getBiome(coords.x, coords.y);
    
    return { biome };
  }
}
