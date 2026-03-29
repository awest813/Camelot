import { describe, it, expect, beforeEach } from "vitest";
import { TutorialSystem, TutorialStep } from "./tutorial-system";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeSteps(count: number): TutorialStep[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `step_${i}`,
    message: `Message ${i}`,
    highlightTarget: `target_${i}`,
    advanceHint: `Hint ${i}`,
  }));
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("TutorialSystem", () => {
  let system: TutorialSystem;

  beforeEach(() => {
    system = new TutorialSystem();
  });

  // ── Step management ───────────────────────────────────────────────────────

  it("addStep() registers a step", () => {
    system.addStep({ id: "s1", message: "Hello" });
    expect(system.totalSteps).toBe(1);
  });

  it("addStep() appends multiple steps in order", () => {
    const steps = makeSteps(3);
    steps.forEach((s) => system.addStep(s));
    expect(system.totalSteps).toBe(3);
    expect(system.getAllSteps().map((s) => s.id)).toEqual(["step_0", "step_1", "step_2"]);
  });

  it("getStep() returns the correct step by id", () => {
    system.addStep({ id: "intro", message: "Welcome!" });
    const step = system.getStep("intro");
    expect(step).toBeDefined();
    expect(step!.message).toBe("Welcome!");
  });

  it("getStep() returns undefined for unknown id", () => {
    expect(system.getStep("ghost")).toBeUndefined();
  });

  it("getAllSteps() returns a copy (mutations do not affect internal state)", () => {
    system.addStep({ id: "s1", message: "Hi" });
    const copy = system.getAllSteps();
    copy[0].message = "Mutated";
    expect(system.getAllSteps()[0].message).toBe("Hi");
  });

  it("removeStep() removes a step by id", () => {
    system.addStep({ id: "a", message: "A" });
    system.addStep({ id: "b", message: "B" });
    system.removeStep("a");
    expect(system.totalSteps).toBe(1);
    expect(system.getStep("a")).toBeUndefined();
  });

  it("removeStep() is a no-op for unknown id", () => {
    system.addStep({ id: "a", message: "A" });
    expect(() => system.removeStep("ghost")).not.toThrow();
    expect(system.totalSteps).toBe(1);
  });

  it("clearSteps() removes all steps and resets state", () => {
    makeSteps(3).forEach((s) => system.addStep(s));
    system.clearSteps();
    expect(system.totalSteps).toBe(0);
    expect(system.isStarted).toBe(false);
  });

  // ── start() ───────────────────────────────────────────────────────────────

  it("start() returns false when no steps are registered", () => {
    expect(system.start()).toBe(false);
    expect(system.isStarted).toBe(false);
  });

  it("start() returns true when steps are registered", () => {
    system.addStep({ id: "s1", message: "Go" });
    expect(system.start()).toBe(true);
  });

  it("start() sets isStarted to true", () => {
    system.addStep({ id: "s1", message: "Go" });
    system.start();
    expect(system.isStarted).toBe(true);
  });

  it("start() sets currentStepIndex to 0", () => {
    system.addStep({ id: "s1", message: "Go" });
    system.start();
    expect(system.currentStepIndex).toBe(0);
  });

  it("start() fires onStepBegin for the first step", () => {
    const began: Array<{ index: number; id: string }> = [];
    system.onStepBegin = (i, s) => began.push({ index: i, id: s.id });
    system.addStep({ id: "first", message: "Welcome!" });
    system.start();
    expect(began).toEqual([{ index: 0, id: "first" }]);
  });

  it("start() returns false when already started", () => {
    system.addStep({ id: "s1", message: "Go" });
    system.start();
    expect(system.start()).toBe(false);
  });

  it("start() returns false when tutorial is completed", () => {
    system.addStep({ id: "s1", message: "Go" });
    system.start();
    system.advance();
    expect(system.start()).toBe(false);
  });

  it("start() returns false when tutorial was skipped", () => {
    system.addStep({ id: "s1", message: "Go" });
    system.start();
    system.skip();
    expect(system.start()).toBe(false);
  });

  // ── advance() ─────────────────────────────────────────────────────────────

  it("advance() returns false when not started", () => {
    system.addStep({ id: "s1", message: "Go" });
    expect(system.advance()).toBe(false);
  });

  it("advance() returns false when already completed", () => {
    system.addStep({ id: "s1", message: "Go" });
    system.start();
    system.advance();
    expect(system.advance()).toBe(false);
  });

  it("advance() returns false when skipped", () => {
    system.addStep({ id: "s1", message: "Go" });
    system.start();
    system.skip();
    expect(system.advance()).toBe(false);
  });

  it("advance() returns true when active", () => {
    makeSteps(2).forEach((s) => system.addStep(s));
    system.start();
    expect(system.advance()).toBe(true);
  });

  it("advance() fires onStepComplete for the departing step", () => {
    const completed: Array<{ index: number; id: string }> = [];
    system.onStepComplete = (i, s) => completed.push({ index: i, id: s.id });
    makeSteps(2).forEach((s) => system.addStep(s));
    system.start();
    system.advance();
    expect(completed).toEqual([{ index: 0, id: "step_0" }]);
  });

  it("advance() fires onStepBegin for the next step", () => {
    const began: Array<{ index: number; id: string }> = [];
    system.onStepBegin = (i, s) => began.push({ index: i, id: s.id });
    makeSteps(2).forEach((s) => system.addStep(s));
    system.start();
    system.advance();
    // began[0] was from start(); began[1] should be the next step
    expect(began[1]).toEqual({ index: 1, id: "step_1" });
  });

  it("advance() moves currentStepIndex forward", () => {
    makeSteps(3).forEach((s) => system.addStep(s));
    system.start();
    expect(system.currentStepIndex).toBe(0);
    system.advance();
    expect(system.currentStepIndex).toBe(1);
    system.advance();
    expect(system.currentStepIndex).toBe(2);
  });

  it("advance() on the last step completes the tutorial", () => {
    system.addStep({ id: "only", message: "Only step" });
    system.start();
    system.advance();
    expect(system.isCompleted).toBe(true);
    expect(system.isActive).toBe(false);
  });

  it("advance() on the last step fires onTutorialComplete", () => {
    let completed = false;
    system.onTutorialComplete = () => { completed = true; };
    system.addStep({ id: "last", message: "Done" });
    system.start();
    system.advance();
    expect(completed).toBe(true);
  });

  it("advance() on the last step does NOT fire onStepBegin for a next step", () => {
    const began: number[] = [];
    system.onStepBegin = (i) => began.push(i);
    system.addStep({ id: "only", message: "Only" });
    system.start();      // fires onStepBegin(0)
    system.advance();    // should NOT fire onStepBegin again
    expect(began).toHaveLength(1);
    expect(began[0]).toBe(0);
  });

  it("advance() sets currentStepIndex to -1 after last step", () => {
    system.addStep({ id: "last", message: "Done" });
    system.start();
    system.advance();
    expect(system.currentStepIndex).toBe(-1);
  });

  // ── skip() ────────────────────────────────────────────────────────────────

  it("skip() fires onTutorialSkipped when active", () => {
    let skipped = false;
    system.onTutorialSkipped = () => { skipped = true; };
    system.addStep({ id: "s1", message: "Hi" });
    system.start();
    system.skip();
    expect(skipped).toBe(true);
  });

  it("skip() sets isSkipped to true", () => {
    system.addStep({ id: "s1", message: "Hi" });
    system.start();
    system.skip();
    expect(system.isSkipped).toBe(true);
  });

  it("skip() sets isActive to false", () => {
    system.addStep({ id: "s1", message: "Hi" });
    system.start();
    system.skip();
    expect(system.isActive).toBe(false);
  });

  it("skip() sets currentStepIndex to -1", () => {
    system.addStep({ id: "s1", message: "Hi" });
    system.start();
    system.skip();
    expect(system.currentStepIndex).toBe(-1);
  });

  it("skip() is a no-op when tutorial is not started", () => {
    let fired = false;
    system.onTutorialSkipped = () => { fired = true; };
    system.addStep({ id: "s1", message: "Hi" });
    system.skip();
    expect(fired).toBe(false);
  });

  it("skip() is a no-op when tutorial is already completed", () => {
    let fired = false;
    system.onTutorialSkipped = () => { fired = true; };
    system.addStep({ id: "s1", message: "Hi" });
    system.start();
    system.advance();
    system.skip();
    expect(fired).toBe(false);
  });

  // ── isActive ──────────────────────────────────────────────────────────────

  it("isActive is false before start()", () => {
    system.addStep({ id: "s1", message: "Hi" });
    expect(system.isActive).toBe(false);
  });

  it("isActive is true after start() and before advance or skip", () => {
    makeSteps(2).forEach((s) => system.addStep(s));
    system.start();
    expect(system.isActive).toBe(true);
  });

  it("isActive is false after completion", () => {
    system.addStep({ id: "s1", message: "Hi" });
    system.start();
    system.advance();
    expect(system.isActive).toBe(false);
  });

  it("isActive is false after skip", () => {
    system.addStep({ id: "s1", message: "Hi" });
    system.start();
    system.skip();
    expect(system.isActive).toBe(false);
  });

  // ── currentStep ───────────────────────────────────────────────────────────

  it("currentStep is null when tutorial is not started", () => {
    system.addStep({ id: "s1", message: "Hi" });
    expect(system.currentStep).toBeNull();
  });

  it("currentStep returns the active step when running", () => {
    system.addStep({ id: "move", message: "Move!" });
    system.start();
    expect(system.currentStep!.id).toBe("move");
    expect(system.currentStep!.message).toBe("Move!");
  });

  it("currentStep returns null after tutorial completes", () => {
    system.addStep({ id: "s1", message: "Hi" });
    system.start();
    system.advance();
    expect(system.currentStep).toBeNull();
  });

  it("currentStep returns null after tutorial is skipped", () => {
    system.addStep({ id: "s1", message: "Hi" });
    system.start();
    system.skip();
    expect(system.currentStep).toBeNull();
  });

  // ── reset() ───────────────────────────────────────────────────────────────

  it("reset() clears started/completed/skipped flags", () => {
    system.addStep({ id: "s1", message: "Hi" });
    system.start();
    system.advance();
    system.reset();
    expect(system.isStarted).toBe(false);
    expect(system.isCompleted).toBe(false);
    expect(system.isSkipped).toBe(false);
  });

  it("reset() sets currentStepIndex back to -1", () => {
    system.addStep({ id: "s1", message: "Hi" });
    system.start();
    system.reset();
    expect(system.currentStepIndex).toBe(-1);
  });

  it("reset() does not remove registered steps", () => {
    makeSteps(3).forEach((s) => system.addStep(s));
    system.start();
    system.reset();
    expect(system.totalSteps).toBe(3);
  });

  it("reset() fires no callbacks", () => {
    let fired = false;
    system.onTutorialComplete = () => { fired = true; };
    system.onTutorialSkipped = () => { fired = true; };
    system.onStepBegin = () => { fired = true; };
    system.addStep({ id: "s1", message: "Hi" });
    system.start();
    // clear the fired flag set by start's onStepBegin
    fired = false;
    system.reset();
    expect(fired).toBe(false);
  });

  it("tutorial can be started again after reset()", () => {
    const began: number[] = [];
    system.onStepBegin = (i) => began.push(i);
    system.addStep({ id: "s1", message: "Hi" });
    system.start();
    system.reset();
    system.start();
    expect(began).toHaveLength(2); // once from first start, once from second
  });

  // ── Persistence ───────────────────────────────────────────────────────────

  it("getSnapshot() returns current state", () => {
    makeSteps(2).forEach((s) => system.addStep(s));
    system.start();
    const snap = system.getSnapshot();
    expect(snap.started).toBe(true);
    expect(snap.completed).toBe(false);
    expect(snap.skipped).toBe(false);
    expect(snap.currentStepIndex).toBe(0);
  });

  it("restoreSnapshot() restores an active state without firing callbacks", () => {
    let fired = false;
    system.onStepBegin = () => { fired = true; };
    makeSteps(3).forEach((s) => system.addStep(s));
    system.restoreSnapshot({ started: true, completed: false, skipped: false, currentStepIndex: 1 });
    expect(fired).toBe(false);
    expect(system.isStarted).toBe(true);
    expect(system.currentStepIndex).toBe(1);
    expect(system.currentStep!.id).toBe("step_1");
  });

  it("restoreSnapshot() restores a completed state", () => {
    makeSteps(2).forEach((s) => system.addStep(s));
    system.restoreSnapshot({ started: true, completed: true, skipped: false, currentStepIndex: -1 });
    expect(system.isCompleted).toBe(true);
    expect(system.isActive).toBe(false);
    expect(system.currentStep).toBeNull();
  });

  it("restoreSnapshot() restores a skipped state", () => {
    makeSteps(2).forEach((s) => system.addStep(s));
    system.restoreSnapshot({ started: true, completed: false, skipped: true, currentStepIndex: -1 });
    expect(system.isSkipped).toBe(true);
    expect(system.isActive).toBe(false);
  });

  it("restoreSnapshot() handles null gracefully", () => {
    expect(() => system.restoreSnapshot(null as any)).not.toThrow();
  });

  it("getSnapshot() / restoreSnapshot() round-trip preserves active step", () => {
    makeSteps(3).forEach((s) => system.addStep(s));
    system.start();
    system.advance(); // now on step_1

    const snap = system.getSnapshot();

    const system2 = new TutorialSystem();
    makeSteps(3).forEach((s) => system2.addStep(s));
    system2.restoreSnapshot(snap);

    expect(system2.currentStepIndex).toBe(1);
    expect(system2.currentStep!.id).toBe("step_1");
    expect(system2.isActive).toBe(true);
  });

  // ── Full scenario ─────────────────────────────────────────────────────────

  it("full scenario: 3-step tutorial completes in order", () => {
    const began: string[] = [];
    const done: string[] = [];
    let tutDone = false;

    system.onStepBegin    = (_, s) => began.push(s.id);
    system.onStepComplete = (_, s) => done.push(s.id);
    system.onTutorialComplete = () => { tutDone = true; };

    makeSteps(3).forEach((s) => system.addStep(s));
    system.start();                  // began: [step_0]
    system.advance();                // done: [step_0], began: [step_0, step_1]
    system.advance();                // done: [step_0, step_1], began: [step_0, step_1, step_2]
    system.advance();                // done: [step_0, step_1, step_2], tutDone

    expect(began).toEqual(["step_0", "step_1", "step_2"]);
    expect(done).toEqual(["step_0", "step_1", "step_2"]);
    expect(tutDone).toBe(true);
    expect(system.isCompleted).toBe(true);
  });

  it("full scenario: tutorial skipped mid-way stops further advances", () => {
    let tutDone = false;
    let skipFired = false;
    system.onTutorialComplete = () => { tutDone = true; };
    system.onTutorialSkipped  = () => { skipFired = true; };

    makeSteps(4).forEach((s) => system.addStep(s));
    system.start();
    system.advance();    // step 0 → 1
    system.skip();       // skips mid-tutorial

    expect(skipFired).toBe(true);
    expect(tutDone).toBe(false);
    expect(system.isSkipped).toBe(true);
    expect(system.advance()).toBe(false); // no-op after skip
  });
});
