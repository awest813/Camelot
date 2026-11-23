import { describe, it, expect, vi } from "vitest";
import type { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Kernel } from "../../core/kernel";
import type { Item } from "../../systems/inventory-system";
import { FeedbackKey } from "../services";
import { SpoilsFeature, SpoilsHostKey } from "./spoils-feature";

function setup() {
  const k = new Kernel();
  const notes: string[] = [];
  const drops: Array<{ at: Vector3; item: Item }> = [];
  const coin: Item = { id: "gold_coins", name: "Gold", description: "", stackable: true, quantity: 5 };
  k.services.provide(SpoilsHostKey, {
    level: () => 7,
    roll: (table) => (table === "bandit" ? [coin, { ...coin, id: "dagger", name: "Dagger" }] : []),
    resolveLeveled: () => "steel_sword",
    drop: (at, item) => { drops.push({ at, item }); },
  });
  k.services.provide(FeedbackKey, { notify: (t) => { notes.push(t); }, grant: vi.fn(), addFame: vi.fn(), markDirty: vi.fn() });
  k.install(new SpoilsFeature());
  const kill = (npcId: string, lootTableId?: string) =>
    k.events.emit("player:kill", { npcId, npcName: npcId, xp: 10, at: { x: 10, y: 1, z: -4 }, lootTableId });
  return { k, notes, drops, kill };
}

describe("SpoilsFeature (headless, through the kernel)", () => {
  it("a bandit's loot table scatters where it fell", () => {
    const t = setup();
    t.kill("Bandit_3", "bandit");
    expect(t.drops.map((d) => d.item.id)).toEqual(["gold_coins", "dagger"]);
    for (const d of t.drops) {
      expect(Math.abs(d.at.x - 10)).toBeLessThanOrEqual(0.6);
      expect(d.at.y).toBeCloseTo(1.5);
    }
  });

  it("an elite also drops leveled gear, and says so", () => {
    const t = setup();
    t.kill("Bandit Chief_1");
    expect(t.drops.map((d) => d.item.name)).toEqual(["Steel Sword"]);
    expect(t.notes).toEqual(["The elite drops Steel Sword!"]);
  });

  it("an ordinary NPC without a table leaves nothing", () => {
    const t = setup();
    t.kill("Villager_2");
    expect(t.drops).toEqual([]);
  });
});
