import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GraphicsSettingsUI } from "./graphics-settings-ui";
import type { QualityTier } from "../systems/graphics-system";

// ── GraphicsSettingsUI ────────────────────────────────────────────────────────

describe("GraphicsSettingsUI", () => {
  let ui: GraphicsSettingsUI;

  beforeEach(() => {
    // jsdom provides document in Vitest
    ui = new GraphicsSettingsUI();
  });

  afterEach(() => {
    ui.destroy();
  });

  it("starts hidden", () => {
    expect(ui.isVisible).toBe(false);
  });

  it("show() makes the dialog visible", () => {
    ui.show("high");
    expect(ui.isVisible).toBe(true);
    const root = document.querySelector(".graphics-settings") as HTMLElement | null;
    expect(root).not.toBeNull();
    expect(root!.style.display).toBe("flex");
  });

  it("hide() hides the dialog", () => {
    ui.show("high");
    ui.hide();
    expect(ui.isVisible).toBe(false);
    const root = document.querySelector(".graphics-settings") as HTMLElement | null;
    expect(root!.style.display).toBe("none");
  });

  it("show() highlights the active tier button", () => {
    ui.show("medium");
    const cards = document.querySelectorAll(".graphics-settings__card");
    const labels = Array.from(cards).map((c) => c.querySelector(".graphics-settings__card-label")!.textContent);
    const activeCards = Array.from(cards).filter((c) => c.classList.contains("is-active"));
    expect(activeCards).toHaveLength(1);
    expect(activeCards[0].querySelector(".graphics-settings__card-label")!.textContent).toBe("Medium");
    // Verify all four tier labels are rendered
    expect(labels).toEqual(expect.arrayContaining(["Low", "Medium", "High", "Ultra"]));
  });

  it("renders four tier cards", () => {
    ui.show("high");
    const cards = document.querySelectorAll(".graphics-settings__card");
    expect(cards).toHaveLength(4);
  });

  it("calls onTierSelect when a tier card is clicked", () => {
    const spy = vi.fn();
    ui.onTierSelect = spy;
    ui.show("high");
    const cards = document.querySelectorAll<HTMLButtonElement>(".graphics-settings__card");
    // Click the first card (Low)
    cards[0].click();
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith("low");
  });

  it("calls onClose when the close button is clicked", () => {
    const spy = vi.fn();
    ui.onClose = spy;
    ui.show("high");
    const closeBtn = document.querySelector<HTMLButtonElement>(".graphics-settings__close")!;
    closeBtn.click();
    expect(spy).toHaveBeenCalledOnce();
  });

  it("calls onClose when backdrop is clicked", () => {
    const spy = vi.fn();
    ui.onClose = spy;
    ui.show("high");
    const root = document.querySelector<HTMLElement>(".graphics-settings")!;
    root.click();
    expect(spy).toHaveBeenCalledOnce();
  });

  it("does not call onTierSelect when clicking backdrop", () => {
    const tierSpy = vi.fn();
    ui.onTierSelect = tierSpy;
    ui.show("high");
    const root = document.querySelector<HTMLElement>(".graphics-settings")!;
    root.click();
    expect(tierSpy).not.toHaveBeenCalled();
  });

  it("destroy() removes the DOM element", () => {
    ui.show("high");
    expect(document.querySelector(".graphics-settings")).not.toBeNull();
    ui.destroy();
    expect(document.querySelector(".graphics-settings")).toBeNull();
    expect(ui.isVisible).toBe(false);
  });

  it("calling show() multiple times reuses the same DOM element", () => {
    ui.show("low");
    ui.show("ultra");
    const roots = document.querySelectorAll(".graphics-settings");
    expect(roots).toHaveLength(1);
  });

  it.each<QualityTier>(["low", "medium", "high", "ultra"])(
    "show('%s') marks only that card as active",
    (tier) => {
      ui.show(tier);
      const activeCards = document.querySelectorAll(".graphics-settings__card.is-active");
      expect(activeCards).toHaveLength(1);
      const active = activeCards[0] as HTMLElement;
      expect(active.querySelector(".graphics-settings__card-label")!.textContent!.toLowerCase()).toBe(tier);
    },
  );
});
