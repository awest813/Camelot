import type { MapEditorSystem, MapExportData } from "./map-editor-system";
import type { QuestCreatorSystem } from "./quest-creator-system";
import type { DialogueCreatorSystem } from "./dialogue-creator-system";
import type { FactionCreatorSystem } from "./faction-creator-system";
import type { LootTableCreatorSystem } from "./loot-table-creator-system";
import type { NpcCreatorSystem } from "./npc-creator-system";
import type { ItemCreatorSystem } from "./item-creator-system";
import type { SpawnCreatorSystem } from "./spawn-creator-system";

// ── Validation report types ───────────────────────────────────────────────────

/** A normalised diagnostic entry from any content system. */
export interface BundleIssue {
  /** Human-readable description of the problem. */
  message: string;
}

/** Per-system validation summary inside a bundle report. */
export interface BundleSystemReport {
  /** Stable system identifier. */
  systemId: BundleSystemId;
  /** Display name shown in the dashboard. */
  label: string;
  /** Whether this system passed validation with zero issues. */
  valid: boolean;
  /** List of normalised issues (empty when valid). */
  issues: BundleIssue[];
}

/** Overall validation result across all attached systems. */
export interface ContentBundleReport {
  /** True only when every system passes validation. */
  allValid: boolean;
  /** Per-system breakdown. */
  systems: BundleSystemReport[];
  /** ISO-8601 timestamp of when the report was generated. */
  generatedAt: string;
}

// ── Bundle export types ───────────────────────────────────────────────────────

export type BundleSystemId =
  | "map"
  | "quest"
  | "dialogue"
  | "faction"
  | "lootTable"
  | "npc"
  | "item"
  | "spawn";

/** Manifest embedded at the top of every exported bundle. */
export interface ContentBundleManifest {
  schemaVersion: 1;
  /** Human-readable title for this content bundle. */
  title: string;
  /** Optional short description. */
  description: string;
  /** Author / publisher name. */
  author: string;
  /** ISO-8601 creation timestamp. */
  exportedAt: string;
  /** Set of system IDs included in this bundle. */
  systems: BundleSystemId[];
}

/** The complete exportable content bundle. */
export interface ContentBundleExport {
  manifest: ContentBundleManifest;
  /** Serialised map export, if a MapEditorSystem was attached. */
  map?: MapExportData;
  /** Serialised quest definition JSON (parsed object). */
  quest?: unknown;
  /** Serialised dialogue definition JSON (parsed object). */
  dialogue?: unknown;
  /** Serialised faction definition JSON (parsed object). */
  faction?: unknown;
  /** Serialised loot table definition JSON (parsed object). */
  lootTable?: unknown;
  /** Serialised NPC archetype definition JSON (parsed object). */
  npc?: unknown;
  /** Serialised item definition JSON (parsed object). */
  item?: unknown;
  /** Serialised spawn group definition JSON (parsed object). */
  spawn?: unknown;
}

// ── Play-from-here harness ────────────────────────────────────────────────────

/**
 * Lightweight config returned by `getPlayFromHereConfig`.
 * The game layer reads this to open the relevant creator UI.
 */
export interface PlayFromHereConfig {
  systemId: BundleSystemId;
  /** Suggested window title / notification text. */
  label: string;
}

// ── Attached system registry ──────────────────────────────────────────────────

export interface ContentBundleSystems {
  map?: MapEditorSystem;
  quest?: QuestCreatorSystem;
  dialogue?: DialogueCreatorSystem;
  faction?: FactionCreatorSystem;
  lootTable?: LootTableCreatorSystem;
  npc?: NpcCreatorSystem;
  item?: ItemCreatorSystem;
  spawn?: SpawnCreatorSystem;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Recursively sort object keys so that exported JSON is stable and
 * diff-friendly regardless of insertion order.
 */
export function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = sortKeysDeep(obj[key]);
    }
    return sorted;
  }
  return value;
}

/** Serialise a value as indented JSON with deterministic key ordering. */
export function toNormalizedJson(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value), null, 2);
}

// ── System ────────────────────────────────────────────────────────────────────

/** Bundle metadata used to configure the manifest on export. */
export interface ContentBundleMeta {
  title: string;
  description: string;
  author: string;
}

const BLANK_META: ContentBundleMeta = { title: "", description: "", author: "" };

/**
 * Headless aggregation layer for all content creator systems.
 *
 * - `attach*()` methods register each individual creator system.
 * - `validate()` runs every attached system's validator and returns a
 *   unified `ContentBundleReport`.
 * - `exportBundle()` serialises all attached systems as a single JSON
 *   string with deterministic key ordering.
 * - `exportToFile()` triggers a browser file download.
 * - `getPlayFromHereConfig(id)` returns the info needed to open the
 *   matching creator UI for rapid content iteration.
 */
export class ContentBundleSystem {
  private _systems: ContentBundleSystems = {};
  private _meta: ContentBundleMeta = { ...BLANK_META };

  // ── Attach creator systems ────────────────────────────────────────────────

  attachMap(sys: MapEditorSystem):             this { this._systems.map         = sys; return this; }
  attachQuest(sys: QuestCreatorSystem):        this { this._systems.quest        = sys; return this; }
  attachDialogue(sys: DialogueCreatorSystem):  this { this._systems.dialogue     = sys; return this; }
  attachFaction(sys: FactionCreatorSystem):    this { this._systems.faction      = sys; return this; }
  attachLootTable(sys: LootTableCreatorSystem):this { this._systems.lootTable    = sys; return this; }
  attachNpc(sys: NpcCreatorSystem):            this { this._systems.npc          = sys; return this; }
  attachItem(sys: ItemCreatorSystem):          this { this._systems.item         = sys; return this; }
  attachSpawn(sys: SpawnCreatorSystem):        this { this._systems.spawn        = sys; return this; }

  // ── Meta ──────────────────────────────────────────────────────────────────

  /** Set bundle-level manifest metadata (title, description, author). */
  setMeta(meta: Partial<ContentBundleMeta>): void {
    if (meta.title       !== undefined) this._meta.title       = meta.title.trim();
    if (meta.description !== undefined) this._meta.description = meta.description.trim();
    if (meta.author      !== undefined) this._meta.author      = meta.author.trim();
  }

  get meta(): Readonly<ContentBundleMeta> { return this._meta; }

  // ── Validation ────────────────────────────────────────────────────────────

  /**
   * Run validation on every attached system and return a unified report.
   *
   * Systems that are not attached are skipped and do not appear in the report.
   */
  validate(): ContentBundleReport {
    const reports: BundleSystemReport[] = [];
    const { map, quest, dialogue, faction, lootTable, npc, item, spawn } = this._systems;

    if (map) {
      const r = map.validateMap(0.5);
      reports.push({
        systemId: "map",
        label: "Map",
        valid: r.isValid,
        issues: r.issues.map((i) => ({ message: i.message })),
      });
    }

    if (quest) {
      const r = quest.validate();
      reports.push({
        systemId: "quest",
        label: "Quest",
        valid: r.valid,
        issues: r.issues.map((i) => ({ message: i.detail })),
      });
    }

    if (dialogue) {
      const r = dialogue.validate();
      reports.push({
        systemId: "dialogue",
        label: "Dialogue",
        valid: r.valid,
        issues: r.issues.map((i) => ({ message: i.detail })),
      });
    }

    if (faction) {
      const r = faction.validate();
      reports.push({
        systemId: "faction",
        label: "Faction",
        valid: r.valid,
        issues: r.issues.map((m) => ({ message: m })),
      });
    }

    if (lootTable) {
      const r = lootTable.validate();
      reports.push({
        systemId: "lootTable",
        label: "Loot Table",
        valid: r.valid,
        issues: r.issues.map((m) => ({ message: m })),
      });
    }

    if (npc) {
      const r = npc.validate();
      reports.push({
        systemId: "npc",
        label: "NPC",
        valid: r.valid,
        issues: r.issues.map((m) => ({ message: m })),
      });
    }

    if (item) {
      const r = item.validate();
      reports.push({
        systemId: "item",
        label: "Item",
        valid: r.valid,
        issues: r.issues.map((m) => ({ message: m })),
      });
    }

    if (spawn) {
      const r = spawn.validate();
      reports.push({
        systemId: "spawn",
        label: "Spawn Group",
        valid: r.valid,
        issues: r.issues.map((i) => ({ message: i.detail })),
      });
    }

    return {
      allValid: reports.every((r) => r.valid),
      systems: reports,
      generatedAt: new Date().toISOString(),
    };
  }

  // ── Export ────────────────────────────────────────────────────────────────

  /**
   * Build and return the full content bundle as a plain object.
   * All nested keys are sorted for deterministic output.
   */
  buildBundle(): ContentBundleExport {
    const { map, quest, dialogue, faction, lootTable, npc, item, spawn } = this._systems;
    const included: BundleSystemId[] = [];

    const bundle: ContentBundleExport = {
      manifest: {
        schemaVersion: 1,
        title:       this._meta.title       || "Untitled Bundle",
        description: this._meta.description || "",
        author:      this._meta.author      || "",
        exportedAt:  new Date().toISOString(),
        systems:     included,
      },
    };

    if (map) {
      bundle.map = map.exportMap();
      included.push("map");
    }
    if (quest) {
      try { bundle.quest = JSON.parse(quest.exportToJson()); } catch { /* skip */ }
      included.push("quest");
    }
    if (dialogue) {
      try { bundle.dialogue = JSON.parse(dialogue.exportToJson()); } catch { /* skip */ }
      included.push("dialogue");
    }
    if (faction) {
      try { bundle.faction = JSON.parse(faction.exportToJson()); } catch { /* skip */ }
      included.push("faction");
    }
    if (lootTable) {
      try { bundle.lootTable = JSON.parse(lootTable.exportToJson()); } catch { /* skip */ }
      included.push("lootTable");
    }
    if (npc) {
      try { bundle.npc = JSON.parse(npc.exportToJson()); } catch { /* skip */ }
      included.push("npc");
    }
    if (item) {
      try { bundle.item = JSON.parse(item.exportToJson()); } catch { /* skip */ }
      included.push("item");
    }
    if (spawn) {
      try { bundle.spawn = JSON.parse(spawn.exportToJson()); } catch { /* skip */ }
      included.push("spawn");
    }

    // Update manifest systems list (populated above)
    bundle.manifest.systems = [...included];
    return bundle;
  }

  /**
   * Serialise the bundle as a diff-friendly, deterministically-keyed
   * JSON string (2-space indented, all object keys sorted alphabetically).
   */
  exportToJson(): string {
    return toNormalizedJson(this.buildBundle());
  }

  /**
   * Trigger a browser file download of the bundle JSON.
   * No-op in non-browser environments.
   */
  exportToFile(filename?: string): void {
    if (typeof document === "undefined") return;
    const json = this.exportToJson();
    const blob = new Blob([json], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = filename ?? `${this._meta.title.replace(/\s+/g, "_") || "content_bundle"}.bundle.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Play from here ────────────────────────────────────────────────────────

  /**
   * Return a `PlayFromHereConfig` for the given system so the game layer
   * can open the matching creator UI for rapid content iteration.
   * Returns `null` if the system is not attached.
   */
  getPlayFromHereConfig(systemId: BundleSystemId): PlayFromHereConfig | null {
    const labels: Record<BundleSystemId, string> = {
      map:       "Map Editor",
      quest:     "Quest Creator",
      dialogue:  "Dialogue Creator",
      faction:   "Faction Creator",
      lootTable: "Loot Table Creator",
      npc:       "NPC Creator",
      item:      "Item Creator",
      spawn:     "Loot + Spawn Creator",
    };
    if (!this._systems[systemId]) return null;
    return { systemId, label: labels[systemId] };
  }

  /** List all currently attached system IDs. */
  get attachedSystems(): BundleSystemId[] {
    return (Object.keys(this._systems) as BundleSystemId[]).filter(
      (k) => this._systems[k] !== undefined,
    );
  }
}
