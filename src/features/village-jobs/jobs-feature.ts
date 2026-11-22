/**
 * Village jobs as a kernel feature: the job board rules, the job window,
 * and mirroring jobs into the quest log.
 *
 * Inputs:   events `player:kill`, `dialogue:action` ("jobs:ask"),
 *           `dialogue:closed`, `questlog:opened`, `save:loaded`;
 *           services player, feedback, inventory, quest-log, modal,
 *           village-world.
 * Outputs:  the `jobs` service (open a board's window, rules for saving).
 *
 * Extracted from game.ts (engine overhaul, Phase 1).
 */
import type { Feature, FeatureContext } from "../../core/kernel";
import { createServiceKey } from "../../core/kernel";
import { VillageJobBoard, type JobContext } from "../../systems/village-jobs";
import { JobBoardUI } from "../../ui/job-board-ui";
import type { Quest } from "../../systems/quest-system";
import {
  FeedbackKey, InventoryKey, ModalKey, PlayerKey, QuestLogKey, VillageWorldKey,
  type FeedbackService, type InventoryService, type ModalService, type PlayerService,
  type QuestLogService, type VillageWorldService,
} from "../services";

export interface JobBoardRef {
  boardId: string;
  placeName: string;
}

export interface JobsService {
  /** Rules and state (saved through this). */
  readonly rules: VillageJobBoard;
  /** The job window (modal bookkeeping reads `isVisible`). */
  readonly window: JobBoardUI;
  /** Open (or refresh) a board's window. */
  open(board: JobBoardRef): void;
  /** Quest-log id of a board's current job. */
  questIdOf(boardId: string): string;
}

export const JobsKey = createServiceKey<JobsService>("jobs");

interface JobDeps {
  readonly player: PlayerService;
  readonly feedback: FeedbackService;
  readonly inventory: InventoryService;
  readonly questLog: QuestLogService;
  readonly modal: ModalService;
  readonly world: VillageWorldService;
}

export class VillageJobsFeature implements Feature {
  public readonly id = "village-jobs";
  public readonly rules = new VillageJobBoard();
  public readonly window: JobBoardUI;
  private _deps: JobDeps | null = null;
  /** The board whose window is open. */
  private _active: JobBoardRef | null = null;
  /** "Any work going?" opens the window once the conversation has closed. */
  private _pending: JobBoardRef | null = null;

  constructor(window: JobBoardUI = new JobBoardUI()) {
    this.window = window;
  }

  public install(ctx: FeatureContext): void {
    const s = ctx.kernel.services;
    const deps: JobDeps = {
      get player() { return s.get(PlayerKey); },
      get feedback() { return s.get(FeedbackKey); },
      get inventory() { return s.get(InventoryKey); },
      get questLog() { return s.get(QuestLogKey); },
      get modal() { return s.get(ModalKey); },
      get world() { return s.get(VillageWorldKey); },
    };
    this._deps = deps;

    ctx.provide(JobsKey, {
      rules: this.rules,
      window: this.window,
      open: (board) => this.open(board),
      questIdOf: (boardId) => this._questId(boardId),
    });

    // Bounty kills advance jobs (prefix match on the NPC's name).
    ctx.on("player:kill", ({ npcId }) => this.rules.onKill(npcId));
    this.rules.onProgress = (job, template) => {
      this._syncQuest(job.boardId);
      const left = template.required - job.progress;
      deps.feedback.notify(
        left > 0 ? `${template.title}: ${job.progress}/${template.required}`
                 : `${template.title}: done — return to ${job.placeName} for your pay.`,
        2600,
      );
      deps.feedback.markDirty();
    };
    ctx.scope.add(() => { this.rules.onProgress = null; });

    ctx.on("dialogue:action", ({ eventId, npcName }) => {
      if (eventId === "jobs:ask" && npcName) this._pending = deps.world.innBoardOf(npcName);
    });
    ctx.on("dialogue:closed", () => {
      const board = this._pending;
      this._pending = null;
      if (board) this.open(board);
    });
    ctx.on("questlog:opened", () => this._syncAll());
    ctx.on("save:loaded", () => {
      // Drop job entries the loaded state no longer has, then mirror it back.
      this._pruneStale();
      this._syncAll();
    });

    this._wireWindow();
    // The feature owns its window: uninstalling removes it from the page.
    ctx.scope.add(() => {
      this.window.destroy();
      this._deps = null;
    });
  }

  /** Open (or refresh) the job window for a board. */
  public open(board: JobBoardRef): void {
    const deps = this._deps;
    if (!deps) return;
    this._active = board;
    const view = this.rules.view(board.boardId, board.placeName, this._context());
    if (this.window.isVisible) {
      this.window.render(board.placeName, view);
      return;
    }
    this.window.show(board.placeName, view);
    deps.modal.suspendGameplay();
  }

  private _wireWindow(): void {
    const refresh = () => {
      const b = this._active;
      if (b && this.rules.activeAt(b.boardId)) this._syncQuest(b.boardId);
      if (b && this.window.isVisible) {
        this.window.render(b.placeName, this.rules.view(b.boardId, b.placeName, this._context()));
      }
      this._deps?.feedback.markDirty();
    };
    this.window.onAccept = () => {
      const b = this._active, deps = this._deps;
      if (!b || !deps) return;
      const job = this.rules.accept(b.boardId, b.placeName, deps.player.level());
      this._syncQuest(job.boardId);
      const t = VillageJobBoard.template(job.templateId);
      if (t) deps.feedback.notify(`New job: ${t.title}`, 2600);
      refresh();
    };
    this.window.onHandIn = () => {
      const b = this._active, deps = this._deps;
      if (!b || !deps) return;
      const questId = this._questId(b.boardId); // before handIn bumps the count
      const done = this.rules.handIn(b.boardId, this._context());
      if (!done) { refresh(); return; }
      const quest = deps.questLog.quests().find((q) => q.id === questId);
      if (quest) {
        quest.isCompleted = true;
        quest.isActive = false;
        for (const o of quest.objectives) { o.current = o.required; o.completed = true; }
      }
      deps.feedback.addFame(5);
      deps.feedback.grant({ gold: done.rewardGold, xp: done.rewardXp, label: `Job done: ${done.template.title}` });
      refresh();
    };
    this.window.onDecline = () => {
      const b = this._active;
      if (!b) return;
      this._removeQuest(b.boardId);
      this.rules.decline(b.boardId);
      refresh();
    };
    this.window.onClose = () => {
      this._active = null;
      this._deps?.modal.restoreGameplay();
    };
  }

  private _context(): JobContext {
    const deps = this._deps!;
    return {
      playerLevel: deps.player.level(),
      countItem: (id) => deps.inventory.count(id),
      removeItem: (id, n) => deps.inventory.remove(id, n),
    };
  }

  /** Quest-log id for a board's current job (one entry per job taken there). */
  private _questId(boardId: string): string {
    const n = this.rules.completedAt(boardId);
    return n === 0 ? `job_${boardId}` : `job_${boardId}_${n}`;
  }

  private _syncAll(): void {
    for (const job of this.rules.getActive()) this._syncQuest(job.boardId);
  }

  /** Mirror an active job into the quest log (created on first sync). */
  private _syncQuest(boardId: string): void {
    const deps = this._deps;
    const job = this.rules.activeAt(boardId);
    if (!deps || !job) return;
    const template = VillageJobBoard.template(job.templateId);
    if (!template) return;
    const id = this._questId(boardId);
    let quest = deps.questLog.quests().find((q) => q.id === id);
    if (!quest) {
      quest = {
        id,
        name: `${template.title} (${job.placeName})`,
        description: VillageJobBoard.describe(template, job.placeName),
        isCompleted: false,
        isActive: true,
        reward: `${template.rewardGold} gold`,
        objectives: [{
          id: `${id}_obj`,
          // Never matched by QuestSystem's own kill/pickup hooks — the job board drives it.
          type: template.kind === "bounty" ? "kill" : "fetch",
          targetId: `__job__${template.target}`,
          description: template.kind === "bounty"
            ? `Kill ${template.required} (${template.target.replace(/([a-z])([A-Z])/g, "$1 $2")})`
            : `Bring ${template.required} × ${template.target.replace(/_/g, " ")}`,
          required: template.required,
          current: 0,
          completed: false,
        }],
      } as Quest;
      deps.questLog.add(quest);
    }
    const obj = quest.objectives[0];
    // Supply runs count what's in the bag; bounties count kills.
    const have = template.kind === "supply" ? deps.inventory.count(template.target) : job.progress;
    obj.current = Math.min(have, obj.required);
    // Never mark it complete: QuestSystem would then close the quest (and
    // announce it) on the next kill/talk event, before the job is paid.
    obj.completed = false;
  }

  /** Drop an abandoned job's quest-log entry. */
  private _removeQuest(boardId: string): void {
    const quests = this._deps?.questLog.quests();
    if (!quests) return;
    const id = this._questId(boardId);
    const i = quests.findIndex((q) => q.id === id && !q.isCompleted);
    if (i >= 0) quests.splice(i, 1);
  }

  /** Drop quest-log entries for jobs that are no longer active. */
  private _pruneStale(): void {
    const quests = this._deps?.questLog.quests();
    if (!quests) return;
    const live = new Set(this.rules.getActive().map((j) => this._questId(j.boardId)));
    for (let i = quests.length - 1; i >= 0; i--) {
      const q = quests[i];
      if (q.id.startsWith("job_") && !q.isCompleted && !live.has(q.id)) quests.splice(i, 1);
    }
  }
}
