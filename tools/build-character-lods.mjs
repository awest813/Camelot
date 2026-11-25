#!/usr/bin/env node
/**
 * Character LODs and the model manifest (engine overhaul, Phase 7).
 *
 * For each character model the rigs use (LOD_MODELS) writes
 * `<name>.lod1.glb` beside it: the same skin, about RATIO of the
 * triangles, and nothing else. No animations, and no textures: the game
 * binds the LOD to the full model's skeleton and gives it the full
 * model's materials. Then it writes public/model/manifest.json, listing
 * every model's size and triangle count and, where there is one, its LOD.
 * The game reads the manifest to know which models have a LOD (no 404s).
 *
 * Usage:  node tools/build-character-lods.mjs [--check]
 *   --check: fail if a LOD or the manifest is missing or stale.
 */
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTMeshoptCompression } from "@gltf-transform/extensions";
import { meshopt, prune, simplify, weld } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const MODELS = join(ROOT, "public", "model");
const MANIFEST = join(MODELS, "manifest.json");
/**
 * The models the game's character rigs use (src/rendering/character-models.ts;
 * a test keeps the two in step).  Other models have no LOD consumer.
 */
export const LOD_MODELS = [
  "kaykit/Knight.glb", "kaykit/Barbarian.glb", "kaykit/Mage.glb", "kaykit/Rogue.glb", "kaykit/Rogue_Hooded.glb",
  "kaykit/Skeleton_Warrior.glb", "kaykit/Skeleton_Mage.glb", "kaykit/Skeleton_Rogue.glb", "kaykit/Skeleton_Minion.glb",
  "quaternius/characters/VillagerMale.glb", "quaternius/characters/VillagerFemale.glb",
  "quaternius/characters/Archer.glb", "quaternius/characters/Rogue.glb", "quaternius/characters/Barbarian.glb",
];
export const LOD_RATIO = 0.25;
const LOD_ERROR = 0.02;
const LOD_SUFFIX = ".lod1.glb";

const files = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? files(p) : [p];
});

const triangles = (doc) => {
  let tris = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const idx = prim.getIndices();
      tris += (idx ? idx.getCount() : prim.getAttribute("POSITION").getCount()) / 3;
    }
  }
  return Math.round(tris);
};

async function io() {
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
  return new NodeIO().registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
}

/** The LOD of one model: its skin and simplified geometry, nothing else. */
async function buildLod(io, file) {
  const doc = await io.read(file);
  const root = doc.getRoot();
  for (const anim of root.listAnimations()) {
    for (const ch of anim.listChannels()) ch.dispose();
    for (const sm of anim.listSamplers()) sm.dispose();
    anim.dispose();
  }
  // Materials stay (by name, so the game can match them) but lose their textures.
  for (const tex of root.listTextures()) tex.dispose();
  await doc.transform(
    weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio: LOD_RATIO, error: LOD_ERROR }),
    // Everything now unused (the animations' samplers and data, the images);
    // vertex attributes stay, UVs included: the game's materials are textured.
    prune({ keepAttributes: true, keepLeaves: true }),
    meshopt({ encoder: MeshoptEncoder, level: "medium", quantizationVolume: "scene" }),
  );
  doc.createExtension(EXTMeshoptCompression).setRequired(true);
  return { doc, bytes: await io.writeBinary(doc) };
}

export async function run({ check = false } = {}) {
  const nio = await io();
  const manifest = { generatedBy: "tools/build-character-lods.mjs", lodRatio: LOD_RATIO, models: {} };
  const stale = [];
  for (const file of files(MODELS).filter((p) => p.endsWith(".glb") && !p.endsWith(LOD_SUFFIX)).sort()) {
    const rel = relative(MODELS, file).split("\\").join("/");
    const doc = await nio.read(file);
    const entry = { bytes: statSync(file).size, tris: triangles(doc) };
    const skinned = doc.getRoot().listSkins().length > 0;
    if (skinned && LOD_MODELS.includes(rel)) {
      const lodRel = rel.replace(/\.glb$/, LOD_SUFFIX);
      const lodPath = join(MODELS, lodRel);
      const { doc: lodDoc, bytes } = await buildLod(nio, file);
      if (check) {
        if (!existsSync(lodPath)) stale.push(`missing ${lodRel}`);
      } else {
        writeFileSync(lodPath, bytes);
      }
      entry.lod1 = { file: lodRel, bytes: check && existsSync(lodPath) ? statSync(lodPath).size : bytes.byteLength, tris: triangles(lodDoc) };
    }
    manifest.models[rel] = entry;
  }
  const text = JSON.stringify(manifest, null, 2) + "\n";
  if (check) {
    const current = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : null;
    const lods = (m) => JSON.stringify(Object.entries(m?.models ?? {}).map(([k, v]) => [k, v.lod1?.file ?? null]));
    if (lods(current) !== lods(manifest)) stale.push("manifest.json lists other LODs than the models call for");
    return { manifest, stale };
  }
  writeFileSync(MANIFEST, text);
  return { manifest, stale };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const check = process.argv.includes("--check");
  const { manifest, stale } = await run({ check });
  const lods = Object.entries(manifest.models).filter(([, v]) => v.lod1);
  for (const [k, v] of lods) console.log(`${k}: ${v.tris} → ${v.lod1.tris} tris, ${(v.lod1.bytes / 1024).toFixed(0)} KB`);
  if (stale.length) {
    console.error("✖ character LODs are stale:\n  " + stale.join("\n  ") + "\nRun: node tools/build-character-lods.mjs");
    process.exit(1);
  }
  console.log(`${lods.length} LODs, ${Object.keys(manifest.models).length} models in the manifest${check ? " (up to date)" : ""}`);
}
