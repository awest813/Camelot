/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { EDITOR_ONLY, editorCodeInGame } from "./check-bundle.mjs";

const chunk = (entry: string | null, modules: string[], imports: string[] = [], dynamicImports: string[] = []) =>
  ({ entry, facade: null, imports, dynamicImports, modules });

describe("check-bundle: no editor code in the game", () => {
  it("knows editor modules from game ones", () => {
    for (const m of ["src/features/editor/editor-suite.ts", "src/ui/map-editor-toolbar.ts", "src/ui/quest-creator-ui.ts",
      "src/systems/npc-creator-system.ts", "src/systems/workspace-draft-system.ts", "src/editor-main.ts",
      "node_modules/@babylonjs/gui/2D/controls/button.js", "node_modules/@babylonjs/inspector/index.js"]) {
      expect(EDITOR_ONLY.test(m), m).toBe(true);
    }
    for (const m of ["src/main.ts", "src/game.ts", "src/ui/inventory-panel.tsx", "src/ui/dialogue-box.tsx",
      "src/systems/dialogue-system.ts", "node_modules/@babylonjs/core/scene.js"]) {
      expect(EDITOR_ONLY.test(m), m).toBe(false);
    }
  });

  it("follows the game page's static and lazy chunks, and ignores the editor app's", () => {
    const report = {
      "index.js": chunk("index", ["src/main.ts"], ["app.js"], ["lazy.js"]),
      "app.js": chunk(null, ["src/game.ts"]),
      "lazy.js": chunk(null, ["src/ui/world-builder-ui.ts"]),
      "editor.js": chunk("editor", ["src/editor-main.ts", "src/features/editor/editor-suite.ts"], ["app.js"]),
    };
    expect(editorCodeInGame(report)).toEqual(["src/ui/world-builder-ui.ts (lazy.js)"]);
    delete (report as Record<string, unknown>)["lazy.js"];
    report["index.js"].dynamicImports = [];
    expect(editorCodeInGame(report)).toEqual([]);
  });
});
