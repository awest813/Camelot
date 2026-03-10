import { describe, it, expect, vi } from "vitest";
import { ObjectPool } from "./object-pool";

// ── Helpers ───────────────────────────────────────────────────────────────────

interface PoolItem {
  value: number;
  active: boolean;
}

function makeFactory() {
  let counter = 0;
  return () => ({ value: ++counter, active: false });
}

function makeReset() {
  return (item: PoolItem) => {
    item.active = false;
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ObjectPool", () => {

  // ── Construction ──────────────────────────────────────────────────────────

  it("starts with zero size and zero totalAllocated when no prewarm", () => {
    const pool = new ObjectPool(makeFactory(), makeReset());
    expect(pool.size).toBe(0);
    expect(pool.totalAllocated).toBe(0);
  });

  it("prewarms pool with initial items", () => {
    const pool = new ObjectPool(makeFactory(), makeReset(), 5);
    expect(pool.size).toBe(5);
    expect(pool.totalAllocated).toBe(5);
  });

  it("initialSize is capped at maxSize", () => {
    const pool = new ObjectPool(makeFactory(), makeReset(), 20, 10);
    expect(pool.size).toBe(10);
    expect(pool.totalAllocated).toBe(10);
  });

  // ── acquire ───────────────────────────────────────────────────────────────

  it("acquire() returns a prewarmed item from the pool", () => {
    const pool = new ObjectPool(makeFactory(), makeReset(), 3);
    const item = pool.acquire();
    expect(item).toBeDefined();
    expect(pool.size).toBe(2); // one taken out
    expect(pool.totalAllocated).toBe(3); // no new allocation
  });

  it("acquire() allocates a new item when pool is empty", () => {
    const pool = new ObjectPool(makeFactory(), makeReset());
    expect(pool.size).toBe(0);
    const item = pool.acquire();
    expect(item).toBeDefined();
    expect(pool.totalAllocated).toBe(1);
  });

  it("acquire() increments totalAllocated only on fresh allocation", () => {
    const pool = new ObjectPool(makeFactory(), makeReset(), 1);
    const first = pool.acquire();  // from pool — no new alloc
    expect(pool.totalAllocated).toBe(1);

    const second = pool.acquire(); // pool empty — new alloc
    expect(pool.totalAllocated).toBe(2);

    expect(first).not.toBe(second);
  });

  // ── release ───────────────────────────────────────────────────────────────

  it("release() returns item to pool and calls reset", () => {
    const resetFn = vi.fn((item: PoolItem) => { item.active = false; });
    const pool = new ObjectPool(makeFactory(), resetFn);
    const item = pool.acquire();
    item.active = true;

    pool.release(item);
    expect(resetFn).toHaveBeenCalledWith(item);
    expect(item.active).toBe(false);
    expect(pool.size).toBe(1);
  });

  it("release() discards item when pool is at maxSize", () => {
    const disposed: PoolItem[] = [];
    const pool = new ObjectPool(makeFactory(), makeReset(), 0, 2, (i) => disposed.push(i));

    // Acquire 3 items (pool starts empty, all freshly allocated)
    const a = pool.acquire();
    const b = pool.acquire();
    const c = pool.acquire();
    expect(pool.totalAllocated).toBe(3);

    // Release a and b — both fit (pool size goes 0 → 1 → 2 = maxSize)
    pool.release(a);
    pool.release(b);
    expect(pool.size).toBe(2);

    // Release c — pool is at maxSize, so c is discarded via dispose
    pool.release(c);
    expect(pool.size).toBe(2);           // still 2 — c was not enqueued
    expect(disposed).toContain(c);       // c was disposed
    expect(disposed).not.toContain(a);   // a is safely pooled
    expect(disposed).not.toContain(b);   // b is safely pooled
  });

  it("release() does not dispose when dispose function is not provided", () => {
    const pool = new ObjectPool(makeFactory(), makeReset(), 0, 1);
    pool.prewarm(1);
    const a = pool.acquire(); // pool now empty
    const b = pool.acquire(); // newly allocated
    pool.release(a);          // back in pool (size = 1 = max)
    expect(() => pool.release(b)).not.toThrow(); // b is overflow — no dispose
    expect(pool.size).toBe(1);
  });

  // ── prewarm ───────────────────────────────────────────────────────────────

  it("prewarm() after construction adds items up to maxSize", () => {
    const pool = new ObjectPool(makeFactory(), makeReset(), 0, 5);
    pool.prewarm(3);
    expect(pool.size).toBe(3);
    pool.prewarm(4); // only 2 more fit
    expect(pool.size).toBe(5);
    expect(pool.totalAllocated).toBe(5);
  });

  it("prewarm() calls reset on each new item", () => {
    const resetFn = vi.fn((item: PoolItem) => { item.active = false; });
    const pool = new ObjectPool(makeFactory(), resetFn, 3);
    expect(resetFn).toHaveBeenCalledTimes(3);
  });

  // ── clear ─────────────────────────────────────────────────────────────────

  it("clear() disposes all idle items and empties the pool", () => {
    const disposed: PoolItem[] = [];
    const pool = new ObjectPool(makeFactory(), makeReset(), 5, 10, (i) => disposed.push(i));
    pool.clear();
    expect(pool.size).toBe(0);
    expect(disposed).toHaveLength(5);
  });

  it("clear() leaves totalAllocated unchanged", () => {
    const pool = new ObjectPool(makeFactory(), makeReset(), 5);
    pool.clear();
    expect(pool.totalAllocated).toBe(5);
  });

  it("clear() without dispose function does not throw", () => {
    const pool = new ObjectPool(makeFactory(), makeReset(), 5);
    expect(() => pool.clear()).not.toThrow();
    expect(pool.size).toBe(0);
  });

  it("pool is fully functional after clear()", () => {
    const pool = new ObjectPool(makeFactory(), makeReset(), 3);
    pool.clear();
    const item = pool.acquire(); // should allocate a new item
    expect(item).toBeDefined();
    expect(pool.totalAllocated).toBe(4); // 3 prewarm + 1 post-clear
  });

  // ── Lifecycle integration ──────────────────────────────────────────────────

  it("acquire → use → release → reacquire yields same object", () => {
    const pool = new ObjectPool(makeFactory(), makeReset());
    const a = pool.acquire();
    a.active = true;
    pool.release(a);
    const b = pool.acquire();
    expect(b).toBe(a);      // same object reference
    expect(b.active).toBe(false); // reset was called
  });

  it("pool handles multiple concurrent checkouts", () => {
    const pool = new ObjectPool(makeFactory(), makeReset(), 2);
    const a = pool.acquire();
    const b = pool.acquire();
    const c = pool.acquire(); // must allocate new
    expect(pool.totalAllocated).toBe(3);
    expect([a, b, c].every(Boolean)).toBe(true);
  });
});
