// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ContainerUI } from "./container-ui";
import type { ContainerSystem, Container } from "../systems/container-system";
import type { Item } from "../systems/inventory-system";

// ── Fixtures ───────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: "iron_sword",
    name: "Iron Sword",
    description: "A basic sword.",
    stackable: false,
    quantity: 1,
    weight: 3,
    stats: { value: 80 },
    ...overrides,
  } as Item;
}

function makeContainer(overrides: Partial<Container> = {}): Container {
  return {
    id: "chest_01",
    name: "Treasure Chest",
    mesh: {} as never,
    contents: [makeItem()],
    isLocked: false,
    lockDifficulty: 0,
    isOpen: true,
    ...overrides,
  };
}

/** Minimal ContainerSystem stub sufficient for ContainerUI tests. */
function makeSystem(overrides: Partial<ContainerSystem> = {}): ContainerSystem {
  return {
    activeContainer: makeContainer(),
    takeItem: vi.fn((_containerId: string, _itemId: string) => true),
    takeAll: vi.fn((_containerId: string) => 1),
    closeContainer: vi.fn(),
    ...overrides,
  } as unknown as ContainerSystem;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("ContainerUI", () => {
  let ui: ContainerUI;

  beforeEach(() => {
    document.body.innerHTML = "";
    ui = new ContainerUI();
  });

  // ── show() / hide() ──────────────────────────────────────────────────────────

  describe("show()", () => {
    it("creates the root DOM element", () => {
      ui.show();
      expect(document.querySelector(".container-ui")).not.toBeNull();
    });

    it("sets isVisible to true", () => {
      ui.show();
      expect(ui.isVisible).toBe(true);
    });

    it("renders with display flex", () => {
      ui.show();
      const root = document.querySelector(".container-ui") as HTMLElement;
      expect(root.style.display).toBe("flex");
    });

    it("creates the DOM only once on repeated calls", () => {
      ui.show();
      ui.show();
      expect(document.querySelectorAll(".container-ui").length).toBe(1);
    });

    it("root has role=dialog", () => {
      ui.show();
      const root = document.querySelector(".container-ui");
      expect(root?.getAttribute("role")).toBe("dialog");
    });

    it("root has aria-modal=true", () => {
      ui.show();
      const root = document.querySelector(".container-ui");
      expect(root?.getAttribute("aria-modal")).toBe("true");
    });

    it("root has an aria-label", () => {
      ui.show();
      const root = document.querySelector(".container-ui");
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
      const root = document.querySelector(".container-ui") as HTMLElement;
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
      const closeBtn = document.querySelector<HTMLButtonElement>(".container-ui__close");
      closeBtn?.click();
      expect(ui.isVisible).toBe(false);
    });

    it("fires onClose callback when clicked", () => {
      const onClose = vi.fn();
      ui.onClose = onClose;
      ui.show();
      const closeBtn = document.querySelector<HTMLButtonElement>(".container-ui__close");
      closeBtn?.click();
      expect(onClose).toHaveBeenCalledOnce();
    });

    it("has an aria-label", () => {
      ui.show();
      const closeBtn = document.querySelector(".container-ui__close");
      expect(closeBtn?.getAttribute("aria-label")).toBeTruthy();
    });
  });

  // ── update() — title ──────────────────────────────────────────────────────────

  describe("update() — title", () => {
    it("shows the container name in the title", () => {
      ui.show();
      ui.update(makeSystem());
      const title = document.querySelector(".container-ui__title");
      expect(title?.textContent).toBe("Treasure Chest");
    });

    it("falls back to 'Container' when no active container", () => {
      ui.show();
      ui.update(makeSystem({ activeContainer: null }));
      const title = document.querySelector(".container-ui__title");
      expect(title?.textContent).toBe("Container");
    });

    it("shows the correct name for a named corpse container", () => {
      const sys = makeSystem({
        activeContainer: makeContainer({ name: "Bandit's body" }),
      });
      ui.show();
      ui.update(sys);
      const title = document.querySelector(".container-ui__title");
      expect(title?.textContent).toBe("Bandit's body");
    });
  });

  // ── update() — item list ──────────────────────────────────────────────────────

  describe("update() — item list", () => {
    it("renders a row for each container item", () => {
      const sys = makeSystem({
        activeContainer: makeContainer({
          contents: [makeItem(), makeItem({ id: "dagger", name: "Dagger" })],
        }),
      });
      ui.show();
      ui.update(sys);
      const rows = document.querySelectorAll(".container-ui__item-row");
      expect(rows.length).toBe(2);
    });

    it("displays item name in row", () => {
      ui.show();
      ui.update(makeSystem());
      const nameEl = document.querySelector(".container-ui__item-name");
      expect(nameEl?.textContent).toBe("Iron Sword");
    });

    it("shows 'Empty.' when container has no items", () => {
      const sys = makeSystem({
        activeContainer: makeContainer({ contents: [] }),
      });
      ui.show();
      ui.update(sys);
      const empty = document.querySelector(".container-ui__empty");
      expect(empty?.textContent).toBe("Empty.");
    });

    it("shows 'Empty.' when no active container", () => {
      ui.show();
      ui.update(makeSystem({ activeContainer: null }));
      const empty = document.querySelector(".container-ui__empty");
      expect(empty).not.toBeNull();
    });

    it("each item row has role=listitem", () => {
      ui.show();
      ui.update(makeSystem());
      const row = document.querySelector(".container-ui__item-row");
      expect(row?.getAttribute("role")).toBe("listitem");
    });

    it("each item row has data-item-id", () => {
      ui.show();
      ui.update(makeSystem());
      const row = document.querySelector(".container-ui__item-row");
      expect(row?.getAttribute("data-item-id")).toBe("iron_sword");
    });

    it("shows quantity badge for items with quantity > 1", () => {
      const sys = makeSystem({
        activeContainer: makeContainer({
          contents: [makeItem({ id: "arrows", name: "Arrow", quantity: 20 })],
        }),
      });
      ui.show();
      ui.update(sys);
      const qty = document.querySelector(".container-ui__item-qty");
      expect(qty?.textContent).toBe("×20");
    });

    it("quantity badge has aria-label", () => {
      const sys = makeSystem({
        activeContainer: makeContainer({
          contents: [makeItem({ id: "arrows", name: "Arrow", quantity: 5 })],
        }),
      });
      ui.show();
      ui.update(sys);
      const qty = document.querySelector(".container-ui__item-qty");
      expect(qty?.getAttribute("aria-label")).toContain("5");
    });

    it("does not show quantity badge for single items", () => {
      ui.show();
      ui.update(makeSystem());
      const qty = document.querySelector(".container-ui__item-qty");
      expect(qty).toBeNull();
    });

    it("item list has role=list", () => {
      ui.show();
      const list = document.querySelector(".container-ui__item-list");
      expect(list?.getAttribute("role")).toBe("list");
    });

    it("item list has aria-label", () => {
      ui.show();
      const list = document.querySelector(".container-ui__item-list");
      expect(list?.getAttribute("aria-label")).toBeTruthy();
    });

    it("item list has aria-live=polite", () => {
      ui.show();
      const list = document.querySelector(".container-ui__item-list");
      expect(list?.getAttribute("aria-live")).toBe("polite");
    });
  });

  // ── update() — Take All button ────────────────────────────────────────────────

  describe("update() — Take All button", () => {
    it("is enabled when container has items", () => {
      ui.show();
      ui.update(makeSystem());
      const btn = document.querySelector<HTMLButtonElement>(".container-ui__take-all-btn");
      expect(btn?.disabled).toBe(false);
    });

    it("is disabled when container is empty", () => {
      const sys = makeSystem({
        activeContainer: makeContainer({ contents: [] }),
      });
      ui.show();
      ui.update(sys);
      const btn = document.querySelector<HTMLButtonElement>(".container-ui__take-all-btn");
      expect(btn?.disabled).toBe(true);
    });

    it("is disabled when no active container", () => {
      ui.show();
      ui.update(makeSystem({ activeContainer: null }));
      const btn = document.querySelector<HTMLButtonElement>(".container-ui__take-all-btn");
      expect(btn?.disabled).toBe(true);
    });

    it("has aria-disabled=false when enabled", () => {
      ui.show();
      ui.update(makeSystem());
      const btn = document.querySelector(".container-ui__take-all-btn");
      expect(btn?.getAttribute("aria-disabled")).toBe("false");
    });

    it("has aria-disabled=true when disabled", () => {
      const sys = makeSystem({
        activeContainer: makeContainer({ contents: [] }),
      });
      ui.show();
      ui.update(sys);
      const btn = document.querySelector(".container-ui__take-all-btn");
      expect(btn?.getAttribute("aria-disabled")).toBe("true");
    });

    it("is initially disabled before update() is called", () => {
      ui.show();
      const btn = document.querySelector<HTMLButtonElement>(".container-ui__take-all-btn");
      expect(btn?.disabled).toBe(true);
    });
  });

  // ── callbacks ─────────────────────────────────────────────────────────────────

  describe("onTakeItem callback", () => {
    it("fires onTakeItem with item id when Take button clicked", () => {
      const onTakeItem = vi.fn();
      ui.onTakeItem = onTakeItem;
      ui.show();
      ui.update(makeSystem());
      const btn = document.querySelector<HTMLButtonElement>(".container-ui__take-btn");
      btn?.click();
      expect(onTakeItem).toHaveBeenCalledWith("iron_sword");
    });

    it("fires correct item id for each row's button", () => {
      const onTakeItem = vi.fn();
      ui.onTakeItem = onTakeItem;
      const sys = makeSystem({
        activeContainer: makeContainer({
          contents: [
            makeItem({ id: "item_a", name: "Item A" }),
            makeItem({ id: "item_b", name: "Item B" }),
          ],
        }),
      });
      ui.show();
      ui.update(sys);
      const btns = document.querySelectorAll<HTMLButtonElement>(".container-ui__take-btn");
      btns[1]?.click();
      expect(onTakeItem).toHaveBeenCalledWith("item_b");
    });
  });

  describe("onTakeAll callback", () => {
    it("fires onTakeAll when Take All button is clicked and enabled", () => {
      const onTakeAll = vi.fn();
      ui.onTakeAll = onTakeAll;
      ui.show();
      ui.update(makeSystem());
      const btn = document.querySelector<HTMLButtonElement>(".container-ui__take-all-btn");
      btn?.click();
      expect(onTakeAll).toHaveBeenCalledOnce();
    });

    it("does not fire onTakeAll when Take All button is disabled", () => {
      const onTakeAll = vi.fn();
      ui.onTakeAll = onTakeAll;
      const sys = makeSystem({
        activeContainer: makeContainer({ contents: [] }),
      });
      ui.show();
      ui.update(sys);
      const btn = document.querySelector<HTMLButtonElement>(".container-ui__take-all-btn");
      btn?.click();
      expect(onTakeAll).not.toHaveBeenCalled();
    });
  });

  // ── re-render on subsequent update() ──────────────────────────────────────────

  describe("re-renders on update()", () => {
    it("updates title on second call", () => {
      ui.show();
      ui.update(makeSystem({ activeContainer: makeContainer({ name: "Old Chest" }) }));
      ui.update(makeSystem({ activeContainer: makeContainer({ name: "New Chest" }) }));
      const title = document.querySelector(".container-ui__title");
      expect(title?.textContent).toBe("New Chest");
    });

    it("reflects item count change on second call", () => {
      ui.show();
      ui.update(makeSystem({
        activeContainer: makeContainer({ contents: [makeItem()] }),
      }));
      ui.update(makeSystem({
        activeContainer: makeContainer({
          contents: [makeItem(), makeItem({ id: "dagger", name: "Dagger" })],
        }),
      }));
      const rows = document.querySelectorAll(".container-ui__item-row");
      expect(rows.length).toBe(2);
    });

    it("shows Empty when items depleted on second update()", () => {
      ui.show();
      ui.update(makeSystem({ activeContainer: makeContainer({ contents: [makeItem()] }) }));
      ui.update(makeSystem({ activeContainer: makeContainer({ contents: [] }) }));
      expect(document.querySelector(".container-ui__empty")).not.toBeNull();
    });

    it("does not duplicate the item list element on repeated update()", () => {
      ui.show();
      ui.update(makeSystem());
      ui.update(makeSystem());
      expect(document.querySelectorAll(".container-ui__item-list").length).toBe(1);
    });
  });

  // ── destroy() ─────────────────────────────────────────────────────────────────

  describe("destroy()", () => {
    it("removes the root element from the DOM", () => {
      ui.show();
      ui.destroy();
      expect(document.querySelector(".container-ui")).toBeNull();
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
      expect(document.querySelector(".container-ui")).not.toBeNull();
      expect(ui.isVisible).toBe(true);
    });
  });
});
