// ── ObjectPool ───────────────────────────────────────────────────────────────

/**
 * Generic reusable object pool for engine performance.
 *
 * Frequent allocation and garbage collection of short-lived game objects (loot
 * meshes, projectiles, hit particles, decals, etc.) creates GC pressure that
 * causes frame-time spikes.  An ObjectPool keeps a set of pre-built objects
 * ready for immediate reuse, eliminating allocation cost at runtime.
 *
 * Usage:
 * ```ts
 * const pool = new ObjectPool<Projectile>(
 *   () => new Projectile(scene),        // factory
 *   (p) => { p.reset(); p.hide(); },    // reset function (called on release)
 *   10,                                 // pre-warm with 10 objects
 *   50,                                 // never hold more than 50 idle
 * );
 *
 * // Acquire an instance (from pool or newly created)
 * const proj = pool.acquire();
 * // ... configure and use proj ...
 *
 * // Return to pool when done (does NOT dispose the object)
 * pool.release(proj);
 * ```
 *
 * Memory contract:
 *   - `acquire()` never returns an item that is still held by another caller.
 *   - `release()` calls the reset function then enqueues the item.
 *   - If the pool is at `maxSize` when `release()` is called, the overflow
 *     item is discarded via `dispose()` (if the function was supplied).
 *   - Calling `clear()` disposes ALL idle items and empties the pool.
 *
 * Thread safety:
 *   JavaScript is single-threaded, so no locking is needed.
 */
export class ObjectPool<T> {
  private readonly _factory:  () => T;
  private readonly _reset:    (item: T) => void;
  private readonly _dispose?: (item: T) => void;
  private readonly _maxSize:  number;

  private _available: T[] = [];
  private _totalAllocated: number = 0;

  /**
   * @param factory  Called to create a new instance when the pool is empty.
   * @param reset    Called on every `release()` to return the item to a clean
   *   state before it goes back into the pool.
   * @param initialSize  Number of objects to create immediately via `prewarm()`.
   *   Defaults to 0.
   * @param maxSize  Maximum number of idle objects the pool will hold.  When
   *   the pool is full, released objects are disposed instead of enqueued.
   *   Defaults to 100.
   * @param dispose  Optional tear-down function called when an overflow item is
   *   discarded or when `clear()` is called.
   */
  constructor(
    factory:     () => T,
    reset:       (item: T) => void,
    initialSize: number  = 0,
    maxSize:     number  = 100,
    dispose?:    (item: T) => void,
  ) {
    this._factory  = factory;
    this._reset    = reset;
    this._dispose  = dispose;
    this._maxSize  = Math.max(1, maxSize);

    if (initialSize > 0) this.prewarm(initialSize);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Acquire an item from the pool.  If the pool is empty a new instance is
   * created via the factory function.
   *
   * The returned object has already been through `reset()` (either during
   * a previous `release()` call, or it is freshly constructed).
   */
  public acquire(): T {
    if (this._available.length > 0) {
      return this._available.pop()!;
    }
    this._totalAllocated++;
    return this._factory();
  }

  /**
   * Return an item to the pool.  The item's `reset` function is called first.
   *
   * If the pool already holds `maxSize` idle items, the item is discarded
   * (via `dispose()` if supplied) to prevent unbounded memory growth.
   */
  public release(item: T): void {
    this._reset(item);
    if (this._available.length >= this._maxSize) {
      this._dispose?.(item);
      return;
    }
    this._available.push(item);
  }

  /**
   * Pre-populate the pool with `count` freshly-constructed items.
   * Useful for eliminating first-frame allocation spikes.
   *
   * Items are created, reset, then stored.  If `count` would exceed `maxSize`,
   * only enough items to fill the pool are created.
   */
  public prewarm(count: number): void {
    const toCreate = Math.min(count, this._maxSize - this._available.length);
    for (let i = 0; i < toCreate; i++) {
      const item = this._factory();
      this._totalAllocated++;
      this._reset(item);
      this._available.push(item);
    }
  }

  /**
   * Dispose all currently idle items and empty the pool.
   * Does NOT affect items that are currently acquired (in use).
   * After `clear()` the pool is fully functional — new `acquire()` calls will
   * create fresh objects via the factory.
   */
  public clear(): void {
    if (this._dispose) {
      for (const item of this._available) {
        this._dispose(item);
      }
    }
    this._available = [];
  }

  // ── Accessors (profiling / debug) ──────────────────────────────────────────

  /**
   * Number of items currently sitting idle in the pool and immediately
   * available for `acquire()` without allocation.
   */
  public get size(): number {
    return this._available.length;
  }

  /**
   * Total number of objects ever created by this pool (factory calls).
   * Does not decrease when items are discarded or disposed.
   * Useful for spotting allocation growth in long sessions.
   */
  public get totalAllocated(): number {
    return this._totalAllocated;
  }
}
