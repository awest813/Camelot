import type { ContentBundleExport, BundleSystemId } from "./content-bundle-system";

// ── Asset types ───────────────────────────────────────────────────────────────

export type AssetType =
  | "item"
  | "npc"
  | "quest"
  | "dialogue"
  | "faction"
  | "lootTable"
  | "spawn"
  | "map";

/** A single registered asset in the browser. */
export interface AssetEntry {
  /** Unique content ID (must be unique across all registered assets). */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** Content type for icon/filtering. */
  type: AssetType;
  /** Free-form tags for filtering (e.g. "weapon", "boss", "main-quest"). */
  tags: string[];
  /** Short description shown in the detail panel. */
  description: string;
  /**
   * IDs of other registered assets this asset references.
   * For example, a spawn group referencing a loot table ID.
   */
  dependencies: string[];
}

/** Options for filtering the asset list. */
export interface AssetSearchOptions {
  /** Case-insensitive substring match against name, id, and description. */
  query?: string;
  /** Only show assets of these types. */
  types?: AssetType[];
  /** Only show assets that have ALL of the given tags. */
  tags?: string[];
  /** If true, only return favorited assets. */
  favoritesOnly?: boolean;
}

// ── System ────────────────────────────────────────────────────────────────────

/**
 * Headless asset-browser registry for Release D — Collaboration + Scale.
 *
 * - `register()` / `unregister()` manage individual asset entries.
 * - `importFromBundle()` bulk-registers all assets in a `ContentBundleExport`.
 * - `search()` provides filtered/sorted results for the UI.
 * - `toggleFavorite()` / `isFavorite()` maintain a favorites set.
 * - `getDependencies()` / `getDependents()` surface dependency graphs.
 */
export class AssetBrowserSystem {
  private readonly _assets = new Map<string, AssetEntry>();
  private readonly _favorites = new Set<string>();

  // ── Registration ──────────────────────────────────────────────────────────

  /** Register or replace an asset entry. */
  register(asset: AssetEntry): void {
    this._assets.set(asset.id, { ...asset, tags: [...asset.tags], dependencies: [...asset.dependencies] });
  }

  /** Remove an asset by ID. Returns true if it existed. */
  unregister(id: string): boolean {
    this._favorites.delete(id);
    return this._assets.delete(id);
  }

  /** Remove all registered assets and clear favorites. */
  clear(): void {
    this._assets.clear();
    this._favorites.clear();
  }

  get size(): number {
    return this._assets.size;
  }

  // ── Bulk import ───────────────────────────────────────────────────────────

  /**
   * Parse a `ContentBundleExport` and register each discoverable asset entry.
   * Returns the number of newly registered entries.
   */
  importFromBundle(bundle: ContentBundleExport): number {
    let count = 0;

    const tryRegister = (entry: AssetEntry) => {
      if (entry.id) {
        this.register(entry);
        count++;
      }
    };

    // quest
    if (bundle.quest) {
      const q = bundle.quest as Record<string, unknown>;
      if (typeof q.id === "string") {
        tryRegister({
          id: q.id,
          name: (q.name as string) || q.id,
          type: "quest",
          tags: ["quest"],
          description: (q.description as string) || "",
          dependencies: _extractStringArray(q.linkedDialogueIds),
        });
      }
    }

    // dialogue
    if (bundle.dialogue) {
      const d = bundle.dialogue as Record<string, unknown>;
      if (typeof d.id === "string") {
        tryRegister({
          id: d.id,
          name: (d.name as string) || d.id,
          type: "dialogue",
          tags: ["dialogue"],
          description: (d.description as string) || "",
          dependencies: [],
        });
      }
    }

    // faction
    if (bundle.faction) {
      const f = bundle.faction as Record<string, unknown>;
      if (typeof f.id === "string") {
        tryRegister({
          id: f.id,
          name: (f.name as string) || f.id,
          type: "faction",
          tags: ["faction"],
          description: (f.description as string) || "",
          dependencies: [],
        });
      }
    }

    // lootTable
    if (bundle.lootTable) {
      const lt = bundle.lootTable as Record<string, unknown>;
      if (typeof lt.id === "string") {
        const deps = _extractStringArray(
          Array.isArray(lt.entries)
            ? (lt.entries as Record<string, unknown>[]).map((e) => e.subTableId).filter(Boolean)
            : undefined,
        );
        tryRegister({
          id: lt.id,
          name: (lt.id as string),
          type: "lootTable",
          tags: ["loot-table"],
          description: `Loot table with ${Array.isArray(lt.entries) ? (lt.entries as unknown[]).length : 0} entr${Array.isArray(lt.entries) && (lt.entries as unknown[]).length === 1 ? "y" : "ies"}`,
          dependencies: deps,
        });
      }
    }

    // npc
    if (bundle.npc) {
      const n = bundle.npc as Record<string, unknown>;
      if (typeof n.id === "string") {
        const deps: string[] = [];
        if (typeof n.dialogueId === "string") deps.push(n.dialogueId);
        if (typeof n.lootTableId === "string") deps.push(n.lootTableId);
        if (typeof n.factionId === "string") deps.push(n.factionId);
        tryRegister({
          id: n.id,
          name: (n.displayName as string) || (n.name as string) || n.id,
          type: "npc",
          tags: ["npc", ..._extractStringArray(n.tags)],
          description: (n.description as string) || "",
          dependencies: deps,
        });
      }
    }

    // item
    if (bundle.item) {
      const i = bundle.item as Record<string, unknown>;
      if (typeof i.id === "string") {
        tryRegister({
          id: i.id,
          name: (i.name as string) || i.id,
          type: "item",
          tags: ["item", ..._extractStringArray(i.tags)],
          description: (i.description as string) || "",
          dependencies: [],
        });
      }
    }

    // spawn
    if (bundle.spawn) {
      const s = bundle.spawn as Record<string, unknown>;
      if (typeof s.id === "string") {
        const deps: string[] = [];
        if (typeof s.lootTableId === "string") deps.push(s.lootTableId);
        if (typeof s.archetypeId === "string") deps.push(s.archetypeId);
        tryRegister({
          id: s.id,
          name: (s.id as string),
          type: "spawn",
          tags: ["spawn"],
          description: (s.description as string) || "",
          dependencies: deps,
        });
      }
    }

    // map entities
    if (bundle.map) {
      const map = bundle.map as { entities?: { id?: string; type?: string; label?: string }[] };
      for (const entity of map.entities ?? []) {
        if (entity.id) {
          tryRegister({
            id: entity.id,
            name: entity.label ?? entity.id,
            type: "map",
            tags: ["map", ...(entity.type ? [entity.type] : [])],
            description: `Map entity (${entity.type ?? "unknown"})`,
            dependencies: [],
          });
        }
      }
    }

    return count;
  }

  // ── Query ─────────────────────────────────────────────────────────────────

  /** Return all assets, unsorted. */
  getAll(): AssetEntry[] {
    return Array.from(this._assets.values());
  }

  /**
   * Search assets by query string, type filter, tag filter, and favorites flag.
   * Results are sorted: favorites first, then alphabetically by name.
   */
  search(opts: AssetSearchOptions = {}): AssetEntry[] {
    const { query, types, tags, favoritesOnly } = opts;
    const lcQuery = query ? query.toLowerCase() : "";

    let results = Array.from(this._assets.values());

    if (lcQuery) {
      results = results.filter(
        (a) =>
          a.id.toLowerCase().includes(lcQuery) ||
          a.name.toLowerCase().includes(lcQuery) ||
          a.description.toLowerCase().includes(lcQuery),
      );
    }

    if (types && types.length > 0) {
      const typeSet = new Set(types);
      results = results.filter((a) => typeSet.has(a.type));
    }

    if (tags && tags.length > 0) {
      results = results.filter((a) => tags.every((t) => a.tags.includes(t)));
    }

    if (favoritesOnly) {
      results = results.filter((a) => this._favorites.has(a.id));
    }

    // Sort: favorites first, then alphabetically
    return results.sort((a, b) => {
      const fa = this._favorites.has(a.id);
      const fb = this._favorites.has(b.id);
      if (fa !== fb) return fa ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  getById(id: string): AssetEntry | undefined {
    return this._assets.get(id);
  }

  // ── Favorites ─────────────────────────────────────────────────────────────

  isFavorite(id: string): boolean {
    return this._favorites.has(id);
  }

  toggleFavorite(id: string): boolean {
    if (this._favorites.has(id)) {
      this._favorites.delete(id);
      return false;
    }
    this._favorites.add(id);
    return true;
  }

  getFavoriteIds(): string[] {
    return Array.from(this._favorites);
  }

  get favoriteCount(): number {
    return this._favorites.size;
  }

  // ── Dependency graph ──────────────────────────────────────────────────────

  /**
   * Return all assets that the given asset directly depends on
   * (i.e. whose IDs appear in `asset.dependencies`).
   */
  getDependencies(id: string): AssetEntry[] {
    const asset = this._assets.get(id);
    if (!asset) return [];
    return asset.dependencies
      .map((depId) => this._assets.get(depId))
      .filter((a): a is AssetEntry => a !== undefined);
  }

  /**
   * Return all assets that have `id` listed in their `dependencies`.
   * These are the reverse-dependencies (dependents).
   */
  getDependents(id: string): AssetEntry[] {
    return Array.from(this._assets.values()).filter((a) => a.dependencies.includes(id));
  }

  /** Collect the complete dependency graph (BFS) for an asset ID. */
  getTransitiveDependencies(id: string): AssetEntry[] {
    const visited = new Set<string>();
    const queue = [id];
    const result: AssetEntry[] = [];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      const asset = this._assets.get(cur);
      if (!asset || cur === id) {
        for (const dep of (asset?.dependencies ?? [])) queue.push(dep);
        continue;
      }
      result.push(asset);
      for (const dep of asset.dependencies) queue.push(dep);
    }
    return result;
  }

  // ── All available tags ─────────────────────────────────────────────────────

  /** Return all distinct tags across all registered assets, sorted. */
  getAllTags(): string[] {
    const tags = new Set<string>();
    for (const a of this._assets.values()) {
      for (const t of a.tags) tags.add(t);
    }
    return Array.from(tags).sort();
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _extractStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}
