#!/usr/bin/env node
/**
 * Architecture guardrails (engine overhaul, Phase 0).
 *
 * Static checks over src/ with no dependencies:
 *
 *  Rules (error):
 *   - framework-no-babylon    src/framework/** must not import @babylonjs/* (the domain
 *                             layer stays engine-free).
 *
 *  Ratchets (error when a count goes UP from tools/guardrails-baseline.json;
 *  a note when it goes down, so the baseline can be tightened with --update):
 *   - game-ts-lines           size of src/game.ts (the overhaul shrinks it)
 *   - unseeded-random         Math.random() calls outside the RNG allowlist
 *   - callback-properties     `this.x.onY = ` wiring in src/game.ts (to become events)
 *   - babylon-gui-files       src/ files importing @babylonjs/gui (to become Preact)
 *
 * Usage:
 *   node tools/check-guardrails.mjs            # check
 *   node tools/check-guardrails.mjs --update   # write current counts as the baseline
 *   node tools/check-guardrails.mjs --json     # machine-readable report
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const SRC = join(ROOT, "src");
const BASELINE = join(ROOT, "tools", "guardrails-baseline.json");

/**
 * Growth allowed above the baseline before a ratchet fails.  game.ts gets a
 * little slack so a small bug fix there isn't blocked; it's still meant to
 * shrink (move code out, then lower the baseline with --update).
 */
const SLACK = { "game-ts-lines": 40 };

/** Files allowed to call Math.random (the future RNG module lives here). */
const RANDOM_ALLOWLIST = [/^src\/core\/rng\//];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith(".d.ts")) out.push(p);
  }
  return out;
}

const rel = (p) => relative(ROOT, p).split(sep).join("/");

/** Strip comments (line and block) so documentation doesn't count. */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

export function measure() {
  const files = walk(SRC).map((p) => ({ path: rel(p), text: readFileSync(p, "utf8") }));
  const violations = [];
  let unseededRandom = 0;
  const randomByFile = {};
  let babylonGuiFiles = 0;

  for (const f of files) {
    const code = stripComments(f.text);
    if (f.path.startsWith("src/framework/") && /from\s+["']@babylonjs\//.test(code)) {
      violations.push({ rule: "framework-no-babylon", file: f.path });
    }
    if (!RANDOM_ALLOWLIST.some((re) => re.test(f.path))) {
      const n = (code.match(/Math\.random\s*\(/g) ?? []).length;
      if (n) { unseededRandom += n; randomByFile[f.path] = n; }
    }
    if (/from\s+["']@babylonjs\/gui/.test(code)) babylonGuiFiles++;
  }

  const game = files.find((f) => f.path === "src/game.ts");
  const gameLines = game ? game.text.split("\n").length : 0;
  const callbackProps = game ? (stripComments(game.text).match(/^\s*this\.[\w.]+\.on[A-Z]\w*\s*=(?!=)/gm) ?? []).length : 0;

  return {
    violations,
    counts: {
      "game-ts-lines": gameLines,
      "unseeded-random": unseededRandom,
      "callback-properties": callbackProps,
      "babylon-gui-files": babylonGuiFiles,
    },
    randomByFile,
  };
}

function main() {
  const args = new Set(process.argv.slice(2));
  const report = measure();
  if (args.has("--update")) {
    writeFileSync(BASELINE, JSON.stringify({ counts: report.counts }, null, 2) + "\n");
    console.log("guardrails: baseline updated", report.counts);
    return;
  }
  if (args.has("--json")) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  let baseline = { counts: {} };
  try { baseline = JSON.parse(readFileSync(BASELINE, "utf8")); } catch { /* first run */ }

  let failed = false;
  for (const v of report.violations) {
    console.error(`✖ ${v.rule}: ${v.file}`);
    failed = true;
  }
  for (const [key, now] of Object.entries(report.counts)) {
    const was = baseline.counts?.[key];
    if (was === undefined) {
      console.log(`• ${key}: ${now} (no baseline — run with --update)`);
    } else if (now > was + (SLACK[key] ?? 0)) {
      console.error(`✖ ${key}: ${now} > baseline ${was}${SLACK[key] ? ` + ${SLACK[key]} slack` : ""} (this should only go down)`);
      if (key === "unseeded-random") {
        console.error("  Use a seeded RNG stream instead of Math.random(). Per file:", report.randomByFile);
      }
      failed = true;
    } else if (now > was) {
      console.log(`! ${key}: ${now} (baseline ${was}, within ${SLACK[key]} slack — move code out rather than add)`);
    } else if (now < was) {
      console.log(`✓ ${key}: ${now} (down from ${was} — tighten with: node tools/check-guardrails.mjs --update)`);
    } else {
      console.log(`✓ ${key}: ${now}`);
    }
  }
  if (failed) process.exit(1);
  console.log("guardrails: OK");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
