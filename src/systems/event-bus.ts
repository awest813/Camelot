import type { Item } from "./inventory-system";

// ── Typed event catalogue ────────────────────────────────────────────────────

/**
 * All gameplay events that can flow through the bus.
 * Add new entries here as systems evolve.
 */
export interface GameEvents {
  /** An NPC was killed by the player. */
  "player:kill": { npcId: string; npcName: string; xp: number };
  /** An item was picked up (from loot, container, etc.). */
  "player:pickup": { itemId: string; quantity: number };
  /** The player gained a level. */
  "player:levelUp": { newLevel: number };
  /** The player's HP reached zero. */
  "player:died": Record<string, never>;
  /** A quest became active. */
  "quest:activated": { questId: string };
  /** A quest was fully completed. */
  "quest:completed": { questId: string; xpReward: number };
  /** The player transitioned to a different cell. */
  "cell:changed": { cellId: string; cellName: string };
  /** An NPC entered combat with the player. */
  "npc:aggro": { npcName: string };
  /** A buy or sell transaction completed. */
  "barter:transaction": { type: "buy" | "sell"; itemName: string; gold: number };
  /** The player committed a crime witnessed by an NPC. */
  "crime:committed": { crimeType: string; factionId: string; bounty: number };
  /** The player cast a spell. */
  "spell:cast": { spellId: string; spellName: string; magickaCost: number };
  /** A spell hit an NPC. */
  "spell:hit": { spellId: string; npcName: string; damage: number };
  /** A spell healed the player. */
  "spell:heal": { spellId: string; amount: number };
  /** The stealth system detected the player. */
  "stealth:detected": { npcName: string };
  /** The player's inventory changed. */
  "inventory:changed": { item: Item; delta: number };
  /** A loot drop was generated (e.g. from a loot table roll). */
  "loot:dropped": { tableId: string; items: Item[] };
  /** An NPC's disposition towards the player changed. */
  "disposition:changed": { npcId: string; oldValue: number; newValue: number };
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
 * bus.on("player:kill", ({ npcName }) => questSystem.onKill(npcName));
 * bus.emit("player:kill", { npcId: "guard_01", npcName: "Guard", xp: 50 });
 * ```
 */
export class GameEventBus {
  private _listeners: Map<GameEventType, Set<Function>> = new Map();

  // ── Subscribe ─────────────────────────────────────────────────────────────

  /** Subscribe to an event.  The same callback can be registered once per event. */
  public on<T extends GameEventType>(event: T, callback: GameEventCallback<T>): void {
    let set = this._listeners.get(event);
    if (!set) {
      set = new Set();
      this._listeners.set(event, set);
    }
    set.add(callback as Function);
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
