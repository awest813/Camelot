/**
 * Village jobs as a kernel feature: the job board rules and the job window.
 * Each job taken is a radiant quest in the quest engine (templates from
 * `radiantTemplateOf`): the engine counts bounty kills, the log shows it, the
 * save keeps it, and the quest bridge pays for it on hand-in.
 *
 * A board with a bandit camp (or, for veterans, a dragon's roost) still
 * standing near it can also offer to clear it: taking the job marks the
 * site on the map, and its clearing (landmarks feature) completes the hunt.
 *
 * Inputs:   events `quest:progressed`, `dialogue:action` ("jobs:ask"),
 *           `dialogue:closed`, `save:loaded`, `landmark:cleared`; services
 *           player, feedback, inventory, quests, modal, village-world,
 *           landmarks, world-info.
 * Outputs:  the `jobs` service (open a board's window, rules for saving).
 *
 * Extracted from game.ts (engine overhaul, Phase 1).
 */
import type { Feature, FeatureContext } from "../../core/kernel";
import { createServiceKey } from "../../core/kernel";
import { JOB_TEMPLATES, VillageJobBoard, radiantTemplateOf, type ActiveJob, type JobCamp, type JobContext } from "../../systems/village-jobs";
import { clearedEvent, deliverEvent, reportEvent } from "../../framework/quests/radiant";
import { JobBoardUI } from "../../ui/job-board-ui";
import { FeedbackKey, InventoryKey, LandmarksKey, WorldInfoKey, ModalKey, PlayerKey, QuestsKey, VillagesKey, type FeedbackService, type InventoryService, type ModalService, type PlayerService, type QuestsService, type VillagesService, ownSave, ownTransient, JobsKey } from "../services";

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
  /** Quest id of a board's current job. */
  questIdOf(boardId: string): string;
}

export { JobsKey };

interface JobDeps {
  readonly player: PlayerService;
  readonly feedback: FeedbackService;
  readonly inventory: InventoryService;
  readonly quests: QuestsService;
  readonly modal: ModalService;
  readonly villages: VillagesService;
}

const COMPASS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"] as const;
/** Which way (dx, dz) points, as a word (north is +z). */
export function compassWord(dx: number, dz: number): string {
  const sector = Math.round(Math.atan2(dx, dz) / (Math.PI / 4));
  return COMPASS[((sector % 8) + 8) % 8];
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
  /** The camp a board could send the player to clear (none until installed). */
  private _campNear: (boardId: string, kind: string, reach: number) => JobCamp | null = () => null;
  /** Put a landmark on the map. */
  private _mark: (id: string) => boolean = () => false;

  constructor(window: JobBoardUI = new JobBoardUI()) {
    this.window = window;
  }

  public install(ctx: FeatureContext): void {
    ownSave(ctx, { key: "villageJobs", save: () => this.rules.getSaveState(), load: (data) => this.rules.restoreFromSave(data as never) });
    const s = ctx.kernel.services;
    const deps: JobDeps = {
      get player() { return s.get(PlayerKey); },
      get feedback() { return s.get(FeedbackKey); },
      get inventory() { return s.get(InventoryKey); },
      get quests() { return s.get(QuestsKey); },
      get modal() { return s.get(ModalKey); },
      get villages() { return s.get(VillagesKey); },
    };
    this._deps = deps;

    ctx.provide(JobsKey, {
      rules: this.rules,
      window: this.window,
      open: (board) => this.open(board),
      questIdOf: (boardId) => this._questId(boardId),
    });

    // Jobs are radiant quests: their templates live in the quest engine, and
    // a job's bounty kills are its quest's first step.
    const engine = () => deps.quests.engine;
    for (const t of JOB_TEMPLATES) engine().registerRadiantTemplate(radiantTemplateOf(t));
    this.rules.progress = (job) => engine().getQuestState(this._questId(job.boardId))?.nodes.hunt?.progress ?? job.progress;
    ctx.on("quest:progressed", ({ questId, nodeId, progress, required }) => {
      const job = this.rules.getActive().find((j) => this._questId(j.boardId) === questId);
      if (!job || nodeId !== "hunt") return;
      const t = VillageJobBoard.template(job.templateId)!;
      deps.feedback.notify(progress < required ? `${t.title}: ${progress}/${required}` : `${t.title}: done — return to ${job.placeName} for your pay.`, 2600);
      deps.feedback.markDirty();
      this._refreshWindow();
    });

    // A camp a clearance names has fallen: the hunt is done (whoever did it).
    ctx.on("landmark:cleared", ({ id }) => { deps.quests.apply("custom", clearedEvent(id)); });
    this._campNear = (boardId, kind, reach) => {
      const m = /_(-?\d+)_(-?\d+)$/.exec(boardId);
      const landmarks = s.tryGet(LandmarksKey);
      if (!m || !landmarks?.nearest) return null;
      const size = s.get(WorldInfoKey).chunkSize;
      const bx = Number(m[1]) * size, bz = Number(m[2]) * size;
      const camp = landmarks.nearest(kind, bx, bz, reach);
      return camp && { id: camp.id, name: camp.name, direction: compassWord(camp.x - bx, camp.z - bz) };
    };
    this._mark = (id) => s.tryGet(LandmarksKey)?.mark?.(id) ?? false;

    ctx.on("dialogue:action", ({ eventId, npcName }) => {
      if (eventId === "jobs:ask" && npcName) this._pending = deps.villages.innBoardOf(npcName);
    });
    ctx.on("dialogue:closed", () => {
      const board = this._pending;
      this._pending = null;
      if (board) this.open(board);
    });
    // After a load: a job from an older save (before jobs were quests) gets
    // its quest, carrying its kills over.
    ownTransient(ctx, "jobs taken before they were quests", () => this._migrateOldJobs());

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

  private _refreshWindow(): void {
    const b = this._active;
    if (b && this.window.isVisible) this.window.render(b.placeName, this.rules.view(b.boardId, b.placeName, this._context()));
  }

  private _wireWindow(): void {
    const refresh = () => {
      this._refreshWindow();
      this._deps?.feedback.markDirty();
    };
    this.window.onAccept = () => {
      const b = this._active, deps = this._deps;
      if (!b || !deps) return;
      const job = this.rules.accept(b.boardId, b.placeName, deps.player.level(), (t) => (t.site ? this._campNear(b.boardId, t.site.kind, t.site.reach) : null));
      this._startQuest(job);
      const t = VillageJobBoard.template(job.templateId);
      if (t) deps.feedback.notify(`New job: ${t.title}`, 2600);
      if (job.camp) {
        this._mark(job.camp.id);
        deps.feedback.notify(`Marked on your map: ${job.camp.name}`, 2600);
      }
      refresh();
    };
    this.window.onHandIn = () => {
      const b = this._active, deps = this._deps;
      if (!b || !deps) return;
      const questId = this._questId(b.boardId); // before handIn bumps the count
      const done = this.rules.handIn(b.boardId, this._context());
      if (!done) { refresh(); return; }
      // The quest's last step: the engine completes it and the bridge pays.
      if (done.template.kind !== "supply") deps.quests.apply("custom", reportEvent(questId));
      else deps.quests.apply("custom", deliverEvent(questId), done.template.required);
      refresh();
    };
    this.window.onDecline = () => {
      const b = this._active, deps = this._deps;
      if (!b || !deps) return;
      if (this.rules.activeAt(b.boardId)) deps.quests.engine.removeQuest(this._questId(b.boardId));
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
      campNear: (boardId, kind, reach) => this._campNear(boardId, kind, reach),
    };
  }

  /** Quest-log id for a board's current job (one entry per job taken there). */
  private _questId(boardId: string): string {
    const n = this.rules.completedAt(boardId);
    return n === 0 ? `job_${boardId}` : `job_${boardId}_${n}`;
  }

  /** Start a job's radiant quest (once). */
  private _startQuest(job: ActiveJob): void {
    const camp: Record<string, string> = job.camp ? { camp: job.camp.name, landmark: job.camp.id } : {};
    this._deps?.quests.engine.startRadiant(job.templateId, this._questId(job.boardId), { place: job.placeName, ...camp });
  }

  /** Jobs from older saves: give them their quest. */
  private _migrateOldJobs(): void {
    const deps = this._deps;
    if (!deps) return;
    const engine = deps.quests.engine;
    for (const job of this.rules.getActive()) {
      const questId = this._questId(job.boardId);
      if (engine.getQuestDefinition(questId)) continue;
      // `progress` is the count the old save stored (no quest to read yet).
      const kills = job.progress;
      this._startQuest(job);
      const t = VillageJobBoard.template(job.templateId);
      if (t?.kind === "bounty" && kills > 0) engine.applyEvent({ type: "kill", targetId: t.target, amount: kills }, questId);
    }
  }
}
