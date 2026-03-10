import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  RespawnSystem,
  DEFAULT_RESPAWN_HOURS,
  MIN_RESPAWN_HOURS,
  MAX_RESPAWN_HOURS,
} from "./respawn-system";

describe("RespawnSystem", () => {
  let rs: RespawnSystem;

  beforeEach(() => {
    rs = new RespawnSystem();
  });

  // ── registerZone ──────────────────────────────────────────────────────────

  it("registers a zone with the default respawn window", () => {
    rs.registerZone("zone_a");
    const zone = rs.getZone("zone_a")!;
    expect(zone.zoneId).toBe("zone_a");
    expect(zone.respawnAfterHours).toBe(DEFAULT_RESPAWN_HOURS);
    expect(zone.pendingRespawn).toBe(false);
    expect(zone.lastClearedAt).toBeNull();
  });

  it("registers a zone with a custom respawn window", () => {
    rs.registerZone("zone_b", 24);
    expect(rs.getZone("zone_b")!.respawnAfterHours).toBe(24);
  });

  it("clamps respawn window to [MIN, MAX]", () => {
    rs.registerZone("too_short", 0);
    rs.registerZone("too_long", MAX_RESPAWN_HOURS + 1000);
    expect(rs.getZone("too_short")!.respawnAfterHours).toBe(MIN_RESPAWN_HOURS);
    expect(rs.getZone("too_long")!.respawnAfterHours).toBe(MAX_RESPAWN_HOURS);
  });

  it("ignores duplicate registration (preserves existing state)", () => {
    rs.registerZone("zone_c", 72);
    rs.markCleared("zone_c", 1000);
    rs.registerZone("zone_c", 24); // should be a no-op
    expect(rs.getZone("zone_c")!.lastClearedAt).toBe(1000);
    expect(rs.getZone("zone_c")!.respawnAfterHours).toBe(72);
  });

  // ── markCleared ───────────────────────────────────────────────────────────

  it("markCleared sets pendingRespawn to true", () => {
    rs.registerZone("zone_a");
    rs.markCleared("zone_a", 5000);
    expect(rs.getZone("zone_a")!.pendingRespawn).toBe(true);
    expect(rs.getZone("zone_a")!.lastClearedAt).toBe(5000);
  });

  it("markCleared on unknown zone is a no-op", () => {
    expect(() => rs.markCleared("unknown", 0)).not.toThrow();
  });

  // ── isDue ──────────────────────────────────────────────────────────────────

  it("isDue returns false for never-cleared zone", () => {
    rs.registerZone("zone_a");
    expect(rs.isDue("zone_a", 999999)).toBe(false);
  });

  it("isDue returns false before the window elapses", () => {
    rs.registerZone("zone_a", 72);
    rs.markCleared("zone_a", 0); // cleared at minute 0
    const oneHourLater = 59; // < 72*60
    expect(rs.isDue("zone_a", oneHourLater)).toBe(false);
  });

  it("isDue returns true exactly at the window boundary", () => {
    rs.registerZone("zone_a", 72);
    rs.markCleared("zone_a", 0);
    const exactBoundary = 72 * 60;
    expect(rs.isDue("zone_a", exactBoundary)).toBe(true);
  });

  it("isDue returns true well past the window", () => {
    rs.registerZone("zone_a", 72);
    rs.markCleared("zone_a", 0);
    expect(rs.isDue("zone_a", 999999)).toBe(true);
  });

  it("isDue returns false for unknown zone", () => {
    expect(rs.isDue("no_such_zone", 9999)).toBe(false);
  });

  // ── update ────────────────────────────────────────────────────────────────

  it("update does not fire callback before window elapses", () => {
    const cb = vi.fn();
    rs.onZoneRespawn = cb;
    rs.registerZone("zone_a", 72);
    rs.markCleared("zone_a", 0);
    rs.update(60 * 71); // 71 hours < 72 hours
    expect(cb).not.toHaveBeenCalled();
  });

  it("update fires onZoneRespawn when window elapses", () => {
    const cb = vi.fn();
    rs.onZoneRespawn = cb;
    rs.registerZone("zone_a", 72);
    rs.markCleared("zone_a", 0);
    rs.update(72 * 60 + 1);
    expect(cb).toHaveBeenCalledWith("zone_a");
  });

  it("update clears pendingRespawn after firing", () => {
    rs.registerZone("zone_a", 72);
    rs.markCleared("zone_a", 0);
    rs.update(72 * 60 + 1);
    expect(rs.getZone("zone_a")!.pendingRespawn).toBe(false);
  });

  it("update fires callback for multiple zones in the same tick", () => {
    const cb = vi.fn();
    rs.onZoneRespawn = cb;
    rs.registerZone("zone_a", 24);
    rs.registerZone("zone_b", 48);
    rs.markCleared("zone_a", 0);
    rs.markCleared("zone_b", 0);
    rs.update(48 * 60 + 1);
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it("update does not fire again after respawn (no double-fire)", () => {
    const cb = vi.fn();
    rs.onZoneRespawn = cb;
    rs.registerZone("zone_a", 24);
    rs.markCleared("zone_a", 0);
    rs.update(24 * 60 + 1);
    rs.update(48 * 60 + 1); // second call — zone is no longer pending
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("update ignores zones that have never been cleared", () => {
    const cb = vi.fn();
    rs.onZoneRespawn = cb;
    rs.registerZone("zone_a", 1);
    rs.update(999999);
    expect(cb).not.toHaveBeenCalled();
  });

  // ── zones accessor ────────────────────────────────────────────────────────

  it("zones returns all registered zones", () => {
    rs.registerZone("a");
    rs.registerZone("b");
    rs.registerZone("c");
    expect(rs.zones.length).toBe(3);
  });

  // ── Persistence ───────────────────────────────────────────────────────────

  it("getSaveState captures cleared/pending state", () => {
    rs.registerZone("zone_a", 72);
    rs.markCleared("zone_a", 5000);
    const state = rs.getSaveState();
    expect(state.zones[0].lastClearedAt).toBe(5000);
    expect(state.zones[0].pendingRespawn).toBe(true);
  });

  it("restoreFromSave restores lastClearedAt and pendingRespawn", () => {
    rs.registerZone("zone_a", 72);
    rs.restoreFromSave({
      zones: [{ zoneId: "zone_a", respawnAfterHours: 72, lastClearedAt: 5000, pendingRespawn: true }],
    });
    const zone = rs.getZone("zone_a")!;
    expect(zone.lastClearedAt).toBe(5000);
    expect(zone.pendingRespawn).toBe(true);
  });

  it("restoreFromSave ignores unknown zones", () => {
    rs.registerZone("zone_a", 72);
    expect(() =>
      rs.restoreFromSave({
        zones: [{ zoneId: "zone_unknown", respawnAfterHours: 72, lastClearedAt: 0, pendingRespawn: true }],
      }),
    ).not.toThrow();
    expect(rs.zones.length).toBe(1);
  });

  it("restoreFromSave handles null gracefully", () => {
    expect(() => rs.restoreFromSave(null as any)).not.toThrow();
  });

  it("full round-trip save/restore preserves state", () => {
    rs.registerZone("zone_a", 48);
    rs.markCleared("zone_a", 1234);
    const state = rs.getSaveState();

    const rs2 = new RespawnSystem();
    rs2.registerZone("zone_a", 48);
    rs2.restoreFromSave(state);

    const zone = rs2.getZone("zone_a")!;
    expect(zone.lastClearedAt).toBe(1234);
    expect(zone.pendingRespawn).toBe(true);
  });
});
