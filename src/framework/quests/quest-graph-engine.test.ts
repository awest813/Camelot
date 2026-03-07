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

  describe("validateGraph", () => {
    it("reports valid for a well-formed linear quest", () => {
      const engine = new QuestGraphEngine([
        {
          id: "q_valid",
          name: "Valid Quest",
          startNodeIds: ["step_a"],
          completionNodeIds: ["step_b"],
          nodes: [
            {
              id: "step_a",
              description: "Step A",
              triggerType: "talk",
              targetId: "npc_a",
              requiredCount: 1,
              nextNodeIds: ["step_b"],
            },
            {
              id: "step_b",
              description: "Step B",
              triggerType: "kill",
              targetId: "enemy_b",
              requiredCount: 1,
            },
          ],
        },
      ]);

      const report = engine.validateGraph("q_valid");
      expect(report.valid).toBe(true);
      expect(report.issues).toHaveLength(0);
    });

    it("detects a dead-end node that is not a completion node", () => {
      const engine = new QuestGraphEngine([
        {
          id: "q_dead_end",
          name: "Dead End",
          startNodeIds: ["step_a"],
          completionNodeIds: ["step_b"],
          nodes: [
            {
              id: "step_a",
              description: "Step A",
              triggerType: "talk",
              targetId: "npc_a",
              requiredCount: 1,
              nextNodeIds: ["step_b"],
            },
            {
              id: "step_b",
              description: "Step B — completion",
              triggerType: "kill",
              targetId: "enemy",
              requiredCount: 1,
            },
            {
              id: "step_orphan",
              description: "Orphan with no successor",
              triggerType: "custom",
              targetId: "orphan",
              requiredCount: 1,
              prerequisites: ["step_a"],
            },
          ],
        },
      ]);

      const report = engine.validateGraph("q_dead_end");
      expect(report.valid).toBe(false);
      const deadEnd = report.issues.find((i) => i.type === "dead_end" && i.nodeId === "step_orphan");
      expect(deadEnd).toBeDefined();
    });

    it("detects unreachable nodes", () => {
      const engine = new QuestGraphEngine([
        {
          id: "q_unreachable",
          name: "Unreachable",
          startNodeIds: ["step_a"],
          nodes: [
            {
              id: "step_a",
              description: "Step A",
              triggerType: "talk",
              targetId: "npc",
              requiredCount: 1,
            },
            {
              id: "step_island",
              description: "Disconnected island",
              triggerType: "kill",
              targetId: "enemy",
              requiredCount: 1,
            },
          ],
        },
      ]);

      const report = engine.validateGraph("q_unreachable");
      expect(report.valid).toBe(false);
      const unreachable = report.issues.find((i) => i.type === "unreachable" && i.nodeId === "step_island");
      expect(unreachable).toBeDefined();
    });

    it("detects dependency cycles", () => {
      const engine = new QuestGraphEngine([
        {
          id: "q_cycle",
          name: "Cyclic Quest",
          startNodeIds: ["step_a"],
          nodes: [
            {
              id: "step_a",
              description: "Step A",
              triggerType: "talk",
              targetId: "npc",
              requiredCount: 1,
              nextNodeIds: ["step_b"],
            },
            {
              id: "step_b",
              description: "Step B",
              triggerType: "kill",
              targetId: "enemy",
              requiredCount: 1,
              nextNodeIds: ["step_a"],
            },
          ],
        },
      ]);

      const report = engine.validateGraph("q_cycle");
      expect(report.valid).toBe(false);
      const cycle = report.issues.find((i) => i.type === "cycle");
      expect(cycle).toBeDefined();
    });

    it("returns an invalid report for an unregistered quest", () => {
      const engine = new QuestGraphEngine();
      const report = engine.validateGraph("q_missing");
      expect(report.valid).toBe(false);
      expect(report.questId).toBe("q_missing");
      expect(report.issues[0].type).toBe("not_found");
    });
  });
});
