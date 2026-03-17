/**
 * Quest + Inventory integration test suite.
 *
 * Covers pick-up / fetch-quest flows end-to-end using the headless framework
 * engines, targeting known edge-cases:
 *
 *   1. Item-consume effects applied via dialogue choices.
 *   2. Multi-objective quest completion ordering (prerequisites, parallel
 *      nodes, dependency chaining).
 *   3. Faction-disposition gating on dialogue choices.
 *   4. Give-item effects wired from dialogue to inventory.
 *   5. Quest status transitions (inactive → active → completed / failed).
 */

import { describe, it, expect } from "vitest";
import { FrameworkRuntime } from "./runtime/framework-runtime";
import { frameworkBaseContent } from "./content/base-content";
import type { RpgContentBundle } from "./content/content-types";

// ── Shared helpers ────────────────────────────────────────────────────────────

/** Build a runtime pre-seeded with base content. */
function mkRuntime(overrides: Partial<RpgContentBundle> = {}, capacity = 50) {
  return new FrameworkRuntime(
    { ...frameworkBaseContent, ...overrides },
    { inventoryCapacity: capacity },
  );
}

// ── 1. Item-consume effects via dialogue ──────────────────────────────────────

describe("Item-consume effects via dialogue", () => {
  it("consume_item effect removes the correct quantity on dialogue choice", () => {
    const runtime = mkRuntime();
    runtime.inventoryEngine.addItem("gold_coins", 50);

    const session = runtime.createDialogueSession("innkeeper_intro");
    session.choose("rest"); // advance to rest_reply node
    // "pay" choice has consume_item: { itemId: "gold_coins", quantity: 10 }
    session.choose("pay");

    expect(runtime.inventoryEngine.getItemCount("gold_coins")).toBe(40);
  });

  it("consume_item fails gracefully when player does not have the item", () => {
    // No gold_coins in inventory — choosing "pay" should still complete the
    // dialogue (the effect is best-effort) without throwing.
    const runtime = mkRuntime();
    const session = runtime.createDialogueSession("innkeeper_intro");
    session.choose("rest");
    expect(() => session.choose("pay")).not.toThrow();
    expect(session.isComplete).toBe(true);
  });

  it("consume_item does not remove items when quantity exceeds what is held", () => {
    const runtime = mkRuntime();
    runtime.inventoryEngine.addItem("gold_coins", 5); // only 5, needs 10
    const before = runtime.inventoryEngine.getItemCount("gold_coins");
    const session = runtime.createDialogueSession("innkeeper_intro");
    session.choose("rest");
    session.choose("pay");
    // removeItem fails silently; no partial removal should occur
    expect(runtime.inventoryEngine.getItemCount("gold_coins")).toBe(before);
  });

  it("multiple consume_item sessions each deduct independently", () => {
    const runtime = mkRuntime();
    runtime.inventoryEngine.addItem("gold_coins", 30);

    for (let i = 0; i < 3; i++) {
      const s = runtime.createDialogueSession("innkeeper_intro");
      s.choose("rest");
      s.choose("pay");
    }

    expect(runtime.inventoryEngine.getItemCount("gold_coins")).toBe(0);
  });
});

// ── 2. Give-item effects via dialogue ─────────────────────────────────────────

describe("Give-item effects via dialogue", () => {
  // Build content with a give_item dialogue effect
  const giveItemContent: RpgContentBundle = {
    ...frameworkBaseContent,
    dialogues: [
      ...frameworkBaseContent.dialogues,
      {
        id: "reward_dialogue",
        startNodeId: "root",
        nodes: [
          {
            id: "root",
            speaker: "Captain",
            text: "Well done, adventurer. Here is your reward.",
            choices: [
              {
                id: "accept_reward",
                text: "Thank you.",
                endsDialogue: true,
                effects: [
                  { type: "give_item", itemId: "guard_token", quantity: 3 },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  it("give_item effect adds the item to the player's inventory", () => {
    const runtime = mkRuntime(giveItemContent);
    const session = runtime.createDialogueSession("reward_dialogue");
    session.choose("accept_reward");
    expect(runtime.inventoryEngine.getItemCount("guard_token")).toBe(3);
  });

  it("give_item respects inventory capacity (best-effort)", () => {
    const runtime = mkRuntime(giveItemContent, /* capacity= */ 1);
    // Fill inventory to capacity first
    runtime.inventoryEngine.addItem("health_potion", 1);
    // addItem for give_item will fail silently if capacity exceeded
    const session = runtime.createDialogueSession("reward_dialogue");
    expect(() => session.choose("accept_reward")).not.toThrow();
    expect(session.isComplete).toBe(true);
  });
});

// ── 3. Fetch-quest (pick-up objective) flow ───────────────────────────────────

describe("Fetch-quest pick-up flow (bandit bounty)", () => {
  it("completing kill and pickup objectives in order finishes the quest", () => {
    const runtime = mkRuntime();
    runtime.questEngine.activateQuest("quest_bandit_bounty");

    // Quest starts with kill_bandits node active
    const stateAfterActivate = runtime.questEngine.getQuestState("quest_bandit_bounty")!;
    expect(stateAfterActivate.nodes.kill_bandits.active).toBe(true);
    expect(stateAfterActivate.nodes.collect_proof.active).toBe(false);

    // Applying 2 kill events should advance progress but not complete the node
    runtime.applyQuestEvent({ type: "kill", targetId: "Bandit", amount: 2 });
    const mid = runtime.questEngine.getQuestState("quest_bandit_bounty")!;
    expect(mid.nodes.kill_bandits.completed).toBe(false);
    expect(mid.nodes.kill_bandits.progress).toBe(2);

    // Third kill should complete kill_bandits and activate collect_proof
    const results = runtime.applyQuestEvent({ type: "kill", targetId: "Bandit" });
    const killResult = results.find((r) => r.questId === "quest_bandit_bounty")!;
    expect(killResult.completedNodeIds).toContain("kill_bandits");
    expect(killResult.activatedNodeIds).toContain("collect_proof");
    expect(killResult.questCompleted).toBe(false);

    // Now pick up the proof token
    const finalResults = runtime.applyQuestEvent({ type: "pickup", targetId: "bandit_token" });
    const finalResult = finalResults.find((r) => r.questId === "quest_bandit_bounty")!;
    expect(finalResult.completedNodeIds).toContain("collect_proof");
    expect(finalResult.questCompleted).toBe(true);
    expect(finalResult.xpReward).toBe(150);

    expect(runtime.questEngine.getQuestStatus("quest_bandit_bounty")).toBe("completed");
  });

  it("pickup event before kill_bandits is completed does not activate collect_proof", () => {
    const runtime = mkRuntime();
    runtime.questEngine.activateQuest("quest_bandit_bounty");

    // Fire pickup before kills
    runtime.applyQuestEvent({ type: "pickup", targetId: "bandit_token" });

    const state = runtime.questEngine.getQuestState("quest_bandit_bounty")!;
    expect(state.nodes.collect_proof.active).toBe(false);
    expect(state.status).toBe("active");
  });

  it("excess kill events beyond required count do not double-complete a node", () => {
    const runtime = mkRuntime();
    runtime.questEngine.activateQuest("quest_bandit_bounty");

    // Kill 5 bandits (only 3 required)
    runtime.applyQuestEvent({ type: "kill", targetId: "Bandit", amount: 5 });
    const state = runtime.questEngine.getQuestState("quest_bandit_bounty")!;

    expect(state.nodes.kill_bandits.completed).toBe(true);
    expect(state.nodes.kill_bandits.progress).toBe(3); // capped at requiredCount
    expect(state.nodes.collect_proof.active).toBe(true);
  });
});

// ── 4. Multi-objective quest with dependency ordering ─────────────────────────

describe("Multi-objective quest with explicit prerequisites", () => {
  const multiObjContent: RpgContentBundle = {
    ...frameworkBaseContent,
    quests: [
      ...frameworkBaseContent.quests,
      {
        id: "quest_chain",
        name: "Chained Quest",
        description: "Three objectives that must complete in sequence.",
        xpReward: 300,
        startNodeIds: ["obj_1"],
        nodes: [
          {
            id: "obj_1",
            description: "Step 1: talk to the elder.",
            triggerType: "talk",
            targetId: "Elder",
            requiredCount: 1,
            nextNodeIds: ["obj_2"],
          },
          {
            id: "obj_2",
            description: "Step 2: retrieve the artifact.",
            triggerType: "pickup",
            targetId: "ancient_artifact",
            requiredCount: 1,
            nextNodeIds: ["obj_3"],
          },
          {
            id: "obj_3",
            description: "Step 3: return to the elder.",
            triggerType: "talk",
            targetId: "Elder",
            requiredCount: 2, // must talk twice for confirmation
            prerequisites: ["obj_2"], // must have retrieved artifact first
          },
        ],
      },
    ],
  };

  it("objectives activate in chain order", () => {
    const runtime = mkRuntime(multiObjContent);
    runtime.questEngine.activateQuest("quest_chain");

    // Only obj_1 active at start
    let state = runtime.questEngine.getQuestState("quest_chain")!;
    expect(state.nodes.obj_1.active).toBe(true);
    expect(state.nodes.obj_2.active).toBe(false);
    expect(state.nodes.obj_3.active).toBe(false);

    // Complete obj_1
    runtime.applyQuestEvent({ type: "talk", targetId: "Elder" });
    state = runtime.questEngine.getQuestState("quest_chain")!;
    expect(state.nodes.obj_1.completed).toBe(true);
    expect(state.nodes.obj_2.active).toBe(true);
    expect(state.nodes.obj_3.active).toBe(false);

    // Complete obj_2
    runtime.applyQuestEvent({ type: "pickup", targetId: "ancient_artifact" });
    state = runtime.questEngine.getQuestState("quest_chain")!;
    expect(state.nodes.obj_2.completed).toBe(true);
    expect(state.nodes.obj_3.active).toBe(true);

    // Complete obj_3 (requires 2 talk events)
    runtime.applyQuestEvent({ type: "talk", targetId: "Elder" });
    state = runtime.questEngine.getQuestState("quest_chain")!;
    expect(state.nodes.obj_3.completed).toBe(false); // only 1/2

    const finalResults = runtime.applyQuestEvent({ type: "talk", targetId: "Elder" });
    const finalResult = finalResults.find((r) => r.questId === "quest_chain")!;
    expect(finalResult.questCompleted).toBe(true);
    expect(finalResult.xpReward).toBe(300);
  });

  it("completing obj_3 before obj_2 has no effect (not yet active)", () => {
    const runtime = mkRuntime(multiObjContent);
    runtime.questEngine.activateQuest("quest_chain");

    // Skip obj_1, directly try obj_3 events
    runtime.applyQuestEvent({ type: "talk", targetId: "Elder" }); // matches obj_1, not obj_3
    // At this point obj_2 becomes active, obj_3 still inactive
    runtime.applyQuestEvent({ type: "talk", targetId: "Elder" }); // tries obj_3 — inactive, should skip

    const state = runtime.questEngine.getQuestState("quest_chain")!;
    expect(state.nodes.obj_3.progress).toBe(0);
    expect(state.nodes.obj_3.active).toBe(false);
  });

  it("quest is not completed until all final nodes are done", () => {
    const runtime = mkRuntime(multiObjContent);
    runtime.questEngine.activateQuest("quest_chain");

    runtime.applyQuestEvent({ type: "talk", targetId: "Elder" });
    runtime.applyQuestEvent({ type: "pickup", targetId: "ancient_artifact" });
    // Only 1 of 2 required talks for obj_3
    runtime.applyQuestEvent({ type: "talk", targetId: "Elder" });

    expect(runtime.questEngine.getQuestStatus("quest_chain")).toBe("active");
  });
});

// ── 5. Parallel objectives (no explicit nextNodeIds) ──────────────────────────

describe("Parallel objectives (prerequisites-based activation)", () => {
  const parallelContent: RpgContentBundle = {
    ...frameworkBaseContent,
    quests: [
      ...frameworkBaseContent.quests,
      {
        id: "quest_parallel",
        name: "Parallel Quest",
        description: "Two objectives that can be completed in any order.",
        xpReward: 200,
        startNodeIds: ["slay_wolf", "gather_herbs"],
        nodes: [
          {
            id: "slay_wolf",
            description: "Kill a wolf.",
            triggerType: "kill",
            targetId: "Wolf",
            requiredCount: 1,
          },
          {
            id: "gather_herbs",
            description: "Pick up herbs.",
            triggerType: "pickup",
            targetId: "herb",
            requiredCount: 3,
          },
        ],
      },
    ],
  };

  it("both parallel objectives start active", () => {
    const runtime = mkRuntime(parallelContent);
    runtime.questEngine.activateQuest("quest_parallel");

    const state = runtime.questEngine.getQuestState("quest_parallel")!;
    expect(state.nodes.slay_wolf.active).toBe(true);
    expect(state.nodes.gather_herbs.active).toBe(true);
  });

  it("completing only one objective does not finish the quest", () => {
    const runtime = mkRuntime(parallelContent);
    runtime.questEngine.activateQuest("quest_parallel");

    runtime.applyQuestEvent({ type: "kill", targetId: "Wolf" });
    expect(runtime.questEngine.getQuestStatus("quest_parallel")).toBe("active");
  });

  it("completing objectives in opposite order also completes the quest", () => {
    const runtime = mkRuntime(parallelContent);
    runtime.questEngine.activateQuest("quest_parallel");

    // Gather first
    runtime.applyQuestEvent({ type: "pickup", targetId: "herb", amount: 3 });
    expect(runtime.questEngine.getQuestStatus("quest_parallel")).toBe("active");

    // Then slay
    const results = runtime.applyQuestEvent({ type: "kill", targetId: "Wolf" });
    const r = results.find((r) => r.questId === "quest_parallel")!;
    expect(r.questCompleted).toBe(true);
    expect(runtime.questEngine.getQuestStatus("quest_parallel")).toBe("completed");
  });
});

// ── 6. Faction-disposition gating on dialogue choices ─────────────────────────

describe("Faction-disposition gating on dialogue choices", () => {
  const gatedContent: RpgContentBundle = {
    ...frameworkBaseContent,
    dialogues: [
      ...frameworkBaseContent.dialogues,
      {
        id: "gated_dialogue",
        startNodeId: "root",
        nodes: [
          {
            id: "root",
            speaker: "Elder",
            text: "Prove yourself.",
            choices: [
              {
                id: "allied_offer",
                text: "As your ally, I request access.",
                endsDialogue: true,
                conditions: [{ type: "faction_min", factionId: "village_guard", min: 60 }],
              },
              {
                id: "regular_offer",
                text: "I need your help.",
                endsDialogue: true,
              },
            ],
          },
        ],
      },
    ],
  };

  it("faction-gated choice is unavailable when reputation is too low", () => {
    const runtime = mkRuntime(gatedContent);
    // village_guard default reputation = 0 (below 60 threshold)
    const session = runtime.createDialogueSession("gated_dialogue");
    const node = session.getCurrentNode()!;
    const alliedChoice = node.choices.find((c) => c.id === "allied_offer")!;
    expect(alliedChoice.isAvailable).toBe(false);
  });

  it("faction-gated choice becomes available when reputation meets threshold", () => {
    const runtime = mkRuntime(gatedContent);
    runtime.factionEngine.setReputation("village_guard", 60);

    const session = runtime.createDialogueSession("gated_dialogue");
    const node = session.getCurrentNode()!;
    const alliedChoice = node.choices.find((c) => c.id === "allied_offer")!;
    expect(alliedChoice.isAvailable).toBe(true);
  });

  it("un-gated choice is always available regardless of faction standing", () => {
    const runtime = mkRuntime(gatedContent);
    runtime.factionEngine.setReputation("village_guard", -100);

    const session = runtime.createDialogueSession("gated_dialogue");
    const node = session.getCurrentNode()!;
    const regularChoice = node.choices.find((c) => c.id === "regular_offer")!;
    expect(regularChoice.isAvailable).toBe(true);
  });

  it("choosing the gated choice after becoming allied succeeds", () => {
    const runtime = mkRuntime(gatedContent);
    runtime.factionEngine.setReputation("village_guard", 75);

    const session = runtime.createDialogueSession("gated_dialogue");
    const result = session.choose("allied_offer");
    expect(result.success).toBe(true);
    expect(session.isComplete).toBe(true);
  });

  it("faction delta effect in dialogue adjusts reputation immediately", () => {
    // guard_intro / friendly_greeting applies +5 to village_guard
    const runtime = mkRuntime();
    expect(runtime.factionEngine.getReputation("village_guard")).toBe(0);

    const session = runtime.createDialogueSession("guard_intro");
    session.choose("friendly_greeting");
    expect(runtime.factionEngine.getReputation("village_guard")).toBe(5);
  });

  it("hostile faction_delta pushes reputation below threshold changing disposition", () => {
    const runtime = mkRuntime();
    // default rep = 0, hostile below -25
    runtime.factionEngine.adjustReputation("village_guard", -30);
    expect(runtime.factionEngine.getDisposition("village_guard")).toBe("hostile");
  });

  it("faction reputation gates quest activation via dialogue activate_quest effect", () => {
    // Build content where accepting requires a reputation check, then activates quest
    const conditionalContent: RpgContentBundle = {
      ...frameworkBaseContent,
      dialogues: [
        ...frameworkBaseContent.dialogues,
        {
          id: "conditional_quest_dlg",
          startNodeId: "root",
          nodes: [
            {
              id: "root",
              speaker: "NPC",
              text: "I need a trustworthy person.",
              choices: [
                {
                  id: "accept",
                  text: "You can count on me.",
                  endsDialogue: true,
                  conditions: [{ type: "faction_min", factionId: "village_guard", min: 25 }],
                  effects: [{ type: "activate_quest", questId: "quest_bandit_bounty" }],
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
    };
    const runtime = mkRuntime(conditionalContent);
    runtime.factionEngine.setReputation("village_guard", 25);

    const session = runtime.createDialogueSession("conditional_quest_dlg");
    const result = session.choose("accept");
    expect(result.success).toBe(true);
    expect(runtime.questEngine.getQuestStatus("quest_bandit_bounty")).toBe("active");
  });
});

// ── 7. Quest status not re-activated once completed ───────────────────────────

describe("Quest status lifecycle", () => {
  it("applyQuestEvent has no effect on a completed quest", () => {
    const runtime = mkRuntime();
    runtime.questEngine.activateQuest("quest_guard_resolution");

    // Complete the quest
    const s = runtime.createDialogueSession("guard_intro");
    s.choose("friendly_greeting");
    s.choose("accept_job");
    runtime.applyQuestEvent({ type: "kill", targetId: "RuinGuard" });

    expect(runtime.questEngine.getQuestStatus("quest_guard_resolution")).toBe("completed");

    // Firing the same event again should produce no new results
    const results = runtime.applyQuestEvent({ type: "kill", targetId: "RuinGuard" });
    const questResult = results.find((r) => r.questId === "quest_guard_resolution");
    expect(questResult).toBeUndefined();
  });

  it("activating an already-completed quest returns false", () => {
    const runtime = mkRuntime();
    runtime.questEngine.activateQuest("quest_bandit_bounty");
    runtime.applyQuestEvent({ type: "kill", targetId: "Bandit", amount: 3 });
    runtime.applyQuestEvent({ type: "pickup", targetId: "bandit_token" });

    expect(runtime.questEngine.getQuestStatus("quest_bandit_bounty")).toBe("completed");
    expect(runtime.questEngine.activateQuest("quest_bandit_bounty")).toBe(false);
  });

  it("inactive quest ignores events until explicitly activated", () => {
    const runtime = mkRuntime();
    // Do not activate quest_bandit_bounty
    runtime.applyQuestEvent({ type: "kill", targetId: "Bandit", amount: 10 });
    expect(runtime.questEngine.getQuestStatus("quest_bandit_bounty")).toBe("inactive");
  });
});

// ── 8. Save / restore round-trip preserves quest + inventory state ─────────────

describe("Save / restore preserves quest + inventory state", () => {
  it("save snapshot captures quest progress and inventory counts", () => {
    const runtime = mkRuntime();
    runtime.inventoryEngine.addItem("health_potion", 5);
    runtime.questEngine.activateQuest("quest_bandit_bounty");
    runtime.applyQuestEvent({ type: "kill", targetId: "Bandit", amount: 2 });

    const save = runtime.createSave("test_profile");
    // questState is typed as Record<string,unknown> but contains the QuestSnapshot structure
    const questSnap = save.state.questState as { quests: Record<string, { nodes: Record<string, { progress: number }> }> };
    expect(questSnap.quests.quest_bandit_bounty.nodes.kill_bandits.progress).toBe(2);
    // inventoryState contains the InventorySnapshot structure
    const invSnap = save.state.inventoryState as { items: Array<{ itemId: string; quantity: number }> };
    expect(invSnap.items.some((i) => i.itemId === "health_potion" && i.quantity === 5)).toBe(true);
  });

  it("restoring a save resumes quest progress from where it left off", () => {
    const runtime = mkRuntime();
    runtime.questEngine.activateQuest("quest_bandit_bounty");
    runtime.applyQuestEvent({ type: "kill", targetId: "Bandit", amount: 2 });

    const save = runtime.createSave("restore_test");

    // Create a fresh runtime and restore
    const runtime2 = mkRuntime();
    runtime2.restoreFromSave(save);

    const state = runtime2.questEngine.getQuestState("quest_bandit_bounty")!;
    expect(state.nodes.kill_bandits.progress).toBe(2);
    expect(state.nodes.kill_bandits.completed).toBe(false);

    // Continue from where we left off
    const results = runtime2.applyQuestEvent({ type: "kill", targetId: "Bandit" });
    const r = results.find((r) => r.questId === "quest_bandit_bounty")!;
    expect(r.completedNodeIds).toContain("kill_bandits");
    expect(r.activatedNodeIds).toContain("collect_proof");
  });
});
