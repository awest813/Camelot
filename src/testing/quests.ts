/**
 * A stand-in for the game's quest bridge in feature tests: a real quest
 * engine, events applied to it, progress emitted as `quest:progressed`, and
 * completed quests' rewards recorded instead of paid.
 */
import type { Kernel } from "../core/kernel";
import { QuestGraphEngine } from "../framework/quests/quest-graph-engine";
import { QuestsKey } from "../features/services";

export interface QuestPayment { questId: string; gold: number; xp: number; fame: number }

export function provideQuests(k: Kernel): { engine: QuestGraphEngine; paid: QuestPayment[] } {
  const engine = new QuestGraphEngine();
  const paid: QuestPayment[] = [];
  k.services.provide(QuestsKey, {
    engine,
    apply: (type, targetId, amount) => {
      for (const r of engine.applyEvent({ type, targetId, amount })) {
        for (const p of r.progressed ?? []) k.events.emit("quest:progressed", { questId: r.questId, ...p });
        if (!r.questCompleted) continue;
        const def = engine.getQuestDefinition(r.questId)!;
        paid.push({ questId: r.questId, gold: def.rewardGold ?? 0, xp: def.xpReward ?? 0, fame: def.fameReward ?? 10 });
      }
    },
  });
  return { engine, paid };
}
