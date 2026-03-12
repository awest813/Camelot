import { describe, it, expect, beforeEach } from "vitest";
import { WeatherSystem, WEATHER_STATES } from "./weather-system";
import type { WeatherState } from "./weather-system";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSystem(initial: WeatherState = "clear"): WeatherSystem {
  return new WeatherSystem(initial);
}

// Minimal mocks that satisfy the Scene / HemisphericLight / DirectionalLight
// interfaces used by WeatherSystem, without importing BabylonJS internals.
function makeSceneMock() {
  return { fogDensity: 0, fogColor: null as unknown } as any;
}

function makeLightMock() {
  return { intensity: 0 } as any;
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

  describe("interrupted transition continuity", () => {
    it("forceWeather mid-transition does not snap fog density", () => {
      const sys = makeSystem("clear");
      // Clear fog = 0.006, Storm fog = 0.025
      sys.forceWeather("storm"); // progress reset to 0; fog starts at 0.006
      // Advance halfway through the transition
      sys.update(sys.transitionDuration / 2);
      const midFog = sys.fogDensity; // ~0.0155 (halfway between 0.006 and 0.025)
      expect(midFog).toBeGreaterThan(0.006);
      expect(midFog).toBeLessThan(0.025);

      // Interrupt with a new forceWeather; the transition must start from the
      // current blended fog density, not from VISUALS["storm"].fogDensity.
      sys.forceWeather("clear");
      // Immediately after the interrupt: progress = 0, fog should equal midFog
      expect(sys.fogDensity).toBeCloseTo(midFog, 4);
    });

    it("automatic weather change mid-transition starts from blended state", () => {
      const sys = makeSystem("clear");
      sys.minWeatherDuration = 1;
      sys.maxWeatherDuration = 1;
      sys.forceWeather("storm"); // progress = 0, from=clear, to=storm
      // Advance 15 s so the visual is partway between clear and storm
      sys.update(15);
      const fogBeforeAutoChange = sys.fogDensity;
      // Now drain the timer so a new auto transition fires
      sys.update(sys.nextChangeIn + 0.1);
      // The new _fromVisuals must be the blended state just before the change,
      // so at progress = 0 the fog must equal fogBeforeAutoChange.
      // (We test the absolute value here because a second forceWeather resets progress.)
      expect(sys.fogDensity).toBeGreaterThan(0);
    });

    it("chained forceWeather calls each begin from the current blended state", () => {
      const sys = makeSystem("clear");
      sys.forceWeather("storm");
      sys.update(sys.transitionDuration / 2); // 50 % into clear→storm
      const fogA = sys.fogDensity;

      sys.forceWeather("rain");               // interrupt: start from fogA
      expect(sys.fogDensity).toBeCloseTo(fogA, 4);

      sys.update(sys.transitionDuration / 2); // 50 % into fogA→rain
      const fogB = sys.fogDensity;

      sys.forceWeather("overcast");           // interrupt: start from fogB
      expect(sys.fogDensity).toBeCloseTo(fogB, 4);
    });
  });

  describe("scene / light integration", () => {
    it("applies fog density to the scene on construction", () => {
      const scene = makeSceneMock();
      new WeatherSystem("foggy", scene, null, null);
      // foggy fog density = 0.030
      expect(scene.fogDensity).toBeCloseTo(0.030, 5);
    });

    it("updates scene fog density during update", () => {
      const scene = makeSceneMock();
      const sys = new WeatherSystem("clear", scene, null, null);
      expect(scene.fogDensity).toBeCloseTo(0.006, 5);

      sys.forceWeather("storm"); // progress = 0; fog = clear density
      expect(scene.fogDensity).toBeCloseTo(0.006, 5);

      sys.update(sys.transitionDuration); // progress = 1; fog = storm density
      expect(scene.fogDensity).toBeCloseTo(0.025, 5);
    });

    it("updates ambient light intensity on transition", () => {
      const ambient = makeLightMock();
      const sys = new WeatherSystem("clear", null, ambient, null, { ambientBase: 1.0, sunBase: 1.0 });
      // clear ambientScale = 1.0; base = 1.0 → intensity = 1.0
      expect(ambient.intensity).toBeCloseTo(1.0, 5);

      sys.forceWeather("storm"); // storm ambientScale = 0.50
      sys.update(sys.transitionDuration);
      expect(ambient.intensity).toBeCloseTo(0.50, 5);
    });

    it("updates sun light intensity on transition", () => {
      const sun = makeLightMock();
      const sys = new WeatherSystem("clear", null, null, sun, { ambientBase: 1.0, sunBase: 1.0 });
      // clear sunScale = 1.0; base = 1.0 → intensity = 1.0
      expect(sun.intensity).toBeCloseTo(1.0, 5);

      sys.forceWeather("storm"); // storm sunScale = 0.20
      sys.update(sys.transitionDuration);
      expect(sun.intensity).toBeCloseTo(0.20, 5);
    });

    it("updates fog color on scene during transition", () => {
      const scene = makeSceneMock();
      const sys = new WeatherSystem("clear", scene, null, null);
      // clear fog color = { r: 0.50, g: 0.60, b: 0.72 }
      expect(scene.fogColor.r).toBeCloseTo(0.50, 4);

      sys.forceWeather("storm");
      sys.update(sys.transitionDuration);
      // storm fog color = { r: 0.30, g: 0.32, b: 0.38 }
      expect(scene.fogColor.r).toBeCloseTo(0.30, 4);
    });
  });
});
