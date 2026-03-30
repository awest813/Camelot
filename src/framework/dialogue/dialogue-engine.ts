import {
  DialogueAdvanceResult,
  DialogueChoice,
  DialogueChoiceCondition,
  DialogueChoiceView,
  DialogueContext,
  DialogueDefinition,
  DialogueNode,
  DialogueNodeView,
  DialogueSessionSnapshot,
} from "./dialogue-types";

export class DialogueEngine {
  private _definitions: Map<string, DialogueDefinition> = new Map();
  private _nodeMaps: Map<string, Map<string, DialogueNode>> = new Map();

  constructor(definitions: DialogueDefinition[] = []) {
    for (const definition of definitions) {
      this.registerDialogue(definition);
    }
  }

  public registerDialogue(definition: DialogueDefinition): void {
    const nodeMap = this._validateDefinition(definition);
    this._definitions.set(definition.id, definition);
    this._nodeMaps.set(definition.id, nodeMap);
  }

  /** Returns true when a dialogue definition is registered for `dialogueId`. */
  public hasDialogue(dialogueId: string): boolean {
    return this._definitions.has(dialogueId);
  }

  public createSession(dialogueId: string, context: DialogueContext): DialogueSession {
    const definition = this._definitions.get(dialogueId);
    const nodeMap = this._nodeMaps.get(dialogueId);
    if (!definition || !nodeMap) {
      throw new Error(`Unknown dialogue id '${dialogueId}'.`);
    }
    return new DialogueSession(definition, context, nodeMap);
  }

  private _validateDefinition(definition: DialogueDefinition): Map<string, DialogueNode> {
    const nodeMap = new Map<string, DialogueNode>();
    for (const node of definition.nodes) {
      if (nodeMap.has(node.id)) {
        throw new Error(`Duplicate dialogue node id '${node.id}' in '${definition.id}'.`);
      }
      nodeMap.set(node.id, node);
    }

    if (!nodeMap.has(definition.startNodeId)) {
      throw new Error(`Dialogue '${definition.id}' start node '${definition.startNodeId}' does not exist.`);
    }

    for (const node of definition.nodes) {
      const choiceIds = new Set<string>();
      for (const choice of node.choices) {
        if (choiceIds.has(choice.id)) {
          throw new Error(`Duplicate choice id '${choice.id}' in dialogue node '${node.id}'.`);
        }
        choiceIds.add(choice.id);
        if (choice.nextNodeId && !nodeMap.has(choice.nextNodeId)) {
          throw new Error(
            `Dialogue '${definition.id}' has choice '${choice.id}' pointing to unknown node '${choice.nextNodeId}'.`
          );
        }
      }
    }

    return nodeMap;
  }
}

export class DialogueSession {
  private _definition: DialogueDefinition;
  private _context: DialogueContext;
  private _nodeMap: Map<string, DialogueNode>;
  private _currentNodeId: string | null;
  private _completed = false;

  constructor(definition: DialogueDefinition, context: DialogueContext, nodeMap: Map<string, DialogueNode>) {
    this._definition = definition;
    this._context = context;
    this._nodeMap = nodeMap;
    this._currentNodeId = definition.startNodeId;
  }

  public get isComplete(): boolean {
    return this._completed;
  }

  public getCurrentNode(): DialogueNodeView | null {
    if (!this._currentNodeId) return null;
    const node = this._nodeMap.get(this._currentNodeId);
    if (!node) return null;
    return this._toNodeView(node);
  }

  public choose(choiceId: string): DialogueAdvanceResult {
    if (this._completed) {
      return {
        success: false,
        message: "Dialogue is already complete.",
        isComplete: true,
        currentNode: null,
      };
    }

    const node = this._currentNodeId ? this._nodeMap.get(this._currentNodeId) : null;
    if (!node) {
      this._completed = true;
      this._currentNodeId = null;
      return {
        success: false,
        message: "Dialogue node is missing.",
        isComplete: true,
        currentNode: null,
      };
    }

    const choice = node.choices.find((candidate) => candidate.id === choiceId);
    if (!choice) {
      return {
        success: false,
        message: `Choice '${choiceId}' not found.`,
        isComplete: this._completed,
        currentNode: this._toNodeView(node),
      };
    }

    const blockedBy = this._getBlockedByReason(choice);
    if (blockedBy) {
      return {
        success: false,
        message: blockedBy,
        isComplete: this._completed,
        currentNode: this._toNodeView(node),
      };
    }

    this._applyEffects(choice);

    const shouldEnd = Boolean(choice.endsDialogue || node.terminal || !choice.nextNodeId);
    if (shouldEnd) {
      this._completed = true;
      this._currentNodeId = null;
      return {
        success: true,
        message: "Dialogue complete.",
        isComplete: true,
        currentNode: null,
      };
    }

    this._currentNodeId = choice.nextNodeId ?? null;
    const nextNode = this.getCurrentNode();
    if (!nextNode) {
      this._completed = true;
      this._currentNodeId = null;
      return {
        success: false,
        message: "Dialogue could not continue to next node.",
        isComplete: true,
        currentNode: null,
      };
    }

    return {
      success: true,
      message: "Choice applied.",
      isComplete: false,
      currentNode: nextNode,
    };
  }

  public getSnapshot(): DialogueSessionSnapshot {
    return {
      dialogueId: this._definition.id,
      currentNodeId: this._currentNodeId,
      completed: this._completed,
    };
  }

  private _toNodeView(node: DialogueNode): DialogueNodeView {
    const choices: DialogueChoiceView[] = node.choices.map((choice) => {
      const blockedBy = this._getBlockedByReason(choice);
      return {
        id: choice.id,
        text: choice.text,
        isAvailable: blockedBy === null,
        blockedBy: blockedBy ?? undefined,
      };
    });

    return {
      id: node.id,
      speaker: node.speaker,
      text: node.text,
      terminal: Boolean(node.terminal),
      cameraSequenceId: node.cameraSequenceId,
      choices,
    };
  }

  private _getBlockedByReason(choice: DialogueChoice): string | null {
    if (!choice.conditions || choice.conditions.length === 0) return null;
    for (const condition of choice.conditions) {
      const isMet = this._evaluateCondition(condition);
      if (!isMet) {
        return `Choice blocked by ${condition.type}.`;
      }
    }
    return null;
  }

  private _evaluateCondition(condition: DialogueChoiceCondition): boolean {
    switch (condition.type) {
      case "flag":
        return this._context.getFlag(condition.flag) === condition.equals;
      case "faction_min":
        return this._context.getFactionReputation(condition.factionId) >= condition.min;
      case "quest_status":
        return this._context.getQuestStatus(condition.questId) === condition.status;
      case "has_item":
        return this._context.getInventoryCount(condition.itemId) >= condition.minQuantity;
      case "skill_min":
        return (this._context.getSkillLevel?.(condition.skillId) ?? 0) >= condition.min;
      default:
        return false;
    }
  }

  private _applyEffects(choice: DialogueChoice): void {
    if (!choice.effects || choice.effects.length === 0) return;
    for (const effect of choice.effects) {
      switch (effect.type) {
        case "set_flag":
          this._context.setFlag(effect.flag, effect.value);
          break;
        case "faction_delta":
          this._context.adjustFactionReputation(effect.factionId, effect.amount);
          break;
        case "emit_event":
          this._context.emitEvent?.(effect.eventId, effect.payload);
          break;
        case "activate_quest":
          this._context.activateQuest?.(effect.questId);
          break;
        case "consume_item":
          this._context.consumeItem?.(effect.itemId, effect.quantity);
          break;
        case "give_item":
          this._context.giveItem?.(effect.itemId, effect.quantity);
          break;
      }
    }
  }
}
