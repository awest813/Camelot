import { describe, it, expect, vi, beforeEach } from "vitest";
import { BarterSystem } from "./barter-system";

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
      items: [],
      addItem: vi.fn(() => true),
      removeItem: vi.fn(() => true),
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
    expect(mockInventory.addItem).toHaveBeenCalled();
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

  // ── sellItem ──────────────────────────────────────────────────────────────

  it("sellItem adds gold to player and deducts from merchant", () => {
    mockInventory.items = [{ ...sampleItem }];
    const sellPrice = barter.getSellPrice(sampleItem);
    barter.sellItem("merch_01", "sword");
    expect(barter.playerGold).toBe(200 + sellPrice);
    expect(barter.getMerchant("merch_01")!.gold).toBe(500 - sellPrice);
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
    barter.onTransaction = spy;
    barter.buyItem("merch_01", "potion_hp");
    expect(spy).toHaveBeenCalledWith("buy", "Health Potion", expect.any(Number));
  });

  it("fires onTransaction callback on sell", () => {
    const spy = vi.fn();
    barter.onTransaction = spy;
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
});
