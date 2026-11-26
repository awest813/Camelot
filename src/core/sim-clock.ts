/**
 * Game-time for gameplay code that would otherwise read the wall clock or
 * set real-time timers (hit-stop, debounces, delayed clean-up).
 *
 * Normally it is the wall clock and `setTimeout`.  In deterministic mode
 * (replays, see replay/game-replay.ts) time is the frame count times the
 * fixed step, and timers fire on the frame that reaches them, so a session
 * plays back the same however fast the machine runs it.
 */

interface Timer { at: number; seq: number; fn: () => void }

class SimClock {
  private _frameTime: (() => number) | null = null;
  private _timers: Timer[] = [];
  private _seq = 0;

  /** Milliseconds: the wall clock, or frame time in deterministic mode. */
  public now(): number {
    return this._frameTime ? this._frameTime() : performance.now();
  }

  /** Run `fn` after `ms` of game time. */
  public after(ms: number, fn: () => void): void {
    if (!this._frameTime) { setTimeout(fn, ms); return; }
    this._timers.push({ at: this.now() + ms, seq: this._seq++, fn });
  }

  /** Switch to frame time (`frameTime` returns the current frame's ms). */
  public useFrameTime(frameTime: () => number): void {
    this._frameTime = frameTime;
  }

  public get deterministic(): boolean {
    return this._frameTime !== null;
  }

  /** Deterministic mode: run the timers that are due, in order. */
  public runDue(): void {
    const now = this.now();
    const due = this._timers.filter((t) => t.at <= now).sort((a, b) => a.at - b.at || a.seq - b.seq);
    if (due.length === 0) return;
    this._timers = this._timers.filter((t) => t.at > now);
    for (const t of due) t.fn();
  }
}

export const simClock = new SimClock();
