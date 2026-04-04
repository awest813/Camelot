import type { BiomeType } from "./world-manager";

// ─── Option types ──────────────────────────────────────────────────────────────

/** High-level shape of the generated world, analogous to Minecraft's world type. */
export type WorldType = "normal" | "flat" | "amplified" | "island";

/**
 * Controls how large individual biome regions feel.
 * Smaller values → tighter, more varied transitions; larger values → expansive
 * single-biome stretches.
 */
export type BiomeScale = "small" | "medium" | "large" | "huge";

/**
 * How frequently procedural structures (ruins, shrines, watchtowers) appear.
 * Maps directly to a spawn-probability threshold.
 */
export type StructureDensity = "none" | "rare" | "normal" | "abundant";

/** Full set of world-generation knobs beyond the seed itself. */
export interface WorldGenOptions {
  /** Overall world shape. Default: "normal". */
  worldType: WorldType;
  /** Size of individual biome regions. Default: "medium". */
  biomeScale: BiomeScale;
  /** How often structures spawn. Default: "normal". */
  structureDensity: StructureDensity;
  /**
   * When set, forces the chunk at (0, 0) — and its immediate neighbours within
   * a small radius — to produce this biome, giving the player a predictable
   * starting area. `null` means no override.  Default: `null`.
   */
  startingBiome: BiomeType | null;
}

const DEFAULT_OPTIONS: WorldGenOptions = {
  worldType: "normal",
  biomeScale: "medium",
  structureDensity: "normal",
  startingBiome: null,
};

// ─── Biome-scale frequency tables ─────────────────────────────────────────────

interface BiomeFreqs {
  /** Primary sin frequency (chunkX axis). */
  fx: number;
  /** Primary sin frequency (chunkZ axis). */
  fz: number;
  /** Secondary cos frequency (chunkX axis). */
  cx: number;
  /** Secondary cos frequency (chunkZ axis). */
  cz: number;
}

const BIOME_SCALE_FREQS: Record<BiomeScale, BiomeFreqs> = {
  // Very tight — biomes flip every few chunks
  small:  { fx: 1.0,  fz: 0.6,  cx: 0.4,  cz: 1.4  },
  // Moderate — comparable to the legacy default (0.5 / 0.3 / 0.2 / 0.7)
  medium: { fx: 0.5,  fz: 0.3,  cx: 0.2,  cz: 0.7  },
  // Expansive — large sweeping biome zones
  large:  { fx: 0.2,  fz: 0.12, cx: 0.08, cz: 0.28 },
  // Continent-scale — massive biome regions
  huge:   { fx: 0.08, fz: 0.05, cx: 0.03, cz: 0.11 },
};

// ─── Structure density → spawn threshold ──────────────────────────────────────

const STRUCTURE_THRESHOLDS: Record<StructureDensity, number> = {
  none:     0.00,   // never
  rare:     0.10,   // ~10 % of chunks
  normal:   0.25,   // ~25 % of chunks (legacy default)
  abundant: 0.45,   // ~45 % of chunks
};

// ─── WorldSeed ─────────────────────────────────────────────────────────────────

/**
 * Minecraft-style world seed: a single number (or string hashed to a number)
 * that, together with a set of generation options, fully determines biome
 * layout, structure placement, and vegetation randomisation.
 *
 * Both `WorldManager.getBiome()` and `StructureManager.hasStructureAt()` / `_rand()`
 * delegate to this class when a seed is provided.
 *
 * @example
 * ```ts
 * // Numeric seed, default options
 * const seed = new WorldSeed(12345);
 *
 * // String seed — hashed to an integer
 * const seed2 = new WorldSeed("my world", { biomeScale: "large", structureDensity: "abundant" });
 * ```
 */
export class WorldSeed {
  /** Canonical string representation of the seed (always the original input as a string). */
  public readonly seedString: string;

  /** Numeric value used for generation. Derived from `seed` by hash when a string is supplied. */
  public readonly seedValue: number;

  /** Resolved, immutable copy of the generation options. */
  public readonly options: Readonly<WorldGenOptions>;

  constructor(seed: string | number, options: Partial<WorldGenOptions> = {}) {
    this.seedString = String(seed);
    this.seedValue  = typeof seed === "number"
      ? seed
      : WorldSeed.hashString(String(seed));
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  // ─── Seeded random ──────────────────────────────────────────────────────────

  /**
   * Deterministic pseudo-random value in `[0, 1)` seeded by chunk coordinates,
   * a slot index, and the world seed.
   *
   * Drop-in replacement for `StructureManager._rand()` when a seed is active.
   */
  public rand(cx: number, cz: number, slot: number): number {
    // Mix the world seed into the legacy trig hash to shift the entire
    // landscape without destroying its deterministic quality.
    const mix = (this.seedValue & 0xffff) * 0.0001;
    return Math.abs(Math.sin(cx * 217.3 + cz * 431.9 + slot * 83.1 + mix)) % 1;
  }

  // ─── Biome determination ────────────────────────────────────────────────────

  /**
   * Determine the biome at the given chunk coordinate, respecting the active
   * `WorldType`, `BiomeScale`, and optional `startingBiome` override.
   */
  public getBiome(chunkX: number, chunkZ: number): BiomeType {
    // Flat worlds are entirely plains — no variation
    if (this.options.worldType === "flat") return "plains";

    // Honour the starting-biome pin for the first few chunks around the origin
    if (this.options.startingBiome !== null) {
      const dist = Math.max(Math.abs(chunkX), Math.abs(chunkZ));
      if (dist <= 2) return this.options.startingBiome;
    }

    const f = BIOME_SCALE_FREQS[this.options.biomeScale];
    const mix = (this.seedValue & 0xffff) * 0.001;

    const v = Math.sin(chunkX * f.fx + chunkZ * f.fz + mix)
            * Math.cos(chunkX * f.cx - chunkZ * f.cz + mix * 0.7);
    const n = (v + 1) / 2; // normalise to [0, 1]

    if (this.options.worldType === "island") {
      // Island worlds: a lush central core surrounded by harsher terrain
      const dist = Math.sqrt(chunkX * chunkX + chunkZ * chunkZ);
      if (dist < 6) return n < 0.5 ? "plains" : "forest";
      return n < 0.5 ? "tundra" : "desert";
    }

    if (this.options.worldType === "amplified") {
      // Amplified worlds compress the normalised biome value toward extremes
      // for more dramatic contrasts.  The compression factor (4) maps the
      // [0, 0.5] half of n onto [0, 1] using a quadratic curve, producing
      // sharp biome boundaries.
      const AMPLIFIED_COMPRESSION = 4;
      const amp = n < 0.5
        ? n * n * AMPLIFIED_COMPRESSION
        : 1 - (1 - n) * (1 - n) * AMPLIFIED_COMPRESSION;
      const a = Math.max(0, Math.min(1, amp));
      if (a < 0.25) return "tundra";
      if (a < 0.5)  return "plains";
      if (a < 0.75) return "forest";
      return "desert";
    }

    // "normal" (and fallthrough)
    if (n < 0.25) return "tundra";
    if (n < 0.5)  return "plains";
    if (n < 0.75) return "forest";
    return "desert";
  }

  // ─── Structure placement ────────────────────────────────────────────────────

  /**
   * Returns whether a structure should be spawned at the given chunk.
   * Respects `structureDensity` and suppresses all structures on flat worlds.
   */
  public hasStructure(chunkX: number, chunkZ: number): boolean {
    if (this.options.worldType === "flat") return false;
    const threshold = STRUCTURE_THRESHOLDS[this.options.structureDensity];
    return this.rand(chunkX, chunkZ, 0) <= threshold;
  }

  // ─── Utilities ──────────────────────────────────────────────────────────────

  /**
   * Hash a string seed to a stable 32-bit integer using the djb2 algorithm.
   * The result is always non-negative.
   *
   * Implementation note: the intermediate `| 0` coerces the accumulator to a
   * signed 32-bit integer on every iteration, which is correct for djb2 — it
   * intentionally wraps on overflow.  The final `>>> 0` reinterprets the
   * signed result as an unsigned 32-bit value so the return is always ≥ 0.
   */
  public static hashString(s: string): number {
    let hash = 5381;
    for (let i = 0; i < s.length; i++) {
      // hash * 33 + charCode, keeping arithmetic in 32-bit signed range
      hash = (((hash << 5) + hash) + s.charCodeAt(i)) | 0;
    }
    return hash >>> 0; // reinterpret as unsigned 32-bit
  }
}
