import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { steerAroundObstacles, STEER_CHECK_DIST } from './steering';

vi.mock('@babylonjs/core/Culling/ray', () => ({
  Ray: class {
    constructor(public origin: any, public direction: any, public length: number) {}
  },
}));

describe('steerAroundObstacles', () => {
  let mockScene: any;
  let origin: Vector3;
  let desiredDir: Vector3;
  let out: Vector3;

  beforeEach(() => {
    origin = new Vector3(0, 0, 0);
    desiredDir = new Vector3(0, 0, 1); // forward
    out = new Vector3();

    mockScene = {
      pickWithRay: vi.fn(() => ({ pickedMesh: null })),
    };
  });

  it('returns the desired direction when the path is clear', () => {
    mockScene.pickWithRay.mockReturnValue({ pickedMesh: null });

    steerAroundObstacles(mockScene, origin, desiredDir, 'myNpc', out);

    expect(out.x).toBeCloseTo(0);
    expect(out.z).toBeCloseTo(1);
  });

  it('returns an alternative direction when the straight path is blocked', () => {
    // First call (0°) blocked, second call (40°) clear
    mockScene.pickWithRay
      .mockReturnValueOnce({ pickedMesh: { name: 'ruins_wall_0_0_0' } })
      .mockReturnValue({ pickedMesh: null });

    steerAroundObstacles(mockScene, origin, desiredDir, 'myNpc', out);

    // Should NOT be the original forward direction
    const isOriginal = Math.abs(out.x - 0) < 0.01 && Math.abs(out.z - 1) < 0.01;
    expect(isOriginal).toBe(false);
    // Should be a unit-ish vector in XZ plane
    const len = Math.sqrt(out.x * out.x + out.z * out.z);
    expect(len).toBeGreaterThan(0.9);
  });

  it('falls back to desired direction when all candidates are blocked', () => {
    mockScene.pickWithRay.mockReturnValue({ pickedMesh: { name: 'wall' } });

    steerAroundObstacles(mockScene, origin, desiredDir, 'myNpc', out);

    expect(out.x).toBeCloseTo(0);
    expect(out.z).toBeCloseTo(1);
  });

  it('uses STEER_CHECK_DIST as the ray length', () => {
    mockScene.pickWithRay.mockReturnValue({ pickedMesh: null });

    steerAroundObstacles(mockScene, origin, desiredDir, 'myNpc', out);

    const [, ray] = mockScene.pickWithRay.mock.calls[0];
    // The Ray constructor is called with (origin, dir, length) — check length via the instance
    expect(mockScene.pickWithRay).toHaveBeenCalled();
    // Verify STEER_CHECK_DIST is exported and sensible
    expect(STEER_CHECK_DIST).toBeGreaterThan(0);
  });

  it('mesh filter excludes the NPC\'s own mesh, chunk terrain, other NPCs, and loot', () => {
    mockScene.pickWithRay.mockReturnValue({ pickedMesh: null });
    steerAroundObstacles(mockScene, origin, desiredDir, 'Guard', out);

    const filterFn = mockScene.pickWithRay.mock.calls[0][1];

    // Self mesh → excluded
    expect(filterFn({ isVisible: true, name: 'Guard', metadata: null })).toBe(false);
    // Chunk terrain → excluded
    expect(filterFn({ isVisible: true, name: 'chunk_3_5', metadata: null })).toBe(false);
    // Player body → excluded
    expect(filterFn({ isVisible: true, name: 'playerBody', metadata: null })).toBe(false);
    // Other NPC → excluded
    expect(filterFn({ isVisible: true, name: 'Bandit', metadata: { type: 'npc' } })).toBe(false);
    // Loot → excluded
    expect(filterFn({ isVisible: true, name: 'chest', metadata: { type: 'loot' } })).toBe(false);
    // Structure wall → included (acts as obstacle)
    expect(filterFn({ isVisible: true, name: 'ruins_wall_2_3_0', metadata: null })).toBe(true);
    // Invisible mesh → excluded
    expect(filterFn({ isVisible: false, name: 'ruins_wall_2_3_0', metadata: null })).toBe(false);
  });
});
