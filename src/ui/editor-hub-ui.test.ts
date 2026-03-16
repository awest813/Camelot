// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { EditorHubUI, type EditorToolId } from "./editor-hub-ui";

describe("EditorHubUI", () => {
  let ui: EditorHubUI;
  let openedTools: EditorToolId[];

  beforeEach(() => {
    document.body.innerHTML = "";
    openedTools = [];
    ui = new EditorHubUI({ onOpen: (tool) => openedTools.push(tool) });
  });

  describe("open() / close() / toggle()", () => {
    it("is not visible before open()", () => {
      expect(ui.isVisible).toBe(false);
    });

    it("becomes visible after open()", () => {
      ui.open();
      expect(ui.isVisible).toBe(true);
    });

    it("creates the .editor-hub element in the DOM", () => {
      ui.open();
      expect(document.querySelector(".editor-hub")).not.toBeNull();
    });

    it("renders a card for every tool entry", () => {
      ui.open();
      const cards = document.querySelectorAll(".editor-hub__tool-card");
      // 9 tools defined in TOOLS constant
      expect(cards.length).toBe(9);
    });

    it("hides the panel after close()", () => {
      ui.open();
      ui.close();
      expect(ui.isVisible).toBe(false);
    });

    it("fires onClose callback when close() is called", () => {
      const onClose = vi.fn();
      ui.onClose = onClose;
      ui.open();
      ui.close();
      expect(onClose).toHaveBeenCalledOnce();
    });

    it("toggle() opens when currently closed and returns true", () => {
      const result = ui.toggle();
      expect(result).toBe(true);
      expect(ui.isVisible).toBe(true);
    });

    it("toggle() closes when currently open and returns false", () => {
      ui.open();
      const result = ui.toggle();
      expect(result).toBe(false);
      expect(ui.isVisible).toBe(false);
    });

    it("open() on an already-open hub does not duplicate DOM nodes", () => {
      ui.open();
      ui.open();
      const hubs = document.querySelectorAll(".editor-hub");
      expect(hubs.length).toBe(1);
    });
  });

  describe("Escape key handler", () => {
    it("closes the hub when Escape is pressed while open", () => {
      ui.open();
      expect(ui.isVisible).toBe(true);

      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

      expect(ui.isVisible).toBe(false);
    });

    it("fires onClose callback when Escape closes the hub", () => {
      const onClose = vi.fn();
      ui.onClose = onClose;
      ui.open();

      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

      expect(onClose).toHaveBeenCalledOnce();
    });

    it("does not respond to Escape after the hub is closed", () => {
      const onClose = vi.fn();
      ui.onClose = onClose;
      ui.open();
      ui.close(); // removes the listener

      onClose.mockClear();
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

      expect(onClose).not.toHaveBeenCalled();
    });

    it("re-attaches the Escape listener when opened again after being closed", () => {
      ui.open();
      ui.close();
      ui.open(); // re-open

      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

      expect(ui.isVisible).toBe(false);
    });

    it("does not add a duplicate Escape listener on repeated open() calls", () => {
      const onClose = vi.fn();
      ui.onClose = onClose;
      ui.open();
      ui.open(); // second call while already open

      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

      // onClose should fire exactly once
      expect(onClose).toHaveBeenCalledOnce();
    });

    it("ignores non-Escape key presses while open", () => {
      ui.open();
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      expect(ui.isVisible).toBe(true);
    });
  });

  describe("tool card interaction", () => {
    it("fires onOpen callback with the tool id when a card is clicked", () => {
      ui.open();
      const firstCard = document.querySelector(".editor-hub__tool-card") as HTMLElement;
      firstCard.click();
      expect(openedTools.length).toBe(1);
    });

    it("closes the hub when a tool card is clicked", () => {
      ui.open();
      const firstCard = document.querySelector(".editor-hub__tool-card") as HTMLElement;
      firstCard.click();
      expect(ui.isVisible).toBe(false);
    });
  });

  describe("backdrop click", () => {
    it("closes the hub when clicking the backdrop (root element)", () => {
      ui.open();
      const root = document.querySelector(".editor-hub") as HTMLElement;
      // Simulate a click directly on the backdrop (target === root)
      root.dispatchEvent(new MouseEvent("click", { bubbles: false }));
      expect(ui.isVisible).toBe(false);
    });
  });

  describe("close button", () => {
    it("closes the hub when the × button is clicked", () => {
      ui.open();
      const closeBtn = document.querySelector(".editor-hub__close-btn") as HTMLElement;
      closeBtn.click();
      expect(ui.isVisible).toBe(false);
    });
  });
});
