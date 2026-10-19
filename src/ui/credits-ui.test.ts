import { afterEach, describe, expect, it, vi } from "vitest";
import { CREDITS_SECTIONS, CreditsUI } from "./credits-ui";

describe("CreditsUI", () => {
  let ui: CreditsUI;

  afterEach(() => {
    ui?.destroy();
  });

  it("lists the shipped attributions", () => {
    const text = CREDITS_SECTIONS.flatMap((section) => section.lines).join("\n");
    expect(text).toContain("Kay Lousberg");
    expect(text).toContain("Quaternius");
    expect(text).toContain("SIL Open Font License");
    expect(text).toContain("Babylon.js");
  });

  it("opens, closes, and restores nothing until asked", () => {
    ui = new CreditsUI();
    const onClose = vi.fn();
    ui.onClose = onClose;
    expect(ui.isVisible).toBe(false);
    ui.show();
    expect(ui.isVisible).toBe(true);
    expect(document.querySelector("#credits-title")?.textContent).toBe("Credits");
    document.querySelector<HTMLButtonElement>(".credits-dialog .graphics-settings__close")?.click();
    expect(ui.isVisible).toBe(false);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
