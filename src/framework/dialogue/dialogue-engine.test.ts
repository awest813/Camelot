import { describe, it, expect, vi } from "vitest";
import { DialogueEngine } from "./dialogue-engine";
import { DialogueContext } from "./dialogue-types";

const makeContext = (): DialogueContext & { flags: Record<string, boolean>; rep: number } => {
  const state = {
    flags: { accepted: false },
    rep: 0,
    questStatus: "active" as const,
    invCount: 0,
    emitEvent: vi.fn(),
  };

  return {
    flags: state.flags,
    rep: state.rep,
    getFlag: (flag) => Boolean(state.flags[flag]),
    setFlag: (flag, value) => {
      state.flags[flag] = value;
    },
    getFactionReputation: () => state.rep,
    adjustFactionReputation: (_factionId, amount) => {
      state.rep += amount;
    },
    getQuestStatus: () => state.questStatus,
    getInventoryCount: () => state.invCount,
    emitEvent: state.emitEvent,
  };
};

describe("DialogueEngine", () => {
  it("evaluates conditions and applies effects while traversing nodes", () => {
    const engine = new DialogueEngine([
      {
        id: "intro",
        startNodeId: "start",
        nodes: [
          {
            id: "start",
            speaker: "Guard",
            text: "Need something?",
            choices: [
              {
                id: "locked",
                text: "Special option",
                conditions: [{ type: "faction_min", factionId: "guard", min: 10 }],
                nextNodeId: "end",
              },
              {
                id: "accept",
                text: "I can help.",
                effects: [
                  { type: "set_flag", flag: "accepted", value: true },
                  { type: "faction_delta", factionId: "guard", amount: 5 },
                  { type: "emit_event", eventId: "quest:talk:Guard" },
                ],
                nextNodeId: "end",
              },
            ],
          },
          {
            id: "end",
            speaker: "Guard",
            text: "Good. Return when done.",
            choices: [{ id: "bye", text: "Bye", endsDialogue: true }],
          },
        ],
      },
    ]);

    const ctx = makeContext();
    const session = engine.createSession("intro", ctx);
    const startNode = session.getCurrentNode();
    expect(startNode?.choices.find((choice) => choice.id === "locked")?.isAvailable).toBe(false);

    const accepted = session.choose("accept");
    expect(accepted.success).toBe(true);
    expect(ctx.getFlag("accepted")).toBe(true);
    expect(ctx.getFactionReputation("guard")).toBe(5);

    const done = session.choose("bye");
    expect(done.success).toBe(true);
    expect(done.isComplete).toBe(true);
  });

  it("rejects unavailable choices", () => {
    const engine = new DialogueEngine([
      {
        id: "intro",
        startNodeId: "start",
        nodes: [
          {
            id: "start",
            speaker: "Guard",
            text: "No entry.",
            choices: [
              {
                id: "guarded",
                text: "Pass through.",
                conditions: [{ type: "flag", flag: "gate_open", equals: true }],
                endsDialogue: true,
              },
            ],
          },
        ],
      },
    ]);

    const session = engine.createSession("intro", makeContext());
    const result = session.choose("guarded");
    expect(result.success).toBe(false);
    expect(result.message).toContain("blocked");
  });
});
