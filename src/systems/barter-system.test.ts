import { describe, it, expect, vi, beforeEach } from "vitest";
import type { InventorySystem } from "./inventory-system";
import { BarterSystem } from "./barter-system";
import { listen } from "../testing/listen";

describe("BarterSystem", () => {
  let barter: BarterSystem;
  let mockInventory: any;
  let mockUI: any;

  const sampleItem = {
    id: "sword",
    name: "Iron Sword",
    description: "A basic sword.",
    stackable: false,
    quantity: 1,
    weight: 3,
    stats: { value: 80 },
  };

  const potion = {
    id: "potion_hp",
    name: "Health Potion",
    description: "Restores 50 HP.",
    stackable: true,
    quantity: 5,
    weight: 0.3,
    stats: { value: 25 },
  };

  beforeEach(() => {
    mockUI = { showNotification: vi.fn() };
    mockInventory = {
      items: [] as typeof potion[],
      addItem(item: typeof potion) {
        const copy = { ...item };
        const existing = this.items.find((i) => i.id === copy.id);
        if (copy.stackable && existing) {
          existing.quantity += copy.quantity;
        } else {
          this.items.push(copy);
        }
        return true;
      },
      removeItem(itemId: string, amount: number) {
        const idx = this.items.findIndex((i) => i.id === itemId);
        if (idx === -1) return false;
        const row = this.items[idx];
        if (row.quantity > amount) row.quantity -= amount;
        else this.items.splice(idx, 1);
        return true;
      },
      removeInstance(item: typeof potion & { instanceId?: string }, amount: number) {
        let idx = this.items.indexOf(item);
        if (idx === -1) return this.removeItem(item.id, amount);
        const row = this.items[idx];
        if (row.quantity > amount) row.quantity -= amount;
        else this.items.splice(idx, 1);
        return true;
      },
    };

    barter = new BarterSystem(mockInventory, mockUI);
    barter.playerGold = 200;
    barter.barterSkill = 20;

    barter.registerMerchant({
      id: "merch_01",
      name: "Trader",
      factionId: "town",
      inventory: [{ ...potion }],
      gold: 500,
      priceMultiplier: 1.0,
      isOpen: true,
      openHour: 8,
      closeHour: 20,
    });
  });

  // ── getBuyPrice ────────────────────────────────────────────────────────────

  it("getBuyPrice reflects base value and barter factor", () => {
    const price = barter.getBuyPrice(potion, "merch_01");
    // barterFactor = 1.4 - 20/250 = 1.32; price = 25 * 1.0 * 1.32 = 33
    expect(price).toBe(Math.round(25 * (1.4 - 20 / 250)));
  });

  it("getBuyPrice decreases as barterSkill increases", () => {
    barter.barterSkill = 20;
    const price20 = barter.getBuyPrice(potion, "merch_01");
    barter.barterSkill = 80;
    const price80 = barter.getBuyPrice(potion, "merch_01");
    expect(price80).toBeLessThan(price20);
  });

  it("getBuyPrice improves with merchant rapport", () => {
    const before = barter.getBuyPrice(potion, "merch_01");
    barter.buyItem("merch_01", "potion_hp");
    const after = barter.getBuyPrice(potion, "merch_01");
    expect(after).toBeLessThanOrEqual(before);
    expect(barter.getMerchantRapport("merch_01")).toBe(1);
  });

  // ── getSellPrice ──────────────────────────────────────────────────────────

  it("getSellPrice is a fraction of item value", () => {
    const price = barter.getSellPrice(sampleItem);
    expect(price).toBeGreaterThan(0);
    expect(price).toBeLessThan(80); // always less than base value
  });

  it("getSellPrice improves with higher barterSkill", () => {
    barter.barterSkill = 10;
    const price10 = barter.getSellPrice(potion);
    barter.barterSkill = 90;
    const price90 = barter.getSellPrice(potion);
    expect(price90).toBeGreaterThan(price10);
  });

  it("getSellPrice drops when merchant is saturated with that item", () => {
    const baseline = barter.getSellPrice(potion, "merch_01");
    const merch = barter.getMerchant("merch_01")!;
    merch.inventory.push({ ...potion, quantity: 20 });
    const saturated = barter.getSellPrice(potion, "merch_01");
    expect(saturated).toBeLessThan(baseline);
  });

  // ── openBarter ────────────────────────────────────────────────────────────

  it("openBarter returns true for a valid open merchant", () => {
    expect(barter.openBarter("merch_01", 10)).toBe(true);
    expect(barter.activeMerchantId).toBe("merch_01");
  });

  it("openBarter returns false for unknown merchant", () => {
    expect(barter.openBarter("unknown", 10)).toBe(false);
  });

  it("openBarter returns false when outside trading hours", () => {
    expect(barter.openBarter("merch_01", 22)).toBe(false);
    expect(mockUI.showNotification).toHaveBeenCalled();
  });

  it("openBarter returns false when merchant isOpen = false", () => {
    const merch = barter.getMerchant("merch_01")!;
    merch.isOpen = false;
    expect(barter.openBarter("merch_01", 10)).toBe(false);
  });

  // ── buyItem ───────────────────────────────────────────────────────────────

  it("buyItem deducts gold from player and adds to merchant", () => {
    const price = barter.getBuyPrice(potion, "merch_01");
    barter.buyItem("merch_01", "potion_hp");
    expect(barter.playerGold).toBe(200 - price);
    expect(barter.getMerchant("merch_01")!.gold).toBe(500 + price);
    expect(mockInventory.items.some((i) => i.id === "potion_hp")).toBe(true);
  });

  it("buyItem returns false if player gold < price", () => {
    barter.playerGold = 1;
    const result = barter.buyItem("merch_01", "potion_hp");
    expect(result).toBe(false);
    expect(mockUI.showNotification).toHaveBeenCalled();
  });

  it("buyItem returns false if item not in stock", () => {
    expect(barter.buyItem("merch_01", "nonexistent")).toBe(false);
  });

  it("buyItem reduces merchant stock quantity", () => {
    barter.buyItem("merch_01", "potion_hp");
    const stock = barter.getMerchant("merch_01")!.inventory.find(i => i.id === "potion_hp");
    // quantity was 5, should now be 4
    expect(stock?.quantity).toBe(4);
  });

  it("buyItem rolls back gold and stock if item vanishes after addItem (integrity check)", () => {
    const rogueInv = {
      items: [] as typeof potion[],
      addItem(_item: typeof potion) {
        return true;
      },
      removeItem(_itemId: string, _amount: number) {
        return true;
      },
    };
    const rogueBarter = new BarterSystem(rogueInv as unknown as InventorySystem, mockUI);
    rogueBarter.playerGold = 200;
    rogueBarter.barterSkill = 20;
    rogueBarter.registerMerchant({
      id: "merch_01",
      name: "Trader",
      factionId: "town",
      inventory: [{ ...potion, quantity: 2 }],
      gold: 500,
      priceMultiplier: 1.0,
      isOpen: true,
      openHour: 8,
      closeHour: 20,
    });
    const price = rogueBarter.getBuyPrice(potion, "merch_01");
    expect(rogueBarter.buyItem("merch_01", "potion_hp")).toBe(false);
    expect(rogueBarter.playerGold).toBe(200);
    const m = rogueBarter.getMerchant("merch_01")!;
    expect(m.gold).toBe(500);
    expect(m.inventory.find((i) => i.id === "potion_hp")?.quantity).toBe(2);
  });

  it("an item that goes straight to the quiver or satchel is still paid for and leaves the stock", () => {
    const absorbingInv = {
      items: [] as typeof potion[],
      lastAddAbsorbed: false,
      addItem(_item: typeof potion) { this.lastAddAbsorbed = true; return true; },
      removeItem() { return true; },
    };
    const b = new BarterSystem(absorbingInv as unknown as InventorySystem, mockUI);
    b.playerGold = 200;
    b.barterSkill = 20;
    b.registerMerchant({
      id: "merch_01", name: "Trader", factionId: "town", inventory: [{ ...potion, quantity: 2 }],
      gold: 500, priceMultiplier: 1.0, isOpen: true, openHour: 8, closeHour: 20,
    });
    const price = b.getBuyPrice(potion, "merch_01");
    expect(b.buyItem("merch_01", "potion_hp")).toBe(true);
    expect(b.playerGold).toBe(200 - price);
    expect(b.getMerchant("merch_01")!.inventory.find((i) => i.id === "potion_hp")?.quantity).toBe(1);
  });

  // ── sellItem ──────────────────────────────────────────────────────────────

  it("sellItem adds gold to player and deducts from merchant", () => {
    mockInventory.items = [{ ...sampleItem }];
    const sellPrice = barter.getSellPrice(sampleItem);
    barter.sellItem("merch_01", "sword");
    expect(barter.playerGold).toBe(200 + sellPrice);
    expect(barter.getMerchant("merch_01")!.gold).toBe(500 - sellPrice);
  });

  it("gold coins can't be sold for gold (each sale made a coin)", () => {
    mockInventory.items = [{ id: "gold_coins", name: "Gold Coins", description: "", stackable: true, quantity: 100, weight: 0, stats: { value: 1 } }];
    expect(barter.sellItem("merch_01", "gold_coins")).toBe(false);
    expect(barter.playerGold).toBe(200);
    expect(mockInventory.items[0].quantity).toBe(100);
  });

  it("sellItem sells the exact copy named by instanceId", () => {
    const worn  = { ...sampleItem, instanceId: "sword#worn" };
    const fresh = { ...sampleItem, instanceId: "sword#fresh" };
    mockInventory.items = [worn, fresh];
    expect(barter.sellItem("merch_01", "sword", "sword#fresh")).toBe(true);
    expect(mockInventory.items.map((i: { instanceId?: string }) => i.instanceId)).toEqual(["sword#worn"]);
    const stock = barter.getMerchant("merch_01")!.inventory;
    expect(stock.some((i) => i.instanceId === "sword#fresh")).toBe(true);
  });

  it("buyItem buys the exact copy named by instanceId", () => {
    const m = barter.getMerchant("merch_01")!;
    m.inventory.push({ ...sampleItem, instanceId: "sword#a" }, { ...sampleItem, instanceId: "sword#b" });
    expect(barter.buyItem("merch_01", "sword", "sword#b")).toBe(true);
    expect(mockInventory.items.some((i: { instanceId?: string }) => i.instanceId === "sword#b")).toBe(true);
    expect(m.inventory.some((i) => i.instanceId === "sword#a")).toBe(true);
    expect(m.inventory.some((i) => i.instanceId === "sword#b")).toBe(false);
  });

  it("itemValueMultiplier lowers both buy and sell prices", () => {
    const full = { ...sampleItem };
    const sellFull = barter.getSellPrice(full, "merch_01");
    const buyFull = barter.getBuyPrice(full, "merch_01");
    barter.itemValueMultiplier = () => 0.5;
    expect(barter.getSellPrice(full, "merch_01")).toBe(Math.max(1, Math.round(sellFull / 2)));
    expect(barter.getBuyPrice(full, "merch_01")).toBeLessThan(buyFull);
    barter.itemValueMultiplier = () => 5; // clamped to full value
    expect(barter.getSellPrice(full, "merch_01")).toBe(sellFull);
  });

  it("sellItem returns false when item not in player inventory", () => {
    mockInventory.items = [];
    expect(barter.sellItem("merch_01", "sword")).toBe(false);
  });

  it("sellItem returns false when merchant can't afford it", () => {
    const expensiveItem = { ...sampleItem, stats: { value: 10000 } };
    mockInventory.items = [expensiveItem];
    expect(barter.sellItem("merch_01", "sword")).toBe(false);
    expect(mockUI.showNotification).toHaveBeenCalled();
  });

  it("fires onTransaction callback on buy", () => {
    const spy = vi.fn();
    listen(barter, "barter:transaction", (p) => spy(p.type, p.itemName, p.gold));
    barter.buyItem("merch_01", "potion_hp");
    expect(spy).toHaveBeenCalledWith("buy", "Health Potion", expect.any(Number));
  });

  it("fires onTransaction callback on sell", () => {
    const spy = vi.fn();
    listen(barter, "barter:transaction", (p) => spy(p.type, p.itemName, p.gold));
    mockInventory.items = [{ ...sampleItem }];
    barter.sellItem("merch_01", "sword");
    expect(spy).toHaveBeenCalledWith("sell", "Iron Sword", expect.any(Number));
  });

  // ── closeBarter ───────────────────────────────────────────────────────────

  it("closeBarter clears activeMerchantId", () => {
    barter.openBarter("merch_01", 10);
    barter.closeBarter();
    expect(barter.activeMerchantId).toBeNull();
  });

  // ── persistence ───────────────────────────────────────────────────────────

  it("saves and restores merchant inventory and gold", () => {
    barter.buyItem("merch_01", "potion_hp");
    const saved = barter.getSaveState();

    // Create fresh system and restore
    const restored = new BarterSystem(mockInventory, mockUI);
    restored.registerMerchant({
      id: "merch_01",
      name: "Trader",
      factionId: "town",
      inventory: [{ ...potion }],
      gold: 500,
      isOpen: true,
      openHour: 8,
      closeHour: 20,
    });
    restored.restoreFromSave(saved);

    const merchant = restored.getMerchant("merch_01")!;
    expect(merchant.gold).toBe(barter.getMerchant("merch_01")!.gold);
    expect(restored.playerGold).toBe(barter.playerGold);
  });

  it("persists merchant rapport", () => {
    barter.buyItem("merch_01", "potion_hp");
    const saved = barter.getSaveState();

    const restored = new BarterSystem(mockInventory, mockUI);
    restored.registerMerchant({
      id: "merch_01",
      name: "Trader",
      factionId: "town",
      inventory: [{ ...potion }],
      gold: 500,
      isOpen: true,
      openHour: 8,
      closeHour: 20,
    });
    restored.restoreFromSave(saved);

    expect(restored.getMerchantRapport("merch_01")).toBe(1);
  });
});
