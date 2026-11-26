import { describe, it, expect, beforeEach } from "vitest";
import { VillageJobBoard, JOB_TEMPLATES, radiantTemplateOf, type JobContext } from "./village-jobs";
import { QuestGraphEngine } from "../framework/quests/quest-graph-engine";

function ctx(bag: Record<string, number>, level = 1): JobContext {
  return {
    playerLevel: level,
    countItem: (id) => bag[id] ?? 0,
    removeItem: (id, n) => {
      if ((bag[id] ?? 0) < n) return false;
      bag[id] -= n;
      return true;
    },
  };
}

/** Find a board id whose first offer is the given template. */
function boardOffering(templateId: string, level = 1, hasCamp = false): string {
  const b = new VillageJobBoard();
  for (let i = 0; i < 2000; i++) {
    if (b.offerFor(`board_${i}`, level, hasCamp).id === templateId) return `board_${i}`;
  }
  throw new Error(`no board offers ${templateId}`);
}

describe("VillageJobBoard", () => {
  let board: VillageJobBoard;
  beforeEach(() => { board = new VillageJobBoard(); });

  it("offers deterministically and never above the player's level", () => {
    expect(board.offerFor("inn_3_4", 1)).toEqual(board.offerFor("inn_3_4", 1));
    for (let i = 0; i < 300; i++) expect(board.offerFor(`b${i}`, 1).id).not.toBe("bounty_dragon");
    const offered = new Set(Array.from({ length: 300 }, (_, i) => board.offerFor(`b${i}`, 10).id));
    expect(offered.has("clear_camp"), "no camp near: no clearance").toBe(false);
    expect(offered.size).toBe(JOB_TEMPLATES.length - 1);
    const withCamp = new Set(Array.from({ length: 300 }, (_, i) => board.offerFor(`b${i}`, 10, true).id));
    expect(withCamp.size).toBe(JOB_TEMPLATES.length);
  });

  it("asking first accepts the job, with the place named", () => {
    const id = boardOffering("bounty_bandits");
    const r = board.ask(id, "Camcross", ctx({}));
    expect(r.type).toBe("accepted");
    expect(r.text).toContain("Camcross");
    expect(board.activeAt(id)?.templateId).toBe("bounty_bandits");
  });

  it("bounties: the job's quest counts the kills; the board pays once they are in", () => {
    const id = boardOffering("bounty_bandits");
    board.ask(id, "Camcross", ctx({}));
    // In the game the job is a radiant quest; its first step counts kills.
    const engine = new QuestGraphEngine();
    for (const t of JOB_TEMPLATES) engine.registerRadiantTemplate(radiantTemplateOf(t));
    engine.startRadiant("bounty_bandits", "job", { place: "Camcross" });
    board.progress = () => engine.getQuestState("job")!.nodes.hunt.progress;
    engine.applyEvent({ type: "kill", targetId: "Bandit" });
    engine.applyEvent({ type: "kill", targetId: "Wolf" });   // not a bandit
    expect(board.ask(id, "Camcross", ctx({})).type).toBe("progress");
    expect(board.view(id, "Camcross", ctx({})).canHandIn).toBe(false);
    engine.applyEvent({ type: "kill", targetId: "Bandit", amount: 5 }); // capped at the requirement
    expect(board.getActive()[0].progress).toBe(3);
    const done = board.ask(id, "Camcross", ctx({}));
    expect(done.type).toBe("completed");
    if (done.type === "completed") expect(done.rewardGold).toBe(120);
    expect(board.activeAt(id)).toBeUndefined();
    expect(board.completedAt(id)).toBe(1);
  });

  it("each template is a radiant quest template", () => {
    const bounty = radiantTemplateOf(VillageJobBoard.template("bounty_dead")!);
    expect(bounty).toMatchObject({ kind: "kill", targetId: "RuinGuard", required: 3, name: "The Restless Dead ({place})", objective: "Kill 3 (Ruin Guard)", fameReward: 5 });
    const supply = radiantTemplateOf(VillageJobBoard.template("supply_iron")!);
    expect(supply).toMatchObject({ kind: "deliver", targetId: "iron_ingot", objective: "Bring 4 × iron ingot" });
  });

  it("supply runs take the goods and pay on the spot; short deliveries take nothing", () => {
    const id = boardOffering("supply_iron");
    board.ask(id, "Camcross", ctx({}));
    const bag = { iron_ingot: 3 };
    const short = board.ask(id, "Camcross", ctx(bag));
    expect(short.type).toBe("progress");
    expect(bag.iron_ingot).toBe(3);
    bag.iron_ingot = 5;
    const done = board.ask(id, "Camcross", ctx(bag));
    expect(done.type).toBe("completed");
    expect(bag.iron_ingot).toBe(1);
  });

  it("finishing a job rolls the next offer from the jobs-done count", () => {
    const id = boardOffering("supply_leather");
    board.ask(id, "X", ctx({}));
    board.ask(id, "X", ctx({ leather_strips: 6 }));
    expect(board.completedAt(id)).toBe(1);
    // The offer after one completion is the same on every board instance.
    const other = new VillageJobBoard();
    other.restoreFromSave(board.getSaveState());
    expect(other.offerFor(id, 1)).toEqual(board.offerFor(id, 1));
  });

  it("view / accept / handIn / decline drive the job board window", () => {
    const id = boardOffering("supply_potions");
    const offer = board.view(id, "Camcross", ctx({}));
    expect(offer.job).toBeNull();
    expect(offer.template.id).toBe("supply_potions");
    expect(offer.description).toContain("Camcross");
    board.accept(id, "Camcross", 1);
    const bag = { potion_hp_01: 2 };
    let v = board.view(id, "Camcross", ctx(bag));
    expect(v.progress).toBe(2);
    expect(v.canHandIn).toBe(false);
    expect(board.handIn(id, ctx(bag))).toBeNull();
    bag.potion_hp_01 = 3;
    v = board.view(id, "Camcross", ctx(bag));
    expect(v.canHandIn).toBe(true);
    expect(board.handIn(id, ctx(bag))?.rewardGold).toBe(90);
    expect(bag.potion_hp_01).toBe(0);
  });

  it("declining or abandoning moves the board on to a different job", () => {
    const id = boardOffering("bounty_bandits");
    board.accept(id, "X", 1);
    board.decline(id);
    expect(board.activeAt(id)).toBeUndefined();
    // Over a few declines the offer must change at least once.
    const seen = new Set<string>([board.offerFor(id, 1).id]);
    for (let i = 0; i < 5; i++) { board.decline(id); seen.add(board.offerFor(id, 1).id); }
    expect(seen.size).toBeGreaterThan(1);
    const copy = new VillageJobBoard();
    copy.restoreFromSave(board.getSaveState());
    expect(copy.offerFor(id, 1)).toEqual(board.offerFor(id, 1));
  });

  it("round-trips through its save state and drops unknown templates", () => {
    const id = boardOffering("bounty_dead");
    board.ask(id, "Ashford", ctx({}));
    board.progress = () => 1; // one kill so far (the quest engine's count in the game)
    const saved = board.getSaveState();
    saved.active.push({ boardId: "ghost", placeName: "?", templateId: "nope", progress: 0 });
    const copy = new VillageJobBoard();
    copy.restoreFromSave(saved);
    expect(copy.activeAt(id)?.progress).toBe(1);
    expect(copy.activeAt("ghost")).toBeUndefined();
  });

  it("clearances: offered near a camp, name it and its direction; the camp's clearing completes the hunt", () => {
    const id = boardOffering("clear_camp", 1, true);
    const camp = { id: "site_bandit-camp_5_6", name: "Ravenwick Bandit Camp", direction: "north-east" };
    const c = { ...ctx({}), campNear: () => camp };
    const view = board.view(id, "Millbrook", c);
    expect(view.template.id).toBe("clear_camp");
    expect(view.description).toContain("Ravenwick Bandit Camp, north-east of Millbrook");
    const job = board.accept(id, "Millbrook", 1, camp);
    expect(job.camp).toEqual(camp);
    expect(board.view(id, "Millbrook", { ...ctx({}), campNear: () => null }).description, "the job keeps its camp").toContain("Ravenwick");

    const engine = new QuestGraphEngine();
    engine.registerRadiantTemplate(radiantTemplateOf(VillageJobBoard.template("clear_camp")!));
    engine.startRadiant("clear_camp", "job_x", { place: "Millbrook", camp: camp.name, landmark: camp.id });
    expect(engine.getQuestState("job_x")?.nodes.hunt).toBeDefined();
    board.progress = () => engine.getQuestState("job_x")?.nodes.hunt?.progress ?? 0;
    engine.applyEvent({ type: "custom", targetId: "cleared:site_other_1_1" });
    expect(board.handIn(id, c), "another camp: not this job").toBeNull();
    engine.applyEvent({ type: "custom", targetId: `cleared:${camp.id}` });
    expect(engine.getQuestDefinition("job_x")?.nodes[0].description).toBe("Clear Ravenwick Bandit Camp");
    expect(board.handIn(id, c)?.rewardGold).toBe(220);
  });

  it("saves and restores a clearance's camp", () => {
    const id = boardOffering("clear_camp", 1, true);
    board.accept(id, "Millbrook", 1, { id: "c1", name: "Thornfell Bandit Camp", direction: "west" });
    const b2 = new VillageJobBoard();
    b2.restoreFromSave(JSON.parse(JSON.stringify(board.getSaveState())));
    expect(b2.activeAt(id)?.camp).toEqual({ id: "c1", name: "Thornfell Bandit Camp", direction: "west" });
  });
});
