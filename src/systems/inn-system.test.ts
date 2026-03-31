import { describe, it, expect, beforeEach, vi } from "vitest";
import { InnSystem, InnDef, InnMenuItem, InnSaveState } from "./inn-system";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ALE_ITEM: InnMenuItem = {
  id: "ale",
  name: "Ale",
  description: "A frothy mug of ale.",
  price: 2,
  type: "drink",
  itemId: "ale",
};

const MEAD_ITEM: InnMenuItem = {
  id: "mead",
  name: "Mead",
  description: "A rich honeyed mead.",
  price: 3,
  type: "drink",
  itemId: "mead",
};

const STEW_ITEM: InnMenuItem = {
  id: "stew",
  name: "Hot Stew",
  description: "A hearty bowl of stew.",
  price: 4,
  type: "food",
  itemId: "stew",
};

const BREAD_ITEM: InnMenuItem = {
  id: "bread",
  name: "Bread",
  description: "A loaf of bread.",
  price: 1,
  type: "food",
};

const BROKEN_LANTERN: InnDef = {
  id: "inn_broken_lantern",
  name: "The Broken Lantern",
  factionId: "town",
  roomPrice: 10,
  openHour: 6,
  closeHour: 24,
  roomCount: 4,
  menuItems: [ALE_ITEM, MEAD_ITEM, STEW_ITEM, BREAD_ITEM],
};

const NIGHT_OWL_INN: InnDef = {
  id: "inn_night_owl",
  name: "Night Owl Inn",
  roomPrice: 15,
  openHour: 20,
  closeHour: 6,
  roomCount: 2,
  menuItems: [ALE_ITEM],
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("InnSystem", () => {
  let inn: InnSystem;

  beforeEach(() => {
    inn = new InnSystem();
  });

  // ── registerInn ────────────────────────────────────────────────────────────

  describe("registerInn", () => {
    it("registers a single inn and makes it retrievable", () => {
      inn.registerInn(BROKEN_LANTERN);
      expect(inn.getInn("inn_broken_lantern")).toBeDefined();
      expect(inn.getInn("inn_broken_lantern")!.name).toBe("The Broken Lantern");
    });

    it("stores the room price correctly", () => {
      inn.registerInn(BROKEN_LANTERN);
      expect(inn.getInn("inn_broken_lantern")!.roomPrice).toBe(10);
    });

    it("stores menuItems without mutation", () => {
      inn.registerInn(BROKEN_LANTERN);
      const stored = inn.getInn("inn_broken_lantern")!;
      expect(stored.menuItems).toHaveLength(4);
    });

    it("replaces a previous registration with the same id", () => {
      inn.registerInn(BROKEN_LANTERN);
      inn.registerInn({ ...BROKEN_LANTERN, roomPrice: 20 });
      expect(inn.getInn("inn_broken_lantern")!.roomPrice).toBe(20);
    });

    it("initialises goldEarned to 0 on first registration", () => {
      inn.registerInn(BROKEN_LANTERN);
      expect(inn.getGoldEarned("inn_broken_lantern")).toBe(0);
    });

    it("returns all registered ids", () => {
      inn.registerInn(BROKEN_LANTERN);
      inn.registerInn(NIGHT_OWL_INN);
      expect(inn.registeredIds).toContain("inn_broken_lantern");
      expect(inn.registeredIds).toContain("inn_night_owl");
    });
  });

  // ── getInn ─────────────────────────────────────────────────────────────────

  describe("getInn", () => {
    it("returns undefined for an unregistered id", () => {
      expect(inn.getInn("nonexistent")).toBeUndefined();
    });
  });

  // ── getMenuItems ───────────────────────────────────────────────────────────

  describe("getMenuItems", () => {
    beforeEach(() => inn.registerInn(BROKEN_LANTERN));

    it("returns all menu items when no type filter is given", () => {
      expect(inn.getMenuItems("inn_broken_lantern")).toHaveLength(4);
    });

    it("filters to only drink items", () => {
      const drinks = inn.getMenuItems("inn_broken_lantern", "drink");
      expect(drinks).toHaveLength(2);
      expect(drinks.every((d) => d.type === "drink")).toBe(true);
    });

    it("filters to only food items", () => {
      const foods = inn.getMenuItems("inn_broken_lantern", "food");
      expect(foods).toHaveLength(2);
      expect(foods.every((f) => f.type === "food")).toBe(true);
    });

    it("returns an empty array for an unregistered inn", () => {
      expect(inn.getMenuItems("unknown_inn")).toHaveLength(0);
    });
  });

  // ── isOpen ─────────────────────────────────────────────────────────────────

  describe("isOpen", () => {
    beforeEach(() => inn.registerInn(BROKEN_LANTERN));

    it("returns true during open hours", () => {
      expect(inn.isOpen("inn_broken_lantern", 10)).toBe(true);
    });

    it("returns true at exactly openHour", () => {
      expect(inn.isOpen("inn_broken_lantern", 6)).toBe(true);
    });

    it("returns false before openHour", () => {
      expect(inn.isOpen("inn_broken_lantern", 3)).toBe(false);
    });

    it("treats closeHour 24 as open until end of day", () => {
      expect(inn.isOpen("inn_broken_lantern", 23)).toBe(true);
    });

    it("returns false for an unregistered inn", () => {
      expect(inn.isOpen("unknown", 12)).toBe(false);
    });

    it("handles fractional hours by flooring", () => {
      expect(inn.isOpen("inn_broken_lantern", 9.9)).toBe(true);
    });
  });

  // ── rentRoom ───────────────────────────────────────────────────────────────

  describe("rentRoom", () => {
    beforeEach(() => inn.registerInn(BROKEN_LANTERN));

    it("returns success and deducts gold when conditions are met", () => {
      const result = inn.rentRoom("inn_broken_lantern", 12, 50);
      expect(result.success).toBe(true);
      expect(result.cost).toBe(10);
      expect(result.newGold).toBe(40);
    });

    it("fires onRentRoom callback", () => {
      const cb = vi.fn();
      inn.onRentRoom = cb;
      inn.rentRoom("inn_broken_lantern", 12, 50);
      expect(cb).toHaveBeenCalledWith("inn_broken_lantern", 10);
    });

    it("accumulates goldEarned", () => {
      inn.rentRoom("inn_broken_lantern", 12, 50);
      inn.rentRoom("inn_broken_lantern", 14, 50);
      expect(inn.getGoldEarned("inn_broken_lantern")).toBe(20);
    });

    it("fails when inn is not registered", () => {
      const result = inn.rentRoom("unknown_inn", 12, 50);
      expect(result.success).toBe(false);
      expect(result.cost).toBe(0);
      expect(result.newGold).toBe(50);
    });

    it("fails when inn is closed at given hour", () => {
      const result = inn.rentRoom("inn_broken_lantern", 3, 50);
      expect(result.success).toBe(false);
      expect(result.cost).toBe(0);
      expect(result.newGold).toBe(50);
    });

    it("fails when player lacks gold", () => {
      const result = inn.rentRoom("inn_broken_lantern", 12, 5);
      expect(result.success).toBe(false);
      expect(result.reason).toMatch(/gold/i);
    });

    it("succeeds when player has exactly the room price", () => {
      const result = inn.rentRoom("inn_broken_lantern", 12, 10);
      expect(result.success).toBe(true);
      expect(result.newGold).toBe(0);
    });

    it("does not fire callback on failure", () => {
      const cb = vi.fn();
      inn.onRentRoom = cb;
      inn.rentRoom("inn_broken_lantern", 3, 50); // closed
      expect(cb).not.toHaveBeenCalled();
    });

    it("does not change goldEarned on failure", () => {
      inn.rentRoom("inn_broken_lantern", 3, 50); // closed
      expect(inn.getGoldEarned("inn_broken_lantern")).toBe(0);
    });
  });

  // ── purchaseMenuItem ───────────────────────────────────────────────────────

  describe("purchaseMenuItem", () => {
    beforeEach(() => inn.registerInn(BROKEN_LANTERN));

    it("returns success and deducts gold when conditions are met", () => {
      const result = inn.purchaseMenuItem("inn_broken_lantern", "ale", 12, 50);
      expect(result.success).toBe(true);
      expect(result.cost).toBe(2);
      expect(result.newGold).toBe(48);
    });

    it("returns the purchased item on success", () => {
      const result = inn.purchaseMenuItem("inn_broken_lantern", "stew", 12, 50);
      expect(result.item).not.toBeNull();
      expect(result.item!.id).toBe("stew");
    });

    it("fires onPurchaseMenuItem callback", () => {
      const cb = vi.fn();
      inn.onPurchaseMenuItem = cb;
      inn.purchaseMenuItem("inn_broken_lantern", "ale", 12, 50);
      expect(cb).toHaveBeenCalledWith("inn_broken_lantern", expect.objectContaining({ id: "ale" }));
    });

    it("accumulates goldEarned per item purchase", () => {
      inn.purchaseMenuItem("inn_broken_lantern", "ale", 12, 50);
      inn.purchaseMenuItem("inn_broken_lantern", "stew", 12, 50);
      expect(inn.getGoldEarned("inn_broken_lantern")).toBe(6); // 2 + 4
    });

    it("fails for an unregistered inn", () => {
      const result = inn.purchaseMenuItem("unknown", "ale", 12, 50);
      expect(result.success).toBe(false);
      expect(result.item).toBeNull();
    });

    it("fails when the inn is closed", () => {
      const result = inn.purchaseMenuItem("inn_broken_lantern", "ale", 3, 50);
      expect(result.success).toBe(false);
    });

    it("fails for an item not on the menu", () => {
      const result = inn.purchaseMenuItem("inn_broken_lantern", "wine", 12, 50);
      expect(result.success).toBe(false);
      expect(result.reason).toMatch(/not on menu/i);
    });

    it("fails when player lacks gold", () => {
      const result = inn.purchaseMenuItem("inn_broken_lantern", "ale", 12, 1);
      expect(result.success).toBe(false);
      expect(result.reason).toMatch(/gold/i);
    });

    it("succeeds when player has exactly enough gold", () => {
      const result = inn.purchaseMenuItem("inn_broken_lantern", "ale", 12, 2);
      expect(result.success).toBe(true);
      expect(result.newGold).toBe(0);
    });

    it("does not fire callback on failure", () => {
      const cb = vi.fn();
      inn.onPurchaseMenuItem = cb;
      inn.purchaseMenuItem("inn_broken_lantern", "ale", 3, 50); // closed
      expect(cb).not.toHaveBeenCalled();
    });
  });

  // ── getGoldEarned ──────────────────────────────────────────────────────────

  describe("getGoldEarned", () => {
    it("returns 0 for an unregistered inn", () => {
      expect(inn.getGoldEarned("unknown")).toBe(0);
    });

    it("tracks combined room and menu purchases", () => {
      inn.registerInn(BROKEN_LANTERN);
      inn.rentRoom("inn_broken_lantern", 12, 100);
      inn.purchaseMenuItem("inn_broken_lantern", "ale", 12, 100);
      expect(inn.getGoldEarned("inn_broken_lantern")).toBe(12); // 10 + 2
    });
  });

  // ── Persistence ────────────────────────────────────────────────────────────

  describe("getSaveState / restoreFromSave", () => {
    it("round-trips goldEarned through save/restore", () => {
      inn.registerInn(BROKEN_LANTERN);
      inn.rentRoom("inn_broken_lantern", 12, 100);
      inn.purchaseMenuItem("inn_broken_lantern", "mead", 12, 100);

      const state = inn.getSaveState();

      const restored = new InnSystem();
      restored.registerInn(BROKEN_LANTERN);
      restored.restoreFromSave(state);

      expect(restored.getGoldEarned("inn_broken_lantern")).toBe(13); // 10 + 3
    });

    it("includes all registered inns in the save state", () => {
      inn.registerInn(BROKEN_LANTERN);
      inn.registerInn(NIGHT_OWL_INN);
      const state = inn.getSaveState();
      expect(state.inns).toHaveLength(2);
      expect(state.inns.map((i) => i.id)).toContain("inn_broken_lantern");
      expect(state.inns.map((i) => i.id)).toContain("inn_night_owl");
    });

    it("ignores restore data for unregistered inns", () => {
      const state: InnSaveState = { inns: [{ id: "ghost_inn", goldEarned: 500 }] };
      inn.restoreFromSave(state); // should not throw
      expect(inn.getGoldEarned("ghost_inn")).toBe(0);
    });

    it("ignores negative goldEarned in save data", () => {
      inn.registerInn(BROKEN_LANTERN);
      const state: InnSaveState = { inns: [{ id: "inn_broken_lantern", goldEarned: -50 }] };
      inn.restoreFromSave(state);
      // Negative value is rejected; goldEarned stays 0
      expect(inn.getGoldEarned("inn_broken_lantern")).toBe(0);
    });

    it("handles null/undefined save state gracefully", () => {
      inn.registerInn(BROKEN_LANTERN);
      expect(() => inn.restoreFromSave(null as unknown as InnSaveState)).not.toThrow();
      expect(() => inn.restoreFromSave(undefined as unknown as InnSaveState)).not.toThrow();
    });
  });
});
