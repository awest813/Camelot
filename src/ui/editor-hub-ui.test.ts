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
      // 12 tools defined in TOOLS constant
      expect(cards.length).toBe(12);
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

  describe("Escape handling", () => {
    // Escape is owned by the game's pause cascade — the hub deliberately has
    // no self-Escape listener (a self-close there double-fired: the cascade
    // saw the hub already closed and paused on top of it).
    it("does not close itself on Escape", () => {
      ui.open();
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      expect(ui.isVisible).toBe(true);
    });

    it("fires onClose when close() is called (by the game cascade)", () => {
      const onClose = vi.fn();
      ui.onClose = onClose;
      ui.open();
      ui.close();
      expect(onClose).toHaveBeenCalledOnce();
    });

    it("repeated open() calls stay open", () => {
      ui.open();
      ui.open(); // second call while already open
      expect(ui.isVisible).toBe(true);
    });

    it("stays open on non-Escape key presses", () => {
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
