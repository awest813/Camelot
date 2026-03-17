/**
 * FrameworkRuntime event adapter tests.
 *
 * Validates that registered IFrameworkEventAdapter implementations receive
 * the correct notifications when framework state changes.
 */
import { describe, it, expect, vi } from "vitest";
import { FrameworkRuntime } from "./framework-runtime";
import { frameworkBaseContent } from "../content/base-content";
import type { IFrameworkEventAdapter } from "./framework-adapter";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("FrameworkRuntime — adapter registration", () => {
  it("starts with zero adapters", () => {
    const runtime = new FrameworkRuntime(frameworkBaseContent);
    expect(runtime.adapterCount).toBe(0);
  });

  it("registerAdapter() increments the adapter count", () => {
    const runtime = new FrameworkRuntime(frameworkBaseContent);
    const adapter: IFrameworkEventAdapter = {};
    runtime.registerAdapter(adapter);
    expect(runtime.adapterCount).toBe(1);
  });

  it("unregisterAdapter() decrements the adapter count", () => {
    const runtime = new FrameworkRuntime(frameworkBaseContent);
    const adapter: IFrameworkEventAdapter = {};
    runtime.registerAdapter(adapter);
    runtime.unregisterAdapter(adapter);
    expect(runtime.adapterCount).toBe(0);
  });

  it("registering the same adapter instance twice is a no-op", () => {
    const runtime = new FrameworkRuntime(frameworkBaseContent);
    const adapter: IFrameworkEventAdapter = {};
    runtime.registerAdapter(adapter);
    runtime.registerAdapter(adapter);
    expect(runtime.adapterCount).toBe(1);
  });

  it("unregisterAdapter() on an unknown adapter is a no-op", () => {
    const runtime = new FrameworkRuntime(frameworkBaseContent);
    const adapter: IFrameworkEventAdapter = {};
    expect(() => runtime.unregisterAdapter(adapter)).not.toThrow();
  });

  it("multiple distinct adapters can be registered simultaneously", () => {
    const runtime = new FrameworkRuntime(frameworkBaseContent);
    runtime.registerAdapter({});
    runtime.registerAdapter({});
    runtime.registerAdapter({});
    expect(runtime.adapterCount).toBe(3);
  });
});

describe("FrameworkRuntime — onQuestEvent adapter callback", () => {
  it("fires onQuestEvent when applyQuestEvent is called", () => {
    const runtime = new FrameworkRuntime(frameworkBaseContent, { inventoryCapacity: 20 });
    runtime.questEngine.activateQuest("quest_bandit_bounty");

    const onQuestEvent = vi.fn();
    runtime.registerAdapter({ onQuestEvent });

    runtime.applyQuestEvent({ type: "kill", targetId: "Bandit", amount: 3 });
    expect(onQuestEvent).toHaveBeenCalledOnce();

    const [passedEvent, passedResults] = onQuestEvent.mock.calls[0] as [unknown, unknown[]];
    expect(passedEvent).toMatchObject({ type: "kill", targetId: "Bandit", amount: 3 });
    expect(passedResults).toBeInstanceOf(Array);
  });

  it("fires onQuestEvent even when no quest matched (empty results array)", () => {
    const runtime = new FrameworkRuntime(frameworkBaseContent, { inventoryCapacity: 20 });
    const onQuestEvent = vi.fn();
    runtime.registerAdapter({ onQuestEvent });

    runtime.applyQuestEvent({ type: "kill", targetId: "Nobody" });
    expect(onQuestEvent).toHaveBeenCalledOnce();
    const results = onQuestEvent.mock.calls[0][1] as unknown[];
    expect(results).toHaveLength(0);
  });

  it("fires onQuestEvent via dialogue emitEvent effect", () => {
    const runtime = new FrameworkRuntime(frameworkBaseContent, { inventoryCapacity: 20 });
    runtime.questEngine.activateQuest("quest_guard_resolution");

    const onQuestEvent = vi.fn();
    runtime.registerAdapter({ onQuestEvent });

    // guard_intro → friendly_greeting → accept_job emits quest:talk:Guard
    const session = runtime.createDialogueSession("guard_intro");
    session.choose("friendly_greeting");
    session.choose("accept_job");

    expect(onQuestEvent).toHaveBeenCalled();
  });

  it("does not fire onQuestEvent after adapter is unregistered", () => {
    const runtime = new FrameworkRuntime(frameworkBaseContent, { inventoryCapacity: 20 });
    const onQuestEvent = vi.fn();
    const adapter: IFrameworkEventAdapter = { onQuestEvent };
    runtime.registerAdapter(adapter);
    runtime.unregisterAdapter(adapter);

    runtime.applyQuestEvent({ type: "kill", targetId: "Bandit" });
    expect(onQuestEvent).not.toHaveBeenCalled();
  });
});

describe("FrameworkRuntime — onInventoryChange adapter callback", () => {
  it("fires onInventoryChange when an item is given via dialogue effect", () => {
    const runtime = new FrameworkRuntime(frameworkBaseContent, { inventoryCapacity: 20 });
    const onInventoryChange = vi.fn();
    runtime.registerAdapter({ onInventoryChange });

    // innkeeper_intro → rest → pay consumes gold_coins
    runtime.inventoryEngine.addItem("gold_coins", 50);
    // Note: addItem itself doesn't fire adapter since it bypasses the session
    onInventoryChange.mockClear();

    const session = runtime.createDialogueSession("innkeeper_intro");
    session.choose("rest");
    session.choose("pay"); // consumes 10 gold_coins

    expect(onInventoryChange).toHaveBeenCalledWith("gold_coins", 40);
  });

  it("fires onInventoryChange with quantity 0 when last item is consumed", () => {
    const runtime = new FrameworkRuntime(frameworkBaseContent, { inventoryCapacity: 20 });
    const onInventoryChange = vi.fn();
    runtime.registerAdapter({ onInventoryChange });

    runtime.inventoryEngine.addItem("gold_coins", 10);
    onInventoryChange.mockClear();

    const session = runtime.createDialogueSession("innkeeper_intro");
    session.choose("rest");
    session.choose("pay"); // consumes exactly 10 gold_coins → quantity = 0

    expect(onInventoryChange).toHaveBeenCalledWith("gold_coins", 0);
  });
});

describe("FrameworkRuntime — onFactionReputationChange adapter callback", () => {
  it("fires onFactionReputationChange when a faction_delta effect applies", () => {
    const runtime = new FrameworkRuntime(frameworkBaseContent, { inventoryCapacity: 20 });
    const onFactionReputationChange = vi.fn();
    runtime.registerAdapter({ onFactionReputationChange });

    const session = runtime.createDialogueSession("guard_intro");
    session.choose("friendly_greeting"); // faction_delta: village_guard +5

    expect(onFactionReputationChange).toHaveBeenCalledWith("village_guard", 5);
  });

  it("fires with the updated reputation value after adjustment", () => {
    const runtime = new FrameworkRuntime(frameworkBaseContent, { inventoryCapacity: 20 });
    runtime.factionEngine.setReputation("village_guard", 20);

    const onFactionReputationChange = vi.fn();
    runtime.registerAdapter({ onFactionReputationChange });

    const session = runtime.createDialogueSession("guard_intro");
    session.choose("threaten_guard"); // faction_delta: village_guard -10 → 10

    expect(onFactionReputationChange).toHaveBeenCalledWith("village_guard", 10);
  });
});

describe("FrameworkRuntime — onFlagChange adapter callback", () => {
  it("fires onFlagChange when a set_flag dialogue effect applies", () => {
    const runtime = new FrameworkRuntime(frameworkBaseContent, { inventoryCapacity: 20 });
    const onFlagChange = vi.fn();
    runtime.registerAdapter({ onFlagChange });

    // guard_intro → friendly_greeting → accept_job emits set_flag: accepted_ruin_job=true
    const session = runtime.createDialogueSession("guard_intro");
    session.choose("friendly_greeting");
    session.choose("accept_job");

    expect(onFlagChange).toHaveBeenCalledWith("accepted_ruin_job", true);
  });
});

describe("FrameworkRuntime — onDialogueComplete adapter callback", () => {
  it("fires onDialogueComplete when a dialogue session ends", () => {
    const runtime = new FrameworkRuntime(frameworkBaseContent, { inventoryCapacity: 20 });
    const onDialogueComplete = vi.fn();
    runtime.registerAdapter({ onDialogueComplete });

    const session = runtime.createDialogueSession("guard_intro");
    session.choose("friendly_greeting");
    session.choose("accept_job"); // endsDialogue: true

    expect(onDialogueComplete).toHaveBeenCalledWith("guard_intro");
  });

  it("does not fire onDialogueComplete while dialogue is still in progress", () => {
    const runtime = new FrameworkRuntime(frameworkBaseContent, { inventoryCapacity: 20 });
    const onDialogueComplete = vi.fn();
    runtime.registerAdapter({ onDialogueComplete });

    const session = runtime.createDialogueSession("guard_intro");
    session.choose("friendly_greeting"); // moves to help_offer, not complete yet

    expect(onDialogueComplete).not.toHaveBeenCalled();
    expect(session.isComplete).toBe(false);
  });
});

describe("FrameworkRuntime — multiple adapters receive the same events", () => {
  it("all registered adapters are notified for the same event", () => {
    const runtime = new FrameworkRuntime(frameworkBaseContent, { inventoryCapacity: 20 });
    runtime.questEngine.activateQuest("quest_bandit_bounty");

    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const cb3 = vi.fn();
    runtime.registerAdapter({ onQuestEvent: cb1 });
    runtime.registerAdapter({ onQuestEvent: cb2 });
    runtime.registerAdapter({ onQuestEvent: cb3 });

    runtime.applyQuestEvent({ type: "kill", targetId: "Bandit" });

    expect(cb1).toHaveBeenCalledOnce();
    expect(cb2).toHaveBeenCalledOnce();
    expect(cb3).toHaveBeenCalledOnce();
  });

  it("adapter methods are optional — adapters without a method do not throw", () => {
    const runtime = new FrameworkRuntime(frameworkBaseContent, { inventoryCapacity: 20 });
    // adapter has no onQuestEvent method
    runtime.registerAdapter({ onFlagChange: vi.fn() });

    expect(() => runtime.applyQuestEvent({ type: "kill", targetId: "Bandit" })).not.toThrow();
  });
});
