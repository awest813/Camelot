import { describe, it, expect, vi, beforeEach } from "vitest";
import { CellManager } from "./cell-manager";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

// ── Babylon mocks ─────────────────────────────────────────────────────────────

vi.mock("@babylonjs/core/Meshes/meshBuilder", () => ({
  MeshBuilder: {
    CreateBox: vi.fn(() => ({
      position: { x: 0, y: 0, z: 0, clone: vi.fn(() => new Vector3(0, 0, 0)) },
      metadata: null,
      material: null,
      isDisposed: vi.fn(() => false),
      dispose: vi.fn(),
    })),
  },
}));

vi.mock("@babylonjs/core/Materials/standardMaterial", () => ({
  StandardMaterial: class {
    diffuseColor: any = null;
    emissiveColor: any = null;
    alpha: number = 1;
    constructor(_name: string, _scene: any) {}
  },
}));

vi.mock("@babylonjs/core/Maths/math.color", () => ({
  Color3: class {
    constructor(public r = 0, public g = 0, public b = 0) {}
  },
}));

// ─────────────────────────────────────────────────────────────────────────────

describe("CellManager", () => {
  let cellManager: CellManager;
  let mockScene: any;
  let mockPlayer: any;

  beforeEach(() => {
    mockScene = {};
    mockPlayer = {
      camera: { position: new Vector3(0, 5, 0) },
    };

    cellManager = new CellManager(mockScene, mockPlayer);
  });

  it("starts in the exterior cell", () => {
    expect(cellManager.currentCellId).toBe("exterior");
    expect(cellManager.isInterior).toBe(false);
  });

  it("exterior cell is always registered", () => {
    expect(cellManager.currentCell).toBeDefined();
    expect(cellManager.currentCell!.name).toBe("Exterior World");
  });

  it("registerCell makes cell available", () => {
    cellManager.registerCell({
      id: "cave_01",
      name: "Dark Cave",
      type: "interior",
      spawnPosition: new Vector3(0, 1, 0),
    });
    // No direct public get() accessor, but we can verify via transition below
  });

  it("spawnPortal creates a portal with correct metadata", () => {
    cellManager.registerCell({
      id: "cave_01",
      name: "Cave",
      type: "interior",
      spawnPosition: new Vector3(0, 1, 0),
    });

    const portal = cellManager.spawnPortal(
      "p1",
      new Vector3(5, 1, 5),
      "cave_01",
      new Vector3(0, 1, 0),
      "Enter Cave",
    );

    expect(portal.id).toBe("p1");
    expect(portal.targetCellId).toBe("cave_01");
    expect(portal.labelText).toBe("Enter Cave");
    expect(cellManager.portals.has("p1")).toBe(true);
  });

  it("tryTransition returns false for unknown portal", () => {
    expect(cellManager.tryTransition("nonexistent")).toBe(false);
  });

  it("tryTransition teleports player to target position", () => {
    cellManager.registerCell({
      id: "cave_01",
      name: "Cave",
      type: "interior",
      spawnPosition: new Vector3(0, 1, 0),
    });

    const targetPos = new Vector3(3, 1, 5);
    cellManager.spawnPortal("p2", new Vector3(5, 1, 5), "cave_01", targetPos);

    const result = cellManager.tryTransition("p2");
    expect(result).toBe(true);
    // Player should have been teleported to the target position
    const pos = mockPlayer.camera.position;
    expect(pos.x).toBeCloseTo(targetPos.x, 1);
    expect(pos.z).toBeCloseTo(targetPos.z, 1);
  });

  it("tryTransition updates currentCellId", () => {
    cellManager.registerCell({
      id: "tower_01",
      name: "Tower",
      type: "interior",
      spawnPosition: new Vector3(0, 1, 0),
    });
    cellManager.spawnPortal("p3", new Vector3(0, 0, 0), "tower_01", new Vector3(0, 1, 0));
    cellManager.tryTransition("p3");
    expect(cellManager.currentCellId).toBe("tower_01");
  });

  it("tryTransition tracks visited cells", () => {
    cellManager.registerCell({ id: "dungeon_01", name: "Dungeon", type: "interior", spawnPosition: new Vector3() });
    cellManager.spawnPortal("p4", new Vector3(), "dungeon_01", new Vector3());
    cellManager.tryTransition("p4");
    expect(cellManager.visitedCellIds).toContain("dungeon_01");
    expect(cellManager.visitedCellIds).toContain("exterior");
  });

  it("tryTransition fires onCellChanged callback", () => {
    const spy = vi.fn();
    cellManager.onCellChanged = spy;

    cellManager.registerCell({ id: "inn_01", name: "The Prancing Pony", type: "interior", spawnPosition: new Vector3() });
    cellManager.spawnPortal("p5", new Vector3(), "inn_01", new Vector3());
    cellManager.tryTransition("p5");

    expect(spy).toHaveBeenCalledWith("inn_01", "The Prancing Pony");
  });

  it("isInterior is true after transitioning to interior cell", () => {
    cellManager.registerCell({ id: "shop_01", name: "Shop", type: "interior", spawnPosition: new Vector3() });
    cellManager.spawnPortal("p6", new Vector3(), "shop_01", new Vector3());
    cellManager.tryTransition("p6");
    expect(cellManager.isInterior).toBe(true);
  });

  it("interior build function is called during transition", () => {
    const buildSpy = vi.fn(() => []);
    cellManager.registerCell({
      id: "chapel_01",
      name: "Chapel",
      type: "interior",
      spawnPosition: new Vector3(),
      build: buildSpy,
    });
    cellManager.spawnPortal("p7", new Vector3(), "chapel_01", new Vector3());
    cellManager.tryTransition("p7");
    expect(buildSpy).toHaveBeenCalled();
  });

  it("saves and restores state", () => {
    cellManager.registerCell({ id: "crypt_01", name: "Crypt", type: "interior", spawnPosition: new Vector3() });
    cellManager.spawnPortal("p8", new Vector3(), "crypt_01", new Vector3());
    cellManager.tryTransition("p8");

    const saved = cellManager.getSaveState();
    const fresh = new CellManager(mockScene, mockPlayer);
    fresh.restoreFromSave(saved);

    expect(fresh.currentCellId).toBe("crypt_01");
    expect(fresh.visitedCellIds).toContain("crypt_01");
  });
});
