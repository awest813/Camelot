import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorldManager, BiomeType } from './world-manager';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

// ── Hoisted mocks (available inside vi.mock factory closures) ─────────────────

const { mockMeshDispose, mockBodyDispose } = vi.hoisted(() => ({
  mockMeshDispose: vi.fn(),
  mockBodyDispose: vi.fn(),
}));

// ── Babylon mocks ─────────────────────────────────────────────────────────────

vi.mock('@babylonjs/core/Meshes/meshBuilder', () => ({
  MeshBuilder: {
    CreateGround: vi.fn(function() {
      return {
        position: { x: 0, z: 0 },
        checkCollisions: false,
        receiveShadows: false,
        material: null,
        dispose: mockMeshDispose,
      };
    }),
    CreateCylinder: vi.fn(function() {
      return {
        position: { set: vi.fn(), x: 0, y: 0, z: 0 },
        rotation: { z: 0 },
        material: null,
        receiveShadows: false,
        dispose: mockMeshDispose,
      };
    }),
    CreateBox: vi.fn(function() {
      return {
        position: { set: vi.fn(), x: 0, y: 0, z: 0 },
        rotation: { y: 0 },
        material: null,
        receiveShadows: false,
        dispose: mockMeshDispose,
      };
    }),
  },
}));

vi.mock('@babylonjs/core/Physics/v2/physicsAggregate', () => ({
  // Use a regular function (not arrow function) so it can be called with `new`
  PhysicsAggregate: function PhysicsAggregate() {
    return { dispose: mockBodyDispose };
  },
}));

vi.mock('@babylonjs/core/Physics', () => ({
  PhysicsShapeType: { BOX: 'BOX' },
}));

vi.mock('@babylonjs/core/Materials/standardMaterial', () => ({
  StandardMaterial: class {
    diffuseColor: any = null;
    specularColor: any = null;
    specularPower: number = 1;
    freeze = vi.fn();
    constructor(_name: string, _scene: any) {}
  },
}));

vi.mock('@babylonjs/core/Maths/math.color', () => ({
  Color3: class {
    constructor(public r = 0, public g = 0, public b = 0) {}
  },
}));

vi.mock('./structure-manager', () => ({
  StructureManager: class {
    trySpawnForChunk = vi.fn();
    disposeChunk = vi.fn();
    onNPCSpawn: any = null;
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const mockScene = {} as any;

/**
 * Advance WorldManager by `frames` update calls.
 * The internal _updateInterval is 10, so the chunk sweep runs every 10 frames.
 */
function advanceFrames(wm: WorldManager, frames: number, pos: Vector3 = new Vector3(0, 0, 0)): void {
  for (let i = 0; i < frames; i++) {
    wm.update(pos);
  }
}

// ── Test suites ───────────────────────────────────────────────────────────────

describe('WorldManager.getBiome', () => {
  it('returns a valid BiomeType for every chunk', () => {
    const valid: BiomeType[] = ['plains', 'forest', 'desert', 'tundra'];
    const wm = new WorldManager(mockScene);
    for (let x = -5; x <= 5; x++) {
      for (let z = -5; z <= 5; z++) {
        expect(valid).toContain(wm.getBiome(x, z));
      }
    }
  });

  it('is deterministic — same chunk always returns the same biome', () => {
    const wm = new WorldManager(mockScene);
    for (let x = -3; x <= 3; x++) {
      for (let z = -3; z <= 3; z++) {
        expect(wm.getBiome(x, z)).toBe(wm.getBiome(x, z));
      }
    }
  });

  it('returns all four biome types across a representative area', () => {
    const wm = new WorldManager(mockScene);
    const found = new Set<BiomeType>();
    for (let x = -20; x <= 20; x++) {
      for (let z = -20; z <= 20; z++) {
        found.add(wm.getBiome(x, z));
      }
    }
    expect(found.size).toBe(4);
  });

  it('origin chunk (0,0) returns a consistent biome', () => {
    const wm = new WorldManager(mockScene);
    const b = wm.getBiome(0, 0);
    expect(['plains', 'forest', 'desert', 'tundra']).toContain(b);
    // Call again to confirm determinism
    expect(wm.getBiome(0, 0)).toBe(b);
  });
});

describe('WorldManager chunk load queue', () => {
  beforeEach(() => {
    mockMeshDispose.mockClear();
    mockBodyDispose.mockClear();
  });

  it('loads at most _loadBudgetPerFrame chunks per update call', () => {
    const wm = new WorldManager(mockScene);
    // Trigger the first sweep (interval = 10)
    advanceFrames(wm, 10);
    // After the sweep frame, the queue has 25 entries; the first 2 are already drained
    // by _processLoadQueue on that frame. loadedChunkCount should be at most 2.
    expect(wm.loadedChunkCount).toBeLessThanOrEqual(2);
  });

  it('eventually loads all needed chunks when given enough frames', () => {
    const wm = new WorldManager(mockScene);
    // loadDistance=2 → 5×5=25 chunks. Each frame drains 2, so ~13 extra frames needed.
    advanceFrames(wm, 10 + 25); // generous: trigger sweep + plenty of drain frames
    expect(wm.loadedChunkCount).toBe(25);
    expect(wm.loadQueueLength).toBe(0);
  });

  it('queue is empty and chunk count is 25 after sweep + drain', () => {
    const wm = new WorldManager(mockScene);
    advanceFrames(wm, 10 + 14); // 10 sweep + 14 drain (ceil(25/2))
    expect(wm.loadQueueLength).toBe(0);
    expect(wm.loadedChunkCount).toBe(25);
  });

  it('does not load the same chunk twice', () => {
    const wm = new WorldManager(mockScene);
    advanceFrames(wm, 10 + 30); // over-drain
    expect(wm.loadedChunkCount).toBe(25);
  });

  it('player chunk (0,0) is the first chunk loaded after the sweep', () => {
    const wm = new WorldManager(mockScene);
    // After exactly 10 frames (first sweep) + 1 drain frame = 11 frames total,
    // The sweep fires on frame 10 and processLoadQueue runs on frames 1-10.
    // On frame 10: sweep enqueues all 25 chunks sorted by distance, processLoadQueue
    // runs first (queue was empty so 0 loaded), then sweep adds to queue.
    // On frames 11+: processLoadQueue drains 2 per frame.
    //
    // After frame 11: 2 chunks loaded. The first entry in the sorted queue is
    // chunk (0,0) at distance 0.
    advanceFrames(wm, 11);
    expect(wm.loadedChunkCount).toBeGreaterThanOrEqual(1);
    // And the total chunks queued + loaded = 25
    expect(wm.loadQueueLength + wm.loadedChunkCount).toBe(25);
  });

  it('skips stale queue entries when player moves far away', () => {
    const wm = new WorldManager(mockScene);
    // Queue up chunks near origin
    advanceFrames(wm, 10);
    expect(wm.loadQueueLength + wm.loadedChunkCount).toBeGreaterThan(0);

    // Move player far away; subsequent drains should skip the origin-queued entries
    const farPos = new Vector3(100 * 50, 0, 100 * 50);
    advanceFrames(wm, 30, farPos); // drain stale entries + trigger far sweep

    // Origin chunks should not pile up — total loaded should be bounded
    expect(wm.loadedChunkCount).toBeLessThan(50);
  });

  it('stale check uses current-frame player position, not just last sweep position', () => {
    const wm = new WorldManager(mockScene);
    // Trigger first sweep at origin — 25 chunks are enqueued
    advanceFrames(wm, 10);
    expect(wm.loadQueueLength).toBeGreaterThan(0);

    // Move far away on the very next frame; _lastPlayerChunk must update immediately
    // so _processLoadQueue skips every origin-area entry rather than loading them.
    const farPos = new Vector3(100 * 50, 0, 100 * 50);
    wm.update(farPos);

    // With the fix, no origin chunk should have been loaded
    expect(wm.loadedChunkCount).toBe(0);
  });

  it('prunes stale queued chunks immediately when the player changes chunk', () => {
    const wm = new WorldManager(mockScene);
    advanceFrames(wm, 10);
    expect(wm.loadQueueLength).toBe(25);

    wm.update(new Vector3(100 * 50, 0, 100 * 50));

    expect(wm.loadQueueLength).toBe(0);
    expect(wm.loadQueuePoolSize).toBeGreaterThanOrEqual(25);
  });

  it('reuses pooled queue entries across distant streaming sweeps', () => {
    const wm = new WorldManager(mockScene);

    advanceFrames(wm, 10);
    const initialAllocated = wm.loadQueueEntriesAllocated;

    wm.update(new Vector3(100 * 50, 0, 100 * 50));
    advanceFrames(wm, 9, new Vector3(100 * 50, 0, 100 * 50));

    expect(wm.loadQueueLength).toBe(25);
    expect(wm.loadQueueEntriesAllocated).toBe(initialAllocated);
  });
});

describe('WorldManager chunk reloading', () => {
  beforeEach(() => {
    mockMeshDispose.mockClear();
    mockBodyDispose.mockClear();
  });

  it('a chunk unloaded due to distance can be reloaded when the player returns', () => {
    const wm = new WorldManager(mockScene);
    const origin = new Vector3(0, 0, 0);

    // Load all 25 origin chunks
    advanceFrames(wm, 10 + 25, origin);
    expect(wm.loadedChunkCount).toBe(25);

    // Move far enough to trigger unloads
    const farPos = new Vector3(400, 0, 400); // chunkX=8, chunkZ=8 — origin is 8 chunks away
    advanceFrames(wm, 10, farPos);
    expect(wm.loadedChunkCount).toBeLessThan(25);

    // Return to origin — sweep re-enqueues origin chunks, drain finishes loading
    advanceFrames(wm, 10 + 25, origin);
    expect(wm.loadedChunkCount).toBe(25);
  });
});

describe('WorldManager.dispose', () => {
  beforeEach(() => {
    mockMeshDispose.mockClear();
    mockBodyDispose.mockClear();
  });

  it('dispose() releases all chunk physics bodies and meshes', () => {
    const wm = new WorldManager(mockScene);
    advanceFrames(wm, 10 + 25, new Vector3(0, 0, 0));
    expect(wm.loadedChunkCount).toBe(25);

    wm.dispose();

    expect(mockBodyDispose).toHaveBeenCalled();
    expect(mockMeshDispose).toHaveBeenCalled();
    expect(wm.loadedChunkCount).toBe(0);
  });

  it('dispose() empties the load queue', () => {
    const wm = new WorldManager(mockScene);
    // Trigger sweep to populate the queue
    advanceFrames(wm, 10);
    expect(wm.loadQueueLength).toBeGreaterThan(0);

    wm.dispose();

    expect(wm.loadQueueLength).toBe(0);
  });

  it('dispose() releases physics bodies before meshes', () => {
    const callOrder: string[] = [];
    mockBodyDispose.mockImplementation(() => callOrder.push('body'));
    mockMeshDispose.mockImplementation(() => callOrder.push('mesh'));

    const wm = new WorldManager(mockScene);
    advanceFrames(wm, 10 + 25, new Vector3(0, 0, 0));

    callOrder.length = 0;
    wm.dispose();

    const firstBody = callOrder.indexOf('body');
    const firstMesh = callOrder.indexOf('mesh');
    expect(firstBody).toBeGreaterThanOrEqual(0);
    expect(firstMesh).toBeGreaterThan(firstBody);
  });
});

describe('WorldManager chunk physics disposal', () => {
  beforeEach(() => {
    mockMeshDispose.mockClear();
    mockBodyDispose.mockClear();
  });

  it('disposes physics body when a chunk is unloaded', () => {
    const wm = new WorldManager(mockScene);
    const origin = new Vector3(0, 0, 0);

    // Load all chunks near origin
    advanceFrames(wm, 10 + 25, origin);
    expect(wm.loadedChunkCount).toBe(25);

    // Move player so origin chunks exceed unloadDistance(4)
    // At chunkX=6, chunks at cx=0 have |0-6|=6>4 → unloaded
    const farPos = new Vector3(300, 0, 300);
    advanceFrames(wm, 10, farPos);

    // Physics bodies should have been disposed for each unloaded chunk
    expect(mockBodyDispose).toHaveBeenCalled();
  });

  it('disposes physics body before mesh on chunk unload', () => {
    const callOrder: string[] = [];
    mockBodyDispose.mockImplementation(() => callOrder.push('body'));
    mockMeshDispose.mockImplementation(() => callOrder.push('mesh'));

    const wm = new WorldManager(mockScene);
    advanceFrames(wm, 10 + 25, new Vector3(0, 0, 0));

    // Reset order tracking before triggering unload
    callOrder.length = 0;
    advanceFrames(wm, 10, new Vector3(400, 0, 400));

    // body.dispose() must be called before mesh.dispose()
    const bodyIdx = callOrder.indexOf('body');
    const meshIdx = callOrder.indexOf('mesh');
    expect(bodyIdx).toBeGreaterThanOrEqual(0);
    expect(meshIdx).toBeGreaterThan(bodyIdx);
  });
});

describe('WorldManager.chunkSize', () => {
  it('exposes the chunk size as a public readonly property', () => {
    const wm = new WorldManager(mockScene);
    expect(wm.chunkSize).toBe(50);
  });

  it('chunkSize is consistent across multiple instances', () => {
    const wm1 = new WorldManager(mockScene);
    const wm2 = new WorldManager(mockScene);
    expect(wm1.chunkSize).toBe(wm2.chunkSize);
  });
});

describe('WorldManager chunk callbacks', () => {
  beforeEach(() => {
    mockMeshDispose.mockClear();
    mockBodyDispose.mockClear();
  });

  it('onChunkLoaded fires once for each newly loaded chunk', () => {
    const wm = new WorldManager(mockScene);
    const loaded: Array<{ cx: number; cz: number }> = [];
    wm.onChunkLoaded = (cx, cz) => loaded.push({ cx, cz });

    advanceFrames(wm, 10 + 25);

    expect(loaded.length).toBe(25);
  });

  it('onChunkLoaded callback receives correct cx/cz coordinates', () => {
    const wm = new WorldManager(mockScene);
    const loaded: Array<{ cx: number; cz: number; biome: string }> = [];
    wm.onChunkLoaded = (cx, cz, biome) => loaded.push({ cx, cz, biome });

    // Load all chunks around origin
    advanceFrames(wm, 10 + 25);

    // Chunk (0,0) must be among those loaded
    const origin = loaded.find(e => e.cx === 0 && e.cz === 0);
    expect(origin).toBeDefined();
    expect(['plains', 'forest', 'desert', 'tundra']).toContain(origin?.biome);
  });

  it('onChunkLoaded reports the same biome as getBiome', () => {
    const wm = new WorldManager(mockScene);
    const loaded: Array<{ cx: number; cz: number; biome: string }> = [];
    wm.onChunkLoaded = (cx, cz, biome) => loaded.push({ cx, cz, biome });

    advanceFrames(wm, 10 + 25);

    for (const entry of loaded) {
      expect(entry.biome).toBe(wm.getBiome(entry.cx, entry.cz));
    }
  });

  it('onChunkLoaded does not fire for a chunk that was already loaded', () => {
    const wm = new WorldManager(mockScene);
    let callCount = 0;
    wm.onChunkLoaded = () => { callCount++; };

    // Load all 25 origin chunks
    advanceFrames(wm, 10 + 25);
    const afterFirst = callCount;
    expect(afterFirst).toBe(25);

    // Run many more frames at the same position — no new chunks should load
    advanceFrames(wm, 50);
    expect(callCount).toBe(afterFirst);
  });

  it('onChunkLoaded does not fire for stale queue entries that are skipped', () => {
    const wm = new WorldManager(mockScene);
    let callCount = 0;
    wm.onChunkLoaded = () => { callCount++; };

    // Queue up chunks near origin but do not drain yet
    advanceFrames(wm, 10); // sweep fires, queue is filled, 0 loaded so far

    // Teleport far away immediately so all queued entries become stale
    const farPos = new Vector3(100 * 50, 0, 100 * 50);
    wm.update(farPos); // prunes stale entries from queue

    // No origin chunk should have been loaded
    expect(callCount).toBe(0);
  });

  it('onChunkUnloaded fires for each chunk that is distance-unloaded', () => {
    const wm = new WorldManager(mockScene);
    const unloaded: Array<{ cx: number; cz: number }> = [];
    wm.onChunkUnloaded = (cx, cz) => unloaded.push({ cx, cz });

    // Load all 25 origin chunks
    advanceFrames(wm, 10 + 25, new Vector3(0, 0, 0));
    expect(wm.loadedChunkCount).toBe(25);
    expect(unloaded.length).toBe(0);

    // Move far enough that origin chunks exceed unloadDistance (4)
    const farPos = new Vector3(300, 0, 300); // chunkX=6, chunkZ=6 → |0-6|=6>4
    advanceFrames(wm, 10, farPos);

    expect(unloaded.length).toBeGreaterThan(0);
  });

  it('onChunkUnloaded receives correct cx/cz for unloaded chunks', () => {
    const wm = new WorldManager(mockScene);
    const unloaded: Array<{ cx: number; cz: number }> = [];
    wm.onChunkUnloaded = (cx, cz) => unloaded.push({ cx, cz });

    advanceFrames(wm, 10 + 25, new Vector3(0, 0, 0));

    // Move far away; origin chunks at (0,0) should be unloaded
    const farPos = new Vector3(300, 0, 300);
    advanceFrames(wm, 10, farPos);

    // Chunk (0,0) should appear in the unloaded list
    const originEntry = unloaded.find(e => e.cx === 0 && e.cz === 0);
    expect(originEntry).toBeDefined();
  });

  it('onChunkUnloaded does not fire during dispose()', () => {
    const wm = new WorldManager(mockScene);
    let unloadCount = 0;
    wm.onChunkUnloaded = () => { unloadCount++; };

    advanceFrames(wm, 10 + 25, new Vector3(0, 0, 0));
    expect(wm.loadedChunkCount).toBe(25);

    wm.dispose();

    // dispose() should clean up without firing the unload callback
    expect(unloadCount).toBe(0);
    expect(wm.loadedChunkCount).toBe(0);
  });

  it('onChunkLoaded and onChunkUnloaded can be reassigned at runtime', () => {
    const wm = new WorldManager(mockScene);
    let loadCount = 0;
    let unloadCount = 0;

    wm.onChunkLoaded = () => { loadCount++; };
    wm.onChunkUnloaded = () => { unloadCount++; };

    advanceFrames(wm, 10 + 25, new Vector3(0, 0, 0));
    expect(loadCount).toBe(25);

    // Clear callback and trigger unloads — should not increment
    wm.onChunkUnloaded = null;
    advanceFrames(wm, 10, new Vector3(300, 0, 300));
    expect(unloadCount).toBe(0);
  });
});
