import { UIManager } from "../ui/ui-manager";
import type { QuestGraphEngine } from "../framework/quests/quest-graph-engine";
import type { QuestRuntimeState, QuestTriggerType } from "../framework/quests/quest-types";
import type { GameEventBus } from "./event-bus";

/**
 * The quest log.  It shows two kinds of quest:
 *
 *   - framework quests (the one quest engine: graph, triggers, save), once
 *     started.  Their entries are views built from the engine on every read.
 *   - entries a feature owns and drives itself (a village job): added with
 *     `addQuest`, moved with `setProgress`, completed with `finish`.  Game
 *     events (kills, pickups, talks) never touch them.
 *
 * Kills, pickups and talks go to the framework engine (see `QuestBridge`);
 * the log no longer matches them itself.  (Engine overhaul, Phase 4: one
 * quest engine.)
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

  /** Entries owned by features (not framework quests). */
  private _own: Quest[] = [];
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

  /** Add a feature-owned entry; its owner drives it. */
  public addQuest(quest: Quest, silent = false): void {
    quest.isFailed ??= false;
    this._own.push(quest);
    if (!silent) this._ui.showNotification(`New Quest: ${quest.name}`, 3000);
    this.refresh();
  }

  /** Every quest in the log: started framework quests, then owned entries. */
  public getQuests(): Quest[] {
    return [...this._frameworkViews(), ...this._own];
  }

  /** The feature-owned entries only (what the legacy save section holds). */
  public getOwnQuests(): readonly Quest[] {
    return this._own;
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

  /** Set an owned entry's objective progress (clamped to what it needs). */
  public setProgress(questId: string, objectiveId: string, current: number): void {
    const obj = this._own.find(q => q.id === questId)?.objectives.find(o => o.id === objectiveId);
    if (!obj) return;
    obj.current = Math.max(0, Math.min(obj.required, current));
    obj.completed = obj.current >= obj.required;
    this.refresh();
  }

  /**
   * Complete an owned entry quietly, its owner having already paid out (no
   * toast, no XP).  Its objectives show as done.
   */
  public finish(questId: string): boolean {
    const quest = this._own.find(q => q.id === questId);
    if (!quest || quest.isCompleted || quest.isFailed) return false;
    quest.isCompleted = true;
    quest.isActive = false;
    for (const o of quest.objectives) { o.current = o.required; o.completed = true; }
    this.refresh();
    return true;
  }

  /** Take an owned entry out of the log (an abandoned job). */
  public remove(questId: string): boolean {
    const i = this._own.findIndex(q => q.id === questId);
    if (i < 0) return false;
    this._own.splice(i, 1);
    this.refresh();
    return true;
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
   * Restore saved progress (used by SaveSystem).  Owned entries take their
   * saved state.  A saved entry that is now a framework quest (the starter
   * quests, in saves from before the merge) is carried over into the
   * engine; the framework snapshot, restored after this, wins when it has
   * the quest.
   */
  public restoreState(savedQuests: QuestSaveState[]): void {
    const engine = this._engine?.() ?? null;
    for (const saved of savedQuests) {
      const quest = this._own.find(q => q.id === saved.id);
      if (quest) {
        quest.isCompleted = saved.isCompleted;
        quest.isActive = saved.isActive && !saved.isFailed;
        quest.isFailed = saved.isFailed ?? false;
        for (const savedObj of saved.objectives) {
          const obj = quest.objectives.find(o => o.id === savedObj.id);
          if (obj) {
            obj.current = savedObj.current;
            obj.completed = savedObj.completed;
          }
        }
        continue;
      }
      if (engine) migrateIntoEngine(engine, saved);
    }
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
