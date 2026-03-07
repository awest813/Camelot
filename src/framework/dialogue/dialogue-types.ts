export type DialogueChoiceCondition =
  | { type: "flag"; flag: string; equals: boolean }
  | { type: "faction_min"; factionId: string; min: number }
  | { type: "quest_status"; questId: string; status: "inactive" | "active" | "completed" }
  | { type: "has_item"; itemId: string; minQuantity: number }
  | { type: "skill_min"; skillId: string; min: number };

export type DialogueChoiceEffect =
  | { type: "set_flag"; flag: string; value: boolean }
  | { type: "faction_delta"; factionId: string; amount: number }
  | { type: "emit_event"; eventId: string; payload?: Record<string, unknown> }
  | { type: "activate_quest"; questId: string }
  | { type: "consume_item"; itemId: string; quantity: number }
  | { type: "give_item"; itemId: string; quantity: number };

export interface DialogueChoice {
  id: string;
  text: string;
  nextNodeId?: string;
  endsDialogue?: boolean;
  conditions?: DialogueChoiceCondition[];
  effects?: DialogueChoiceEffect[];
}

export interface DialogueNode {
  id: string;
  speaker: string;
  text: string;
  terminal?: boolean;
  choices: DialogueChoice[];
}

export interface DialogueDefinition {
  id: string;
  startNodeId: string;
  nodes: DialogueNode[];
}

export interface DialogueContext {
  getFlag(flag: string): boolean;
  setFlag(flag: string, value: boolean): void;
  getFactionReputation(factionId: string): number;
  adjustFactionReputation(factionId: string, amount: number): void;
  getQuestStatus(questId: string): "inactive" | "active" | "completed";
  getInventoryCount(itemId: string): number;
  emitEvent?(eventId: string, payload?: Record<string, unknown>): void;
  getSkillLevel?(skillId: string): number;
  activateQuest?(questId: string): void;
  consumeItem?(itemId: string, quantity: number): boolean;
  giveItem?(itemId: string, quantity: number): void;
}

export interface DialogueChoiceView {
  id: string;
  text: string;
  isAvailable: boolean;
  blockedBy?: string;
}

export interface DialogueNodeView {
  id: string;
  speaker: string;
  text: string;
  terminal: boolean;
  choices: DialogueChoiceView[];
}

export interface DialogueAdvanceResult {
  success: boolean;
  message: string;
  isComplete: boolean;
  currentNode: DialogueNodeView | null;
}

export interface DialogueSessionSnapshot {
  dialogueId: string;
  currentNodeId: string | null;
  completed: boolean;
}
