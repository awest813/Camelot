/**
 * village-buildings — assemble cottages and inns from the Quaternius Medieval
 * Village MegaKit modules (CC0, imported as the `v*` FantasyAssetKeys).
 *
 * Pure layout data (no Babylon): {@link buildingLayout} returns where each
 * module goes in building-local space; the game turns that into instances.
 *
 * Kit conventions (measured from the modules):
 *  • walls are 2 m wide × {@link WALL_HEIGHT} tall, pivot at the bottom
 *    centre, the facade on local +Z;
 *  • floor tiles are 2 × 2 m, pivot at the centre;
 *  • `RoofWxD` covers a W × D footprint centred on its pivot, sitting on top
 *    of the walls, ridge along Z; `GableW` is the matching brick gable end;
 *  • door panels hinge at one edge and are ~1.1 m wide; after Babylon's
 *    handedness conversion the panel extends toward −X from its pivot.
 *
 * Local space: the building is centred on the origin, its door faces +Z.
 */
import type { FantasyAssetKey } from "../systems/fantasy-asset-loader";

export type BuildingKind = "cottage" | "house" | "inn";

export interface ModulePlacement {
  key: FantasyAssetKey;
  x: number;
  y: number;
  z: number;
  /** Yaw in radians; local +Z of the module ends up pointing along (sin, cos). */
  rotY: number;
}

export const WALL_WIDTH = 2;
export const WALL_HEIGHT = 3.12;
/** Half the door panel width — offsets the hinge so the panel fills the opening. */
export const DOOR_HALF = 0.53;

interface Spec {
  /** Footprint in wall segments (X × Z). */
  segsX: number;
  segsZ: number;
  wall: FantasyAssetKey;
  wallDoor: FantasyAssetKey;
  wallWindow: FantasyAssetKey;
  /** Plain-wall variant for the back (timber framing on cottages). */
  wallBack: FantasyAssetKey;
  corner: FantasyAssetKey;
  roof: FantasyAssetKey;
  gable: FantasyAssetKey;
}

const SPECS: Record<BuildingKind, Spec> = {
  cottage: {
    segsX: 2, segsZ: 2,
    wall: "vWallPlaster", wallDoor: "vWallPlasterDoor", wallWindow: "vWallPlasterWindow",
    wallBack: "vWallTimber", corner: "vCornerWood", roof: "vRoof4x4", gable: "vGable4",
  },
  house: {
    segsX: 2, segsZ: 3,
    wall: "vWallTimber", wallDoor: "vWallPlasterDoor", wallWindow: "vWallPlasterWindow",
    wallBack: "vWallTimber", corner: "vCornerWood", roof: "vRoof4x6", gable: "vGable4",
  },
  inn: {
    segsX: 3, segsZ: 4,
    wall: "vWallBrick", wallDoor: "vWallBrickDoor", wallWindow: "vWallBrickWindow",
    wallBack: "vWallBrick", corner: "vCornerBrick", roof: "vRoof6x8", gable: "vGable6",
  },
};

/** Footprint (metres) of a building kind: width along X, depth along Z. */
export function buildingFootprint(kind: BuildingKind): { width: number; depth: number } {
  const s = SPECS[kind];
  return { width: s.segsX * WALL_WIDTH, depth: s.segsZ * WALL_WIDTH };
}

/** Module placements for one building, in building-local space. */
export function buildingLayout(kind: BuildingKind): ModulePlacement[] {
  const s = SPECS[kind];
  const hw = (s.segsX * WALL_WIDTH) / 2;
  const hd = (s.segsZ * WALL_WIDTH) / 2;
  const out: ModulePlacement[] = [];
  const put = (key: FantasyAssetKey, x: number, y: number, z: number, rotY: number) =>
    out.push({ key, x, y, z, rotY });

  // Segment centres along a side of `n` segments.
  const centres = (n: number) => Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * WALL_WIDTH);
  const doorIndex = Math.floor((s.segsX - 1) / 2);

  // Front (+Z): door in the middle segment, windows either side.
  centres(s.segsX).forEach((x, i) => {
    if (i === doorIndex) {
      put(s.wallDoor, x, 0, hd, 0);
      put("vDoor", x + DOOR_HALF, 0, hd - 0.12, 0);
    } else {
      put(s.wallWindow, x, 0, hd, 0);
      put("vWindow", x, 0, hd - 0.1, 0);
      put("vShutters", x, 0, hd - 0.1, 0);
    }
  });
  // Back (−Z).
  centres(s.segsX).forEach((x) => put(s.wallBack, x, 0, -hd, Math.PI));
  // Sides: a window (with frame and shutters) in every other segment.
  centres(s.segsZ).forEach((z, i) => {
    const window = i % 2 === 1;
    for (const [x, rot, inset] of [[-hw, -Math.PI / 2, 0.1], [hw, Math.PI / 2, -0.1]] as const) {
      put(window ? s.wallWindow : s.wall, x, 0, z, rot);
      if (window) {
        put("vWindow", x + inset, 0, z, rot);
        put("vShutters", x + inset, 0, z, rot);
      }
    }
  });
  // Corner posts.
  for (const [cx, cz] of [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]] as const) {
    put(s.corner, cx, 0, cz, 0);
  }
  // Floor.
  for (const x of centres(s.segsX)) {
    for (const z of centres(s.segsZ)) put("vFloorWood", x, 0.02, z, 0);
  }
  // Roof + gable ends.
  put(s.roof, 0, WALL_HEIGHT, 0, 0);
  put(s.gable, 0, WALL_HEIGHT, hd, 0);
  put(s.gable, 0, WALL_HEIGHT, -hd, Math.PI);
  return out;
}

/** A static wall collider box, in building-local space (yaw 0; axis-aligned). */
export interface WallCollider {
  x: number;
  z: number;
  /** Extent along local X. */
  width: number;
  /** Extent along local Z. */
  depth: number;
}

/** Wall thickness used for colliders. */
export const WALL_COLLIDER_THICKNESS = 0.3;

/**
 * Colliders for a building's walls: back, both sides, and the front split
 * around the doorway, so the interior stays open to anyone who walks in
 * (chasers, companions, projectiles, dropped loot).
 */
export function buildingWallColliders(kind: BuildingKind): WallCollider[] {
  const s = SPECS[kind];
  const hw = (s.segsX * WALL_WIDTH) / 2;
  const hd = (s.segsZ * WALL_WIDTH) / 2;
  const t = WALL_COLLIDER_THICKNESS;
  const out: WallCollider[] = [
    { x: 0, z: -hd, width: hw * 2, depth: t },
    { x: -hw, z: 0, width: t, depth: hd * 2 },
    { x: hw, z: 0, width: t, depth: hd * 2 },
  ];
  // Front: everything but the door opening (centred on the door segment).
  const doorIndex = Math.floor((s.segsX - 1) / 2);
  const doorX = (doorIndex - (s.segsX - 1) / 2) * WALL_WIDTH;
  const gapL = doorX - DOOR_HALF - 0.05;
  const gapR = doorX + DOOR_HALF + 0.05;
  if (gapL > -hw) out.push({ x: (-hw + gapL) / 2, z: hd, width: gapL + hw, depth: t });
  if (gapR < hw) out.push({ x: (gapR + hw) / 2, z: hd, width: hw - gapR, depth: t });
  return out;
}

/** Building-local → world, for a building at `origin` turned by `origin.rot`. */
export function toWorld(
  p: { x: number; z: number },
  origin: { x: number; z: number; rot: number },
): { x: number; z: number } {
  const c = Math.cos(origin.rot), s = Math.sin(origin.rot);
  return { x: origin.x + p.x * c + p.z * s, z: origin.z - p.x * s + p.z * c };
}
