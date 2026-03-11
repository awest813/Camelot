import { describe, it, expect, beforeEach } from "vitest";
import { DialogueCreatorSystem } from "./dialogue-creator-system";

describe("DialogueCreatorSystem", () => {
  let sys: DialogueCreatorSystem;

  beforeEach(() => {
    sys = new DialogueCreatorSystem();
  });

  // ── Meta ──────────────────────────────────────────────────────────────────

  describe("setMeta", () => {
    it("trims and sets id and startNodeId", () => {
      sys.setMeta("  dlg_test  ", "  node_1  ");
      expect(sys.draft.id).toBe("dlg_test");
      expect(sys.draft.startNodeId).toBe("node_1");
    });
  });

  // ── addNode ───────────────────────────────────────────────────────────────

  describe("addNode", () => {
    it("returns a generated id when none supplied", () => {
      const id = sys.addNode();
      expect(id).toMatch(/^node_\d+$/);
    });

    it("uses a supplied id", () => {
      const id = sys.addNode({ id: "intro" });
      expect(id).toBe("intro");
    });

    it("auto-assigns startNodeId to first node", () => {
      const id = sys.addNode();
      expect(sys.draft.startNodeId).toBe(id);
    });

    it("does NOT overwrite existing startNodeId", () => {
      sys.setMeta("dlg", "existing_start");
      const id = sys.addNode();
      expect(sys.draft.startNodeId).toBe("existing_start");
      expect(id).not.toBe("existing_start");
    });

    it("defaults speaker to NPC", () => {
      const id = sys.addNode();
      const node = sys.nodes.find(n => n.id === id)!;
      expect(node.speaker).toBe("NPC");
    });

    it("applies partial overrides", () => {
      const id = sys.addNode({ speaker: "Guard", text: "Halt!", terminal: true });
      const node = sys.nodes.find(n => n.id === id)!;
      expect(node.speaker).toBe("Guard");
      expect(node.text).toBe("Halt!");
      expect(node.terminal).toBe(true);
    });
  });

  // ── updateNode ────────────────────────────────────────────────────────────

  describe("updateNode", () => {
    it("updates fields on an existing node", () => {
      const id = sys.addNode({ speaker: "NPC", text: "Hello" });
      sys.updateNode(id, { speaker: "Innkeeper", text: "Welcome!" });
      const node = sys.nodes.find(n => n.id === id)!;
      expect(node.speaker).toBe("Innkeeper");
      expect(node.text).toBe("Welcome!");
    });

    it("returns false for unknown nodeId", () => {
      expect(sys.updateNode("ghost_node", { text: "boo" })).toBe(false);
    });
  });

  // ── removeNode ────────────────────────────────────────────────────────────

  describe("removeNode", () => {
    it("removes the node", () => {
      const id = sys.addNode();
      expect(sys.nodes.length).toBe(1);
      sys.removeNode(id);
      expect(sys.nodes.length).toBe(0);
    });

    it("returns false for unknown nodeId", () => {
      expect(sys.removeNode("ghost")).toBe(false);
    });

    it("clears startNodeId when start is removed", () => {
      const id = sys.addNode();
      sys.setMeta("dlg", id);
      sys.removeNode(id);
      expect(sys.draft.startNodeId).toBe("");
    });

    it("prunes nextNodeId references in other nodes' choices", () => {
      const a = sys.addNode();
      const b = sys.addNode();
      sys.addChoice(a, { nextNodeId: b });
      sys.removeNode(b);
      const nodeA = sys.nodes.find(n => n.id === a)!;
      expect(nodeA.choices[0].nextNodeId).toBe("");
    });
  });

  // ── addChoice ─────────────────────────────────────────────────────────────

  describe("addChoice", () => {
    it("adds a choice to an existing node", () => {
      const nodeId = sys.addNode();
      const choiceId = sys.addChoice(nodeId, { text: "Tell me more." });
      expect(choiceId).toBeTruthy();
      const node = sys.nodes.find(n => n.id === nodeId)!;
      expect(node.choices.length).toBe(1);
      expect(node.choices[0].text).toBe("Tell me more.");
    });

    it("returns null for unknown nodeId", () => {
      expect(sys.addChoice("ghost")).toBeNull();
    });
  });

  // ── updateChoice ──────────────────────────────────────────────────────────

  describe("updateChoice", () => {
    it("updates choice fields", () => {
      const nodeId   = sys.addNode();
      const choiceId = sys.addChoice(nodeId)!;
      sys.updateChoice(nodeId, choiceId, { text: "Goodbye.", endsDialogue: true });
      const node = sys.nodes.find(n => n.id === nodeId)!;
      const choice = node.choices[0];
      expect(choice.text).toBe("Goodbye.");
      expect(choice.endsDialogue).toBe(true);
    });

    it("returns false for unknown node", () => {
      expect(sys.updateChoice("ghost", "c1", { text: "x" })).toBe(false);
    });
  });

  // ── removeChoice ──────────────────────────────────────────────────────────

  describe("removeChoice", () => {
    it("removes a choice", () => {
      const nodeId   = sys.addNode();
      const choiceId = sys.addChoice(nodeId)!;
      sys.removeChoice(nodeId, choiceId);
      const node = sys.nodes.find(n => n.id === nodeId)!;
      expect(node.choices.length).toBe(0);
    });
  });

  // ── Conditions ────────────────────────────────────────────────────────────

  describe("addCondition / removeCondition", () => {
    it("adds and removes a condition", () => {
      const nodeId   = sys.addNode();
      const choiceId = sys.addChoice(nodeId)!;
      sys.addCondition(nodeId, choiceId, { type: "flag", flag: "met_innkeeper", equals: true });
      const node   = sys.nodes.find(n => n.id === nodeId)!;
      const choice = node.choices[0];
      expect(choice.conditions.length).toBe(1);
      sys.removeCondition(nodeId, choiceId, 0);
      expect(choice.conditions.length).toBe(0);
    });
  });

  // ── Effects ───────────────────────────────────────────────────────────────

  describe("addEffect / removeEffect", () => {
    it("adds and removes an effect", () => {
      const nodeId   = sys.addNode();
      const choiceId = sys.addChoice(nodeId)!;
      sys.addEffect(nodeId, choiceId, { type: "set_flag", flag: "quest_started", value: true });
      const node   = sys.nodes.find(n => n.id === nodeId)!;
      const choice = node.choices[0];
      expect(choice.effects.length).toBe(1);
      sys.removeEffect(nodeId, choiceId, 0);
      expect(choice.effects.length).toBe(0);
    });
  });

  // ── Validation ────────────────────────────────────────────────────────────

  describe("validate", () => {
    it("reports missing_id when id is empty", () => {
      const report = sys.validate();
      const types  = report.issues.map(i => i.type);
      expect(types).toContain("missing_id");
    });

    it("reports missing_start when start node does not exist", () => {
      sys.setMeta("dlg_x", "ghost_start");
      const report = sys.validate();
      expect(report.issues.some(i => i.type === "missing_start")).toBe(true);
    });

    it("reports dangling_ref for a choice referencing a non-existent node", () => {
      const nodeId   = sys.addNode({ text: "Hello" });
      const choiceId = sys.addChoice(nodeId, { text: "Go" })!;
      sys.updateChoice(nodeId, choiceId, { nextNodeId: "nonexistent" });
      sys.setMeta("dlg_x", nodeId);
      const report = sys.validate();
      expect(report.issues.some(i => i.type === "dangling_ref")).toBe(true);
    });

    it("reports unreachable for nodes not reachable from start", () => {
      const a = sys.addNode({ text: "Start" });
      sys.addNode({ text: "Orphan" }); // no connection to it
      sys.setMeta("dlg_x", a);
      const report = sys.validate();
      expect(report.issues.some(i => i.type === "unreachable")).toBe(true);
    });

    it("passes for a minimal valid dialogue", () => {
      const start = sys.addNode({ text: "Welcome, traveller." });
      const end   = sys.addNode({ text: "Farewell.", terminal: true });
      const cId   = sys.addChoice(start, { text: "Goodbye." })!;
      sys.updateChoice(start, cId, { nextNodeId: end });
      sys.setMeta("dlg_valid", start);
      const report = sys.validate();
      expect(report.valid).toBe(true);
    });
  });

  // ── Export / Import ───────────────────────────────────────────────────────

  describe("exportToJson / importFromJson", () => {
    it("round-trips through JSON", () => {
      const id = sys.addNode({ speaker: "Merchant", text: "Buy something?" });
      sys.setMeta("dlg_merchant", id);
      const json   = sys.exportToJson();
      const sys2   = new DialogueCreatorSystem();
      const ok     = sys2.importFromJson(json);
      expect(ok).toBe(true);
      expect(sys2.draft.id).toBe("dlg_merchant");
      expect(sys2.nodes.length).toBe(1);
      expect(sys2.nodes[0].speaker).toBe("Merchant");
    });

    it("returns false for invalid JSON", () => {
      expect(sys.importFromJson("not-json")).toBe(false);
      expect(sys.importFromJson('{"id":123}')).toBe(false);
    });
  });

  // ── Reset ─────────────────────────────────────────────────────────────────

  describe("reset", () => {
    it("clears all state", () => {
      sys.addNode({ text: "Hi" });
      sys.setMeta("dlg_x", "node_1");
      sys.reset();
      expect(sys.draft.id).toBe("");
      expect(sys.nodes.length).toBe(0);
    });
  });
});
