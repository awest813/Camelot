import { describe, it, expect, vi } from "vitest";
import { Kernel } from "../../core/kernel";
import { FeedbackKey } from "../services";
import { SurvivalFeature, SurvivalHostKey, type SurvivalBody } from "./survival-feature";

function setup(cold: boolean) {
  const k = new Kernel();
  const notes: string[] = [];
  let mult = 1;
  const body: SurvivalBody = { health: 100, stamina: 100, magicka: 100, maxStamina: 100, maxMagicka: 100, notifyDamageTaken: vi.fn() };
  k.services.provide(SurvivalHostKey, { body: () => body, isCold: () => cold, setXpMultiplier: (m) => { mult = m; } });
  k.services.provide(FeedbackKey, { notify: (t) => { notes.push(t); }, grant: vi.fn(), addFame: vi.fn(), markDirty: vi.fn() });
  const f = new SurvivalFeature();
  k.install(f);
  const live = (seconds: number) => { for (let t = 0; t < seconds; t += 1) k.phases.run("sim", 1); };
  return { k, f, notes, body, live, mult: () => mult };
}

describe("SurvivalFeature (headless, through the kernel)", () => {
  it("out in the cold long enough: warned, then freezing drains health", () => {
    const t = setup(true);
    t.live(60 * 30);
    expect(t.notes).toContain("You are cold. Seek shelter or fire.");
    expect(t.notes).toContain("You are freezing! Health is draining.");
    expect(t.body.health).toBeLessThan(100);
    expect(t.body.notifyDamageTaken).toHaveBeenCalled();
  });

  it("hours on the road (fast travel) leave you hungrier and wearier", () => {
    const t = setup(false);
    const before = { hunger: t.f.needs.hunger, fatigue: t.f.needs.fatigue };
    t.k.events.emit("clock:skipped", { hours: 10, seconds: 50 });
    expect(t.f.needs.hunger).toBeLessThan(before.hunger);
    expect(t.f.needs.fatigue).toBeLessThan(before.fatigue);
  });

  it("in the warm, cold never builds", () => {
    const t = setup(false);
    t.live(60 * 30);
    expect(t.notes.some((n) => /cold|freezing/i.test(n))).toBe(false);
  });

  it("unmet needs slow learning", () => {
    const t = setup(false);
    t.live(60 * 60 * 3);
    expect(t.f.needs.xpMultiplier).toBeLessThanOrEqual(1);
    expect(t.mult()).toBe(t.f.needs.xpMultiplier);
  });
});
