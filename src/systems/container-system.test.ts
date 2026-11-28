import { describe, it, expect, vi, beforeEach } from "vitest";
import { ContainerSystem, LOCKPICK, pickChance } from "./container-system";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

// ── Babylon mocks ─────────────────────────────────────────────────────────────

vi.mock("../rendering/mesh-builder", () => ({
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

  it("saves the Warden's Key charges left", () => {
    containerSystem.masterKeys = 2;
    const saved = containerSystem.getSaveState();
    containerSystem.masterKeys = 0;
    containerSystem.restoreFromSave(saved);
    expect(containerSystem.masterKeys).toBe(2);
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

  it("picking a lock: a roll under the chance opens it; a miss snaps a pick; no picks, no try", () => {
    let n = 0;
    const strongbox = () => containerSystem.spawnContainer({ id: `s${n++}`, name: "Strongbox", position: new Vector3(), contents: [], isLocked: true, lockDifficulty: 35 });
    mockInventory.items = [{ ...LOCKPICK, quantity: 2 }];
    mockInventory.removeQuantity = vi.fn((_id: string, k: number) => { mockInventory.items[0].quantity -= k; return true; });
    containerSystem.lockSkill = () => 25;
    const picked = vi.fn();
    containerSystem.onLockPicked = picked;

    containerSystem.lockRng = () => 0.99; // a miss
    const box = strongbox();
    expect(containerSystem.tryOpen(box)).toBe(false);
    expect(mockInventory.removeQuantity).toHaveBeenCalledWith("lockpick", 1);
    expect(mockUI.showNotification).toHaveBeenLastCalledWith("The lockpick snaps. (1 left)", 2200);

    containerSystem.lockRng = () => 0.0; // a success
    expect(containerSystem.tryOpen(box)).toBe(true);
    expect(box.isLocked).toBe(false);
    expect(picked).toHaveBeenCalledWith(box);
    expect(containerSystem.lockpicks(), "a success keeps the pick").toBe(1);

    mockInventory.items = [];
    expect(containerSystem.tryOpen(strongbox())).toBe(false);
    expect(mockUI.showNotification.mock.calls.at(-1)[0]).toMatch(/You need a lockpick/);
  });

  it("a lock within your skill opens without a pick; the odds fall as locks get harder", () => {
    containerSystem.lockSkill = () => 50;
    const easy = containerSystem.spawnContainer({ id: "e1", name: "Box", position: new Vector3(), contents: [], isLocked: true, lockDifficulty: 40 });
    expect(containerSystem.tryOpen(easy)).toBe(true);
    expect(pickChance(25, 35)).toBeCloseTo(0.35);
    expect(pickChance(0, 100)).toBe(0.1);
    expect(pickChance(100, 0)).toBe(0.95);
  });

  it("a save loaded before a chest's model has loaded is applied when the chest registers (not a site's)", () => {
    containerSystem.restoreFromSave({ containers: [
      { id: "chest_01", contents: [], isLocked: false },
      { id: "chest_site_bandit-camp_1_1", contents: [], isLocked: false },
    ] });
    const old = containerSystem.registerChest("chest_01", "Old Chest", { metadata: null, getChildMeshes: () => [] } as any, [sampleItem], 0);
    expect(old.contents, "the save says it was emptied").toEqual([]);
    const camp = containerSystem.registerChest("chest_site_bandit-camp_1_1", "Strongbox", { metadata: null, getChildMeshes: () => [] } as any, [sampleItem], 35);
    expect(camp.contents, "a site's chest follows the landmarks, not the save").toHaveLength(1);
  });

  it("a chest in the world: registered on its model, forgotten when its chunk goes", () => {
    const mesh: any = { metadata: null, getChildMeshes: () => [] };
    const c = containerSystem.registerChest("chest_site_x", "Bandits' Strongbox", mesh, [sampleItem], 35);
    expect(c.isLocked).toBe(true);
    expect(mesh.metadata).toEqual({ type: "container", container: c });
    containerSystem.unregister("chest_site_x");
    expect(containerSystem.getSaveState().containers.some((x) => x.id === "chest_site_x")).toBe(false);
  });

  it("a master key (the Warden's Key) opens one lock of any difficulty", () => {
    const make = (id: string) => containerSystem.spawnContainer({ id, name: "C", position: new Vector3(), contents: [], isLocked: true, lockDifficulty: 100 });
    containerSystem.masterKeys = 1;
    expect(containerSystem.tryOpen(make("k1"), 0)).toBe(true);
    expect(containerSystem.masterKeys).toBe(0);
    expect(containerSystem.tryOpen(make("k2"), 0), "the key is spent").toBe(false);
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
