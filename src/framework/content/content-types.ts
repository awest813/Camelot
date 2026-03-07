import { DialogueDefinition } from "../dialogue/dialogue-types";
import { FactionDefinition } from "../factions/faction-types";
import { ItemDefinition } from "../inventory/inventory-types";
import { QuestDefinition } from "../quests/quest-types";

// ── NPC archetype definition ──────────────────────────────────────────────────

export type NpcRole = "guard" | "merchant" | "innkeeper" | "villager" | "enemy" | "boss" | "companion";

/** Data-driven template for spawning and configuring NPCs. */
export interface NpcArchetypeDefinition {
  id: string;
  name: string;
  description?: string;
  role: NpcRole;
  /** Faction this NPC belongs to. */
  factionId?: string;
  /** Whether the NPC is aggressive on sight. */
  isHostile: boolean;
  /** Whether the NPC offers merchant services. */
  isMerchant: boolean;
  /** Dialogue tree id used when the player talks to this NPC. */
  dialogueId?: string;
  /** Loot table id dropped on death. */
  lootTableId?: string;
  /** Base health. Scaled by level in practice. */
  baseHealth: number;
  /** NPC level for scaling calculations. */
  level: number;
  /** Skill overrides (skill-id → rank 1–100). */
  skills?: Record<string, number>;
  /** Starting disposition toward the player (0–100). */
  disposition?: number;
  /** Patrol route tag (links to map-editor patrol group). */
  patrolGroupId?: string;
  /** If true, the NPC respawns after a configurable delay. */
  respawns?: boolean;
}

// ── Content bundle ────────────────────────────────────────────────────────────

export interface RpgContentBundle {
  dialogues: DialogueDefinition[];
  quests: QuestDefinition[];
  items: ItemDefinition[];
  factions: FactionDefinition[];
  npcArchetypes: NpcArchetypeDefinition[];
}

export interface ContentCollision {
  domain: keyof RpgContentBundle;
  id: string;
  replacedSource: string;
  incomingSource: string;
}
