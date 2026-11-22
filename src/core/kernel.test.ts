import { describe, it, expect, vi } from "vitest";
import { Scope } from "./scope";
import { Rng, RngStreams, hashString } from "./rng/rng";
import { PhaseScheduler } from "./phases";
import { Kernel, createServiceKey, type Feature } from "./kernel";

describe("Scope", () => {
  it("disposes children first, then its own items in reverse order, once", () => {
    const log: string[] = [];
    const root = new Scope("root");
    root.add(() => log.push("a"));
    const child = root.child("child");
    child.add({ dispose: () => log.push("child") });
    root.add(() => log.push("b"));
    root.dispose();
    root.dispose();
    expect(log).toEqual(["child", "b", "a"]);
    expect(child.disposed).toBe(true);
  });

  it("releases things added after disposal at once (late async callbacks)", () => {
    const s = new Scope();
    s.dispose();
    const fn = vi.fn();
    s.add(fn);
    expect(fn).toHaveBeenCalledOnce();
    expect(s.child("late").disposed).toBe(true);
  });

  it("a child disposed early is dropped from its parent", () => {
    const log: string[] = [];
    const root = new Scope();
    const c = root.child("c");
    c.add(() => log.push("c"));
    c.dispose();
    root.dispose();
    expect(log).toEqual(["c"]);
  });

  it("keeps going when a disposer throws", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const after = vi.fn();
    const s = new Scope();
    s.add(after);
    s.add(() => { throw new Error("boom"); });
    s.dispose();
    expect(after).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("Rng / RngStreams", () => {
  it("replays exactly from a seed or a saved state", () => {
    const a = new Rng("seed"), b = new Rng("seed");
    const xs = Array.from({ length: 5 }, () => a.next());
    expect(Array.from({ length: 5 }, () => b.next())).toEqual(xs);
    const state = a.getState();
    const next = a.next();
    const c = new Rng(0); c.setState(state);
    expect(c.next()).toBe(next);
  });

  it("stays in range", () => {
    const r = new Rng(1);
    for (let i = 0; i < 500; i++) {
      const v = r.int(2, 5);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(5);
      expect(r.next()).toBeLessThan(1);
    }
  });

  it("derives independent named streams, unaffected by creation order", () => {
    const s1 = new RngStreams("world");
    const s2 = new RngStreams("world");
    s2.stream("other").next();
    expect(s1.stream("loot").next()).toBe(s2.stream("loot").next());
    expect(s1.stream("chunk", 3, 4).next()).toBe(new RngStreams("world").stream("chunk", 3, 4).next());
    expect(s1.stream("chunk", 3, 4)).toBe(s1.stream("chunk", 3, 4));
    expect(new RngStreams("a").stream("x").next()).not.toBe(new RngStreams("b").stream("x").next());
    expect(hashString("abc")).toBe(hashString("abc"));
  });

  it("saves and restores stream positions", () => {
    const s = new RngStreams("w");
    s.stream("raids").next();
    const saved = s.getSaveState();
    const expected = s.stream("raids").next();
    const t = new RngStreams("other");
    t.restoreFromSave(saved);
    expect(t.seed).toBe("w");
    expect(t.stream("raids").next()).toBe(expected);
  });

  it("a stream kept across a reseed or a load stays live (it is the saved one)", () => {
    const s = new RngStreams("before");
    const kept = s.stream("raids");
    kept.next();
    s.reseed("world");
    expect(kept.next(), "restarts from the new seed").toBe(new RngStreams("world").stream("raids").next());
    expect(s.stream("raids")).toBe(kept);

    const other = new RngStreams("w");
    other.stream("raids").next();
    other.stream("raids").next();
    const saved = other.getSaveState();
    const expected = other.stream("raids").next();
    s.restoreFromSave(saved);
    expect(kept.next(), "continues from the save").toBe(expected);
  });
});

describe("PhaseScheduler", () => {
  it("runs a phase in dependency order, keeping registration order otherwise", () => {
    const p = new PhaseScheduler();
    const log: string[] = [];
    const sys = (id: string, after?: string[]) => ({ id, phase: "sim" as const, after, update: () => log.push(id) });
    p.register(sys("c", ["a"]));
    p.register(sys("a"));
    p.register(sys("b"));
    p.register(sys("d", ["missing"]));
    p.register({ id: "x", phase: "present", update: () => log.push("x") });
    p.run("sim", 0.016);
    expect(log).toEqual(["a", "c", "b", "d"]);
    expect(p.orderOf("present")).toEqual(["x"]);
  });

  it("unregisters, rejects duplicates and cycles, and isolates failures", () => {
    const p = new PhaseScheduler();
    const off = p.register({ id: "a", phase: "ai", update: () => undefined });
    expect(() => p.register({ id: "a", phase: "ai", update: () => undefined })).toThrow();
    off();
    expect(p.has("a")).toBe(false);

    p.register({ id: "x", phase: "sim", after: ["y"], update: () => undefined });
    p.register({ id: "y", phase: "sim", after: ["x"], update: () => undefined });
    expect(() => p.run("sim", 0)).toThrow(/cycle/);

    const q = new PhaseScheduler();
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const ran = vi.fn();
    q.register({ id: "bad", phase: "sim", update: () => { throw new Error("x"); } });
    q.register({ id: "good", phase: "sim", update: ran });
    q.run("sim", 0);
    expect(ran).toHaveBeenCalled();
    expect(q.timings().map((t) => t.id).sort()).toEqual(["bad", "good"]);
    err.mockRestore();
  });
});

describe("Kernel", () => {
  const Clock = createServiceKey<{ hour: number }>("clock");

  it("installs a feature whose systems, events and services go away on uninstall", () => {
    const k = new Kernel({ seed: "test" });
    const heard: number[] = [];
    const ticks = vi.fn();
    const feature: Feature = {
      id: "demo",
      install(ctx) {
        ctx.system({ id: "demo.tick", phase: "sim", update: ticks });
        ctx.on("player:levelUp", ({ newLevel }) => heard.push(newLevel));
        ctx.provide(Clock, { hour: 8 });
      },
    };
    k.install(feature);
    expect(() => k.install(feature)).toThrow();
    k.phases.run("sim", 0.1);
    k.events.emit("player:levelUp", { newLevel: 2 });
    expect(k.services.get(Clock).hour).toBe(8);

    k.uninstall("demo");
    k.phases.run("sim", 0.1);
    k.events.emit("player:levelUp", { newLevel: 3 });
    expect(ticks).toHaveBeenCalledTimes(1);
    expect(heard).toEqual([2]);
    expect(k.services.tryGet(Clock)).toBeUndefined();
    expect(k.isInstalled("demo")).toBe(false);
  });

  it("rolls back a feature whose install throws", () => {
    const k = new Kernel();
    expect(() => k.install({
      id: "broken",
      install(ctx) {
        ctx.provide(Clock, { hour: 1 });
        throw new Error("nope");
      },
    })).toThrow("nope");
    expect(k.services.tryGet(Clock)).toBeUndefined();
    expect(k.isInstalled("broken")).toBe(false);
  });
});
