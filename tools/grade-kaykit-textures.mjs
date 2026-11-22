#!/usr/bin/env node
// Re-grade the KayKit character + weapon texture atlases toward Camelot's
// dark-fantasy look: desaturated, darker, cold shadows / bone-warm highlights,
// a touch more contrast.  KayKit assets are CC0, so modification is allowed.
//
// Idempotent: graded GLBs carry `asset.extras.camelotGrade`, graded external
// PNGs are listed in `public/model/kaykit/.graded.json`; both are skipped on
// re-run.  To regrade from scratch, restore the originals from git first.
//
// Usage: node tools/grade-kaykit-textures.mjs   (npm run assets:grade)

import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decodePng, encodePng } from "./png-rgba.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const kaykit = path.join(root, "public", "model", "kaykit");
export const GRADE_ID = "dark-fantasy-v1";

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smoothstep = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

/** Grade one sRGB colour (0–1 channels).  Exported for tests and other tools. */
export function gradeColor([r, g, b]) {
  const l = 0.299 * r + 0.587 * g + 0.114 * b;
  const sat = 0.42;
  let c = [l + (r - l) * sat, l + (g - l) * sat, l + (b - l) * sat];
  c = c.map((v) => v * 0.8);
  const t = smoothstep(0.15, 0.7, l);
  const shadow = [0.93, 0.97, 1.06];
  const highlight = [1.06, 1.0, 0.86];
  c = c.map((v, i) => v * (shadow[i] + (highlight[i] - shadow[i]) * t));
  c = c.map((v) => clamp01((v - 0.4) * 1.12 + 0.4));
  return c;
}

function gradePng(buf) {
  const img = decodePng(buf);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const [r, g, b] = gradeColor([d[i] / 255, d[i + 1] / 255, d[i + 2] / 255]);
    d[i] = Math.round(r * 255);
    d[i + 1] = Math.round(g * 255);
    d[i + 2] = Math.round(b * 255);
  }
  return encodePng(img);
}

const align4 = (n) => (n + 3) & ~3;

async function gradeGlb(file) {
  const buf = await readFile(file);
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString("utf8"));
  if (json.asset?.extras?.camelotGrade === GRADE_ID) return false;
  const binHeader = 20 + jsonLen;
  const binLen = buf.readUInt32LE(binHeader);
  const bin = buf.subarray(binHeader + 8, binHeader + 8 + binLen);

  const imageViews = new Set((json.images ?? []).map((im) => im.bufferView).filter((v) => v !== undefined));
  if (imageViews.size === 0) return false;

  // Rebuild the BIN chunk view by view, swapping graded PNG bytes in.
  const parts = [];
  let offset = 0;
  json.bufferViews.forEach((view, index) => {
    let bytes = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    if (imageViews.has(index)) bytes = gradePng(Buffer.from(bytes));
    const padded = align4(offset);
    if (padded > offset) parts.push(Buffer.alloc(padded - offset));
    offset = padded;
    view.byteOffset = offset;
    view.byteLength = bytes.length;
    parts.push(bytes);
    offset += bytes.length;
  });
  const padded = align4(offset);
  if (padded > offset) parts.push(Buffer.alloc(padded - offset));
  const newBin = Buffer.concat(parts);
  json.buffers[0].byteLength = newBin.length;
  json.asset = { ...json.asset, extras: { ...(json.asset?.extras ?? {}), camelotGrade: GRADE_ID } };

  let jsonBuf = Buffer.from(JSON.stringify(json), "utf8");
  const jsonPad = align4(jsonBuf.length) - jsonBuf.length;
  if (jsonPad) jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(jsonPad, 0x20)]);

  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + newBin.length, 8);
  const jh = Buffer.alloc(8);
  jh.writeUInt32LE(jsonBuf.length, 0);
  jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8);
  bh.writeUInt32LE(newBin.length, 0);
  bh.writeUInt32LE(0x004e4942, 4);
  await writeFile(file, Buffer.concat([header, jh, jsonBuf, bh, newBin]));
  return true;
}

async function main() {
  const done = [];
  for (const name of (await readdir(kaykit)).filter((f) => f.endsWith(".glb"))) {
    if (await gradeGlb(path.join(kaykit, name))) done.push(name);
  }

  const weapons = path.join(kaykit, "weapons");
  const ledgerFile = path.join(kaykit, ".graded.json");
  let ledger = {};
  try { ledger = JSON.parse(await readFile(ledgerFile, "utf8")); } catch { /* first run */ }
  for (const name of (await readdir(weapons)).filter((f) => f.endsWith(".png"))) {
    const key = `weapons/${name}`;
    if (ledger[key] === GRADE_ID) continue;
    const file = path.join(weapons, name);
    await writeFile(file, gradePng(await readFile(file)));
    ledger[key] = GRADE_ID;
    done.push(key);
  }
  await writeFile(ledgerFile, JSON.stringify(ledger, null, 2) + "\n");
  console.log(done.length ? `Graded (${GRADE_ID}): ${done.join(", ")}` : "All KayKit textures already graded.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
