import { describe, it, expect, beforeEach } from "vitest";
import { FastTravelSystem } from "./fast-travel-system";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

// ── Minimal Player stub ───────────────────────────────────────────────────────

function makePlayer(pos = { x: 0, y: 1, z: 0 }) {
  return {
    camera: {
      position: { x: pos.x, y: pos.y, z: pos.z } as any,
    },
  } as any;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("FastTravelSystem", () => {
  let fts: FastTravelSystem;

  beforeEach(() => {
    fts = new FastTravelSystem();
  });

  // ── discoverLocation ──────────────────────────────────────────────────────

  it("returns true for a newly discovered location", () => {
    const isNew = fts.discoverLocation("town_a", "Town A", new Vector3(10, 2, 10));
    expect(isNew).toBe(true);
  });

  it("returns false when re-discovering an existing location", () => {
    fts.discoverLocation("town_a", "Town A", new Vector3(10, 2, 10));
    const isNew = fts.discoverLocation("town_a", "Town A", new Vector3(10, 2, 10));
    expect(isNew).toBe(false);
  });

  it("stores discovered locations in discoveredLocations list", () => {
    fts.discoverLocation("loc_01", "Fort Alpha", new Vector3(5, 0, 5));
    fts.discoverLocation("loc_02", "Ruins Beta", new Vector3(50, 0, 50));
    expect(fts.discoveredLocations).toHaveLength(2);
    expect(fts.discoveredLocations[0].name).toBe("Fort Alpha");
  });

  it("isDiscovered returns true for known locations", () => {
    fts.discoverLocation("cave_01", "Dark Cave", new Vector3(0, 0, 0));
    expect(fts.isDiscovered("cave_01")).toBe(true);
  });

  it("isDiscovered returns false for unknown locations", () => {
    expect(fts.isDiscovered("nowhere")).toBe(false);
  });

  it("accepts plain vector objects (not just Vector3 instances)", () => {
    fts.discoverLocation("plain_vec", "Plain", { x: 1, y: 2, z: 3 });
    expect(fts.isDiscovered("plain_vec")).toBe(true);
  });

  // ── fastTravelTo ──────────────────────────────────────────────────────────

  it("teleports player to discovered location", () => {
    fts.discoverLocation("town_b", "Town B", new Vector3(100, 2, 200));
    const player = makePlayer();
    const result = fts.fastTravelTo("town_b", player, false, false);
    expect(result.ok).toBe(true);
    expect(player.camera.position.x).toBe(100);
    expect(player.camera.position.z).toBe(200);
  });

  it("returns failure for undiscovered location", () => {
    const result = fts.fastTravelTo("hidden_city", makePlayer(), false, false);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/discovered/i);
  });

  it("blocks fast travel while in combat", () => {
    fts.discoverLocation("town_c", "Town C", new Vector3(0, 0, 0));
    const result = fts.fastTravelTo("town_c", makePlayer(), true, false);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/combat/i);
  });

  it("blocks fast travel while sneaking", () => {
    fts.discoverLocation("town_d", "Town D", new Vector3(0, 0, 0));
    const result = fts.fastTravelTo("town_d", makePlayer(), false, true);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/sneak/i);
  });

  it("combat check takes priority over sneak check", () => {
    fts.discoverLocation("loc", "Loc", new Vector3(0, 0, 0));
    const result = fts.fastTravelTo("loc", makePlayer(), true, true);
    expect(result.message).toMatch(/combat/i);
  });

  // ── Persistence ───────────────────────────────────────────────────────────

  it("getSaveState captures all discovered locations", () => {
    fts.discoverLocation("a", "A", new Vector3(1, 0, 1));
    fts.discoverLocation("b", "B", new Vector3(2, 0, 2));
    const state = fts.getSaveState();
    expect(state.discoveredIds).toContain("a");
    expect(state.locations).toHaveLength(2);
  });

  it("restoreFromSave re-populates discovered locations", () => {
    fts.discoverLocation("x", "X", new Vector3(5, 0, 5));
    const state = fts.getSaveState();
    const fts2  = new FastTravelSystem();
    fts2.restoreFromSave(state);
    expect(fts2.isDiscovered("x")).toBe(true);
    expect(fts2.discoveredLocations[0].name).toBe("X");
  });

  it("restoreFromSave handles null gracefully", () => {
    expect(() => fts.restoreFromSave(null as any)).not.toThrow();
    expect(fts.discoveredLocations).toHaveLength(0);
  });

  it("restoreFromSave skips malformed entries", () => {
    fts.restoreFromSave({
      discoveredIds: [],
      locations: [{ id: null, name: "bad", position: { x: 0, y: 0, z: 0 } } as any],
    });
    expect(fts.discoveredLocations).toHaveLength(0);
  });

  it("restoreFromSave skips entries with missing position y or z", () => {
    fts.restoreFromSave({
      discoveredIds: [],
      locations: [
        { id: "loc_no_y", name: "No Y", position: { x: 10, z: 5 } } as any,
        { id: "loc_no_z", name: "No Z", position: { x: 10, y: 3 } } as any,
        { id: "loc_ok",   name: "Good", position: { x: 10, y: 3, z: 5 } } as any,
      ],
    });
    expect(fts.discoveredLocations).toHaveLength(1);
    expect(fts.discoveredLocations[0].id).toBe("loc_ok");
  });

  it("full round-trip save/restore preserves position", () => {
    fts.discoverLocation("dungeon", "Dungeon", new Vector3(77, 3, 88));
    const state = fts.getSaveState();
    const fts2  = new FastTravelSystem();
    fts2.restoreFromSave(state);
    const player = makePlayer();
    fts2.fastTravelTo("dungeon", player, false, false);
    expect(player.camera.position.x).toBe(77);
    expect(player.camera.position.z).toBe(88);
  });
});
