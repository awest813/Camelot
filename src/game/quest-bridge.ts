/**
 * Between the game and the framework's quests: kills, pickups and talks
 * become quest events; a finished framework quest pays its XP, gold and
 * items; killing someone a quest needed alive fails it (framework and
 * legacy quests alike).
 *
 * Moved out of game.ts (engine overhaul, Phase 1).
 */
import type { FrameworkRuntime } from "../framework/runtime/framework-runtime";
import type { QuestSystem } from "../systems/quest-system";
import type { GameEventBus } from "../systems/event-bus";
import type { PlayerPack } from "./player-pack";

export interface QuestBridgeDeps {
  framework(): FrameworkRuntime;
  legacy(): QuestSystem;
  events(): GameEventBus;
  pack: PlayerPack;
  addXp(xp: number): void;
  notify(text: string, ms: number): void;
  markDirty(): void;
}

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
    for (const update of fw.applyQuestEvent({ type, targetId, amount })) {
      if (!update.questCompleted) continue;
      this._d.events().emit("quest:completed", { questId: update.questId, xpReward: update.xpReward });
      this._d.notify(`Framework quest complete: ${update.questId}`, 2800);
      if (update.xpReward > 0) {
        this._d.addXp(update.xpReward);
        this._d.notify(`+${update.xpReward} XP`, 2000);
      }
      const def = fw.questEngine.getQuestDefinition(update.questId);
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
      if (gold > 0 || (def?.rewardItems?.length ?? 0) > 0) this._d.markDirty();
    }
  }

  /**
   * Fail the quests that needed `npcName` alive: framework quests with an
   * unfinished "talk" node for them, and legacy quests with an unfinished
   * talk objective.  (Killing the Guard fails "Parley with the Guard" while
   * "Eliminate the Guard" completes.)
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
      }
    }
    const legacy = this._d.legacy();
    for (const quest of legacy.getActiveQuests()) {
      if (quest.objectives.some((o) => !o.completed && o.type === "talk" && o.targetId === npcName)) legacy.failQuest(quest.id);
    }
  }
}
