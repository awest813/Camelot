// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { SaddlebagUI, type SaddlebagItemView } from "./saddlebag-ui";

function makeItem(overrides: Partial<SaddlebagItemView> = {}): SaddlebagItemView {
  return {
    id: "health_potion",
    name: "Health Potion",
    quantity: 1,
    stackable: true,
    ...overrides,
  };
}

describe("SaddlebagUI", () => {
  let ui: SaddlebagUI;

  beforeEach(() => {
    document.body.innerHTML = "";
    ui = new SaddlebagUI();
  });

  describe("open()", () => {
    it("makes the dialog visible", () => {
      ui.open("Shadowmere", [], 0, 10);
      expect(ui.isVisible).toBe(true);
      const root = document.querySelector(".saddlebag") as HTMLElement;
      expect(root).not.toBeNull();
      expect(root.style.display).toBe("grid");
    });

    it("shows the horse name in the title", () => {
      ui.open("Shadowmere", [], 0, 10);
      const title = document.querySelector(".saddlebag__title");
      expect(title?.textContent).toContain("Shadowmere");
    });

    it("shows capacity used and max", () => {
      ui.open("Shadowmere", [makeItem()], 1, 10);
      const cap = document.querySelector(".saddlebag__capacity");
      expect(cap?.textContent).toContain("1");
      expect(cap?.textContent).toContain("10");
    });

    it("renders an empty message when no items", () => {
      ui.open("Shadowmere", [], 0, 10);
      const empty = document.querySelector(".saddlebag__empty");
      expect(empty).not.toBeNull();
    });

    it("renders a row for each item", () => {
      const items = [
        makeItem({ id: "health_potion", name: "Health Potion" }),
        makeItem({ id: "iron_sword", name: "Iron Sword", stackable: false, quantity: 1 }),
      ];
      ui.open("Shadowmere", items, 2, 10);
      const rows = document.querySelectorAll(".saddlebag__row");
      expect(rows.length).toBe(2);
    });

    it("shows quantity for stackable items", () => {
      ui.open("Shadowmere", [makeItem({ quantity: 3, stackable: true })], 1, 10);
      const name = document.querySelector(".saddlebag__row-name");
      expect(name?.textContent).toContain("×3");
    });

    it("does not show quantity marker for non-stackable items", () => {
      ui.open("Shadowmere", [makeItem({ stackable: false, quantity: 1 })], 1, 10);
      const name = document.querySelector(".saddlebag__row-name");
      expect(name?.textContent).not.toContain("×");
    });

    it("sets role=dialog on root element", () => {
      ui.open("Shadowmere", [], 0, 10);
      const root = document.querySelector(".saddlebag");
      expect(root?.getAttribute("role")).toBe("dialog");
    });

    it("sets aria-modal=true", () => {
      ui.open("Shadowmere", [], 0, 10);
      const root = document.querySelector(".saddlebag");
      expect(root?.getAttribute("aria-modal")).toBe("true");
    });
  });

  describe("close()", () => {
    it("hides the dialog", () => {
      ui.open("Shadowmere", [], 0, 10);
      ui.close();
      expect(ui.isVisible).toBe(false);
      const root = document.querySelector(".saddlebag") as HTMLElement;
      expect(root.style.display).toBe("none");
    });

    it("fires the onClose callback", () => {
      const onClose = vi.fn();
      ui.onClose = onClose;
      ui.open("Shadowmere", [], 0, 10);
      ui.close();
      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  describe("onRemoveItem callback", () => {
    it("fires with the item id when Take is clicked", () => {
      const onRemove = vi.fn();
      ui.onRemoveItem = onRemove;
      ui.open("Shadowmere", [makeItem({ id: "health_potion" })], 1, 10);
      const removeBtn = document.querySelector(".saddlebag__row-remove") as HTMLButtonElement;
      removeBtn.click();
      expect(onRemove).toHaveBeenCalledOnce();
      expect(onRemove).toHaveBeenCalledWith("health_potion");
    });
  });

  describe("refresh()", () => {
    it("updates the capacity display", () => {
      ui.open("Shadowmere", [makeItem()], 1, 10);
      ui.refresh([], 0, 10);
      const cap = document.querySelector(".saddlebag__capacity");
      expect(cap?.textContent).toContain("0");
    });

    it("shows empty message when items are removed", () => {
      ui.open("Shadowmere", [makeItem()], 1, 10);
      ui.refresh([], 0, 10);
      const empty = document.querySelector(".saddlebag__empty");
      expect(empty).not.toBeNull();
    });

    it("renders updated item list", () => {
      ui.open("Shadowmere", [makeItem(), makeItem({ id: "iron_sword", name: "Iron Sword" })], 2, 10);
      ui.refresh([makeItem()], 1, 10);
      const rows = document.querySelectorAll(".saddlebag__row");
      expect(rows.length).toBe(1);
    });
  });

  describe("showStatus()", () => {
    it("displays the status message", () => {
      ui.open("Shadowmere", [], 0, 10);
      ui.showStatus("Item taken.");
      const status = document.querySelector(".saddlebag__status");
      expect(status?.textContent).toBe("Item taken.");
    });
  });
});
