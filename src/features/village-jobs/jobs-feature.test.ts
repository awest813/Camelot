import { describe, it, expect, vi } from "vitest";
import { Kernel } from "../../core/kernel";
import { FeedbackKey, InventoryKey, ModalKey, PlayerKey, QuestLogKey, QuestsKey, VillagesKey } from "../services";
import { VillageJobsFeature, JobsKey } from "./jobs-feature";
import { VillageJobBoard } from "../../systems/village-jobs";
import { QuestSystem } from "../../systems/quest-system";
import { QuestGraphEngine } from "../../framework/quests/quest-graph-engine";

/** A board id whose first offer is the given template. */
function boardOffering(templateId: string): string {
  const b = new VillageJobBoard();
  for (let i = 0; i < 3000; i++) if (b.offerFor(`inn_${i}_0`, 3).id === templateId) return `inn_${i}_0`;
  throw new Error(`no board offers ${templateId}`);
}

function setup(boardId: string) {
  const k = new Kernel();
  const bag: Record<string, number> = {};
  const engine = new QuestGraphEngine();
  const log = new QuestSystem({ showNotification: vi.fn(), toggleQuestLog: vi.fn(), updateQuestLog: vi.fn() } as never);
  log.setFramework(() => engine);
  const notes: string[] = [];
  /** What the quest bridge paid (gold, fame) for completed quests. */
  const paid: Array<{ questId: string; gold: number; fame: number }> = [];
  const modal = { suspendGameplay: vi.fn(), restoreGameplay: vi.fn() };
  k.services.provide(PlayerKey, { position: () => ({ x: 0, z: 0 }), level: () => 3 });
  k.services.provide(FeedbackKey, { notify: (t) => { notes.push(t); }, grant: vi.fn(), addFame: vi.fn(), markDirty: vi.fn() });
  k.services.provide(InventoryKey, {
    count: (id) => bag[id] ?? 0,
    remove: (id, n) => { if ((bag[id] ?? 0) < n) return false; bag[id] -= n; return true; },
  });
  // The quest bridge, in brief: events into the engine, progress reported, completion paid.
  k.services.provide(QuestsKey, {
    engine,
    apply: (type, targetId, amount) => {
      for (const r of engine.applyEvent({ type, targetId, amount })) {
        const def = engine.getQuestDefinition(r.questId)!;
        for (const p of r.progressed ?? []) k.events.emit("quest:progressed", { questId: r.questId, ...p });
        if (r.questCompleted) paid.push({ questId: r.questId, gold: def.rewardGold ?? 0, fame: def.fameReward ?? 10 });
      }
    },
  });
  k.services.provide(QuestLogKey, {
    quests: () => log.getQuests(), add: (q) => log.addQuest(q, true),
    setProgress: (id, o, n) => log.setProgress(id, o, n), finish: (id) => log.finish(id), remove: (id) => log.remove(id),
  });
  k.services.provide(ModalKey, modal);
  k.services.provide(VillagesKey, {
    currentVillage: () => null, loadedVillage: () => null, planFor: () => null, clearingAt: () => null,
    populate: () => false, loaded: () => new Map(),
    innBoardOf: (name) => (name.startsWith("Innkeeper") ? { boardId, placeName: "Camcross" } : null),
  });
  const feature = new VillageJobsFeature();
  k.install(feature);
  const jobs = k.services.get(JobsKey);
  const click = (label: string) => {
    const btn = Array.from(document.querySelectorAll<HTMLButtonElement>(".job-board__btn")).find((b) => b.textContent === label);
    if (!btn) throw new Error(`no "${label}" button`);
    btn.click();
  };
  const quest = (id: string) => log.getQuests().find((q) => q.id === id);
  return { k, jobs, bag, engine, log, quest, notes, paid, modal, click, feature, kill: (target: string) => k.services.get(QuestsKey).apply("kill", target) };
}

describe("VillageJobsFeature (headless, through the kernel)", () => {
  it("“Any work going?” opens the window once the conversation closes; a bounty is a quest run to payment", () => {
    const board = boardOffering("bounty_bandits");
    const t = setup(board);
    t.k.events.emit("dialogue:action", { eventId: "jobs:ask", npcName: "Innkeeper_10001" });
    expect(t.jobs.window.isVisible, "waits for the dialogue to close").toBe(false);
    t.k.events.emit("dialogue:closed", {});
    expect(t.jobs.window.isVisible).toBe(true);
    expect(t.modal.suspendGameplay).toHaveBeenCalledOnce();

    t.click("Accept");
    const id = t.jobs.questIdOf(board);
    expect(t.engine.getRadiantInstance(id), "the job is a radiant quest").toEqual({ templateId: "bounty_bandits", vars: { place: "Camcross" } });
    expect(t.quest(id)!.name).toBe("Bandit Trouble (Camcross)");

    for (let i = 0; i < 3; i++) t.kill("Bandit");
    t.kill("Wolf");
    expect(t.quest(id)!.objectives[0].current).toBe(3);
    expect(t.notes).toContain("Bandit Trouble: 1/3");
    expect(t.notes.at(-1)).toBe("Bandit Trouble: done — return to Camcross for your pay.");
    expect(t.quest(id)!.isCompleted, "not complete until paid").toBe(false);

    // Back at the board, the job is handed in: the quest completes and the bridge pays.
    t.jobs.open({ boardId: board, placeName: "Camcross" });
    t.click("Hand in");
    expect(t.paid).toEqual([{ questId: id, gold: 120, fame: 5 }]);
    expect(t.quest(id)!.isCompleted).toBe(true);
    expect(t.jobs.rules.completedAt(board)).toBe(1);
    t.click("Close");
    expect(t.modal.restoreGameplay).toHaveBeenCalledOnce();
    t.k.uninstall("village-jobs");
  });

  it("supply runs: hand-in takes the goods and completes the quest; abandoning removes it", () => {
    const board = boardOffering("supply_iron");
    const t = setup(board);
    t.jobs.open({ boardId: board, placeName: "Camcross" });
    t.click("Accept");
    const id = t.jobs.questIdOf(board);
    t.bag.iron_ingot = 4;
    t.jobs.open({ boardId: board, placeName: "Camcross" });
    t.click("Hand in");
    expect(t.bag.iron_ingot).toBe(0);
    expect(t.paid.map((p) => p.questId)).toEqual([id]);

    // The next job there: abandon it.
    t.click("Accept");
    const next = t.jobs.questIdOf(board);
    expect(next).not.toBe(id);
    expect(t.quest(next)).toBeDefined();
    t.click("Abandon");
    expect(t.quest(next)).toBeUndefined();
    expect(t.engine.getQuestDefinition(next)).toBeUndefined();
    expect(t.jobs.rules.getActive()).toHaveLength(0);
    t.k.uninstall("village-jobs");
  });

  it("a job from an older save gets its quest (kills carried over); the log's old entry goes", () => {
    const board = boardOffering("bounty_dead");
    const t = setup(board);
    // An old save: the job with its own kill count, and a log entry the jobs owned.
    t.jobs.rules.restoreFromSave({ active: [{ boardId: board, placeName: "Ashford", templateId: "bounty_dead", progress: 2 }], completed: {}, declined: {} });
    t.log.addQuest({ id: `job_${board}`, name: "old", description: "", objectives: [], isCompleted: false, isActive: true }, true);
    t.k.events.emit("save:loaded", {});
    const id = t.jobs.questIdOf(board);
    expect(t.engine.getQuestState(id)!.nodes.hunt.progress).toBe(2);
    expect(t.log.getQuests().filter((q) => q.id === id)).toHaveLength(1);
    expect(t.quest(id)!.name).toBe("The Restless Dead (Ashford)");
    expect(t.jobs.rules.getActive()[0].progress).toBe(2);
    t.k.uninstall("village-jobs");
    expect(document.querySelector(".job-board"), "window removed from the page").toBeNull();
    expect(t.k.services.tryGet(JobsKey)).toBeUndefined();
  });
});
