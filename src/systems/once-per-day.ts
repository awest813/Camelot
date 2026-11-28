/**
 * Something allowed once per key per game day (e.g. Speechcraft for talking
 * to someone: once a day each, not for every greeting).
 */
export class OncePerDay {
  private readonly _lastDay = new Map<string, number>();

  /** True the first time `key` asks on this game day (time in game minutes). */
  public take(key: string, nowMinutes: number): boolean {
    const day = Math.floor(nowMinutes / (24 * 60));
    if (this._lastDay.get(key) === day) return false;
    this._lastDay.set(key, day);
    return true;
  }
}
