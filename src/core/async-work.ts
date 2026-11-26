/**
 * Asynchronous work whose result changes the game (a navmesh from the
 * worker, a model that finished loading).
 *
 * Normally `ordered(p)` is just `p`.  In deterministic mode (replays) the
 * result is held back until the frame driver settles: once nothing is in
 * flight, results are released one at a time in the order the work began,
 * each continuation running before the next is released.  So the game sees
 * them at the same frame and in the same order on every run, whatever
 * order the network or the worker finished in.
 */

interface Held { resolve: () => void }

class AsyncWork {
  public deterministic = false;
  private _seq = 0;
  private readonly _inFlight = new Set<number>();
  private readonly _ready = new Map<number, Held>();
  private _wake: (() => void) | null = null;

  /** `p`, released in order in deterministic mode. */
  public ordered<T>(p: Promise<T>): Promise<T> {
    if (!this.deterministic) return p;
    const seq = this._seq++;
    this._inFlight.add(seq);
    return new Promise<T>((resolve, reject) => {
      const hold = (release: () => void) => {
        this._inFlight.delete(seq);
        this._ready.set(seq, { resolve: release });
        this._wake?.();
      };
      p.then((v) => hold(() => resolve(v)), (e: unknown) => hold(() => reject(e)));
    });
  }

  /** Work started and not finished yet. */
  public get pending(): number {
    return this._inFlight.size + this._ready.size;
  }

  /** Deterministic mode: wait for all work, releasing results in order (and any work they start). */
  public async settle(): Promise<void> {
    for (;;) {
      await macrotask();
      if (this._inFlight.size > 0) {
        await new Promise<void>((r) => { this._wake = r; });
        this._wake = null;
        continue;
      }
      if (this._ready.size === 0) return;
      const first = Math.min(...this._ready.keys());
      const held = this._ready.get(first)!;
      this._ready.delete(first);
      held.resolve();
    }
  }
}

function macrotask(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

export const asyncWork = new AsyncWork();
