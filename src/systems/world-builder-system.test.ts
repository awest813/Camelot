import { describe, it, expect, beforeEach } from "vitest";
import {
  WorldBuilderSystem,
  DEFAULT_WORLD_CONFIG,
  BUILTIN_WORLD_PRESETS,
  type WorldRegion,
} from "./world-builder-system";

describe("WorldBuilderSystem — Constructor & Defaults", () => {
  it("initializes with DEFAULT_WORLD_CONFIG", () => {
    const sys = new WorldBuilderSystem();
    expect(sys.config.seed).toBe(DEFAULT_WORLD_CONFIG.seed);
    expect(sys.config.worldType).toBe(DEFAULT_WORLD_CONFIG.worldType);
    expect(sys.config.biomeScale).toBe(DEFAULT_WORLD_CONFIG.biomeScale);
    expect(sys.config.structureDensity).toBe(DEFAULT_WORLD_CONFIG.structureDensity);
    expect(sys.config.startingBiome).toBe(DEFAULT_WORLD_CONFIG.startingBiome);
    expect(sys.config.elevationScale).toBe(1.0);
    expect(sys.config.vegetationDensity).toBe(1.0);
    expect(sys.config.temperatureShift).toBe(0.0);
    expect(sys.regions).toHaveLength(0);
  });

  it("merges partial initial config", () => {
    const sys = new WorldBuilderSystem({
      seed: "Excalibur",
      worldType: "amplified",
      elevationScale: 2.2,
    });
    expect(sys.config.seed).toBe("Excalibur");
    expect(sys.config.worldType).toBe("amplified");
    expect(sys.config.elevationScale).toBe(2.2);
    expect(sys.config.biomeScale).toBe(DEFAULT_WORLD_CONFIG.biomeScale);
  });
});

describe("WorldBuilderSystem — Setters & Clamping", () => {
  let sys: WorldBuilderSystem;

  beforeEach(() => {
    sys = new WorldBuilderSystem();
  });

  it("updates individual config properties", () => {
    sys.setSeed("Tintagel");
    expect(sys.config.seed).toBe("Tintagel");

    sys.setWorldType("island");
    expect(sys.config.worldType).toBe("island");

    sys.setBiomeScale("large");
    expect(sys.config.biomeScale).toBe("large");

    sys.setStructureDensity("abundant");
    expect(sys.config.structureDensity).toBe("abundant");

    sys.setStartingBiome("tundra");
    expect(sys.config.startingBiome).toBe("tundra");
  });

  it("randomizes seed to a non-empty string", () => {
    const s1 = sys.randomizeSeed();
    expect(typeof s1).toBe("string");
    expect(s1.length).toBeGreaterThan(0);
    expect(sys.config.seed).toBe(s1);
  });

  it("clamps elevationScale to [0.5, 3.0]", () => {
    sys.setElevationScale(0.1);
    expect(sys.config.elevationScale).toBe(0.5);

    sys.setElevationScale(10.0);
    expect(sys.config.elevationScale).toBe(3.0);
  });

  it("clamps vegetationDensity to [0.0, 2.5]", () => {
    sys.setVegetationDensity(-1.0);
    expect(sys.config.vegetationDensity).toBe(0.0);

    sys.setVegetationDensity(5.0);
    expect(sys.config.vegetationDensity).toBe(2.5);
  });

  it("clamps temperatureShift to [-1.0, 1.0]", () => {
    sys.setTemperatureShift(-3.0);
    expect(sys.config.temperatureShift).toBe(-1.0);

    sys.setTemperatureShift(2.5);
    expect(sys.config.temperatureShift).toBe(1.0);
  });

  it("invokes onConfigChanged listener when configuration is modified", () => {
    let triggered = false;
    sys.onConfigChanged = (cfg) => {
      triggered = true;
      expect(cfg.seed).toBe("Morgana");
    };

    sys.setSeed("Morgana");
    expect(triggered).toBe(true);
  });
});

describe("WorldBuilderSystem — Runtime WorldSeed Bridge & 2D Grid Sampling", () => {
  it("produces a functioning WorldSeed instance matching configuration", () => {
    const sys = new WorldBuilderSystem({
      seed: "Camelot123",
      worldType: "island",
      biomeScale: "small",
    });
    const ws = sys.toWorldSeed();
    expect(ws).toBeDefined();
    expect(ws.seedString).toBe("Camelot123");
    expect(ws.options.worldType).toBe("island");
    expect(ws.options.biomeScale).toBe("small");
  });

  it("samples a 2D chunk grid of correct dimensions", () => {
    const sys = new WorldBuilderSystem();
    const radius = 5; // (2 * 5 + 1) = 11x11
    const grid = sys.sampleGrid(radius, 0, 0);

    expect(grid).toHaveLength(11);
    expect(grid[0]).toHaveLength(11);

    const centerCell = grid[5][5];
    expect(centerCell.cx).toBe(0);
    expect(centerCell.cz).toBe(0);
    expect(centerCell.isStartingChunk).toBe(true);
    expect(typeof centerCell.elevation).toBe("number");
    expect(["plains", "forest", "desert", "tundra"]).toContain(centerCell.biome);
  });

  it("applies region override in sampleGrid", () => {
    const sys = new WorldBuilderSystem();
    sys.addRegion({
      id: "frozen_wastes",
      name: "Frozen Wastes",
      bounds: { minCX: -2, minCZ: -2, maxCX: 2, maxCZ: 2 },
      biome: "tundra",
      dangerLevel: 5,
      encounterRate: 1.0,
    });

    const grid = sys.sampleGrid(3, 0, 0);
    // Center chunk (0, 0) should be inside frozen_wastes and therefore tundra
    const center = grid[3][3];
    expect(center.cx).toBe(0);
    expect(center.cz).toBe(0);
    expect(center.biome).toBe("tundra");
  });
});

describe("WorldBuilderSystem — Region Management", () => {
  let sys: WorldBuilderSystem;

  const testRegion: WorldRegion = {
    id: "gawain_reach",
    name: "Gawain's Reach",
    bounds: { minCX: 5, minCZ: 5, maxCX: 10, maxCZ: 10 },
    biome: "forest",
    dangerLevel: 4,
    encounterRate: 1.2,
    description: "Border highlands guarded by green knights.",
  };

  beforeEach(() => {
    sys = new WorldBuilderSystem();
  });

  it("adds and retrieves regions", () => {
    expect(sys.addRegion(testRegion)).toBe(true);
    expect(sys.regions).toHaveLength(1);
    expect(sys.getRegion("gawain_reach")?.name).toBe("Gawain's Reach");
  });

  it("rejects duplicate region IDs", () => {
    expect(sys.addRegion(testRegion)).toBe(true);
    expect(sys.addRegion(testRegion)).toBe(false);
    expect(sys.regions).toHaveLength(1);
  });

  it("normalizes inverted bounds", () => {
    sys.addRegion({
      id: "inverted",
      name: "Inverted",
      bounds: { minCX: 10, minCZ: 15, maxCX: 2, maxCZ: 4 },
      biome: "plains",
      dangerLevel: 2,
      encounterRate: 1.0,
    });

    const reg = sys.getRegion("inverted");
    expect(reg?.bounds.minCX).toBe(2);
    expect(reg?.bounds.maxCX).toBe(10);
    expect(reg?.bounds.minCZ).toBe(4);
    expect(reg?.bounds.maxCZ).toBe(15);
  });

  it("finds region by coordinates using getRegionAt", () => {
    sys.addRegion(testRegion);
    expect(sys.getRegionAt(7, 7)?.id).toBe("gawain_reach");
    expect(sys.getRegionAt(0, 0)).toBeUndefined();
    expect(sys.getRegionAt(12, 12)).toBeUndefined();
  });

  it("updates existing regions", () => {
    sys.addRegion(testRegion);
    const updated = sys.updateRegion("gawain_reach", {
      name: "Sir Gawain's Realm",
      dangerLevel: 6,
    });
    expect(updated).toBe(true);
    expect(sys.getRegion("gawain_reach")?.name).toBe("Sir Gawain's Realm");
    expect(sys.getRegion("gawain_reach")?.dangerLevel).toBe(6);
  });

  it("removes and clears regions", () => {
    sys.addRegion(testRegion);
    expect(sys.removeRegion("gawain_reach")).toBe(true);
    expect(sys.regions).toHaveLength(0);

    sys.addRegion(testRegion);
    sys.clearRegions();
    expect(sys.regions).toHaveLength(0);
  });
});

describe("WorldBuilderSystem — Presets", () => {
  let sys: WorldBuilderSystem;

  beforeEach(() => {
    sys = new WorldBuilderSystem();
  });

  it("provides built-in presets", () => {
    const presets = sys.getAllPresets();
    expect(presets.length).toBeGreaterThanOrEqual(5);
    expect(presets.some((p) => p.id === "classic_avalon")).toBe(true);
    expect(presets.some((p) => p.id === "frostpeak_reach")).toBe(true);
  });

  it("applies a built-in preset", () => {
    const ok = sys.applyPreset("frostpeak_reach");
    expect(ok).toBe(true);
    expect(sys.config.seed).toBe("Frostpeak");
    expect(sys.config.worldType).toBe("amplified");
    expect(sys.config.startingBiome).toBe("tundra");
    expect(sys.regions.length).toBeGreaterThan(0);
    expect(sys.regions[0].id).toBe("howling_pass");
  });

  it("saves and deletes custom presets", () => {
    const custom = {
      id: "my_custom_realm",
      name: "My Custom Realm",
      description: "Custom test realm",
      config: {
        ...DEFAULT_WORLD_CONFIG,
        seed: "Custom42",
      },
    };

    sys.saveCustomPreset(custom);
    expect(sys.getPreset("my_custom_realm")).toBeDefined();
    expect(sys.getAllPresets().some((p) => p.id === "my_custom_realm")).toBe(true);

    sys.deleteCustomPreset("my_custom_realm");
    expect(sys.getPreset("my_custom_realm")).toBeUndefined();
  });
});

describe("WorldBuilderSystem — Validation", () => {
  it("validates valid default configuration without errors", () => {
    const sys = new WorldBuilderSystem();
    const rep = sys.validate();
    expect(rep.isValid).toBe(true);
    expect(rep.issues.filter((i) => i.severity === "error")).toHaveLength(0);
  });

  it("reports error for empty seed", () => {
    const sys = new WorldBuilderSystem({ seed: "" });
    const rep = sys.validate();
    expect(rep.isValid).toBe(false);
    expect(rep.issues.some((i) => i.field === "seed" && i.severity === "error")).toBe(true);
  });

  it("reports warning for out-of-range elevation or vegetation", () => {
    const sys = new WorldBuilderSystem();
    // Bypass setter clamp to test validator logic directly
    (sys as any)._config.elevationScale = 0.2;
    const rep = sys.validate();
    expect(rep.issues.some((i) => i.field === "elevationScale" && i.severity === "warning")).toBe(true);
  });
});

describe("WorldBuilderSystem — JSON Export & Import", () => {
  it("exports and imports world configuration and regions losslessly", () => {
    const sys1 = new WorldBuilderSystem({
      seed: "RoundTable",
      worldType: "amplified",
      biomeScale: "large",
      elevationScale: 1.6,
    });
    sys1.addRegion({
      id: "reg1",
      name: "Knights Realm",
      bounds: { minCX: -5, minCZ: -5, maxCX: 5, maxCZ: 5 },
      biome: "plains",
      dangerLevel: 3,
      encounterRate: 1.1,
    });

    const json = sys1.exportToJson();
    expect(typeof json).toBe("string");

    const sys2 = new WorldBuilderSystem();
    const ok = sys2.importFromJson(json);
    expect(ok).toBe(true);
    expect(sys2.config.seed).toBe("RoundTable");
    expect(sys2.config.worldType).toBe("amplified");
    expect(sys2.config.elevationScale).toBe(1.6);
    expect(sys2.regions).toHaveLength(1);
    expect(sys2.regions[0].name).toBe("Knights Realm");
  });

  it("gracefully rejects invalid JSON strings", () => {
    const sys = new WorldBuilderSystem();
    expect(sys.importFromJson("not json")).toBe(false);
    expect(sys.importFromJson(JSON.stringify({ version: 2 }))).toBe(false);
  });
});

describe("WorldBuilderSystem — Simplex, Voronoi & Arthurian Procedural Extensions", () => {
  it("provides continuous climate and elevation sampling in sampleGrid", () => {
    const sys = new WorldBuilderSystem({ seed: "HighlandRealm" });
    const grid = sys.sampleGrid(3, 0, 0);

    for (const row of grid) {
      for (const cell of row) {
        expect(typeof cell.elevation).toBe("number");
        expect(cell.elevation).toBeGreaterThanOrEqual(0);
        expect(cell.elevation).toBeLessThanOrEqual(1.0);
        expect(typeof cell.temperature).toBe("number");
        expect(typeof cell.moisture).toBe("number");
      }
    }
  });

  it("builds settlements, provinces, and road networks via VoronoiWorldGraph", () => {
    const sys = new WorldBuilderSystem({ seed: "CamelotRealm" });
    expect(sys.settlements.length).toBeGreaterThanOrEqual(5);
    expect(sys.provinces.length).toBe(sys.settlements.length);
    expect(sys.roads.length).toBeGreaterThanOrEqual(5);
  });

  it("generates authentic Arthurian regions with valid geographic bounds", () => {
    const sys = new WorldBuilderSystem();
    const region = sys.generateArthurianRegion("forest");

    expect(region.id).toBeDefined();
    expect(region.name.length).toBeGreaterThan(0);
    expect(region.biome).toBe("forest");
    expect(region.dangerLevel).toBeGreaterThanOrEqual(1);
    expect(region.dangerLevel).toBeLessThanOrEqual(10);
    expect(region.bounds.minCX).toBeLessThanOrEqual(region.bounds.maxCX);
    expect(region.bounds.minCZ).toBeLessThanOrEqual(region.bounds.maxCZ);
  });

  it("includes settlements in export payload", () => {
    const sys = new WorldBuilderSystem({ seed: "ExportTest" });
    const json = sys.exportToJson();
    const parsed = JSON.parse(json);

    expect(parsed.settlements).toBeDefined();
    expect(Array.isArray(parsed.settlements)).toBe(true);
    expect(parsed.settlements.length).toBeGreaterThan(0);
  });

  it("integrates RiverNetworkGenerator and annotates water cells in sampleGrid", () => {
    const sys = new WorldBuilderSystem({ seed: "RiversOfAvalon" });
    expect(sys.riverGen).toBeDefined();

    const grid = sys.sampleGrid(5, 0, 0);
    expect(grid.length).toBe(11);

    // Verify cell water annotations
    let hasWaterCell = false;
    for (const row of grid) {
      for (const cell of row) {
        if (cell.isWaterBody || (cell.riverFlow ?? 0) > 0) {
          hasWaterCell = true;
          expect(typeof cell.riverFlow).toBe("number");
        }
      }
    }
    expect(hasWaterCell).toBe(true);
  });

  it("includes rivers and lakes in JSON export payload", () => {
    const sys = new WorldBuilderSystem({ seed: "WatershedExport" });
    sys.sampleGrid(5, 0, 0);
    const json = sys.exportToJson();
    const parsed = JSON.parse(json);

    expect(parsed.rivers).toBeDefined();
    expect(Array.isArray(parsed.rivers)).toBe(true);
    expect(parsed.lakes).toBeDefined();
    expect(Array.isArray(parsed.lakes)).toBe(true);
  });
});
