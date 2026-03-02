import { describe, it, expect } from "vitest";
import { QuestGraphEngine } from "./quest-graph-engine";

describe("QuestGraphEngine", () => {
  it("progresses nodes in sequence and completes quest", () => {
    const engine = new QuestGraphEngine([
      {
        id: "q_guard",
        name: "Guard Duty",
        xpReward: 100,
        startNodeIds: ["talk_guard"],
        nodes: [
          {
            id: "talk_guard",
            description: "Talk to guard",
            triggerType: "talk",
            targetId: "Guard",
            requiredCount: 1,
            nextNodeIds: ["kill_bandit"],
          },
          {
            id: "kill_bandit",
            description: "Kill bandit",
            triggerType: "kill",
            targetId: "Bandit",
            requiredCount: 1,
          },
        ],
      },
    ]);

    expect(engine.activateQuest("q_guard")).toBe(true);

    const talkUpdate = engine.applyEvent({ type: "talk", targetId: "Guard" });
    expect(talkUpdate).toHaveLength(1);
    expect(talkUpdate[0].completedNodeIds).toContain("talk_guard");
    expect(talkUpdate[0].activatedNodeIds).toContain("kill_bandit");
    expect(talkUpdate[0].questCompleted).toBe(false);

    const killUpdate = engine.applyEvent({ type: "kill", targetId: "Bandit" });
    expect(killUpdate[0].questCompleted).toBe(true);
    expect(killUpdate[0].xpReward).toBe(100);
    expect(engine.getQuestStatus("q_guard")).toBe("completed");
  });

  it("restores quest snapshots", () => {
    const engine = new QuestGraphEngine([
      {
        id: "q_fetch",
        name: "Fetch",
        nodes: [
          {
            id: "fetch_potion",
            description: "Fetch potion",
            triggerType: "pickup",
            targetId: "potion",
            requiredCount: 2,
          },
        ],
      },
    ]);
    engine.activateQuest("q_fetch");
    engine.applyEvent({ type: "pickup", targetId: "potion" });
    const snapshot = engine.getSnapshot();

    const restored = new QuestGraphEngine([
      {
        id: "q_fetch",
        name: "Fetch",
        nodes: [
          {
            id: "fetch_potion",
            description: "Fetch potion",
            triggerType: "pickup",
            targetId: "potion",
            requiredCount: 2,
          },
        ],
      },
    ]);
    restored.restoreSnapshot(snapshot);

    expect(restored.getQuestState("q_fetch")?.nodes.fetch_potion.progress).toBe(1);
    expect(restored.getQuestStatus("q_fetch")).toBe("active");
  });
});
