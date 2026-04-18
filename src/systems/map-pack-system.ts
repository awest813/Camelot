import {
  MapEditorSystem,
  type MapExportData,
  type MapValidationReport,
  type MapValidationContext,
} from "./map-editor-system";

// ── Public types ──────────────────────────────────────────────────────────────

export interface MapPackEntry {
  /** Unique identifier for this map within the pack. */
  id: string;
  /** Human-readable display label. */
  label: string;
  /** Full map snapshot. */
  data: MapExportData;
}

export interface MapPackData {
  version: 1;
  /** Optional human-readable pack title. */
  title?: string;
  /** Optional author or owner of this pack. */
  author?: string;
  /** Optional longer description of the pack's content. */
  description?: string;
  /** All maps in the pack. */
  maps: MapPackEntry[];
}

// ── MapPackSystem ─────────────────────────────────────────────────────────────

/**
 * MapPackSystem — headless multi-map bundle manager.
 *
 * Stores named `MapExportData` snapshots and supports:
 * - CRUD: `addMap` / `removeMap` / `getMap` / `getAllMaps` / `getMapIds`
 * - Metadata: `setTitle` / `setAuthor` / `setDescription`
 * - Update: `updateMapData`
 * - Validation: `validateMap` / `validateAll` (via `MapEditorSystem.validateMapData`)
 * - Export: `buildPack` / `exportToJson` / `exportToFile`
 * - Import: `importFromJson` / `importFromFile`
 * - Callbacks: `onMapAdded` / `onMapRemoved`
 * - `reset()` clears all maps and resets metadata
 */
export class MapPackSystem {
  /** Optional pack title persisted in the exported `MapPackData`. */
  public title: string = "";
  /** Optional author string persisted in the exported `MapPackData`. */
  public author: string = "";
  /** Optional pack description persisted in the exported `MapPackData`. */
  public description: string = "";

  /** Fired when a map is added via `addMap`. Receives the new entry. */
  public onMapAdded: ((entry: MapPackEntry) => void) | null = null;

  /** Fired when a map is removed via `removeMap`. Receives the removed entry id. */
  public onMapRemoved: ((id: string) => void) | null = null;

  private readonly _maps: Map<string, MapPackEntry> = new Map();

  // ── CRUD ──────────────────────────────────────────────────────────────────

  /**
   * Add a new map to the pack.
   * Returns `true` on success; `false` if `id` is empty or already in use.
   */
  addMap(id: string, label: string, data: MapExportData): boolean {
    const trimmedId = id.trim();
    if (!trimmedId) return false;
    if (this._maps.has(trimmedId)) return false;
    const entry: MapPackEntry = { id: trimmedId, label: label.trim() || trimmedId, data };
    this._maps.set(trimmedId, entry);
    this.onMapAdded?.({ ...entry });
    return true;
  }

  /**
   * Remove a map by id.
   * Returns `true` if the map was found and removed; `false` otherwise.
   */
  removeMap(id: string): boolean {
    if (!this._maps.has(id)) return false;
    this._maps.delete(id);
    this.onMapRemoved?.(id);
    return true;
  }

  /**
   * Returns a shallow copy of the entry for the given id, or `null` if not found.
   */
  getMap(id: string): MapPackEntry | null {
    const entry = this._maps.get(id);
    if (!entry) return null;
    return { ...entry };
  }

  /**
   * Returns shallow copies of all map entries in insertion order.
   */
  getAllMaps(): MapPackEntry[] {
    return Array.from(this._maps.values()).map((e) => ({ ...e }));
  }

  /**
   * Returns all registered map IDs in insertion order.
   */
  getMapIds(): string[] {
    return Array.from(this._maps.keys());
  }

  /**
   * Replace the `MapExportData` for an existing map.
   * Returns `true` on success; `false` if the map id is not found.
   */
  updateMapData(id: string, data: MapExportData): boolean {
    const entry = this._maps.get(id);
    if (!entry) return false;
    entry.data = data;
    return true;
  }

  /**
   * Update the display label of an existing map.
   * Returns `true` on success; `false` if the map id is not found.
   */
  updateMapLabel(id: string, label: string): boolean {
    const entry = this._maps.get(id);
    if (!entry) return false;
    entry.label = label.trim() || id;
    return true;
  }

  /** Total number of maps currently in the pack. */
  get mapCount(): number {
    return this._maps.size;
  }

  // ── Validation ────────────────────────────────────────────────────────────

  /**
   * Run validation rules against the map with the given id.
   * Returns `null` if the map id is not found.
   * Uses `MapEditorSystem.validateMapData` so no live scene is required.
   */
  validateMap(id: string, minEntitySpacing?: number, context?: MapValidationContext): MapValidationReport | null {
    const entry = this._maps.get(id);
    if (!entry) return null;
    return MapEditorSystem.validateMapData(entry.data, minEntitySpacing, context);
  }

  /**
   * Run validation against every map in the pack.
   * Returns a `Map<id, MapValidationReport>` with one report per map.
   */
  validateAll(minEntitySpacing?: number, context?: MapValidationContext): Map<string, MapValidationReport> {
    const results = new Map<string, MapValidationReport>();
    for (const [id, entry] of this._maps) {
      results.set(id, MapEditorSystem.validateMapData(entry.data, minEntitySpacing, context));
    }
    return results;
  }

  /**
   * Returns `true` when all maps in the pack pass validation.
   * An empty pack is considered valid.
   */
  isAllValid(minEntitySpacing?: number, context?: MapValidationContext): boolean {
    for (const entry of this._maps.values()) {
      const report = MapEditorSystem.validateMapData(entry.data, minEntitySpacing, context);
      if (!report.isValid) return false;
    }
    return true;
  }

  // ── Export ────────────────────────────────────────────────────────────────

  /**
   * Build and return the `MapPackData` structure representing the current pack.
   */
  buildPack(): MapPackData {
    const pack: MapPackData = {
      version: 1,
      maps: Array.from(this._maps.values()).map((e) => ({ ...e })),
    };
    if (this.title.trim())       pack.title       = this.title.trim();
    if (this.author.trim())      pack.author      = this.author.trim();
    if (this.description.trim()) pack.description = this.description.trim();
    return pack;
  }

  /**
   * Serialize the current pack to a JSON string.
   */
  exportToJson(): string {
    return JSON.stringify(this.buildPack(), null, 2);
  }

  /**
   * Trigger a browser file download of the pack as `<filename>.mappack.json`.
   * No-ops in non-browser (headless / SSR) environments.
   */
  exportToFile(filename?: string): void {
    if (typeof document === "undefined") return;
    const json = this.exportToJson();
    const blob = new Blob([json], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = filename ?? `camelot_mappack_${Date.now()}.mappack.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Import ────────────────────────────────────────────────────────────────

  /**
   * Load a pack from a raw JSON string.
   * Maps whose IDs already exist in the pack are skipped.
   * Returns `true` on success; `false` if parsing fails or structure is invalid.
   */
  importFromJson(json: string): boolean {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      return false;
    }
    if (!this._isMapPackData(parsed)) return false;
    const pack = parsed as MapPackData;

    if (pack.title !== undefined)       this.title       = pack.title;
    if (pack.author !== undefined)      this.author      = pack.author;
    if (pack.description !== undefined) this.description = pack.description;

    for (const entry of pack.maps) {
      if (!entry.id || this._maps.has(entry.id)) continue;
      const newEntry: MapPackEntry = { id: entry.id, label: entry.label || entry.id, data: entry.data };
      this._maps.set(entry.id, newEntry);
      this.onMapAdded?.({ ...newEntry });
    }
    return true;
  }

  /**
   * Load a pack from a browser `File` object.
   * Returns a Promise that resolves to `true` on success, `false` on failure.
   */
  importFromFile(file: File): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve(this.importFromJson((e.target?.result as string) ?? ""));
      };
      reader.onerror = () => resolve(false);
      reader.readAsText(file);
    });
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  /**
   * Remove all maps and reset metadata fields.
   * Does not fire `onMapRemoved` for individual entries.
   */
  reset(): void {
    this._maps.clear();
    this.title       = "";
    this.author      = "";
    this.description = "";
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _isMapPackData(value: unknown): boolean {
    if (typeof value !== "object" || value === null) return false;
    const v = value as Record<string, unknown>;
    if (v["version"] !== 1) return false;
    if (!Array.isArray(v["maps"])) return false;
    for (const entry of v["maps"] as unknown[]) {
      if (typeof entry !== "object" || entry === null) return false;
      const e = entry as Record<string, unknown>;
      if (typeof e["id"] !== "string" || !e["id"]) return false;
      if (typeof e["data"] !== "object" || e["data"] === null) return false;
    }
    return true;
  }
}
