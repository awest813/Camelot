import { createNoise2D } from "simplex-noise";
import type { BiomeType } from "./world-manager";
import { WorldSeed } from "./world-seed";

/** PRNG generator: deterministic 32-bit Mulberry32 algorithm. */
export function createMulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function (): number {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface TerrainConfig {
  /** Frequency of base macro continental shapes. Default: 0.005 */
  baseFrequency: number;
  /** Number of octaves for fractal Brownian motion. Default: 4 */
  octaves: number;
  /** Multiplier applied to frequency per octave. Default: 2.0 */
  lacunarity: number;
  /** Multiplier applied to amplitude per octave. Default: 0.5 */
  persistence: number;
  /** Base height amplitude in units. Default: 12.0 */
  heightScale: number;
  /** Global vertical elevation shift. Default: 0.0 */
  heightOffset: number;
}

export const DEFAULT_TERRAIN_CONFIG: Readonly<TerrainConfig> = {
  baseFrequency: 0.005,
  octaves: 4,
  lacunarity: 2.0,
  persistence: 0.5,
  heightScale: 12.0,
  heightOffset: 0.0,
};

export interface ClimateSample {
  temperature: number; // [-1, 1]
  moisture: number;    // [0, 1]
  biome: BiomeType;
}

/**
 * SimplexTerrainGenerator — continuous 3D terrain elevation and organic climate
 * modeling powered by Jonas Wagner's MIT-licensed `simplex-noise` engine.
 */
export class SimplexTerrainGenerator {
  public readonly seedString: string;
  public readonly seedNumber: number;
  public readonly config: TerrainConfig;

  private readonly _elevationNoise: (x: number, y: number) => number;
  private readonly _temperatureNoise: (x: number, y: number) => number;
  private readonly _moistureNoise: (x: number, y: number) => number;

  constructor(seed: string | number, config: Partial<TerrainConfig> = {}) {
    this.seedString = String(seed);
    this.seedNumber = typeof seed === "number" ? seed : WorldSeed.hashString(this.seedString);
    this.config = { ...DEFAULT_TERRAIN_CONFIG, ...config };

    const prngElevation = createMulberry32(this.seedNumber);
    const prngTemperature = createMulberry32(this.seedNumber ^ 0x5a5a5a5a);
    const prngMoisture = createMulberry32(this.seedNumber ^ 0x3c3c3c3c);

    this._elevationNoise = createNoise2D(prngElevation);
    this._temperatureNoise = createNoise2D(prngTemperature);
    this._moistureNoise = createNoise2D(prngMoisture);
  }

  /**
   * Sample Fractional Brownian Motion (fBm) noise at coordinate (x, y).
   * Result is normalised to roughly [-1, 1].
   */
  public sampleFbm(
    noiseFn: (x: number, y: number) => number,
    x: number,
    y: number,
    baseFreq: number,
    octaves: number,
    lacunarity: number = 2.0,
    persistence: number = 0.5,
  ): number {
    let total = 0;
    let freq = baseFreq;
    let amp = 1.0;
    let maxAmp = 0;

    for (let i = 0; i < octaves; i++) {
      total += noiseFn(x * freq, y * freq) * amp;
      maxAmp += amp;
      amp *= persistence;
      freq *= lacunarity;
    }

    return maxAmp > 0 ? total / maxAmp : 0;
  }

  /**
   * Continuous world height calculation at coordinates (worldX, worldZ).
   * Produces smooth rolling terrain across chunk boundaries.
   *
   * @param worldX World X coordinate (e.g. chunkX * chunkSize + localX).
   * @param worldZ World Z coordinate.
   * @param elevationMultiplier Optional dynamic elevation scaling (e.g. from world builder slider).
   */
  public getHeightAt(worldX: number, worldZ: number, elevationMultiplier: number = 1.0): number {
    const rawFbm = this.sampleFbm(
      this._elevationNoise,
      worldX,
      worldZ,
      this.config.baseFrequency,
      this.config.octaves,
      this.config.lacunarity,
      this.config.persistence,
    );

    // Normalise [-1, 1] to [0, 1] with subtle cubic shaping for flatter valleys
    const norm = (rawFbm + 1.0) * 0.5;
    const shaped = Math.pow(norm, 1.25);

    return (shaped * this.config.heightScale * elevationMultiplier) + this.config.heightOffset;
  }

  /**
   * Approximates local terrain gradient / slope steepness in [0, 1] range.
   * Useful for placing cliffs vs gentle grass slopes.
   */
  public getSlopeAt(worldX: number, worldZ: number, delta: number = 1.0): number {
    const hCenter = this.getHeightAt(worldX, worldZ);
    const hX = this.getHeightAt(worldX + delta, worldZ);
    const hZ = this.getHeightAt(worldX, worldZ + delta);

    const dx = (hX - hCenter) / delta;
    const dz = (hZ - hCenter) / delta;
    const gradient = Math.sqrt(dx * dx + dz * dz);

    return Math.min(1.0, gradient);
  }

  /**
   * Evaluates macro environmental climate (temperature and moisture) using
   * 2D multi-octave simplex noise, mapping into a Whittaker-style ecological matrix.
   */
  public getClimateAt(worldX: number, worldZ: number, globalTempShift: number = 0.0): ClimateSample {
    const climateFreq = this.config.baseFrequency * 0.35;

    // Temperature: [-1, 1]
    const rawTemp = this.sampleFbm(this._temperatureNoise, worldX, worldZ, climateFreq, 2);
    const temperature = Math.max(-1.0, Math.min(1.0, rawTemp + globalTempShift));

    // Moisture: [0, 1]
    const rawMoist = this.sampleFbm(this._moistureNoise, worldX, worldZ, climateFreq, 2);
    const moisture = Math.max(0.0, Math.min(1.0, (rawMoist + 1.0) * 0.5));

    const biome = this.classifyWhittakerBiome(temperature, moisture);
    return { temperature, moisture, biome };
  }

  /**
   * Classify temperature and moisture into the 4 core Camelot biomes:
   * tundra, plains, forest, desert.
   */
  public classifyWhittakerBiome(temperature: number, moisture: number): BiomeType {
    // Freezing alpine / sub-zero zone
    if (temperature < -0.25) {
      return "tundra";
    }

    // Arid / scorching zone
    if (temperature > 0.25 && moisture < 0.35) {
      return "desert";
    }

    // High moisture temperate zone
    if (moisture > 0.52) {
      return "forest";
    }

    // Balanced temperate meadows
    return "plains";
  }
}
