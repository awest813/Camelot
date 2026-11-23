/**
 * Between the game and the quest engine (the framework's, the only one):
 * kills, pickups and talks become quest events; a finished quest pays its
 * XP, fame, gold and items; killing someone a quest needed alive fails it.
 * The quest log is redrawn whenever a quest moves.
 *
 * Moved out of game.ts (engine overhaul, Phase 1).
 */
import type { FrameworkRuntime } from "../framework/runtime/framework-runtime";
import type { GameEventBus } from "../systems/event-bus";
import type { PlayerPack } from "./player-pack";

export interface QuestBridgeDeps {
  framework(): FrameworkRuntime;
  /** Redraw the quest log (if open). */
  refreshLog(): void;
  events(): GameEventBus;
  pack: PlayerPack;
  addXp(xp: number): void;
  addFame(amount: number): void;
  notify(text: string, ms: number): void;
  markDirty(): void;
}

/** Fame for finishing any quest. */
const QUEST_FAME = 10;

export class QuestBridge {
  constructor(private readonly _d: QuestBridgeDeps) {}

  /** The quest target id for an NPC's name ("Bandit_3" → "Bandit"). */
  public targetId(entityName: string): string {
    if (entityName.startsWith("RuinGuard")) return "RuinGuard";
    if (entityName.startsWith("TowerGuard")) return "TowerGuard";
    return entityName.split("_")[0];
  }

  /** Feed a quest event to the framework and pay out any quest it finishes. */
  public apply(type: "kill" | "pickup" | "talk" | "custom", targetId: string, amount = 1): void {
    const fw = this._d.framework();
    const updates = fw.applyQuestEvent({ type, targetId, amount });
    if (updates.length > 0) this._d.refreshLog();
    for (const update of updates) {
      if (!update.questCompleted) continue;
      const def = fw.questEngine.getQuestDefinition(update.questId);
      this._d.events().emit("quest:completed", { questId: update.questId, xpReward: update.xpReward });
      this._d.notify(`Quest Complete: ${def?.name ?? update.questId}!`, 4000);
      this._d.addFame(QUEST_FAME);
      if (update.xpReward > 0) {
        this._d.addXp(update.xpReward);
        this._d.notify(`+${update.xpReward} XP`, 2000);
      }
      const gold = Math.max(0, Math.floor(def?.rewardGold ?? 0));
      if (gold > 0) {
        this._d.pack.addGold(gold);
        this._d.notify(`Quest reward: +${gold} gold`, 2400);
      }
      for (const reward of def?.rewardItems ?? []) {
        const quantity = Math.max(1, Math.floor(reward.quantity ?? 1));
        const item = fw.contentRegistry.getItemDefinition(reward.itemId);
        this._d.pack.give(reward.itemId, quantity);
        if (item) this._d.notify(`Quest reward: ${item.name} ×${quantity}`, 2400);
      }
      this._d.markDirty();
    }
  }

  /**
   * Fail the quests that needed `npcName` alive: those with an unfinished
   * "talk" node for them.  (Killing the Guard fails "Parley with the Guard"
   * while "Eliminate the Guard" completes.)
   */
  public failForDead(npcName: string): void {
    const fw = this._d.framework();
    const target = this.targetId(npcName);
    for (const questId of fw.questEngine.getActiveQuestIds()) {
      const def = fw.questEngine.getQuestDefinition(questId);
      const state = fw.questEngine.getQuestState(questId);
      if (!def || !state) continue;
      const neededAlive = def.nodes.some((n) => n.triggerType === "talk" && n.targetId === target && !state.nodes[n.id]?.completed);
      if (neededAlive && fw.questEngine.failQuest(questId)) {
        this._d.notify(`Quest failed: ${def.name} — ${npcName} is dead.`, 4000);
        this._d.markDirty();
        this._d.refreshLog();
      }
    }
  }
}
