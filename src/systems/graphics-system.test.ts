import { describe, it, expect } from "vitest";
import {
  GraphicsSystem,
  DEFAULT_SHADOW,
  DEFAULT_POST_PROCESS,
  DEFAULT_SKY,
  DEFAULT_FOG,
  DEFAULT_LIGHTING,
  isPowerOfTwo,
  validateGraphicsConfig,
} from "./graphics-system";

// ── isPowerOfTwo helper ───────────────────────────────────────────────────────

describe("isPowerOfTwo", () => {
  it("returns true for standard shadow-map sizes", () => {
    for (const n of [256, 512, 1024, 2048, 4096]) {
      expect(isPowerOfTwo(n), `expected ${n} to be a power of two`).toBe(true);
    }
  });

  it("returns false for non-powers-of-two", () => {
    for (const n of [0, 3, 100, 1000, 1500]) {
      expect(isPowerOfTwo(n), `expected ${n} not to be a power of two`).toBe(false);
    }
  });

  it("returns false for negative numbers", () => {
    expect(isPowerOfTwo(-1024)).toBe(false);
  });

  it("returns false for non-integer values", () => {
    expect(isPowerOfTwo(512.5)).toBe(false);
  });

  it("returns false for NaN and Infinity", () => {
    expect(isPowerOfTwo(NaN)).toBe(false);
    expect(isPowerOfTwo(Infinity)).toBe(false);
  });
});

// ── Default preset smoke tests ────────────────────────────────────────────────

describe("default presets", () => {
  it("DEFAULT_SHADOW has valid power-of-two mapSize", () => {
    expect(isPowerOfTwo(DEFAULT_SHADOW.mapSize)).toBe(true);
  });

  it("DEFAULT_SHADOW has positive blurKernel", () => {
    expect(DEFAULT_SHADOW.blurKernel).toBeGreaterThan(0);
  });

  it("DEFAULT_POST_PROCESS bloom threshold is in [0, 1]", () => {
    const { threshold } = DEFAULT_POST_PROCESS.bloom;
    expect(threshold).toBeGreaterThanOrEqual(0);
    expect(threshold).toBeLessThanOrEqual(1);
  });

  it("DEFAULT_POST_PROCESS bloom weight is positive", () => {
    expect(DEFAULT_POST_PROCESS.bloom.weight).toBeGreaterThan(0);
  });

  it("DEFAULT_POST_PROCESS bloom kernel is a positive integer", () => {
    const { kernel } = DEFAULT_POST_PROCESS.bloom;
    expect(kernel).toBeGreaterThan(0);
    expect(Number.isInteger(kernel)).toBe(true);
  });

  it("DEFAULT_POST_PROCESS bloom scale is in (0, 1]", () => {
    const { scale } = DEFAULT_POST_PROCESS.bloom;
    expect(scale).toBeGreaterThan(0);
    expect(scale).toBeLessThanOrEqual(1);
  });

  it("DEFAULT_POST_PROCESS exposure is positive", () => {
    expect(DEFAULT_POST_PROCESS.exposure).toBeGreaterThan(0);
  });

  it("DEFAULT_POST_PROCESS contrast is positive", () => {
    expect(DEFAULT_POST_PROCESS.contrast).toBeGreaterThan(0);
  });

  it("DEFAULT_POST_PROCESS sharpenEdgeAmount is in [0, 1]", () => {
    const { sharpenEdgeAmount } = DEFAULT_POST_PROCESS;
    expect(sharpenEdgeAmount).toBeGreaterThanOrEqual(0);
    expect(sharpenEdgeAmount).toBeLessThanOrEqual(1);
  });

  it("DEFAULT_POST_PROCESS vignetteWeight is non-negative", () => {
    expect(DEFAULT_POST_PROCESS.vignetteWeight).toBeGreaterThanOrEqual(0);
  });

  it("DEFAULT_SKY luminance is in [0, 1]", () => {
    expect(DEFAULT_SKY.luminance).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_SKY.luminance).toBeLessThanOrEqual(1);
  });

  it("DEFAULT_SKY turbidity is positive", () => {
    expect(DEFAULT_SKY.turbidity).toBeGreaterThan(0);
  });

  it("DEFAULT_SKY rayleigh is non-negative", () => {
    expect(DEFAULT_SKY.rayleigh).toBeGreaterThanOrEqual(0);
  });

  it("DEFAULT_SKY mieCoefficient is non-negative", () => {
    expect(DEFAULT_SKY.mieCoefficient).toBeGreaterThanOrEqual(0);
  });

  it("DEFAULT_SKY mieDirectionalG is in [0, 1]", () => {
    expect(DEFAULT_SKY.mieDirectionalG).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_SKY.mieDirectionalG).toBeLessThanOrEqual(1);
  });

  it("DEFAULT_SKY azimuth is in [0, 1]", () => {
    expect(DEFAULT_SKY.azimuth).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_SKY.azimuth).toBeLessThanOrEqual(1);
  });

  it("DEFAULT_SKY inclination is a finite number", () => {
    expect(Number.isFinite(DEFAULT_SKY.inclination)).toBe(true);
  });

  it("DEFAULT_FOG density is positive", () => {
    expect(DEFAULT_FOG.density).toBeGreaterThan(0);
  });

  it("DEFAULT_FOG color channels are all in [0, 1]", () => {
    const { r, g, b } = DEFAULT_FOG.color;
    expect(r).toBeGreaterThanOrEqual(0); expect(r).toBeLessThanOrEqual(1);
    expect(g).toBeGreaterThanOrEqual(0); expect(g).toBeLessThanOrEqual(1);
    expect(b).toBeGreaterThanOrEqual(0); expect(b).toBeLessThanOrEqual(1);
  });

  it("DEFAULT_LIGHTING ambientBase is positive", () => {
    expect(DEFAULT_LIGHTING.ambientBase).toBeGreaterThan(0);
  });

  it("DEFAULT_LIGHTING sunBase is positive", () => {
    expect(DEFAULT_LIGHTING.sunBase).toBeGreaterThan(0);
  });
});

// ── Fog / WeatherSystem consistency ──────────────────────────────────────────

describe("DEFAULT_FOG / WeatherSystem 'clear' state consistency", () => {
  /**
   * The WeatherSystem 'clear' preset (defined in weather-system.ts) must match
   * DEFAULT_FOG so the very first rendered frame before WeatherSystem.update()
   * is called looks identical to what WeatherSystem would set.
   *
   * If this test fails it means either:
   *   (a) weather-system.ts was changed without updating DEFAULT_FOG, or
   *   (b) DEFAULT_FOG was changed without updating weather-system.ts.
   */
  it("DEFAULT_FOG density matches WeatherSystem clear fog density (0.006)", () => {
    expect(DEFAULT_FOG.density).toBeCloseTo(0.006, 5);
  });

  it("DEFAULT_FOG color matches WeatherSystem clear fog color (0.50, 0.60, 0.72)", () => {
    expect(DEFAULT_FOG.color.r).toBeCloseTo(0.50, 4);
    expect(DEFAULT_FOG.color.g).toBeCloseTo(0.60, 4);
    expect(DEFAULT_FOG.color.b).toBeCloseTo(0.72, 4);
  });
});

// ── validateGraphicsConfig ────────────────────────────────────────────────────

function validConfig() {
  return {
    shadow:      { ...DEFAULT_SHADOW },
    postProcess: {
      ...DEFAULT_POST_PROCESS,
      bloom: { ...DEFAULT_POST_PROCESS.bloom },
    },
    sky:         { ...DEFAULT_SKY },
    fog:         { ...DEFAULT_FOG, color: { ...DEFAULT_FOG.color } },
    lighting:    { ...DEFAULT_LIGHTING },
  };
}

describe("validateGraphicsConfig", () => {
  it("returns no errors for the default configuration", () => {
    expect(validateGraphicsConfig(validConfig())).toHaveLength(0);
  });

  // ── Shadow validation ───────────────────────────────────────────────────
  it("reports error when shadow.mapSize is not a power of two", () => {
    const cfg = validConfig();
    cfg.shadow.mapSize = 1000;
    const errors = validateGraphicsConfig(cfg);
    expect(errors.some(e => e.includes("mapSize"))).toBe(true);
  });

  it("reports error when shadow.mapSize is zero", () => {
    const cfg = validConfig();
    cfg.shadow.mapSize = 0;
    const errors = validateGraphicsConfig(cfg);
    expect(errors.some(e => e.includes("mapSize"))).toBe(true);
  });

  it("reports error when shadow.blurKernel is negative", () => {
    const cfg = validConfig();
    cfg.shadow.blurKernel = -1;
    const errors = validateGraphicsConfig(cfg);
    expect(errors.some(e => e.includes("blurKernel"))).toBe(true);
  });

  it("reports error when shadow.blurKernel is NaN", () => {
    const cfg = validConfig();
    cfg.shadow.blurKernel = NaN;
    const errors = validateGraphicsConfig(cfg);
    expect(errors.some(e => e.includes("blurKernel"))).toBe(true);
  });

  // ── Bloom validation ────────────────────────────────────────────────────
  it("reports error when bloom.threshold > 1", () => {
    const cfg = validConfig();
    cfg.postProcess.bloom.threshold = 1.5;
    expect(validateGraphicsConfig(cfg).some(e => e.includes("threshold"))).toBe(true);
  });

  it("reports error when bloom.threshold < 0", () => {
    const cfg = validConfig();
    cfg.postProcess.bloom.threshold = -0.1;
    expect(validateGraphicsConfig(cfg).some(e => e.includes("threshold"))).toBe(true);
  });

  it("reports error when bloom.weight is zero", () => {
    const cfg = validConfig();
    cfg.postProcess.bloom.weight = 0;
    expect(validateGraphicsConfig(cfg).some(e => e.includes("weight"))).toBe(true);
  });

  it("reports error when bloom.kernel is not an integer", () => {
    const cfg = validConfig();
    cfg.postProcess.bloom.kernel = 4.5;
    expect(validateGraphicsConfig(cfg).some(e => e.includes("kernel"))).toBe(true);
  });

  it("reports error when bloom.scale is 0", () => {
    const cfg = validConfig();
    cfg.postProcess.bloom.scale = 0;
    expect(validateGraphicsConfig(cfg).some(e => e.includes("scale"))).toBe(true);
  });

  it("reports error when bloom.scale > 1", () => {
    const cfg = validConfig();
    cfg.postProcess.bloom.scale = 2;
    expect(validateGraphicsConfig(cfg).some(e => e.includes("scale"))).toBe(true);
  });

  // ── Post-process validation ─────────────────────────────────────────────
  it("reports error when sharpenEdgeAmount > 1", () => {
    const cfg = validConfig();
    cfg.postProcess.sharpenEdgeAmount = 1.5;
    expect(validateGraphicsConfig(cfg).some(e => e.includes("sharpenEdgeAmount"))).toBe(true);
  });

  it("reports error when exposure is zero", () => {
    const cfg = validConfig();
    cfg.postProcess.exposure = 0;
    expect(validateGraphicsConfig(cfg).some(e => e.includes("exposure"))).toBe(true);
  });

  it("reports error when contrast is negative", () => {
    const cfg = validConfig();
    cfg.postProcess.contrast = -1;
    expect(validateGraphicsConfig(cfg).some(e => e.includes("contrast"))).toBe(true);
  });

  it("reports error when vignetteWeight is negative", () => {
    const cfg = validConfig();
    cfg.postProcess.vignetteWeight = -0.5;
    expect(validateGraphicsConfig(cfg).some(e => e.includes("vignetteWeight"))).toBe(true);
  });

  // ── Sky validation ──────────────────────────────────────────────────────
  it("reports error when sky.turbidity is zero", () => {
    const cfg = validConfig();
    cfg.sky.turbidity = 0;
    expect(validateGraphicsConfig(cfg).some(e => e.includes("turbidity"))).toBe(true);
  });

  it("reports error when sky.luminance > 1", () => {
    const cfg = validConfig();
    cfg.sky.luminance = 1.5;
    expect(validateGraphicsConfig(cfg).some(e => e.includes("luminance"))).toBe(true);
  });

  it("reports error when sky.luminance < 0", () => {
    const cfg = validConfig();
    cfg.sky.luminance = -0.1;
    expect(validateGraphicsConfig(cfg).some(e => e.includes("luminance"))).toBe(true);
  });

  it("reports error when sky.rayleigh is negative", () => {
    const cfg = validConfig();
    cfg.sky.rayleigh = -1;
    expect(validateGraphicsConfig(cfg).some(e => e.includes("rayleigh"))).toBe(true);
  });

  it("reports error when sky.mieCoefficient is negative", () => {
    const cfg = validConfig();
    cfg.sky.mieCoefficient = -0.001;
    expect(validateGraphicsConfig(cfg).some(e => e.includes("mieCoefficient"))).toBe(true);
  });

  it("reports error when sky.mieDirectionalG > 1", () => {
    const cfg = validConfig();
    cfg.sky.mieDirectionalG = 1.1;
    expect(validateGraphicsConfig(cfg).some(e => e.includes("mieDirectionalG"))).toBe(true);
  });

  it("reports error when sky.mieDirectionalG < 0", () => {
    const cfg = validConfig();
    cfg.sky.mieDirectionalG = -0.1;
    expect(validateGraphicsConfig(cfg).some(e => e.includes("mieDirectionalG"))).toBe(true);
  });

  it("reports error when sky.azimuth > 1", () => {
    const cfg = validConfig();
    cfg.sky.azimuth = 1.5;
    expect(validateGraphicsConfig(cfg).some(e => e.includes("azimuth"))).toBe(true);
  });

  it("reports error when sky.azimuth < 0", () => {
    const cfg = validConfig();
    cfg.sky.azimuth = -0.1;
    expect(validateGraphicsConfig(cfg).some(e => e.includes("azimuth"))).toBe(true);
  });

  it("reports error when sky.inclination is NaN", () => {
    const cfg = validConfig();
    cfg.sky.inclination = NaN;
    expect(validateGraphicsConfig(cfg).some(e => e.includes("inclination"))).toBe(true);
  });

  it("reports error when sky.inclination is Infinity", () => {
    const cfg = validConfig();
    cfg.sky.inclination = Infinity;
    expect(validateGraphicsConfig(cfg).some(e => e.includes("inclination"))).toBe(true);
  });

  // ── Fog validation ──────────────────────────────────────────────────────
  it("reports error when fog.density is zero", () => {
    const cfg = validConfig();
    cfg.fog.density = 0;
    expect(validateGraphicsConfig(cfg).some(e => e.includes("density"))).toBe(true);
  });

  it("reports error when fog.density is negative", () => {
    const cfg = validConfig();
    cfg.fog.density = -0.01;
    expect(validateGraphicsConfig(cfg).some(e => e.includes("density"))).toBe(true);
  });

  it("reports error when fog.color.r is out of [0, 1]", () => {
    const cfg = validConfig();
    cfg.fog.color.r = 1.5;
    expect(validateGraphicsConfig(cfg).some(e => e.includes("fog.color.r"))).toBe(true);
  });

  it("reports error when fog.color.g is negative", () => {
    const cfg = validConfig();
    cfg.fog.color.g = -0.1;
    expect(validateGraphicsConfig(cfg).some(e => e.includes("fog.color.g"))).toBe(true);
  });

  it("reports error when fog.color.b is NaN", () => {
    const cfg = validConfig();
    cfg.fog.color.b = NaN;
    expect(validateGraphicsConfig(cfg).some(e => e.includes("fog.color.b"))).toBe(true);
  });

  // ── Lighting validation ─────────────────────────────────────────────────
  it("reports error when lighting.ambientBase is zero", () => {
    const cfg = validConfig();
    cfg.lighting.ambientBase = 0;
    expect(validateGraphicsConfig(cfg).some(e => e.includes("ambientBase"))).toBe(true);
  });

  it("reports error when lighting.sunBase is negative", () => {
    const cfg = validConfig();
    cfg.lighting.sunBase = -1;
    expect(validateGraphicsConfig(cfg).some(e => e.includes("sunBase"))).toBe(true);
  });

  // ── Multiple errors ─────────────────────────────────────────────────────
  it("collects multiple errors when multiple fields are invalid", () => {
    const cfg = validConfig();
    cfg.shadow.mapSize          = 1000;  // not power-of-two
    cfg.postProcess.bloom.threshold = 2; // > 1
    cfg.fog.density             = -1;    // negative
    const errors = validateGraphicsConfig(cfg);
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });
});

// ── GraphicsSystem class ──────────────────────────────────────────────────────

describe("GraphicsSystem", () => {
  it("constructs with defaults when no arguments given", () => {
    const gfx = new GraphicsSystem();
    expect(gfx.shadow).toEqual(DEFAULT_SHADOW);
    expect(gfx.sky).toEqual(DEFAULT_SKY);
    expect(gfx.fog.density).toBeCloseTo(DEFAULT_FOG.density, 5);
    expect(gfx.lighting).toEqual(DEFAULT_LIGHTING);
  });

  it("isValid returns true for the default configuration", () => {
    expect(new GraphicsSystem().isValid).toBe(true);
  });

  it("validate() returns empty array for default configuration", () => {
    expect(new GraphicsSystem().validate()).toHaveLength(0);
  });

  it("accepts shadow overrides", () => {
    const gfx = new GraphicsSystem({ shadow: { mapSize: 2048, blurKernel: 32 } });
    expect(gfx.shadow.mapSize).toBe(2048);
    expect(gfx.shadow.blurKernel).toBe(32);
  });

  it("accepts sky overrides", () => {
    const gfx = new GraphicsSystem({ sky: { turbidity: 10, inclination: 0.0 } });
    expect(gfx.sky.turbidity).toBe(10);
    expect(gfx.sky.inclination).toBe(0.0);
    // Unoverridden fields retain defaults
    expect(gfx.sky.luminance).toBeCloseTo(DEFAULT_SKY.luminance, 5);
  });

  it("accepts fog overrides", () => {
    const gfx = new GraphicsSystem({ fog: { density: 0.030 } });
    expect(gfx.fog.density).toBeCloseTo(0.030, 5);
    // Color retains default
    expect(gfx.fog.color.r).toBeCloseTo(DEFAULT_FOG.color.r, 5);
  });

  it("accepts fog color override (partial)", () => {
    const gfx = new GraphicsSystem({ fog: { color: { r: 0.70 } } as any });
    expect(gfx.fog.color.r).toBeCloseTo(0.70, 5);
    expect(gfx.fog.color.g).toBeCloseTo(DEFAULT_FOG.color.g, 5);
    expect(gfx.fog.color.b).toBeCloseTo(DEFAULT_FOG.color.b, 5);
  });

  it("accepts lighting overrides", () => {
    const gfx = new GraphicsSystem({ lighting: { ambientBase: 0.80, sunBase: 1.20 } });
    expect(gfx.lighting.ambientBase).toBeCloseTo(0.80, 5);
    expect(gfx.lighting.sunBase).toBeCloseTo(1.20, 5);
  });

  it("accepts bloom overrides inside postProcess", () => {
    const gfx = new GraphicsSystem({ postProcess: { bloom: { threshold: 0.5 } } });
    expect(gfx.postProcess.bloom.threshold).toBeCloseTo(0.5, 5);
    // Other bloom fields retain defaults
    expect(gfx.postProcess.bloom.weight).toBeCloseTo(DEFAULT_POST_PROCESS.bloom.weight, 5);
  });

  it("isValid returns false when shadow.mapSize is invalid", () => {
    const gfx = new GraphicsSystem({ shadow: { mapSize: 1000 } });
    expect(gfx.isValid).toBe(false);
  });

  it("validate() lists the shadow.mapSize error message", () => {
    const gfx = new GraphicsSystem({ shadow: { mapSize: 1000 } });
    const errors = gfx.validate();
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toMatch(/mapSize/);
  });

  it("isValid returns false when fog.density is 0", () => {
    const gfx = new GraphicsSystem({ fog: { density: 0 } });
    expect(gfx.isValid).toBe(false);
  });

  it("default toneMappingType is 'aces'", () => {
    expect(new GraphicsSystem().postProcess.toneMappingType).toBe("aces");
  });

  it("toneMappingType can be overridden to 'none'", () => {
    const gfx = new GraphicsSystem({ postProcess: { toneMappingType: "none" } });
    expect(gfx.postProcess.toneMappingType).toBe("none");
  });

  it("default fxaa is true", () => {
    expect(new GraphicsSystem().postProcess.fxaa).toBe(true);
  });

  it("fxaa can be disabled via override", () => {
    const gfx = new GraphicsSystem({ postProcess: { fxaa: false } });
    expect(gfx.postProcess.fxaa).toBe(false);
  });
});
