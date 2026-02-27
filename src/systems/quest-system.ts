import { UIManager } from "../ui/ui-manager";

export type ObjectiveType = "kill" | "fetch" | "talk";

export interface QuestObjective {
  id: string;
  type: ObjectiveType;
  description: string;
  /** NPC mesh name for kill/talk objectives; item id for fetch objectives. */
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
  reward?: string;
}

export interface QuestSaveState {
  id: string;
  isCompleted: boolean;
  isActive: boolean;
  objectives: { id: string; current: number; completed: boolean }[];
}

export class QuestSystem {
  private _quests: Quest[] = [];
  private _ui: UIManager;
  public isLogOpen: boolean = false;

  constructor(ui: UIManager) {
    this._ui = ui;
  }

  public addQuest(quest: Quest, silent = false): void {
    this._quests.push(quest);
    if (!silent) this._ui.showNotification(`New Quest: ${quest.name}`, 3000);
    this._syncUI();
  }

  public getQuests(): Quest[] {
    return this._quests;
  }

  public getActiveQuests(): Quest[] {
    return this._quests.filter(q => q.isActive && !q.isCompleted);
  }

  public getCompletedQuests(): Quest[] {
    return this._quests.filter(q => q.isCompleted);
  }

  /** Called by CombatSystem when an NPC is killed. */
  public onKill(npcName: string): void {
    this._updateObjective("kill", npcName);
  }

  /** Called by InteractionSystem when loot is successfully picked up. */
  public onPickup(itemId: string): void {
    this._updateObjective("fetch", itemId);
  }

  /** Called by DialogueSystem when dialogue with an NPC starts. */
  public onTalk(npcName: string): void {
    this._updateObjective("talk", npcName);
  }

  public toggleQuestLog(): void {
    this.isLogOpen = !this.isLogOpen;
    this._ui.toggleQuestLog(this.isLogOpen);
    if (this.isLogOpen) this._ui.updateQuestLog(this._quests);
  }

  /** Restore quest progress from a saved state (used by SaveSystem). */
  public restoreState(savedQuests: QuestSaveState[]): void {
    for (const saved of savedQuests) {
      const quest = this._quests.find(q => q.id === saved.id);
      if (!quest) continue;
      quest.isCompleted = saved.isCompleted;
      quest.isActive = saved.isActive;
      for (const savedObj of saved.objectives) {
        const obj = quest.objectives.find(o => o.id === savedObj.id);
        if (obj) {
          obj.current = savedObj.current;
          obj.completed = savedObj.completed;
        }
      }
    }
    this._syncUI();
  }

  private _updateObjective(type: ObjectiveType, targetId: string): void {
    let anyUpdated = false;
    for (const quest of this._quests) {
      if (!quest.isActive || quest.isCompleted) continue;
      for (const obj of quest.objectives) {
        if (obj.completed || obj.type !== type || obj.targetId !== targetId) continue;
        obj.current = Math.min(obj.required, obj.current + 1);
        if (obj.current >= obj.required) obj.completed = true;
        anyUpdated = true;
      }
      this._checkCompletion(quest);
    }
    if (anyUpdated) this._syncUI();
  }

  private _checkCompletion(quest: Quest): void {
    if (quest.isCompleted) return;
    if (quest.objectives.every(o => o.completed)) {
      quest.isCompleted = true;
      quest.isActive = false;
      this._ui.showNotification(`Quest Complete: ${quest.name}!`, 4000);
    }
  }

  private _syncUI(): void {
    if (this.isLogOpen) this._ui.updateQuestLog(this._quests);
  }
}
