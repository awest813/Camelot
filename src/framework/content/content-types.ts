import { DialogueDefinition } from "../dialogue/dialogue-types";
import { FactionDefinition } from "../factions/faction-types";
import { ItemDefinition } from "../inventory/inventory-types";
import { QuestDefinition } from "../quests/quest-types";

// ── NPC archetype definition ──────────────────────────────────────────────────

export type NpcRole = "guard" | "merchant" | "innkeeper" | "villager" | "enemy" | "boss" | "companion" | "bandit" | "healer" | "trainer" | "beggar";

export type NpcVoiceType =
  | "neutral"
  | "male_warrior"
  | "female_warrior"
  | "old_man"
  | "old_woman"
  | "merchant"
  | "child"
  | "beast"
  | "undead";

export type NpcPersonalityTrait =
  | "brave"
  | "cowardly"
  | "aggressive"
  | "friendly"
  | "shy"
  | "greedy"
  | "noble"
  | "cunning";

/**
 * Per-archetype combat AI tuning overrides.
 * Fields left undefined fall back to role-based or entity defaults.
 */
export interface NpcAIProfile {
  /** Detection radius in world units. */
  aggroRange: number;
  /** Melee engage radius in world units. */
  attackRange: number;
  /** Per-hit damage value. */
  attackDamage: number;
  /** Seconds between melee attacks. */
  attackCooldown: number;
  /** Walk / run speed multiplier. */
  moveSpeed: number;
  /**
   * Health fraction [0–1] below which the NPC flees instead of fighting.
   * 0 means the NPC never flees.
   */
  fleesBelowHealthPct: number;
}

/** Damage categories matched by the combat system's resistance calculations. */
export type DamageType = "physical" | "fire" | "frost" | "shock";

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
  /**
   * Damage resistances per type (0–1 range, 1 = full immunity).
   * Applied to all spawned instances of this archetype.
   * Example: `{ physical: 0.3 }` → 30% less physical damage.
   */
  damageResistances?: Partial<Record<DamageType, number>>;
  /**
   * Damage weaknesses per type (positive multiplier added on top of base).
   * Example: `{ fire: 0.5 }` → 50% extra fire damage (1.5× total).
   */
  damageWeaknesses?: Partial<Record<DamageType, number>>;
  /** Voice profile identifier for dialogue audio integration. */
  voiceType?: NpcVoiceType;
  /** Behavioral personality tags used by dialogue conditions and AI. */
  personalityTraits?: NpcPersonalityTrait[];
  /**
   * Per-archetype combat AI parameter overrides.
   * Values provided here take precedence over role-based defaults.
   */
  aiProfile?: Partial<NpcAIProfile>;
  /** Named daily-schedule definition id (links to DailyScheduleSystem). */
  scheduleId?: string;
  /** Item definition IDs the NPC spawns carrying (for inventory integration). */
  startingEquipment?: string[];
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
