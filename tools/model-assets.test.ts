import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/** The JSON chunk of a GLB. */
function glbJson(path: string): { images?: Array<{ uri?: string }>; extensionsUsed?: string[]; skins?: Array<{ joints: number[] }> } {
  const b = readFileSync(path);
  const len = b.readUInt32LE(12);
  return JSON.parse(b.subarray(20, 20 + len).toString("utf8"));
}
const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

describe("shipped models (after tools/optimize-models.mjs)", () => {
  const glbs = walk("public/model").filter((p) => p.endsWith(".glb"));

  it("every texture a model points at exists, and each model is meshopt-compressed", () => {
    expect(glbs.length).toBeGreaterThan(100);
    for (const glb of glbs) {
      const json = glbJson(glb);
      expect(json.extensionsUsed ?? [], glb).toContain("EXT_meshopt_compression");
      for (const image of json.images ?? []) {
        if (!image.uri || image.uri.startsWith("data:")) continue;
        expect(existsSync(resolve(dirname(glb), decodeURIComponent(image.uri))), `${glb} → ${image.uri}`).toBe(true);
      }
    }
  });

  it("no model splits one skeleton into several skins (each would get its own bone texture)", () => {
    for (const glb of glbs) {
      const joints = (glbJson(glb).skins ?? []).map((s) => s.joints.join(","));
      expect(new Set(joints).size, glb).toBe(joints.length);
    }
  });

  it("the village well's textures exist", () => {
    const src = readFileSync("src/world/village-well.ts", "utf8");
    const names = [...src.matchAll(/t\("([^"]+)"\)/g)].map((m) => m[1]);
    expect(names.length).toBe(3);
    for (const n of names) expect(existsSync(`public/model/quaternius/village/textures/medieval-village-megakit/${n}`), n).toBe(true);
  });

  it("the meshopt decoder ships with the game", () => {
    expect(existsSync("public/vendor/meshopt_decoder.js")).toBe(true);
  });
});
