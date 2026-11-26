import type { Item } from "./inventory-system";
import type { NPC } from "../entities/npc";
import type { ManagedEventDefinition } from "./event-manager-system";
import type { MarkPosition } from "./mark-recall-system";
import type { ActiveEffect } from "./active-effects-system";
import type { WeatherState } from "./weather-system";
import type { NpcBoltStatusEffect } from "./projectile-system";
import type { BiomeType } from "../world/world-manager";
import type { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { AchievementDefinition } from "../platform/achievement-system";
import type { ConsumableUseSource, QuickSlotKey } from "./quickslot-system";
import type { ProgressionSkillId } from "./skill-progression-system";
import type { AttributeName } from "./attribute-system";

// ── Typed event catalogue ────────────────────────────────────────────────────

/**
 * All gameplay events that can flow through the bus.
 * Add new entries here as systems evolve.
 */
export interface GameEvents {
  /** The player killed an NPC (where it fell, and its loot table if any). */
  "player:kill": {
    npcId: string; npcName: string; xp: number;
    at?: { x: number; y: number; z: number };
    lootTableId?: string;
    /** A peaceful settler (killing one is murder), and their faction. */
    civilian?: boolean;
    factionId?: string;
  };
  /** The player struck a peaceful settler (an assault). */
  "player:assault": { npcId: string; factionId: string };
  /** The player gained a level. */
  "player:levelUp": { newLevel: number };
  /** The player's HP reached zero. */
  "player:died": Record<string, never>;
  /** A quest was fully completed. */
  "quest:completed": { questId: string; xpReward: number };
  /** A step of a quest moved (e.g. a kill counted toward a bounty). */
  "quest:progressed": { questId: string; nodeId: string; progress: number; required: number };
  /** The player transitioned to a different cell. */
  "cell:changed": { cellId: string; cellName: string };
  /** A buy or sell transaction completed. */
  "barter:transaction": { type: "buy" | "sell"; itemName: string; gold: number };
  /** The player committed a crime witnessed by an NPC. */
  "crime:committed": { crimeType: string; factionId: string; bounty: number };
  /** The player cast a spell. */
  "spell:cast": { spellId: string; spellName: string; magickaCost: number; damage?: number; heal?: number };
  /** A spell hit an NPC. */
  "spell:hit": { spellId: string; npcName: string; damage: number };
  /** A spell healed the player. */
  "spell:heal": { spellId: string; amount: number };
  /** The stealth system detected the player. */
  "stealth:detected": { npcName: string; displayName: string };
  "pickpocket:opened": { npcName: string };
  /** An NPC's disposition towards the player changed. */
  "disposition:changed": { npcId: string; oldValue: number; newValue: number };
  /** A pet was granted to the player for the first time. */
  "pet:acquired": { petId: string; petName: string; species: string };
  /** A pet was summoned into the world. */
  "pet:summoned": { petId: string; petName: string };
  /** A pet was dismissed from the world. */
  "pet:dismissed": { petId: string; petName: string };
  /** A pet gained a level. */
  "pet:levelUp": { petId: string; petName: string; newLevel: number };
  /** The active pet died. */
  "pet:died": { petId: string; petName: string };
  /** A new in-game hour began (fired once per hour, also when time skips). */
  "time:hour": { hour: number; elapsedHours: number };
  /** A save finished loading (features reset their transient state). */
  "save:loaded": Record<string, never>;
  /** An NPC left the world (despawned or its chunk unloaded); drop references. */
  "npc:released": { npcName: string };
  /** A place was discovered (a village or a landmark): on the map and for fast travel. */
  "location:discovered": { id: string; name: string };
  /** A world chunk unloaded (its content and NPCs are gone). */
  "chunk:unloaded": { chunkKey: string; cx?: number; cz?: number };
  /** A world chunk finished loading (its ground and vegetation are in). */
  "chunk:loaded": { chunkKey: string; cx: number; cz: number; biome: BiomeType };
  /** A dialogue choice fired a host action (e.g. "jobs:ask"), with the speaker. */
  "dialogue:action": { eventId: string; npcName: string | null; payload?: Record<string, unknown> };
  /** The player started talking to an NPC (by its key). */
  "dialogue:started": { npcName: string };
  /** A conversation ended and the dialogue UI is gone. */
  "dialogue:closed": Record<string, never>;
  /** The quest log was opened. */
  "questlog:opened": Record<string, never>;
  /** A sleeping NPC is standing at its bed spot (with the NPC, for the indoors handoff). */
  "npc:atBed": { npc: NPC };

  // ── Reported by systems on the bus they are given (`system.events`) ──────
  "swim:entered": Record<string, never>;
  "swim:exited": Record<string, never>;
  /** Breath fell below the warning threshold (once per dive). */
  "swim:breathLow": Record<string, never>;
  /** Out of breath: damage this tick. */
  "swim:drowning": { damage: number };
  "disease:contracted": { diseaseId: string };
  "disease:cured": { diseaseId: string };
  /** A managed world event fired (a copy of its definition, and any context). */
  "worldEvent:triggered": { eventId: string; def: ManagedEventDefinition; context?: Record<string, unknown> };
  "mark:set": { position: Readonly<MarkPosition>; cellId: string | null };
  "mark:recalled": { position: Readonly<MarkPosition>; cellId: string | null };
  "merchant:restocked": { merchantId: string };
  "effect:expired": { effect: ActiveEffect };
  "perk:unlocked": { perkId: string; perkName: string };
  "zone:respawned": { zoneId: string };
  /**
   * The weather turned: fired at the start of the transition (the new state
   * is decided; the visuals ease toward it over `transitionDuration`).
   */
  "weather:changed": { state: WeatherState };
  "fame:changed": { fame: number; infamy: number };
  "skill:levelUp": { skillId: string; skillName: string; newLevel: number };
  "inventory:opened": Record<string, never>;
  /** A resident's schedule turned to sleep, or from it (the daily schedule). */
  "npc:slept": { npc: NPC };
  "npc:woke": { npc: NPC };
  /** The player's weapon connected (a power attack or not). */
  "combat:weaponHit": { powerAttack: boolean };
  /** A melee blow got through to the player. */
  "combat:playerStruck": Record<string, never>;
  /** The player blocked a blow. */
  "combat:blocked": Record<string, never>;
  /** An arrow or a spell of the player's hurt a hostile (combat alerts it). */
  "combat:hostileHit": { npc: NPC; damage: number };
  /** A hostile arrow or bolt hit the player; apply `statusEffect` when there is one. */
  "projectile:playerHit": { damage: number; sourceName: string; statusEffect: NpcBoltStatusEffect | null };
  /** An NPC died to the player's blow, arrow or spell (the XP it was worth). */
  "npc:killed": { npcName: string; xp: number; npc: NPC };
  /** The player's attack hurt an NPC (crime and assault checks). */
  "combat:npcDamaged": { npc: NPC; damage: number };
  /** An NPC half-noticed the player (it comes to look). */
  "stealth:noticed": { npc: NPC; playerPos: Vector3 };
  "equipment:changed": Record<string, never>;
  /** About to write a save (prune what should not be kept). */
  "save:beforeSave": Record<string, never>;
  "loot:pickedUp": { itemId: string };
  /** The player chose to pickpocket this NPC (instead of talking). */
  "interact:pickpocket": { npc: NPC };
  "portal:entered": { portalId: string };
  "achievement:unlocked": { definition: AchievementDefinition };
  /** A consumable was used (from a quick slot or the inventory). */
  "item:consumed": { item: Item; source: ConsumableUseSource };
  "trainer:trained": { trainerId: string; skillId: ProgressionSkillId; newLevel: number; goldSpent: number };
  /** The player's combat (XP) level rose; `player:levelUp` is the character level. */
  "player:combatLevelUp": { newLevel: number };
  /** A quick-slot key asked to be assigned (pick a consumable for it). */
  "quickslot:assign": { key: QuickSlotKey; itemId: string | null };
  /** A structure brought an NPC into the world, or took one out. */
  "npc:spawned": { npc: NPC };
  "npc:removed": { npc: NPC };

  // ── The player's choices in the HUD panels (UIManager) ──────────────────
  "ui:skillPurchase": { treeIndex: number; skillIndex: number };
  "ui:inventoryItemClick": { item: Item };
  "ui:inventoryClosed": Record<string, never>;
  "ui:waitConfirm": { hours: number };
  "ui:attributeSpend": { name: AttributeName };
  /** A panel closed from inside it; the game closes it through its registry. */
  "ui:panelClosed": { id: "wait" | "attributes" | "quest-log" | "skill-tree" | "inventory" };
  /** A heavy hit asks for a moment of slow motion. */
  "ui:hitStop": { durationMs: number };
}

export type GameEventType = keyof GameEvents;
export type GameEventCallback<T extends GameEventType> = (payload: GameEvents[T]) => void;

// ── GameEventBus ──────────────────────────────────────────────────────────────

/**
 * Lightweight typed publish/subscribe event bus for gameplay systems.
 *
 * Design goals:
 *   - Zero BabylonJS dependencies — usable in headless tests.
 *   - Strictly typed payloads per event type.
 *   - `once()` support for one-shot listeners.
 *   - `off()` for explicit unsubscription (prevents memory leaks on cell unload).
 *
 * Usage:
 * ```ts
 * const bus = new GameEventBus();
 * bus.on("player:kill", ({ npcName }) => notify(`${npcName} falls.`));
 * bus.emit("player:kill", { npcId: "guard_01", npcName: "Guard", xp: 50 });
 * ```
 */
export class GameEventBus {
  private _listeners: Map<GameEventType, Set<Function>> = new Map();

  // ── Subscribe ─────────────────────────────────────────────────────────────

  /**
   * Subscribe to an event.  The same callback can be registered once per event.
   * Returns a function that unsubscribes (kernel scopes own these).
   */
  public on<T extends GameEventType>(event: T, callback: GameEventCallback<T>): () => void {
    let set = this._listeners.get(event);
    if (!set) {
      set = new Set();
      this._listeners.set(event, set);
    }
    set.add(callback as Function);
    return () => this.off(event, callback);
  }

  /** Remove a previously registered callback. */
  public off<T extends GameEventType>(event: T, callback: GameEventCallback<T>): void {
    this._listeners.get(event)?.delete(callback as Function);
  }

  /**
   * Subscribe to an event for a single firing.
   * The callback is automatically removed after the first invocation.
   */
  public once<T extends GameEventType>(event: T, callback: GameEventCallback<T>): void {
    const wrapper: GameEventCallback<T> = (payload) => {
      this.off(event, wrapper);
      callback(payload);
    };
    this.on(event, wrapper);
  }

  // ── Publish ───────────────────────────────────────────────────────────────

  /** Emit an event synchronously to all registered listeners. */
  public emit<T extends GameEventType>(event: T, payload: GameEvents[T]): void {
    const set = this._listeners.get(event);
    if (!set) return;
    if (set.size === 1) {
      const callback = set.values().next().value as GameEventCallback<T> | undefined;
      callback?.(payload);
      return;
    }
    // Snapshot to allow safe removal inside a callback
    for (const cb of Array.from(set)) {
      (cb as GameEventCallback<T>)(payload);
    }
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  /** Remove all listeners for a specific event (e.g. on cell unload). */
  public clearEvent(event: GameEventType): void {
    this._listeners.delete(event);
  }

  /** Remove every listener on the bus (e.g. full game teardown). */
  public clearAll(): void {
    this._listeners.clear();
  }

  /** Returns the number of listeners currently registered for an event. */
  public listenerCount(event: GameEventType): number {
    return this._listeners.get(event)?.size ?? 0;
  }
}
