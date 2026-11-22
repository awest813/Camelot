import { describe, it, expect, vi } from "vitest";
import { BarterSystem } from "../systems/barter-system";
import { MerchantRestockSystem } from "../systems/merchant-restock-system";
import { ShopSystem } from "../systems/shop-system";
import { registerStarterMerchants, STARTER_MERCHANTS, RESTOCK_HOURS } from "./starter-merchants";

function setup() {
  const inventory = { items: [], addItem: () => true, removeItem: () => true, removeQuantity: () => true };
  const barter = new BarterSystem(inventory as never, { showNotification: vi.fn() } as never);
  const restock = new MerchantRestockSystem();
  const shops = new ShopSystem();
  registerStarterMerchants(barter, restock, shops, 0);
  return { barter, restock, shops };
}

const ids = (items: Array<{ id: string; quantity: number }>) => items.map((i) => `${i.id}×${i.quantity}`).sort();

describe("starter merchants", () => {
  it("a restock brings back exactly the opening stock (the general store keeps its food)", () => {
    const t = setup();
    const opening = new Map(STARTER_MERCHANTS.map((m) => [m.id, ids(t.barter.getMerchant(m.id)!.inventory)]));
    for (const m of STARTER_MERCHANTS) t.barter.getMerchant(m.id)!.inventory.length = 0;
    t.restock.update((RESTOCK_HOURS + 1) * 60, t.barter);
    for (const m of STARTER_MERCHANTS) {
      expect(ids(t.barter.getMerchant(m.id)!.inventory), m.id).toEqual(opening.get(m.id));
    }
    expect(opening.get("merchant_general_01")).toEqual(expect.arrayContaining(["bread×6", "ale×6", "stew×4"]));
  });

  it("selling from a shelf doesn't eat into the restock template", () => {
    const t = setup();
    t.barter.getMerchant("merchant_01")!.inventory[0].quantity = 0;
    t.restock.update((RESTOCK_HOURS + 1) * 60, t.barter);
    expect(t.barter.getMerchant("merchant_01")!.inventory[0].quantity).toBe(5);
  });

  it("every merchant has its shop", () => {
    const t = setup();
    for (const m of STARTER_MERCHANTS) {
      expect(t.shops.getAllShops().filter((s) => s.merchantId === m.id), m.id).toHaveLength(1);
    }
  });
});
