import { describe, it, expect } from "vitest";
import type { Item } from "../systems/inventory-system";
import { PlayerPack, GOLD_ITEM_ID, type PackInventory } from "./player-pack";

function setup() {
  const items: Item[] = [];
  const inv: PackInventory = {
    items,
    addItem: (it) => {
      const ex = it.stackable ? items.find((i) => i.id === it.id) : undefined;
      if (ex) ex.quantity += it.quantity; else items.push({ ...it });
      return true;
    },
    removeItem: (id, n = 1) => {
      const ex = items.find((i) => i.id === id);
      if (!ex || ex.quantity < n) return false;
      ex.quantity -= n;
      if (ex.quantity === 0) items.splice(items.indexOf(ex), 1);
      return true;
    },
  };
  const pack = new PlayerPack(() => inv,
    (id) => (id === "health_potion" ? { name: "Health Potion", description: "", stackable: true } : undefined));
  return { pack, items };
}

describe("PlayerPack", () => {
  it("gold: add, spend, can't overspend, set; dialogue counts it as an item", () => {
    const t = setup();
    t.pack.addGold(50);
    expect(t.pack.gold()).toBe(50);
    expect(t.pack.count(GOLD_ITEM_ID)).toBe(50);
    expect(t.pack.spendGold(80)).toBe(false);
    expect(t.pack.spendGold(20)).toBe(true);
    t.pack.setGold(100);
    expect(t.pack.gold()).toBe(100);
    t.pack.setGold(10);
    expect(t.pack.gold()).toBe(10);
  });

  it("framework item ids map to the game's", () => {
    const t = setup();
    expect(t.pack.give("health_potion", 2)).toBe(true);
    expect(t.items[0]).toMatchObject({ id: "potion_hp_01", quantity: 2 });
    expect(t.pack.count("health_potion")).toBe(2);
    expect(t.pack.consume("health_potion", 1)).toBe(true);
    expect(t.pack.count("health_potion")).toBe(1);
    expect(t.pack.give("unknown_thing", 1)).toBe(false);
  });

  it("receive: another of a carried item, else a framework item, else the fallback", () => {
    const t = setup();
    t.pack.receive("trinket", () => ({ id: "trinket", name: "Trinket", description: "", stackable: false, quantity: 1 }));
    expect(t.items.map((i) => i.id)).toEqual(["trinket"]);
    t.pack.receive("health_potion", () => { throw new Error("not the fallback"); });
    expect(t.pack.count("health_potion")).toBe(1);
  });
});
