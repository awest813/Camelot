// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { FastTravelUI } from "./fast-travel-ui";
import type { FastTravelOptionView } from "./fast-travel-ui";

// ── Fixtures ───────────────────────────────────────────────────────────────────

function makeOption(overrides: Partial<FastTravelOptionView> = {}): FastTravelOptionView {
  return {
    id: "whiterun",
    name: "Whiterun",
    estimatedHours: 4.5,
    ...overrides,
  };
}

const SAMPLE_OPTIONS: FastTravelOptionView[] = [
  makeOption({ id: "whiterun", name: "Whiterun", estimatedHours: 4.5 }),
  makeOption({ id: "riften", name: "Riften", estimatedHours: 8.0 }),
  makeOption({ id: "solitude", name: "Solitude", estimatedHours: 12.0 }),
];

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("FastTravelUI", () => {
  let ui: FastTravelUI;

  beforeEach(() => {
    document.body.innerHTML = "";
    ui = new FastTravelUI();
  });

  // ── open() ───────────────────────────────────────────────────────────────────

  describe("open()", () => {
    it("creates the root DOM element", () => {
      ui.open(SAMPLE_OPTIONS);
      expect(document.querySelector(".fast-travel")).not.toBeNull();
    });

    it("sets isVisible to true", () => {
      ui.open(SAMPLE_OPTIONS);
      expect(ui.isVisible).toBe(true);
    });

    it("renders with display grid", () => {
      ui.open(SAMPLE_OPTIONS);
      const root = document.querySelector(".fast-travel") as HTMLElement;
      expect(root.style.display).toBe("grid");
    });

    it("creates the DOM only once on repeated calls", () => {
      ui.open(SAMPLE_OPTIONS);
      ui.open(SAMPLE_OPTIONS);
      expect(document.querySelectorAll(".fast-travel").length).toBe(1);
    });

    it("root has role=dialog", () => {
      ui.open(SAMPLE_OPTIONS);
      const root = document.querySelector(".fast-travel");
      expect(root?.getAttribute("role")).toBe("dialog");
    });

    it("root has aria-modal=true", () => {
      ui.open(SAMPLE_OPTIONS);
      const root = document.querySelector(".fast-travel");
      expect(root?.getAttribute("aria-modal")).toBe("true");
    });

    it("root has aria-labelledby pointing to title", () => {
      ui.open(SAMPLE_OPTIONS);
      const root = document.querySelector(".fast-travel");
      const titleId = root?.getAttribute("aria-labelledby") ?? "";
      expect(titleId).toBeTruthy();
      expect(document.getElementById(titleId)).not.toBeNull();
    });

    it("shows title 'Fast Travel'", () => {
      ui.open(SAMPLE_OPTIONS);
      const title = document.querySelector(".fast-travel__title");
      expect(title?.textContent).toBe("Fast Travel");
    });

    it("renders one row per option", () => {
      ui.open(SAMPLE_OPTIONS);
      const rows = document.querySelectorAll(".fast-travel__row");
      expect(rows.length).toBe(SAMPLE_OPTIONS.length);
    });

    it("first option is selected by default", () => {
      ui.open(SAMPLE_OPTIONS);
      const rows = document.querySelectorAll<HTMLButtonElement>(".fast-travel__row");
      expect(rows[0].classList.contains("is-selected")).toBe(true);
    });

    it("first option row has aria-pressed=true", () => {
      ui.open(SAMPLE_OPTIONS);
      const rows = document.querySelectorAll<HTMLButtonElement>(".fast-travel__row");
      expect(rows[0].getAttribute("aria-pressed")).toBe("true");
    });

    it("non-selected rows have aria-pressed=false", () => {
      ui.open(SAMPLE_OPTIONS);
      const rows = document.querySelectorAll<HTMLButtonElement>(".fast-travel__row");
      expect(rows[1].getAttribute("aria-pressed")).toBe("false");
      expect(rows[2].getAttribute("aria-pressed")).toBe("false");
    });

    it("rows show destination name", () => {
      ui.open(SAMPLE_OPTIONS);
      const names = document.querySelectorAll(".fast-travel__row-name");
      expect(names[0].textContent).toBe("Whiterun");
      expect(names[1].textContent).toBe("Riften");
    });

    it("rows show estimated hours", () => {
      ui.open(SAMPLE_OPTIONS);
      const etas = document.querySelectorAll(".fast-travel__row-eta");
      expect(etas[0].textContent).toBe("~4.5h");
    });

    it("status text references the selected destination", () => {
      ui.open(SAMPLE_OPTIONS);
      const status = document.querySelector(".fast-travel__status") as HTMLElement;
      expect(status.textContent).toContain("Whiterun");
    });

    it("status includes estimated hours", () => {
      ui.open(SAMPLE_OPTIONS);
      const status = document.querySelector(".fast-travel__status") as HTMLElement;
      expect(status.textContent).toContain("4.5");
    });

    it("travel button is enabled when options are provided", () => {
      ui.open(SAMPLE_OPTIONS);
      const btn = document.querySelector(".fast-travel__btn--primary") as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });

    it("open() with empty array shows empty message", () => {
      ui.open([]);
      const empty = document.querySelector(".fast-travel__empty");
      expect(empty).not.toBeNull();
    });

    it("travel button is disabled when options list is empty", () => {
      ui.open([]);
      const btn = document.querySelector(".fast-travel__btn--primary") as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it("status prompts exploration when no options", () => {
      ui.open([]);
      const status = document.querySelector(".fast-travel__status") as HTMLElement;
      expect(status.textContent).toContain("Explore");
    });

    it("open() re-renders options on second call", () => {
      ui.open(SAMPLE_OPTIONS);
      ui.open([makeOption({ id: "markarth", name: "Markarth", estimatedHours: 6.0 })]);
      const rows = document.querySelectorAll(".fast-travel__row");
      expect(rows.length).toBe(1);
      expect(rows[0].querySelector(".fast-travel__row-name")?.textContent).toBe("Markarth");
    });
  });

  // ── close() ──────────────────────────────────────────────────────────────────

  describe("close()", () => {
    it("hides the root element", () => {
      ui.open(SAMPLE_OPTIONS);
      ui.close();
      const root = document.querySelector(".fast-travel") as HTMLElement;
      expect(root.style.display).toBe("none");
    });

    it("sets isVisible to false", () => {
      ui.open(SAMPLE_OPTIONS);
      ui.close();
      expect(ui.isVisible).toBe(false);
    });

    it("fires onClose callback", () => {
      const onClose = vi.fn();
      ui.onClose = onClose;
      ui.open(SAMPLE_OPTIONS);
      ui.close();
      expect(onClose).toHaveBeenCalledOnce();
    });

    it("close() is safe to call before open()", () => {
      expect(() => ui.close()).not.toThrow();
    });

    it("does not fire onClose when called before DOM is created", () => {
      const onClose = vi.fn();
      ui.onClose = onClose;
      ui.close();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // ── Cancel button ─────────────────────────────────────────────────────────────

  describe("cancel button", () => {
    it("clicking cancel closes the UI", () => {
      ui.open(SAMPLE_OPTIONS);
      const cancelBtn = Array.from(
        document.querySelectorAll<HTMLButtonElement>(".fast-travel__btn"),
      ).find((b) => b.textContent === "Cancel");
      cancelBtn?.click();
      expect(ui.isVisible).toBe(false);
    });

    it("clicking cancel fires onClose", () => {
      const onClose = vi.fn();
      ui.onClose = onClose;
      ui.open(SAMPLE_OPTIONS);
      const cancelBtn = Array.from(
        document.querySelectorAll<HTMLButtonElement>(".fast-travel__btn"),
      ).find((b) => b.textContent === "Cancel");
      cancelBtn?.click();
      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  // ── Close button (✕) ─────────────────────────────────────────────────────────

  describe("close button", () => {
    it("has aria-label", () => {
      ui.open(SAMPLE_OPTIONS);
      const closeBtn = document.querySelector(".fast-travel__close-btn");
      expect(closeBtn?.getAttribute("aria-label")).toBeTruthy();
    });

    it("clicking ✕ closes the UI", () => {
      ui.open(SAMPLE_OPTIONS);
      const closeBtn = document.querySelector<HTMLButtonElement>(".fast-travel__close-btn");
      closeBtn?.click();
      expect(ui.isVisible).toBe(false);
    });

    it("clicking ✕ fires onClose", () => {
      const onClose = vi.fn();
      ui.onClose = onClose;
      ui.open(SAMPLE_OPTIONS);
      const closeBtn = document.querySelector<HTMLButtonElement>(".fast-travel__close-btn");
      closeBtn?.click();
      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  // ── Destination selection ─────────────────────────────────────────────────────

  describe("destination selection", () => {
    it("clicking a row selects it", () => {
      ui.open(SAMPLE_OPTIONS);
      const rows = document.querySelectorAll<HTMLButtonElement>(".fast-travel__row");
      rows[1].click();
      const updatedRows = document.querySelectorAll<HTMLButtonElement>(".fast-travel__row");
      expect(updatedRows[1].classList.contains("is-selected")).toBe(true);
    });

    it("clicking a row deselects the previously selected row", () => {
      ui.open(SAMPLE_OPTIONS);
      const rows = document.querySelectorAll<HTMLButtonElement>(".fast-travel__row");
      rows[1].click();
      const updatedRows = document.querySelectorAll<HTMLButtonElement>(".fast-travel__row");
      expect(updatedRows[0].classList.contains("is-selected")).toBe(false);
    });

    it("status updates to reflect newly selected destination", () => {
      ui.open(SAMPLE_OPTIONS);
      const rows = document.querySelectorAll<HTMLButtonElement>(".fast-travel__row");
      rows[1].click();
      const status = document.querySelector(".fast-travel__status") as HTMLElement;
      expect(status.textContent).toContain("Riften");
    });

    it("clicking a row updates aria-pressed attributes", () => {
      ui.open(SAMPLE_OPTIONS);
      const rows = document.querySelectorAll<HTMLButtonElement>(".fast-travel__row");
      rows[2].click();
      const updatedRows = document.querySelectorAll<HTMLButtonElement>(".fast-travel__row");
      expect(updatedRows[2].getAttribute("aria-pressed")).toBe("true");
      expect(updatedRows[0].getAttribute("aria-pressed")).toBe("false");
    });
  });

  // ── Travel button ─────────────────────────────────────────────────────────────

  describe("travel button", () => {
    it("clicking Travel fires onTravel with selected id", () => {
      const onTravel = vi.fn();
      ui.onTravel = onTravel;
      ui.open(SAMPLE_OPTIONS);
      const travelBtn = document.querySelector<HTMLButtonElement>(".fast-travel__btn--primary");
      travelBtn?.click();
      expect(onTravel).toHaveBeenCalledWith("whiterun");
    });

    it("fires onTravel with the id of the clicked row", () => {
      const onTravel = vi.fn();
      ui.onTravel = onTravel;
      ui.open(SAMPLE_OPTIONS);
      const rows = document.querySelectorAll<HTMLButtonElement>(".fast-travel__row");
      rows[2].click(); // select Solitude
      const travelBtn = document.querySelector<HTMLButtonElement>(".fast-travel__btn--primary");
      travelBtn?.click();
      expect(onTravel).toHaveBeenCalledWith("solitude");
    });

    it("does not fire onTravel when no destination is selected", () => {
      const onTravel = vi.fn();
      ui.onTravel = onTravel;
      ui.open([]);
      const travelBtn = document.querySelector<HTMLButtonElement>(".fast-travel__btn--primary");
      travelBtn?.click();
      expect(onTravel).not.toHaveBeenCalled();
    });

    it("onTravel defaults to null and does not throw", () => {
      ui.open(SAMPLE_OPTIONS);
      const travelBtn = document.querySelector<HTMLButtonElement>(".fast-travel__btn--primary");
      expect(() => travelBtn?.click()).not.toThrow();
    });
  });

  // ── isVisible flag ────────────────────────────────────────────────────────────

  describe("isVisible", () => {
    it("starts as false", () => {
      expect(ui.isVisible).toBe(false);
    });

    it("is true after open()", () => {
      ui.open(SAMPLE_OPTIONS);
      expect(ui.isVisible).toBe(true);
    });

    it("is false after close()", () => {
      ui.open(SAMPLE_OPTIONS);
      ui.close();
      expect(ui.isVisible).toBe(false);
    });

    it("toggles correctly through multiple open/close cycles", () => {
      ui.open(SAMPLE_OPTIONS);
      expect(ui.isVisible).toBe(true);
      ui.close();
      expect(ui.isVisible).toBe(false);
      ui.open(SAMPLE_OPTIONS);
      expect(ui.isVisible).toBe(true);
    });
  });

  // ── ETA formatting ────────────────────────────────────────────────────────────

  describe("ETA formatting", () => {
    it("formats fractional hours to one decimal place", () => {
      ui.open([makeOption({ id: "d", name: "Dawnstar", estimatedHours: 3.25 })]);
      const eta = document.querySelector(".fast-travel__row-eta") as HTMLElement;
      expect(eta.textContent).toBe("~3.3h");
    });

    it("formats whole-number hours with .0", () => {
      ui.open([makeOption({ id: "w", name: "Windhelm", estimatedHours: 6.0 })]);
      const eta = document.querySelector(".fast-travel__row-eta") as HTMLElement;
      expect(eta.textContent).toBe("~6.0h");
    });
  });
});
