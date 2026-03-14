// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { StableUI, type StableHorseView } from "./stable-ui";

function makeHorse(overrides: Partial<StableHorseView> = {}): StableHorseView {
  return {
    id: "bay_mare",
    name: "Bay Mare",
    speed: 1.8,
    saddlebagCapacity: 8,
    price: 500,
    isOwned: false,
    ...overrides,
  };
}

describe("StableUI", () => {
  let ui: StableUI;

  beforeEach(() => {
    document.body.innerHTML = "";
    ui = new StableUI();
  });

  describe("open()", () => {
    it("makes the dialog visible", () => {
      ui.open("Stable Master", [makeHorse()], 1000);
      expect(ui.isVisible).toBe(true);
      const root = document.querySelector(".stable") as HTMLElement;
      expect(root).not.toBeNull();
      expect(root.style.display).toBe("grid");
    });

    it("shows the NPC name in the title", () => {
      ui.open("Old Thomas", [makeHorse()], 500);
      const title = document.querySelector(".stable__npc-line");
      expect(title?.textContent).toContain("Old Thomas");
    });

    it("displays the player gold amount", () => {
      ui.open("Stable Master", [makeHorse()], 750);
      const gold = document.querySelector(".stable__gold");
      expect(gold?.textContent).toContain("750g");
    });

    it("renders a row for each horse", () => {
      const horses = [
        makeHorse({ id: "bay_mare", name: "Bay Mare" }),
        makeHorse({ id: "black_stallion", name: "Black Stallion", price: 800 }),
      ];
      ui.open("Stable Master", horses, 1000);
      const rows = document.querySelectorAll(".stable__row");
      expect(rows.length).toBe(2);
    });

    it("renders an empty message when no horses available", () => {
      ui.open("Stable Master", [], 500);
      const empty = document.querySelector(".stable__empty");
      expect(empty).not.toBeNull();
    });

    it("disables the purchase button when no horses available", () => {
      ui.open("Stable Master", [], 500);
      const btn = document.querySelector(".stable__btn--primary") as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it("selects the first unowned horse by default", () => {
      const horses = [
        makeHorse({ id: "bay_mare", isOwned: true }),
        makeHorse({ id: "black_stallion", name: "Black Stallion", isOwned: false }),
      ];
      ui.open("Stable Master", horses, 1000);
      const rows = document.querySelectorAll(".stable__row");
      expect(rows[1].classList.contains("is-selected")).toBe(true);
    });

    it("sets role=dialog on root element", () => {
      ui.open("Stable Master", [makeHorse()], 500);
      const root = document.querySelector(".stable");
      expect(root?.getAttribute("role")).toBe("dialog");
    });

    it("sets aria-modal=true", () => {
      ui.open("Stable Master", [makeHorse()], 500);
      const root = document.querySelector(".stable");
      expect(root?.getAttribute("aria-modal")).toBe("true");
    });
  });

  describe("close()", () => {
    it("hides the dialog", () => {
      ui.open("Stable Master", [makeHorse()], 500);
      ui.close();
      expect(ui.isVisible).toBe(false);
      const root = document.querySelector(".stable") as HTMLElement;
      expect(root.style.display).toBe("none");
    });

    it("fires the onClose callback", () => {
      const onClose = vi.fn();
      ui.onClose = onClose;
      ui.open("Stable Master", [makeHorse()], 500);
      ui.close();
      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  describe("horse selection", () => {
    it("marks the selected row with is-selected class", () => {
      const horses = [
        makeHorse({ id: "bay_mare", name: "Bay Mare" }),
        makeHorse({ id: "black_stallion", name: "Black Stallion", price: 800 }),
      ];
      ui.open("Stable Master", horses, 1000);
      const rows = document.querySelectorAll(".stable__row") as NodeListOf<HTMLButtonElement>;
      // First row is selected by default
      expect(rows[0].classList.contains("is-selected")).toBe(true);
      // Click second row to select it
      rows[1].click();
      const updatedRows = document.querySelectorAll(".stable__row") as NodeListOf<HTMLButtonElement>;
      expect(updatedRows[1].classList.contains("is-selected")).toBe(true);
      expect(updatedRows[0].classList.contains("is-selected")).toBe(false);
    });

    it("marks owned rows with is-owned class", () => {
      const horses = [makeHorse({ id: "bay_mare", isOwned: true })];
      ui.open("Stable Master", horses, 500);
      const rows = document.querySelectorAll(".stable__row");
      expect(rows[0].classList.contains("is-owned")).toBe(true);
    });

    it("shows 'Owned' text in stats for owned horses", () => {
      const horses = [makeHorse({ id: "bay_mare", isOwned: true })];
      ui.open("Stable Master", horses, 500);
      const stats = document.querySelector(".stable__row-stats");
      expect(stats?.textContent).toBe("Owned");
    });

    it("disables owned horse rows", () => {
      const horses = [makeHorse({ id: "bay_mare", isOwned: true })];
      ui.open("Stable Master", horses, 500);
      const row = document.querySelector(".stable__row") as HTMLButtonElement;
      expect(row.disabled).toBe(true);
    });
  });

  describe("purchase button", () => {
    it("enables the purchase button when player can afford selected horse", () => {
      ui.open("Stable Master", [makeHorse({ price: 500 })], 1000);
      const btn = document.querySelector(".stable__btn--primary") as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });

    it("disables the purchase button when player cannot afford selected horse", () => {
      ui.open("Stable Master", [makeHorse({ price: 500 })], 100);
      const btn = document.querySelector(".stable__btn--primary") as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it("disables the purchase button when selected horse is already owned", () => {
      ui.open("Stable Master", [makeHorse({ isOwned: true })], 1000);
      const btn = document.querySelector(".stable__btn--primary") as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });
  });

  describe("onPurchase callback", () => {
    it("fires with the selected horse id when purchase is clicked", () => {
      const onPurchase = vi.fn();
      ui.onPurchase = onPurchase;
      ui.open("Stable Master", [makeHorse({ id: "bay_mare", price: 500 })], 1000);
      const btn = document.querySelector(".stable__btn--primary") as HTMLButtonElement;
      btn.click();
      expect(onPurchase).toHaveBeenCalledOnce();
      expect(onPurchase).toHaveBeenCalledWith("bay_mare");
    });

    it("does not fire when the player cannot afford the horse", () => {
      const onPurchase = vi.fn();
      ui.onPurchase = onPurchase;
      ui.open("Stable Master", [makeHorse({ price: 500 })], 100);
      (ui as any)._handlePurchase();
      expect(onPurchase).not.toHaveBeenCalled();
    });
  });

  describe("setPlayerGold()", () => {
    it("updates the displayed gold amount", () => {
      ui.open("Stable Master", [makeHorse()], 500);
      ui.setPlayerGold(750);
      const gold = document.querySelector(".stable__gold");
      expect(gold?.textContent).toContain("750g");
    });

    it("refreshes the purchase button state", () => {
      ui.open("Stable Master", [makeHorse({ price: 600 })], 500);
      const btn = document.querySelector(".stable__btn--primary") as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
      ui.setPlayerGold(700);
      expect(btn.disabled).toBe(false);
    });
  });

  describe("markOwned()", () => {
    it("marks the horse as owned and re-renders", () => {
      ui.open("Stable Master", [makeHorse({ id: "bay_mare", isOwned: false })], 1000);
      ui.markOwned("bay_mare");
      const rows = document.querySelectorAll(".stable__row");
      expect(rows[0].classList.contains("is-owned")).toBe(true);
    });
  });

  describe("showStatus()", () => {
    it("displays the status message", () => {
      ui.open("Stable Master", [makeHorse()], 500);
      ui.showStatus("Not enough gold.");
      const status = document.querySelector(".stable__status");
      expect(status?.textContent).toBe("Not enough gold.");
    });

    it("adds error class when isError is true", () => {
      ui.open("Stable Master", [makeHorse()], 500);
      ui.showStatus("Error!", true);
      const status = document.querySelector(".stable__status");
      expect(status?.classList.contains("stable__status--error")).toBe(true);
    });

    it("adds ok class when isError is false", () => {
      ui.open("Stable Master", [makeHorse()], 500);
      ui.showStatus("Success!", false);
      const status = document.querySelector(".stable__status");
      expect(status?.classList.contains("stable__status--ok")).toBe(true);
    });
  });
});
