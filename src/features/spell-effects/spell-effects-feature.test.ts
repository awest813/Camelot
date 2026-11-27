import { describe, expect, it } from "vitest";
import { Kernel } from "../../core/kernel";
import { SpellEffectsFeature } from "./spell-effects-feature";

function setup() {
  const k = new Kernel();
  const added: Array<{ effectType: string; magnitude: number; duration: number }> = [];
  const d = {
    effects: { addEffect: (e: { effectType: string; magnitude: number; duration: number }) => { added.push(e); } },
    stealth: { unseenSeconds: 0 },
    swim: { waterBreathingSeconds: 0 },
    alchemy: { effects: null as null | { timed: (...a: any[]) => void; unseen: (s: number) => void } },
  };
  k.install(new SpellEffectsFeature(d as never));
  const cast = (spellId: string, effect: string, magnitude: number, duration: number) =>
    k.events.emit("spell:cast", { spellId, spellName: spellId, magickaCost: 10, effect: effect as never, magnitude, duration });
  return { k, d, added, cast };
}

describe("SpellEffectsFeature", () => {
  it("Bark-skin wards, Spirit Blade fortifies, Fade cloaks, Breath of the Lake lets you breathe", () => {
    const t = setup();
    t.cast("barkskin", "ward", 30, 60);
    t.cast("spirit_blade", "spirit_weapon", 50, 60);
    t.cast("fade", "unseen", 0, 15);
    t.cast("lake_breath", "water_breathing", 0, 30);
    expect(t.added.map((e) => [e.effectType, e.magnitude, e.duration])).toEqual([["resist_damage", 30, 60], ["fortify_strength", 50, 60]]);
    expect(t.d.stealth.unseenSeconds).toBe(15);
    expect(t.d.swim.waterBreathingSeconds).toBe(30);
  });

  it("gives crafted potions their lasting effects, and takes the hook back on uninstall", () => {
    const t = setup();
    t.d.alchemy.effects!.timed("fortify_health", 20, 60, "Fortify Endurance");
    t.d.alchemy.effects!.unseen(30);
    expect(t.added.at(-1)).toMatchObject({ effectType: "fortify_health", magnitude: 20, duration: 60 });
    expect(t.d.stealth.unseenSeconds).toBe(30);
    t.k.uninstall("spell-effects");
    expect(t.d.alchemy.effects).toBeNull();
  });
});
