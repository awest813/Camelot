import { UIManager } from "../ui/ui-manager";
import type { QuestGraphEngine } from "../framework/quests/quest-graph-engine";
import type { QuestRuntimeState, QuestTriggerType } from "../framework/quests/quest-types";
import type { GameEventBus } from "./event-bus";

/**
 * The quest log: a view of the framework quest engine.  Every started
 * quest (story quests, and radiant ones such as village jobs and raids)
 * shows as an entry built from the engine on each read.  Kills, pickups and
 * talks go to the engine (see `QuestBridge`), not to the log.
 *
 * The log also reads the legacy `quests` section of older saves and carries
 * its progress into the engine (`restoreState`).  (Engine overhaul, Phase 4:
 * one quest engine.)
 */

export type ObjectiveType = "kill" | "fetch" | "talk" | "custom";

export interface QuestObjective {
  id: string;
  type: ObjectiveType;
  description: string;
  /** NPC key for kill / talk objectives; item id for fetch objectives. */
  targetId: string;
  required: number;
  current: number;
  completed: boolean;
}

export interface Quest {
  id: string;
  name: string;
  description: string;
  objectives: QuestObjective[];
  isCompleted: boolean;
  isActive: boolean;
  /**
   * Terminal failure (e.g. a quest target the player needed alive died).
   * Optional for backward compatibility — absent means not failed.
   */
  isFailed?: boolean;
  reward?: string;
  xpReward?: number;
}

export interface QuestSaveState {
  id: string;
  isCompleted: boolean;
  isActive: boolean;
  /** Absent in older saves — restored as not failed. */
  isFailed?: boolean;
  objectives: { id: string; current: number; completed: boolean }[];
}

const OBJECTIVE_TYPE: Record<QuestTriggerType, ObjectiveType> = {
  kill: "kill", pickup: "fetch", talk: "talk", custom: "custom",
};

export class QuestSystem {
  /** Where this system reports what happened (the game's event bus). */
  public events: GameEventBus | null = null;

  private _ui: UIManager;
  private _engine: (() => QuestGraphEngine | null) | null = null;
  public isLogOpen: boolean = false;

  constructor(ui: UIManager) {
    this._ui = ui;
  }

  /** Show the framework engine's quests in the log (it can be rebuilt, so a getter). */
  public setFramework(engine: () => QuestGraphEngine | null): void {
    this._engine = engine;
    this.refresh();
  }

  /** Every quest in the log: the engine's started quests. */
  public getQuests(): Quest[] {
    return this._frameworkViews();
  }

  public getActiveQuests(): Quest[] {
    return this.getQuests().filter(q => q.isActive && !q.isCompleted && !q.isFailed);
  }

  public getCompletedQuests(): Quest[] {
    return this.getQuests().filter(q => q.isCompleted);
  }

  public getFailedQuests(): Quest[] {
    return this.getQuests().filter(q => q.isFailed);
  }

  public toggleQuestLog(): void {
    this.isLogOpen = !this.isLogOpen;
    this._ui.toggleQuestLog(this.isLogOpen);
    if (this.isLogOpen) {
      this._ui.updateQuestLog(this.getQuests());
      this.events?.emit("questlog:opened", {});
    }
  }

  /** Redraw the log if it is open (after a framework quest moved). */
  public refresh(): void {
    if (this.isLogOpen) this._ui.updateQuestLog(this.getQuests());
  }

  /**
   * Restore the legacy `quests` save section (older saves).  An entry for
   * a quest the engine now owns (the starter quests, from before the merge)
   * is carried into the engine; the framework snapshot, restored after this,
   * wins when it has the quest.  Anything else (old job entries) is dropped:
   * those are radiant quests now.
   */
  public restoreState(savedQuests: QuestSaveState[]): void {
    const engine = this._engine?.() ?? null;
    if (engine) for (const saved of savedQuests) migrateIntoEngine(engine, saved);
    this.refresh();
  }

  /** Log entries for the framework quests that have started. */
  private _frameworkViews(): Quest[] {
    const engine = this._engine?.() ?? null;
    if (!engine) return [];
    const out: Quest[] = [];
    for (const [id, state] of Object.entries(engine.getSnapshot().quests)) {
      if (state.status === "inactive") continue;
      const def = engine.getQuestDefinition(id);
      if (!def) continue;
      const objectives: QuestObjective[] = [];
      for (const node of def.nodes) {
        const n = state.nodes[node.id];
        if (!n || n.skipped || !(n.active || n.completed || n.failed)) continue;
        objectives.push({
          id: node.id,
          type: OBJECTIVE_TYPE[node.triggerType],
          description: node.description,
          targetId: node.targetId,
          required: node.requiredCount,
          current: n.progress,
          completed: n.completed,
        });
      }
      const rewards = [
        def.xpReward ? `${def.xpReward} XP` : "",
        def.rewardGold ? `${def.rewardGold} gold` : "",
      ].filter(Boolean);
      out.push({
        id,
        name: def.name,
        description: def.description ?? "",
        objectives,
        isActive: state.status === "active",
        isCompleted: state.status === "completed",
        isFailed: state.status === "failed",
        reward: rewards.length ? rewards.join(", ") : undefined,
        xpReward: def.xpReward,
      });
    }
    return out;
  }
}

/** Carry a legacy save entry for a quest the engine now owns into the engine. */
function migrateIntoEngine(engine: QuestGraphEngine, saved: QuestSaveState): void {
  const def = engine.getQuestDefinition(saved.id);
  if (!def) return;
  const status: QuestRuntimeState["status"] = saved.isFailed ? "failed"
    : saved.isCompleted ? "completed"
    : saved.isActive ? "active" : "inactive";
  const nodes: QuestRuntimeState["nodes"] = {};
  for (const node of def.nodes) {
    const obj = saved.objectives.find(o => o.id === node.id);
    const completed = obj?.completed ?? status === "completed";
    nodes[node.id] = {
      active: status === "active" && !completed,
      completed,
      progress: obj ? Math.min(node.requiredCount, obj.current) : completed ? node.requiredCount : 0,
      ...(status === "failed" && !completed ? { failed: true } : {}),
    };
  }
  engine.restoreSnapshot({ quests: { [saved.id]: { status, nodes } } });
}
