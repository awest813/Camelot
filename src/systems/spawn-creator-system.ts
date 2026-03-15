import type { NpcRole } from "../framework/content/content-types";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Well-known NPC roles available as archetype suggestions. */
export const SPAWN_ARCHETYPE_ROLES: NpcRole[] = [
  "guard", "merchant", "innkeeper", "villager", "enemy", "boss", "companion",
];

// ── Draft types ───────────────────────────────────────────────────────────────

/**
 * A single spawn entry describing one NPC variant to place in a spawn group.
 */
export interface SpawnEntryDraft {
  /** Unique entry id within the spawn group. */
  id: string;
  /** ID of the NpcArchetypeDefinition template to use. */
  archetypeId: string;
  /** ID of the LootTable to assign to this spawn's loot roll (optional). */
  lootTableId: string;
  /** Number of NPCs of this type to spawn. */
  count: number;
  /** Minimum player level at which this entry becomes active. */
  levelMin: number;
  /** Maximum player level at which this entry remains active (0 = no cap). */
  levelMax: number;
  /**
   * Hours of in-game time before this entry respawns after being cleared.
   * 0 = never respawns.
   */
  respawnIntervalHours: number;
}

/** Top-level spawn group draft being authored. */
export interface SpawnGroupDraft {
  /** Unique identifier for this spawn group. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Optional description for documentation purposes. */
  description: string;
  /** List of spawn entries in this group. */
  entries: SpawnEntryDraft[];
}

/** An issue found when validating a spawn group. */
export interface SpawnValidationIssue {
  type:
    | "missing_id"
    | "missing_name"
    | "missing_archetype"
    | "invalid_count"
    | "invalid_level_range"
    | "invalid_respawn";
  entryId?: string;
  detail: string;
}

export interface SpawnValidationReport {
  valid: boolean;
  issues: SpawnValidationIssue[];
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const BLANK_ENTRY: Omit<SpawnEntryDraft, "id"> = {
  archetypeId:          "",
  lootTableId:          "",
  count:                1,
  levelMin:             1,
  levelMax:             0,
  respawnIntervalHours: 72,
};

const BLANK_DRAFT: SpawnGroupDraft = {
  id:          "",
  name:        "",
  description: "",
  entries:     [],
};

// ── System ────────────────────────────────────────────────────────────────────

/**
 * Headless authoring system for NPC spawn group configurations.
 *
 * Manages a mutable `SpawnGroupDraft` with helpers for spawn entry CRUD,
 * validation (archetype check, level ranges, counts), and JSON / file
 * export-import.
 *
 * This is the backend for the Loot + Spawn GUI (Content GUI Release B).
 */
export class SpawnCreatorSystem {
  private _draft: SpawnGroupDraft;
  private _entryCounter = 0;

  constructor(initial?: Partial<SpawnGroupDraft>) {
    this._draft = {
      ...BLANK_DRAFT,
      ...initial,
      entries: [...(initial?.entries ?? [])],
    };
  }

  // ── Metadata ──────────────────────────────────────────────────────────────

  /** Update spawn-group-level metadata. */
  setMeta(id: string, name: string, description = ""): void {
    this._draft.id          = id.trim();
    this._draft.name        = name.trim();
    this._draft.description = description.trim();
  }

  // ── Entry management ──────────────────────────────────────────────────────

  /**
   * Append a new spawn entry to the draft.
   * Auto-generates an id when `partial.id` is absent.
   * Returns the final entry id.
   */
  addEntry(partial: Partial<SpawnEntryDraft> = {}): string {
    const id = partial.id?.trim() || `entry_${++this._entryCounter}`;
    const entry: SpawnEntryDraft = {
      id,
      archetypeId:          partial.archetypeId          ?? BLANK_ENTRY.archetypeId,
      lootTableId:          partial.lootTableId          ?? BLANK_ENTRY.lootTableId,
      count:                Math.max(1, partial.count    ?? BLANK_ENTRY.count),
      levelMin:             Math.max(1, partial.levelMin ?? BLANK_ENTRY.levelMin),
      levelMax:             Math.max(0, partial.levelMax ?? BLANK_ENTRY.levelMax),
      respawnIntervalHours: Math.max(0, partial.respawnIntervalHours ?? BLANK_ENTRY.respawnIntervalHours),
    };
    this._draft.entries.push(entry);
    return id;
  }

  /**
   * Apply field updates to an existing spawn entry.
   * Returns `false` when `entryId` is not found.
   */
  updateEntry(entryId: string, updates: Partial<Omit<SpawnEntryDraft, "id">>): boolean {
    const entry = this._draft.entries.find(e => e.id === entryId);
    if (!entry) return false;

    if (updates.archetypeId          !== undefined) entry.archetypeId          = updates.archetypeId.trim();
    if (updates.lootTableId          !== undefined) entry.lootTableId          = updates.lootTableId.trim();
    if (updates.count                !== undefined) entry.count                = Math.max(1, updates.count);
    if (updates.levelMin             !== undefined) entry.levelMin             = Math.max(1, updates.levelMin);
    if (updates.levelMax             !== undefined) entry.levelMax             = Math.max(0, updates.levelMax);
    if (updates.respawnIntervalHours !== undefined) entry.respawnIntervalHours = Math.max(0, updates.respawnIntervalHours);
    return true;
  }

  /**
   * Remove a spawn entry from the draft.
   * Returns `false` when `entryId` is not found.
   */
  removeEntry(entryId: string): boolean {
    const idx = this._draft.entries.findIndex(e => e.id === entryId);
    if (idx === -1) return false;
    this._draft.entries.splice(idx, 1);
    return true;
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  /**
   * Validate the current draft.
   * Returns a `SpawnValidationReport` with any issues found.
   *
   * Rules:
   *  - Spawn group id must be non-empty
   *  - Spawn group name must be non-empty
   *  - Each entry must have a non-empty archetypeId
   *  - Each entry count must be >= 1
   *  - If levelMax > 0, levelMax must be >= levelMin
   *  - respawnIntervalHours must be >= 0
   */
  validate(): SpawnValidationReport {
    const issues: SpawnValidationIssue[] = [];

    if (!this._draft.id) {
      issues.push({ type: "missing_id", detail: "Spawn group id is required." });
    }
    if (!this._draft.name) {
      issues.push({ type: "missing_name", detail: "Spawn group name is required." });
    }

    for (const entry of this._draft.entries) {
      if (!entry.archetypeId) {
        issues.push({
          type:    "missing_archetype",
          entryId: entry.id,
          detail:  `Entry "${entry.id}": archetypeId is required.`,
        });
      }
      if (entry.count < 1) {
        issues.push({
          type:    "invalid_count",
          entryId: entry.id,
          detail:  `Entry "${entry.id}": count must be at least 1.`,
        });
      }
      if (entry.levelMax > 0 && entry.levelMax < entry.levelMin) {
        issues.push({
          type:    "invalid_level_range",
          entryId: entry.id,
          detail:  `Entry "${entry.id}": levelMax (${entry.levelMax}) must be ≥ levelMin (${entry.levelMin}).`,
        });
      }
      if (entry.respawnIntervalHours < 0) {
        issues.push({
          type:    "invalid_respawn",
          entryId: entry.id,
          detail:  `Entry "${entry.id}": respawnIntervalHours must be ≥ 0.`,
        });
      }
    }

    return { valid: issues.length === 0, issues };
  }

  // ── Export ─────────────────────────────────────────────────────────────────

  /** Serialize the draft as a pretty-printed JSON string. */
  exportToJson(): string {
    return JSON.stringify(this._draft, null, 2);
  }

  /**
   * Trigger a browser file-download of the current draft as a JSON file.
   * No-op in headless environments where `document` is absent.
   */
  exportToFile(filename?: string): void {
    if (typeof document === "undefined") return;
    const json = this.exportToJson();
    const blob = new Blob([json], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = filename ?? `${this._draft.id || "spawn_group"}.spawn.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Import ─────────────────────────────────────────────────────────────────

  /**
   * Deserialize and load a spawn group from a JSON string.
   * Returns `true` on success, `false` on any parse or schema error.
   */
  importFromJson(json: string): boolean {
    try {
      const parsed = JSON.parse(json) as SpawnGroupDraft;
      if (
        !parsed ||
        typeof parsed.id !== "string" ||
        !Array.isArray(parsed.entries)
      ) {
        return false;
      }
      this._draft = {
        id:          parsed.id          ?? "",
        name:        parsed.name        ?? "",
        description: parsed.description ?? "",
        entries:     parsed.entries.map(e => ({
          id:                   e.id                   ?? "",
          archetypeId:          e.archetypeId          ?? "",
          lootTableId:          e.lootTableId          ?? "",
          count:                Math.max(1, e.count    ?? 1),
          levelMin:             Math.max(1, e.levelMin ?? 1),
          levelMax:             Math.max(0, e.levelMax ?? 0),
          respawnIntervalHours: Math.max(0, e.respawnIntervalHours ?? 72),
        })),
      };
      this._entryCounter = 0;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Read a `File` from the browser and import its JSON content.
   * Returns a Promise resolving to `true` on success.
   */
  importFromFile(file: File): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const reader = new FileReader();
      reader.onload  = (e) => {
        const text = e.target?.result;
        if (typeof text !== "string") { resolve(false); return; }
        resolve(this.importFromJson(text));
      };
      reader.onerror = () => resolve(false);
      reader.readAsText(file);
    });
  }

  // ── Reset ──────────────────────────────────────────────────────────────────

  /** Discard the current draft and start fresh. */
  reset(): void {
    this._draft = { ...BLANK_DRAFT, entries: [] };
    this._entryCounter = 0;
  }

  // ── Getters ───────────────────────────────────────────────────────────────

  /** Read-only snapshot of the current draft. */
  get draft(): Readonly<SpawnGroupDraft> {
    return this._draft;
  }

  /** Read-only list of spawn entries in the current draft. */
  get entries(): readonly SpawnEntryDraft[] {
    return this._draft.entries;
  }
}
