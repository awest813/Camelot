import { describe, it, expect } from "vitest";
import { ActorStore, Aggressive, Dead, InDialogue } from "./actors";

describe("ActorStore", () => {
  it("gives each body an id, tags it, and finds actors by tags", () => {
    const s = new ActorStore<{ name: string }>();
    const a = s.spawn({ name: "Bandit" }), b = s.spawn({ name: "Farmer" });
    expect(a).not.toBe(b);
    s.set(a, Aggressive, true);
    s.set(b, Dead, true);
    s.set(a, Dead, true);
    expect(s.has(a, Aggressive)).toBe(true);
    expect(s.has(b, Aggressive)).toBe(false);
    expect([...s.query(Dead)].sort()).toEqual([a, b].sort());
    expect([...s.query(Dead, Aggressive)]).toEqual([a]);
    expect(s.body(a)?.name).toBe("Bandit");
    s.set(a, Dead, false);
    expect([...s.query(Dead)]).toEqual([b]);
  });

  it("a despawned actor has no tags and is gone from queries", () => {
    const s = new ActorStore();
    const a = s.spawn({});
    s.set(a, InDialogue, true);
    s.despawn(a);
    expect(s.exists(a)).toBe(false);
    expect(s.has(a, InDialogue)).toBe(false);
    expect([...s.query(InDialogue)]).toEqual([]);
    expect(() => s.set(a, InDialogue, true)).not.toThrow();
    s.despawn(a);
    expect(s.size).toBe(0);
  });

  it("a recycled slot gets a new id, so a stale id names nothing", () => {
    const s = new ActorStore<string>();
    const a = s.spawn("first");
    s.despawn(a);
    const b = s.spawn("second");
    expect(b).not.toBe(a);
    expect(s.body(a)).toBeUndefined();
    expect(s.body(b)).toBe("second");
  });

  it("survives heavy churn: every live actor keeps its tags (bitECS 0.4.0 versioning broke here)", () => {
    const s = new ActorStore<number>();
    let live: number[] = [];
    for (let round = 0; round < 50; round++) {
      for (let i = 0; i < 20; i++) { const id = s.spawn(i); s.set(id, Dead, true); live.push(id); }
      for (const id of live.filter((_, i) => i % 3 === round % 3)) s.despawn(id);
      live = live.filter((id) => s.exists(id));
      for (const id of live) { s.set(id, Aggressive, true); expect(s.has(id, Dead)).toBe(true); }
    }
    expect(new Set(s.query(Dead, Aggressive))).toEqual(new Set(live));
  });
});
