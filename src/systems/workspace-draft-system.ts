import type { MapEditorSystem } from "./map-editor-system";
import type { QuestCreatorSystem } from "./quest-creator-system";
import type { DialogueCreatorSystem } from "./dialogue-creator-system";
import type { FactionCreatorSystem } from "./faction-creator-system";
import type { LootTableCreatorSystem } from "./loot-table-creator-system";
import type { NpcCreatorSystem } from "./npc-creator-system";
import type { ItemCreatorSystem } from "./item-creator-system";
import type { SpawnCreatorSystem } from "./spawn-creator-system";

// ── Types ─────────────────────────────────────────────────────────────────────

/** Snapshot stored in localStorage. */
export interface WorkspaceDraftSnapshot {
  /** ISO-8601 timestamp of the last save. */
  savedAt: string;
  /** Serialised creator-system payloads (optional — only present when non-empty). */
  quest?:     string;
  dialogue?:  string;
  faction?:   string;
  lootTable?: string;
  npc?:       string;
  item?:      string;
  spawn?:     string;
  map?:       string;
}

/** Summary of what was restored from a draft. */
export interface WorkspaceDraftRestoreResult {
  /** How many systems had data restored. */
  restoredCount: number;
  /** Names of systems that were restored. */
  restoredSystems: string[];
  /** ISO timestamp of the draft that was restored, or null if no draft. */
  savedAt: string | null;
}

// ── Attached systems registry ─────────────────────────────────────────────────

export interface WorkspaceDraftSystems {
  quest?:     QuestCreatorSystem;
  dialogue?:  DialogueCreatorSystem;
  faction?:   FactionCreatorSystem;
  lootTable?: LootTableCreatorSystem;
  npc?:       NpcCreatorSystem;
  item?:      ItemCreatorSystem;
  spawn?:     SpawnCreatorSystem;
  map?:       MapEditorSystem;
}

// ── System ─────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "camelot-workspace-draft";
const DEBOUNCE_MS = 2_000;

/**
 * LocalStorage-backed workspace draft — Release D: Collaboration + Scale.
 *
 * Auto-saves the state of all attached creator systems 2 s after any
 * `markDirty()` call so authors never lose work mid-session.
 *
 * Usage:
 *   const draft = new WorkspaceDraftSystem();
 *   draft.attach({ quest: questCreatorSystem, ... });
 *   draft.onSaved = () => ui.showNotification("Draft auto-saved.", 1500);
 *
 *   // Trigger a deferred save (call from creator UI onClose, etc.)
 *   draft.markDirty();
 *
 *   // On startup: restore if a draft exists
 *   const result = draft.restore();
 *   if (result.restoredCount > 0) { ... show notification ... }
 *
 *   // Query
 *   draft.hasDraft();
 *   draft.getDraftSavedAt(); // ISO string or null
 *   draft.clearDraft();
 */
export class WorkspaceDraftSystem {
  /** Fired after a debounced save completes successfully. */
  public onSaved: (() => void) | null = null;

  private _systems: WorkspaceDraftSystems = {};
  private _debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Attach ────────────────────────────────────────────────────────────────

  attach(systems: WorkspaceDraftSystems): this {
    this._systems = { ...this._systems, ...systems };
    return this;
  }

  attachQuest(sys: QuestCreatorSystem):           this { this._systems.quest     = sys; return this; }
  attachDialogue(sys: DialogueCreatorSystem):     this { this._systems.dialogue  = sys; return this; }
  attachFaction(sys: FactionCreatorSystem):       this { this._systems.faction   = sys; return this; }
  attachLootTable(sys: LootTableCreatorSystem):   this { this._systems.lootTable = sys; return this; }
  attachNpc(sys: NpcCreatorSystem):               this { this._systems.npc       = sys; return this; }
  attachItem(sys: ItemCreatorSystem):             this { this._systems.item      = sys; return this; }
  attachSpawn(sys: SpawnCreatorSystem):           this { this._systems.spawn     = sys; return this; }
  attachMap(sys: MapEditorSystem):                this { this._systems.map       = sys; return this; }

  // ── Dirty / auto-save ─────────────────────────────────────────────────────

  /**
   * Schedule a debounced save.  Subsequent calls within the debounce window
   * reset the timer so only one save fires per idle period.
   */
  markDirty(): void {
    if (this._debounceTimer !== null) {
      clearTimeout(this._debounceTimer);
    }
    this._debounceTimer = setTimeout(() => {
      this._debounceTimer = null;
      this.save();
    }, DEBOUNCE_MS);
  }

  /** Cancel any pending debounced save without writing to storage. */
  cancelPending(): void {
    if (this._debounceTimer !== null) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  /**
   * Immediately snapshot all attached systems and write to localStorage.
   * Safe to call from a non-browser environment (no-op).
   * Returns the snapshot that was saved.
   */
  save(): WorkspaceDraftSnapshot {
    const snap: WorkspaceDraftSnapshot = { savedAt: new Date().toISOString() };

    if (this._systems.quest) {
      const json = this._systems.quest.exportToJson();
      if (_hasContent(json)) snap.quest = json;
    }
    if (this._systems.dialogue) {
      const json = this._systems.dialogue.exportToJson();
      if (_hasContent(json)) snap.dialogue = json;
    }
    if (this._systems.faction) {
      const json = this._systems.faction.exportToJson();
      if (_hasContent(json)) snap.faction = json;
    }
    if (this._systems.lootTable) {
      const json = this._systems.lootTable.exportToJson();
      if (_hasContent(json)) snap.lootTable = json;
    }
    if (this._systems.npc) {
      const json = this._systems.npc.exportToJson();
      if (_hasContent(json)) snap.npc = json;
    }
    if (this._systems.item) {
      const json = this._systems.item.exportToJson();
      if (_hasContent(json)) snap.item = json;
    }
    if (this._systems.spawn) {
      const json = this._systems.spawn.exportToJson();
      if (_hasContent(json)) snap.spawn = json;
    }
    if (this._systems.map) {
      const mapData = this._systems.map.exportMap();
      if (mapData.entries.length > 0 || (mapData.patrolRoutes?.length ?? 0) > 0) {
        snap.map = JSON.stringify(mapData);
      }
    }

    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
    }

    this.onSaved?.();
    return snap;
  }

  // ── Restore ───────────────────────────────────────────────────────────────

  /**
   * Read the draft from localStorage and restore each attached system.
   * Returns a summary of what was restored.
   * Non-browser environments or absent drafts return `restoredCount: 0`.
   */
  restore(): WorkspaceDraftRestoreResult {
    const result: WorkspaceDraftRestoreResult = {
      restoredCount: 0,
      restoredSystems: [],
      savedAt: null,
    };

    if (typeof localStorage === "undefined") return result;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return result;

    let snap: WorkspaceDraftSnapshot;
    try {
      snap = JSON.parse(raw) as WorkspaceDraftSnapshot;
    } catch {
      return result;
    }

    result.savedAt = snap.savedAt ?? null;

    const tryRestore = (
      name: string,
      json: string | undefined,
      fn: (json: string) => boolean,
    ) => {
      if (!json) return;
      try {
        if (fn(json)) {
          result.restoredCount++;
          result.restoredSystems.push(name);
        }
      } catch { /* skip */ }
    };

    if (this._systems.quest && snap.quest) {
      tryRestore("Quest", snap.quest, (j) => this._systems.quest!.importFromJson(j));
    }
    if (this._systems.dialogue && snap.dialogue) {
      tryRestore("Dialogue", snap.dialogue, (j) => this._systems.dialogue!.importFromJson(j));
    }
    if (this._systems.faction && snap.faction) {
      tryRestore("Faction", snap.faction, (j) => this._systems.faction!.importFromJson(j));
    }
    if (this._systems.lootTable && snap.lootTable) {
      tryRestore("Loot Table", snap.lootTable, (j) => this._systems.lootTable!.importFromJson(j));
    }
    if (this._systems.npc && snap.npc) {
      tryRestore("NPC", snap.npc, (j) => this._systems.npc!.importFromJson(j));
    }
    if (this._systems.item && snap.item) {
      tryRestore("Item", snap.item, (j) => this._systems.item!.importFromJson(j));
    }
    if (this._systems.spawn && snap.spawn) {
      tryRestore("Spawn", snap.spawn, (j) => this._systems.spawn!.importFromJson(j));
    }
    if (this._systems.map && snap.map) {
      tryRestore("Map", snap.map, (j) => {
        this._systems.map!.importFromJson(j);
        return true;
      });
    }

    return result;
  }

  // ── Query / clear ─────────────────────────────────────────────────────────

  /** Returns true when a draft snapshot exists in localStorage. */
  hasDraft(): boolean {
    if (typeof localStorage === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) !== null;
  }

  /**
   * Returns the ISO-8601 `savedAt` timestamp of the stored draft, or `null`
   * if no draft exists or the stored JSON is malformed.
   */
  getDraftSavedAt(): string | null {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return (JSON.parse(raw) as WorkspaceDraftSnapshot).savedAt ?? null;
    } catch {
      return null;
    }
  }

  /** Remove the workspace draft from localStorage. */
  clearDraft(): void {
    this.cancelPending();
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  /**
   * Return the raw snapshot from localStorage without applying it, or `null`
   * if none exists.
   */
  peekDraft(): WorkspaceDraftSnapshot | null {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as WorkspaceDraftSnapshot;
    } catch {
      return null;
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns true when the JSON string produced by a creator system contains
 * meaningful content (i.e. the root object has at least an "id" or "nodes"
 * key with a non-empty value, so we don't persist blank drafts).
 */
function _hasContent(json: string): boolean {
  try {
    const obj = JSON.parse(json) as Record<string, unknown>;
    // Quest / dialogue / faction / npc / item: presence of "id" is sufficient
    if (typeof obj.id === "string" && obj.id.trim() !== "") return true;
    // Loot table: has entries
    if (Array.isArray(obj.entries) && (obj.entries as unknown[]).length > 0) return true;
    // Spawn: has groups
    if (Array.isArray(obj.groups) && (obj.groups as unknown[]).length > 0) return true;
    // Dialogue / quest: has nodes
    if (Array.isArray(obj.nodes) && (obj.nodes as unknown[]).length > 0) return true;
    return false;
  } catch {
    return false;
  }
}
