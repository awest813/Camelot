import type { ChunkKey, Vec2Like } from "./ChunkTypes";

export function toChunkKey(coords: Vec2Like): ChunkKey {
  return `${coords.x},${coords.y}`;
}

export function fromChunkKey(key: ChunkKey): Vec2Like {
  const [x, y] = key.split(",").map(Number);
  return { x, y };
}

export function worldToChunkCoords(
  world: Vec2Like,
  chunkSize: number
): Vec2Like {
  return {
    x: Math.floor(world.x / chunkSize),
    y: Math.floor(world.y / chunkSize),
  };
}

export function squareCoordsAround(
  center: Vec2Like,
  radius: number
): Vec2Like[] {
  const coords: Vec2Like[] = [];

  for (let y = center.y - radius; y <= center.y + radius; y++) {
    for (let x = center.x - radius; x <= center.x + radius; x++) {
      coords.push({ x, y });
    }
  }

  return coords;
}

export function sortCoordsByDistance(
  coords: Vec2Like[],
  center: Vec2Like
): Vec2Like[] {
  return [...coords].sort((a, b) => {
    const da = Math.abs(a.x - center.x) + Math.abs(a.y - center.y);
    const db = Math.abs(b.x - center.x) + Math.abs(b.y - center.y);
    return da - db;
  });
}
