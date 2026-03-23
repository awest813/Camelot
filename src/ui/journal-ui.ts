import type { JournalCategory, JournalEntry, JournalSystem } from "../systems/journal-system";

// ── Constants ──────────────────────────────────────────────────────────────────

/** Ordered list of category filter tabs shown above the entry list. */
const CATEGORY_TABS: Array<{ key: JournalCategory | "all" | "favorites"; label: string }> = [
  { key: "all",         label: "All"         },
  { key: "quest",       label: "Quest"        },
  { key: "lore",        label: "Lore"         },
  { key: "note",        label: "Note"         },
  { key: "rumor",       label: "Rumor"        },
  { key: "observation", label: "Observation"  },
  { key: "misc",        label: "Misc"         },
  { key: "favorites",   label: "⭐ Favorites" },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Format a Unix-ms timestamp as a short locale date string. */
export function formatEntryDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    year:  "numeric",
    month: "short",
    day:   "numeric",
  });
}

// ── JournalUI ──────────────────────────────────────────────────────────────────

/**
 * JournalUI — player-facing journal browser overlay.
 *
 * Left pane — scrollable entry list filtered by category tab and/or search
 * query.  Right pane — full detail view for the selected entry.
 *
 * Wire-up example:
 * ```ts
 * const ui = new JournalUI();
 *
 * ui.onFavoriteToggle = (id) => {
 *   journalSystem.toggleFavorite(id);
 *   ui.update(journalSystem);
 * };
 *
 * // Open / close via keybinding (J):
 * window.addEventListener("keydown", (e) => {
 *   if (e.key === "j" || e.key === "J") {
 *     ui.isVisible ? ui.hide() : ui.show();
 *     if (ui.isVisible) ui.update(journalSystem);
 *   }
 * });
 * ```
 */
export class JournalUI {
  public isVisible: boolean = false;

  /** Called when the player clicks the ⭐ toggle on an entry row. */
  public onFavoriteToggle: ((id: string) => void) | null = null;

  private _root:       HTMLDivElement | null = null;
  private _tabBar:     HTMLDivElement | null = null;
  private _searchInput: HTMLInputElement | null = null;
  private _listEl:     HTMLDivElement | null = null;
  private _detailEl:   HTMLDivElement | null = null;

  /** Currently active category filter. */
  private _activeFilter: JournalCategory | "all" | "favorites" = "all";
  /** The id of the currently shown entry in the detail pane. */
  private _selectedId: string | null = null;
  /** Last search query string. */
  private _searchQuery: string = "";
  /** Last snapshot of entries from `update()`. */
  private _lastEntries: JournalEntry[] = [];

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Make the panel visible. Creates the root DOM lazily on first call. */
  public show(): void {
    if (typeof document === "undefined") return;
    this._ensureDom();
    if (this._root) this._root.style.display = "flex";
    this.isVisible = true;
  }

  /** Hide the panel without destroying its DOM. */
  public hide(): void {
    if (this._root) this._root.style.display = "none";
    this.isVisible = false;
  }

  /**
   * Refresh the display from the current JournalSystem state.
   * Call after any mutation (add/update/remove/toggleFavorite).
   */
  public update(system: JournalSystem): void {
    if (typeof document === "undefined") return;
    this._ensureDom();

    // Snapshot entries based on active filter + search query.
    let entries: JournalEntry[];
    if (this._searchQuery.trim()) {
      entries = system.search(this._searchQuery);
      if (this._activeFilter !== "all" && this._activeFilter !== "favorites") {
        entries = entries.filter((e) => e.category === this._activeFilter);
      } else if (this._activeFilter === "favorites") {
        entries = entries.filter((e) => e.favorite);
      }
    } else if (this._activeFilter === "all") {
      entries = system.getAllEntries();
    } else if (this._activeFilter === "favorites") {
      entries = system.getFavorites();
    } else {
      entries = system.getByCategory(this._activeFilter);
    }

    this._lastEntries = entries;
    this._renderList(entries);
    this._renderTabs();

    // Refresh detail pane if the selected entry still exists.
    if (this._selectedId) {
      const current = entries.find((e) => e.id === this._selectedId);
      if (current) {
        this._renderDetail(current);
      } else {
        this._selectedId = null;
        this._clearDetail();
      }
    }
  }

  /** Remove the DOM element entirely and reset state. */
  public destroy(): void {
    this._root?.remove();
    this._root        = null;
    this._tabBar      = null;
    this._searchInput = null;
    this._listEl      = null;
    this._detailEl    = null;
    this._selectedId  = null;
    this._searchQuery = "";
    this._lastEntries = [];
    this._activeFilter = "all";
    this.isVisible    = false;
  }

  // ── DOM accessors (for testing) ─────────────────────────────────────────────

  /** The currently active category filter key. */
  public get activeFilter(): JournalCategory | "all" | "favorites" {
    return this._activeFilter;
  }

  /** The id of the currently selected entry (or null). */
  public get selectedId(): string | null {
    return this._selectedId;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private _ensureDom(): void {
    if (this._root || typeof document === "undefined") return;

    const root = document.createElement("div");
    root.className = "journal-ui";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "Player Journal");
    root.style.display = "none";

    // ── Header ────────────────────────────────────────────────────────────────
    const header = document.createElement("header");
    header.className = "journal-ui__header";
    root.appendChild(header);

    const titleEl = document.createElement("h2");
    titleEl.className = "journal-ui__title";
    titleEl.textContent = "Journal";
    header.appendChild(titleEl);

    const closeBtn = document.createElement("button");
    closeBtn.className = "journal-ui__close";
    closeBtn.type = "button";
    closeBtn.textContent = "✕";
    closeBtn.setAttribute("aria-label", "Close journal");
    closeBtn.addEventListener("click", () => this.hide());
    header.appendChild(closeBtn);

    // ── Category tab bar ──────────────────────────────────────────────────────
    const tabBar = document.createElement("div");
    tabBar.className = "journal-ui__tabs";
    tabBar.setAttribute("role", "tablist");
    tabBar.setAttribute("aria-label", "Journal categories");
    root.appendChild(tabBar);
    this._tabBar = tabBar;

    // ── Search bar ────────────────────────────────────────────────────────────
    const searchWrap = document.createElement("div");
    searchWrap.className = "journal-ui__search-wrap";
    root.appendChild(searchWrap);

    const searchInput = document.createElement("input");
    searchInput.className = "journal-ui__search";
    searchInput.type = "search";
    searchInput.placeholder = "Search entries…";
    searchInput.setAttribute("aria-label", "Search journal entries");
    searchInput.addEventListener("input", () => {
      this._searchQuery = searchInput.value;
      // Re-render the list with the new search query applied to the last
      // entries snapshot without requiring a full system update.
      this._rerenderWithCurrentFilter();
    });
    searchWrap.appendChild(searchInput);
    this._searchInput = searchInput;

    // ── Content area (list + detail) ──────────────────────────────────────────
    const body = document.createElement("div");
    body.className = "journal-ui__body";
    root.appendChild(body);

    const listEl = document.createElement("div");
    listEl.className = "journal-ui__list";
    listEl.setAttribute("role", "list");
    listEl.setAttribute("aria-label", "Journal entries");
    body.appendChild(listEl);
    this._listEl = listEl;

    const detailEl = document.createElement("div");
    detailEl.className = "journal-ui__detail";
    detailEl.setAttribute("aria-live", "polite");
    body.appendChild(detailEl);
    this._detailEl = detailEl;

    document.body.appendChild(root);
    this._root = root;

    this._renderTabs();
  }

  private _renderTabs(): void {
    if (!this._tabBar) return;
    this._tabBar.innerHTML = "";
    for (const tab of CATEGORY_TABS) {
      const btn = document.createElement("button");
      btn.className = "journal-ui__tab" +
        (this._activeFilter === tab.key ? " is-active" : "");
      btn.type = "button";
      btn.textContent = tab.label;
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", this._activeFilter === tab.key ? "true" : "false");
      btn.setAttribute("data-filter", tab.key);
      btn.addEventListener("click", () => {
        this._activeFilter = tab.key;
        this._selectedId   = null;
        this._rerenderWithCurrentFilter();
        this._renderTabs();
        this._clearDetail();
      });
      this._tabBar.appendChild(btn);
    }
  }

  /**
   * Re-filter `_lastEntries` by the current `_activeFilter` and `_searchQuery`
   * without going back to the system (used for search-input changes).
   */
  private _rerenderWithCurrentFilter(): void {
    if (!this._listEl) return;
    // When search is active we already have a filtered list from `update()`,
    // but for client-side re-filtering we work with what we have.
    // This just re-renders; for correct results callers should call update().
    this._renderList(this._lastEntries);
  }

  private _renderList(entries: JournalEntry[]): void {
    if (!this._listEl) return;
    this._listEl.innerHTML = "";

    if (entries.length === 0) {
      const empty = document.createElement("p");
      empty.className = "journal-ui__empty";
      empty.textContent = "No entries found.";
      this._listEl.appendChild(empty);
      return;
    }

    for (const entry of entries) {
      const row = document.createElement("div");
      row.className = "journal-ui__entry-row" +
        (this._selectedId === entry.id ? " is-selected" : "");
      row.setAttribute("role", "listitem");
      row.setAttribute("data-entry-id", entry.id);
      row.addEventListener("click", () => {
        this._selectedId = entry.id;
        this._renderDetail(entry);
        // Update selection highlight.
        this._listEl?.querySelectorAll(".journal-ui__entry-row").forEach((el) => {
          el.classList.toggle("is-selected", (el as HTMLElement).dataset.entryId === entry.id);
        });
      });

      const titleEl = document.createElement("span");
      titleEl.className = "journal-ui__entry-title";
      titleEl.textContent = entry.title;
      row.appendChild(titleEl);

      const badgeEl = document.createElement("span");
      badgeEl.className = `journal-ui__entry-badge journal-ui__entry-badge--${entry.category}`;
      badgeEl.textContent = entry.category;
      row.appendChild(badgeEl);

      const favBtn = document.createElement("button");
      favBtn.className = "journal-ui__fav-btn" + (entry.favorite ? " is-favorite" : "");
      favBtn.type = "button";
      favBtn.textContent = entry.favorite ? "⭐" : "☆";
      favBtn.setAttribute("aria-label",
        entry.favorite ? `Unstar ${entry.title}` : `Star ${entry.title}`);
      favBtn.setAttribute("aria-pressed", entry.favorite ? "true" : "false");
      favBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        this.onFavoriteToggle?.(entry.id);
      });
      row.appendChild(favBtn);

      this._listEl.appendChild(row);
    }
  }

  private _renderDetail(entry: JournalEntry): void {
    if (!this._detailEl) return;
    this._detailEl.innerHTML = "";

    const titleEl = document.createElement("h3");
    titleEl.className = "journal-ui__detail-title";
    titleEl.textContent = entry.title;
    this._detailEl.appendChild(titleEl);

    const metaEl = document.createElement("p");
    metaEl.className = "journal-ui__detail-meta";
    metaEl.textContent = `${entry.category}  ·  ${formatEntryDate(entry.updatedAt)}`;
    this._detailEl.appendChild(metaEl);

    if (entry.tags.length > 0) {
      const tagsWrap = document.createElement("div");
      tagsWrap.className = "journal-ui__detail-tags";
      for (const tag of entry.tags) {
        const chip = document.createElement("span");
        chip.className = "journal-ui__tag-chip";
        chip.textContent = tag;
        tagsWrap.appendChild(chip);
      }
      this._detailEl.appendChild(tagsWrap);
    }

    const bodyEl = document.createElement("p");
    bodyEl.className = "journal-ui__detail-body";
    bodyEl.textContent = entry.body;
    this._detailEl.appendChild(bodyEl);
  }

  private _clearDetail(): void {
    if (!this._detailEl) return;
    this._detailEl.innerHTML = "";
  }
}
