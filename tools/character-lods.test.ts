/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import { LOD_MODELS } from "./build-character-lods.mjs";
import { CHARACTER_MODEL_IDS, QUATERNIUS_HUMAN_FILES, isQuaterniusHuman } from "../src/rendering/character-models";

const MODELS = join(__dirname, "..", "public", "model");

describe("character LODs", () => {
  it("cover exactly the models the character rigs use", () => {
    const used = CHARACTER_MODEL_IDS.map((id) => (isQuaterniusHuman(id)
      ? `quaternius/characters/${QUATERNIUS_HUMAN_FILES[id]}`
      : `kaykit/${id}.glb`));
    expect([...LOD_MODELS].sort()).toEqual([...new Set(used)].sort());
  });

  it("are in the manifest and on disk: the same skeletons, at most 60% of the triangles", async () => {
    const manifest = JSON.parse(readFileSync(join(MODELS, "manifest.json"), "utf8"));
    await MeshoptDecoder.ready;
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
    const tris = async (f: string) => {
      let n = 0;
      for (const m of (await io.read(join(MODELS, f))).getRoot().listMeshes()) {
        for (const p of m.listPrimitives()) n += (p.getIndices()?.getCount() ?? p.getAttribute("POSITION")!.getCount()) / 3;
      }
      return Math.round(n);
    };
    const skins = async (f: string) => (await io.read(join(MODELS, f))).getRoot().listSkins()
      .map((s) => s.listJoints().map((j) => j.getName()).join(","));
    for (const model of LOD_MODELS) {
      const entry = manifest.models[model];
      expect(entry?.lod1, model).toBeDefined();
      expect(existsSync(join(MODELS, entry.lod1.file)), entry.lod1.file).toBe(true);
      expect(entry.lod1.tris / entry.tris, model).toBeLessThanOrEqual(0.6);
      expect(await tris(model), `${model} changed since its LOD was built: run node tools/build-character-lods.mjs`).toBe(entry.tris);
      const lodSkins = await skins(entry.lod1.file);
      const baseSkins = await skins(model);
      for (const s of lodSkins) expect(baseSkins, `${entry.lod1.file}: a skeleton the full model has`).toContain(s);
    }
    expect(Object.values(manifest.models).filter((m: any) => m.lod1)).toHaveLength(LOD_MODELS.length);
  }, 60_000);
});
