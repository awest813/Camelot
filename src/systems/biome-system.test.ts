import { describe, it, expect, vi, beforeEach } from "vitest";
import { BiomeSystem } from "./biome-system";
import type { BiomeDefinition } from "./biome-system";

// ── Fixture helpers ───────────────────────────────────────────────────────────

const forestBiome: BiomeDefinition = {
  id: "forest",
  name: "Forest",
  description: "Dense woodland biome.",
  shape: {
    type: "rect",
    min: { x: 0, y: 0, z: 0 },
    max: { x: 100, y: 50, z: 100 },
  },
  encounterGroups: [
    { tableId: "forest_wolves", weight: 3 },
    { tableId: "forest_bandits", weight: 2 },
  ],
  encounterRate: 0.5,
  ambientId: "forest_ambient",
};

const desertBiome: BiomeDefinition = {
  id: "desert",
  name: "Desert",
  shape: {
    type: "sphere",
    center: { x: 300, y: 0, z: 300 },
    radius: 80,
  },
  encounterGroups: [
    { tableId: "desert_scorpions", weight: 4 },
    { tableId: "desert_bandits", weight: 1 },
  ],
  encounterRate: 0.3,
};

// ── Tests: CRUD ───────────────────────────────────────────────────────────────

describe("BiomeSystem — CRUD", () => {
  it("registers a biome and retrieves its definition", () => {
    const sys = new BiomeSystem();
    sys.addBiome(forestBiome);
    expect(sys.getBiome("forest")).toEqual(forestBiome);
  });

  it("replaces an existing biome with the same id", () => {
    const sys = new BiomeSystem();
    sys.addBiome(forestBiome);
    const updated: BiomeDefinition = { ...forestBiome, name: "Enchanted Forest" };
    sys.addBiome(updated);
    expect(sys.getBiome("forest")?.name).toBe("Enchanted Forest");
    expect(sys.biomes).toHaveLength(1);
  });

  it("removeBiome deletes a registered biome", () => {
    const sys = new BiomeSystem();
    sys.addBiome(forestBiome);
    sys.removeBiome("forest");
    expect(sys.getBiome("forest")).toBeUndefined();
    expect(sys.biomes).toHaveLength(0);
  });

  it("removeBiome on unknown id does not throw", () => {
    const sys = new BiomeSystem();
    expect(() => sys.removeBiome("ghost")).not.toThrow();
  });

  it("biomes getter returns all registered definitions", () => {
    const sys = new BiomeSystem();
    sys.addBiome(forestBiome);
    sys.addBiome(desertBiome);
    expect(sys.biomes).toHaveLength(2);
    expect(sys.biomes.map((b) => b.id)).toContain("forest");
    expect(sys.biomes.map((b) => b.id)).toContain("desert");
  });

  it("clear() removes all biomes", () => {
    const sys = new BiomeSystem();
    sys.addBiome(forestBiome);
    sys.addBiome(desertBiome);
    sys.clear();
    expect(sys.biomes).toHaveLength(0);
  });

  it("getBiome returns undefined for unknown id", () => {
    const sys = new BiomeSystem();
    expect(sys.getBiome("nowhere")).toBeUndefined();
  });
});

// ── Tests: Spatial queries (rect) ─────────────────────────────────────────────

describe("BiomeSystem — spatial queries (rect)", () => {
  let sys: BiomeSystem;

  beforeEach(() => {
    sys = new BiomeSystem();
    sys.addBiome(forestBiome); // [0,100]³ y-clamped [0,50]
  });

  it("point at origin is inside the rect biome", () => {
    expect(sys.getBiomesAtPoint(0, 0, 0)).toContain("forest");
  });

  it("point at max corner is inside (boundary inclusive)", () => {
    expect(sys.getBiomesAtPoint(100, 50, 100)).toContain("forest");
  });

  it("point at center is inside", () => {
    expect(sys.getBiomesAtPoint(50, 25, 50)).toContain("forest");
  });

  it("point outside on x-axis is not inside", () => {
    expect(sys.getBiomesAtPoint(101, 25, 50)).not.toContain("forest");
  });

  it("point outside on y-axis is not inside", () => {
    expect(sys.getBiomesAtPoint(50, 51, 50)).not.toContain("forest");
  });

  it("returns empty array when no biome contains the point", () => {
    expect(sys.getBiomesAtPoint(500, 500, 500)).toEqual([]);
  });
});

// ── Tests: Spatial queries (sphere) ───────────────────────────────────────────

describe("BiomeSystem — spatial queries (sphere)", () => {
  let sys: BiomeSystem;

  beforeEach(() => {
    sys = new BiomeSystem();
    sys.addBiome(desertBiome); // center (300, 0, 300) radius 80
  });

  it("point at center is inside", () => {
    expect(sys.getBiomesAtPoint(300, 0, 300)).toContain("desert");
  });

  it("point on surface is inside (boundary inclusive)", () => {
    expect(sys.getBiomesAtPoint(380, 0, 300)).toContain("desert");
  });

  it("point just outside radius is not inside", () => {
    expect(sys.getBiomesAtPoint(381, 0, 300)).not.toContain("desert");
  });

  it("diagonal point within radius is inside", () => {
    // distance: sqrt(40²+0²+40²) ≈ 56.6 < 80 — inside
    expect(sys.getBiomesAtPoint(340, 0, 340)).toContain("desert");
  });

  it("diagonal point outside radius is not inside", () => {
    // distance: sqrt(70²+0²+70²) ≈ 98.99 > 80 — outside
    expect(sys.getBiomesAtPoint(370, 0, 370)).not.toContain("desert");
  });
});

// ── Tests: Player position tracking ───────────────────────────────────────────

describe("BiomeSystem — player position tracking", () => {
  let sys: BiomeSystem;

  beforeEach(() => {
    sys = new BiomeSystem();
    sys.addBiome(forestBiome);
    sys.addBiome(desertBiome);
  });

  it("getCurrentBiomeIds is empty before any updatePlayerPosition", () => {
    expect(sys.getCurrentBiomeIds()).toHaveLength(0);
  });

  it("updatePlayerPosition sets current biome when inside", () => {
    sys.updatePlayerPosition(50, 25, 50);
    expect(sys.getCurrentBiomeIds()).toContain("forest");
  });

  it("updatePlayerPosition clears current biome when outside", () => {
    sys.updatePlayerPosition(50, 25, 50); // inside forest
    sys.updatePlayerPosition(500, 0, 500); // outside everything
    expect(sys.getCurrentBiomeIds()).toHaveLength(0);
  });

  it("fires onBiomeEntered when player enters a biome", () => {
    const cb = vi.fn();
    sys.onBiomeEntered = cb;
    sys.updatePlayerPosition(50, 25, 50);
    expect(cb).toHaveBeenCalledWith("forest");
  });

  it("fires onBiomeExited when player leaves a biome", () => {
    const exitCb = vi.fn();
    sys.onBiomeExited = exitCb;
    sys.updatePlayerPosition(50, 25, 50);
    sys.updatePlayerPosition(500, 0, 500);
    expect(exitCb).toHaveBeenCalledWith("forest");
  });

  it("does not fire onBiomeEntered when position stays in same biome", () => {
    const cb = vi.fn();
    sys.updatePlayerPosition(50, 25, 50); // first enter
    sys.onBiomeEntered = cb;
    sys.updatePlayerPosition(60, 25, 60); // still inside forest
    expect(cb).not.toHaveBeenCalled();
  });

  it("does not fire onBiomeExited when position stays in same biome", () => {
    sys.updatePlayerPosition(50, 25, 50);
    const exitCb = vi.fn();
    sys.onBiomeExited = exitCb;
    sys.updatePlayerPosition(70, 25, 70); // still inside forest
    expect(exitCb).not.toHaveBeenCalled();
  });

  it("tracks multiple biomes when point is in overlapping regions", () => {
    const overlap: BiomeDefinition = {
      id: "clearing",
      name: "Forest Clearing",
      shape: {
        type: "rect",
        min: { x: 40, y: 0, z: 40 },
        max: { x: 60, y: 50, z: 60 },
      },
      encounterGroups: [{ tableId: "clearing_deer", weight: 1 }],
    };
    sys.addBiome(overlap);
    sys.updatePlayerPosition(50, 25, 50); // inside both forest and clearing
    const ids = sys.getCurrentBiomeIds();
    expect(ids).toContain("forest");
    expect(ids).toContain("clearing");
  });

  it("removeBiome fires onBiomeExited if player was inside", () => {
    const exitCb = vi.fn();
    sys.onBiomeExited = exitCb;
    sys.updatePlayerPosition(50, 25, 50); // inside forest
    sys.removeBiome("forest");
    expect(exitCb).toHaveBeenCalledWith("forest");
    expect(sys.getCurrentBiomeIds()).not.toContain("forest");
  });
});

// ── Tests: Encounter table sampling ───────────────────────────────────────────

describe("BiomeSystem — encounter table sampling", () => {
  let sys: BiomeSystem;

  beforeEach(() => {
    sys = new BiomeSystem();
    sys.addBiome(forestBiome);
  });

  it("returns null for unknown biome", () => {
    expect(sys.sampleEncounterTable("ghost")).toBeNull();
  });

  it("returns null when biome has no encounter groups", () => {
    sys.addBiome({
      id: "empty",
      name: "Empty",
      shape: { type: "rect", min: { x: 0, y: 0, z: 0 }, max: { x: 10, y: 10, z: 10 } },
      encounterGroups: [],
    });
    expect(sys.sampleEncounterTable("empty")).toBeNull();
  });

  it("returns a valid table id for a biome with groups", () => {
    const result = sys.sampleEncounterTable("forest");
    expect(["forest_wolves", "forest_bandits"]).toContain(result);
  });

  it("uses the provided rng function", () => {
    // rng returning 0 should select the first entry (forest_wolves, weight 3)
    const result = sys.sampleEncounterTable("forest", () => 0);
    expect(result).toBe("forest_wolves");
  });

  it("rng near 1.0 selects last entry", () => {
    // total weight = 5; roll = 0.999 * 5 = 4.999 → first entry consumes 3 → 1.999 left → second entry
    const result = sys.sampleEncounterTable("forest", () => 0.999);
    expect(result).toBe("forest_bandits");
  });

  it("getEncounterGroups returns all groups for the biome", () => {
    const groups = sys.getEncounterGroups("forest");
    expect(groups).toHaveLength(2);
    expect(groups[0].tableId).toBe("forest_wolves");
  });

  it("getEncounterGroups returns empty array for unknown biome", () => {
    expect(sys.getEncounterGroups("ghost")).toEqual([]);
  });
});

// ── Tests: Snapshot / restore ─────────────────────────────────────────────────

describe("BiomeSystem — snapshot / restore", () => {
  it("getSnapshot captures playerInside flags", () => {
    const sys = new BiomeSystem();
    sys.addBiome(forestBiome);
    sys.addBiome(desertBiome);
    sys.updatePlayerPosition(50, 25, 50); // inside forest only

    const snap = sys.getSnapshot();
    const forestSnap = snap.find((s) => s.id === "forest")!;
    const desertSnap = snap.find((s) => s.id === "desert")!;

    expect(forestSnap.playerInside).toBe(true);
    expect(desertSnap.playerInside).toBe(false);
  });

  it("restoreSnapshot re-applies playerInside flags", () => {
    const sys = new BiomeSystem();
    sys.addBiome(forestBiome);
    sys.addBiome(desertBiome);

    sys.restoreSnapshot([
      { id: "forest", playerInside: true },
      { id: "desert", playerInside: false },
    ]);

    expect(sys.getCurrentBiomeIds()).toContain("forest");
    expect(sys.getCurrentBiomeIds()).not.toContain("desert");
  });

  it("restoreSnapshot fires onBiomeEntered for newly-inside biomes", () => {
    const sys = new BiomeSystem();
    sys.addBiome(forestBiome);
    const cb = vi.fn();
    sys.onBiomeEntered = cb;

    sys.restoreSnapshot([{ id: "forest", playerInside: true }]);
    expect(cb).toHaveBeenCalledWith("forest");
  });

  it("restoreSnapshot fires onBiomeExited for now-outside biomes", () => {
    const sys = new BiomeSystem();
    sys.addBiome(forestBiome);
    sys.updatePlayerPosition(50, 25, 50); // put player inside

    const exitCb = vi.fn();
    sys.onBiomeExited = exitCb;
    sys.restoreSnapshot([{ id: "forest", playerInside: false }]);
    expect(exitCb).toHaveBeenCalledWith("forest");
  });

  it("restoreSnapshot ignores unknown biome ids", () => {
    const sys = new BiomeSystem();
    sys.addBiome(forestBiome);
    expect(() =>
      sys.restoreSnapshot([{ id: "ghost_biome", playerInside: true }])
    ).not.toThrow();
  });

  it("round-trip: snapshot then restore preserves state", () => {
    const sys = new BiomeSystem();
    sys.addBiome(forestBiome);
    sys.addBiome(desertBiome);
    sys.updatePlayerPosition(50, 25, 50);

    const snap = sys.getSnapshot();

    // Reset position
    sys.updatePlayerPosition(500, 0, 500);
    expect(sys.getCurrentBiomeIds()).toHaveLength(0);

    sys.restoreSnapshot(snap);
    expect(sys.getCurrentBiomeIds()).toContain("forest");
    expect(sys.getCurrentBiomeIds()).not.toContain("desert");
  });

  it("restoreSnapshot does not fire callbacks when state is unchanged", () => {
    const sys = new BiomeSystem();
    sys.addBiome(forestBiome);
    // player already outside
    const enterCb = vi.fn();
    const exitCb = vi.fn();
    sys.onBiomeEntered = enterCb;
    sys.onBiomeExited = exitCb;

    sys.restoreSnapshot([{ id: "forest", playerInside: false }]);
    expect(enterCb).not.toHaveBeenCalled();
    expect(exitCb).not.toHaveBeenCalled();
  });
});
