import { describe, expect, it, vi } from "vitest";
import { BarterSystem } from "../systems/barter-system";
import { MerchantRestockSystem } from "../systems/merchant-restock-system";
import type { InventorySystem } from "../systems/inventory-system";
import { STARTER_MERCHANTS, baseMerchantId, branchMerchant } from "./starter-merchants";

const ui = { showNotification: vi.fn() } as never;
const inv = { items: [], addItem: () => true, removeItem: () => true } as unknown as InventorySystem;

describe("branch shops (each village its own)", () => {
  it("a village's branch has fresh shelves and purse, apart from the base shop's", () => {
    const barter = new BarterSystem(inv, ui);
    const restock = new MerchantRestockSystem();
    const base = STARTER_MERCHANTS[0];
    const a = branchMerchant(barter, restock, base.id, "village_1_2", 0);
    const b = branchMerchant(barter, restock, base.id, "village_5_-3", 0);
    expect(a).toBe(`${base.id}@village_1_2`);
    expect(baseMerchantId(a)).toBe(base.id);
    expect(branchMerchant(barter, restock, base.id, "village_1_2", 0), "the same branch the second time").toBe(a);
    barter.getMerchant(a)!.gold = 1;
    expect(barter.getMerchant(b)!.gold).toBe(base.gold);
    expect(branchMerchant(barter, restock, "nobody", "village_1_2", 0)).toBe("nobody");
  });

  it("a saved branch gets its shelves back when first visited after a load, and survives another save before that", () => {
    const barter = new BarterSystem(inv, ui);
    const restock = new MerchantRestockSystem();
    const base = STARTER_MERCHANTS[0];
    const id = branchMerchant(barter, restock, base.id, "village_1_2", 0);
    barter.getMerchant(id)!.gold = 77;
    const saved = barter.getSaveState();

    const later = new BarterSystem(inv, ui);
    later.restoreFromSave(saved);
    const resaved = later.getSaveState();
    expect(resaved.merchants.find((m) => m.id === id)?.gold, "kept while unvisited").toBe(77);
    branchMerchant(later, new MerchantRestockSystem(), base.id, "village_1_2", 0);
    expect(later.getMerchant(id)!.gold).toBe(77);
  });
});
