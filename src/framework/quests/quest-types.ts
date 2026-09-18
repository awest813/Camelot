export type QuestTriggerType = "kill" | "pickup" | "talk" | "custom";
/**
 * Lifecycle status of a quest.
 * `"failed"` is terminal — a failed quest ignores further events and cannot
 * be re-activated.  Failing is how quests react to the world going wrong
 * (e.g. a quest target the player needed alive is killed).
 */
export type QuestStatus = "inactive" | "active" | "completed" | "failed";

export interface QuestEvent {
  type: QuestTriggerType;
  targetId: string;
  amount?: number;
}

export interface QuestNodeDefinition {
  id: string;
  description: string;
  triggerType: QuestTriggerType;
  targetId: string;
  requiredCount: number;
  prerequisites?: string[];
  nextNodeIds?: string[];
  /**
   * Mutual-exclusion group for xor-choice branching.  When a node in a group
   * completes, every other node in the same group is skipped (branch not
   * taken) and never activates.  Choices are driven by events — e.g. two
   * dialogue options emitting different custom events complete different
   * exclusive nodes.
   */
  exclusiveGroup?: string;
}

export interface QuestDefinition {
  id: string;
  name: string;
  description?: string;
  nodes: QuestNodeDefinition[];
  startNodeIds?: string[];
  completionNodeIds?: string[];
  xpReward?: number;
  /** Gold granted to the player when the quest completes. */
  rewardGold?: number;
  /** Inventory items granted when the quest completes. */
  rewardItems?: Array<{ itemId: string; quantity?: number }>;
}

export interface QuestNodeState {
  active: boolean;
  completed: boolean;
  progress: number;
  /** Set when the node was still open at the moment its quest failed. */
  failed?: boolean;
  /** Set when the node lost an exclusive-group race (branch not taken). */
  skipped?: boolean;
}

export interface QuestRuntimeState {
  status: QuestStatus;
  nodes: Record<string, QuestNodeState>;
}

export interface QuestEventResult {
  questId: string;
  activatedNodeIds: string[];
  completedNodeIds: string[];
  questCompleted: boolean;
  xpReward: number;
  /** True when this result transitioned the quest into `"failed"`. */
  questFailed: boolean;
  /** Nodes skipped by exclusive-group resolution in this update. */
  skippedNodeIds: string[];
}

export interface QuestSnapshot {
  quests: Record<string, QuestRuntimeState>;
}

export type QuestValidationIssueType = "dead_end" | "unreachable" | "cycle" | "not_found";

export interface QuestValidationIssue {
  type: QuestValidationIssueType;
  nodeId: string;
  detail: string;
}

export interface QuestValidationReport {
  questId: string;
  valid: boolean;
  issues: QuestValidationIssue[];
}
