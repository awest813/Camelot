// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { PickpocketUI } from "./pickpocket-ui";

describe("PickpocketUI", () => {
  let ui: PickpocketUI;

  beforeEach(() => {
    document.body.innerHTML = "";
    ui = new PickpocketUI();
  });

  it("is not visible before show()", () => {
    expect(ui.isVisible).toBe(false);
  });

  it("show() displays the panel with the mark's name", () => {
    ui.show("Guard");
    expect(ui.isVisible).toBe(true);
    const root = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(root.style.display).toBe("flex");
    expect(root.textContent).toContain("Pickpocket Guard");
  });

  it("root has dialog role, modal flag, and label", () => {
    ui.show("Guard");
    const root = document.querySelector('[role="dialog"]')!;
    expect(root.getAttribute("aria-modal")).toBe("true");
    expect(root.getAttribute("aria-label")).toBe("Pickpocket");
  });

  it("update() renders a steal button with the chance per item", () => {
    ui.show("Guard");
    ui.update([
      { id: "coin_purse", name: "Coin Purse", chance: 73 },
      { id: "gold_ring", name: "Gold Ring", chance: 41 },
    ]);
    const buttons = Array.from(document.querySelectorAll("button"))
      .filter((b) => b.textContent?.startsWith("Steal"));
    expect(buttons).toHaveLength(2);
    expect(buttons[0].textContent).toContain("73%");
    expect(buttons[0].getAttribute("aria-label")).toContain("Coin Purse");
  });

  it("clicking steal fires onStealItem with the item id", () => {
    const onSteal = vi.fn();
    ui.onStealItem = onSteal;
    ui.show("Guard");
    ui.update([{ id: "coin_purse", name: "Coin Purse", chance: 73 }]);
    const btn = Array.from(document.querySelectorAll("button"))
      .find((b) => b.textContent?.startsWith("Steal")) as HTMLButtonElement;
    btn.click();
    expect(onSteal).toHaveBeenCalledOnce();
    expect(onSteal).toHaveBeenCalledWith("coin_purse");
  });

  it("shows an empty message when there is nothing to steal", () => {
    ui.show("Guard");
    ui.update([]);
    expect(document.body.textContent).toContain("Nothing worth taking.");
  });

  it("✕ hides and fires onClose (Escape stays in the game cascade)", () => {
    const onClose = vi.fn();
    ui.onClose = onClose;
    ui.show("Guard");
    const closeBtn = document.querySelector('[aria-label="Close pickpocket panel"]') as HTMLButtonElement;
    closeBtn.click();
    expect(ui.isVisible).toBe(false);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("hide() without show() does not throw", () => {
    expect(() => ui.hide()).not.toThrow();
  });

  it("destroy() removes the panel", () => {
    ui.show("Guard");
    ui.destroy();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(ui.isVisible).toBe(false);
  });
});
