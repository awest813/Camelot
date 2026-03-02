export type FactionDisposition = "hostile" | "neutral" | "friendly" | "allied";

export interface FactionDefinition {
  id: string;
  name: string;
  description?: string;
  defaultReputation?: number;
  hostileBelow?: number;
  friendlyAt?: number;
  alliedAt?: number;
}

export interface FactionSnapshot {
  reputations: Record<string, number>;
}
