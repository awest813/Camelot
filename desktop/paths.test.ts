import path from "path";
import { describe, expect, it } from "vitest";
import { resolveDistFile } from "./paths.mjs";

describe("resolveDistFile", () => {
  const root = path.resolve("/tmp/camelot-dist");

  it("maps the site root to index.html and keeps nested assets", () => {
    expect(resolveDistFile(root, "/")).toBe(path.join(root, "index.html"));
    expect(resolveDistFile(root, "/static/js/app.js")).toBe(path.join(root, "static/js/app.js"));
  });

  it("rejects traversal and bad escapes", () => {
    expect(resolveDistFile(root, "/../package.json")).toBeNull();
    expect(resolveDistFile(root, "/static/../../etc/passwd")).toBeNull();
    expect(resolveDistFile(root, "/%00index.html")).toBeNull();
    expect(resolveDistFile(root, "/%E0%A4%A")).toBeNull();
  });
});
