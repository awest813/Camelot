import { describe, it, expect, vi } from "vitest";
import { Kernel } from "../../core/kernel";
import { FeedbackKey, LootKey, PlayerKey, WorldStateKey } from "../services";
import { WorldEventsFeature, WorldEventsKey } from "./world-events-feature";

function setup(opts: { weather?: string; bounty?: boolean } = {}) {
  const k = new Kernel();
  const notes: string[] = [];
  const drops: Array<[string, number]> = [];
  const grants: Array<{ gold?: number; xp?: number; label: string }> = [];
  k.services.provide(PlayerKey, { position: () => ({ x: 0, z: 0 }), level: () => 5 });
  k.services.provide(WorldStateKey, {
    weather: () => opts.weather ?? "storm",
    hasBounty: () => !!opts.bounty,
    biomeAt: () => "forest",
  });
  k.services.provide(FeedbackKey, { notify: (t) => { notes.push(t); }, grant: (r) => { grants.push(r); }, addFame: vi.fn(), markDirty: vi.fn() });
  k.services.provide(LootKey, { dropNear: (t, n) => { drops.push([t, n]); } });
  k.install(new WorldEventsFeature());
  return { k, notes, drops, grants };
}

describe("WorldEventsFeature (headless, through the kernel)", () => {
  it("hourly ticks fire dynamic events (caches near the player + rewards) and ambient flavour", () => {
    const t = setup({ weather: "storm", bounty: true });
    // A week of hours, starting at midnight.
    for (let h = 0; h < 24 * 7; h++) t.k.events.emit("time:hour", { hour: h % 24, elapsedHours: h });
    expect(t.notes.some((n) => n.startsWith("World event:")), "a world event fired").toBe(true);
    expect(t.drops.length).toBeGreaterThan(0);
    expect(t.drops.every(([, n]) => n >= 1 && n <= 3)).toBe(true);
    expect(t.grants.length).toBeGreaterThan(0);
    // Night in a forest: the wolf howls at some point.
    expect(t.notes).toContain("A wolf howls somewhere in the dark.");
  });

  it("offers the travel events for fast-travel arrival, and stops on uninstall", () => {
    const t = setup();
    const { travel } = t.k.services.get(WorldEventsKey);
    expect(travel).toBeDefined();
    t.k.uninstall("world-events");
    const before = t.notes.length;
    for (let h = 0; h < 48; h++) t.k.events.emit("time:hour", { hour: h % 24, elapsedHours: h });
    expect(t.notes.length).toBe(before);
  });
});
