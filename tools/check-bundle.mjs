#!/usr/bin/env node
/**
 * Bundle-size budgets (engine overhaul, Phase 0).  Run after `vite build`.
 *
 * Measures the game page in dist/ (from the build's chunk report,
 * dist/.vite/chunk-modules.json): its code loaded up front, all the JS it
 * can load, its largest chunk and the model payload, and fails when any
 * exceeds tools/bundle-budgets.json.  Also fails if the game page can load
 * editor code (Phase 9: the editors are the editor app's, editor.html).  Budgets
 * start at today's size plus a little headroom and are meant to ratchet down
 * as the overhaul proceeds (see docs/engine-overhaul-plan.md, target:
 * entry ≤ 900 KB).
 *
 * Usage:
 *   node tools/check-bundle.mjs            # check
 *   node tools/check-bundle.mjs --update   # set budgets to current sizes + 3%
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const BUDGETS = join(ROOT, "tools", "bundle-budgets.json");
const HEADROOM = 1.03;
/** Success metric (docs/engine-overhaul-plan.md): the game's start-up JS at most 900 KB. */
const ENTRY_TARGET = 900 * 1024;

function files(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) files(p, out);
    else out.push({ path: p, name, size: st.size });
  }
  return out;
}

/** Chunk files a page loads: `staticOnly` = what it loads up front. */
function reachable(report, entryName, staticOnly) {
  const entry = Object.keys(report).find((f) => report[f].entry === entryName);
  if (!entry) throw new Error(`no ${entryName} entry in the chunk report`);
  const seen = new Set();
  const queue = [entry];
  while (queue.length) {
    const f = queue.pop();
    if (seen.has(f) || !report[f]) continue;
    seen.add(f);
    queue.push(...report[f].imports, ...(staticOnly ? [] : report[f].dynamicImports));
  }
  return seen;
}

/**
 * Editor code the game page must never load (engine overhaul, Phase 9): the
 * editor suite, its panels and systems, the inspector, and Babylon GUI (only
 * the map editor's panels use it).
 */
export const EDITOR_ONLY = /^src\/(features\/editor\/|ui\/(map-editor-|[\w-]+-creator-ui|editor-hub-ui|editor-layout|asset-browser-ui|bundle-merge-ui|mod-manifest-ui|world-builder-ui|content-bundle-ui)|systems\/(map-editor-system|[\w-]+-creator-system|workspace-draft-system)|editor-main)|node_modules\/@babylonjs\/(inspector|gui)\//;

/** Modules the game page can load that are editor-only. */
export function editorCodeInGame(report) {
  const out = [];
  for (const f of reachable(report, "index", false)) {
    for (const m of report[f].modules) if (EDITOR_ONLY.test(m)) out.push(`${m} (${f})`);
  }
  return out;
}

export function measure() {
  const report = JSON.parse(readFileSync(join(DIST, ".vite", "chunk-modules.json"), "utf8"));
  const size = (f) => statSync(join(DIST, f)).size;
  const vendor = (f) => /\/(babylon-vendor|recast-vendor)-/.test(f);
  const upFront = reachable(report, "index", true);
  const game = reachable(report, "index", false);
  const gameJs = [...game].map((f) => ({ name: f, size: size(f) }));
  const largest = gameJs.reduce((a, f) => (f.size > a.size ? f : a), gameJs[0]);
  const all = files(DIST);
  const models = all.filter((f) => /\.(glb|gltf|bin)$/.test(f.name)).reduce((n, f) => n + f.size, 0);
  const editorOnly = [...reachable(report, "editor", false)].filter((f) => !game.has(f));
  return {
    sizes: {
      // The game page's own code loaded up front (vendor chunks apart).
      "entry-js": [...upFront].filter((f) => !vendor(f)).reduce((n, f) => n + size(f), 0),
      // Everything the game page loads before its first frame: its code and
      // Babylon's (the real start-up figure; docs/startup-overhaul.md).
      "upfront-js": [...upFront].reduce((n, f) => n + size(f), 0),
      // All JS the game page can load (the editor app's extra chunks apart).
      "total-js": gameJs.reduce((n, f) => n + f.size, 0),
      "largest-js": largest.size,
      "models": models,
    },
    largestName: largest.name,
    editorJs: editorOnly.reduce((n, f) => n + size(f), 0),
    editorInGame: editorCodeInGame(report),
  };
}

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

function main() {
  const { sizes, largestName, editorJs, editorInGame } = measure();
  console.log(`• editor app's own JS: ${kb(editorJs)} (not loaded by the game)`);
  if (editorInGame.length) {
    console.error(`✖ the game page can load editor code:\n  ${editorInGame.slice(0, 20).join("\n  ")}`);
    process.exit(1);
  }
  console.log("✓ no editor code in the game");
  if (process.argv.includes("--update")) {
    const budgets = Object.fromEntries(Object.entries(sizes).map(([k, v]) => [k, Math.ceil(v * HEADROOM)]));
    // The plan's target for the start-up code is a hard ceiling, not a baseline.
    budgets["entry-js"] = Math.min(budgets["entry-js"], ENTRY_TARGET);
    writeFileSync(BUDGETS, JSON.stringify({ budgets }, null, 2) + "\n");
    console.log("bundle: budgets updated", Object.fromEntries(Object.entries(budgets).map(([k, v]) => [k, kb(v)])));
    return;
  }
  const { budgets } = JSON.parse(readFileSync(BUDGETS, "utf8"));
  let failed = false;
  for (const [key, size] of Object.entries(sizes)) {
    const max = budgets[key];
    if (max === undefined) { console.log(`• ${key}: ${kb(size)} (no budget)`); continue; }
    const pct = ((size / max) * 100).toFixed(0);
    if (size > max) {
      console.error(`✖ ${key}: ${kb(size)} > budget ${kb(max)}${key === "largest-js" ? ` (${largestName})` : ""}`);
      failed = true;
    } else {
      console.log(`✓ ${key}: ${kb(size)} (${pct}% of ${kb(max)})`);
    }
  }
  if (failed) {
    console.error("bundle: over budget. Lazy-load the new code, or raise the budget deliberately in tools/bundle-budgets.json.");
    process.exit(1);
  }
  console.log("bundle: OK");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
