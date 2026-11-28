#!/usr/bin/env node
/**
 * Architecture guardrails (engine overhaul, Phase 0).
 *
 * Static checks over src/ with no dependencies:
 *
 *  Rules (error):
 *   - framework-no-babylon    src/framework/** must not import @babylonjs/* (the domain
 *                             layer stays engine-free).
 *   - pointer-lock-owner      only the play-focus owner locks or unlocks the pointer
 *                             (Phase 2); standalone fallbacks are allowlisted.
 *   - npc-identity            no `.mesh.name` for identity (Phase 3): NPCs have `key`
 *                             (stable, saved), `actorId` (runtime) and `displayName`.
 *                             The map editor's own entities are allowlisted.
 *   - feature-imports-feature a feature (src/features/<name>/) must not import another
 *                             feature's code; shared service keys live in
 *                             features/services.ts.  Type-only imports are fine.
 *
 *  Ratchets (error when a count goes UP from tools/guardrails-baseline.json;
 *  a note when it goes down, so the baseline can be tightened with --update):
 *   - game-ts-lines           size of src/game.ts (the overhaul shrinks it)
 *   - unseeded-random         Math.random outside the RNG allowlist (calls, and
 *                             references such as a default `rng = Math.random`)
 *   - composition-root-lines  game.ts plus src/game/ (not tests): what is left to
 *                             become features
 *   - callback-properties     `x.onY = ` wiring in the composition root (src/game.ts
 *                             and src/game/), to become events and services
 *   - babylon-gui-files       src/ files importing @babylonjs/gui (to become Preact)
 *   - borrowed-names          names taken from The Elder Scrolls (BORROWED_NAMES) in
 *                             src/ (tests and comments included) and the README, to
 *                             reach zero (docs/original-setting-plan.md)
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

/**
 * Where pointer lock may change: the PlayFocus wiring (src/game/game-state.ts), and the
 * dialogue / inventory systems' fallbacks for when they run without a game.
 */
const POINTER_LOCK_ALLOWLIST = ["src/game/game-state.ts", "src/systems/dialogue-system.ts", "src/systems/inventory-system.ts"];

/** Files whose `.mesh.name` reads are not NPC identity (the editor's own entities). */
const MESH_NAME_ALLOWLIST = ["src/systems/map-editor-system.ts"];

/** Files allowed to call Math.random (the RNG module, which seeds everything else). */
const RANDOM_ALLOWLIST = [/^src\/core\/rng\//];

/**
 * Names that belong to The Elder Scrolls (places, peoples, characters, the
 * shouts, diseases, ingredients and the rest), matched as whole words, any case.
 */
export const BORROWED_NAMES = [
  "Skyrim", "Oblivion", "Tamriel", "Cyrodiil", "Whiterun", "Dragonsreach", "Bethesda", "Elder Scrolls",
  "Septim", "Daedric", "Daedra", "Thu'um", "Dragonborn", "Draugr", "Dwemer", "Falmer",
  "Argonian", "Khajiit", "Altmer", "Bosmer", "Dunmer", "Orsimer", "Redguard", "Nord", "Nords", "Breton",
  "Lydia", "Aela", "J'zargo", "Jenassa", "Farkas", "Borgakh", "Marcurio", "Uthgerd",
  "Atronach", "Nightblade", "Spellsword", "Battlemage", "Mysticism", "Fus Ro", "soul gem", "soul gems",
  "Harrada", "Clannfear", "Spiddal", "Cairn Bolete", "Imp Gall", "Wisp Stalk",
  "Witbane", "Collywobbles", "Rust Chancre", "Porphyric", "Yellow Tick", "Swamp Rot", "Brain Rot",
  "Oakflesh", "Guardian Stone", "Guardian Stones",
  "Morrowind", "Shadowmere", "Riften", "Windhelm", "Markarth", "Winterhold", "Falkreath", "Morthal", "Dawnstar",
  "Riverwood", "Helgen", "Kvatch", "Bruma", "Chorrol", "Cheydinhal", "Leyawiin", "Skingrad", "Bravil",
  "Nirnroot", "Skooma", "Sweetroll", "Housecarl", "Jarl", "Sovngarde", "Akatosh", "Faendal", "Skulvar", "Vivec",
];
// Letters (and apostrophes) bound a name; digits and underscores don't, so ids like
// "whiterun_guard" count too.
const BORROWED_RE = new RegExp(`(?<![A-Za-z'])(?:${BORROWED_NAMES.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![A-Za-z'])`, "gi");

/** Borrowed names in `text`. */
export function countBorrowed(text) {
  return (text.match(BORROWED_RE) ?? []).length;
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith(".d.ts")) out.push(p);
  }
  return out;
}

/** Every .ts/.tsx under `dir`, tests included. */
function walkAll(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkAll(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".d.ts")) out.push(p);
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
    // Babylon barrels pull whole folders into the start-up bundle (the Physics
    // barrel brought the v1 Ammo/Cannon/Oimo plugins; "@babylonjs/loaders/glTF"
    // registers glTF 1.0 and every extension, FlowGraph with them): import the
    // module that defines the thing, and models through rendering/gltf-loading.
    for (const m of code.matchAll(/^\s*import\s+(type\s+)?(?:[^;]*?from\s+)?["'](@babylonjs\/(?:core|loaders|gui|materials|serializers)(?:\/(?:Physics|Particles|Materials|Meshes|Misc|Engines|Loading|PostProcesses|Rendering|Lights|Cameras|Behaviors|Gizmos|Debug|Audio|AudioV2|glTF|glTF\/2\.0|glTF\/2\.0\/Extensions|FlowGraph))?)["']/gm)) {
      if (!m[1]) violations.push({ rule: "babylon-barrel-import", file: f.path, detail: m[2] });
    }
    if (/\b(requestPointerLock|exitPointerLock)\s*\(/.test(code) && !POINTER_LOCK_ALLOWLIST.includes(f.path)) {
      violations.push({ rule: "pointer-lock-owner", file: f.path });
    }
    const feature = /^src\/features\/([^/]+)\//.exec(f.path)?.[1];
    if (feature) {
      for (const m of code.matchAll(/^\s*import\s+(type\s+)?[^;]*?from\s+["']\.\.\/(?!\.\.\/)([^/"']+)\/[^"']*["']/gm)) {
        if (!m[1] && m[2] !== feature) violations.push({ rule: "feature-imports-feature", file: f.path, detail: `imports ../${m[2]}/` });
      }
    }
    if (/\.mesh\.name\b/.test(code) && !MESH_NAME_ALLOWLIST.includes(f.path)) {
      violations.push({ rule: "npc-identity", file: f.path });
    }
    if (!RANDOM_ALLOWLIST.some((re) => re.test(f.path))) {
      const n = (code.match(/Math\.random\b/g) ?? []).length;
      if (n) { unseededRandom += n; randomByFile[f.path] = n; }
    }
    if (/from\s+["']@babylonjs\/gui/.test(code)) babylonGuiFiles++;
  }

  const game = files.find((f) => f.path === "src/game.ts");
  const gameLines = game ? game.text.split("\n").length : 0;
  // The composition root: game.ts and src/game/ (wiring moved there still counts).
  const root = files.filter((f) => f.path === "src/game.ts" || (f.path.startsWith("src/game/") && !/\.test\.tsx?$/.test(f.path)));
  // All of it, not only game.ts: moving code into src/game/ is not removing it.
  const rootLines = root.reduce((n, f) => n + f.text.split("\n").length, 0);
  const callbackProps = root.reduce((n, f) =>
    n + (stripComments(f.text).match(/^\s*(?:this\.|game\.|gi\.)?\w+(?:\.\w+)*\.on[A-Z]\w*\s*=(?!=)/gm) ?? []).length, 0);

  // Borrowed names: all of src/ (tests and comments too) and the README.
  const borrowedByFile = {};
  let borrowed = 0;
  const everything = [...walkAll(SRC), join(ROOT, "README.md")];
  for (const p of everything) {
    const n = countBorrowed(readFileSync(p, "utf8"));
    if (n) { borrowed += n; borrowedByFile[rel(p)] = n; }
  }

  return {
    violations,
    borrowedByFile,
    counts: {
      "game-ts-lines": gameLines,
      "composition-root-lines": rootLines,
      "unseeded-random": unseededRandom,
      "callback-properties": callbackProps,
      "babylon-gui-files": babylonGuiFiles,
      "borrowed-names": borrowed,
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
    console.error(`✖ ${v.rule}: ${v.file}${v.detail ? ` (${v.detail})` : ""}`);
    failed = true;
  }
  for (const [key, now] of Object.entries(report.counts)) {
    const was = baseline.counts?.[key];
    if (was === undefined) {
      console.log(`• ${key}: ${now} (no baseline — run with --update)`);
    } else if (now > was + (SLACK[key] ?? 0)) {
      console.error(`✖ ${key}: ${now} > baseline ${was}${SLACK[key] ? ` + ${SLACK[key]} slack` : ""} (this should only go down)`);
      if (key === "borrowed-names") {
        console.error("  The setting is the game's own (docs/original-setting-plan.md). Per file:", report.borrowedByFile);
      }
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
