/**
 * Quest-and-Inventory Integration Tests
 *
 * End-to-end tests covering pick-up/fetch-quest flows using the headless
 * framework engines.  These tests exercise:
 *   - Pick-up (fetch) quest completion via item pickup events
 *   - Item-consume effects wired through dialogue choices
 *   - Multi-objective quest completion ordering and prerequisite gates
 *   - Faction-disposition gating on dialogue choices
 *   - Save/restore round-trips preserving quest + inventory state
 */
import { describe, it, expect } from "vitest";
import { FrameworkRuntime } from "./runtime/framework-runtime";
import { frameworkBaseContent } from "./content/base-content";
import type { RpgContentBundle } from "./content/content-types";
import type { QuestDefinition } from "./quests/quest-types";
import type { ItemDefinition } from "./inventory/inventory-types";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal content bundle from a base patch. */
function makeContent(
  patch: Partial<RpgContentBundle> = {},
): RpgContentBundle {
  return {
    ...frameworkBaseContent,
    ...patch,
    items: [...(patch.items ?? frameworkBaseContent.items)],
    quests: [...(patch.quests ?? frameworkBaseContent.quests)],
    factions: [...(patch.factions ?? frameworkBaseContent.factions)],
    dialogues: [...(patch.dialogues ?? frameworkBaseContent.dialogues)],
    npcArchetypes: [...(patch.npcArchetypes ?? frameworkBaseContent.npcArchetypes)],
  };
}

// ── Simple fetch-quest flow ───────────────────────────────────────────────────

describe("Quest-Inventory Integration — fetch-quest pick-up flow", () => {
  it("completing a single-objective fetch quest via pickup event marks the quest completed", () => {
    const content = makeContent({
      quests: [
        {
          id: "quest_herb_collection",
          name: "Herb Collection",
          description: "Gather healing herbs for the village healer.",
          xpReward: 50,
          nodes: [
            {
              id: "pick_herbs",
              description: "Pick up 3 healing herbs.",
              triggerType: "pickup",
              targetId: "healing_herb",
              requiredCount: 3,
            },
          ],
        } satisfies QuestDefinition,
      ],
      items: [
        ...frameworkBaseContent.items,
        {
          id: "healing_herb",
          name: "Healing Herb",
          description: "A fragrant medicinal herb.",
          stackable: true,
          maxStack: 20,
          tags: ["ingredient"],
        } satisfies ItemDefinition,
      ],
    });

    const runtime = new FrameworkRuntime(content, { inventoryCapacity: 20 });
    runtime.questEngine.activateQuest("quest_herb_collection");
    expect(runtime.questEngine.getQuestStatus("quest_herb_collection")).toBe("active");

    // Picking up one herb at a time
    runtime.applyQuestEvent({ type: "pickup", targetId: "healing_herb" });
    runtime.applyQuestEvent({ type: "pickup", targetId: "healing_herb" });
    expect(runtime.questEngine.getQuestStatus("quest_herb_collection")).toBe("active");

    const results = runtime.applyQuestEvent({ type: "pickup", targetId: "healing_herb" });
    expect(results[0].questCompleted).toBe(true);
    expect(results[0].xpReward).toBe(50);
    expect(runtime.questEngine.getQuestStatus("quest_herb_collection")).toBe("completed");
  });

  it("pickup events for irrelevant items do not advance the quest", () => {
    const runtime = new FrameworkRuntime(frameworkBaseContent, { inventoryCapacity: 20 });
    runtime.questEngine.activateQuest("quest_bandit_bounty");

    // Picking up unrelated items should not advance the bandit_token objective
    runtime.applyQuestEvent({ type: "pickup", targetId: "iron_sword" });
    runtime.applyQuestEvent({ type: "pickup", targetId: "health_potion" });

    const state = runtime.questEngine.getQuestState("quest_bandit_bounty");
    expect(state?.nodes["collect_proof"]?.progress ?? 0).toBe(0);
    expect(runtime.questEngine.getQuestStatus("quest_bandit_bounty")).toBe("active");
  });

  it("batch pickup (amount > 1) advances progress by the specified amount", () => {
    const content = makeContent({
      quests: [
        {
          id: "quest_wood",
          name: "Firewood",
          description: "Gather 5 logs.",
          xpReward: 25,
          nodes: [
            {
              id: "gather_logs",
              description: "Pick up 5 logs.",
              triggerType: "pickup",
              targetId: "log",
              requiredCount: 5,
            },
          ],
        } satisfies QuestDefinition,
      ],
      items: [
        ...frameworkBaseContent.items,
        { id: "log", name: "Log", description: "A wooden log.", stackable: true, maxStack: 99, tags: ["material"] } satisfies ItemDefinition,
      ],
    });

    const runtime = new FrameworkRuntime(content, { inventoryCapacity: 20 });
    runtime.questEngine.activateQuest("quest_wood");

    const results = runtime.applyQuestEvent({ type: "pickup", targetId: "log", amount: 5 });
    expect(results[0].questCompleted).toBe(true);
  });
});

// ── Multi-objective quest ordering ────────────────────────────────────────────

describe("Quest-Inventory Integration — multi-objective ordering", () => {
  it("second objective is not active until the first is completed (prerequisite gate)", () => {
    // quest_bandit_bounty: kill 3 bandits → then collect token
    const runtime = new FrameworkRuntime(frameworkBaseContent, { inventoryCapacity: 20 });
    runtime.questEngine.activateQuest("quest_bandit_bounty");

    const initialState = runtime.questEngine.getQuestState("quest_bandit_bounty")!;
    expect(initialState.nodes["kill_bandits"].active).toBe(true);
    expect(initialState.nodes["collect_proof"].active).toBe(false);
  });

  it("completing the first objective activates the second", () => {
    const runtime = new FrameworkRuntime(frameworkBaseContent, { inventoryCapacity: 20 });
    runtime.questEngine.activateQuest("quest_bandit_bounty");

    // Kill 3 bandits
    runtime.applyQuestEvent({ type: "kill", targetId: "Bandit", amount: 3 });

    const state = runtime.questEngine.getQuestState("quest_bandit_bounty")!;
    expect(state.nodes["kill_bandits"].completed).toBe(true);
    expect(state.nodes["collect_proof"].active).toBe(true);
  });

  it("quest completes only after all objectives in the chain are satisfied", () => {
    const runtime = new FrameworkRuntime(frameworkBaseContent, { inventoryCapacity: 20 });
    runtime.questEngine.activateQuest("quest_bandit_bounty");

    // Only kill bandits — quest should still be active
    runtime.applyQuestEvent({ type: "kill", targetId: "Bandit", amount: 3 });
    expect(runtime.questEngine.getQuestStatus("quest_bandit_bounty")).toBe("active");

    // Now collect the token
    const results = runtime.applyQuestEvent({ type: "pickup", targetId: "bandit_token" });
    expect(results[0].questCompleted).toBe(true);
    expect(runtime.questEngine.getQuestStatus("quest_bandit_bounty")).toBe("completed");
  });

  it("multi-objective quest with parallel objectives all complete independently", () => {
    const content = makeContent({
      quests: [
        {
          id: "quest_parallel",
          name: "Parallel Tasks",
          description: "Do two things simultaneously.",
          xpReward: 80,
          completionNodeIds: ["task_a", "task_b"],
          nodes: [
            {
              id: "task_a",
              description: "Kill 1 wolf.",
              triggerType: "kill",
              targetId: "Wolf",
              requiredCount: 1,
            },
            {
              id: "task_b",
              description: "Pick up a mushroom.",
              triggerType: "pickup",
              targetId: "mushroom",
              requiredCount: 1,
            },
          ],
        } satisfies QuestDefinition,
        ...frameworkBaseContent.quests,
      ],
      items: [
        ...frameworkBaseContent.items,
        { id: "mushroom", name: "Mushroom", description: "A forest mushroom.", stackable: true, maxStack: 10, tags: ["ingredient"] } satisfies ItemDefinition,
      ],
    });

    const runtime = new FrameworkRuntime(content, { inventoryCapacity: 20 });
    runtime.questEngine.activateQuest("quest_parallel");

    runtime.applyQuestEvent({ type: "kill", targetId: "Wolf" });
    // Only task_a is done; task_b still outstanding → quest stays active
    expect(runtime.questEngine.getQuestStatus("quest_parallel")).toBe("active");

    const results = runtime.applyQuestEvent({ type: "pickup", targetId: "mushroom" });
    expect(results[0].questCompleted).toBe(true);
    expect(runtime.questEngine.getQuestStatus("quest_parallel")).toBe("completed");
  });
});

// ── Item-consume effects via dialogue ─────────────────────────────────────────

describe("Quest-Inventory Integration — item-consume effects", () => {
  it("consume_item dialogue effect removes the item from inventory", () => {
    const runtime = new FrameworkRuntime(frameworkBaseContent, { inventoryCapacity: 20 });
    runtime.inventoryEngine.addItem("gold_coins", 50);

    // Use innkeeper_intro → rest → pay: consumes 10 gold_coins
    const session = runtime.createDialogueSession("innkeeper_intro");
    session.choose("rest");
    session.choose("pay");

    expect(runtime.inventoryEngine.getItemCount("gold_coins")).toBe(40);
  });

  it("consume_item effect fails gracefully when the player lacks the item", () => {
    const runtime = new FrameworkRuntime(frameworkBaseContent, { inventoryCapacity: 20 });
    // No gold added — player cannot pay
    const session = runtime.createDialogueSession("innkeeper_intro");
    session.choose("rest");
    // The dialogue choice still "succeeds" at the session level but the item
    // removal returns false internally; inventory remains unchanged.
    expect(() => session.choose("pay")).not.toThrow();
    expect(runtime.inventoryEngine.getItemCount("gold_coins")).toBe(0);
  });

  it("give_item dialogue effect adds items to inventory", () => {
    const content = makeContent({
      dialogues: [
        ...frameworkBaseContent.dialogues,
        {
          id: "reward_dialogue",
          startNodeId: "greet",
          nodes: [
            {
              id: "greet",
              speaker: "Quest Giver",
              text: "Here is your reward!",
              choices: [
                {
                  id: "accept",
                  text: "Thank you.",
                  endsDialogue: true,
                  effects: [
                    { type: "give_item", itemId: "health_potion", quantity: 3 },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    const runtime = new FrameworkRuntime(content, { inventoryCapacity: 20 });
    const session = runtime.createDialogueSession("reward_dialogue");
    session.choose("accept");
    expect(runtime.inventoryEngine.getItemCount("health_potion")).toBe(3);
  });

  it("consume_item + quest event in same dialogue choice both apply", () => {
    const content = makeContent({
      dialogues: [
        ...frameworkBaseContent.dialogues,
        {
          id: "trade_quest_dialogue",
          startNodeId: "greet",
          nodes: [
            {
              id: "greet",
              speaker: "Alchemist",
              text: "Bring me a health potion in exchange for quest credit.",
              choices: [
                {
                  id: "trade",
                  text: "Here you go.",
                  endsDialogue: true,
                  effects: [
                    { type: "consume_item", itemId: "health_potion", quantity: 1 },
                    { type: "emit_event", eventId: "quest:pickup:quest_item" },
                  ],
                },
              ],
            },
          ],
        },
      ],
      quests: [
        ...frameworkBaseContent.quests,
        {
          id: "trade_quest",
          name: "Trade Quest",
          description: "Trade a potion.",
          xpReward: 30,
          nodes: [
            {
              id: "trade_node",
              description: "Give the potion to the alchemist.",
              triggerType: "pickup",
              targetId: "quest_item",
              requiredCount: 1,
            },
          ],
        } satisfies QuestDefinition,
      ],
    });

    const runtime = new FrameworkRuntime(content, { inventoryCapacity: 20 });
    runtime.inventoryEngine.addItem("health_potion", 2);
    runtime.questEngine.activateQuest("trade_quest");

    const session = runtime.createDialogueSession("trade_quest_dialogue");
    session.choose("trade");

    expect(runtime.inventoryEngine.getItemCount("health_potion")).toBe(1); // one consumed
    expect(runtime.questEngine.getQuestStatus("trade_quest")).toBe("completed");
  });
});

// ── Faction-disposition gating ────────────────────────────────────────────────

describe("Quest-Inventory Integration — faction-disposition gating", () => {
  it("faction_delta effect from dialogue adjusts reputation", () => {
    const runtime = new FrameworkRuntime(frameworkBaseContent, { inventoryCapacity: 20 });
    const initialRep = runtime.factionEngine.getReputation("village_guard");

    const session = runtime.createDialogueSession("guard_intro");
    session.choose("friendly_greeting");

    expect(runtime.factionEngine.getReputation("village_guard")).toBe(initialRep + 5);
  });

  it("hostile dialogue choice reduces faction reputation", () => {
    const runtime = new FrameworkRuntime(frameworkBaseContent, { inventoryCapacity: 20 });
    const session = runtime.createDialogueSession("guard_intro");
    session.choose("threaten_guard");
    expect(runtime.factionEngine.getReputation("village_guard")).toBe(-10);
  });

  it("faction_min condition blocks dialogue choice when reputation is too low", () => {
    const content = makeContent({
      dialogues: [
        ...frameworkBaseContent.dialogues,
        {
          id: "guild_dialogue",
          startNodeId: "greet",
          nodes: [
            {
              id: "greet",
              speaker: "Guild Master",
              text: "Only respected members may enter the vault.",
              choices: [
                {
                  id: "enter_vault",
                  text: "I am a senior member. Let me through.",
                  endsDialogue: true,
                  conditions: [{ type: "faction_min", factionId: "merchants_guild", min: 50 }],
                },
                {
                  id: "leave",
                  text: "Maybe another time.",
                  endsDialogue: true,
                },
              ],
            },
          ],
        },
      ],
    });

    const runtime = new FrameworkRuntime(content, { inventoryCapacity: 20 });
    // merchants_guild starts at 10 reputation — below threshold of 50
    const session = runtime.createDialogueSession("guild_dialogue");
    const node = session.getCurrentNode()!;
    const vaultChoice = node.choices.find(c => c.id === "enter_vault")!;
    expect(vaultChoice.isAvailable).toBe(false);
  });

  it("faction_min condition allows dialogue choice when reputation is sufficient", () => {
    const content = makeContent({
      dialogues: [
        ...frameworkBaseContent.dialogues,
        {
          id: "guild_dialogue",
          startNodeId: "greet",
          nodes: [
            {
              id: "greet",
              speaker: "Guild Master",
              text: "Only respected members may enter the vault.",
              choices: [
                {
                  id: "enter_vault",
                  text: "I am a senior member. Let me through.",
                  endsDialogue: true,
                  conditions: [{ type: "faction_min", factionId: "merchants_guild", min: 50 }],
                },
                {
                  id: "leave",
                  text: "Maybe another time.",
                  endsDialogue: true,
                },
              ],
            },
          ],
        },
      ],
    });

    const runtime = new FrameworkRuntime(content, { inventoryCapacity: 20 });
    runtime.factionEngine.setReputation("merchants_guild", 60);

    const session = runtime.createDialogueSession("guild_dialogue");
    const node = session.getCurrentNode()!;
    const vaultChoice = node.choices.find(c => c.id === "enter_vault")!;
    expect(vaultChoice.isAvailable).toBe(true);
  });

  it("disposition gate quest: hostile faction blocks quest acceptance dialogue", () => {
    const content = makeContent({
      dialogues: [
        ...frameworkBaseContent.dialogues,
        {
          id: "faction_quest_dialogue",
          startNodeId: "greet",
          nodes: [
            {
              id: "greet",
              speaker: "Captain",
              text: "Help us protect the town. We only work with allies.",
              choices: [
                {
                  id: "accept",
                  text: "I'll help.",
                  endsDialogue: true,
                  conditions: [{ type: "faction_min", factionId: "village_guard", min: 25 }],
                  effects: [
                    { type: "emit_event", eventId: "quest:talk:Captain" },
                  ],
                },
                {
                  id: "decline",
                  text: "Not interested.",
                  endsDialogue: true,
                },
              ],
            },
          ],
        },
      ],
      quests: [
        ...frameworkBaseContent.quests,
        {
          id: "faction_quest",
          name: "Faction Quest",
          description: "Help the guards.",
          xpReward: 100,
          nodes: [
            {
              id: "talk_captain",
              description: "Agree to help the captain.",
              triggerType: "talk",
              targetId: "Captain",
              requiredCount: 1,
            },
          ],
        } satisfies QuestDefinition,
      ],
    });

    // At default reputation (0) the accept choice is locked
    const runtimeLow = new FrameworkRuntime(content, { inventoryCapacity: 20 });
    runtimeLow.questEngine.activateQuest("faction_quest");
    const sessionLow = runtimeLow.createDialogueSession("faction_quest_dialogue");
    const nodeLow = sessionLow.getCurrentNode()!;
    expect(nodeLow.choices.find(c => c.id === "accept")!.isAvailable).toBe(false);

    // With sufficient reputation the choice is available and the quest advances
    const runtimeHigh = new FrameworkRuntime(content, { inventoryCapacity: 20 });
    runtimeHigh.factionEngine.setReputation("village_guard", 30);
    runtimeHigh.questEngine.activateQuest("faction_quest");
    const sessionHigh = runtimeHigh.createDialogueSession("faction_quest_dialogue");
    sessionHigh.choose("accept");
    expect(runtimeHigh.questEngine.getQuestStatus("faction_quest")).toBe("completed");
  });
});

// ── Save / restore round-trip ─────────────────────────────────────────────────

describe("Quest-Inventory Integration — save and restore", () => {
  it("save/restore preserves partial quest progress", () => {
    const runtime = new FrameworkRuntime(frameworkBaseContent, { inventoryCapacity: 20 });
    runtime.questEngine.activateQuest("quest_bandit_bounty");

    // Kill 2 out of 3 required bandits
    runtime.applyQuestEvent({ type: "kill", targetId: "Bandit", amount: 2 });

    const save = runtime.createSave("test_profile");

    const runtime2 = new FrameworkRuntime(frameworkBaseContent, { inventoryCapacity: 20 });
    runtime2.restoreFromSave(save);

    const state = runtime2.questEngine.getQuestState("quest_bandit_bounty")!;
    expect(state.nodes["kill_bandits"].progress).toBe(2);
    expect(state.nodes["kill_bandits"].completed).toBe(false);
    expect(runtime2.questEngine.getQuestStatus("quest_bandit_bounty")).toBe("active");
  });

  it("save/restore preserves inventory contents", () => {
    const runtime = new FrameworkRuntime(frameworkBaseContent, { inventoryCapacity: 20 });
    runtime.inventoryEngine.addItem("health_potion", 5);
    runtime.inventoryEngine.addItem("iron_sword", 1);

    const save = runtime.createSave("inv_profile");

    const runtime2 = new FrameworkRuntime(frameworkBaseContent, { inventoryCapacity: 20 });
    runtime2.restoreFromSave(save);

    expect(runtime2.inventoryEngine.getItemCount("health_potion")).toBe(5);
    expect(runtime2.inventoryEngine.getItemCount("iron_sword")).toBe(1);
  });

  it("save/restore preserves faction reputations", () => {
    const runtime = new FrameworkRuntime(frameworkBaseContent, { inventoryCapacity: 20 });
    runtime.factionEngine.adjustReputation("village_guard", 40);
    runtime.factionEngine.adjustReputation("bandits", -20);

    const save = runtime.createSave("faction_profile");

    const runtime2 = new FrameworkRuntime(frameworkBaseContent, { inventoryCapacity: 20 });
    runtime2.restoreFromSave(save);

    expect(runtime2.factionEngine.getReputation("village_guard")).toBe(40);
    expect(runtime2.factionEngine.getReputation("bandits")).toBe(-70); // -50 default + -20
  });

  it("completing a quest after restore is correctly reflected in save state", () => {
    const runtime = new FrameworkRuntime(frameworkBaseContent, { inventoryCapacity: 20 });
    runtime.questEngine.activateQuest("quest_bandit_bounty");
    runtime.applyQuestEvent({ type: "kill", targetId: "Bandit", amount: 3 });

    const mid = runtime.createSave("mid_profile");

    const runtime2 = new FrameworkRuntime(frameworkBaseContent, { inventoryCapacity: 20 });
    runtime2.restoreFromSave(mid);

    // Complete the remaining collect_proof objective
    runtime2.applyQuestEvent({ type: "pickup", targetId: "bandit_token" });
    expect(runtime2.questEngine.getQuestStatus("quest_bandit_bounty")).toBe("completed");

    const finalSave = runtime2.createSave("final_profile");
    const runtime3 = new FrameworkRuntime(frameworkBaseContent, { inventoryCapacity: 20 });
    runtime3.restoreFromSave(finalSave);
    expect(runtime3.questEngine.getQuestStatus("quest_bandit_bounty")).toBe("completed");
  });
});
