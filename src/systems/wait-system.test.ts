import { describe, it, expect, beforeEach, vi } from "vitest";
import { WaitSystem, WAIT_MIN_HOURS, WAIT_MAX_HOURS } from "./wait-system";
import { TimeSystem } from "./time-system";

// ── Minimal Player stub ───────────────────────────────────────────────────────

function makePlayer(overrides: Partial<{
  health: number; maxHealth: number;
  magicka: number; maxMagicka: number;
  stamina: number; maxStamina: number;
}> = {}) {
  return {
    health:    overrides.health    ?? 50,
    maxHealth: overrides.maxHealth ?? 100,
    magicka:   overrides.magicka   ?? 40,
    maxMagicka: overrides.maxMagicka ?? 100,
    stamina:   overrides.stamina   ?? 30,
    maxStamina: overrides.maxStamina ?? 100,
  } as any;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("WaitSystem", () => {
  let ws: WaitSystem;
  let time: TimeSystem;

  beforeEach(() => {
    ws   = new WaitSystem();
    time = new TimeSystem(120, 8); // start at 08:00
  });

  // ── wait() validation ─────────────────────────────────────────────────────

  it("rejects 0 hours", () => {
    const result = ws.wait(0, time, makePlayer());
    expect(result.ok).toBe(false);
  });

  it("rejects negative hours", () => {
    const result = ws.wait(-3, time, makePlayer());
    expect(result.ok).toBe(false);
  });

  it("rejects more than WAIT_MAX_HOURS", () => {
    const result = ws.wait(WAIT_MAX_HOURS + 1, time, makePlayer());
    expect(result.ok).toBe(false);
  });

  it("accepts minimum valid hours", () => {
    const result = ws.wait(WAIT_MIN_HOURS, time, makePlayer());
    expect(result.ok).toBe(true);
  });

  it("accepts maximum valid hours", () => {
    const result = ws.wait(WAIT_MAX_HOURS, time, makePlayer());
    expect(result.ok).toBe(true);
  });

  // ── Time advancement ──────────────────────────────────────────────────────

  it("advances TimeSystem by the requested hours", () => {
    const initialHour = time.hour; // 8
    ws.wait(4, time, makePlayer());
    expect(time.hour).toBe(initialHour + 4);
  });

  it("wraps correctly past midnight", () => {
    // start at 22:00, wait 6 hours → 04:00
    const t = new TimeSystem(120, 22);
    ws.wait(6, t, makePlayer());
    expect(t.hour).toBe(4);
  });

  it("fires onHourChange when the hour changes", () => {
    const spy = vi.fn();
    time.onHourChange = spy;
    ws.wait(2, time, makePlayer());
    // Hour changes from 8 → 10; callback fires once with the final hour
    expect(spy).toHaveBeenCalledWith(10);
  });

  // ── Stat restoration ──────────────────────────────────────────────────────

  it("restores proportional health per hour (1/24 of max per hour)", () => {
    const player = makePlayer({ health: 0, maxHealth: 120 });
    ws.wait(12, time, player);
    // 12/24 = 50 % of 120 = 60
    expect(player.health).toBeCloseTo(60, 4);
  });

  it("restores proportional magicka per hour", () => {
    const player = makePlayer({ magicka: 0, maxMagicka: 100 });
    ws.wait(24, time, player);
    expect(player.magicka).toBeCloseTo(100, 4);
  });

  it("does not exceed max stats", () => {
    const player = makePlayer({ health: 95, maxHealth: 100 });
    ws.wait(24, time, player);
    expect(player.health).toBe(100);
  });

  it("accumulates totalHoursWaited across multiple calls", () => {
    ws.wait(3, time, makePlayer());
    ws.wait(5, time, makePlayer());
    expect(ws.totalHoursWaited).toBe(8);
  });

  // ── Return message ────────────────────────────────────────────────────────

  it("returns a message containing the waited hours and new time string", () => {
    const t = new TimeSystem(120, 8);
    const result = ws.wait(2, t, makePlayer());
    expect(result.ok).toBe(true);
    expect(result.message).toContain("2 hours");
    expect(result.message).toContain("10:00");
  });

  it("uses singular 'hour' for 1 hour", () => {
    const result = ws.wait(1, time, makePlayer());
    expect(result.message).toContain("1 hour");
    expect(result.message).not.toContain("1 hours");
  });

  // ── Save / restore ────────────────────────────────────────────────────────

  it("saves and restores totalHoursWaited", () => {
    ws.wait(7, time, makePlayer());
    const state = ws.getSaveState();
    const ws2   = new WaitSystem();
    ws2.restoreFromSave(state);
    expect(ws2.totalHoursWaited).toBe(7);
  });

  it("ignores corrupt save data gracefully", () => {
    ws.restoreFromSave(null as any);
    expect(ws.totalHoursWaited).toBe(0);
  });
});
