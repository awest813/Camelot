import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import "@babylonjs/core/Meshes/Builders/groundBuilder";
import "@babylonjs/core/Meshes/Builders/sphereBuilder";
import "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import "@babylonjs/core/Meshes/Builders/boxBuilder";
import "@babylonjs/core/Meshes/Builders/torusBuilder";
import "@babylonjs/core/Meshes/Builders/ribbonBuilder";
import "@babylonjs/core/Meshes/Builders/discBuilder";

import { distToPath } from "../moba/math";
import {
  FOUNTAIN,
  LANES,
  LANE_PATHS,
  NEXUS_AT,
  PROPS,
  TOWER_SPAWNS,
} from "../moba/map";
import type { Match } from "../moba/sim";
import type { Lane, Team, TowerTier } from "../moba/types";
import { PAL, candy, teamColor } from "./palette";

interface Crystal {
  mesh: Mesh;
  baseY: number;
}

function keyOf(team: Team, kind: "tower" | "nexus", lane: Lane | null, tier: TowerTier | null): string {
  return kind === "nexus" ? `${team}:nexus` : `${team}:${lane}:${tier}`;
}

function hash(x: number, z: number): number {
  const n = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function ribbon(scene: Scene, name: string, path: { x: number; z: number }[], width: number, y: number): Mesh {
  const left: Vector3[] = [];
  const right: Vector3[] = [];
  for (let i = 0; i < path.length; i++) {
    const prev = path[Math.max(0, i - 1)];
    const next = path[Math.min(path.length - 1, i + 1)];
    let dx = next.x - prev.x;
    let dz = next.z - prev.z;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    left.push(new Vector3(path[i].x - dz * width, y, path[i].z + dx * width));
    right.push(new Vector3(path[i].x + dz * width, y, path[i].z - dx * width));
  }
  const mesh = MeshBuilder.CreateRibbon(name, { pathArray: [left, right], sideOrientation: Mesh.DOUBLESIDE }, scene);
  mesh.isPickable = false;
  return mesh;
}

export class Arena {
  private readonly nodes = new Map<string, TransformNode>();
  private readonly hp = new Map<string, number>();
  private readonly crystals: Crystal[] = [];
  private readonly water: Mesh;

  constructor(private readonly scene: Scene) {
    this.paintLights();
    this.paintGround();
    this.paintLanes();
    this.water = this.paintRiver();
    this.paintBases();
    this.paintProps();
    this.paintHorizon();
  }

  tick(time: number): void {
    this.water.position.y = 0.08 + Math.sin(time * 1.7) * 0.035;
    for (const crystal of this.crystals) {
      const bob = Math.sin(time * 2.2 + crystal.baseY) * 0.1;
      crystal.mesh.position.y = crystal.baseY + bob;
      const s = 1 + Math.sin(time * 3 + crystal.baseY) * 0.06;
      crystal.mesh.scaling.setAll(s);
    }
  }

  sync(match: Match): void {
    for (const unit of match.units) {
      if (unit.kind !== "tower" && unit.kind !== "nexus") continue;
      const key = keyOf(unit.team, unit.kind, unit.lane, unit.tier);
      const node = this.nodes.get(key);
      if (!node) continue;
      const prev = this.hp.get(key);
      if (prev != null && unit.hp < prev - 1 && unit.alive) {
        node.scaling.set(1.06, 0.9, 1.06);
      } else {
        node.scaling.x += (1 - node.scaling.x) * 0.15;
        node.scaling.y += (1 - node.scaling.y) * 0.15;
        node.scaling.z += (1 - node.scaling.z) * 0.15;
      }
      this.hp.set(key, unit.hp);
      if (!unit.alive && node.position.y > -3.5) node.position.y -= 0.05;
    }
  }

  private paintLights(): void {
    this.scene.ambientColor = new Color3(0.38, 0.4, 0.44);
    const hemi = new HemisphericLight("sky", new Vector3(0.15, 1, 0.2), this.scene);
    hemi.intensity = 0.62;
    hemi.diffuse = new Color3(0.9, 0.95, 1);
    hemi.groundColor = new Color3(0.24, 0.3, 0.16);
    hemi.specular = new Color3(0.04, 0.04, 0.04);
    const sun = new DirectionalLight("sun", new Vector3(0.45, -1, 0.25), this.scene);
    sun.intensity = 0.38;
    sun.diffuse = new Color3(1, 0.95, 0.82);
    sun.specular = new Color3(0.15, 0.14, 0.1);
  }

  private paintGround(): void {
    const ground = MeshBuilder.CreateGround("green", { width: 108, height: 108, subdivisions: 56 }, this.scene);
    const positions = ground.getVerticesData(VertexBuffer.PositionKind);
    if (!positions) return;
    const colors = new Float32Array((positions.length / 3) * 4);
    for (let i = 0, c = 0; i < positions.length; i += 3, c += 4) {
      const x = positions[i];
      const z = positions[i + 2];
      const n = hash(Math.round(x * 2), Math.round(z * 2));
      let color = n > 0.72 ? PAL.grassLite : n < 0.18 ? PAL.grassDeep : PAL.grass;
      let clearance = Infinity;
      for (const lane of LANES) clearance = Math.min(clearance, distToPath(x, z, LANE_PATHS[lane]));
      if (clearance < 3.1) color = PAL.lane.scale(0.92);
      const edge = Math.max(Math.abs(x), Math.abs(z));
      if (edge > 42) color = PAL.grassDeep.scale(0.85);
      colors[c] = color.r;
      colors[c + 1] = color.g;
      colors[c + 2] = color.b;
      colors[c + 3] = 1;
    }
    ground.setVerticesData(VertexBuffer.ColorKind, colors);
    const mat = candy(this.scene, "grass", Color3.White(), 0.02);
    mat.specularColor = Color3.Black();
    ground.material = mat;
    ground.isPickable = false;
  }

  private paintLanes(): void {
    const fill = candy(this.scene, "lane", PAL.lane, 0);
    const edge = candy(this.scene, "laneEdge", PAL.laneEdge, 0);
    for (const lane of LANES) {
      const dirt = ribbon(this.scene, `lane-${lane}`, LANE_PATHS[lane], 1.7, 0.05);
      dirt.material = fill;
      const trim = ribbon(this.scene, `trim-${lane}`, LANE_PATHS[lane], 2.05, 0.03);
      trim.material = edge;
    }
  }

  private paintRiver(): Mesh {
    const path = [
      { x: -18, z: 34 },
      { x: -8, z: 16 },
      { x: 0, z: 0 },
      { x: 8, z: -16 },
      { x: 18, z: -34 },
    ];
    const mesh = ribbon(this.scene, "river", path, 3.4, 0.08);
    mesh.material = candy(this.scene, "water", PAL.river, 0.35, 0.72);
    const shine = ribbon(this.scene, "riverShine", path, 1.3, 0.1);
    shine.material = candy(this.scene, "waterShine", new Color3(0.8, 0.96, 1), 0.55, 0.35);
    return mesh;
  }

  private paintBases(): void {
    for (const team of ["camelot", "mordred"] as const) {
      const well = FOUNTAIN[team];
      const padColor = team === "camelot" ? new Color3(0.5, 0.36, 0.2) : new Color3(0.3, 0.18, 0.36);
      const pad = MeshBuilder.CreateCylinder(`${team}-pad`, { diameter: 11, height: 0.22, tessellation: 12 }, this.scene);
      pad.position.set(well.x, 0.06, well.z);
      pad.material = candy(this.scene, `${team}-stone`, padColor, 0);
      pad.isPickable = false;
      const ring = MeshBuilder.CreateTorus(`${team}-ring`, { diameter: 11.5, thickness: 0.28, tessellation: 10 }, this.scene);
      ring.position.set(well.x, 0.28, well.z);
      ring.material = candy(this.scene, `${team}-ring`, teamColor(team), 0.04);
      ring.isPickable = false;
      const pool = MeshBuilder.CreateDisc(`${team}-pool`, { radius: 2.1, tessellation: 10 }, this.scene);
      pool.rotation.x = Math.PI / 2;
      pool.position.set(well.x, 0.3, well.z);
      pool.material = candy(this.scene, `${team}-pool`, teamColor(team, true), 0.28, 0.9);
      pool.isPickable = false;

      const nexus = NEXUS_AT[team];
      const root = new TransformNode(`${team}-nexus`, this.scene);
      root.position.set(nexus.x, 0, nexus.z);
      this.nodes.set(keyOf(team, "nexus", null, null), root);
      const plinth = MeshBuilder.CreateCylinder(`${team}-plinth`, { diameter: 4.2, height: 0.7, tessellation: 8 }, this.scene);
      plinth.position.y = 0.35;
      plinth.parent = root;
      plinth.material = candy(this.scene, `${team}-plinth`, PAL.stone, 0.05);
      plinth.isPickable = false;
      const keep = MeshBuilder.CreateCylinder(`${team}-keep`, { diameter: 2.5, height: 3.4, tessellation: 7 }, this.scene);
      keep.position.y = 2.3;
      keep.parent = root;
      keep.material = candy(this.scene, `${team}-keep`, team === "camelot" ? new Color3(0.52, 0.42, 0.3) : new Color3(0.26, 0.16, 0.32), 0);
      keep.isPickable = false;
      const roof = MeshBuilder.CreateCylinder(`${team}-roof`, {
        diameterTop: 0.15,
        diameterBottom: 3.1,
        height: 1.6,
        tessellation: 7,
      }, this.scene);
      roof.position.y = 4.6;
      roof.parent = root;
      roof.material = candy(this.scene, `${team}-roof`, teamColor(team), 0.25);
      roof.isPickable = false;
      const gem = MeshBuilder.CreateSphere(`${team}-gem`, { diameter: 0.85, segments: 6 }, this.scene);
      gem.position.y = 5.7;
      gem.parent = root;
      gem.material = candy(this.scene, `${team}-gem`, teamColor(team), 0.9);
      gem.isPickable = false;
      this.crystals.push({ mesh: gem, baseY: 5.7 });
    }

    for (const tower of TOWER_SPAWNS) {
      const root = new TransformNode(`tower-${tower.team}-${tower.lane}-${tower.tier}`, this.scene);
      root.position.set(tower.x, 0, tower.z);
      this.nodes.set(keyOf(tower.team, "tower", tower.lane, tower.tier), root);
      const height = tower.tier === "outer" ? 2.8 : 3.4;
      const shaft = MeshBuilder.CreateCylinder("shaft", { height, diameter: 1.35, tessellation: 7 }, this.scene);
      shaft.position.y = height / 2;
      shaft.parent = root;
      shaft.material = candy(this.scene, "towerStone", PAL.stone, 0);
      shaft.isPickable = false;
      const cap = MeshBuilder.CreateCylinder("cap", {
        diameterTop: 0.12,
        diameterBottom: 1.7,
        height: 1.05,
        tessellation: 7,
      }, this.scene);
      cap.position.y = height + 0.4;
      cap.parent = root;
      cap.material = candy(this.scene, "towerCap", teamColor(tower.team), 0.28);
      cap.isPickable = false;
      const gem = MeshBuilder.CreateSphere("gem", { diameter: 0.42, segments: 5 }, this.scene);
      gem.position.y = height + 1.15;
      gem.parent = root;
      gem.material = candy(this.scene, "towerGem", teamColor(tower.team), 0.85);
      gem.isPickable = false;
      this.crystals.push({ mesh: gem, baseY: height + 1.15 });
      const flag = MeshBuilder.CreateBox("flag", { width: 0.08, height: 0.7, depth: 0.55 }, this.scene);
      flag.position.set(0.78, height * 0.62, 0);
      flag.parent = root;
      flag.material = candy(this.scene, "flag", teamColor(tower.team, true), 0.2);
      flag.isPickable = false;
    }
  }

  private paintProps(): void {
    const trunkMat = candy(this.scene, "trunk", PAL.trunk, 0.05);
    const leafMat = candy(this.scene, "leaf", PAL.leaf, 0.1);
    const leafLite = candy(this.scene, "leafLite", PAL.leafLite, 0.14);
    const rockMat = candy(this.scene, "rock", PAL.rock, 0.06);
    const flowers = [
      candy(this.scene, "flowerA", new Color3(0.98, 0.45, 0.62), 0.25),
      candy(this.scene, "flowerB", new Color3(1, 0.86, 0.3), 0.25),
      candy(this.scene, "flowerC", new Color3(0.55, 0.75, 1), 0.25),
    ];

    const trunk = MeshBuilder.CreateCylinder("protoTrunk", { height: 1.05, diameter: 0.38, tessellation: 5 }, this.scene);
    trunk.material = trunkMat;
    trunk.setEnabled(false);
    const puff = MeshBuilder.CreateSphere("protoPuff", { diameter: 1.7, segments: 5 }, this.scene);
    puff.material = leafMat;
    puff.setEnabled(false);
    const puff2 = MeshBuilder.CreateSphere("protoPuff2", { diameter: 1.15, segments: 5 }, this.scene);
    puff2.material = leafLite;
    puff2.setEnabled(false);
    const rock = MeshBuilder.CreateSphere("protoRock", { diameter: 1.3, segments: 4 }, this.scene);
    rock.material = rockMat;
    rock.setEnabled(false);
    const bloom = MeshBuilder.CreateSphere("protoBloom", { diameter: 0.38, segments: 4 }, this.scene);
    bloom.setEnabled(false);

    for (const prop of PROPS) {
      if (prop.kind === "flower") {
        const flower = bloom.clone(`flower-${prop.x.toFixed(1)}`)!;
        flower.material = flowers[Math.floor(prop.tint * flowers.length) % flowers.length];
        flower.position.set(prop.x, 0.22, prop.z);
        flower.scaling.setAll(0.7 + prop.tint * 0.6);
        flower.setEnabled(true);
        flower.isPickable = false;
        continue;
      }
      if (prop.kind === "rock") {
        const stone = rock.clone(`rock-${prop.x.toFixed(1)}`)!;
        stone.position.set(prop.x, 0.45, prop.z);
        stone.scaling.set(1 + prop.tint, 0.55 + prop.tint * 0.3, 0.9);
        stone.setEnabled(true);
        stone.isPickable = false;
        continue;
      }
      const stem = trunk.clone(`stem-${prop.x.toFixed(1)}`)!;
      stem.position.set(prop.x, 0.55, prop.z);
      stem.scaling.setAll(0.85 + prop.tint * 0.4);
      stem.setEnabled(true);
      stem.isPickable = false;
      const top = puff.clone(`top-${prop.x.toFixed(1)}`)!;
      top.position.set(prop.x, 1.55 + prop.tint * 0.3, prop.z);
      top.scaling.set(1, 0.82, 1);
      top.setEnabled(true);
      top.isPickable = false;
      const cap = puff2.clone(`cap-${prop.x.toFixed(1)}`)!;
      cap.position.set(prop.x, 2.35, prop.z);
      cap.setEnabled(true);
      cap.isPickable = false;
    }
  }

  private paintHorizon(): void {
    const hillMat = candy(this.scene, "hill", new Color3(0.42, 0.66, 0.36), 0.04);
    const farMat = candy(this.scene, "hillFar", new Color3(0.48, 0.66, 0.58), 0.04);
    for (let i = 0; i < 10; i++) {
      const hill = MeshBuilder.CreateSphere(`hill-${i}`, { diameter: 18, segments: 6 }, this.scene);
      const ang = (i / 10) * Math.PI * 2 + 0.3;
      hill.position.set(Math.cos(ang) * 108, -7, Math.sin(ang) * 108);
      hill.scaling.set(1.6, 0.5, 1);
      hill.material = i % 2 ? farMat : hillMat;
      hill.isPickable = false;
    }
    const sun = MeshBuilder.CreateSphere("sun", { diameter: 6, segments: 8 }, this.scene);
    sun.position.set(-30, 28, -10);
    sun.material = candy(this.scene, "sun", new Color3(1, 0.93, 0.55), 0.95);
    sun.isPickable = false;
  }
}
