import { describe, it, expect } from "vitest";
import { frameworkBaseContent } from "./content/base-content";
import { FrameworkRuntime } from "./runtime/framework-runtime";
import type { RpgContentBundle } from "./content/content-types";

// A minimal content bundle with a skill-gated dialogue choice for testing
// the skillLevelProvider integration.
const skillGatedContent: RpgContentBundle = {
  ...frameworkBaseContent,
  dialogues: [
    ...frameworkBaseContent.dialogues,
    {
      id: "skill_test_dialogue",
      startNodeId: "root",
      nodes: [
        {
          id: "root",
          speaker: "TestNPC",
          text: "Can you open the magic gate?",
          choices: [
            {
              id: "use_arcana",
              text: "Let me try. (requires arcana 3)",
              endsDialogue: true,
              conditions: [{ type: "skill_min", skillId: "arcana", min: 3 }],
            },
            {
              id: "walk_away",
              text: "Not today.",
              endsDialogue: true,
            },
          ],
        },
      ],
    },
  ],
};

describe("FrameworkRuntime integration", () => {
  it("runs dialogue -> faction updates -> quest progression -> save snapshot", () => {
    const runtime = new FrameworkRuntime(frameworkBaseContent, { inventoryCapacity: 10 });

    // Seed inventory so dialogue item checks could be used by content authors.
    runtime.inventoryEngine.addItem("health_potion", 2);
    runtime.questEngine.activateQuest("quest_guard_resolution");

    const session = runtime.createDialogueSession("guard_intro");
    const node = session.getCurrentNode();
    expect(node?.id).toBe("start");

    // Friendly branch should improve guard faction reputation.
    const choiceResult = session.choose("friendly_greeting");
    expect(choiceResult.success).toBe(true);
    expect(runtime.factionEngine.getReputation("village_guard")).toBe(5);

    // Accepting the quest emits quest:talk:Guard via dialogue event effect.
    const accept = session.choose("accept_job");
    expect(accept.success).toBe(true);
    expect(session.isComplete).toBe(true);

    // Quest graph should now have advanced first node.
    const questState = runtime.questEngine.getQuestState("quest_guard_resolution");
    expect(questState?.nodes.talk_to_guard.completed).toBe(true);

    // Drive kill event and complete quest.
    const updates = runtime.applyQuestEvent({ type: "kill", targetId: "RuinGuard" });
    expect(updates[0].questCompleted).toBe(true);
    expect(runtime.questEngine.getQuestStatus("quest_guard_resolution")).toBe("completed");

    const save = runtime.createSave("integration_profile");
    expect(save.state.factionState).toBeTruthy();
    expect(save.state.questState).toBeTruthy();
    expect(save.profileId).toBe("integration_profile");
  });
});

describe("FrameworkRuntime — skillLevelProvider", () => {
  it("blocks skill_min dialogue choice when no provider is configured", () => {
    const runtime = new FrameworkRuntime(skillGatedContent, { inventoryCapacity: 10 });
    const session = runtime.createDialogueSession("skill_test_dialogue");
    const node = session.getCurrentNode()!;
    const arcanaChoice = node.choices.find(c => c.id === "use_arcana")!;
    expect(arcanaChoice.isAvailable).toBe(false);
  });

  it("blocks skill_min dialogue choice when provider returns insufficient rank", () => {
    const runtime = new FrameworkRuntime(skillGatedContent, {
      inventoryCapacity: 10,
      skillLevelProvider: () => 2, // rank 2 < required 3
    });
    const session = runtime.createDialogueSession("skill_test_dialogue");
    const node = session.getCurrentNode()!;
    const arcanaChoice = node.choices.find(c => c.id === "use_arcana")!;
    expect(arcanaChoice.isAvailable).toBe(false);
  });

  it("allows skill_min dialogue choice when provider returns sufficient rank", () => {
    const runtime = new FrameworkRuntime(skillGatedContent, {
      inventoryCapacity: 10,
      skillLevelProvider: (skillId) => skillId === "arcana" ? 3 : 0,
    });
    const session = runtime.createDialogueSession("skill_test_dialogue");
    const node = session.getCurrentNode()!;
    const arcanaChoice = node.choices.find(c => c.id === "use_arcana")!;
    expect(arcanaChoice.isAvailable).toBe(true);
  });

  it("choices without skill conditions remain available regardless of provider", () => {
    const runtime = new FrameworkRuntime(skillGatedContent, {
      inventoryCapacity: 10,
      skillLevelProvider: () => 0,
    });
    const session = runtime.createDialogueSession("skill_test_dialogue");
    const node = session.getCurrentNode()!;
    const walkAway = node.choices.find(c => c.id === "walk_away")!;
    expect(walkAway.isAvailable).toBe(true);
  });
});
