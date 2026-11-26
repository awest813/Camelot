/**
 * Hours of the game day, shared by every system that reasons about them
 * (the clock, raids, world events, encounters, followers, travel).  Hours
 * are 0–24, fractional allowed.
 */

/** Daylight is 06:00–20:00; the rest is night (the clock's own definition). */
export const DAY_START_HOUR = 6;
export const NIGHT_START_HOUR = 20;

export function isNightHour(hour: number): boolean {
  return hour >= NIGHT_START_HOUR || hour < DAY_START_HOUR;
}

/** Hours from `from` to `to` on the clock face, going forward past midnight. */
export function hoursSince(from: number, to: number): number {
  return to >= from ? to - from : 24 - from + to;
}

/** Whether `hour` is in [min, max), where a range like 20 → 4 wraps midnight. */
export function inHourRange(hour: number, min: number, max: number): boolean {
  return min <= max ? hour >= min && hour < max : hour >= min || hour < max;
}
