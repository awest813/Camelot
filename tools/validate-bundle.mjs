#!/usr/bin/env node
/**
 * validate-bundle.mjs
 *
 * Headless CLI validator for Camelot .bundle.json content files.
 *
 * Usage:
 *   node tools/validate-bundle.mjs <path/to/file.bundle.json>
 *
 * Exit codes:
 *   0  — all systems valid
 *   1  — one or more validation errors found
 *   2  — usage / file-read error
 *
 * Suitable for CI pipelines and pre-commit hooks.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ── CLI arg parsing ───────────────────────────────────────────────────────────

const [, , bundlePath, ...extra] = process.argv;

if (!bundlePath || extra.length > 0 || bundlePath === "--help" || bundlePath === "-h") {
  console.error("Usage: node tools/validate-bundle.mjs <path/to/file.bundle.json>");
  process.exit(2);
}

// ── Read + parse ──────────────────────────────────────────────────────────────

let raw;
try {
  raw = readFileSync(resolve(bundlePath), "utf8");
} catch (err) {
  console.error(`Error: cannot read file "${bundlePath}": ${err.message}`);
  process.exit(2);
}

let bundle;
try {
  bundle = JSON.parse(raw);
} catch (err) {
  console.error(`Error: invalid JSON in "${bundlePath}": ${err.message}`);
  process.exit(2);
}

// ── Validation helpers ────────────────────────────────────────────────────────

/** Collect issues per system. */
const report = [];

function addSystem(systemId, label, issues) {
  report.push({ systemId, label, valid: issues.length === 0, issues });
}

function requiredString(obj, field, path) {
  const issues = [];
  if (obj[field] === undefined || obj[field] === null) {
    issues.push(`${path}: missing required field "${field}"`);
  } else if (typeof obj[field] !== "string") {
    issues.push(`${path}: field "${field}" must be a string`);
  } else if (obj[field].trim() === "") {
    issues.push(`${path}: field "${field}" must not be empty`);
  }
  return issues;
}

function requiredNumber(obj, field, path) {
  const issues = [];
  if (obj[field] === undefined || obj[field] === null) {
    issues.push(`${path}: missing required field "${field}"`);
  } else if (typeof obj[field] !== "number" || !Number.isFinite(obj[field])) {
    issues.push(`${path}: field "${field}" must be a finite number`);
  }
  return issues;
}

function requiredArray(obj, field, path) {
  const issues = [];
  if (!Array.isArray(obj[field])) {
    issues.push(`${path}: field "${field}" must be an array`);
  }
  return issues;
}

// ── 1. Manifest validation ────────────────────────────────────────────────────

const VALID_SYSTEMS = new Set(["map", "quest", "dialogue", "faction", "lootTable", "npc", "item", "spawn"]);

(function validateManifest() {
  const issues = [];
  const m = bundle.manifest;

  if (!m || typeof m !== "object") {
    issues.push('Top-level "manifest" object is missing or not an object');
    addSystem("manifest", "Manifest", issues);
    return;
  }

  if (m.schemaVersion !== 1) {
    issues.push(`manifest.schemaVersion must be 1, got ${JSON.stringify(m.schemaVersion)}`);
  }

  issues.push(...requiredString(m, "title", "manifest"));
  issues.push(...requiredString(m, "author", "manifest"));
  issues.push(...requiredString(m, "exportedAt", "manifest"));

  if (!Array.isArray(m.systems)) {
    issues.push('manifest.systems must be an array');
  } else {
    for (const s of m.systems) {
      if (!VALID_SYSTEMS.has(s)) {
        issues.push(`manifest.systems contains unknown system id "${s}"`);
      }
    }
  }

  addSystem("manifest", "Manifest", issues);
})();

// ── 2. Cross-check manifest.systems vs present keys ───────────────────────────

if (Array.isArray(bundle.manifest?.systems)) {
  const declaredSystems = bundle.manifest.systems;
  const crossIssues = [];

  for (const sid of declaredSystems) {
    if (!(sid in bundle)) {
      crossIssues.push(`manifest.systems declares "${sid}" but no "${sid}" key exists in the bundle`);
    }
  }

  // Warn about extra system keys not listed in manifest
  for (const sid of VALID_SYSTEMS) {
    if (sid in bundle && !declaredSystems.includes(sid)) {
      crossIssues.push(`bundle contains "${sid}" data but manifest.systems does not list it`);
    }
  }

  if (crossIssues.length > 0) {
    addSystem("manifest-cross", "Manifest Cross-Check", crossIssues);
  }
}

// ── 3. Per-system validation ──────────────────────────────────────────────────

// Quest
if ("quest" in bundle) {
  const issues = [];
  const q = bundle.quest;
  if (!q || typeof q !== "object") {
    issues.push('quest: must be an object');
  } else {
    issues.push(...requiredString(q, "id", "quest"));
    issues.push(...requiredString(q, "name", "quest"));
    issues.push(...requiredArray(q, "nodes", "quest"));

    if (Array.isArray(q.nodes)) {
      const nodeIds = new Set();
      for (let i = 0; i < q.nodes.length; i++) {
        const n = q.nodes[i];
        const p = `quest.nodes[${i}]`;
        if (!n || typeof n !== "object") { issues.push(`${p}: must be an object`); continue; }
        issues.push(...requiredString(n, "id", p));
        issues.push(...requiredString(n, "targetId", p));
        if (n.id && nodeIds.has(n.id)) {
          issues.push(`quest: duplicate node id "${n.id}"`);
        }
        if (n.id) nodeIds.add(n.id);
        if (n.requiredCount !== undefined && (typeof n.requiredCount !== "number" || n.requiredCount < 1)) {
          issues.push(`${p}: requiredCount must be a positive integer`);
        }
        // Check prerequisites reference valid nodes
        if (Array.isArray(n.prerequisites)) {
          for (const prereq of n.prerequisites) {
            if (!q.nodes.some(other => other.id === prereq)) {
              issues.push(`${p}: prerequisite "${prereq}" does not reference a known node`);
            }
          }
        }
      }
    }
  }
  addSystem("quest", "Quest", issues);
}

// Dialogue
if ("dialogue" in bundle) {
  const issues = [];
  const d = bundle.dialogue;
  if (!d || typeof d !== "object") {
    issues.push('dialogue: must be an object');
  } else {
    issues.push(...requiredString(d, "id", "dialogue"));
    issues.push(...requiredString(d, "startNodeId", "dialogue"));
    issues.push(...requiredArray(d, "nodes", "dialogue"));

    if (Array.isArray(d.nodes) && typeof d.startNodeId === "string") {
      const nodeIds = new Set(d.nodes.map(n => n?.id).filter(Boolean));
      if (!nodeIds.has(d.startNodeId)) {
        issues.push(`dialogue.startNodeId "${d.startNodeId}" does not match any node id`);
      }
      for (let i = 0; i < d.nodes.length; i++) {
        const n = d.nodes[i];
        const p = `dialogue.nodes[${i}]`;
        if (!n || typeof n !== "object") { issues.push(`${p}: must be an object`); continue; }
        issues.push(...requiredString(n, "id", p));
        if (Array.isArray(n.choices)) {
          for (let j = 0; j < n.choices.length; j++) {
            const c = n.choices[j];
            const cp = `${p}.choices[${j}]`;
            if (!c || typeof c !== "object") { issues.push(`${cp}: must be an object`); continue; }
            issues.push(...requiredString(c, "id", cp));
            if (c.nextNodeId && !nodeIds.has(c.nextNodeId)) {
              issues.push(`${cp}: nextNodeId "${c.nextNodeId}" does not reference a known node`);
            }
          }
        }
      }
    }
  }
  addSystem("dialogue", "Dialogue", issues);
}

// Faction
if ("faction" in bundle) {
  const issues = [];
  const f = bundle.faction;
  if (!f || typeof f !== "object") {
    issues.push('faction: must be an object');
  } else {
    issues.push(...requiredString(f, "id", "faction"));
    issues.push(...requiredString(f, "name", "faction"));
    issues.push(...requiredNumber(f, "hostileBelow", "faction"));
    issues.push(...requiredNumber(f, "friendlyAt", "faction"));
    issues.push(...requiredNumber(f, "alliedAt", "faction"));
    if (
      typeof f.hostileBelow === "number" &&
      typeof f.friendlyAt  === "number" &&
      typeof f.alliedAt    === "number"
    ) {
      if (f.hostileBelow >= f.friendlyAt) {
        issues.push(`faction: hostileBelow (${f.hostileBelow}) must be less than friendlyAt (${f.friendlyAt})`);
      }
      if (f.friendlyAt >= f.alliedAt) {
        issues.push(`faction: friendlyAt (${f.friendlyAt}) must be less than alliedAt (${f.alliedAt})`);
      }
    }
    if (Array.isArray(f.relations)) {
      const seen = new Set();
      for (let i = 0; i < f.relations.length; i++) {
        const r = f.relations[i];
        const p = `faction.relations[${i}]`;
        issues.push(...requiredString(r, "targetId", p));
        if (r.targetId === f.id) {
          issues.push(`${p}: self-referencing relation (targetId equals faction id)`);
        }
        if (r.targetId && seen.has(r.targetId)) {
          issues.push(`faction: duplicate relation targetId "${r.targetId}"`);
        }
        if (r.targetId) seen.add(r.targetId);
      }
    }
  }
  addSystem("faction", "Faction", issues);
}

// Loot Table
if ("lootTable" in bundle) {
  const issues = [];
  const lt = bundle.lootTable;
  if (!lt || typeof lt !== "object") {
    issues.push('lootTable: must be an object');
  } else {
    issues.push(...requiredString(lt, "id", "lootTable"));
    if (lt.rolls !== undefined && (typeof lt.rolls !== "number" || lt.rolls < 1)) {
      issues.push('lootTable: rolls must be a positive integer');
    }
    if (Array.isArray(lt.entries)) {
      for (let i = 0; i < lt.entries.length; i++) {
        const e = lt.entries[i];
        const p = `lootTable.entries[${i}]`;
        if (!e.itemId && !e.subTableId) {
          issues.push(`${p}: must have either itemId or subTableId`);
        }
        if (e.weight !== undefined && (typeof e.weight !== "number" || e.weight < 0)) {
          issues.push(`${p}: weight must be a non-negative number`);
        }
      }
    }
  }
  addSystem("lootTable", "Loot Table", issues);
}

// NPC
if ("npc" in bundle) {
  const issues = [];
  const npc = bundle.npc;
  if (!npc || typeof npc !== "object") {
    issues.push('npc: must be an object');
  } else {
    issues.push(...requiredString(npc, "id", "npc"));
    issues.push(...requiredString(npc, "name", "npc"));
    if (npc.baseHealth !== undefined && (typeof npc.baseHealth !== "number" || npc.baseHealth <= 0)) {
      issues.push('npc: baseHealth must be a positive number');
    }
  }
  addSystem("npc", "NPC", issues);
}

// Item
if ("item" in bundle) {
  const issues = [];
  const item = bundle.item;
  if (!item || typeof item !== "object") {
    issues.push('item: must be an object');
  } else {
    issues.push(...requiredString(item, "id", "item"));
    issues.push(...requiredString(item, "name", "item"));
  }
  addSystem("item", "Item", issues);
}

// Spawn
if ("spawn" in bundle) {
  const issues = [];
  const sp = bundle.spawn;
  if (!sp || typeof sp !== "object") {
    issues.push('spawn: must be an object');
  } else {
    issues.push(...requiredString(sp, "id", "spawn"));
    if (sp.count !== undefined && (typeof sp.count !== "number" || sp.count < 1)) {
      issues.push('spawn: count must be a positive integer');
    }
  }
  addSystem("spawn", "Spawn Group", issues);
}

// Map (basic structure check only — map data has no creator-system-style import in CLI context)
if ("map" in bundle) {
  const issues = [];
  const m = bundle.map;
  if (!m || typeof m !== "object") {
    issues.push('map: must be an object');
  } else {
    if (!Array.isArray(m.entities)) {
      issues.push('map: "entities" must be an array');
    }
  }
  addSystem("map", "Map", issues);
}

// ── Print report ──────────────────────────────────────────────────────────────

const totalSystems = report.length;
const failedSystems = report.filter((r) => !r.valid);
const allValid = failedSystems.length === 0;

console.log(`\nCamelot Bundle Validator — ${bundlePath}`);
console.log("─".repeat(60));

for (const sys of report) {
  const icon = sys.valid ? "✓" : "✗";
  console.log(`  ${icon}  ${sys.label}`);
  for (const issue of sys.issues) {
    console.log(`       • ${issue}`);
  }
}

console.log("─".repeat(60));
console.log(
  allValid
    ? `  All ${totalSystems} checks passed.\n`
    : `  ${failedSystems.length}/${totalSystems} checks failed.\n`,
);

process.exit(allValid ? 0 : 1);
