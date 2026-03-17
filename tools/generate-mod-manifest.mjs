#!/usr/bin/env node
/**
 * generate-mod-manifest.mjs
 *
 * Scans a directory for Camelot mod files (`*.json`) and generates (or
 * updates) a `mods-manifest.json` file that the `ModLoader` can consume.
 *
 * Usage:
 *   node tools/generate-mod-manifest.mjs <mods-dir> [options]
 *
 * Arguments:
 *   mods-dir         Path to the directory containing mod JSON files.
 *                    Defaults to `public/mods` relative to the cwd.
 *
 * Options:
 *   --out <file>     Path for the generated manifest.
 *                    Defaults to `<mods-dir>/mods-manifest.json`.
 *   --enabled        Mark all discovered mods as enabled: true (default: omit field).
 *   --disabled       Mark all discovered mods as enabled: false.
 *   --merge          Merge with an existing manifest (preserve enabled state).
 *                    Without this flag the manifest is fully regenerated.
 *   --dry-run        Print the manifest to stdout without writing a file.
 *   --json           Print the result as pretty JSON (implies --dry-run output format).
 *   --help           Show this help text.
 *
 * Conventions for mod files:
 *   - Each `*.json` file in the directory is considered a mod.
 *   - The manifest filename itself (`mods-manifest.json`) is excluded.
 *   - The mod `id` is taken from the top-level `"id"` field inside the JSON.
 *     If the file has no `"id"`, the filename stem (without extension) is used.
 *   - The manifest `url` is the filename relative to the manifest location.
 *
 * Exit codes:
 *   0  Manifest written (or dry-run succeeded).
 *   1  Directory does not exist or contains no discoverable mods.
 *   2  I/O or JSON parse error.
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { resolve, join, relative, basename, extname } from "node:path";

// ── Parse CLI arguments ───────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(`
Usage: generate-mod-manifest.mjs [mods-dir] [options]

Arguments:
  mods-dir         Directory containing *.json mod files
                   (default: public/mods)

Options:
  --out <file>     Output manifest path
                   (default: <mods-dir>/mods-manifest.json)
  --enabled        Mark all mods as enabled: true
  --disabled       Mark all mods as enabled: false
  --merge          Preserve enabled state from an existing manifest
  --dry-run        Print manifest to stdout without writing
  --json           Alias for --dry-run (machine-readable JSON output)
  --help           Show this help
`);
  process.exit(0);
}

const dryRun   = args.includes("--dry-run") || args.includes("--json");
const doMerge  = args.includes("--merge");
const setEnabled  = args.includes("--enabled")  ? true  : undefined;
const setDisabled = args.includes("--disabled") ? false : undefined;
const enabledFlag = setDisabled !== undefined ? false : setEnabled; // undefined = omit

// --out argument
const outIdx = args.indexOf("--out");
const outValue = outIdx !== -1 ? args[outIdx + 1] : undefined;

// Positional argument: mods dir (exclude flags and the --out value)
const flagValues = new Set(outValue ? [outValue] : []);
const positionalArgs = args.filter((a, i) => {
  if (a.startsWith("--")) return false;
  if (flagValues.has(a)) { flagValues.delete(a); return false; } // consume --out value once
  return true;
});
const modsDir = positionalArgs[0]
  ? resolve(positionalArgs[0])
  : resolve(process.cwd(), "public/mods");

const outFile = outValue
  ? resolve(outValue)
  : join(modsDir, "mods-manifest.json");

const manifestFilename = basename(outFile);

// ── Validate input directory ──────────────────────────────────────────────────

if (!existsSync(modsDir) || !statSync(modsDir).isDirectory()) {
  console.error(`Error: directory not found: ${modsDir}`);
  process.exit(1);
}

// ── Discover mod files ────────────────────────────────────────────────────────

/** @typedef {{ id: string; url: string; enabled?: boolean }} ModEntry */

let files;
try {
  // Always exclude the default manifest name + the chosen output filename
  const excludedNames = new Set([manifestFilename, "mods-manifest.json"]);
  files = readdirSync(modsDir).filter(f => {
    if (extname(f) !== ".json") return false;
    if (excludedNames.has(f)) return false;
    return true;
  }).sort();
} catch (err) {
  console.error(`Error reading directory ${modsDir}: ${err.message}`);
  process.exit(2);
}

if (files.length === 0) {
  console.error(`No mod JSON files found in ${modsDir} (excluding manifest).`);
  process.exit(1);
}

// ── Load existing manifest (for --merge) ─────────────────────────────────────

/** @type {Map<string, boolean | undefined>} id → enabled */
const existingEnabledState = new Map();

if (doMerge && existsSync(outFile)) {
  try {
    const raw = readFileSync(outFile, "utf8");
    const existing = JSON.parse(raw);
    if (Array.isArray(existing?.mods)) {
      for (const entry of existing.mods) {
        if (typeof entry.id === "string") {
          existingEnabledState.set(entry.id, entry.enabled);
        }
      }
    }
  } catch {
    // Ignore — treat as if no existing manifest
  }
}

// ── Build manifest entries ────────────────────────────────────────────────────

/** @type {ModEntry[]} */
const mods = [];

for (const file of files) {
  const filePath = join(modsDir, file);
  let modId = basename(file, ".json");

  try {
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.id === "string" && parsed.id.trim() !== "") {
      modId = parsed.id.trim();
    }
  } catch {
    // Use filename stem as fallback id — still include the entry
  }

  const url = relative(modsDir, filePath).replace(/\\/g, "/");

  /** @type {ModEntry} */
  const entry = { id: modId, url };

  if (doMerge && existingEnabledState.has(modId)) {
    // Preserve existing enabled state
    const prev = existingEnabledState.get(modId);
    if (prev !== undefined) entry.enabled = prev;
  } else if (enabledFlag !== undefined) {
    entry.enabled = enabledFlag;
  }

  mods.push(entry);
}

// ── Build manifest ────────────────────────────────────────────────────────────

const manifest = { mods };
const output = JSON.stringify(manifest, null, 2) + "\n";

// ── Output ────────────────────────────────────────────────────────────────────

if (dryRun) {
  process.stdout.write(output);
} else {
  try {
    writeFileSync(outFile, output, "utf8");
    console.log(`Manifest written to ${outFile} (${mods.length} mod(s)).`);
    for (const entry of mods) {
      const status = entry.enabled === true ? " [enabled]" : entry.enabled === false ? " [disabled]" : "";
      console.log(`  ${entry.id} → ${entry.url}${status}`);
    }
  } catch (err) {
    console.error(`Error writing manifest: ${err.message}`);
    process.exit(2);
  }
}

process.exit(0);
