import { describe, it, expect, vi } from "vitest";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Kernel } from "../../core/kernel";
import { FeedbackKey, PurseKey } from "../services";
import { TravelKey, type TravelService } from "../fast-travel/fast-travel-feature";
import { DeathFeature, DeathHostKey, REVIVE_DELAY } from "./death-feature";

function setup() {
  const k = new Kernel();
  const notes: string[] = [];
  let health = 100;
  let gold = 250;
  const pos = new Vector3(100, 2, 100);
  const host = {
    health: () => health, maxHealth: () => 120, setHealth: (v: number) => { health = v; },
    position: () => pos, flash: vi.fn(), closeScreens: vi.fn(), purgeEffects: vi.fn(), calmAttackers: vi.fn(), fall: vi.fn(), rise: vi.fn(),
  };
  k.services.provide(DeathHostKey, host);
  k.services.provide(PurseKey, { gold: () => gold, spend: (n) => { gold -= n; return true; } });
  k.services.provide(FeedbackKey, { notify: (t) => { notes.push(t); }, grant: vi.fn(), addFame: vi.fn(), markDirty: vi.fn() });
  k.services.provide(TravelKey, {
    places: { discoveredLocations: [
      { id: "far", name: "Far Keep", position: { x: 900, y: 2, z: 900 } },
      { id: "near", name: "Millbrook", position: { x: 110, y: 2, z: 95 } },
    ] },
  } as unknown as TravelService);
  const died: number[] = [];
  k.events.on("player:died", () => died.push(1));
  k.install(new DeathFeature());
  const step = (seconds: number) => { for (let t = 0; t < seconds; t += 0.1) k.phases.run("sim", 0.1); };
  return { k, notes, host, pos, died, step, gold: () => gold, health: () => health, hit: (v: number) => { health = v; } };
}

describe("DeathFeature (headless, through the kernel)", () => {
  it("falling, then waking at the nearest place, lighter in gold", () => {
    const t = setup();
    t.hit(0);
    t.step(0.1);
    expect(t.died).toHaveLength(1);
    expect(t.notes, "the veil says it, not a toast").not.toContain("You have fallen...");
    t.step(REVIVE_DELAY - 1);
    expect(t.health(), "still down").toBe(0);
    t.step(1.2);
    expect(t.health()).toBe(60);
    expect([t.pos.x, t.pos.z]).toEqual([110, 95]);
    expect(t.gold()).toBe(225);
    expect(t.notes.at(-1)).toBe("You awaken at Millbrook. (25 gold lost)");
    expect(t.host.closeScreens).toHaveBeenCalledOnce();
    expect(t.host.calmAttackers).toHaveBeenCalledOnce();
    expect(t.host.fall).toHaveBeenCalledOnce();
    expect(t.host.rise).toHaveBeenCalledOnce();
    // One fall, one event.
    t.step(10);
    expect(t.died).toHaveLength(1);
  });

  it("healed before waking: no revive", () => {
    const t = setup();
    t.hit(0);
    t.step(1);
    t.hit(30);
    t.step(REVIVE_DELAY + 1);
    expect(t.health()).toBe(30);
    expect(t.host.closeScreens).not.toHaveBeenCalled();
  });
});
