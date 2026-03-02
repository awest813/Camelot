import { describe, it, expect } from "vitest";
import { frameworkBaseContent } from "./content/base-content";
import { FrameworkRuntime } from "./runtime/framework-runtime";

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
