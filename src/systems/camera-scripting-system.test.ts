import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  CameraScriptingSystem,
  CameraSequenceDefinition,
  CameraScriptingContext,
  CameraScriptStep,
  SplineWaypoint,
} from "./camera-scripting-system";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeContext(overrides: Partial<CameraScriptingContext> = {}): CameraScriptingContext & {
  lookAtCalls:  Array<{ x: number; y: number; z: number }>;
  panToCalls:   Array<{ x: number; y: number; z: number; durationMs: number; easing: string }>;
  fadeOutCalls: number[];
  fadeInCalls:  number[];
  shakeCalls:   Array<{ intensity: number; durationMs: number }>;
  setPosCalls:  Array<{ x: number; y: number; z: number }>;
} {
  const lookAtCalls:  Array<{ x: number; y: number; z: number }> = [];
  const panToCalls:   Array<{ x: number; y: number; z: number; durationMs: number; easing: string }> = [];
  const fadeOutCalls: number[] = [];
  const fadeInCalls:  number[] = [];
  const shakeCalls:   Array<{ intensity: number; durationMs: number }> = [];
  const setPosCalls:  Array<{ x: number; y: number; z: number }> = [];

  return {
    lookAtCalls, panToCalls, fadeOutCalls, fadeInCalls, shakeCalls, setPosCalls,
    cameraLookAt:  (x, y, z)                         => lookAtCalls.push({ x, y, z }),
    cameraPanTo:   (x, y, z, durationMs, easing)     => panToCalls.push({ x, y, z, durationMs, easing }),
    cameraFadeOut: (durationMs)                       => fadeOutCalls.push(durationMs),
    cameraFadeIn:  (durationMs)                       => fadeInCalls.push(durationMs),
    cameraShake:   (intensity, durationMs)            => shakeCalls.push({ intensity, durationMs }),
    cameraSetPosition: (x, y, z)                     => setPosCalls.push({ x, y, z }),
    ...overrides,
  };
}

function makeSeq(
  id: string,
  steps: CameraScriptStep[],
  extras: Partial<CameraSequenceDefinition> = {},
): CameraSequenceDefinition {
  return { id, steps, ...extras };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("CameraScriptingSystem", () => {
  let sys: CameraScriptingSystem;
  let ctx: ReturnType<typeof makeContext>;

  beforeEach(() => {
    sys = new CameraScriptingSystem();
    ctx = makeContext();
  });

  // ── Registration ─────────────────────────────────────────────────────────

  describe("registerSequence / getSequence / unregisterSequence / getAllSequences", () => {
    it("starts with no sequences registered", () => {
      expect(sys.getAllSequences()).toHaveLength(0);
    });

    it("registerSequence stores the definition", () => {
      sys.registerSequence(makeSeq("cam_a", []));
      expect(sys.getSequence("cam_a")).toBeDefined();
    });

    it("getSequence returns undefined for unknown id", () => {
      expect(sys.getSequence("ghost")).toBeUndefined();
    });

    it("getAllSequences returns all registered sequences", () => {
      sys.registerSequence(makeSeq("a", []));
      sys.registerSequence(makeSeq("b", []));
      expect(sys.getAllSequences()).toHaveLength(2);
    });

    it("re-registering replaces the definition", () => {
      sys.registerSequence(makeSeq("cam_a", [{ type: "fade_out" }]));
      sys.registerSequence(makeSeq("cam_a", [{ type: "fade_in" }]));
      expect(sys.getSequence("cam_a")!.steps[0].type).toBe("fade_in");
    });

    it("unregisterSequence removes the sequence and returns true", () => {
      sys.registerSequence(makeSeq("cam_a", []));
      expect(sys.unregisterSequence("cam_a")).toBe(true);
      expect(sys.getSequence("cam_a")).toBeUndefined();
    });

    it("unregisterSequence returns false for unknown id", () => {
      expect(sys.unregisterSequence("ghost")).toBe(false);
    });
  });

  // ── play() ────────────────────────────────────────────────────────────────

  describe("play()", () => {
    it("returns false for unregistered sequence", () => {
      expect(sys.play("unknown", ctx)).toBe(false);
    });

    it("returns true for a registered sequence", () => {
      sys.registerSequence(makeSeq("seq", []));
      expect(sys.play("seq", ctx)).toBe(true);
    });

    it("returns false when sequence is already playing", () => {
      sys.registerSequence(makeSeq("seq", [{ type: "wait", durationMs: 1000 }]));
      sys.play("seq", ctx);
      expect(sys.play("seq", ctx)).toBe(false);
    });

    it("executes a look_at step immediately on play", () => {
      sys.registerSequence(makeSeq("seq", [{ type: "look_at", x: 1, y: 2, z: 3 }]));
      sys.play("seq", ctx);
      expect(ctx.lookAtCalls).toHaveLength(1);
      expect(ctx.lookAtCalls[0]).toEqual({ x: 1, y: 2, z: 3 });
    });

    it("sequence with only instant steps completes synchronously", () => {
      const onComplete = vi.fn();
      sys.onSequenceComplete = onComplete;
      sys.registerSequence(makeSeq("seq", [
        { type: "look_at", x: 0, y: 0, z: 0 },
        { type: "look_at", x: 1, y: 1, z: 1 },
      ]));
      sys.play("seq", ctx);
      expect(onComplete).toHaveBeenCalledWith("seq");
      expect(sys.isPlaying("seq")).toBe(false);
    });

    it("timed step suspends execution — sequence stays playing after play()", () => {
      sys.registerSequence(makeSeq("seq", [{ type: "fade_out", durationMs: 500 }]));
      sys.play("seq", ctx);
      expect(sys.isPlaying("seq")).toBe(true);
      expect(ctx.fadeOutCalls).toHaveLength(1);
    });
  });

  // ── stop() ────────────────────────────────────────────────────────────────

  describe("stop()", () => {
    it("fires onSequenceStopped", () => {
      const onStopped = vi.fn();
      sys.onSequenceStopped = onStopped;
      sys.registerSequence(makeSeq("seq", [{ type: "wait", durationMs: 1000 }]));
      sys.play("seq", ctx);
      sys.stop("seq");
      expect(onStopped).toHaveBeenCalledWith("seq");
    });

    it("isPlaying returns false after stop", () => {
      sys.registerSequence(makeSeq("seq", [{ type: "wait", durationMs: 1000 }]));
      sys.play("seq", ctx);
      sys.stop("seq");
      expect(sys.isPlaying("seq")).toBe(false);
    });

    it("stop is a no-op when sequence is not playing", () => {
      const onStopped = vi.fn();
      sys.onSequenceStopped = onStopped;
      sys.stop("ghost");
      expect(onStopped).not.toHaveBeenCalled();
    });
  });

  // ── pause() / resume() ────────────────────────────────────────────────────

  describe("pause() / resume()", () => {
    beforeEach(() => {
      sys.registerSequence(makeSeq("seq", [{ type: "wait", durationMs: 1000 }]));
      sys.play("seq", ctx);
    });

    it("pause while playing sets isPaused to true", () => {
      sys.pause("seq");
      expect(sys.isPaused("seq")).toBe(true);
    });

    it("pause fires onSequencePaused", () => {
      const onPaused = vi.fn();
      sys.onSequencePaused = onPaused;
      sys.pause("seq");
      expect(onPaused).toHaveBeenCalledWith("seq");
    });

    it("pause is a no-op when sequence is not playing", () => {
      const onPaused = vi.fn();
      sys.onSequencePaused = onPaused;
      sys.pause("ghost");
      expect(onPaused).not.toHaveBeenCalled();
    });

    it("pause is a no-op when already paused", () => {
      const onPaused = vi.fn();
      sys.onSequencePaused = onPaused;
      sys.pause("seq");
      sys.pause("seq");
      expect(onPaused).toHaveBeenCalledTimes(1);
    });

    it("resume while paused fires onSequenceResumed", () => {
      const onResumed = vi.fn();
      sys.onSequenceResumed = onResumed;
      sys.pause("seq");
      sys.resume("seq");
      expect(onResumed).toHaveBeenCalledWith("seq");
    });

    it("resume clears isPaused", () => {
      sys.pause("seq");
      sys.resume("seq");
      expect(sys.isPaused("seq")).toBe(false);
    });

    it("resume is a no-op when sequence is not paused", () => {
      const onResumed = vi.fn();
      sys.onSequenceResumed = onResumed;
      sys.resume("seq");
      expect(onResumed).not.toHaveBeenCalled();
    });
  });

  // ── isPlaying() / isPaused() / getPlayheadStep() ──────────────────────────

  describe("query helpers", () => {
    it("isPlaying returns false before play", () => {
      sys.registerSequence(makeSeq("seq", []));
      expect(sys.isPlaying("seq")).toBe(false);
    });

    it("isPlaying returns true while playing a timed step", () => {
      sys.registerSequence(makeSeq("seq", [{ type: "wait", durationMs: 500 }]));
      sys.play("seq", ctx);
      expect(sys.isPlaying("seq")).toBe(true);
    });

    it("isPlaying includes paused sequences", () => {
      sys.registerSequence(makeSeq("seq", [{ type: "wait", durationMs: 500 }]));
      sys.play("seq", ctx);
      sys.pause("seq");
      expect(sys.isPlaying("seq")).toBe(true);
    });

    it("isPaused returns false while actively playing", () => {
      sys.registerSequence(makeSeq("seq", [{ type: "wait", durationMs: 500 }]));
      sys.play("seq", ctx);
      expect(sys.isPaused("seq")).toBe(false);
    });

    it("getPlayheadStep returns current step index while playing", () => {
      sys.registerSequence(makeSeq("seq", [
        { type: "wait", durationMs: 500 },
        { type: "wait", durationMs: 500 },
      ]));
      sys.play("seq", ctx);
      expect(sys.getPlayheadStep("seq")).toBe(0);
    });

    it("getPlayheadStep returns null when not playing", () => {
      sys.registerSequence(makeSeq("seq", []));
      expect(sys.getPlayheadStep("seq")).toBeNull();
    });
  });

  // ── Step-type dispatches ───────────────────────────────────────────────────

  describe("look_at step", () => {
    it("calls cameraLookAt with correct args", () => {
      sys.registerSequence(makeSeq("seq", [{ type: "look_at", x: 5, y: 10, z: -3 }]));
      sys.play("seq", ctx);
      expect(ctx.lookAtCalls[0]).toEqual({ x: 5, y: 10, z: -3 });
    });

    it("does not throw when cameraLookAt callback is absent", () => {
      const bare: CameraScriptingContext = {};
      sys.registerSequence(makeSeq("seq", [{ type: "look_at", x: 0, y: 0, z: 0 }]));
      expect(() => sys.play("seq", bare)).not.toThrow();
    });
  });

  describe("pan_to step", () => {
    it("calls cameraPanTo with correct args", () => {
      sys.registerSequence(makeSeq("seq", [
        { type: "pan_to", x: 2, y: 3, z: 4, durationMs: 1500, easing: "ease_in_out" },
      ]));
      sys.play("seq", ctx);
      expect(ctx.panToCalls[0]).toEqual({ x: 2, y: 3, z: 4, durationMs: 1500, easing: "ease_in_out" });
    });

    it("uses default durationMs of 1000 when not specified", () => {
      sys.registerSequence(makeSeq("seq", [{ type: "pan_to", x: 0, y: 0, z: 0 }]));
      sys.play("seq", ctx);
      expect(ctx.panToCalls[0].durationMs).toBe(1000);
    });

    it("uses default easing of linear when not specified", () => {
      sys.registerSequence(makeSeq("seq", [{ type: "pan_to", x: 0, y: 0, z: 0 }]));
      sys.play("seq", ctx);
      expect(ctx.panToCalls[0].easing).toBe("linear");
    });

    it("does not throw when cameraPanTo callback is absent", () => {
      const bare: CameraScriptingContext = {};
      sys.registerSequence(makeSeq("seq", [{ type: "pan_to", x: 0, y: 0, z: 0 }]));
      expect(() => sys.play("seq", bare)).not.toThrow();
    });

    it("pan_to suspends execution for durationMs", () => {
      const onComplete = vi.fn();
      sys.onSequenceComplete = onComplete;
      sys.registerSequence(makeSeq("seq", [{ type: "pan_to", x: 0, y: 0, z: 0, durationMs: 600 }]));
      sys.play("seq", ctx);
      expect(onComplete).not.toHaveBeenCalled();
      sys.update(300, ctx);
      expect(onComplete).not.toHaveBeenCalled();
      sys.update(300, ctx);
      expect(onComplete).toHaveBeenCalledWith("seq");
    });
  });

  describe("fade_out step", () => {
    it("calls cameraFadeOut with correct durationMs", () => {
      sys.registerSequence(makeSeq("seq", [{ type: "fade_out", durationMs: 800 }]));
      sys.play("seq", ctx);
      expect(ctx.fadeOutCalls[0]).toBe(800);
    });

    it("uses default durationMs of 500 when not specified", () => {
      sys.registerSequence(makeSeq("seq", [{ type: "fade_out" }]));
      sys.play("seq", ctx);
      expect(ctx.fadeOutCalls[0]).toBe(500);
    });

    it("does not throw when cameraFadeOut callback is absent", () => {
      const bare: CameraScriptingContext = {};
      sys.registerSequence(makeSeq("seq", [{ type: "fade_out" }]));
      expect(() => sys.play("seq", bare)).not.toThrow();
    });
  });

  describe("fade_in step", () => {
    it("calls cameraFadeIn with correct durationMs", () => {
      sys.registerSequence(makeSeq("seq", [{ type: "fade_in", durationMs: 1200 }]));
      sys.play("seq", ctx);
      expect(ctx.fadeInCalls[0]).toBe(1200);
    });

    it("uses default durationMs of 500 when not specified", () => {
      sys.registerSequence(makeSeq("seq", [{ type: "fade_in" }]));
      sys.play("seq", ctx);
      expect(ctx.fadeInCalls[0]).toBe(500);
    });
  });

  describe("shake step", () => {
    it("calls cameraShake with correct intensity and durationMs", () => {
      sys.registerSequence(makeSeq("seq", [{ type: "shake", intensity: 0.8, durationMs: 300 }]));
      sys.play("seq", ctx);
      expect(ctx.shakeCalls[0]).toEqual({ intensity: 0.8, durationMs: 300 });
    });

    it("uses default intensity 0.5 and durationMs 500", () => {
      sys.registerSequence(makeSeq("seq", [{ type: "shake" }]));
      sys.play("seq", ctx);
      expect(ctx.shakeCalls[0]).toEqual({ intensity: 0.5, durationMs: 500 });
    });
  });

  describe("wait step", () => {
    it("wait step suspends execution without calling any camera callbacks", () => {
      sys.registerSequence(makeSeq("seq", [{ type: "wait", durationMs: 1000 }]));
      sys.play("seq", ctx);
      expect(ctx.lookAtCalls).toHaveLength(0);
      expect(ctx.panToCalls).toHaveLength(0);
      expect(ctx.fadeOutCalls).toHaveLength(0);
      expect(ctx.fadeInCalls).toHaveLength(0);
      expect(ctx.shakeCalls).toHaveLength(0);
    });

    it("update() with sufficient time advances past a wait step", () => {
      const onComplete = vi.fn();
      sys.onSequenceComplete = onComplete;
      sys.registerSequence(makeSeq("seq", [{ type: "wait", durationMs: 500 }]));
      sys.play("seq", ctx);
      sys.update(500, ctx);
      expect(onComplete).toHaveBeenCalledWith("seq");
    });

    it("update() with insufficient time keeps the sequence waiting", () => {
      const onComplete = vi.fn();
      sys.onSequenceComplete = onComplete;
      sys.registerSequence(makeSeq("seq", [{ type: "wait", durationMs: 1000 }]));
      sys.play("seq", ctx);
      sys.update(400, ctx);
      expect(onComplete).not.toHaveBeenCalled();
      expect(sys.isPlaying("seq")).toBe(true);
    });

    it("paused sequences do not advance during update", () => {
      const onComplete = vi.fn();
      sys.onSequenceComplete = onComplete;
      sys.registerSequence(makeSeq("seq", [{ type: "wait", durationMs: 200 }]));
      sys.play("seq", ctx);
      sys.pause("seq");
      sys.update(500, ctx);
      expect(onComplete).not.toHaveBeenCalled();
    });
  });

  // ── Multi-step sequences ───────────────────────────────────────────────────

  describe("multi-step sequences", () => {
    it("all steps execute in order", () => {
      const order: string[] = [];
      sys.onStepBegin = (_id, _idx, step) => order.push(step.type);
      sys.registerSequence(makeSeq("seq", [
        { type: "fade_out", durationMs: 100 },
        { type: "look_at",  x: 0, y: 0, z: 0 },
        { type: "fade_in",  durationMs: 100 },
      ]));
      sys.play("seq", ctx);       // starts fade_out
      sys.update(100, ctx);       // completes fade_out → starts look_at → immediately starts fade_in
      sys.update(100, ctx);       // completes fade_in
      expect(order).toEqual(["fade_out", "look_at", "fade_in"]);
    });

    it("onStepBegin fires for each step with correct indices", () => {
      const indices: number[] = [];
      sys.onStepBegin = (_id, idx) => indices.push(idx);
      sys.registerSequence(makeSeq("seq", [
        { type: "wait", durationMs: 100 },
        { type: "wait", durationMs: 100 },
        { type: "wait", durationMs: 100 },
      ]));
      sys.play("seq", ctx);      // step 0
      sys.update(100, ctx);      // step 0 done → step 1
      sys.update(100, ctx);      // step 1 done → step 2
      expect(indices).toEqual([0, 1, 2]);
    });

    it("onStepComplete fires for each completed step", () => {
      const completed: number[] = [];
      sys.onStepComplete = (_id, idx) => completed.push(idx);
      sys.registerSequence(makeSeq("seq", [
        { type: "wait", durationMs: 50 },
        { type: "wait", durationMs: 50 },
      ]));
      sys.play("seq", ctx);
      sys.update(50, ctx);   // step 0 complete
      sys.update(50, ctx);   // step 1 complete
      expect(completed).toContain(0);
      expect(completed).toContain(1);
    });

    it("onSequenceComplete fires when last step finishes", () => {
      const onComplete = vi.fn();
      sys.onSequenceComplete = onComplete;
      sys.registerSequence(makeSeq("seq", [
        { type: "look_at", x: 0, y: 0, z: 0 },
        { type: "look_at", x: 1, y: 1, z: 1 },
      ]));
      sys.play("seq", ctx);
      expect(onComplete).toHaveBeenCalledWith("seq");
    });
  });

  // ── Loop ──────────────────────────────────────────────────────────────────

  describe("loop", () => {
    it("looping sequence restarts from step 0 after the last step", () => {
      let stepBeginCount = 0;
      sys.onStepBegin = () => stepBeginCount++;
      sys.registerSequence(makeSeq("seq", [
        { type: "wait", durationMs: 100 },
      ], { loop: true }));
      sys.play("seq", ctx);       // step 0 begins (count=1)
      sys.update(100, ctx);       // step 0 done → loops to step 0 again (count=2)
      sys.update(100, ctx);       // step 0 done → loops again (count=3)
      expect(stepBeginCount).toBe(3);
      expect(sys.isPlaying("seq")).toBe(true);
    });

    it("onSequenceComplete is NOT fired for looping sequences", () => {
      const onComplete = vi.fn();
      sys.onSequenceComplete = onComplete;
      sys.registerSequence(makeSeq("seq", [
        { type: "wait", durationMs: 100 },
      ], { loop: true }));
      sys.play("seq", ctx);
      sys.update(100, ctx);
      expect(onComplete).not.toHaveBeenCalled();
    });

    it("non-looping sequence fires onSequenceComplete and stops", () => {
      const onComplete = vi.fn();
      sys.onSequenceComplete = onComplete;
      sys.registerSequence(makeSeq("seq", [{ type: "wait", durationMs: 100 }]));
      sys.play("seq", ctx);
      sys.update(100, ctx);
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(sys.isPlaying("seq")).toBe(false);
    });
  });

  // ── jumpToStep() ──────────────────────────────────────────────────────────

  describe("jumpToStep()", () => {
    it("moves to the given step index and executes it", () => {
      sys.registerSequence(makeSeq("seq", [
        { type: "wait", durationMs: 1000 },
        { type: "look_at", x: 5, y: 5, z: 5 },
      ]));
      sys.play("seq", ctx);
      expect(ctx.lookAtCalls).toHaveLength(0);
      sys.jumpToStep("seq", 1, ctx);
      expect(ctx.lookAtCalls).toHaveLength(1);
      expect(sys.getPlayheadStep("seq")).toBeNull(); // completed synchronously
    });

    it("fires onStepBegin for the target step", () => {
      const onStepBegin = vi.fn();
      sys.onStepBegin = onStepBegin;
      sys.registerSequence(makeSeq("seq", [
        { type: "wait", durationMs: 1000 },
        { type: "wait", durationMs: 500 },
      ]));
      sys.play("seq", ctx);
      sys.jumpToStep("seq", 1, ctx);
      const calls = onStepBegin.mock.calls;
      const jumpCall = calls.find(([, idx]) => idx === 1);
      expect(jumpCall).toBeDefined();
    });

    it("returns false when sequence is not playing", () => {
      sys.registerSequence(makeSeq("seq", [{ type: "wait", durationMs: 100 }]));
      expect(sys.jumpToStep("seq", 0, ctx)).toBe(false);
    });

    it("returns false for an out-of-range step index", () => {
      sys.registerSequence(makeSeq("seq", [{ type: "wait", durationMs: 100 }]));
      sys.play("seq", ctx);
      expect(sys.jumpToStep("seq", 5, ctx)).toBe(false);
    });
  });

  // ── playingSequences accessor ──────────────────────────────────────────────

  describe("playingSequences", () => {
    it("returns all currently playing states", () => {
      sys.registerSequence(makeSeq("a", [{ type: "wait", durationMs: 100 }]));
      sys.registerSequence(makeSeq("b", [{ type: "wait", durationMs: 100 }]));
      sys.play("a", ctx);
      sys.play("b", ctx);
      expect(sys.playingSequences).toHaveLength(2);
    });
  });

  // ── Save / Restore ────────────────────────────────────────────────────────

  describe("getSnapshot / restoreSnapshot", () => {
    it("getSnapshot captures current playing state", () => {
      sys.registerSequence(makeSeq("seq", [{ type: "wait", durationMs: 1000 }]));
      sys.play("seq", ctx);
      const snap = sys.getSnapshot();
      expect(snap.playing).toHaveLength(1);
      expect(snap.playing[0].sequenceId).toBe("seq");
      expect(snap.playing[0].stepIndex).toBe(0);
    });

    it("restoreSnapshot resumes playback from saved state", () => {
      sys.registerSequence(makeSeq("seq", [
        { type: "wait", durationMs: 500 },
        { type: "wait", durationMs: 500 },
      ]));
      sys.play("seq", ctx);
      sys.update(500, ctx);          // advance to step 1
      const snap = sys.getSnapshot();
      expect(snap.playing[0].stepIndex).toBe(1);

      const sys2 = new CameraScriptingSystem();
      sys2.registerSequence(makeSeq("seq", [
        { type: "wait", durationMs: 500 },
        { type: "wait", durationMs: 500 },
      ]));
      sys2.restoreSnapshot(snap);
      expect(sys2.isPlaying("seq")).toBe(true);
      expect(sys2.getPlayheadStep("seq")).toBe(1);
    });

    it("restoreSnapshot does not fire callbacks", () => {
      const onComplete = vi.fn();
      sys.registerSequence(makeSeq("seq", [{ type: "wait", durationMs: 100 }]));
      sys.play("seq", ctx);
      const snap = sys.getSnapshot();

      const sys2 = new CameraScriptingSystem();
      sys2.onSequenceComplete = onComplete;
      sys2.registerSequence(makeSeq("seq", [{ type: "wait", durationMs: 100 }]));
      sys2.restoreSnapshot(snap);
      expect(onComplete).not.toHaveBeenCalled();
    });

    it("restoreSnapshot skips sequences that are no longer registered", () => {
      sys.registerSequence(makeSeq("seq", [{ type: "wait", durationMs: 100 }]));
      sys.play("seq", ctx);
      const snap = sys.getSnapshot();

      const sys2 = new CameraScriptingSystem(); // seq not registered
      sys2.restoreSnapshot(snap);
      expect(sys2.isPlaying("seq")).toBe(false);
    });

    it("restoreSnapshot handles null/undefined gracefully", () => {
      expect(() => sys.restoreSnapshot(null as unknown as never)).not.toThrow();
    });
  });

  // ── Spline path step ──────────────────────────────────────────────────────

  describe("spline_path step", () => {
    const waypoints: SplineWaypoint[] = [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 5, z: 0 },
      { x: 20, y: 0, z: 10 },
      { x: 30, y: 5, z: 10 },
    ];

    it("is a timed step with default duration 2000ms", () => {
      sys.registerSequence(makeSeq("spline", [
        { type: "spline_path", waypoints },
      ]));
      sys.play("spline", ctx);
      expect(sys.isPlaying("spline")).toBe(true);
      // After 1000ms it should still be playing
      sys.update(1000, ctx);
      expect(sys.isPlaying("spline")).toBe(true);
      // After 2000ms total it completes
      sys.update(1100, ctx);
      expect(sys.isPlaying("spline")).toBe(false);
    });

    it("respects custom durationMs", () => {
      sys.registerSequence(makeSeq("spline", [
        { type: "spline_path", waypoints, durationMs: 500 },
      ]));
      sys.play("spline", ctx);
      sys.update(600, ctx);
      expect(sys.isPlaying("spline")).toBe(false);
    });

    it("calls cameraSetPosition on play (initial waypoint)", () => {
      sys.registerSequence(makeSeq("spline", [
        { type: "spline_path", waypoints },
      ]));
      sys.play("spline", ctx);
      expect(ctx.setPosCalls.length).toBeGreaterThanOrEqual(1);
      expect(ctx.setPosCalls[0]).toEqual({ x: 0, y: 0, z: 0 });
    });

    it("calls cameraSetPosition during update", () => {
      sys.registerSequence(makeSeq("spline", [
        { type: "spline_path", waypoints, durationMs: 1000 },
      ]));
      sys.play("spline", ctx);
      const initialCalls = ctx.setPosCalls.length;
      sys.update(500, ctx);
      expect(ctx.setPosCalls.length).toBeGreaterThan(initialCalls);
    });

    it("interpolated position is between waypoints", () => {
      sys.registerSequence(makeSeq("spline", [
        { type: "spline_path", waypoints, durationMs: 1000 },
      ]));
      sys.play("spline", ctx);
      sys.update(500, ctx); // 50%
      const midPos = ctx.setPosCalls[ctx.setPosCalls.length - 1];
      // At 50%, position should be somewhere in the middle
      expect(midPos.x).toBeGreaterThan(0);
      expect(midPos.x).toBeLessThan(30);
    });

    it("calls cameraLookAt when lookAt is specified", () => {
      sys.registerSequence(makeSeq("spline", [
        { type: "spline_path", waypoints, durationMs: 1000, lookAt: { x: 15, y: 0, z: 5 } },
      ]));
      sys.play("spline", ctx);
      expect(ctx.lookAtCalls.some(c => c.x === 15 && c.y === 0 && c.z === 5)).toBe(true);
      sys.update(500, ctx);
      // lookAt should be called again during update
      expect(ctx.lookAtCalls.filter(c => c.x === 15).length).toBeGreaterThan(1);
    });

    it("completes and fires onStepComplete", () => {
      const cb = vi.fn();
      sys.onStepComplete = cb;
      sys.registerSequence(makeSeq("spline", [
        { type: "spline_path", waypoints, durationMs: 500 },
      ]));
      sys.play("spline", ctx);
      sys.update(600, ctx);
      // onStepComplete fires for the spline_path step
      expect(cb).toHaveBeenCalled();
    });

    it("advances to next step after completion", () => {
      sys.registerSequence(makeSeq("spline", [
        { type: "spline_path", waypoints, durationMs: 200 },
        { type: "look_at", x: 99, y: 99, z: 99 },
      ]));
      sys.play("spline", ctx);
      sys.update(300, ctx);
      expect(ctx.lookAtCalls.some(c => c.x === 99)).toBe(true);
    });
  });

  // ── Catmull-Rom static method ─────────────────────────────────────────────

  describe("CameraScriptingSystem.catmullRom()", () => {
    const waypoints: SplineWaypoint[] = [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 10, z: 0 },
      { x: 20, y: 0, z: 10 },
    ];

    it("returns first waypoint at t=0", () => {
      const pos = CameraScriptingSystem.catmullRom(waypoints, 0);
      expect(pos.x).toBeCloseTo(0);
      expect(pos.y).toBeCloseTo(0);
      expect(pos.z).toBeCloseTo(0);
    });

    it("returns last waypoint at t=1", () => {
      const pos = CameraScriptingSystem.catmullRom(waypoints, 1);
      expect(pos.x).toBeCloseTo(20);
      expect(pos.y).toBeCloseTo(0);
      expect(pos.z).toBeCloseTo(10);
    });

    it("returns interpolated position at t=0.5", () => {
      const pos = CameraScriptingSystem.catmullRom(waypoints, 0.5);
      expect(pos.x).toBeGreaterThan(0);
      expect(pos.x).toBeLessThan(20);
    });

    it("handles single waypoint", () => {
      const pos = CameraScriptingSystem.catmullRom([{ x: 5, y: 5, z: 5 }], 0.5);
      expect(pos).toEqual({ x: 5, y: 5, z: 5 });
    });

    it("handles empty waypoints", () => {
      const pos = CameraScriptingSystem.catmullRom([], 0.5);
      expect(pos).toEqual({ x: 0, y: 0, z: 0 });
    });

    it("clamps t below 0 to first waypoint", () => {
      const pos = CameraScriptingSystem.catmullRom(waypoints, -0.5);
      expect(pos.x).toBeCloseTo(0);
    });

    it("clamps t above 1 to last waypoint", () => {
      const pos = CameraScriptingSystem.catmullRom(waypoints, 1.5);
      expect(pos.x).toBeCloseTo(20);
    });

    it("produces smooth curve (no sharp jumps)", () => {
      const steps = 20;
      const positions: SplineWaypoint[] = [];
      for (let i = 0; i <= steps; i++) {
        positions.push(CameraScriptingSystem.catmullRom(waypoints, i / steps));
      }
      // Check that consecutive positions don't jump too far
      for (let i = 1; i < positions.length; i++) {
        const dx = positions[i].x - positions[i - 1].x;
        const dy = positions[i].y - positions[i - 1].y;
        const dz = positions[i].z - positions[i - 1].z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        expect(dist).toBeLessThan(5); // no jumps > 5 units
      }
    });

    it("passes through start and end points exactly for two waypoints", () => {
      const two: SplineWaypoint[] = [
        { x: 0, y: 0, z: 0 },
        { x: 10, y: 10, z: 10 },
      ];
      expect(CameraScriptingSystem.catmullRom(two, 0)).toEqual({ x: 0, y: 0, z: 0 });
      expect(CameraScriptingSystem.catmullRom(two, 1)).toEqual({ x: 10, y: 10, z: 10 });
    });
  });
});
