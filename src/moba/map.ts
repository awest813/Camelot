import { dist, distToPath, mulberry32 } from "./math";
import type { Lane, Team, TowerTier, Vec } from "./types";

/** Playable square, in world metres. Bases sit in the corners. */
export const BOUNDS = 40;
export const FIRST_WAVE = 8;
export const WAVE_INTERVAL = 18;
export const RECALL_TIME = 4.2;
export const FOUNTAIN_RADIUS = 6.5;
export const MINION_CAP = 8;

/** Healing well behind each nexus. Enemy heroes melt if they step in. */
export const FOUNTAIN: Record<Team, Vec> = {
  camelot: { x: -36.2, z: -36.2 },
  mordred: { x: 36.2, z: 36.2 },
};

export const NEXUS_AT: Record<Team, Vec> = {
  camelot: { x: -28.6, z: -28.6 },
  mordred: { x: 28.6, z: 28.6 },
};

/**
 * Lane polylines run Camelot (southwest) → Mordred (northeast).
 * Top takes the west then north roads, bot the south then east, mid the diagonal.
 */
export const LANE_PATHS: Record<Lane, Vec[]> = {
  mid: [
    { x: -24, z: -24 },
    { x: -16, z: -16 },
    { x: -8, z: -8 },
    { x: 0, z: 0 },
    { x: 8, z: 8 },
    { x: 16, z: 16 },
    { x: 24, z: 24 },
    { x: 28.6, z: 28.6 },
  ],
  top: [
    { x: -33, z: -22 },
    { x: -33, z: -8 },
    { x: -33, z: 8 },
    { x: -33, z: 24 },
    { x: -18, z: 33 },
    { x: 0, z: 33 },
    { x: 16, z: 33 },
    { x: 28, z: 30 },
    { x: 28.6, z: 28.6 },
  ],
  bot: [
    { x: -22, z: -33 },
    { x: -8, z: -33 },
    { x: 8, z: -33 },
    { x: 24, z: -33 },
    { x: 33, z: -18 },
    { x: 33, z: 0 },
    { x: 33, z: 16 },
    { x: 30, z: 28 },
    { x: 28.6, z: 28.6 },
  ],
};

export const LANES: Lane[] = ["top", "mid", "bot"];

export function pathFor(team: Team, lane: Lane): Vec[] {
  const path = LANE_PATHS[lane];
  return team === "camelot" ? path : path.slice().reverse();
}

export function otherTeam(team: Team): Team {
  return team === "camelot" ? "mordred" : "camelot";
}

export interface TowerSpawn {
  team: Team;
  lane: Lane;
  tier: TowerTier;
  x: number;
  z: number;
}

export const TOWER_SPAWNS: TowerSpawn[] = [
  { team: "camelot", lane: "top", tier: "outer", x: -33, z: -2 },
  { team: "camelot", lane: "top", tier: "inner", x: -33, z: 20 },
  { team: "camelot", lane: "mid", tier: "outer", x: -20, z: -20 },
  { team: "camelot", lane: "mid", tier: "inner", x: -9, z: -9 },
  { team: "camelot", lane: "bot", tier: "outer", x: -2, z: -33 },
  { team: "camelot", lane: "bot", tier: "inner", x: 20, z: -33 },

  { team: "mordred", lane: "top", tier: "outer", x: 2, z: 33 },
  { team: "mordred", lane: "top", tier: "inner", x: 20, z: 33 },
  { team: "mordred", lane: "mid", tier: "outer", x: 20, z: 20 },
  { team: "mordred", lane: "mid", tier: "inner", x: 9, z: 9 },
  { team: "mordred", lane: "bot", tier: "outer", x: 33, z: 2 },
  { team: "mordred", lane: "bot", tier: "inner", x: 33, z: -20 },
];

export function heroSpawn(team: Team, lane: Lane): Vec {
  const b = FOUNTAIN[team];
  const s = team === "camelot" ? 1 : -1;
  if (lane === "top") return { x: b.x + s * 0.4, z: b.z + s * 1.8 };
  if (lane === "bot") return { x: b.x + s * 1.8, z: b.z + s * 0.4 };
  return { x: b.x + s * 1.3, z: b.z + s * 1.3 };
}

export interface Prop {
  x: number;
  z: number;
  r: number;
  kind: "tree" | "rock" | "flower";
  tint: number;
}

function nearBase(x: number, z: number): boolean {
  return dist({ x, z }, FOUNTAIN.camelot) < 11 || dist({ x, z }, FOUNTAIN.mordred) < 11
    || dist({ x, z }, NEXUS_AT.camelot) < 6 || dist({ x, z }, NEXUS_AT.mordred) < 6;
}

function laneClearance(x: number, z: number): number {
  let best = Infinity;
  for (const lane of LANES) {
    best = Math.min(best, distToPath(x, z, LANE_PATHS[lane]));
  }
  return best;
}

export function buildProps(seed: number): Prop[] {
  const rng = mulberry32(seed);
  const props: Prop[] = [];
  let guard = 0;
  while (props.filter((p) => p.kind !== "flower").length < 42 && guard < 800) {
    guard++;
    const x = (rng() * 2 - 1) * 36;
    const z = (rng() * 2 - 1) * 36;
    if (nearBase(x, z)) continue;
    if (laneClearance(x, z) < 4.6) continue;
    const rock = rng() < 0.28;
    props.push({
      x,
      z,
      r: rock ? 1.05 : 1.15,
      kind: rock ? "rock" : "tree",
      tint: rng(),
    });
  }
  guard = 0;
  while (props.filter((p) => p.kind === "flower").length < 36 && guard < 500) {
    guard++;
    const x = (rng() * 2 - 1) * 37;
    const z = (rng() * 2 - 1) * 37;
    if (nearBase(x, z)) continue;
    const clearance = laneClearance(x, z);
    if (clearance < 2.3 || clearance > 6.5) continue;
    props.push({ x, z, r: 0, kind: "flower", tint: rng() });
  }
  return props;
}

export const PROPS: Prop[] = buildProps(1337);

export function blockers(): Prop[] {
  return PROPS.filter((p) => p.kind !== "flower");
}
