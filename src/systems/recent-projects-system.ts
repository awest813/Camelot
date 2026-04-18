/**
 * RecentProjectsSystem — Tracks recently opened / saved editor projects.
 *
 * Persists a bounded list of recent project entries in `localStorage` so the
 * standalone editor shell can show a "Recent Projects" panel on the welcome
 * dashboard and restore the user's last session quickly.
 *
 * Each entry stores the project's display name, the last-opened timestamp,
 * an optional file path (for Electron/native file-system integration), and
 * an optional thumbnail data-URL for visual previews.
 *
 * The list is capped at {@link MAX_RECENT_PROJECTS} entries (default 10).
 * When a new entry would exceed the cap, the oldest entry is evicted.
 *
 * Usage:
 *   const recents = new RecentProjectsSystem();
 *   recents.restore();                       // load from localStorage
 *   recents.addProject({ name: "My Mod" });  // track a project
 *   recents.getProjects();                   // newest-first list
 */

// ── Constants ────────────────────────────────────────────────────────────────

export const MAX_RECENT_PROJECTS = 10;
export const STORAGE_KEY = "camelot_recent_projects";

// ── Types ────────────────────────────────────────────────────────────────────

export interface RecentProjectEntry {
  /** Unique identifier — auto-generated via `crypto.randomUUID()` when omitted. */
  id: string;
  /** Human-readable project name. */
  name: string;
  /** ISO-8601 timestamp of the last time this project was opened or saved. */
  lastOpenedAt: string;
  /** Optional absolute file path for native (Electron) file-system access. */
  filePath?: string;
  /** Optional thumbnail data-URL for visual preview cards. */
  thumbnail?: string;
}

export interface RecentProjectInput {
  /** Human-readable project name (required). */
  name: string;
  /** Optional file path for native access. */
  filePath?: string;
  /** Optional thumbnail data-URL. */
  thumbnail?: string;
}

// ── System ───────────────────────────────────────────────────────────────────

export class RecentProjectsSystem {
  /** Fired after any mutation (add / remove / pin / clear). */
  public onChanged: (() => void) | null = null;

  private _projects: RecentProjectEntry[] = [];

  // ── Queries ───────────────────────────────────────────────────────────────

  /** Returns all recent projects, newest first. */
  getProjects(): ReadonlyArray<RecentProjectEntry> {
    return this._projects;
  }

  /** Returns a single project by ID, or `undefined`. */
  getProject(id: string): RecentProjectEntry | undefined {
    return this._projects.find(p => p.id === id);
  }

  /** Number of tracked projects. */
  get count(): number {
    return this._projects.length;
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  /**
   * Add (or touch) a project in the recent list.
   *
   * If a project with the same `filePath` already exists, it is moved to the
   * front and its `lastOpenedAt` timestamp is refreshed.  Otherwise a new
   * entry is prepended.  The list is trimmed to {@link MAX_RECENT_PROJECTS}.
   *
   * @returns The resulting {@link RecentProjectEntry}.
   */
  addProject(input: RecentProjectInput): RecentProjectEntry {
    const now = new Date().toISOString();

    // De-duplicate by filePath when present.
    if (input.filePath) {
      const idx = this._projects.findIndex(p => p.filePath === input.filePath);
      if (idx !== -1) {
        const existing = this._projects.splice(idx, 1)[0];
        existing.name = input.name;
        existing.lastOpenedAt = now;
        if (input.thumbnail !== undefined) existing.thumbnail = input.thumbnail;
        this._projects.unshift(existing);
        this._persist();
        return existing;
      }
    }

    const entry: RecentProjectEntry = {
      id: this._generateId(),
      name: input.name,
      lastOpenedAt: now,
      filePath: input.filePath,
      thumbnail: input.thumbnail,
    };

    this._projects.unshift(entry);

    // Evict oldest entries beyond the cap.
    if (this._projects.length > MAX_RECENT_PROJECTS) {
      this._projects.length = MAX_RECENT_PROJECTS;
    }

    this._persist();
    return entry;
  }

  /**
   * Remove a project from the recent list by ID.
   * @returns `true` if the entry existed and was removed.
   */
  removeProject(id: string): boolean {
    const idx = this._projects.findIndex(p => p.id === id);
    if (idx === -1) return false;
    this._projects.splice(idx, 1);
    this._persist();
    return true;
  }

  /** Clear the entire recent-projects list. */
  clear(): void {
    if (this._projects.length === 0) return;
    this._projects = [];
    this._persist();
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  /**
   * Restore the recent-projects list from `localStorage`.
   * Silently no-ops if the key is absent or the stored JSON is malformed.
   */
  restore(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      this._projects = parsed.filter(
        (e): e is RecentProjectEntry =>
          typeof e === "object" &&
          e !== null &&
          typeof (e as RecentProjectEntry).id === "string" &&
          typeof (e as RecentProjectEntry).name === "string" &&
          typeof (e as RecentProjectEntry).lastOpenedAt === "string",
      );
    } catch {
      // Corrupt data — start fresh.
      this._projects = [];
    }
  }

  /** Returns the current snapshot suitable for JSON serialisation. */
  getSnapshot(): RecentProjectEntry[] {
    return this._projects.map(p => ({ ...p }));
  }

  /** Replace state from a previously-captured snapshot (e.g. for testing). */
  restoreSnapshot(state: RecentProjectEntry[]): void {
    this._projects = state.map(p => ({ ...p }));
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private _persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._projects));
    } catch {
      // localStorage might be unavailable or full — silently skip.
    }
    this.onChanged?.();
  }

  private static _idCounter = 0;

  private _generateId(): string {
    // Use crypto.randomUUID where available, fall back to a counter-based id.
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `proj_${Date.now()}_${++RecentProjectsSystem._idCounter}_${Math.random().toString(36).slice(2, 8)}`;
  }
}
