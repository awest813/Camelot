import type {
  QuestDefinition,
  QuestTriggerType,
  QuestValidationReport,
} from "../framework/quests/quest-types";
import { QuestGraphEngine } from "../framework/quests/quest-graph-engine";

/** A single node in a quest being authored. */
export interface QuestCreatorNodeDraft {
  id: string;
  description: string;
  triggerType: QuestTriggerType;
  targetId: string;
  requiredCount: number;
  prerequisites: string[];
}

/** The top-level quest draft being edited. */
export interface QuestCreatorDraft {
  id: string;
  name: string;
  description: string;
  xpReward: number;
  nodes: QuestCreatorNodeDraft[];
}

const BLANK_DRAFT: QuestCreatorDraft = {
  id: "",
  name: "",
  description: "",
  xpReward: 100,
  nodes: [],
};

/**
 * Headless authoring system for quest definitions.
 *
 * Manages a mutable draft (`QuestCreatorDraft`), supports CRUD for nodes,
 * validates the draft via the framework `QuestGraphEngine`, and provides
 * JSON / file-download export + file-import.
 */
export class QuestCreatorSystem {
  private _draft: QuestCreatorDraft;
  private _nodeIdCounter = 0;

  constructor(initial?: Partial<QuestCreatorDraft>) {
    this._draft = {
      ...BLANK_DRAFT,
      ...initial,
      nodes: [...(initial?.nodes ?? [])],
    };
  }

  // ── Quest metadata ─────────────────────────────────────────────────────────

  /** Update quest-level metadata fields. */
  setMeta(id: string, name: string, description: string, xpReward: number): void {
    this._draft.id          = id.trim();
    this._draft.name        = name.trim();
    this._draft.description = description.trim();
    this._draft.xpReward    = Math.max(0, xpReward);
  }

  // ── Node management ────────────────────────────────────────────────────────

  /**
   * Append a new node to the draft.
   * `partial.id` is used when supplied; otherwise a unique auto-ID is generated.
   * Returns the final node ID.
   */
  addNode(partial: Partial<QuestCreatorNodeDraft> = {}): string {
    const id = partial.id?.trim() || `node_${++this._nodeIdCounter}`;
    const node: QuestCreatorNodeDraft = {
      id,
      description:   partial.description   ?? "",
      triggerType:   partial.triggerType   ?? "kill",
      targetId:      partial.targetId      ?? "",
      requiredCount: Math.max(1, partial.requiredCount ?? 1),
      prerequisites: [...(partial.prerequisites ?? [])],
    };
    this._draft.nodes.push(node);
    return id;
  }

  /**
   * Apply field updates to an existing node.
   * Returns `false` when `nodeId` is not found.
   */
  updateNode(
    nodeId: string,
    updates: Partial<Omit<QuestCreatorNodeDraft, "id">>,
  ): boolean {
    const node = this._draft.nodes.find(n => n.id === nodeId);
    if (!node) return false;

    if (updates.description   !== undefined) node.description   = updates.description;
    if (updates.triggerType   !== undefined) node.triggerType   = updates.triggerType;
    if (updates.targetId      !== undefined) node.targetId      = updates.targetId.trim();
    if (updates.requiredCount !== undefined) node.requiredCount = Math.max(1, updates.requiredCount);
    if (updates.prerequisites !== undefined) node.prerequisites = [...updates.prerequisites];

    return true;
  }

  /**
   * Remove a node from the draft.
   * Any prerequisite references to this node in other nodes are pruned automatically.
   * Returns `false` when `nodeId` is not found.
   */
  removeNode(nodeId: string): boolean {
    const idx = this._draft.nodes.findIndex(n => n.id === nodeId);
    if (idx === -1) return false;

    this._draft.nodes.splice(idx, 1);

    // Prune dangling prerequisite references
    for (const node of this._draft.nodes) {
      node.prerequisites = node.prerequisites.filter(p => p !== nodeId);
    }
    return true;
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  /**
   * Validate the current draft using the framework `QuestGraphEngine`.
   * Returns a `QuestValidationReport` even when the draft is structurally
   * incomplete (in which case validation errors are surfaced as issues).
   */
  validate(): QuestValidationReport {
    try {
      const definition = this.toQuestDefinition();
      const engine = new QuestGraphEngine([definition]);
      return engine.validateGraph(definition.id);
    } catch (err) {
      return {
        questId: this._draft.id || "(draft)",
        valid: false,
        issues: [
          {
            type: "not_found",
            nodeId: "",
            detail: err instanceof Error ? err.message : String(err),
          },
        ],
      };
    }
  }

  // ── Export ─────────────────────────────────────────────────────────────────

  /** Convert the draft to a `QuestDefinition` ready for registration. */
  toQuestDefinition(): QuestDefinition {
    return {
      id:          this._draft.id,
      name:        this._draft.name,
      description: this._draft.description || undefined,
      xpReward:    this._draft.xpReward,
      nodes:       this._draft.nodes.map(n => ({
        id:            n.id,
        description:   n.description,
        triggerType:   n.triggerType,
        targetId:      n.targetId,
        requiredCount: n.requiredCount,
        prerequisites: n.prerequisites.length > 0 ? [...n.prerequisites] : undefined,
      })),
    };
  }

  /** Serialize the draft as a JSON string (pretty-printed). */
  exportToJson(): string {
    return JSON.stringify(this.toQuestDefinition(), null, 2);
  }

  /**
   * Trigger a browser file-download of the current draft as a JSON file.
   * No-op in headless (non-browser) environments where `document` is absent.
   */
  exportToFile(filename?: string): void {
    if (typeof document === "undefined") return;
    const json = this.exportToJson();
    const blob = new Blob([json], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = filename ?? `${this._draft.id || "quest"}.quest.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Import ─────────────────────────────────────────────────────────────────

  /**
   * Deserialize and load a quest definition from a JSON string.
   * Returns `true` on success, `false` on any parse or schema error.
   */
  importFromJson(json: string): boolean {
    try {
      const parsed = JSON.parse(json) as QuestDefinition;
      if (!parsed || typeof parsed.id !== "string" || !Array.isArray(parsed.nodes)) {
        return false;
      }
      this._draft = {
        id:          parsed.id,
        name:        parsed.name        ?? "",
        description: parsed.description ?? "",
        xpReward:    parsed.xpReward    ?? 0,
        nodes:       parsed.nodes.map(n => ({
          id:            n.id,
          description:   n.description,
          triggerType:   n.triggerType,
          targetId:      n.targetId,
          requiredCount: n.requiredCount,
          prerequisites: n.prerequisites ? [...n.prerequisites] : [],
        })),
      };
      this._nodeIdCounter = 0;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Read a `File` from the browser and import its JSON content.
   * Returns a Promise resolving to `true` on success.
   */
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

  // ── Reset ──────────────────────────────────────────────────────────────────

  /** Discard the current draft and start fresh. */
  reset(): void {
    this._draft = { ...BLANK_DRAFT, nodes: [] };
    this._nodeIdCounter = 0;
  }

  // ── Getters ────────────────────────────────────────────────────────────────

  /** Read-only snapshot of the current draft. */
  get draft(): Readonly<QuestCreatorDraft> {
    return this._draft;
  }

  /** Read-only list of nodes in the current draft. */
  get nodes(): readonly QuestCreatorNodeDraft[] {
    return this._draft.nodes;
  }
}
