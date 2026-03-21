/**
 * JournalSystem — Player journal for Camelot.
 *
 * Manages named journal entries with categories, tags, notes, and favorites.
 * Supports full-text search, tag-based filtering, category queries, and
 * snapshot persistence.
 *
 * Headless: no BabylonJS dependencies.
 */

// ── Entry ─────────────────────────────────────────────────────────────────────

/**
 * Broad category used to group journal entries.
 * Extend with additional values as the game grows.
 */
export type JournalCategory =
  | "quest"
  | "lore"
  | "note"
  | "rumor"
  | "observation"
  | "misc";

/**
 * A single player journal entry.
 */
export interface JournalEntry {
  /** Stable unique identifier. */
  id: string;
  /** Entry title. */
  title: string;
  /** Main body text. */
  body: string;
  /** Broad category for grouping and filtering. */
  category: JournalCategory;
  /**
   * Arbitrary string tags for freeform filtering (e.g. "dark-brotherhood",
   * "cyrodiil", "nirnroot").  Lower-cased on storage for consistent matching.
   */
  tags: string[];
  /** Optional short summary shown in list views. */
  summary?: string;
  /** Unix-timestamp (ms) of when the entry was created. */
  createdAt: number;
  /** Unix-timestamp (ms) of the most recent update. */
  updatedAt: number;
  /** Whether the player has starred this entry. */
  favorite: boolean;
}

// ── Snapshot ──────────────────────────────────────────────────────────────────

export interface JournalSnapshot {
  entries: Array<{
    id: string;
    title: string;
    body: string;
    category: JournalCategory;
    tags: string[];
    summary?: string;
    createdAt: number;
    updatedAt: number;
    favorite: boolean;
  }>;
}

// ── System ────────────────────────────────────────────────────────────────────

export class JournalSystem {
  private readonly _entries = new Map<string, JournalEntry>();
  /** Internal clock — injectable for testing. */
  private _now: () => number;

  constructor(now: () => number = Date.now) {
    this._now = now;
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  /**
   * Add a new journal entry.
   * Throws if an entry with the same id already exists, or if required fields
   * are missing.
   */
  public addEntry(
    entry: Omit<JournalEntry, "createdAt" | "updatedAt" | "favorite"> &
      Partial<Pick<JournalEntry, "favorite">>,
  ): JournalEntry {
    if (!entry.id || !entry.id.trim()) {
      throw new Error("JournalSystem: entry id must be a non-empty string.");
    }
    if (this._entries.has(entry.id)) {
      throw new Error(`JournalSystem: an entry with id "${entry.id}" already exists.`);
    }
    if (!entry.title || !entry.title.trim()) {
      throw new Error("JournalSystem: entry title must be a non-empty string.");
    }
    if (!entry.body || !entry.body.trim()) {
      throw new Error("JournalSystem: entry body must be a non-empty string.");
    }
    const now = this._now();
    const stored: JournalEntry = {
      ...entry,
      tags: (entry.tags ?? []).map((t) => t.toLowerCase().trim()).filter(Boolean),
      favorite: entry.favorite ?? false,
      createdAt: now,
      updatedAt: now,
    };
    this._entries.set(entry.id, stored);
    return { ...stored, tags: [...stored.tags] };
  }

  /**
   * Update fields of an existing entry.
   * Only the fields provided are changed; `createdAt` is never modified.
   * Throws if the id is not found.
   */
  public updateEntry(
    id: string,
    updates: Partial<Omit<JournalEntry, "id" | "createdAt" | "updatedAt">>,
  ): JournalEntry {
    const existing = this._entries.get(id);
    if (!existing) {
      throw new Error(`JournalSystem: no entry with id "${id}".`);
    }
    if (updates.title !== undefined && !updates.title.trim()) {
      throw new Error("JournalSystem: entry title must be a non-empty string.");
    }
    if (updates.body !== undefined && !updates.body.trim()) {
      throw new Error("JournalSystem: entry body must be a non-empty string.");
    }
    const updated: JournalEntry = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: this._now(),
    };
    if (updates.tags !== undefined) {
      updated.tags = updates.tags.map((t) => t.toLowerCase().trim()).filter(Boolean);
    }
    this._entries.set(id, updated);
    return { ...updated, tags: [...updated.tags] };
  }

  /**
   * Remove an entry by id.
   * Returns `true` if the entry existed and was removed, `false` otherwise.
   */
  public removeEntry(id: string): boolean {
    return this._entries.delete(id);
  }

  /**
   * Look up an entry by id.
   * Returns a copy to prevent external mutation, or `undefined` if not found.
   */
  public getEntry(id: string): JournalEntry | undefined {
    const e = this._entries.get(id);
    return e ? { ...e, tags: [...e.tags] } : undefined;
  }

  /** Total number of stored entries. */
  public get entryCount(): number {
    return this._entries.size;
  }

  // ── Favorites ─────────────────────────────────────────────────────────────

  /**
   * Toggle the `favorite` flag on an entry.
   * Throws if the id is not found.
   */
  public toggleFavorite(id: string): boolean {
    const e = this._entries.get(id);
    if (!e) {
      throw new Error(`JournalSystem: no entry with id "${id}".`);
    }
    e.favorite = !e.favorite;
    e.updatedAt = this._now();
    return e.favorite;
  }

  /** Return all favorited entries sorted by `updatedAt` descending. */
  public getFavorites(): JournalEntry[] {
    return Array.from(this._entries.values())
      .filter((e) => e.favorite)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((e) => ({ ...e, tags: [...e.tags] }));
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  /**
   * Return all entries for a given category, sorted by `updatedAt` descending.
   */
  public getByCategory(category: JournalCategory): JournalEntry[] {
    return Array.from(this._entries.values())
      .filter((e) => e.category === category)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((e) => ({ ...e, tags: [...e.tags] }));
  }

  /**
   * Return all entries that include ALL of the supplied tags.
   * Tags are matched case-insensitively.
   * Sorted by `updatedAt` descending.
   */
  public getByTags(tags: string[]): JournalEntry[] {
    const normalised = tags.map((t) => t.toLowerCase().trim()).filter(Boolean);
    if (normalised.length === 0) return this.getAllEntries();
    return Array.from(this._entries.values())
      .filter((e) => normalised.every((tag) => e.tags.includes(tag)))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((e) => ({ ...e, tags: [...e.tags] }));
  }

  /**
   * Full-text search across entry `title`, `body`, and `summary` fields.
   * Case-insensitive substring match.
   * Returns matching entries sorted by relevance (title match first, then
   * body match), then by `updatedAt` descending within each tier.
   */
  public search(query: string): JournalEntry[] {
    const q = query.toLowerCase().trim();
    if (!q) return this.getAllEntries();

    const titleMatches: JournalEntry[] = [];
    const bodyMatches: JournalEntry[] = [];

    for (const e of this._entries.values()) {
      const inTitle = e.title.toLowerCase().includes(q);
      const inBody = e.body.toLowerCase().includes(q);
      const inSummary = e.summary ? e.summary.toLowerCase().includes(q) : false;

      if (inTitle) {
        titleMatches.push({ ...e, tags: [...e.tags] });
      } else if (inBody || inSummary) {
        bodyMatches.push({ ...e, tags: [...e.tags] });
      }
    }

    titleMatches.sort((a, b) => b.updatedAt - a.updatedAt);
    bodyMatches.sort((a, b) => b.updatedAt - a.updatedAt);

    return [...titleMatches, ...bodyMatches];
  }

  /**
   * Return all entries sorted by `updatedAt` descending.
   */
  public getAllEntries(): JournalEntry[] {
    return Array.from(this._entries.values())
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((e) => ({ ...e, tags: [...e.tags] }));
  }

  /**
   * Return all distinct tags used across all entries, sorted alphabetically.
   */
  public getAllTags(): string[] {
    const tagSet = new Set<string>();
    for (const e of this._entries.values()) {
      for (const t of e.tags) tagSet.add(t);
    }
    return Array.from(tagSet).sort();
  }

  // ── Snapshot / restore ────────────────────────────────────────────────────

  public getSnapshot(): JournalSnapshot {
    return {
      entries: Array.from(this._entries.values()).map((e) => ({
        id: e.id,
        title: e.title,
        body: e.body,
        category: e.category,
        tags: [...e.tags],
        summary: e.summary,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
        favorite: e.favorite,
      })),
    };
  }

  /**
   * Restore journal state from a snapshot.
   * Replaces all current entries.
   * Unknown or malformed entries are silently skipped.
   */
  public restoreSnapshot(snap: JournalSnapshot): void {
    this._entries.clear();
    if (!snap?.entries) return;
    for (const raw of snap.entries) {
      if (!raw.id || !raw.title || !raw.body || !raw.category) continue;
      const e: JournalEntry = {
        id: raw.id,
        title: raw.title,
        body: raw.body,
        category: raw.category,
        tags: Array.isArray(raw.tags) ? raw.tags.map((t) => String(t).toLowerCase().trim()).filter(Boolean) : [],
        summary: raw.summary,
        createdAt: typeof raw.createdAt === "number" ? raw.createdAt : this._now(),
        updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : this._now(),
        favorite: raw.favorite ?? false,
      };
      this._entries.set(e.id, e);
    }
  }
}
