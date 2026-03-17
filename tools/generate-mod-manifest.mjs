#!/usr/bin/env node
/**
 * generate-mod-manifest.mjs
 *
 * CLI tool for generating a Camelot mod manifest (manifest.json) from one or
 * more individual mod JSON files.
 *
 * Each mod file must be a JSON object with at least an `id` field and a
 * `content` object, matching the `RpgMod` interface used by ModLoader.
 *
 * Usage:
 *   node tools/generate-mod-manifest.mjs [options] <mod1.json> [mod2.json ...]
 *
 * Options:
 *   --output <path>   Write the manifest to <path> instead of stdout.
 *                     Intermediate directories must already exist.
 *   --disabled        Mark all generated entries as enabled: false.
 *   -h, --help        Print this help text and exit.
 *
 * Output format:
 *   {
 *     "mods": [
 *       { "id": "<mod-id>", "url": "<relative-path>" },
 *       ...
 *     ]
 *   }
 *
 * The `url` field in each entry is the path provided on the command line
 * (i.e. relative to wherever the manifest will be served from).
 *
 * Exit codes:
 *   0  — manifest generated successfully
 *   1  — one or more mod files failed validation
 *   2  — usage / file-read error
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// ── CLI arg parsing ───────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
  printHelp();
  process.exit(args.length === 0 ? 2 : 0);
}

let outputPath = null;
let disabled   = false;
const modPaths = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--output") {
    if (!args[i + 1]) {
      console.error("Error: --output requires a path argument.");
      process.exit(2);
    }
    outputPath = resolve(args[++i]);
  } else if (args[i] === "--disabled") {
    disabled = true;
  } else if (args[i].startsWith("--")) {
    console.error(`Error: unknown option "${args[i]}". Run with --help for usage.`);
    process.exit(2);
  } else {
    modPaths.push(args[i]);
  }
}

if (modPaths.length === 0) {
  console.error("Error: at least one mod JSON file path is required.");
  printHelp();
  process.exit(2);
}

// ── Read + validate each mod file ─────────────────────────────────────────────

const issues  = [];
const entries = [];

for (const modPath of modPaths) {
  const absPath = resolve(modPath);
  let raw;
  try {
    raw = readFileSync(absPath, "utf8");
  } catch (err) {
    issues.push(`${modPath}: cannot read file — ${err.message}`);
    continue;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    issues.push(`${modPath}: invalid JSON — ${err.message}`);
    continue;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    issues.push(`${modPath}: must be a JSON object.`);
    continue;
  }

  // Validate required fields
  const modId = parsed.id;
  if (typeof modId !== "string" || modId.trim() === "") {
    issues.push(`${modPath}: "id" field is missing or empty.`);
    continue;
  }

  if (!parsed.content || typeof parsed.content !== "object" || Array.isArray(parsed.content)) {
    issues.push(`${modPath}: "content" field is missing or not an object.`);
    continue;
  }

  // Check for duplicate ids within this run
  const existingEntry = entries.find(e => e.id === modId.trim());
  if (existingEntry) {
    issues.push(`${modPath}: duplicate mod id "${modId.trim()}" (already registered from another file).`);
    continue;
  }

  const entry = { id: modId.trim(), url: modPath };
  if (disabled) entry.enabled = false;

  entries.push(entry);
  console.log(`  ✓  ${modId.trim()}  (${modPath})`);
}

// ── Report issues ─────────────────────────────────────────────────────────────

if (issues.length > 0) {
  console.error("\nValidation errors:");
  for (const issue of issues) {
    console.error(`  ✗  ${issue}`);
  }
  console.error(`\n${issues.length} error(s). Manifest not written.\n`);
  process.exit(1);
}

// ── Build + write manifest ────────────────────────────────────────────────────

const manifest = { mods: entries };
const json = JSON.stringify(manifest, null, 2) + "\n";

if (outputPath) {
  try {
    writeFileSync(outputPath, json, "utf8");
    console.log(`\n✓ Manifest written to ${outputPath} (${entries.length} mod(s)).\n`);
  } catch (err) {
    console.error(`Error: cannot write to "${outputPath}": ${err.message}`);
    process.exit(2);
  }
} else {
  process.stdout.write(json);
}

process.exit(0);

// ── Helpers ───────────────────────────────────────────────────────────────────

function printHelp() {
  console.log(`
Camelot Mod Manifest Generator

Usage:
  node tools/generate-mod-manifest.mjs [options] <mod1.json> [mod2.json ...]

Options:
  --output <path>   Write the manifest to <path> (default: stdout).
  --disabled        Mark all entries as enabled: false in the manifest.
  -h, --help        Show this help text.

Each mod file must be a JSON object with:
  • "id"      — unique string identifier for the mod
  • "content" — object containing the mod's content data

Exit codes:
  0  — success
  1  — validation errors in one or more mod files
  2  — usage or file I/O error
`);
}
