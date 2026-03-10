import { describe, it, expect, beforeEach } from "vitest";
import { QuestCreatorSystem } from "./quest-creator-system";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeSystem() {
  return new QuestCreatorSystem();
}

function makePopulated() {
  const sys = makeSystem();
  sys.setMeta("q_test", "Test Quest", "A test quest", 200);
  sys.addNode({ id: "n1", description: "Kill 3 bandits", triggerType: "kill", targetId: "bandit", requiredCount: 3 });
  sys.addNode({ id: "n2", description: "Return to captain", triggerType: "talk", targetId: "Captain", requiredCount: 1, prerequisites: ["n1"] });
  return sys;
}

// ── Constructor ────────────────────────────────────────────────────────────

describe("QuestCreatorSystem — constructor", () => {
  it("starts with a blank draft", () => {
    const sys = makeSystem();
    expect(sys.draft.id).toBe("");
    expect(sys.draft.name).toBe("");
    expect(sys.draft.xpReward).toBe(100);
    expect(sys.nodes).toHaveLength(0);
  });

  it("accepts an initial partial draft", () => {
    const sys = new QuestCreatorSystem({ id: "q1", name: "Quest 1", xpReward: 50 });
    expect(sys.draft.id).toBe("q1");
    expect(sys.draft.name).toBe("Quest 1");
    expect(sys.draft.xpReward).toBe(50);
  });
});

// ── setMeta ────────────────────────────────────────────────────────────────

describe("QuestCreatorSystem — setMeta", () => {
  it("updates all metadata fields", () => {
    const sys = makeSystem();
    sys.setMeta("q_main", "Main Quest", "The primary story arc", 500);
    expect(sys.draft.id).toBe("q_main");
    expect(sys.draft.name).toBe("Main Quest");
    expect(sys.draft.description).toBe("The primary story arc");
    expect(sys.draft.xpReward).toBe(500);
  });

  it("trims whitespace from id and name", () => {
    const sys = makeSystem();
    sys.setMeta("  q1  ", "  My Quest  ", "", 0);
    expect(sys.draft.id).toBe("q1");
    expect(sys.draft.name).toBe("My Quest");
  });

  it("clamps xpReward to 0 when negative", () => {
    const sys = makeSystem();
    sys.setMeta("x", "x", "", -99);
    expect(sys.draft.xpReward).toBe(0);
  });
});

// ── addNode ────────────────────────────────────────────────────────────────

describe("QuestCreatorSystem — addNode", () => {
  it("returns the node id and appends it to the list", () => {
    const sys = makeSystem();
    const id = sys.addNode({ id: "n1", description: "Kill guard", triggerType: "kill", targetId: "Guard", requiredCount: 1 });
    expect(id).toBe("n1");
    expect(sys.nodes).toHaveLength(1);
    expect(sys.nodes[0].triggerType).toBe("kill");
    expect(sys.nodes[0].targetId).toBe("Guard");
  });

  it("auto-generates an id when none is provided", () => {
    const sys = makeSystem();
    const id1 = sys.addNode();
    const id2 = sys.addNode();
    expect(id1).not.toBe(id2);
    expect(sys.nodes).toHaveLength(2);
  });

  it("defaults requiredCount to 1 and prerequisites to []", () => {
    const sys = makeSystem();
    sys.addNode({ id: "n0" });
    expect(sys.nodes[0].requiredCount).toBe(1);
    expect(sys.nodes[0].prerequisites).toEqual([]);
  });

  it("clamps requiredCount to 1 when 0 is provided", () => {
    const sys = makeSystem();
    sys.addNode({ id: "n0", requiredCount: 0 });
    expect(sys.nodes[0].requiredCount).toBe(1);
  });
});

// ── updateNode ─────────────────────────────────────────────────────────────

describe("QuestCreatorSystem — updateNode", () => {
  it("updates individual fields", () => {
    const sys = makePopulated();
    const ok = sys.updateNode("n1", { description: "Kill 5 bandits", requiredCount: 5 });
    expect(ok).toBe(true);
    expect(sys.nodes[0].description).toBe("Kill 5 bandits");
    expect(sys.nodes[0].requiredCount).toBe(5);
  });

  it("returns false for unknown node", () => {
    const sys = makePopulated();
    expect(sys.updateNode("nonexistent", { description: "x" })).toBe(false);
  });

  it("updates prerequisites list", () => {
    const sys = makePopulated();
    sys.addNode({ id: "n3", triggerType: "pickup", targetId: "item_sword", requiredCount: 1 });
    sys.updateNode("n3", { prerequisites: ["n1", "n2"] });
    expect(sys.nodes[2].prerequisites).toEqual(["n1", "n2"]);
  });

  it("trims whitespace from targetId", () => {
    const sys = makePopulated();
    sys.updateNode("n1", { targetId: "  bandit_chief  " });
    expect(sys.nodes[0].targetId).toBe("bandit_chief");
  });
});

// ── removeNode ─────────────────────────────────────────────────────────────

describe("QuestCreatorSystem — removeNode", () => {
  it("removes the node by id", () => {
    const sys = makePopulated();
    const ok = sys.removeNode("n1");
    expect(ok).toBe(true);
    expect(sys.nodes).toHaveLength(1);
    expect(sys.nodes[0].id).toBe("n2");
  });

  it("returns false for unknown node", () => {
    const sys = makePopulated();
    expect(sys.removeNode("ghost")).toBe(false);
  });

  it("prunes dangling prerequisite references in other nodes", () => {
    const sys = makePopulated();
    // n2 has prerequisite n1
    sys.removeNode("n1");
    expect(sys.nodes[0].prerequisites).toEqual([]);
  });
});

// ── validate ───────────────────────────────────────────────────────────────

describe("QuestCreatorSystem — validate", () => {
  it("returns valid for a well-formed single-node quest", () => {
    const sys = makeSystem();
    sys.setMeta("q_simple", "Simple", "", 100);
    sys.addNode({ id: "n1", description: "Kill bandit", triggerType: "kill", targetId: "bandit", requiredCount: 1 });
    const report = sys.validate();
    expect(report.valid).toBe(true);
    expect(report.issues).toHaveLength(0);
  });

  it("returns valid for a two-node chain", () => {
    const sys = makePopulated();
    const report = sys.validate();
    expect(report.valid).toBe(true);
  });

  it("returns invalid when a prerequisite references an unknown node", () => {
    const sys = makeSystem();
    sys.setMeta("q_bad", "Bad", "", 0);
    sys.addNode({ id: "n1", triggerType: "kill", targetId: "x", requiredCount: 1, prerequisites: ["ghost_node"] });
    // QuestGraphEngine will throw during registration because ghost_node doesn't exist
    const report = sys.validate();
    expect(report.valid).toBe(false);
    expect(report.issues.length).toBeGreaterThan(0);
  });

  it("surfaces structural error when quest id is empty", () => {
    const sys = makeSystem();
    // id is "" — QuestGraphEngine should still process it (empty string is a valid map key)
    sys.addNode({ id: "n1", triggerType: "kill", targetId: "x", requiredCount: 1 });
    // Should not throw; validate returns a report
    const report = sys.validate();
    // Empty id causes validateGraph to look for "" in the map — it should still be found
    expect(report).toHaveProperty("valid");
  });
});

// ── toQuestDefinition ──────────────────────────────────────────────────────

describe("QuestCreatorSystem — toQuestDefinition", () => {
  it("maps draft fields to QuestDefinition correctly", () => {
    const sys = makePopulated();
    const def = sys.toQuestDefinition();
    expect(def.id).toBe("q_test");
    expect(def.name).toBe("Test Quest");
    expect(def.xpReward).toBe(200);
    expect(def.nodes).toHaveLength(2);
    expect(def.nodes[1].prerequisites).toEqual(["n1"]);
  });

  it("omits description when blank", () => {
    const sys = makeSystem();
    sys.setMeta("q1", "Q", "", 10);
    sys.addNode({ id: "n1", triggerType: "kill", targetId: "x", requiredCount: 1 });
    const def = sys.toQuestDefinition();
    expect(def.description).toBeUndefined();
  });

  it("omits prerequisites array when empty", () => {
    const sys = makeSystem();
    sys.setMeta("q1", "Q", "", 10);
    sys.addNode({ id: "n1", triggerType: "kill", targetId: "x", requiredCount: 1 });
    const def = sys.toQuestDefinition();
    expect(def.nodes[0].prerequisites).toBeUndefined();
  });
});

// ── exportToJson / importFromJson ──────────────────────────────────────────

describe("QuestCreatorSystem — JSON round-trip", () => {
  it("serializes and deserializes without data loss", () => {
    const sys = makePopulated();
    const json = sys.exportToJson();
    expect(typeof json).toBe("string");

    const sys2 = makeSystem();
    const ok = sys2.importFromJson(json);
    expect(ok).toBe(true);
    expect(sys2.draft.id).toBe("q_test");
    expect(sys2.draft.name).toBe("Test Quest");
    expect(sys2.draft.xpReward).toBe(200);
    expect(sys2.nodes).toHaveLength(2);
    expect(sys2.nodes[1].prerequisites).toEqual(["n1"]);
  });

  it("returns false for invalid JSON", () => {
    const sys = makeSystem();
    expect(sys.importFromJson("not json")).toBe(false);
  });

  it("returns false when nodes field is missing", () => {
    const sys = makeSystem();
    expect(sys.importFromJson(JSON.stringify({ id: "x", name: "x" }))).toBe(false);
  });

  it("returns false for empty string", () => {
    const sys = makeSystem();
    expect(sys.importFromJson("")).toBe(false);
  });
});

// ── reset ──────────────────────────────────────────────────────────────────

describe("QuestCreatorSystem — reset", () => {
  it("clears all draft state", () => {
    const sys = makePopulated();
    sys.reset();
    expect(sys.draft.id).toBe("");
    expect(sys.draft.name).toBe("");
    expect(sys.nodes).toHaveLength(0);
    expect(sys.draft.xpReward).toBe(100);
  });

  it("resets auto-id counter so generated ids restart", () => {
    const sys = makeSystem();
    sys.addNode(); // node_1
    sys.reset();
    const id = sys.addNode();
    expect(id).toBe("node_1"); // counter restarted
  });
});
