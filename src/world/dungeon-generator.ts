import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Scene } from "@babylonjs/core/scene";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { createMulberry32 } from "./simplex-terrain";
import { WorldSeed } from "./world-seed";
import { ArthurianNameGenerator } from "./arthurian-names";
import type { CellDefinition } from "./cell-manager";

export type DungeonRoomType = "entry" | "hall" | "crypt" | "tomb" | "treasury" | "boss_chamber";

export interface DungeonProp {
  id: string;
  type: string;
  x: number;
  z: number;
  rotationY?: number;
}

export interface DungeonEnemy {
  type: string;
  x: number;
  z: number;
  isBoss?: boolean;
}

export interface DungeonRoom {
  id: string;
  type: DungeonRoomType;
  x: number;
  z: number;
  width: number;
  height: number;
  centerX: number;
  centerZ: number;
  props: DungeonProp[];
  enemies: DungeonEnemy[];
}

export interface DungeonCorridor {
  fromRoomId: string;
  toRoomId: string;
  tiles: Array<{ x: number; z: number }>;
}

export interface DungeonConfig {
  seed: string | number;
  gridWidth?: number;
  gridHeight?: number;
  minRoomSize?: number;
  maxRooms?: number;
  dangerLevel?: number;
  theme?: "barrow" | "crypt" | "catacomb" | "cavern";
}

interface BspNode {
  x: number;
  z: number;
  width: number;
  height: number;
  left?: BspNode;
  right?: BspNode;
  room?: DungeonRoom;
}

/**
 * DungeonGenerator — Procedural BSP-partitioned dungeon and ancient barrow builder.
 *
 * Generates interconnected chambers, burial crypts, corridors, props, and enemy encounters
 * with complete wiring for Babylon.js 3D mesh construction in CellManager.
 */
export class DungeonGenerator {
  public readonly seed: number;
  public readonly gridWidth: number;
  public readonly gridHeight: number;
  public readonly minRoomSize: number;
  public readonly maxRooms: number;
  public readonly dangerLevel: number;
  public readonly theme: "barrow" | "crypt" | "catacomb" | "cavern";

  public rooms: DungeonRoom[] = [];
  public corridors: DungeonCorridor[] = [];
  public name: string;
  public id: string;

  private readonly _rng: () => number;

  constructor(config: DungeonConfig) {
    this.seed = typeof config.seed === "number" ? config.seed : WorldSeed.hashString(config.seed);
    this.gridWidth = config.gridWidth ?? 32;
    this.gridHeight = config.gridHeight ?? 32;
    this.minRoomSize = config.minRoomSize ?? 4;
    this.maxRooms = config.maxRooms ?? 6;
    this.dangerLevel = Math.max(1, Math.min(10, config.dangerLevel ?? 2));
    this.theme = config.theme ?? "barrow";

    this._rng = createMulberry32(this.seed);
    this.name = ArthurianNameGenerator.generateDungeonName(this.seed);
    this.id = `dungeon_${this.seed.toString(36).replace(/^-/, "")}`;

    this._generateLayout();
  }

  /**
   * Generates the room and corridor layout using recursive BSP.
   */
  private _generateLayout(): void {
    this.rooms = [];
    this.corridors = [];

    const root: BspNode = {
      x: 1,
      z: 1,
      width: this.gridWidth - 2,
      height: this.gridHeight - 2,
    };

    // Split BSP tree
    this._splitBsp(root, 0, 4);

    // Carve rooms in leaves
    const leaves: BspNode[] = [];
    this._collectLeaves(root, leaves);

    // Limit to maxRooms
    const selectedLeaves = leaves.slice(0, this.maxRooms);

    let roomIdCounter = 1;
    for (const leaf of selectedLeaves) {
      const roomW = Math.max(
        this.minRoomSize,
        Math.floor(this.minRoomSize + this._rng() * (leaf.width - this.minRoomSize - 1)),
      );
      const roomH = Math.max(
        this.minRoomSize,
        Math.floor(this.minRoomSize + this._rng() * (leaf.height - this.minRoomSize - 1)),
      );
      const roomX = leaf.x + Math.floor(this._rng() * (leaf.width - roomW));
      const roomZ = leaf.z + Math.floor(this._rng() * (leaf.height - roomH));

      const room: DungeonRoom = {
        id: `room_${roomIdCounter++}`,
        type: "crypt",
        x: roomX,
        z: roomZ,
        width: roomW,
        height: roomH,
        centerX: roomX + Math.floor(roomW / 2),
        centerZ: roomZ + Math.floor(roomH / 2),
        props: [],
        enemies: [],
      };

      leaf.room = room;
      this.rooms.push(room);
    }

    if (this.rooms.length === 0) return;

    // First room is entry
    this.rooms[0].type = "entry";

    // Find furthest room from entry for boss_chamber / tomb
    let maxDist = -1;
    let furthestIdx = -1;
    for (let i = 1; i < this.rooms.length; i++) {
      const dx = this.rooms[i].centerX - this.rooms[0].centerX;
      const dz = this.rooms[i].centerZ - this.rooms[0].centerZ;
      const dist = dx * dx + dz * dz;
      if (dist > maxDist) {
        maxDist = dist;
        furthestIdx = i;
      }
    }

    if (furthestIdx !== -1) {
      this.rooms[furthestIdx].type = this.dangerLevel >= 3 ? "boss_chamber" : "tomb";
    }

    // Secondary room types
    for (let i = 1; i < this.rooms.length; i++) {
      if (i === furthestIdx) continue;
      if (i % 2 === 1) this.rooms[i].type = "treasury";
      else this.rooms[i].type = "hall";
    }

    // Connect rooms with corridors in sequence to guarantee full connectivity
    for (let i = 0; i < this.rooms.length - 1; i++) {
      const rA = this.rooms[i];
      const rB = this.rooms[i + 1];
      const tiles = this._carveCorridor(rA.centerX, rA.centerZ, rB.centerX, rB.centerZ);
      this.corridors.push({
        fromRoomId: rA.id,
        toRoomId: rB.id,
        tiles,
      });
    }

    // Distribute props and enemies
    this._populateContents();
  }

  private _splitBsp(node: BspNode, depth: number, maxDepth: number): void {
    if (depth >= maxDepth) return;
    if (node.width < this.minRoomSize * 2 + 2 && node.height < this.minRoomSize * 2 + 2) return;

    // Decide split orientation
    const splitHoriz = node.height > node.width ? true : node.width > node.height ? false : this._rng() > 0.5;

    if (splitHoriz && node.height >= this.minRoomSize * 2 + 2) {
      const split = Math.floor(node.height * (0.38 + this._rng() * 0.24));
      node.left = { x: node.x, z: node.z, width: node.width, height: split };
      node.right = { x: node.x, z: node.z + split, width: node.width, height: node.height - split };
      this._splitBsp(node.left, depth + 1, maxDepth);
      this._splitBsp(node.right, depth + 1, maxDepth);
    } else if (!splitHoriz && node.width >= this.minRoomSize * 2 + 2) {
      const split = Math.floor(node.width * (0.38 + this._rng() * 0.24));
      node.left = { x: node.x, z: node.z, width: split, height: node.height };
      node.right = { x: node.x + split, z: node.z, width: node.width - split, height: node.height };
      this._splitBsp(node.left, depth + 1, maxDepth);
      this._splitBsp(node.right, depth + 1, maxDepth);
    }
  }

  private _collectLeaves(node: BspNode, out: BspNode[]): void {
    if (!node.left && !node.right) {
      out.push(node);
      return;
    }
    if (node.left) this._collectLeaves(node.left, out);
    if (node.right) this._collectLeaves(node.right, out);
  }

  private _carveCorridor(x1: number, z1: number, x2: number, z2: number): Array<{ x: number; z: number }> {
    const tiles: Array<{ x: number; z: number }> = [];
    let curX = x1;
    let curZ = z1;

    // Horizontal leg
    const stepX = x2 >= x1 ? 1 : -1;
    while (curX !== x2) {
      tiles.push({ x: curX, z: curZ });
      curX += stepX;
    }

    // Vertical leg
    const stepZ = z2 >= z1 ? 1 : -1;
    while (curZ !== z2) {
      tiles.push({ x: curX, z: curZ });
      curZ += stepZ;
    }
    tiles.push({ x: curX, z: curZ });

    return tiles;
  }

  private _populateContents(): void {
    let propCounter = 1;

    for (const room of this.rooms) {
      if (room.type === "entry") {
        room.props.push({ id: `prop_${propCounter++}`, type: "Lantern", x: room.centerX, z: room.centerZ });
        continue;
      }

      if (room.type === "crypt") {
        room.props.push({ id: `prop_${propCounter++}`, type: "Altar", x: room.centerX, z: room.centerZ });
        room.props.push({ id: `prop_${propCounter++}`, type: "Chest", x: room.x + 1, z: room.z + 1 });
        room.enemies.push({ type: "Skeleton", x: room.centerX, z: room.centerZ + 1 });
      } else if (room.type === "treasury") {
        room.props.push({ id: `prop_${propCounter++}`, type: "Chest", x: room.centerX, z: room.centerZ });
        room.props.push({ id: `prop_${propCounter++}`, type: "Cauldron", x: room.x + 1, z: room.z + 1 });
        room.enemies.push({ type: "Spider", x: room.centerX - 1, z: room.centerZ });
      } else if (room.type === "boss_chamber" || room.type === "tomb") {
        room.props.push({ id: `prop_${propCounter++}`, type: "Altar", x: room.centerX, z: room.centerZ });
        room.props.push({ id: `prop_${propCounter++}`, type: "Chest", x: room.centerX + 1, z: room.centerZ + 1 });
        room.props.push({ id: `prop_${propCounter++}`, type: "Lantern", x: room.x + 1, z: room.z + 1 });
        const bossType = this.dangerLevel >= 5 ? "Troll" : this.dangerLevel >= 3 ? "Ghost" : "Skeleton";
        room.enemies.push({ type: bossType, x: room.centerX, z: room.centerZ, isBoss: true });
      } else {
        // Hall
        room.props.push({ id: `prop_${propCounter++}`, type: "Bench", x: room.x + 1, z: room.centerZ });
        room.enemies.push({ type: "Bat", x: room.centerX, z: room.centerZ });
      }
    }
  }

  /**
   * Converts the procedural dungeon into a CellDefinition ready for CellManager.
   */
  public toCellDefinition(tileSize: number = 3): CellDefinition {
    const entryRoom = this.rooms[0] || { centerX: 2, centerZ: 2 };
    const spawnPos = new Vector3(entryRoom.centerX * tileSize, 1.0, entryRoom.centerZ * tileSize);

    return {
      id: this.id,
      name: this.name,
      type: "interior",
      spawnPosition: spawnPos,
      build: (scene: Scene) => this.buildMeshes(scene, tileSize),
    };
  }

  /**
   * Builds the 3D interior geometry (floors, walls, props) in Babylon.js.
   */
  public buildMeshes(scene: Scene, tileSize: number = 3): Mesh[] {
    const meshes: Mesh[] = [];

    const floorMat = new StandardMaterial(`${this.id}_floor_mat`, scene);
    floorMat.diffuseColor = new Color3(0.22, 0.2, 0.18);
    floorMat.specularColor = new Color3(0.05, 0.05, 0.05);

    const wallMat = new StandardMaterial(`${this.id}_wall_mat`, scene);
    wallMat.diffuseColor = new Color3(0.16, 0.14, 0.12);
    wallMat.specularColor = new Color3(0.04, 0.04, 0.04);

    // Build floor meshes for rooms
    for (const r of this.rooms) {
      const floor = MeshBuilder.CreateGround(
        `${this.id}_floor_${r.id}`,
        { width: r.width * tileSize, height: r.height * tileSize },
        scene,
      );
      floor.position.x = (r.x + r.width / 2) * tileSize;
      floor.position.y = 0;
      floor.position.z = (r.z + r.height / 2) * tileSize;
      floor.material = floorMat;
      floor.checkCollisions = true;
      meshes.push(floor);
    }

    // Build corridor floor tiles
    for (let c = 0; c < this.corridors.length; c++) {
      const corr = this.corridors[c];
      for (let t = 0; t < corr.tiles.length; t++) {
        const tile = corr.tiles[t];
        const floor = MeshBuilder.CreateGround(
          `${this.id}_corr_${c}_${t}`,
          { width: tileSize, height: tileSize },
          scene,
        );
        floor.position.x = (tile.x + 0.5) * tileSize;
        floor.position.y = 0;
        floor.position.z = (tile.z + 0.5) * tileSize;
        floor.material = floorMat;
        floor.checkCollisions = true;
        meshes.push(floor);
      }
    }

    // Build perimeter walls for rooms
    const wallHeight = 3.2;
    const wallThickness = 0.4;

    for (const r of this.rooms) {
      const rx = (r.x + r.width / 2) * tileSize;
      const rz = (r.z + r.height / 2) * tileSize;
      const hw = (r.width * tileSize) / 2;
      const hh = (r.height * tileSize) / 2;

      // North wall (+z)
      const north = MeshBuilder.CreateBox(
        `${this.id}_wall_n_${r.id}`,
        { width: r.width * tileSize, height: wallHeight, depth: wallThickness },
        scene,
      );
      north.position = new Vector3(rx, wallHeight / 2, rz + hh);
      north.material = wallMat;
      north.checkCollisions = true;
      meshes.push(north);

      // South wall (-z)
      const south = MeshBuilder.CreateBox(
        `${this.id}_wall_s_${r.id}`,
        { width: r.width * tileSize, height: wallHeight, depth: wallThickness },
        scene,
      );
      south.position = new Vector3(rx, wallHeight / 2, rz - hh);
      south.material = wallMat;
      south.checkCollisions = true;
      meshes.push(south);

      // East wall (+x)
      const east = MeshBuilder.CreateBox(
        `${this.id}_wall_e_${r.id}`,
        { width: wallThickness, height: wallHeight, depth: r.height * tileSize },
        scene,
      );
      east.position = new Vector3(rx + hw, wallHeight / 2, rz);
      east.material = wallMat;
      east.checkCollisions = true;
      meshes.push(east);

      // West wall (-x)
      const west = MeshBuilder.CreateBox(
        `${this.id}_wall_w_${r.id}`,
        { width: wallThickness, height: wallHeight, depth: r.height * tileSize },
        scene,
      );
      west.position = new Vector3(rx - hw, wallHeight / 2, rz);
      west.material = wallMat;
      west.checkCollisions = true;
      meshes.push(west);
    }

    return meshes;
  }
}
