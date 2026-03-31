import { describe, it, expect, beforeEach } from "vitest";
import { ShopSystem, ShopDef, ShopType } from "./shop-system";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const GENERAL_STORE: ShopDef = {
  id: "shop_general_emporium",
  name: "General Emporium",
  type: "general",
  merchantId: "merchant_general_emporium",
  factionId: "merchants_guild",
  openHour: 8,
  closeHour: 20,
  description: "Everything a traveler needs.",
};

const IRON_FORGE: ShopDef = {
  id: "shop_iron_forge",
  name: "The Iron Forge",
  type: "weapons",
  merchantId: "merchant_iron_forge",
  factionId: "merchants_guild",
  openHour: 8,
  closeHour: 18,
  description: "Fine weapons and repair.",
};

const SHIELD_AND_PLATE: ShopDef = {
  id: "shop_shield_and_plate",
  name: "Shield & Plate",
  type: "armor",
  merchantId: "merchant_shield_and_plate",
  factionId: "merchants_guild",
  openHour: 9,
  closeHour: 19,
};

const ELIXIR_SHOP: ShopDef = {
  id: "shop_elixir",
  name: "Elixir & Reagents",
  type: "alchemist",
  merchantId: "merchant_elixir",
  factionId: "mages_college",
  openHour: 10,
  closeHour: 22,
};

const BROKEN_LANTERN_BAR: ShopDef = {
  id: "shop_broken_lantern_bar",
  name: "The Broken Lantern Bar",
  type: "inn_bar",
  merchantId: "merchant_broken_lantern_bar",
  openHour: 6,
  closeHour: 24,
};

const NIGHT_MARKET: ShopDef = {
  id: "shop_night_market",
  name: "Night Market Stall",
  type: "general",
  merchantId: "merchant_night_market",
  openHour: 20,
  closeHour: 4,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ShopSystem", () => {
  let sys: ShopSystem;

  beforeEach(() => {
    sys = new ShopSystem();
  });

  // ── registerShop ───────────────────────────────────────────────────────────

  describe("registerShop", () => {
    it("registers a shop and makes it retrievable by id", () => {
      sys.registerShop(GENERAL_STORE);
      expect(sys.getShop("shop_general_emporium")).toBeDefined();
    });

    it("stores the shop name correctly", () => {
      sys.registerShop(IRON_FORGE);
      expect(sys.getShop("shop_iron_forge")!.name).toBe("The Iron Forge");
    });

    it("stores the merchantId correctly", () => {
      sys.registerShop(IRON_FORGE);
      expect(sys.getShop("shop_iron_forge")!.merchantId).toBe("merchant_iron_forge");
    });

    it("stores the shop type correctly", () => {
      sys.registerShop(ELIXIR_SHOP);
      expect(sys.getShop("shop_elixir")!.type).toBe("alchemist");
    });

    it("replaces a previous registration with the same id", () => {
      sys.registerShop(GENERAL_STORE);
      sys.registerShop({ ...GENERAL_STORE, name: "Updated Emporium" });
      expect(sys.getShop("shop_general_emporium")!.name).toBe("Updated Emporium");
    });
  });

  // ── registerAll ────────────────────────────────────────────────────────────

  describe("registerAll", () => {
    it("registers multiple shops at once", () => {
      sys.registerAll([GENERAL_STORE, IRON_FORGE, ELIXIR_SHOP]);
      expect(sys.registeredIds).toHaveLength(3);
    });

    it("all registered shops are retrievable after registerAll", () => {
      sys.registerAll([GENERAL_STORE, SHIELD_AND_PLATE]);
      expect(sys.getShop("shop_general_emporium")).toBeDefined();
      expect(sys.getShop("shop_shield_and_plate")).toBeDefined();
    });
  });

  // ── getShop ────────────────────────────────────────────────────────────────

  describe("getShop", () => {
    it("returns undefined for an unregistered id", () => {
      expect(sys.getShop("nonexistent")).toBeUndefined();
    });
  });

  // ── registeredIds ──────────────────────────────────────────────────────────

  describe("registeredIds", () => {
    it("returns an empty array when no shops are registered", () => {
      expect(sys.registeredIds).toHaveLength(0);
    });

    it("lists all registered shop ids", () => {
      sys.registerShop(IRON_FORGE);
      sys.registerShop(ELIXIR_SHOP);
      expect(sys.registeredIds).toContain("shop_iron_forge");
      expect(sys.registeredIds).toContain("shop_elixir");
    });
  });

  // ── getAllShops ────────────────────────────────────────────────────────────

  describe("getAllShops", () => {
    it("returns an empty array when no shops are registered", () => {
      expect(sys.getAllShops()).toHaveLength(0);
    });

    it("returns all registered shop definitions", () => {
      sys.registerAll([GENERAL_STORE, IRON_FORGE, SHIELD_AND_PLATE, ELIXIR_SHOP, BROKEN_LANTERN_BAR]);
      expect(sys.getAllShops()).toHaveLength(5);
    });
  });

  // ── getShopsByType ─────────────────────────────────────────────────────────

  describe("getShopsByType", () => {
    beforeEach(() => {
      sys.registerAll([GENERAL_STORE, IRON_FORGE, SHIELD_AND_PLATE, ELIXIR_SHOP, BROKEN_LANTERN_BAR, NIGHT_MARKET]);
    });

    it("returns only weapons shops", () => {
      const shops = sys.getShopsByType("weapons");
      expect(shops).toHaveLength(1);
      expect(shops[0].id).toBe("shop_iron_forge");
    });

    it("returns only armor shops", () => {
      const shops = sys.getShopsByType("armor");
      expect(shops).toHaveLength(1);
      expect(shops[0].id).toBe("shop_shield_and_plate");
    });

    it("returns only alchemist shops", () => {
      const shops = sys.getShopsByType("alchemist");
      expect(shops).toHaveLength(1);
      expect(shops[0].id).toBe("shop_elixir");
    });

    it("returns multiple shops when several share a type", () => {
      const shops = sys.getShopsByType("general");
      expect(shops).toHaveLength(2);
    });

    it("returns inn_bar shops", () => {
      const shops = sys.getShopsByType("inn_bar");
      expect(shops).toHaveLength(1);
      expect(shops[0].id).toBe("shop_broken_lantern_bar");
    });

    it("returns an empty array for a type with no registered shops", () => {
      const fresh = new ShopSystem();
      expect(fresh.getShopsByType("weapons")).toHaveLength(0);
    });
  });

  // ── isOpen ─────────────────────────────────────────────────────────────────

  describe("isOpen", () => {
    beforeEach(() => {
      sys.registerAll([GENERAL_STORE, IRON_FORGE, BROKEN_LANTERN_BAR, NIGHT_MARKET]);
    });

    it("returns true during open hours", () => {
      expect(sys.isOpen("shop_general_emporium", 12)).toBe(true);
    });

    it("returns true at exactly openHour", () => {
      expect(sys.isOpen("shop_general_emporium", 8)).toBe(true);
    });

    it("returns false before openHour", () => {
      expect(sys.isOpen("shop_general_emporium", 7)).toBe(false);
    });

    it("returns false at exactly closeHour (exclusive)", () => {
      expect(sys.isOpen("shop_general_emporium", 20)).toBe(false);
    });

    it("returns false after closeHour", () => {
      expect(sys.isOpen("shop_iron_forge", 19)).toBe(false);
    });

    it("treats closeHour 24 as open until end of day", () => {
      expect(sys.isOpen("shop_broken_lantern_bar", 23)).toBe(true);
    });

    it("handles fractional hours by flooring", () => {
      expect(sys.isOpen("shop_general_emporium", 8.5)).toBe(true);
      expect(sys.isOpen("shop_general_emporium", 19.9)).toBe(true);
    });

    it("returns false for an unregistered shop id", () => {
      expect(sys.isOpen("nonexistent", 12)).toBe(false);
    });

    it("night market is closed during daytime", () => {
      expect(sys.isOpen("shop_night_market", 14)).toBe(false);
    });

    it("night market is open at its openHour", () => {
      expect(sys.isOpen("shop_night_market", 20)).toBe(true);
    });

    it("night market is open at midnight", () => {
      // openHour=20, closeHour=4 — midnight (0) falls within the open window
      expect(sys.isOpen("shop_night_market", 0)).toBe(true);
    });

    it("night market is open at hour 3", () => {
      expect(sys.isOpen("shop_night_market", 3)).toBe(true);
    });

    it("night market is closed at its closeHour", () => {
      expect(sys.isOpen("shop_night_market", 4)).toBe(false);
    });
  });

  // ── getOpenShopsByType ─────────────────────────────────────────────────────

  describe("getOpenShopsByType", () => {
    beforeEach(() => {
      sys.registerAll([GENERAL_STORE, NIGHT_MARKET, IRON_FORGE]);
    });

    it("returns only open shops of the given type", () => {
      // At hour 12: GENERAL_STORE is open (8-20), NIGHT_MARKET is closed (20-4), IRON_FORGE irrelevant type
      const open = sys.getOpenShopsByType("general", 12);
      expect(open).toHaveLength(1);
      expect(open[0].id).toBe("shop_general_emporium");
    });

    it("returns both shops when both of a type are open", () => {
      sys.registerShop({ ...GENERAL_STORE, id: "shop_general_2", merchantId: "merchant_g2", openHour: 8, closeHour: 20 });
      const open = sys.getOpenShopsByType("general", 10);
      expect(open).toHaveLength(2);
    });

    it("returns an empty array when no shops of the type are open", () => {
      const open = sys.getOpenShopsByType("alchemist", 12);
      expect(open).toHaveLength(0);
    });

    it("returns night market when within its hours", () => {
      const open = sys.getOpenShopsByType("general", 22);
      expect(open).toHaveLength(1);
      expect(open[0].id).toBe("shop_night_market");
    });
  });

  // ── shop type coverage ─────────────────────────────────────────────────────

  describe("ShopType coverage", () => {
    const ALL_TYPES: ShopType[] = ["general", "weapons", "armor", "alchemist", "inn_bar"];

    it("all five shop types can be registered and retrieved by type", () => {
      sys.registerAll([GENERAL_STORE, IRON_FORGE, SHIELD_AND_PLATE, ELIXIR_SHOP, BROKEN_LANTERN_BAR]);
      for (const type of ALL_TYPES) {
        expect(sys.getShopsByType(type)).toHaveLength(1);
      }
    });
  });
});
