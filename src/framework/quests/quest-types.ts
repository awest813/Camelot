export type QuestTriggerType = "kill" | "pickup" | "talk" | "custom";
export type QuestStatus = "inactive" | "active" | "completed";

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
}

export interface QuestDefinition {
  id: string;
  name: string;
  description?: string;
  nodes: QuestNodeDefinition[];
  startNodeIds?: string[];
  completionNodeIds?: string[];
  xpReward?: number;
}

export interface QuestNodeState {
  active: boolean;
  completed: boolean;
  progress: number;
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
