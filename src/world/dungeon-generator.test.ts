import { describe, it, expect, vi } from "vitest";
import { DungeonGenerator } from "./dungeon-generator";

vi.mock("@babylonjs/core/Meshes/meshBuilder", () => ({
  MeshBuilder: {
    CreateGround: vi.fn((name, _options) => ({
      name,
      position: { x: 0, y: 0, z: 0 },
      material: null,
      checkCollisions: false,
      dispose: vi.fn(),
      isDisposed: vi.fn(() => false),
    })),
    CreateBox: vi.fn((name, _options) => ({
      name,
      position: { x: 0, y: 0, z: 0 },
      material: null,
      checkCollisions: false,
      dispose: vi.fn(),
      isDisposed: vi.fn(() => false),
    })),
  },
}));

vi.mock("@babylonjs/core/Materials/standardMaterial", () => ({
  StandardMaterial: vi.fn(function (name) {
    return {
      name,
      diffuseColor: {},
      specularColor: {},
    };
  }),
}));

describe("DungeonGenerator", () => {
  it("initializes with default and custom configurations", () => {
    const d = new DungeonGenerator({ seed: "BarrowOfUther", dangerLevel: 4 });
    expect(d.seed).toBeTypeOf("number");
    expect(d.name).toContain("of");
    expect(d.rooms.length).toBeGreaterThanOrEqual(2);
    expect(d.corridors.length).toBe(d.rooms.length - 1);
    expect(d.rooms[0].type).toBe("entry");
  });

  it("is fully deterministic for the same seed", () => {
    const dA = new DungeonGenerator({ seed: 424242 });
    const dB = new DungeonGenerator({ seed: 424242 });

    expect(dA.name).toBe(dB.name);
    expect(dA.rooms.length).toBe(dB.rooms.length);
    expect(dA.rooms[0].centerX).toBe(dB.rooms[0].centerX);
    expect(dA.corridors.length).toBe(dB.corridors.length);
  });

  it("ensures all rooms are connected in a continuous corridor graph", () => {
    const d = new DungeonGenerator({ seed: 99999, maxRooms: 5 });
    for (let i = 0; i < d.rooms.length - 1; i++) {
      const corr = d.corridors[i];
      expect(corr.fromRoomId).toBe(d.rooms[i].id);
      expect(corr.toRoomId).toBe(d.rooms[i + 1].id);
      expect(corr.tiles.length).toBeGreaterThan(0);
    }
  });

  it("assigns appropriate room types, props, and enemies", () => {
    const d = new DungeonGenerator({ seed: "AncientCrypt", dangerLevel: 5 });

    const entry = d.rooms.find((r) => r.type === "entry");
    expect(entry).toBeDefined();

    const bossRoom = d.rooms.find((r) => r.type === "boss_chamber" || r.type === "tomb");
    expect(bossRoom).toBeDefined();
    expect(bossRoom?.enemies.some((e) => e.isBoss)).toBe(true);

    // Props should exist across rooms
    const totalProps = d.rooms.reduce((acc, r) => acc + r.props.length, 0);
    expect(totalProps).toBeGreaterThan(0);
  });

  it("produces valid CellDefinition for CellManager", () => {
    const d = new DungeonGenerator({ seed: 101 });
    const cellDef = d.toCellDefinition();

    expect(cellDef.id).toBe(d.id);
    expect(cellDef.name).toBe(d.name);
    expect(cellDef.type).toBe("interior");
    expect(cellDef.spawnPosition).toBeDefined();
    expect(cellDef.build).toBeTypeOf("function");
  });

  it("builds 3D Babylon meshes (floors and walls)", () => {
    const d = new DungeonGenerator({ seed: 202 });
    const mockScene = {} as any;
    const meshes = d.buildMeshes(mockScene, 3);

    expect(meshes.length).toBeGreaterThan(0);
    // At least room floors + corridor tiles + 4 walls per room
    const expectedMinMeshes = d.rooms.length + d.rooms.length * 4;
    expect(meshes.length).toBeGreaterThanOrEqual(expectedMinMeshes);
  });
});
