/**
 * Seeded random number streams.
 *
 * Every random decision in the game should come from a named stream derived
 * from the world seed — `rng.stream("loot")`, `rng.stream("chunk", cx, cz)` —
 * instead of `Math.random()`, so a seed (plus inputs) replays a session.
 * The guardrails ratchet counts the remaining `Math.random()` calls
 * (tools/check-guardrails.mjs); this folder is the only place allowed to use
 * it.
 *
 * Engine overhaul, Phase 1 (docs/engine-overhaul-plan.md → Kernel).
 */

/** FNV-1a 32-bit hash of a string. */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** A small, fast, seedable generator (Mulberry32) with savable state. */
export class Rng {
  private _state: number;

  constructor(seed: number | string) {
    this._state = (typeof seed === "string" ? hashString(seed) : seed) >>> 0;
  }

  /** Uniform in [0, 1). */
  public next(): number {
    this._state = (this._state + 0x6d2b79f5) >>> 0;
    let t = this._state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform in [min, max). */
  public range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Integer in [min, max] (inclusive). */
  public int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** True with probability `p`. */
  public chance(p: number): boolean {
    return this.next() < p;
  }

  public pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error("Rng.pick on an empty list");
    return items[Math.floor(this.next() * items.length)];
  }

  /** State for saving; `setState` restores the exact sequence. */
  public getState(): number {
    return this._state;
  }

  public setState(state: number): void {
    this._state = state >>> 0;
  }
}

/**
 * Named streams derived from one root seed.  The same name and keys always
 * give the same stream (and the same object while it lives), independent of
 * how many other streams exist or the order they were created in.
 */
export class RngStreams {
  private readonly _streams = new Map<string, Rng>();

  constructor(private _seed: string) {}

  public get seed(): string {
    return this._seed;
  }

  /**
   * Reseed (e.g. a new game).  Streams already handed out restart from the
   * new seed in place, so a feature that kept one keeps a live stream.
   */
  public reseed(seed: string): void {
    this._seed = seed;
    for (const [id, r] of this._streams) r.setState(hashString(`${seed}|${id}`));
  }

  public stream(name: string, ...keys: Array<string | number>): Rng {
    const id = keys.length ? `${name}:${keys.join(",")}` : name;
    let r = this._streams.get(id);
    if (!r) {
      r = new Rng(hashString(`${this._seed}|${id}`));
      this._streams.set(id, r);
    }
    return r;
  }

  /** Saved state of the long-lived streams (chunk streams are re-derived). */
  public getSaveState(): { seed: string; streams: Record<string, number> } {
    const streams: Record<string, number> = {};
    for (const [id, r] of this._streams) streams[id] = r.getState();
    return { seed: this._seed, streams };
  }

  public restoreFromSave(state: { seed: string; streams: Record<string, number> } | undefined): void {
    if (!state) return;
    this.reseed(state.seed);
    for (const [id, s] of Object.entries(state.streams ?? {})) {
      let r = this._streams.get(id);
      if (!r) {
        r = new Rng(0);
        this._streams.set(id, r);
      }
      r.setState(s);
    }
  }
}

/**
 * Unseeded fallback for code that hasn't been given a stream yet.  Prefer a
 * named stream; this exists so migrated code can drop `Math.random()` now
 * and take a stream later.
 */
export function unseededRandom(): number {
  return Math.random();
}
