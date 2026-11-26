import { describe, expect, it } from "vitest";
import { QuestGraphEngine } from "./quest-graph-engine";
import { defendEvent, deliverEvent, radiantDefinition, reportEvent, type RadiantTemplate } from "./radiant";

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

  it("defend quests: the count and rewards come from the instance (a raid's size)", () => {
    const RAID: RadiantTemplate = {
      id: "raid", kind: "defend", name: "Raid on {place}", description: "", objective: "Drive off the raiders ({required})",
      targetId: "", required: 2, rewardGold: 35, xpReward: 25, fameReward: 10, perCount: true,
    };
    const def = radiantDefinition(RAID, "raid_1", { place: "Ashford", required: "4" });
    expect(def.nodes[0]).toMatchObject({ description: "Drive off the raiders (4)", requiredCount: 4, targetId: defendEvent("raid_1") });
    expect([def.rewardGold, def.xpReward]).toEqual([140, 100]);
    expect(radiantDefinition(RAID, "raid_2", {}).nodes[0].requiredCount, "the template's count otherwise").toBe(2);

    const e = new QuestGraphEngine();
    e.registerRadiantTemplate(RAID);
    e.startRadiant("raid", "raid_1", { place: "Ashford", required: "2" });
    e.applyEvent({ type: "custom", targetId: defendEvent("raid_1") });
    const copy = new QuestGraphEngine();
    copy.registerRadiantTemplate(RAID);
    copy.restoreSnapshot(e.getSnapshot());
    expect(copy.getQuestState("raid_1")!.nodes.defend.progress, "the size survives a save").toBe(1);
    expect(copy.applyEvent({ type: "custom", targetId: defendEvent("raid_1") })[0].questCompleted).toBe(true);
  });
});
