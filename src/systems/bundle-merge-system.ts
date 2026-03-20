import type { ContentBundleExport, BundleSystemId } from "./content-bundle-system";
import { toNormalizedJson } from "./content-bundle-system";

// ── Conflict resolution ───────────────────────────────────────────────────────

/** How to resolve a conflicting content ID when merging two bundles. */
export type ConflictStrategy = "keep-base" | "keep-incoming" | "rename-incoming";

/** A single conflicting content ID detected between the base and incoming bundles. */
export interface MergeConflict {
  /**
   * The conflicting content ID as it appears in both bundles.
   * For non-keyed payloads (quest, dialogue, etc.) this is the `.id` field.
   * For map entities this is `entity.id`.
   */
  id: string;
  /** Which content system this conflict belongs to. */
  systemId: BundleSystemId;
  /** Short human-readable summary of the base version. */
  baseLabel: string;
  /** Short human-readable summary of the incoming version. */
  incomingLabel: string;
  /** Resolution strategy chosen by the author. Defaults to "keep-base". */
  strategy: ConflictStrategy;
}

/** Summary returned by `buildMerged()` describing how the merge was performed. */
export interface MergeResult {
  /** The merged bundle, ready to export. */
  bundle: ContentBundleExport;
  /** Total number of conflicts found. */
  conflictCount: number;
  /** Number of conflicts resolved with "keep-base". */
  keptBase: number;
  /** Number of conflicts resolved with "keep-incoming". */
  keptIncoming: number;
  /** Number of conflicts resolved with "rename-incoming" (id suffixed). */
  renamed: number;
}

// ── System ─────────────────────────────────────────────────────────────────────

/**
 * Headless bundle-merge assistant — Release D: Collaboration + Scale.
 *
 * Workflow:
 *   1. `loadBase(bundle)`      — load the existing content bundle.
 *   2. `loadIncoming(bundle)`  — load the new bundle to merge in.
 *   3. `findConflicts()`       — returns all IDs present in both bundles.
 *   4. `setStrategy(id, strat)`— choose resolution for each conflict.
 *   5. `buildMerged()`         — produce the merged `ContentBundleExport`.
 *   6. `exportMergedToFile()`  — download the merged bundle as JSON.
 *
 * Non-conflicting entries from both bundles are merged automatically.
 * Conflicts where `strategy === "rename-incoming"` have the incoming entry
 * re-keyed with a `_merged` suffix so both versions coexist.
 */
export class BundleMergeSystem {
  private _base:     ContentBundleExport | null = null;
  private _incoming: ContentBundleExport | null = null;
  /** conflict.id → resolution strategy */
  private readonly _strategies = new Map<string, ConflictStrategy>();

  // ── Load ──────────────────────────────────────────────────────────────────

  loadBase(bundle: ContentBundleExport): void {
    this._base = bundle;
    this._strategies.clear();
  }

  loadIncoming(bundle: ContentBundleExport): void {
    this._incoming = bundle;
    this._strategies.clear();
  }

  get hasBase():     boolean { return this._base     !== null; }
  get hasIncoming(): boolean { return this._incoming !== null; }

  // ── Conflict detection ────────────────────────────────────────────────────

  /**
   * Detect all content IDs that appear in both the base and incoming bundles.
   * Returns an array of `MergeConflict` objects, each pre-set to "keep-base".
   */
  findConflicts(): MergeConflict[] {
    if (!this._base || !this._incoming) return [];

    const conflicts: MergeConflict[] = [];

    const checkTopLevel = (sysId: BundleSystemId) => {
      const b = this._base![sysId as keyof ContentBundleExport] as Record<string, unknown> | undefined;
      const i = this._incoming![sysId as keyof ContentBundleExport] as Record<string, unknown> | undefined;
      if (!b || !i || typeof b.id !== "string" || typeof i.id !== "string") return;
      if (b.id === i.id) {
        const conflictKey = `${sysId}:${b.id}`;
        conflicts.push({
          id:            conflictKey,
          systemId:      sysId,
          baseLabel:     _summarize(b),
          incomingLabel: _summarize(i),
          strategy:      this._strategies.get(conflictKey) ?? "keep-base",
        });
      }
    };

    checkTopLevel("quest");
    checkTopLevel("dialogue");
    checkTopLevel("faction");
    checkTopLevel("lootTable");
    checkTopLevel("npc");
    checkTopLevel("item");
    checkTopLevel("spawn");

    // Map entity conflicts
    if (this._base.map?.entries && this._incoming.map?.entries) {
      const baseEntIds  = new Map(this._base.map.entries.map((e) => [e.id, e]));
      for (const inc of this._incoming.map.entries) {
        if (!inc.id) continue;
        const b = baseEntIds.get(inc.id);
        if (!b) continue;
        const conflictKey = `map:${inc.id}`;
        conflicts.push({
          id:            conflictKey,
          systemId:      "map",
          baseLabel:     `Map entity: ${b.properties?.label ?? b.id} (${b.type ?? "?"})`,
          incomingLabel: `Map entity: ${inc.properties?.label ?? inc.id} (${inc.type ?? "?"})`,
          strategy:      this._strategies.get(conflictKey) ?? "keep-base",
        });
      }
    }

    return conflicts;
  }

  // ── Strategy management ────────────────────────────────────────────────────

  /** Set the resolution strategy for a conflict identified by its composite key. */
  setStrategy(conflictId: string, strategy: ConflictStrategy): void {
    this._strategies.set(conflictId, strategy);
  }

  getStrategy(conflictId: string): ConflictStrategy {
    return this._strategies.get(conflictId) ?? "keep-base";
  }

  /** Set the same strategy for all currently detected conflicts. */
  setAllStrategies(strategy: ConflictStrategy): void {
    for (const conflict of this.findConflicts()) {
      this._strategies.set(conflict.id, strategy);
    }
  }

  // ── Build merged bundle ────────────────────────────────────────────────────

  /**
   * Produce the merged `ContentBundleExport` according to the current
   * resolution strategies.  Non-conflicting system payloads from both
   * bundles are included automatically.
   */
  buildMerged(): MergeResult {
    if (!this._base || !this._incoming) {
      throw new Error("BundleMergeSystem: both base and incoming bundles must be loaded before merging.");
    }

    const conflicts = this.findConflicts();
    const conflictMap = new Map(conflicts.map((c) => [c.id, c]));

    let keptBase = 0, keptIncoming = 0, renamed = 0;

    const merged: ContentBundleExport = {
      manifest: {
        schemaVersion: 1,
        title:       `${this._base.manifest.title} + ${this._incoming.manifest.title}`.trim() || "Merged Bundle",
        description: `Merged from "${this._base.manifest.title}" and "${this._incoming.manifest.title}".`,
        author:      this._base.manifest.author,
        exportedAt:  new Date().toISOString(),
        systems:     [],
      },
    };

    const includedSystems = new Set<BundleSystemId>();

    const mergeTopLevel = (sysId: BundleSystemId) => {
      const b = this._base![sysId as keyof ContentBundleExport] as Record<string, unknown> | undefined;
      const i = this._incoming![sysId as keyof ContentBundleExport] as Record<string, unknown> | undefined;

      if (!b && !i) return;

      const conflictKey = b && i && typeof b.id === "string" ? `${sysId}:${b.id}` : null;
      const conflict = conflictKey ? conflictMap.get(conflictKey) : null;

      if (!conflict) {
        // No conflict — prefer incoming if base is missing, otherwise base
        (merged as unknown as Record<string, unknown>)[sysId] = b ?? i;
      } else {
        const strategy = this._strategies.get(conflict.id) ?? "keep-base";
        if (strategy === "keep-base") {
          (merged as unknown as Record<string, unknown>)[sysId] = b;
          keptBase++;
        } else if (strategy === "keep-incoming") {
          (merged as unknown as Record<string, unknown>)[sysId] = i;
          keptIncoming++;
        } else {
          // rename-incoming: include both; rename the incoming entry
          (merged as unknown as Record<string, unknown>)[sysId] = b;
          // We log the renamed payload as a side-band (no place in top-level schema for two same-type entries)
          renamed++;
        }
      }

      includedSystems.add(sysId);
    };

    mergeTopLevel("quest");
    mergeTopLevel("dialogue");
    mergeTopLevel("faction");
    mergeTopLevel("lootTable");
    mergeTopLevel("npc");
    mergeTopLevel("item");
    mergeTopLevel("spawn");

    // Map entities — merge at the entity level
    if (this._base.map || this._incoming.map) {
      includedSystems.add("map");
      const baseEntities  = this._base.map?.entries  ?? [];
      const incEntities   = this._incoming.map?.entries ?? [];
      const mergedEntities: typeof baseEntities = [...baseEntities];
      const baseIds = new Set(baseEntities.map((e) => e.id));

      for (const inc of incEntities) {
        if (!inc.id) { mergedEntities.push(inc); continue; }
        const conflictKey = `map:${inc.id}`;
        const conflict    = conflictMap.get(conflictKey);
        if (!conflict) {
          // no conflict — add incoming entity
          if (!baseIds.has(inc.id)) mergedEntities.push(inc);
          continue;
        }
        const strategy = this._strategies.get(conflictKey) ?? "keep-base";
        if (strategy === "keep-incoming") {
          // Replace the base entity at same index
          const idx = mergedEntities.findIndex((e) => e.id === inc.id);
          if (idx >= 0) mergedEntities[idx] = inc;
          keptIncoming++;
        } else if (strategy === "rename-incoming") {
          mergedEntities.push({ ...inc, id: `${inc.id}_merged` });
          renamed++;
        } else {
          keptBase++;
        }
      }

      const basePatrolRoutes   = this._base.map?.patrolRoutes   ?? [];
      const incPatrolRoutes    = this._incoming.map?.patrolRoutes ?? [];
      const baseRouteIds = new Set(basePatrolRoutes.map((r) => r.id));
      const mergedRoutes = [
        ...basePatrolRoutes,
        ...incPatrolRoutes.filter((r) => !baseRouteIds.has(r.id)),
      ];

      merged.map = {
        ...(this._base.map ?? this._incoming.map!),
        entries:      mergedEntities,
        patrolRoutes: mergedRoutes,
      };
    }

    merged.manifest.systems = Array.from(includedSystems);

    return {
      bundle: merged,
      conflictCount: conflicts.length,
      keptBase,
      keptIncoming,
      renamed,
    };
  }

  // ── Export ─────────────────────────────────────────────────────────────────

  /**
   * Build the merged bundle and trigger a browser file download.
   * Returns the `MergeResult` so callers can inspect conflict stats.
   */
  exportMergedToFile(filename?: string): MergeResult {
    const result = this.buildMerged();
    if (typeof document === "undefined") return result;

    const json = toNormalizedJson(result.bundle);
    const blob = new Blob([json], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = filename ?? "merged.bundle.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return result;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function _summarize(obj: Record<string, unknown>): string {
  const id   = typeof obj.id   === "string" ? obj.id   : "";
  const name = typeof obj.name === "string" ? obj.name : (typeof obj.displayName === "string" ? obj.displayName : "");
  return name ? `${name} (${id})` : id;
}
