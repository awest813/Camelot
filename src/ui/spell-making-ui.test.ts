// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { SpellMakingUI } from "./spell-making-ui";
import type { SpellMakingForgeRequest } from "./spell-making-ui";

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Simple cost function that sums magnitude across components. */
const simpleCost = (components: { magnitude: number }[]): number =>
  components.reduce((sum, c) => sum + c.magnitude, 0) * 5;

function makeUI(): SpellMakingUI {
  return new SpellMakingUI(simpleCost);
}

function openAndGetForgeBtn(): HTMLButtonElement {
  return document.querySelector<HTMLButtonElement>(".spell-making__btn--primary")!;
}

function setNameInput(value: string): void {
  const input = document.querySelector<HTMLInputElement>(".spell-making__input");
  if (input) {
    input.value = value;
    input.dispatchEvent(new Event("input"));
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("SpellMakingUI", () => {
  let ui: SpellMakingUI;

  beforeEach(() => {
    document.body.innerHTML = "";
    ui = makeUI();
  });

  // ── open() ───────────────────────────────────────────────────────────────────

  describe("open()", () => {
    it("creates the root DOM element", () => {
      ui.open();
      expect(document.querySelector(".spell-making")).not.toBeNull();
    });

    it("sets isVisible to true", () => {
      ui.open();
      expect(ui.isVisible).toBe(true);
    });

    it("renders with display grid", () => {
      ui.open();
      const root = document.querySelector(".spell-making") as HTMLElement;
      expect(root.style.display).toBe("grid");
    });

    it("creates the DOM only once on repeated calls", () => {
      ui.open();
      ui.open();
      expect(document.querySelectorAll(".spell-making").length).toBe(1);
    });

    it("root has role=dialog", () => {
      ui.open();
      const root = document.querySelector(".spell-making");
      expect(root?.getAttribute("role")).toBe("dialog");
    });

    it("root has aria-modal=true", () => {
      ui.open();
      const root = document.querySelector(".spell-making");
      expect(root?.getAttribute("aria-modal")).toBe("true");
    });

    it("root has aria-labelledby pointing to title element", () => {
      ui.open();
      const root = document.querySelector(".spell-making");
      const titleId = root?.getAttribute("aria-labelledby") ?? "";
      expect(titleId).toBeTruthy();
      expect(document.getElementById(titleId)).not.toBeNull();
    });

    it("shows title 'Spellmaking Altar'", () => {
      ui.open();
      const title = document.querySelector(".spell-making__title");
      expect(title?.textContent).toBe("Spellmaking Altar");
    });

    it("shows subtitle text", () => {
      ui.open();
      const subtitle = document.querySelector(".spell-making__subtitle");
      expect(subtitle?.textContent).toBeTruthy();
    });

    it("close button has aria-label", () => {
      ui.open();
      const closeBtn = document.querySelector(".spell-making__close-btn");
      expect(closeBtn?.getAttribute("aria-label")).toBeTruthy();
    });

    it("renders spell name input", () => {
      ui.open();
      expect(document.querySelector(".spell-making__input")).not.toBeNull();
    });

    it("name input starts empty on open()", () => {
      ui.open();
      const input = document.querySelector<HTMLInputElement>(".spell-making__input");
      expect(input?.value).toBe("");
    });

    it("name input is cleared when opened a second time", () => {
      ui.open();
      setNameInput("Old Name");
      ui.close();
      ui.open();
      const input = document.querySelector<HTMLInputElement>(".spell-making__input");
      expect(input?.value).toBe("");
    });

    it("renders two component sections", () => {
      ui.open();
      const components = document.querySelectorAll(".spell-making__component");
      expect(components.length).toBe(2);
    });

    it("first component card has title 'Primary Effect'", () => {
      ui.open();
      const titles = document.querySelectorAll(".spell-making__component-title");
      expect(titles[0].textContent).toBe("Primary Effect");
    });

    it("second component card has title 'Secondary Effect'", () => {
      ui.open();
      const titles = document.querySelectorAll(".spell-making__component-title");
      expect(titles[1].textContent).toBe("Secondary Effect");
    });

    it("renders a secondary-effect toggle checkbox", () => {
      ui.open();
      const check = document.querySelector<HTMLInputElement>(".spell-making__check input[type=checkbox]");
      expect(check).not.toBeNull();
    });

    it("secondary-effect checkbox starts unchecked", () => {
      ui.open();
      const check = document.querySelector<HTMLInputElement>(".spell-making__check input[type=checkbox]");
      expect(check?.checked).toBe(false);
    });

    it("renders a cost preview paragraph", () => {
      ui.open();
      expect(document.querySelector(".spell-making__cost")).not.toBeNull();
    });

    it("renders the Forge Spell button", () => {
      ui.open();
      const btn = openAndGetForgeBtn();
      expect(btn).not.toBeNull();
      expect(btn.textContent).toBe("Forge Spell");
    });

    it("renders the Cancel button", () => {
      ui.open();
      const cancelBtn = Array.from(document.querySelectorAll<HTMLButtonElement>(".spell-making__btn")).find(
        (b) => b.textContent === "Cancel",
      );
      expect(cancelBtn).not.toBeNull();
    });
  });

  // ── close() ──────────────────────────────────────────────────────────────────

  describe("close()", () => {
    it("hides the root element", () => {
      ui.open();
      ui.close();
      const root = document.querySelector(".spell-making") as HTMLElement;
      expect(root.style.display).toBe("none");
    });

    it("sets isVisible to false", () => {
      ui.open();
      ui.close();
      expect(ui.isVisible).toBe(false);
    });

    it("fires onClose callback", () => {
      const onClose = vi.fn();
      ui.onClose = onClose;
      ui.open();
      ui.close();
      expect(onClose).toHaveBeenCalledOnce();
    });

    it("close() is safe to call before open()", () => {
      expect(() => ui.close()).not.toThrow();
    });

    it("does not fire onClose before DOM is created", () => {
      const onClose = vi.fn();
      ui.onClose = onClose;
      ui.close();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // ── Cancel button ─────────────────────────────────────────────────────────────

  describe("Cancel button", () => {
    it("clicking Cancel closes the UI", () => {
      ui.open();
      const cancelBtn = Array.from(document.querySelectorAll<HTMLButtonElement>(".spell-making__btn")).find(
        (b) => b.textContent === "Cancel",
      );
      cancelBtn?.click();
      expect(ui.isVisible).toBe(false);
    });

    it("clicking Cancel fires onClose", () => {
      const onClose = vi.fn();
      ui.onClose = onClose;
      ui.open();
      const cancelBtn = Array.from(document.querySelectorAll<HTMLButtonElement>(".spell-making__btn")).find(
        (b) => b.textContent === "Cancel",
      );
      cancelBtn?.click();
      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  // ── Close (✕) button ─────────────────────────────────────────────────────────

  describe("close (✕) button", () => {
    it("clicking ✕ closes the UI", () => {
      ui.open();
      const closeBtn = document.querySelector<HTMLButtonElement>(".spell-making__close-btn");
      closeBtn?.click();
      expect(ui.isVisible).toBe(false);
    });

    it("clicking ✕ fires onClose", () => {
      const onClose = vi.fn();
      ui.onClose = onClose;
      ui.open();
      const closeBtn = document.querySelector<HTMLButtonElement>(".spell-making__close-btn");
      closeBtn?.click();
      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  // ── showStatus() ─────────────────────────────────────────────────────────────

  describe("showStatus()", () => {
    it("updates status text content", () => {
      ui.open();
      ui.showStatus("Spell forged successfully.");
      const status = document.querySelector(".spell-making__status");
      expect(status?.textContent).toBe("Spell forged successfully.");
    });

    it("adds error class when isError is true", () => {
      ui.open();
      ui.showStatus("Enter a spell name.", true);
      const status = document.querySelector(".spell-making__status");
      expect(status?.classList.contains("spell-making__status--error")).toBe(true);
      expect(status?.classList.contains("spell-making__status--ok")).toBe(false);
    });

    it("adds ok class when isError is false", () => {
      ui.open();
      ui.showStatus("Ready to forge.", false);
      const status = document.querySelector(".spell-making__status");
      expect(status?.classList.contains("spell-making__status--ok")).toBe(true);
      expect(status?.classList.contains("spell-making__status--error")).toBe(false);
    });

    it("defaults isError to false", () => {
      ui.open();
      ui.showStatus("Crafting...");
      const status = document.querySelector(".spell-making__status");
      expect(status?.classList.contains("spell-making__status--ok")).toBe(true);
    });

    it("showStatus() is safe to call before open()", () => {
      expect(() => ui.showStatus("test")).not.toThrow();
    });

    it("clears error class when transitioning from error to ok", () => {
      ui.open();
      ui.showStatus("Error!", true);
      ui.showStatus("Fixed.", false);
      const status = document.querySelector(".spell-making__status");
      expect(status?.classList.contains("spell-making__status--error")).toBe(false);
    });
  });

  // ── Forge Spell ───────────────────────────────────────────────────────────────

  describe("Forge Spell button", () => {
    it("fires onForge with spell name and components when name is provided", () => {
      const onForge = vi.fn<(request: SpellMakingForgeRequest) => void>();
      ui.onForge = onForge;
      ui.open();
      setNameInput("Storm Lash");
      openAndGetForgeBtn().click();
      expect(onForge).toHaveBeenCalledOnce();
      const req: SpellMakingForgeRequest = onForge.mock.calls[0][0];
      expect(req.name).toBe("Storm Lash");
      expect(req.components.length).toBeGreaterThanOrEqual(1);
    });

    it("forged request includes at least the primary component", () => {
      const onForge = vi.fn<(request: SpellMakingForgeRequest) => void>();
      ui.onForge = onForge;
      ui.open();
      setNameInput("Frost Bite");
      openAndGetForgeBtn().click();
      const req: SpellMakingForgeRequest = onForge.mock.calls[0][0];
      expect(req.components).toHaveLength(1);
    });

    it("forged request includes two components when secondary is enabled", () => {
      const onForge = vi.fn<(request: SpellMakingForgeRequest) => void>();
      ui.onForge = onForge;
      ui.open();
      setNameInput("Twin Force");
      const check = document.querySelector<HTMLInputElement>(".spell-making__check input[type=checkbox]")!;
      check.checked = true;
      check.dispatchEvent(new Event("change"));
      openAndGetForgeBtn().click();
      const req: SpellMakingForgeRequest = onForge.mock.calls[0][0];
      expect(req.components).toHaveLength(2);
    });

    it("shows error status when name is empty", () => {
      ui.open();
      openAndGetForgeBtn().click();
      const status = document.querySelector(".spell-making__status");
      expect(status?.classList.contains("spell-making__status--error")).toBe(true);
    });

    it("does not fire onForge when name is empty", () => {
      const onForge = vi.fn();
      ui.onForge = onForge;
      ui.open();
      // leave name blank
      openAndGetForgeBtn().click();
      expect(onForge).not.toHaveBeenCalled();
    });

    it("onForge defaults to null and clicking Forge does not throw", () => {
      ui.onForge = null;
      ui.open();
      setNameInput("Any Spell");
      expect(() => openAndGetForgeBtn().click()).not.toThrow();
    });

    it("primary component has magnitude from the magnitude input (default 15)", () => {
      const onForge = vi.fn<(request: SpellMakingForgeRequest) => void>();
      ui.onForge = onForge;
      ui.open();
      setNameInput("Test Spell");
      openAndGetForgeBtn().click();
      const req: SpellMakingForgeRequest = onForge.mock.calls[0][0];
      expect(req.components[0].magnitude).toBe(15);
    });

    it("primary component has school 'destruction' by default", () => {
      const onForge = vi.fn<(request: SpellMakingForgeRequest) => void>();
      ui.onForge = onForge;
      ui.open();
      setNameInput("Fire Spell");
      openAndGetForgeBtn().click();
      const req: SpellMakingForgeRequest = onForge.mock.calls[0][0];
      expect(req.components[0].school).toBe("destruction");
    });

    it("primary component effectType defaults to 'damage'", () => {
      const onForge = vi.fn<(request: SpellMakingForgeRequest) => void>();
      ui.onForge = onForge;
      ui.open();
      setNameInput("Damage Spell");
      openAndGetForgeBtn().click();
      const req: SpellMakingForgeRequest = onForge.mock.calls[0][0];
      expect(req.components[0].effectType).toBe("damage");
    });

    it("primary component includes damageType when effectType is 'damage'", () => {
      const onForge = vi.fn<(request: SpellMakingForgeRequest) => void>();
      ui.onForge = onForge;
      ui.open();
      setNameInput("Shock Spell");
      openAndGetForgeBtn().click();
      const req: SpellMakingForgeRequest = onForge.mock.calls[0][0];
      expect(req.components[0].damageType).toBeDefined();
    });
  });

  // ── Cost preview ─────────────────────────────────────────────────────────────

  describe("cost preview", () => {
    it("shows cost preview after open()", () => {
      ui.open();
      const cost = document.querySelector(".spell-making__cost") as HTMLElement;
      expect(cost.textContent).toContain("gold");
    });

    it("cost preview updates when magnitude input changes", () => {
      ui.open();
      const magnitudeInput = document.querySelector<HTMLInputElement>(
        ".spell-making__component-fields input[type=number]",
      )!;
      const before = document.querySelector(".spell-making__cost")?.textContent ?? "";
      magnitudeInput.value = "50";
      magnitudeInput.dispatchEvent(new Event("input"));
      const after = document.querySelector(".spell-making__cost")?.textContent ?? "";
      expect(before).not.toBe(after);
    });
  });

  // ── isVisible flag ────────────────────────────────────────────────────────────

  describe("isVisible", () => {
    it("starts as false", () => {
      expect(ui.isVisible).toBe(false);
    });

    it("is true after open()", () => {
      ui.open();
      expect(ui.isVisible).toBe(true);
    });

    it("is false after close()", () => {
      ui.open();
      ui.close();
      expect(ui.isVisible).toBe(false);
    });

    it("toggles correctly through multiple open/close cycles", () => {
      ui.open();
      expect(ui.isVisible).toBe(true);
      ui.close();
      expect(ui.isVisible).toBe(false);
      ui.open();
      expect(ui.isVisible).toBe(true);
    });
  });
});
