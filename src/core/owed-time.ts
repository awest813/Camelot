/**
 * Time owed to systems that run on some steps only (every 2nd, 3rd, 6th):
 * each, when it runs, is given all the time since it last ran, not just the
 * step's (which ran it at a half, a third, a sixth of its pace).
 */
export class OwedTime {
  private readonly _owed = new Map<string, number>();

  /** A step passed: every system is owed `dt` more. */
  public pass(dt: number, ...ids: string[]): this {
    for (const id of ids) this._owed.set(id, (this._owed.get(id) ?? 0) + dt);
    return this;
  }

  /** What `id` is owed now (and it is paid). */
  public take(id: string): number {
    const t = this._owed.get(id) ?? 0;
    this._owed.set(id, 0);
    return t;
  }
}

/** One per game (keyed by it), for code with no object of its own to keep it on. */
const PER_OWNER = new WeakMap<object, OwedTime>();
export function owedTimeOf(owner: object): OwedTime {
  let o = PER_OWNER.get(owner);
  if (!o) PER_OWNER.set(owner, (o = new OwedTime()));
  return o;
}
