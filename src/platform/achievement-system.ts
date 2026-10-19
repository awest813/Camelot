import catalogue from "../../steam/achievements.json";
import type { GameEventBus } from "../systems/event-bus";
import { ACHIEVEMENT_STORAGE_KEY } from "./constants";
import { getDesktopBridge } from "./desktop-bridge";

export interface AchievementDefinition {
  /** Steamworks API name. Uppercase, digits, and underscores only. */
  id: string;
  name: string;
  description: string;
  /** Hidden on the Steam overlay until unlocked. */
  hidden?: boolean;
}

export const ACHIEVEMENTS: readonly AchievementDefinition[] = catalogue;

const KNOWN_IDS = new Set(ACHIEVEMENTS.map((entry) => entry.id));

/**
 * Tracks the launch achievement set. Unlocks are idempotent, persisted in
 * localStorage, and forwarded to the desktop shell when it is present so
 * Steamworks (or the offline achievement file) stays in step.
 */
export class AchievementSystem {
  private readonly _unlocked = new Set<string>();

  /** Fires only the first time an achievement is unlocked this session. */
  public onUnlocked: ((definition: AchievementDefinition) => void) | null = null;

  constructor() {
    this._load();
  }

  public isUnlocked(id: string): boolean {
    return this._unlocked.has(id);
  }

  public list(): Array<AchievementDefinition & { unlocked: boolean }> {
    return ACHIEVEMENTS.map((entry) => ({
      ...entry,
      unlocked: this._unlocked.has(entry.id),
    }));
  }

  /**
   * Unlock by Steam API name.
   * @returns true when this call newly unlocked it.
   */
  public unlock(id: string): boolean {
    const definition = ACHIEVEMENTS.find((entry) => entry.id === id);
    if (!definition || this._unlocked.has(id)) return false;
    this._unlocked.add(id);
    this._persist();
    this.onUnlocked?.(definition);
    return true;
  }

  /** Subscribe to gameplay events that map directly onto achievements. */
  public bind(bus: GameEventBus): void {
    bus.on("player:kill", ({ npcName }) => {
      this.unlock("ACH_FIRST_BLOOD");
      if (/dragon/i.test(npcName)) this.unlock("ACH_DRAGONSLAYER");
    });
    bus.on("quest:completed", () => {
      this.unlock("ACH_OATH_KEPT");
    });
    bus.on("player:levelUp", ({ newLevel }) => {
      if (newLevel >= 5) this.unlock("ACH_SEASONED");
      if (newLevel >= 10) this.unlock("ACH_KNIGHT_OF_THE_REALM");
    });
    bus.on("player:died", () => {
      this.unlock("ACH_ONCE_AND_FUTURE");
    });
    bus.on("spell:cast", () => {
      this.unlock("ACH_FIRST_SPELL");
    });
    bus.on("pet:acquired", () => {
      this.unlock("ACH_COMPANION");
    });
  }

  /**
   * Union local unlocks with the desktop achievement file. Does not toast;
   * callers already showed a toast when the local unlock happened.
   */
  public async syncWithDesktop(): Promise<void> {
    const bridge = getDesktopBridge();
    if (!bridge) return;
    try {
      const merged = await bridge.syncAchievements([...this._unlocked]);
      let changed = false;
      for (const id of merged) {
        if (KNOWN_IDS.has(id) && !this._unlocked.has(id)) {
          this._unlocked.add(id);
          changed = true;
        }
      }
      if (changed) this._persist();
    } catch (error) {
      console.warn("[AchievementSystem] Desktop sync failed", error);
    }
  }

  private _load(): void {
    if (typeof localStorage === "undefined") return;
    try {
      const raw = localStorage.getItem(ACHIEVEMENT_STORAGE_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      for (const id of parsed) {
        if (typeof id === "string" && KNOWN_IDS.has(id)) this._unlocked.add(id);
      }
    } catch {
      // A corrupt achievement cache must not block launching the game.
    }
  }

  private _persist(): void {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(ACHIEVEMENT_STORAGE_KEY, JSON.stringify([...this._unlocked]));
  }
}
