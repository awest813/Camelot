#!/usr/bin/env node
/**
 * Shrinks the game's models (engine overhaul, Phase 7: asset pipeline).
 *
 *   - Geometry and animation: meshopt compression (EXT_meshopt_compression,
 *     with quantization), animations resampled, unused data pruned.
 *   - Textures: WebP (EXT_texture_webp), longest side at most MAX_TEXTURE.
 *     The packs share texture files between models (113 files referenced
 *     393 times), so external textures stay external: each is converted
 *     once to a .webp beside it and the models point at that.  Images
 *     embedded in a model are compressed in place.
 *
 * Usage:  node tools/optimize-models.mjs [--src <dir>] [--out <dir>] [--dry]
 *   default: rewrite public/model in place (git keeps the originals);
 *   --out:   write the results under another directory instead;
 *   --dry:   only report what it would save.
 *
 * Runs once per asset drop; the game loads the results with the decoder in
 * public/vendor/meshopt_decoder.js.
 */
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTTextureWebP } from "@gltf-transform/extensions";
import { dedup, meshopt, prune, resample, textureCompress } from "@gltf-transform/functions";
import { PropertyType } from "@gltf-transform/core";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const MAX_TEXTURE = 1024;
const WEBP_QUALITY = 82;
const PLACEHOLDER_PREFIX = "__external__:";

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const outIdx = args.indexOf("--out");
const srcIdx = args.indexOf("--src");
const SRC = resolve(srcIdx >= 0 ? args[srcIdx + 1] : "public/model");
const OUT = outIdx >= 0 ? resolve(args[outIdx + 1]) : SRC;

const files = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? files(p) : [p];
});
const target = (p) => join(OUT, relative(SRC, p));
const webpName = (uri) => uri.replace(/\.(jpe?g|png)$/i, ".webp");
const mb = (n) => (n / 1048576).toFixed(1) + " MB";

/** Split a GLB into its JSON and BIN chunks. */
function readGlb(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const jsonLen = view.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLen)));
  const binStart = 20 + jsonLen;
  const bin = binStart < bytes.byteLength ? bytes.subarray(binStart + 8, binStart + 8 + view.getUint32(binStart, true)) : null;
  return { json, bin };
}

/** Join JSON and BIN chunks into a GLB (both padded to 4 bytes). */
function writeGlb(json, bin) {
  const pad = (n) => (4 - (n % 4)) % 4;
  let jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  jsonBytes = Uint8Array.from([...jsonBytes, ...new Array(pad(jsonBytes.length)).fill(0x20)]);
  const binPadded = bin ? Uint8Array.from([...bin, ...new Array(pad(bin.length)).fill(0)]) : null;
  const total = 12 + 8 + jsonBytes.length + (binPadded ? 8 + binPadded.length : 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, total, true);
  view.setUint32(12, jsonBytes.length, true); view.setUint32(16, 0x4e4f534a, true);
  out.set(jsonBytes, 20);
  if (binPadded) {
    const at = 20 + jsonBytes.length;
    view.setUint32(at, binPadded.length, true); view.setUint32(at + 4, 0x004e4942, true);
    out.set(binPadded, at + 8);
  }
  return out;
}

async function main() {
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });

  const glbs = files(SRC).filter((p) => p.endsWith(".glb"));
  const externals = new Map(); // absolute texture path → .webp path
  let before = 0, after = 0;

  for (const file of glbs) {
    const raw = readFileSync(file);
    before += raw.byteLength;
    const { json } = readGlb(raw);
    if (json.extensionsUsed?.includes("EXT_meshopt_compression")) { after += raw.byteLength; continue; } // already done
    const doc = await io.read(file);
    doc.createExtension(EXTTextureWebP).setRequired(true);

    // External textures: remember where they live.
    const external = new Map(); // texture → its .webp URI, relative to the model
    for (const tex of doc.getRoot().listTextures()) {
      const uri = tex.getURI();
      if (uri && !uri.startsWith("data:")) {
        const abs = resolve(dirname(file), decodeURIComponent(uri));
        externals.set(abs, webpName(abs));
        external.set(tex, webpName(uri));
      }
    }
    await doc.transform(
      resample(),
      prune({ keepAttributes: true }),
      // Embedded images become WebP here; external ones too, but those are
      // swapped for a placeholder next (the shared .webp is written once).
      textureCompress({ encoder: sharp, targetFormat: "webp", resize: [MAX_TEXTURE, MAX_TEXTURE], quality: WEBP_QUALITY }),
    );
    for (const [tex, uri] of external) {
      if (tex.isDisposed()) continue;
      tex.setName(PLACEHOLDER_PREFIX + uri).setImage(new Uint8Array([0])).setMimeType("image/webp");
    }
    // One quantization volume for the whole model: per-mesh volumes give each
    // skinned mesh its own copy of the skin (and Babylon a skeleton and bone
    // texture each).  Then fold identical skins back together.
    await doc.transform(
      meshopt({ encoder: MeshoptEncoder, level: "medium", quantizationVolume: "scene" }),
      dedup({ propertyTypes: [PropertyType.SKIN] }),
    );

    // Point placeholder images at their shared .webp files.
    const { json: outJson, bin } = readGlb(await io.writeBinary(doc));
    for (const image of outJson.images ?? []) {
      if (!image.name?.startsWith(PLACEHOLDER_PREFIX)) continue;
      image.uri = encodeURI(image.name.slice(PLACEHOLDER_PREFIX.length));
      delete image.bufferView;
      delete image.name;
      image.mimeType = "image/webp";
    }
    const glb = writeGlb(outJson, bin);
    after += glb.byteLength;
    if (!DRY) {
      mkdirSync(dirname(target(file)), { recursive: true });
      writeFileSync(target(file), glb);
    }
  }

  // Each shared texture once.
  let texBefore = 0, texAfter = 0;
  for (const [src, webp] of externals) {
    if (!existsSync(src)) { console.warn("missing texture", relative(SRC, src)); continue; }
    texBefore += statSync(src).size;
    const out = await sharp(src).resize(MAX_TEXTURE, MAX_TEXTURE, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY }).toBuffer();
    texAfter += out.byteLength;
    if (!DRY) {
      mkdirSync(dirname(target(webp)), { recursive: true });
      writeFileSync(target(webp), out);
    }
  }

  // In place: the originals the .webp files replace go, unless a .gltf
  // (which this tool leaves alone) still points at them.
  if (!DRY && OUT === SRC) {
    const stillUsed = new Set();
    for (const gltf of files(SRC).filter((p) => p.endsWith(".gltf"))) {
      for (const image of JSON.parse(readFileSync(gltf, "utf8")).images ?? []) {
        if (image.uri && !image.uri.startsWith("data:")) stillUsed.add(resolve(dirname(gltf), decodeURIComponent(image.uri)));
      }
    }
    let removed = 0;
    for (const src of externals.keys()) {
      if (stillUsed.has(src) || !existsSync(src) || !existsSync(webpName(src))) continue;
      unlinkSync(src);
      removed++;
    }
    console.log(`removed ${removed} original textures now served as .webp`);
  }

  console.log(`models:   ${glbs.length} GLBs ${mb(before)} → ${mb(after)}`);
  console.log(`textures: ${externals.size} shared ${mb(texBefore)} → ${mb(texAfter)}`);
  console.log(`total:    ${mb(before + texBefore)} → ${mb(after + texAfter)}${DRY ? " (dry run)" : ""}`);
}

await main();
