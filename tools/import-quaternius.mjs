#!/usr/bin/env node
// Import real Quaternius (CC0) models into Camelot's catalogue slots.
//
//   node tools/import-quaternius.mjs <extracted-packs-dir>
//
// <extracted-packs-dir> holds one sub-folder per downloaded Quaternius pack
// (the Standard zips from quaternius.com / itch.io, unzipped as-is).  The
// slot → source-model mapping lives in tools/quaternius-slot-map.json.
//
// For each mapped slot the source glTF (+ .bin) is repacked as
// public/model/quaternius/<pack>/<Slot>.glb with its geometry embedded and
// its textures referenced from public/model/quaternius/<pack>/textures/
// <sourcePack>/, so trim sheets shared by many models ship once per folder.
// Textures are downscaled (default 1024 px) and re-encoded as JPEG through
// the Playwright Chromium canvas; base-colour maps get the same
// dark-fantasy grade as the KayKit characters (tools/grade-kaykit-textures).
//
// Slots without a good match in the downloaded packs keep the procedural
// stand-ins from tools/generate-filler-assets.mjs.

import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import os from "node:os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outRoot = path.join(root, "public", "model", "quaternius");
const require = createRequire(import.meta.url);

const TEXTURE_SIZE = Number(process.env.QUATERNIUS_TEXTURE_SIZE ?? 1024);

async function walk(dir, out = []) {
  for (const name of await readdir(dir)) {
    const p = path.join(dir, name);
    const s = await stat(p);
    if (s.isDirectory()) await walk(p, out);
    else out.push(p);
  }
  return out;
}

/** Find a source model by base name inside one pack folder (.gltf preferred, then .glb). */
function findSource(files, packDir, sourceName) {
  const inPack = files.filter((f) => f.startsWith(packDir + path.sep));
  let hits = inPack.filter((f) => path.basename(f).toLowerCase() === `${sourceName}.gltf`.toLowerCase());
  if (hits.length === 0) hits = inPack.filter((f) => path.basename(f).toLowerCase() === `${sourceName}.glb`.toLowerCase());
  hits.sort((a, b) => Number(!/gltf/i.test(path.dirname(a))) - Number(!/gltf/i.test(path.dirname(b))));
  return hits[0] ?? null;
}

function findTexture(files, packDir, uri, nearDir) {
  const raw = path.basename(decodeURIComponent(uri)).toLowerCase();
  // Some exports reference "X_png.png" for a file named "X.png".
  const names = new Set([raw, raw.replace(/_png\.png$/, ".png")]);
  const inPack = files.filter((f) => f.startsWith(packDir + path.sep) && names.has(path.basename(f).toLowerCase()));
  // The copy next to the referencing glTF is the one its exporter matched (normal-map convention).
  const near = nearDir ? inPack.find((f) => path.dirname(f) === nearDir) : undefined;
  if (near) return near;
  // Prefer the OpenGL-convention normal maps glTF expects (skip *Unreal* variants).
  inPack.sort((a, b) => Number(/unreal/i.test(a)) - Number(/unreal/i.test(b)));
  return inPack[0] ?? null;
}

const align4 = (n) => (n + 3) & ~3;

function packGlb(json, bin) {
  json.buffers = [{ byteLength: bin.length }];
  let jsonBuf = Buffer.from(JSON.stringify(json), "utf8");
  const jp = align4(jsonBuf.length) - jsonBuf.length;
  if (jp) jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(jp, 0x20)]);
  const bp = align4(bin.length) - bin.length;
  const binBuf = bp ? Buffer.concat([bin, Buffer.alloc(bp)]) : bin;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + binBuf.length, 8);
  const jh = Buffer.alloc(8);
  jh.writeUInt32LE(jsonBuf.length, 0);
  jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8);
  bh.writeUInt32LE(binBuf.length, 0);
  bh.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jh, jsonBuf, bh, binBuf]);
}

/** Resize + JPEG-encode images in Chromium; base-colour maps are dark-graded. */
async function convertTextures(jobs) {
  if (jobs.length === 0) return;
  const { chromium } = require("playwright");
  const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
  const page = await browser.newPage();
  for (const job of jobs) {
    const src = await readFile(job.src);
    const mime = job.src.toLowerCase().endsWith(".jpg") || job.src.toLowerCase().endsWith(".jpeg") ? "image/jpeg" : "image/png";
    const dataUrl = await page.evaluate(async ({ b64, mime, size, grade, quality }) => {
      const img = new Image();
      img.src = `data:${mime};base64,${b64}`;
      await img.decode();
      const w = Math.min(size, img.naturalWidth);
      const h = Math.round(img.naturalHeight * (w / img.naturalWidth));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, w, h);
      if (grade) {
        // Same curve as tools/grade-kaykit-textures.mjs gradeColor().
        const data = ctx.getImageData(0, 0, w, h);
        const d = data.data;
        const clamp = (v) => Math.min(1, Math.max(0, v));
        const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
        const sh = [0.93, 0.97, 1.06], hi = [1.06, 1.0, 0.86];
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
          const l = 0.299 * r + 0.587 * g + 0.114 * b;
          const t = smooth(0.15, 0.7, l);
          const c = [r, g, b].map((v, k) => {
            let x = (l + (v - l) * 0.42) * 0.8;
            x *= sh[k] + (hi[k] - sh[k]) * t;
            return clamp((x - 0.4) * 1.12 + 0.4);
          });
          d[i] = c[0] * 255; d[i + 1] = c[1] * 255; d[i + 2] = c[2] * 255;
        }
        ctx.putImageData(data, 0, 0);
      }
      return canvas.toDataURL("image/jpeg", quality);
    }, { b64: src.toString("base64"), mime, size: TEXTURE_SIZE, grade: job.grade, quality: job.normal ? 0.92 : 0.86 });
    await mkdir(path.dirname(job.dest), { recursive: true });
    await writeFile(job.dest, Buffer.from(dataUrl.split(",")[1], "base64"));
    console.log(`  texture ${path.relative(root, job.dest)}`);
  }
  await browser.close();
}

// ── Skinned attachments (heads, hair) ─────────────────────────────────────────

const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const TYPED = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };

function readAccessor(json, bin, index) {
  const acc = json.accessors[index];
  const view = json.bufferViews[acc.bufferView];
  const Typed = TYPED[acc.componentType];
  const n = COMPONENTS[acc.type];
  const elem = Typed.BYTES_PER_ELEMENT;
  const stride = view.byteStride ?? n * elem;
  const out = new Typed(acc.count * n);
  const base = (view.byteOffset ?? 0) + (acc.byteOffset ?? 0);
  const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  const get = {
    5120: (o) => dv.getInt8(o), 5121: (o) => dv.getUint8(o), 5122: (o) => dv.getInt16(o, true),
    5123: (o) => dv.getUint16(o, true), 5125: (o) => dv.getUint32(o, true), 5126: (o) => dv.getFloat32(o, true),
  }[acc.componentType];
  for (let i = 0; i < acc.count; i++) {
    for (let c = 0; c < n; c++) out[i * n + c] = get(base + i * stride + c * elem);
  }
  return { data: out, acc };
}

/** Append a typed array as a new bufferView + accessor; returns [bin, accessorIndex]. */
function appendAccessor(json, bin, data, componentType, type, target, extra = {}) {
  const pad = align4(bin.length) - bin.length;
  const offset = bin.length + pad;
  const bytes = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  const out = Buffer.concat([bin, Buffer.alloc(pad), bytes]);
  json.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, ...(target ? { target } : {}) });
  json.accessors.push({ bufferView: json.bufferViews.length - 1, componentType, count: data.length / COMPONENTS[type], type, ...extra });
  return [out, json.accessors.length - 1];
}

/**
 * Splice skinned meshes from another model (same Quaternius 65-bone rig) into
 * `json`, bound to its first skin.  `extra`: { pack, model, pathIncludes?,
 * meshes?: string[] (mesh or node names), minY?: number (keep only triangles
 * wholly above this height — e.g. a head cut from a base body) }.
 */
async function attachSkinned(json, bin, files, packsRoot, extra, imagePack) {
  const packDir = path.join(packsRoot, extra.pack);
  const candidates = files.filter((f) => f.startsWith(packDir + path.sep)
    && path.basename(f).toLowerCase() === `${extra.model}.gltf`.toLowerCase()
    && (!extra.pathIncludes || f.includes(extra.pathIncludes)));
  const src = candidates[0];
  if (!src) throw new Error(`attach: ${extra.pack}/${extra.model} not found`);
  const other = JSON.parse(await readFile(src, "utf8"));
  const otherBin = await readFile(path.join(path.dirname(src), decodeURIComponent(other.buffers[0].uri)));

  // Joint remap by bone name (attachment skin → host skin).
  const hostJoints = json.skins[0].joints.map((i) => json.nodes[i].name);
  const otherJoints = (other.skins?.[0]?.joints ?? []).map((i) => other.nodes[i].name);
  const jointMap = otherJoints.map((n) => {
    const k = hostJoints.indexOf(n);
    if (k < 0) throw new Error(`attach ${extra.model}: host rig lacks bone ${n}`);
    return k;
  });

  // Materials / textures / images, remapped.
  const matMap = new Map();
  const texMap = new Map();
  const copyTexture = (ti) => {
    if (texMap.has(ti)) return texMap.get(ti);
    const t = other.textures[ti];
    json.images ??= [];
    json.textures ??= [];
    json.samplers ??= [];
    json.images.push({ ...other.images[t.source] });
    imagePack.set(json.images.length - 1, { pack: extra.pack, dir: path.dirname(src) });
    let sampler;
    if (t.sampler !== undefined) { json.samplers.push({ ...other.samplers[t.sampler] }); sampler = json.samplers.length - 1; }
    json.textures.push({ source: json.images.length - 1, ...(sampler !== undefined ? { sampler } : {}) });
    texMap.set(ti, json.textures.length - 1);
    return json.textures.length - 1;
  };
  const copyMaterial = (mi) => {
    if (matMap.has(mi)) return matMap.get(mi);
    const m = JSON.parse(JSON.stringify(other.materials[mi]));
    const fix = (ref) => { if (ref && typeof ref.index === "number") { ref.index = copyTexture(ref.index); delete ref.texCoord; } };
    fix(m.normalTexture); fix(m.occlusionTexture); fix(m.emissiveTexture);
    fix(m.pbrMetallicRoughness?.baseColorTexture); fix(m.pbrMetallicRoughness?.metallicRoughnessTexture);
    json.materials.push(m);
    matMap.set(mi, json.materials.length - 1);
    return json.materials.length - 1;
  };

  const wanted = extra.meshes ? new Set(extra.meshes) : null;
  for (const node of other.nodes) {
    if (node.mesh === undefined) continue;
    const mesh = other.meshes[node.mesh];
    if (wanted && !wanted.has(mesh.name) && !wanted.has(node.name)) continue;
    const prims = [];
    for (const prim of mesh.primitives) {
      const pos = readAccessor(other, otherBin, prim.attributes.POSITION).data;
      const idx = readAccessor(other, otherBin, prim.indices).data;
      // Keep triangles wholly above minY (all, when unset).
      const keep = [];
      for (let t = 0; t < idx.length; t += 3) {
        const a = idx[t], b = idx[t + 1], c = idx[t + 2];
        if (extra.minY === undefined || Math.min(pos[a * 3 + 1], pos[b * 3 + 1], pos[c * 3 + 1]) >= extra.minY) keep.push(a, b, c);
      }
      if (keep.length === 0) continue;
      const remap = new Map();
      const order = [];
      const newIdx = new Uint16Array(keep.length);
      keep.forEach((v, i) => {
        if (!remap.has(v)) { remap.set(v, order.length); order.push(v); }
        newIdx[i] = remap.get(v);
      });
      const attributes = {};
      for (const name of ["POSITION", "NORMAL", "TEXCOORD_0", "JOINTS_0", "WEIGHTS_0"]) {
        if (prim.attributes[name] === undefined) continue;
        const { data, acc } = readAccessor(other, otherBin, prim.attributes[name]);
        const n = COMPONENTS[acc.type];
        const Typed = name === "JOINTS_0" ? Uint16Array : data.constructor;
        const out = new Typed(order.length * n);
        order.forEach((v, i) => {
          for (let c = 0; c < n; c++) {
            const value = data[v * n + c];
            out[i * n + c] = name === "JOINTS_0" ? jointMap[value] : value;
          }
        });
        // Keep normalized-integer attributes (UVs / weights stored as
        // UNSIGNED_BYTE/SHORT) normalized — otherwise they read as 0–255.
        let extraProps = acc.normalized && name !== "JOINTS_0" ? { normalized: true } : {};
        if (name === "POSITION") {
          const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
          for (let i = 0; i < out.length; i += 3) for (let c = 0; c < 3; c++) { min[c] = Math.min(min[c], out[i + c]); max[c] = Math.max(max[c], out[i + c]); }
          extraProps = { ...extraProps, min, max };
        }
        const componentType = name === "JOINTS_0" ? 5123 : acc.componentType;
        let accIndex;
        [bin, accIndex] = appendAccessor(json, bin, out, componentType, acc.type, 34962, extraProps);
        attributes[name] = accIndex;
      }
      let idxAcc;
      [bin, idxAcc] = appendAccessor(json, bin, newIdx, 5123, "SCALAR", 34963);
      prims.push({ attributes, indices: idxAcc, ...(prim.material !== undefined ? { material: copyMaterial(prim.material) } : {}) });
    }
    if (prims.length === 0) continue;
    json.meshes.push({ name: `${extra.model}_${mesh.name}`, primitives: prims });
    json.nodes.push({ name: `${extra.model}_${node.name}`, mesh: json.meshes.length - 1, skin: 0 });
    json.scenes[json.scene ?? 0].nodes.push(json.nodes.length - 1);
  }
  return bin;
}

/** Which images feed base-colour vs normal slots (decides grading / JPEG quality). */
function imageRoles(json) {
  const baseColor = new Set();
  const normal = new Set();
  const src = (texIndex) => json.textures?.[texIndex]?.source;
  for (const m of json.materials ?? []) {
    const bc = m.pbrMetallicRoughness?.baseColorTexture?.index;
    if (bc !== undefined && src(bc) !== undefined) baseColor.add(src(bc));
    const n = m.normalTexture?.index;
    if (n !== undefined && src(n) !== undefined) normal.add(src(n));
  }
  return { baseColor, normal };
}

/**
 * Read a GLB, write each embedded image to a temp file (recorded in
 * `embedded` by image index), drop those bufferViews and compact the binary.
 */
async function unpackGlbWithExternalImages(file, embedded, tag) {
  const buf = await readFile(file);
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString("utf8"));
  const binStart = 20 + jsonLen + 8;
  const bin = buf.subarray(binStart, binStart + buf.readUInt32LE(20 + jsonLen));
  const tmpDir = path.join(os.tmpdir(), "camelot-quaternius-import");
  await mkdir(tmpDir, { recursive: true });

  const dropped = new Set();
  for (const [index, image] of (json.images ?? []).entries()) {
    if (image.bufferView === undefined) continue;
    const view = json.bufferViews[image.bufferView];
    const bytes = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    const ext = image.mimeType === "image/jpeg" ? "jpg" : "png";
    const tmp = path.join(tmpDir, `${tag}-${index}.${ext}`);
    await writeFile(tmp, bytes);
    embedded.set(index, tmp);
    dropped.add(image.bufferView);
    delete image.bufferView;
  }

  // Compact: keep non-image views, renumber references.
  const remap = new Map();
  const views = [];
  const parts = [];
  let offset = 0;
  json.bufferViews.forEach((view, index) => {
    if (dropped.has(index)) return;
    const bytes = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    const padded = align4(offset);
    if (padded > offset) parts.push(Buffer.alloc(padded - offset));
    offset = padded;
    remap.set(index, views.length);
    views.push({ ...view, byteOffset: offset });
    parts.push(bytes);
    offset += bytes.length;
  });
  json.bufferViews = views;
  for (const acc of json.accessors ?? []) {
    if (acc.bufferView !== undefined) acc.bufferView = remap.get(acc.bufferView);
    if (acc.sparse) {
      acc.sparse.indices.bufferView = remap.get(acc.sparse.indices.bufferView);
      acc.sparse.values.bufferView = remap.get(acc.sparse.values.bufferView);
    }
  }
  return { json, bin: Buffer.concat(parts) };
}

async function main() {
  const packsDir = process.argv[2];
  if (!packsDir) {
    console.error("usage: node tools/import-quaternius.mjs <extracted-packs-dir>");
    process.exitCode = 1;
    return;
  }
  const map = JSON.parse(await readFile(path.join(__dirname, "quaternius-slot-map.json"), "utf8"));
  const files = await walk(path.resolve(packsDir));
  const textureJobs = new Map();
  const imported = [];
  const missing = [];

  for (const [slotPack, slots] of Object.entries(map.slots)) {
    for (const [slot, spec] of Object.entries(slots)) {
      const packDir = path.join(path.resolve(packsDir), spec.pack);
      const srcFile = findSource(files, packDir, spec.model);
      if (!srcFile) { missing.push(`${slotPack}/${slot} ← ${spec.pack}/${spec.model}`); continue; }
      let json;
      let bin;
      /** For GLB sources: image index → extracted temp file (embedded textures). */
      const embedded = new Map();
      if (srcFile.toLowerCase().endsWith(".glb")) {
        ({ json, bin } = await unpackGlbWithExternalImages(srcFile, embedded, `${spec.pack}-${spec.model}`));
      } else {
        json = JSON.parse(await readFile(srcFile, "utf8"));
        const bins = [];
        for (const buf of json.buffers ?? []) {
          bins.push(await readFile(path.join(path.dirname(srcFile), decodeURIComponent(buf.uri))));
        }
        if (bins.length !== 1) throw new Error(`${srcFile}: expected one buffer, got ${bins.length}`);
        bin = bins[0];
      }
      json.buffers = [{ byteLength: bin.length }];
      /** Image index → pack its file lives in (attachments come from other packs). */
      const imagePack = new Map();
      for (const extra of spec.attach ?? []) {
        bin = await attachSkinned(json, bin, files, path.resolve(packsDir), extra, imagePack);
      }
      const roles = imageRoles(json);

      // Shared, converted textures: <slotPack>/textures/<sourcePack>/<name>.jpg.
      // (Babylon's glTF loader rejects ".." in URIs, so they live below the model.)
      const texPack = spec.pack.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      for (const [index, image] of (json.images ?? []).entries()) {
        const from = imagePack.get(index);
        const imgPackDir = from ? path.join(path.resolve(packsDir), from.pack) : packDir;
        const texSrc = embedded.get(index) ?? findTexture(files, imgPackDir, image.uri, from ? from.dir : path.dirname(srcFile));
        if (!texSrc) throw new Error(`${srcFile}: texture ${image.uri} not found in pack`);
        const base = embedded.has(index)
          ? `${spec.model}_${(image.name ?? `image${index}`).replace(/[^a-z0-9_-]+/gi, "_")}`
          : path.basename(decodeURIComponent(image.uri)).replace(/\.(png|jpe?g)$/i, "");
        const dest = path.join(outRoot, slotPack, "textures", texPack, `${base}.jpg`);
        textureJobs.set(dest, {
          src: texSrc,
          dest,
          grade: roles.baseColor.has(index),
          normal: roles.normal.has(index),
        });
        image.uri = `textures/${texPack}/${base}.jpg`;
        image.mimeType = "image/jpeg";
      }
      json.asset = {
        ...(json.asset ?? {}),
        extras: { ...(json.asset?.extras ?? {}), source: `Quaternius ${spec.pack} / ${spec.model} (CC0)` },
      };
      const out = path.join(outRoot, slotPack, `${slot}.glb`);
      await mkdir(path.dirname(out), { recursive: true });
      await writeFile(out, packGlb(json, bin));
      imported.push({ slot: `${slotPack}/${slot}`, source: `${spec.pack}/${spec.model}` });
    }
  }

  await convertTextures([...textureJobs.values()]);

  const manifestFile = path.join(outRoot, "quaternius-import-manifest.json");
  await writeFile(manifestFile, JSON.stringify({
    tool: "tools/import-quaternius.mjs",
    license: "CC0 1.0 — models by Quaternius (quaternius.com)",
    textureSize: TEXTURE_SIZE,
    imported,
  }, null, 2) + "\n");
  console.log(`Imported ${imported.length} slots.`);
  if (missing.length) {
    console.log(`Not found (left as stand-ins):\n  ${missing.join("\n  ")}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
