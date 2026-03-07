import { describe, it, expect, vi, beforeEach } from "vitest";
import { ContainerSystem } from "./container-system";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

// ── Babylon mocks ─────────────────────────────────────────────────────────────

vi.mock("@babylonjs/core/Meshes/meshBuilder", () => ({
  MeshBuilder: {
    CreateBox: vi.fn(() => ({
      position: { x: 0, y: 0, z: 0, copyFrom: vi.fn() },
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
    specularColor: any = null;
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

describe("ContainerSystem", () => {
  let containerSystem: ContainerSystem;
  let mockScene: any;
  let mockPlayer: any;
  let mockInventory: any;
  let mockUI: any;

  const sampleItem = {
    id: "gold",
    name: "Gold Coins",
    description: "Shiny coins.",
    stackable: true,
    quantity: 50,
    weight: 0.1,
    stats: { value: 1 },
  };

  beforeEach(() => {
    mockScene = {};
    mockPlayer = { camera: { position: new Vector3(0, 0, 0) } };
    mockUI = { showNotification: vi.fn() };
    mockInventory = {
      items: [],
      addItem: vi.fn(() => true),
      removeItem: vi.fn(() => true),
    };

    containerSystem = new ContainerSystem(mockScene, mockPlayer, mockInventory, mockUI);
  });

  it("spawnContainer creates a container with the given contents", () => {
    const container = containerSystem.spawnContainer({
      id: "chest_1",
      name: "Chest",
      position: new Vector3(0, 0, 0),
      contents: [{ ...sampleItem }],
    });

    expect(container.id).toBe("chest_1");
    expect(container.contents).toHaveLength(1);
    expect(container.isLocked).toBe(false);
  });

  it("spawnContainer registers the container in the map", () => {
    containerSystem.spawnContainer({ id: "c1", name: "C", position: new Vector3(), contents: [] });
    expect(containerSystem.getContainer("c1")).toBeDefined();
  });

  it("tryOpen returns true for an unlocked container", () => {
    const container = containerSystem.spawnContainer({ id: "c2", name: "C", position: new Vector3(), contents: [] });
    const result = containerSystem.tryOpen(container);
    expect(result).toBe(true);
    expect(container.isOpen).toBe(true);
    expect(containerSystem.activeContainer).toBe(container);
  });

  it("tryOpen returns false if locked and skill too low", () => {
    const container = containerSystem.spawnContainer({
      id: "c3", name: "C", position: new Vector3(), contents: [],
      isLocked: true, lockDifficulty: 50,
    });
    const result = containerSystem.tryOpen(container, 20); // skill 20 < difficulty 50
    expect(result).toBe(false);
    expect(mockUI.showNotification).toHaveBeenCalled();
  });

  it("tryOpen succeeds when skill >= lockDifficulty", () => {
    const container = containerSystem.spawnContainer({
      id: "c4", name: "C", position: new Vector3(), contents: [],
      isLocked: true, lockDifficulty: 30,
    });
    expect(containerSystem.tryOpen(container, 30)).toBe(true);
  });

  it("tryOpen fires onContainerOpen callback", () => {
    const spy = vi.fn();
    containerSystem.onContainerOpen = spy;
    const container = containerSystem.spawnContainer({ id: "c5", name: "C", position: new Vector3(), contents: [] });
    containerSystem.tryOpen(container);
    expect(spy).toHaveBeenCalledWith(container);
  });

  it("takeItem transfers one item from container to inventory", () => {
    const container = containerSystem.spawnContainer({
      id: "c6", name: "C", position: new Vector3(), contents: [{ ...sampleItem }],
    });
    const result = containerSystem.takeItem("c6", "gold");
    expect(result).toBe(true);
    expect(mockInventory.addItem).toHaveBeenCalled();
  });

  it("takeItem returns false if itemId not found", () => {
    containerSystem.spawnContainer({ id: "c7", name: "C", position: new Vector3(), contents: [] });
    expect(containerSystem.takeItem("c7", "nonexistent")).toBe(false);
  });

  it("takeItem decrements stack quantity instead of removing when qty > 1", () => {
    const container = containerSystem.spawnContainer({
      id: "c8", name: "C", position: new Vector3(),
      contents: [{ ...sampleItem, quantity: 3 }],
    });
    containerSystem.takeItem("c8", "gold");
    const remaining = containerSystem.getContainer("c8")!.contents[0];
    expect(remaining.quantity).toBe(2);
  });

  it("takeAll moves all items and shows notification", () => {
    const container = containerSystem.spawnContainer({
      id: "c9", name: "C", position: new Vector3(),
      contents: [{ ...sampleItem }, { id: "sword", name: "Sword", description: "", stackable: false, quantity: 1 }],
    });
    const count = containerSystem.takeAll("c9");
    expect(count).toBe(2);
    expect(mockUI.showNotification).toHaveBeenCalled();
  });

  it("closeContainer clears activeContainer", () => {
    const container = containerSystem.spawnContainer({ id: "c10", name: "C", position: new Vector3(), contents: [] });
    containerSystem.tryOpen(container);
    containerSystem.closeContainer();
    expect(containerSystem.activeContainer).toBeNull();
    expect(container.isOpen).toBe(false);
  });

  it("saves and restores container contents", () => {
    const container = containerSystem.spawnContainer({
      id: "c11", name: "C", position: new Vector3(),
      contents: [{ ...sampleItem, quantity: 10 }],
    });
    const saved = containerSystem.getSaveState();

    // Drain the container, then restore
    container.contents = [];
    containerSystem.restoreFromSave(saved);
    expect(container.contents).toHaveLength(1);
    expect(container.contents[0].quantity).toBe(10);
  });
});
