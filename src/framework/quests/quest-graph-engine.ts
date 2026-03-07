import {
  QuestDefinition,
  QuestEvent,
  QuestEventResult,
  QuestNodeDefinition,
  QuestNodeState,
  QuestRuntimeState,
  QuestSnapshot,
  QuestStatus,
  QuestValidationIssue,
  QuestValidationReport,
} from "./quest-types";

export class QuestGraphEngine {
  private _definitions: Map<string, QuestDefinition> = new Map();
  private _states: Map<string, QuestRuntimeState> = new Map();

  constructor(definitions: QuestDefinition[] = []) {
    for (const definition of definitions) {
      this.registerQuest(definition);
    }
  }

  public registerQuest(definition: QuestDefinition): void {
    this._validateDefinition(definition);
    this._definitions.set(definition.id, definition);
    this._states.set(definition.id, {
      status: "inactive",
      nodes: this._createEmptyNodeState(definition),
    });
  }

  public activateQuest(questId: string): boolean {
    const definition = this._definitions.get(questId);
    const state = this._states.get(questId);
    if (!definition || !state || state.status === "completed") return false;

    state.status = "active";
    const startNodeIds = this._getStartNodeIds(definition);
    for (const nodeId of startNodeIds) {
      const nodeState = state.nodes[nodeId];
      if (nodeState && !nodeState.completed) nodeState.active = true;
    }
    return true;
  }

  public getQuestStatus(questId: string): QuestStatus {
    return this._states.get(questId)?.status ?? "inactive";
  }

  public getQuestState(questId: string): QuestRuntimeState | null {
    const state = this._states.get(questId);
    if (!state) return null;
    return {
      status: state.status,
      nodes: Object.fromEntries(
        Object.entries(state.nodes).map(([nodeId, nodeState]) => [nodeId, { ...nodeState }])
      ),
    };
  }

  public applyEvent(event: QuestEvent): QuestEventResult[] {
    const results: QuestEventResult[] = [];

    for (const [questId, definition] of this._definitions.entries()) {
      const state = this._states.get(questId);
      if (!state || state.status !== "active") continue;

      const activatedNodeIds: string[] = [];
      const completedNodeIds: string[] = [];
      const delta = Math.max(1, Math.floor(event.amount ?? 1));

      for (const node of definition.nodes) {
        const nodeState = state.nodes[node.id];
        if (!nodeState || !nodeState.active || nodeState.completed) continue;
        if (node.triggerType !== event.type || node.targetId !== event.targetId) continue;

        nodeState.progress = Math.min(node.requiredCount, nodeState.progress + delta);
        if (nodeState.progress >= node.requiredCount) {
          nodeState.completed = true;
          nodeState.active = false;
          completedNodeIds.push(node.id);

          const nextNodeIds = this._getImmediateNextNodeIds(node, definition);
          for (const nextNodeId of nextNodeIds) {
            const nextState = state.nodes[nextNodeId];
            if (!nextState || nextState.completed || nextState.active) continue;
            if (!this._arePrerequisitesCompleted(nextNodeId, definition, state.nodes)) continue;
            nextState.active = true;
            activatedNodeIds.push(nextNodeId);
          }
        }
      }

      if (completedNodeIds.length === 0 && activatedNodeIds.length === 0) {
        continue;
      }

      const questCompleted = this._isQuestCompleted(definition, state.nodes);
      if (questCompleted) state.status = "completed";
      this._activateImplicitNodes(definition, state.nodes, activatedNodeIds);

      results.push({
        questId,
        activatedNodeIds: Array.from(new Set(activatedNodeIds)),
        completedNodeIds,
        questCompleted,
        xpReward: questCompleted ? definition.xpReward ?? 0 : 0,
      });
    }

    return results;
  }

  public getSnapshot(): QuestSnapshot {
    const quests: Record<string, QuestRuntimeState> = {};
    for (const [questId, state] of this._states.entries()) {
      quests[questId] = {
        status: state.status,
        nodes: Object.fromEntries(
          Object.entries(state.nodes).map(([nodeId, nodeState]) => [nodeId, { ...nodeState }])
        ),
      };
    }
    return { quests };
  }

  public restoreSnapshot(snapshot: QuestSnapshot): void {
    for (const [questId, savedState] of Object.entries(snapshot.quests)) {
      if (!this._definitions.has(questId)) continue;
      this._states.set(questId, {
        status: savedState.status,
        nodes: Object.fromEntries(
          Object.entries(savedState.nodes).map(([nodeId, nodeState]) => [nodeId, { ...nodeState }])
        ),
      });
    }
  }

  /**
   * Validates the quest graph for a registered quest.
   * Checks for dead-end nodes, unreachable nodes, and dependency cycles.
   */
  public validateGraph(questId: string): QuestValidationReport {
    const definition = this._definitions.get(questId);
    if (!definition) {
      return {
        questId,
        valid: false,
        issues: [{ type: "unreachable", nodeId: "", detail: `Quest '${questId}' is not registered.` }],
      };
    }

    const issues: QuestValidationIssue[] = [];
    const nodeMap = new Map(definition.nodes.map((n) => [n.id, n]));
    const startNodeIds = new Set(this._getStartNodeIds(definition));
    const completionNodeIds = new Set(
      definition.completionNodeIds && definition.completionNodeIds.length > 0
        ? definition.completionNodeIds
        : definition.nodes.map((n) => n.id)
    );

    /**
     * Returns all successors of a node for validation purposes, combining:
     * - Explicit `nextNodeIds` if set, OR
     * - Nodes that list this node in their `prerequisites` (implicit fallback), AND
     * - Always includes nodes that declare this node as a prerequisite (implicit activation).
     *
     * This mirrors the runtime behaviour of `_getImmediateNextNodeIds` (explicit path)
     * combined with `_activateImplicitNodes` (prerequisite-based activation).
     */
    const getAllSuccessors = (nodeId: string): string[] => {
      const node = nodeMap.get(nodeId);
      const explicitNext = node?.nextNodeIds ?? [];
      // Nodes whose prerequisites list nodeId — activated implicitly by the runtime
      const implicitNext = definition.nodes
        .filter((n) => (n.prerequisites ?? []).includes(nodeId))
        .map((n) => n.id);
      return [...new Set([...explicitNext, ...implicitNext])];
    };

    // --- Reachability check (BFS from start nodes, using full successor set) ---
    const reachable = new Set<string>();
    const queue = [...startNodeIds];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (reachable.has(current)) continue;
      reachable.add(current);
      for (const successor of getAllSuccessors(current)) {
        if (!reachable.has(successor)) queue.push(successor);
      }
    }

    for (const node of definition.nodes) {
      if (!reachable.has(node.id)) {
        issues.push({
          type: "unreachable",
          nodeId: node.id,
          detail: `Node '${node.id}' cannot be reached from the quest start nodes.`,
        });
      }
    }

    // --- Dead-end check ---
    // A node is a dead-end if it is reachable, has no successors, and is not a completion node.
    for (const node of definition.nodes) {
      if (!reachable.has(node.id)) continue;
      if (completionNodeIds.has(node.id)) continue;
      if (getAllSuccessors(node.id).length === 0) {
        issues.push({
          type: "dead_end",
          nodeId: node.id,
          detail: `Node '${node.id}' has no successors and is not a completion node.`,
        });
      }
    }

    // --- Cycle detection (DFS with color marking using full successor set) ---
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = new Map<string, number>(definition.nodes.map((n) => [n.id, WHITE]));

    const dfsCycleCheck = (nodeId: string): boolean => {
      color.set(nodeId, GRAY);
      for (const successor of getAllSuccessors(nodeId)) {
        if (color.get(successor) === GRAY) {
          issues.push({
            type: "cycle",
            nodeId,
            detail: `Cycle detected: node '${nodeId}' has a path back to '${successor}'.`,
          });
          color.set(nodeId, BLACK);
          return true;
        }
        if (color.get(successor) === WHITE) {
          if (dfsCycleCheck(successor)) {
            color.set(nodeId, BLACK);
            return true;
          }
        }
      }
      color.set(nodeId, BLACK);
      return false;
    };

    for (const node of definition.nodes) {
      if (color.get(node.id) === WHITE) {
        dfsCycleCheck(node.id);
      }
    }

    return { questId, valid: issues.length === 0, issues };
  }

  private _createEmptyNodeState(definition: QuestDefinition): Record<string, QuestNodeState> {
    const nodes: Record<string, QuestNodeState> = {};
    for (const node of definition.nodes) {
      nodes[node.id] = {
        active: false,
        completed: false,
        progress: 0,
      };
    }
    return nodes;
  }

  private _validateDefinition(definition: QuestDefinition): void {
    const nodeIds = new Set<string>();
    for (const node of definition.nodes) {
      if (nodeIds.has(node.id)) {
        throw new Error(`Duplicate quest node id '${node.id}' in quest '${definition.id}'.`);
      }
      nodeIds.add(node.id);
    }

    const validateNodeRefs = (nodeIdsToValidate: string[], source: string): void => {
      for (const ref of nodeIdsToValidate) {
        if (!nodeIds.has(ref)) {
          throw new Error(`Unknown node reference '${ref}' in ${source} for quest '${definition.id}'.`);
        }
      }
    };

    for (const node of definition.nodes) {
      validateNodeRefs(node.prerequisites ?? [], `prerequisites of node '${node.id}'`);
      validateNodeRefs(node.nextNodeIds ?? [], `nextNodeIds of node '${node.id}'`);
    }
    validateNodeRefs(definition.startNodeIds ?? [], "startNodeIds");
    validateNodeRefs(definition.completionNodeIds ?? [], "completionNodeIds");
  }

  private _getStartNodeIds(definition: QuestDefinition): string[] {
    if (definition.startNodeIds && definition.startNodeIds.length > 0) {
      return definition.startNodeIds;
    }
    return definition.nodes
      .filter((node) => !node.prerequisites || node.prerequisites.length === 0)
      .map((node) => node.id);
  }

  private _getImmediateNextNodeIds(node: QuestNodeDefinition, definition: QuestDefinition): string[] {
    if (node.nextNodeIds && node.nextNodeIds.length > 0) {
      return node.nextNodeIds;
    }
    return definition.nodes
      .filter((candidate) => (candidate.prerequisites ?? []).includes(node.id))
      .map((candidate) => candidate.id);
  }

  private _arePrerequisitesCompleted(
    nodeId: string,
    definition: QuestDefinition,
    state: Record<string, QuestNodeState>
  ): boolean {
    const node = definition.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) return false;
    const prerequisites = node.prerequisites ?? [];
    if (prerequisites.length === 0) return true;
    return prerequisites.every((prereqId) => state[prereqId]?.completed);
  }

  private _activateImplicitNodes(
    definition: QuestDefinition,
    state: Record<string, QuestNodeState>,
    activatedNodeIds: string[]
  ): void {
    for (const node of definition.nodes) {
      const nodeState = state[node.id];
      if (!nodeState || nodeState.completed || nodeState.active) continue;
      if (!this._arePrerequisitesCompleted(node.id, definition, state)) continue;
      nodeState.active = true;
      activatedNodeIds.push(node.id);
    }
  }

  private _isQuestCompleted(
    definition: QuestDefinition,
    state: Record<string, QuestNodeState>
  ): boolean {
    const completionNodeIds =
      definition.completionNodeIds && definition.completionNodeIds.length > 0
        ? definition.completionNodeIds
        : definition.nodes.map((node) => node.id);

    return completionNodeIds.every((nodeId) => state[nodeId]?.completed);
  }
}
