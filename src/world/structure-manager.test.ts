import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StructureManager } from './structure-manager';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const { mockMeshDispose, mockBodyDispose, standardMaterialInstances } = vi.hoisted(() => ({
  mockMeshDispose: vi.fn(),
  mockBodyDispose: vi.fn(),
  standardMaterialInstances: [] as Array<{ name: string }>,
}));

// ── Babylon mocks ─────────────────────────────────────────────────────────────

vi.mock('@babylonjs/core/Meshes/meshBuilder', () => ({
  MeshBuilder: {
    CreateBox: vi.fn(() => ({
      position: { set: vi.fn(), x: 0, y: 0, z: 0 },
      rotation: { y: 0, z: 0 },
      material: null,
      receiveShadows: false,
      parent: null,
      dispose: mockMeshDispose,
    })),
    CreateGround: vi.fn(() => ({
      position: { x: 0, z: 0 },
      checkCollisions: false,
      receiveShadows: false,
      material: null,
      dispose: mockMeshDispose,
    })),
    CreateCylinder: vi.fn(() => ({
      position: { set: vi.fn(), x: 0, y: 0, z: 0 },
      rotation: { y: 0, z: 0 },
      material: null,
      receiveShadows: false,
      parent: null,
      dispose: mockMeshDispose,
    })),
    CreateSphere: vi.fn(() => ({
      position: { set: vi.fn(), x: 0, y: 0, z: 0 },
      rotation: { y: 0, z: 0 },
      material: null,
      receiveShadows: false,
      parent: null,
      dispose: mockMeshDispose,
    })),
    CreateTorus: vi.fn(() => ({
      position: { set: vi.fn(), x: 0, y: 0, z: 0 },
      rotation: { y: 0, z: 0 },
      material: null,
      receiveShadows: false,
      dispose: mockMeshDispose,
    })),
    CreatePlane: vi.fn(() => ({
      position: { set: vi.fn(), x: 0, y: 0, z: 0 },
      rotation: { y: 0, z: 0 },
      material: null,
      receiveShadows: false,
      dispose: mockMeshDispose,
    })),
  },
}));

vi.mock('@babylonjs/core/Lights/pointLight', () => ({
  PointLight: class {
    diffuse: any = null;
    specular: any = null;
    intensity: number = 1;
    range: number = 10;
    constructor(_name: string, _position: any, _scene: any) {}
  },
}));

vi.mock('@babylonjs/core/Physics/v2/physicsAggregate', () => ({
  // Use a regular function (not arrow function) so it can be called with `new`
  PhysicsAggregate: function PhysicsAggregate() {
    return { dispose: mockBodyDispose };
  },
}));

vi.mock('@babylonjs/core/Physics', () => ({
  PhysicsShapeType: { BOX: 'BOX', CYLINDER: 'CYLINDER', CAPSULE: 'CAPSULE' },
}));

vi.mock('@babylonjs/core/Materials/standardMaterial', () => ({
  StandardMaterial: class {
    name: string;
    diffuseColor: any = null;
    specularColor: any = null;
    specularPower: number = 1;
    freeze = vi.fn();
    constructor(name: string, _scene: any) {
      this.name = name;
      standardMaterialInstances.push({ name });
    }
  },
}));

vi.mock('@babylonjs/core/Maths/math.color', () => ({
  Color3: class {
    constructor(public r = 0, public g = 0, public b = 0) {}
  },
}));

vi.mock('../entities/npc', () => ({
  NPC: class {
    aggroRange = 0;
    attackDamage = 0;
    xpReward = 0;
    patrolPoints: any[] = [];
    constructor(_scene: any, _pos: any, _name: string) {}
  },
}));

vi.mock('../entities/loot', () => ({
  Loot: class {
    dispose = vi.fn();
    constructor(_scene: any, _pos: any, _def: any) {}
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const mockScene = {} as any;

// ── Test suites ───────────────────────────────────────────────────────────────

describe('StructureManager.hasStructureAt', () => {
  it('is deterministic — same chunk always returns the same value', () => {
    const sm = new StructureManager(mockScene);
    for (let x = -5; x <= 5; x++) {
      for (let z = -5; z <= 5; z++) {
        expect(sm.hasStructureAt(x, z)).toBe(sm.hasStructureAt(x, z));
      }
    }
  });

  it('returns a boolean', () => {
    const sm = new StructureManager(mockScene);
    expect(typeof sm.hasStructureAt(0, 0)).toBe('boolean');
    expect(typeof sm.hasStructureAt(3, -7)).toBe('boolean');
  });

  it('approximately 25% of chunks have structures', () => {
    const sm = new StructureManager(mockScene);
    let count = 0;
    const total = 400; // 20 x 20 grid
    for (let x = -10; x < 10; x++) {
      for (let z = -10; z < 10; z++) {
        if (sm.hasStructureAt(x, z)) count++;
      }
    }
    // Expect between 15% and 35% to have structures
    const ratio = count / total;
    expect(ratio).toBeGreaterThan(0.15);
    expect(ratio).toBeLessThan(0.35);
  });

  it('different chunks can have different results', () => {
    const sm = new StructureManager(mockScene);
    const results = new Set<boolean>();
    for (let x = 0; x < 20; x++) {
      results.add(sm.hasStructureAt(x, 0));
    }
    // At least one chunk should have a structure, and at least one should not
    expect(results.has(true)).toBe(true);
    expect(results.has(false)).toBe(true);
  });
});

describe('StructureManager.disposeChunk', () => {
  beforeEach(() => {
    mockMeshDispose.mockClear();
    mockBodyDispose.mockClear();
  });

  it('does not throw for a chunk that was never loaded', () => {
    const sm = new StructureManager(mockScene);
    expect(() => sm.disposeChunk(0, 0)).not.toThrow();
    expect(() => sm.disposeChunk(100, -200)).not.toThrow();
  });

  it('can be called multiple times on the same chunk without throwing', () => {
    const sm = new StructureManager(mockScene);
    expect(() => {
      sm.disposeChunk(5, 5);
      sm.disposeChunk(5, 5);
    }).not.toThrow();
  });
});

describe('StructureManager.trySpawnForChunk — physics disposal', () => {
  beforeEach(() => {
    mockMeshDispose.mockClear();
    mockBodyDispose.mockClear();
  });

  it('disposeChunk disposes all physics bodies for a spawned structure', () => {
    const sm = new StructureManager(mockScene);

    // Find a chunk that has a structure (plains/forest → ruins)
    let structureChunk: [number, number] | null = null;
    for (let x = 0; x < 20 && !structureChunk; x++) {
      for (let z = 0; z < 20 && !structureChunk; z++) {
        if (sm.hasStructureAt(x, z)) structureChunk = [x, z];
      }
    }
    expect(structureChunk).not.toBeNull();
    const [cx, cz] = structureChunk!;

    sm.trySpawnForChunk(cx, cz, 'plains', 50);
    mockBodyDispose.mockClear(); // ignore aggregates created during spawning

    sm.disposeChunk(cx, cz);
    // Ruins create 4 wall aggregates + 1 chest aggregate = 5 bodies
    expect(mockBodyDispose).toHaveBeenCalled();
  });

  it('disposeChunk disposes physics bodies before meshes', () => {
    const callOrder: string[] = [];
    mockBodyDispose.mockImplementation(() => callOrder.push('body'));
    mockMeshDispose.mockImplementation(() => callOrder.push('mesh'));

    const sm = new StructureManager(mockScene);
    let cx = 0, cz = 0;
    let found = false;
    for (let x = 0; x < 20 && !found; x++) {
      for (let z = 0; z < 20 && !found; z++) {
        if (sm.hasStructureAt(x, z)) { cx = x; cz = z; found = true; }
      }
    }

    sm.trySpawnForChunk(cx, cz, 'plains', 50);
    callOrder.length = 0; // reset after spawn
    sm.disposeChunk(cx, cz);

    // First disposal call must be a body, not a mesh
    expect(callOrder[0]).toBe('body');
  });

  it('trySpawnForChunk is a no-op for an already-processed chunk', () => {
    vi.mocked(MeshBuilder.CreateBox).mockClear();

    const sm = new StructureManager(mockScene);
    let cx = 0, cz = 0;
    let found = false;
    for (let x = 0; x < 20 && !found; x++) {
      for (let z = 0; z < 20 && !found; z++) {
        if (sm.hasStructureAt(x, z)) { cx = x; cz = z; found = true; }
      }
    }

    sm.trySpawnForChunk(cx, cz, 'plains', 50);
    const countAfterFirst = vi.mocked(MeshBuilder.CreateBox).mock.calls.length;
    sm.trySpawnForChunk(cx, cz, 'plains', 50); // should be a no-op
    expect(vi.mocked(MeshBuilder.CreateBox).mock.calls.length).toBe(countAfterFirst);
  });

  it('disposeChunk for non-structure chunk does not call dispose', () => {
    const sm = new StructureManager(mockScene);

    // Find a chunk with no structure
    let noStructChunk: [number, number] | null = null;
    for (let x = 0; x < 20 && !noStructChunk; x++) {
      for (let z = 0; z < 20 && !noStructChunk; z++) {
        if (!sm.hasStructureAt(x, z)) noStructChunk = [x, z];
      }
    }
    expect(noStructChunk).not.toBeNull();
    const [cx, cz] = noStructChunk!;

    sm.trySpawnForChunk(cx, cz, 'plains', 50);
    sm.disposeChunk(cx, cz);

    // No meshes or bodies should have been disposed (structure was empty)
    expect(mockMeshDispose).not.toHaveBeenCalled();
    expect(mockBodyDispose).not.toHaveBeenCalled();
  });
});

describe('StructureManager shared material pool', () => {
  beforeEach(() => {
    standardMaterialInstances.length = 0;
  });

  it('reuses the same material for the same structure type across different chunks', () => {
    const sm = new StructureManager(mockScene);

    // Spawn ruins at two different plains chunks
    const ruinChunks: Array<[number, number]> = [];
    for (let x = 0; x < 30 && ruinChunks.length < 2; x++) {
      for (let z = 0; z < 30 && ruinChunks.length < 2; z++) {
        if (sm.hasStructureAt(x, z)) ruinChunks.push([x, z]);
      }
    }
    expect(ruinChunks.length).toBeGreaterThanOrEqual(2);

    sm.trySpawnForChunk(ruinChunks[0][0], ruinChunks[0][1], 'plains', 50);
    const matsAfterFirst = standardMaterialInstances.length;

    sm.trySpawnForChunk(ruinChunks[1][0], ruinChunks[1][1], 'plains', 50);
    const matsAfterSecond = standardMaterialInstances.length;

    // Second ruins spawn must reuse existing materials — no new ones created
    expect(matsAfterSecond).toBe(matsAfterFirst);
  });

  it('uses at most 30 unique material types for all three structure types combined', () => {
    // original 6: ruins_stone, shrine_stone, shrine_altar, tower_stone, tower_wood, chest_wood
    // fantasy props add: torch_iron, torch_wood, torch_flame, campfire_stone, campfire_log,
    // campfire_flame, barrel_wood, barrel_iron, banner_pole, banner_pennant_bandits,
    // banner_pennant_imperial, standing_stone, standing_stone_cap, shrine_rune
    const MAX_STRUCTURE_MATERIAL_TYPES = 30;
    const sm = new StructureManager(mockScene);

    const biomesNeeded: Array<'plains' | 'desert' | 'tundra'> = ['plains', 'desert', 'tundra'];
    for (const biome of biomesNeeded) {
      for (let x = 0; x < 30; x++) {
        for (let z = 0; z < 30; z++) {
          if (sm.hasStructureAt(x, z)) {
            sm.trySpawnForChunk(x, z, biome, 50);
          }
        }
      }
    }

    const uniqueMatNames = new Set(standardMaterialInstances.map(m => m.name));
    expect(uniqueMatNames.size).toBeLessThanOrEqual(MAX_STRUCTURE_MATERIAL_TYPES);
  });
});

describe('StructureManager.dispose', () => {
  beforeEach(() => {
    mockMeshDispose.mockClear();
    mockBodyDispose.mockClear();
  });

  it('dispose() releases meshes and physics bodies for all tracked structures', () => {
    const sm = new StructureManager(mockScene);

    // Spawn structures across several chunks
    for (let x = 0; x < 10; x++) {
      for (let z = 0; z < 10; z++) {
        sm.trySpawnForChunk(x, z, 'plains', 50);
      }
    }

    sm.dispose();

    // All bodies and meshes from spawned structures should have been disposed
    expect(mockBodyDispose).toHaveBeenCalled();
    expect(mockMeshDispose).toHaveBeenCalled();
  });

  it('dispose() releases physics bodies before meshes', () => {
    const callOrder: string[] = [];
    mockBodyDispose.mockImplementation(() => callOrder.push('body'));
    mockMeshDispose.mockImplementation(() => callOrder.push('mesh'));

    const sm = new StructureManager(mockScene);
    // Find a chunk that has a structure so bodies/meshes are actually created
    let structCx = -1, structCz = -1;
    outer:
    for (let x = 0; x < 20; x++) {
      for (let z = 0; z < 20; z++) {
        if (sm.hasStructureAt(x, z)) { structCx = x; structCz = z; break outer; }
      }
    }
    sm.trySpawnForChunk(structCx, structCz, 'plains', 50);

    callOrder.length = 0;
    sm.dispose();

    const firstBody = callOrder.indexOf('body');
    const firstMesh = callOrder.indexOf('mesh');
    expect(firstBody).toBeGreaterThanOrEqual(0);
    expect(firstMesh).toBeGreaterThan(firstBody);
  });

  it('dispose() is idempotent — calling it twice does not throw', () => {
    const sm = new StructureManager(mockScene);
    for (let x = 0; x < 5; x++) {
      sm.trySpawnForChunk(x, x, 'plains', 50);
    }
    expect(() => { sm.dispose(); sm.dispose(); }).not.toThrow();
  });
});

// ── Seed integration ──────────────────────────────────────────────────────────

describe('StructureManager with WorldSeed', () => {
  it('uses the seed hasStructure() when a seed is provided', async () => {
    const { WorldSeed } = await import('./world-seed');
    // "none" density → no structures
    const seed = new WorldSeed(1, { structureDensity: 'none' });
    const sm = new StructureManager(mockScene, null, seed);
    for (let x = -5; x <= 5; x++) {
      for (let z = -5; z <= 5; z++) {
        expect(sm.hasStructureAt(x, z)).toBe(false);
      }
    }
  });

  it('falls back to default ~25% rate when no seed is supplied', () => {
    const sm = new StructureManager(mockScene);
    let count = 0;
    for (let x = -10; x <= 10; x++) {
      for (let z = -10; z <= 10; z++) {
        if (sm.hasStructureAt(x, z)) count++;
      }
    }
    const total = 21 * 21;
    // Default threshold is 25%, expect 5–50% (generous for hash non-uniformity)
    expect(count / total).toBeGreaterThan(0.05);
    expect(count / total).toBeLessThan(0.50);
  });

  it('flat worldType suppresses structure spawning', async () => {
    const { WorldSeed } = await import('./world-seed');
    const seed = new WorldSeed(1, { worldType: 'flat' });
    const sm = new StructureManager(mockScene, null, seed);
    for (let x = -5; x <= 5; x++) {
      for (let z = -5; z <= 5; z++) {
        expect(sm.hasStructureAt(x, z)).toBe(false);
      }
    }
  });
});
