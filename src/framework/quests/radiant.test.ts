import { describe, expect, it } from "vitest";
import { QuestGraphEngine } from "./quest-graph-engine";
import { deliverEvent, radiantDefinition, reportEvent, type RadiantTemplate } from "./radiant";

const BANDITS: RadiantTemplate = {
  id: "bounty_bandits", kind: "kill", name: "Bandit Trouble ({place})",
  description: "Bandits near {place}. Kill three.", objective: "Kill 3 bandits",
  report: "Return to {place} for your pay", targetId: "Bandit", required: 3, rewardGold: 120, xpReward: 60, fameReward: 5,
};
const IRON: RadiantTemplate = {
  id: "supply_iron", kind: "deliver", name: "Iron for the Forge ({place})",
  description: "Bring four ingots.", objective: "Bring 4 Iron Ingots", targetId: "iron_ingot", required: 4, rewardGold: 70,
};

function engine() {
  const e = new QuestGraphEngine();
  e.registerRadiantTemplate(BANDITS);
  e.registerRadiantTemplate(IRON);
  return e;
}

describe("radiant quests", () => {
  it("an instance is a real quest: filled text, rewards, kill then report back", () => {
    const def = radiantDefinition(BANDITS, "job_inn_1", { place: "Ashford" });
    expect(def.name).toBe("Bandit Trouble (Ashford)");
    expect(def.nodes.map((n) => n.description)).toEqual(["Kill 3 bandits", "Return to Ashford for your pay"]);
    expect([def.rewardGold, def.xpReward, def.fameReward]).toEqual([120, 60, 5]);

    const e = engine();
    expect(e.startRadiant("bounty_bandits", "job_inn_1", { place: "Ashford" })).toBe(true);
    expect(e.startRadiant("bounty_bandits", "job_inn_1", { place: "Ashford" }), "not twice").toBe(false);
    expect(e.getQuestStatus("job_inn_1")).toBe("active");
    const r1 = e.applyEvent({ type: "kill", targetId: "Bandit", amount: 2 });
    expect(r1[0].progressed).toEqual([{ nodeId: "hunt", progress: 2, required: 3 }]);
    e.applyEvent({ type: "kill", targetId: "Bandit" });
    expect(e.getQuestState("job_inn_1")!.nodes.report.active).toBe(true);
    expect(e.getQuestStatus("job_inn_1"), "not paid until reported").toBe("active");
    const done = e.applyEvent({ type: "custom", targetId: reportEvent("job_inn_1") });
    expect(done[0].questCompleted).toBe(true);
  });

  it("deliver quests complete on their delivery event; abandoned ones are removed", () => {
    const e = engine();
    e.startRadiant("supply_iron", "job_inn_2", { place: "Brook" });
    expect(e.applyEvent({ type: "custom", targetId: deliverEvent("job_inn_2"), amount: 4 })[0].questCompleted).toBe(true);
    e.startRadiant("supply_iron", "job_inn_3", { place: "Brook" });
    expect(e.removeQuest("job_inn_3")).toBe(true);
    expect(e.getQuestDefinition("job_inn_3")).toBeUndefined();
    expect(e.getSnapshot().radiant).not.toHaveProperty("job_inn_3");
  });

  it("an event can go to one quest only", () => {
    const e = engine();
    e.startRadiant("bounty_bandits", "a", { place: "A" });
    e.startRadiant("bounty_bandits", "b", { place: "B" });
    e.applyEvent({ type: "kill", targetId: "Bandit", amount: 2 }, "a");
    expect(e.getQuestState("a")!.nodes.hunt.progress).toBe(2);
    expect(e.getQuestState("b")!.nodes.hunt.progress).toBe(0);
  });

  it("saves and restores: instances are rebuilt from their template and vars, then their state", () => {
    const e = engine();
    e.startRadiant("bounty_bandits", "job_inn_1", { place: "Ashford" });
    e.applyEvent({ type: "kill", targetId: "Bandit", amount: 2 });
    const snap = JSON.parse(JSON.stringify(e.getSnapshot()));
    expect(snap.radiant.job_inn_1).toEqual({ templateId: "bounty_bandits", vars: { place: "Ashford" } });

    const loaded = engine();
    loaded.restoreSnapshot(snap);
    expect(loaded.getQuestDefinition("job_inn_1")!.name).toBe("Bandit Trouble (Ashford)");
    expect(loaded.getQuestState("job_inn_1")!.nodes.hunt.progress).toBe(2);
    expect(loaded.getRadiantInstance("job_inn_1")).toEqual({ templateId: "bounty_bandits", vars: { place: "Ashford" } });
  });
});
