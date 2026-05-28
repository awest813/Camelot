// ── Shadow configuration ──────────────────────────────────────────────────────

/**
 * Configuration for the directional-light shadow generator.
 *
 * `mapSize` must be a positive power of two (512, 1024, 2048, etc.).  BabylonJS
 * silently rounds non-power-of-two values, so we validate early and surface the
 * error before it silently corrupts the shadow quality.
 */
export interface ShadowConfig {
  /** Shadow-map texture resolution.  Must be a positive power of two. */
  mapSize: number;
  /** PCF blur-kernel half-width for soft-shadow smoothing. */
  blurKernel: number;
}

// ── Bloom configuration ───────────────────────────────────────────────────────

/**
 * Bloom post-process configuration.
 *
 * All values are validated by {@link GraphicsSystem.validate}.
 */
export interface BloomConfig {
  enabled: boolean;
  /** Luminance threshold above which bloom is applied.  Range [0, 1]. */
  threshold: number;
  /** Bloom contribution weight.  Must be > 0. */
  weight: number;
  /** Blur kernel half-width in pixels.  Must be a positive integer. */
  kernel: number;
  /** Downscale factor for the bloom texture.  Range (0, 1]. */
  scale: number;
}

// ── Post-processing configuration ─────────────────────────────────────────────

/**
 * Full post-processing pipeline configuration used by
 * `DefaultRenderingPipeline` in game.ts.
 */
export interface PostProcessConfig {
  bloom: BloomConfig;
  /** Enable FXAA anti-aliasing. */
  fxaa: boolean;
  /** Sharpening edge-detection amount applied after FXAA.  Range [0, 1]. */
  sharpenEdgeAmount: number;
  /** ACES filmic tone-mapping type or "none" to disable. */
  toneMappingType: "aces" | "none";
  /** Overall scene exposure multiplier.  Must be > 0. */
  exposure: number;
  /** Contrast multiplier applied during image processing.  Must be > 0. */
  contrast: number;
  /** Vignette strength.  Must be ≥ 0. */
  vignetteWeight: number;
}

// ── Sky configuration ─────────────────────────────────────────────────────────

/**
 * Atmospheric sky-dome parameters fed into SkyMaterial.
 *
 * All fields correspond directly to `SkyMaterial` properties.  See the
 * Babylon.js materials docs for detailed descriptions.
 */
export interface SkyConfig {
  /** Atmospheric turbidity (haze level).  Recommended range [1, 20]. */
  turbidity: number;
  /** Sky luminance.  Recommended range [0, 1]. */
  luminance: number;
  /** Rayleigh scattering coefficient.  Typical range [0, 4]. */
  rayleigh: number;
  /** Mie scattering coefficient.  Typical range [0, 0.1]. */
  mieCoefficient: number;
  /** Mie directional scattering factor.  Range [0, 1]. */
  mieDirectionalG: number;
  /**
   * Sun inclination (elevation angle).  0 = horizon, 0.5 = zenith.
   * Negative values place the sun below the horizon (night).
   * Typical range [−0.5, 0.5].
   */
  inclination: number;
  /** Sun azimuth (horizontal angle).  Range [0, 1] wraps around 360°. */
  azimuth: number;
}

// ── Fog configuration ─────────────────────────────────────────────────────────

/**
 * Initial scene fog configuration.
 *
 * These values are applied by `_setLight()` in game.ts so the very first
 * rendered frame is consistent with the WeatherSystem's "clear" state before
 * that system takes over blending.
 */
export interface FogConfig {
  /** EXP2 fog density.  Must be > 0.  WeatherSystem "clear" default: 0.006. */
  density: number;
  /** Fog colour.  Each channel in [0, 1]. */
  color: { r: number; g: number; b: number };
}

// ── Lighting configuration ────────────────────────────────────────────────────

/**
 * Base intensities for the hemisphere ambient light and the directional sun
 * light.  These are the values passed to `WeatherSystem` as `baseIntensity`
 * so that weather-driven scales are applied on top of them.
 */
export interface LightingConfig {
  /** Base intensity of the hemispheric ambient light. */
  ambientBase: number;
  /** Base intensity of the directional sun light. */
  sunBase: number;
}

// ── Default presets ───────────────────────────────────────────────────────────

/** Default shadow map configuration used by the game. */
export const DEFAULT_SHADOW: ShadowConfig = {
  mapSize:    1024,
  blurKernel: 12,
};

/** Default post-processing preset (clear mid-morning, WebGL renderer). */
export const DEFAULT_POST_PROCESS: PostProcessConfig = {
  bloom: {
    enabled:   false,
    threshold: 0.55,
    weight:    0.35,
    kernel:    24,
    scale:     0.5,
  },
  fxaa:              false,
  sharpenEdgeAmount: 0,
  toneMappingType:   "aces",
  exposure:          1.10,
  contrast:          1.18,
  vignetteWeight:    3.2,
};

/** Default sky-dome parameters for a vivid clear-day atmosphere. */
export const DEFAULT_SKY: SkyConfig = {
  turbidity:       3.5,
  luminance:       1.0,
  rayleigh:        3.0,
  mieCoefficient:  0.004,
  mieDirectionalG: 0.92,
  inclination:     0.38,
  azimuth:         0.25,
};

/**
 * Default initial fog configuration.
 *
 * These values intentionally match the WeatherSystem "clear" preset so the
 * first rendered frame is consistent before WeatherSystem takes over.
 */
export const DEFAULT_FOG: FogConfig = {
  density: 0.006,
  color:   { r: 0.50, g: 0.60, b: 0.72 },
};

/**
 * Default lighting base intensities passed to WeatherSystem.
 * They match the values set on the lights in game.ts `_setLight()`.
 */
export const DEFAULT_LIGHTING: LightingConfig = {
  ambientBase: 0.65,
  sunBase:     1.25,
};

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Returns `true` when `n` is a positive power of two.
 *
 * Shadow-map resolutions must be powers of two to avoid silent BabylonJS
 * rounding that changes shadow quality without warning.
 */
export function isPowerOfTwo(n: number): boolean {
  return Number.isInteger(n) && n > 0 && (n & (n - 1)) === 0;
}

/**
 * Validates all GraphicsSystem configuration objects and returns a list of
 * human-readable error strings.  An empty array means the configuration is
 * valid.
 */
export function validateGraphicsConfig(config: {
  shadow:      ShadowConfig;
  postProcess: PostProcessConfig;
  sky:         SkyConfig;
  fog:         FogConfig;
  lighting:    LightingConfig;
}): string[] {
  const errors: string[] = [];

  // ── Shadow ────────────────────────────────────────────────────────────────
  if (!isPowerOfTwo(config.shadow.mapSize)) {
    errors.push(
      `shadow.mapSize must be a positive power of two, got ${config.shadow.mapSize}`,
    );
  }
  if (!Number.isFinite(config.shadow.blurKernel) || config.shadow.blurKernel <= 0) {
    errors.push(
      `shadow.blurKernel must be a positive finite number, got ${config.shadow.blurKernel}`,
    );
  }

  // ── Bloom ─────────────────────────────────────────────────────────────────
  const bloom = config.postProcess.bloom;
  if (!Number.isFinite(bloom.threshold) || bloom.threshold < 0 || bloom.threshold > 1) {
    errors.push(`bloom.threshold must be in [0, 1], got ${bloom.threshold}`);
  }
  if (!Number.isFinite(bloom.weight) || bloom.weight <= 0) {
    errors.push(`bloom.weight must be > 0, got ${bloom.weight}`);
  }
  if (!Number.isFinite(bloom.kernel) || bloom.kernel <= 0 || !Number.isInteger(bloom.kernel)) {
    errors.push(`bloom.kernel must be a positive integer, got ${bloom.kernel}`);
  }
  if (!Number.isFinite(bloom.scale) || bloom.scale <= 0 || bloom.scale > 1) {
    errors.push(`bloom.scale must be in (0, 1], got ${bloom.scale}`);
  }

  // ── Post-process ──────────────────────────────────────────────────────────
  const pp = config.postProcess;
  if (!Number.isFinite(pp.sharpenEdgeAmount) || pp.sharpenEdgeAmount < 0 || pp.sharpenEdgeAmount > 1) {
    errors.push(`postProcess.sharpenEdgeAmount must be in [0, 1], got ${pp.sharpenEdgeAmount}`);
  }
  if (!Number.isFinite(pp.exposure) || pp.exposure <= 0) {
    errors.push(`postProcess.exposure must be > 0, got ${pp.exposure}`);
  }
  if (!Number.isFinite(pp.contrast) || pp.contrast <= 0) {
    errors.push(`postProcess.contrast must be > 0, got ${pp.contrast}`);
  }
  if (!Number.isFinite(pp.vignetteWeight) || pp.vignetteWeight < 0) {
    errors.push(`postProcess.vignetteWeight must be ≥ 0, got ${pp.vignetteWeight}`);
  }

  // ── Sky ───────────────────────────────────────────────────────────────────
  const sky = config.sky;
  if (!Number.isFinite(sky.turbidity) || sky.turbidity <= 0) {
    errors.push(`sky.turbidity must be > 0, got ${sky.turbidity}`);
  }
  if (!Number.isFinite(sky.luminance) || sky.luminance < 0 || sky.luminance > 1) {
    errors.push(`sky.luminance must be in [0, 1], got ${sky.luminance}`);
  }
  if (!Number.isFinite(sky.rayleigh) || sky.rayleigh < 0) {
    errors.push(`sky.rayleigh must be ≥ 0, got ${sky.rayleigh}`);
  }
  if (!Number.isFinite(sky.mieCoefficient) || sky.mieCoefficient < 0) {
    errors.push(`sky.mieCoefficient must be ≥ 0, got ${sky.mieCoefficient}`);
  }
  if (!Number.isFinite(sky.mieDirectionalG) || sky.mieDirectionalG < 0 || sky.mieDirectionalG > 1) {
    errors.push(`sky.mieDirectionalG must be in [0, 1], got ${sky.mieDirectionalG}`);
  }
  if (!Number.isFinite(sky.inclination)) {
    errors.push(`sky.inclination must be a finite number, got ${sky.inclination}`);
  }
  if (!Number.isFinite(sky.azimuth) || sky.azimuth < 0 || sky.azimuth > 1) {
    errors.push(`sky.azimuth must be in [0, 1], got ${sky.azimuth}`);
  }

  // ── Fog ───────────────────────────────────────────────────────────────────
  if (!Number.isFinite(config.fog.density) || config.fog.density <= 0) {
    errors.push(`fog.density must be > 0, got ${config.fog.density}`);
  }
  const { r, g, b } = config.fog.color;
  for (const [name, val] of [["r", r], ["g", g], ["b", b]] as [string, number][]) {
    if (!Number.isFinite(val) || val < 0 || val > 1) {
      errors.push(`fog.color.${name} must be in [0, 1], got ${val}`);
    }
  }

  // ── Lighting ──────────────────────────────────────────────────────────────
  if (!Number.isFinite(config.lighting.ambientBase) || config.lighting.ambientBase <= 0) {
    errors.push(`lighting.ambientBase must be > 0, got ${config.lighting.ambientBase}`);
  }
  if (!Number.isFinite(config.lighting.sunBase) || config.lighting.sunBase <= 0) {
    errors.push(`lighting.sunBase must be > 0, got ${config.lighting.sunBase}`);
  }

  return errors;
}

// ── Quality tiers ─────────────────────────────────────────────────────────────

/**
 * Quality tier identifiers.
 *
 *   - `low`     — Tuned for low-end machines (2-4 GB RAM, 2-4 cores/threads).
 *                 Disables bloom/FXAA/sharpening, shrinks the shadow map, and
 *                 drops the render-scale.  Targets ≥30 FPS on integrated GPUs.
 *   - `medium`  — Balanced preset for 4-8 GB RAM mid-range hardware.
 *   - `high`    — Matches the existing `DEFAULT_*` presets.
 *   - `ultra`   — Increases shadow resolution and enables bloom/FXAA for
 *                 high-end desktops.
 */
export type QualityTier = "low" | "medium" | "high" | "ultra";

/**
 * Auxiliary, tier-driven knobs that influence renderer setup outside of the
 * existing config blocks.  These are read by the BabylonJS adapter in
 * `game.ts` to throttle hardware-scaling, shadow generators, and the
 * `DefaultRenderingPipeline`.
 */
export interface PerformanceConfig {
  /**
   * Engine hardware-scaling level (1 / devicePixelRatio multiplier).  Values
   * `> 1` lower the internal render resolution — a cheap, high-impact win on
   * iGPUs.  Babylon's `engine.setHardwareScalingLevel(v)`.
   */
  hardwareScalingLevel: number;
  /** Render shadows at all.  `false` skips the entire ShadowGenerator path. */
  shadowsEnabled: boolean;
  /**
   * Use soft (blur-exponential) shadows.  When `false`, shadows fall back to
   * the cheap PCF/hard path — saves a full-screen blur each frame.
   */
  softShadows: boolean;
  /** Enable the full `DefaultRenderingPipeline` post-process stack. */
  postProcessEnabled: boolean;
  /** Cap simultaneously active particle systems (0 disables particles). */
  maxParticles: number;
  /** Target frames-per-second; renderer may throttle the run-loop to match. */
  targetFps: number;
}

/** Full tier preset: every config block + perf knobs. */
export interface TierPreset {
  shadow:      ShadowConfig;
  postProcess: PostProcessConfig;
  fog:         FogConfig;
  lighting:    LightingConfig;
  performance: PerformanceConfig;
}

/**
 * Low-end preset — 2-4 GB RAM, 2-4 cores/threads, integrated GPU.
 *
 * Tradeoffs:
 *   - 512² shadow map (¼ the texels of default, fits in <1 MB VRAM)
 *   - Hard shadows, no PCF blur
 *   - No bloom, no FXAA, no sharpening, no vignette
 *   - 0.75× render scale (Babylon `setHardwareScalingLevel(1/0.75)`)
 *   - Particles capped at 64
 *   - Sun intensity nudged up to compensate for cheaper shadows
 */
export const LOW_TIER_PRESET: TierPreset = {
  shadow: {
    mapSize:    512,
    blurKernel: 1,
  },
  postProcess: {
    bloom: {
      enabled:   false,
      threshold: 0.55,
      weight:    0.35,
      kernel:    16,
      scale:     0.5,
    },
    fxaa:              false,
    sharpenEdgeAmount: 0,
    toneMappingType:   "aces",
    exposure:          1.10,
    contrast:          1.15,
    vignetteWeight:    0,
  },
  fog: {
    density: 0.006,
    color:   { r: 0.50, g: 0.60, b: 0.72 },
  },
  lighting: {
    ambientBase: 0.75,
    sunBase:     1.30,
  },
  performance: {
    hardwareScalingLevel: 1 / 0.75,
    shadowsEnabled:       true,
    softShadows:          false,
    postProcessEnabled:   false,
    maxParticles:         64,
    targetFps:            30,
  },
};

/** Medium preset — 4-8 GB RAM, mid-range iGPU/entry dGPU. */
export const MEDIUM_TIER_PRESET: TierPreset = {
  shadow: {
    mapSize:    1024,
    blurKernel: 6,
  },
  postProcess: {
    bloom: { ...DEFAULT_POST_PROCESS.bloom, enabled: false },
    fxaa:              true,
    sharpenEdgeAmount: 0,
    toneMappingType:   "aces",
    exposure:          1.10,
    contrast:          1.18,
    vignetteWeight:    1.5,
  },
  fog:      { ...DEFAULT_FOG, color: { ...DEFAULT_FOG.color } },
  lighting: { ...DEFAULT_LIGHTING },
  performance: {
    hardwareScalingLevel: 1.0,
    shadowsEnabled:       true,
    softShadows:          true,
    postProcessEnabled:   true,
    maxParticles:         256,
    targetFps:            60,
  },
};

/** High preset — matches the existing DEFAULT_* values. */
export const HIGH_TIER_PRESET: TierPreset = {
  shadow:      { ...DEFAULT_SHADOW },
  postProcess: {
    ...DEFAULT_POST_PROCESS,
    bloom: { ...DEFAULT_POST_PROCESS.bloom },
  },
  fog:      { ...DEFAULT_FOG, color: { ...DEFAULT_FOG.color } },
  lighting: { ...DEFAULT_LIGHTING },
  performance: {
    hardwareScalingLevel: 1.0,
    shadowsEnabled:       true,
    softShadows:          true,
    postProcessEnabled:   true,
    maxParticles:         512,
    targetFps:            60,
  },
};

/** Ultra preset — high-end desktops. */
export const ULTRA_TIER_PRESET: TierPreset = {
  shadow: {
    mapSize:    2048,
    blurKernel: 16,
  },
  postProcess: {
    bloom: {
      enabled:   true,
      threshold: 0.55,
      weight:    0.35,
      kernel:    24,
      scale:     0.5,
    },
    fxaa:              true,
    sharpenEdgeAmount: 0.3,
    toneMappingType:   "aces",
    exposure:          1.10,
    contrast:          1.18,
    vignetteWeight:    3.2,
  },
  fog:      { ...DEFAULT_FOG, color: { ...DEFAULT_FOG.color } },
  lighting: { ...DEFAULT_LIGHTING },
  performance: {
    hardwareScalingLevel: 1.0,
    shadowsEnabled:       true,
    softShadows:          true,
    postProcessEnabled:   true,
    maxParticles:         1024,
    targetFps:            60,
  },
};

/** Lookup the full preset for a tier. */
export function presetForTier(tier: QualityTier): TierPreset {
  switch (tier) {
    case "low":    return LOW_TIER_PRESET;
    case "medium": return MEDIUM_TIER_PRESET;
    case "high":   return HIGH_TIER_PRESET;
    case "ultra":  return ULTRA_TIER_PRESET;
  }
}

/** Hardware capability hints used to pick a quality tier. */
export interface HardwareHints {
  /** Approximate device RAM in GB.  Browser: `navigator.deviceMemory`. */
  deviceMemoryGB?: number;
  /** Logical CPU cores/threads.  Browser: `navigator.hardwareConcurrency`. */
  hardwareConcurrency?: number;
  /** Network save-data hint.  Browser: `navigator.connection.saveData`. */
  saveData?: boolean;
}

/**
 * Pick a quality tier from hardware hints.
 *
 * Heuristic (intentionally conservative — better to start low and let the
 * user upgrade than to ship a stutter on first paint):
 *
 *   - `low`    when RAM ≤ 4 GB **or** cores ≤ 4 **or** `saveData` is set.
 *   - `medium` when RAM ≤ 8 GB **or** cores ≤ 8.
 *   - `high`   otherwise.
 *
 * Returns `"medium"` when no hints are provided — a safe middle ground that
 * preserves the existing behaviour without forcing an unknown machine to the
 * ultra path.
 */
export function detectQualityTier(hints: HardwareHints = {}): QualityTier {
  const { deviceMemoryGB, hardwareConcurrency, saveData } = hints;

  const hasAnyHint =
    deviceMemoryGB !== undefined ||
    hardwareConcurrency !== undefined ||
    saveData !== undefined;

  if (!hasAnyHint) return "medium";

  if (saveData === true) return "low";
  if (deviceMemoryGB !== undefined && deviceMemoryGB <= 4) return "low";
  if (hardwareConcurrency !== undefined && hardwareConcurrency <= 4) return "low";

  if (deviceMemoryGB !== undefined && deviceMemoryGB <= 8) return "medium";
  if (hardwareConcurrency !== undefined && hardwareConcurrency <= 8) return "medium";

  return "high";
}

/**
 * Read hardware hints from `navigator` when available.  Returns an empty
 * object in non-browser environments (Node, Vitest) — callers can then fall
 * back to a user-selected tier or the `"medium"` default.
 */
export function readNavigatorHardwareHints(
  nav: { deviceMemory?: number; hardwareConcurrency?: number; connection?: { saveData?: boolean } } | undefined =
    typeof navigator !== "undefined" ? (navigator as any) : undefined,
): HardwareHints {
  if (!nav) return {};
  const hints: HardwareHints = {};
  if (typeof nav.deviceMemory === "number")        hints.deviceMemoryGB      = nav.deviceMemory;
  if (typeof nav.hardwareConcurrency === "number") hints.hardwareConcurrency = nav.hardwareConcurrency;
  if (nav.connection && typeof nav.connection.saveData === "boolean") {
    hints.saveData = nav.connection.saveData;
  }
  return hints;
}

// ── GraphicsSystem ────────────────────────────────────────────────────────────

/**
 * GraphicsSystem — centralised rendering configuration for the game.
 *
 * Holds validated, read-only presets for:
 *   - Shadow map (resolution + soft-shadow blur)
 *   - Post-processing (bloom, FXAA, sharpen, ACES tone mapping, vignette)
 *   - Procedural sky dome (SkyMaterial atmospheric parameters)
 *   - Initial scene fog (density + colour)
 *   - Base lighting intensities (consumed by WeatherSystem as multiplier base)
 *
 * The class carries **no BabylonJS engine dependencies**, so it is fully
 * testable in a headless Vitest environment.  Actual BabylonJS setup
 * (HemisphericLight, DirectionalLight, ShadowGenerator, DefaultRenderingPipeline,
 * SkyMaterial) is performed in `game.ts` using the values exposed here.
 *
 * Usage:
 * ```ts
 * const gfx = new GraphicsSystem();
 * const errors = gfx.validate();
 * if (errors.length > 0) console.warn("Graphics config issues:", errors);
 *
 * // Read config values for BabylonJS setup:
 * shadows.useBlurExponentialShadowMap = true;
 * shadows.blurKernel = gfx.shadow.blurKernel;
 * ```
 */
export class GraphicsSystem {
  public readonly shadow:      ShadowConfig;
  public readonly postProcess: PostProcessConfig;
  public readonly sky:         SkyConfig;
  public readonly fog:         FogConfig;
  public readonly lighting:    LightingConfig;
  public readonly performance: PerformanceConfig;
  public readonly tier:        QualityTier;

  constructor(overrides: {
    /**
     * Optional quality tier.  When supplied, the matching {@link TierPreset}
     * provides the base values; individual `shadow` / `postProcess` / etc.
     * overrides are then layered on top.
     *
     * When omitted, falls back to the legacy `DEFAULT_*` constants so that
     * existing callers see no behaviour change.
     */
    tier?:        QualityTier;
    shadow?:      Partial<ShadowConfig>;
    postProcess?: Partial<PostProcessConfig> & { bloom?: Partial<BloomConfig> };
    sky?:         Partial<SkyConfig>;
    fog?:         Partial<FogConfig>;
    lighting?:    Partial<LightingConfig>;
    performance?: Partial<PerformanceConfig>;
  } = {}) {
    this.tier = overrides.tier ?? "high";
    const base = overrides.tier ? presetForTier(overrides.tier) : {
      shadow:      DEFAULT_SHADOW,
      postProcess: DEFAULT_POST_PROCESS,
      fog:         DEFAULT_FOG,
      lighting:    DEFAULT_LIGHTING,
      performance: HIGH_TIER_PRESET.performance,
    };

    this.shadow = { ...base.shadow, ...overrides.shadow };

    const bloomOverride = overrides.postProcess?.bloom ?? {};
    const ppOverride    = { ...overrides.postProcess };
    delete (ppOverride as any).bloom;
    this.postProcess = {
      ...base.postProcess,
      ...ppOverride,
      bloom: { ...base.postProcess.bloom, ...bloomOverride },
    };

    this.sky      = { ...DEFAULT_SKY, ...overrides.sky };
    this.fog      = {
      ...base.fog,
      ...overrides.fog,
      color: { ...base.fog.color, ...overrides.fog?.color },
    };
    this.lighting    = { ...base.lighting,    ...overrides.lighting };
    this.performance = { ...base.performance, ...overrides.performance };
  }

  /**
   * Build a GraphicsSystem auto-tuned from runtime hardware hints.  Convenient
   * one-liner for the boot path:
   * ```ts
   * const gfx = GraphicsSystem.autoDetect();
   * ```
   * Pass explicit `hints` to override the `navigator`-derived defaults (handy
   * for tests).
   */
  public static autoDetect(hints?: HardwareHints): GraphicsSystem {
    const resolved = hints ?? readNavigatorHardwareHints();
    return new GraphicsSystem({ tier: detectQualityTier(resolved) });
  }

  /**
   * Create a GraphicsSystem using the tier the player previously saved to
   * `localStorage` (via {@link persistGraphicsTier}).  Falls back to
   * {@link autoDetect} when no saved preference exists.
   *
   * This is the preferred factory for the game boot path so that a player's
   * explicit quality choice survives page reloads.
   */
  public static fromSavedOrAutoDetect(hints?: HardwareHints): GraphicsSystem {
    const saved = readSavedGraphicsTier();
    if (saved) return new GraphicsSystem({ tier: saved });
    return GraphicsSystem.autoDetect(hints);
  }

  /**
   * Validate all configuration values and return human-readable error strings.
   * An empty array means the configuration is valid.
   */
  public validate(): string[] {
    return validateGraphicsConfig({
      shadow:      this.shadow,
      postProcess: this.postProcess,
      sky:         this.sky,
      fog:         this.fog,
      lighting:    this.lighting,
    });
  }

  /** `true` when the configuration passes all validation rules. */
  public get isValid(): boolean {
    return this.validate().length === 0;
  }
}

// ── Graphics tier persistence ─────────────────────────────────────────────────

/** `localStorage` key for the player-selected graphics quality tier. */
export const GRAPHICS_TIER_STORAGE_KEY = "camelot_graphics_tier";

/**
 * Read the last player-selected {@link QualityTier} from `localStorage`.
 * Returns `null` when no preference has been saved or the environment does
 * not provide `localStorage` (e.g. Node / Vitest).
 */
export function readSavedGraphicsTier(): QualityTier | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(GRAPHICS_TIER_STORAGE_KEY);
  if (raw === "low" || raw === "medium" || raw === "high" || raw === "ultra") {
    return raw;
  }
  return null;
}

/**
 * Persist the player's chosen {@link QualityTier} to `localStorage` so that
 * {@link GraphicsSystem.fromSavedOrAutoDetect} can restore it on the next
 * page load.
 */
export function persistGraphicsTier(tier: QualityTier): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(GRAPHICS_TIER_STORAGE_KEY, tier);
}
