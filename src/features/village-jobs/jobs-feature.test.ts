import { describe, it, expect, vi } from "vitest";
import { Kernel } from "../../core/kernel";
import { FeedbackKey, InventoryKey, ModalKey, PlayerKey, QuestLogKey, VillagesKey } from "../services";
import { VillageJobsFeature, JobsKey } from "./jobs-feature";
import { VillageJobBoard } from "../../systems/village-jobs";
import { QuestSystem } from "../../systems/quest-system";

/** A board id whose first offer is the given template. */
function boardOffering(templateId: string): string {
  const b = new VillageJobBoard();
  for (let i = 0; i < 3000; i++) if (b.offerFor(`inn_${i}_0`, 3).id === templateId) return `inn_${i}_0`;
  throw new Error(`no board offers ${templateId}`);
}

function setup(boardId: string) {
  const k = new Kernel();
  const bag: Record<string, number> = {};
  const log = new QuestSystem({ showNotification: vi.fn(), toggleQuestLog: vi.fn(), updateQuestLog: vi.fn() } as never);

  const grants: Array<{ gold?: number; label: string }> = [];
  const modal = { suspendGameplay: vi.fn(), restoreGameplay: vi.fn() };
  k.services.provide(PlayerKey, { position: () => ({ x: 0, z: 0 }), level: () => 3 });
  k.services.provide(FeedbackKey, { notify: vi.fn(), grant: (r) => { grants.push(r); }, addFame: vi.fn(), markDirty: vi.fn() });
  k.services.provide(InventoryKey, {
    count: (id) => bag[id] ?? 0,
    remove: (id, n) => { if ((bag[id] ?? 0) < n) return false; bag[id] -= n; return true; },
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
  return { k, jobs, bag, get quests() { return log.getQuests(); }, log, grants, modal, click, feature };
}

describe("VillageJobsFeature (headless, through the kernel)", () => {
  it("“Any work going?” opens the window once the conversation closes; a bounty runs to payment", () => {
    const board = boardOffering("bounty_bandits");
    const t = setup(board);
    t.k.events.emit("dialogue:action", { eventId: "jobs:ask", npcName: "Innkeeper_10001" });
    expect(t.jobs.window.isVisible, "waits for the dialogue to close").toBe(false);
    t.k.events.emit("dialogue:closed", {});
    expect(t.jobs.window.isVisible).toBe(true);
    expect(t.modal.suspendGameplay).toHaveBeenCalledOnce();

    t.click("Accept");
    const quest = t.quests.find((q) => q.id === t.jobs.questIdOf(board))!;
    expect(quest.name).toContain("Camcross");

    for (let i = 0; i < 3; i++) t.k.events.emit("player:kill", { npcId: `Bandit_${i}`, npcName: "Bandit", xp: 5 });
    expect(quest.objectives[0].current).toBe(3);
    expect(quest.isCompleted, "not complete until paid").toBe(false);

    // Back at the board, the job can be handed in.
    t.jobs.open({ boardId: board, placeName: "Camcross" });
    t.click("Hand in");
    expect(t.grants[0]?.gold).toBe(120);
    expect(quest.isCompleted).toBe(true);
    t.click("Close");
    expect(t.modal.restoreGameplay).toHaveBeenCalledOnce();
    t.k.uninstall("village-jobs");
  });

  it("supply runs count the bag in the quest log; abandoning removes the entry", () => {
    const board = boardOffering("supply_iron");
    const t = setup(board);
    t.jobs.open({ boardId: board, placeName: "Camcross" });
    t.click("Accept");
    t.bag.iron_ingot = 2;
    t.k.events.emit("questlog:opened", {});
    expect(t.quests[0].objectives[0].current).toBe(2);
    t.click("Abandon");
    expect(t.quests).toHaveLength(0);
    expect(t.jobs.rules.getActive()).toHaveLength(0);
    t.k.uninstall("village-jobs");
  });

  it("a load prunes job entries the save doesn't have; uninstall closes the window", () => {
    const board = boardOffering("supply_leather");
    const t = setup(board);
    t.jobs.open({ boardId: board, placeName: "Camcross" });
    t.click("Accept");
    expect(t.quests).toHaveLength(1);
    t.jobs.rules.restoreFromSave(undefined); // the loaded save had no jobs
    t.k.events.emit("save:loaded", {});
    expect(t.quests).toHaveLength(0);
    t.k.uninstall("village-jobs");
    expect(t.jobs.window.isVisible).toBe(false);
    expect(document.querySelector(".job-board"), "window removed from the page").toBeNull();
    expect(t.k.services.tryGet(JobsKey)).toBeUndefined();
  });
});
