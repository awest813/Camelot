import type { AssetBrowserSystem, AssetEntry, AssetType } from "../systems/asset-browser-system";

// ── Icon map ───────────────────────────────────────────────────────────────────

const TYPE_ICON: Record<AssetType, string> = {
  item:      "⚔",
  npc:       "🧑",
  quest:     "📜",
  dialogue:  "💬",
  faction:   "🏰",
  lootTable: "💰",
  spawn:     "🏕",
  map:       "🗺",
};

const TYPE_COLOR: Record<AssetType, string> = {
  item:      "#fb923c",
  npc:       "#34d399",
  quest:     "#4ea8e0",
  dialogue:  "#a78bfa",
  faction:   "#f472b6",
  lootTable: "#fbbf24",
  spawn:     "#6ee7b7",
  map:       "#D4A017",
};

const ALL_TYPES: AssetType[] = ["item", "npc", "quest", "dialogue", "faction", "lootTable", "spawn", "map"];

/**
 * HTML-based Asset Browser overlay — Release D: Collaboration + Scale.
 *
 * Layout:
 *   ┌─────────────────────────────────────────────────┐
 *   │ Header (search + type filters + fav toggle)      │
 *   ├────────────────────┬────────────────────────────┤
 *   │ Asset list (scroll)│ Detail panel               │
 *   │  • cards with icon │  • id, name, type          │
 *   │  • tags badges     │  • tags, description       │
 *   │  • fav star        │  • dependencies list       │
 *   │                    │  • dependents list         │
 *   ├────────────────────┴────────────────────────────┤
 *   │ Action bar: Import Bundle | Export JSON | Close  │
 *   └─────────────────────────────────────────────────┘
 *
 * Keybinding: Shift+F6 (wired in game.ts).
 */
export class AssetBrowserUI {
  /** Called when user closes the panel. */
  public onClose: (() => void) | null = null;

  /**
   * Called when the user clicks "Import Bundle" to load assets from a
   * `.bundle.json` file. The game layer should handle file picking and
   * call `sys.importFromBundle(parsed)` then `ui.refresh()`.
   */
  public onImportBundle: (() => void) | null = null;

  /**
   * Called when the user selects an asset and clicks "Insert".
   * The game layer can use this to place the asset into the active editor.
   */
  public onInsert: ((asset: AssetEntry) => void) | null = null;

  private readonly _sys: AssetBrowserSystem;
  private _root: HTMLElement | null = null;
  private _listEl: HTMLElement | null = null;
  private _detailEl: HTMLElement | null = null;
  private _countEl: HTMLElement | null = null;
  private _searchInp: HTMLInputElement | null = null;
  private _favOnlyBtn: HTMLButtonElement | null = null;

  private _selectedId: string | null = null;
  private _activeTypes: Set<AssetType> = new Set(ALL_TYPES);
  private _favOnly = false;
  private _activeTags: Set<string> = new Set();

  constructor(system: AssetBrowserSystem) {
    this._sys = system;
  }

  get isVisible(): boolean {
    return this._root !== null && !this._root.hidden;
  }

  open(): void {
    if (this._root) {
      this._root.hidden = false;
      this._refresh();
      return;
    }
    this._build();
  }

  close(): void {
    if (this._root) this._root.hidden = true;
    this.onClose?.();
  }

  /** Re-render the asset list (call after importing a bundle). */
  refresh(): void {
    this._refresh();
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  private _build(): void {
    const root = document.createElement("div");
    root.className = "asset-browser";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Asset Browser");
    this._root = root;

    const panel = document.createElement("section");
    panel.className = "asset-browser__panel";
    root.appendChild(panel);

    // ── Header ────────────────────────────────────────────────────────────
    const header = document.createElement("div");
    header.className = "asset-browser__header";

    const titleWrap = document.createElement("div");
    const titleEl = document.createElement("h2");
    titleEl.className   = "asset-browser__title";
    titleEl.textContent = "🗂 Asset Browser";
    const subtitleEl = document.createElement("p");
    subtitleEl.className   = "asset-browser__subtitle";
    subtitleEl.textContent = "Search, filter, and inspect all registered content assets — Shift+F6";
    titleWrap.appendChild(titleEl);
    titleWrap.appendChild(subtitleEl);
    header.appendChild(titleWrap);

    const closeBtn = document.createElement("button");
    closeBtn.className   = "asset-browser__close-btn";
    closeBtn.textContent = "✕";
    closeBtn.setAttribute("aria-label", "Close asset browser");
    closeBtn.addEventListener("click", () => this.close());
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // ── Search + filter bar ────────────────────────────────────────────────
    const filterBar = document.createElement("div");
    filterBar.className = "asset-browser__filter-bar";

    const searchInp = document.createElement("input");
    searchInp.type        = "search";
    searchInp.placeholder = "Search by name, id, or description…";
    searchInp.className   = "asset-browser__search";
    searchInp.setAttribute("aria-label", "Search assets");
    searchInp.addEventListener("input", () => this._refresh());
    this._searchInp = searchInp;
    filterBar.appendChild(searchInp);

    // Type filter chips
    const typeRow = document.createElement("div");
    typeRow.className = "asset-browser__type-row";
    for (const type of ALL_TYPES) {
      const chip = document.createElement("button");
      chip.className        = "asset-browser__type-chip asset-browser__type-chip--active";
      chip.textContent      = `${TYPE_ICON[type]} ${type}`;
      chip.style.setProperty("--chip-color", TYPE_COLOR[type]);
      chip.setAttribute("aria-pressed", "true");
      chip.setAttribute("data-type", type);
      chip.addEventListener("click", () => {
        if (this._activeTypes.has(type)) {
          this._activeTypes.delete(type);
          chip.classList.remove("asset-browser__type-chip--active");
          chip.setAttribute("aria-pressed", "false");
        } else {
          this._activeTypes.add(type);
          chip.classList.add("asset-browser__type-chip--active");
          chip.setAttribute("aria-pressed", "true");
        }
        this._refresh();
      });
      typeRow.appendChild(chip);
    }
    filterBar.appendChild(typeRow);

    // Favorites toggle
    const favBtn = document.createElement("button");
    favBtn.className   = "asset-browser__fav-btn";
    favBtn.textContent = "⭐ Favorites only";
    favBtn.setAttribute("aria-pressed", "false");
    favBtn.addEventListener("click", () => {
      this._favOnly = !this._favOnly;
      favBtn.setAttribute("aria-pressed", String(this._favOnly));
      favBtn.classList.toggle("asset-browser__fav-btn--active", this._favOnly);
      this._refresh();
    });
    this._favOnlyBtn = favBtn;
    filterBar.appendChild(favBtn);

    panel.appendChild(filterBar);

    // ── Body (list + detail) ──────────────────────────────────────────────
    const body = document.createElement("div");
    body.className = "asset-browser__body";

    // Asset list
    const listWrap = document.createElement("div");
    listWrap.className = "asset-browser__list-wrap";

    const countEl = document.createElement("div");
    countEl.className = "asset-browser__count";
    countEl.textContent = "0 assets";
    this._countEl = countEl;
    listWrap.appendChild(countEl);

    const listEl = document.createElement("div");
    listEl.className = "asset-browser__list";
    listEl.setAttribute("role", "listbox");
    listEl.setAttribute("aria-label", "Asset list");
    this._listEl = listEl;
    listWrap.appendChild(listEl);

    body.appendChild(listWrap);

    // Detail panel
    const detailEl = document.createElement("div");
    detailEl.className = "asset-browser__detail";
    detailEl.setAttribute("aria-live", "polite");
    this._detailEl = detailEl;
    this._renderDetailEmpty();
    body.appendChild(detailEl);

    panel.appendChild(body);

    // ── Action bar ─────────────────────────────────────────────────────────
    const actions = document.createElement("div");
    actions.className = "asset-browser__actions";

    const importBtn = document.createElement("button");
    importBtn.className   = "asset-browser__btn asset-browser__btn--secondary";
    importBtn.textContent = "📂 Import Bundle";
    importBtn.title       = "Load a .bundle.json file to register its assets";
    importBtn.addEventListener("click", () => this.onImportBundle?.());

    const closeActionBtn = document.createElement("button");
    closeActionBtn.className   = "asset-browser__btn asset-browser__btn--close";
    closeActionBtn.textContent = "Close";
    closeActionBtn.addEventListener("click", () => this.close());

    actions.appendChild(importBtn);
    actions.appendChild(closeActionBtn);
    panel.appendChild(actions);

    // ── Footer ─────────────────────────────────────────────────────────────
    const footer = document.createElement("div");
    footer.className = "asset-browser__footer";
    footer.innerHTML =
      'Press <kbd>Esc</kbd> or click ✕ to close &nbsp;·&nbsp; ' +
      'Import a <kbd>.bundle.json</kbd> to populate the browser';
    panel.appendChild(footer);

    document.body.appendChild(root);
    this._refresh();
  }

  // ── Refresh list ───────────────────────────────────────────────────────────

  private _refresh(): void {
    if (!this._listEl || !this._countEl) return;

    const query = this._searchInp?.value ?? "";
    const results = this._sys.search({
      query: query || undefined,
      types: Array.from(this._activeTypes),
      favoritesOnly: this._favOnly || undefined,
    });

    this._countEl.textContent = `${results.length} asset${results.length !== 1 ? "s" : ""}`;
    this._listEl.innerHTML = "";

    if (results.length === 0) {
      const empty = document.createElement("div");
      empty.className   = "asset-browser__empty";
      empty.textContent =
        this._sys.size === 0
          ? "No assets registered. Use \"Import Bundle\" to load a .bundle.json file."
          : "No assets match the current filters.";
      this._listEl.appendChild(empty);
      return;
    }

    for (const asset of results) {
      this._listEl.appendChild(this._buildCard(asset));
    }
  }

  private _buildCard(asset: AssetEntry): HTMLElement {
    const isSelected = asset.id === this._selectedId;
    const isFav      = this._sys.isFavorite(asset.id);

    const card = document.createElement("div");
    card.className = `asset-browser__card${isSelected ? " asset-browser__card--selected" : ""}`;
    card.setAttribute("role", "option");
    card.setAttribute("aria-selected", String(isSelected));
    card.style.setProperty("--card-color", TYPE_COLOR[asset.type]);

    // Icon
    const iconEl = document.createElement("span");
    iconEl.className   = "asset-browser__card-icon";
    iconEl.textContent = TYPE_ICON[asset.type];

    // Body
    const bodyEl = document.createElement("div");
    bodyEl.className = "asset-browser__card-body";

    const nameEl = document.createElement("div");
    nameEl.className = "asset-browser__card-name";
    nameEl.textContent = asset.name;

    const idEl = document.createElement("div");
    idEl.className = "asset-browser__card-id";
    idEl.textContent = asset.id;

    bodyEl.appendChild(nameEl);
    bodyEl.appendChild(idEl);

    // Tags
    if (asset.tags.length > 0) {
      const tagsEl = document.createElement("div");
      tagsEl.className = "asset-browser__card-tags";
      for (const tag of asset.tags.slice(0, 4)) {
        const t = document.createElement("span");
        t.className   = "asset-browser__tag";
        t.textContent = tag;
        tagsEl.appendChild(t);
      }
      bodyEl.appendChild(tagsEl);
    }

    // Favorite star
    const favBtn = document.createElement("button");
    favBtn.className   = `asset-browser__fav-star${isFav ? " asset-browser__fav-star--on" : ""}`;
    favBtn.textContent = isFav ? "⭐" : "☆";
    favBtn.title       = isFav ? "Remove from favorites" : "Add to favorites";
    favBtn.setAttribute("aria-label", isFav ? "Remove from favorites" : "Add to favorites");
    favBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this._sys.toggleFavorite(asset.id);
      this._refresh();
      if (this._selectedId === asset.id) this._renderDetail(asset.id);
    });

    card.appendChild(iconEl);
    card.appendChild(bodyEl);
    card.appendChild(favBtn);

    card.addEventListener("click", () => {
      this._selectedId = asset.id;
      this._refresh();
      this._renderDetail(asset.id);
    });

    return card;
  }

  // ── Detail panel ───────────────────────────────────────────────────────────

  private _renderDetailEmpty(): void {
    if (!this._detailEl) return;
    this._detailEl.innerHTML = "";
    const msg = document.createElement("p");
    msg.className   = "asset-browser__detail-empty";
    msg.textContent = "Select an asset to view its details, dependencies, and dependents.";
    this._detailEl.appendChild(msg);
  }

  private _renderDetail(id: string): void {
    if (!this._detailEl) return;
    const asset = this._sys.getById(id);
    if (!asset) { this._renderDetailEmpty(); return; }

    this._detailEl.innerHTML = "";

    // Header row
    const dHeader = document.createElement("div");
    dHeader.className = "asset-browser__detail-header";
    dHeader.style.setProperty("--detail-color", TYPE_COLOR[asset.type]);

    const dIcon = document.createElement("span");
    dIcon.className   = "asset-browser__detail-icon";
    dIcon.textContent = TYPE_ICON[asset.type];

    const dTitle = document.createElement("div");
    const dName = document.createElement("div");
    dName.className   = "asset-browser__detail-name";
    dName.textContent = asset.name;
    const dId = document.createElement("div");
    dId.className   = "asset-browser__detail-id";
    dId.textContent = `ID: ${asset.id}`;
    dTitle.appendChild(dName);
    dTitle.appendChild(dId);

    dHeader.appendChild(dIcon);
    dHeader.appendChild(dTitle);
    this._detailEl.appendChild(dHeader);

    // Type badge
    const typeBadge = document.createElement("span");
    typeBadge.className   = "asset-browser__detail-badge";
    typeBadge.textContent = asset.type;
    typeBadge.style.setProperty("--badge-color", TYPE_COLOR[asset.type]);
    this._detailEl.appendChild(typeBadge);

    // Description
    if (asset.description) {
      const desc = document.createElement("p");
      desc.className   = "asset-browser__detail-desc";
      desc.textContent = asset.description;
      this._detailEl.appendChild(desc);
    }

    // Tags
    if (asset.tags.length > 0) {
      const tagsSection = this._makeDetailSection("Tags");
      const tagsWrap = document.createElement("div");
      tagsWrap.className = "asset-browser__detail-tags";
      for (const tag of asset.tags) {
        const t = document.createElement("span");
        t.className   = "asset-browser__tag";
        t.textContent = tag;
        tagsWrap.appendChild(t);
      }
      tagsSection.appendChild(tagsWrap);
      this._detailEl.appendChild(tagsSection);
    }

    // Dependencies
    const deps = this._sys.getDependencies(id);
    if (deps.length > 0) {
      const depSection = this._makeDetailSection(`Dependencies (${deps.length})`);
      for (const dep of deps) {
        depSection.appendChild(this._makeRefRow(dep));
      }
      this._detailEl.appendChild(depSection);
    } else {
      const depSection = this._makeDetailSection("Dependencies");
      const none = document.createElement("p");
      none.className   = "asset-browser__detail-none";
      none.textContent = "No registered dependencies.";
      depSection.appendChild(none);
      this._detailEl.appendChild(depSection);
    }

    // Dependents (reverse deps)
    const dependents = this._sys.getDependents(id);
    if (dependents.length > 0) {
      const depSection = this._makeDetailSection(`Used by (${dependents.length})`);
      for (const dep of dependents) {
        depSection.appendChild(this._makeRefRow(dep));
      }
      this._detailEl.appendChild(depSection);
    }

    // Insert button
    const insertBtn = document.createElement("button");
    insertBtn.className   = "asset-browser__btn asset-browser__btn--primary";
    insertBtn.textContent = "↗ Insert Asset";
    insertBtn.title       = "Insert this asset into the active editor";
    insertBtn.addEventListener("click", () => this.onInsert?.(asset));
    this._detailEl.appendChild(insertBtn);
  }

  private _makeDetailSection(title: string): HTMLElement {
    const section = document.createElement("div");
    section.className = "asset-browser__detail-section";
    const h = document.createElement("h4");
    h.className   = "asset-browser__detail-section-title";
    h.textContent = title;
    section.appendChild(h);
    return section;
  }

  private _makeRefRow(asset: AssetEntry): HTMLElement {
    const row = document.createElement("div");
    row.className = "asset-browser__ref-row";

    const icon = document.createElement("span");
    icon.className   = "asset-browser__ref-icon";
    icon.textContent = TYPE_ICON[asset.type];

    const name = document.createElement("span");
    name.className   = "asset-browser__ref-name";
    name.textContent = asset.name;

    const id = document.createElement("span");
    id.className   = "asset-browser__ref-id";
    id.textContent = asset.id;

    row.appendChild(icon);
    row.appendChild(name);
    row.appendChild(id);

    // Click to navigate
    row.style.cursor = "pointer";
    row.setAttribute("title", `View ${asset.name}`);
    row.addEventListener("click", () => {
      this._selectedId = asset.id;
      this._refresh();
      this._renderDetail(asset.id);
    });

    return row;
  }
}
