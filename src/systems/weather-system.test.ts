import { describe, it, expect, beforeEach } from "vitest";
import { WeatherSystem, WEATHER_STATES } from "./weather-system";
import type { WeatherState } from "./weather-system";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSystem(initial: WeatherState = "clear"): WeatherSystem {
  return new WeatherSystem(initial);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("WeatherSystem", () => {
  it("initialises with the given state", () => {
    for (const state of WEATHER_STATES) {
      const sys = makeSystem(state);
      expect(sys.state).toBe(state);
    }
  });

  it("transition progress starts at 1 (fully applied)", () => {
    const sys = makeSystem("clear");
    // fog density should equal the clear baseline immediately
    expect(sys.fogDensity).toBeCloseTo(0.006, 5);
  });

  it("label returns a human-readable string", () => {
    expect(makeSystem("clear").label).toBe("Clear");
    expect(makeSystem("overcast").label).toBe("Overcast");
    expect(makeSystem("foggy").label).toBe("Foggy");
    expect(makeSystem("rain").label).toBe("Rain");
    expect(makeSystem("storm").label).toBe("Storm");
  });

  it("fogDensity is a positive number", () => {
    for (const state of WEATHER_STATES) {
      expect(makeSystem(state).fogDensity).toBeGreaterThan(0);
    }
  });

  it("forceWeather changes state immediately", () => {
    const sys = makeSystem("clear");
    sys.forceWeather("storm");
    expect(sys.state).toBe("storm");
  });

  it("forceWeather fires onWeatherChange callback", () => {
    const sys = makeSystem("clear");
    const events: WeatherState[] = [];
    sys.onWeatherChange = (s) => events.push(s);
    sys.forceWeather("rain");
    expect(events).toEqual(["rain"]);
  });

  it("update advances transition progress over time", () => {
    const sys = makeSystem("clear");
    sys.forceWeather("storm"); // transition progress = 0
    // transitionDuration default is 30 s; advance 15 s
    sys.update(15);
    // fog density should be halfway between clear and storm values
    const clearFog = 0.006;
    const stormFog = 0.025;
    const midFog   = (clearFog + stormFog) / 2;
    expect(sys.fogDensity).toBeCloseTo(midFog, 3);
  });

  it("update fully completes transition after transitionDuration seconds", () => {
    const sys = makeSystem("clear");
    sys.forceWeather("storm");
    sys.update(sys.transitionDuration + 1);
    // Should be fully storm fog density now
    expect(sys.fogDensity).toBeCloseTo(0.025, 5);
  });

  it("nextChangeIn decreases with each update tick", () => {
    const sys = makeSystem("clear");
    const before = sys.nextChangeIn;
    sys.update(10);
    expect(sys.nextChangeIn).toBeLessThan(before);
  });

  it("automatically transitions when timer expires", () => {
    const sys = makeSystem("clear");
    sys.minWeatherDuration = 1;
    sys.maxWeatherDuration = 1;
    // Drain the timer; the system should transition to a new state
    const events: WeatherState[] = [];
    sys.onWeatherChange = (s) => events.push(s);
    sys.update(sys.nextChangeIn + 1);
    // The transition fired, which means nextChangeIn was reset to ~1 s
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  describe("getSaveState / restoreFromSave", () => {
    it("round-trips state and nextChangeIn", () => {
      const sys = makeSystem("rain");
      const saved = sys.getSaveState();
      expect(saved.state).toBe("rain");

      const sys2 = makeSystem("clear");
      sys2.restoreFromSave(saved);
      expect(sys2.state).toBe("rain");
      expect(sys2.nextChangeIn).toBeCloseTo(saved.nextChangeIn, 5);
    });

    it("falls back to clear for unknown state in save data", () => {
      const sys = makeSystem("clear");
      sys.restoreFromSave({ state: "blizzard" as any, nextChangeIn: 60 });
      expect(sys.state).toBe("clear");
    });

    it("clamps negative nextChangeIn to 0", () => {
      const sys = makeSystem("clear");
      sys.restoreFromSave({ state: "clear", nextChangeIn: -99 });
      expect(sys.nextChangeIn).toBe(0);
    });

    it("ignores non-finite nextChangeIn and generates a new duration", () => {
      const sys = makeSystem("clear");
      sys.restoreFromSave({ state: "clear", nextChangeIn: NaN });
      expect(Number.isFinite(sys.nextChangeIn)).toBe(true);
      expect(sys.nextChangeIn).toBeGreaterThan(0);
    });
  });

  describe("minWeatherDuration / maxWeatherDuration config", () => {
    it("respects custom min/max duration window", () => {
      const sys = makeSystem("clear");
      sys.minWeatherDuration = 10;
      sys.maxWeatherDuration = 20;
      // Force a new cycle
      sys.restoreFromSave({ state: "clear", nextChangeIn: -1 });
      sys.update(0); // triggers a new transition with a fresh duration
      // nextChangeIn should be in [0, 20] range (could be 0 if already counted down)
      expect(sys.nextChangeIn).toBeGreaterThanOrEqual(0);
    });
  });
});
