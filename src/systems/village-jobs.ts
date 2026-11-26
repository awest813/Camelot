/**
 * VillageJobBoard — radiant work offered by innkeepers ("Any work going?").
 *
 * Each board (an inn, keyed by its chunk) offers one job at a time:
 *  • bounties — kill N enemies whose name starts with a prefix (bandits,
 *    the restless dead, a dragon for veterans), then return to collect;
 *  • supply runs — bring N of an item (iron, leather, healing potions),
 *    handed over and paid on the spot.
 *
 * Pure state + rules (no Babylon / UI): which job each board offers (the
 * same per board and per number of jobs finished there, so a reload offers
 * the same work), the jobs taken, and hand-ins.  Each job taken is a radiant
 * quest in the quest engine (see `radiantTemplateOf`), which counts bounty
 * kills, shows it in the log, saves it and pays for it; the board reads a
 * job's progress through `progress`.
 */
import type { RadiantTemplate } from "../framework/quests/radiant";

export type JobKind = "bounty" | "supply";

export interface JobTemplate {
  id: string;
  kind: JobKind;
  title: string;
  /** `{place}` is replaced with the board's place name. */
  description: string;
  /** Bounty: NPC name prefix to count; supply: item id to deliver. */
  target: string;
  required: number;
  rewardGold: number;
  rewardXp: number;
  /** Only offered from this character level up. */
  minLevel?: number;
}

export const JOB_TEMPLATES: readonly JobTemplate[] = [
  {
    id: "bounty_bandits", kind: "bounty", title: "Bandit Trouble",
    description: "Bandits have been preying on travellers near {place}. Kill three of them.",
    target: "Bandit", required: 3, rewardGold: 120, rewardXp: 60,
  },
  {
    id: "bounty_dead", kind: "bounty", title: "The Restless Dead",
    description: "The dead walk in the old ruins beyond {place}. Put three of them back in the ground.",
    target: "RuinGuard", required: 3, rewardGold: 150, rewardXp: 75,
  },
  {
    id: "bounty_dragon", kind: "bounty", title: "Wyrm in the North",
    description: "A dragon has been seen over the tundra, and {place} lives in dread. Slay it.",
    target: "DragonBoss", required: 1, rewardGold: 600, rewardXp: 300, minLevel: 5,
  },
  {
    id: "supply_iron", kind: "supply", title: "Iron for the Forge",
    description: "The smith at {place} is short of iron. Bring four Iron Ingots.",
    target: "iron_ingot", required: 4, rewardGold: 70, rewardXp: 30,
  },
  {
    id: "supply_leather", kind: "supply", title: "Strips of Leather",
    description: "{place} needs leather for harness and boots. Bring six Leather Strips.",
    target: "leather_strips", required: 6, rewardGold: 45, rewardXp: 25,
  },
  {
    id: "supply_potions", kind: "supply", title: "Medicine for the Sick",
    description: "Fever has come to {place}. Bring three Health Potions for the sick.",
    target: "potion_hp_01", required: 3, rewardGold: 90, rewardXp: 40,
  },
];

export interface ActiveJob {
  boardId: string;
  placeName: string;
  templateId: string;
  /** Bounty kills (read through `VillageJobBoard.progress`; older saves stored it here). */
  progress: number;
}

/** A job template as a radiant quest template (kills, or a delivery). */
export function radiantTemplateOf(t: JobTemplate): RadiantTemplate {
  const label = t.target.replace(/([a-z])([A-Z])/g, "$1 $2");
  return {
    id: t.id,
    kind: t.kind === "bounty" ? "kill" : "deliver",
    name: `${t.title} ({place})`,
    description: t.description,
    objective: t.kind === "bounty" ? `Kill ${t.required} (${label})` : `Bring ${t.required} × ${t.target.replace(/_/g, " ")}`,
    report: "Return to {place} for your pay",
    targetId: t.target,
    required: t.required,
    rewardGold: t.rewardGold,
    xpReward: t.rewardXp,
    fameReward: 5,
  };
}

export interface JobContext {
  playerLevel: number;
  /** How many of an item the player carries. */
  countItem: (itemId: string) => number;
  /** Remove items (all or nothing); returns false when short. */
  removeItem: (itemId: string, amount: number) => boolean;
}

export type AskResult =
  | { type: "accepted"; job: ActiveJob; template: JobTemplate; text: string }
  | { type: "progress"; job: ActiveJob; template: JobTemplate; text: string }
  | { type: "completed"; template: JobTemplate; text: string; rewardGold: number; rewardXp: number };

export interface VillageJobsSaveState {
  active: ActiveJob[];
  completed: Record<string, number>;
  /** Jobs turned down / abandoned per board (rolls the next offer). Optional for old saves. */
  declined?: Record<string, number>;
}

/** What a board shows right now (for the job board window). */
export interface BoardView {
  template: JobTemplate;
  /** The active job here, or null when this is a fresh offer. */
  job: ActiveJob | null;
  description: string;
  /** Progress toward the requirement (kills, or items carried for supply runs). */
  progress: number;
  /** Whether "Hand in" would succeed now. */
  canHandIn: boolean;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export class VillageJobBoard {
  private readonly _active = new Map<string, ActiveJob>();
  private readonly _completed = new Map<string, number>();
  private readonly _declined = new Map<string, number>();

  /** A job's bounty kills so far (the game reads them from the quest engine). */
  public progress: (job: ActiveJob) => number = (job) => job.progress;

  public static template(id: string): JobTemplate | undefined {
    return JOB_TEMPLATES.find((t) => t.id === id);
  }

  public static describe(template: JobTemplate, placeName: string): string {
    return template.description.replace("{place}", placeName);
  }

  /** The job a board offers next (deterministic per board and jobs done there). */
  public offerFor(boardId: string, playerLevel: number): JobTemplate {
    const pool = JOB_TEMPLATES.filter((t) => (t.minLevel ?? 0) <= playerLevel);
    const n = this._completed.get(boardId) ?? 0;
    const d = this._declined.get(boardId) ?? 0;
    return pool[hash(`${boardId}#${n}${d ? `~${d}` : ""}`) % pool.length];
  }

  public getActive(): ActiveJob[] {
    return [...this._active.values()].map((j) => ({ ...j, progress: this.progress(j) }));
  }

  public activeAt(boardId: string): ActiveJob | undefined {
    return this._active.get(boardId);
  }

  public completedAt(boardId: string): number {
    return this._completed.get(boardId) ?? 0;
  }

  /**
   * The player asks a board for work: accept a new job, report progress, or
   * hand in (supply runs pay on delivery; bounties once the kills are done).
   */
  public ask(boardId: string, placeName: string, ctx: JobContext): AskResult {
    const job = this._active.get(boardId);
    if (!job) {
      const template = this.offerFor(boardId, ctx.playerLevel);
      const fresh: ActiveJob = { boardId, placeName, templateId: template.id, progress: 0 };
      this._active.set(boardId, fresh);
      return { type: "accepted", job: fresh, template, text: VillageJobBoard.describe(template, placeName) };
    }
    const template = VillageJobBoard.template(job.templateId)!;
    if (template.kind === "supply") {
      const have = ctx.countItem(template.target);
      if (have >= template.required && ctx.removeItem(template.target, template.required)) {
        return this._complete(job, template);
      }
      job.progress = Math.min(have, template.required);
      return { type: "progress", job, template, text: `You have ${have} of ${template.required}.` };
    }
    if (this.progress(job) >= template.required) return this._complete(job, template);
    return {
      type: "progress", job, template,
      text: `${template.required - this.progress(job)} still to go.`,
    };
  }

  /** The board's current state: its active job, or the job it offers. */
  public view(boardId: string, placeName: string, ctx: JobContext): BoardView {
    const job = this._active.get(boardId) ?? null;
    const template = job ? VillageJobBoard.template(job.templateId)! : this.offerFor(boardId, ctx.playerLevel);
    const place = job?.placeName ?? placeName;
    const progress = template.kind === "supply"
      ? Math.min(ctx.countItem(template.target), template.required)
      : job ? this.progress(job) : 0;
    return {
      template,
      job,
      description: VillageJobBoard.describe(template, place),
      progress,
      canHandIn: !!job && progress >= template.required,
    };
  }

  /** Take the board's offered job (no-op if one is already active there). */
  public accept(boardId: string, placeName: string, playerLevel: number): ActiveJob {
    const existing = this._active.get(boardId);
    if (existing) return existing;
    const template = this.offerFor(boardId, playerLevel);
    const job: ActiveJob = { boardId, placeName, templateId: template.id, progress: 0 };
    this._active.set(boardId, job);
    return job;
  }

  /** Hand in the active job when its requirement is met (supply runs take the goods). */
  public handIn(boardId: string, ctx: JobContext): Extract<AskResult, { type: "completed" }> | null {
    const job = this._active.get(boardId);
    if (!job) return null;
    const template = VillageJobBoard.template(job.templateId)!;
    if (template.kind === "supply") {
      if (ctx.countItem(template.target) < template.required) return null;
      if (!ctx.removeItem(template.target, template.required)) return null;
    } else if (this.progress(job) < template.required) {
      return null;
    }
    return this._complete(job, template) as Extract<AskResult, { type: "completed" }>;
  }

  /**
   * Turn down the offer or abandon the active job: the board moves on to a
   * different job (no reward, no penalty).
   */
  public decline(boardId: string): void {
    this._active.delete(boardId);
    this._declined.set(boardId, (this._declined.get(boardId) ?? 0) + 1);
  }

  private _complete(job: ActiveJob, template: JobTemplate): AskResult {
    this._active.delete(job.boardId);
    this._completed.set(job.boardId, (this._completed.get(job.boardId) ?? 0) + 1);
    return {
      type: "completed", template,
      text: `${template.title} — done. ${template.rewardGold} gold.`,
      rewardGold: template.rewardGold, rewardXp: template.rewardXp,
    };
  }

  public getSaveState(): VillageJobsSaveState {
    return {
      active: this.getActive(),
      completed: Object.fromEntries(this._completed),
      declined: Object.fromEntries(this._declined),
    };
  }

  public restoreFromSave(state: VillageJobsSaveState | undefined): void {
    this._active.clear();
    this._completed.clear();
    this._declined.clear();
    if (!state) return;
    for (const j of state.active ?? []) {
      if (VillageJobBoard.template(j.templateId)) this._active.set(j.boardId, { ...j });
    }
    for (const [k, v] of Object.entries(state.completed ?? {})) {
      if (typeof v === "number") this._completed.set(k, v);
    }
    for (const [k, v] of Object.entries(state.declined ?? {})) {
      if (typeof v === "number") this._declined.set(k, v);
    }
  }
}
