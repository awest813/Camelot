import { describe, expect, it } from "vitest";
import { hoursSince, inHourRange, isNightHour } from "./game-hours";

describe("game hours", () => {
  it("night is 20:00 to 06:00", () => {
    expect([19.9, 20, 23, 0, 5.9, 6, 12].map(isNightHour)).toEqual([false, true, true, true, true, false, false]);
  });
  it("hoursSince goes forward past midnight", () => {
    expect(hoursSince(8, 11)).toBe(3);
    expect(hoursSince(22, 2)).toBe(4);
    expect(hoursSince(5, 5)).toBe(0);
  });
  it("inHourRange handles ranges that wrap midnight", () => {
    expect(inHourRange(9, 8, 17)).toBe(true);
    expect(inHourRange(17, 8, 17)).toBe(false);
    expect(inHourRange(23, 20, 4)).toBe(true);
    expect(inHourRange(3, 20, 4)).toBe(true);
    expect(inHourRange(12, 20, 4)).toBe(false);
  });
});
