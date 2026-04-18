// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { StandaloneEditorShell, type StandaloneEditorShellCallbacks } from "./standalone-editor-shell";
import type { EditorToolId } from "./editor-hub-ui";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeShell(overrides: Partial<StandaloneEditorShellCallbacks> = {}): StandaloneEditorShell {
  return new StandaloneEditorShell({
    onToolSelect: vi.fn(),
    ...overrides,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("StandaloneEditorShell", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  // ── open / close / isVisible ───────────────────────────────────────────────

  describe("open() / close() / isVisible", () => {
    it("is not visible before open()", () => {
      const shell = makeShell();
      expect(shell.isVisible).toBe(false);
    });

    it("becomes visible after open()", () => {
      const shell = makeShell();
      shell.open();
      expect(shell.isVisible).toBe(true);
    });

    it("creates a .standalone-editor element in the DOM on first open()", () => {
      const shell = makeShell();
      shell.open();
      expect(document.querySelector(".standalone-editor")).not.toBeNull();
    });

    it("hides the panel after close()", () => {
      const shell = makeShell();
      shell.open();
      shell.close();
      expect(shell.isVisible).toBe(false);
    });

    it("fires onClose callback when close() is called", () => {
      const onClose = vi.fn();
      const shell = makeShell();
      shell.onClose = onClose;
      shell.open();
      shell.close();
      expect(onClose).toHaveBeenCalledOnce();
    });

    it("calling open() a second time does not duplicate DOM nodes", () => {
      const shell = makeShell();
      shell.open();
      shell.open();
      expect(document.querySelectorAll(".standalone-editor").length).toBe(1);
    });

    it("re-shows the panel when open() is called after close()", () => {
      const shell = makeShell();
      shell.open();
      shell.close();
      shell.open();
      expect(shell.isVisible).toBe(true);
    });
  });

  // ── toggle() ──────────────────────────────────────────────────────────────

  describe("toggle()", () => {
    it("toggle() opens the shell when closed and returns true", () => {
      const shell = makeShell();
      const result = shell.toggle();
      expect(result).toBe(true);
      expect(shell.isVisible).toBe(true);
    });

    it("toggle() closes the shell when open and returns false", () => {
      const shell = makeShell();
      shell.open();
      const result = shell.toggle();
      expect(result).toBe(false);
      expect(shell.isVisible).toBe(false);
    });
  });

  // ── Escape key ────────────────────────────────────────────────────────────

  describe("Escape key handler", () => {
    it("closes the shell when Escape is pressed while open", () => {
      const shell = makeShell();
      shell.open();
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      expect(shell.isVisible).toBe(false);
    });

    it("fires onClose when Escape closes the shell", () => {
      const onClose = vi.fn();
      const shell = makeShell();
      shell.onClose = onClose;
      shell.open();
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      expect(onClose).toHaveBeenCalledOnce();
    });

    it("does not respond to Escape after the shell is closed", () => {
      const onClose = vi.fn();
      const shell = makeShell();
      shell.onClose = onClose;
      shell.open();
      shell.close();
      onClose.mockClear();
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      expect(onClose).not.toHaveBeenCalled();
    });

    it("re-attaches Escape listener when reopened after being closed", () => {
      const shell = makeShell();
      shell.open();
      shell.close();
      shell.open();
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      expect(shell.isVisible).toBe(false);
    });

    it("does not fire close for non-Escape keys", () => {
      const shell = makeShell();
      shell.open();
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      expect(shell.isVisible).toBe(true);
    });

    it("does not add a duplicate Escape listener on repeated open() calls", () => {
      const onClose = vi.fn();
      const shell = makeShell();
      shell.onClose = onClose;
      shell.open();
      shell.open();
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  // ── Title bar ─────────────────────────────────────────────────────────────

  describe("title bar", () => {
    it("renders the application name", () => {
      const shell = makeShell();
      shell.open();
      const nameEl = document.querySelector(".standalone-editor__app-name");
      expect(nameEl?.textContent).toBe("Camelot Editor");
    });

    it("renders a close button in the title bar", () => {
      const shell = makeShell();
      shell.open();
      const closeBtn = document.querySelector(".standalone-editor__close-btn");
      expect(closeBtn).not.toBeNull();
    });

    it("clicking the close button hides the shell", () => {
      const shell = makeShell();
      shell.open();
      const closeBtn = document.querySelector(".standalone-editor__close-btn") as HTMLButtonElement;
      closeBtn.click();
      expect(shell.isVisible).toBe(false);
    });

    it("renders the four file action buttons (New, Open, Save, Export)", () => {
      const shell = makeShell();
      shell.open();
      const btns = document.querySelectorAll(".standalone-editor__title-btn");
      expect(btns.length).toBe(4);
    });

    it("New button fires onNew callback", () => {
      const onNew = vi.fn();
      const shell = makeShell({ onNew });
      shell.open();
      const btns = document.querySelectorAll<HTMLButtonElement>(".standalone-editor__title-btn");
      btns[0].click();
      expect(onNew).toHaveBeenCalledOnce();
    });

    it("Open button fires onOpen callback", () => {
      const onOpen = vi.fn();
      const shell = makeShell({ onOpen });
      shell.open();
      const btns = document.querySelectorAll<HTMLButtonElement>(".standalone-editor__title-btn");
      btns[1].click();
      expect(onOpen).toHaveBeenCalledOnce();
    });

    it("Save button fires onSave callback", () => {
      const onSave = vi.fn();
      const shell = makeShell({ onSave });
      shell.open();
      const btns = document.querySelectorAll<HTMLButtonElement>(".standalone-editor__title-btn");
      btns[2].click();
      expect(onSave).toHaveBeenCalledOnce();
    });

    it("Export button fires onExport callback", () => {
      const onExport = vi.fn();
      const shell = makeShell({ onExport });
      shell.open();
      const btns = document.querySelectorAll<HTMLButtonElement>(".standalone-editor__title-btn");
      btns[3].click();
      expect(onExport).toHaveBeenCalledOnce();
    });

    it("title bar has a toolbar role on the actions group", () => {
      const shell = makeShell();
      shell.open();
      const toolbar = document.querySelector(".standalone-editor__title-actions");
      expect(toolbar?.getAttribute("role")).toBe("toolbar");
    });

    it("action buttons without callbacks are disabled", () => {
      const shell = makeShell(); // no optional callbacks provided
      shell.open();
      const btns = document.querySelectorAll<HTMLButtonElement>(".standalone-editor__title-btn");
      // All four are disabled because no callbacks were supplied
      btns.forEach(btn => expect(btn.disabled).toBe(true));
    });
  });

  // ── Sidebar navigation ────────────────────────────────────────────────────

  describe("sidebar navigation", () => {
    it("renders a <nav> element with an aria-label", () => {
      const shell = makeShell();
      shell.open();
      const nav = document.querySelector(".standalone-editor__sidebar");
      expect(nav?.tagName).toBe("NAV");
      expect(nav?.getAttribute("aria-label")).toBeTruthy();
    });

    it("renders three section headers (Content, World, Tools)", () => {
      const shell = makeShell();
      shell.open();
      const headers = document.querySelectorAll(".standalone-editor__nav-section-header");
      expect(headers.length).toBe(3);
    });

    it("renders 12 tool navigation items total", () => {
      const shell = makeShell();
      shell.open();
      const items = document.querySelectorAll(".standalone-editor__nav-item");
      expect(items.length).toBe(12);
    });

    it("each nav item carries a data-tool-id attribute", () => {
      const shell = makeShell();
      shell.open();
      const items = document.querySelectorAll<HTMLElement>(".standalone-editor__nav-item");
      items.forEach(item => {
        expect(item.getAttribute("data-tool-id")).toBeTruthy();
      });
    });

    it("clicking a nav item fires onToolSelect with the correct tool ID", () => {
      const onToolSelect = vi.fn();
      const shell = makeShell({ onToolSelect });
      shell.open();
      const questBtn = document.querySelector<HTMLButtonElement>(
        '[data-tool-id="quest"].standalone-editor__nav-item'
      )!;
      questBtn.click();
      expect(onToolSelect).toHaveBeenCalledWith("quest");
    });

    it("clicking a nav item sets it as active (adds --active modifier class)", () => {
      const shell = makeShell();
      shell.open();
      const mapBtn = document.querySelector<HTMLButtonElement>(
        '[data-tool-id="map"].standalone-editor__nav-item'
      )!;
      mapBtn.click();
      expect(mapBtn.classList.contains("standalone-editor__nav-item--active")).toBe(true);
    });

    it("clicking a second nav item deactivates the previous one", () => {
      const shell = makeShell();
      shell.open();
      const mapBtn = document.querySelector<HTMLButtonElement>(
        '[data-tool-id="map"].standalone-editor__nav-item'
      )!;
      const questBtn = document.querySelector<HTMLButtonElement>(
        '[data-tool-id="quest"].standalone-editor__nav-item'
      )!;
      mapBtn.click();
      questBtn.click();
      expect(mapBtn.classList.contains("standalone-editor__nav-item--active")).toBe(false);
      expect(questBtn.classList.contains("standalone-editor__nav-item--active")).toBe(true);
    });
  });

  // ── setActiveSection() ────────────────────────────────────────────────────

  describe("setActiveSection()", () => {
    it("highlights the specified tool nav item", () => {
      const shell = makeShell();
      shell.open();
      shell.setActiveSection("dialogue");
      const btn = document.querySelector<HTMLElement>(
        '[data-tool-id="dialogue"].standalone-editor__nav-item'
      )!;
      expect(btn.classList.contains("standalone-editor__nav-item--active")).toBe(true);
    });

    it("sets aria-current='page' on the active nav item", () => {
      const shell = makeShell();
      shell.open();
      shell.setActiveSection("npc");
      const btn = document.querySelector<HTMLElement>(
        '[data-tool-id="npc"].standalone-editor__nav-item'
      )!;
      expect(btn.getAttribute("aria-current")).toBe("page");
    });

    it("removes aria-current from the previously active item", () => {
      const shell = makeShell();
      shell.open();
      shell.setActiveSection("map");
      shell.setActiveSection("quest");
      const mapBtn = document.querySelector<HTMLElement>(
        '[data-tool-id="map"].standalone-editor__nav-item'
      )!;
      expect(mapBtn.getAttribute("aria-current")).toBeNull();
    });

    it("can be called before open() without throwing (silently no-ops highlight)", () => {
      const shell = makeShell();
      expect(() => shell.setActiveSection("map")).not.toThrow();
    });
  });

  // ── Welcome dashboard ─────────────────────────────────────────────────────

  describe("welcome dashboard", () => {
    it("renders a welcome heading", () => {
      const shell = makeShell();
      shell.open();
      const heading = document.querySelector(".standalone-editor__welcome-heading");
      expect(heading?.textContent).toContain("Welcome");
    });

    it("renders exactly 4 featured tool cards in the welcome grid", () => {
      const shell = makeShell();
      shell.open();
      const cards = document.querySelectorAll(".standalone-editor__welcome-card");
      expect(cards.length).toBe(4);
    });

    it("each featured card carries a data-tool-id attribute", () => {
      const shell = makeShell();
      shell.open();
      const cards = document.querySelectorAll<HTMLElement>(".standalone-editor__welcome-card");
      cards.forEach(card => {
        expect(card.getAttribute("data-tool-id")).toBeTruthy();
      });
    });

    it("clicking a welcome card fires onToolSelect", () => {
      const onToolSelect = vi.fn();
      const shell = makeShell({ onToolSelect });
      shell.open();
      const firstCard = document.querySelector<HTMLButtonElement>(".standalone-editor__welcome-card")!;
      firstCard.click();
      expect(onToolSelect).toHaveBeenCalledOnce();
    });

    it("clicking a welcome card highlights the corresponding sidebar nav item", () => {
      const shell = makeShell();
      shell.open();
      const mapCard = document.querySelector<HTMLButtonElement>(
        '[data-tool-id="map"].standalone-editor__welcome-card'
      )!;
      mapCard.click();
      const mapNavBtn = document.querySelector<HTMLElement>(
        '[data-tool-id="map"].standalone-editor__nav-item'
      )!;
      expect(mapNavBtn.classList.contains("standalone-editor__nav-item--active")).toBe(true);
    });

    it("renders a tip paragraph in the welcome view", () => {
      const shell = makeShell();
      shell.open();
      const tip = document.querySelector(".standalone-editor__welcome-tip");
      expect(tip).not.toBeNull();
      expect(tip?.textContent).toContain("Tip");
    });

    it("welcome region has role='region' and aria-label", () => {
      const shell = makeShell();
      shell.open();
      const region = document.querySelector(".standalone-editor__welcome");
      expect(region?.getAttribute("role")).toBe("region");
      expect(region?.getAttribute("aria-label")).toBeTruthy();
    });
  });

  // ── Status bar ────────────────────────────────────────────────────────────

  describe("setStatus()", () => {
    it("updates the status bar text", () => {
      const shell = makeShell();
      shell.open();
      shell.setStatus("Map loaded — 12 entities");
      const text = document.querySelector(".standalone-editor__status-text");
      expect(text?.textContent).toBe("Map loaded — 12 entities");
    });

    it("default status text contains 'Ready'", () => {
      const shell = makeShell();
      shell.open();
      const text = document.querySelector(".standalone-editor__status-text");
      expect(text?.textContent).toContain("Ready");
    });

    it("error status turns the dot amber", () => {
      const shell = makeShell();
      shell.open();
      shell.setStatus("Validation failed", true);
      const dot = document.querySelector<HTMLElement>(".standalone-editor__status-dot");
      // jsdom normalises hex colours to rgb(); accept either representation
      expect(dot?.style.color).toMatch(/^(#E08830|rgb\(224,\s*136,\s*48\))$/i);
    });

    it("ok status keeps the dot green", () => {
      const shell = makeShell();
      shell.open();
      shell.setStatus("Saved", false);
      const dot = document.querySelector<HTMLElement>(".standalone-editor__status-dot");
      // jsdom normalises hex colours to rgb(); accept either representation
      expect(dot?.style.color).toMatch(/^(#5EC45E|rgb\(94,\s*196,\s*94\))$/i);
    });

    it("status bar has role='status' and aria-live='polite'", () => {
      const shell = makeShell();
      shell.open();
      const bar = document.querySelector(".standalone-editor__status-bar");
      expect(bar?.getAttribute("role")).toBe("status");
      expect(bar?.getAttribute("aria-live")).toBe("polite");
    });
  });

  // ── ARIA / accessibility ──────────────────────────────────────────────────

  describe("ARIA attributes", () => {
    it("root has role='application'", () => {
      const shell = makeShell();
      shell.open();
      const root = document.querySelector(".standalone-editor");
      expect(root?.getAttribute("role")).toBe("application");
    });

    it("root has an aria-label", () => {
      const shell = makeShell();
      shell.open();
      const root = document.querySelector(".standalone-editor");
      expect(root?.getAttribute("aria-label")).toBeTruthy();
    });

    it("main area has an aria-label", () => {
      const shell = makeShell();
      shell.open();
      const main = document.querySelector(".standalone-editor__main");
      expect(main?.getAttribute("aria-label")).toBeTruthy();
    });

    it("close button has an aria-label", () => {
      const shell = makeShell();
      shell.open();
      const btn = document.querySelector(".standalone-editor__close-btn");
      expect(btn?.getAttribute("aria-label")).toBeTruthy();
    });
  });

  // ── Recent projects ──────────────────────────────────────────────────────

  describe("recent projects", () => {
    it("renders a Recent Projects heading on the welcome dashboard", () => {
      const shell = makeShell();
      shell.open();
      const heading = document.querySelector(".standalone-editor__recent-heading");
      expect(heading?.textContent).toBe("Recent Projects");
    });

    it("shows 'No recent projects.' placeholder by default", () => {
      const shell = makeShell();
      shell.open();
      const empty = document.querySelector(".standalone-editor__recent-empty");
      expect(empty?.textContent).toBe("No recent projects.");
    });

    it("renders a recent-list container with role='list'", () => {
      const shell = makeShell();
      shell.open();
      const list = document.querySelector(".standalone-editor__recent-list");
      expect(list?.getAttribute("role")).toBe("list");
    });

    it("updateRecentProjects() renders project cards", () => {
      const shell = makeShell();
      shell.open();
      shell.updateRecentProjects([
        { id: "a", name: "Alpha", lastOpenedAt: "2025-06-01T00:00:00Z" },
        { id: "b", name: "Beta", lastOpenedAt: "2025-05-01T00:00:00Z" },
      ]);
      const items = document.querySelectorAll(".standalone-editor__recent-item");
      expect(items.length).toBe(2);
    });

    it("each recent item carries data-project-id", () => {
      const shell = makeShell();
      shell.open();
      shell.updateRecentProjects([
        { id: "proj1", name: "P", lastOpenedAt: "2025-01-01T00:00:00Z" },
      ]);
      const item = document.querySelector<HTMLElement>(".standalone-editor__recent-item");
      expect(item?.getAttribute("data-project-id")).toBe("proj1");
    });

    it("each recent item shows the project name", () => {
      const shell = makeShell();
      shell.open();
      shell.updateRecentProjects([
        { id: "x", name: "My Mod", lastOpenedAt: "2025-01-01T00:00:00Z" },
      ]);
      const name = document.querySelector(".standalone-editor__recent-name");
      expect(name?.textContent).toBe("My Mod");
    });

    it("shows the file path when present", () => {
      const shell = makeShell();
      shell.open();
      shell.updateRecentProjects([
        { id: "x", name: "A", lastOpenedAt: "2025-01-01T00:00:00Z", filePath: "/home/user/a.json" },
      ]);
      const pathEl = document.querySelector(".standalone-editor__recent-path");
      expect(pathEl?.textContent).toBe("/home/user/a.json");
    });

    it("does not render a path element when filePath is absent", () => {
      const shell = makeShell();
      shell.open();
      shell.updateRecentProjects([
        { id: "x", name: "A", lastOpenedAt: "2025-01-01T00:00:00Z" },
      ]);
      const pathEl = document.querySelector(".standalone-editor__recent-path");
      expect(pathEl).toBeNull();
    });

    it("renders a date span for each item", () => {
      const shell = makeShell();
      shell.open();
      shell.updateRecentProjects([
        { id: "x", name: "A", lastOpenedAt: "2025-06-15T12:00:00Z" },
      ]);
      const dateEl = document.querySelector(".standalone-editor__recent-date");
      expect(dateEl?.textContent).toBeTruthy();
    });

    it("clicking a recent item fires onRecentProjectOpen with the project ID", () => {
      const onRecentProjectOpen = vi.fn();
      const shell = makeShell({ onRecentProjectOpen });
      shell.open();
      shell.updateRecentProjects([
        { id: "abc", name: "X", lastOpenedAt: "2025-01-01T00:00:00Z" },
      ]);
      const openBtn = document.querySelector<HTMLButtonElement>(".standalone-editor__recent-open")!;
      openBtn.click();
      expect(onRecentProjectOpen).toHaveBeenCalledWith("abc");
    });

    it("open button is disabled when no onRecentProjectOpen callback is provided", () => {
      const shell = makeShell();
      shell.open();
      shell.updateRecentProjects([
        { id: "abc", name: "X", lastOpenedAt: "2025-01-01T00:00:00Z" },
      ]);
      const openBtn = document.querySelector<HTMLButtonElement>(".standalone-editor__recent-open")!;
      expect(openBtn.disabled).toBe(true);
    });

    it("clicking the remove button fires onRecentProjectRemove", () => {
      const onRecentProjectRemove = vi.fn();
      const shell = makeShell({ onRecentProjectRemove });
      shell.open();
      shell.updateRecentProjects([
        { id: "xyz", name: "Y", lastOpenedAt: "2025-01-01T00:00:00Z" },
      ]);
      const removeBtn = document.querySelector<HTMLButtonElement>(".standalone-editor__recent-remove")!;
      removeBtn.click();
      expect(onRecentProjectRemove).toHaveBeenCalledWith("xyz");
    });

    it("remove button is disabled when no onRecentProjectRemove callback is provided", () => {
      const shell = makeShell();
      shell.open();
      shell.updateRecentProjects([
        { id: "xyz", name: "Y", lastOpenedAt: "2025-01-01T00:00:00Z" },
      ]);
      const removeBtn = document.querySelector<HTMLButtonElement>(".standalone-editor__recent-remove")!;
      expect(removeBtn.disabled).toBe(true);
    });

    it("calling updateRecentProjects with empty array shows the placeholder", () => {
      const shell = makeShell();
      shell.open();
      shell.updateRecentProjects([
        { id: "a", name: "A", lastOpenedAt: "2025-01-01T00:00:00Z" },
      ]);
      shell.updateRecentProjects([]);
      const empty = document.querySelector(".standalone-editor__recent-empty");
      expect(empty?.textContent).toBe("No recent projects.");
      expect(document.querySelectorAll(".standalone-editor__recent-item").length).toBe(0);
    });

    it("updateRecentProjects replaces previous items", () => {
      const shell = makeShell();
      shell.open();
      shell.updateRecentProjects([
        { id: "a", name: "A", lastOpenedAt: "2025-01-01T00:00:00Z" },
      ]);
      shell.updateRecentProjects([
        { id: "b", name: "B", lastOpenedAt: "2025-01-01T00:00:00Z" },
        { id: "c", name: "C", lastOpenedAt: "2025-01-01T00:00:00Z" },
      ]);
      const items = document.querySelectorAll(".standalone-editor__recent-item");
      expect(items.length).toBe(2);
    });

    it("updateRecentProjects before open() silently no-ops", () => {
      const shell = makeShell();
      expect(() => {
        shell.updateRecentProjects([
          { id: "a", name: "A", lastOpenedAt: "2025-01-01T00:00:00Z" },
        ]);
      }).not.toThrow();
    });

    it("each recent item has role='listitem'", () => {
      const shell = makeShell();
      shell.open();
      shell.updateRecentProjects([
        { id: "a", name: "A", lastOpenedAt: "2025-01-01T00:00:00Z" },
      ]);
      const item = document.querySelector(".standalone-editor__recent-item");
      expect(item?.getAttribute("role")).toBe("listitem");
    });

    it("open button has an appropriate aria-label", () => {
      const onRecentProjectOpen = vi.fn();
      const shell = makeShell({ onRecentProjectOpen });
      shell.open();
      shell.updateRecentProjects([
        { id: "a", name: "My World", lastOpenedAt: "2025-01-01T00:00:00Z" },
      ]);
      const openBtn = document.querySelector<HTMLButtonElement>(".standalone-editor__recent-open")!;
      expect(openBtn.getAttribute("aria-label")).toContain("My World");
    });

    it("remove button has an appropriate aria-label", () => {
      const onRecentProjectRemove = vi.fn();
      const shell = makeShell({ onRecentProjectRemove });
      shell.open();
      shell.updateRecentProjects([
        { id: "a", name: "My World", lastOpenedAt: "2025-01-01T00:00:00Z" },
      ]);
      const removeBtn = document.querySelector<HTMLButtonElement>(".standalone-editor__recent-remove")!;
      expect(removeBtn.getAttribute("aria-label")).toContain("My World");
    });
  });
});
