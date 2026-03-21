import { describe, it, expect, vi, beforeEach } from "vitest";
import { WeatherScheduleSystem } from "./weather-schedule-system";
import type {
  WeatherScheduleDefinition,
  WeatherScheduleStep,
  WeatherScheduleSnapshot,
} from "./weather-schedule-system";

// ── Fixture helpers ───────────────────────────────────────────────────────────

const simpleDayNightSchedule: WeatherScheduleDefinition = {
  id: "day_night",
  label: "Day / Night Cycle",
  description: "A simple two-step clear/overcast loop.",
  steps: [
    { weather: "clear", durationSeconds: 600, label: "Daytime" },
    { weather: "overcast", durationSeconds: 300, label: "Dusk" },
  ],
  loop: true,
};

const stormSchedule: WeatherScheduleDefinition = {
  id: "storm_sequence",
  label: "Approaching Storm",
  steps: [
    { weather: "overcast", durationSeconds: 30 },
    { weather: "rain", durationSeconds: 60 },
    { weather: "storm", durationSeconds: 120 },
    { weather: "rain", durationSeconds: 60 },
    { weather: "clear", durationSeconds: 30 },
  ],
  loop: false,
};

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("WeatherScheduleSystem", () => {
  let sys: WeatherScheduleSystem;

  beforeEach(() => {
    sys = new WeatherScheduleSystem();
  });

  // ── addSchedule ───────────────────────────────────────────────────────────

  describe("addSchedule", () => {
    it("registers a valid schedule", () => {
      sys.addSchedule(simpleDayNightSchedule);
      expect(sys.scheduleCount).toBe(1);
    });

    it("getSchedule returns a shallow copy", () => {
      sys.addSchedule(simpleDayNightSchedule);
      const def = sys.getSchedule("day_night")!;
      expect(def.id).toBe("day_night");
      expect(def.loop).toBe(true);
      expect(def.steps).toHaveLength(2);
    });

    it("replaces an existing schedule with the same id", () => {
      sys.addSchedule(simpleDayNightSchedule);
      const updated: WeatherScheduleDefinition = {
        ...simpleDayNightSchedule,
        label: "Updated",
        steps: [{ weather: "foggy", durationSeconds: 100 }],
      };
      sys.addSchedule(updated);
      expect(sys.scheduleCount).toBe(1);
      expect(sys.getSchedule("day_night")!.label).toBe("Updated");
    });

    it("throws on empty id", () => {
      expect(() =>
        sys.addSchedule({ id: "", label: "x", steps: [{ weather: "clear", durationSeconds: 10 }] }),
      ).toThrow();
    });

    it("throws on empty steps array", () => {
      expect(() =>
        sys.addSchedule({ id: "empty", label: "x", steps: [] }),
      ).toThrow();
    });

    it("throws when a step has non-positive durationSeconds", () => {
      expect(() =>
        sys.addSchedule({
          id: "bad",
          label: "x",
          steps: [{ weather: "clear", durationSeconds: 0 }],
        }),
      ).toThrow();

      expect(() =>
        sys.addSchedule({
          id: "neg",
          label: "x",
          steps: [{ weather: "clear", durationSeconds: -5 }],
        }),
      ).toThrow();
    });

    it("throws when a step has no weather value", () => {
      expect(() =>
        sys.addSchedule({
          id: "noWeather",
          label: "x",
          steps: [{ weather: "" as any, durationSeconds: 10 }],
        }),
      ).toThrow();
    });
  });

  // ── removeSchedule ────────────────────────────────────────────────────────

  describe("removeSchedule", () => {
    it("returns true and removes a known schedule", () => {
      sys.addSchedule(simpleDayNightSchedule);
      expect(sys.removeSchedule("day_night")).toBe(true);
      expect(sys.scheduleCount).toBe(0);
    });

    it("returns false for an unknown id", () => {
      expect(sys.removeSchedule("nonexistent")).toBe(false);
    });

    it("stops active playback when the active schedule is removed", () => {
      sys.addSchedule(simpleDayNightSchedule);
      sys.play("day_night");
      expect(sys.isPlaying).toBe(true);
      sys.removeSchedule("day_night");
      expect(sys.isPlaying).toBe(false);
    });
  });

  // ── getScheduleIds ────────────────────────────────────────────────────────

  describe("getScheduleIds", () => {
    it("returns ids in insertion order", () => {
      sys.addSchedule(simpleDayNightSchedule);
      sys.addSchedule(stormSchedule);
      expect(sys.getScheduleIds()).toEqual(["day_night", "storm_sequence"]);
    });

    it("returns empty array when no schedules are registered", () => {
      expect(sys.getScheduleIds()).toEqual([]);
    });
  });

  // ── play ──────────────────────────────────────────────────────────────────

  describe("play", () => {
    it("starts playback from step 0", () => {
      sys.addSchedule(stormSchedule);
      sys.play("storm_sequence");
      expect(sys.isPlaying).toBe(true);
      expect(sys.currentStepIndex).toBe(0);
      expect(sys.activeScheduleId).toBe("storm_sequence");
    });

    it("fires onStep callback with the first step", () => {
      sys.addSchedule(stormSchedule);
      const cb = vi.fn();
      sys.onStep = cb;
      sys.play("storm_sequence");
      expect(cb).toHaveBeenCalledOnce();
      expect(cb).toHaveBeenCalledWith("storm_sequence", 0, stormSchedule.steps[0]);
    });

    it("throws for an unknown schedule id", () => {
      expect(() => sys.play("unknown")).toThrow();
    });

    it("sets stepTimeRemaining to the first step duration", () => {
      sys.addSchedule(stormSchedule);
      sys.play("storm_sequence");
      expect(sys.stepTimeRemaining).toBeCloseTo(30);
    });
  });

  // ── stop ──────────────────────────────────────────────────────────────────

  describe("stop", () => {
    it("stops playback and resets state", () => {
      sys.addSchedule(stormSchedule);
      sys.play("storm_sequence");
      sys.stop();
      expect(sys.isPlaying).toBe(false);
      expect(sys.activeScheduleId).toBeNull();
      expect(sys.stepTimeRemaining).toBe(0);
    });

    it("is a no-op when already idle", () => {
      expect(() => sys.stop()).not.toThrow();
    });
  });

  // ── pause / resume ────────────────────────────────────────────────────────

  describe("pause / resume", () => {
    it("pauses and resumes playback", () => {
      sys.addSchedule(stormSchedule);
      sys.play("storm_sequence");
      sys.pause();
      expect(sys.isPaused).toBe(true);
      sys.resume();
      expect(sys.isPaused).toBe(false);
    });

    it("pause has no effect when idle", () => {
      sys.pause();
      expect(sys.isPaused).toBe(false);
    });

    it("does not advance time while paused", () => {
      sys.addSchedule(stormSchedule);
      sys.play("storm_sequence");
      const before = sys.stepTimeRemaining;
      sys.pause();
      sys.update(15);
      expect(sys.stepTimeRemaining).toBeCloseTo(before);
    });
  });

  // ── jumpToStep ────────────────────────────────────────────────────────────

  describe("jumpToStep", () => {
    it("jumps to the specified step index", () => {
      sys.addSchedule(stormSchedule);
      sys.play("storm_sequence");
      sys.jumpToStep(2);
      expect(sys.currentStepIndex).toBe(2);
      expect(sys.currentStep?.weather).toBe("storm");
      expect(sys.stepTimeRemaining).toBeCloseTo(120);
    });

    it("fires onStep when jumping", () => {
      sys.addSchedule(stormSchedule);
      sys.play("storm_sequence");
      const cb = vi.fn();
      sys.onStep = cb;
      sys.jumpToStep(3);
      expect(cb).toHaveBeenCalledWith("storm_sequence", 3, stormSchedule.steps[3]);
    });

    it("throws when no schedule is active", () => {
      expect(() => sys.jumpToStep(0)).toThrow();
    });

    it("throws on out-of-range index", () => {
      sys.addSchedule(stormSchedule);
      sys.play("storm_sequence");
      expect(() => sys.jumpToStep(99)).toThrow();
      expect(() => sys.jumpToStep(-1)).toThrow();
    });
  });

  // ── update — natural step advance ─────────────────────────────────────────

  describe("update — step advancement", () => {
    it("advances to the next step when time expires", () => {
      sys.addSchedule(stormSchedule);
      sys.play("storm_sequence");
      const stepCb = vi.fn();
      sys.onStep = stepCb;
      // Advance past first step (30s)
      sys.update(31);
      expect(sys.currentStepIndex).toBe(1);
      expect(sys.currentStep?.weather).toBe("rain");
      expect(stepCb).toHaveBeenCalledWith("storm_sequence", 1, stormSchedule.steps[1]);
    });

    it("carries over excess time to the next step", () => {
      sys.addSchedule(stormSchedule);
      sys.play("storm_sequence");
      // First step is 30s; advance 35s: 5s should carry over into next step (60s)
      sys.update(35);
      expect(sys.currentStepIndex).toBe(1);
      expect(sys.stepTimeRemaining).toBeCloseTo(55);
    });

    it("can advance multiple steps in a single update", () => {
      sys.addSchedule(stormSchedule);
      sys.play("storm_sequence");
      // Steps: 30 + 60 = 90s covers first two steps
      sys.update(91);
      expect(sys.currentStepIndex).toBe(2);
    });

    it("fires onComplete when the non-looping schedule ends", () => {
      sys.addSchedule(stormSchedule);
      sys.play("storm_sequence");
      const completeCb = vi.fn();
      sys.onComplete = completeCb;
      const totalDuration = stormSchedule.steps.reduce((sum, s) => sum + s.durationSeconds, 0);
      sys.update(totalDuration + 1);
      expect(sys.isPlaying).toBe(false);
      expect(completeCb).toHaveBeenCalledWith("storm_sequence");
    });

    it("loops back to step 0 after the last step when loop=true", () => {
      sys.addSchedule(simpleDayNightSchedule);
      sys.play("day_night");
      const stepCb = vi.fn();
      sys.onStep = stepCb;
      // Total loop = 600 + 300 = 900s; advance past it
      sys.update(901);
      // Should be back at step 0
      expect(sys.currentStepIndex).toBe(0);
      expect(sys.isPlaying).toBe(true);
    });

    it("does not fire onComplete for looping schedules", () => {
      sys.addSchedule(simpleDayNightSchedule);
      sys.play("day_night");
      const completeCb = vi.fn();
      sys.onComplete = completeCb;
      sys.update(901);
      expect(completeCb).not.toHaveBeenCalled();
    });

    it("is a no-op when idle", () => {
      expect(() => sys.update(100)).not.toThrow();
      expect(sys.isPlaying).toBe(false);
    });
  });

  // ── currentStep ───────────────────────────────────────────────────────────

  describe("currentStep", () => {
    it("returns null when idle", () => {
      expect(sys.currentStep).toBeNull();
    });

    it("returns the current step data while playing", () => {
      sys.addSchedule(stormSchedule);
      sys.play("storm_sequence");
      const step = sys.currentStep!;
      expect(step.weather).toBe("overcast");
      expect(step.durationSeconds).toBe(30);
    });
  });

  // ── snapshot / restore ────────────────────────────────────────────────────

  describe("getSnapshot / restoreSnapshot", () => {
    it("snapshot captures idle state", () => {
      const snap = sys.getSnapshot();
      expect(snap.activeScheduleId).toBeNull();
      expect(snap.currentStepIndex).toBe(0);
      expect(snap.stepTimeRemaining).toBe(0);
      expect(snap.paused).toBe(false);
    });

    it("snapshot captures playing state", () => {
      sys.addSchedule(stormSchedule);
      sys.play("storm_sequence");
      sys.update(10);
      const snap = sys.getSnapshot();
      expect(snap.activeScheduleId).toBe("storm_sequence");
      expect(snap.currentStepIndex).toBe(0);
      expect(snap.stepTimeRemaining).toBeCloseTo(20);
      expect(snap.paused).toBe(false);
    });

    it("snapshot captures paused state", () => {
      sys.addSchedule(stormSchedule);
      sys.play("storm_sequence");
      sys.pause();
      const snap = sys.getSnapshot();
      expect(snap.paused).toBe(true);
    });

    it("restores playing state without firing callbacks", () => {
      sys.addSchedule(stormSchedule);
      const stepCb = vi.fn();
      sys.onStep = stepCb;
      const snap: WeatherScheduleSnapshot = {
        activeScheduleId: "storm_sequence",
        currentStepIndex: 2,
        stepTimeRemaining: 50,
        paused: false,
      };
      sys.restoreSnapshot(snap);
      // No callback should fire during restore
      expect(stepCb).not.toHaveBeenCalled();
      expect(sys.activeScheduleId).toBe("storm_sequence");
      expect(sys.currentStepIndex).toBe(2);
      expect(sys.stepTimeRemaining).toBeCloseTo(50);
      expect(sys.isPaused).toBe(false);
    });

    it("restores paused state", () => {
      sys.addSchedule(stormSchedule);
      const snap: WeatherScheduleSnapshot = {
        activeScheduleId: "storm_sequence",
        currentStepIndex: 1,
        stepTimeRemaining: 40,
        paused: true,
      };
      sys.restoreSnapshot(snap);
      expect(sys.isPaused).toBe(true);
    });

    it("ignores unknown schedule id in snapshot", () => {
      const snap: WeatherScheduleSnapshot = {
        activeScheduleId: "nonexistent",
        currentStepIndex: 0,
        stepTimeRemaining: 10,
        paused: false,
      };
      sys.restoreSnapshot(snap);
      expect(sys.isPlaying).toBe(false);
      expect(sys.activeScheduleId).toBeNull();
    });

    it("restores idle state from null activeScheduleId", () => {
      sys.addSchedule(stormSchedule);
      sys.play("storm_sequence");
      const snap: WeatherScheduleSnapshot = {
        activeScheduleId: null,
        currentStepIndex: 0,
        stepTimeRemaining: 0,
        paused: false,
      };
      sys.restoreSnapshot(snap);
      expect(sys.isPlaying).toBe(false);
    });

    it("round-trip snapshot preserves state accurately", () => {
      sys.addSchedule(stormSchedule);
      sys.play("storm_sequence");
      sys.update(10);
      const snap = sys.getSnapshot();

      const sys2 = new WeatherScheduleSystem();
      sys2.addSchedule(stormSchedule);
      sys2.restoreSnapshot(snap);

      expect(sys2.activeScheduleId).toBe(sys.activeScheduleId);
      expect(sys2.currentStepIndex).toBe(sys.currentStepIndex);
      expect(sys2.stepTimeRemaining).toBeCloseTo(sys.stepTimeRemaining);
      expect(sys2.isPaused).toBe(sys.isPaused);
    });

    it("handles malformed snapshot gracefully (clamps step index)", () => {
      sys.addSchedule(stormSchedule);
      const snap: WeatherScheduleSnapshot = {
        activeScheduleId: "storm_sequence",
        currentStepIndex: 999,
        stepTimeRemaining: 10,
        paused: false,
      };
      sys.restoreSnapshot(snap);
      expect(sys.currentStepIndex).toBe(stormSchedule.steps.length - 1);
    });
  });

  // ── multi-schedule management ─────────────────────────────────────────────

  describe("multi-schedule management", () => {
    it("can register multiple schedules", () => {
      sys.addSchedule(simpleDayNightSchedule);
      sys.addSchedule(stormSchedule);
      expect(sys.scheduleCount).toBe(2);
      expect(sys.getScheduleIds()).toContain("day_night");
      expect(sys.getScheduleIds()).toContain("storm_sequence");
    });

    it("switching schedules stops the previous one", () => {
      sys.addSchedule(simpleDayNightSchedule);
      sys.addSchedule(stormSchedule);
      sys.play("day_night");
      sys.play("storm_sequence");
      expect(sys.activeScheduleId).toBe("storm_sequence");
      expect(sys.currentStepIndex).toBe(0);
    });
  });
});
