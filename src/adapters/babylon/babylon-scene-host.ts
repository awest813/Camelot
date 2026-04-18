/**
 * BabylonSceneHost — Extracted scene-setup configuration for the Babylon adapter layer.
 *
 * Encapsulates the lighting, sky, fog, shadow, and post-processing setup that
 * currently lives inline in `game.ts._setLight()` and `_initPostProcessing()`.
 *
 * This module is intentionally Babylon-free at the data/config level: it holds
 * the *configuration* as pure data (which can be tested headlessly) and exposes
 * a small surface that game.ts can call to *apply* the configuration to a live
 * Babylon scene.
 *
 * Progression path:
 *   1. game.ts keeps working exactly as before.
 *   2. New code can import `BabylonSceneHost` to read/write scene config.
 *   3. Eventually game.ts._setLight and _initPostProcessing delegate to this.
 *
 * The config structures mirror `GraphicsSystem` types so the two are compatible
 * and can be progressively unified.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

/** RGB colour value (0–1 per channel). */
export interface ColorRGB {
  r: number;
  g: number;
  b: number;
}

/** Scene lighting configuration. */
export interface LightingConfig {
  /** Ambient hemisphere intensity. */
  ambientIntensity: number;
  /** Directional sun intensity. */
  sunIntensity: number;
  /** Hemisphere light diffuse colour. */
  ambientDiffuse: ColorRGB;
  /** Hemisphere light ground colour. */
  ambientGround: ColorRGB;
  /** Sun direction (normalised). */
  sunDirection: { x: number; y: number; z: number };
  /** Sun diffuse colour. */
  sunDiffuse: ColorRGB;
}

/** Atmospheric fog configuration. */
export interface FogConfig {
  mode: "none" | "exp2" | "linear";
  density: number;
  color: ColorRGB;
}

/** Shadow generator configuration. */
export interface ShadowConfig {
  mapSize: number;
  blurKernel: number;
  bias: number;
}

/** Procedural sky configuration. */
export interface SkyConfig {
  turbidity: number;
  luminance: number;
  rayleigh: number;
  mieCoefficient: number;
  mieDirectionalG: number;
  inclination: number;
  azimuth: number;
}

/** Post-processing pipeline configuration. */
export interface PostProcessingConfig {
  bloomEnabled: boolean;
  bloomThreshold: number;
  bloomWeight: number;
  bloomKernel: number;
  bloomScale: number;
  fxaaEnabled: boolean;
  sharpenEdgeAmount: number;
  toneMappingEnabled: boolean;
  exposure: number;
  contrast: number;
  vignetteWeight: number;
}

/** Clear colour for the scene background. */
export interface ClearColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Full scene-host configuration snapshot (serialisable, testable). */
export interface SceneHostConfig {
  clearColor: ClearColor;
  lighting: LightingConfig;
  fog: FogConfig;
  shadow: ShadowConfig;
  sky: SkyConfig;
  postProcessing: PostProcessingConfig;
}

// ── Defaults ──────────────────────────────────────────────────────────────────

export const DEFAULT_CLEAR_COLOR: ClearColor = { r: 0.28, g: 0.46, b: 0.74, a: 1.0 };

export const DEFAULT_LIGHTING: LightingConfig = {
  ambientIntensity: 0.85,
  sunIntensity: 1.4,
  ambientDiffuse: { r: 0.92, g: 0.88, b: 0.72 },
  ambientGround: { r: 0.18, g: 0.14, b: 0.08 },
  sunDirection: { x: -1.0, y: -2.5, z: -0.6 },
  sunDiffuse: { r: 1.0, g: 0.92, b: 0.72 },
};

export const DEFAULT_FOG: FogConfig = {
  mode: "exp2",
  density: 0.002,
  color: { r: 0.72, g: 0.78, b: 0.88 },
};

export const DEFAULT_SHADOW: ShadowConfig = {
  mapSize: 2048,
  blurKernel: 32,
  bias: 0.0005,
};

export const DEFAULT_SKY: SkyConfig = {
  turbidity: 8,
  luminance: 1.1,
  rayleigh: 2.2,
  mieCoefficient: 0.005,
  mieDirectionalG: 0.75,
  inclination: 0.49,
  azimuth: 0.25,
};

export const DEFAULT_POST_PROCESSING: PostProcessingConfig = {
  bloomEnabled: true,
  bloomThreshold: 0.85,
  bloomWeight: 0.35,
  bloomKernel: 64,
  bloomScale: 0.5,
  fxaaEnabled: true,
  sharpenEdgeAmount: 0.3,
  toneMappingEnabled: true,
  exposure: 1.1,
  contrast: 1.15,
  vignetteWeight: 1.8,
};

// ── System ─────────────────────────────────────────────────────────────────────

/**
 * Pure-data scene host that stores and validates the visual configuration
 * for a Babylon scene.  Can be snapshot/restored, compared, and tested
 * without a real Babylon engine.
 */
export class BabylonSceneHost {
  public clearColor: ClearColor;
  public lighting: LightingConfig;
  public fog: FogConfig;
  public shadow: ShadowConfig;
  public sky: SkyConfig;
  public postProcessing: PostProcessingConfig;

  constructor(config?: Partial<SceneHostConfig>) {
    this.clearColor     = { ...(config?.clearColor ?? DEFAULT_CLEAR_COLOR) };
    this.lighting       = { ...(config?.lighting ?? DEFAULT_LIGHTING) };
    this.fog            = { ...(config?.fog ?? DEFAULT_FOG) };
    this.shadow         = { ...(config?.shadow ?? DEFAULT_SHADOW) };
    this.sky            = { ...(config?.sky ?? DEFAULT_SKY) };
    this.postProcessing = { ...(config?.postProcessing ?? DEFAULT_POST_PROCESSING) };
  }

  // ── Mutation helpers ────────────────────────────────────────────────────────

  /** Update fog density (e.g. in response to weather changes). */
  setFogDensity(density: number): void {
    this.fog.density = Math.max(0, density);
  }

  /** Update fog colour (e.g. weather-driven blending). */
  setFogColor(r: number, g: number, b: number): void {
    this.fog.color = { r, g, b };
  }

  /** Update sun inclination (for time-of-day). */
  setSunInclination(inclination: number): void {
    this.sky.inclination = inclination;
  }

  /** Update ambient + sun intensity (for time-of-day / weather). */
  setLightIntensity(ambient: number, sun: number): void {
    this.lighting.ambientIntensity = Math.max(0, ambient);
    this.lighting.sunIntensity = Math.max(0, sun);
  }

  // ── Validation ────────────────────────────────────────────────────────────

  /** Returns a list of issues with the current configuration. */
  validate(): string[] {
    const issues: string[] = [];
    if (this.shadow.mapSize <= 0 || (this.shadow.mapSize & (this.shadow.mapSize - 1)) !== 0) {
      issues.push(`shadow.mapSize must be a positive power of two (got ${this.shadow.mapSize})`);
    }
    if (this.postProcessing.exposure <= 0) {
      issues.push(`postProcessing.exposure must be > 0 (got ${this.postProcessing.exposure})`);
    }
    if (this.postProcessing.contrast <= 0) {
      issues.push(`postProcessing.contrast must be > 0 (got ${this.postProcessing.contrast})`);
    }
    if (this.fog.density < 0) {
      issues.push(`fog.density must be >= 0 (got ${this.fog.density})`);
    }
    return issues;
  }

  /** Whether the current config passes all validation checks. */
  get isValid(): boolean {
    return this.validate().length === 0;
  }

  // ── Snapshot / Restore ────────────────────────────────────────────────────

  getSnapshot(): SceneHostConfig {
    return {
      clearColor: { ...this.clearColor },
      lighting: { ...this.lighting },
      fog: { ...this.fog },
      shadow: { ...this.shadow },
      sky: { ...this.sky },
      postProcessing: { ...this.postProcessing },
    };
  }

  restoreSnapshot(config: SceneHostConfig): void {
    this.clearColor     = { ...config.clearColor };
    this.lighting       = { ...config.lighting };
    this.fog            = { ...config.fog };
    this.shadow         = { ...config.shadow };
    this.sky            = { ...config.sky };
    this.postProcessing = { ...config.postProcessing };
  }
}
