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

const colors = {
  props: [0.55, 0.34, 0.18, 1],
  nature: [0.24, 0.48, 0.22, 1],
  characters: [0.52, 0.52, 0.58, 1],
  monsters: [0.42, 0.34, 0.48, 1],
  outfits: [0.36, 0.39, 0.44, 1],
  animations: [0.28, 0.44, 0.72, 1],
};

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

function addPyramid(builder, center, size) {
  const [cx, cy, cz] = center;
  const [sx, sy, sz] = size;
  const y0 = cy - sy / 2;
  const apex = [cx, cy + sy / 2, cz];
  const base = [
    [cx - sx / 2, y0, cz - sz / 2],
    [cx + sx / 2, y0, cz - sz / 2],
    [cx + sx / 2, y0, cz + sz / 2],
    [cx - sx / 2, y0, cz + sz / 2],
  ];
  addFace(builder, [base[3], base[2], base[1], base[0]], [0, -1, 0]);
  for (let i = 0; i < 4; i++) {
    const next = (i + 1) % 4;
    const start = builder.positions.length / 3;
    builder.positions.push(...base[i], ...base[next], ...apex);
    builder.normals.push(0, 0.65, -0.75, 0, 0.65, -0.75, 0, 0.65, -0.75);
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
}

function createGeometry(pack, name) {
  const builder = makeBuilder();

  if (pack === "nature") {
    if (name.includes("Rock")) addPyramid(builder, [0, 0.45, 0], [1.2, 0.9, 1.0]);
    else if (name.includes("Log")) addCylinder(builder, [0, 0.35, 0], 0.28, 1.45, 12);
    else if (name.includes("Flower") || name.includes("Fern") || name.includes("Grass")) {
      addBox(builder, [0, 0.28, 0], [0.16, 0.56, 0.16]);
      addPyramid(builder, [0, 0.72, 0], [0.9, 0.55, 0.9]);
    } else {
      addCylinder(builder, [0, 0.55, 0], 0.16, 1.1, 10);
      addPyramid(builder, [0, 1.45, 0], [1.15, 1.55, 1.15]);
    }
  } else if (pack === "characters" || pack === "monsters" || pack === "animations") {
    addBox(builder, [0, 0.55, 0], [0.38, 1.1, 0.26]);
    addBox(builder, [0, 1.25, 0], [0.32, 0.32, 0.32]);
    addBox(builder, [-0.32, 0.62, 0], [0.16, 0.72, 0.16]);
    addBox(builder, [0.32, 0.62, 0], [0.16, 0.72, 0.16]);
    addBox(builder, [-0.12, -0.18, 0], [0.16, 0.64, 0.16]);
    addBox(builder, [0.12, -0.18, 0], [0.16, 0.64, 0.16]);
  } else if (pack === "outfits") {
    if (name.includes("Shield")) addCylinder(builder, [0, 0.65, 0], 0.55, 0.16, 16);
    else if (name.includes("Helmet")) addPyramid(builder, [0, 0.8, 0], [0.9, 0.7, 0.9]);
    else if (name.includes("Cloak")) addBox(builder, [0, 0.55, 0], [0.85, 1.2, 0.12]);
    else addBox(builder, [0, 0.55, 0], [0.72, 1.1, 0.32]);
  } else {
    if (name.includes("Barrel") || name.includes("Cauldron") || name.includes("Well") || name.includes("Fountain")) {
      addCylinder(builder, [0, 0.55, 0], 0.45, 1.1, 14);
    } else if (name.includes("Sign") || name.includes("Flag") || name.includes("Banner")) {
      addBox(builder, [0, 0.75, 0], [0.12, 1.5, 0.12]);
      addBox(builder, [0.38, 1.1, 0], [0.72, 0.46, 0.08]);
    } else {
      addBox(builder, [0, 0.5, 0], [1, 1, 1]);
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

  const positionOffset = 0;
  const normalOffset = positions.length;
  const indexOffset = positions.length + normals.length;
  const json = {
    asset: { version: "2.0", generator: "Camelot filler asset generator" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: `filler_${name}`, mesh: 0 }],
    meshes: [{
      name,
      primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 }],
    }],
    materials: [{
      name: `${pack}_filler_material`,
      pbrMetallicRoughness: { baseColorFactor: colors[pack], metallicFactor: 0.05, roughnessFactor: 0.82 },
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
      note: "Temporary static placeholder GLBs for Quaternius CC0 catalogue slots. Replace with real pack assets when available.",
      files: written,
    }, null, 2) + "\n",
  );

  console.log(`Generated ${written.length} filler GLB assets in ${path.relative(root, outRoot)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
