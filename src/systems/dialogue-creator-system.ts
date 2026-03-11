import type {
  DialogueDefinition,
  DialogueChoiceCondition,
  DialogueChoiceEffect,
} from "../framework/dialogue/dialogue-types";

// ── Draft types ───────────────────────────────────────────────────────────────

export interface DialogueChoiceDraft {
  id: string;
  text: string;
  nextNodeId: string;
  endsDialogue: boolean;
  conditions: DialogueChoiceCondition[];
  effects: DialogueChoiceEffect[];
}

export interface DialogueNodeDraft {
  id: string;
  speaker: string;
  text: string;
  terminal: boolean;
  /** Canvas X position for graph view. */
  x: number;
  /** Canvas Y position for graph view. */
  y: number;
  choices: DialogueChoiceDraft[];
}

export interface DialogueDraft {
  id: string;
  startNodeId: string;
  nodes: DialogueNodeDraft[];
}

export interface DialogueValidationIssue {
  type: "missing_id" | "missing_start" | "dangling_ref" | "unreachable" | "empty_text" | "empty_choice_text";
  nodeId?: string;
  choiceId?: string;
  detail: string;
}

export interface DialogueValidationReport {
  valid: boolean;
  issues: DialogueValidationIssue[];
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const BLANK_DRAFT: DialogueDraft = { id: "", startNodeId: "", nodes: [] };

/** Auto-layout position for the Nth node on the canvas (grid). */
function defaultPos(index: number): { x: number; y: number } {
  const col = index % 4;
  const row = Math.floor(index / 4);
  return { x: 40 + col * 280, y: 40 + row * 180 };
}

// ── System ────────────────────────────────────────────────────────────────────

/**
 * Headless authoring system for dialogue definitions.
 *
 * Manages a mutable `DialogueDraft` with CRUD for nodes and choices,
 * validates structure, and provides JSON / file export-import.
 */
export class DialogueCreatorSystem {
  private _draft: DialogueDraft;
  private _nodeCounter = 0;
  private _choiceCounter = 0;

  constructor(initial?: Partial<DialogueDraft>) {
    this._draft = {
      ...BLANK_DRAFT,
      ...initial,
      nodes: [...(initial?.nodes ?? [])],
    };
  }

  // ── Meta ──────────────────────────────────────────────────────────────────

  /** Update dialogue-level metadata. */
  setMeta(id: string, startNodeId: string): void {
    this._draft.id          = id.trim();
    this._draft.startNodeId = startNodeId.trim();
  }

  // ── Nodes ─────────────────────────────────────────────────────────────────

  /**
   * Append a new node to the draft.
   * Auto-generates an ID when `partial.id` is absent.
   * Sets the start node automatically if this is the first node.
   * Returns the final node ID.
   */
  addNode(partial: Partial<Omit<DialogueNodeDraft, "choices">> = {}): string {
    const id  = partial.id?.trim() || `node_${++this._nodeCounter}`;
    const pos = defaultPos(this._draft.nodes.length);
    const node: DialogueNodeDraft = {
      id,
      speaker:  partial.speaker  ?? "NPC",
      text:     partial.text     ?? "",
      terminal: partial.terminal ?? false,
      x:        partial.x       ?? pos.x,
      y:        partial.y       ?? pos.y,
      choices:  [],
    };
    this._draft.nodes.push(node);
    if (this._draft.nodes.length === 1 && !this._draft.startNodeId) {
      this._draft.startNodeId = id;
    }
    return id;
  }

  /**
   * Apply field updates to an existing node (excluding choices and id).
   * Returns `false` when `nodeId` is not found.
   */
  updateNode(
    nodeId: string,
    updates: Partial<Omit<DialogueNodeDraft, "id" | "choices">>,
  ): boolean {
    const node = this._draft.nodes.find(n => n.id === nodeId);
    if (!node) return false;
    if (updates.speaker  !== undefined) node.speaker  = updates.speaker;
    if (updates.text     !== undefined) node.text     = updates.text;
    if (updates.terminal !== undefined) node.terminal = updates.terminal;
    if (updates.x        !== undefined) node.x        = updates.x;
    if (updates.y        !== undefined) node.y        = updates.y;
    return true;
  }

  /**
   * Remove a node and prune all choice references to it.
   * Returns `false` when `nodeId` is not found.
   */
  removeNode(nodeId: string): boolean {
    const idx = this._draft.nodes.findIndex(n => n.id === nodeId);
    if (idx === -1) return false;
    this._draft.nodes.splice(idx, 1);

    // Prune dangling nextNodeId references
    for (const node of this._draft.nodes) {
      for (const choice of node.choices) {
        if (choice.nextNodeId === nodeId) choice.nextNodeId = "";
      }
    }

    // Reassign start node if necessary
    if (this._draft.startNodeId === nodeId) {
      this._draft.startNodeId = this._draft.nodes[0]?.id ?? "";
    }
    return true;
  }

  // ── Choices ───────────────────────────────────────────────────────────────

  /**
   * Append a new choice to the given node.
   * Returns the choice ID, or `null` when the node is not found.
   */
  addChoice(nodeId: string, partial: Partial<DialogueChoiceDraft> = {}): string | null {
    const node = this._draft.nodes.find(n => n.id === nodeId);
    if (!node) return null;
    const id: string = partial.id?.trim() || `choice_${++this._choiceCounter}`;
    const choice: DialogueChoiceDraft = {
      id,
      text:         partial.text         ?? "",
      nextNodeId:   partial.nextNodeId   ?? "",
      endsDialogue: partial.endsDialogue ?? false,
      conditions:   [...(partial.conditions ?? [])],
      effects:      [...(partial.effects ?? [])],
    };
    node.choices.push(choice);
    return id;
  }

  /**
   * Apply field updates to an existing choice.
   * Returns `false` when the node or choice is not found.
   */
  updateChoice(
    nodeId: string,
    choiceId: string,
    updates: Partial<Omit<DialogueChoiceDraft, "id">>,
  ): boolean {
    const node = this._draft.nodes.find(n => n.id === nodeId);
    if (!node) return false;
    const choice = node.choices.find(c => c.id === choiceId);
    if (!choice) return false;
    if (updates.text         !== undefined) choice.text         = updates.text;
    if (updates.nextNodeId   !== undefined) choice.nextNodeId   = updates.nextNodeId.trim();
    if (updates.endsDialogue !== undefined) choice.endsDialogue = updates.endsDialogue;
    if (updates.conditions   !== undefined) choice.conditions   = [...updates.conditions];
    if (updates.effects      !== undefined) choice.effects      = [...updates.effects];
    return true;
  }

  /**
   * Remove a choice from a node.
   * Returns `false` when the node or choice is not found.
   */
  removeChoice(nodeId: string, choiceId: string): boolean {
    const node = this._draft.nodes.find(n => n.id === nodeId);
    if (!node) return false;
    const idx = node.choices.findIndex(c => c.id === choiceId);
    if (idx === -1) return false;
    node.choices.splice(idx, 1);
    return true;
  }

  // ── Conditions / Effects (convenience helpers) ────────────────────────────

  /** Add a condition to a specific choice. */
  addCondition(nodeId: string, choiceId: string, condition: DialogueChoiceCondition): boolean {
    const node = this._draft.nodes.find(n => n.id === nodeId);
    if (!node) return false;
    const choice = node.choices.find(c => c.id === choiceId);
    if (!choice) return false;
    choice.conditions.push(condition);
    return true;
  }

  /** Remove a condition by index from a specific choice. */
  removeCondition(nodeId: string, choiceId: string, index: number): boolean {
    const node = this._draft.nodes.find(n => n.id === nodeId);
    if (!node) return false;
    const choice = node.choices.find(c => c.id === choiceId);
    if (!choice || index < 0 || index >= choice.conditions.length) return false;
    choice.conditions.splice(index, 1);
    return true;
  }

  /** Add an effect to a specific choice. */
  addEffect(nodeId: string, choiceId: string, effect: DialogueChoiceEffect): boolean {
    const node = this._draft.nodes.find(n => n.id === nodeId);
    if (!node) return false;
    const choice = node.choices.find(c => c.id === choiceId);
    if (!choice) return false;
    choice.effects.push(effect);
    return true;
  }

  /** Remove an effect by index from a specific choice. */
  removeEffect(nodeId: string, choiceId: string, index: number): boolean {
    const node = this._draft.nodes.find(n => n.id === nodeId);
    if (!node) return false;
    const choice = node.choices.find(c => c.id === choiceId);
    if (!choice || index < 0 || index >= choice.effects.length) return false;
    choice.effects.splice(index, 1);
    return true;
  }

  // ── Validation ────────────────────────────────────────────────────────────

  /**
   * Validate the current draft.
   * Checks for: missing ID, missing/invalid start node, dangling nextNodeId
   * references, unreachable nodes, and empty speaker text.
   */
  validate(): DialogueValidationReport {
    const issues: DialogueValidationIssue[] = [];
    const nodeIds = new Set(this._draft.nodes.map(n => n.id));

    if (!this._draft.id) {
      issues.push({ type: "missing_id", detail: "Dialogue ID is empty." });
    }

    if (!this._draft.startNodeId || !nodeIds.has(this._draft.startNodeId)) {
      issues.push({
        type: "missing_start",
        detail: `Start node "${this._draft.startNodeId || "(none)"}" not found in node list.`,
      });
    }

    for (const node of this._draft.nodes) {
      if (!node.text.trim()) {
        issues.push({ type: "empty_text", nodeId: node.id, detail: `Node "${node.id}" has empty dialogue text.` });
      }
      for (const choice of node.choices) {
        if (!choice.text.trim()) {
          issues.push({ type: "empty_choice_text", nodeId: node.id, choiceId: choice.id, detail: `Choice "${choice.id}" in node "${node.id}" has empty text.` });
        }
        if (!choice.endsDialogue && choice.nextNodeId && !nodeIds.has(choice.nextNodeId)) {
          issues.push({
            type: "dangling_ref",
            nodeId: node.id,
            choiceId: choice.id,
            detail: `Choice "${choice.id}" references unknown node "${choice.nextNodeId}".`,
          });
        }
      }
    }

    // Reachability check from start node
    if (this._draft.startNodeId && nodeIds.has(this._draft.startNodeId)) {
      const reachable = new Set<string>();
      const queue = [this._draft.startNodeId];
      while (queue.length > 0) {
        const id = queue.shift()!;
        if (reachable.has(id)) continue;
        reachable.add(id);
        const node = this._draft.nodes.find(n => n.id === id);
        if (!node) continue;
        for (const choice of node.choices) {
          if (choice.nextNodeId && nodeIds.has(choice.nextNodeId)) {
            queue.push(choice.nextNodeId);
          }
        }
      }
      for (const node of this._draft.nodes) {
        if (!reachable.has(node.id)) {
          issues.push({
            type: "unreachable",
            nodeId: node.id,
            detail: `Node "${node.id}" is unreachable from start node "${this._draft.startNodeId}".`,
          });
        }
      }
    }

    return { valid: issues.length === 0, issues };
  }

  // ── Export ────────────────────────────────────────────────────────────────

  /** Convert the draft to a `DialogueDefinition` ready for the content registry. */
  toDefinition(): DialogueDefinition {
    return {
      id:          this._draft.id,
      startNodeId: this._draft.startNodeId,
      nodes:       this._draft.nodes.map(n => ({
        id:       n.id,
        speaker:  n.speaker,
        text:     n.text,
        terminal: n.terminal || undefined,
        choices:  n.choices.map(c => ({
          id:          c.id,
          text:        c.text,
          nextNodeId:  c.nextNodeId  || undefined,
          endsDialogue: c.endsDialogue || undefined,
          conditions:  c.conditions.length > 0 ? [...c.conditions] : undefined,
          effects:     c.effects.length > 0    ? [...c.effects]    : undefined,
        })),
      })),
    };
  }

  /** Serialize the draft as a pretty-printed JSON string. */
  exportToJson(): string {
    return JSON.stringify(this.toDefinition(), null, 2);
  }

  /**
   * Trigger a browser file-download of the draft as a `.dialogue.json` file.
   * No-op in non-browser environments.
   */
  exportToFile(filename?: string): void {
    if (typeof document === "undefined") return;
    const json = this.exportToJson();
    const blob = new Blob([json], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = filename ?? `${this._draft.id || "dialogue"}.dialogue.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Import ────────────────────────────────────────────────────────────────

  /**
   * Load a `DialogueDefinition` from a JSON string.
   * Returns `true` on success, `false` on parse or schema error.
   */
  importFromJson(json: string): boolean {
    try {
      const parsed = JSON.parse(json) as DialogueDefinition;
      if (!parsed || typeof parsed.id !== "string" || !Array.isArray(parsed.nodes)) return false;
      this._draft = {
        id:          parsed.id,
        startNodeId: parsed.startNodeId ?? "",
        nodes:       parsed.nodes.map((n, idx) => {
          const pos = defaultPos(idx);
          return {
            id:       n.id,
            speaker:  n.speaker,
            text:     n.text,
            terminal: n.terminal ?? false,
            x:        pos.x,
            y:        pos.y,
            choices:  (n.choices ?? []).map(c => ({
              id:          c.id,
              text:        c.text,
              nextNodeId:  c.nextNodeId   ?? "",
              endsDialogue: c.endsDialogue ?? false,
              conditions:  c.conditions   ? [...c.conditions] : [],
              effects:     c.effects      ? [...c.effects]    : [],
            })),
          };
        }),
      };
      this._nodeCounter   = 0;
      this._choiceCounter = 0;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Read a browser `File` and import its JSON content.
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

  // ── Reset ─────────────────────────────────────────────────────────────────

  /** Discard the current draft and start fresh. */
  reset(): void {
    this._draft         = { ...BLANK_DRAFT, nodes: [] };
    this._nodeCounter   = 0;
    this._choiceCounter = 0;
  }

  // ── Getters ───────────────────────────────────────────────────────────────

  get draft(): Readonly<DialogueDraft> { return this._draft; }
  get nodes(): readonly DialogueNodeDraft[] { return this._draft.nodes; }
}
