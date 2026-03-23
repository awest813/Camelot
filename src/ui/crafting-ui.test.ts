// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { CraftingUI } from "./crafting-ui";
import { CraftingSystem } from "../systems/crafting-system";
import type { CraftingRecipe, MaterialInventory } from "../systems/crafting-system";

// ── Fixtures ───────────────────────────────────────────────────────────────────

function makeSword(): CraftingRecipe {
  return {
    id: "iron_sword",
    label: "Iron Sword",
    description: "A sturdy iron sword.",
    category: "weapon",
    requiredMaterials: [
      { materialId: "iron_ingot",     quantity: 2 },
      { materialId: "leather_strips", quantity: 1 },
    ],
    outputItemId: "iron_sword",
    outputItemName: "Iron Sword",
    outputQuantity: 1,
    requiredSkill: 10,
    craftingXp: 15,
  };
}

function makeRing(): CraftingRecipe {
  return {
    id: "gold_ring",
    label: "Gold Ring",
    description: "A simple gold ring.",
    category: "jewelry",
    requiredMaterials: [
      { materialId: "gold_ingot", quantity: 1 },
    ],
    outputItemId: "gold_ring",
    outputItemName: "Gold Ring",
    craftingXp: 10,
  };
}

function makeArmor(): CraftingRecipe {
  return {
    id: "leather_armor",
    label: "Leather Armor",
    category: "armor",
    requiredMaterials: [
      { materialId: "leather", quantity: 5 },
    ],
    outputItemId: "leather_armor",
    outputItemName: "Leather Armor",
  };
}

function makeSystem(): CraftingSystem {
  const sys = new CraftingSystem();
  sys.addRecipe(makeSword());
  sys.addRecipe(makeRing());
  sys.addRecipe(makeArmor());
  return sys;
}

/** Materials that satisfy all three test recipes. */
const FULL_MATS: MaterialInventory = {
  iron_ingot:     2,
  leather_strips: 1,
  gold_ingot:     1,
  leather:        5,
};

/** Materials that satisfy none of the recipes. */
const EMPTY_MATS: MaterialInventory = {};

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("CraftingUI", () => {
  let ui:  CraftingUI;
  let sys: CraftingSystem;

  beforeEach(() => {
    document.body.innerHTML = "";
    ui  = new CraftingUI();
    sys = makeSystem();
  });

  // ── show() / hide() ──────────────────────────────────────────────────────────

  describe("show()", () => {
    it("creates the root DOM element", () => {
      ui.show();
      expect(document.querySelector(".crafting-ui")).not.toBeNull();
    });

    it("sets isVisible to true", () => {
      ui.show();
      expect(ui.isVisible).toBe(true);
    });

    it("renders with display flex", () => {
      ui.show();
      const root = document.querySelector(".crafting-ui") as HTMLElement;
      expect(root.style.display).toBe("flex");
    });

    it("creates the DOM only once on repeated calls", () => {
      ui.show();
      ui.show();
      expect(document.querySelectorAll(".crafting-ui").length).toBe(1);
    });

    it("root has role=dialog", () => {
      ui.show();
      const root = document.querySelector(".crafting-ui");
      expect(root?.getAttribute("role")).toBe("dialog");
    });

    it("root has aria-modal=true", () => {
      ui.show();
      const root = document.querySelector(".crafting-ui");
      expect(root?.getAttribute("aria-modal")).toBe("true");
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
      const root = document.querySelector(".crafting-ui") as HTMLElement;
      expect(root.style.display).toBe("none");
    });
  });

  // ── close button ──────────────────────────────────────────────────────────────

  describe("close button", () => {
    it("hides the panel when clicked", () => {
      ui.show();
      const closeBtn = document.querySelector<HTMLButtonElement>(".crafting-ui__close");
      closeBtn?.click();
      expect(ui.isVisible).toBe(false);
    });

    it("has an aria-label", () => {
      ui.show();
      const closeBtn = document.querySelector(".crafting-ui__close");
      expect(closeBtn?.getAttribute("aria-label")).toBeTruthy();
    });
  });

  // ── update() ─────────────────────────────────────────────────────────────────

  describe("update()", () => {
    it("renders a tab for each category including All", () => {
      ui.show();
      ui.update(sys, FULL_MATS, 15);
      const tabs = document.querySelectorAll(".crafting-ui__tab");
      expect(tabs.length).toBe(5); // All, Weapon, Armor, Jewelry, Misc
    });

    it("marks the All tab as active by default", () => {
      ui.show();
      ui.update(sys, FULL_MATS, 15);
      const tabs = document.querySelectorAll<HTMLButtonElement>(".crafting-ui__tab");
      expect(tabs[0].classList.contains("is-active")).toBe(true);
      expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    });

    it("renders recipe rows for the active category", () => {
      ui.show();
      ui.update(sys, FULL_MATS, 15);
      const rows = document.querySelectorAll(".crafting-ui__recipe-row");
      expect(rows.length).toBe(3); // All category shows all 3
    });

    it("shows recipe names in the list", () => {
      ui.show();
      ui.update(sys, FULL_MATS, 15);
      const names = Array.from(
        document.querySelectorAll(".crafting-ui__recipe-name"),
      ).map((el) => el.textContent);
      expect(names).toContain("Iron Sword");
      expect(names).toContain("Gold Ring");
    });

    it("shows category badge on each row", () => {
      ui.show();
      ui.update(sys, FULL_MATS, 15);
      const badges = document.querySelectorAll(".crafting-ui__category-badge");
      expect(badges.length).toBeGreaterThan(0);
    });

    it("marks rows with can-craft when materials are sufficient", () => {
      ui.show();
      ui.update(sys, FULL_MATS, 15);
      const rows = document.querySelectorAll(".crafting-ui__recipe-row");
      rows.forEach((r) => expect(r.classList.contains("can-craft")).toBe(true));
    });

    it("marks rows with cannot-craft when materials are insufficient", () => {
      ui.show();
      ui.update(sys, EMPTY_MATS, 0);
      const rows = document.querySelectorAll(".crafting-ui__recipe-row");
      rows.forEach((r) => expect(r.classList.contains("cannot-craft")).toBe(true));
    });

    it("shows a detail hint when no recipe is selected", () => {
      ui.show();
      ui.update(sys, FULL_MATS, 15);
      const hint = document.querySelector(".crafting-ui__detail-hint");
      expect(hint).not.toBeNull();
    });

    it("renders an empty message when category has no recipes", () => {
      // Remove all recipes first
      const emptySys = new CraftingSystem();
      ui.show();
      ui.update(emptySys, EMPTY_MATS, 0);
      const empty = document.querySelector(".crafting-ui__empty");
      expect(empty).not.toBeNull();
    });
  });

  // ── tab filtering ─────────────────────────────────────────────────────────────

  describe("tab filtering", () => {
    it("filters the recipe list when a category tab is clicked", () => {
      ui.show();
      ui.update(sys, FULL_MATS, 15);
      const tabs = document.querySelectorAll<HTMLButtonElement>(".crafting-ui__tab");
      // Click "Weapon" tab (index 1)
      tabs[1].click();
      const rows = document.querySelectorAll(".crafting-ui__recipe-row");
      expect(rows.length).toBe(1); // only Iron Sword
    });

    it("updates activeFilter when a tab is clicked", () => {
      ui.show();
      ui.update(sys, FULL_MATS, 15);
      const tabs = document.querySelectorAll<HTMLButtonElement>(".crafting-ui__tab");
      tabs[1].click();
      expect(ui.activeFilter).toBe("weapon");
    });

    it("marks the clicked tab as active", () => {
      ui.show();
      ui.update(sys, FULL_MATS, 15);
      const tabs = document.querySelectorAll<HTMLButtonElement>(".crafting-ui__tab");
      tabs[2].click(); // Armor tab
      const freshTabs = document.querySelectorAll<HTMLButtonElement>(".crafting-ui__tab");
      expect(freshTabs[2].classList.contains("is-active")).toBe(true);
      expect(freshTabs[2].getAttribute("aria-selected")).toBe("true");
    });

    it("clears the selected recipe when changing tab", () => {
      ui.show();
      ui.update(sys, FULL_MATS, 15);
      // Select a recipe first
      const rows = document.querySelectorAll<HTMLElement>(".crafting-ui__recipe-row");
      rows[0].click();
      expect(ui.selectedId).not.toBeNull();
      // Switch tab
      const tabs = document.querySelectorAll<HTMLButtonElement>(".crafting-ui__tab");
      tabs[1].click();
      expect(ui.selectedId).toBeNull();
    });
  });

  // ── recipe selection ──────────────────────────────────────────────────────────

  describe("recipe selection", () => {
    it("selecting a recipe sets selectedId", () => {
      ui.show();
      ui.update(sys, FULL_MATS, 15);
      const rows = document.querySelectorAll<HTMLElement>(".crafting-ui__recipe-row");
      rows[0].click();
      expect(ui.selectedId).not.toBeNull();
    });

    it("shows the recipe title in the detail pane after selection", () => {
      ui.show();
      ui.update(sys, FULL_MATS, 15);
      const rows = document.querySelectorAll<HTMLElement>(".crafting-ui__recipe-row");
      rows[0].click(); // Iron Sword is first
      const title = document.querySelector(".crafting-ui__detail-title");
      expect(title?.textContent).toBeTruthy();
    });

    it("shows material rows in the detail pane", () => {
      ui.show();
      ui.update(sys, FULL_MATS, 15);
      const rows = document.querySelectorAll<HTMLElement>(".crafting-ui__recipe-row");
      rows[0].click();
      const mats = document.querySelectorAll(".crafting-ui__mat-row");
      expect(mats.length).toBeGreaterThan(0);
    });

    it("marks material rows with mat-ok when available", () => {
      ui.show();
      ui.update(sys, FULL_MATS, 15);
      // Select iron sword
      const rows = document.querySelectorAll<HTMLElement>("[data-recipe-id='iron_sword']");
      rows[0].click();
      const mats = document.querySelectorAll(".crafting-ui__mat-row");
      mats.forEach((m) => expect(m.classList.contains("mat-ok")).toBe(true));
    });

    it("marks material rows with mat-missing when insufficient", () => {
      ui.show();
      ui.update(sys, EMPTY_MATS, 0);
      const rows = document.querySelectorAll<HTMLElement>("[data-recipe-id='iron_sword']");
      rows[0].click();
      const mats = document.querySelectorAll(".crafting-ui__mat-row");
      mats.forEach((m) =>
        expect(m.classList.contains("mat-missing")).toBe(true),
      );
    });

    it("shows the output item name in the detail pane", () => {
      ui.show();
      ui.update(sys, FULL_MATS, 15);
      const rows = document.querySelectorAll<HTMLElement>("[data-recipe-id='iron_sword']");
      rows[0].click();
      const output = document.querySelector(".crafting-ui__detail-output");
      expect(output?.textContent).toContain("Iron Sword");
    });

    it("shows skill requirement when present", () => {
      ui.show();
      ui.update(sys, FULL_MATS, 15);
      const rows = document.querySelectorAll<HTMLElement>("[data-recipe-id='iron_sword']");
      rows[0].click();
      const skillEl = document.querySelector(".crafting-ui__detail-skill");
      expect(skillEl).not.toBeNull();
      expect(skillEl?.textContent).toContain("10");
    });

    it("marks skill requirement as skill-met when player meets it", () => {
      ui.show();
      ui.update(sys, FULL_MATS, 15);
      const rows = document.querySelectorAll<HTMLElement>("[data-recipe-id='iron_sword']");
      rows[0].click();
      const skillEl = document.querySelector(".crafting-ui__detail-skill");
      expect(skillEl?.classList.contains("skill-met")).toBe(true);
    });

    it("marks skill requirement as skill-missing when player is under-skilled", () => {
      ui.show();
      ui.update(sys, FULL_MATS, 5); // skill=5, required=10
      const rows = document.querySelectorAll<HTMLElement>("[data-recipe-id='iron_sword']");
      rows[0].click();
      const skillEl = document.querySelector(".crafting-ui__detail-skill");
      expect(skillEl?.classList.contains("skill-missing")).toBe(true);
    });

    it("marks selected row with is-selected class", () => {
      ui.show();
      ui.update(sys, FULL_MATS, 15);
      const rows = document.querySelectorAll<HTMLElement>(".crafting-ui__recipe-row");
      rows[0].click();
      const updatedRow = document.querySelectorAll(".crafting-ui__recipe-row")[0];
      expect(updatedRow.classList.contains("is-selected")).toBe(true);
    });
  });

  // ── onCraft callback ──────────────────────────────────────────────────────────

  describe("onCraft callback", () => {
    it("fires with the recipe id when Craft is clicked", () => {
      ui.show();
      ui.update(sys, FULL_MATS, 15);
      const fn = vi.fn();
      ui.onCraft = fn;
      const rows = document.querySelectorAll<HTMLElement>("[data-recipe-id='iron_sword']");
      rows[0].click();
      const craftBtn = document.querySelector<HTMLButtonElement>(".crafting-ui__craft-btn");
      craftBtn?.click();
      expect(fn).toHaveBeenCalledWith("iron_sword");
    });

    it("does not fire when the craft button is disabled", () => {
      ui.show();
      ui.update(sys, EMPTY_MATS, 0);
      const fn = vi.fn();
      ui.onCraft = fn;
      const rows = document.querySelectorAll<HTMLElement>("[data-recipe-id='iron_sword']");
      rows[0].click();
      const craftBtn = document.querySelector<HTMLButtonElement>(".crafting-ui__craft-btn");
      craftBtn?.click();
      expect(fn).not.toHaveBeenCalled();
    });

    it("enables the craft button when materials and skill are sufficient", () => {
      ui.show();
      ui.update(sys, FULL_MATS, 15);
      const rows = document.querySelectorAll<HTMLElement>("[data-recipe-id='iron_sword']");
      rows[0].click();
      const craftBtn = document.querySelector<HTMLButtonElement>(".crafting-ui__craft-btn");
      expect(craftBtn?.disabled).toBe(false);
    });

    it("disables the craft button when materials are insufficient", () => {
      ui.show();
      ui.update(sys, EMPTY_MATS, 0);
      const rows = document.querySelectorAll<HTMLElement>("[data-recipe-id='iron_sword']");
      rows[0].click();
      const craftBtn = document.querySelector<HTMLButtonElement>(".crafting-ui__craft-btn");
      expect(craftBtn?.disabled).toBe(true);
    });
  });

  // ── craft count display ───────────────────────────────────────────────────────

  describe("craft count", () => {
    it("shows craft count on recipe row after crafting", () => {
      // Simulate one successful craft by restoring a snapshot
      sys.craft("iron_sword", FULL_MATS, 15);
      ui.show();
      ui.update(sys, FULL_MATS, 15);
      const count = document.querySelector(".crafting-ui__craft-count");
      expect(count).not.toBeNull();
      expect(count?.textContent).toContain("1");
    });

    it("shows craft count in detail pane after selecting a crafted recipe", () => {
      sys.craft("iron_sword", FULL_MATS, 15);
      ui.show();
      ui.update(sys, FULL_MATS, 15);
      const rows = document.querySelectorAll<HTMLElement>("[data-recipe-id='iron_sword']");
      rows[0].click();
      const countEl = document.querySelector(".crafting-ui__detail-count");
      expect(countEl?.textContent).toContain("1");
    });
  });

  // ── accessibility ─────────────────────────────────────────────────────────────

  describe("accessibility", () => {
    it("tablist has aria-label", () => {
      ui.show();
      const tablist = document.querySelector("[role='tablist']");
      expect(tablist?.getAttribute("aria-label")).toBeTruthy();
    });

    it("tab buttons have role=tab", () => {
      ui.show();
      ui.update(sys, FULL_MATS, 15);
      const tabs = document.querySelectorAll(".crafting-ui__tab");
      tabs.forEach((t) => expect(t.getAttribute("role")).toBe("tab"));
    });

    it("recipe list container has role=list", () => {
      ui.show();
      const list = document.querySelector(".crafting-ui__list");
      expect(list?.getAttribute("role")).toBe("list");
    });

    it("recipe rows have role=listitem", () => {
      ui.show();
      ui.update(sys, FULL_MATS, 15);
      const rows = document.querySelectorAll(".crafting-ui__recipe-row");
      rows.forEach((r) => expect(r.getAttribute("role")).toBe("listitem"));
    });

    it("detail pane has aria-live=polite", () => {
      ui.show();
      const detail = document.querySelector(".crafting-ui__detail");
      expect(detail?.getAttribute("aria-live")).toBe("polite");
    });

    it("material qty spans have aria-label", () => {
      ui.show();
      ui.update(sys, FULL_MATS, 15);
      const rows = document.querySelectorAll<HTMLElement>("[data-recipe-id='iron_sword']");
      rows[0].click();
      const qtySpans = document.querySelectorAll(".crafting-ui__mat-qty");
      qtySpans.forEach((q) =>
        expect(q.getAttribute("aria-label")).toBeTruthy(),
      );
    });
  });

  // ── destroy() ─────────────────────────────────────────────────────────────────

  describe("destroy()", () => {
    it("removes the root element from the DOM", () => {
      ui.show();
      ui.destroy();
      expect(document.querySelector(".crafting-ui")).toBeNull();
    });

    it("sets isVisible to false", () => {
      ui.show();
      ui.destroy();
      expect(ui.isVisible).toBe(false);
    });

    it("does not throw when called before show()", () => {
      expect(() => ui.destroy()).not.toThrow();
    });

    it("resets selectedId to null", () => {
      ui.show();
      ui.update(sys, FULL_MATS, 15);
      const rows = document.querySelectorAll<HTMLElement>(".crafting-ui__recipe-row");
      rows[0].click();
      ui.destroy();
      expect(ui.selectedId).toBeNull();
    });

    it("resets activeFilter to all", () => {
      ui.show();
      ui.update(sys, FULL_MATS, 15);
      const tabs = document.querySelectorAll<HTMLButtonElement>(".crafting-ui__tab");
      tabs[1].click(); // switch to weapon
      ui.destroy();
      expect(ui.activeFilter).toBe("all");
    });
  });
});
