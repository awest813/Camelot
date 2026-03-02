import { describe, it, expect } from "vitest";
import { InventoryEngine } from "./inventory-engine";
import { ItemDefinition } from "./inventory-types";

const ITEM_DEFS: ItemDefinition[] = [
  {
    id: "iron_sword",
    name: "Iron Sword",
    description: "Sword",
    stackable: false,
    slot: "mainHand",
  },
  {
    id: "health_potion",
    name: "Health Potion",
    description: "Potion",
    stackable: true,
    maxStack: 10,
  },
];

describe("InventoryEngine", () => {
  it("adds stackable items to one slot", () => {
    const inventory = new InventoryEngine(ITEM_DEFS, 3);
    expect(inventory.addItem("health_potion", 3).success).toBe(true);
    expect(inventory.addItem("health_potion", 2).success).toBe(true);
    expect(inventory.getItemCount("health_potion")).toBe(5);
    expect(inventory.getSnapshot().items).toHaveLength(1);
  });

  it("respects capacity for non-stackable items", () => {
    const inventory = new InventoryEngine(ITEM_DEFS, 1);
    expect(inventory.addItem("iron_sword", 1).success).toBe(true);
    const result = inventory.addItem("iron_sword", 1);
    expect(result.success).toBe(false);
    expect(result.reason).toBe("CAPACITY_EXCEEDED");
  });

  it("equips and unequips an item", () => {
    const inventory = new InventoryEngine(ITEM_DEFS, 4);
    inventory.addItem("iron_sword", 1);

    const equip = inventory.equipItem("iron_sword", "mainHand");
    expect(equip.success).toBe(true);
    expect(inventory.getItemCount("iron_sword")).toBe(0);
    expect(inventory.getSnapshot().equipped.mainHand).toBe("iron_sword");

    const unequip = inventory.unequipSlot("mainHand");
    expect(unequip.success).toBe(true);
    expect(inventory.getItemCount("iron_sword")).toBe(1);
    expect(inventory.getSnapshot().equipped.mainHand).toBeUndefined();
  });
});
