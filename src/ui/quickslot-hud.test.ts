// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { QuickSlotHUD } from "./quickslot-hud";
import type { QuickSlotSystem, QuickSlotKey } from "../systems/quickslot-system";
import { QUICK_SLOT_KEYS } from "../systems/quickslot-system";
import type { Item } from "../systems/inventory-system";

// ── Fixtures ───────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: "health_potion",
    name: "Health Potion",
    description: "Restores 50 HP.",
    stackable: true,
    quantity: 1,
    weight: 0.3,
    stats: { heal: 50 },
    ...overrides,
  } as Item;
}

type SlotEntry = { key: QuickSlotKey; itemId: string | null; item: Item | null };

function makeSystem(slots: Partial<Record<QuickSlotKey, Item | null>> = {}): QuickSlotSystem {
  const resolved: Record<QuickSlotKey, Item | null> = {
    "7": null,
    "8": null,
    "9": null,
    "0": null,
    ...slots,
  };
  return {
    getSlots: vi.fn((): SlotEntry[] =>
      QUICK_SLOT_KEYS.map((k) => ({
        key: k,
        itemId: resolved[k]?.id ?? null,
        item: resolved[k] ?? null,
      })),
    ),
  } as unknown as QuickSlotSystem;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("QuickSlotHUD", () => {
  let hud: QuickSlotHUD;

  beforeEach(() => {
    document.body.innerHTML = "";
    hud = new QuickSlotHUD();
  });

  // ── show() ───────────────────────────────────────────────────────────────────

  describe("show()", () => {
    it("creates the root DOM element", () => {
      hud.show();
      expect(document.querySelector(".quickslot-hud")).not.toBeNull();
    });

    it("sets isVisible to true", () => {
      hud.show();
      expect(hud.isVisible).toBe(true);
    });

    it("renders with display flex", () => {
      hud.show();
      const root = document.querySelector(".quickslot-hud") as HTMLElement;
      expect(root.style.display).toBe("flex");
    });

    it("creates the DOM only once on repeated show() calls", () => {
      hud.show();
      hud.show();
      expect(document.querySelectorAll(".quickslot-hud").length).toBe(1);
    });

    it("root has role=toolbar", () => {
      hud.show();
      const root = document.querySelector(".quickslot-hud");
      expect(root?.getAttribute("role")).toBe("toolbar");
    });

    it("root has aria-label", () => {
      hud.show();
      const root = document.querySelector(".quickslot-hud");
      expect(root?.getAttribute("aria-label")).toBeTruthy();
    });

    it("renders exactly 4 slot cells", () => {
      hud.show();
      expect(document.querySelectorAll(".quickslot-hud__slot").length).toBe(4);
    });

    it("each cell has data-key for keys 7, 8, 9, 0", () => {
      hud.show();
      const cells = document.querySelectorAll(".quickslot-hud__slot");
      const keys = Array.from(cells).map((c) => c.getAttribute("data-key"));
      expect(keys).toEqual(["7", "8", "9", "0"]);
    });

    it("each cell has role=button", () => {
      hud.show();
      const cells = document.querySelectorAll(".quickslot-hud__slot");
      cells.forEach((cell) => {
        expect(cell.getAttribute("role")).toBe("button");
      });
    });

    it("each cell has tabindex=0", () => {
      hud.show();
      const cells = document.querySelectorAll(".quickslot-hud__slot");
      cells.forEach((cell) => {
        expect(cell.getAttribute("tabindex")).toBe("0");
      });
    });

    it("each cell has an aria-label", () => {
      hud.show();
      const cells = document.querySelectorAll(".quickslot-hud__slot");
      cells.forEach((cell) => {
        expect(cell.getAttribute("aria-label")).toBeTruthy();
      });
    });

    it("each cell shows the key label", () => {
      hud.show();
      QUICK_SLOT_KEYS.forEach((key) => {
        const cell = document.querySelector(`[data-key="${key}"]`);
        const keyLabel = cell?.querySelector(".quickslot-hud__key-label");
        expect(keyLabel?.textContent).toBe(key);
      });
    });

    it("each cell initially shows '—' placeholder", () => {
      hud.show();
      const namels = document.querySelectorAll(".quickslot-hud__item-name");
      namels.forEach((el) => {
        expect(el.textContent).toBe("—");
      });
    });
  });

  // ── hide() ───────────────────────────────────────────────────────────────────

  describe("hide()", () => {
    it("sets isVisible to false", () => {
      hud.show();
      hud.hide();
      expect(hud.isVisible).toBe(false);
    });

    it("sets display to none", () => {
      hud.show();
      hud.hide();
      const root = document.querySelector(".quickslot-hud") as HTMLElement;
      expect(root.style.display).toBe("none");
    });

    it("does not throw when called before show()", () => {
      expect(() => hud.hide()).not.toThrow();
    });
  });

  // ── update() — empty slots ───────────────────────────────────────────────────

  describe("update() — empty slots", () => {
    it("shows '—' for all four empty slots", () => {
      hud.show();
      hud.update(makeSystem());
      const namels = document.querySelectorAll(".quickslot-hud__item-name");
      namels.forEach((el) => {
        expect(el.textContent).toBe("—");
      });
    });

    it("does not render any quantity badges when all slots are empty", () => {
      hud.show();
      hud.update(makeSystem());
      expect(document.querySelectorAll(".quickslot-hud__qty-badge").length).toBe(0);
    });

    it("sets aria-label to 'empty' for each slot", () => {
      hud.show();
      hud.update(makeSystem());
      const cells = document.querySelectorAll(".quickslot-hud__slot");
      cells.forEach((cell) => {
        expect(cell.getAttribute("aria-label")).toContain("empty");
      });
    });

    it("sets data-item-id to empty string for empty slots", () => {
      hud.show();
      hud.update(makeSystem());
      const cells = document.querySelectorAll(".quickslot-hud__slot");
      cells.forEach((cell) => {
        expect(cell.getAttribute("data-item-id")).toBe("");
      });
    });
  });

  // ── update() — bound items ───────────────────────────────────────────────────

  describe("update() — bound items", () => {
    it("shows item name for a bound slot", () => {
      hud.show();
      hud.update(makeSystem({ "7": makeItem({ name: "Health Potion" }) }));
      const cell = document.querySelector('[data-key="7"]');
      expect(cell?.querySelector(".quickslot-hud__item-name")?.textContent).toBe("Health Potion");
    });

    it("sets data-item-id on the cell when bound", () => {
      hud.show();
      hud.update(makeSystem({ "7": makeItem({ id: "hp_01", name: "HP" }) }));
      const cell = document.querySelector('[data-key="7"]');
      expect(cell?.getAttribute("data-item-id")).toBe("hp_01");
    });

    it("updates the aria-label to include the item name", () => {
      hud.show();
      hud.update(makeSystem({ "8": makeItem({ name: "Stamina Potion" }) }));
      const cell = document.querySelector('[data-key="8"]');
      expect(cell?.getAttribute("aria-label")).toContain("Stamina Potion");
    });

    it("does not show a quantity badge for quantity=1 stackable items", () => {
      hud.show();
      hud.update(makeSystem({ "9": makeItem({ quantity: 1, stackable: true }) }));
      const cell = document.querySelector('[data-key="9"]');
      expect(cell?.querySelector(".quickslot-hud__qty-badge")).toBeNull();
    });

    it("shows a quantity badge for stackable items with quantity > 1", () => {
      hud.show();
      hud.update(makeSystem({ "0": makeItem({ quantity: 5, stackable: true }) }));
      const cell = document.querySelector('[data-key="0"]');
      const badge = cell?.querySelector(".quickslot-hud__qty-badge");
      expect(badge).not.toBeNull();
      expect(badge?.textContent).toBe("×5");
    });

    it("quantity badge has aria-label with quantity", () => {
      hud.show();
      hud.update(makeSystem({ "7": makeItem({ quantity: 3, stackable: true }) }));
      const cell = document.querySelector('[data-key="7"]');
      const badge = cell?.querySelector(".quickslot-hud__qty-badge");
      expect(badge?.getAttribute("aria-label")).toContain("3");
    });

    it("does not show a quantity badge for non-stackable items", () => {
      hud.show();
      hud.update(makeSystem({ "7": makeItem({ quantity: 1, stackable: false }) }));
      const cell = document.querySelector('[data-key="7"]');
      expect(cell?.querySelector(".quickslot-hud__qty-badge")).toBeNull();
    });

    it("includes quantity in aria-label when badge is shown", () => {
      hud.show();
      hud.update(makeSystem({ "7": makeItem({ name: "Mana Potion", quantity: 4, stackable: true }) }));
      const cell = document.querySelector('[data-key="7"]');
      const label = cell?.getAttribute("aria-label") ?? "";
      expect(label).toContain("×4");
    });
  });

  // ── update() — diffing / DOM reuse ───────────────────────────────────────────

  describe("update() — diffing", () => {
    it("removes old quantity badge when quantity drops to 1", () => {
      hud.show();
      hud.update(makeSystem({ "7": makeItem({ quantity: 3, stackable: true }) }));
      hud.update(makeSystem({ "7": makeItem({ quantity: 1, stackable: true }) }));
      const cell = document.querySelector('[data-key="7"]');
      expect(cell?.querySelector(".quickslot-hud__qty-badge")).toBeNull();
    });

    it("removes item name when slot is cleared", () => {
      hud.show();
      hud.update(makeSystem({ "7": makeItem({ name: "HP Potion" }) }));
      hud.update(makeSystem({ "7": null }));
      const cell = document.querySelector('[data-key="7"]');
      expect(cell?.querySelector(".quickslot-hud__item-name")?.textContent).toBe("—");
    });

    it("only calls getSlots once per update() call", () => {
      const system = makeSystem({ "7": makeItem() });
      hud.show();
      hud.update(system);
      expect(vi.mocked(system.getSlots)).toHaveBeenCalledTimes(1);
    });

    it("does not mutate the DOM for unchanged slots on second update()", () => {
      const system = makeSystem({ "7": makeItem({ id: "hp", name: "HP", quantity: 1 }) });
      hud.show();
      hud.update(system);
      const nameEl = document.querySelector('[data-key="7"] .quickslot-hud__item-name') as HTMLElement;
      const originalRef = nameEl;
      hud.update(system);
      const nameElAfter = document.querySelector('[data-key="7"] .quickslot-hud__item-name') as HTMLElement;
      // The element reference should be the same object (no re-creation)
      expect(nameElAfter).toBe(originalRef);
    });
  });

  // ── onAssign callback ─────────────────────────────────────────────────────────

  describe("onAssign callback", () => {
    it("fires with the key when an empty slot cell is clicked", () => {
      const spy = vi.fn();
      hud.onAssign = spy;
      hud.show();
      hud.update(makeSystem());
      const cell = document.querySelector('[data-key="7"]') as HTMLElement;
      cell.click();
      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith("7", null);
    });

    it("fires with the bound item ID when a filled slot is clicked", () => {
      const spy = vi.fn();
      hud.onAssign = spy;
      hud.show();
      hud.update(makeSystem({ "9": makeItem({ id: "elixir_01", name: "Elixir" }) }));
      const cell = document.querySelector('[data-key="9"]') as HTMLElement;
      cell.click();
      expect(spy).toHaveBeenCalledWith("9", "elixir_01");
    });

    it("fires on Enter keydown", () => {
      const spy = vi.fn();
      hud.onAssign = spy;
      hud.show();
      hud.update(makeSystem());
      const cell = document.querySelector('[data-key="8"]') as HTMLElement;
      cell.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      expect(spy).toHaveBeenCalledOnce();
    });

    it("fires on Space keydown", () => {
      const spy = vi.fn();
      hud.onAssign = spy;
      hud.show();
      hud.update(makeSystem());
      const cell = document.querySelector('[data-key="0"]') as HTMLElement;
      cell.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
      expect(spy).toHaveBeenCalledOnce();
    });

    it("does not throw when onAssign is null", () => {
      hud.onAssign = null;
      hud.show();
      hud.update(makeSystem());
      const cell = document.querySelector('[data-key="7"]') as HTMLElement;
      expect(() => cell.click()).not.toThrow();
    });
  });

  // ── destroy() ────────────────────────────────────────────────────────────────

  describe("destroy()", () => {
    it("removes the root DOM element", () => {
      hud.show();
      hud.destroy();
      expect(document.querySelector(".quickslot-hud")).toBeNull();
    });

    it("sets isVisible to false", () => {
      hud.show();
      hud.destroy();
      expect(hud.isVisible).toBe(false);
    });

    it("does not throw on repeated calls", () => {
      hud.show();
      expect(() => {
        hud.destroy();
        hud.destroy();
      }).not.toThrow();
    });

    it("allows show() to re-create DOM after destroy()", () => {
      hud.show();
      hud.destroy();
      hud.show();
      expect(document.querySelector(".quickslot-hud")).not.toBeNull();
      expect(hud.isVisible).toBe(true);
    });
  });

  // ── update() without prior show() ────────────────────────────────────────────

  describe("update() without prior show()", () => {
    it("lazily creates the DOM", () => {
      hud.update(makeSystem());
      expect(document.querySelector(".quickslot-hud")).not.toBeNull();
    });

    it("renders all four slots", () => {
      hud.update(makeSystem({ "7": makeItem({ name: "Potion" }) }));
      expect(document.querySelectorAll(".quickslot-hud__slot").length).toBe(4);
    });
  });
});
