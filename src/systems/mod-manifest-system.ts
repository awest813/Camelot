import type { ModManifest, ModManifestEntry } from "../framework/mods/mod-types";

// ── Draft types ───────────────────────────────────────────────────────────────

/**
 * A mutable draft of a single mod manifest entry.
 */
export interface ModManifestEntryDraft {
  /** Internal key used within the authoring tool; also used as the mod id in the output manifest. */
  id: string;
  /** Remote or relative URL to the mod's JSON file. */
  url: string;
  /** Whether this mod should be included in the active load order. */
  enabled: boolean;
}

export interface ModManifestDraft {
  entries: ModManifestEntryDraft[];
}

export interface ModManifestValidationIssue {
  type:
    | "empty_id"
    | "duplicate_id"
    | "empty_url"
    | "invalid_url";
  entryId: string;
  detail: string;
}

export interface ModManifestValidationReport {
  valid: boolean;
  issues: ModManifestValidationIssue[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const BLANK_ENTRY: Omit<ModManifestEntryDraft, "id"> = {
  url:     "",
  enabled: true,
};

// ── System ────────────────────────────────────────────────────────────────────

/**
 * Headless authoring system for mod manifest files.
 *
 * Manages an ordered list of `ModManifestEntryDraft` records with helpers for
 * CRUD, reordering, validation, and JSON / file export-import.
 *
 * The produced `ModManifest` is compatible with the framework `ModLoader`.
 *
 * Usage:
 * ```ts
 * const sys = new ModManifestSystem();
 * sys.addEntry({ id: "my_mod", url: "./my-mod.mod.json" });
 * const report = sys.validate();
 * if (report.valid) {
 *   sys.exportToFile(); // downloads manifest.json
 * }
 * ```
 */
export class ModManifestSystem {
  private _entries: ModManifestEntryDraft[];
  private _entryCounter = 0;

  constructor(initial?: Partial<ModManifestDraft>) {
    this._entries = (initial?.entries ?? []).map(e => ({ ...e }));
    // Seed counter beyond any pre-loaded entries.
    this._entryCounter = this._entries.length;
  }

  // ── Accessors ─────────────────────────────────────────────────────────────

  /** Read-only snapshot of the current entry list. */
  get entries(): readonly ModManifestEntryDraft[] {
    return this._entries;
  }

  /** Total number of entries (enabled and disabled). */
  get entryCount(): number {
    return this._entries.length;
  }

  // ── Entry management ──────────────────────────────────────────────────────

  /**
   * Append a new mod manifest entry.
   * Auto-generates an id when `partial.id` is absent or blank.
   * Returns the final entry id.
   */
  addEntry(partial: Partial<ModManifestEntryDraft> = {}): string {
    const id = partial.id?.trim() || `mod_${++this._entryCounter}`;
    const entry: ModManifestEntryDraft = {
      id,
      url:     (partial.url     ?? BLANK_ENTRY.url).trim(),
      enabled: partial.enabled  ?? BLANK_ENTRY.enabled,
    };
    this._entries.push(entry);
    return id;
  }

  /**
   * Remove the entry with the given id.
   * Returns `true` on success, `false` when not found.
   */
  removeEntry(id: string): boolean {
    const idx = this._entries.findIndex(e => e.id === id);
    if (idx < 0) return false;
    this._entries.splice(idx, 1);
    return true;
  }

  /**
   * Apply field updates to an existing entry.
   * Returns `false` when the entry is not found.
   */
  updateEntry(id: string, fields: Partial<Omit<ModManifestEntryDraft, "id">>): boolean {
    const entry = this._entries.find(e => e.id === id);
    if (!entry) return false;

    if (fields.url     !== undefined) entry.url     = fields.url.trim();
    if (fields.enabled !== undefined) entry.enabled = fields.enabled;
    return true;
  }

  /**
   * Set an entry's `enabled` flag to `true`.
   * Returns `false` when the entry is not found.
   */
  enableEntry(id: string): boolean {
    return this.updateEntry(id, { enabled: true });
  }

  /**
   * Set an entry's `enabled` flag to `false`.
   * Returns `false` when the entry is not found.
   */
  disableEntry(id: string): boolean {
    return this.updateEntry(id, { enabled: false });
  }

  /**
   * Move an entry one position earlier in the list (lower index = higher load priority).
   * Returns `false` when the entry is not found or already first.
   */
  moveEntryUp(id: string): boolean {
    const idx = this._entries.findIndex(e => e.id === id);
    if (idx <= 0) return false;
    const tmp = this._entries[idx - 1];
    this._entries[idx - 1] = this._entries[idx];
    this._entries[idx] = tmp;
    return true;
  }

  /**
   * Move an entry one position later in the list (higher index = lower load priority).
   * Returns `false` when the entry is not found or already last.
   */
  moveEntryDown(id: string): boolean {
    const idx = this._entries.findIndex(e => e.id === id);
    if (idx < 0 || idx >= this._entries.length - 1) return false;
    const tmp = this._entries[idx + 1];
    this._entries[idx + 1] = this._entries[idx];
    this._entries[idx] = tmp;
    return true;
  }

  // ── Validation ────────────────────────────────────────────────────────────

  /**
   * Validate all entries and return a structured report.
   *
   * Checks performed:
   *  • Each entry must have a non-empty `id`.
   *  • Entry ids must be unique within the manifest.
   *  • Each entry must have a non-empty `url`.
   *  • The `url` must be a plausible string (non-whitespace only).
   */
  validate(): ModManifestValidationReport {
    const issues: ModManifestValidationIssue[] = [];
    const seenIds = new Set<string>();

    for (const entry of this._entries) {
      const eid = entry.id || "(blank)";

      if (!entry.id || entry.id.trim() === "") {
        issues.push({
          type:   "empty_id",
          entryId: eid,
          detail: `Entry has an empty id.`,
        });
      } else if (seenIds.has(entry.id)) {
        issues.push({
          type:   "duplicate_id",
          entryId: entry.id,
          detail: `Duplicate mod id "${entry.id}".`,
        });
      } else {
        seenIds.add(entry.id);
      }

      if (!entry.url || entry.url.trim() === "") {
        issues.push({
          type:   "empty_url",
          entryId: eid,
          detail: `Entry "${eid}" has an empty url.`,
        });
      }
    }

    return { valid: issues.length === 0, issues };
  }

  // ── Output ────────────────────────────────────────────────────────────────

  /**
   * Build a `ModManifest` object compatible with `ModLoader`.
   * All entries (enabled and disabled) are included; `enabled` defaults to
   * `undefined` (which `ModLoader` treats as enabled) when `true` to keep
   * the output clean.
   */
  toManifest(): ModManifest {
    const mods: ModManifestEntry[] = this._entries.map(e => {
      const entry: ModManifestEntry = { id: e.id, url: e.url };
      if (!e.enabled) entry.enabled = false;
      return entry;
    });
    return { mods };
  }

  // ── Import / export ───────────────────────────────────────────────────────

  /** Serialize the current manifest to a JSON string. */
  exportToJson(): string {
    return JSON.stringify(this.toManifest(), null, 2);
  }

  /**
   * Trigger a browser file download of the manifest as `manifest.json`.
   * No-op in non-browser environments.
   */
  exportToFile(): void {
    /* istanbul ignore next */
    if (typeof document === "undefined") return;
    const blob = new Blob([this.exportToJson()], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "manifest.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Replace the current entries with those parsed from a JSON string.
   * Returns `false` when the string is not valid JSON or lacks a `mods` array.
   */
  importFromJson(json: string): boolean {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      return false;
    }

    if (!parsed || typeof parsed !== "object") return false;
    const src = parsed as Record<string, unknown>;
    if (!Array.isArray(src.mods)) return false;

    const entries: ModManifestEntryDraft[] = [];
    for (const item of src.mods) {
      if (!item || typeof item !== "object") continue;
      const m = item as Record<string, unknown>;
      entries.push({
        id:      typeof m.id      === "string" ? m.id.trim()      : "",
        url:     typeof m.url     === "string" ? m.url.trim()     : "",
        enabled: m.enabled !== false,
      });
    }

    this._entries = entries;
    this._entryCounter = entries.length;
    return true;
  }

  /**
   * Replace the current entries from a `File` object.
   * Resolves to `false` when reading or parsing fails.
   */
  async importFromFile(file: File): Promise<boolean> {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(this.importFromJson(reader.result as string));
      };
      reader.onerror = () => resolve(false);
      reader.readAsText(file);
    });
  }

  /** Reset the system to an empty draft. */
  reset(): void {
    this._entries       = [];
    this._entryCounter  = 0;
  }
}
