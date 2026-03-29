import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  EventScriptSystem,
  EventScript,
  EventScriptContext,
  SimpleEventScriptStep,
} from "./event-script-system";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeContext(overrides: Partial<EventScriptContext> = {}): EventScriptContext & {
  notifications: string[];
  flags: Map<string, boolean>;
  quests: Map<string, "inactive" | "active" | "completed">;
  items: Map<string, number>;
  factions: Map<string, number>;
  emittedEvents: Array<{ eventType: string; targetId: string; amount: number }>;
  gameTime: number;
} {
  const flags = new Map<string, boolean>();
  const quests = new Map<string, "inactive" | "active" | "completed">();
  const items = new Map<string, number>();
  const factions = new Map<string, number>();
  const notifications: string[] = [];
  const emittedEvents: Array<{ eventType: string; targetId: string; amount: number }> = [];
  let gameTime = 0;

  return {
    notifications,
    flags,
    quests,
    items,
    factions,
    emittedEvents,
    get gameTime() {
      return gameTime;
    },
    set gameTime(v: number) {
      gameTime = v;
    },
    getFlag: (f) => flags.get(f) ?? false,
    setFlag: (f, v) => flags.set(f, v),
    getQuestStatus: (id) => quests.get(id) ?? "inactive",
    activateQuest: (id) => quests.set(id, "active"),
    giveItem: (id, qty) => items.set(id, (items.get(id) ?? 0) + qty),
    removeItem: (id, qty) => {
      const current = items.get(id) ?? 0;
      if (current < qty) return false;
      items.set(id, current - qty);
      return true;
    },
    adjustFaction: (id, amt) => factions.set(id, (factions.get(id) ?? 0) + amt),
    showNotification: (msg) => notifications.push(msg),
    emitEvent: (et, tid, amt) => emittedEvents.push({ eventType: et, targetId: tid, amount: amt }),
    getCurrentGameTimeMinutes: () => gameTime,
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("EventScriptSystem", () => {
  let system: EventScriptSystem;

  beforeEach(() => {
    system = new EventScriptSystem();
  });

  // ── Registration ─────────────────────────────────────────────────────────

  it("registers a script", () => {
    system.registerScript({ id: "s1", steps: [] });
    expect(system.getScript("s1")).toBeDefined();
  });

  it("re-registration replaces the script", () => {
    system.registerScript({ id: "s1", steps: [{ type: "set_flag", flag: "a", value: true }] });
    system.registerScript({ id: "s1", steps: [{ type: "set_flag", flag: "b", value: true }] });
    expect(system.getScript("s1")!.steps[0]).toMatchObject({ flag: "b" });
  });

  it("returns undefined for unknown script", () => {
    expect(system.getScript("unknown")).toBeUndefined();
  });

  // ── run() ─────────────────────────────────────────────────────────────────

  it("returns false for unregistered script", () => {
    const ctx = makeContext();
    expect(system.run("ghost", ctx)).toBe(false);
  });

  it("executes an empty script and marks complete", () => {
    const ctx = makeContext();
    const completed: string[] = [];
    system.onScriptComplete = (id) => completed.push(id);
    system.registerScript({ id: "empty", steps: [] });
    expect(system.run("empty", ctx)).toBe(true);
    expect(completed).toEqual(["empty"]);
    expect(system.isCompleted("empty")).toBe(true);
    expect(system.isPending("empty")).toBe(false);
  });

  it("executes show_notification step", () => {
    const ctx = makeContext();
    system.registerScript({ id: "s1", steps: [{ type: "show_notification", message: "Hello!" }] });
    system.run("s1", ctx);
    expect(ctx.notifications).toContain("Hello!");
  });

  it("executes trigger_quest step", () => {
    const ctx = makeContext();
    system.registerScript({ id: "s1", steps: [{ type: "trigger_quest", questId: "q_main" }] });
    system.run("s1", ctx);
    expect(ctx.quests.get("q_main")).toBe("active");
  });

  it("executes award_item step with default quantity 1", () => {
    const ctx = makeContext();
    system.registerScript({ id: "s1", steps: [{ type: "award_item", itemId: "sword" }] });
    system.run("s1", ctx);
    expect(ctx.items.get("sword")).toBe(1);
  });

  it("executes award_item step with custom quantity", () => {
    const ctx = makeContext();
    system.registerScript({
      id: "s1",
      steps: [{ type: "award_item", itemId: "gold_coin", quantity: 50 }],
    });
    system.run("s1", ctx);
    expect(ctx.items.get("gold_coin")).toBe(50);
  });

  it("executes remove_item step", () => {
    const ctx = makeContext();
    ctx.items.set("key", 3);
    system.registerScript({ id: "s1", steps: [{ type: "remove_item", itemId: "key", quantity: 2 }] });
    system.run("s1", ctx);
    expect(ctx.items.get("key")).toBe(1);
  });

  it("executes set_flag step", () => {
    const ctx = makeContext();
    system.registerScript({
      id: "s1",
      steps: [{ type: "set_flag", flag: "entered_cave", value: true }],
    });
    system.run("s1", ctx);
    expect(ctx.flags.get("entered_cave")).toBe(true);
  });

  it("executes faction_delta step", () => {
    const ctx = makeContext();
    ctx.factions.set("thieves_guild", 50);
    system.registerScript({
      id: "s1",
      steps: [{ type: "faction_delta", factionId: "thieves_guild", amount: 15 }],
    });
    system.run("s1", ctx);
    expect(ctx.factions.get("thieves_guild")).toBe(65);
  });

  it("executes emit_event step with default amount", () => {
    const ctx = makeContext();
    system.registerScript({
      id: "s1",
      steps: [{ type: "emit_event", eventType: "kill", targetId: "wolf" }],
    });
    system.run("s1", ctx);
    expect(ctx.emittedEvents).toEqual([{ eventType: "kill", targetId: "wolf", amount: 1 }]);
  });

  it("executes emit_event step with custom amount", () => {
    const ctx = makeContext();
    system.registerScript({
      id: "s1",
      steps: [{ type: "emit_event", eventType: "pickup", targetId: "gem", amount: 3 }],
    });
    system.run("s1", ctx);
    expect(ctx.emittedEvents[0].amount).toBe(3);
  });

  it("executes multiple steps in order", () => {
    const ctx = makeContext();
    const order: string[] = [];
    system.onStepExecuted = (_id, _idx, step) => {
      if (step.type === "show_notification") order.push(step.message);
    };
    system.registerScript({
      id: "s1",
      steps: [
        { type: "show_notification", message: "first" },
        { type: "show_notification", message: "second" },
        { type: "show_notification", message: "third" },
      ],
    });
    system.run("s1", ctx);
    expect(order).toEqual(["first", "second", "third"]);
  });

  // ── wait_hours ────────────────────────────────────────────────────────────

  it("pauses on wait_hours and resumes via update()", () => {
    const ctx = makeContext();
    ctx.gameTime = 0;
    system.registerScript({
      id: "s1",
      steps: [
        { type: "show_notification", message: "before wait" },
        { type: "wait_hours", hours: 4 },
        { type: "show_notification", message: "after wait" },
      ],
    });
    system.run("s1", ctx);

    expect(ctx.notifications).toContain("before wait");
    expect(ctx.notifications).not.toContain("after wait");
    expect(system.isWaiting("s1")).toBe(true);
    expect(system.isPending("s1")).toBe(true);

    // Advance game clock — 4 hours = 240 minutes
    ctx.gameTime = 239;
    system.update(ctx.gameTime, ctx);
    expect(ctx.notifications).not.toContain("after wait"); // not yet

    ctx.gameTime = 240;
    system.update(ctx.gameTime, ctx);
    expect(ctx.notifications).toContain("after wait");
    expect(system.isPending("s1")).toBe(false);
    expect(system.isCompleted("s1")).toBe(true);
  });

  it("handles wait_hours of 0 as immediate (resumes on same update() call)", () => {
    const ctx = makeContext();
    ctx.gameTime = 100;
    system.registerScript({
      id: "s1",
      steps: [
        { type: "wait_hours", hours: 0 },
        { type: "show_notification", message: "instant" },
      ],
    });
    system.run("s1", ctx);
    // wait_hours 0 sets waitUntilGameTime = 100; update(100) should resume
    system.update(100, ctx);
    expect(ctx.notifications).toContain("instant");
  });

  // ── cancel() ──────────────────────────────────────────────────────────────

  it("cancel() fires onScriptCancelled and removes from pending", () => {
    const ctx = makeContext();
    const cancelled: string[] = [];
    system.onScriptCancelled = (id) => cancelled.push(id);
    system.registerScript({
      id: "s1",
      steps: [{ type: "wait_hours", hours: 10 }],
    });
    system.run("s1", ctx);
    expect(system.isPending("s1")).toBe(true);
    system.cancel("s1");
    expect(system.isPending("s1")).toBe(false);
    expect(cancelled).toEqual(["s1"]);
  });

  it("cancel() is no-op for non-running script", () => {
    const cancelled: string[] = [];
    system.onScriptCancelled = (id) => cancelled.push(id);
    system.cancel("ghost");
    expect(cancelled).toHaveLength(0);
  });

  // ── Non-repeatable / repeatable ───────────────────────────────────────────

  it("non-repeatable script cannot be run a second time", () => {
    const ctx = makeContext();
    const completed: string[] = [];
    system.onScriptComplete = (id) => completed.push(id);
    system.registerScript({ id: "once", steps: [{ type: "show_notification", message: "hi" }] });
    system.run("once", ctx);
    system.run("once", ctx);
    expect(completed).toHaveLength(1);
    expect(ctx.notifications).toHaveLength(1);
  });

  it("repeatable script can be run again after completing", () => {
    const ctx = makeContext();
    const completed: string[] = [];
    system.onScriptComplete = (id) => completed.push(id);
    system.registerScript({
      id: "repeat",
      repeatable: true,
      steps: [{ type: "show_notification", message: "again" }],
    });
    system.run("repeat", ctx);
    system.run("repeat", ctx);
    expect(completed).toHaveLength(2);
    expect(ctx.notifications).toHaveLength(2);
  });

  it("running script blocks second run() call", () => {
    const ctx = makeContext();
    system.registerScript({
      id: "s1",
      repeatable: true,
      steps: [{ type: "wait_hours", hours: 5 }],
    });
    expect(system.run("s1", ctx)).toBe(true);
    expect(system.run("s1", ctx)).toBe(false);
  });

  // ── branch_on_flag ────────────────────────────────────────────────────────

  it("branch_on_flag takes ifTrue branch when flag is true", () => {
    const ctx = makeContext();
    ctx.flags.set("hero", true);
    system.registerScript({
      id: "s1",
      steps: [
        {
          type: "branch_on_flag",
          flag: "hero",
          ifTrue: [{ type: "show_notification", message: "brave hero" }],
          ifFalse: [{ type: "show_notification", message: "unknown" }],
        },
      ],
    });
    system.run("s1", ctx);
    expect(ctx.notifications).toContain("brave hero");
    expect(ctx.notifications).not.toContain("unknown");
  });

  it("branch_on_flag takes ifFalse branch when flag is false", () => {
    const ctx = makeContext();
    ctx.flags.set("hero", false);
    system.registerScript({
      id: "s1",
      steps: [
        {
          type: "branch_on_flag",
          flag: "hero",
          ifTrue: [{ type: "show_notification", message: "brave hero" }],
          ifFalse: [{ type: "show_notification", message: "unknown" }],
        },
      ],
    });
    system.run("s1", ctx);
    expect(ctx.notifications).toContain("unknown");
    expect(ctx.notifications).not.toContain("brave hero");
  });

  it("branch_on_flag with no ifFalse branch — no steps on false", () => {
    const ctx = makeContext();
    system.registerScript({
      id: "s1",
      steps: [
        {
          type: "branch_on_flag",
          flag: "unlocked",
          ifTrue: [{ type: "show_notification", message: "open" }],
        },
      ],
    });
    system.run("s1", ctx);
    expect(ctx.notifications).toHaveLength(0);
  });

  // ── branch_on_quest ────────────────────────────────────────────────────────

  it("branch_on_quest takes then branch when quest matches status", () => {
    const ctx = makeContext();
    ctx.quests.set("q_main", "completed");
    system.registerScript({
      id: "s1",
      steps: [
        {
          type: "branch_on_quest",
          questId: "q_main",
          status: "completed",
          then: [{ type: "show_notification", message: "thanks, hero" }],
          else: [{ type: "show_notification", message: "not done yet" }],
        },
      ],
    });
    system.run("s1", ctx);
    expect(ctx.notifications).toContain("thanks, hero");
    expect(ctx.notifications).not.toContain("not done yet");
  });

  it("branch_on_quest takes else branch when quest does not match", () => {
    const ctx = makeContext();
    ctx.quests.set("q_main", "active");
    system.registerScript({
      id: "s1",
      steps: [
        {
          type: "branch_on_quest",
          questId: "q_main",
          status: "completed",
          then: [{ type: "show_notification", message: "done" }],
          else: [{ type: "show_notification", message: "still going" }],
        },
      ],
    });
    system.run("s1", ctx);
    expect(ctx.notifications).toContain("still going");
  });

  // ── onStepExecuted callback ───────────────────────────────────────────────

  it("fires onStepExecuted for each executed step", () => {
    const ctx = makeContext();
    const executed: Array<{ idx: number; type: string }> = [];
    system.onStepExecuted = (_id, idx, step) => executed.push({ idx, type: step.type });
    system.registerScript({
      id: "s1",
      steps: [
        { type: "set_flag", flag: "f", value: true },
        { type: "show_notification", message: "hi" },
      ],
    });
    system.run("s1", ctx);
    expect(executed).toEqual([
      { idx: 0, type: "set_flag" },
      { idx: 1, type: "show_notification" },
    ]);
  });

  it("fires onStepExecuted for wait_hours step before suspending", () => {
    const ctx = makeContext();
    const types: string[] = [];
    system.onStepExecuted = (_id, _idx, step) => types.push(step.type);
    system.registerScript({
      id: "s1",
      steps: [
        { type: "show_notification", message: "before" },
        { type: "wait_hours", hours: 1 },
        { type: "show_notification", message: "after" },
      ],
    });
    system.run("s1", ctx);
    expect(types).toEqual(["show_notification", "wait_hours"]);
    // after step not yet executed
  });

  // ── runningScripts accessor ───────────────────────────────────────────────

  it("runningScripts returns all pending scripts", () => {
    const ctx = makeContext();
    system.registerScript({ id: "a", steps: [{ type: "wait_hours", hours: 1 }] });
    system.registerScript({ id: "b", steps: [{ type: "wait_hours", hours: 2 }] });
    system.run("a", ctx);
    system.run("b", ctx);
    const ids = system.runningScripts.map((r) => r.scriptId).sort();
    expect(ids).toEqual(["a", "b"]);
  });

  // ── Save / restore ────────────────────────────────────────────────────────

  it("getSaveState / restoreFromSave round-trips completed scripts", () => {
    const ctx = makeContext();
    system.registerScript({ id: "done", steps: [{ type: "set_flag", flag: "x", value: true }] });
    system.run("done", ctx);

    const saved = system.getSaveState();
    const system2 = new EventScriptSystem();
    system2.registerScript({ id: "done", steps: [] });
    system2.restoreFromSave(saved);
    expect(system2.isCompleted("done")).toBe(true);
  });

  it("getSaveState / restoreFromSave round-trips a waiting script", () => {
    const ctx = makeContext();
    ctx.gameTime = 0;
    system.registerScript({
      id: "wait_script",
      steps: [
        { type: "wait_hours", hours: 6 },
        { type: "show_notification", message: "resumed" },
      ],
    });
    system.run("wait_script", ctx);

    const saved = system.getSaveState();
    expect(saved.pendingScripts).toHaveLength(1);
    expect(saved.pendingScripts[0].waitUntilGameTime).toBe(360);

    const system2 = new EventScriptSystem();
    system2.registerScript({
      id: "wait_script",
      steps: [
        { type: "wait_hours", hours: 6 },
        { type: "show_notification", message: "resumed" },
      ],
    });
    system2.restoreFromSave(saved);
    expect(system2.isPending("wait_script")).toBe(true);
    expect(system2.isWaiting("wait_script")).toBe(true);

    const ctx2 = makeContext();
    ctx2.gameTime = 360;
    system2.update(360, ctx2);
    expect(ctx2.notifications).toContain("resumed");
    expect(system2.isPending("wait_script")).toBe(false);
  });

  it("restoreFromSave skips pending scripts whose definition is gone", () => {
    const ctx = makeContext();
    ctx.gameTime = 0;
    system.registerScript({ id: "s1", steps: [{ type: "wait_hours", hours: 1 }] });
    system.run("s1", ctx);

    const saved = system.getSaveState();
    const system2 = new EventScriptSystem();
    // s1 not registered in system2
    system2.restoreFromSave(saved);
    expect(system2.isPending("s1")).toBe(false);
  });

  it("restoreFromSave handles null/empty state gracefully", () => {
    const system2 = new EventScriptSystem();
    expect(() => system2.restoreFromSave(null as any)).not.toThrow();
  });

  // ── Complex scenario ──────────────────────────────────────────────────────

  it("complex script: quest intro with branch and wait", () => {
    const ctx = makeContext();
    ctx.gameTime = 0;
    ctx.flags.set("guild_member", true);

    system.registerScript({
      id: "guild_intro",
      steps: [
        { type: "show_notification", message: "You have been summoned." },
        {
          type: "branch_on_flag",
          flag: "guild_member",
          ifTrue: [
            { type: "faction_delta", factionId: "guild", amount: 10 },
            { type: "show_notification", message: "Welcome back, member." },
          ],
          ifFalse: [{ type: "show_notification", message: "You are not a member." }],
        },
        { type: "wait_hours", hours: 2 },
        { type: "trigger_quest", questId: "q_heist" },
        { type: "award_item", itemId: "guild_key", quantity: 1 },
      ],
    });

    system.run("guild_intro", ctx);

    // Sync steps before wait should have fired
    expect(ctx.notifications).toContain("You have been summoned.");
    expect(ctx.notifications).toContain("Welcome back, member.");
    expect(ctx.notifications).not.toContain("You are not a member.");
    expect(ctx.factions.get("guild")).toBe(10);
    expect(system.isWaiting("guild_intro")).toBe(true);

    // After wait
    ctx.gameTime = 120;
    system.update(120, ctx);
    expect(ctx.quests.get("q_heist")).toBe("active");
    expect(ctx.items.get("guild_key")).toBe(1);
    expect(system.isCompleted("guild_intro")).toBe(true);
  });

  // ── Camera steps ──────────────────────────────────────────────────────────

  it("camera_look_at calls context.cameraLookAt with correct coords", () => {
    const lookAtCalls: Array<{ x: number; y: number; z: number }> = [];
    const ctx = makeContext({ cameraLookAt: (x, y, z) => lookAtCalls.push({ x, y, z }) });
    system.registerScript({
      id: "s1",
      steps: [{ type: "camera_look_at", x: 10, y: 5, z: -20 }],
    });
    system.run("s1", ctx);
    expect(lookAtCalls).toEqual([{ x: 10, y: 5, z: -20 }]);
  });

  it("camera_look_at is a no-op when cameraLookAt is not provided", () => {
    const ctx = makeContext();
    system.registerScript({
      id: "s1",
      steps: [{ type: "camera_look_at", x: 0, y: 0, z: 0 }],
    });
    expect(() => system.run("s1", ctx)).not.toThrow();
    expect(system.isCompleted("s1")).toBe(true);
  });

  it("camera_pan_to calls context.cameraPanTo with default durationMs 1000", () => {
    const panCalls: Array<{ x: number; y: number; z: number; d: number }> = [];
    const ctx = makeContext({
      cameraPanTo: (x, y, z, d) => panCalls.push({ x, y, z, d }),
    });
    system.registerScript({
      id: "s1",
      steps: [{ type: "camera_pan_to", x: 1, y: 2, z: 3 }],
    });
    system.run("s1", ctx);
    expect(panCalls).toEqual([{ x: 1, y: 2, z: 3, d: 1000 }]);
  });

  it("camera_pan_to uses custom durationMs when provided", () => {
    const panCalls: Array<{ x: number; y: number; z: number; d: number }> = [];
    const ctx = makeContext({
      cameraPanTo: (x, y, z, d) => panCalls.push({ x, y, z, d }),
    });
    system.registerScript({
      id: "s1",
      steps: [{ type: "camera_pan_to", x: 0, y: 0, z: 0, durationMs: 2500 }],
    });
    system.run("s1", ctx);
    expect(panCalls[0].d).toBe(2500);
  });

  it("camera_pan_to is a no-op when cameraPanTo is not provided", () => {
    const ctx = makeContext();
    system.registerScript({
      id: "s1",
      steps: [{ type: "camera_pan_to", x: 0, y: 0, z: 0 }],
    });
    expect(() => system.run("s1", ctx)).not.toThrow();
    expect(system.isCompleted("s1")).toBe(true);
  });

  it("camera_fade_out calls context.cameraFadeOut with default durationMs 500", () => {
    const fadeCalls: number[] = [];
    const ctx = makeContext({ cameraFadeOut: (d) => fadeCalls.push(d) });
    system.registerScript({ id: "s1", steps: [{ type: "camera_fade_out" }] });
    system.run("s1", ctx);
    expect(fadeCalls).toEqual([500]);
  });

  it("camera_fade_out uses custom durationMs when provided", () => {
    const fadeCalls: number[] = [];
    const ctx = makeContext({ cameraFadeOut: (d) => fadeCalls.push(d) });
    system.registerScript({ id: "s1", steps: [{ type: "camera_fade_out", durationMs: 800 }] });
    system.run("s1", ctx);
    expect(fadeCalls).toEqual([800]);
  });

  it("camera_fade_in calls context.cameraFadeIn with default durationMs 500", () => {
    const fadeCalls: number[] = [];
    const ctx = makeContext({ cameraFadeIn: (d) => fadeCalls.push(d) });
    system.registerScript({ id: "s1", steps: [{ type: "camera_fade_in" }] });
    system.run("s1", ctx);
    expect(fadeCalls).toEqual([500]);
  });

  it("camera_shake calls context.cameraShake with defaults intensity 0.5 and durationMs 500", () => {
    const shakeCalls: Array<{ i: number; d: number }> = [];
    const ctx = makeContext({ cameraShake: (i, d) => shakeCalls.push({ i, d }) });
    system.registerScript({ id: "s1", steps: [{ type: "camera_shake" }] });
    system.run("s1", ctx);
    expect(shakeCalls).toEqual([{ i: 0.5, d: 500 }]);
  });

  it("camera_shake uses custom intensity and durationMs when provided", () => {
    const shakeCalls: Array<{ i: number; d: number }> = [];
    const ctx = makeContext({ cameraShake: (i, d) => shakeCalls.push({ i, d }) });
    system.registerScript({
      id: "s1",
      steps: [{ type: "camera_shake", intensity: 1.5, durationMs: 300 }],
    });
    system.run("s1", ctx);
    expect(shakeCalls).toEqual([{ i: 1.5, d: 300 }]);
  });

  it("camera steps fire onStepExecuted like other steps", () => {
    const types: string[] = [];
    const ctx = makeContext({ cameraFadeOut: () => {} });
    system.onStepExecuted = (_id, _idx, step) => types.push(step.type);
    system.registerScript({
      id: "s1",
      steps: [
        { type: "camera_fade_out", durationMs: 400 },
        { type: "camera_fade_in", durationMs: 400 },
      ],
    });
    system.run("s1", ctx);
    expect(types).toEqual(["camera_fade_out", "camera_fade_in"]);
  });
});
