import { describe, it, expect, beforeEach } from "vitest";
import { QuickSlotSystem, QUICK_SLOT_KEYS, isConsumableItem } from "./quickslot-system";
import type { QuickSlotKey } from "./quickslot-system";
import type { Item } from "./inventory-system";

// ── Minimal stubs ─────────────────────────────────────────────────────────────

function makePlayer(health = 50, magicka = 50, stamina = 50) {
  return {
    health,
    maxHealth:  100,
    magicka,
    maxMagicka: 100,
    stamina,
    maxStamina: 100,
  } as any;
}

function makeInventory(items: Item[] = []) {
  const removed: Array<{ id: string; amount: number }> = [];
  return {
    items,
    removeItem(id: string, amount: number) {
      removed.push({ id, amount });
      const idx = items.findIndex((i) => i.id === id);
      if (idx !== -1) {
        items[idx].quantity -= amount;
        if (items[idx].quantity <= 0) items.splice(idx, 1);
      }
      return true;
    },
    _removed: removed,
  } as any;
}

function makeUI() {
  const notes: string[] = [];
  return {
    showNotification: (msg: string) => notes.push(msg),
    notifications: notes,
  } as any;
}

function makeHealPotion(id = "potion_hp_01", qty = 3): Item {
  return {
    id,
    name: "Health Potion",
    description: "Restores 50 HP.",
    stackable: true,
    quantity: qty,
    stats: { heal: 50, value: 25 },
  };
}

function makeMagickaPotion(id = "potion_mp_01", qty = 2): Item {
  return {
    id,
    name: "Magicka Potion",
    description: "Restores 40 Magicka.",
    stackable: true,
    quantity: qty,
    stats: { magicka: 40, value: 25 },
  };
}

function makeStaminaPotion(id = "potion_sp_01", qty = 2): Item {
  return {
    id,
    name: "Stamina Potion",
    description: "Restores 30 Stamina.",
    stackable: true,
    quantity: qty,
    stats: { stamina: 30, value: 20 },
  };
}

function makeWeapon(id = "sword_01"): Item {
  return {
    id,
    name: "Iron Sword",
    description: "A sword.",
    stackable: false,
    quantity: 1,
    slot: "mainHand",
    stats: { damage: 10, value: 80 },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("QuickSlotSystem", () => {
  it("all slots start empty", () => {
    const sys = new QuickSlotSystem(makeInventory(), makePlayer(), makeUI());
    for (const k of QUICK_SLOT_KEYS) {
      expect(sys.getSlotItemId(k)).toBeNull();
    }
  });

  it("bindSlot / getSlotItemId round-trip", () => {
    const sys = new QuickSlotSystem(makeInventory(), makePlayer(), makeUI());
    sys.bindSlot("7", "potion_hp_01");
    expect(sys.getSlotItemId("7")).toBe("potion_hp_01");
    sys.bindSlot("7", null);
    expect(sys.getSlotItemId("7")).toBeNull();
  });

  it("getSlots returns all four keys", () => {
    const sys = new QuickSlotSystem(makeInventory(), makePlayer(), makeUI());
    const slots = sys.getSlots();
    expect(slots.map((s) => s.key)).toEqual(["7", "8", "9", "0"]);
  });

  it("getSlots resolves item reference from inventory", () => {
    const potion = makeHealPotion();
    const sys = new QuickSlotSystem(makeInventory([potion]), makePlayer(), makeUI());
    sys.bindSlot("7", "potion_hp_01");
    const slot7 = sys.getSlots().find((s) => s.key === "7")!;
    expect(slot7.item).not.toBeNull();
    expect(slot7.item?.name).toBe("Health Potion");
  });

  describe("useSlot", () => {
    it("returns false and notifies when slot is empty", () => {
      const ui = makeUI();
      const sys = new QuickSlotSystem(makeInventory(), makePlayer(), ui);
      const result = sys.useSlot("8");
      expect(result).toBe(false);
      expect(ui.notifications.some((n) => n.includes("empty"))).toBe(true);
    });

    it("returns false when item is not in inventory", () => {
      const ui = makeUI();
      const sys = new QuickSlotSystem(makeInventory([]), makePlayer(), ui);
      sys.bindSlot("7", "missing_potion");
      const result = sys.useSlot("7");
      expect(result).toBe(false);
      expect(ui.notifications.some((n) => n.includes("not in inventory"))).toBe(true);
    });

    it("returns false when item is not a consumable", () => {
      const ui  = makeUI();
      const inv = makeInventory([makeWeapon()]);
      const sys = new QuickSlotSystem(inv, makePlayer(), ui);
      sys.bindSlot("7", "sword_01");
      const result = sys.useSlot("7");
      expect(result).toBe(false);
      expect(ui.notifications.some((n) => n.includes("not a consumable"))).toBe(true);
    });

    it("restores health when using a health potion", () => {
      const player = makePlayer(40);
      const inv    = makeInventory([makeHealPotion()]);
      const sys    = new QuickSlotSystem(inv, player, makeUI());
      sys.bindSlot("7", "potion_hp_01");

      const result = sys.useSlot("7");
      expect(result).toBe(true);
      expect(player.health).toBe(90); // 40 + 50
    });

    it("does not overheal past maxHealth", () => {
      const player = makePlayer(80);
      const inv    = makeInventory([makeHealPotion()]);
      const sys    = new QuickSlotSystem(inv, player, makeUI());
      sys.bindSlot("7", "potion_hp_01");
      sys.useSlot("7");
      expect(player.health).toBe(100);
    });

    it("restores magicka from a magicka potion", () => {
      const player = makePlayer(100, 20, 100);
      const inv    = makeInventory([makeMagickaPotion()]);
      const sys    = new QuickSlotSystem(inv, player, makeUI());
      sys.bindSlot("8", "potion_mp_01");
      sys.useSlot("8");
      expect(player.magicka).toBe(60); // 20 + 40
    });

    it("restores stamina from a stamina potion", () => {
      const player = makePlayer(100, 100, 10);
      const inv    = makeInventory([makeStaminaPotion()]);
      const sys    = new QuickSlotSystem(inv, player, makeUI());
      sys.bindSlot("9", "potion_sp_01");
      sys.useSlot("9");
      expect(player.stamina).toBe(40); // 10 + 30
    });

    it("removes one item from inventory after use", () => {
      const potion = makeHealPotion("potion_hp_01", 3);
      const inv    = makeInventory([potion]);
      const sys    = new QuickSlotSystem(inv, makePlayer(50), makeUI());
      sys.bindSlot("7", "potion_hp_01");
      sys.useSlot("7");
      expect(inv._removed).toEqual([{ id: "potion_hp_01", amount: 1 }]);
    });

    it("fires onItemConsumed callback with correct item and source key", () => {
      const potion  = makeHealPotion();
      const inv     = makeInventory([potion]);
      const sys     = new QuickSlotSystem(inv, makePlayer(50), makeUI());
      sys.bindSlot("0", "potion_hp_01");

      const events: Array<{ id: string; source: QuickSlotKey | "inventory" }> = [];
      sys.onItemConsumed = (item, source) => events.push({ id: item.id, source });

      sys.useSlot("0");
      expect(events).toEqual([{ id: "potion_hp_01", source: "0" }]);
    });
  });

  describe("tryConsumeFromInventoryRow", () => {
    it("consumes from inventory and reports inventory source", () => {
      const player = makePlayer(30);
      const inv = makeInventory([makeHealPotion("potion_hp_01", 2)]);
      const sys = new QuickSlotSystem(inv, player, makeUI());
      const events: Array<{ id: string; source: string }> = [];
      sys.onItemConsumed = (item, source) => events.push({ id: item.id, source });
      const row = inv.items[0];
      expect(sys.tryConsumeFromInventoryRow(row)).toBe(true);
      expect(player.health).toBe(80);
      expect(events).toEqual([{ id: "potion_hp_01", source: "inventory" }]);
    });

    it("returns false for non-consumables so host can equip", () => {
      const inv = makeInventory([makeWeapon()]);
      const sys = new QuickSlotSystem(inv, makePlayer(), makeUI());
      expect(sys.tryConsumeFromInventoryRow(inv.items[0])).toBe(false);
    });
  });

  describe("isConsumableItem", () => {
    it("is true when heal/magicka/stamina stat is positive", () => {
      expect(isConsumableItem(makeHealPotion())).toBe(true);
      expect(isConsumableItem(makeWeapon())).toBe(false);
      expect(isConsumableItem({ ...makeHealPotion(), stats: { value: 25 } })).toBe(false);
    });
  });

  describe("getSaveState / restoreFromSave", () => {
    it("round-trips slot bindings", () => {
      const sys = new QuickSlotSystem(makeInventory(), makePlayer(), makeUI());
      sys.bindSlot("7", "potion_hp_01");
      sys.bindSlot("8", "potion_mp_01");

      const saved = sys.getSaveState();
      expect(saved.slots["7"]).toBe("potion_hp_01");
      expect(saved.slots["8"]).toBe("potion_mp_01");
      expect(saved.slots["9"]).toBeNull();
      expect(saved.slots["0"]).toBeNull();

      const sys2 = new QuickSlotSystem(makeInventory(), makePlayer(), makeUI());
      sys2.restoreFromSave(saved);
      expect(sys2.getSlotItemId("7")).toBe("potion_hp_01");
      expect(sys2.getSlotItemId("8")).toBe("potion_mp_01");
      expect(sys2.getSlotItemId("9")).toBeNull();
    });

    it("restoreFromSave handles missing keys gracefully", () => {
      const sys = new QuickSlotSystem(makeInventory(), makePlayer(), makeUI());
      // Provide a partial save (missing "9" and "0")
      sys.restoreFromSave({ slots: { "7": "item_a", "8": null, "9": null, "0": null } });
      expect(sys.getSlotItemId("7")).toBe("item_a");
    });
  });
});
