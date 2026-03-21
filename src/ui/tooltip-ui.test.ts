// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { TooltipUI } from "./tooltip-ui";

describe("TooltipUI", () => {
  let ui: TooltipUI;

  beforeEach(() => {
    document.body.innerHTML = "";
    vi.useFakeTimers();
    ui = new TooltipUI({ showDelay: 200, hideDelay: 80 });
  });

  afterEach(() => {
    ui.detachAll();
    vi.useRealTimers();
  });

  // ── attach() ──────────────────────────────────────────────────────────────

  describe("attach()", () => {
    it("registers the element (attachedCount increments)", () => {
      const btn = document.createElement("button");
      document.body.appendChild(btn);
      ui.attach(btn, "Hello");
      expect(ui.attachedCount).toBe(1);
    });

    it("creates the tooltip DOM node in document.body", () => {
      const btn = document.createElement("button");
      document.body.appendChild(btn);
      ui.attach(btn, "Hello");
      expect(document.querySelector(".tooltip")).not.toBeNull();
    });

    it("sets aria-describedby on the target element", () => {
      const btn = document.createElement("button");
      document.body.appendChild(btn);
      ui.attach(btn, "Test content");
      expect(btn.getAttribute("aria-describedby")).toBe("camelot-tooltip");
    });

    it("re-attaching the same element replaces previous attachment", () => {
      const btn = document.createElement("button");
      document.body.appendChild(btn);
      ui.attach(btn, "First");
      ui.attach(btn, "Second");
      // Should still have only 1 entry.
      expect(ui.attachedCount).toBe(1);
    });

    it("supports multiple distinct elements", () => {
      const a = document.createElement("button");
      const b = document.createElement("button");
      document.body.appendChild(a);
      document.body.appendChild(b);
      ui.attach(a, "A");
      ui.attach(b, "B");
      expect(ui.attachedCount).toBe(2);
    });
  });

  // ── detach() ──────────────────────────────────────────────────────────────

  describe("detach()", () => {
    it("decrements attachedCount", () => {
      const btn = document.createElement("button");
      document.body.appendChild(btn);
      ui.attach(btn, "Hi");
      ui.detach(btn);
      expect(ui.attachedCount).toBe(0);
    });

    it("removes aria-describedby from the element", () => {
      const btn = document.createElement("button");
      document.body.appendChild(btn);
      ui.attach(btn, "Hi");
      ui.detach(btn);
      expect(btn.hasAttribute("aria-describedby")).toBe(false);
    });

    it("is a no-op for elements that were never attached", () => {
      const btn = document.createElement("button");
      expect(() => ui.detach(btn)).not.toThrow();
    });
  });

  // ── detachAll() ───────────────────────────────────────────────────────────

  describe("detachAll()", () => {
    it("clears all attachments", () => {
      const a = document.createElement("button");
      const b = document.createElement("button");
      document.body.appendChild(a);
      document.body.appendChild(b);
      ui.attach(a, "A");
      ui.attach(b, "B");
      ui.detachAll();
      expect(ui.attachedCount).toBe(0);
    });

    it("removes the tooltip DOM node from the document", () => {
      const btn = document.createElement("button");
      document.body.appendChild(btn);
      ui.attach(btn, "Hi");
      ui.detachAll();
      expect(document.querySelector(".tooltip")).toBeNull();
    });
  });

  // ── isVisible ─────────────────────────────────────────────────────────────

  describe("isVisible", () => {
    it("is false before any mouseenter", () => {
      const btn = document.createElement("button");
      document.body.appendChild(btn);
      ui.attach(btn, "Hi");
      expect(ui.isVisible).toBe(false);
    });

    it("becomes true after the show delay elapses", () => {
      const btn = document.createElement("button");
      document.body.appendChild(btn);
      ui.attach(btn, "Hi");

      btn.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
      expect(ui.isVisible).toBe(false); // still waiting

      vi.advanceTimersByTime(200);
      expect(ui.isVisible).toBe(true);
    });

    it("becomes false after mouseleave + hide delay", () => {
      const btn = document.createElement("button");
      document.body.appendChild(btn);
      ui.attach(btn, "Hi");

      btn.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
      vi.advanceTimersByTime(200);
      expect(ui.isVisible).toBe(true);

      btn.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
      vi.advanceTimersByTime(80);
      expect(ui.isVisible).toBe(false);
    });

    it("becomes true on focus after show delay", () => {
      const btn = document.createElement("button");
      document.body.appendChild(btn);
      ui.attach(btn, "Hi");

      btn.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
      vi.advanceTimersByTime(200);
      expect(ui.isVisible).toBe(true);
    });

    it("hides on blur after hide delay", () => {
      const btn = document.createElement("button");
      document.body.appendChild(btn);
      ui.attach(btn, "Hi");

      btn.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
      vi.advanceTimersByTime(200);
      btn.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
      vi.advanceTimersByTime(80);
      expect(ui.isVisible).toBe(false);
    });
  });

  // ── tooltip content ───────────────────────────────────────────────────────

  describe("tooltip content", () => {
    it("shows the attached content after the delay", () => {
      const btn = document.createElement("button");
      document.body.appendChild(btn);
      ui.attach(btn, "Governs melee damage.");

      btn.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
      vi.advanceTimersByTime(200);

      const tip = document.querySelector(".tooltip") as HTMLElement;
      expect(tip?.textContent).toBe("Governs melee damage.");
    });

    it("has role=tooltip on the tooltip element", () => {
      const btn = document.createElement("button");
      document.body.appendChild(btn);
      ui.attach(btn, "Info");

      const tip = document.querySelector(".tooltip");
      expect(tip?.getAttribute("role")).toBe("tooltip");
    });

    it("has aria-live=polite on the tooltip element", () => {
      const btn = document.createElement("button");
      document.body.appendChild(btn);
      ui.attach(btn, "Info");

      const tip = document.querySelector(".tooltip");
      expect(tip?.getAttribute("aria-live")).toBe("polite");
    });
  });

  // ── updateContent() ───────────────────────────────────────────────────────

  describe("updateContent()", () => {
    it("updates text shown when the tooltip is already visible", () => {
      const btn = document.createElement("button");
      document.body.appendChild(btn);
      ui.attach(btn, "Original");

      btn.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
      vi.advanceTimersByTime(200);

      ui.updateContent(btn, "Updated text");

      const tip = document.querySelector(".tooltip") as HTMLElement;
      expect(tip?.textContent).toBe("Updated text");
    });

    it("is a no-op for elements that are not attached", () => {
      const btn = document.createElement("button");
      expect(() => ui.updateContent(btn, "X")).not.toThrow();
    });
  });

  // ── show delay cancellation ────────────────────────────────────────────────

  describe("rapid mouseenter/mouseleave", () => {
    it("does not show the tooltip if mouseleave fires before the delay", () => {
      const btn = document.createElement("button");
      document.body.appendChild(btn);
      ui.attach(btn, "Hi");

      btn.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
      btn.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
      vi.advanceTimersByTime(300);

      expect(ui.isVisible).toBe(false);
    });
  });
});
