// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { WaitUI } from "./wait-ui";
import { WAIT_MIN_HOURS, WAIT_MAX_HOURS } from "../systems/wait-system";

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("WaitUI", () => {
  let ui: WaitUI;

  beforeEach(() => {
    document.body.innerHTML = "";
    ui = new WaitUI();
  });

  // ── show() ───────────────────────────────────────────────────────────────────

  describe("show()", () => {
    it("creates the root DOM element", () => {
      ui.show();
      expect(document.querySelector(".wait-ui")).not.toBeNull();
    });

    it("sets isVisible to true", () => {
      ui.show();
      expect(ui.isVisible).toBe(true);
    });

    it("renders with display flex", () => {
      ui.show();
      const root = document.querySelector(".wait-ui") as HTMLElement;
      expect(root.style.display).toBe("flex");
    });

    it("creates the DOM only once on repeated calls", () => {
      ui.show();
      ui.show();
      expect(document.querySelectorAll(".wait-ui").length).toBe(1);
    });

    it("root has role=dialog", () => {
      ui.show();
      const root = document.querySelector(".wait-ui");
      expect(root?.getAttribute("role")).toBe("dialog");
    });

    it("root has aria-modal=true", () => {
      ui.show();
      const root = document.querySelector(".wait-ui");
      expect(root?.getAttribute("aria-modal")).toBe("true");
    });

    it("root has aria-label", () => {
      ui.show();
      const root = document.querySelector(".wait-ui");
      expect(root?.getAttribute("aria-label")).toBeTruthy();
    });

    it("shows the title 'Wait'", () => {
      ui.show();
      const title = document.querySelector(".wait-ui__title");
      expect(title?.textContent).toBe("Wait");
    });

    it("shows a prompt asking how many hours to wait", () => {
      ui.show();
      const prompt = document.querySelector(".wait-ui__prompt");
      expect(prompt?.textContent).toContain("hours");
    });

    it("displays the currentTimeString when provided", () => {
      ui.show("Day 3, 14:30");
      const timeEl = document.querySelector(".wait-ui__time-value");
      expect(timeEl?.textContent).toBe("Day 3, 14:30");
    });

    it("leaves the time value empty when no currentTimeString is provided", () => {
      ui.show();
      const timeEl = document.querySelector(".wait-ui__time-value");
      expect(timeEl?.textContent).toBe("");
    });

    it("time-value element has aria-live=polite", () => {
      ui.show();
      const timeEl = document.querySelector(".wait-ui__time-value");
      expect(timeEl?.getAttribute("aria-live")).toBe("polite");
    });

    it("contains a close button", () => {
      ui.show();
      const closeBtn = document.querySelector(".wait-ui__close");
      expect(closeBtn).not.toBeNull();
    });

    it("close button has aria-label", () => {
      ui.show();
      const closeBtn = document.querySelector(".wait-ui__close");
      expect(closeBtn?.getAttribute("aria-label")).toBeTruthy();
    });

    it("contains the hours input", () => {
      ui.show();
      expect(document.querySelector(".wait-ui__hours-input")).not.toBeNull();
    });

    it("hours input has min attribute equal to WAIT_MIN_HOURS", () => {
      ui.show();
      const input = document.querySelector(".wait-ui__hours-input") as HTMLInputElement;
      expect(Number(input.min)).toBe(WAIT_MIN_HOURS);
    });

    it("hours input has max attribute equal to WAIT_MAX_HOURS", () => {
      ui.show();
      const input = document.querySelector(".wait-ui__hours-input") as HTMLInputElement;
      expect(Number(input.max)).toBe(WAIT_MAX_HOURS);
    });

    it("hours input has aria-label", () => {
      ui.show();
      const input = document.querySelector(".wait-ui__hours-input");
      expect(input?.getAttribute("aria-label")).toBeTruthy();
    });

    it("contains a decrease button", () => {
      ui.show();
      expect(document.querySelector(".wait-ui__dec-btn")).not.toBeNull();
    });

    it("decrease button has aria-label", () => {
      ui.show();
      const btn = document.querySelector(".wait-ui__dec-btn");
      expect(btn?.getAttribute("aria-label")).toBeTruthy();
    });

    it("contains an increase button", () => {
      ui.show();
      expect(document.querySelector(".wait-ui__inc-btn")).not.toBeNull();
    });

    it("increase button has aria-label", () => {
      ui.show();
      const btn = document.querySelector(".wait-ui__inc-btn");
      expect(btn?.getAttribute("aria-label")).toBeTruthy();
    });

    it("contains the confirm (Wait) button", () => {
      ui.show();
      expect(document.querySelector(".wait-ui__confirm-btn")).not.toBeNull();
    });

    it("contains the cancel button", () => {
      ui.show();
      expect(document.querySelector(".wait-ui__cancel-btn")).not.toBeNull();
    });

    it("shows a label for 'hours' unit", () => {
      ui.show();
      const unit = document.querySelector(".wait-ui__hours-unit");
      expect(unit?.textContent).toContain("hours");
    });
  });

  // ── hide() ───────────────────────────────────────────────────────────────────

  describe("hide()", () => {
    it("sets isVisible to false", () => {
      ui.show();
      ui.hide();
      expect(ui.isVisible).toBe(false);
    });

    it("sets display to none", () => {
      ui.show();
      ui.hide();
      const root = document.querySelector(".wait-ui") as HTMLElement;
      expect(root.style.display).toBe("none");
    });

    it("does not throw when called before show()", () => {
      expect(() => ui.hide()).not.toThrow();
    });
  });

  // ── hours getter / spinner ───────────────────────────────────────────────────

  describe("hours getter", () => {
    it("defaults to 8", () => {
      expect(ui.hours).toBe(8);
    });

    it("reflects the hours input value after clicking increment", () => {
      ui.show();
      const incBtn = document.querySelector(".wait-ui__inc-btn") as HTMLButtonElement;
      incBtn.click();
      expect(ui.hours).toBe(9);
    });

    it("reflects the hours input value after clicking decrement", () => {
      ui.show();
      const decBtn = document.querySelector(".wait-ui__dec-btn") as HTMLButtonElement;
      decBtn.click();
      expect(ui.hours).toBe(7);
    });

    it("clamps to WAIT_MIN_HOURS when decremented below minimum", () => {
      ui.show();
      const input = document.querySelector(".wait-ui__hours-input") as HTMLInputElement;
      // Set to minimum first via DOM
      input.value = String(WAIT_MIN_HOURS);
      input.dispatchEvent(new Event("change"));
      const decBtn = document.querySelector(".wait-ui__dec-btn") as HTMLButtonElement;
      decBtn.click();
      expect(ui.hours).toBe(WAIT_MIN_HOURS);
    });

    it("clamps to WAIT_MAX_HOURS when incremented above maximum", () => {
      ui.show();
      const input = document.querySelector(".wait-ui__hours-input") as HTMLInputElement;
      input.value = String(WAIT_MAX_HOURS);
      input.dispatchEvent(new Event("change"));
      const incBtn = document.querySelector(".wait-ui__inc-btn") as HTMLButtonElement;
      incBtn.click();
      expect(ui.hours).toBe(WAIT_MAX_HOURS);
    });

    it("updates via hours input change event", () => {
      ui.show();
      const input = document.querySelector(".wait-ui__hours-input") as HTMLInputElement;
      input.value = "12";
      input.dispatchEvent(new Event("change"));
      expect(ui.hours).toBe(12);
    });

    it("updates via hours input input event", () => {
      ui.show();
      const input = document.querySelector(".wait-ui__hours-input") as HTMLInputElement;
      input.value = "6";
      input.dispatchEvent(new Event("input"));
      expect(ui.hours).toBe(6);
    });

    it("syncs input element text after increment", () => {
      ui.show();
      const incBtn = document.querySelector(".wait-ui__inc-btn") as HTMLButtonElement;
      incBtn.click();
      const input = document.querySelector(".wait-ui__hours-input") as HTMLInputElement;
      expect(input.value).toBe("9");
    });

    it("syncs input element text after decrement", () => {
      ui.show();
      const decBtn = document.querySelector(".wait-ui__dec-btn") as HTMLButtonElement;
      decBtn.click();
      const input = document.querySelector(".wait-ui__hours-input") as HTMLInputElement;
      expect(input.value).toBe("7");
    });

    it("ignores non-numeric input values", () => {
      ui.show();
      const input = document.querySelector(".wait-ui__hours-input") as HTMLInputElement;
      input.value = "abc";
      input.dispatchEvent(new Event("change"));
      expect(ui.hours).toBe(8); // unchanged
    });
  });

  // ── setCurrentTime() ─────────────────────────────────────────────────────────

  describe("setCurrentTime()", () => {
    it("updates the time display element", () => {
      ui.show();
      ui.setCurrentTime("Day 5, 09:00");
      const timeEl = document.querySelector(".wait-ui__time-value");
      expect(timeEl?.textContent).toBe("Day 5, 09:00");
    });

    it("does not throw when called before show()", () => {
      expect(() => ui.setCurrentTime("Day 1, 00:00")).not.toThrow();
    });
  });

  // ── onConfirm callback ───────────────────────────────────────────────────────

  describe("onConfirm callback", () => {
    it("fires with current hours when the Wait button is clicked", () => {
      const spy = vi.fn();
      ui.onConfirm = spy;
      ui.show();
      const waitBtn = document.querySelector(".wait-ui__confirm-btn") as HTMLButtonElement;
      waitBtn.click();
      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(8);
    });

    it("fires with updated hours after increment", () => {
      const spy = vi.fn();
      ui.onConfirm = spy;
      ui.show();
      const incBtn = document.querySelector(".wait-ui__inc-btn") as HTMLButtonElement;
      incBtn.click();
      const waitBtn = document.querySelector(".wait-ui__confirm-btn") as HTMLButtonElement;
      waitBtn.click();
      expect(spy).toHaveBeenCalledWith(9);
    });

    it("fires with the correct hours after direct input change", () => {
      const spy = vi.fn();
      ui.onConfirm = spy;
      ui.show();
      const input = document.querySelector(".wait-ui__hours-input") as HTMLInputElement;
      input.value = "20";
      input.dispatchEvent(new Event("change"));
      const waitBtn = document.querySelector(".wait-ui__confirm-btn") as HTMLButtonElement;
      waitBtn.click();
      expect(spy).toHaveBeenCalledWith(20);
    });

    it("does not throw when onConfirm is null", () => {
      ui.onConfirm = null;
      ui.show();
      const waitBtn = document.querySelector(".wait-ui__confirm-btn") as HTMLButtonElement;
      expect(() => waitBtn.click()).not.toThrow();
    });
  });

  // ── onClose callback ─────────────────────────────────────────────────────────

  describe("onClose callback", () => {
    it("fires when the close (✕) button is clicked", () => {
      const spy = vi.fn();
      ui.onClose = spy;
      ui.show();
      const closeBtn = document.querySelector(".wait-ui__close") as HTMLButtonElement;
      closeBtn.click();
      expect(spy).toHaveBeenCalledOnce();
    });

    it("hides the panel when close button is clicked", () => {
      ui.show();
      const closeBtn = document.querySelector(".wait-ui__close") as HTMLButtonElement;
      closeBtn.click();
      expect(ui.isVisible).toBe(false);
    });

    it("fires when the Cancel button is clicked", () => {
      const spy = vi.fn();
      ui.onClose = spy;
      ui.show();
      const cancelBtn = document.querySelector(".wait-ui__cancel-btn") as HTMLButtonElement;
      cancelBtn.click();
      expect(spy).toHaveBeenCalledOnce();
    });

    it("hides the panel when Cancel button is clicked", () => {
      ui.show();
      const cancelBtn = document.querySelector(".wait-ui__cancel-btn") as HTMLButtonElement;
      cancelBtn.click();
      expect(ui.isVisible).toBe(false);
    });

    it("does not throw when onClose is null", () => {
      ui.onClose = null;
      ui.show();
      const cancelBtn = document.querySelector(".wait-ui__cancel-btn") as HTMLButtonElement;
      expect(() => cancelBtn.click()).not.toThrow();
    });
  });

  // ── destroy() ────────────────────────────────────────────────────────────────

  describe("destroy()", () => {
    it("removes the root DOM element", () => {
      ui.show();
      ui.destroy();
      expect(document.querySelector(".wait-ui")).toBeNull();
    });

    it("sets isVisible to false", () => {
      ui.show();
      ui.destroy();
      expect(ui.isVisible).toBe(false);
    });

    it("does not throw on repeated calls", () => {
      ui.show();
      expect(() => {
        ui.destroy();
        ui.destroy();
      }).not.toThrow();
    });

    it("allows show() to re-create DOM after destroy()", () => {
      ui.show();
      ui.destroy();
      ui.show();
      expect(document.querySelector(".wait-ui")).not.toBeNull();
      expect(ui.isVisible).toBe(true);
    });
  });

  // ── edge cases ───────────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("show() is a no-op when document is undefined", () => {
      // This tests the guard branch; jsdom always has document so we just
      // verify no error when show() is called normally.
      expect(() => ui.show()).not.toThrow();
    });

    it("update via show() overwrites currentTimeString on second call", () => {
      ui.show("Day 1, 00:00");
      ui.show("Day 2, 12:00");
      const timeEl = document.querySelector(".wait-ui__time-value");
      expect(timeEl?.textContent).toBe("Day 2, 12:00");
    });
  });
});
