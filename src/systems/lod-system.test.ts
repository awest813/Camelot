import { describe, it, expect, beforeEach, vi } from "vitest";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { LodSystem } from "./lod-system";

// ── Minimal Mesh stub ─────────────────────────────────────────────────────────

interface MeshStub {
  position: Vector3;
  isVisible: boolean;
  _disposed: boolean;
  isDisposed(): boolean;
  dispose(): void;
}

function makeMesh(x: number = 0, y: number = 0, z: number = 0) {
  const stub: MeshStub = {
    position: new Vector3(x, y, z),
    isVisible: true,
    _disposed: false,
    isDisposed() { return this._disposed; },
    dispose() { this._disposed = true; },
  };
  return stub as unknown as import("@babylonjs/core/Meshes/mesh").Mesh;
}

const PLAYER_ORIGIN = new Vector3(0, 0, 0);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("LodSystem", () => {
  let lod: LodSystem;

  beforeEach(() => {
    // Update interval = 1 so every call to update() runs the pass immediately
    lod = new LodSystem(1);
  });

  it("is constructed with zero entries", () => {
    expect(lod.entryCount).toBe(0);
  });

  it("register() adds a mesh entry", () => {
    const mesh = makeMesh(0, 0, 0);
    lod.register(mesh, 100);
    expect(lod.entryCount).toBe(1);
  });

  it("register() ignores duplicate registrations", () => {
    const mesh = makeMesh(0, 0, 0);
    lod.register(mesh, 100);
    lod.register(mesh, 200); // same mesh
    expect(lod.entryCount).toBe(1);
  });

  it("register() clamps invalid cullDistance to 1", () => {
    const mesh = makeMesh(0, 0, 0);
    lod.register(mesh, -10); // invalid — should clamp to 1
    // Player at origin; mesh at origin → distance 0 ≤ 1 → visible
    lod.update(PLAYER_ORIGIN);
    expect(mesh.isVisible).toBe(true);
  });

  it("keeps a mesh visible when inside cull distance", () => {
    const mesh = makeMesh(10, 0, 0); // 10 units away
    lod.register(mesh, 50);
    lod.update(PLAYER_ORIGIN);
    expect(mesh.isVisible).toBe(true);
  });

  it("hides a mesh when beyond cull distance", () => {
    const mesh = makeMesh(200, 0, 0); // 200 units away
    lod.register(mesh, 50);
    lod.update(PLAYER_ORIGIN);
    expect(mesh.isVisible).toBe(false);
  });

  it("restores visibility when player moves inside cull distance", () => {
    const mesh = makeMesh(200, 0, 0);
    lod.register(mesh, 50);
    lod.update(PLAYER_ORIGIN); // cull
    expect(mesh.isVisible).toBe(false);

    lod.update(new Vector3(180, 0, 0)); // now 20 units from mesh → inside 50
    expect(mesh.isVisible).toBe(true);
  });

  it("update() returns the count of culled meshes", () => {
    lod.register(makeMesh(5, 0, 0), 50);   // inside
    lod.register(makeMesh(200, 0, 0), 50); // culled
    lod.register(makeMesh(300, 0, 0), 50); // culled
    const culled = lod.update(PLAYER_ORIGIN);
    expect(culled).toBe(2);
  });

  it("unregister() restores visibility and removes the entry", () => {
    const mesh = makeMesh(200, 0, 0);
    lod.register(mesh, 50);
    lod.update(PLAYER_ORIGIN); // cull the mesh
    expect(mesh.isVisible).toBe(false);

    lod.unregister(mesh);
    expect(lod.entryCount).toBe(0);
    expect(mesh.isVisible).toBe(true); // restored
  });

  it("unregister() is safe for meshes not in the registry", () => {
    const mesh = makeMesh(0, 0, 0);
    expect(() => lod.unregister(mesh)).not.toThrow();
  });

  it("clear() restores visibility and empties the registry", () => {
    const near = makeMesh(5, 0, 0);
    const far  = makeMesh(200, 0, 0);
    lod.register(near, 50);
    lod.register(far, 50);
    lod.update(PLAYER_ORIGIN);
    expect(far.isVisible).toBe(false);

    lod.clear();
    expect(lod.entryCount).toBe(0);
    expect(near.isVisible).toBe(true);
    expect(far.isVisible).toBe(true);
  });

  it("update() silently skips and prunes disposed meshes", () => {
    const mesh = makeMesh(200, 0, 0);
    lod.register(mesh, 50);
    mesh.dispose(); // dispose the mesh before update

    expect(() => lod.update(PLAYER_ORIGIN)).not.toThrow();
    // Disposed mesh should be pruned from entries
    expect(lod.entryCount).toBe(0);
  });

  it("respects updateEveryNFrames throttle", () => {
    // interval = 3 → only frames 3, 6, 9, … actually run the pass
    const throttled = new LodSystem(3);
    const mesh = makeMesh(200, 0, 0);
    throttled.register(mesh, 50);

    // Frame 1 — skipped
    throttled.update(PLAYER_ORIGIN);
    // Frame 2 — skipped
    throttled.update(PLAYER_ORIGIN);
    // Both skips should leave initial state (isVisible = true) unchanged
    expect(mesh.isVisible).toBe(true);

    // Frame 3 — runs the pass
    throttled.update(PLAYER_ORIGIN);
    expect(mesh.isVisible).toBe(false);
  });

  it("handles multiple meshes at varying distances correctly", () => {
    const close  = makeMesh(5, 0, 0);
    const medium = makeMesh(80, 0, 0);
    const far    = makeMesh(150, 0, 0);
    lod.register(close,  100);
    lod.register(medium, 100);
    lod.register(far,    100);

    lod.update(PLAYER_ORIGIN);
    expect(close.isVisible).toBe(true);   //   5 < 100
    expect(medium.isVisible).toBe(true);  //  80 < 100
    expect(far.isVisible).toBe(false);    // 150 > 100
  });

  // ── Multi-level LOD ───────────────────────────────────────────────────────

  it("registerLevels() counts all level meshes in entryCount", () => {
    const hi  = makeMesh(10, 0, 0);
    const med = makeMesh(10, 0, 0);
    const lo  = makeMesh(10, 0, 0);
    lod.registerLevels([
      { mesh: hi,  maxDistance: 50  },
      { mesh: med, maxDistance: 100 },
      { mesh: lo,  maxDistance: 200 },
    ]);
    expect(lod.entryCount).toBe(3);
  });

  it("registerLevels() shows highest-detail mesh when close", () => {
    const hi  = makeMesh(10, 0, 0);
    const med = makeMesh(10, 0, 0);
    const lo  = makeMesh(10, 0, 0);
    lod.registerLevels([
      { mesh: hi,  maxDistance: 50  },
      { mesh: med, maxDistance: 100 },
      { mesh: lo,  maxDistance: 200 },
    ]);
    // Player at origin; meshes at x=10 → distance 10
    lod.update(PLAYER_ORIGIN);
    expect(hi.isVisible).toBe(true);   // 10 ≤ 50 → show hi
    expect(med.isVisible).toBe(false); // hi already chosen
    expect(lo.isVisible).toBe(false);
  });

  it("registerLevels() shows medium mesh when mid-range", () => {
    const hi  = makeMesh(70, 0, 0);
    const med = makeMesh(70, 0, 0);
    const lo  = makeMesh(70, 0, 0);
    lod.registerLevels([
      { mesh: hi,  maxDistance: 50  },
      { mesh: med, maxDistance: 100 },
      { mesh: lo,  maxDistance: 200 },
    ]);
    // distance = 70 → beyond hi(50) but within med(100)
    lod.update(PLAYER_ORIGIN);
    expect(hi.isVisible).toBe(false);  // 70 > 50
    expect(med.isVisible).toBe(true);  // 70 ≤ 100
    expect(lo.isVisible).toBe(false);
  });

  it("registerLevels() shows lowest mesh when far away", () => {
    const hi  = makeMesh(150, 0, 0);
    const med = makeMesh(150, 0, 0);
    const lo  = makeMesh(150, 0, 0);
    lod.registerLevels([
      { mesh: hi,  maxDistance: 50  },
      { mesh: med, maxDistance: 100 },
      { mesh: lo,  maxDistance: 200 },
    ]);
    // distance = 150 → beyond hi and med, within lo(200)
    lod.update(PLAYER_ORIGIN);
    expect(hi.isVisible).toBe(false);
    expect(med.isVisible).toBe(false);
    expect(lo.isVisible).toBe(true);   // 150 ≤ 200
  });

  it("registerLevels() hides all meshes when beyond max LOD distance", () => {
    const hi  = makeMesh(300, 0, 0);
    const med = makeMesh(300, 0, 0);
    const lo  = makeMesh(300, 0, 0);
    lod.registerLevels([
      { mesh: hi,  maxDistance: 50  },
      { mesh: med, maxDistance: 100 },
      { mesh: lo,  maxDistance: 200 },
    ]);
    // distance = 300 → beyond all levels
    lod.update(PLAYER_ORIGIN);
    expect(hi.isVisible).toBe(false);
    expect(med.isVisible).toBe(false);
    expect(lo.isVisible).toBe(false);
  });

  it("registerLevels() switches levels as player moves", () => {
    const hi  = makeMesh(10, 0, 0);
    const med = makeMesh(10, 0, 0);
    const lo  = makeMesh(10, 0, 0);
    lod.registerLevels([
      { mesh: hi,  maxDistance: 30  },
      { mesh: med, maxDistance: 80  },
      { mesh: lo,  maxDistance: 150 },
    ]);

    // Close — hi visible
    lod.update(new Vector3(0, 0, 0));
    expect(hi.isVisible).toBe(true);
    expect(med.isVisible).toBe(false);
    expect(lo.isVisible).toBe(false);

    // Move player back to x=-50 → distance 60 → med visible
    lod.update(new Vector3(-50, 0, 0));
    expect(hi.isVisible).toBe(false);
    expect(med.isVisible).toBe(true);
    expect(lo.isVisible).toBe(false);

    // Move further → x=-130 → distance 140 → lo visible
    lod.update(new Vector3(-130, 0, 0));
    expect(hi.isVisible).toBe(false);
    expect(med.isVisible).toBe(false);
    expect(lo.isVisible).toBe(true);

    // Move very far → x=-200 → distance 210 → all hidden
    lod.update(new Vector3(-200, 0, 0));
    expect(hi.isVisible).toBe(false);
    expect(med.isVisible).toBe(false);
    expect(lo.isVisible).toBe(false);
  });

  it("unregisterLevels() restores visibility and removes the group", () => {
    const hi  = makeMesh(200, 0, 0);
    const lo  = makeMesh(200, 0, 0);
    lod.registerLevels([
      { mesh: hi, maxDistance: 50  },
      { mesh: lo, maxDistance: 150 },
    ]);
    lod.update(PLAYER_ORIGIN); // both culled at distance 200

    lod.unregisterLevels(hi);
    expect(lod.entryCount).toBe(0);
    expect(hi.isVisible).toBe(true);
    expect(lo.isVisible).toBe(true);
  });

  it("unregisterLevels() is safe for unknown mesh", () => {
    const mesh = makeMesh(0, 0, 0);
    expect(() => lod.unregisterLevels(mesh)).not.toThrow();
  });

  it("clear() removes level groups and restores their visibility", () => {
    const hi = makeMesh(300, 0, 0);
    const lo = makeMesh(300, 0, 0);
    lod.registerLevels([
      { mesh: hi, maxDistance: 50  },
      { mesh: lo, maxDistance: 150 },
    ]);
    lod.update(PLAYER_ORIGIN); // all hidden
    expect(hi.isVisible).toBe(false);
    expect(lo.isVisible).toBe(false);

    lod.clear();
    expect(lod.entryCount).toBe(0);
    expect(hi.isVisible).toBe(true);
    expect(lo.isVisible).toBe(true);
  });

  it("registerLevels() prunes disposed mesh levels on update", () => {
    const hi  = makeMesh(10, 0, 0);
    const med = makeMesh(10, 0, 0);
    lod.registerLevels([
      { mesh: hi,  maxDistance: 50  },
      { mesh: med, maxDistance: 100 },
    ]);
    hi.dispose();
    med.dispose();

    expect(() => lod.update(PLAYER_ORIGIN)).not.toThrow();
    expect(lod.entryCount).toBe(0);
  });

  it("registerLevels() ignores duplicate group registration", () => {
    const hi  = makeMesh(10, 0, 0);
    const med = makeMesh(10, 0, 0);
    const levels = [
      { mesh: hi,  maxDistance: 50  },
      { mesh: med, maxDistance: 100 },
    ];
    lod.registerLevels(levels);
    lod.registerLevels(levels); // same first mesh reference
    expect(lod.entryCount).toBe(2); // not 4
  });

  it("update() culled count includes hidden level meshes", () => {
    const hi  = makeMesh(300, 0, 0);
    const med = makeMesh(300, 0, 0);
    const lo  = makeMesh(300, 0, 0);
    lod.registerLevels([
      { mesh: hi,  maxDistance: 50  },
      { mesh: med, maxDistance: 100 },
      { mesh: lo,  maxDistance: 200 },
    ]);
    const culled = lod.update(PLAYER_ORIGIN);
    // All 3 level meshes are beyond their maxDistance → all hidden
    expect(culled).toBe(3);
  });
});
