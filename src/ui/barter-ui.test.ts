// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { BarterUI } from "./barter-ui";
import type { BarterSystem, MerchantDef } from "../systems/barter-system";
import type { Item } from "../systems/inventory-system";

// ── Fixtures ───────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: "iron_sword",
    name: "Iron Sword",
    description: "A sturdy sword.",
    stackable: false,
    quantity: 1,
    weight: 3,
    stats: { value: 80 },
    ...overrides,
  } as Item;
}

function makePotion(overrides: Partial<Item> = {}): Item {
  return {
    id: "health_potion",
    name: "Health Potion",
    description: "Restores 50 HP.",
    stackable: true,
    quantity: 3,
    weight: 0.3,
    stats: { value: 25 },
    ...overrides,
  } as Item;
}

function makeMerchant(overrides: Partial<MerchantDef> = {}): MerchantDef {
  return {
    id: "trader_01",
    name: "Geralt the Trader",
    factionId: "town",
    inventory: [makePotion()],
    gold: 500,
    priceMultiplier: 1.0,
    isOpen: true,
    openHour: 8,
    closeHour: 20,
    ...overrides,
  };
}

/** Minimal BarterSystem stub sufficient for BarterUI tests. */
function makeSystem(overrides: Partial<BarterSystem> = {}): BarterSystem {
  const merchant = makeMerchant();
  return {
    activeMerchantId: "trader_01",
    playerGold: 200,
    barterSkill: 20,
    getMerchant: vi.fn((_id: string) => merchant),
    getBuyPrice: vi.fn((_item: Item, _merchantId: string) => 30),
    getSellPrice: vi.fn((_item: Item, _merchantId?: string) => 15),
    openBarter: vi.fn(() => true),
    closeBarter: vi.fn(),
    buyItem: vi.fn(() => true),
    sellItem: vi.fn(() => true),
    ...overrides,
  } as unknown as BarterSystem;
}

const PLAYER_ITEMS: Item[] = [makeItem(), makePotion({ id: "hp2", name: "Stamina Potion" })];

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("BarterUI", () => {
  let ui: BarterUI;

  beforeEach(() => {
    document.body.innerHTML = "";
    ui = new BarterUI();
  });

  // ── show() / hide() ──────────────────────────────────────────────────────────

  describe("show()", () => {
    it("creates the root DOM element", () => {
      ui.show();
      expect(document.querySelector(".barter-ui")).not.toBeNull();
    });

    it("sets isVisible to true", () => {
      ui.show();
      expect(ui.isVisible).toBe(true);
    });

    it("renders with display flex", () => {
      ui.show();
      const root = document.querySelector(".barter-ui") as HTMLElement;
      expect(root.style.display).toBe("flex");
    });

    it("creates the DOM only once on repeated calls", () => {
      ui.show();
      ui.show();
      expect(document.querySelectorAll(".barter-ui").length).toBe(1);
    });

    it("root has role=dialog", () => {
      ui.show();
      const root = document.querySelector(".barter-ui");
      expect(root?.getAttribute("role")).toBe("dialog");
    });

    it("root has aria-modal=true", () => {
      ui.show();
      const root = document.querySelector(".barter-ui");
      expect(root?.getAttribute("aria-modal")).toBe("true");
    });

    it("root has an aria-label", () => {
      ui.show();
      const root = document.querySelector(".barter-ui");
      expect(root?.getAttribute("aria-label")).toBeTruthy();
    });
  });

  describe("hide()", () => {
    it("sets isVisible to false", () => {
      ui.show();
      ui.hide();
      expect(ui.isVisible).toBe(false);
    });

    it("hides the root element", () => {
      ui.show();
      ui.hide();
      const root = document.querySelector(".barter-ui") as HTMLElement;
      expect(root.style.display).toBe("none");
    });

    it("does not throw when called before show()", () => {
      expect(() => ui.hide()).not.toThrow();
    });
  });

  // ── close button ──────────────────────────────────────────────────────────────

  describe("close button", () => {
    it("hides the panel when clicked", () => {
      ui.show();
      const closeBtn = document.querySelector<HTMLButtonElement>(".barter-ui__close");
      closeBtn?.click();
      expect(ui.isVisible).toBe(false);
    });

    it("fires onClose callback when clicked", () => {
      const onClose = vi.fn();
      ui.onClose = onClose;
      ui.show();
      const closeBtn = document.querySelector<HTMLButtonElement>(".barter-ui__close");
      closeBtn?.click();
      expect(onClose).toHaveBeenCalledOnce();
    });

    it("has an aria-label", () => {
      ui.show();
      const closeBtn = document.querySelector(".barter-ui__close");
      expect(closeBtn?.getAttribute("aria-label")).toBeTruthy();
    });
  });

  // ── update() — title ──────────────────────────────────────────────────────────

  describe("update() — title", () => {
    it("shows the merchant name in the title", () => {
      ui.show();
      ui.update(makeSystem(), PLAYER_ITEMS);
      const title = document.querySelector(".barter-ui__title");
      expect(title?.textContent).toBe("Geralt the Trader");
    });

    it("falls back to 'Merchant' when no active merchant", () => {
      ui.show();
      const sys = makeSystem({ activeMerchantId: null });
      ui.update(sys, PLAYER_ITEMS);
      const title = document.querySelector(".barter-ui__title");
      expect(title?.textContent).toBe("Merchant");
    });
  });

  // ── update() — merchant column ────────────────────────────────────────────────

  describe("update() — merchant column", () => {
    it("renders a column heading 'Merchant's Goods'", () => {
      ui.show();
      ui.update(makeSystem(), []);
      const headings = Array.from(document.querySelectorAll(".barter-ui__col-title"))
        .map((el) => el.textContent);
      expect(headings).toContain("Merchant's Goods");
    });

    it("renders a row for each merchant item", () => {
      ui.show();
      ui.update(makeSystem(), []);
      const merchantList = document.querySelector("[aria-label='Merchant inventory']");
      const rows = merchantList?.querySelectorAll(".barter-ui__item-row") ?? [];
      expect(rows.length).toBe(1);
    });

    it("displays item name in merchant row", () => {
      ui.show();
      ui.update(makeSystem(), []);
      const row = document.querySelector<HTMLElement>("[aria-label='Merchant inventory'] .barter-ui__item-row");
      expect(row?.querySelector(".barter-ui__item-name")?.textContent).toBe("Health Potion");
    });

    it("displays buy price in merchant row", () => {
      ui.show();
      ui.update(makeSystem(), []);
      const row = document.querySelector<HTMLElement>("[aria-label='Merchant inventory'] .barter-ui__item-row");
      const priceEl = row?.querySelector(".barter-ui__item-price");
      expect(priceEl?.textContent).toContain("30");
    });

    it("shows a Buy button for each merchant item", () => {
      ui.show();
      ui.update(makeSystem(), []);
      const merchantList = document.querySelector("[aria-label='Merchant inventory']");
      const btns = merchantList?.querySelectorAll(".barter-ui__action-btn--buy") ?? [];
      expect(btns.length).toBe(1);
    });

    it("shows 'Nothing for sale.' when merchant inventory is empty", () => {
      const sys = makeSystem();
      (sys.getMerchant as ReturnType<typeof vi.fn>).mockReturnValue(
        makeMerchant({ inventory: [] }),
      );
      ui.show();
      ui.update(sys, []);
      const merchantList = document.querySelector("[aria-label='Merchant inventory']");
      expect(merchantList?.textContent).toContain("Nothing for sale.");
    });

    it("shows 'No merchant active.' when activeMerchantId is null", () => {
      ui.show();
      const sys = makeSystem({ activeMerchantId: null });
      ui.update(sys, []);
      const merchantList = document.querySelector("[aria-label='Merchant inventory']");
      expect(merchantList?.textContent).toContain("No merchant active.");
    });

    it("shows quantity badge for stackable items with quantity > 1", () => {
      ui.show();
      ui.update(makeSystem(), []);
      const qty = document.querySelector("[aria-label='Merchant inventory'] .barter-ui__item-qty");
      expect(qty?.textContent).toBe("×3");
    });

    it("disables Buy button when player cannot afford the item", () => {
      const sys = makeSystem({ playerGold: 0 });
      ui.show();
      ui.update(sys, []);
      const btn = document.querySelector<HTMLButtonElement>(
        "[aria-label='Merchant inventory'] .barter-ui__action-btn--buy",
      );
      expect(btn?.disabled).toBe(false);
      expect(btn?.style.opacity).toBe("0.5");
      expect(btn?.style.cursor).toBe("not-allowed");
    });

    it("enables Buy button when player can afford the item", () => {
      const sys = makeSystem({ playerGold: 500 });
      ui.show();
      ui.update(sys, []);
      const btn = document.querySelector<HTMLButtonElement>(
        "[aria-label='Merchant inventory'] .barter-ui__action-btn--buy",
      );
      expect(btn?.disabled).toBe(false);
      expect(btn?.style.opacity).toBe("");
      expect(btn?.style.cursor).toBe("");
    });

    it("Buy button has aria-disabled=false when affordable", () => {
      const sys = makeSystem({ playerGold: 500 });
      ui.show();
      ui.update(sys, []);
      const btn = document.querySelector(
        "[aria-label='Merchant inventory'] .barter-ui__action-btn--buy",
      );
      expect(btn?.getAttribute("aria-disabled")).toBe("false");
    });

    it("Buy button has aria-disabled=true when unaffordable", () => {
      const sys = makeSystem({ playerGold: 0 });
      ui.show();
      ui.update(sys, []);
      const btn = document.querySelector(
        "[aria-label='Merchant inventory'] .barter-ui__action-btn--buy",
      );
      expect(btn?.getAttribute("aria-disabled")).toBe("true");
    });
  });

  // ── update() — player column ──────────────────────────────────────────────────

  describe("update() — player column", () => {
    it("renders a column heading 'Your Inventory'", () => {
      ui.show();
      ui.update(makeSystem(), PLAYER_ITEMS);
      const headings = Array.from(document.querySelectorAll(".barter-ui__col-title"))
        .map((el) => el.textContent);
      expect(headings).toContain("Your Inventory");
    });

    it("renders a row for each player item", () => {
      ui.show();
      ui.update(makeSystem(), PLAYER_ITEMS);
      const playerList = document.querySelector("[aria-label='Player inventory']");
      const rows = playerList?.querySelectorAll(".barter-ui__item-row") ?? [];
      expect(rows.length).toBe(2);
    });

    it("displays item name in player row", () => {
      ui.show();
      ui.update(makeSystem(), [makeItem()]);
      const row = document.querySelector<HTMLElement>("[aria-label='Player inventory'] .barter-ui__item-row");
      expect(row?.querySelector(".barter-ui__item-name")?.textContent).toBe("Iron Sword");
    });

    it("displays sell price in player row", () => {
      ui.show();
      ui.update(makeSystem(), [makeItem()]);
      const row = document.querySelector<HTMLElement>("[aria-label='Player inventory'] .barter-ui__item-row");
      const priceEl = row?.querySelector(".barter-ui__item-price");
      expect(priceEl?.textContent).toContain("15");
    });

    it("shows a Sell button for each player item", () => {
      ui.show();
      ui.update(makeSystem(), [makeItem()]);
      const playerList = document.querySelector("[aria-label='Player inventory']");
      const btns = playerList?.querySelectorAll(".barter-ui__action-btn--sell") ?? [];
      expect(btns.length).toBe(1);
    });

    it("shows 'Inventory empty.' when player has no items", () => {
      ui.show();
      ui.update(makeSystem(), []);
      const playerList = document.querySelector("[aria-label='Player inventory']");
      expect(playerList?.textContent).toContain("Inventory empty.");
    });

    it("item row has role=listitem", () => {
      ui.show();
      ui.update(makeSystem(), [makeItem()]);
      const row = document.querySelector("[aria-label='Player inventory'] .barter-ui__item-row");
      expect(row?.getAttribute("role")).toBe("listitem");
    });

    it("item row has data-item-id", () => {
      ui.show();
      ui.update(makeSystem(), [makeItem({ id: "my_sword" })]);
      const row = document.querySelector("[aria-label='Player inventory'] .barter-ui__item-row");
      expect(row?.getAttribute("data-item-id")).toBe("my_sword");
    });

    it("price element has aria-label with gold amount", () => {
      ui.show();
      ui.update(makeSystem(), [makeItem()]);
      const priceEl = document.querySelector(
        "[aria-label='Player inventory'] .barter-ui__item-price",
      );
      expect(priceEl?.getAttribute("aria-label")).toBeTruthy();
    });
  });

  // ── update() — gold footer ────────────────────────────────────────────────────

  describe("update() — gold footer", () => {
    it("shows merchant gold", () => {
      ui.show();
      ui.update(makeSystem(), []);
      const mg = document.querySelector(".barter-ui__gold--merchant");
      expect(mg?.textContent).toContain("500");
    });

    it("shows player gold", () => {
      ui.show();
      ui.update(makeSystem(), []);
      const pg = document.querySelector(".barter-ui__gold--player");
      expect(pg?.textContent).toContain("200");
    });

    it("merchant gold element has aria-label", () => {
      ui.show();
      ui.update(makeSystem(), []);
      const mg = document.querySelector(".barter-ui__gold--merchant");
      expect(mg?.getAttribute("aria-label")).toBeTruthy();
    });

    it("player gold element has aria-label", () => {
      ui.show();
      ui.update(makeSystem(), []);
      const pg = document.querySelector(".barter-ui__gold--player");
      expect(pg?.getAttribute("aria-label")).toBeTruthy();
    });

    it("shows 0 for merchant gold when no active merchant", () => {
      ui.show();
      const sys = makeSystem({ activeMerchantId: null });
      ui.update(sys, []);
      const mg = document.querySelector(".barter-ui__gold--merchant");
      expect(mg?.textContent).toContain("0");
    });
  });

  // ── callbacks ─────────────────────────────────────────────────────────────────

  describe("onBuy callback", () => {
    it("fires onBuy with item id when Buy button clicked", () => {
      const onBuy = vi.fn();
      ui.onBuy = onBuy;
      ui.show();
      ui.update(makeSystem({ playerGold: 500 }), []);
      const btn = document.querySelector<HTMLButtonElement>(
        "[aria-label='Merchant inventory'] .barter-ui__action-btn--buy",
      );
      btn?.click();
      expect(onBuy).toHaveBeenCalledWith("health_potion");
    });

    it("does not fire onBuy when button is disabled", () => {
      const onBuy = vi.fn();
      ui.onBuy = onBuy;
      ui.show();
      ui.update(makeSystem({ playerGold: 0 }), []);
      const btn = document.querySelector<HTMLButtonElement>(
        "[aria-label='Merchant inventory'] .barter-ui__action-btn--buy",
      );
      btn?.click();
      expect(onBuy).not.toHaveBeenCalled();
    });
  });

  describe("onSell callback", () => {
    it("fires onSell with item id when Sell button clicked", () => {
      const onSell = vi.fn();
      ui.onSell = onSell;
      ui.show();
      ui.update(makeSystem(), [makeItem({ id: "my_sword" })]);
      const btn = document.querySelector<HTMLButtonElement>(
        "[aria-label='Player inventory'] .barter-ui__action-btn--sell",
      );
      btn?.click();
      expect(onSell).toHaveBeenCalledWith("my_sword");
    });
  });

  // ── re-render on subsequent update() ──────────────────────────────────────────

  describe("re-renders on update()", () => {
    it("updates merchant name on second call", () => {
      ui.show();
      const sys1 = makeSystem();
      (sys1.getMerchant as ReturnType<typeof vi.fn>).mockReturnValue(
        makeMerchant({ name: "First Trader" }),
      );
      ui.update(sys1, []);

      const sys2 = makeSystem();
      (sys2.getMerchant as ReturnType<typeof vi.fn>).mockReturnValue(
        makeMerchant({ name: "Second Trader" }),
      );
      ui.update(sys2, []);

      const title = document.querySelector(".barter-ui__title");
      expect(title?.textContent).toBe("Second Trader");
    });

    it("updates player gold on second call", () => {
      ui.show();
      ui.update(makeSystem({ playerGold: 100 }), []);
      ui.update(makeSystem({ playerGold: 250 }), []);
      const pg = document.querySelector(".barter-ui__gold--player");
      expect(pg?.textContent).toContain("250");
    });

    it("does not duplicate columns on repeated update()", () => {
      ui.show();
      ui.update(makeSystem(), []);
      ui.update(makeSystem(), []);
      expect(document.querySelectorAll(".barter-ui__col").length).toBe(2);
    });

    it("clears and rebuilds merchant list on each update()", () => {
      ui.show();
      const sys = makeSystem();
      (sys.getMerchant as ReturnType<typeof vi.fn>).mockReturnValue(
        makeMerchant({ inventory: [makePotion()] }),
      );
      ui.update(sys, []);
      expect(
        document.querySelectorAll("[aria-label='Merchant inventory'] .barter-ui__item-row").length,
      ).toBe(1);

      (sys.getMerchant as ReturnType<typeof vi.fn>).mockReturnValue(
        makeMerchant({ inventory: [makePotion(), makeItem()] }),
      );
      ui.update(sys, []);
      expect(
        document.querySelectorAll("[aria-label='Merchant inventory'] .barter-ui__item-row").length,
      ).toBe(2);
    });
  });

  // ── merchant inventory list accessibility ──────────────────────────────────────

  describe("accessibility", () => {
    it("merchant inventory list has role=list", () => {
      ui.show();
      const list = document.querySelector("[aria-label='Merchant inventory']");
      expect(list?.getAttribute("role")).toBe("list");
    });

    it("player inventory list has role=list", () => {
      ui.show();
      const list = document.querySelector("[aria-label='Player inventory']");
      expect(list?.getAttribute("role")).toBe("list");
    });

    it("merchant list has aria-label", () => {
      ui.show();
      const list = document.querySelector(".barter-ui__item-list");
      expect(list?.getAttribute("aria-label")).toBeTruthy();
    });
  });

  // ── destroy() ─────────────────────────────────────────────────────────────────

  describe("destroy()", () => {
    it("removes the root element from the DOM", () => {
      ui.show();
      ui.destroy();
      expect(document.querySelector(".barter-ui")).toBeNull();
    });

    it("sets isVisible to false", () => {
      ui.show();
      ui.destroy();
      expect(ui.isVisible).toBe(false);
    });

    it("does not throw when called before show()", () => {
      expect(() => ui.destroy()).not.toThrow();
    });

    it("allows show() to create fresh DOM after destroy()", () => {
      ui.show();
      ui.destroy();
      ui.show();
      expect(document.querySelector(".barter-ui")).not.toBeNull();
      expect(ui.isVisible).toBe(true);
    });
  });
});
