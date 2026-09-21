#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outRoot = path.join(root, "public", "model", "quaternius");

const packs = {
  props: [
    "Barrel", "Crate", "Chest", "Table", "Chair", "Bench", "Shelf", "Bookshelf", "Bed", "Anvil",
    "Forge", "Altar", "Well", "Fountain", "MarketStall", "SignPost", "Lantern", "Cauldron", "Flag",
    "BannerStand",
  ],
  nature: [
    "OakTree", "PineTree", "WillowTree", "DeadTree", "BushLarge", "BushSmall", "Fern", "FlowerRed",
    "FlowerBlue", "GrassClump", "RockLarge", "RockMedium", "RockSmall", "Stump", "Log", "Mushroom",
  ],
  characters: [
    "Knight", "Mage", "Rogue", "Archer", "Barbarian", "VillagerMale", "VillagerFemale", "Guard",
    "Merchant", "Innkeeper",
  ],
  monsters: [
    "Skeleton", "Spider", "Slime", "Goblin", "Orc", "Troll", "DragonSmall", "Wolf", "Bat", "Ghost",
  ],
  outfits: [
    "HelmetLight", "HelmetHeavy", "HelmetMage", "ChestLight", "ChestHeavy", "ChestRobe", "LegsLight",
    "LegsHeavy", "BootsLight", "BootsHeavy", "CloakShort", "CloakLong", "Shield", "ShieldTower",
  ],
  animations: [
    "Idle", "Walk", "Run", "AttackMelee", "AttackRanged", "Death", "Hit", "Dodge", "Cast", "Block",
    "Pickup", "Sit",
  ],
};

function getMaterial(pack, name) {
  if (pack === "props") {
    if (name === "Anvil") return { color: [0.24, 0.25, 0.28, 1], metallic: 0.85, roughness: 0.28 };
    if (name === "Cauldron") return { color: [0.18, 0.18, 0.22, 1], metallic: 0.75, roughness: 0.35 };
    if (name === "Altar") return { color: [0.68, 0.65, 0.60, 1], metallic: 0.05, roughness: 0.88 };
    if (name === "Well" || name === "Fountain") return { color: [0.60, 0.58, 0.55, 1], metallic: 0.05, roughness: 0.85 };
    if (name === "Lantern") return { color: [0.92, 0.78, 0.32, 1], metallic: 0.80, roughness: 0.25 };
    if (name === "Flag" || name === "BannerStand") return { color: [0.78, 0.18, 0.20, 1], metallic: 0.05, roughness: 0.80 };
    if (name === "MarketStall") return { color: [0.82, 0.35, 0.20, 1], metallic: 0.05, roughness: 0.75 };
    if (name === "Chest") return { color: [0.48, 0.30, 0.15, 1], metallic: 0.28, roughness: 0.58 };
    if (name === "Barrel") return { color: [0.54, 0.36, 0.18, 1], metallic: 0.18, roughness: 0.72 };
    if (name === "Crate") return { color: [0.68, 0.54, 0.34, 1], metallic: 0.02, roughness: 0.82 };
    if (name === "Forge") return { color: [0.30, 0.28, 0.30, 1], metallic: 0.25, roughness: 0.78 };
    if (name === "Bed") return { color: [0.58, 0.22, 0.24, 1], metallic: 0.05, roughness: 0.70 };
    if (name === "Bookshelf") return { color: [0.45, 0.28, 0.16, 1], metallic: 0.04, roughness: 0.78 };
    return { color: [0.52, 0.34, 0.18, 1], metallic: 0.05, roughness: 0.80 };
  }

  if (pack === "nature") {
    if (name === "FlowerRed") return { color: [0.92, 0.16, 0.22, 1], metallic: 0.0, roughness: 0.50 };
    if (name === "FlowerBlue") return { color: [0.20, 0.50, 0.95, 1], metallic: 0.0, roughness: 0.50 };
    if (name === "Mushroom") return { color: [0.85, 0.18, 0.16, 1], metallic: 0.0, roughness: 0.60 };
    if (name.includes("Rock")) return { color: [0.54, 0.52, 0.50, 1], metallic: 0.05, roughness: 0.90 };
    if (name.includes("Log") || name === "Stump") return { color: [0.44, 0.30, 0.16, 1], metallic: 0.02, roughness: 0.85 };
    if (name === "DeadTree") return { color: [0.42, 0.38, 0.35, 1], metallic: 0.02, roughness: 0.92 };
    if (name === "PineTree") return { color: [0.14, 0.34, 0.16, 1], metallic: 0.02, roughness: 0.82 };
    if (name === "WillowTree") return { color: [0.24, 0.46, 0.20, 1], metallic: 0.02, roughness: 0.85 };
    if (name.includes("Tree")) return { color: [0.18, 0.48, 0.16, 1], metallic: 0.02, roughness: 0.84 };
    if (name === "Fern" || name === "GrassClump") return { color: [0.26, 0.62, 0.20, 1], metallic: 0.0, roughness: 0.78 };
    return { color: [0.22, 0.52, 0.18, 1], metallic: 0.02, roughness: 0.85 };
  }

  if (pack === "characters") {
    if (name === "Knight") return { color: [0.78, 0.80, 0.84, 1], metallic: 0.82, roughness: 0.28 };
    if (name === "Guard") return { color: [0.45, 0.50, 0.64, 1], metallic: 0.50, roughness: 0.45 };
    if (name === "Mage") return { color: [0.22, 0.26, 0.68, 1], metallic: 0.05, roughness: 0.75 };
    if (name === "Rogue") return { color: [0.20, 0.18, 0.20, 1], metallic: 0.15, roughness: 0.60 };
    if (name === "Archer") return { color: [0.34, 0.50, 0.24, 1], metallic: 0.05, roughness: 0.78 };
    if (name === "Barbarian") return { color: [0.60, 0.36, 0.20, 1], metallic: 0.10, roughness: 0.85 };
    if (name === "Merchant") return { color: [0.65, 0.20, 0.35, 1], metallic: 0.12, roughness: 0.68 };
    if (name === "Innkeeper") return { color: [0.58, 0.48, 0.32, 1], metallic: 0.02, roughness: 0.82 };
    if (name === "VillagerFemale") return { color: [0.42, 0.55, 0.62, 1], metallic: 0.02, roughness: 0.85 };
    return { color: [0.62, 0.54, 0.44, 1], metallic: 0.02, roughness: 0.85 };
  }

  if (pack === "monsters") {
    if (name === "Skeleton") return { color: [0.88, 0.86, 0.78, 1], metallic: 0.05, roughness: 0.70 };
    if (name === "Spider") return { color: [0.15, 0.12, 0.16, 1], metallic: 0.30, roughness: 0.45 };
    if (name === "Slime") return { color: [0.18, 0.92, 0.40, 0.85], metallic: 0.10, roughness: 0.18 };
    if (name === "Goblin") return { color: [0.35, 0.58, 0.22, 1], metallic: 0.05, roughness: 0.78 };
    if (name === "Orc") return { color: [0.26, 0.46, 0.22, 1], metallic: 0.14, roughness: 0.72 };
    if (name === "Troll") return { color: [0.40, 0.45, 0.42, 1], metallic: 0.05, roughness: 0.95 };
    if (name === "DragonSmall") return { color: [0.82, 0.18, 0.15, 1], metallic: 0.40, roughness: 0.42 };
    if (name === "Wolf") return { color: [0.46, 0.44, 0.42, 1], metallic: 0.02, roughness: 0.88 };
    if (name === "Bat") return { color: [0.20, 0.16, 0.20, 1], metallic: 0.05, roughness: 0.80 };
    if (name === "Ghost") return { color: [0.65, 0.88, 0.98, 0.75], metallic: 0.00, roughness: 0.25 };
    return { color: [0.44, 0.35, 0.50, 1], metallic: 0.05, roughness: 0.80 };
  }

  if (pack === "outfits") {
    if (name.includes("Heavy") || name === "ShieldTower") return { color: [0.78, 0.80, 0.84, 1], metallic: 0.85, roughness: 0.28 };
    if (name.includes("Mage") || name.includes("Robe")) return { color: [0.25, 0.24, 0.58, 1], metallic: 0.02, roughness: 0.82 };
    if (name.includes("Cloak")) return { color: [0.68, 0.15, 0.18, 1], metallic: 0.02, roughness: 0.82 };
    if (name === "Shield") return { color: [0.50, 0.38, 0.24, 1], metallic: 0.40, roughness: 0.55 };
    return { color: [0.48, 0.34, 0.20, 1], metallic: 0.05, roughness: 0.75 };
  }

  return { color: [0.30, 0.48, 0.76, 1], metallic: 0.10, roughness: 0.70 };
}

function makeBuilder() {
  return { positions: [], normals: [], indices: [] };
}

function addFace(builder, corners, normal) {
  const start = builder.positions.length / 3;
  for (const corner of corners) {
    builder.positions.push(...corner);
    builder.normals.push(...normal);
  }
  builder.indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
}

function addBox(builder, center, size) {
  const [cx, cy, cz] = center;
  const [sx, sy, sz] = size.map((v) => v / 2);
  const x0 = cx - sx, x1 = cx + sx;
  const y0 = cy - sy, y1 = cy + sy;
  const z0 = cz - sz, z1 = cz + sz;

  addFace(builder, [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0]);
  addFace(builder, [[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0]], [-1, 0, 0]);
  addFace(builder, [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0]);
  addFace(builder, [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0]);
  addFace(builder, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1]);
  addFace(builder, [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1]);
}

function addPyramid(builder, center, size, sides = 4) {
  const [cx, cy, cz] = center;
  const [sx, sy, sz] = size;
  const y0 = cy - sy / 2;
  const y1 = cy + sy / 2;
  const rx = sx / 2;
  const rz = sz / 2;

  const baseVerts = [];
  for (let i = 0; i < sides; i++) {
    const angle = (Math.PI * 2 * i) / sides;
    baseVerts.push([cx + Math.cos(angle) * rx, y0, cz + Math.sin(angle) * rz]);
  }

  const baseStart = builder.positions.length / 3;
  for (let i = 0; i < sides; i++) {
    builder.positions.push(...baseVerts[i]);
    builder.normals.push(0, -1, 0);
  }
  for (let i = 1; i < sides - 1; i++) {
    builder.indices.push(baseStart, baseStart + i + 1, baseStart + i);
  }

  const apex = [cx, y1, cz];
  for (let i = 0; i < sides; i++) {
    const next = (i + 1) % sides;
    const p0 = baseVerts[i];
    const p1 = baseVerts[next];
    const midAngle = (Math.PI * 2 * (i + 0.5)) / sides;
    const nx = Math.cos(midAngle);
    const nz = Math.sin(midAngle);
    const start = builder.positions.length / 3;
    builder.positions.push(...p0, ...p1, ...apex);
    builder.normals.push(nx, 0.5, nz, nx, 0.5, nz, nx, 0.5, nz);
    builder.indices.push(start, start + 1, start + 2);
  }
}

function addCylinder(builder, center, radius, height, sides = 10) {
  const [cx, cy, cz] = center;
  const y0 = cy - height / 2;
  const y1 = cy + height / 2;

  for (let i = 0; i < sides; i++) {
    const a0 = (Math.PI * 2 * i) / sides;
    const a1 = (Math.PI * 2 * (i + 1)) / sides;
    const p0 = [cx + Math.cos(a0) * radius, y0, cz + Math.sin(a0) * radius];
    const p1 = [cx + Math.cos(a1) * radius, y0, cz + Math.sin(a1) * radius];
    const p2 = [cx + Math.cos(a1) * radius, y1, cz + Math.sin(a1) * radius];
    const p3 = [cx + Math.cos(a0) * radius, y1, cz + Math.sin(a0) * radius];
    addFace(builder, [p0, p1, p2, p3], [Math.cos((a0 + a1) / 2), 0, Math.sin((a0 + a1) / 2)]);
  }

  const topStart = builder.positions.length / 3;
  for (let i = 0; i < sides; i++) {
    const a = (Math.PI * 2 * i) / sides;
    builder.positions.push(cx + Math.cos(a) * radius, y1, cz + Math.sin(a) * radius);
    builder.normals.push(0, 1, 0);
  }
  for (let i = 1; i < sides - 1; i++) {
    builder.indices.push(topStart, topStart + i, topStart + i + 1);
  }

  const btmStart = builder.positions.length / 3;
  for (let i = 0; i < sides; i++) {
    const a = (Math.PI * 2 * i) / sides;
    builder.positions.push(cx + Math.cos(a) * radius, y0, cz + Math.sin(a) * radius);
    builder.normals.push(0, -1, 0);
  }
  for (let i = 1; i < sides - 1; i++) {
    builder.indices.push(btmStart, btmStart + i + 1, btmStart + i);
  }
}

function addCone(builder, center, radius, height, sides = 8) {
  const [cx, cy, cz] = center;
  const y0 = cy - height / 2;
  const y1 = cy + height / 2;

  const btmStart = builder.positions.length / 3;
  for (let i = 0; i < sides; i++) {
    const a = (Math.PI * 2 * i) / sides;
    builder.positions.push(cx + Math.cos(a) * radius, y0, cz + Math.sin(a) * radius);
    builder.normals.push(0, -1, 0);
  }
  for (let i = 1; i < sides - 1; i++) {
    builder.indices.push(btmStart, btmStart + i + 1, btmStart + i);
  }

  const apex = [cx, y1, cz];
  for (let i = 0; i < sides; i++) {
    const a0 = (Math.PI * 2 * i) / sides;
    const a1 = (Math.PI * 2 * (i + 1)) / sides;
    const p0 = [cx + Math.cos(a0) * radius, y0, cz + Math.sin(a0) * radius];
    const p1 = [cx + Math.cos(a1) * radius, y0, cz + Math.sin(a1) * radius];
    const mid = (a0 + a1) / 2;
    const nx = Math.cos(mid);
    const nz = Math.sin(mid);

    const start = builder.positions.length / 3;
    builder.positions.push(...p0, ...p1, ...apex);
    builder.normals.push(nx, 0.4, nz, nx, 0.4, nz, nx, 0.4, nz);
    builder.indices.push(start, start + 1, start + 2);
  }
}

function addWedge(builder, center, size, dir = "z") {
  const [cx, cy, cz] = center;
  const [sx, sy, sz] = size.map((v) => v / 2);
  const x0 = cx - sx, x1 = cx + sx;
  const y0 = cy - sy, y1 = cy + sy;
  const z0 = cz - sz, z1 = cz + sz;

  if (dir === "z") {
    // Slopes down towards +z
    addFace(builder, [[x1, y0, z0], [x0, y0, z0], [x0, y0, z1], [x1, y0, z1]], [0, -1, 0]); // bottom
    addFace(builder, [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], [0, 0, -1]); // back vertical
    addFace(builder, [[x0, y1, z0], [x1, y1, z0], [x1, y0, z1], [x0, y0, z1]], [0, 0.7, 0.7]); // slope
    // side triangles
    const s1 = builder.positions.length / 3;
    builder.positions.push(x1, y0, z0, x1, y1, z0, x1, y0, z1);
    builder.normals.push(1, 0, 0, 1, 0, 0, 1, 0, 0);
    builder.indices.push(s1, s1 + 1, s1 + 2);

    const s2 = builder.positions.length / 3;
    builder.positions.push(x0, y0, z0, x0, y0, z1, x0, y1, z0);
    builder.normals.push(-1, 0, 0, -1, 0, 0, -1, 0, 0);
    builder.indices.push(s2, s2 + 1, s2 + 2);
  } else {
    // Default box fallback
    addBox(builder, center, size);
  }
}

function createGeometry(pack, name) {
  const builder = makeBuilder();

  // ───────────────────────────────────────────────────────────────────────────
  // NATURE PACK
  // ───────────────────────────────────────────────────────────────────────────
  if (pack === "nature") {
    if (name.includes("Rock")) {
      const s = name.includes("Large") ? 1.4 : name.includes("Medium") ? 0.95 : 0.6;
      // Multi-faceted low-poly boulder
      addPyramid(builder, [0, 0.35 * s, 0], [1.2 * s, 0.7 * s, 1.1 * s], 6);
      addBox(builder, [0.1 * s, 0.25 * s, 0.05 * s], [0.95 * s, 0.5 * s, 0.85 * s]);
      addPyramid(builder, [-0.15 * s, 0.55 * s, -0.1 * s], [0.75 * s, 0.5 * s, 0.7 * s], 5);
    } else if (name.includes("Flower")) {
      // Slender stem, 5 petal lobes, and center stamen
      addCylinder(builder, [0, 0.25, 0], 0.03, 0.5, 6);
      addBox(builder, [0, 0.52, 0], [0.08, 0.08, 0.08]);
      for (let i = 0; i < 5; i++) {
        const a = (Math.PI * 2 * i) / 5;
        const px = Math.cos(a) * 0.16;
        const pz = Math.sin(a) * 0.16;
        addPyramid(builder, [px, 0.52, pz], [0.16, 0.10, 0.16], 4);
      }
    } else if (name === "Mushroom") {
      // Flared stalk + wide parasol cap with rim
      addCylinder(builder, [0, 0.24, 0], 0.11, 0.48, 8);
      addCylinder(builder, [0, 0.50, 0], 0.44, 0.14, 10);
      addCone(builder, [0, 0.65, 0], 0.48, 0.26, 8);
    } else if (name === "Fern" || name === "GrassClump") {
      addCylinder(builder, [0, 0.12, 0], 0.06, 0.24, 6);
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI * 2 * i) / 6;
        const dist = 0.24;
        addPyramid(builder, [Math.cos(a) * dist, 0.48, Math.sin(a) * dist], [0.35, 0.65, 0.35], 4);
      }
    } else if (name === "PineTree") {
      // Conifer: cylindrical trunk + 4 stepped conical evergreen foliage tiers
      addCylinder(builder, [0, 0.6, 0], 0.20, 1.2, 8);
      addCone(builder, [0, 1.5, 0], 1.35, 1.0, 8);
      addCone(builder, [0, 2.2, 0], 1.05, 0.9, 8);
      addCone(builder, [0, 2.8, 0], 0.75, 0.8, 7);
      addCone(builder, [0, 3.3, 0], 0.45, 0.7, 6);
    } else if (name === "WillowTree") {
      // Weeping willow: curved trunk, broad crown, and cascading drape tiers
      addCylinder(builder, [0, 0.8, 0], 0.28, 1.6, 8);
      addBox(builder, [0, 1.8, 0], [1.8, 0.8, 1.8]);
      // 4 cascading foliage curtains
      addBox(builder, [0.8, 1.3, 0], [0.45, 1.2, 1.2]);
      addBox(builder, [-0.8, 1.3, 0], [0.45, 1.2, 1.2]);
      addBox(builder, [0, 1.3, 0.8], [1.2, 1.2, 0.45]);
      addBox(builder, [0, 1.3, -0.8], [1.2, 1.2, 0.45]);
      addPyramid(builder, [0, 2.4, 0], [1.4, 0.8, 1.4], 6);
    } else if (name === "DeadTree") {
      // Jagged gnarled dead tree with bare limb stumps
      addCylinder(builder, [0, 1.1, 0], 0.22, 2.2, 8);
      addBox(builder, [0.45, 1.4, 0.1], [0.85, 0.14, 0.14]);
      addBox(builder, [-0.42, 1.7, -0.1], [0.75, 0.14, 0.14]);
      addBox(builder, [0.15, 2.0, 0.35], [0.14, 0.14, 0.65]);
      addPyramid(builder, [0, 2.4, 0], [0.35, 0.7, 0.35], 5);
    } else if (name === "OakTree") {
      // Sturdy trunk with multi-lobed rounded canopy
      addCylinder(builder, [0, 0.8, 0], 0.26, 1.6, 8);
      addBox(builder, [0, 2.0, 0], [1.6, 1.4, 1.6]);
      addPyramid(builder, [0.4, 2.4, 0.3], [1.3, 1.1, 1.3], 6);
      addPyramid(builder, [-0.4, 2.3, -0.3], [1.2, 1.0, 1.2], 6);
      addPyramid(builder, [0, 2.8, 0], [1.1, 0.9, 1.1], 5);
    } else if (name === "Stump") {
      addCylinder(builder, [0, 0.35, 0], 0.45, 0.7, 10);
      addBox(builder, [0.35, 0.15, 0.2], [0.3, 0.3, 0.25]); // root flare
    } else if (name === "Log") {
      addCylinder(builder, [0, 0.32, 0], 0.28, 1.8, 10);
    } else {
      // BushLarge / BushSmall
      const sz = name.includes("Large") ? 1.15 : 0.75;
      addBox(builder, [0, 0.35 * sz, 0], [1.2 * sz, 0.7 * sz, 1.0 * sz]);
      addPyramid(builder, [0, 0.85 * sz, 0], [1.3 * sz, 0.85 * sz, 1.1 * sz], 6);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MONSTERS PACK
  // ───────────────────────────────────────────────────────────────────────────
  else if (pack === "monsters") {
    if (name === "Wolf") {
      // Quadruped: horizontal body, neck, head with snout and pointed ears, 4 legs, tail
      addBox(builder, [0, 0.58, 0], [0.42, 0.42, 0.85]); // torso
      addBox(builder, [0, 0.82, 0.48], [0.28, 0.28, 0.32]); // head
      addBox(builder, [0, 0.74, 0.72], [0.18, 0.16, 0.26]); // snout
      addPyramid(builder, [-0.10, 1.02, 0.44], [0.10, 0.22, 0.10], 3); // left ear
      addPyramid(builder, [0.10, 1.02, 0.44], [0.10, 0.22, 0.10], 3); // right ear
      // 4 legs
      addBox(builder, [-0.18, 0.24, 0.30], [0.12, 0.48, 0.12]);
      addBox(builder, [0.18, 0.24, 0.30], [0.12, 0.48, 0.12]);
      addBox(builder, [-0.18, 0.24, -0.30], [0.12, 0.48, 0.12]);
      addBox(builder, [0.18, 0.24, -0.30], [0.12, 0.48, 0.12]);
      // bushy tail
      addBox(builder, [0, 0.62, -0.58], [0.14, 0.14, 0.42]);
    } else if (name === "Bat") {
      // Compact body, head with large ears, wide spread wings
      addBox(builder, [0, 0.42, 0], [0.26, 0.32, 0.26]); // body
      addBox(builder, [0, 0.64, 0.05], [0.20, 0.20, 0.20]); // head
      addPyramid(builder, [-0.08, 0.80, 0.05], [0.08, 0.18, 0.08], 3); // left ear
      addPyramid(builder, [0.08, 0.80, 0.05], [0.08, 0.18, 0.08], 3); // right ear
      // Spread wings
      addBox(builder, [-0.62, 0.48, 0], [0.82, 0.05, 0.45]);
      addBox(builder, [0.62, 0.48, 0], [0.82, 0.05, 0.45]);
    } else if (name === "Ghost") {
      // Floating ethereal form: cowl head, floating torso, tapering wispy tail (no human legs)
      addBox(builder, [0, 1.18, 0], [0.38, 0.38, 0.38]); // cowl head
      addCone(builder, [0, 1.45, 0], 0.25, 0.35, 6); // hood peak
      addBox(builder, [0, 0.75, 0], [0.55, 0.65, 0.42]); // billowing torso
      addPyramid(builder, [0, 0.28, 0.05], [0.42, 0.60, 0.35], 5); // tapering ethereal tail
    } else if (name === "Spider") {
      addBox(builder, [0, 0.26, 0.22], [0.48, 0.32, 0.52]); // cephalothorax
      addBox(builder, [0, 0.30, -0.25], [0.58, 0.42, 0.58]); // abdomen
      // 8 angled spider legs
      for (let side of [-1, 1]) {
        for (let i = 0; i < 4; i++) {
          const z = -0.15 + i * 0.16;
          addBox(builder, [side * 0.42, 0.20, z], [0.42, 0.08, 0.10]);
        }
      }
    } else if (name === "Slime") {
      addCylinder(builder, [0, 0.28, 0], 0.60, 0.55, 10);
      addCone(builder, [0, 0.68, 0], 0.62, 0.45, 8);
      addBox(builder, [0, 0.35, 0], [0.24, 0.24, 0.24]); // inner nucleus
    } else if (name === "DragonSmall") {
      // Quadruped reptilian body, neck, horned head, wings, tail
      addBox(builder, [0, 0.48, 0], [0.46, 0.38, 0.85]); // body
      addBox(builder, [0, 0.82, 0.45], [0.24, 0.42, 0.24]); // neck
      addBox(builder, [0, 1.05, 0.62], [0.28, 0.24, 0.42]); // head & snout
      addPyramid(builder, [-0.12, 1.25, 0.52], [0.10, 0.25, 0.10], 3); // horn
      addPyramid(builder, [0.12, 1.25, 0.52], [0.10, 0.25, 0.10], 3);
      // Wings
      addBox(builder, [-0.75, 0.75, 0], [0.95, 0.06, 0.60]);
      addBox(builder, [0.75, 0.75, 0], [0.95, 0.06, 0.60]);
      // Tail
      addBox(builder, [0, 0.38, -0.65], [0.18, 0.18, 0.65]);
      // 4 legs
      addBox(builder, [-0.22, 0.20, 0.30], [0.14, 0.40, 0.14]);
      addBox(builder, [0.22, 0.20, 0.30], [0.14, 0.40, 0.14]);
      addBox(builder, [-0.22, 0.20, -0.30], [0.14, 0.40, 0.14]);
      addBox(builder, [0.22, 0.20, -0.30], [0.14, 0.40, 0.14]);
    } else if (name === "Skeleton") {
      // Skull, ribcage, spine, thin limbs
      addBox(builder, [0, 1.25, 0], [0.26, 0.28, 0.26]); // skull
      addBox(builder, [0, 0.82, 0], [0.38, 0.44, 0.22]); // ribcage
      addBox(builder, [0, 0.52, 0], [0.28, 0.16, 0.20]); // pelvis
      addBox(builder, [-0.14, 0.22, 0], [0.08, 0.48, 0.08]); // left leg
      addBox(builder, [0.14, 0.22, 0], [0.08, 0.48, 0.08]); // right leg
      addBox(builder, [-0.28, 0.78, 0], [0.08, 0.55, 0.08]); // left arm
      addBox(builder, [0.28, 0.78, 0], [0.08, 0.55, 0.08]); // right arm
    } else if (name === "Orc") {
      // Massive hulking shoulders, heavy lower jaw, thick limbs
      addBox(builder, [0, 0.72, 0], [0.65, 0.68, 0.45]); // broad torso
      addBox(builder, [0, 1.25, 0.05], [0.38, 0.35, 0.38]); // head
      addBox(builder, [0, 1.12, 0.25], [0.30, 0.18, 0.20]); // jutting tusked jaw
      addBox(builder, [-0.44, 0.92, 0], [0.24, 0.20, 0.28]); // left shoulder pauldron
      addBox(builder, [0.44, 0.92, 0], [0.24, 0.20, 0.28]); // right shoulder pauldron
      addBox(builder, [-0.42, 0.58, 0], [0.20, 0.65, 0.20]); // arms
      addBox(builder, [0.42, 0.58, 0], [0.20, 0.65, 0.20]);
      addBox(builder, [-0.18, 0.20, 0], [0.20, 0.45, 0.22]); // legs
      addBox(builder, [0.18, 0.20, 0], [0.20, 0.45, 0.22]);
    } else if (name === "Goblin") {
      // Small frame, hunched, large lateral pointed ears
      addBox(builder, [0, 0.48, 0], [0.34, 0.45, 0.28]); // torso
      addBox(builder, [0, 0.85, 0.08], [0.26, 0.25, 0.26]); // head
      addPyramid(builder, [-0.24, 0.88, 0.05], [0.22, 0.12, 0.12], 3); // left ear
      addPyramid(builder, [0.24, 0.88, 0.05], [0.22, 0.12, 0.12], 3); // right ear
      addBox(builder, [-0.24, 0.44, 0], [0.12, 0.48, 0.12]);
      addBox(builder, [0.24, 0.44, 0], [0.12, 0.48, 0.12]);
      addBox(builder, [-0.12, 0.12, 0], [0.12, 0.28, 0.12]);
      addBox(builder, [0.12, 0.12, 0], [0.12, 0.28, 0.12]);
    } else if (name === "Troll") {
      // Towering hunched posture, massive long arms hanging to knuckles
      addBox(builder, [0, 0.95, 0.1], [0.75, 0.95, 0.55]); // hulking torso
      addBox(builder, [0, 1.55, 0.25], [0.38, 0.35, 0.38]); // small sunken head
      addBox(builder, [-0.55, 0.70, 0.1], [0.26, 1.15, 0.26]); // long thick arm
      addBox(builder, [0.55, 0.70, 0.1], [0.26, 1.15, 0.26]);
      addBox(builder, [-0.22, 0.24, 0], [0.24, 0.52, 0.26]); // thick legs
      addBox(builder, [0.22, 0.24, 0], [0.24, 0.52, 0.26]);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // CHARACTERS PACK
  // ───────────────────────────────────────────────────────────────────────────
  else if (pack === "characters") {
    // Base anatomy variables
    if (name === "Knight") {
      // Great helm with crest, shoulder pauldrons, chest breastplate, shield & sword
      addBox(builder, [0, 0.65, 0], [0.46, 0.75, 0.32]); // breastplate torso
      addBox(builder, [0, 1.25, 0], [0.32, 0.34, 0.32]); // great helm
      addPyramid(builder, [0, 1.48, 0], [0.15, 0.22, 0.30], 4); // helm crest
      addBox(builder, [-0.34, 0.95, 0], [0.20, 0.16, 0.22]); // left pauldron
      addBox(builder, [0.34, 0.95, 0], [0.20, 0.16, 0.22]); // right pauldron
      addBox(builder, [-0.32, 0.62, 0], [0.14, 0.55, 0.14]); // left arm
      addBox(builder, [0.32, 0.62, 0], [0.14, 0.55, 0.14]); // right arm
      addBox(builder, [-0.38, 0.62, 0.18], [0.12, 0.52, 0.38]); // shield on arm
      addBox(builder, [0.36, 0.52, 0.32], [0.08, 0.65, 0.12]); // sword blade
      addBox(builder, [-0.14, 0.15, 0], [0.16, 0.55, 0.16]); // armored legs
      addBox(builder, [0.14, 0.15, 0], [0.16, 0.55, 0.16]);
    } else if (name === "Mage") {
      // Pointed wizard hat, cowled shoulders, long flared robe dress, arcane staff
      addBox(builder, [0, 0.68, 0], [0.42, 0.65, 0.28]); // upper torso
      addCone(builder, [0, 0.30, 0], 0.44, 0.60, 8); // flared robe skirt
      addBox(builder, [0, 1.18, 0], [0.28, 0.28, 0.28]); // head
      addCylinder(builder, [0, 1.34, 0], 0.38, 0.05, 10); // hat brim
      addCone(builder, [0, 1.62, 0], 0.26, 0.55, 6); // pointed hat cone
      addBox(builder, [-0.28, 0.65, 0], [0.12, 0.55, 0.12]);
      addBox(builder, [0.28, 0.65, 0], [0.12, 0.55, 0.12]);
      addCylinder(builder, [0.36, 0.70, 0.22], 0.04, 1.4, 6); // staff
      addBox(builder, [0.36, 1.45, 0.22], [0.12, 0.12, 0.12]); // staff orb
    } else if (name === "Archer") {
      // Feathered cap, leather vest, back quiver with arrows, bow
      addBox(builder, [0, 0.60, 0], [0.40, 0.70, 0.28]); // torso
      addBox(builder, [0, 1.18, 0], [0.28, 0.28, 0.28]); // head
      addBox(builder, [0, 1.35, 0], [0.32, 0.10, 0.32]); // cap
      addPyramid(builder, [0.12, 1.48, 0], [0.08, 0.24, 0.14], 3); // feather
      addBox(builder, [-0.08, 0.72, -0.20], [0.14, 0.55, 0.14]); // quiver on back
      addBox(builder, [-0.28, 0.60, 0], [0.12, 0.58, 0.12]);
      addBox(builder, [0.28, 0.60, 0], [0.12, 0.58, 0.12]);
      addBox(builder, [-0.34, 0.60, 0.20], [0.06, 0.95, 0.14]); // bow
      addBox(builder, [-0.14, 0.15, 0], [0.14, 0.55, 0.14]);
      addBox(builder, [0.14, 0.15, 0], [0.14, 0.55, 0.14]);
    } else if (name === "Barbarian") {
      // Brawny bare torso with crossed battle straps, horned helm, war kilt, heavy axe
      addBox(builder, [0, 0.68, 0], [0.52, 0.72, 0.34]); // broad torso
      addBox(builder, [0, 1.25, 0], [0.30, 0.30, 0.30]); // head
      addPyramid(builder, [-0.20, 1.42, 0], [0.08, 0.28, 0.08], 3); // horn left
      addPyramid(builder, [0.20, 1.42, 0], [0.08, 0.28, 0.08], 3); // horn right
      addBox(builder, [-0.36, 0.65, 0], [0.18, 0.60, 0.18]); // muscular arms
      addBox(builder, [0.36, 0.65, 0], [0.18, 0.60, 0.18]);
      addBox(builder, [0.42, 0.72, 0.25], [0.06, 1.1, 0.06]); // axe haft
      addBox(builder, [0.42, 1.20, 0.32], [0.08, 0.35, 0.24]); // axe blade
      addBox(builder, [-0.16, 0.15, 0], [0.16, 0.55, 0.16]);
      addBox(builder, [0.16, 0.15, 0], [0.16, 0.55, 0.16]);
    } else if (name === "Guard") {
      // Town guard: kettle helm, heraldic breastplate, upright halberd
      addBox(builder, [0, 0.64, 0], [0.44, 0.70, 0.30]); // cuirass
      addBox(builder, [0, 1.20, 0], [0.28, 0.28, 0.28]); // head
      addCylinder(builder, [0, 1.34, 0], 0.34, 0.06, 8); // kettle helm brim
      addPyramid(builder, [0, 1.44, 0], [0.26, 0.16, 0.26], 4);
      addBox(builder, [-0.28, 0.60, 0], [0.14, 0.55, 0.14]);
      addBox(builder, [0.28, 0.60, 0], [0.14, 0.55, 0.14]);
      addCylinder(builder, [0.36, 0.90, 0.15], 0.04, 1.8, 6); // halberd shaft
      addBox(builder, [0.36, 1.70, 0.22], [0.06, 0.32, 0.24]); // halberd head
      addBox(builder, [-0.14, 0.15, 0], [0.15, 0.55, 0.15]);
      addBox(builder, [0.14, 0.15, 0], [0.15, 0.55, 0.15]);
    } else if (name === "Merchant") {
      // Tricorn/feathered cap, decorative doublet, large trade satchel
      addBox(builder, [0, 0.62, 0], [0.42, 0.68, 0.30]);
      addBox(builder, [0, 1.18, 0], [0.28, 0.28, 0.28]);
      addBox(builder, [0, 1.35, 0], [0.36, 0.10, 0.36]); // cap
      addBox(builder, [0.28, 0.55, 0.18], [0.24, 0.28, 0.18]); // large merchant pack/satchel
      addBox(builder, [-0.26, 0.58, 0], [0.12, 0.55, 0.12]);
      addBox(builder, [0.26, 0.58, 0], [0.12, 0.55, 0.12]);
      addBox(builder, [-0.14, 0.15, 0], [0.14, 0.55, 0.14]);
      addBox(builder, [0.14, 0.15, 0], [0.14, 0.55, 0.14]);
    } else if (name === "Innkeeper") {
      // Rolled sleeves, serving apron, holding wooden tankard
      addBox(builder, [0, 0.60, 0], [0.44, 0.68, 0.32]); // torso
      addBox(builder, [0, 0.52, 0.18], [0.36, 0.55, 0.06]); // front apron
      addBox(builder, [0, 1.18, 0], [0.28, 0.28, 0.28]); // head
      addBox(builder, [-0.28, 0.60, 0], [0.14, 0.55, 0.14]);
      addBox(builder, [0.28, 0.60, 0.10], [0.14, 0.55, 0.14]);
      addCylinder(builder, [0.28, 0.72, 0.32], 0.10, 0.22, 8); // ale tankard
      addBox(builder, [-0.14, 0.15, 0], [0.14, 0.55, 0.14]);
      addBox(builder, [0.14, 0.15, 0], [0.14, 0.55, 0.14]);
    } else if (name === "VillagerFemale") {
      // Peasant dress, laced bodice, wide skirt bell
      addBox(builder, [0, 0.72, 0], [0.36, 0.50, 0.26]); // bodice
      addCone(builder, [0, 0.28, 0], 0.46, 0.65, 8); // bell skirt
      addBox(builder, [0, 1.18, 0], [0.26, 0.26, 0.26]); // head
      addBox(builder, [-0.25, 0.65, 0], [0.10, 0.55, 0.10]);
      addBox(builder, [0.25, 0.65, 0], [0.10, 0.55, 0.10]);
    } else {
      // VillagerMale / Rogue
      addBox(builder, [0, 0.60, 0], [0.38, 0.70, 0.28]);
      addBox(builder, [0, 1.18, 0], [0.28, 0.28, 0.28]);
      if (name === "Rogue") {
        addCone(builder, [0, 1.38, -0.05], 0.24, 0.25, 5); // cowl peak
        addBox(builder, [-0.25, 0.42, 0.15], [0.06, 0.30, 0.08]); // dagger left
        addBox(builder, [0.25, 0.42, 0.15], [0.06, 0.30, 0.08]); // dagger right
      }
      addBox(builder, [-0.26, 0.58, 0], [0.12, 0.55, 0.12]);
      addBox(builder, [0.26, 0.58, 0], [0.12, 0.55, 0.12]);
      addBox(builder, [-0.13, 0.15, 0], [0.14, 0.55, 0.14]);
      addBox(builder, [0.13, 0.15, 0], [0.14, 0.55, 0.14]);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PROPS PACK
  // ───────────────────────────────────────────────────────────────────────────
  else if (pack === "props") {
    if (name === "Anvil") {
      addBox(builder, [0, 0.16, 0], [0.55, 0.32, 0.42]); // heavy base
      addBox(builder, [0, 0.38, 0], [0.36, 0.16, 0.26]); // waist
      addBox(builder, [-0.10, 0.52, 0], [0.65, 0.16, 0.28]); // striking table
      addCone(builder, [0.38, 0.52, 0], 0.14, 0.38, 5); // anvil horn
    } else if (name === "MarketStall") {
      // 4 wooden posts, display counter, and pitched fabric canopy
      addBox(builder, [0, 0.45, 0], [1.3, 0.70, 0.75]); // vendor counter
      // 4 posts
      addBox(builder, [-0.62, 1.05, -0.35], [0.08, 1.4, 0.08]);
      addBox(builder, [0.62, 1.05, -0.35], [0.08, 1.4, 0.08]);
      addBox(builder, [-0.62, 1.05, 0.35], [0.08, 1.4, 0.08]);
      addBox(builder, [0.62, 1.05, 0.35], [0.08, 1.4, 0.08]);
      // pitched striped fabric canopy
      addPyramid(builder, [0, 1.85, 0], [1.5, 0.35, 1.0], 4);
    } else if (name === "Bookshelf") {
      // Sturdy uprights, backboard, shelves, and book rows
      addBox(builder, [0, 0.95, -0.22], [0.95, 1.8, 0.06]); // backboard
      addBox(builder, [-0.44, 0.95, 0], [0.08, 1.8, 0.45]); // left side
      addBox(builder, [0.44, 0.95, 0], [0.08, 1.8, 0.45]); // right side
      addBox(builder, [0, 0.10, 0], [0.95, 0.08, 0.45]); // shelves
      addBox(builder, [0, 0.65, 0], [0.95, 0.08, 0.45]);
      addBox(builder, [0, 1.25, 0], [0.95, 0.08, 0.45]);
      addBox(builder, [0, 1.85, 0], [0.95, 0.08, 0.45]);
      // Books on shelf
      addBox(builder, [-0.15, 0.38, 0.05], [0.45, 0.35, 0.28]);
      addBox(builder, [0.15, 0.95, 0.05], [0.42, 0.35, 0.28]);
    } else if (name === "Bed") {
      addBox(builder, [0, 0.24, 0], [1.1, 0.28, 1.6]); // bed frame & mattress
      addBox(builder, [0, 0.58, -0.78], [1.1, 0.70, 0.10]); // headboard
      addBox(builder, [0, 0.42, 0.78], [1.1, 0.45, 0.10]); // footboard
      addBox(builder, [0, 0.44, -0.55], [0.75, 0.12, 0.32]); // pillow
      addBox(builder, [0, 0.40, 0.15], [1.05, 0.08, 0.95]); // folded quilt
    } else if (name === "Bench") {
      addBox(builder, [0, 0.42, 0], [1.2, 0.08, 0.45]); // seat plank
      addBox(builder, [0, 0.82, -0.20], [1.2, 0.50, 0.06]); // backrest
      addBox(builder, [-0.52, 0.21, 0], [0.08, 0.42, 0.38]); // legs
      addBox(builder, [0.52, 0.21, 0], [0.08, 0.42, 0.38]);
    } else if (name === "SignPost") {
      addCylinder(builder, [0, 0.95, 0], 0.08, 1.9, 6); // post
      addBox(builder, [0.26, 1.65, 0], [0.55, 0.18, 0.04]); // sign 1
      addBox(builder, [-0.22, 1.35, 0.04], [0.48, 0.18, 0.04]); // sign 2
    } else if (name === "Well") {
      addCylinder(builder, [0, 0.45, 0], 0.65, 0.9, 12); // circular well curb
      addBox(builder, [-0.52, 1.25, 0], [0.10, 1.4, 0.10]); // post 1
      addBox(builder, [0.52, 1.25, 0], [0.10, 1.4, 0.10]); // post 2
      addPyramid(builder, [0, 1.95, 0], [1.3, 0.35, 1.1], 4); // shingle roof
    } else if (name === "Fountain") {
      addCylinder(builder, [0, 0.22, 0], 0.95, 0.44, 12); // lower basin
      addCylinder(builder, [0, 0.65, 0], 0.32, 0.52, 8); // central column
      addCylinder(builder, [0, 0.95, 0], 0.55, 0.18, 10); // upper spillway
    } else if (name === "Chest") {
      addBox(builder, [0, 0.24, 0], [0.75, 0.46, 0.48]); // chest body
      addBox(builder, [0, 0.52, 0], [0.78, 0.14, 0.50]); // lid
      addBox(builder, [0, 0.38, 0.26], [0.12, 0.14, 0.04]); // latch
    } else if (name === "Barrel") {
      addCylinder(builder, [0, 0.55, 0], 0.46, 1.1, 12);
      addCylinder(builder, [0, 0.55, 0], 0.49, 0.12, 12); // iron mid hoop
      addCylinder(builder, [0, 0.88, 0], 0.47, 0.08, 12); // top hoop
      addCylinder(builder, [0, 0.22, 0], 0.47, 0.08, 12); // bottom hoop
    } else if (name === "Lantern") {
      addBox(builder, [0, 0.42, 0], [0.28, 0.42, 0.28]); // lantern cage
      addPyramid(builder, [0, 0.72, 0], [0.36, 0.20, 0.36], 4); // top hood
    } else if (name === "Cauldron") {
      addCylinder(builder, [0, 0.42, 0], 0.50, 0.68, 12);
      addCylinder(builder, [0, 0.74, 0], 0.54, 0.08, 12); // rim
      // 3 tripod feet
      for (let i = 0; i < 3; i++) {
        const a = (Math.PI * 2 * i) / 3;
        addBox(builder, [Math.cos(a) * 0.38, 0.08, Math.sin(a) * 0.38], [0.10, 0.18, 0.10]);
      }
    } else if (name === "Altar") {
      addBox(builder, [0, 0.15, 0], [1.2, 0.30, 0.85]); // lower plinth
      addBox(builder, [0, 0.45, 0], [1.0, 0.36, 0.68]); // upper altar slab
      addBox(builder, [0, 0.64, 0], [0.65, 0.06, 0.38]); // ritual basin
    } else if (name.includes("Flag") || name.includes("Banner")) {
      addCylinder(builder, [0, 1.1, 0], 0.06, 2.2, 6);
      addBox(builder, [0.35, 1.6, 0], [0.65, 0.95, 0.04]);
    } else if (name === "Table") {
      addBox(builder, [0, 0.72, 0], [1.2, 0.10, 0.8]);
      addBox(builder, [-0.5, 0.34, -0.3], [0.1, 0.68, 0.1]);
      addBox(builder, [0.5, 0.34, -0.3], [0.1, 0.68, 0.1]);
      addBox(builder, [-0.5, 0.34, 0.3], [0.1, 0.68, 0.1]);
      addBox(builder, [0.5, 0.34, 0.3], [0.1, 0.68, 0.1]);
    } else if (name === "Chair") {
      addBox(builder, [0, 0.44, 0], [0.48, 0.08, 0.48]);
      addBox(builder, [0, 0.84, -0.2], [0.48, 0.72, 0.08]);
      addBox(builder, [-0.2, 0.2, -0.2], [0.08, 0.4, 0.08]);
      addBox(builder, [0.2, 0.2, -0.2], [0.08, 0.4, 0.08]);
      addBox(builder, [-0.2, 0.2, 0.2], [0.08, 0.4, 0.08]);
      addBox(builder, [0.2, 0.2, 0.2], [0.08, 0.4, 0.08]);
    } else {
      // Crate / Shelf / Forge
      addBox(builder, [0, 0.5, 0], [0.85, 0.95, 0.85]);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // OUTFITS PACK
  // ───────────────────────────────────────────────────────────────────────────
  else if (pack === "outfits") {
    if (name.includes("ShieldTower")) {
      addBox(builder, [0, 0.65, 0], [0.55, 1.25, 0.08]); // rectangular tower shield
      addBox(builder, [0, 0.65, 0.06], [0.18, 0.18, 0.04]); // shield boss
    } else if (name.includes("Shield")) {
      addCylinder(builder, [0, 0.65, 0], 0.45, 0.08, 12); // round buckler
      addCone(builder, [0, 0.65, 0.06], 0.15, 0.12, 8); // central boss
    } else if (name.includes("HelmetHeavy")) {
      addBox(builder, [0, 0.75, 0], [0.44, 0.48, 0.44]); // great helm
      addPyramid(builder, [0, 1.05, 0], [0.46, 0.20, 0.46], 4);
    } else if (name.includes("HelmetMage")) {
      addCylinder(builder, [0, 0.70, 0], 0.48, 0.05, 10); // brim
      addCone(builder, [0, 1.05, 0], 0.32, 0.65, 6); // pointed cone
    } else if (name.includes("HelmetLight")) {
      addBox(builder, [0, 0.75, 0], [0.40, 0.40, 0.40]);
      addBox(builder, [0, 0.65, 0.22], [0.08, 0.22, 0.06]); // noseguard
    } else if (name.includes("Cloak")) {
      addBox(builder, [0, 0.65, 0], [0.65, 1.15, 0.08]);
    } else {
      addBox(builder, [0, 0.55, 0], [0.64, 0.95, 0.30]);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ANIMATIONS PACK
  // ───────────────────────────────────────────────────────────────────────────
  else {
    // Dynamic pose geometry reflecting specific animation states
    if (name === "Death") {
      // Fallen prone pose
      addBox(builder, [0, 0.15, 0], [0.38, 0.22, 0.95]); // prone torso
      addBox(builder, [0, 0.18, 0.65], [0.26, 0.24, 0.26]); // head on ground
      addBox(builder, [-0.14, 0.12, -0.65], [0.12, 0.14, 0.65]); // legs
      addBox(builder, [0.14, 0.12, -0.65], [0.12, 0.14, 0.65]);
    } else if (name === "Sit") {
      // Seated pose
      addBox(builder, [0, 0.65, -0.15], [0.38, 0.70, 0.26]); // seated torso
      addBox(builder, [0, 1.15, -0.15], [0.28, 0.28, 0.28]); // head
      addBox(builder, [-0.12, 0.32, 0.20], [0.14, 0.14, 0.55]); // bent forward thighs
      addBox(builder, [0.12, 0.32, 0.20], [0.14, 0.14, 0.55]);
      addBox(builder, [-0.12, 0.12, 0.45], [0.12, 0.32, 0.12]); // vertical calves
      addBox(builder, [0.12, 0.12, 0.45], [0.12, 0.32, 0.12]);
    } else if (name === "AttackMelee") {
      // Raised right arm striking forward
      addBox(builder, [0, 0.55, 0], [0.38, 0.88, 0.26]);
      addBox(builder, [0, 1.15, 0], [0.28, 0.28, 0.28]);
      addBox(builder, [-0.28, 0.55, 0], [0.14, 0.64, 0.14]);
      addBox(builder, [0.32, 0.90, 0.25], [0.14, 0.64, 0.14]); // raised striking arm
      addBox(builder, [-0.12, -0.05, 0], [0.14, 0.62, 0.14]);
      addBox(builder, [0.12, -0.05, 0], [0.14, 0.62, 0.14]);
    } else if (name === "Block") {
      // Defensive guard stance
      addBox(builder, [0, 0.55, 0], [0.38, 0.88, 0.26]);
      addBox(builder, [0, 1.15, 0], [0.28, 0.28, 0.28]);
      addBox(builder, [-0.15, 0.70, 0.28], [0.42, 0.14, 0.14]); // crossed guard arms
      addBox(builder, [-0.12, -0.05, 0], [0.14, 0.62, 0.14]);
      addBox(builder, [0.12, -0.05, 0], [0.14, 0.62, 0.14]);
    } else {
      // Default standing locomotion pose (Idle, Walk, Run, Cast, etc.)
      addBox(builder, [0, 0.55, 0], [0.38, 0.88, 0.26]);
      addBox(builder, [0, 1.15, 0], [0.28, 0.28, 0.28]);
      addBox(builder, [-0.28, 0.55, 0], [0.14, 0.64, 0.14]);
      addBox(builder, [0.28, 0.55, 0], [0.14, 0.64, 0.14]);
      addBox(builder, [-0.12, -0.05, 0], [0.14, 0.62, 0.14]);
      addBox(builder, [0.12, -0.05, 0], [0.14, 0.62, 0.14]);
    }
  }

  return builder;
}

function pad4(buffer, byte = 0) {
  const pad = (4 - (buffer.length % 4)) % 4;
  return pad === 0 ? buffer : Buffer.concat([buffer, Buffer.alloc(pad, byte)]);
}

function floatBuffer(values) {
  const buffer = Buffer.alloc(values.length * 4);
  values.forEach((value, index) => buffer.writeFloatLE(value, index * 4));
  return buffer;
}

function uint16Buffer(values) {
  const buffer = Buffer.alloc(values.length * 2);
  values.forEach((value, index) => buffer.writeUInt16LE(value, index * 2));
  return buffer;
}

function minMaxPositions(values) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < values.length; i += 3) {
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], values[i + axis]);
      max[axis] = Math.max(max[axis], values[i + axis]);
    }
  }
  return { min, max };
}

function makeGlb(pack, name) {
  const geometry = createGeometry(pack, name);
  const positions = pad4(floatBuffer(geometry.positions));
  const normals = pad4(floatBuffer(geometry.normals));
  const indices = pad4(uint16Buffer(geometry.indices));
  const bin = Buffer.concat([positions, normals, indices]);
  const bounds = minMaxPositions(geometry.positions);
  const mat = getMaterial(pack, name);

  const positionOffset = 0;
  const normalOffset = positions.length;
  const indexOffset = positions.length + normals.length;
  const json = {
    asset: { version: "2.0", generator: "Camelot polished filler asset generator v3" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: `filler_${name}`, mesh: 0 }],
    meshes: [{
      name,
      primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 }],
    }],
    materials: [{
      name: `${pack}_${name}_material`,
      pbrMetallicRoughness: {
        baseColorFactor: mat.color,
        metallicFactor: mat.metallic,
        roughnessFactor: mat.roughness,
      },
    }],
    buffers: [{ byteLength: bin.length }],
    bufferViews: [
      { buffer: 0, byteOffset: positionOffset, byteLength: positions.length, target: 34962 },
      { buffer: 0, byteOffset: normalOffset, byteLength: normals.length, target: 34962 },
      { buffer: 0, byteOffset: indexOffset, byteLength: indices.length, target: 34963 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: geometry.positions.length / 3, type: "VEC3", min: bounds.min, max: bounds.max },
      { bufferView: 1, componentType: 5126, count: geometry.normals.length / 3, type: "VEC3" },
      { bufferView: 2, componentType: 5123, count: geometry.indices.length, type: "SCALAR" },
    ],
  };

  const jsonChunk = pad4(Buffer.from(JSON.stringify(json)), 0x20);
  const totalLength = 12 + 8 + jsonChunk.length + 8 + bin.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);

  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonChunk.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);

  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(bin.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);

  return Buffer.concat([header, jsonHeader, jsonChunk, binHeader, bin]);
}

async function main() {
  const written = [];

  for (const [pack, names] of Object.entries(packs)) {
    const dir = path.join(outRoot, pack);
    await mkdir(dir, { recursive: true });
    for (const name of names) {
      const file = path.join(dir, `${name}.glb`);
      await writeFile(file, makeGlb(pack, name));
      written.push(path.relative(root, file).replaceAll("\\", "/"));
    }
  }

  await writeFile(
    path.join(outRoot, "filler-assets-manifest.json"),
    JSON.stringify({
      generator: "tools/generate-filler-assets.mjs",
      note: "Polished low-poly stylized placeholder GLBs for Quaternius CC0 catalogue slots.",
      files: written,
    }, null, 2) + "\n",
  );

  console.log(`Generated ${written.length} polished low-poly GLB assets in ${path.relative(root, outRoot)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
