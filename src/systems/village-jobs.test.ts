import { describe, it, expect, beforeEach } from "vitest";
import { VillageJobBoard, JOB_TEMPLATES, type JobContext } from "./village-jobs";

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
function boardOffering(templateId: string, level = 1): string {
  const b = new VillageJobBoard();
  for (let i = 0; i < 2000; i++) {
    if (b.offerFor(`board_${i}`, level).id === templateId) return `board_${i}`;
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
    expect(offered.size).toBe(JOB_TEMPLATES.length);
  });

  it("asking first accepts the job, with the place named", () => {
    const id = boardOffering("bounty_bandits");
    const r = board.ask(id, "Camcross", ctx({}));
    expect(r.type).toBe("accepted");
    expect(r.text).toContain("Camcross");
    expect(board.activeAt(id)?.templateId).toBe("bounty_bandits");
  });

  it("bounties count matching kills, then pay out when you return", () => {
    const id = boardOffering("bounty_bandits");
    board.ask(id, "Camcross", ctx({}));
    let progressed = 0;
    board.onProgress = () => { progressed++; };
    board.onKill("Bandit_123");
    board.onKill("Wolf_9");            // ignored
    board.onKill("Bandit Chief_44");   // prefix match
    expect(board.ask(id, "Camcross", ctx({})).type).toBe("progress");
    board.onKill("Bandit Archer_7");
    board.onKill("Bandit_8");          // beyond the requirement: not counted
    expect(progressed).toBe(3);
    const done = board.ask(id, "Camcross", ctx({}));
    expect(done.type).toBe("completed");
    if (done.type === "completed") expect(done.rewardGold).toBe(120);
    expect(board.activeAt(id)).toBeUndefined();
    expect(board.completedAt(id)).toBe(1);
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

  it("round-trips through its save state and drops unknown templates", () => {
    const id = boardOffering("bounty_dead");
    board.ask(id, "Ashford", ctx({}));
    board.onKill("RuinGuard_1_2");
    const saved = board.getSaveState();
    saved.active.push({ boardId: "ghost", placeName: "?", templateId: "nope", progress: 0 });
    const copy = new VillageJobBoard();
    copy.restoreFromSave(saved);
    expect(copy.activeAt(id)?.progress).toBe(1);
    expect(copy.activeAt("ghost")).toBeUndefined();
  });
});
