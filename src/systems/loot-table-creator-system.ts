import type { LootTable, LootEntry, LootCondition } from "./loot-table-system";

// ── Draft types ───────────────────────────────────────────────────────────────

/**
 * An editable snapshot of a single `LootEntry`.
 * The `entryKey` is an internal draft identifier and is not part of the
 * exported `LootEntry` schema.
 */
export interface LootEntryDraft {
  /** Internal unique key used by the creator UI. */
  entryKey:    string;
  itemId:      string;
  itemName:    string;
  weight:      number;
  minQuantity: number;
  maxQuantity: number;
  guarantee:   boolean;
  /** Optional sub-table chaining (overrides item fields when set). */
  subTableId:  string;
  /** Optional level condition. 0 = not set. */
  minLevel:    number;
  /** Optional level condition. 0 = not set. */
  maxLevel:    number;
}

export interface LootTableCreatorDraft {
  id:         string;
  rolls:      number;
  unique:     boolean;
  noneWeight: number;
  entries:    LootEntryDraft[];
}

export interface LootTableValidationReport {
  valid:  boolean;
  issues: string[];
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const BLANK_DRAFT: LootTableCreatorDraft = {
  id:         "",
  rolls:      1,
  unique:     false,
  noneWeight: 0,
  entries:    [],
};

// ── System ────────────────────────────────────────────────────────────────────

/**
 * Headless authoring system for loot table definitions.
 *
 * Manages a mutable `LootTableCreatorDraft` with CRUD helpers for entries,
 * validation, and JSON / file export-import.
 *
 * The produced `LootTable` is compatible with `LootTableSystem`.
 */
export class LootTableCreatorSystem {
  private _draft: LootTableCreatorDraft;
  private _entryCounter = 0;

  constructor(initial?: Partial<LootTableCreatorDraft>) {
    this._draft = {
      ...BLANK_DRAFT,
      ...initial,
      entries: [...(initial?.entries ?? [])],
    };
  }

  // ── Metadata ──────────────────────────────────────────────────────────────

  /**
   * Apply table-level field updates.
   * `rolls` is clamped to [1, 20].
   * `noneWeight` is clamped to [0, 10000].
   */
  setMeta(fields: Partial<Omit<LootTableCreatorDraft, "entries">>): void {
    if (fields.id         !== undefined) this._draft.id         = fields.id.trim();
    if (fields.unique     !== undefined) this._draft.unique     = fields.unique;
    if (fields.rolls      !== undefined)
      this._draft.rolls      = Math.max(1, Math.min(20, Math.round(fields.rolls)));
    if (fields.noneWeight !== undefined)
      this._draft.noneWeight = Math.max(0, Math.min(10_000, Math.round(fields.noneWeight)));
  }

  // ── Entry management ──────────────────────────────────────────────────────

  /**
   * Append a new entry to the draft.
   * `partial.entryKey` is used when supplied; otherwise a unique auto-key is
   * generated.  Returns the final entry key.
   */
  addEntry(partial: Partial<LootEntryDraft> = {}): string {
    const entryKey = partial.entryKey?.trim() || `entry_${++this._entryCounter}`;
    const entry: LootEntryDraft = {
      entryKey,
      itemId:      partial.itemId      ?? "",
      itemName:    partial.itemName    ?? "",
      weight:      Math.max(0, Math.round(partial.weight ?? 10)),
      minQuantity: Math.max(1, Math.round(partial.minQuantity ?? 1)),
      maxQuantity: Math.max(1, Math.round(partial.maxQuantity ?? 1)),
      guarantee:   partial.guarantee   ?? false,
      subTableId:  partial.subTableId  ?? "",
      minLevel:    Math.max(0, Math.round(partial.minLevel ?? 0)),
      maxLevel:    Math.max(0, Math.round(partial.maxLevel ?? 0)),
    };
    // Ensure minQuantity <= maxQuantity
    if (entry.minQuantity > entry.maxQuantity) {
      entry.maxQuantity = entry.minQuantity;
    }
    this._draft.entries.push(entry);
    return entryKey;
  }

  /**
   * Apply field updates to an existing entry.
   * Returns `false` when `entryKey` is not found.
   */
  updateEntry(
    entryKey: string,
    updates: Partial<Omit<LootEntryDraft, "entryKey">>,
  ): boolean {
    const entry = this._draft.entries.find(e => e.entryKey === entryKey);
    if (!entry) return false;

    if (updates.itemId      !== undefined) entry.itemId      = updates.itemId.trim();
    if (updates.itemName    !== undefined) entry.itemName    = updates.itemName.trim();
    if (updates.weight      !== undefined) entry.weight      = Math.max(0, Math.round(updates.weight));
    if (updates.minQuantity !== undefined) entry.minQuantity = Math.max(1, Math.round(updates.minQuantity));
    if (updates.maxQuantity !== undefined) entry.maxQuantity = Math.max(1, Math.round(updates.maxQuantity));
    if (updates.guarantee   !== undefined) entry.guarantee   = updates.guarantee;
    if (updates.subTableId  !== undefined) entry.subTableId  = updates.subTableId.trim();
    if (updates.minLevel    !== undefined) entry.minLevel    = Math.max(0, Math.round(updates.minLevel));
    if (updates.maxLevel    !== undefined) entry.maxLevel    = Math.max(0, Math.round(updates.maxLevel));

    // Keep quantity range consistent
    if (entry.minQuantity > entry.maxQuantity) entry.maxQuantity = entry.minQuantity;

    return true;
  }

  /**
   * Remove an entry by entryKey.
   * Returns `false` when `entryKey` is not found.
   */
  removeEntry(entryKey: string): boolean {
    const idx = this._draft.entries.findIndex(e => e.entryKey === entryKey);
    if (idx === -1) return false;
    this._draft.entries.splice(idx, 1);
    return true;
  }

  /** Move an entry up by one position in the list. Returns `false` when already first. */
  moveEntryUp(entryKey: string): boolean {
    const idx = this._draft.entries.findIndex(e => e.entryKey === entryKey);
    if (idx <= 0) return false;
    [this._draft.entries[idx - 1], this._draft.entries[idx]] =
      [this._draft.entries[idx], this._draft.entries[idx - 1]];
    return true;
  }

  /** Move an entry down by one position in the list. Returns `false` when already last. */
  moveEntryDown(entryKey: string): boolean {
    const idx = this._draft.entries.findIndex(e => e.entryKey === entryKey);
    if (idx === -1 || idx >= this._draft.entries.length - 1) return false;
    [this._draft.entries[idx], this._draft.entries[idx + 1]] =
      [this._draft.entries[idx + 1], this._draft.entries[idx]];
    return true;
  }

  // ── Validation ────────────────────────────────────────────────────────────

  /** Validate the current draft for required fields and entry consistency. */
  validate(): LootTableValidationReport {
    const issues: string[] = [];

    if (!this._draft.id) issues.push("Loot table ID is required.");
    if (this._draft.entries.length === 0) issues.push("Loot table must have at least one entry.");

    let totalNonGuaranteedWeight = 0;
    const seenKeys = new Set<string>();

    for (const entry of this._draft.entries) {
      if (seenKeys.has(entry.entryKey)) {
        issues.push(`Duplicate entry key: "${entry.entryKey}".`);
      }
      seenKeys.add(entry.entryKey);

      if (!entry.guarantee) totalNonGuaranteedWeight += entry.weight;

      // An entry must either name an item or chain a sub-table
      if (!entry.itemId && !entry.itemName && !entry.subTableId) {
        issues.push(
          `Entry "${entry.entryKey}" has no itemId, itemName, or subTableId — it will produce nothing.`,
        );
      }

      if (entry.maxLevel > 0 && entry.minLevel > entry.maxLevel) {
        issues.push(
          `Entry "${entry.entryKey}": minLevel (${entry.minLevel}) > maxLevel (${entry.maxLevel}).`,
        );
      }
    }

    const nonGuaranteedEntries = this._draft.entries.filter(e => !e.guarantee);
    if (nonGuaranteedEntries.length > 0 && totalNonGuaranteedWeight === 0) {
      issues.push(
        "All non-guaranteed entries have zero weight — no items will ever be rolled.",
      );
    }

    return { valid: issues.length === 0, issues };
  }

  // ── Export ────────────────────────────────────────────────────────────────

  /** Convert the draft to a `LootTable` ready for `LootTableSystem`. */
  toLootTable(): LootTable {
    const entries: LootEntry[] = this._draft.entries.map(e => {
      const entry: LootEntry = { weight: e.weight };

      if (e.subTableId) {
        entry.subTableId = e.subTableId;
      } else {
        if (e.itemId)   entry.itemId   = e.itemId;
        if (e.itemName) entry.itemName = e.itemName;
      }

      if (e.minQuantity !== 1 || e.maxQuantity !== 1) {
        entry.minQuantity = e.minQuantity;
        entry.maxQuantity = e.maxQuantity;
      }
      if (e.guarantee) entry.guarantee = true;

      const condition: LootCondition = {};
      if (e.minLevel > 0) condition.minLevel = e.minLevel;
      if (e.maxLevel > 0) condition.maxLevel = e.maxLevel;
      if (Object.keys(condition).length > 0) entry.condition = condition;

      return entry;
    });

    return {
      id:         this._draft.id,
      rolls:      this._draft.rolls,
      unique:     this._draft.unique   || undefined,
      noneWeight: this._draft.noneWeight > 0 ? this._draft.noneWeight : undefined,
      entries,
    };
  }

  /** Serialize the draft as a pretty-printed JSON string. */
  exportToJson(): string {
    return JSON.stringify(
      { ...this.toLootTable(), _draftEntryKeys: this._draft.entries.map(e => e.entryKey) },
      null,
      2,
    );
  }

  /** Trigger a browser file-download of the draft. No-op in non-browser environments. */
  exportToFile(filename?: string): void {
    if (typeof document === "undefined") return;
    const json = this.exportToJson();
    const blob = new Blob([json], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = filename ?? `${this._draft.id || "loot_table"}.loottable.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Import ────────────────────────────────────────────────────────────────

  /** Load a loot table from a JSON string. Returns `true` on success. */
  importFromJson(json: string): boolean {
    try {
      const parsed = JSON.parse(json) as LootTable & {
        _draftEntryKeys?: string[];
      };
      if (!parsed || typeof parsed.id !== "string" || !Array.isArray(parsed.entries)) {
        return false;
      }

      const keys: string[] = parsed._draftEntryKeys ?? [];

      this._draft = {
        id:         parsed.id,
        rolls:      parsed.rolls       ?? 1,
        unique:     parsed.unique      ?? false,
        noneWeight: parsed.noneWeight  ?? 0,
        entries:    parsed.entries.map((e, i) => ({
          entryKey:    keys[i] ?? `entry_${i + 1}`,
          itemId:      e.itemId    ?? "",
          itemName:    e.itemName  ?? "",
          weight:      e.weight    ?? 10,
          minQuantity: e.minQuantity ?? 1,
          maxQuantity: e.maxQuantity ?? 1,
          guarantee:   e.guarantee  ?? false,
          subTableId:  e.subTableId ?? "",
          minLevel:    e.condition?.minLevel ?? 0,
          maxLevel:    e.condition?.maxLevel ?? 0,
        })),
      };
      this._entryCounter = 0;
      return true;
    } catch {
      return false;
    }
  }

  /** Read a browser `File` and import its JSON content. */
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

  // ── Reset ─────────────────────────────────────────────────────────────────

  /** Discard the current draft and start fresh. */
  reset(): void {
    this._draft = { ...BLANK_DRAFT, entries: [] };
    this._entryCounter = 0;
  }

  // ── Getters ───────────────────────────────────────────────────────────────

  get draft(): Readonly<LootTableCreatorDraft> { return this._draft; }

  get entries(): readonly LootEntryDraft[] { return this._draft.entries; }
}
