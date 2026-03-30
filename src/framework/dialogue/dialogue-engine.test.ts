import { describe, it, expect, vi } from "vitest";
import { DialogueEngine } from "./dialogue-engine";
import { DialogueContext } from "./dialogue-types";

const makeContext = (overrides?: Partial<{
  flags: Record<string, boolean>;
  rep: number;
  invCount: number;
  skillLevel: number;
  activatedQuests: string[];
  consumedItems: Array<{ itemId: string; quantity: number }>;
  givenItems: Array<{ itemId: string; quantity: number }>;
}>): DialogueContext & { flags: Record<string, boolean>; rep: number } => {
  const state = {
    flags: { accepted: false, ...(overrides?.flags ?? {}) },
    rep: overrides?.rep ?? 0,
    questStatus: "active" as const,
    invCount: overrides?.invCount ?? 0,
    skillLevel: overrides?.skillLevel ?? 0,
    activatedQuests: overrides?.activatedQuests ?? [],
    consumedItems: overrides?.consumedItems ?? [],
    givenItems: overrides?.givenItems ?? [],
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
    getSkillLevel: () => state.skillLevel,
    activateQuest: (questId) => { state.activatedQuests.push(questId); },
    consumeItem: (itemId, quantity) => {
      state.consumedItems.push({ itemId, quantity });
      return true;
    },
    giveItem: (itemId, quantity) => { state.givenItems.push({ itemId, quantity }); },
    _state: state,
  } as unknown as DialogueContext & { flags: Record<string, boolean>; rep: number };
};

describe("DialogueEngine", () => {
  it("hasDialogue returns whether an id is registered", () => {
    const engine = new DialogueEngine([
      { id: "a", startNodeId: "n1", nodes: [{ id: "n1", speaker: "X", text: "Hi", choices: [] }] },
    ]);
    expect(engine.hasDialogue("a")).toBe(true);
    expect(engine.hasDialogue("missing")).toBe(false);
  });

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

  it("blocks a choice when skill_min condition is not met", () => {
    const engine = new DialogueEngine([
      {
        id: "skill_check",
        startNodeId: "start",
        nodes: [
          {
            id: "start",
            speaker: "Sage",
            text: "Can you decipher this rune?",
            choices: [
              {
                id: "try_rune",
                text: "Let me try.",
                conditions: [{ type: "skill_min", skillId: "arcana", min: 3 }],
                endsDialogue: true,
              },
              {
                id: "decline",
                text: "Not today.",
                endsDialogue: true,
              },
            ],
          },
        ],
      },
    ]);

    const ctx = makeContext({ skillLevel: 1 });
    const session = engine.createSession("skill_check", ctx);
    const node = session.getCurrentNode();
    expect(node?.choices.find((c) => c.id === "try_rune")?.isAvailable).toBe(false);
    expect(node?.choices.find((c) => c.id === "decline")?.isAvailable).toBe(true);
  });

  it("allows a choice when skill_min condition is met", () => {
    const engine = new DialogueEngine([
      {
        id: "skill_check",
        startNodeId: "start",
        nodes: [
          {
            id: "start",
            speaker: "Sage",
            text: "Can you decipher this rune?",
            choices: [
              {
                id: "try_rune",
                text: "Let me try.",
                conditions: [{ type: "skill_min", skillId: "arcana", min: 3 }],
                endsDialogue: true,
              },
            ],
          },
        ],
      },
    ]);

    const ctx = makeContext({ skillLevel: 5 });
    const session = engine.createSession("skill_check", ctx);
    const result = session.choose("try_rune");
    expect(result.success).toBe(true);
  });

  it("activate_quest effect calls activateQuest on context", () => {
    const engine = new DialogueEngine([
      {
        id: "quest_start",
        startNodeId: "start",
        nodes: [
          {
            id: "start",
            speaker: "Elder",
            text: "I have a task for you.",
            choices: [
              {
                id: "accept",
                text: "I accept.",
                effects: [{ type: "activate_quest", questId: "q_elder_task" }],
                endsDialogue: true,
              },
            ],
          },
        ],
      },
    ]);

    const ctx = makeContext();
    const session = engine.createSession("quest_start", ctx);
    session.choose("accept");

    const state = (ctx as unknown as { _state: { activatedQuests: string[] } })._state;
    expect(state.activatedQuests).toContain("q_elder_task");
  });

  it("consume_item effect calls consumeItem on context", () => {
    const engine = new DialogueEngine([
      {
        id: "trade",
        startNodeId: "start",
        nodes: [
          {
            id: "start",
            speaker: "Merchant",
            text: "That'll cost you a gem.",
            choices: [
              {
                id: "pay",
                text: "Here you go.",
                conditions: [{ type: "has_item", itemId: "gem", minQuantity: 1 }],
                effects: [{ type: "consume_item", itemId: "gem", quantity: 1 }],
                endsDialogue: true,
              },
            ],
          },
        ],
      },
    ]);

    const ctx = makeContext({ invCount: 2 });
    const session = engine.createSession("trade", ctx);
    session.choose("pay");

    const state = (ctx as unknown as { _state: { consumedItems: Array<{ itemId: string; quantity: number }> } })._state;
    expect(state.consumedItems).toEqual([{ itemId: "gem", quantity: 1 }]);
  });

  it("give_item effect calls giveItem on context", () => {
    const engine = new DialogueEngine([
      {
        id: "reward",
        startNodeId: "start",
        nodes: [
          {
            id: "start",
            speaker: "Captain",
            text: "Well done! Take this.",
            choices: [
              {
                id: "accept_reward",
                text: "Thank you.",
                effects: [{ type: "give_item", itemId: "health_potion", quantity: 2 }],
                endsDialogue: true,
              },
            ],
          },
        ],
      },
    ]);

    const ctx = makeContext();
    const session = engine.createSession("reward", ctx);
    session.choose("accept_reward");

    const state = (ctx as unknown as { _state: { givenItems: Array<{ itemId: string; quantity: number }> } })._state;
    expect(state.givenItems).toEqual([{ itemId: "health_potion", quantity: 2 }]);
  });
});
