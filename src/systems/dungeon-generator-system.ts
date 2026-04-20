/**
 * DungeonGeneratorSystem — Graph-based procedural dungeon generator.
 *
 * Accepts a directed graph of room nodes (each with dimensions and connection
 * requirements) and produces a spatial tilemap layout compatible with
 * {@link MapExportData}.  Inspired by graph-dungeon-generator
 * (https://github.com/halftheopposite/graph-dungeon-generator).
 *
 * Algorithm overview:
 *   1. Start at the root node; place it at the origin of the tile grid.
 *   2. For each child node, attempt placement in a random cardinal direction
 *      with a corridor connecting to the parent.
 *   3. If a placement collides with already-placed rooms, backtrack and try
 *      the remaining directions.
 *   4. After all nodes are placed, generate corridors between connected rooms.
 *   5. Output the result as a 2D tile grid + entry list.
 *
 * Integration:
 *   - Output is a {@link DungeonLayout} containing a tile grid and a list of
 *     {@link MapExportEntry}-compatible entries for doors/spawns.
 *   - Connect to {@link WorldSeed} for seeded randomisation.
 *   - Dungeons can be imported into {@link MapEditorSystem} or packaged via
 *     {@link MapPackSystem}.
 *
 * @example
 * ```ts
 * const gen = new DungeonGeneratorSystem();
 * const graph: DungeonGraph = {
 *   rooms: [
 *     { id: "entrance", width: 5, height: 5 },
 *     { id: "hallway",  width: 8, height: 3 },
 *     { id: "boss",     width: 7, height: 7 },
 *   ],
 *   edges: [
 *     { from: "entrance", to: "hallway" },
 *     { from: "hallway",  to: "boss"    },
 *   ],
 * };
 * const layout = gen.generate(graph);
 * // layout.tiles is a 2D array, layout.rooms has placed positions
 * ```
 */

// ── Types ──────────────────────────────────────────────────────────────────────

/** Cardinal direction for room placement and corridor generation. */
export type Direction = "north" | "south" | "east" | "west";

/** A single tile in the dungeon grid. */
export type TileType = "empty" | "floor" | "wall" | "door" | "corridor";

/** Room template in the input graph. */
export interface DungeonRoomNode {
  /** Unique identifier for this room. */
  id: string;
  /** Width of the room in tiles (x-axis). Must be ≥ 3. */
  width: number;
  /** Height of the room in tiles (z-axis). Must be ≥ 3. */
  height: number;
  /** Optional room type tag for downstream use (e.g. "boss", "treasure"). */
  tag?: string;
}

/** Directed edge connecting two rooms in the graph. */
export interface DungeonEdge {
  /** Source room id. */
  from: string;
  /** Target room id. */
  to: string;
}

/** Complete graph description of a dungeon to generate. */
export interface DungeonGraph {
  rooms: DungeonRoomNode[];
  edges: DungeonEdge[];
}

/** A placed room in the final layout. */
export interface PlacedRoom {
  /** Room node id. */
  id: string;
  /** Top-left x position in the tile grid. */
  x: number;
  /** Top-left z position in the tile grid. */
  z: number;
  /** Width in tiles. */
  width: number;
  /** Height in tiles. */
  height: number;
  /** Room tag, if any. */
  tag?: string;
}

/** A corridor connection in the final layout. */
export interface PlacedCorridor {
  /** Room id of the source. */
  fromRoomId: string;
  /** Room id of the target. */
  toRoomId: string;
  /** Tiles that form this corridor (list of grid coordinates). */
  tiles: Array<{ x: number; z: number }>;
}

/** The complete generated dungeon layout. */
export interface DungeonLayout {
  /** Width of the tile grid. */
  gridWidth: number;
  /** Height of the tile grid. */
  gridHeight: number;
  /** 2D tile grid, row-major: tiles[z][x]. */
  tiles: TileType[][];
  /** All placed rooms with their grid positions. */
  rooms: PlacedRoom[];
  /** All corridors connecting rooms. */
  corridors: PlacedCorridor[];
}

/** Options for the generation algorithm. */
export interface DungeonGeneratorOptions {
  /** Minimum gap between rooms in tiles. Default: 3 (room for corridor). */
  roomGap: number;
  /** Maximum backtracking attempts per node. Default: 20. */
  maxRetries: number;
  /** Corridor width in tiles. Default: 1. */
  corridorWidth: number;
  /** Grid padding around the entire dungeon. Default: 2. */
  padding: number;
}

/** Seed function type: returns a deterministic float in [0, 1). */
export type SeedFunction = (slot: number) => number;

// ── Constants ──────────────────────────────────────────────────────────────────

const ALL_DIRECTIONS: readonly Direction[] = ["north", "south", "east", "west"];

const DEFAULT_OPTIONS: DungeonGeneratorOptions = {
  roomGap: 3,
  maxRetries: 20,
  corridorWidth: 1,
  padding: 2,
};

// ── Validation ──────────────────────────────────────────────────────────────────

export interface DungeonValidationIssue {
  code:
    | "empty-graph"
    | "room-too-small"
    | "duplicate-room-id"
    | "edge-unknown-room"
    | "disconnected-graph"
    | "circular-graph";
  message: string;
}

// ── System ─────────────────────────────────────────────────────────────────────

export class DungeonGeneratorSystem {
  // ── Callbacks ──────────────────────────────────────────────────────────────

  /** Fired when generation completes successfully. */
  public onGenerateComplete: ((layout: DungeonLayout) => void) | null = null;

  /** Fired when generation fails (e.g. cannot place all rooms). */
  public onGenerateFailed: ((reason: string) => void) | null = null;

  // ── Validation ─────────────────────────────────────────────────────────────

  /**
   * Validate a dungeon graph without generating.
   * Returns a list of issues; empty list means the graph is valid.
   */
  public validate(graph: DungeonGraph): DungeonValidationIssue[] {
    const issues: DungeonValidationIssue[] = [];

    if (graph.rooms.length === 0) {
      issues.push({ code: "empty-graph", message: "Graph has no rooms." });
      return issues;
    }

    // Check room dimensions
    const roomIds = new Set<string>();
    for (const room of graph.rooms) {
      if (room.width < 3 || room.height < 3) {
        issues.push({
          code: "room-too-small",
          message: `Room "${room.id}" is ${room.width}×${room.height}; minimum is 3×3.`,
        });
      }
      if (roomIds.has(room.id)) {
        issues.push({
          code: "duplicate-room-id",
          message: `Duplicate room id "${room.id}".`,
        });
      }
      roomIds.add(room.id);
    }

    // Check edge references
    for (const edge of graph.edges) {
      if (!roomIds.has(edge.from)) {
        issues.push({
          code: "edge-unknown-room",
          message: `Edge references unknown room "${edge.from}".`,
        });
      }
      if (!roomIds.has(edge.to)) {
        issues.push({
          code: "edge-unknown-room",
          message: `Edge references unknown room "${edge.to}".`,
        });
      }
    }

    // Check connectivity (BFS from first room)
    if (graph.rooms.length > 1 && graph.edges.length > 0) {
      const adj = new Map<string, Set<string>>();
      for (const r of graph.rooms) adj.set(r.id, new Set());
      for (const e of graph.edges) {
        adj.get(e.from)?.add(e.to);
        adj.get(e.to)?.add(e.from);
      }
      const visited = new Set<string>();
      const queue = [graph.rooms[0].id];
      visited.add(graph.rooms[0].id);
      while (queue.length > 0) {
        const curr = queue.shift()!;
        for (const neighbor of adj.get(curr) ?? []) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
      if (visited.size < graph.rooms.length) {
        issues.push({
          code: "disconnected-graph",
          message: `Graph is disconnected: ${visited.size} of ${graph.rooms.length} rooms reachable.`,
        });
      }
    }

    // Simple cycle detection (DFS on directed graph)
    if (graph.edges.length > 0) {
      const dirAdj = new Map<string, string[]>();
      for (const r of graph.rooms) dirAdj.set(r.id, []);
      for (const e of graph.edges) {
        dirAdj.get(e.from)?.push(e.to);
      }
      const WHITE = 0, GRAY = 1, BLACK = 2;
      const color = new Map<string, number>();
      for (const r of graph.rooms) color.set(r.id, WHITE);

      let hasCycle = false;
      const dfs = (u: string) => {
        color.set(u, GRAY);
        for (const v of dirAdj.get(u) ?? []) {
          if (color.get(v) === GRAY) { hasCycle = true; return; }
          if (color.get(v) === WHITE) dfs(v);
          if (hasCycle) return;
        }
        color.set(u, BLACK);
      };
      for (const r of graph.rooms) {
        if (color.get(r.id) === WHITE) dfs(r.id);
        if (hasCycle) break;
      }
      if (hasCycle) {
        issues.push({
          code: "circular-graph",
          message: "Graph contains a cycle. Only DAGs are supported.",
        });
      }
    }

    return issues;
  }

  // ── Generation ─────────────────────────────────────────────────────────────

  /**
   * Generate a dungeon layout from the given graph.
   *
   * @param graph   The dungeon graph describing rooms and connections.
   * @param options Optional generation parameters.
   * @param seedFn  Optional seeded random function; receives a slot number and
   *                returns a float in [0, 1). When omitted, `Math.random` is used.
   * @returns       The generated layout, or `null` if generation failed.
   */
  public generate(
    graph: DungeonGraph,
    options?: Partial<DungeonGeneratorOptions>,
    seedFn?: SeedFunction,
  ): DungeonLayout | null {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const rand = seedFn ?? ((_slot: number) => Math.random());

    // Build adjacency from edges
    const children = new Map<string, string[]>();
    for (const room of graph.rooms) children.set(room.id, []);
    for (const edge of graph.edges) {
      children.get(edge.from)?.push(edge.to);
    }

    // Room lookup
    const roomMap = new Map<string, DungeonRoomNode>();
    for (const room of graph.rooms) roomMap.set(room.id, room);

    // Find root nodes (no incoming edges)
    const hasIncoming = new Set<string>(graph.edges.map(e => e.to));
    const roots = graph.rooms.filter(r => !hasIncoming.has(r.id));
    const root = roots.length > 0 ? roots[0] : graph.rooms[0];

    // Placement state: room id → { x, z } (top-left corner in intermediate coords)
    const placed = new Map<string, { x: number; z: number; w: number; h: number }>();

    // Seed slot counter for deterministic randomness
    let seedSlot = 0;

    // Place root at (0, 0)
    placed.set(root.id, { x: 0, z: 0, w: root.width, h: root.height });

    // BFS placement
    const queue = [root.id];
    const visited = new Set<string>([root.id]);

    while (queue.length > 0) {
      const parentId = queue.shift()!;
      const parentRect = placed.get(parentId)!;
      const kids = children.get(parentId) ?? [];

      for (const childId of kids) {
        if (visited.has(childId)) continue;
        visited.add(childId);

        const childNode = roomMap.get(childId)!;
        let childPlaced = false;

        // Shuffle directions using seedFn
        const dirs = [...ALL_DIRECTIONS];
        for (let i = dirs.length - 1; i > 0; i--) {
          const j = Math.floor(rand(seedSlot++) * (i + 1));
          [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
        }

        for (let attempt = 0; attempt < opts.maxRetries && !childPlaced; attempt++) {
          const dir = dirs[attempt % dirs.length];
          const candidate = this._getCandidatePosition(
            parentRect, childNode.width, childNode.height, dir, opts.roomGap, rand, seedSlot++,
          );

          // Check collision with all placed rooms
          if (!this._collides(candidate, childNode.width, childNode.height, placed, opts.roomGap)) {
            placed.set(childId, { x: candidate.x, z: candidate.z, w: childNode.width, h: childNode.height });
            childPlaced = true;
          }
        }

        if (!childPlaced) {
          const reason = `Failed to place room "${childId}" after ${opts.maxRetries} attempts.`;
          this.onGenerateFailed?.(reason);
          return null;
        }

        queue.push(childId);
      }
    }

    // Normalise coordinates so all are non-negative + padding
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (const rect of placed.values()) {
      minX = Math.min(minX, rect.x);
      minZ = Math.min(minZ, rect.z);
      maxX = Math.max(maxX, rect.x + rect.w);
      maxZ = Math.max(maxZ, rect.z + rect.h);
    }

    const offsetX = -minX + opts.padding;
    const offsetZ = -minZ + opts.padding;
    const gridWidth  = (maxX - minX) + opts.padding * 2;
    const gridHeight = (maxZ - minZ) + opts.padding * 2;

    // Build tile grid
    const tiles: TileType[][] = [];
    for (let z = 0; z < gridHeight; z++) {
      tiles[z] = [];
      for (let x = 0; x < gridWidth; x++) {
        tiles[z][x] = "empty";
      }
    }

    // Place rooms onto tile grid
    const placedRooms: PlacedRoom[] = [];
    for (const [id, rect] of placed) {
      const node = roomMap.get(id)!;
      const gx = rect.x + offsetX;
      const gz = rect.z + offsetZ;

      placedRooms.push({
        id,
        x: gx,
        z: gz,
        width: rect.w,
        height: rect.h,
        tag: node.tag,
      });

      // Fill room tiles: walls on border, floor inside
      for (let dz = 0; dz < rect.h; dz++) {
        for (let dx = 0; dx < rect.w; dx++) {
          const tx = gx + dx;
          const tz = gz + dz;
          if (tz >= 0 && tz < gridHeight && tx >= 0 && tx < gridWidth) {
            const isBorder = dx === 0 || dx === rect.w - 1 || dz === 0 || dz === rect.h - 1;
            tiles[tz][tx] = isBorder ? "wall" : "floor";
          }
        }
      }
    }

    // Generate corridors
    const corridors: PlacedCorridor[] = [];
    for (const edge of graph.edges) {
      const fromRect = placed.get(edge.from);
      const toRect = placed.get(edge.to);
      if (!fromRect || !toRect) continue;

      const fromCenterX = fromRect.x + offsetX + Math.floor(fromRect.w / 2);
      const fromCenterZ = fromRect.z + offsetZ + Math.floor(fromRect.h / 2);
      const toCenterX = toRect.x + offsetX + Math.floor(toRect.w / 2);
      const toCenterZ = toRect.z + offsetZ + Math.floor(toRect.h / 2);

      const corridorTiles = this._generateCorridor(
        fromCenterX, fromCenterZ, toCenterX, toCenterZ,
        tiles, gridWidth, gridHeight,
      );

      corridors.push({
        fromRoomId: edge.from,
        toRoomId: edge.to,
        tiles: corridorTiles,
      });
    }

    const layout: DungeonLayout = {
      gridWidth,
      gridHeight,
      tiles,
      rooms: placedRooms,
      corridors,
    };

    this.onGenerateComplete?.(layout);
    return layout;
  }

  /**
   * Convert a dungeon layout to a simplified map-export-compatible entry list.
   * Each room becomes a "structure" entry; each door becomes a "marker" entry.
   */
  public toMapEntries(layout: DungeonLayout): Array<{
    id: string;
    type: "marker" | "structure";
    position: { x: number; y: number; z: number };
    tag?: string;
  }> {
    const entries: Array<{
      id: string;
      type: "marker" | "structure";
      position: { x: number; y: number; z: number };
      tag?: string;
    }> = [];

    for (const room of layout.rooms) {
      entries.push({
        id: `room_${room.id}`,
        type: "structure",
        position: {
          x: room.x + Math.floor(room.width / 2),
          y: 0,
          z: room.z + Math.floor(room.height / 2),
        },
        tag: room.tag,
      });
    }

    // Add door markers at corridor-room junctions
    for (const corridor of layout.corridors) {
      if (corridor.tiles.length > 0) {
        entries.push({
          id: `door_${corridor.fromRoomId}_${corridor.toRoomId}`,
          type: "marker",
          position: {
            x: corridor.tiles[0].x,
            y: 0,
            z: corridor.tiles[0].z,
          },
        });
      }
    }

    return entries;
  }

  // ── Private ───────────────────────────────────────────────────────────────

  /** Compute a candidate position for a child room relative to a parent. */
  private _getCandidatePosition(
    parent: { x: number; z: number; w: number; h: number },
    childW: number,
    childH: number,
    dir: Direction,
    gap: number,
    rand: SeedFunction,
    slot: number,
  ): { x: number; z: number } {
    // Random offset along the perpendicular axis for variety
    const jitter = Math.floor(rand(slot) * 3) - 1;

    switch (dir) {
      case "north":
        return { x: parent.x + jitter, z: parent.z - childH - gap };
      case "south":
        return { x: parent.x + jitter, z: parent.z + parent.h + gap };
      case "east":
        return { x: parent.x + parent.w + gap, z: parent.z + jitter };
      case "west":
        return { x: parent.x - childW - gap, z: parent.z + jitter };
    }
  }

  /** Check if a candidate room rectangle collides with any placed room. */
  private _collides(
    candidate: { x: number; z: number },
    w: number,
    h: number,
    placed: Map<string, { x: number; z: number; w: number; h: number }>,
    gap: number,
  ): boolean {
    for (const rect of placed.values()) {
      // AABB overlap test with gap margin
      if (
        candidate.x < rect.x + rect.w + gap &&
        candidate.x + w + gap > rect.x &&
        candidate.z < rect.z + rect.h + gap &&
        candidate.z + h + gap > rect.z
      ) {
        return true;
      }
    }
    return false;
  }

  /** Generate an L-shaped corridor between two points. */
  private _generateCorridor(
    x1: number, z1: number,
    x2: number, z2: number,
    tiles: TileType[][],
    gridWidth: number, gridHeight: number,
  ): Array<{ x: number; z: number }> {
    const corridorTiles: Array<{ x: number; z: number }> = [];

    // Horizontal segment first, then vertical
    const stepX = x2 > x1 ? 1 : -1;
    for (let x = x1; x !== x2; x += stepX) {
      if (x >= 0 && x < gridWidth && z1 >= 0 && z1 < gridHeight) {
        if (tiles[z1][x] === "empty") {
          tiles[z1][x] = "corridor";
          corridorTiles.push({ x, z: z1 });
        } else if (tiles[z1][x] === "wall") {
          tiles[z1][x] = "door";
          corridorTiles.push({ x, z: z1 });
        }
      }
    }

    // Vertical segment
    const stepZ = z2 > z1 ? 1 : -1;
    for (let z = z1; z !== z2 + stepZ; z += stepZ) {
      if (x2 >= 0 && x2 < gridWidth && z >= 0 && z < gridHeight) {
        if (tiles[z][x2] === "empty") {
          tiles[z][x2] = "corridor";
          corridorTiles.push({ x: x2, z });
        } else if (tiles[z][x2] === "wall") {
          tiles[z][x2] = "door";
          corridorTiles.push({ x: x2, z });
        }
      }
    }

    return corridorTiles;
  }
}
