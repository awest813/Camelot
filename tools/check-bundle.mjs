#!/usr/bin/env node
/**
 * Bundle-size budgets (engine overhaul, Phase 0).  Run after `vite build`.
 *
 * Measures dist/: the entry chunk, all JS, the largest chunk and the total
 * model payload, and fails when any exceeds tools/bundle-budgets.json.  Budgets
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

export function measure() {
  const all = files(DIST);
  const js = all.filter((f) => f.name.endsWith(".js"));
  if (js.length === 0) throw new Error("dist/ has no JS — run `npm run build` first");
  const entry = js.filter((f) => /^index-[\w-]+\.js$/.test(f.name)).reduce((n, f) => n + f.size, 0);
  const largest = js.reduce((a, f) => (f.size > a.size ? f : a), js[0]);
  const models = all.filter((f) => /\.(glb|gltf|bin)$/.test(f.name)).reduce((n, f) => n + f.size, 0);
  return {
    sizes: {
      "entry-js": entry,
      "total-js": js.reduce((n, f) => n + f.size, 0),
      "largest-js": largest.size,
      "models": models,
    },
    largestName: largest.name,
  };
}

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

function main() {
  const { sizes, largestName } = measure();
  if (process.argv.includes("--update")) {
    const budgets = Object.fromEntries(Object.entries(sizes).map(([k, v]) => [k, Math.ceil(v * HEADROOM)]));
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
