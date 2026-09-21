import { WorldSeed, type WorldType, type BiomeScale, type StructureDensity, type WorldGenOptions } from "../world/world-seed";
import type { BiomeType } from "../world/world-manager";
import { SimplexTerrainGenerator } from "../world/simplex-terrain";
import {
  VoronoiWorldGraph,
  type WorldSettlement,
  type WorldProvince,
  type WorldRoadEdge,
} from "../world/voronoi-world";
import {
  RiverNetworkGenerator,
  type River,
  type LakeBasin,
} from "../world/river-network";
import { ArthurianNameGenerator } from "../world/arthurian-names";

// ─── Interfaces & Types ───────────────────────────────────────────────────────

/** Full configuration for world generation and environmental parameters. */
export interface WorldGenConfig {
  /** Text or numeric seed value. Strings are hashed via djb2. */
  seed: string;
  /** High-level shape of the world (normal, flat, amplified, island). */
  worldType: WorldType;
  /** Scale/extent of biome regions (small, medium, large, huge). */
  biomeScale: BiomeScale;
  /** Frequency of procedural structures (none, rare, normal, abundant). */
  structureDensity: StructureDensity;
  /** Specific starting biome override at world origin (or null for procedural). */
  startingBiome: BiomeType | null;
  /** Elevation multiplier applied to terrain height (default: 1.0, range: [0.5, 3.0]). */
  elevationScale: number;
  /** Density multiplier for trees, bushes, and rocks (default: 1.0, range: [0.0, 2.5]). */
  vegetationDensity: number;
  /** Global temperature shift (-1.0 = colder/tundra bias, +1.0 = warmer/desert bias). */
  temperatureShift: number;
}

/** Definition for a named world region with geographic bounds and gameplay tuning. */
export interface WorldRegion {
  id: string;
  name: string;
  /** Rectangular chunk bounds [minCX, minCZ, maxCX, maxCZ]. */
  bounds: {
    minCX: number;
    minCZ: number;
    maxCX: number;
    maxCZ: number;
  };
  /** Dominant biome characteristic of this region. */
  biome: BiomeType;
  /** Danger / level scaling rating for encounters (1 to 10). */
  dangerLevel: number;
  /** Encounter frequency multiplier (default: 1.0, range: [0.0, 3.0]). */
  encounterRate: number;
  /** Optional lore or description for the region. */
  description?: string;
}

/** Pre-configured world setup that can be loaded with a single click. */
export interface WorldPreset {
  id: string;
  name: string;
  description: string;
  config: WorldGenConfig;
  regions?: WorldRegion[];
}

/** 2D grid sample for visualizing a chunk cell in the world map preview. */
export interface ChunkCellSample {
  cx: number;
  cz: number;
  biome: BiomeType;
  hasStructure: boolean;
  elevation: number;
  temperature: number;
  moisture: number;
  isStartingChunk: boolean;
  riverFlow?: number;
  isWaterBody?: boolean;
}

export interface WorldBuilderValidationIssue {
  field: string;
  message: string;
  severity: "error" | "warning";
}

export interface WorldBuilderValidationReport {
  isValid: boolean;
  issues: WorldBuilderValidationIssue[];
}

export interface WorldBuilderExportData {
  version: 1;
  name: string;
  exportedAt: string;
  config: WorldGenConfig;
  regions: WorldRegion[];
  settlements?: WorldSettlement[];
  rivers?: River[];
  lakes?: LakeBasin[];
}

// ─── Default Constants ────────────────────────────────────────────────────────

export const DEFAULT_WORLD_CONFIG: Readonly<WorldGenConfig> = {
  seed: "Avalon",
  worldType: "normal",
  biomeScale: "medium",
  structureDensity: "normal",
  startingBiome: null,
  elevationScale: 1.0,
  vegetationDensity: 1.0,
  temperatureShift: 0.0,
};

export const BUILTIN_WORLD_PRESETS: ReadonlyArray<WorldPreset> = [
  {
    id: "classic_avalon",
    name: "Classic Avalon",
    description: "Balanced Arthurian realm with rolling plains, ancient woodlands, and classic ruins.",
    config: {
      seed: "Avalon",
      worldType: "normal",
      biomeScale: "medium",
      structureDensity: "normal",
      startingBiome: "plains",
      elevationScale: 1.0,
      vegetationDensity: 1.1,
      temperatureShift: 0.0,
    },
    regions: [
      {
        id: "avalon_vale",
        name: "Vale of Avalon",
        bounds: { minCX: -4, minCZ: -4, maxCX: 4, maxCZ: 4 },
        biome: "plains",
        dangerLevel: 1,
        encounterRate: 0.8,
        description: "The serene heartland of the realm where young knights begin their quest.",
      },
      {
        id: "broceliande",
        name: "Forest of Brocéliande",
        bounds: { minCX: 5, minCZ: -6, maxCX: 14, maxCZ: 8 },
        biome: "forest",
        dangerLevel: 3,
        encounterRate: 1.3,
        description: "An enchanted, dense forest steeped in Arthurian lore and bandit hideouts.",
      },
    ],
  },
  {
    id: "frostpeak_reach",
    name: "Frostpeak Reach",
    description: "Harsh northern highlands characterized by dramatic frozen crags and sub-zero tundra.",
    config: {
      seed: "Frostpeak",
      worldType: "amplified",
      biomeScale: "large",
      structureDensity: "rare",
      startingBiome: "tundra",
      elevationScale: 1.8,
      vegetationDensity: 0.6,
      temperatureShift: -0.6,
    },
    regions: [
      {
        id: "howling_pass",
        name: "Howling Pass",
        bounds: { minCX: -6, minCZ: -6, maxCX: 6, maxCZ: 6 },
        biome: "tundra",
        dangerLevel: 5,
        encounterRate: 1.4,
        description: "A wind-scoured mountain pass crawling with ice wolves and frost trolls.",
      },
    ],
  },
  {
    id: "sunken_isles",
    name: "Sunken Isles",
    description: "An isolated central archipelago encircled by treacherous outer coastal barriers.",
    config: {
      seed: "Archipelago",
      worldType: "island",
      biomeScale: "small",
      structureDensity: "abundant",
      startingBiome: "plains",
      elevationScale: 0.8,
      vegetationDensity: 1.2,
      temperatureShift: 0.1,
    },
    regions: [
      {
        id: "isle_of_glass",
        name: "Isle of Glass",
        bounds: { minCX: -3, minCZ: -3, maxCX: 3, maxCZ: 3 },
        biome: "plains",
        dangerLevel: 2,
        encounterRate: 0.9,
        description: "Central island sheltered from ocean gales, dotted with forgotten shrines.",
      },
    ],
  },
  {
    id: "whispering_wilds",
    name: "Whispering Wilds",
    description: "Endless continent-scale ancient forest brimming with overgrown stone monuments and wildlife.",
    config: {
      seed: "OldForest",
      worldType: "normal",
      biomeScale: "huge",
      structureDensity: "abundant",
      startingBiome: "forest",
      elevationScale: 1.1,
      vegetationDensity: 1.8,
      temperatureShift: -0.1,
    },
    regions: [],
  },
  {
    id: "scorched_expanse",
    name: "Scorched Expanse",
    description: "Vast windswept desert dunes and red sandstone canyons with scattered oasis outposts.",
    config: {
      seed: "Wasteland",
      worldType: "amplified",
      biomeScale: "large",
      structureDensity: "rare",
      startingBiome: "desert",
      elevationScale: 1.3,
      vegetationDensity: 0.3,
      temperatureShift: 0.8,
    },
    regions: [],
  },
];

// ─── WorldBuilderSystem ───────────────────────────────────────────────────────

/**
 * Headless world builder & generator engine.
 *
 * Manages world seed configuration, procedural sampling, custom presets,
 * region definitions, validation, and JSON serialization.
 */
export class WorldBuilderSystem {
  private _config: WorldGenConfig;
  private _regions: Map<string, WorldRegion> = new Map();
  private _customPresets: Map<string, WorldPreset> = new Map();
  private _terrainGen!: SimplexTerrainGenerator;
  private _voronoiGraph!: VoronoiWorldGraph;
  private _riverGen!: RiverNetworkGenerator;

  /** Callback fired whenever the world configuration changes. */
  public onConfigChanged: ((config: Readonly<WorldGenConfig>) => void) | null = null;

  constructor(initialConfig: Partial<WorldGenConfig> = {}) {
    this._config = { ...DEFAULT_WORLD_CONFIG, ...initialConfig };
    this._syncGenerators();
  }

  private _syncGenerators(): void {
    this._terrainGen = new SimplexTerrainGenerator(this._config.seed, {
      heightScale: 12.0 * Math.max(0.1, this._config.elevationScale),
    });
    this._voronoiGraph = new VoronoiWorldGraph(
      VoronoiWorldGraph.generateSeededSettlements(this._terrainGen.seedNumber, 8, 7),
    );
    this._riverGen = new RiverNetworkGenerator({
      seed: this._config.seed,
      minFlowThreshold: 3,
      sourceElevationMin: 0.15,
    });
  }

  // ── Configuration Accessors ───────────────────────────────────────────────

  public get config(): Readonly<WorldGenConfig> {
    return this._config;
  }

  public get terrainGen(): SimplexTerrainGenerator {
    return this._terrainGen;
  }

  public get voronoiGraph(): VoronoiWorldGraph {
    return this._voronoiGraph;
  }

  public get riverGen(): RiverNetworkGenerator {
    return this._riverGen;
  }

  public get settlements(): WorldSettlement[] {
    return this._voronoiGraph.settlements;
  }

  public get provinces(): WorldProvince[] {
    return this._voronoiGraph.provinces;
  }

  public get roads(): WorldRoadEdge[] {
    return this._voronoiGraph.roads;
  }

  public get rivers(): River[] {
    return this._riverGen.rivers;
  }

  public get lakes(): LakeBasin[] {
    return this._riverGen.lakes;
  }

  public setConfig(update: Partial<WorldGenConfig>): void {
    this._config = { ...this._config, ...update };
    this._clampConfig();
    this._syncGenerators();
    this.onConfigChanged?.(this._config);
  }

  public setSeed(seed: string): void {
    this.setConfig({ seed });
  }

  public randomizeSeed(): string {
    const randomValue = Math.floor(Math.random() * 0xffffffff).toString();
    this.setSeed(randomValue);
    return randomValue;
  }

  public setWorldType(worldType: WorldType): void {
    this.setConfig({ worldType });
  }

  public setBiomeScale(biomeScale: BiomeScale): void {
    this.setConfig({ biomeScale });
  }

  public setStructureDensity(structureDensity: StructureDensity): void {
    this.setConfig({ structureDensity });
  }

  public setStartingBiome(startingBiome: BiomeType | null): void {
    this.setConfig({ startingBiome });
  }

  public setElevationScale(elevationScale: number): void {
    this.setConfig({ elevationScale });
  }

  public setVegetationDensity(vegetationDensity: number): void {
    this.setConfig({ vegetationDensity });
  }

  public setTemperatureShift(temperatureShift: number): void {
    this.setConfig({ temperatureShift });
  }

  private _clampConfig(): void {
    this._config.elevationScale = Math.min(3.0, Math.max(0.5, this._config.elevationScale));
    this._config.vegetationDensity = Math.min(2.5, Math.max(0.0, this._config.vegetationDensity));
    this._config.temperatureShift = Math.min(1.0, Math.max(-1.0, this._config.temperatureShift));
  }

  // ── Runtime WorldSeed Bridge ──────────────────────────────────────────────

  /** Creates a runtime WorldSeed instance that WorldManager can consume directly. */
  public toWorldSeed(): WorldSeed {
    const opts: Partial<WorldGenOptions> = {
      worldType: this._config.worldType,
      biomeScale: this._config.biomeScale,
      structureDensity: this._config.structureDensity,
      startingBiome: this._config.startingBiome,
    };
    return new WorldSeed(this._config.seed, opts);
  }

  // ── 2D Grid Sampling (Minimap / Preview) ───────────────────────────────────

  /**
   * Samples a 2D matrix of chunk cells around a center chunk coordinate.
   * Useful for real-time 2D visual minimap previews without spinning up 3D geometry.
   *
   * @param radius Chebyshev radius (e.g. 7 = 15x15 chunks, 10 = 21x21 chunks).
   * @param centerCX Center chunk X (default 0).
   * @param centerCZ Center chunk Z (default 0).
   */
  public sampleGrid(radius: number = 7, centerCX: number = 0, centerCZ: number = 0): ChunkCellSample[][] {
    const r = Math.max(1, Math.min(20, Math.floor(radius)));
    const worldSeed = this.toWorldSeed();
    const rows: ChunkCellSample[][] = [];

    // Pre-calculate river network across sampled extent
    this._riverGen.generate(
      centerCX - r,
      centerCX + r,
      centerCZ - r,
      centerCZ + r,
      (cx, cz) => this._terrainGen.getHeightAt(cx * 16, cz * 16, this._config.elevationScale),
    );

    for (let z = -r; z <= r; z++) {
      const row: ChunkCellSample[] = [];
      const cz = centerCZ + z;
      for (let x = -r; x <= r; x++) {
        const cx = centerCX + x;
        let biome = worldSeed.getBiome(cx, cz);

        // Apply temperature shift bias if not overridden by flat or startingBiome
        if (this._config.worldType !== "flat" && Math.abs(this._config.temperatureShift) > 0.05) {
          const shift = this._config.temperatureShift;
          if (shift > 0.3 && biome === "tundra") biome = "plains";
          else if (shift > 0.6 && biome === "plains") biome = "desert";
          else if (shift < -0.3 && biome === "desert") biome = "plains";
          else if (shift < -0.6 && biome === "plains") biome = "tundra";
        }

        // Apply custom region biome override if chunk is within a defined region
        const region = this.getRegionAt(cx, cz);
        if (region) {
          biome = region.biome;
        }

        const hasStructure = worldSeed.hasStructure(cx, cz);
        const distToOrigin = Math.max(Math.abs(cx), Math.abs(cz));
        const isStartingChunk = distToOrigin <= 1;

        const climate = this._terrainGen.getClimateAt(cx * 16, cz * 16, this._config.temperatureShift);

        // Continuous fractal elevation derived from simplex noise blended with biome baseline
        let baseElev = 0.5;
        if (biome === "tundra" || this._config.worldType === "amplified") baseElev = 0.85;
        else if (biome === "plains") baseElev = 0.4;
        else if (biome === "desert") baseElev = 0.55;
        else if (biome === "forest") baseElev = 0.6;
        const simplexH = this._terrainGen.getHeightAt(cx * 16, cz * 16, this._config.elevationScale);
        const normSimplex = Math.max(
          0,
          Math.min(1.0, simplexH / Math.max(1.0, this._terrainGen.config.heightScale * this._config.elevationScale)),
        );
        const elevation = Math.min(1.0, (baseElev * 0.35 + normSimplex * 0.65) * this._config.elevationScale);

        const waterInfo = this._riverGen.getWaterInfoAt(cx, cz);

        row.push({
          cx,
          cz,
          biome,
          hasStructure,
          elevation,
          temperature: climate.temperature,
          moisture: climate.moisture,
          isStartingChunk,
          riverFlow: waterInfo.flow,
          isWaterBody: waterInfo.isWater,
        });
      }
      rows.push(row);
    }

    return rows;
  }

  /** Generates a procedurally-named Arthurian region with randomized bounds and danger. */
  public generateArthurianRegion(biome: BiomeType = "plains"): WorldRegion {
    const id = `reg_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const name = ArthurianNameGenerator.generateRegionName(Math.floor(Math.random() * 0xffff), biome);
    const boundsRadius = Math.floor(2 + Math.random() * 3);
    const centerCX = Math.floor((Math.random() - 0.5) * 8);
    const centerCZ = Math.floor((Math.random() - 0.5) * 8);

    return {
      id,
      name,
      bounds: {
        minCX: centerCX - boundsRadius,
        minCZ: centerCZ - boundsRadius,
        maxCX: centerCX + boundsRadius,
        maxCZ: centerCZ + boundsRadius,
      },
      biome,
      dangerLevel: Math.floor(1 + Math.random() * 8),
      encounterRate: Math.round((0.6 + Math.random() * 1.2) * 10) / 10,
      description: `Historical Arthurian territory of ${name}.`,
    };
  }

  // ── Region Management ─────────────────────────────────────────────────────

  public get regions(): WorldRegion[] {
    return Array.from(this._regions.values());
  }

  public getRegion(id: string): WorldRegion | undefined {
    return this._regions.get(id);
  }

  public getRegionAt(cx: number, cz: number): WorldRegion | undefined {
    for (const reg of this._regions.values()) {
      if (
        cx >= reg.bounds.minCX &&
        cx <= reg.bounds.maxCX &&
        cz >= reg.bounds.minCZ &&
        cz <= reg.bounds.maxCZ
      ) {
        return reg;
      }
    }
    return undefined;
  }

  public addRegion(region: WorldRegion): boolean {
    if (!region.id || this._regions.has(region.id)) return false;
    this._regions.set(region.id, {
      ...region,
      dangerLevel: Math.min(10, Math.max(1, Math.round(region.dangerLevel))),
      encounterRate: Math.min(3.0, Math.max(0.0, region.encounterRate)),
      bounds: {
        minCX: Math.min(region.bounds.minCX, region.bounds.maxCX),
        minCZ: Math.min(region.bounds.minCZ, region.bounds.maxCZ),
        maxCX: Math.max(region.bounds.minCX, region.bounds.maxCX),
        maxCZ: Math.max(region.bounds.minCZ, region.bounds.maxCZ),
      },
    });
    return true;
  }

  public updateRegion(id: string, update: Partial<Omit<WorldRegion, "id">>): boolean {
    const existing = this._regions.get(id);
    if (!existing) return false;

    const merged = { ...existing, ...update };
    if (update.dangerLevel !== undefined) {
      merged.dangerLevel = Math.min(10, Math.max(1, Math.round(update.dangerLevel)));
    }
    if (update.encounterRate !== undefined) {
      merged.encounterRate = Math.min(3.0, Math.max(0.0, update.encounterRate));
    }
    if (update.bounds) {
      merged.bounds = {
        minCX: Math.min(update.bounds.minCX, update.bounds.maxCX),
        minCZ: Math.min(update.bounds.minCZ, update.bounds.maxCZ),
        maxCX: Math.max(update.bounds.minCX, update.bounds.maxCX),
        maxCZ: Math.max(update.bounds.minCZ, update.bounds.maxCZ),
      };
    }

    this._regions.set(id, merged);
    return true;
  }

  public removeRegion(id: string): boolean {
    return this._regions.delete(id);
  }

  public clearRegions(): void {
    this._regions.clear();
  }

  // ── Preset Library ────────────────────────────────────────────────────────

  public getAllPresets(): WorldPreset[] {
    return [...BUILTIN_WORLD_PRESETS, ...Array.from(this._customPresets.values())];
  }

  public getPreset(id: string): WorldPreset | undefined {
    const builtin = BUILTIN_WORLD_PRESETS.find((p) => p.id === id);
    if (builtin) return builtin;
    return this._customPresets.get(id);
  }

  public applyPreset(id: string): boolean {
    const preset = this.getPreset(id);
    if (!preset) return false;

    this.setConfig(preset.config);
    this.clearRegions();
    if (preset.regions) {
      for (const reg of preset.regions) {
        this.addRegion(reg);
      }
    }
    return true;
  }

  public saveCustomPreset(preset: WorldPreset): boolean {
    if (!preset.id) return false;
    this._customPresets.set(preset.id, { ...preset });
    return true;
  }

  public deleteCustomPreset(id: string): boolean {
    return this._customPresets.delete(id);
  }

  // ── Validation ────────────────────────────────────────────────────────────

  public validate(): WorldBuilderValidationReport {
    const issues: WorldBuilderValidationIssue[] = [];

    if (!this._config.seed || this._config.seed.trim().length === 0) {
      issues.push({
        field: "seed",
        message: "Seed cannot be empty.",
        severity: "error",
      });
    }

    if (this._config.elevationScale < 0.5 || this._config.elevationScale > 3.0) {
      issues.push({
        field: "elevationScale",
        message: "Elevation scale must be between 0.5 and 3.0.",
        severity: "warning",
      });
    }

    if (this._config.vegetationDensity < 0.0 || this._config.vegetationDensity > 2.5) {
      issues.push({
        field: "vegetationDensity",
        message: "Vegetation density must be between 0.0 and 2.5.",
        severity: "warning",
      });
    }

    for (const reg of this._regions.values()) {
      if (reg.dangerLevel < 1 || reg.dangerLevel > 10) {
        issues.push({
          field: `region_${reg.id}`,
          message: `Region '${reg.name}' danger level must be between 1 and 10.`,
          severity: "error",
        });
      }
      if (reg.encounterRate < 0.0 || reg.encounterRate > 3.0) {
        issues.push({
          field: `region_${reg.id}`,
          message: `Region '${reg.name}' encounter rate must be between 0.0 and 3.0.`,
          severity: "warning",
        });
      }
    }

    return {
      isValid: issues.filter((i) => i.severity === "error").length === 0,
      issues,
    };
  }

  // ── Serialization & Export / Import ───────────────────────────────────────

  public exportToJson(): string {
    const payload: WorldBuilderExportData = {
      version: 1,
      name: `Camelot_World_${this._config.seed}`,
      exportedAt: new Date().toISOString(),
      config: { ...this._config },
      regions: this.regions,
      settlements: this.settlements,
      rivers: this.rivers,
      lakes: this.lakes,
    };
    return JSON.stringify(payload, null, 2);
  }

  public exportToFile(filename?: string): void {
    const json = this.exportToJson();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename ?? `camelot-world-${this._config.seed.toLowerCase().replace(/\s+/g, "_")}.world.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  public importFromJson(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString);
      if (!data || typeof data !== "object") return false;
      if (data.version !== 1 || !data.config) return false;

      this.setConfig(data.config);
      this.clearRegions();
      if (Array.isArray(data.regions)) {
        for (const reg of data.regions) {
          this.addRegion(reg);
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  public async importFromFile(file: File): Promise<boolean> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const ok = this.importFromJson(reader.result as string);
        resolve(ok);
      };
      reader.onerror = () => resolve(false);
      reader.readAsText(file);
    });
  }
}
