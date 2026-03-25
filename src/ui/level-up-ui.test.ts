// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { LevelUpUI } from "./level-up-ui";
import type { AttributeBonuses } from "../systems/player-level-system";

function makeBonuses(overrides: Partial<AttributeBonuses> = {}): AttributeBonuses {
  return {
    strength:     1,
    endurance:    2,
    intelligence: 1,
    agility:      3,
    willpower:    5,
    speed:        1,
    luck:         2,
    ...overrides,
  };
}

describe("LevelUpUI", () => {
  let ui: LevelUpUI;

  beforeEach(() => {
    document.body.innerHTML = "";
    ui = new LevelUpUI();
  });

  describe("open()", () => {
    it("makes the dialog visible", () => {
      ui.open(2, makeBonuses());
      expect(ui.isVisible).toBe(true);
      const root = document.querySelector(".level-up") as HTMLElement;
      expect(root).not.toBeNull();
      expect(root.style.display).toBe("grid");
    });

    it("renders the correct character level in the heading", () => {
      ui.open(5, makeBonuses());
      const heading = document.querySelector(".level-up__title");
      expect(heading?.textContent).toContain("5");
    });

    it("renders all seven attribute rows", () => {
      ui.open(2, makeBonuses());
      const rows = document.querySelectorAll(".level-up__attr-btn");
      expect(rows.length).toBe(7);
    });

    it("displays the bonus value on each attribute row", () => {
      ui.open(2, makeBonuses({ willpower: 5 }));
      const bonuses = document.querySelectorAll(".level-up__attr-bonus");
      const texts = Array.from(bonuses).map((el) => el.textContent);
      expect(texts).toContain("+5");
    });

    it("disables the confirm button initially", () => {
      ui.open(2, makeBonuses());
      const btn = document.querySelector(".level-up__confirm-btn") as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
      expect(btn.getAttribute("aria-disabled")).toBe("true");
    });

    it("resets selection when opened a second time", () => {
      ui.open(2, makeBonuses());
      // Select two attributes
      const rows = document.querySelectorAll(".level-up__attr-btn") as NodeListOf<HTMLButtonElement>;
      rows[0].click();
      rows[1].click();
      ui.close();
      // Re-open
      ui.open(3, makeBonuses());
      const confirmBtn = document.querySelector(".level-up__confirm-btn") as HTMLButtonElement;
      expect(confirmBtn.disabled).toBe(true);
    });
  });

  describe("close()", () => {
    it("hides the dialog", () => {
      ui.open(2, makeBonuses());
      ui.close();
      expect(ui.isVisible).toBe(false);
      const root = document.querySelector(".level-up") as HTMLElement;
      expect(root.style.display).toBe("none");
    });
  });

  describe("attribute selection", () => {
    it("enables the confirm button after selecting 3 attributes", () => {
      ui.open(2, makeBonuses());
      const rows = document.querySelectorAll(".level-up__attr-btn") as NodeListOf<HTMLButtonElement>;
      rows[0].click();
      rows[1].click();
      rows[2].click();
      const btn = document.querySelector(".level-up__confirm-btn") as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
      expect(btn.getAttribute("aria-disabled")).toBe("false");
    });

    it("marks selected rows with is-selected class", () => {
      ui.open(2, makeBonuses());
      const rows = document.querySelectorAll(".level-up__attr-btn") as NodeListOf<HTMLButtonElement>;
      rows[0].click();
      expect(rows[0].classList.contains("is-selected")).toBe(true);
    });

    it("deselects an already-selected attribute on second click", () => {
      ui.open(2, makeBonuses());
      const rows = document.querySelectorAll(".level-up__attr-btn") as NodeListOf<HTMLButtonElement>;
      rows[0].click();
      expect(rows[0].classList.contains("is-selected")).toBe(true);
      rows[0].click();
      expect(rows[0].classList.contains("is-selected")).toBe(false);
    });

    it("disables unselected rows once 3 attributes are chosen", () => {
      ui.open(2, makeBonuses());
      const rows = document.querySelectorAll(".level-up__attr-btn") as NodeListOf<HTMLButtonElement>;
      rows[0].click();
      rows[1].click();
      rows[2].click();
      expect(rows[3].disabled).toBe(true);
      expect(rows[3].classList.contains("is-disabled")).toBe(true);
      expect(rows[3].getAttribute("aria-disabled")).toBe("true");
    });

    it("does not allow selecting a 4th attribute", () => {
      ui.open(2, makeBonuses());
      const rows = document.querySelectorAll(".level-up__attr-btn") as NodeListOf<HTMLButtonElement>;
      rows[0].click();
      rows[1].click();
      rows[2].click();
      // Attempt to click a 4th — button is disabled, so the handler should not add it
      // Force-click via the original handler would not run on disabled btn
      expect(rows[3].disabled).toBe(true);
    });

    it("re-enables other rows when a selection is removed back to 2", () => {
      ui.open(2, makeBonuses());
      const rows = document.querySelectorAll(".level-up__attr-btn") as NodeListOf<HTMLButtonElement>;
      rows[0].click();
      rows[1].click();
      rows[2].click();
      // Deselect one
      rows[0].click();
      expect(rows[3].disabled).toBe(false);
    });

    it("updates the selection summary text", () => {
      ui.open(2, makeBonuses());
      const rows = document.querySelectorAll(".level-up__attr-btn") as NodeListOf<HTMLButtonElement>;
      const selEl = document.querySelector(".level-up__selection") as HTMLElement;
      rows[0].click(); // Strength
      expect(selEl.textContent).toContain("Strength");
      expect(selEl.textContent).toContain("2 more");
    });
  });

  describe("onConfirm callback", () => {
    it("fires with the three chosen attributes after confirm click", () => {
      const onConfirm = vi.fn();
      ui.onConfirm = onConfirm;
      ui.open(2, makeBonuses());

      const rows = document.querySelectorAll(".level-up__attr-btn") as NodeListOf<HTMLButtonElement>;
      rows[0].click(); // strength
      rows[4].click(); // willpower
      rows[1].click(); // endurance

      const confirmBtn = document.querySelector(".level-up__confirm-btn") as HTMLButtonElement;
      confirmBtn.click();

      expect(onConfirm).toHaveBeenCalledOnce();
      const args = onConfirm.mock.calls[0] as [string, string, string];
      expect(args).toHaveLength(3);
      expect(new Set(args).size).toBe(3); // all three must be distinct
    });

    it("closes the dialog when confirm is clicked", () => {
      ui.onConfirm = vi.fn();
      ui.open(2, makeBonuses());
      const rows = document.querySelectorAll(".level-up__attr-btn") as NodeListOf<HTMLButtonElement>;
      rows[0].click();
      rows[1].click();
      rows[2].click();
      const confirmBtn = document.querySelector(".level-up__confirm-btn") as HTMLButtonElement;
      confirmBtn.click();
      expect(ui.isVisible).toBe(false);
    });

    it("does not fire onConfirm when fewer than 3 attributes are selected", () => {
      const onConfirm = vi.fn();
      ui.onConfirm = onConfirm;
      ui.open(2, makeBonuses());
      const rows = document.querySelectorAll(".level-up__attr-btn") as NodeListOf<HTMLButtonElement>;
      rows[0].click();
      rows[1].click();
      // Only 2 selected; confirm button is disabled so direct call does nothing
      (ui as any)._handleConfirm();
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe("accessibility", () => {
    it("sets role=dialog on the root element", () => {
      ui.open(2, makeBonuses());
      const root = document.querySelector(".level-up");
      expect(root?.getAttribute("role")).toBe("dialog");
    });

    it("sets aria-modal=true", () => {
      ui.open(2, makeBonuses());
      const root = document.querySelector(".level-up");
      expect(root?.getAttribute("aria-modal")).toBe("true");
    });

    it("sets aria-pressed=true on selected rows", () => {
      ui.open(2, makeBonuses());
      const rows = document.querySelectorAll(".level-up__attr-btn") as NodeListOf<HTMLButtonElement>;
      rows[0].click();
      expect(rows[0].getAttribute("aria-pressed")).toBe("true");
    });

    it("sets aria-pressed=false on unselected rows", () => {
      ui.open(2, makeBonuses());
      const rows = document.querySelectorAll(".level-up__attr-btn") as NodeListOf<HTMLButtonElement>;
      expect(rows[1].getAttribute("aria-pressed")).toBe("false");
    });
  });
});
