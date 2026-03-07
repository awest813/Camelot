import { describe, it, expect, vi, beforeEach } from "vitest";
import { TimeSystem } from "./time-system";

describe("TimeSystem", () => {
  let time: TimeSystem;

  beforeEach(() => {
    // 120-second real-time day, starting at 08:00
    time = new TimeSystem(120, 8);
  });

  it("initialises with the correct start hour", () => {
    expect(time.hour).toBe(8);
    expect(time.minute).toBe(0);
  });

  it("formats timeString as HH:MM", () => {
    expect(time.timeString).toBe("08:00");
  });

  it("advances game time on update", () => {
    // 120-second day → 12 in-game minutes per real second
    time.update(1);
    expect(time.gameTime).toBeCloseTo(8 * 60 + 12, 1);
  });

  it("wraps game time at 24 hours", () => {
    // Advance a full real-time day (120 seconds)
    time.update(120);
    expect(time.gameTime).toBeCloseTo(8 * 60, 1); // back to 08:00
  });

  it("isDaytime is true between 06:00 and 20:00", () => {
    expect(time.isDaytime).toBe(true); // 08:00

    const night = new TimeSystem(120, 22);
    expect(night.isDaytime).toBe(false);

    const dawn = new TimeSystem(120, 6);
    expect(dawn.isDaytime).toBe(true);

    const dusk = new TimeSystem(120, 20);
    expect(dusk.isDaytime).toBe(false);
  });

  it("isNight is the inverse of isDaytime", () => {
    expect(time.isNight).toBe(!time.isDaytime);
  });

  it("ambientIntensity is 1.0 at noon", () => {
    const noon = new TimeSystem(120, 12);
    // Noon is peak — no partial minutes
    expect(noon.ambientIntensity).toBe(1.0);
  });

  it("ambientIntensity is 0.08 at 03:00 (deep night)", () => {
    const night = new TimeSystem(120, 3);
    expect(night.ambientIntensity).toBe(0.08);
  });

  it("fires onHourChange callback on each new hour", () => {
    const spy = vi.fn();
    time.onHourChange = spy;

    // Advance enough to cross from hour 8 into 9
    // 12 in-game minutes per real second; need 5 real seconds to advance 60 in-game minutes
    time.update(5);
    expect(spy).toHaveBeenCalledWith(9);
  });

  it("onHourChange does not fire if hour hasn't changed", () => {
    const spy = vi.fn();
    time.onHourChange = spy;

    // Small advance (less than 5 min)
    time.update(0.1);
    expect(spy).not.toHaveBeenCalled();
  });

  it("isOpen returns true within merchant hours", () => {
    expect(time.isOpen(8, 20)).toBe(true);
    const night = new TimeSystem(120, 21);
    expect(night.isOpen(8, 20)).toBe(false);
  });

  it("normalizedTime is 0.5 at noon", () => {
    const noon = new TimeSystem(120, 12);
    expect(noon.normalizedTime).toBeCloseTo(0.5, 2);
  });

  it("saves and restores state", () => {
    time.update(3); // advance a bit
    const saved = time.getSaveState();

    const restored = new TimeSystem(120, 0);
    restored.restoreFromSave(saved);
    expect(restored.gameTime).toBeCloseTo(time.gameTime, 1);
    expect(restored.hour).toBe(time.hour);
  });
});
