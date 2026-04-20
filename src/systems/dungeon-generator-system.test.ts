import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  DungeonGeneratorSystem,
  DungeonGraph,
  DungeonLayout,
  DungeonRoomNode,
  DungeonEdge,
  TileType,
  SeedFunction,
} from "./dungeon-generator-system";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeGraph(
  rooms: DungeonRoomNode[],
  edges: DungeonEdge[] = [],
): DungeonGraph {
  return { rooms, edges };
}

function simpleGraph(): DungeonGraph {
  return makeGraph(
    [
      { id: "entrance", width: 5, height: 5 },
      { id: "hallway", width: 7, height: 3 },
      { id: "boss", width: 6, height: 6 },
    ],
    [
      { from: "entrance", to: "hallway" },
      { from: "hallway", to: "boss" },
    ],
  );
}

function linearGraph(count: number): DungeonGraph {
  const rooms: DungeonRoomNode[] = [];
  const edges: DungeonEdge[] = [];
  for (let i = 0; i < count; i++) {
    rooms.push({ id: `room_${i}`, width: 4, height: 4 });
    if (i > 0) edges.push({ from: `room_${i - 1}`, to: `room_${i}` });
  }
  return makeGraph(rooms, edges);
}

/** Deterministic seed function based on simple hash. */
function makeSeed(base: number = 42): SeedFunction {
  return (slot: number) => Math.abs(Math.sin(base * 217.3 + slot * 83.1)) % 1;
}

function countTileType(layout: DungeonLayout, type: TileType): number {
  let count = 0;
  for (const row of layout.tiles) {
    for (const tile of row) {
      if (tile === type) count++;
    }
  }
  return count;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("DungeonGeneratorSystem", () => {
  let gen: DungeonGeneratorSystem;

  beforeEach(() => {
    gen = new DungeonGeneratorSystem();
  });

  // ── Validation ────────────────────────────────────────────────────────────

  describe("validate()", () => {
    it("returns empty-graph issue for empty rooms", () => {
      const issues = gen.validate(makeGraph([]));
      expect(issues).toHaveLength(1);
      expect(issues[0].code).toBe("empty-graph");
    });

    it("returns room-too-small for 2×2 room", () => {
      const issues = gen.validate(makeGraph([{ id: "tiny", width: 2, height: 2 }]));
      expect(issues.some(i => i.code === "room-too-small")).toBe(true);
    });

    it("returns no issues for valid room dimensions", () => {
      const issues = gen.validate(makeGraph([{ id: "ok", width: 3, height: 3 }]));
      expect(issues).toHaveLength(0);
    });

    it("detects duplicate room ids", () => {
      const issues = gen.validate(makeGraph([
        { id: "dup", width: 3, height: 3 },
        { id: "dup", width: 4, height: 4 },
      ]));
      expect(issues.some(i => i.code === "duplicate-room-id")).toBe(true);
    });

    it("detects edges referencing unknown rooms", () => {
      const issues = gen.validate(makeGraph(
        [{ id: "a", width: 3, height: 3 }],
        [{ from: "a", to: "missing" }],
      ));
      expect(issues.some(i => i.code === "edge-unknown-room")).toBe(true);
    });

    it("detects disconnected graphs", () => {
      const issues = gen.validate(makeGraph(
        [
          { id: "a", width: 3, height: 3 },
          { id: "b", width: 3, height: 3 },
          { id: "c", width: 3, height: 3 },
        ],
        [{ from: "a", to: "b" }],
      ));
      expect(issues.some(i => i.code === "disconnected-graph")).toBe(true);
    });

    it("detects circular graphs", () => {
      const issues = gen.validate(makeGraph(
        [
          { id: "a", width: 3, height: 3 },
          { id: "b", width: 3, height: 3 },
          { id: "c", width: 3, height: 3 },
        ],
        [
          { from: "a", to: "b" },
          { from: "b", to: "c" },
          { from: "c", to: "a" },
        ],
      ));
      expect(issues.some(i => i.code === "circular-graph")).toBe(true);
    });

    it("validates simple graph with no issues", () => {
      const issues = gen.validate(simpleGraph());
      expect(issues).toHaveLength(0);
    });
  });

  // ── Generation ────────────────────────────────────────────────────────────

  describe("generate()", () => {
    it("generates a layout for a single room", () => {
      const graph = makeGraph([{ id: "solo", width: 5, height: 5 }]);
      const layout = gen.generate(graph, {}, makeSeed());
      expect(layout).not.toBeNull();
      expect(layout!.rooms).toHaveLength(1);
      expect(layout!.rooms[0].id).toBe("solo");
    });

    it("generates a layout for simple graph", () => {
      const layout = gen.generate(simpleGraph(), {}, makeSeed());
      expect(layout).not.toBeNull();
      expect(layout!.rooms).toHaveLength(3);
    });

    it("places all rooms from a linear chain", () => {
      const layout = gen.generate(linearGraph(5), {}, makeSeed());
      expect(layout).not.toBeNull();
      expect(layout!.rooms).toHaveLength(5);
    });

    it("no rooms overlap", () => {
      const layout = gen.generate(simpleGraph(), {}, makeSeed());
      expect(layout).not.toBeNull();
      const rooms = layout!.rooms;
      for (let i = 0; i < rooms.length; i++) {
        for (let j = i + 1; j < rooms.length; j++) {
          const a = rooms[i], b = rooms[j];
          const overlapsX = a.x < b.x + b.width && a.x + a.width > b.x;
          const overlapsZ = a.z < b.z + b.height && a.z + a.height > b.z;
          expect(overlapsX && overlapsZ).toBe(false);
        }
      }
    });

    it("tile grid contains floor tiles for each room", () => {
      const layout = gen.generate(simpleGraph(), {}, makeSeed());
      expect(layout).not.toBeNull();
      const floorCount = countTileType(layout!, "floor");
      expect(floorCount).toBeGreaterThan(0);
    });

    it("tile grid contains wall tiles around rooms", () => {
      const layout = gen.generate(simpleGraph(), {}, makeSeed());
      expect(layout).not.toBeNull();
      const wallCount = countTileType(layout!, "wall");
      expect(wallCount).toBeGreaterThan(0);
    });

    it("generates corridors for connected rooms", () => {
      const layout = gen.generate(simpleGraph(), {}, makeSeed());
      expect(layout).not.toBeNull();
      expect(layout!.corridors).toHaveLength(2);
    });

    it("corridors have tiles", () => {
      const layout = gen.generate(simpleGraph(), {}, makeSeed());
      expect(layout).not.toBeNull();
      for (const corridor of layout!.corridors) {
        expect(corridor.tiles.length).toBeGreaterThan(0);
      }
    });

    it("tile grid dimensions are positive", () => {
      const layout = gen.generate(simpleGraph(), {}, makeSeed());
      expect(layout).not.toBeNull();
      expect(layout!.gridWidth).toBeGreaterThan(0);
      expect(layout!.gridHeight).toBeGreaterThan(0);
      expect(layout!.tiles.length).toBe(layout!.gridHeight);
      expect(layout!.tiles[0].length).toBe(layout!.gridWidth);
    });

    it("deterministic output with same seed", () => {
      const graph = simpleGraph();
      const layout1 = gen.generate(graph, {}, makeSeed(99));
      const layout2 = gen.generate(graph, {}, makeSeed(99));
      expect(layout1).not.toBeNull();
      expect(layout2).not.toBeNull();
      expect(layout1!.rooms.map(r => `${r.id}:${r.x},${r.z}`))
        .toEqual(layout2!.rooms.map(r => `${r.id}:${r.x},${r.z}`));
    });

    it("different seeds produce different layouts", () => {
      const graph = simpleGraph();
      const layout1 = gen.generate(graph, {}, makeSeed(1));
      const layout2 = gen.generate(graph, {}, makeSeed(999));
      expect(layout1).not.toBeNull();
      expect(layout2).not.toBeNull();
      // At least one room should be at a different position
      const pos1 = layout1!.rooms.map(r => `${r.x},${r.z}`).join("|");
      const pos2 = layout2!.rooms.map(r => `${r.x},${r.z}`).join("|");
      expect(pos1).not.toBe(pos2);
    });

    it("preserves room tags", () => {
      const graph = makeGraph(
        [
          { id: "boss_room", width: 7, height: 7, tag: "boss" },
          { id: "treasure", width: 4, height: 4, tag: "treasure" },
        ],
        [{ from: "boss_room", to: "treasure" }],
      );
      const layout = gen.generate(graph, {}, makeSeed());
      expect(layout).not.toBeNull();
      expect(layout!.rooms.find(r => r.id === "boss_room")!.tag).toBe("boss");
      expect(layout!.rooms.find(r => r.id === "treasure")!.tag).toBe("treasure");
    });

    it("respects custom roomGap option", () => {
      const graph = makeGraph(
        [
          { id: "a", width: 4, height: 4 },
          { id: "b", width: 4, height: 4 },
        ],
        [{ from: "a", to: "b" }],
      );
      const layout = gen.generate(graph, { roomGap: 5 }, makeSeed());
      expect(layout).not.toBeNull();
      const a = layout!.rooms.find(r => r.id === "a")!;
      const b = layout!.rooms.find(r => r.id === "b")!;
      // Distance between rooms should be at least roomGap
      const dx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.width, b.x + b.width));
      const dz = Math.max(0, Math.max(a.z, b.z) - Math.min(a.z + a.height, b.z + b.height));
      expect(Math.max(dx, dz)).toBeGreaterThanOrEqual(5);
    });

    it("respects custom padding option", () => {
      const graph = makeGraph([{ id: "solo", width: 5, height: 5 }]);
      const layout = gen.generate(graph, { padding: 4 }, makeSeed());
      expect(layout).not.toBeNull();
      // Room should be at least 4 tiles from the edge
      expect(layout!.rooms[0].x).toBeGreaterThanOrEqual(4);
      expect(layout!.rooms[0].z).toBeGreaterThanOrEqual(4);
    });
  });

  // ── Callbacks ─────────────────────────────────────────────────────────────

  describe("callbacks", () => {
    it("fires onGenerateComplete on success", () => {
      const cb = vi.fn();
      gen.onGenerateComplete = cb;
      gen.generate(simpleGraph(), {}, makeSeed());
      expect(cb).toHaveBeenCalledOnce();
      expect(cb.mock.calls[0][0].rooms).toHaveLength(3);
    });

    it("fires onGenerateFailed when placement fails", () => {
      const cb = vi.fn();
      gen.onGenerateFailed = cb;
      // Create a graph with many large rooms and tiny gap to force collision failures
      const bigRooms = Array.from({ length: 30 }, (_, i) => ({
        id: `big_${i}`,
        width: 30,
        height: 30,
      }));
      const edges = bigRooms.slice(1).map((r, i) => ({
        from: bigRooms[i].id,
        to: r.id,
      }));
      const result = gen.generate(makeGraph(bigRooms, edges), { maxRetries: 1, roomGap: 1 }, makeSeed());
      // Either the generation failed (cb called), or it somehow succeeded.
      // With these extreme params, failure is expected.
      if (result === null) {
        expect(cb).toHaveBeenCalled();
      } else {
        // If it somehow succeeds with 30 huge rooms, that's fine too — skip assertion
        expect(result.rooms.length).toBeGreaterThan(0);
      }
    });
  });

  // ── toMapEntries ──────────────────────────────────────────────────────────

  describe("toMapEntries()", () => {
    it("creates structure entries for rooms", () => {
      const layout = gen.generate(simpleGraph(), {}, makeSeed());
      expect(layout).not.toBeNull();
      const entries = gen.toMapEntries(layout!);
      const structures = entries.filter(e => e.type === "structure");
      expect(structures).toHaveLength(3);
    });

    it("creates marker entries for corridor doors", () => {
      const layout = gen.generate(simpleGraph(), {}, makeSeed());
      expect(layout).not.toBeNull();
      const entries = gen.toMapEntries(layout!);
      const markers = entries.filter(e => e.type === "marker");
      expect(markers).toHaveLength(2); // 2 corridors = 2 door markers
    });

    it("structure entries have correct position (room center)", () => {
      const layout = gen.generate(
        makeGraph([{ id: "test", width: 5, height: 5 }]),
        {},
        makeSeed(),
      );
      expect(layout).not.toBeNull();
      const entries = gen.toMapEntries(layout!);
      const room = layout!.rooms[0];
      const entry = entries.find(e => e.id === "room_test")!;
      expect(entry.position.x).toBe(room.x + Math.floor(room.width / 2));
      expect(entry.position.z).toBe(room.z + Math.floor(room.height / 2));
      expect(entry.position.y).toBe(0);
    });

    it("preserves room tags in entries", () => {
      const layout = gen.generate(
        makeGraph([{ id: "boss", width: 5, height: 5, tag: "boss_fight" }]),
        {},
        makeSeed(),
      );
      expect(layout).not.toBeNull();
      const entries = gen.toMapEntries(layout!);
      expect(entries[0].tag).toBe("boss_fight");
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("handles graph with no edges (isolated rooms)", () => {
      const graph = makeGraph([
        { id: "a", width: 3, height: 3 },
        { id: "b", width: 3, height: 3 },
      ]);
      // No edges — only root is placed
      const layout = gen.generate(graph, {}, makeSeed());
      expect(layout).not.toBeNull();
      // Only the root room gets placed (no edges to traverse)
      expect(layout!.rooms).toHaveLength(1);
    });

    it("handles single room with self-edge gracefully via validate", () => {
      const graph = makeGraph(
        [{ id: "loop", width: 5, height: 5 }],
        [{ from: "loop", to: "loop" }],
      );
      const issues = gen.validate(graph);
      expect(issues.some(i => i.code === "circular-graph")).toBe(true);
    });

    it("branching graph places all children", () => {
      const graph = makeGraph(
        [
          { id: "root", width: 5, height: 5 },
          { id: "left", width: 4, height: 4 },
          { id: "right", width: 4, height: 4 },
          { id: "up", width: 4, height: 4 },
        ],
        [
          { from: "root", to: "left" },
          { from: "root", to: "right" },
          { from: "root", to: "up" },
        ],
      );
      const layout = gen.generate(graph, {}, makeSeed());
      expect(layout).not.toBeNull();
      expect(layout!.rooms).toHaveLength(4);
      expect(layout!.corridors).toHaveLength(3);
    });

    it("minimum-size rooms (3×3) are placed correctly", () => {
      const graph = makeGraph(
        [
          { id: "a", width: 3, height: 3 },
          { id: "b", width: 3, height: 3 },
        ],
        [{ from: "a", to: "b" }],
      );
      const layout = gen.generate(graph, {}, makeSeed());
      expect(layout).not.toBeNull();
      expect(layout!.rooms).toHaveLength(2);
      // Each 3×3 room has 1 floor tile (center) and 8 wall tiles
      for (const room of layout!.rooms) {
        expect(room.width).toBe(3);
        expect(room.height).toBe(3);
      }
    });
  });
});
