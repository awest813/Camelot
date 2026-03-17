#!/usr/bin/env node
/**
 * validate-bundle.mjs
 *
 * Headless CLI validator for Camelot `.bundle.json` content bundles.
 *
 * Usage:
 *   node tools/validate-bundle.mjs path/to/my.bundle.json
 *   node tools/validate-bundle.mjs path/to/my.bundle.json --json
 *
 * Flags:
 *   --json   Print the full validation report as JSON instead of human-readable text.
 *
 * Exit codes:
 *   0  All checks passed.
 *   1  One or more validation errors were found.
 *   2  The file could not be read or parsed (I/O / JSON error).
 *
 * This script runs entirely in Node.js without a browser and without
 * importing any BabylonJS modules.  It implements the same structural checks
 * that ContentBundleSystem.validate() performs for each system payload, using
 * only plain JavaScript object inspection.
 *
 * Suitable for CI pipelines and pre-commit hooks:
 *   # GitHub Actions step example:
 *   - run: node tools/validate-bundle.mjs dist/my-mod.bundle.json
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ── CLI argument parsing ──────────────────────────────────────────────────────

const args = process.argv.slice(2);
const jsonOutput = args.includes("--json");

if (args.includes("--help") || args.includes("-h")) {
  console.log(`
Usage: validate-bundle.mjs <path-to-bundle.json> [--json]

Arguments:
  path-to-bundle.json   Path to the .bundle.json file to validate.

Options:
  --json                Print the full validation report as JSON.
  --help                Show this help text.

Exit codes:
  0  All checks passed.
  1  One or more validation errors were found.
  2  The file could not be read or parsed (I/O / JSON error).
`);
  process.exit(0);
}

const positionalArgs = args.filter((a) => !a.startsWith("--"));

if (positionalArgs.length === 0) {
  console.error("Usage: validate-bundle.mjs <path-to-bundle.json> [--json]");
  process.exit(2);
}

if (positionalArgs.length > 1) {
  console.error(`Error: expected exactly one file path, got ${positionalArgs.length} positional arguments.`);
  process.exit(2);
}

const filePath = positionalArgs[0];

// ── File I/O ──────────────────────────────────────────────────────────────────

let bundle;
try {
  const raw = readFileSync(resolve(filePath), "utf8");
  bundle = JSON.parse(raw);
} catch (err) {
  console.error(`Error: could not read or parse '${filePath}':\n  ${err.message}`);
  process.exit(2);
}

// ── Schema version check ──────────────────────────────────────────────────────

/**
 * @typedef {{ systemId: string; label: string; valid: boolean; issues: { message: string }[] }} SystemReport
 * @typedef {{ allValid: boolean; systems: SystemReport[]; generatedAt: string }} BundleReport
 */

/** @type {SystemReport[]} */
const reports = [];

function addReport(systemId, label, issues) {
  reports.push({ systemId, label, valid: issues.length === 0, issues: issues.map((m) => ({ message: m })) });
}

// ── Manifest validation ───────────────────────────────────────────────────────

const manifestIssues = [];

if (!bundle || typeof bundle !== "object") {
  console.error("Error: bundle file is not a valid JSON object.");
  process.exit(2);
}

const { manifest } = bundle;
if (!manifest || typeof manifest !== "object") {
  manifestIssues.push("Missing 'manifest' field.");
} else {
  if (manifest.schemaVersion !== 1) {
    manifestIssues.push(`Unsupported schema version: ${manifest.schemaVersion}. Expected 1.`);
  }
  if (typeof manifest.title !== "string" || manifest.title.trim() === "") {
    manifestIssues.push("Manifest 'title' is missing or empty.");
  }
  if (!Array.isArray(manifest.systems)) {
    manifestIssues.push("Manifest 'systems' must be an array.");
  }
}

addReport("manifest", "Manifest", manifestIssues);

// ── Map validation ────────────────────────────────────────────────────────────

if (bundle.map !== undefined) {
  const mapIssues = [];
  const map = bundle.map;

  if (!map || typeof map !== "object") {
    mapIssues.push("'map' payload is not a valid object.");
  } else {
    if (map.version !== 1) mapIssues.push(`Map version should be 1, got ${map.version}.`);
    if (!Array.isArray(map.entries)) {
      mapIssues.push("Map 'entries' must be an array.");
    } else {
      const ids = new Set();
      for (const entry of map.entries) {
        if (!entry.id || typeof entry.id !== "string") {
          mapIssues.push("A map entry is missing a valid 'id' field.");
          continue;
        }
        if (ids.has(entry.id)) {
          mapIssues.push(`Duplicate map entry id: '${entry.id}'.`);
        }
        ids.add(entry.id);
        if (!entry.type) mapIssues.push(`Map entry '${entry.id}' is missing 'type'.`);
        if (!entry.position || typeof entry.position !== "object") {
          mapIssues.push(`Map entry '${entry.id}' is missing 'position'.`);
        }
      }
    }
    if (!Array.isArray(map.patrolRoutes)) {
      mapIssues.push("Map 'patrolRoutes' must be an array.");
    }
  }

  addReport("map", "Map", mapIssues);
}

// ── Quest validation ──────────────────────────────────────────────────────────

if (bundle.quest !== undefined) {
  const questIssues = [];
  const quest = bundle.quest;

  if (!quest || typeof quest !== "object") {
    questIssues.push("'quest' payload is not a valid object.");
  } else {
    if (typeof quest.id !== "string" || quest.id.trim() === "") {
      questIssues.push("Quest is missing a valid 'id'.");
    }
    if (typeof quest.name !== "string" || quest.name.trim() === "") {
      questIssues.push("Quest is missing a valid 'name'.");
    }
    if (!Array.isArray(quest.nodes)) {
      questIssues.push("Quest 'nodes' must be an array.");
    } else if (quest.nodes.length === 0) {
      questIssues.push("Quest has no nodes.");
    } else {
      const nodeIds = new Set(quest.nodes.map((n) => n.id));
      for (const node of quest.nodes) {
        if (!node.id) { questIssues.push("A quest node is missing an 'id'."); continue; }
        if (!node.triggerType) questIssues.push(`Quest node '${node.id}' is missing 'triggerType'.`);
        if (!node.targetId)   questIssues.push(`Quest node '${node.id}' is missing 'targetId'.`);
        if (!Number.isFinite(node.requiredCount) || node.requiredCount < 1) {
          questIssues.push(`Quest node '${node.id}' has invalid 'requiredCount'.`);
        }
        for (const ref of node.nextNodeIds ?? []) {
          if (!nodeIds.has(ref)) questIssues.push(`Quest node '${node.id}' references unknown nextNodeId '${ref}'.`);
        }
        for (const ref of node.prerequisites ?? []) {
          if (!nodeIds.has(ref)) questIssues.push(`Quest node '${node.id}' references unknown prerequisite '${ref}'.`);
        }
      }
    }
  }

  addReport("quest", "Quest", questIssues);
}

// ── Dialogue validation ───────────────────────────────────────────────────────

if (bundle.dialogue !== undefined) {
  const dlgIssues = [];
  const dlg = bundle.dialogue;

  if (!dlg || typeof dlg !== "object") {
    dlgIssues.push("'dialogue' payload is not a valid object.");
  } else {
    if (typeof dlg.id !== "string" || dlg.id.trim() === "") {
      dlgIssues.push("Dialogue is missing a valid 'id'.");
    }
    if (!Array.isArray(dlg.nodes)) {
      dlgIssues.push("Dialogue 'nodes' must be an array.");
    } else if (dlg.nodes.length === 0) {
      dlgIssues.push("Dialogue has no nodes.");
    } else {
      const nodeIds = new Set(dlg.nodes.map((n) => n.id));
      if (dlg.startNodeId && !nodeIds.has(dlg.startNodeId)) {
        dlgIssues.push(`Dialogue startNodeId '${dlg.startNodeId}' does not exist in nodes.`);
      }
      for (const node of dlg.nodes) {
        if (!node.id) { dlgIssues.push("A dialogue node is missing an 'id'."); continue; }
        if (!node.speaker) dlgIssues.push(`Dialogue node '${node.id}' is missing 'speaker'.`);
        if (!node.text)    dlgIssues.push(`Dialogue node '${node.id}' is missing 'text'.`);
      }
    }
  }

  addReport("dialogue", "Dialogue", dlgIssues);
}

// ── Faction validation ────────────────────────────────────────────────────────

if (bundle.faction !== undefined) {
  const factIssues = [];
  const faction = bundle.faction;

  if (!faction || typeof faction !== "object") {
    factIssues.push("'faction' payload is not a valid object.");
  } else {
    if (typeof faction.id !== "string" || faction.id.trim() === "") {
      factIssues.push("Faction is missing a valid 'id'.");
    }
    if (typeof faction.name !== "string" || faction.name.trim() === "") {
      factIssues.push("Faction is missing a valid 'name'.");
    }
    if (!Number.isFinite(faction.defaultReputation)) {
      factIssues.push("Faction 'defaultReputation' must be a finite number.");
    }
  }

  addReport("faction", "Faction", factIssues);
}

// ── Loot table validation ─────────────────────────────────────────────────────

if (bundle.lootTable !== undefined) {
  const ltIssues = [];
  const lt = bundle.lootTable;

  if (!lt || typeof lt !== "object") {
    ltIssues.push("'lootTable' payload is not a valid object.");
  } else {
    if (typeof lt.id !== "string" || lt.id.trim() === "") {
      ltIssues.push("Loot table is missing a valid 'id'.");
    }
    if (!Number.isFinite(lt.rolls) || lt.rolls < 1) {
      ltIssues.push("Loot table 'rolls' must be a positive integer.");
    }
    if (!Array.isArray(lt.entries)) {
      ltIssues.push("Loot table 'entries' must be an array.");
    } else if (lt.entries.length === 0) {
      ltIssues.push("Loot table has no entries.");
    } else {
      for (const entry of lt.entries) {
        if (!entry.itemId) ltIssues.push("A loot table entry is missing 'itemId'.");
        if (!Number.isFinite(entry.weight) || entry.weight <= 0) {
          ltIssues.push(`Loot entry '${entry.itemId ?? "?"}' has invalid 'weight'.`);
        }
      }
    }
  }

  addReport("lootTable", "Loot Table", ltIssues);
}

// ── NPC validation ────────────────────────────────────────────────────────────

if (bundle.npc !== undefined) {
  const npcIssues = [];
  const npc = bundle.npc;

  if (!npc || typeof npc !== "object") {
    npcIssues.push("'npc' payload is not a valid object.");
  } else {
    if (typeof npc.id !== "string" || npc.id.trim() === "") {
      npcIssues.push("NPC is missing a valid 'id'.");
    }
    if (typeof npc.name !== "string" || npc.name.trim() === "") {
      npcIssues.push("NPC is missing a valid 'name'.");
    }
    if (typeof npc.role !== "string" || npc.role.trim() === "") {
      npcIssues.push("NPC is missing a valid 'role'.");
    }
  }

  addReport("npc", "NPC", npcIssues);
}

// ── Item validation ───────────────────────────────────────────────────────────

if (bundle.item !== undefined) {
  const itemIssues = [];
  const item = bundle.item;

  if (!item || typeof item !== "object") {
    itemIssues.push("'item' payload is not a valid object.");
  } else {
    if (typeof item.id !== "string" || item.id.trim() === "") {
      itemIssues.push("Item is missing a valid 'id'.");
    }
    if (typeof item.name !== "string" || item.name.trim() === "") {
      itemIssues.push("Item is missing a valid 'name'.");
    }
    if (typeof item.description !== "string") {
      itemIssues.push("Item 'description' must be a string.");
    }
  }

  addReport("item", "Item", itemIssues);
}

// ── Spawn validation ──────────────────────────────────────────────────────────

if (bundle.spawn !== undefined) {
  const spawnIssues = [];
  const spawn = bundle.spawn;

  if (!spawn || typeof spawn !== "object") {
    spawnIssues.push("'spawn' payload is not a valid object.");
  } else {
    if (typeof spawn.id !== "string" || spawn.id.trim() === "") {
      spawnIssues.push("Spawn group is missing a valid 'id'.");
    }
    if (!Array.isArray(spawn.entries)) {
      spawnIssues.push("Spawn group 'entries' must be an array.");
    } else if (spawn.entries.length === 0) {
      spawnIssues.push("Spawn group has no entries.");
    } else {
      for (const entry of spawn.entries) {
        if (!entry.archetypeId) spawnIssues.push("A spawn entry is missing 'archetypeId'.");
        if (!Number.isFinite(entry.count) || entry.count < 1) {
          spawnIssues.push(`Spawn entry '${entry.archetypeId ?? "?"}' has invalid 'count'.`);
        }
      }
    }
  }

  addReport("spawn", "Spawn Group", spawnIssues);
}

// ── Build final report ────────────────────────────────────────────────────────

/** @type {BundleReport} */
const report = {
  allValid: reports.every((r) => r.valid),
  systems: reports,
  generatedAt: new Date().toISOString(),
};

// ── Output ────────────────────────────────────────────────────────────────────

if (jsonOutput) {
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
} else {
  const titleStr = manifest?.title ? ` — ${manifest.title}` : "";
  console.log(`\nCamelot Bundle Validator${titleStr}`);
  console.log(`File: ${filePath}`);
  console.log(`─`.repeat(50));

  for (const sys of report.systems) {
    const icon = sys.valid ? "✔" : "✘";
    console.log(`${icon} ${sys.label}`);
    for (const issue of sys.issues) {
      console.log(`    • ${issue.message}`);
    }
  }

  console.log(`─`.repeat(50));
  if (report.allValid) {
    console.log("Result: PASS — bundle is valid.\n");
  } else {
    const errorCount = report.systems.reduce((n, s) => n + s.issues.length, 0);
    console.log(`Result: FAIL — ${errorCount} issue(s) found.\n`);
  }
}

process.exit(report.allValid ? 0 : 1);
