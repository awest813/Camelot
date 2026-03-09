import type { Scene } from "@babylonjs/core/scene";
import type { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import type { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { Color3 } from "@babylonjs/core/Maths/math.color";

// ── Weather state types ───────────────────────────────────────────────────────

export type WeatherState = "clear" | "overcast" | "foggy" | "rain" | "storm";

export const WEATHER_STATES: WeatherState[] = [
  "clear",
  "overcast",
  "foggy",
  "rain",
  "storm",
];

// ── Per-state visual configuration ───────────────────────────────────────────

interface WeatherVisuals {
  fogDensity: number;
  fogColor: { r: number; g: number; b: number };
  /** Multiplier applied to the base ambient-light intensity (0–1). */
  ambientScale: number;
  /** Multiplier applied to the base directional-sun intensity (0–1). */
  sunScale: number;
}

const VISUALS: Record<WeatherState, WeatherVisuals> = {
  clear:    { fogDensity: 0.006, fogColor: { r: 0.50, g: 0.60, b: 0.72 }, ambientScale: 1.00, sunScale: 1.00 },
  overcast: { fogDensity: 0.010, fogColor: { r: 0.55, g: 0.57, b: 0.62 }, ambientScale: 0.75, sunScale: 0.50 },
  foggy:    { fogDensity: 0.030, fogColor: { r: 0.70, g: 0.72, b: 0.75 }, ambientScale: 0.60, sunScale: 0.30 },
  rain:     { fogDensity: 0.018, fogColor: { r: 0.40, g: 0.43, b: 0.50 }, ambientScale: 0.65, sunScale: 0.35 },
  storm:    { fogDensity: 0.025, fogColor: { r: 0.30, g: 0.32, b: 0.38 }, ambientScale: 0.50, sunScale: 0.20 },
};

// ── Weighted transition table ─────────────────────────────────────────────────

/**
 * Relative weights for transitioning from state A (row) to state B (column).
 * Self-weights represent the tendency to stay in the same state.
 */
const TRANSITIONS: Record<WeatherState, Partial<Record<WeatherState, number>>> = {
  clear:    { clear: 60, overcast: 25, foggy: 15 },
  overcast: { overcast: 40, clear: 20, rain: 25, foggy: 10, storm: 5 },
  foggy:    { foggy: 40, clear: 35, overcast: 25 },
  rain:     { rain: 35, overcast: 30, storm: 20, clear: 15 },
  storm:    { storm: 30, rain: 45, overcast: 25 },
};

// ── Save / load ───────────────────────────────────────────────────────────────

export interface WeatherSaveState {
  state: WeatherState;
  nextChangeIn: number;
}

// ── System ────────────────────────────────────────────────────────────────────

/**
 * WeatherSystem — Oblivion-lite atmospheric weather.
 *
 * Manages a randomised Markov-chain weather progression that drives:
 *   - Scene fog density and colour
 *   - Ambient and directional light intensity
 *   - Smooth visual transitions between states
 *
 * Wire-up in game.ts:
 * ```ts
 * this.weatherSystem = new WeatherSystem(
 *   "clear",
 *   this.scene,
 *   ambientLight,
 *   sunLight,
 *   { ambientBase: 0.55, sunBase: 0.85 },
 * );
 * // In update loop:
 * this.weatherSystem.update(deltaTime);
 * ```
 *
 * The system requires no external deps beyond BabylonJS scene/light references
 * and works fully headlessly when scene/lights are omitted (useful for tests).
 */
export class WeatherSystem {
  // ── Config ────────────────────────────────────────────────────────────────
  /** Minimum real-time seconds before weather can change. */
  public minWeatherDuration: number = 120;
  /** Maximum real-time seconds before a forced weather change. */
  public maxWeatherDuration: number = 600;
  /** Real-time seconds over which visuals smoothly interpolate on transition. */
  public transitionDuration: number = 30;

  // ── State ─────────────────────────────────────────────────────────────────
  private _state: WeatherState;
  private _nextChangeIn: number;
  /** Progress from 0 (start of transition) to 1 (fully transitioned). */
  private _transitionProgress: number = 1;
  private _fromVisuals: WeatherVisuals;
  private _toVisuals: WeatherVisuals;

  // ── Optional scene references (absent in headless/test mode) ──────────────
  private readonly _scene: Scene | null;
  private readonly _ambient: HemisphericLight | null;
  private readonly _sun: DirectionalLight | null;
  private readonly _ambientBase: number;
  private readonly _sunBase: number;

  // ── Callbacks ─────────────────────────────────────────────────────────────
  /**
   * Called at the **start** of a weather transition — i.e. when the new
   * weather state is decided and `state` is updated, but before the visual
   * interpolation finishes (transition progress is reset to 0 at this point).
   *
   * This early-fire design lets listeners react immediately — for example to
   * start playing rain sounds or triggering cinematic events — without waiting
   * for the full `transitionDuration` to elapse.  If you need to react only
   * after the visual transition is complete, poll `fogDensity` or compare
   * `state` against your expected value after `transitionDuration` seconds.
   */
  public onWeatherChange: ((newState: WeatherState) => void) | null = null;

  /**
   * @param initialState  Starting weather state.
   * @param scene         BabylonJS scene for fog updates (optional — omit for headless use).
   * @param ambient       Hemispheric ambient light (optional).
   * @param sun           Directional sun light (optional).
   * @param baseIntensity Base intensities that the ambientScale/sunScale multipliers are applied to.
   */
  constructor(
    initialState: WeatherState = "clear",
    scene: Scene | null = null,
    ambient: HemisphericLight | null = null,
    sun: DirectionalLight | null = null,
    baseIntensity: { ambientBase: number; sunBase: number } = { ambientBase: 0.55, sunBase: 0.85 },
  ) {
    this._state          = initialState;
    this._fromVisuals    = VISUALS[initialState];
    this._toVisuals      = VISUALS[initialState];
    this._transitionProgress = 1;
    this._nextChangeIn   = this._randomDuration();

    this._scene       = scene;
    this._ambient     = ambient;
    this._sun         = sun;
    this._ambientBase = baseIntensity.ambientBase;
    this._sunBase     = baseIntensity.sunBase;

    // Apply initial visuals immediately
    this._applyVisuals(1);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Current weather state label. */
  public get state(): WeatherState {
    return this._state;
  }

  /** Human-readable label for display in UI / debug overlays. */
  public get label(): string {
    const map: Record<WeatherState, string> = {
      clear:    "Clear",
      overcast: "Overcast",
      foggy:    "Foggy",
      rain:     "Rain",
      storm:    "Storm",
    };
    return map[this._state];
  }

  /** Current blended fog density (useful for UI display / debug). */
  public get fogDensity(): number {
    return lerp(this._fromVisuals.fogDensity, this._toVisuals.fogDensity, this._transitionProgress);
  }

  /**
   * Seconds remaining until the next potential weather change.
   * Exposed for save-state serialisation and tests.
   */
  public get nextChangeIn(): number {
    return this._nextChangeIn;
  }

  /**
   * Force an immediate transition to the given state.
   * Useful for scripted events ("a storm approaches…").
   */
  public forceWeather(state: WeatherState): void {
    this._beginTransition(state);
  }

  /**
   * Advance the weather simulation.
   * Call once per fixed-step game loop tick.
   *
   * @param deltaTime Elapsed real-time seconds since last tick.
   */
  public update(deltaTime: number): void {
    // Advance smooth visual interpolation
    if (this._transitionProgress < 1) {
      this._transitionProgress = Math.min(
        1,
        this._transitionProgress + deltaTime / Math.max(0.001, this.transitionDuration),
      );
      this._applyVisuals(this._transitionProgress);
    }

    // Count down to next weather change
    this._nextChangeIn -= deltaTime;
    if (this._nextChangeIn <= 0) {
      const next = this._pickNextState();
      this._beginTransition(next);
    }
  }

  // ── Save / Load ───────────────────────────────────────────────────────────

  public getSaveState(): WeatherSaveState {
    return {
      state:        this._state,
      nextChangeIn: this._nextChangeIn,
    };
  }

  public restoreFromSave(data: WeatherSaveState): void {
    const safeState: WeatherState = VISUALS[data.state] ? data.state : "clear";
    this._state           = safeState;
    this._fromVisuals     = VISUALS[safeState];
    this._toVisuals       = VISUALS[safeState];
    this._transitionProgress = 1;

    if (typeof data.nextChangeIn === "number" && Number.isFinite(data.nextChangeIn)) {
      this._nextChangeIn = Math.max(0, data.nextChangeIn);
    } else {
      this._nextChangeIn = this._randomDuration();
    }

    this._applyVisuals(1);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _beginTransition(next: WeatherState): void {
    this._fromVisuals        = VISUALS[this._state];
    this._toVisuals          = VISUALS[next];
    this._state              = next;
    this._transitionProgress = 0;
    this._nextChangeIn       = this._randomDuration();
    this.onWeatherChange?.(next);
  }

  private _applyVisuals(t: number): void {
    if (this._scene) {
      this._scene.fogDensity = lerp(this._fromVisuals.fogDensity, this._toVisuals.fogDensity, t);
      this._scene.fogColor   = new Color3(
        lerp(this._fromVisuals.fogColor.r, this._toVisuals.fogColor.r, t),
        lerp(this._fromVisuals.fogColor.g, this._toVisuals.fogColor.g, t),
        lerp(this._fromVisuals.fogColor.b, this._toVisuals.fogColor.b, t),
      );
    }

    if (this._ambient) {
      this._ambient.intensity = this._ambientBase * lerp(this._fromVisuals.ambientScale, this._toVisuals.ambientScale, t);
    }

    if (this._sun) {
      this._sun.intensity = this._sunBase * lerp(this._fromVisuals.sunScale, this._toVisuals.sunScale, t);
    }
  }

  private _pickNextState(): WeatherState {
    const options = TRANSITIONS[this._state];
    let total = 0;
    for (const w of Object.values(options)) total += w;

    let rand = Math.random() * total;
    for (const [stateKey, weight] of Object.entries(options)) {
      rand -= weight;
      if (rand <= 0) return stateKey as WeatherState;
    }
    return this._state; // fallback (shouldn't be reached)
  }

  private _randomDuration(): number {
    return this.minWeatherDuration + Math.random() * (this.maxWeatherDuration - this.minWeatherDuration);
  }
}

// ── Utility ───────────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number): number {
  const tc = Math.min(1, Math.max(0, t));
  return a + (b - a) * tc;
}
