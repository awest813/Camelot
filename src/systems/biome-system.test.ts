import { describe, it, expect, beforeEach } from "vitest";
import { BiomeSystem } from "./biome-system";
import type { BiomeDefinition } from "./biome-system";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const darkwood: BiomeDefinition = {
  id: "darkwood",
  name: "Darkwood Forest",
  description: "Dense woodland teeming with predators.",
  spawnTableIds: ["sg_wolves", "sg_bandits"],
  encounterWeightMultiplier: 1.4,
  encounterLevelMin: 3,
  encounterLevelMax: 12,
  ambientMoodId: "eerie",
};

const plains: BiomeDefinition = {
  id: "plains",
  name: "Sunlit Plains",
  spawnTableIds: ["sg_deer", "sg_goblins"],
  encounterWeightMultiplier: 0.8,
  encounterLevelMin: 1,
  encounterLevelMax: 6,
};

const dungeon: BiomeDefinition = {
  id: "dungeon",
  name: "Ancient Dungeon",
  spawnTableIds: ["sg_skeletons", "sg_draugr"],
  encounterWeightMultiplier: 2.0,
  encounterLevelMin: 5,
  encounterLevelMax: 0, // no upper bound
  ambientMoodId: "hostile",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("BiomeSystem — Biome CRUD", () => {
  let sys: BiomeSystem;
  beforeEach(() => { sys = new BiomeSystem(); });

  it("registers a biome and retrieves it", () => {
    sys.registerBiome(darkwood);
    expect(sys.getBiome("darkwood")).toEqual(darkwood);
  });

  it("returns undefined for unknown biome", () => {
    expect(sys.getBiome("nope")).toBeUndefined();
  });

  it("replaces an existing biome with the same id", () => {
    sys.registerBiome(darkwood);
    sys.registerBiome({ ...darkwood, name: "Murky Darkwood" });
    expect(sys.getBiome("darkwood")?.name).toBe("Murky Darkwood");
    expect(sys.biomes).toHaveLength(1);
  });

  it("stored definition is a copy (mutation-safe)", () => {
    const def = { ...darkwood };
    sys.registerBiome(def);
    def.name = "mutated";
    expect(sys.getBiome("darkwood")?.name).toBe("Darkwood Forest");
  });

  it("lists all registered biomes", () => {
    sys.registerBiome(darkwood);
    sys.registerBiome(plains);
    expect(sys.biomes).toHaveLength(2);
  });

  it("unregisters a biome", () => {
    sys.registerBiome(darkwood);
    sys.unregisterBiome("darkwood");
    expect(sys.getBiome("darkwood")).toBeUndefined();
  });

  it("safe to unregister an unknown biome", () => {
    expect(() => sys.unregisterBiome("nope")).not.toThrow();
  });

  it("unregistering a biome clears all region mappings for that biome", () => {
    sys.registerBiome(darkwood);
    sys.setRegionBiome("region_north", "darkwood");
    sys.setRegionBiome("region_east", "darkwood");
    sys.unregisterBiome("darkwood");
    expect(sys.getBiomeIdForRegion("region_north")).toBeUndefined();
    expect(sys.getBiomeIdForRegion("region_east")).toBeUndefined();
  });

  it("clear removes all biomes and mappings", () => {
    sys.registerBiome(darkwood);
    sys.registerBiome(plains);
    sys.setRegionBiome("region_north", "darkwood");
    sys.clear();
    expect(sys.biomes).toHaveLength(0);
    expect(sys.getBiomeIdForRegion("region_north")).toBeUndefined();
  });
});

describe("BiomeSystem — Region ↔ Biome association", () => {
  let sys: BiomeSystem;
  beforeEach(() => {
    sys = new BiomeSystem();
    sys.registerBiome(darkwood);
    sys.registerBiome(plains);
  });

  it("associates a region with a biome", () => {
    sys.setRegionBiome("r_north", "darkwood");
    expect(sys.getBiomeIdForRegion("r_north")).toBe("darkwood");
  });

  it("returns undefined biomeId for unmapped region", () => {
    expect(sys.getBiomeIdForRegion("r_unknown")).toBeUndefined();
  });

  it("returns biome definition for mapped region", () => {
    sys.setRegionBiome("r_north", "darkwood");
    expect(sys.getBiomeForRegion("r_north")).toEqual(darkwood);
  });

  it("returns undefined biome for unmapped region", () => {
    expect(sys.getBiomeForRegion("r_unknown")).toBeUndefined();
  });

  it("throws when mapping to an unknown biome", () => {
    expect(() => sys.setRegionBiome("r_north", "bogus")).toThrow(/unknown biome/);
  });

  it("overwrites an existing region mapping", () => {
    sys.setRegionBiome("r_north", "darkwood");
    sys.setRegionBiome("r_north", "plains");
    expect(sys.getBiomeIdForRegion("r_north")).toBe("plains");
  });

  it("clearRegionBiome removes the mapping", () => {
    sys.setRegionBiome("r_north", "darkwood");
    sys.clearRegionBiome("r_north");
    expect(sys.getBiomeIdForRegion("r_north")).toBeUndefined();
  });

  it("safe to clearRegionBiome for unmapped region", () => {
    expect(() => sys.clearRegionBiome("r_none")).not.toThrow();
  });

  it("getRegionsForBiome returns all regions mapped to that biome", () => {
    sys.setRegionBiome("r_north", "darkwood");
    sys.setRegionBiome("r_east",  "darkwood");
    sys.setRegionBiome("r_south", "plains");
    const regions = sys.getRegionsForBiome("darkwood");
    expect(regions).toHaveLength(2);
    expect(regions).toContain("r_north");
    expect(regions).toContain("r_east");
  });

  it("getRegionsForBiome returns empty array when no regions mapped", () => {
    expect(sys.getRegionsForBiome("darkwood")).toHaveLength(0);
  });
});

describe("BiomeSystem — Encounter helpers", () => {
  let sys: BiomeSystem;
  beforeEach(() => {
    sys = new BiomeSystem();
    sys.registerBiome(darkwood);
    sys.registerBiome(dungeon);
    sys.setRegionBiome("r_forest", "darkwood");
    sys.setRegionBiome("r_dungeon", "dungeon");
  });

  it("getSpawnTableIds returns biome spawn tables for mapped region", () => {
    expect(sys.getSpawnTableIds("r_forest")).toEqual(["sg_wolves", "sg_bandits"]);
  });

  it("getSpawnTableIds returns empty array for unmapped region", () => {
    expect(sys.getSpawnTableIds("r_unknown")).toEqual([]);
  });

  it("getEncounterWeightMultiplier returns biome weight for mapped region", () => {
    expect(sys.getEncounterWeightMultiplier("r_forest")).toBe(1.4);
  });

  it("getEncounterWeightMultiplier returns 1.0 for unmapped region", () => {
    expect(sys.getEncounterWeightMultiplier("r_unknown")).toBe(1.0);
  });

  it("getEncounterLevelRange returns biome range for mapped region", () => {
    expect(sys.getEncounterLevelRange("r_forest")).toEqual({ min: 3, max: 12 });
  });

  it("getEncounterLevelRange returns { min:0, max:0 } for unmapped region", () => {
    expect(sys.getEncounterLevelRange("r_unknown")).toEqual({ min: 0, max: 0 });
  });

  it("isLevelInRange returns true within range", () => {
    expect(sys.isLevelInRange("r_forest", 5)).toBe(true);
  });

  it("isLevelInRange returns false below min", () => {
    expect(sys.isLevelInRange("r_forest", 1)).toBe(false);
  });

  it("isLevelInRange returns false above max", () => {
    expect(sys.isLevelInRange("r_forest", 20)).toBe(false);
  });

  it("isLevelInRange respects max=0 (no upper bound)", () => {
    // dungeon: min=5, max=0 → no upper cap
    expect(sys.isLevelInRange("r_dungeon", 100)).toBe(true);
  });

  it("isLevelInRange returns true for unmapped region at any level", () => {
    expect(sys.isLevelInRange("r_unknown", 1)).toBe(true);
    expect(sys.isLevelInRange("r_unknown", 100)).toBe(true);
  });

  it("getAmbientMoodId returns mood for mapped region with mood", () => {
    expect(sys.getAmbientMoodId("r_forest")).toBe("eerie");
  });

  it("getAmbientMoodId returns undefined for biome with no mood", () => {
    sys.registerBiome(plains);
    sys.setRegionBiome("r_plains", "plains");
    expect(sys.getAmbientMoodId("r_plains")).toBeUndefined();
  });

  it("getAmbientMoodId returns undefined for unmapped region", () => {
    expect(sys.getAmbientMoodId("r_unknown")).toBeUndefined();
  });
});

describe("BiomeSystem — Save / restore", () => {
  let sys: BiomeSystem;
  beforeEach(() => {
    sys = new BiomeSystem();
    sys.registerBiome(darkwood);
    sys.registerBiome(plains);
  });

  it("getSaveState captures region biome mappings", () => {
    sys.setRegionBiome("r_north", "darkwood");
    sys.setRegionBiome("r_south", "plains");
    const state = sys.getSaveState();
    expect(state.regionBiomes).toEqual({ r_north: "darkwood", r_south: "plains" });
  });

  it("getSaveState returns empty object when no mappings", () => {
    expect(sys.getSaveState().regionBiomes).toEqual({});
  });

  it("restoreFromSave restores mappings", () => {
    sys.setRegionBiome("r_north", "darkwood");
    const state = sys.getSaveState();

    const fresh = new BiomeSystem();
    fresh.registerBiome(darkwood);
    fresh.registerBiome(plains);
    fresh.restoreFromSave(state);

    expect(fresh.getBiomeIdForRegion("r_north")).toBe("darkwood");
  });

  it("restoreFromSave silently drops stale biome ids", () => {
    const state = { regionBiomes: { r_north: "deleted_biome" } };
    expect(() => sys.restoreFromSave(state)).not.toThrow();
    expect(sys.getBiomeIdForRegion("r_north")).toBeUndefined();
  });

  it("restoreFromSave clears previous mappings before loading", () => {
    sys.setRegionBiome("r_south", "plains");
    sys.restoreFromSave({ regionBiomes: { r_north: "darkwood" } });
    expect(sys.getBiomeIdForRegion("r_south")).toBeUndefined();
    expect(sys.getBiomeIdForRegion("r_north")).toBe("darkwood");
  });

  it("round-trip getSaveState → restoreFromSave preserves all mappings", () => {
    sys.setRegionBiome("r1", "darkwood");
    sys.setRegionBiome("r2", "plains");
    sys.setRegionBiome("r3", "darkwood");
    const state = sys.getSaveState();

    const fresh = new BiomeSystem();
    fresh.registerBiome(darkwood);
    fresh.registerBiome(plains);
    fresh.restoreFromSave(state);

    expect(fresh.getBiomeIdForRegion("r1")).toBe("darkwood");
    expect(fresh.getBiomeIdForRegion("r2")).toBe("plains");
    expect(fresh.getBiomeIdForRegion("r3")).toBe("darkwood");
  });
});
