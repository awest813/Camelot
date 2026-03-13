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
  mapSize:    2048,
  blurKernel: 32,
};

/** Default post-processing preset (clear mid-morning, WebGL renderer). */
export const DEFAULT_POST_PROCESS: PostProcessConfig = {
  bloom: {
    enabled:   true,
    threshold: 0.55,
    weight:    0.35,
    kernel:    64,
    scale:     0.65,
  },
  fxaa:              true,
  sharpenEdgeAmount: 0.40,
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

  constructor(overrides: {
    shadow?:      Partial<ShadowConfig>;
    postProcess?: Partial<PostProcessConfig> & { bloom?: Partial<BloomConfig> };
    sky?:         Partial<SkyConfig>;
    fog?:         Partial<FogConfig>;
    lighting?:    Partial<LightingConfig>;
  } = {}) {
    this.shadow = { ...DEFAULT_SHADOW, ...overrides.shadow };

    const bloomOverride = overrides.postProcess?.bloom ?? {};
    const ppOverride    = { ...overrides.postProcess };
    delete (ppOverride as any).bloom;
    this.postProcess = {
      ...DEFAULT_POST_PROCESS,
      ...ppOverride,
      bloom: { ...DEFAULT_POST_PROCESS.bloom, ...bloomOverride },
    };

    this.sky      = { ...DEFAULT_SKY,      ...overrides.sky };
    this.fog      = {
      ...DEFAULT_FOG,
      ...overrides.fog,
      color: { ...DEFAULT_FOG.color, ...overrides.fog?.color },
    };
    this.lighting = { ...DEFAULT_LIGHTING, ...overrides.lighting };
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
