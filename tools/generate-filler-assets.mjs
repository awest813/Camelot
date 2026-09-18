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
    if (name === "Anvil") return { color: [0.22, 0.23, 0.26, 1], metallic: 0.82, roughness: 0.32 };
    if (name === "Cauldron") return { color: [0.18, 0.18, 0.20, 1], metallic: 0.72, roughness: 0.40 };
    if (name === "Altar") return { color: [0.65, 0.63, 0.58, 1], metallic: 0.05, roughness: 0.90 };
    if (name === "Well" || name === "Fountain") return { color: [0.58, 0.57, 0.54, 1], metallic: 0.05, roughness: 0.85 };
    if (name === "Lantern") return { color: [0.86, 0.74, 0.30, 1], metallic: 0.75, roughness: 0.28 };
    if (name === "Flag" || name === "BannerStand") return { color: [0.74, 0.16, 0.18, 1], metallic: 0.05, roughness: 0.85 };
    if (name === "MarketStall") return { color: [0.78, 0.32, 0.22, 1], metallic: 0.05, roughness: 0.88 };
    if (name === "Chest") return { color: [0.46, 0.28, 0.14, 1], metallic: 0.25, roughness: 0.60 };
    if (name === "Barrel") return { color: [0.52, 0.34, 0.16, 1], metallic: 0.15, roughness: 0.75 };
    if (name === "Crate") return { color: [0.66, 0.52, 0.32, 1], metallic: 0.02, roughness: 0.85 };
    if (name === "Forge") return { color: [0.28, 0.26, 0.28, 1], metallic: 0.20, roughness: 0.80 };
    return { color: [0.50, 0.32, 0.16, 1], metallic: 0.05, roughness: 0.80 };
  }

  if (pack === "nature") {
    if (name === "FlowerRed") return { color: [0.88, 0.18, 0.24, 1], metallic: 0.0, roughness: 0.55 };
    if (name === "FlowerBlue") return { color: [0.22, 0.48, 0.92, 1], metallic: 0.0, roughness: 0.55 };
    if (name === "Mushroom") return { color: [0.80, 0.18, 0.16, 1], metallic: 0.0, roughness: 0.65 };
    if (name.includes("Rock")) return { color: [0.52, 0.50, 0.48, 1], metallic: 0.05, roughness: 0.92 };
    if (name.includes("Log") || name === "Stump") return { color: [0.42, 0.28, 0.14, 1], metallic: 0.02, roughness: 0.85 };
    if (name === "DeadTree") return { color: [0.44, 0.40, 0.36, 1], metallic: 0.02, roughness: 0.90 };
    if (name.includes("Tree")) return { color: [0.18, 0.44, 0.16, 1], metallic: 0.02, roughness: 0.85 };
    if (name === "Fern" || name === "GrassClump") return { color: [0.28, 0.60, 0.22, 1], metallic: 0.0, roughness: 0.80 };
    return { color: [0.22, 0.50, 0.18, 1], metallic: 0.02, roughness: 0.85 };
  }

  if (pack === "characters") {
    if (name === "Knight") return { color: [0.74, 0.76, 0.80, 1], metallic: 0.75, roughness: 0.35 };
    if (name === "Guard") return { color: [0.42, 0.48, 0.62, 1], metallic: 0.45, roughness: 0.50 };
    if (name === "Mage") return { color: [0.24, 0.26, 0.62, 1], metallic: 0.05, roughness: 0.80 };
    if (name === "Rogue") return { color: [0.22, 0.20, 0.20, 1], metallic: 0.15, roughness: 0.65 };
    if (name === "Archer") return { color: [0.36, 0.48, 0.26, 1], metallic: 0.05, roughness: 0.80 };
    if (name === "Barbarian") return { color: [0.58, 0.38, 0.22, 1], metallic: 0.10, roughness: 0.85 };
    if (name === "Merchant") return { color: [0.62, 0.22, 0.38, 1], metallic: 0.12, roughness: 0.70 };
    if (name === "Innkeeper") return { color: [0.55, 0.48, 0.34, 1], metallic: 0.02, roughness: 0.85 };
    return { color: [0.60, 0.52, 0.42, 1], metallic: 0.02, roughness: 0.85 };
  }

  if (pack === "monsters") {
    if (name === "Skeleton") return { color: [0.86, 0.84, 0.76, 1], metallic: 0.05, roughness: 0.75 };
    if (name === "Spider") return { color: [0.16, 0.14, 0.16, 1], metallic: 0.25, roughness: 0.50 };
    if (name === "Slime") return { color: [0.22, 0.88, 0.38, 0.85], metallic: 0.08, roughness: 0.22 };
    if (name === "Goblin") return { color: [0.36, 0.56, 0.22, 1], metallic: 0.05, roughness: 0.80 };
    if (name === "Orc") return { color: [0.28, 0.44, 0.24, 1], metallic: 0.12, roughness: 0.75 };
    if (name === "Troll") return { color: [0.42, 0.44, 0.40, 1], metallic: 0.05, roughness: 0.95 };
    if (name === "DragonSmall") return { color: [0.78, 0.18, 0.16, 1], metallic: 0.35, roughness: 0.45 };
    if (name === "Wolf") return { color: [0.45, 0.42, 0.40, 1], metallic: 0.02, roughness: 0.90 };
    if (name === "Bat") return { color: [0.22, 0.18, 0.20, 1], metallic: 0.05, roughness: 0.85 };
    if (name === "Ghost") return { color: [0.68, 0.88, 0.98, 0.70], metallic: 0.00, roughness: 0.30 };
    return { color: [0.42, 0.34, 0.48, 1], metallic: 0.05, roughness: 0.80 };
  }

  if (pack === "outfits") {
    if (name.includes("Heavy") || name === "ShieldTower") return { color: [0.76, 0.78, 0.82, 1], metallic: 0.80, roughness: 0.30 };
    if (name.includes("Mage") || name.includes("Robe")) return { color: [0.26, 0.24, 0.56, 1], metallic: 0.02, roughness: 0.85 };
    if (name.includes("Cloak")) return { color: [0.65, 0.16, 0.20, 1], metallic: 0.02, roughness: 0.85 };
    if (name === "Shield") return { color: [0.48, 0.36, 0.24, 1], metallic: 0.35, roughness: 0.60 };
    return { color: [0.46, 0.32, 0.18, 1], metallic: 0.05, roughness: 0.75 };
  }

  return { color: [0.28, 0.46, 0.74, 1], metallic: 0.10, roughness: 0.70 };
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

  // Base
  const baseStart = builder.positions.length / 3;
  for (let i = 0; i < sides; i++) {
    builder.positions.push(...baseVerts[i]);
    builder.normals.push(0, -1, 0);
  }
  for (let i = 1; i < sides - 1; i++) {
    builder.indices.push(baseStart, baseStart + i + 1, baseStart + i);
  }

  // Sides
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

  // Side faces
  for (let i = 0; i < sides; i++) {
    const a0 = (Math.PI * 2 * i) / sides;
    const a1 = (Math.PI * 2 * (i + 1)) / sides;
    const p0 = [cx + Math.cos(a0) * radius, y0, cz + Math.sin(a0) * radius];
    const p1 = [cx + Math.cos(a1) * radius, y0, cz + Math.sin(a1) * radius];
    const p2 = [cx + Math.cos(a1) * radius, y1, cz + Math.sin(a1) * radius];
    const p3 = [cx + Math.cos(a0) * radius, y1, cz + Math.sin(a0) * radius];
    addFace(builder, [p0, p1, p2, p3], [Math.cos((a0 + a1) / 2), 0, Math.sin((a0 + a1) / 2)]);
  }

  // Top cap
  const topStart = builder.positions.length / 3;
  for (let i = 0; i < sides; i++) {
    const a = (Math.PI * 2 * i) / sides;
    builder.positions.push(cx + Math.cos(a) * radius, y1, cz + Math.sin(a) * radius);
    builder.normals.push(0, 1, 0);
  }
  for (let i = 1; i < sides - 1; i++) {
    builder.indices.push(topStart, topStart + i, topStart + i + 1);
  }

  // Bottom cap
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

function createGeometry(pack, name) {
  const builder = makeBuilder();

  if (pack === "nature") {
    if (name.includes("Rock")) {
      const scale = name.includes("Large") ? 1.4 : name.includes("Medium") ? 0.95 : 0.6;
      addPyramid(builder, [0, 0.4 * scale, 0], [1.1 * scale, 0.8 * scale, 0.95 * scale], 6);
      addBox(builder, [0, 0.2 * scale, 0], [1.0 * scale, 0.4 * scale, 0.9 * scale]);
    } else if (name.includes("Flower")) {
      addCylinder(builder, [0, 0.22, 0], 0.03, 0.44, 6);
      addPyramid(builder, [0, 0.48, 0], [0.36, 0.16, 0.36], 5);
    } else if (name === "Mushroom") {
      addCylinder(builder, [0, 0.28, 0], 0.12, 0.56, 8);
      addCylinder(builder, [0, 0.58, 0], 0.42, 0.16, 10);
      addPyramid(builder, [0, 0.72, 0], [0.55, 0.22, 0.55], 8);
    } else if (name === "Fern" || name === "GrassClump") {
      addCylinder(builder, [0, 0.15, 0], 0.05, 0.3, 6);
      addPyramid(builder, [0, 0.55, 0], [0.75, 0.70, 0.75], 5);
    } else if (name.includes("Tree") || name === "Stump" || name.includes("Log")) {
      if (name === "Stump") {
        addCylinder(builder, [0, 0.35, 0], 0.42, 0.7, 10);
      } else if (name.includes("Log")) {
        addCylinder(builder, [0, 0.32, 0], 0.26, 1.6, 10);
      } else if (name === "DeadTree") {
        addCylinder(builder, [0, 1.1, 0], 0.18, 2.2, 8);
        addBox(builder, [0.35, 1.4, 0], [0.65, 0.12, 0.12]);
        addBox(builder, [-0.32, 1.7, 0.1], [0.55, 0.12, 0.12]);
      } else {
        addCylinder(builder, [0, 0.75, 0], 0.22, 1.5, 8);
        addPyramid(builder, [0, 1.8, 0], [1.6, 1.3, 1.6], 6);
        addPyramid(builder, [0, 2.6, 0], [1.2, 1.1, 1.2], 6);
      }
    } else {
      const sz = name.includes("Large") ? 1.1 : 0.7;
      addBox(builder, [0, 0.35 * sz, 0], [1.1 * sz, 0.7 * sz, 0.95 * sz]);
      addPyramid(builder, [0, 0.85 * sz, 0], [1.2 * sz, 0.8 * sz, 1.05 * sz], 6);
    }
  } else if (pack === "props") {
    if (name === "Anvil") {
      addBox(builder, [0, 0.18, 0], [0.46, 0.36, 0.36]);
      addBox(builder, [0, 0.44, 0], [0.72, 0.20, 0.28]);
      addPyramid(builder, [0.44, 0.44, 0], [0.24, 0.18, 0.24], 4);
    } else if (name === "Chest") {
      addBox(builder, [0, 0.24, 0], [0.72, 0.46, 0.46]);
      addBox(builder, [0, 0.52, 0], [0.75, 0.14, 0.48]);
    } else if (name === "Altar") {
      addBox(builder, [0, 0.16, 0], [1.1, 0.32, 0.76]);
      addBox(builder, [0, 0.46, 0], [0.94, 0.34, 0.62]);
    } else if (name === "Well") {
      addCylinder(builder, [0, 0.45, 0], 0.58, 0.9, 12);
      addBox(builder, [-0.46, 1.1, 0], [0.1, 1.2, 0.1]);
      addBox(builder, [0.46, 1.1, 0], [0.1, 1.2, 0.1]);
      addBox(builder, [0, 1.7, 0], [1.1, 0.14, 0.6]);
    } else if (name === "Fountain") {
      addCylinder(builder, [0, 0.22, 0], 0.85, 0.44, 12);
      addCylinder(builder, [0, 0.65, 0], 0.32, 0.50, 8);
    } else if (name === "Lantern") {
      addCylinder(builder, [0, 0.45, 0], 0.18, 0.55, 6);
      addPyramid(builder, [0, 0.78, 0], [0.42, 0.20, 0.42], 6);
    } else if (name.includes("Flag") || name.includes("Banner")) {
      addCylinder(builder, [0, 1.0, 0], 0.05, 2.0, 6);
      addBox(builder, [0.28, 1.45, 0], [0.55, 0.85, 0.04]);
    } else if (name === "Cauldron") {
      addCylinder(builder, [0, 0.42, 0], 0.48, 0.72, 10);
      addBox(builder, [-0.35, 0.08, 0], [0.1, 0.2, 0.1]);
      addBox(builder, [0.35, 0.08, 0], [0.1, 0.2, 0.1]);
    } else if (name === "Barrel") {
      addCylinder(builder, [0, 0.55, 0], 0.44, 1.1, 12);
    } else if (name === "Table") {
      addBox(builder, [0, 0.72, 0], [1.2, 0.12, 0.8]);
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
      addBox(builder, [0, 0.5, 0], [0.85, 0.95, 0.85]);
    }
  } else if (pack === "monsters") {
    if (name === "DragonSmall") {
      addBox(builder, [0, 0.48, 0], [0.46, 0.38, 0.82]);
      addBox(builder, [0, 0.76, 0.48], [0.28, 0.28, 0.38]);
      addBox(builder, [-0.62, 0.65, 0.05], [0.78, 0.06, 0.52]);
      addBox(builder, [0.62, 0.65, 0.05], [0.78, 0.06, 0.52]);
      addBox(builder, [0, 0.34, -0.58], [0.16, 0.16, 0.55]);
    } else if (name === "Spider") {
      addBox(builder, [0, 0.26, 0.22], [0.55, 0.36, 0.62]);
      addBox(builder, [0, 0.22, -0.16], [0.38, 0.26, 0.32]);
      addBox(builder, [-0.44, 0.18, 0], [0.52, 0.08, 0.48]);
      addBox(builder, [0.44, 0.18, 0], [0.52, 0.08, 0.48]);
    } else if (name === "Slime") {
      addCylinder(builder, [0, 0.25, 0], 0.55, 0.45, 10);
      addPyramid(builder, [0, 0.55, 0], [0.75, 0.35, 0.75], 8);
    } else if (name === "Skeleton") {
      addBox(builder, [0, 0.72, 0], [0.34, 0.48, 0.22]);
      addBox(builder, [0, 1.15, 0], [0.24, 0.26, 0.24]);
      addBox(builder, [-0.14, 0.24, 0], [0.10, 0.52, 0.10]);
      addBox(builder, [0.14, 0.24, 0], [0.10, 0.52, 0.10]);
    } else {
      addBox(builder, [0, 0.65, 0], [0.52, 0.95, 0.38]);
      addBox(builder, [0, 1.25, 0], [0.36, 0.34, 0.34]);
      addBox(builder, [-0.36, 0.65, 0], [0.18, 0.68, 0.18]);
      addBox(builder, [0.36, 0.65, 0], [0.18, 0.68, 0.18]);
    }
  } else if (pack === "outfits") {
    if (name.includes("ShieldTower")) {
      addBox(builder, [0, 0.65, 0], [0.52, 1.2, 0.08]);
    } else if (name.includes("Shield")) {
      addCylinder(builder, [0, 0.65, 0], 0.48, 0.12, 12);
    } else if (name.includes("Helmet")) {
      addBox(builder, [0, 0.78, 0], [0.42, 0.42, 0.42]);
      addPyramid(builder, [0, 1.08, 0], [0.46, 0.24, 0.46], 4);
    } else if (name.includes("Cloak")) {
      addBox(builder, [0, 0.65, 0], [0.65, 1.15, 0.08]);
    } else {
      addBox(builder, [0, 0.55, 0], [0.64, 0.95, 0.30]);
    }
  } else {
    // characters & animations
    addBox(builder, [0, 0.55, 0], [0.38, 0.88, 0.26]);
    addBox(builder, [0, 1.15, 0], [0.28, 0.28, 0.28]);
    addBox(builder, [-0.28, 0.55, 0], [0.14, 0.64, 0.14]);
    addBox(builder, [0.28, 0.55, 0], [0.14, 0.64, 0.14]);
    addBox(builder, [-0.12, -0.05, 0], [0.14, 0.62, 0.14]);
    addBox(builder, [0.12, -0.05, 0], [0.14, 0.62, 0.14]);
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
    asset: { version: "2.0", generator: "Camelot filler asset generator v2" },
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
