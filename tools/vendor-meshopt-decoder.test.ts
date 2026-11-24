import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildDecoderScript } from "./vendor-meshopt-decoder.mjs";

describe("vendored meshopt decoder", () => {
  it("public/vendor/meshopt_decoder.js matches the installed meshoptimizer", () => {
    const pkg = JSON.parse(readFileSync("node_modules/meshoptimizer/package.json", "utf8"));
    const expected = buildDecoderScript(readFileSync("node_modules/meshoptimizer/meshopt_decoder.mjs", "utf8"), pkg.version);
    expect(readFileSync("public/vendor/meshopt_decoder.js", "utf8"), "run: node tools/vendor-meshopt-decoder.mjs").toBe(expected);
  });
});
