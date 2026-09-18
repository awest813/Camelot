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

  describe("failQuest", () => {
    const makeEngine = () => new QuestGraphEngine([
      {
        id: "q_guard",
        name: "Guard Duty",
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

    it("fails an active quest and marks open nodes failed", () => {
      const engine = makeEngine();
      engine.activateQuest("q_guard");
      expect(engine.failQuest("q_guard")).toBe(true);
      expect(engine.getQuestStatus("q_guard")).toBe("failed");
      const state = engine.getQuestState("q_guard");
      expect(state?.nodes.talk_guard.failed).toBe(true);
      expect(state?.nodes.talk_guard.active).toBe(false);
    });

    it("returns false for inactive, completed, already-failed, or unknown quests", () => {
      const engine = makeEngine();
      expect(engine.failQuest("q_guard")).toBe(false); // inactive
      expect(engine.failQuest("q_missing")).toBe(false); // unknown
      engine.activateQuest("q_guard");
      expect(engine.failQuest("q_guard")).toBe(true);
      expect(engine.failQuest("q_guard")).toBe(false); // already failed
    });

    it("ignores further events once failed and refuses re-activation", () => {
      const engine = makeEngine();
      engine.activateQuest("q_guard");
      engine.failQuest("q_guard");
      expect(engine.applyEvent({ type: "talk", targetId: "Guard" })).toHaveLength(0);
      expect(engine.activateQuest("q_guard")).toBe(false);
      expect(engine.getQuestStatus("q_guard")).toBe("failed");
    });

    it("preserves failure across snapshot restore", () => {
      const engine = makeEngine();
      engine.activateQuest("q_guard");
      engine.failQuest("q_guard");
      const snapshot = engine.getSnapshot();
      const restored = makeEngine();
      restored.restoreSnapshot(snapshot);
      expect(restored.getQuestStatus("q_guard")).toBe("failed");
      expect(restored.getQuestState("q_guard")?.nodes.talk_guard.failed).toBe(true);
    });
  });

  describe("exclusiveGroup (xor-choice branching)", () => {
    const makeEngine = () => new QuestGraphEngine([
      {
        id: "q_choice",
        name: "Spare or Slay",
        xpReward: 50,
        startNodeIds: ["meet"],
        completionNodeIds: ["slay", "spare"],
        nodes: [
          {
            id: "meet",
            description: "Meet the elder",
            triggerType: "talk",
            targetId: "Elder",
            requiredCount: 1,
            nextNodeIds: ["slay", "spare"],
          },
          {
            id: "slay",
            description: "Slay the beast",
            triggerType: "kill",
            targetId: "Beast",
            requiredCount: 1,
            exclusiveGroup: "fate",
          },
          {
            id: "spare",
            description: "Spare the beast",
            triggerType: "custom",
            targetId: "beast_spared",
            requiredCount: 1,
            exclusiveGroup: "fate",
          },
        ],
      },
    ]);

    it("activates both branches, then skips the untaken one", () => {
      const engine = makeEngine();
      engine.activateQuest("q_choice");
      const [first] = engine.applyEvent({ type: "talk", targetId: "Elder" });
      expect(first.activatedNodeIds).toEqual(
        expect.arrayContaining(["slay", "spare"]),
      );
      expect(first.questCompleted).toBe(false);

      const [second] = engine.applyEvent({ type: "custom", targetId: "beast_spared" });
      expect(second.completedNodeIds).toContain("spare");
      expect(second.skippedNodeIds).toContain("slay");
      expect(second.questCompleted).toBe(true);
      expect(second.xpReward).toBe(50);
      expect(engine.getQuestStatus("q_choice")).toBe("completed");

      const state = engine.getQuestState("q_choice");
      expect(state?.nodes.slay.skipped).toBe(true);
      expect(state?.nodes.slay.active).toBe(false);
    });

    it("ignores events for the skipped branch", () => {
      const engine = makeEngine();
      engine.activateQuest("q_choice");
      engine.applyEvent({ type: "talk", targetId: "Elder" });
      engine.applyEvent({ type: "kill", targetId: "Beast" }); // slay taken
      expect(engine.applyEvent({ type: "custom", targetId: "beast_spared" })).toHaveLength(0);
      expect(engine.getQuestStatus("q_choice")).toBe("completed");
    });

    it("nodes without a group never skip each other", () => {
      const engine = new QuestGraphEngine([
        {
          id: "q_plain",
          name: "Plain",
          nodes: [
            { id: "a", description: "A", triggerType: "kill", targetId: "X", requiredCount: 1 },
            { id: "b", description: "B", triggerType: "kill", targetId: "Y", requiredCount: 1 },
          ],
        },
      ]);
      engine.activateQuest("q_plain");
      const [result] = engine.applyEvent({ type: "kill", targetId: "X" });
      expect(result.skippedNodeIds).toHaveLength(0);
      expect(engine.getQuestStatus("q_plain")).toBe("active");
    });
  });
});
